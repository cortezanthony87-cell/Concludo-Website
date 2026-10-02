# Concludo Natural-Language Workflow Platform & Extensible Connector Centre
## Phase 3 Architecture, Extensibility & Demonstration Handover

### 1. Executive Summary
Phase 3 expands the Concludo Natural-Language Workflow Builder from a vertical slice into an extensible, enterprise-grade automation platform. Users can converse in plain Australian English to build, inspect, test, dry run, and execute multi-application workflows across native Concludo tools, external SaaS platforms (HubSpot, Stripe, Google Workspace, Microsoft 365, Slack), and custom REST APIs / webhooks.

---

### 2. Core Architectural Components Delivered

#### A. Extensible Connector Registry & Connector Centre (`/connections`)
- **Location:** `app/src/lib/workflows/connectorRegistry.ts` & `app/src/pages/workflows/ConnectorCentrePage.tsx`
- **Capabilities:**
  - 18 Trigger Manifests covering manual, scheduled, webhooks, meetings, projects, risks, issues, and external integrations.
  - 35 Action Manifests covering logic, governance, AI agents, projects, calendar, communications, and external API mutations.
  - 19 Connector Manifests including Concludo Native tools, HubSpot, Stripe, Google Sheets, Google Calendar, Google Drive, Microsoft Outlook, Slack, Custom REST API, and Custom Inbound Webhooks.
  - Connector Centre provides category filtering, real-time capability discovery, OAuth permission breakdowns in plain Australian English, and connection health status.

#### B. Sandboxed Deterministic Expression Engine (`expressions.ts`)
- **Location:** `app/src/lib/workflows/expressions.ts`
- **Security & Safety:** Strictly no `eval()`, no `new Function()`, and no arbitrary code execution.
- Evaluates token paths (e.g. `$trigger.deal_amount`, `$steps.step_1.output.score`), math arithmetic, string operations (`trim`, `concat`, `lowercase`), date comparisons (`date_before`, `date_after`), and boolean logic.

#### C. Enterprise Template Library (`templates.ts`)
- **Location:** `app/src/lib/workflows/templates.ts`
- **Breadth:** 20 production templates across Meetings, Sales, Customer Onboarding, Finance, Compliance, Operations, and AI.
- Includes locked governance fields (e.g. `approvalRequirement`, anti-surveillance policies) ensuring administrative compliance cannot be removed by casual customization.

#### D. Database Migration & RLS Tenant Isolation
- **Applied Migration:** `20261001200000_natural_language_workflow_builder.sql` applied directly to Supabase production project (`dikthezsghsssnwtctem`).
- **Tables Activated:**
  - `workflow_versions`: Immutable published and draft snapshots.
  - `workflow_dry_runs`: Non-destructive testing logs and step results.
  - `workflow_incidents`: Automated incident tracking on persistent failures.
  - `workflow_idempotency_records`: Tenant-scoped duplicate suppression.
- **Row-Level Security:** Enforced via `organization_members` tenant isolation policies.

#### E. Resilience & Circuit Breakers (`executionEngine.ts`)
- Non-destructive Dry Runs (`isDryRun: true`) producing synthetic preview outputs without database mutation.
- Bounded Retries (maximum 3 attempts with exponential backoff).
- Automatic Circuit Breaker tripping after 3 consecutive connector errors to protect external APIs from hammering.
- Idempotency checks preventing duplicate processing upon webhook or trigger replays.

---

### 3. Demonstration Workflows Verified

| Scenario | Trigger | Steps & Flow | Result |
|---|---|---|---|
| **0. Meeting Follow-through** | `meeting.completed` | Access check &rarr; AI summary & action extraction &rarr; Approval Centre review &rarr; Project tasks &rarr; Calendar deadlines &rarr; Notification. | Verified (Pauses for human sign-off; completes upon approval). |
| **1. HubSpot Deal Won Onboarding** | `hubspot.deal_stage_changed` | Deal Closed Won &rarr; Customer & Owner identity mapping &rarr; Draft onboarding project &rarr; Owner sign-off &rarr; Live tasks &rarr; Calendar kickoff dates. | Verified (Non-destructive dry run tested). |
| **2. Stripe Payment Failure** | `stripe.invoice_payment_failed` | Invoice payment failed &rarr; Finance alert &rarr; Recovery task &rarr; Wait 3 days &rarr; Recheck status &rarr; Draft email &rarr; Approval gate &rarr; Send. | Verified (Grace period & human sign-off enforced). |
| **3. Google Sheet to Project Task** | `schedule.reached` (15m) | 15-minute poll &rarr; Read approved rows &rarr; Bounded loop &rarr; Create tasks &rarr; Write back Concludo task IDs. | Verified (Bounded batch & write-back safety verified). |

---

### 4. Verification Evidence & Automated Tests
- **Automated Test Suite:** `tests/workflow_platform_phase3.test.ts` (9/9 pass, 42 assertions).
- **TypeScript Compilation:** `tsc --noEmit` passed with 0 errors.
- **Production Build:** `bun run build` generated production bundle `dist/assets/index-BS36ugP0.js` and 53 prerendered route files with `noindex` headers.
- **Persistent Git Backup:** Git bundle saved at `/tasklet/threads/a_1kggpxq3epghhdcp3dt3/work/workflow_platform_de9d285.bundle`.
