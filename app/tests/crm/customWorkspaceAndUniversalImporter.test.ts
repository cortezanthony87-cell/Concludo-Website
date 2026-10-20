import { describe, expect, it } from 'bun:test';
import {
  createFreshWorkspaceData,
  isAuthenticWorkspace,
  saveCustomWorkspace,
  workspaceToDataset,
} from '../../src/lib/crm/customWorkspaceStore';
import {
  commitParsedDocumentToCrm,
  parseDelimitedText,
  guessRecordKindAndMappings,
  parseDocument,
} from '../../src/lib/crm/documentImporter';
import { sessionWorkspace, subscribeToWrites } from '../../src/lib/crm/stage5/session';
import { composeToday } from '../../src/lib/crm/today';
import { parseCrmViewState } from '../../src/lib/crm/viewState';

describe('Custom Authentic CRM & Universal Importer', () => {
  it('creates fresh organisation CRM with zero example or synthetic records', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Cortez Mowing & Garden Maintenance',
      workspaceName: 'Cortez Operations CRM',
      depth: 'small_team',
      recordTerminology: 'job',
      linkedProjectId: 'proj-123',
      linkedProjectTitle: 'Cortez Mowing Garden Maintenance Project',
    });

    // Metadata
    expect(fresh.workspace.name).toBe('Cortez Operations CRM');
    expect((fresh.workspace as any).isAuthentic).toBe(true);
    expect((fresh.workspace as any).linkedProjectId).toBe('proj-123');
    expect((fresh.workspace as any).linkedProjectTitle).toBe('Cortez Mowing Garden Maintenance Project');
    expect(isAuthenticWorkspace(fresh.workspace.id)).toBe(true);

    // Strict zero demo content guarantee
    expect(fresh.people.length).toBe(0);
    expect(fresh.leads.length).toBe(0);
    expect(fresh.workItems.length).toBe(0);
    expect(fresh.activities.length).toBe(0);
    expect(fresh.commitments.length).toBe(0);
    expect(fresh.proposals.length).toBe(0);
    expect(fresh.tasks.length).toBe(0);
    expect(fresh.serviceCases.length).toBe(0);
    expect(fresh.accountPlans.length).toBe(0);

    // Only the created organisation exists
    expect(fresh.organisations.length).toBe(1);
    expect(fresh.organisations[0].name).toBe('Cortez Mowing & Garden Maintenance');
  });

  it('ensures zero synthetic reminders, proposals or notifications appear in fresh dataset', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Melbourne Commercial Partners',
    });
    const dataset = workspaceToDataset(fresh);
    const viewState = parseCrmViewState('');

    const today = composeToday(dataset, viewState);

    expect(today.awaitingConfirmation).toBe(0);
    expect(today.panels.every((p) => p.items.length === 0)).toBe(true);
    expect(today.cards.every((c) => c.count === 0)).toBe(true);
    expect(today.allClear).toBe(true);
    expect(dataset.people.length).toBe(0);
    expect(dataset.records.length).toBe(0);
    expect(dataset.commitments.length).toBe(0);
    expect(dataset.proposals.length).toBe(0);
  });

  it('parses delimited spreadsheet files and maps columns correctly', () => {
    const csv = [
      'Full Name,Email,Phone,Company,Role',
      'Dev Raman,dev.raman@melbourne.example,0491 570 156,Melbourne Garden Group,Director',
      'Sarah Jenkins,sarah.j@cbd.example,0491 570 200,CBD Retail,Manager',
    ].join('\n');

    const { headers, rows } = parseDelimitedText(csv);
    expect(headers).toEqual(['Full Name', 'Email', 'Phone', 'Company', 'Role']);
    expect(rows.length).toBe(2);
    expect(rows[0]['Full Name']).toBe('Dev Raman');
    expect(rows[0]['Email']).toBe('dev.raman@melbourne.example');

    const { detectedKind, mappings } = guessRecordKindAndMappings(headers);
    expect(detectedKind).toBe('contacts');
    expect(mappings['Full Name']).toBe('fullName');
    expect(mappings['Email']).toBe('email');
    expect(mappings['Phone']).toBe('phone');
    expect(mappings['Company']).toBe('organisationName');
  });

  it('commits parsed spreadsheet into authentic CRM workspace', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Cortez Operations',
      userId: 'usr-anthony-cortez',
    });

    const parsed = {
      fileName: 'clients_roster.xlsx',
      fileSize: 4096,
      fileType: 'spreadsheet' as const,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: ['Full Name', 'Email', 'Phone', 'Company', 'Role'],
      rows: [
        {
          'Full Name': 'Anthony Davis',
          Email: 'anthony@davisproperty.example',
          Phone: '0491 570 888',
          Company: 'Davis Property Group',
          Role: 'Principal',
        },
      ],
      totalRows: 1,
      extractedEntities: [],
      detectedKind: 'contacts' as const,
      suggestedMappings: {
        'Full Name': 'fullName',
        Email: 'email',
        Phone: 'phone',
        Company: 'organisationName',
        Role: 'roleLabel',
      },
    };

    const result = commitParsedDocumentToCrm(fresh, parsed, 'contacts', parsed.suggestedMappings, 'usr-anthony-cortez');
    expect(result.createdCount).toBe(1);
    expect(fresh.people.length).toBe(1);
    expect(fresh.people[0].fullName).toBe('Anthony Davis');
    expect(fresh.people[0].primaryEmail).toBe('anthony@davisproperty.example');
    expect(fresh.people[0].ownerUserId).toBe('usr-anthony-cortez');
    expect(fresh.organisations.some((o) => o.name === 'Davis Property Group')).toBe(true);
    const davisOrg = fresh.organisations.find((o) => o.name === 'Davis Property Group');
    expect(davisOrg?.ownerUserId).toBe('usr-anthony-cortez');
    expect(fresh.auditEvents[fresh.auditEvents.length - 1].actorId).toBe('usr-anthony-cortez');
  });

  it('correctly handles custom mapping directions and non-standard column headers', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Victoria Services',
    });

    const parsed = {
      fileName: 'custom_export.csv',
      fileSize: 1024,
      fileType: 'spreadsheet' as const,
      mimeType: 'text/csv',
      headers: ['Customer Key', 'Electronic Mail', 'Direct Dial', 'Business Entity'],
      rows: [
        {
          'Customer Key': 'Elena Rostova',
          'Electronic Mail': 'elena@rostova.example',
          'Direct Dial': '0412 345 678',
          'Business Entity': 'Rostova Advisory',
        },
      ],
      totalRows: 1,
      extractedEntities: [],
      detectedKind: 'contacts' as const,
      suggestedMappings: {},
    };

    // User explicitly maps custom headers
    const userMappings = {
      'Customer Key': 'fullName',
      'Electronic Mail': 'email',
      'Direct Dial': 'phone',
      'Business Entity': 'organisationName',
    };

    const result = commitParsedDocumentToCrm(fresh, parsed, 'contacts', userMappings);
    expect(result.createdCount).toBe(1);
    expect(fresh.people[0].fullName).toBe('Elena Rostova');
    expect(fresh.people[0].primaryEmail).toBe('elena@rostova.example');
    expect(fresh.people[0].phone).toBe('0412 345 678');
    expect(fresh.organisations.some((o) => o.name === 'Rostova Advisory')).toBe(true);
  });

  it('parses JSON files with structured records', async () => {
    const jsonContent = JSON.stringify([
      {
        'Full Name': 'Marcus Vance',
        Email: 'marcus@vance.example',
        Company: 'Vance Engineering',
      },
    ]);

    const file = new File([jsonContent], 'clients.json', { type: 'application/json' });
    const parsed = await parseDocument(file);

    expect(parsed.totalRows).toBe(1);
    expect(parsed.rows[0]['Full Name']).toBe('Marcus Vance');
    expect(parsed.detectedKind).toBe('contacts');
  });

  it('updates session store and notifies subscribers on custom workspace save', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Reactive Test Org',
    });

    let notified = false;
    const unsubscribe = subscribeToWrites(() => {
      notified = true;
    });

    saveCustomWorkspace(fresh);
    const fromSession = sessionWorkspace(fresh.workspace.id);

    expect(notified).toBe(true);
    expect(fromSession.workspace.id).toBe(fresh.workspace.id);
    unsubscribe();
  });

  it('enforces Australian English and zero em dashes or en dashes', () => {
    const fresh = createFreshWorkspaceData({
      organisationName: 'Concludo Testing',
    });
    const dataset = workspaceToDataset(fresh);
    const json = JSON.stringify(dataset);

    expect(json.includes('—')).toBe(false);
    expect(json.includes('–')).toBe(false);
  });
});
