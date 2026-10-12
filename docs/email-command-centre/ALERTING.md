# Email Command Centre: alerting plan

Concludo Workspace. Final, Stage 7.

An alert that fires often enough to be ignored is worse than no alert. Four
things wake somebody up. Everything else arrives as a ticket or in the weekly
review.

Concludo is a very small company. "Page" means a phone notification to the one
person on call, which today is the founder. That is a constraint on how many
alerts can exist, and it is the honest reason this list is short.

---

## 1. Page immediately

### P1. A cursor advanced on a run that did not complete

```
increase(ecc_sync_cursor_advanced_total[15m])
  > increase(ecc_sync_runs_total{outcome=~"completed|completed_with_resync"}[15m])
```

**Why this is first.** This is the only failure in the module that loses
customer data silently and permanently. A cursor past unprocessed messages
means those messages are never fetched, never analysed and never missed by
anyone until somebody asks why a thread never appeared.

**First action.** Stop the synchronisation scheduler. Do not reset any cursor.
Take the affected account ids from the metric labels and read their last sync
audit events.

### P2. A token or secret reached a log

```
count_over_time({job="concludo"} |~ "(?i)(access_token|refresh_token|client_secret|bearer [a-z0-9]|api[_-]?key)" [5m]) > 0
```

**Why.** A credential in a log is a credential in a backup, a log aggregator,
and anywhere those are shipped. The window for containment is hours.

**First action.** Treat it as a credential compromise, not a logging bug. Rotate
the secret, revoke the affected tokens at the provider, then find the log line.
`docs/INCIDENT_RESPONSE.md` has the sequence.

### P3. An external action ran without a matching approval

```
increase(ecc_drafts_saved_to_mailbox_total[5m]) > 0
  unless increase(ecc_approvals_total{kind="save_draft_to_mailbox"}[10m]) > 0
```

and, separately and always:

```
increase(ecc_action_refusals_total{because="release_disabled"}[5m]) > 0
```

**Why.** The first says something reached a customer's mailbox without the
approval that is supposed to be the only way to get there. The second says code
tried to run an action the release disables, which means a path exists that
should not.

**First action.** Turn off the `write_draft_to_mailbox` capability for every
account, then investigate. The guarantee in `approvals.ts` is the product's
most load-bearing claim and it is either true or it is not.

### P4. Cross-account or cross-tenant access was attempted

```
increase(ecc_account_mismatch_refusals_total[15m]) > 0
or increase(ecc_cross_account_query_errors_total[15m]) > 0
or increase(ecc_scope_guard_refusals_total[15m]) > 0
```

**Why.** All three were refused, which is the system working. They are still
page-worthy, because each one means code attempted something the product
promises it cannot do, and the next version of that code might not be refused.

**First action.** Find the request id, read the trace, and work out whether it
was a bug or an attempt.

## 2. Ticket within a business day

| Alert | Condition | Why not a page |
|---|---|---|
| Sync success rate below 90 per cent | `rate(ecc_sync_runs_total{outcome=~"completed.*"}[1h]) / rate(ecc_sync_runs_total[1h]) < 0.90` | Usually a provider having a bad hour. Mail is delayed, not lost: the cursor did not move |
| Analysis queue backing up | `ecc_analysis_queue_depth > 500 for 30m` | Slow, not wrong. The dashboard says which threads are unanalysed |
| Repeated rate limiting | `increase(ecc_sync_backoff_seconds_total[1h]) > 600` | The backoff is working. Worth a look at the schedule |
| Model validation failures rising | `increase(ecc_validation_failures_total[1h]) > 20` | A prompt has probably drifted. Invalid fields are dropped, not displayed |
| Credential revoked or permission expired | `increase(ecc_sync_runs_total{outcome=~"credential_revoked|permission_expired"}[1h]) > 0` | Often the person revoked it on purpose. Needs a message to them, not a page |
| Retention sweep did not run | `absent_over_time(ecc_retention_sweeps_total[36h])` | A day of extra retention is not an emergency. A week is |
| p99 page size above 1 MB | `histogram_quantile(0.99, ecc_page_size_bytes) > 1e6` | The queue cap has regressed. Slow, not unsafe |
| Error rate above 2 per cent | `rate(ecc_api_requests_total{status=~"5.."}[15m]) / rate(ecc_api_requests_total[15m]) > 0.02` | Visible to the person as an error state that tells the truth |
| Injection detector flagging ordinary mail | `rate(ecc_injection_findings_total[24h])` more than triple the trailing week | A warning that is usually wrong stops being read. Tune it, do not ignore it |
| Starter cap hit by many accounts | `increase(ecc_entitlement_cap_hits_total[24h]) > 20` | A commercial signal, not a fault |

## 3. Weekly review only

Everything in section 13 of `docs/MONITORING.md`: refusal mixes, backlog usage,
draft withholding reasons, approval invalidation fields, cost per account.

## 4. What deliberately has no alert

Stated so nobody adds one later without arguing for it.

- **Per-person throughput.** How long somebody takes per item, how many they
  clear, whether that is more or less than last week. The product has a rule
  against productivity scoring and an alert is a productivity score with a
  pager attached.
- **A high backlog count.** A person with four hundred unread threads has not
  triggered an incident.
- **A security alert on a thread.** The module raising an advisory is the module
  working. Alerting on it would mean alerting on a phishing email arriving,
  which happens every day.
- **An injection attempt detected.** Same reasoning. The capability layer is the
  lock; the detector is the alarm, and the alarm is for the person reading their
  own mail, not for the on-call.
- **A person deciding "manual review".** That is a person using the feature
  correctly.

## 5. Escalation

| Time | Who |
|---|---|
| 0 minutes | On call, by phone notification |
| 20 minutes, unacknowledged | Second channel: SMS |
| 45 minutes, unacknowledged | Fall back to the documented safe state: disable the module flag, pause the synchronisation scheduler. Both are reversible and both are better than an unattended P1 |

With one person on call, the 45-minute fallback is the real mitigation. It is
written down so that it is a decision made in advance rather than one made at
3am.

## 6. Testing the alerts

Before the module is enabled for anybody, each of the four P1 alerts is fired
deliberately on staging and the notification is confirmed to arrive:

| Alert | How to fire it on staging |
|---|---|
| P1 | Increment the cursor counter without a completed run, from a test harness |
| P2 | Log a fake string shaped like a token, in the staging environment only |
| P3 | Call the draft-save counter directly with no approval row |
| P4 | Call `planAction` with a mismatched account id, which refuses and increments |

An alert that has never fired is an alert nobody knows is wired up. Re-test
after any change to the alerting pipeline, and record the date in the
deployment log.

## 7. Silences

Any silence longer than four hours needs a reason written in the ticket and an
expiry. A silence with no expiry is a deleted alert with extra steps.

The four P1 alerts cannot be silenced for longer than one hour. If one of them
is firing continuously, the correct action is to disable the module, not to
silence the alert.
