/**
 * Email Command Centre, Stage 8 tests.
 *
 * The rebuilt dashboard and the outputs surface.
 *
 * Two groups matter more than the rest. The composition tests assert that no
 * thread appears twice on the Overview, which is the defect the rebuild exists
 * to fix: the old page showed one invoice-redirection attempt four times. The
 * output tests assert that nothing in a produced document was invented, which
 * is the only property that makes a generated document safe to send to a
 * client.
 *
 * Run: bun app/tests/emailCommandCentre.outputs.test.ts
 */
import {
  OUTPUT_KINDS,
  OUTPUT_ENTITLEMENTS,
  OutputKind,
  availabilityFor,
  basisLabel,
  buildFollowUpEmail,
  buildOutputPayload,
  entitledTo,
  evidenceFor,
  outputDefinition,
  recipientsFor,
} from '../src/lib/email/outputs';
import { renderOutputDocument, documentFileName, DOCUMENT_STYLESHEET, DOCUMENT_LOCKUP } from '../src/lib/email/outputDocument';
import { composeOverview } from '../src/lib/email/overview';
import { recordsFor, ThreadRecord } from '../src/lib/email/filters';
import { getDataset } from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import { formatDay, formatDayTime, ACCOUNT_TIME_ZONE } from '../src/lib/email/outputFormat';
import { EMAIL_MODULE_DESTINATIONS } from '../src/lib/email/moduleNav';
import { EMAIL_ROUTES } from '../src/pages/email/emailRouteTable';

let failures = 0;
let checks = 0;

function assert(condition: boolean, description: string): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${description}`);
  }
}

function group(name: string): void {
  console.log(`\n${name}`);
}

const WORK = 'acct-work-01';
const PERSONAL = 'acct-personal-01';
const workDataset = getDataset(WORK)!;
const personalDataset = getDataset(PERSONAL)!;
const workRecords = recordsFor(workDataset);
const personalRecords = recordsFor(personalDataset);

const base = { accountLabel: 'Work', tier: 'pro' as const, now: DEMO_NOW };

function richest(records: readonly ThreadRecord[]): ThreadRecord {
  return records
    .filter((r) => r.analysis.analysed)
    .slice()
    .sort(
      (a, b) =>
        b.analysis.actions.length +
        b.analysis.decisionsMade.length -
        (a.analysis.actions.length + a.analysis.decisionsMade.length)
    )[0];
}

/* ====================================================== 1. the composition */

group('The Overview shows each thread once, which was the whole problem');

{
  const page = composeOverview(workRecords, DEMO_NOW);

  const shown = [
    ...(page.lead ? [page.lead.thread.id] : []),
    ...page.sections.flatMap((s) => s.records.map((r) => r.thread.id)),
    ...page.security.map((r) => r.thread.id),
  ];

  assert(shown.length > 0, 'The page shows something.');
  assert(
    new Set(shown).size === shown.length,
    `No thread appears twice (${shown.length} rows, ${new Set(shown).size} distinct).`
  );

  // The specific regression. On the old page this thread appeared in Handle
  // First, Today's Workload, Reply Queue and Security Review at once.
  const invoice = workRecords.find((r) => r.analysis.securityAlert !== null);
  if (invoice) {
    const appearances = shown.filter((id) => id === invoice.thread.id).length;
    assert(appearances <= 1, `The flagged invoice thread appears at most once (${appearances}).`);
  }
}

group('Security sits apart from routine priority, and before it');

{
  const page = composeOverview(workRecords, DEMO_NOW);
  const flagged = new Set(
    workRecords.filter((r) => r.analysis.securityAlert !== null).map((r) => r.thread.id)
  );

  assert(page.security.length > 0, 'The work account has flagged threads.');
  assert(
    page.security.every((r) => flagged.has(r.thread.id)),
    'Everything in the security band is actually flagged.'
  );
  assert(
    page.sections.every((s) => s.records.every((r) => !flagged.has(r.thread.id))),
    'No flagged thread appears in any routine section.'
  );
  assert(
    page.lead === null || !flagged.has(page.lead.thread.id),
    'And the lead is never a flagged thread, because the lead is about what to do next.'
  );
}

group('The lead is one thread, with the reason it leads');

{
  const page = composeOverview(workRecords, DEMO_NOW);
  assert(page.lead !== null, 'There is a lead thread.');
  assert(page.leadReason.trim().length > 15, `It says why it leads: "${page.leadReason}"`);
  assert(
    page.sections.every((s) => s.records.every((r) => r.thread.id !== page.lead?.thread.id)),
    'The lead does not then appear again in a section.'
  );
}

group('A section reports the truth about what it is not showing');

{
  const page = composeOverview(workRecords, DEMO_NOW);
  for (const section of page.sections) {
    assert(
      section.total >= section.records.length,
      `${section.key}: the total is never smaller than what is drawn.`
    );
    assert(
      section.alreadyShown >= 0 && section.alreadyShown <= section.total,
      `${section.key}: the already-shown count is within the total.`
    );
    assert(section.records.length <= 4, `${section.key}: at most four rows.`);
    assert(section.emptyMessage.trim().length > 10, `${section.key}: has an empty message.`);
    assert(
      !/\b(behind|drowning|overwhelm)/i.test(`${section.title} ${section.description}`),
      `${section.key}: no anxiety framing.`
    );
  }
}

group('An account with nothing to do says so, rather than showing empty boxes');

{
  const resolvedOnly = workRecords.filter((r) => r.analysis.currentStatus === 'resolved');
  const page = composeOverview(resolvedOnly, DEMO_NOW);
  assert(page.lead === null, 'No lead when nothing needs doing.');
  assert(page.security.length === 0, 'No security band.');
  assert(page.allClear, 'And the page knows it is all clear.');
}

group('The composition never crosses the account boundary');

{
  const page = composeOverview([...workRecords, ...personalRecords], DEMO_NOW);
  const shown = [
    ...(page.lead ? [page.lead] : []),
    ...page.sections.flatMap((s) => s.records),
    ...page.security,
  ];
  const accounts = new Set(shown.map((r) => r.thread.accountId));
  // Both accounts' records were handed in deliberately. The composition does
  // not filter by account, because `useViewData` already scopes to one: this
  // asserts that it does not invent a merge of its own.
  assert(accounts.size <= 2, 'It composes what it is given and merges nothing.');
  assert(
    shown.every((r) => r.thread.accountId === r.analysis.accountId),
    'Every row carries matching thread and analysis accounts.'
  );
}

/* ========================================================== 2. the outputs */

group('Four output kinds, each saying what it is for');

{
  assert(OUTPUT_KINDS.length === 4, 'Four kinds.');
  for (const kind of OUTPUT_KINDS) {
    assert(kind.description.trim().length > 40, `${kind.kind}: described.`);
    assert(kind.useWhen.trim().length > 20, `${kind.kind}: says when to use it.`);
    assert(kind.documentKind.trim().length > 3, `${kind.kind}: names the document kind.`);
    assert(outputDefinition(kind.kind).kind === kind.kind, `${kind.kind}: resolvable by key.`);
  }
  assert(
    OUTPUT_KINDS.filter((k) => k.format === 'email_text').length === 1,
    'Exactly one is an email rather than a document.'
  );
}

group('An output is refused when the thread cannot support it');

{
  const unanalysed = workRecords.find((r) => !r.analysis.analysed);
  if (unanalysed) {
    for (const kind of OUTPUT_KINDS) {
      const a = availabilityFor(kind.kind, unanalysed);
      assert(!a.available, `${kind.kind}: refused for an unanalysed thread.`);
      assert(a.reason.length > 20, `${kind.kind}: the refusal explains itself.`);
      assert(a.missing.length > 0, `${kind.kind}: and says what is missing.`);
    }
  }

  const flagged = workRecords.find((r) => r.analysis.securityAlert !== null && r.analysis.analysed);
  if (flagged) {
    const a = availabilityFor('follow_up_email', flagged);
    assert(!a.available, 'No follow-up email for a security-flagged thread.');
    assert(
      /confirms the address is live/i.test(a.reason),
      'And the reason is the real one: a reply confirms the address is live.'
    );
    // A document about it is still allowed, because reading is not replying.
    assert(
      availabilityFor('thread_summary', flagged).available,
      'A report about a flagged thread is still produced, because reading is not replying.'
    );
  }

  const sensitive = workRecords.find(
    (r) => r.analysis.classification.sensitivity === 'sensitive' && r.analysis.analysed
  );
  if (sensitive) {
    assert(
      !availabilityFor('follow_up_email', sensitive).available,
      'No follow-up email for a sensitive thread.'
    );
  }

  const resolved = workRecords.find(
    (r) => r.analysis.currentStatus === 'resolved' && r.analysis.analysed
  );
  if (resolved) {
    assert(
      !availabilityFor('follow_up_email', resolved).available,
      'No follow-up email for a finished conversation.'
    );
  }

  const noDecisions = workRecords.find(
    (r) =>
      r.analysis.analysed &&
      r.analysis.decisionsMade.length === 0 &&
      r.analysis.decisionsRequired.length === 0
  );
  if (noDecisions) {
    const a = availabilityFor('decision_log', noDecisions);
    assert(!a.available, 'No decision log where no decision exists.');
    assert(
      /empty page|no decision/i.test(a.reason),
      'And it says a decision log of nothing would be an empty page.'
    );
  }
}

group('The payload matches the schema contract');

{
  const record = richest(workRecords);
  for (const kind of OUTPUT_KINDS.map((k) => k.kind)) {
    if (!availabilityFor(kind, record).available) continue;
    const payload = buildOutputPayload(kind, { record, ...base });

    assert(payload.document.kind.length > 0, `${kind}: document.kind is set.`);
    assert(payload.document.footer_label.length > 0, `${kind}: footer_label is set.`);
    assert(
      payload.document.classification === 'Commercial in confidence',
      `${kind}: carries the classification.`
    );
    assert(payload.meta.length <= 4, `${kind}: meta is at most four, as the schema says.`);
    assert(payload.counts.length <= 4, `${kind}: counts are at most four.`);
    assert(payload.notices.length === 3, `${kind}: three cover notices.`);
    assert(
      /entitle|produced under/i.test(payload.notices[0]),
      `${kind}: the entitlement line is first.`
    );
    assert(
      /human review is required/i.test(payload.notices[2]),
      `${kind}: the human review line is last.`
    );
    assert(
      payload.meeting.title_lines.length >= 1 && payload.meeting.title_lines.length <= 3,
      `${kind}: the cover title is one to three lines.`
    );
    assert(payload.tier === 'pro', `${kind}: carries the tier it was produced under.`);
  }
}

group('Every register row carries the point in the record it came from');

{
  const record = richest(workRecords);
  const payload = buildOutputPayload('thread_summary', { record, ...base });

  for (const key of ['decisions', 'actions', 'risks'] as const) {
    const register = payload[key];
    if (!register) continue;
    assert(register.rows.length > 0, `${key}: a register that exists has rows.`);
    assert(
      register.columns.length === register.rows[0].length,
      `${key}: every row has as many cells as there are columns.`
    );
    for (const row of register.rows) {
      const evidence = row[row.length - 1];
      assert(
        evidence.trim().length > 0,
        `${key}: the evidence cell is never blank ("${row[1]?.slice(0, 30)}").`
      );
    }
    assert(
      /from the thread/i.test(register.columns[register.columns.length - 1]),
      `${key}: the last column is the evidence column.`
    );
  }
}

group('An inferred date never poses as a stated one');

{
  const withInferred = workRecords.find(
    (r) => r.analysis.analysed && r.analysis.suggestedDates.length > 0
  );
  if (withInferred && availabilityFor('action_plan', withInferred).available) {
    const payload = buildOutputPayload('action_plan', { record: withInferred, ...base });
    const dates = payload.decisions;
    assert(Boolean(dates), 'The action plan carries a dates register.');
    const inferredRows = dates!.rows.filter((row) => /not stated/i.test(row[3]));
    assert(
      inferredRows.length === withInferred.analysis.suggestedDates.length,
      'Every inferred date is labelled as not stated.'
    );
    assert(
      Boolean(dates!.callout) && /worked out/i.test(dates!.callout!.title),
      'And the register carries a callout saying they were worked out.'
    );
  }

  assert(basisLabel('stated') === 'Stated', 'A stated basis says stated.');
  assert(basisLabel('inferred') === 'Inferred', 'An inferred basis says inferred.');
  assert(basisLabel('calculated') === 'Calculated', 'A calculated basis says calculated.');
}

group('Nothing in a document was invented');

{
  const record = richest(workRecords);
  const payload = buildOutputPayload('thread_summary', { record, ...base });
  const a = record.analysis;

  // Every action in the register is an action in the analysis, by description.
  const described = new Set([
    ...a.actions.map((x) => x.description),
    ...a.commitments.map((x) => x.description),
  ]);
  for (const row of payload.actions?.rows ?? []) {
    assert(described.has(row[1]), `The action "${row[1].slice(0, 40)}" came from the analysis.`);
  }

  const decisions = new Set([
    ...a.decisionsMade.map((x) => x.description),
    ...a.decisionsRequired.map((x) => x.description),
  ]);
  for (const row of payload.decisions?.rows ?? []) {
    assert(decisions.has(row[1]), `The decision "${row[1].slice(0, 40)}" came from the analysis.`);
  }

  assert(
    payload.executive?.points.some((p) => p.text === a.oneLineSummary),
    'The summary is the analysis summary, word for word.'
  );
  assert(
    payload.executive?.points.some((p) => p.text === a.whyItMatters),
    'And so is why it matters.'
  );
}

group('A section with nothing in it is omitted, not left empty');

{
  const thin = workRecords.find(
    (r) =>
      r.analysis.analysed &&
      r.analysis.risks.length === 0 &&
      r.analysis.securityAlert === null
  );
  if (thin) {
    const payload = buildOutputPayload('thread_summary', { record: thin, ...base });
    assert(
      payload.risks === undefined,
      'A thread with no risks produces no risk register, rather than an empty heading.'
    );
  }

  const noDecisions = workRecords.find(
    (r) =>
      r.analysis.analysed &&
      r.analysis.decisionsMade.length === 0 &&
      r.analysis.decisionsRequired.length === 0
  );
  if (noDecisions) {
    const payload = buildOutputPayload('thread_summary', { record: noDecisions, ...base });
    assert(payload.decisions === undefined, 'And no decision register either.');
  }
}

/* ================================================== 3. the follow-up email */

group('The follow-up email says only what the thread says');

{
  const record = workRecords.find(
    (r) => r.analysis.analysed && availabilityFor('follow_up_email', r).available
  );
  assert(Boolean(record), 'There is a thread that can take a follow-up.');

  if (record) {
    const email = buildFollowUpEmail({ record, ...base });
    const a = record.analysis;

    assert(email.subject.startsWith('Re: '), 'The subject is a reply subject.');
    assert(!/^Re: Re:/i.test(email.subject), 'And it does not stack Re: prefixes.');
    assert(email.to.length > 0, 'It resolves recipients from the thread.');
    assert(
      email.to.every((t) => !t.includes('you@your-practice.example')),
      'And never addresses the account holder.'
    );

    for (const d of a.decisionsMade) {
      assert(email.body.includes(d.description), 'Every agreed decision is in the body.');
    }
    for (const action of a.actions) {
      assert(email.body.includes(action.description), 'Every action is in the body.');
    }

    // The commitments list is what sending it would promise.
    const mine = a.actions.filter((x) => x.ownerIsSelf);
    assert(
      email.commits.length >= mine.length,
      'Every action of your own is listed as something it commits you to.'
    );
    assert(
      !/\bI will get back to you\b|\bas soon as possible\b|\bASAP\b/i.test(email.body),
      'It makes no promise the thread does not contain.'
    );
    assert(
      /tell me and I will correct it/i.test(email.body),
      'And it invites a correction, because it is a record somebody else has to agree with.'
    );
  }
}

group('An organisation is not greeted by its first word');

{
  const org = workRecords.find(
    (r) =>
      r.analysis.analysed &&
      /accounts|group|collective|advisory|legal/i.test(r.counterpartyName) &&
      availabilityFor('follow_up_email', r).available
  );
  if (org) {
    const email = buildFollowUpEmail({ record: org, ...base });
    assert(
      email.body.startsWith('Hi there,'),
      `An organisation gets "Hi there" rather than "Hi ${org.counterpartyName.split(' ')[0]}" (got "${email.body.split('\n')[0]}").`
    );
  }
}

group('Recipients are deduplicated and exclude the account holder');

{
  const record = richest(workRecords);
  const people = recipientsFor(record);
  assert(new Set(people).size === people.length, 'No recipient appears twice.');
  assert(
    people.every((p) => !p.includes(workDataset.account.primaryAddress)),
    'The account holder is not a recipient of their own email.'
  );
}

/* ====================================================== 4. the renderer */

group('The document is drawn with the Workspace document stylesheet');

{
  const record = richest(workRecords);
  const payload = buildOutputPayload('thread_summary', { record, ...base });
  const html = renderOutputDocument(payload, { producedAt: DEMO_NOW });
  // The template wraps prose across lines, so sentence matches run against a
  // whitespace-normalised copy. Matching the raw string would fail on a line
  // break and say nothing about the document.
  const flat = html.replace(/\s+/g, ' ');

  assert(html.startsWith('<!doctype html>'), 'It is a complete document.');
  assert(
    html.includes(DOCUMENT_STYLESHEET),
    'It links the Workspace document stylesheet rather than inventing a second one.'
  );
  assert(html.includes('class="sheet"'), 'It uses the sheet class that stylesheet defines.');
  assert(html.includes('class="desk"'), 'And the desk the sheet sits on.');
  assert(html.includes(DOCUMENT_LOCKUP), 'It uses the supplied lockup file.');
  assert(
    !/<svg|<path/i.test(html),
    'And never redraws the mark, which the brand rules forbid.'
  );
  assert(
    flat.includes('is not affiliated with, endorsed by, or partnered with'),
    'It carries the independence disclaimer.'
  );
  assert(flat.includes('ACN 701 605 898'), 'And the company identifiers.');
  assert(flat.includes('ABN 61 701 605 898'), 'Both of them.');
  assert(!html.includes('—') && !html.includes('–'), 'No em dash or en dash anywhere in it.');
  assert(
    (html.match(/class="no"/g) ?? []).length >= 3,
    'Sections are numbered, as the specimens are.'
  );
}

group('Content from a thread cannot become markup');

{
  const record = richest(workRecords);
  const payload = buildOutputPayload('thread_summary', { record, ...base });

  // A subject carrying markup is the obvious attack on a renderer that builds
  // HTML from mail. Email is untrusted data everywhere else in this module and
  // it is untrusted here too.
  const hostile = {
    ...payload,
    meeting: {
      ...payload.meeting,
      title_lines: ['<script>alert(1)</script>'],
      subtitle: '<img src=x onerror="alert(2)">',
    },
    document: { ...payload.document, kind: '"><script>alert(3)</script>' },
  };

  const html = renderOutputDocument(hostile, { producedAt: DEMO_NOW });
  assert(!html.includes('<script>alert(1)'), 'A script tag in a subject is escaped.');
  assert(!html.includes('onerror="alert(2)"'), 'An event handler in a summary is escaped.');
  assert(!html.includes('"><script>alert(3)'), 'And an attribute break in the kind is escaped.');
  assert(html.includes('&lt;script&gt;'), 'The text is still shown, escaped.');
}

group('The file name is one a person can find again');

{
  const record = richest(workRecords);
  const payload = buildOutputPayload('action_plan', { record, ...base });
  const name = documentFileName(payload, DEMO_NOW);
  assert(name.startsWith('concludo-'), 'It is named for the company.');
  assert(name.includes('action-plan'), 'And for the kind of document.');
  assert(/\d{4}-\d{2}-\d{2}/.test(name), 'And carries the date.');
  assert(name.endsWith('.html'), 'With a real extension.');
  assert(!/[^a-z0-9.-]/.test(name), 'And nothing in it that a file system will argue with.');
}

/* ===================================================== 5. entitlement */

group('Entitlement decides which outputs a tier may produce');

{
  assert(OUTPUT_ENTITLEMENTS.length === 3, 'Three tiers.');
  assert(entitledTo('thread_summary', 'starter'), 'Starter can produce a thread report.');
  assert(entitledTo('action_plan', 'starter'), 'And an action plan.');
  assert(!entitledTo('decision_log', 'starter'), 'But not a decision log.');
  assert(entitledTo('decision_log', 'pro'), 'Pro can.');
  assert(entitledTo('decision_log', 'team'), 'So can Team.');
  for (const e of OUTPUT_ENTITLEMENTS) {
    assert(e.note.trim().length > 15, `${e.tier}: says what the tier includes.`);
  }
}

/* ===================================================== 6. dates and nav */

group('Dates are formatted in the account time zone, not the browser one');

{
  assert(ACCOUNT_TIME_ZONE === 'Australia/Melbourne', 'The account zone is pinned.');
  // A time late in the Melbourne day, written with a UTC offset. Formatted in
  // UTC this lands on the previous date, which is the Stage 3 bug.
  const lateEvening = '2026-10-12T22:30:00+11:00';
  assert(formatDay(lateEvening).includes('12'), `A 10:30pm Melbourne time stays on the 12th (${formatDay(lateEvening)}).`);
  assert(formatDayTime(lateEvening).includes('10:30'), 'And keeps its local clock time.');
  assert(formatDay('not a date') === '', 'Rubbish formats to nothing rather than to "Invalid Date".');
}

group('Outputs replaced Drafts rather than becoming a twelfth tab');

{
  assert(EMAIL_MODULE_DESTINATIONS.length === 11, 'Still eleven tabs.');
  assert(
    EMAIL_MODULE_DESTINATIONS.some((d) => d.path === '/email/outputs'),
    'Outputs is one of them.'
  );
  assert(
    !EMAIL_MODULE_DESTINATIONS.some((d) => d.path === '/email/drafts'),
    'And Drafts is not, because a reply draft is an output.'
  );
  assert(EMAIL_ROUTES.length === 11, 'Eleven routes, still derived from the tab list.');
  assert(
    EMAIL_ROUTES.some((r) => r.path === '/email/outputs'),
    'Including the outputs route.'
  );
  const outputs = EMAIL_MODULE_DESTINATIONS.find((d) => d.path === '/email/outputs')!;
  assert(
    /nothing is sent/i.test(outputs.accessibleDescription),
    'And its description still says nothing is sent from there.'
  );
}

/* ------------------------------------------------------------- summary */

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre Stage 8 outputs: all checks passed.');
