# Email Command Centre: incident response plan

Concludo Workspace. Final, Stage 7.

Written for the company that exists: one person on call, no rota, no second
engineer at 3am. Every procedure below is one somebody can actually carry out
alone, and the fallback for all of them is the same pair of reversible actions:
turn the module off and pause the synchronisation scheduler.

Concludo is pre-revenue. There are no customers to notify today. The
notification sections are written now, before there are, because that is the
only time they get written honestly.

---

## 1. The two actions that buy time

Memorise these. They are safe, reversible, and correct in almost every
scenario:

```
# 1. Hide the module and stop new analysis being requested.
VITE_ECC_ENABLED=false     # redeploy or flip the flag

# 2. Stop the scheduled synchronisation for the module.
#    Do NOT clear any stored cursor. A cursor is how a resumed sync knows
#    what it has already seen.
```

Doing both takes under five minutes and loses nothing. Do them first and think
second, in anything that looks like severity 1.

## 2. Severity

| Severity | Meaning | Response |
|---|---|---|
| **S1** | Customer data exposed, a credential leaked, an unapproved external action, or silent data loss | Immediate. Both actions in section 1, then investigate |
| **S2** | The feature is broken or wrong for many accounts, but nothing escaped and nothing was lost | Same business day |
| **S3** | Wrong for one account, or degraded | Next business day |
| **S4** | Cosmetic, or a limitation somebody has hit | Backlog |

A thing being alarming does not make it S1. A phishing email arriving in a
customer's mailbox is not an incident; the module flagging it is the module
working.

## 3. The S1 playbooks

### S1-A. A token, secret or key reached a log

**Assume compromise.** A credential in a log is in the log aggregator, the
backups, and anywhere those have been shipped.

1. Both actions in section 1.
2. Rotate the leaked secret at its source: client secret in the provider
   portal, model key with the provider, or token store key in the key
   management service.
3. Revoke the affected tokens at Microsoft or Google, so an exfiltrated token
   is useless even if it is already out.
4. Only now, find the log line. Search every sink, including the ones that
   forward elsewhere.
5. Purge where purging is possible, and record where it is not. Honesty about
   what cannot be deleted is part of the record.
6. Fix the code path. `redactDeep` exists and wraps the logger; a leak means a
   path bypassed it. Add the test that would have caught it.
7. Notify, per section 5.

### S1-B. An external action ran without approval

Today this can only mean saving a draft to a mailbox, because nothing else is
implemented. It would still be the most serious kind of failure this product
can have, because the approval gate is its central claim.

1. Turn off `write_draft_to_mailbox` for every account:

```sql
update ecc_capability_grant
   set revoked_at = now()
 where capability = 'write_draft_to_mailbox' and revoked_at is null;
```

2. Both actions in section 1.
3. Count what happened and find each one:

```sql
select a.account_id, a.thread_id, a.payload_fingerprint, a.executed_at, a.approved_at
  from ecc_action_approval a
 where a.executed_at is not null
 order by a.executed_at desc;
```

Any row with `executed_at` set and no matching approval, or with
`invalidated_at` before `executed_at`, is the incident.

4. Tell the affected people what appeared in their Drafts folder. A draft is
   unsent, which limits the harm, and they are still entitled to know.
5. Do not re-enable the capability for anyone until the gate has a test that
   reproduces the failure and fails without the fix.

### S1-C. One account's data appeared under another

1. Both actions in section 1.
2. Establish the blast radius before touching anything:

```sql
-- Child rows whose account does not match their thread's account.
select 'analysis' as table, count(*) from ecc_analysis a
  join ecc_thread t on t.id = a.thread_id where a.account_id <> t.account_id
union all
select 'extraction', count(*) from ecc_extraction e
  join ecc_thread t on t.id = e.thread_id where e.account_id <> t.account_id
union all
select 'draft', count(*) from ecc_draft d
  join ecc_thread t on t.id = d.thread_id where d.account_id <> t.account_id;
```

The trigger in migration 0002 should make all three zero. A non-zero count
means either the trigger is missing or the write went in before it existed;
check both.

3. Check whether the leak was *shown* to anybody, which is a different question
   from whether it was stored. The combined account view is opt-in:

```sql
select account_id, granted_at from ecc_capability_grant
 where capability = 'combined_account_view' and revoked_at is null;
```

4. Work out whether two different **people** were involved or one person's two
   accounts. The first is a notifiable breach. The second is a serious bug and a
   broken promise, and the customer still gets told.
5. Fix forward, then delete the mis-attributed rows. Do not delete first: they
   are the evidence.

### S1-D. Silent data loss (a cursor advanced on an incomplete run)

1. Pause the scheduler. **Do not reset a cursor.**
2. Identify the accounts from the alert labels and read their recent audit
   events for sync outcomes.
3. For each affected account, force one full resynchronisation by setting the
   cursor to null for that account only:

```sql
update ecc_account set sync_cursor = null where id = '<account id>';
```

That re-reads the mailbox from the beginning, which the idempotency ledger
makes safe: duplicates are skipped by provider message id.

4. Resume the scheduler for those accounts first, and watch.
5. Find the code path. The rule is that the cursor advances only when
   `nextPageToken === null`; something advanced it elsewhere.
6. Tell the affected people. "Some of your mail was not analysed between these
   times, it has been re-analysed now, and nothing in your mailbox was changed"
   is a message people accept. Finding out later is not.

### S1-E. A prompt injection changed behaviour

The capability layer is the lock and the detector is only the alarm, so this
should be impossible rather than unlikely: there is no send, forward, delete or
execution behind the gate for an instruction to reach. If it happens anyway,
something structural has gone.

1. Both actions in section 1.
2. Find the message and keep it. It is the test case.
3. Work out which control failed: the wrapper, the capability denial, or the
   provider interface. One of those three is not what the documents say it is.
4. Do not "improve the detector" as the fix. Tightening an alarm after a lock
   failed is treating the wrong layer, and `docs/THREAT_MODEL.md` says why.

## 4. The S2 playbooks, briefly

| Incident | First move |
|---|---|
| Analysis wrong for many accounts after a prompt change | Revert the prompt version. Every generated field records it, so the affected rows are findable |
| Deadlines off by a day | Check for a date formatted without a `timeZone`. This has happened once, in Stage 3, and has a regression test |
| A queue ordered wrongly | Check for ISO timestamps compared as strings. The data mixes `+10:00` and `+11:00`. Also Stage 4, also tested |
| Sync stuck on one provider | Read `Retry-After` compliance. Retrying faster than asked makes throttling worse |
| The dashboard sending huge pages | The queue cap in `buildDashboard` has regressed. It is ten |
| A view blank for one account | An unknown account is an error state, not an empty one. Check which it rendered |

## 5. Notification

### Who decides

The founder decides whether an incident is notifiable. There is nobody else to
decide, and pretending otherwise would produce a plan that does not run.

### Customers

Notify when: their data was exposed to anybody, an action occurred in their
mailbox without their approval, analysis was lost or wrong in a way they may
have acted on, or their mailbox was read outside what they consented to.

Within 72 hours of confirming it, and sooner if they can still act on it. In
plain words: what happened, what of theirs was involved, what has been done,
what they should do, and who to reply to. No "incident affecting a subset of
infrastructure".

### Regulator

Australian Privacy Act notifiable data breach obligations apply: where there is
unauthorised access to or disclosure of personal information and a likelihood
of serious harm, notify the Office of the Australian Information Commissioner
and affected individuals as soon as practicable, and within 30 days of becoming
aware. Mailbox analysis is exactly the kind of processing where that threshold
is reached, because the content is correspondence with third parties who never
dealt with Concludo at all.

Concludo is not a law firm and this paragraph is not legal advice. Get advice
during the incident, not after it.

### Providers

If a Microsoft or Google credential or token was involved, tell them. Both have
a process and both would rather hear it from us.

## 6. Evidence

Before fixing anything in an S1:

- Capture the relevant audit rows, log lines and metric snapshots.
- Do **not** delete the affected rows. Fix forward, delete afterwards.
- Do not restore over the damaged database. Restore to a new instance and leave
  the original read-only.
- Note the time of every action taken, as it is taken. Reconstructing a
  timeline afterwards from memory is where incident reports go wrong.

## 7. Afterwards

Within five business days, written down, kept with the other project records:

1. What happened, in one paragraph.
2. The timeline, with times.
3. What was affected, counted rather than estimated.
4. Which control failed, and whether it was absent, present and wrong, or
   present and bypassed.
5. The test that now exists and would have caught it. If there is no such test,
   say so and say why.
6. What was told to whom, and when.
7. Whether `docs/KNOWN_LIMITATIONS.md` needs a new entry.

No blame section. One person wrote all of this, and the failures found during
Stage 7 were found by tests written in the same week as the code they broke.
That is the point of the tests, not a reason to be embarrassed.

## 8. Contacts

| Role | Who |
|---|---|
| On call, incident owner | Founder |
| Privacy decisions | Founder, with external advice |
| Microsoft Entra ID application | Founder |
| Google Cloud project | Founder |
| Supabase project | Founder |
| Model provider account | Founder |

This table is the risk, not the plan. Single-person response is a documented
limitation in `docs/KNOWN_LIMITATIONS.md`, and the 45-minute automatic fallback
in `docs/ALERTING.md` exists because of it.
