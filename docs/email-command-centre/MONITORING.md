# Email Command Centre: monitoring plan

Concludo Workspace. Final, Stage 7.

What to measure, and why each one is worth a dashboard. The alerting thresholds
are in `docs/ALERTING.md`; this file is about what is watched and what a healthy
reading looks like.

One rule runs through all of it: **no metric is labelled with message content,
a subject line, a sender address or a person's name.** A monitoring system is
not a place to put a customer's correspondence, and a dashboard is seen by more
people than the mailbox ever was.

---

## 1. The four signals that matter most

If only four things could be watched, these:

| Signal | Healthy | What it being wrong means |
|---|---|---|
| Synchronisation outcome mix | over 98 per cent `completed` | mail is not arriving, and nobody has noticed |
| Analysis completion rate | over 95 per cent of queued threads analysed within 15 minutes | the dashboard is showing a person a partial inbox |
| Cursor advance rate | one advance per account per successful run | a stuck cursor means silent data loss |
| Approval refusals by reason | mostly `not_approved`, a trickle of `approval_expired` | a `release_disabled` refusal means something tried to run a disabled action |

The fourth is the unusual one. A refusal is normal and healthy; a refusal
because the **release** said no means a code path tried to reach a disabled
action, and that is worth looking at the same day.

## 2. Synchronisation

| Metric | Type | Labels | Notes |
|---|---|---|---|
| `ecc_sync_runs_total` | counter | `provider`, `outcome` | Outcomes: `completed`, `completed_with_resync`, `rate_limited`, `permission_expired`, `credential_revoked`, `provider_unavailable`, `partial` |
| `ecc_sync_duration_seconds` | histogram | `provider` | p50, p95, p99 |
| `ecc_sync_pages_fetched` | histogram | `provider` | A run at the 50 page ceiling is a run that stopped early |
| `ecc_sync_messages_new` | counter | `provider` | |
| `ecc_sync_duplicates_skipped` | counter | `provider` | Providers redeliver. Zero is suspicious, not clean |
| `ecc_sync_cursor_advanced_total` | counter | `provider` | Compare with `completed` runs: they should match |
| `ecc_sync_resync_total` | counter | `provider` | An expired cursor. A rising count means cursors are expiring faster than the schedule |
| `ecc_sync_backoff_seconds_total` | counter | `provider` | Time spent waiting on a rate limit |

Watch the ratio of `cursor_advanced` to `completed`. They should be equal. If
advances exceed completions, a cursor is being advanced by a run that did not
finish, which is the one bug in this layer that loses data silently and forever.

## 3. Analysis pipeline

| Metric | Type | Labels |
|---|---|---|
| `ecc_pipeline_runs_total` | counter | `outcome` (`usable`, `degraded`, `failed`) |
| `ecc_stage_results_total` | counter | `stage`, `outcome` (`completed`, `skipped`, `failed`, `blocked`) |
| `ecc_stage_duration_seconds` | histogram | `stage` |
| `ecc_threads_analysed_total` | counter | `account_type` |
| `ecc_analysis_queue_depth` | gauge | |
| `ecc_analysis_age_seconds` | histogram | Time from message arrival to analysis |

`ecc_stage_results_total{outcome="skipped"}` will be large and that is correct:
eight of the twenty-two stages are specified and not built, and the runner
reports them as skipped rather than claiming them as completed. What matters is
that a stage marked `implemented` never reports `skipped`.

## 4. Model calls, when they exist

| Metric | Type | Labels |
|---|---|---|
| `ecc_model_calls_total` | counter | `stage`, `outcome` |
| `ecc_model_latency_seconds` | histogram | `stage` |
| `ecc_model_tokens_total` | counter | `stage`, `direction` |
| `ecc_model_cost_cents_total` | counter | `stage` |
| `ecc_validation_failures_total` | counter | `schema`, `issue` |

`ecc_validation_failures_total` is the prompt-drift detector. A model that
starts returning a field nobody asked for, or a timestamp without an offset,
shows up here before it shows up as a wrong date on somebody's screen. A sudden
rise after a prompt change is the prompt change.

## 5. Security and safety

| Metric | Type | Labels |
|---|---|---|
| `ecc_injection_findings_total` | counter | `pattern` |
| `ecc_security_alerts_total` | counter | `flag`, `severity` |
| `ecc_tracking_pixels_stripped_total` | counter | |
| `ecc_remote_content_stripped_total` | counter | |
| `ecc_capability_refusals_total` | counter | `capability`, `reason` |
| `ecc_scope_guard_refusals_total` | counter | `provider`, `scope` |
| `ecc_action_refusals_total` | counter | `kind`, `because` |

`ecc_scope_guard_refusals_total` should be flat at zero in production. A
non-zero reading means code tried to request a scope that is not declared or is
forbidden, which is a deployment problem, not a user problem.

`ecc_action_refusals_total{because="release_disabled"}` should also be flat at
zero. See section 1.

## 6. Account and tenant boundaries

| Metric | Type | Labels |
|---|---|---|
| `ecc_account_mismatch_refusals_total` | counter | `surface` |
| `ecc_combined_view_enabled_accounts` | gauge | |
| `ecc_cross_account_query_errors_total` | counter | |

All three should be zero or flat. These are not performance metrics; they are
the instrumentation of a promise. A single `ecc_account_mismatch_refusals_total`
increment means something tried to read one account's data with another's token
and was refused, and it is worth tracing the same day even though the refusal
worked.

## 7. Approvals and drafts

| Metric | Type | Labels |
|---|---|---|
| `ecc_approvals_total` | counter | `kind` |
| `ecc_approvals_invalidated_total` | counter | `kind`, `field` |
| `ecc_drafts_generated_total` | counter | `status` |
| `ecc_drafts_withheld_total` | counter | `reason` |
| `ecc_drafts_saved_to_mailbox_total` | counter | |

`ecc_drafts_saved_to_mailbox_total` is the only counter in this document that
represents an external side effect. It must be zero until the capability is
turned on by somebody, and each increment should be traceable to one approval
row. Watch it.

`ecc_approvals_invalidated_total{field="body"}` rising sharply usually means a
draft is being generated badly enough that everybody edits it, which is a
product signal rather than an incident.

## 8. Backlog mode

| Metric | Type | Labels |
|---|---|---|
| `ecc_backlog_sessions_started_total` | counter | `batch_size` |
| `ecc_backlog_sessions_resumed_total` | counter | |
| `ecc_backlog_decisions_total` | counter | `state` |
| `ecc_backlog_batch_size` | histogram | |
| `ecc_backlog_session_abandoned_total` | counter | Paused and never resumed within the window |

Deliberately **not** measured: how long a person spends per item, how many
items a person clears per session, or any comparison between people. Those are
the numbers that turn into a productivity score, and the product has a rule
against it that a dashboard would quietly undo.

## 9. Interface health

| Metric | Type | Labels |
|---|---|---|
| `ecc_view_render_errors_total` | counter | `view` |
| `ecc_api_requests_total` | counter | `route`, `status` |
| `ecc_api_latency_seconds` | histogram | `route` |
| `ecc_page_size_bytes` | histogram | `route` |

`ecc_page_size_bytes` exists because of a Stage 7 finding: the dashboard used
to build every row of every queue, and a 10,000 thread account would have sent
a page several thousand rows long. The queues are capped at ten now. A p99 page
size in the megabytes means something has regressed.

## 10. Privacy operations

| Metric | Type | Labels |
|---|---|---|
| `ecc_retention_sweeps_total` | counter | `outcome` |
| `ecc_retention_rows_removed_total` | counter | `table` |
| `ecc_exports_total` | counter | |
| `ecc_deletions_total` | counter | |
| `ecc_audit_events_written_total` | counter | `kind` |

A retention sweep that reports zero rows removed, every day, for an account
with analysis older than its window, is a sweep that is not running.

## 11. Dashboards

Four, not fourteen.

**Operations.** Sync outcome mix, analysis completion rate, queue depth,
cursor advance ratio, API error rate, API p95. The one a person looks at when
something feels wrong.

**Safety.** Injection findings, security alerts, capability refusals, scope
guard refusals, action refusals by reason, account mismatch refusals, drafts
saved to mailbox. The one a person looks at weekly whether or not anything feels
wrong.

**Cost.** Model calls, tokens, cost, analysis per account, Starter cap hits.
The one that stops a surprise invoice.

**Product.** Backlog sessions and decisions by state, drafts generated and
withheld, approvals and invalidations, metric click-through. The one that says
whether the feature is used, with no per-person numbers on it.

## 12. Logging

Structured JSON, one event per line, every line carrying `request_id`,
`account_id` and `owner_id`.

Never logged, and asserted by test: message bodies, subject lines, sender
addresses, attachment names, tokens, refresh tokens, client secrets,
authorisation headers, API keys. `redactDeep` wraps every log and error path,
and `auditLineLeaks` is the function that checks a line before it is written.

Retention: 30 days for application logs, 90 days for the audit trail in the
database, which is longer because it is the record of what the system did.

## 13. The weekly review

Fifteen minutes, one person, the Safety dashboard:

1. Any `release_disabled` action refusal? Trace it.
2. Any account mismatch refusal? Trace it.
3. Any scope guard refusal? That is a deployment problem.
4. `ecc_drafts_saved_to_mailbox_total` moved? Does each increment have an
   approval row?
5. Injection findings: is the detector flagging ordinary mail again? Read three
   of them.
6. Validation failures: has a prompt drifted?
7. Retention sweeps running, and removing rows?

A week with nothing to look at is a week this takes five minutes. It is not a
week to skip it.
