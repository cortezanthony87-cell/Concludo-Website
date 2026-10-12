# Email Command Centre: documentation index

Concludo Workspace. Final, Stage 8. 12 October 2026.

Concludo is an independent product. It is not affiliated with, endorsed by or
certified by Microsoft, Google, Zoom or any device maker. Where a platform is
named in these documents, it is named only to identify which API an integration
would speak to.

Concludo Pty Ltd is registered (ACN 701 605 898, ABN 61 701 605 898) and the
product is pre-revenue, in build, unpublished and not yet sold. Prices are
indicative until validated with real buyers.

---

## Read these first

| Document | What it is for |
|---|---|
| `../STAGE_8_REBUILD_REPORT.md` | The rebuild: the Overview and the Outputs surface |
| `../STAGE_7_FINAL_REPORT.md` | The completion report: what was built, what was tested, what stays disabled |
| `KNOWN_LIMITATIONS.md` | What is missing, what is partial, what cannot be fixed by code |
| `ARCHITECTURE.md` | How it fits together, including the approval gate and backlog mode |
| `NAVIGATION_MAP.md` | The eleven tabs, the routes, the URL state |

## Building and running it

| Document | What it is for |
|---|---|
| `SETUP_LOCAL.md` | Run and test it locally. No credentials needed |
| `SETUP.md` | The prerequisites a real mailbox connection needs. None are met |
| `SETUP_STAGING.md` | Staging, and the first real mailbox |
| `DEPLOY_PRODUCTION.md` | The ten gates, deploying dark, and the five-step rollout |
| `env.template` | Every environment variable, no secrets, no real values |
| `migrations/` | The database. 0001 core, 0002 row-level security, 0003 retention and deletion, 0099 verification |

## Security and privacy

| Document | What it is for |
|---|---|
| `PERMISSIONS.md` | Every scope requested, every scope forbidden, and why |
| `THREAT_MODEL.md` | Eleven threats, their controls, their residual risk |
| `SECURITY_CHECKLIST.md` | The manual review. Thirteen sections, worked through on a test mailbox |
| `DATA_FLOW.md` | What moves, where it stops, what is kept |
| `PRIVACY_DELETION.md` | The deletion workflow, and the sentence that has to be said at the end |

## Running it in production

| Document | What it is for |
|---|---|
| `MONITORING.md` | What to measure, four dashboards, the weekly review |
| `ALERTING.md` | Four things page somebody. Everything else is a ticket |
| `BACKUP_AND_RECOVERY.md` | Objectives, schedule, the restore procedure, and re-applying a deletion |
| `INCIDENT_RESPONSE.md` | Five severity-1 playbooks, written for one person on call |

## Verification

| Document | What it is for |
|---|---|
| `TEST_REPORT.md` | 3,634 checks across ten suites, and every defect they found |
| `ACCESSIBILITY_REPORT.md` | WCAG 2.2 AA, the eight checks, and the screen-reader pass still outstanding |
| `API.md` | The module API, which exists, and the server API, which does not |

## Where it goes next

| Document | What it is for |
|---|---|
| `ROADMAP.md` | Six gated releases. Release 2 should not start until somebody wants to connect a mailbox and says why |

---

## The short version

The module is complete as a reviewable, usable feature running on synthetic
data: eleven tabs, twenty-two hand-written threads, every extraction traceable
to the sentence it came from, 3,634 passing checks, WCAG 2.2 AA across three
widths, and a database schema verified against PostgreSQL 16.

The Overview is a decision page: one lead thread, a quiet rail of eight counts,
four short sections, and no thread shown twice. Outputs turns a conversation
into a finished Concludo document, built as a payload against the Workspace's
own output schema and drawn with its own document stylesheet.

It cannot connect a mailbox. The OAuth flow, the token store and the model calls
are specified, contracted and tested at their boundaries, and not built, because
each needs something this environment does not have. Eight of the twenty-two
pipeline stages report `skipped` with the reason rather than claiming a result.

Nothing sends, deletes, archives, labels or marks anything as read. Those are
not settings at their defaults: the capabilities are denied and ungrantable, the
read-only provider interface has no method to call, and the approval gate
refuses a disabled action before it reads any approval at all.
