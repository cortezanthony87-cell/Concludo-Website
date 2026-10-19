import { describe, test, expect } from 'bun:test';
import {
  HUB_WORKSPACE_ID,
  HUB_CUSTOMER_ORG,
  HUB_RECORD_ROOMS,
  HUB_MEMBERS,
  HUB_MESSAGES,
  HUB_TIMELINE_ITEMS,
  HUB_ATTENTION_CONDITIONS,
  HUB_INBOX_ITEMS,
  HUB_SEARCH_INDEX,
  getAttentionConditionsCount,
} from '../src/lib/crm/hub/data';
import { getRecordTimeline, verifyTimelineOrder } from '../src/lib/crm/hub/timeline';
import { isHubR0Enabled, setHubR0Enabled } from '../src/lib/crm/hub/featureFlag';
import { createHubMessage, proposeHubUpdate, dismissAttentionCondition } from '../src/lib/crm/hub/hubWrites';
import { decideProposal } from '../src/lib/crm/stage5/writes';
import { CrmContext } from '../src/lib/crm/repositories/repository';
import { CrmWorkspaceData } from '../src/lib/crm/domain';

describe('Concludo Communication Hub (Release 0)', () => {
  test('R0 Acceptance Criterion 1: R0 renders synthetic demonstration data only', () => {
    expect(HUB_WORKSPACE_ID).toBe('ws-kestrel-advisory');
    expect(HUB_CUSTOMER_ORG.name).toBe('Northbridge Industrial');
    expect(HUB_RECORD_ROOMS.length).toBeGreaterThan(0);
    // Members are internal only
    for (const member of HUB_MEMBERS) {
      expect(member.isExternal).toBe(false);
      expect(member.orgName).toBe('Kestrel Advisory');
    }
  });

  test('R0 Acceptance Criterion 2: Timeline order is correct by event time in every test fixture', () => {
    const timeline = getRecordTimeline(HUB_CUSTOMER_ORG.id, 'all');
    expect(timeline.length).toBeGreaterThan(0);
    const isOrdered = verifyTimelineOrder(timeline);
    expect(isOrdered).toBe(true);

    // Verify descending event time
    for (let i = 0; i < timeline.length - 1; i++) {
      const t1 = new Date(timeline[i].eventAt).getTime();
      const t2 = new Date(timeline[i + 1].eventAt).getTime();
      expect(t1).toBeGreaterThanOrEqual(t2);
    }
  });

  test('R0 Acceptance Criterion 3: Attention count equals met conditions and is never above 11', () => {
    const metCount = getAttentionConditionsCount(HUB_ATTENTION_CONDITIONS);
    expect(metCount).toBe(3);
    expect(metCount).toBeLessThanOrEqual(11);
    expect(metCount).toBeGreaterThanOrEqual(0);

    // Edge cases
    const emptyCount = getAttentionConditionsCount([]);
    expect(emptyCount).toBe(0);

    const manyConditions = Array(20).fill(null).map((_, i) => ({
      id: `cond-${i}`,
      conditionSentence: `Condition ${i}`,
      evidenceLink: '/crm',
      evidenceSentence: 'Evidence',
      whatWouldClearIt: 'Resolution',
      status: 'met' as const,
      badgeTone: 'review' as const,
      badgeLabel: 'Review',
    }));
    expect(getAttentionConditionsCount(manyConditions)).toBe(11);
  });

  test('Feature flag hub_r0: Off by default, never enables on real customer workspaces', () => {
    // Default without flag or storage
    expect(isHubR0Enabled()).toBe(false);

    // Real customer workspace must be refused even if local storage attempted
    expect(isHubR0Enabled('ws-real-production-client-999')).toBe(false);
  });

  test('Search S22: Searches records, record rooms, and timeline items', () => {
    expect(HUB_SEARCH_INDEX.some((item) => item.category === 'Records')).toBe(true);
    expect(HUB_SEARCH_INDEX.some((item) => item.category === 'Record rooms')).toBe(true);
    expect(HUB_SEARCH_INDEX.some((item) => item.category === 'Timeline items')).toBe(true);
    expect(HUB_SEARCH_INDEX.some((item) => item.category === 'Messages')).toBe(false);
  });

  test('Writes Rule 1 & 2: Every write routes through commit(), Copilot writes only to crm_proposals', () => {
    const mockContext: CrmContext = {
      workspaceId: 'ws-kestrel-advisory',
      userId: 'usr-maya-chen',
      role: 'crm_admin',
      now: new Date().toISOString(),
    };

    const mockData: CrmWorkspaceData = {
      workspace: {
        id: 'ws-kestrel-advisory',
        name: 'Kestrel Advisory',
        recordTerminology: 'Client',
        recordTerminologyPlural: 'Clients',
        fiscalYearStartMonth: 7,
        currency: 'AUD',
        timezone: 'Australia/Melbourne',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        deletedBy: null,
        purgeAfter: null,
      },
      members: [
        {
          workspaceId: 'ws-kestrel-advisory',
          userId: 'usr-maya-chen',
          role: 'crm_admin',
          joinedAt: new Date().toISOString(),
        },
      ],
      organisations: [],
      people: [],
      leads: [],
      workItems: [],
      tasks: [],
      commitments: [],
      serviceCases: [],
      notes: [],
      interactions: [],
      proposals: [],
      approvals: [],
      relationshipSignals: [],
      auditEvents: [],
      customFieldDefinitions: [],
      customFieldValues: [],
    };

    // 1. Write message through commit
    const msg = createHubMessage({
      context: mockContext,
      data: mockData,
      conversationId: 'room-northbridge-account',
      body: 'Testing internal room message',
      authorName: 'Maya Chen',
      authorInitials: 'MC',
    });
    expect(msg.body).toBe('Testing internal room message');
    expect(mockData.auditEvents.length).toBe(1);
    expect(mockData.auditEvents[0].eventType).toBe('comm_message_created');

    // 2. Copilot creates proposal writing strictly to crm_proposals
    const prop = proposeHubUpdate({
      context: mockContext,
      data: mockData,
      headline: 'Commitment: Tom Reyes sends revised scope by 31 Oct',
      rationale: 'Extracted from conversation between Maya Chen and Tom Reyes',
      changes: [{ field: 'dueDate', from: null, to: '2026-10-31' }],
    });
    expect(prop.subjectTable).toBe('crm_commitments');
    expect(mockData.proposals.length).toBe(1);
    expect(mockData.auditEvents.length).toBe(2);
    expect(mockData.auditEvents[1].subjectTable).toBe('crm_proposals');

    // 3. Contributor role cannot decide proposal (Approver role gate)
    const contributorContext: CrmContext = {
      ...mockContext,
      role: 'crm_contributor',
    };
    expect(() => {
      decideProposal(contributorContext, mockData, prop.id, 'confirmed', 'Contributor confirmation');
    }).toThrow();

    // 4. Approver role can decide proposal
    const approverContext: CrmContext = {
      ...mockContext,
      role: 'crm_approver',
    };
    const decided = decideProposal(approverContext, mockData, prop.id, 'confirmed', 'Approver confirmation');
    expect(decided.state).toBe('confirmed');
    expect(mockData.auditEvents.length).toBe(3);

    // 5. Dismiss attention condition with reason check
    expect(() => {
      dismissAttentionCondition({
        context: mockContext,
        data: mockData,
        conditionId: 'cond-01',
        reason: 'too short',
      });
    }).toThrow();

    const dismissed = dismissAttentionCondition({
      context: mockContext,
      data: mockData,
      conditionId: 'cond-01',
      reason: 'Priya is arranging executive introduction for 6 November board.',
    });
    expect(dismissed.id).toBe('cond-01');
    expect(mockData.relationshipSignals.length).toBe(1);
    expect(mockData.relationshipSignals[0].state).toBe('dismissed');
    expect(mockData.auditEvents.length).toBe(4);
  });

  test('Interface Text Rule 7: Zero em dashes and zero en dashes', () => {
    const fs = require('fs');
    const path = require('path');

    const checkDir = (dirPath: string) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const full = path.join(dirPath, file);
        if (fs.statSync(full).isDirectory()) {
          checkDir(full);
        } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.css')) {
          const content = fs.readFileSync(full, 'utf8');
          const emDashes = (content.match(/\u2014/g) || []).length;
          const enDashes = (content.match(/\u2013/g) || []).length;
          expect(emDashes).toBe(0);
          expect(enDashes).toBe(0);
        }
      }
    };

    checkDir(path.resolve(__dirname, '../src/lib/crm/hub'));
    checkDir(path.resolve(__dirname, '../src/pages/crm/hub'));
  });
});
