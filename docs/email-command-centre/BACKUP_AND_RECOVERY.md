# Email Command Centre: backup and recovery plan

Concludo Workspace. Final, Stage 7.

The thing worth saying first: **a backup of this database is a backup of
commercially sensitive client correspondence.** It is not a backup of a
to-do list. Most of what is in it is third-party personal information that a
Concludo customer holds and Concludo processes. Everything below follows from
that.

The second thing: **Concludo does not hold the mail.** Message bodies are not
stored. If this entire database were lost, no customer would lose a single
email. They would lose the analysis, which can be rebuilt by re-reading their
mailbox. That makes the recovery objectives for this module genuinely less
severe than for a system of record, and it is worth being honest about that
rather than claiming a tighter target than the risk justifies.

---

## 1. What is backed up, and what cannot be

| Asset | Backed up | Notes |
|---|---|---|
| Analysis database | Yes | Supabase point-in-time recovery, plus a nightly logical dump |
| Audit trail | Yes, same database | The row nobody can edit. Longest retention |
| Backlog sessions | Yes, same database | In-browser sessions are not backed up; see section 6 |
| Provider tokens | **No** | Held in the token store. Backing up a token is backing up a credential; they are re-obtained by reconnecting |
| Token store encryption keys | Yes, by the key management service | Rotated on a schedule. Losing these makes the store unreadable |
| Customer mail | Not applicable | Lives in the customer's mailbox. Concludo never had a copy |
| Model keys, client secrets | By the secret manager | Never in a database backup |

## 2. Objectives

| Objective | Target | Why this number |
|---|---|---|
| Recovery point (RPO) | 5 minutes | Point-in-time recovery gives this. Analysis lost in the window is recomputed from the mailbox |
| Recovery time (RTO), database | 2 hours | A restore plus a smoke test, done by one person |
| Recovery time (RTO), feature | 4 hours | Including re-synchronising connected accounts |
| Audit trail durability | No tolerated loss | It is the record of what the system did, including the deletions |

These are achievable with one person and no runbook heroics, which is the test
of whether an objective is real.

## 3. Schedule

| What | Cadence | Retention | Where |
|---|---|---|---|
| Point-in-time recovery | Continuous | 7 days | Supabase, in region |
| Logical dump (`pg_dump`, custom format) | Nightly, 02:30 Australia/Melbourne | 35 days | Object storage, separate account, encrypted at rest |
| Weekly dump, held longer | Sunday | 12 months | Same, with a lifecycle rule |
| Key management backup | Managed by the service | Per its policy | Key ring, with rotation history |

The dump goes to a **separate cloud account** from the database. A backup in the
same account as the thing it protects is not a backup against the failure mode
that matters most, which is a mistake or a compromise with that account's
credentials.

## 4. Protecting the backups

- Encrypted at rest with a key the database role cannot read.
- Object lock or equivalent for the weekly copies, so a compromised credential
  cannot delete the history.
- Access logged. Reading a backup is an event worth seeing.
- Access limited to the one named person who can perform a restore. There is no
  reason for anybody else to read correspondence analysis in bulk.
- **Never restored to staging or to a laptop.** A restore goes to a fresh
  isolated instance or to production. A copy of production correspondence on a
  developer machine is the most likely way this data leaks, and it would be
  nobody's fault but ours.

## 5. Restore procedure

Rehearsed, not just written. The date of the last rehearsal belongs in the
deployment log.

**Step 1. Decide what happened.** A restore is right for data loss or
corruption. It is the wrong tool for a bad deployment, where the flag and a
rollback are faster and lose nothing.

**Step 2. Stop writes.** Disable the module flag and pause the synchronisation
scheduler. A restore racing a live sync produces a database nobody can reason
about.

**Step 3. Restore to a new instance, never over the top.** Point-in-time
recovery to a timestamp before the damage, into a fresh instance. The damaged
database stays up and read-only, because it is now evidence.

**Step 4. Verify before switching.**

```sql
-- Row-level security is still enabled AND forced on all fifteen tables.
select relname, relrowsecurity, relforcerowsecurity
  from pg_class where relname like 'ecc_%' and relkind = 'r' order by relname;

-- The audit trail came back and still cannot be rewritten.
select count(*) from ecc_audit_event;
select grantee, privilege_type from information_schema.role_table_grants
 where table_name = 'ecc_audit_event' and grantee = 'authenticated';
-- Expect SELECT and INSERT only.

-- No analysed row lost its provenance in the restore.
select count(*) from ecc_analysis where analysed and model is null;
-- Expect 0.

-- Every account's rows still belong to that account.
select count(*) from ecc_analysis a
  join ecc_thread t on t.id = a.thread_id
 where a.account_id <> t.account_id;
-- Expect 0.
```

Any unexpected number stops the switch.

**Step 5. Switch.** Repoint the application, re-enable the flag for internal
accounts only, smoke test the seven post-deployment checks in
`docs/DEPLOY_PRODUCTION.md`.

**Step 6. Re-synchronise.** Cursors in the restored database are older than the
mailboxes. The next run picks up the gap, which is exactly what a cursor is
for. Do **not** clear cursors to "force a refresh": a full resynchronisation of
every account at once is a self-inflicted rate limit.

**Step 7. Tell people.** Any restore that loses analysis is a thing customers
are entitled to hear about, in plain words: what window of analysis was lost,
that no mail was affected, and that it is being rebuilt.

**Step 8. Write it down.** What happened, what was restored, what was lost, how
long it took, and what would have made it faster.

## 6. The cases a database restore does not cover

**A paused backlog session.** Today it lives in the person's browser under
`concludo.ecc.backlog.session.v1`. Clearing site data loses it. Nothing is
recoverable and nothing in a mailbox is affected: the decisions were notes. The
server-side table exists in migration 0001 (`ecc_backlog_session`) for when the
API is built, and that is the fix. Until then the interface says plainly that
the session is kept in this browser.

**A token.** Not backed up, by design. Recovery is reconnection by the person,
with consent shown again. That is a feature.

**The customer's mail.** Concludo cannot restore it and never could. If a
customer deletes a thread in their mailbox, the analysis of it survives here
until the retention window or a deletion request removes it, which is worth
knowing and is covered in `docs/PRIVACY_DELETION.md`.

**A deletion a customer asked for.** This is the sharp edge. A restore brings
back rows that somebody exercised a right to have erased. After **any** restore
to a point before a deletion request, the deletion must be re-applied:

```sql
-- Find deletions recorded after the restore point and re-run them.
select account_id, at, description
  from ecc_audit_event
 where kind = 'account_data_deleted'
   and at > '<restore point>'
 order by at;
```

This is why the audit trail is in the same database and has the longest
retention: it is the only record of what has to be re-done. Put it in the
restore checklist, not in somebody's memory.

## 7. Testing

| Test | Cadence | Pass condition |
|---|---|---|
| Restore a nightly dump to a scratch instance | Monthly | Verification queries in section 5 all pass |
| Full point-in-time rehearsal, timed | Quarterly | Inside the 2 hour RTO, by one person, following this document only |
| Re-apply a deletion after a restore | Quarterly, with the above | The audit query finds it and the re-run reports the same retains block |
| Confirm backups are actually being written | Weekly, automated | An alert if the nightly dump is absent for 36 hours |

A backup that has never been restored is a hypothesis.

## 8. What is deliberately not done

- **No backup of message content**, because there is none to back up.
- **No cross-region replica**, yet. The customers are Australian, the data is in
  an Australian region, and a second region adds a second place correspondence
  analysis lives. When there is a reason, it gets its own review.
- **No long-term archive of analysis.** Twelve months on the weekly copies is
  enough to recover from a mistake. Keeping client correspondence analysis for
  seven years because storage is cheap is not a plan, it is an unexamined
  liability.
