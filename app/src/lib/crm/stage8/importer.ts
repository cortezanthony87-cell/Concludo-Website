/**
 * The guided importer.
 *
 * Seven kinds of file, one path through them: read, map, validate, review
 * duplicates, dry run, commit, and roll back if it went wrong.
 *
 * Four decisions shape the whole module.
 *
 * 1. NOTHING IS GUESSED SILENTLY. A column heading suggests a field; it never
 *    maps to one. Every suggestion carries why it was made, and an unmapped
 *    column stays unmapped and is named. The alternative, auto-mapping by fuzzy
 *    match, is how a file's "Mobile" column lands in the notes field and nobody
 *    finds out for a year.
 *
 * 2. NOTHING COMMITS WITHOUT A DRY RUN. The run cannot move to committed unless
 *    it has a dry-run timestamp, enforced here and again by a check constraint
 *    in migration 0007. A preview somebody can skip is not a preview.
 *
 * 3. NOTHING MERGES. A row that looks like an existing record becomes a row in
 *    `needs_duplicate_review` and waits. Not even an exact email match merges,
 *    because two people genuinely share a shared mailbox more often than a CRM
 *    vendor's demo data suggests.
 *
 * 4. AN IMPORTED CONTACT IS NOT A CONTACTABLE CONTACT. A spreadsheet carries no
 *    consent, so every imported person gets a consent record with the basis
 *    recorded as not obtained, which puts them straight onto the consent-gap
 *    indicator and blocks any draft addressed to them. This is deliberate
 *    friction: importing a purchased list and emailing it the same afternoon is
 *    the single most common way a small business breaks the Spam Act, and the
 *    product should not make it easy.
 *
 * ROLLBACK, AND WHAT IT WILL NOT DO. Rollback reverses what the import created
 * and nothing else. A record somebody has edited since the import is left
 * alone and reported as kept, because undoing an import should not discard a
 * person's work. Rollback soft-deletes, so the records remain recoverable and
 * the audit trail stays complete.
 */

import {
  CrmWorkspaceData,
  ImportKind,
  ImportRow,
  ImportRun,
  ImportRowState,
  Uuid,
} from '../domain';
import { CrmContext, CrmRefused } from '../repositories/repository';
import { commit, newId } from '../stage5/writes';

/* ===================================================== reading the file */

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  /** Problems with the file itself, before any field is considered. */
  problems: string[];
}

/**
 * A small delimited-text reader.
 *
 * It handles quoted fields, embedded commas, embedded newlines and escaped
 * quotes, because every one of those appears in a real export and a reader
 * that splits on commas corrupts the file quietly. It does not handle every
 * dialect, and a file it cannot read is reported rather than half-read.
 */
export function readDelimited(text: string, delimiter = ','): ParsedFile {
  const problems: string[] = [];
  // A byte order mark at the start of a file would become part of the first
  // column heading, so the first heading would never match a field. Written
  // as a code point rather than as the character itself, which is invisible
  // in an editor and therefore the kind of thing somebody deletes by accident.
  const BOM = String.fromCharCode(0xfeff);
  const stripped = text.startsWith(BOM) ? text.slice(1) : text;

  if (stripped.trim() === '') {
    return { headers: [], rows: [], problems: ['The file is empty.'] };
  }

  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < stripped.length; i += 1) {
    const char = stripped[i];

    if (inQuotes) {
      if (char === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      record.push(field);
      field = '';
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }
    field += char;
  }

  if (inQuotes) {
    problems.push(
      'A quoted value is never closed, so the end of the file cannot be read. Check for a stray quotation mark.'
    );
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const headerRow = records.shift() ?? [];
  const headers = headerRow.map((header, index) => {
    const trimmed = header.trim();
    return trimmed === '' ? `Column ${index + 1}` : trimmed;
  });

  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) {
      problems.push(
        `Two columns are both named "${header}". Rename one, because a mapping cannot tell them apart.`
      );
    }
    seen.add(header);
  }

  const rows: Record<string, string>[] = [];
  records.forEach((values, index) => {
    if (values.every((value) => value.trim() === '')) return;
    if (values.length !== headers.length) {
      problems.push(
        `Row ${index + 2} has ${values.length} values where the heading has ${headers.length}. It is read as far as it goes and the rest is blank.`
      );
    }
    const row: Record<string, string> = {};
    headers.forEach((header, column) => {
      row[header] = (values[column] ?? '').trim();
    });
    rows.push(row);
  });

  return { headers, rows, problems };
}

/* ===================================================== what each kind takes */

export type FieldKind = 'text' | 'email' | 'phone' | 'date' | 'number' | 'choice' | 'reference';

export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  /**
   * Required fields are kept to the minimum that makes the record mean
   * anything, for the same reason quick capture does: a file rejected for a
   * missing phone number is a file somebody fills with fake phone numbers.
   */
  required: boolean;
  choices?: string[];
  /** Shown beside the field during mapping. */
  note?: string;
}

const NAME_FIELD: FieldSpec = {
  name: 'fullName',
  label: 'Full name',
  kind: 'text',
  required: true,
  note: 'The only field a contact must have.',
};

export const IMPORT_FIELDS: Record<ImportKind, FieldSpec[]> = {
  contacts: [
    NAME_FIELD,
    { name: 'primaryEmail', label: 'Email address', kind: 'email', required: false },
    { name: 'phone', label: 'Phone', kind: 'phone', required: false },
    {
      name: 'organisationName',
      label: 'Organisation',
      kind: 'reference',
      required: false,
      note: 'Matched to an existing organisation by name. An unmatched name is reported, never created silently.',
    },
    { name: 'roleLabel', label: 'Role', kind: 'text', required: false },
  ],
  organisations: [
    { name: 'name', label: 'Organisation name', kind: 'text', required: true },
    { name: 'abn', label: 'ABN', kind: 'text', required: false, note: 'Eleven digits, checked for length only.' },
    { name: 'industry', label: 'Industry', kind: 'text', required: false },
    { name: 'website', label: 'Website', kind: 'text', required: false },
    {
      name: 'parentOrganisationName',
      label: 'Parent organisation',
      kind: 'reference',
      required: false,
      note: 'Matched by name among organisations already in Concludo, including ones created earlier in this same file.',
    },
  ],
  leads: [
    {
      name: 'personName',
      label: 'Contact name',
      kind: 'text',
      required: false,
      note: 'A lead needs a name or an organisation. Neither is a row nobody can act on.',
    },
    { name: 'organisationName', label: 'Organisation', kind: 'text', required: false },
    { name: 'email', label: 'Email address', kind: 'email', required: false },
    { name: 'phone', label: 'Phone', kind: 'phone', required: false },
    {
      name: 'source',
      label: 'Where it came from',
      kind: 'text',
      required: true,
      note: 'Required, because a lead with no recorded source cannot have its consent basis judged later.',
    },
    { name: 'summary', label: 'What they want', kind: 'text', required: false },
  ],
  opportunities: [
    { name: 'title', label: 'Title', kind: 'text', required: true },
    { name: 'organisationName', label: 'Organisation', kind: 'reference', required: false },
    { name: 'stageName', label: 'Stage', kind: 'reference', required: false, note: 'Matched to a stage of the chosen pipeline. Unmatched goes to the first stage and is reported.' },
    { name: 'valueAmount', label: 'Value', kind: 'number', required: false },
    { name: 'expectedCloseDate', label: 'Expected close date', kind: 'date', required: false },
    { name: 'nextStep', label: 'Next step', kind: 'text', required: false },
  ],
  jobs: [
    { name: 'title', label: 'Title', kind: 'text', required: true },
    { name: 'organisationName', label: 'Customer', kind: 'reference', required: false },
    { name: 'stageName', label: 'Stage', kind: 'reference', required: false },
    { name: 'valueAmount', label: 'Value', kind: 'number', required: false },
    { name: 'nextStep', label: 'Next step', kind: 'text', required: false },
    { name: 'nextStepDue', label: 'Next step due', kind: 'date', required: false },
  ],
  activities: [
    { name: 'title', label: 'What happened', kind: 'text', required: true },
    { name: 'occurredAt', label: 'When', kind: 'date', required: true },
    {
      name: 'activityType',
      label: 'Kind',
      kind: 'choice',
      required: false,
      choices: ['meeting', 'call', 'note', 'email', 'document', 'task_completed', 'stage_change'],
      note: 'An unrecognised kind is recorded as a note rather than discarded.',
    },
    { name: 'organisationName', label: 'Organisation', kind: 'reference', required: false },
    { name: 'summary', label: 'Summary', kind: 'text', required: false },
  ],
  custom_fields: [
    { name: 'fieldName', label: 'Field name', kind: 'text', required: true },
    {
      name: 'subjectTable',
      label: 'Applies to',
      kind: 'choice',
      required: true,
      choices: ['crm_people', 'crm_organisations', 'crm_work_items'],
    },
    {
      name: 'fieldType',
      label: 'Type',
      kind: 'choice',
      required: true,
      choices: ['text', 'number', 'date', 'boolean', 'choice'],
    },
    { name: 'choices', label: 'Choices', kind: 'text', required: false, note: 'Separated by a semicolon. Required where the type is a choice.' },
  ],
};

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  contacts: 'Contacts',
  organisations: 'Organisations',
  leads: 'Leads',
  opportunities: 'Opportunities',
  jobs: 'Jobs',
  activities: 'Activity history',
  custom_fields: 'Custom fields',
};

/* ===================================================== mapping */

export interface MappingSuggestion {
  header: string;
  field: string | null;
  /** Why. Shown next to the suggestion so a person can disagree with a reason. */
  because: string;
  confidence: 'exact' | 'likely' | 'possible';
}

export interface MappingProposal {
  kind: ImportKind;
  suggestions: MappingSuggestion[];
  /** Columns with no suggested field. They stay out until somebody maps them. */
  unmappedHeaders: string[];
  /** Required fields nothing was suggested for. Blocks validation. */
  missingRequired: FieldSpec[];
  note: string;
}

const ALIASES: Record<string, string[]> = {
  fullName: ['name', 'full name', 'contact', 'contact name', 'person'],
  name: ['name', 'organisation', 'organization', 'company', 'company name', 'business', 'account'],
  primaryEmail: ['email', 'e-mail', 'email address', 'work email'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'telephone', 'mobile', 'phone number', 'contact number'],
  organisationName: ['organisation', 'organization', 'company', 'account', 'customer', 'client', 'employer'],
  parentOrganisationName: ['parent', 'parent company', 'parent organisation', 'group'],
  roleLabel: ['role', 'title', 'job title', 'position'],
  abn: ['abn', 'australian business number'],
  industry: ['industry', 'sector'],
  website: ['website', 'web', 'url', 'site'],
  source: ['source', 'lead source', 'where from', 'origin', 'channel'],
  summary: ['summary', 'notes', 'note', 'detail', 'details', 'comments'],
  title: ['title', 'name', 'subject', 'description', 'job', 'opportunity'],
  stageName: ['stage', 'status', 'step'],
  valueAmount: ['value', 'amount', 'price', 'fee', 'deal value'],
  expectedCloseDate: ['close date', 'expected close', 'close', 'decision date'],
  nextStep: ['next step', 'next action', 'action'],
  nextStepDue: ['next step due', 'due', 'due date', 'action date'],
  occurredAt: ['date', 'when', 'occurred', 'meeting date', 'timestamp'],
  activityType: ['type', 'kind', 'activity type'],
  fieldName: ['field', 'field name', 'label'],
  subjectTable: ['applies to', 'record', 'object', 'entity'],
  fieldType: ['type', 'field type', 'data type'],
  choices: ['choices', 'options', 'values'],
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Suggests a mapping. It does not make one.
 *
 * The returned proposal is what the mapping screen shows; the application
 * builds a mapping from what the person accepts. A caller that wants the
 * suggestions applied has to say so by calling `acceptSuggestions`, which
 * exists so that "I accepted the suggestions" is a recorded act rather than
 * the default.
 */
export function suggestMapping(headers: string[], kind: ImportKind): MappingProposal {
  const fields = IMPORT_FIELDS[kind];
  const suggestions: MappingSuggestion[] = [];
  const taken = new Set<string>();

  for (const header of headers) {
    const key = normalise(header);
    let match: MappingSuggestion = {
      header,
      field: null,
      because: 'No field in Concludo has a name or a common alias like this one.',
      confidence: 'possible',
    };

    for (const field of fields) {
      if (taken.has(field.name)) continue;
      const fieldKey = normalise(field.label);
      const aliases = (ALIASES[field.name] ?? []).map(normalise);

      if (key === normalise(field.name) || key === fieldKey) {
        match = {
          header,
          field: field.name,
          because: `The heading is the field name.`,
          confidence: 'exact',
        };
        break;
      }
      if (aliases.includes(key)) {
        match = {
          header,
          field: field.name,
          because: `"${header}" is a common heading for ${field.label.toLowerCase()}.`,
          confidence: 'likely',
        };
        break;
      }
      if (aliases.some((alias) => key.includes(alias) || alias.includes(key))) {
        match = {
          header,
          field: field.name,
          because: `"${header}" looks like ${field.label.toLowerCase()}, on a partial match. Worth checking.`,
          confidence: 'possible',
        };
        // Keep looking for something better.
      }
    }

    if (match.field !== null && match.confidence !== 'possible') taken.add(match.field);
    suggestions.push(match);
  }

  const suggested = new Set(suggestions.map((s) => s.field).filter((f): f is string => f !== null));

  return {
    kind,
    suggestions,
    unmappedHeaders: suggestions.filter((s) => s.field === null).map((s) => s.header),
    missingRequired: fields.filter((field) => field.required && !suggested.has(field.name)),
    note:
      'These are suggestions. Nothing is mapped until you accept it, and a column left unmapped is not imported.',
  };
}

/** Turns accepted suggestions into a mapping. Called on a person's say-so. */
export function acceptSuggestions(
  proposal: MappingProposal,
  reject: string[] = []
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const suggestion of proposal.suggestions) {
    if (suggestion.field === null) continue;
    if (reject.includes(suggestion.header)) continue;
    mapping[suggestion.header] = suggestion.field;
  }
  return mapping;
}

/* ===================================================== preview */

export interface PreviewRow {
  rowNumber: number;
  /** Field to value, as the import would read it. */
  read: Record<string, string>;
  /** Columns in the file that this mapping drops. */
  ignored: string[];
}

export function previewRows(
  parsed: ParsedFile,
  mapping: Record<string, string>,
  limit = 10
): PreviewRow[] {
  const ignored = parsed.headers.filter((header) => mapping[header] === undefined);

  return parsed.rows.slice(0, limit).map((row, index) => {
    const read: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      const value = row[header];
      if (value !== undefined && value !== '') read[field] = value;
    }
    return { rowNumber: index + 2, read, ignored };
  });
}

/* ===================================================== validation */

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/** Dates: ISO, Australian day-first, and nothing else guessed. */
export function readDate(value: string): { date: string | null; problem: string | null } {
  const trimmed = value.trim();
  if (trimmed === '') return { date: null, problem: null };

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, problem: null };

  const dayFirst = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const yearPart = dayFirst[3];
    const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);

    if (month > 12 && day <= 12) {
      return {
        date: null,
        problem: `"${trimmed}" is ambiguous: read day first it is not a real date, so the file may be month first. Fix the column or convert the file.`,
      };
    }
    if (day > 31 || month > 12 || day < 1 || month < 1) {
      return { date: null, problem: `"${trimmed}" is not a date.` };
    }

    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
      return { date: null, problem: `"${trimmed}" is not a real date.` };
    }
    return {
      date: candidate.toISOString().slice(0, 10),
      problem: null,
    };
  }

  return {
    date: null,
    problem: `"${trimmed}" is not a date Concludo will read. Use YYYY-MM-DD or DD/MM/YYYY.`,
  };
}

export interface DuplicateFinding {
  rowNumber: number;
  /** What it matched. */
  existingTable: string;
  existingId: string;
  existingName: string;
  matchedOn: string;
  /** Never 'merge'. */
  recommendation: 'review_together' | 'likely_separate';
}

export interface ValidationSummary {
  rows: ImportRow[];
  counts: Record<ImportRowState, number>;
  duplicates: DuplicateFinding[];
  /** Columns the file has and the mapping drops. */
  ignoredColumns: string[];
  /** Required fields nothing is mapped to. */
  missingRequired: string[];
  /** Problems with the file itself. */
  fileProblems: string[];
}

function emptyCounts(): Record<ImportRowState, number> {
  return {
    ready: 0,
    blocked: 0,
    needs_duplicate_review: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    rolled_back: 0,
  };
}

/**
 * Validates every row against the kind's fields and against what is already in
 * the workspace.
 *
 * Nothing is written. The returned rows are the staging rows, ready to be
 * persisted with the run, and every problem names its column.
 */
export function validateImport(
  data: CrmWorkspaceData,
  parsed: ParsedFile,
  mapping: Record<string, string>,
  kind: ImportKind,
  runId: string
): ValidationSummary {
  const fields = IMPORT_FIELDS[kind];
  const mapped = new Set(Object.values(mapping));
  const missingRequired = fields
    .filter((field) => field.required && !mapped.has(field.name))
    .map((field) => field.label);

  const rows: ImportRow[] = [];
  const duplicates: DuplicateFinding[] = [];
  const counts = emptyCounts();

  // Within-file duplicates matter as much as duplicates against the database:
  // the same person twice in one file creates two records unless somebody is
  // told.
  const seenInFile = new Map<string, number>();

  parsed.rows.forEach((source, index) => {
    const rowNumber = index + 2;
    // Two lists, deliberately. `issues` stop the row; `warnings` do not. An
    // organisation name that matches nothing is a warning, because the contact
    // is still worth having and the alternative is a file somebody "fixes" by
    // deleting the column.
    const issues: string[] = [];
    const warnings: string[] = [];
    const read: Record<string, string> = {};

    for (const [header, field] of Object.entries(mapping)) {
      const value = (source[header] ?? '').trim();
      if (value !== '') read[field] = value;
    }

    for (const field of fields) {
      const value = read[field.name];

      if (field.required && (value === undefined || value === '')) {
        issues.push(`${field.label} is empty, and it is the one field this kind of row must have.`);
        continue;
      }
      if (value === undefined) continue;

      if (field.kind === 'email' && !EMAIL.test(value)) {
        issues.push(`${field.label} reads "${value}", which is not an email address.`);
      }
      if (field.kind === 'number' && Number.isNaN(Number(value.replace(/[$,\s]/g, '')))) {
        issues.push(`${field.label} reads "${value}", which is not a number.`);
      }
      if (field.kind === 'date') {
        const { problem } = readDate(value);
        if (problem) issues.push(`${field.label}: ${problem}`);
      }
      if (field.kind === 'choice' && field.choices && !field.choices.includes(value)) {
        const sentence = `${field.label} reads "${value}". Concludo knows ${field.choices.join(', ')}.`;
        // An unrecognised activity kind becomes a note, which is a warning. An
        // unrecognised value in a field that decides what the record IS, such
        // as which table a custom field applies to, stops the row.
        if (field.name === 'activityType') {
          warnings.push(`${sentence} It will be recorded as a note.`);
        } else {
          issues.push(sentence);
        }
      }
      if (field.kind === 'reference') {
        const matchedOrganisation = data.organisations.find(
          (organisation) =>
            organisation.deletedAt === null && normalise(organisation.name) === normalise(value)
        );
        if (field.name.toLowerCase().includes('organisation') && !matchedOrganisation) {
          warnings.push(
            `${field.label} reads "${value}", which matches no organisation in Concludo. The row imports without it. Import the organisations first if you want them linked.`
          );
        }
      }
    }

    // A lead needs a name or an organisation.
    if (kind === 'leads' && !read['personName'] && !read['organisationName']) {
      issues.push('Neither a contact name nor an organisation is recorded, so there is nobody to follow up.');
    }
    if (kind === 'custom_fields' && read['fieldType'] === 'choice' && !read['choices']) {
      issues.push('The type is a choice and no choices are listed, so the field could not be used.');
    }

    // Duplicate detection. Email first, because a shared name is common and a
    // shared address is a question.
    let state: ImportRowState = issues.length > 0 ? 'blocked' : 'ready';
    // Everything after this point may move a ready row to
    // needs_duplicate_review, and nothing after this point may block one: a
    // blocked row is blocked by a field problem, not by a resemblance.

    const email = (read['primaryEmail'] ?? read['email'] ?? '').toLowerCase();
    const name = read['fullName'] ?? read['name'] ?? read['personName'] ?? '';

    if (kind === 'contacts' || kind === 'leads') {
      const existing = data.people.find(
        (person) =>
          person.deletedAt === null &&
          person.mergedIntoPersonId === null &&
          ((email !== '' && person.primaryEmail?.toLowerCase() === email) ||
            (name !== '' && normalise(person.fullName) === normalise(name)))
      );
      if (existing) {
        const matchedOn =
          email !== '' && existing.primaryEmail?.toLowerCase() === email
            ? `the same email address, ${email}`
            : 'the same name';
        duplicates.push({
          rowNumber,
          existingTable: 'crm_people',
          existingId: existing.id,
          existingName: existing.fullName,
          matchedOn,
          recommendation: matchedOn.startsWith('the same email') ? 'review_together' : 'likely_separate',
        });
        if (state !== 'blocked') state = 'needs_duplicate_review';
      }
    }

    if (kind === 'organisations') {
      const existing = data.organisations.find(
        (organisation) =>
          organisation.deletedAt === null &&
          read['name'] !== undefined &&
          normalise(organisation.name) === normalise(read['name'])
      );
      if (existing) {
        duplicates.push({
          rowNumber,
          existingTable: 'crm_organisations',
          existingId: existing.id,
          existingName: existing.name,
          matchedOn: 'the same name',
          recommendation: 'review_together',
        });
        if (state !== 'blocked') state = 'needs_duplicate_review';
      }
    }

    const fileKey = `${kind}:${email || normalise(name) || normalise(read['title'] ?? '')}`;
    if (fileKey !== `${kind}:`) {
      const earlier = seenInFile.get(fileKey);
      if (earlier !== undefined) {
        warnings.push(
          `Row ${earlier} of this same file has the same ${email !== '' ? 'email address' : 'name'}. One of the two is probably a repeat.`
        );
        if (state === 'ready') state = 'needs_duplicate_review';
      } else {
        seenInFile.set(fileKey, rowNumber);
      }
    }

    if (missingRequired.length > 0 && state === 'ready') {
      state = 'blocked';
      issues.push(
        `Nothing is mapped to ${missingRequired.join(' or ')}, so no row of this file can be imported yet.`
      );
    }

    counts[state] += 1;
    rows.push({
      id: newId('improw'),
      crmWorkspaceId: data.workspace.id,
      importRunId: runId,
      rowNumber,
      source,
      state,
      issues,
      warnings,
      createdTable: null,
      createdId: null,
      mergedIntoId: null,
    });
  });

  return {
    rows,
    counts,
    duplicates,
    ignoredColumns: parsed.headers.filter((header) => mapping[header] === undefined),
    missingRequired,
    fileProblems: parsed.problems,
  };
}

/* ===================================================== dry run */

export interface DryRun {
  runId: string;
  kind: ImportKind;
  willCreate: number;
  willWait: number;
  willSkip: number;
  /** Organisations named in the file that do not exist. Never auto-created. */
  unmatchedOrganisations: string[];
  consentNote: string | null;
  /** Said plainly, every time. */
  note: string;
  lines: { label: string; count: number; meaning: string }[];
}

export const DRY_RUN_NOTE =
  'Nothing has been written. This is what the import would do if you commit it.';

export function dryRun(
  summary: ValidationSummary,
  kind: ImportKind,
  runId: string
): DryRun {
  const unmatched = new Set<string>();
  for (const row of summary.rows) {
    for (const note of [...row.issues, ...row.warnings]) {
      const match = /reads "([^"]+)", which matches no organisation/.exec(note);
      if (match) unmatched.add(match[1]);
    }
  }

  return {
    runId,
    kind,
    willCreate: summary.counts.ready,
    willWait: summary.counts.needs_duplicate_review,
    willSkip: summary.counts.blocked,
    unmatchedOrganisations: [...unmatched].sort(),
    consentNote:
      kind === 'contacts' || kind === 'leads'
        ? 'Every imported contact is recorded with no consent basis obtained. They appear on the consent gap list and no message can be addressed to them until a basis is recorded. A spreadsheet is not consent.'
        : null,
    note: DRY_RUN_NOTE,
    lines: [
      {
        label: 'Rows that would be created',
        count: summary.counts.ready,
        meaning: 'Valid, and matching nothing already here.',
      },
      {
        label: 'Rows waiting on a decision',
        count: summary.counts.needs_duplicate_review,
        meaning: 'They look like something already in Concludo. Nothing merges on its own, so each one waits for you.',
      },
      {
        label: 'Rows that would be skipped',
        count: summary.counts.blocked,
        meaning: 'Something is wrong with them. Download the error file, fix it, and import that file.',
      },
    ],
  };
}

/* ===================================================== the error file */

/**
 * The blocked rows, as a file somebody can fix and import again.
 *
 * It reproduces the source columns exactly, in the original order, and adds two
 * of its own. Reproducing the source is the point: an error file that drops a
 * column somebody has to retype is an error file nobody uses.
 */
export function errorFile(parsed: ParsedFile, rows: ImportRow[]): string {
  // Blocked rows only. Including the rows that merely carry a warning would
  // hand somebody a file of everything, which is the same as handing them
  // nothing.
  const problems = rows.filter((row) => row.state === 'blocked' || row.state === 'skipped');
  if (problems.length === 0) return '';

  const escape = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const header = [...parsed.headers, 'Concludo row', 'Concludo issue'].map(escape).join(',');

  const lines = problems.map((row) =>
    [
      ...parsed.headers.map((heading) => escape(row.source[heading] ?? '')),
      escape(String(row.rowNumber)),
      escape(row.issues.join(' ')),
    ].join(',')
  );

  return [header, ...lines].join('\n') + '\n';
}

/* ===================================================== commit */

export interface CommitResult {
  run: ImportRun;
  created: { table: string; id: string; rowNumber: number }[];
  waiting: number;
  skipped: number;
  auditEventId: string | null;
}

interface Creatable {
  table: string;
  create: (read: Record<string, string>) => string | null;
}

function readFields(row: ImportRow, mapping: Record<string, string>): Record<string, string> {
  const read: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    const value = (row.source[header] ?? '').trim();
    if (value !== '') read[field] = value;
  }
  return read;
}

function organisationIdByName(
  data: CrmWorkspaceData,
  value: string | undefined
): string | null {
  if (!value) return null;
  const found = data.organisations.find(
    (organisation) => organisation.deletedAt === null && normalise(organisation.name) === normalise(value)
  );
  return found?.id ?? null;
}

/**
 * Commits a validated run.
 *
 * Refuses without a dry run, refuses a run already committed, and refuses a
 * kind it cannot create. Rows in `needs_duplicate_review` are left alone: a
 * commit is not a decision about them.
 *
 * One audit event for the run, plus the per-record events that each write
 * function already produces. The run-level event is what somebody reads six
 * months later; the per-record ones are what proves which record came from it.
 */
export function commitImport(
  context: CrmContext,
  data: CrmWorkspaceData,
  run: ImportRun,
  rows: ImportRow[],
  mapping: Record<string, string>
): CommitResult {
  if (run.dryRunAt === null) {
    throw new CrmRefused(
      'not_permitted',
      'This import has not been previewed. Run the preview first, because it is the only thing standing between a bad mapping and three thousand bad records.'
    );
  }
  if (run.state === 'committed' || run.state === 'rolled_back') {
    throw new CrmRefused('not_permitted', 'This import has already been committed.');
  }

  const created: CommitResult['created'] = [];

  const makers: Record<ImportKind, Creatable> = {
    contacts: {
      table: 'crm_people',
      create: (read) => {
        const person = {
          id: newId('per'),
          crmWorkspaceId: context.workspaceId,
          fullName: read['fullName'],
          givenName: null,
          familyName: null,
          primaryEmail: read['primaryEmail'] ?? null,
          secondaryEmail: null,
          phone: read['phone'] ?? null,
          primaryEmailScope: 'unknown' as const,
          organisationId: organisationIdByName(data, read['organisationName']),
          roleLabel: read['roleLabel'] ?? null,
          ownerUserId: context.userId,
          relationshipOwnerUserId: context.userId,
          mergedIntoPersonId: null,
          createdAt: context.now,
          updatedAt: context.now,
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
        };
        data.people.push(person);

        // Decision 4. An imported contact arrives with no basis to contact
        // them, recorded rather than assumed, so the gap is visible and the
        // drafting agent refuses them.
        data.consentRecords.push({
          id: newId('cons'),
          crmWorkspaceId: context.workspaceId,
          personId: person.id,
          consentType: 'contact',
          basis: 'not_obtained',
          capturedAt: context.now,
          capturedFrom: `Imported from ${run.fileName}`,
          capturedBy: context.userId,
          expiresAt: null,
          withdrawnAt: null,
          withdrawalNote: null,
          createdAt: context.now,
          updatedAt: context.now,
        });

        return person.id;
      },
    },
    organisations: {
      table: 'crm_organisations',
      create: (read) => {
        const parentId = organisationIdByName(data, read['parentOrganisationName']);
        const parent = data.organisations.find((o) => o.id === parentId);
        const organisation = {
          id: newId('org'),
          crmWorkspaceId: context.workspaceId,
          name: read['name'],
          legalName: null,
          tradingName: null,
          abn: read['abn'] ?? null,
          industry: read['industry'] ?? null,
          website: read['website'] ?? null,
          parentOrganisationId: parentId,
          hierarchyDepth: parent ? parent.hierarchyDepth + 1 : 0,
          ownerUserId: context.userId,
          relationshipOwnerUserId: context.userId,
          dataQualityOwnerUserId: null,
          lifecycleState: 'prospect' as const,
          renewalDate: null,
          createdAt: context.now,
          updatedAt: context.now,
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
        };
        data.organisations.push(organisation);
        return organisation.id;
      },
    },
    leads: {
      table: 'crm_leads',
      create: (read) => {
        const missing: string[] = [];
        if (!read['personName']) missing.push('a name');
        if (!read['organisationName']) missing.push('an organisation');
        if (!read['email'] && !read['phone']) missing.push('a way to reply');
        if (!read['summary']) missing.push('what they want');

        const lead = {
          id: newId('lead'),
          crmWorkspaceId: context.workspaceId,
          personName: read['personName'] ?? null,
          organisationName: read['organisationName'] ?? null,
          email: read['email'] ?? null,
          phone: read['phone'] ?? null,
          // The source carries the file name, because "where did this lead
          // come from" has to survive the import. A lead with the source
          // "spreadsheet" and nothing else is one nobody can judge a consent
          // basis for later.
          source: `${read['source']} (imported from ${run.fileName})`,
          summary: read['summary'] ?? null,
          missingInformation: [
            ...missing,
            'a basis to contact them, because a file does not carry consent',
          ],
          // Imported leads arrive awaiting review rather than in any state
          // that implies somebody has looked at them.
          state: 'awaiting_review' as const,
          notProceedingReason: null,
          convertedAt: null,
          convertedBy: null,
          convertedPersonId: null,
          convertedOrganisationId: null,
          convertedWorkItemId: null,
          receivedAt: context.now,
          ownerUserId: context.userId,
          createdAt: context.now,
          updatedAt: context.now,
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
        };
        data.leads.push(lead);
        return lead.id;
      },
    },
    opportunities: { table: 'crm_work_items', create: (read) => createWorkItem(context, data, read) },
    jobs: { table: 'crm_work_items', create: (read) => createWorkItem(context, data, read) },
    activities: {
      table: 'crm_activities',
      create: (read) => {
        const { date } = readDate(read['occurredAt'] ?? '');
        const known = IMPORT_FIELDS.activities.find((f) => f.name === 'activityType')?.choices ?? [];
        const type = known.includes(read['activityType'] ?? '') ? read['activityType'] : 'note';

        const activity = {
          id: newId('act'),
          crmWorkspaceId: context.workspaceId,
          activityType: type as 'note',
          title: read['title'],
          summary: read['summary'] ?? null,
          occurredAt: date ? `${date}T00:00:00.000Z` : context.now,
          organisationId: organisationIdByName(data, read['organisationName']),
          workItemId: null,
          // An imported history is history. Marking it as meaningful contact
          // would reset every staleness clock in the workspace and make a dead
          // account look live.
          isMeaningfulContact: false,
          followThroughOutstanding: false,
          followThroughReason: null,
          createdBy: context.userId,
          createdAt: context.now,
          updatedAt: context.now,
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
        };
        data.activities.push(activity);
        return activity.id;
      },
    },
    custom_fields: {
      table: 'crm_custom_field_definitions',
      create: (read) => {
        const definition = {
          id: newId('cfd'),
          crmWorkspaceId: context.workspaceId,
          subjectTable: read['subjectTable'],
          fieldKey: read['fieldName'],
          label: read['fieldName'],
          fieldType: read['fieldType'] as 'text',
          options: read['choices'] ? read['choices'].split(';').map((c) => c.trim()) : [],
          // An imported field is never required. Making it required would
          // block every existing record that has no value for it.
          isRequired: false,
          helpText: `Imported from ${run.fileName}`,
          fieldOrder: data.customFieldDefinitions.length,
          createdAt: context.now,
          updatedAt: context.now,
          deletedAt: null,
          deletedBy: null,
          purgeAfter: null,
        };
        data.customFieldDefinitions.push(definition);
        return definition.id;
      },
    },
  };

  const maker = makers[run.kind];

  const committed = commit({
    context,
    data,
    // Committing an import writes customer records in bulk, so it needs the
    // role the database requires for the same act.
    role: 'crm_approver',
    doing: 'Committing an import',
    eventType: 'import_committed',
    subjectTable: 'crm_import_runs',
    detail: `${run.fileName}: ${rows.filter((r) => r.state === 'ready').length} rows into ${maker.table}.`,
    apply: () => {
      for (const row of rows) {
        if (row.state !== 'ready') continue;
        const read = readFields(row, mapping);
        const id = maker.create(read);
        if (id === null) {
          row.state = 'skipped';
          row.issues.push('Concludo could not create this row and has left it alone.');
          continue;
        }
        row.state = 'created';
        row.createdTable = maker.table;
        row.createdId = id;
        created.push({ table: maker.table, id, rowNumber: row.rowNumber });
      }

      run.state = 'committed';
      run.committedAt = context.now;
      run.committedBy = context.userId;
      run.rowCount = rows.length;
      run.mapping = mapping;
      run.updatedAt = context.now;
      return run;
    },
    subjectId: (r) => r.id,
    after: (r) => ({ state: r.state, created: created.length }),
  });

  const auditEventId =
    data.auditEvents.filter((event) => event.subjectId === run.id).at(-1)?.id ?? null;
  committed.auditEventId = auditEventId;

  return {
    run: committed,
    created,
    waiting: rows.filter((row) => row.state === 'needs_duplicate_review').length,
    skipped: rows.filter((row) => row.state === 'blocked' || row.state === 'skipped').length,
    auditEventId,
  };
}

function createWorkItem(
  context: CrmContext,
  data: CrmWorkspaceData,
  read: Record<string, string>
): string | null {
  const pipeline =
    data.pipelines.find((p) => p.isDefault && p.deletedAt === null) ??
    data.pipelines.find((p) => p.deletedAt === null) ??
    null;
  if (!pipeline) return null;

  const stages = data.stages
    .filter((stage) => stage.pipelineId === pipeline.id)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  if (stages.length === 0) return null;

  const named = read['stageName']
    ? stages.find((stage) => normalise(stage.name) === normalise(read['stageName']))
    : undefined;
  const stage = named ?? stages[0];

  const { date: closeDate } = readDate(read['expectedCloseDate'] ?? '');
  const { date: nextDue } = readDate(read['nextStepDue'] ?? '');
  const amount = read['valueAmount'] ? Number(read['valueAmount'].replace(/[$,\s]/g, '')) : null;

  const item = {
    id: newId('wi'),
    crmWorkspaceId: context.workspaceId,
    workItemType: data.workspace.recordTerminology,
    title: read['title'],
    organisationId: organisationIdByName(data, read['organisationName']),
    primaryPersonId: null,
    pipelineId: pipeline.id,
    stageId: stage.id,
    enteredStageAt: context.now,
    status: 'open' as const,
    ownerUserId: context.userId,
    valueAmount: amount !== null && !Number.isNaN(amount) ? amount : null,
    valueCurrency: 'AUD',
    // An imported value is what the file said, which is a stated figure from
    // outside Concludo rather than one calculated from a quote here.
    valueBasis: 'stated' as const,
    expectedCloseDate: closeDate,
    nextStep: read['nextStep'] ?? null,
    nextStepDue: nextDue,
    actionOwnerUserId: read['nextStep'] ? context.userId : null,
    resolvedAt: null,
    resolutionReason: null,
    createdAt: context.now,
    updatedAt: context.now,
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
  };
  data.workItems.push(item);
  return item.id;
}

/* ===================================================== rollback */

export interface RollbackResult {
  run: ImportRun;
  reversed: { table: string; id: string; rowNumber: number }[];
  /** Records left alone, and why. */
  kept: { table: string; id: string; rowNumber: number; because: string }[];
  auditEventId: string | null;
}

/**
 * Reverses an import.
 *
 * Soft-deletes what the import created, except anything edited since the
 * commit, which is reported as kept. A rollback that discards somebody's
 * afternoon of corrections is worse than the bad import it was undoing.
 */
export function rollbackImport(
  context: CrmContext,
  data: CrmWorkspaceData,
  run: ImportRun,
  rows: ImportRow[],
  reason: string
): RollbackResult {
  if (run.state !== 'committed') {
    throw new CrmRefused('not_permitted', 'Only a committed import can be rolled back.');
  }
  if (reason.trim() === '') {
    throw new CrmRefused(
      'invalid',
      'A rollback needs a reason. It is the only record of why a few thousand records disappeared.'
    );
  }

  const reversed: RollbackResult['reversed'] = [];
  const kept: RollbackResult['kept'] = [];

  const collections: Record<string, { id: string; updatedAt: string; deletedAt: string | null; deletedBy: string | null }[]> =
    {
      crm_people: data.people,
      crm_organisations: data.organisations,
      crm_leads: data.leads,
      crm_work_items: data.workItems,
      crm_activities: data.activities,
    };

  const rolledBack = commit({
    context,
    data,
    role: 'crm_approver',
    doing: 'Rolling back an import',
    eventType: 'import_rolled_back',
    subjectTable: 'crm_import_runs',
    detail: reason,
    apply: () => {
      for (const row of rows) {
        if (row.state !== 'created' || row.createdTable === null || row.createdId === null) continue;

        const collection = collections[row.createdTable];
        if (!collection) {
          kept.push({
            table: row.createdTable,
            id: row.createdId,
            rowNumber: row.rowNumber,
            because:
              'Concludo cannot reverse this kind of record automatically. It is named here so it can be removed by hand.',
          });
          continue;
        }

        const record = collection.find((candidate) => candidate.id === row.createdId);
        if (!record) {
          kept.push({
            table: row.createdTable,
            id: row.createdId,
            rowNumber: row.rowNumber,
            because: 'The record is no longer there. Nothing to reverse.',
          });
          continue;
        }
        // Parsed, not compared as strings. Timestamps in this product carry a
        // zone offset in some places and Z in others, so '2026-10-13T23:01Z'
        // sorts BELOW '2026-10-13T09:00+11:00' as text while being two hours
        // later in fact. A string comparison here would silently reverse a
        // record somebody had edited, which is the one thing rollback must not
        // do.
        const editedSince =
          run.committedAt !== null &&
          Date.parse(record.updatedAt) > Date.parse(run.committedAt);
        if (editedSince) {
          kept.push({
            table: row.createdTable,
            id: row.createdId,
            rowNumber: row.rowNumber,
            because: `Somebody has edited this record since the import. It is left as it is, because a rollback should not discard somebody's work.`,
          });
          continue;
        }

        record.deletedAt = context.now;
        record.deletedBy = context.userId;
        record.updatedAt = context.now;
        row.state = 'rolled_back';
        reversed.push({ table: row.createdTable, id: row.createdId, rowNumber: row.rowNumber });
      }

      run.state = 'rolled_back';
      run.rolledBackAt = context.now;
      run.rolledBackBy = context.userId;
      run.rollbackReason = reason;
      run.updatedAt = context.now;
      return run;
    },
    subjectId: (r) => r.id,
    after: (r) => ({ state: r.state, reversed: reversed.length, kept: kept.length }),
  });

  const auditEventId =
    data.auditEvents.filter((event) => event.subjectId === run.id).at(-1)?.id ?? null;

  return { run: rolledBack, reversed, kept, auditEventId };
}

/* ===================================================== starting a run */

export function startImport(
  context: CrmContext,
  kind: ImportKind,
  fileName: string
): ImportRun {
  return {
    id: newId('imprun') as Uuid,
    crmWorkspaceId: context.workspaceId,
    kind,
    fileName,
    mapping: {},
    state: 'mapping',
    rowCount: 0,
    startedBy: context.userId,
    dryRunAt: null,
    committedAt: null,
    committedBy: null,
    rolledBackAt: null,
    rolledBackBy: null,
    rollbackReason: null,
    auditEventId: null,
    createdAt: context.now,
    updatedAt: context.now,
  };
}

/** Marks the run as previewed. The only way to reach a commit. */
export function markDryRun(run: ImportRun, now: string): ImportRun {
  run.dryRunAt = now;
  run.state = 'dry_run';
  run.updatedAt = now;
  return run;
}
