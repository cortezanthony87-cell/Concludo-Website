import { describe, it, expect } from 'bun:test';
import { PINNED_DESTINATIONS, destinationsInGroup } from '../src/lib/workspace/workspaceNav';
import { CRM_TAB_GROUPS, crmDestinationsInGroup } from '../src/lib/crm/moduleNav';

describe('Account Privacy, Meeting Output, and Project Files Verification', () => {
  it('Sidebar: Workspace sidebar Work has Meeting output at /meeting-output and NOT Communicate', () => {
    const workItems = destinationsInGroup('Work');
    const meetingOutput = workItems.find((d) => d.path === '/meeting-output');
    expect(meetingOutput).toBeDefined();
    expect(meetingOutput?.label).toBe('Meeting output');

    const sidebarComm = workItems.find((d) => d.path === '/crm/communicate');
    expect(sidebarComm).toBeUndefined();
  });

  it('CRM Tab Row: Communicate remains present under Work cluster in CRM', () => {
    const crmWorkItems = crmDestinationsInGroup('Work');
    const commTab = crmWorkItems.find((d) => d.path === '/crm/communicate');
    expect(commTab).toBeDefined();
    expect(commTab?.label).toBe('Communicate');
  });

  it('Strict Brand & Language Rules: Zero em dashes and zero en dashes', async () => {
    const fs = await import('node:fs/promises');
    const files = [
      '/tmp/Concludo-Website/app/src/pages/MeetingOutputPage.tsx',
      '/tmp/Concludo-Website/app/src/components/projects/ProjectFilesSection.tsx',
      '/tmp/Concludo-Website/app/src/lib/notifications/userNotificationsClient.ts',
      '/tmp/Concludo-Website/app/src/lib/projects/projectFilesClient.ts',
    ];

    for (const f of files) {
      const content = await fs.readFile(f, 'utf-8');
      expect(content).not.toContain('—'); // em dash
      expect(content).not.toContain('–'); // en dash
    }
  });
});
