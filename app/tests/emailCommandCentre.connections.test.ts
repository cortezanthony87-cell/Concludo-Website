/**
 * Email Command Centre, connection tests.
 *
 * These cover the wiring between views: how a link keeps the account, where Back
 * returns to, that the related-view counts equal the lists they point at, the
 * triage key arithmetic and the Clear Backlog presets.
 *
 * The first group is a regression test for a real defect. A thread link built as
 * `/email/thread/ID?tab=draft?account=...` lost the account, so a Personal-account
 * "View summary" or "Draft reply" opened the Work account and showed "Thread not found".
 *
 * Run: bun tests/emailCommandCentre.connections.test.ts
 */
import { WORK_DATASET, PERSONAL_DATASET } from '../src/lib/email/data';
import { recordsFor } from '../src/lib/email/filters';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import {
  needsAttentionItems,
  replyQueueItems,
  datedItems,
  waitingItems,
  quickWinItems,
  securityItems,
} from '../src/lib/email/views';
import { appendParams, parseFrom, threadHref, parsePreset, backlogHref, BACKLOG_PRESETS } from '../src/lib/email/viewLinks';
import { noteVisit, lastDestination, forgetDestination, labelForDestination } from '../src/lib/email/lastDestination';
import { viewCounts, COUNTED_VIEWS, isCountedView } from '../src/lib/email/viewCounts';
import { nextIndex } from '../src/lib/email/useTriageKeys';
import { EMAIL_MODULE_DESTINATIONS } from '../src/lib/email/moduleNav';

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

const NOW = DEMO_NOW;
const linkTo = (path: string) => appendParams(path, { account: 'acct-personal' });

group('Links keep the account (regression for the dropped-account defect)');
{
  const h = threadHref(linkTo, 'thr-p-001', { tab: 'draft', from: '/email/reply-queue' });
  const u = new URL(h, 'http://x');
  assert(u.pathname === '/email/thread/thr-p-001', 'The path is the thread path.');
  assert(u.searchParams.get('account') === 'acct-personal', 'The account survives a link that also has a tab.');
  assert(u.searchParams.get('tab') === 'draft', 'The tab is kept.');
  assert(u.searchParams.get('from') === 'reply-queue', 'The origin is kept as a short key.');
  assert((h.match(/\?/g) ?? []).length === 1, 'There is exactly one question mark.');
  assert(appendParams('/email/x?a=1#h', { b: '2' }) === '/email/x?a=1&b=2#h', 'A query and a hash are both preserved.');
  assert(appendParams('/email/x', { b: null, c: '' }) === '/email/x', 'Empty values add nothing.');
  assert(threadHref(linkTo, 'thr-p-002').includes('account=acct-personal'), 'A plain thread link keeps the account.');
}

group('Back returns to where the thread was opened');
{
  assert(parseFrom('?from=reply-queue') === '/email/reply-queue', 'A known key maps to its destination.');
  assert(parseFrom('?from=https://evil.example') === null, 'An outside address is refused.');
  assert(parseFrom('?from=thread') === null, 'An unknown key is refused.');
  assert(parseFrom('') === null, 'No key gives null.');
  forgetDestination();
  assert(lastDestination() === null, 'Nothing is remembered at the start.');
  noteVisit('/email');
  assert(lastDestination() === '/email', 'The Overview is remembered, so Back works from it.');
  noteVisit('/email/waiting/');
  assert(lastDestination() === '/email/waiting', 'A trailing slash is the same place.');
  noteVisit('/email/thread/thr-w-001');
  assert(lastDestination() === '/email/waiting', 'A thread path never replaces the remembered destination.');
  assert(labelForDestination('/email/reply-queue') === 'Reply Queue', 'The Back label names the view.');
  assert(labelForDestination('/email') === 'Overview', 'The Overview has a label.');
}

group('Related counts equal the lists they point at');
{
  for (const ds of [WORK_DATASET, PERSONAL_DATASET] as const) {
    const records = recordsFor(ds);
    const input = {
      records,
      drafts: ds.drafts,
      accountId: ds.account.id,
      accountLabel: ds.account.label,
      accountType: ds.account.type,
      now: NOW,
      userDates: [],
    };
    const c = viewCounts(input);
    const tag = ds.account.type;
    assert(c['/email/needs-attention'] === needsAttentionItems(records, ds.account.label, NOW).length, `Needs Attention count matches (${tag}).`);
    assert(c['/email/reply-queue'] === replyQueueItems(records, ds.drafts, NOW).length, `Reply Queue count matches (${tag}).`);
    assert(c['/email/actions-deadlines'] === datedItems(records, NOW, []).length, `Actions and Deadlines count matches (${tag}).`);
    assert(c['/email/waiting'] === waitingItems(records, NOW).length, `Waiting count matches (${tag}).`);
    assert(c['/email/quick-wins'] === quickWinItems(records, NOW).length, `Quick Wins count matches (${tag}).`);
    assert(c['/email/security-review'] === securityItems(records).length, `Security Review count matches (${tag}).`);
    assert(COUNTED_VIEWS.every((v) => typeof c[v] === 'number' && c[v] >= 0), `Every counted view has a count (${tag}).`);
  }
  assert(isCountedView('/email/waiting') && !isCountedView('/email/all') && !isCountedView('/email'), 'Only working views are counted.');
}

group('Accounts are never combined in counts');
{
  const w = viewCounts({ records: recordsFor(WORK_DATASET), drafts: WORK_DATASET.drafts, accountId: WORK_DATASET.account.id, accountLabel: WORK_DATASET.account.label, accountType: WORK_DATASET.account.type, now: NOW, userDates: [] });
  const p = viewCounts({ records: recordsFor(PERSONAL_DATASET), drafts: PERSONAL_DATASET.drafts, accountId: PERSONAL_DATASET.account.id, accountLabel: PERSONAL_DATASET.account.label, accountType: PERSONAL_DATASET.account.type, now: NOW, userDates: [] });
  assert(JSON.stringify(w) !== JSON.stringify(p), 'Work and Personal give different counts from their own records.');
}

group('Triage keys');
assert(nextIndex(-1, 5, 'j') === 0, 'J with nothing focused goes to the first row.');
assert(nextIndex(-1, 5, 'k') === 4, 'K with nothing focused goes to the last row.');
assert(nextIndex(2, 5, 'j') === 3 && nextIndex(2, 5, 'k') === 1, 'J and K move one row.');
assert(nextIndex(4, 5, 'j') === 4 && nextIndex(0, 5, 'k') === 0, 'Movement stops at the ends.');
assert(nextIndex(0, 0, 'j') === -1, 'An empty list focuses nothing.');

group('Clear Backlog presets');
{
  assert(parsePreset('?preset=replies') === 'replies' && parsePreset('?preset=dated') === 'dated' && parsePreset('?preset=unread') === 'unread', 'Known presets are read.');
  assert(parsePreset('?preset=everything') === null && parsePreset('') === null, 'Unknown presets are ignored.');
  assert(backlogHref(linkTo, 'replies') === '/email/clear-backlog?account=acct-personal&preset=replies', 'The preset link keeps the account.');
  assert(backlogHref(linkTo) === '/email/clear-backlog?account=acct-personal', 'No preset gives the plain link.');
  assert(Object.values(BACKLOG_PRESETS).every((p) => p.label.length > 0 && p.flag.length > 0), 'Every preset names an existing selection flag.');
}

group('Every destination is reachable from a key');
for (const d of EMAIL_MODULE_DESTINATIONS.filter((x) => x.path !== '/email')) {
  assert(parseFrom(`?from=${d.path.slice('/email/'.length)}`) === d.path, `${d.label} round-trips through ?from=.`);
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures > 0) {
  console.error(`${failures} failed.`);
  process.exit(1);
}
console.log('Email Command Centre connections: all checks passed.');
