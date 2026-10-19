/**
 * Communication Hub write operations for Release 0.
 *
 * Follows Concludo CRM Rules:
 * 1. Every write goes through the existing commit() path. No new write path.
 * 2. Copilot and any agent write only to crm_proposals.
 * 3. Australian English throughout. No em dashes or en dashes in interface text.
 */

import { commit, newId } from '../stage5/writes';
import { CrmContext, CrmRefused, requireRole } from '../repositories/repository';
import { AttentionCondition, CrmWorkspaceData, Proposal, ProposalKind, ProposedChange, RelationshipSignalState } from '../domain';
import { CommMessage } from './types';
import { HUB_MESSAGES } from './data';

export interface CreateHubMessageArgs {
  context: CrmContext;
  data: CrmWorkspaceData;
  conversationId: string;
  body: string;
  authorName: string;
  authorInitials: string;
  fileAttachment?: {
    name: string;
    sizePhrase: string;
    versionPhrase: string;
    accessPhrase: string;
    type: 'pdf' | 'doc' | 'xls' | 'ppt' | 'file';
    dataUrl?: string;
  };
}

/**
 * Creates a message in an internal record room.
 * Every write is checked, validated, and audited via commit().
 */
export function createHubMessage(args: CreateHubMessageArgs): CommMessage {
  const { context, data, conversationId, body, authorName, authorInitials, fileAttachment } = args;

  return commit<CommMessage>({
    context,
    data,
    role: 'crm_contributor',
    doing: 'post a message to an internal record room',
    eventType: 'comm_message_created',
    subjectTable: 'comm_messages',
    before: null,
    detail: `Message posted in conversation ${conversationId}`,
    subjectId: (msg) => msg.id,
    apply: () => {
      const msg: CommMessage = {
        id: newId('msg'),
        crmWorkspaceId: context.workspaceId,
        conversationId,
        authorKind: 'user',
        authorId: context.userId,
        authorName,
        authorInitials,
        authorOrg: 'Kestrel Advisory',
        isExternal: false,
        body: body.trim(),
        bodyFormat: 'plain',
        reactions: [],
        threadRepliesCount: 0,
        lastReplyAt: undefined,
        fileAttachment: fileAttachment || undefined,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      };
      HUB_MESSAGES.push(msg);
      return msg;
    },
  });
}

export interface ProposeHubUpdateArgs {
  context: CrmContext;
  data: CrmWorkspaceData;
  proposalKind?: ProposalKind;
  headline: string;
  rationale: string;
  changes: ProposedChange[];
}

/**
 * Copilot creates a proposal.
 * Rule 2: Copilot and any agent write only to crm_proposals.
 */
export function proposeHubUpdate(args: ProposeHubUpdateArgs): Proposal {
  const { context, data, proposalKind = 'record_commitment', headline, rationale, changes } = args;

  return commit<Proposal>({
    context,
    data,
    role: 'crm_contributor',
    doing: 'record an AI proposal',
    eventType: 'proposal_created',
    subjectTable: 'crm_proposals',
    before: null,
    detail: headline,
    subjectId: (p) => p.id,
    apply: () => {
      const proposal: Proposal = {
        id: newId('prop'),
        crmWorkspaceId: context.workspaceId,
        proposalKind,
        headline: headline.trim(),
        rationale: rationale.trim(),
        subjectTable: 'crm_commitments',
        subjectId: null,
        changes,
        confidence: 'high',
        evidenceId: null,
        modelVersion: 'concludo-copilot-r0',
        promptVersion: '1.0',
        state: 'awaiting_confirmation',
        isDestructive: false,
        proposedAt: new Date().toISOString(),
        appliedAt: null,
        applicationResult: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        deletedBy: null,
        purgeAfter: null,
      };
      data.proposals.push(proposal);
      return proposal;
    },
  });
}

export interface DismissAttentionConditionArgs {
  context: CrmContext;
  data: CrmWorkspaceData;
  conditionId: string;
  reason: string;
  organisationId?: string;
  conditionName?: AttentionCondition;
}

/**
 * Dismisses an attention condition with a stated reason.
 * Preserves human-in-the-loop auditability and updates relationship signal state.
 */
export function dismissAttentionCondition(args: DismissAttentionConditionArgs): { id: string; reason: string } {
  const { context, data, conditionId, reason, organisationId = 'org-northbridge-ind' } = args;

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    throw new CrmRefused(
      'invalid',
      'A reason of a few words is not a reason. Write the sentence somebody reading this account in three months would need.'
    );
  }

  return commit<{ id: string; reason: string }>({
    context,
    data,
    role: 'crm_contributor',
    doing: 'dismiss an attention condition',
    eventType: 'attention_condition_dismissed',
    subjectTable: 'crm_relationship_signals',
    before: null,
    detail: `Condition ${conditionId} dismissed: ${trimmedReason}`,
    subjectId: () => conditionId,
    apply: () => {
      if (Array.isArray(data.relationshipSignals)) {
        const row: RelationshipSignalState = {
          id: newId('rsig'),
          crmWorkspaceId: context.workspaceId,
          organisationId,
          condition: args.conditionName || 'single_contact_dependency',
          state: 'dismissed',
          reason: trimmedReason,
          decidedBy: context.userId,
          decidedAt: context.now,
          expiresAt: new Date(Date.parse(context.now) + 90 * 86_400_000).toISOString(),
          detailAtDecision: `Condition ${conditionId} dismissed in Communication Hub`,
          computedAt: null,
          createdAt: context.now,
          updatedAt: context.now,
        };
        data.relationshipSignals.push(row);
      }
      return { id: conditionId, reason: trimmedReason };
    },
  });
}
