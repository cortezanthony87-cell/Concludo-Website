# Concludo Technical Architecture

**Specification v1.0**  
**Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898), Melbourne, Australia**  
*Master Engineering Architecture Specification and Technical Constitution for Concludo Workspace SaaS*  
*Target Environment: app.concludo.com*  
*Status: Authoritative Engineering Source of Truth*  
*Language: Australian English*  

---

## Executive Summary & Engineering Constitution

This specification defines the master technical architecture, system design, data models, integration protocols, and engineering standards for Concludo Workspace SaaS. It serves as the formal engineering constitution for all software components, backend services, database migrations, security policies, and user interface systems built by Concludo Pty Ltd.

Where architectural requirements dictate implementation behaviour, this document establishes mandatory constraints. Software engineers, system architects, and technical contributors must strictly adhere to the standards, boundaries, protocols, and conventions documented herein.

### Architectural Index

| Section | Title | Primary Focus |
| :--- | :--- | :--- |
| **Section 1** | Platform Overview | Platform vision, application architecture, system context diagram, scalability goals |
| **Section 2** | Technology Stack | Frontend, backend, database, AI layer, auth, hosting, storage, monitoring, analytics, security |
| **Section 3** | Frontend Architecture | Folder structure, route structure, state management, component design, design system |
| **Section 4** | Backend Architecture | API standards, service boundaries, business logic layer, workflows, agents, reporting |
| **Section 5** | Application Domains | Auth, projects, outputs, decisions, actions, memory, insights, search, agents, reports, integrations, copilot, knowledge graph |
| **Section 6** | AI Architecture | Prompt framework, RAG framework, memory framework, agents, quality controls, grounding |
| **Section 7** | Document Generation Architecture | Output engine, template engine, visualisation engine, report rendering engine |
| **Section 8** | Integration Architecture | Webhooks, public API, Planner, Teams, Slack, CRM endpoints, future integrations |
| **Section 9** | Scalability Framework | Caching, performance, queue architecture, background workers, async jobs, search indexing |
| **Section 10** | Deployment Architecture | Environments, CI/CD pipeline, monitoring, health checks, rollback strategy |
| **Section 11** | Observability | Structured logging, metrics, distributed tracing, alerting, AI monitoring, system monitoring |
| **Section 12** | Engineering Standards | Coding conventions, naming standards, testing standards, review process, documentation |

---


## Section 1: Platform Overview

### 1.1 Platform Vision

Concludo Workspace is an enterprise-grade Strategic Operating System designed to transform how organisations capture, retain, evaluate, and execute strategic intent. Conventional enterprise software treats meeting transcripts, conversation records, and decision logs as passive ephemera. Transcripts are discarded or stored as unindexed blobs; decisions vanish into email threads; and operational actions decay across disparate issue trackers without clear line of sight to the strategic decisions that originated them.

Concludo transforms this paradigm by establishing a unified, governed intelligence pipeline that spans:
1. **Verifiable Meeting Ingestion**: Capturing multi-speaker meeting transcripts and conversation records with full fidelity and speaker attribution.
2. **Structured Corporate Memory**: Extracting decisions, actions, risks, insights, and lessons learned into relational and graph-structured persistence layers.
3. **Evidence-Grounded Intelligence**: Answering natural language questions and generating executive briefings strictly grounded in verified organisational data, with zero tolerance for fabrication or unsupported extrapolation.
4. **Autonomous Strategic Operations**: Modelling organisations through a continuously updated Digital Twin that evaluates strategic health, visualises cross-initiative dependency networks, predicts delivery risks, and simulates hypothetical operational scenarios without ever usurping human executive authority.

Human decision-makers remain authoritatively in control at all stages. The platform observes, analyses, predicts, simulates, and advises; it never replaces executive discretion or executes unreviewed operational modifications.

### 1.2 Application Architecture

Concludo Workspace employs a clean, decoupled client-server architecture designed for high availability, enterprise tenant isolation, and strict data sovereignty:

* **Public Marketing Tier (`concludo.com.au`)**: Hosted separately on Wix, serving public marketing content, educational articles, workbook packages, and interest registration. Completely decoupled from application infrastructure to eliminate any potential cross-contamination of enterprise data.
* **Workspace Application Tier (`app.concludo.com`)**: A high-performance single-page application built on React 19, TypeScript 5.8, and Vite 6. Delivered through global content delivery networks with sub-second asset hydration.
* **Server API Gateway & Middleware (`/api/*`)**: Protected Node.js and Vite server middleware executing service-role privileged operations, enterprise SSO provisioning, webhook signature verification, public REST API routing, and AI engine coordination.
* **Database & Governance Tier (Supabase Sydney `ap-southeast-2`)**: PostgreSQL 15+ relational database providing authoritative Row Level Security (RLS), custom PL/pgSQL stored procedures, real-time change data capture, automated daily retention purge workers, and encrypted S3-compatible object storage.
* **Autonomous Intelligence Engines**: Decoupled TypeScript computational engines running within protected server boundaries, executing deterministic scoring algorithms, graph traversal operations, multi-horizon forecasts, and conversational synthesis.

### 1.3 System Context Diagram

```
+=========================================================================================================+
|                                           CONCLUDO WORKSPACE                                            |
|                                         SYSTEM CONTEXT DIAGRAM                                          |
+=========================================================================================================+

 [ ACTORS ]
   |
   +---> Executive Leaders (C-Suite, Board, Directors) -------> Executive Command Centre, Briefings, Scenarios
   +---> Programme Managers & PMO Leads ----------------------> Digital Twin, Dependency Map, Risk Network
   +---> Team Leaders & Functional Heads ---------------------> Team Workspaces, Action Tracker, Decisions
   +---> Knowledge Workers & Action Owners -------------------> Copilot, Projects, Meeting Reports, Transcripts
   +---> Enterprise Organisation Administrators --------------> SSO, Audit Logs, Retention Policies, Legal Holds

 [ CLIENT TIER: React 19 SPA (app.concludo.com) ]
   |
   +---> Router (React Router 7) ----> Protected Routes, Permission Badges, Workspace Layout
   +---> Auth Context (GoTrue) ------> Session Hydration, PKCE Tokens, Active Organisation & Team State
   +---> UI Views & Components ------> Tailored Poppins/Inter Interfaces, SVG Visualisations, Modals
   |
   | (Authenticated HTTPS / WSS / REST)
   v
 [ SERVER GATEWAY & API ROUTER (/api/*) ]
   |
   +---> Authentication & Plan Gating (canUseFeature, Session Verifier, Suspension Blocks)
   +---> Immutable Audit Logger (recordAuditLog -> audit_logs)
   +---> Public Integration API (/api/v1/*, API Key Scoping, Rate Limiting)
   +---> Webhook Ingest & Dispatcher (HMAC-SHA256 Signatures, Retry Worker)
   +---> Intelligent Service Layer:
           |
           +---> Copilot Engine & Specialized Assistants (Decision, Action, Risk, Exec, Knowledge)
           +---> Strategic Operations & Digital Twin Engine (Health Scoring, Scenarios)
           +---> Predictive Intelligence Engine (Horizon Forecasts, Health Indices)
           +---> Knowledge Network Engine (Graph Traversal, Clusters, Lessons Learned)
           +---> Document Generation Engine (16 Templates, 28 Visualisations, 58 Outputs)
           +---> AI Agent Runner & Workflow Coordinator (Mandatory Human Approvals)
   |
   | (PostgreSQL Protocol / Supabase Service Role / Signed Storage URLs)
   v
 [ DATABASE & PERSISTENCE TIER (Supabase Sydney ap-southeast-2) ]
   |
   +---> Relational Schema (profiles, projects, transcripts, outputs, decision_memory, action_tracker)
   +---> Team & Org Schema (organizations, organization_members, teams, team_members, invitations)
   +---> Enterprise Governance (retention_policies, legal_holds, access_reviews, audit_logs)
   +---> Knowledge Graph (knowledge_nodes, knowledge_relationships, lessons_learned)
   +---> Strategic Ops (strategic_digital_twins, strategic_health_scores, strategic_scenarios)
   +---> AI & Workflows (copilot_conversations, agent_memory, workflows, workflow_approvals)
   +---> Row Level Security (Authoritative SQL Policies checking auth.uid() and tenant scoping)
   +---> S3 Storage Buckets (transcripts, outputs, exports, attachments)
   +---> Background Purge Worker (pg_cron & retention-purge-worker executing 30-day lifecycle)

 [ EXTERNAL ECOSYSTEM ]
   |
   +<--- Microsoft Teams / Zoom / Google Meet (Transcript Webhook Ingestion)
   +<--- Microsoft Planner / Jira / Asana (Bidirectional Action Synchronisation)
   +<--- Slack / Microsoft Teams (Approval Notification Cards, Strategic Alerts)
   +<--- Salesforce / HubSpot CRM (Automated Endpoint Report Payloads)
   +<--- Enterprise IdPs (Okta, Azure AD, Ping Identity via SAML 2.0 SSO)
```

### 1.4 Future Scalability Goals

Concludo is engineered to support substantial enterprise growth without architectural redesign. The target technical performance thresholds include:

1. **User Concurrency**: Support for 100,000+ active enterprise users across 10,000 organisations, maintaining seamless multi-tenant isolation.
2. **Latency Standards**:
   * API Gateway responses (p95): under 150 milliseconds.
   * Full-text search queries across 1,000,000+ records: under 80 milliseconds.
   * Knowledge Graph traversal (depth 3, 50,000 nodes): under 200 milliseconds.
   * Complex document generation (10-page executive briefing): under 2.5 seconds.
3. **Data Volume Capacity**: Managing 50,000,000+ historical meeting minutes and transcripts with automated partition pruning and cold storage archiving.
4. **Availability & Resilience**: 99.95% system uptime, zero-downtime database migrations via the expand-and-contract pattern, and sub-minute recovery time objectives (RTO).


## Section 2: Technology Stack

Concludo maintains an opinionated, enterprise-hardened technology stack where every dependency is chosen for type safety, execution performance, security posture, and maintainability.

### 2.1 Technology Selection Matrix

| Tier | Technology | Version | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 19.0.0 | Component rendering, concurrent UI transitions, DOM reconciler |
| **Language & Typings** | TypeScript | 5.6.0+ | Strict type checking (`strict: true`, `noImplicitAny`), shared data contracts |
| **Build Tooling** | Vite | 6.0.0 | Fast HMR dev server, Rollup-based tree-shaking production bundler |
| **Routing** | React Router | 7.1.0 | Declarative client-side routing, route-level layout nesting |
| **Styling & Tokens** | Tailwind CSS | 3.4.0+ | Utility-first responsive styling, Concludo design token integration |
| **Iconography** | Lucide React | 1.44.0+ | Lightweight SVG iconography with accessible aria attributes |
| **Database & Engine** | PostgreSQL | 15+ | Relational persistence, PL/pgSQL procedures, RLS, GIN search indexes |
| **Backend as a Service** | Supabase Cloud | 2.116.0+ | Auth, Postgres hosting, S3 Storage, realtime engine, pg_cron |
| **API Middleware** | Node.js / Vite | 22 LTS | Protected server API router mounted at `/api/*` for privileged flows |
| **Authentication** | Supabase GoTrue | v2 | JWT access tokens, refresh tokens, PKCE OAuth, SAML 2.0 SSO |
| **Storage** | S3-Compatible Storage | Supabase | Private encrypted buckets for transcripts, outputs, and exports |
| **Scripting & Workers** | Bun Runtime | 1.3.14 | Rapid worker execution, retention purge scripts, automated verification |

### 2.2 Frontend Stack Deep Dive

The frontend is constructed as an enterprise Single Page Application:
* **React 19 Concurrent Features**: Leverages non-blocking UI state transitions (`useTransition`, `useDeferredValue`) when filtering extensive decision registers, action tables, and knowledge graph canvases.
* **Vite 6 Configuration**: Configured with `@vitejs/plugin-react` using esbuild for lightning-fast local development and Rollup for optimised, chunk-split production builds.
* **Tailwind CSS Design Tokens**: Customised to enforce Concludo brand identity:
  * Primary Navy: `#16263F` (Backgrounds, headers, primary action elements).
  * Secondary Navy: `#21395C` (Cards, elevated containers, borders).
  * Concludo Gold: `#E2B53C` and `#BC8A1C` (Accents, highlights, active badges, progress indicators).
  * Light Background: `#F4F6FA` (Application canvas, secondary surfaces).
  * Typography: Headings in Poppins, body text in Inter.

### 2.3 Backend Stack Deep Dive

The backend architecture couples Supabase PostgreSQL with a dedicated Node.js/Vite server API middleware:
* **Supabase Client (`@supabase/supabase-js`)**: Client-side queries use the public client initialized with `anonKey`. Queries execute directly against PostgreSQL under the authoritative supervision of Row Level Security (RLS) policies.
* **Server Admin Client (`getSupabaseAdminClient()`)**: Server-side API endpoints running under `/api/*` utilize the privileged `service_role` key. This key is never bundled, exposed, or transmitted to client browser environments. It is strictly confined to server-side processes for operations requiring cross-table aggregation, administrative provisioning, audit logging, and automated retention purges.
* **Vite API Plugin (`src/server/viteApiPlugin.ts`)**: In development and integrated deployments, incoming requests to `/api/*` are intercepted by custom server middleware and dispatched to the modular API router (`src/server/apiRouter.ts`).

### 2.4 Database & Storage Stack

* **PostgreSQL Schema**: Divided across 24 sequential migrations, defining strict foreign key constraints, cascading rules, timestamps with time zone (`TIMESTAMPTZ`), and metadata stored as JSONB.
* **Storage Buckets**: Four dedicated S3 buckets:
  1. `transcripts`: Encrypted raw meeting transcripts, VTT, SRT, and audio extraction logs.
  2. `outputs`: Generated deliverable documents, structured JSON outputs, and rendered PDFs.
  3. `exports`: Automation exports, CRM sync payloads, and bulk audit archives.
  4. `attachments`: User-uploaded supplementary materials and meeting assets.

### 2.5 Security, Analytics & Monitoring Stack

* **Security Controls**:
  * Authoritative PostgreSQL RLS validating `auth.uid()` on all tables.
  * Plan tier permissions checked at both UI level and server middleware.
  * User suspension checks blocking suspended members immediately.
  * Webhook signatures generated using HMAC-SHA256 with shared secret keys.
  * Public API keys stored exclusively as SHA-256 hashes with high-entropy salt.
* **Audit Logging**: Dedicated immutable table `audit_logs` capturing user ID, organisation ID, event action, IP address, user agent, and metadata payloads.
* **Performance Telemetry**: Database query monitoring via PostgreSQL `pg_stat_statements`, API endpoint latency profiling, and Vite build chunk size telemetry.


## Section 3: Frontend Architecture

The Concludo Workspace frontend is engineered for modularity, absolute type safety, responsive ergonomics, and strict adherence to Concludo brand guidelines.

### 3.1 Folder Structure

The application code is organised within `app/src/` according to clear domain boundaries:

```
app/src/
├── App.tsx                          # Application router and route definitions
├── main.tsx                         # Entry point, DOM mount, styles import
├── index.css                        # Tailwind CSS imports and global font bindings
├── vite-env.d.ts                    # Vite client environment type declarations
├── components/                      # Reusable UI components and layouts
│   ├── WorkspaceLayout.tsx          # Master application layout (sidebar, header, breadcrumbs)
│   ├── ProtectedRoute.tsx           # Route guard checking authentication and session validity
│   ├── PublicAuthRoute.tsx          # Route guard redirecting authenticated users to dashboard
│   ├── knowledge/                   # Graph visualisation, canvas, and node components
│   └── ui/                          # Atoms: buttons, cards, badges, inputs, modal dialogs
├── lib/                             # Core business logic, domain clients, and engines
│   ├── actions/                     # Action Tracker client, types, overdue calculations
│   ├── agents/                      # AI Agent runner, memory service, agent types
│   ├── auth/                        # Auth context, session provider, error mappers
│   ├── copilot/                     # Copilot engine, client, specialized assistant engines
│   ├── decisions/                   # Decision Memory client, impact models, decision types
│   ├── enterprise/                  # Audit service, enterprise client, compliance helpers
│   ├── integrations/                # Integrations client, webhook handlers, API key types
│   ├── intelligence/                # Conversation intelligence client, health calculators
│   ├── knowledge/                   # Knowledge graph engine, memory network client
│   ├── outputs/                     # Output client, deliverable builders, export helpers
│   ├── permissions/                 # Authoritative feature gating, tier types, permission hooks
│   ├── predictive/                  # Predictive engine, forecast service, briefing compiler
│   ├── profiles/                    # User profile client, tier upgrading, settings helpers
│   ├── projects/                    # Projects client, transcript associations, project types
│   ├── reports/                     # Report client, formatters, endpoint report builders
│   ├── retention/                   # Soft-delete managers, 30-day restore RPCs, purge worker
│   ├── search/                      # Cross-entity search client and relevance filters
│   ├── strategic/                   # Digital Twin, Command Centre, Scenarios, Health Engine
│   ├── supabase/                    # Client and admin Supabase client initializers
│   ├── teams/                       # Team workspace client, invitations, activity logging
│   ├── transcripts/                 # Speaker detection, VTT parser, transcript client
│   └── workflows/                   # Workflow orchestrator, execution logger, approvals client
├── pages/                           # Application route page components
│   ├── HomePage.tsx                 # Root landing page redirector
│   ├── LoginPage.tsx                # Authentication login screen
│   ├── SignupPage.tsx               # New user onboarding screen
│   ├── ForgotPasswordPage.tsx       # Password recovery request screen
│   ├── ResetPasswordPage.tsx        # Password reset confirmation screen
│   ├── DashboardPage.tsx            # Personal executive overview dashboard
│   ├── ProjectsPage.tsx             # Projects list, search, and filtering
│   ├── NewProjectPage.tsx           # Project creation and transcript ingest flow
│   ├── ProjectDetailPage.tsx        # Project workspace, outputs, decisions, actions
│   ├── DecisionMemoryPage.tsx       # Enterprise decision memory register
│   ├── DecisionDetailPage.tsx       # Decision audit trail, evidence, linked actions
│   ├── ActionsPage.tsx              # Action tracker register and status boards
│   ├── ActionDetailPage.tsx         # Five-Field delegation inspector and history
│   ├── InsightPage.tsx              # Strategic insights and blind spot explorer
│   ├── StatsPage.tsx                # Workspace analytics and operational metrics
│   ├── EndpointReportPage.tsx       # Formatted deliverable and CRM export inspector
│   ├── SearchPage.tsx               # Global cross-entity search interface
│   ├── AccountPage.tsx              # User profile, security credentials, sessions
│   ├── SettingsPage.tsx             # Workspace configuration and plan tier review
│   ├── RecentlyDeletedPage.tsx      # 30-day recoverable trash bin and restoration
│   ├── TeamDashboardPage.tsx        # Team collaborative workspace dashboard
│   ├── CreateTeamPage.tsx           # Team workspace onboarding flow
│   ├── TeamSettingsPage.tsx         # Team roles, member management, invitations
│   ├── ConnectionTestPage.tsx       # Diagnostic health check and connection tester
│   ├── PermissionsTestPage.tsx      # Tier permission matrix verification harness
│   ├── admin/                       # Enterprise administration portal
│   │   └── AdminPortalPage.tsx      # SSO, domains, audit logs, retention, access reviews
│   ├── agents/                      # AI Agent management
│   │   ├── AgentsPage.tsx           # Foundational agent configuration and activation
│   │   └── AgentDashboardPage.tsx   # Operational activity feed and memory viewer
│   ├── api/                         # Public developer platform
│   │   └── ApiAccessPage.tsx        # API key generation, permissions, and docs
│   ├── approvals/                   # Human governance centre
│   │   └── ApprovalsPage.tsx        # Pending workflow execution review and sign-off
│   ├── automation/                  # Automation and webhooks
│   │   ├── AutomationExportPage.tsx # Automated export pipeline rules
│   │   └── WebhooksPage.tsx         # Webhook endpoints, secrets, and delivery logs
│   ├── copilot/                     # Concludo Copilot
│   │   └── CopilotPage.tsx          # Natural language Q&A, assistant picker, prompts
│   ├── integrations/                # Third-party integrations
│   │   ├── IntegrationsPage.tsx     # Active connectors (Teams, Slack, Planner, CRM)
│   │   └── IntegrationHistoryPage.tsx# Ingest and synchronisation event history
│   ├── knowledge/                   # Knowledge Graph & Memory Network
│   │   ├── KnowledgeExplorerPage.tsx# Interactive graph canvas and node details
│   │   ├── OrganizationalMemoryPage.tsx# Cross-initiative memory explorer
│   │   ├── KnowledgeTimelinePage.tsx# Chronological memory and event progression
│   │   ├── ExecutiveKnowledgeExplorerPage.tsx# Strategic cluster and lesson viewer
│   │   └── KnowledgeAnalyticsPage.tsx# Knowledge growth, decay, and reuse metrics
│   ├── predictive/                  # Predictive Intelligence & Forecasting
│   │   ├── PredictiveIntelligencePage.tsx# Risk, health, and opportunity signals
│   │   ├── ExecutiveIntelligencePage.tsx# High-level momentum and health indices
│   │   ├── ForecastsPage.tsx        # Multi-horizon completion and workload forecasts
│   │   └── ExecutiveBriefingsPage.tsx# Board and leadership briefing compiler
│   ├── strategic/                   # Autonomous Strategic Operations
│   │   ├── DigitalTwinPage.tsx      # Organisational Digital Twin health model
│   │   ├── ExecutiveCommandCenterPage.tsx# Single-pane executive oversight portal
│   │   ├── ScenarioModelingPage.tsx # What-if scenario simulator and impact model
│   │   ├── PerformanceDashboardPage.tsx# Departmental and team performance matrix
│   │   └── ExecutiveBriefingCenterPage.tsx# Board and leadership report generator
│   └── workflows/                   # Workflow Orchestration
│       └── WorkflowsPage.tsx        # Workflow builder, trigger rules, execution logs
└── server/                          # Server API Gateway
    ├── apiRouter.ts                 # Express/Connect compatible API router
    └── viteApiPlugin.ts             # Vite development server middleware adapter
```

### 3.2 Route Structure & Navigation Topology

The application enforces a rigid route hierarchy using React Router 7:
1. **Public Authentication Routes**: Wrapped in `PublicAuthRoute`, redirecting already-authenticated users to `/dashboard`.
2. **Protected Workspace Routes**: Wrapped in `ProtectedRoute` and `WorkspaceLayout`. Access is denied if `session` is null or `profile.is_suspended` is true.
3. **Feature-Gated Routes**: Enforce authoritative plan permissions through `canUseFeature(profile.plan, featureKey, context)`. If unauthorised, users are presented with a clear upgrade path or administrative enablement banner rather than broken views.

### 3.3 State Management Architecture

Concludo deliberately rejects sprawling global state managers in favour of isolated, purpose-built state layers:
* **Global Auth & Session Context (`AuthContext.tsx`)**:
  * Manages active `User`, `Session`, `Profile`, `activeTeam`, and `activeOrganization`.
  * Exposes explicit authentication actions: `signIn`, `signUp`, `signOut`, `refreshProfile`, `switchTeam`, `switchOrganization`.
  * Hydrates user session on mount via `supabase.auth.getSession()` and subscribes to `supabase.auth.onAuthStateChange()`.
* **Scoped Hook State (`usePermissions.ts`)**:
  * Evaluates current user plan tier (`free_preview`, `starter_trial`, `starter`, `pro_trial`, `pro`, `team`, `enterprise`, `admin`).
  * Injects organisational override flags (e.g., `allow_team_agents`, `allow_team_predictive`, `allow_team_knowledge`, `allow_team_copilot`).
* **Optimistic Local UI State**:
  * Data tables and registers utilise local React state for immediate user interactions (search inputs, filter toggles, sort directions).
  * Mutative actions (such as marking an action completed or dismissing an alert) apply optimistic local updates with automatic rollback upon API failure.

### 3.4 Concludo Design System Tokens

Concludo Workspace implements a bespoke corporate design system engineered for executive clarity:

```css
/* Core Design Tokens */
:root {
  --color-navy-primary: #16263F;      /* Dominant corporate navy */
  --color-navy-secondary: #21395C;    /* Structural containers, borders */
  --color-gold-primary: #E2B53C;      /* Vibrant gold accent */
  --color-gold-hover: #BC8A1C;        /* Interactive gold focus state */
  --color-bg-canvas: #F4F6FA;         /* Clean neutral workspace canvas */
  --color-text-main: #0F172A;         /* High-contrast body text */
  --color-text-muted: #64748B;        /* Secondary descriptive text */
  
  --font-headings: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

* **Heading Hierarchy**: All `<h1>` through `<h5>` elements enforce `font-['Poppins']` with bold weights and navy coloration.
* **Body Text**: All reading paragraphs, data grids, and form controls enforce `font-['Inter']` with strict anti-aliasing for sustained reading comfort.
* **Australian English Guardrails**: All user-facing UI labels, tooltips, validation messages, and system alerts are verified for Australian English spelling (e.g., `Organisational Overview`, `Prioritise Actions`, `Colour Palette`, `Licence Management`).

### 3.5 Loading & Error Handling Standards

* **Multi-Stage Loading States**: For asynchronous computational tasks, the UI presents progressive, contextual status indicators rather than generic spinners:
  * Copilot: *"Thinking"*, *"Searching Knowledge"*, *"Analysing Decisions"*, *"Retrieving Evidence"*, *"Generating Answer"*.
  * Strategic Operations: *"Loading Digital Twin"*, *"Calculating Strategic Health"*, *"Running Simulation"*, *"Preparing Briefing"*.
* **Error Boundaries**: Every top-level page route is wrapped in an Error Boundary that catches runtime exceptions, logs correlation metadata to the server, and provides a non-destructive *"Try Again"* recovery action.


## Section 4: Backend Architecture

Concludo Workspace enforces a rigorous separation between client-accessible database operations and privileged server-side execution. The backend architecture guarantees tenant isolation, tamper-proof governance, and deterministic computational workflows.

### 4.1 API Standards & Gateway Contracts

All server-side communications adhere to strict RESTful JSON protocols. API endpoints are served under `/api/*` and return a standard response envelope:

```typescript
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: {
    requestId: string;
    timestamp: string;
    durationMs: number;
    tenantId?: string;
    version: string;
  };
}
```

#### HTTP Status Code Conventions
* `200 OK`: Request succeeded. Response body contains requested resource in `data`.
* `201 Created`: Resource was created successfully.
* `400 Bad Request`: Payload validation failed or required fields are missing.
* `401 Unauthorized`: Request missing valid Supabase JWT or Bearer token.
* `403 Forbidden`: Authenticated user lacks required plan tier, role permission, or user account is suspended (`user_suspended`).
* `404 Not Found`: Target record does not exist or has been soft-deleted.
* `409 Conflict`: Unique constraint violation or state transition conflict (e.g. attempting to purge a record protected by an active Legal Hold).
* `429 Too Many Requests`: Rate limit threshold exceeded.
* `500 Internal Server Error`: Unhandled server exception. Stack traces are masked in production and logged internally with correlation IDs.

### 4.2 Service Boundaries & Encapsulation

```
+-------------------------------------------------------------------------------+
|                             CLIENT-SIDE BOUNDARY                              |
|                                                                               |
|  [ React UI Components ] ---> [ Domain Client (*Client.ts) ]                  |
|                                    |                                          |
|                                    +---> Direct Supabase RLS (anonKey)        |
|                                    |     (Projects, Decisions, Actions)       |
|                                    |                                          |
|                                    +---> Authenticated fetch('/api/*')        |
|                                          (AI, Agents, Briefings, Admin)       |
+-------------------------------------------------------------------------------+
                                     |
                                     | HTTPS with Bearer JWT
                                     v
+-------------------------------------------------------------------------------+
|                             SERVER-SIDE BOUNDARY                              |
|                                                                               |
|  [ API Router (apiRouter.ts) ]                                                |
|         |                                                                     |
|         +---> Session Authenticator & Tenant Context Loader                   |
|         +---> Plan & Feature Gatekeeper (canUseFeature)                       |
|         +---> Suspension Gatekeeper (profile.is_suspended)                    |
|         +---> Immutable Audit Logger (recordAuditLog)                         |
|         |                                                                     |
|         v                                                                     |
|  [ Business Logic Services (*Service.ts) ]                                    |
|         |                                                                     |
|         +---> Computational Engines (*Engine.ts - pure deterministic logic)   |
|         +---> Workflow Orchestrator & Approval Gatekeeper                     |
|         +---> Copilot Engine & Specialised Assistants                         |
|         |                                                                     |
|         v                                                                     |
|  [ Supabase Admin Client (getSupabaseAdminClient) ]                           |
|         |                                                                     |
|         +---> PostgreSQL Service Role Execution (Bypasses RLS internally      |
|               after explicit, programmatic tenant authorisation checks)       |
+-------------------------------------------------------------------------------+
```

### 4.3 Business Logic Layer

Computational logic is isolated within dedicated engine modules (`src/lib/*/engine.ts`). Engines are implemented as pure, deterministic TypeScript classes and functions that accept structured records and return calculated metrics, graphs, forecasts, or text deliverables without executing side-effects directly.

* **Separation of Concerns**: Engines do not execute database queries. Services fetch required records, pass them to the appropriate engine for mathematical or structural processing, and handle the resulting persistence or response formatting.
* **Reproducibility**: Given identical input records, engines guarantee identical results. Randomness is strictly avoided in all health scoring, forecast calculations, and dependency mappings.

```typescript
// Architectural Standard: Pure Computational Engine Pattern
export class StrategicHealthEngine {
  public static calculateHealth(
    metrics: OperationalMetrics,
    history: HealthSnapshot[]
  ): StrategicHealthScore {
    // 1. Pure mathematical calculation across 8 categories
    const categoryScores = this.computeCategories(metrics);
    // 2. Weighted overall score 0-100
    const overallScore = this.computeWeightedAverage(categoryScores);
    // 3. Deterministic classification
    const classification = this.classifyScore(overallScore);
    // 4. Return structured immutable result
    return { overallScore, classification, categoryScores, timestamp: new Date().toISOString() };
  }
}
```

### 4.4 Workflow Layer & Orchestration

The workflow engine (`src/lib/workflows/workflowService.ts`) enables organisations to define, schedule, and execute automated multi-step operational sequences:
* **Workflow Definitions (`workflows` table)**: Capture triggers (`manual`, `transcript_uploaded`, `decision_created`, `action_overdue`, `schedule_cron`), trigger configurations, and ordered action steps stored as structured JSONB arrays.
* **Execution State (`workflow_executions` table)**: Tracks execution runs with statuses (`pending`, `running`, `awaiting_approval`, `completed`, `failed`), step logs, input payloads, and error records.
* **Governance Gatekeeper (`workflow_approvals` table)**: If a workflow step modifies external state (such as dispatching an email, pushing to external CRMs, or executing an external action), the engine suspends execution and enters `awaiting_approval`. Execution resumes only after an authorised human administrator approves the action.

### 4.5 Agent Layer Architecture

Concludo implements seven foundational operational agents (`src/lib/agents/`):
1. **Meeting Follow-Up Agent**: Compiles immediate action summaries and distributes agreed next steps to participants.
2. **Decision Follow-Up Agent**: Audits pending decisions, checks validation dates, and initiates outcome review notices.
3. **Action Accountability Agent**: Monitors approaching and overdue deadlines, notifying action owners and calculating team delivery friction.
4. **Project Intelligence Agent**: Synthesizes project momentum, flagging delivery drift across transcripts and milestone logs.
5. **Risk Monitoring Agent**: Evaluates project transcripts for emerging operational, technical, financial, or delivery risks.
6. **Report Generation Agent**: Automatically compiles weekly status reports and project digests from completed actions and decisions.
7. **Workflow Coordinator**: Orchestrates cross-functional workflows and coordinates multi-agent sequencing.

#### Agent Operational Constraints
* **Stateless Runner (`agentRunner.ts`)**: Agents operate statelessly. Operational context is loaded on-demand from scoped database tables and agent memory.
* **Scoped Memory (`agent_memory` table)**: Agents maintain persistent key-value memory records scoped strictly by `organization_id`, `team_id`, or `user_id`. Cross-tenant memory access is impossible.
* **No Autonomous Mutation**: Agents generate proposals, briefings, and draft actions. They are prohibited from executing permanent system changes or external synchronisations without explicit human confirmation.

### 4.6 Reporting Layer Architecture

The reporting layer compiles multi-source workspace data into professional corporate deliverables:
* **Data Aggregation**: Collects projects, outputs, decisions, actions, knowledge relationships, and health scores across selected date windows.
* **Section Formatting**: Applies standardized corporate typography, structured executive summaries, key achievements, operational bottlenecks, risk heat maps, and next-step commitments.
* **Deliverable Formats**: Generates web-rendered HTML previews, printable CSS-paginated documents, headless PDF binary streams, and structured JSON payloads for third-party consumers.


## Section 5: Application Domains

Concludo Workspace is organised into thirteen distinct domain models. Each domain is defined by explicit relational schemas, PostgreSQL Row Level Security policies, TypeScript data contracts, and client-server boundaries.

```
+===========================================================================================================+
|                                        APPLICATION DOMAIN MAP                                             |
+===========================================================================================================+
| 1. AUTH & PROFILES        | 2. PROJECTS & TRANSCRIPTS | 3. OUTPUTS & INTELLIGENCE | 4. DECISION MEMORY    |
| - Users, Tiers, SSO       | - Initiatives, Dates      | - Deliverables, Notes     | - Rationale, Impact   |
| - Profiles, Trials        | - Transcripts, Speakers   | - 58 Standard Deliverables| - Review Schedules    |
+---------------------------+---------------------------+---------------------------+-----------------------+
| 5. ACTION TRACKER         | 6. MEMORY & RETENTION     | 7. INSIGHTS & BLIND SPOTS | 8. SEARCH ENGINE      |
| - 5-Field Delegation      | - 30-Day Soft Delete      | - Missed Opportunities    | - GIN Full-Text Index |
| - Ownership, Deadlines    | - Legal Holds, Purges     | - Hidden Risk Detection   | - Cross-Entity Query  |
+---------------------------+---------------------------+---------------------------+-----------------------+
| 9. AI AGENTS & WORKFLOWS  | 10. EXECUTIVE REPORTS     | 11. INTEGRATIONS & APIS   | 12. CONCLUDO COPILOT  |
| - 7 Operational Agents    | - Board Updates           | - Webhooks, HMAC-SHA256   | - Natural Language Q&A|
| - Human Approval Gate     | - Strategic Briefings     | - Planner, Teams, Slack   | - Evidence Attribution|
+---------------------------+---------------------------+---------------------------+-----------------------+
| 13. KNOWLEDGE GRAPH & DIGITAL TWIN: Nodes, Relationships, Strategic Health (0-100), Scenarios, Alerts     |
+===========================================================================================================+
```

### 5.1 Auth Domain (`profiles`, `organizations`, `organization_members`)
* **Purpose**: Manages user authentication, profile provisioning, organisation and team memberships, role-based access control, plan tier entitlements, and enterprise SAML 2.0 Single Sign-On.
* **Schema Entities**:
  * `public.profiles`: Stores user name, company, plan tier (`free_preview`, `starter_trial`, `starter`, `pro_trial`, `pro`, `team`, `enterprise`, `admin`), trial expiration timestamps, and `is_suspended` flag.
  * `public.organizations`: Stores enterprise organisation accounts, SSO requirements, and feature override flags (`allow_team_agents`, `allow_team_predictive`, `allow_team_knowledge`, `allow_team_copilot`).
  * `public.organization_members`: Maps users to organisations with roles (`owner`, `admin`, `member`, `guest`).
* **Authoritative Policy**: RLS verifies that users can only view and update their own profile records and organisation memberships.

```sql
-- Profiles Table Schema
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free_preview' CHECK (plan IN (
        'free_preview', 'starter_trial', 'starter', 'pro_trial',
        'pro', 'team', 'enterprise', 'admin'
    )),
    trial_started_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ,
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizations Table Schema
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    sso_enabled BOOLEAN NOT NULL DEFAULT false,
    sso_enforced BOOLEAN NOT NULL DEFAULT false,
    allow_team_agents BOOLEAN NOT NULL DEFAULT false,
    allow_team_predictive BOOLEAN NOT NULL DEFAULT false,
    allow_team_knowledge BOOLEAN NOT NULL DEFAULT false,
    allow_team_copilot BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 Projects Domain (`projects`, `transcripts`)
* **Purpose**: Central organising entity for strategic initiatives, client engagements, and operational programs.
* **Schema Entities**:
  * `public.projects`: Stores project name, client name, description, meeting date, status (`active`, `archived`, `completed`), owner ID, team ID, and organisation ID.
  * `public.transcripts`: Stores raw meeting text, file name, speaker metadata, word count, duration in seconds, and processing status.
* **Retention Lifecycle**: Projects and transcripts support soft-delete with 30-day recovery windows via `deleted_at`, `deleted_by`, and `purge_after`.

```sql
-- Projects Table Schema
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    client_name TEXT,
    description TEXT,
    meeting_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- Transcripts Table Schema
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    speaker_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    word_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
```

### 5.3 Outputs Domain (`outputs`, `generated_intelligence`, `endpoint_reports`)
* **Purpose**: Manages finished business deliverables generated from meetings, project files, and analytical pipelines.
* **Schema Entities**:
  * `public.outputs`: Stores output title, output type, structured markdown content, metadata JSONB, and project associations.
  * `public.generated_intelligence`: Stores automated analytical summaries, key takeaways, and strategic recommendations.
  * `public.endpoint_reports`: Stores external client-ready deliverables and structured CRM push payloads.

```sql
-- Outputs Table Schema
CREATE TABLE IF NOT EXISTS public.outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    output_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
```

### 5.4 Decisions Domain (`decision_memory`)
* **Purpose**: Preserves enterprise decision history, tracking why decisions were made, who authorized them, what evidence was cited, and what outcomes were achieved.
* **Schema Entity (`public.decision_memory`)**:

```sql
CREATE TABLE IF NOT EXISTS public.decision_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    context TEXT,
    decision_text TEXT NOT NULL,
    rationale TEXT,
    impact_level TEXT NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
    approver_name TEXT,
    approver_role TEXT,
    status TEXT NOT NULL DEFAULT 'agreed' CHECK (status IN ('proposed', 'agreed', 'superseded', 'reversed')),
    review_date DATE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
```

### 5.5 Actions Domain (`action_tracker`)
* **Purpose**: Enforces operational accountability across teams through strict adherence to the Five-Field Delegation Standard.
* **Schema Entity (`public.action_tracker`)**:

```sql
CREATE TABLE IF NOT EXISTS public.action_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    decision_id UUID REFERENCES public.decision_memory(id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    definition_of_done TEXT NOT NULL,
    dependencies TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
```

### 5.6 Memory Domain (`agent_memory`, `projects.notes`)
* **Purpose**: Provides persistent, scoped contextual memory across conversation sessions and automated agent executions.
* **Storage Pattern**: Key-value pairs stored in `public.agent_memory` indexed by `(organization_id, agent_id, key)`. Unstructured meeting notes and historical summaries are indexed within `projects.notes`.

```sql
CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, agent_id, key)
);
```

### 5.7 Insights Domain (`generated_intelligence`)
* **Purpose**: Identifies strategic blind spots, unstated assumptions, hidden delivery risks, missed commercial opportunities, and governance gaps.
* **Analytical Processing**: Scans transcript records against the Concludo Failure Pattern Library, evaluating conversation friction, speaker imbalance, and unassigned commitments.

### 5.8 Search Domain (PostgreSQL GIN Full-Text Indexing)
* **Purpose**: Delivers sub-100ms global search across projects, transcripts, decisions, actions, outputs, and knowledge graph nodes.
* **Implementation**: Utilises PostgreSQL `tsvector` generated columns coupled with GIN indexes and English/Australian text search configurations.

### 5.9 Agents & Workflows Domain (`workflows`, `workflow_executions`, `workflow_approvals`)
* **Purpose**: Facilitates background execution of the seven foundational AI agents, managing scheduled runs, execution logs, and activity feeds.
* **Safety Controls**: Agent actions are logged with full input and output context. Automated external mutations require human confirmation.

```sql
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.10 Reports Domain (`executive_briefings`, `strategic_briefings`)
* **Purpose**: Generates high-level corporate briefings, board packs, quarterly operating reviews, and transformation reports.
* **Storage Entities**: Stores title, summary, briefing type, structured sections JSONB, key recommendations, and executive health indices.

### 5.11 Integrations Domain (`integrations`, `webhooks`, `api_keys`)
* **Purpose**: Connects Concludo Workspace to external enterprise ecosystems (Microsoft Teams, Planner, Slack, Salesforce, HubSpot).
* **Security & Contracts**:
  * Webhooks verify inbound payloads via HMAC-SHA256 signatures.
  * Public API keys are hashed using SHA-256 before storage in `public.api_keys`.

```sql
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read:projects'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.12 Copilot Domain (`copilot_conversations`, `copilot_messages`, `copilot_prompts`)
* **Purpose**: Powers the conversational natural language intelligence interface, enabling users to interrogate corporate memory.
* **Storage Entities**:

```sql
CREATE TABLE IF NOT EXISTS public.copilot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.copilot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    confidence_score INTEGER,
    confidence_tier TEXT,
    supporting_evidence JSONB DEFAULT '[]'::jsonb,
    source_records JSONB DEFAULT '{}'::jsonb,
    reasoning_path JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.13 Knowledge Graph & Digital Twin Domain
* **Purpose**: Constructs an interconnected semantic memory graph mapping relationships between projects, decisions, actions, risks, opportunities, teams, and lessons learned.
* **Graph Specification**:
  * **14 Node Types**: `project`, `transcript`, `output`, `decision`, `action`, `insight`, `risk`, `opportunity`, `recommendation`, `report`, `forecast`, `team`, `user`, `organization`.
  * **15 Relationship Types**: `leads_to`, `supports`, `blocks`, `conflicts_with`, `derives_from`, `implements`, `assigned_to`, `impacts`, `mitigates`, `owned_by`, `belongs_to`, `supersedes`, `relates_to`, `evaluated_by`, `generated_from`.
  * **Graph Traversal**: Supported via recursive Common Table Expressions (CTEs) and graph analysis engines in TypeScript.

```sql
-- Knowledge Nodes Schema
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type TEXT NOT NULL CHECK (node_type IN (
        'project', 'transcript', 'output', 'decision', 'action',
        'insight', 'risk', 'opportunity', 'recommendation',
        'report', 'forecast', 'team', 'user', 'organization'
    )),
    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- Strategic Health Scores Schema
CREATE TABLE IF NOT EXISTS public.strategic_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    overall_score NUMERIC(5, 2) NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN (
        'exceptional', 'strong', 'stable', 'watch_required', 'at_risk', 'critical_attention_required'
    )),
    category_scores JSONB NOT NULL,
    supporting_rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```


## Section 6: AI Architecture

Concludo Workspace implements an enterprise AI architecture grounded in deterministic data verification, strict context bounding, and zero tolerance for fabrication.

```
+===========================================================================================================+
|                                    AI & GROUNDING PIPELINE ARCHITECTURE                                   |
+===========================================================================================================+

 [ USER QUERY OR AUTOMATION EVENT ]
   |
   v
 [ 1. NATURAL LANGUAGE INTENT CLASSIFIER ]
   |  Identifies intent: decision_retrieval, action_retrieval, project_retrieval,
   |  timeline_query, risk_analysis, forecast_query, recommendation_query, executive_query
   |
   v
 [ 2. CONTEXTUAL RETRIEVER & HYBRID RAG ]
   |
   +---> Relational Retrieval (Decisions, Overdue Actions, Milestones via SQL)
   +---> Semantic Graph Traversal (Knowledge Nodes, Relationships, Lessons Learned)
   +---> Multi-Turn Context Window (Prior conversation history, referenced entities)
   |
   v
 [ 3. PROMPT COMPOSITION & ANCHORING ENGINE ]
   |  Injects verified system prompt + strict grounding instructions + retrieved evidence JSON
   |  Strict Anti-Hallucination Directive: "Do not fabricate. Cite source record IDs. State unknowns."
   |
   v
 [ 4. MODEL INFERENCE & ROUTING ]
   |  Budget/Fast Tier (classification, routine summarization)
   |  General/Reasoning Tier (complex synthesis, executive briefings, scenario modelling)
   |
   v
 [ 5. POST-GENERATION GROUNDING & VERIFICATION FILTER ]
   |
   +---> Claim Verification: Does every claim map to an attached source record?
   +---> Confidence Scorer (0-100): Calculates Low, Moderate, High, or Very High Confidence
   +---> Source Attribution Builder: Extracts exact Project, Decision, Action, and Node IDs
   +---> Explainability Path Generator: Emits step-by-step reasoning chain ("Why this answer?")
   |
   v
 [ 6. STRUCTURED ENTERPRISE RESPONSE ]
   |  Returns grounded answer + confidence score + reasoning path + cited records
```

### 6.1 Prompt Framework

All interactions with foundational AI models are governed by immutable system prompts designed to eliminate hallucination, preserve Australian English conventions, and enforce executive tone:

* **Role Definition**: Establishes Concludo as an authoritative, objective corporate intelligence analyst. The model is forbidden from adopting conversational filler, sycophantic greetings, or unprompted speculation.
* **Context Injection**: Retrieved records are serialized into compact JSON structures and appended within clear XML boundary tags (`<context_records>...</context_records>`).
* **Variable Substitution**: Dynamic context variables (user identity, organisation name, active team, date range) are injected deterministically prior to inference.
* **Strict Negative Directives**:
  * "Never invent dates, dollar figures, participant names, or commitments not present in the supplied records."
  * "If the supplied records do not contain the answer, explicitly state that the information is not recorded in workspace memory."
  * "Do not use em dashes anywhere in generated text; use commas, colons, semicolons, or parentheses."

### 6.2 Specialised Assistant Engines

The Concludo Copilot engine deploys five specialised conversational assistants:
1. **Decision Assistant**: Traces why decisions were made, who authorized them, what evidence was cited, and what actions resulted from them.
2. **Action Assistant**: Evaluates overdue actions, blocked initiatives, team backlogs, and ownership distributions according to the Five-Field Delegation Standard.
3. **Risk Assistant**: Detects recurring delivery bottlenecks, cross-project risk patterns, and project drift.
4. **Executive Assistant**: Synthesizes high-level strategic health briefings, leadership focus areas, and organizational health metrics (strictly restricted to Enterprise and Admin tiers).
5. **Knowledge Assistant**: Uncovers verified lessons learned, similar historical initiatives, and connected knowledge clusters from the memory graph.

```typescript
// Copilot Response Contract
export interface CopilotQueryResponse {
  answer: string;
  confidence: number; // 0 to 100
  confidenceTier: 'low' | 'moderate' | 'high' | 'very_high';
  supportingEvidence: string[];
  sourceRecords: {
    projectIds: string[];
    decisionIds: string[];
    actionIds: string[];
    reportIds: string[];
    knowledgeNodeIds: string[];
  };
  reasoningPath: string[]; // Step-by-step explanation
  suggestedFollowUps: string[];
  requiresApproval?: boolean;
}
```

### 6.3 RAG Framework (Retrieval-Augmented Generation)

Concludo rejects naive vector similarity over raw text chunks in favor of structured, hybrid retrieval:
1. **Entity-Aware Extraction**: Meeting transcripts are parsed into structured entities (decisions, actions, speakers, topics) at ingestion time.
2. **Hybrid Lexical & Graph Retrieval**:
   * Lexical search uses PostgreSQL full-text search (`tsvector` / GIN) for keyword precision.
   * Semantic graph retrieval uses `knowledge_relationships` to pull connected dependencies, parent initiatives, and linked actions.
3. **Context Token Budgeting**: The retriever calculates a dynamic token budget. High-priority records (direct matches, open actions, active risks) receive complete representation; secondary records receive condensed summaries to prevent context dilution.

### 6.4 Memory Framework

Memory is organized into three distinct tiers:
1. **Short-Term Conversational Memory (`copilot_messages`)**: Retains multi-turn dialogue state within an active session, enabling follow-up questions (*"Which of those actions are overdue?"*).
2. **Mid-Term Project Memory (`projects`, `transcripts`, `outputs`)**: Retains chronological transcripts, deliverables, and meeting notes across the lifespan of a project.
3. **Long-Term Enterprise Memory (`knowledge_nodes`, `agent_memory`, `lessons_learned`)**: Retains organisation-wide knowledge clusters, decision patterns, and persistent agent states across teams and quarters.

### 6.5 Agent Framework & Autonomous Guardrails

AI agents execute within a secure, supervised container:
* **Stateless Execution**: Agents instantiate with a clean memory state, load task parameters and scoped permissions, execute deterministic evaluation logic, and persist results.
* **Governance Barrier**: Agents cannot execute database migrations, alter RLS policies, bypass plan tier checks, or mutate external systems without human review.
* **Human-in-the-Loop Approval**: All mutative recommendations (e.g. creating workflows, reassigning actions, publishing reports) are staged as `pending_approval` in `workflow_approvals`.

### 6.6 Response Quality Controls: The Four Quality Bars

Every output produced by Concludo must satisfy the Four Quality Bars defined in the Output Intelligence Architecture:
1. **Decidable**: The deliverable contains sufficient precision, clear recommendations, and risk trade-offs to enable immediate executive decisions without supplementary research.
2. **Sendable**: The document adheres to executive design standards, impeccable typography, and Australian English, allowing it to be forwarded to clients or board members without manual editing.
3. **Honest**: The output clearly distinguishes verified facts from assumptions and estimates. Uncertainties and missing data are prominently surfaced.
4. **Traceable**: Every conclusion, metric, and recommendation maps back to an authoritative source record, timestamped transcript segment, or verified knowledge node.

### 6.7 Grounding Controls & Confidence Scoring

The post-generation verification filter evaluates response grounding:
* **Confidence Scoring Algorithm**: Evaluates source record density, citation coverage, entity resolution certainty, and query alignment to generate a score from 0 to 100:
  * `Very High Confidence` (85-100): All claims directly backed by primary decision, action, or project records.
  * `High Confidence` (70-84): Claims supported by multiple indirect records or high-density transcript excerpts.
  * `Moderate Confidence` (50-69): Partial documentation available; minor inference required to connect initiatives.
  * `Low Confidence` (<50): Limited documentation; response contains explicit notices of incomplete records.
* **Explainability Chains ("Why this answer?")**: Outputs include step-by-step reasoning paths explaining which database entities were inspected, what criteria were applied, and how the final synthesis was constructed.


## Section 7: Document Generation Architecture

Concludo Workspace includes a powerful, multi-format document generation pipeline capable of producing board-grade corporate deliverables, executive briefings, and structured integration payloads.

```
+===========================================================================================================+
|                                    DOCUMENT GENERATION ENGINE ARCHITECTURE                                |
+===========================================================================================================+

 [ RAW MEETING DATA & WORKSPACE RECORDS ]
   |
   +---> Transcripts, Speaker Logs, Meeting Metadata
   +---> Extracted Decisions (decision_memory) & Actions (action_tracker)
   +---> Knowledge Nodes, Risk Indicators, Strategic Health Scores
   |
   v
 [ 1. TRANSFORMATION PIPELINE (Output Engine) ]
   |  Applies classification logic (47 meeting categories)
   |  Selects output scenario bundle (S01 to S34)
   |  Assembles 10 deterministic spine outputs + requested catalogue deliverables
   |
   v
 [ 2. TEMPLATE ENGINE (16 Business Templates) ]
   |  T1 Executive Summary      | T5 Operating Model       | T9 Transformation Plan  | T13 Strategic Briefing
   |  T2 Meeting Report         | T6 Strategy Paper        | T10 Risk Assessment     | T14 Board Briefing
   |  T3 Action Register        | T7 Action Plan           | T11 Opportunity Assess  | T15 Decision Pack
   |  T4 Business Plan          | T8 Program Update        | T12 Leadership Briefing | T16 Endpoint Report
   |
   v
 [ 3. DYNAMIC VISUALIZATION ENGINE (28 Visual Types) ]
   |  Generates semantic chart configs: Bar Charts, Line Charts, Heat Maps, Mind Maps,
   |  Decision Trees, Roadmaps, Timelines, Gantt Charts, SWOT, Maturity Curves, RAG Dashboards
   |  Enforces: Visuals as answers, not decorations. 4 Visual Tests compliance.
   |
   v
 [ 4. MULTI-FORMAT REPORT RENDERING ENGINE ]
   |
   +---> Responsive Web View (Interactive Tailwind DOM with live collapsible sections)
   +---> Headless PDF Generation (Print-optimised CSS, page-break rules, running headers/footers)
   +---> Structured Markdown Archive (Clean, portable, standard markdown for file storage)
   +---> Structured JSON Endpoint Payload (CRM sync, REST API consumer formatting)
```

### 7.1 Output Engine

The Output Engine converts unstructured conversation transcripts into verified deliverables:
* **Universal Spine Outputs (OUT-01 to OUT-10)**: Every processed meeting automatically generates the ten core operational deliverables:
  * `OUT-01`: Compressed Executive Summary
  * `OUT-02`: Decisions Made Register
  * `OUT-03`: Actions and Ownership Register
  * `OUT-04`: Key Discussion Topics
  * `OUT-05`: Risks and Issues Identified
  * `OUT-06`: Opportunities and Ideas Captured
  * `OUT-07`: Stakeholder Impact Analysis
  * `OUT-08`: Strategic Alignment Assessment
  * `OUT-09`: Meeting Effectiveness and Health Score
  * `OUT-10`: Recommended Next Steps
* **Catalogue Outputs (OUT-11 to OUT-58)**: 48 specialised deliverables generated dynamically based on meeting classification (e.g. Business Model Canvas, SWOT Analysis, Vendor Assessment, Transformation Roadmap).

### 7.2 Template Engine (The 16 Business Templates)

The template engine enforces structural consistency across sixteen standard corporate formats:

| Template Code | Name | Primary Audience | Target Reading Time | Lead Visual |
| :--- | :--- | :--- | :--- | :--- |
| **T1** | Executive Summary | C-Suite, Board, Executive Sponsors | 2 minutes (1 page) | VIS-15 Strategic Health Gauge |
| **T2** | Meeting Report | Meeting Participants, Project Leads | 5 minutes (2 to 4 pages) | VIS-13 RAG Status Summary |
| **T3** | Action Register | Operational Delivery Teams, PMO | 3 minutes (1 to 2 pages) | VIS-14 Action Priority Matrix |
| **T4** | Business Plan | Investors, Founders, Leadership | 15 minutes (10 to 15 pages) | VIS-09 Business Model Matrix |
| **T5** | Operating Model | Operations Leads, Transformation Team | 10 minutes (6 to 8 pages) | VIS-11 Capability Map |
| **T6** | Strategy Paper | Executive Committee, Board | 12 minutes (8 to 10 pages) | VIS-05 Decision Tree / Flow |
| **T7** | Action Plan | Programme Managers, Workstream Leads | 6 minutes (3 to 5 pages) | VIS-08 Gantt / Milestone Chart |
| **T8** | Program Update | Steering Committee, PMO | 5 minutes (3 to 4 pages) | VIS-07 Implementation Roadmap |
| **T9** | Transformation Plan | Executive Sponsors, Change Leads | 15 minutes (10 to 12 pages) | VIS-10 Maturity Curve |
| **T10** | Risk Assessment | Audit & Risk Committee, PMO | 6 minutes (3 to 5 pages) | VIS-03 Risk Heat Map |
| **T11** | Opportunity Assessment | Commercial Director, Growth Team | 5 minutes (3 to 4 pages) | VIS-14 Opportunity Matrix |
| **T12** | Leadership Briefing | Executive Leadership Team | 4 minutes (2 to 3 pages) | VIS-15 Organisational Scorecard |
| **T13** | Strategic Briefing | CEO, Board Chairman | 5 minutes (3 to 4 pages) | VIS-16 Dependency Map |
| **T14** | Board Briefing | Board of Directors | 8 minutes (4 to 6 pages) | VIS-15 Executive Health Gauge |
| **T15** | Decision Pack | Investment Committee, Executives | 6 minutes (3 to 5 pages) | VIS-05 Decision Option Network |
| **T16** | Endpoint Report | CRM Administrators, External Clients | 2 minutes (1 to 2 pages) | VIS-13 RAG Milestone Card |

### 7.3 Visualization Engine (The 28 Visual Types)

Data visualisations within Concludo are treated as cognitive answers rather than aesthetic ornaments:
* **The Four Visual Tests**: Every generated visual must pass:
  1. *The Standalone Test*: Can a director understand the strategic takeaway without reading surrounding body text?
  2. *The Data Integrity Test*: Does every node, bar, or cell map to a verified entity or metric?
  3. *The Density Test*: Does the visual communicate more insight per square centimeter than a text table?
  4. *The Accessibility Test*: Does the visual meet WCAG 2.1 AA contrast standards using Concludo navy and gold palettes?

#### Complete Visual Types Catalogue (VIS-01 to VIS-28)
* `VIS-01`: Horizontal Bar Chart (Workload, budget distribution)
* `VIS-02`: Time-Series Line Chart (Trend velocity, burn-down)
* `VIS-03`: Risk Heat Map (Likelihood vs Impact 5x5 matrix)
* `VIS-04`: Mind Map / Concept Graph (Brainstorming, idea clustering)
* `VIS-05`: Decision Tree (Branching logic, option trade-offs)
* `VIS-06`: Chronological Timeline (Milestone event sequences)
* `VIS-07`: Strategic Roadmap (Multi-quarter workstream phases)
* `VIS-08`: Gantt Chart (Task duration, critical dependencies)
* `VIS-09`: SWOT Analysis Matrix (2x2 strategic quadrants)
* `VIS-10`: Maturity Curve (Capability evolution stages)
* `VIS-11`: Capability Map (Functional domain architecture)
* `VIS-12`: Process Flowchart (Operational procedure steps)
* `VIS-13`: RAG Status Dashboard (Red/Amber/Green indicator cards)
* `VIS-14`: Priority Matrix (Urgency vs Impact 2x2 grid)
* `VIS-15`: Health Gauge (0-100 radial strategic performance dial)
* `VIS-16`: Organisational Dependency Map (Inter-team bottleneck network)
* `VIS-17`: Stakeholder Influence Matrix (Power vs Interest grid)
* `VIS-18`: Value Stream Map (Lead time vs processing efficiency)
* `VIS-19`: Fishbone / Ishikawa Diagram (Root cause failure analysis)
* `VIS-20`: Venn Diagram (Overlapping scope and jurisdictional bounds)
* `VIS-21`: Radar / Spider Chart (Multi-dimensional competency assessment)
* `VIS-22`: Treemap (Proportional resource and budget allocation)
* `VIS-23`: Waterfall Chart (Net variance and cost bridges)
* `VIS-24`: Funnel Chart (Conversion pipeline stages)
* `VIS-25`: Scatter Plot (Correlation analysis and outlier detection)
* `VIS-26`: Force Field Analysis (Driving vs restraining forces)
* `VIS-27`: Decision Network (Interlinked decisions and cascading impacts)
* `VIS-28`: Knowledge Cluster Graph (Connected memory nodes and lessons learned)

### 7.4 Multi-Format Report Rendering Engine

Deliverables are compiled into multiple output targets:
1. **Interactive Web DOM**: Rendered directly in React with accessible disclosure controls, sortable data grids, and interactive SVG diagrams.
2. **Print-Optimised CSS / PDF**: Styled using dedicated `@media print` rules, enforcing page-break avoidance on table rows, A4 layout margins, and running headers with Concludo corporate metadata.
3. **CRM Endpoint Payloads**: Strips formatting and maps decisions, actions, and contact interactions into typed JSON payloads for Salesforce, HubSpot, and Microsoft Dynamics.


## Section 8: Integration Architecture

Concludo Workspace is engineered for seamless interoperability with modern enterprise collaboration platforms, productivity suites, and customer relationship management systems.

```
+===========================================================================================================+
|                                    ENTERPRISE INTEGRATION ARCHITECTURE                                    |
+===========================================================================================================+

 [ EXTERNAL ECOSYSTEM ]
   |
   +---> Microsoft Teams / Zoom / Webex (Inbound Meeting Transcripts)
   +---> Microsoft Planner / Jira / Asana (Bidirectional Action Sync)
   +---> Slack / Teams Chat (Outbound Notifications, Adaptive Approval Cards)
   +---> Salesforce / HubSpot / Dynamics (CRM Deliverables & Opportunity Updates)
   |
   | (HTTPS / REST / Webhooks)
   v
 [ 1. SECURITY & AUTHENTICATION GATEWAY ]
   |
   +---> Public API Keys: Verified via SHA-256 hash match against api_keys table
   +---> Webhook Ingestion: Verified via HMAC-SHA256 signature in X-Concludo-Signature header
   +---> Rate Limiter: Token bucket algorithm enforcing tier limits (60 to 300 req/min)
   |
   v
 [ 2. INTEGRATION EVENT DISPATCHER & TRANSFORMATION LAYER ]
   |
   +---> Normalizes external payloads into internal Concludo schema contracts
   +---> Logs all inbound and outbound events to integration_sync_logs and webhook_logs
   +---> Handles delivery retries with exponential backoff (1s, 2s, 4s, 8s, up to 5 attempts)
   |
   v
 [ 3. CORE PLATFORM INTERFACES ]
   |
   +---> Inbound: Transcripts -> Transcript Parser -> Project Association
   +---> Outbound: Actions -> Five-Field Delegation -> External Task Creation
   +---> Governance: Approval Required -> Slack/Teams Adaptive Card -> User Action
```

### 8.1 Webhook Framework

Concludo supports both inbound webhook ingestion and outbound event dispatching:
* **Inbound Ingestion**: Accepts webhook payloads from meeting recorders (Zoom, Teams, Google Meet). Payloads are cryptographically verified using HMAC-SHA256 signatures before being queued for parsing.
* **Outbound Dispatching (`public.webhooks` table)**:
  * Users can subscribe external endpoints to workspace events (`transcript.processed`, `decision.created`, `action.created`, `action.overdue`, `report.generated`, `risk.detected`).
  * Payloads are signed with an organisation-specific secret key, transmitted in the `X-Concludo-Signature` HTTP header (`t=timestamp,v1=signature`).
  * Failed deliveries are recorded in `webhook_logs` and retried up to five times with exponential backoff before being marked `failed`.

```typescript
// HMAC-SHA256 Webhook Signature Verification Algorithm
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.split('=')[1];
  const signature = signaturePart.split('=')[1];

  // Prevent replay attacks (5 minute threshold)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300 || age < -30) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
```

### 8.2 Public API Framework (`/api/v1/*`)

Enterprise and Team subscribers can integrate internal systems using the Concludo REST API:
* **Authentication**: Authenticates via Bearer tokens (`Authorization: Bearer con_live_...`).
* **Cryptographic Storage**: API keys are generated with high-entropy cryptographic strings. Only the SHA-256 hash of the key is stored in `public.api_keys`. Once displayed to the user during creation, the plaintext key cannot be retrieved.
* **Granular Scopes**: Keys are restricted to specific operations: `read:projects`, `write:projects`, `read:transcripts`, `write:transcripts`, `read:decisions`, `write:decisions`, `read:actions`, `write:actions`, `export:reports`.
* **Rate Limiting**: Enforced at the gateway: 60 requests/minute for Pro/Team tiers; 300 requests/minute for Enterprise tier.

#### Core REST Endpoints Matrix
* `GET /api/v1/projects`: List projects within authorized tenant scope.
* `POST /api/v1/projects`: Create new project initiative.
* `POST /api/v1/transcripts`: Ingest meeting transcript for parsing and deliverable extraction.
* `GET /api/v1/decisions`: Query decision memory by project, impact tier, or status.
* `GET /api/v1/actions`: Retrieve action registers filtered by ownership or overdue status.
* `POST /api/v1/actions`: Create new action enforcing the Five-Field Delegation Standard.
* `GET /api/v1/reports/:id`: Retrieve compiled executive or endpoint report deliverable.

### 8.3 Microsoft Planner Integration

Enables two-way operational synchronization between Concludo Action Tracker and Microsoft Planner:
* **Task Mapping**: Concludo actions map to Planner tasks: `task` -> `title`, `definition_of_done` -> `notes/checklist`, `due_date` -> `dueDateTime`, `priority` -> `priorityLevel`.
* **Two-Way Status Sync**: Marking an action completed in Planner triggers an update in Concludo via Microsoft Graph webhooks; marking an action completed in Concludo immediately resolves the Planner task.

### 8.4 Microsoft Teams Integration

* **Transcript Ingest**: Directly imports meeting transcripts generated by Microsoft Teams recording services.
* **Adaptive Approval Cards**: When an AI agent or workflow stages an action requiring human approval, Concludo posts an interactive Adaptive Card to the designated Teams channel. Authorized managers can click *"Approve"* or *"Reject"* directly within Teams, which calls back into Concludo with an authenticated signature.

### 8.5 Slack Integration

* **Interactive Notification Bot**: Delivers real-time notifications for critical risk alerts, overdue actions, and weekly executive briefings.
* **Approval Workflows**: Staged workflow executions render interactive Slack Block Kit cards with one-click approval buttons.

### 8.6 CRM Integrations (Salesforce, HubSpot, Microsoft Dynamics)

* **Commercial Deliverable Payloads**: When a Sales Discovery or Client Review meeting is processed, Concludo formats an Endpoint Report payload (`OUT-41`).
* **Opportunity Enrichment**: Pushes client pain points, agreed next steps, decision criteria, and competitor mentions directly into the associated CRM Deal or Opportunity object.

### 8.7 Future Integration Protocols

The architecture includes forward-compatible adapters for Google Workspace, Asana, Jira, Monday.com, and the emerging WebMCP (Web Model Context Protocol) standard, enabling browser-driven tools to interact with Concludo data safely.


## Section 9: Scalability Framework

Concludo Workspace is engineered to scale gracefully from single-user advisory accounts to multinational enterprises with hundreds of thousands of active users and millions of historical records.

```
+===========================================================================================================+
|                                        SCALABILITY & PERFORMANCE MODEL                                    |
+===========================================================================================================+

 [ CLIENT LAYER ]
   |
   +---> Vite Chunk Splitting: Routes loaded dynamically on demand (<180KB initial payload)
   +---> Browser HTTP Caching: Immutable static assets cached for 1 year (Cache-Control: max-age=31536000)
   +---> SWR Stale-While-Revalidate: Immediate cached UI hydration with background refresh
   |
   v
 [ SERVER & API GATEWAY ]
   |
   +---> Stateless Request Routing: API middleware scales horizontally across edge nodes
   +---> In-Memory Computational Memoization: Health scoring engines cache intermediate graphs
   |
   v
 [ DATABASE & PERSISTENCE TIER ]
   |
   +---> PostgreSQL Connection Pooling: PgBouncer / Supabase transaction pooler prevents exhaustion
   +---> Partition Pruning: Time-series tables partitioned by calendar year (audit_logs, webhook_logs)
   +---> Index Strategy: Composite B-tree indexes on tenant columns; GIN indexes for full-text search
   |
   v
 [ BACKGROUND WORKER QUEUE ]
   |
   +---> PostgreSQL Job Queue: Transactional worker loop using SELECT ... FOR UPDATE SKIP LOCKED
   +---> Dedicated Workers: Retention Purge Worker, Briefing Compiler, Sync Dispatcher
```

### 9.1 Caching Strategy

Concludo employs a multi-tiered caching architecture:
1. **Edge Static Caching**: Compiled JavaScript, CSS, and font bundles are stamped with content hashes and cached indefinitely at CDN edge nodes.
2. **Client-Side SWR Caching**: Data queries implement stale-while-revalidate patterns. When navigating between views, cached data displays instantly while a background revalidation ensures data freshness.
3. **Engine-Level Memoization**: Computational engines (`strategicHealthEngine.ts`, `dependencyMapEngine.ts`) memoize intermediate graph traversals and adjacency matrices during heavy analytical passes.

### 9.2 Performance Optimisation

* **Code Splitting**: Route components are imported dynamically via React `lazy()` and `Suspense`, ensuring initial bundle sizes remain below 200 KiB.
* **Virtualized Lists**: Large datasets (such as 10,000+ line audit logs or extensive transcript archives) utilize virtualized windowing to keep DOM node counts minimal.
* **Database Query Optimization**: All queries enforce strict index utilization. The query optimizer utilizes composite indexes (e.g. `idx_decision_memory_org_deleted` on `(organization_id, deleted_at)`) to eliminate sequential table scans.

### 9.3 Queue Architecture & Worker Pools

To maintain sub-second API responsiveness, intensive background operations are offloaded to an asynchronous queue:
* **Transactional Queue (`public.job_queue`)**: Implemented directly in PostgreSQL using `FOR UPDATE SKIP LOCKED`. This guarantees that background workers claim unique jobs without lock contention or duplicate execution.
* **Job States**: Jobs cycle through `pending` -> `processing` -> `completed` (or `failed`). Unhandled crashes are automatically recovered via timeout heartbeats.

```sql
-- Transactional Worker Job Dequeue Query
WITH next_job AS (
    SELECT id
    FROM public.job_queue
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE public.job_queue
SET status = 'processing', started_at = now()
WHERE id IN (SELECT id FROM next_job)
RETURNING *;
```

### 9.4 Background Jobs & Cron Workers

1. **Retention Purge Worker (`scripts/retention-purge-worker.ts`)**: Runs nightly to permanently delete soft-deleted records whose `purge_after` timestamp has passed, rigorously verifying that no active Legal Holds protect the target entities.
2. **Transcript Processing Worker**: Parses uploaded VTT/SRT files, calculates speaker word counts, and extracts decision candidates.
3. **Nightly Strategic Health Recalculator**: Recomputes Digital Twin health indices and logs historical score snapshots for trending charts.
4. **Weekly Executive Briefing Compiler**: Assembles executive summary briefings every Monday morning for leadership distribution.

### 9.5 Asynchronous Processing Standards

* Long-running computational tasks return `202 Accepted` immediately with a status polling URL and job identifier.
* File uploads are streamed directly to Supabase Storage buckets using pre-signed upload URLs, bypassing API gateway memory buffers.

### 9.6 Search Indexing & Full-Text Search

* Text search is powered by PostgreSQL `to_tsvector('english', ...)` stored generated columns.
* GIN indexes enable instant full-text filtering across millions of records.
* Forward-compatible database hooks support vector indexing (`pgvector`) for future semantic embedding search without altering relational table structures.


## Section 10: Deployment Architecture

Concludo Workspace employs a modern, automated continuous deployment model designed for zero-downtime releases, immutable environment parity, and instant rollback capability.

```
+===========================================================================================================+
|                                      CI/CD & DEPLOYMENT ARCHITECTURE                                      |
+===========================================================================================================+

 [ DEVELOPER WORKSTATION ]
   |
   +---> Local Vite Server + Strict TypeScript Compiler (`bun run dev`, `tsc --noEmit`)
   +---> Local / Test Supabase Database (`supabase start` / Sydney Cloud Sandbox)
   |
   | git push origin main
   v
 [ GITHUB REPOSITORY: cortezanthony87-cell/Concludo-Website ]
   |
   v
 [ CI/CD PIPELINE (GitHub Actions) ]
   |
   +---> Stage 1: Static Analysis & Linting (ESLint, Prettier, Australian English check)
   +---> Stage 2: Type Validation (`tsc --noEmit` - zero errors permitted)
   +---> Stage 3: Automated Test Suites (Tasklet 12 to 23 regression test suites against Supabase)
   +---> Stage 4: Production Bundling (`vite build` -> dist/ bundle generation)
   +---> Stage 5: Zero-Downtime Database Migration Runner (Expand-and-contract SQL execution)
   |
   v
 [ TARGET ENVIRONMENTS ]
   |
   +---> Dev: Feature branch preview environments with isolated ephemeral storage
   +---> Test: Automated CI test sandbox with synthetic enterprise datasets
   +---> Staging: Staging slot mirror of production for pre-release validation
   +---> Production: Primary host at `app.concludo.com` on Cloudflare Pages / Vercel Edge
         backed by Supabase Sydney (`ap-southeast-2`) production database
```

### 10.1 Environment Topology

Concludo maintains four strictly isolated environments:
1. **Development (Dev)**: Local development workstations utilizing Vite dev servers and isolated developer schemas.
2. **Testing (Test)**: Automated headless environment where integration tests run against real Supabase database instances.
3. **Staging**: Exact duplicate of production configuration used for final executive sign-off and end-to-end integration testing.
4. **Production (`app.concludo.com`)**: Highly available multi-zone production deployment connected to production Supabase services in Sydney, Australia.

### 10.2 CI/CD Pipeline Protocol

Every pull request and merge to `main` executes a five-stage automated pipeline:

```yaml
# CI/CD Production Deployment Pipeline
name: Deploy Concludo Workspace Production

on:
  push:
    branches: [ main ]

jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Bun Runtime
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install Dependencies
        run: cd app && bun install --frozen-lockfile

      - name: Type Validation
        run: cd app && bun run tsc --noEmit

      - name: Automated Integration & Regression Test Suite
        env:
          VITE_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PROD_SERVICE_ROLE_KEY }}
        run: |
          cd app
          bun run scripts/test-tasklet12.ts
          bun run scripts/test-tasklet19.ts
          bun run scripts/test-tasklet22.ts
          bun run scripts/test-tasklet23.ts

      - name: Production Bundle Build
        run: cd app && bun run build

      - name: Deploy to Production Edge
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: concludo-workspace
          directory: app/dist
```

### 10.3 Zero-Downtime Migration Strategy: Expand and Contract

Database schema changes must never cause downtime or break running client sessions:
1. **Expand**: Add new nullable columns, create new tables, and deploy backward-compatible stored procedures. Existing application code continues functioning without modification.
2. **Migrate & Backfill**: Run asynchronous data migration scripts to populate new columns from legacy fields.
3. **Deploy Application Code**: Deploy new frontend and server code that reads from and writes to the new schema structures.
4. **Contract**: Once the old code is completely decommissioned across all client sessions, execute a cleanup migration to drop obsolete columns or legacy fallback triggers.

### 10.4 Rollback Strategy

* **Frontend Rollbacks**: Git-backed edge deployments allow immediate atomic rollbacks to previous build artifacts within five seconds via CDN routing.
* **Database Rollbacks**: Schema migrations are designed to be non-destructive. If application rollback occurs, the expanded database schema remains backward-compatible with the previous software version.


## Section 11: Observability

Concludo Workspace implements comprehensive observability across application transactions, database performance, external integrations, and AI inference pipelines.

```
+===========================================================================================================+
|                                        ENTERPRISE OBSERVABILITY MAP                                       |
+===========================================================================================================+

 [ TELEMETRY SOURCES ]
   |
   +---> Client Browser: Console errors, unhandled rejections, Core Web Vitals, API latency
   +---> API Gateway: HTTP request logs, response times, status codes, correlation IDs
   +---> Database Engine: pg_stat_statements, connection pool usage, lock contention, slow queries
   +---> AI & Copilot Engine: Token usage, inference latency, confidence scores, grounding flags
   |
   v
 [ STRUCTURED INGESTION & CORRELATION ]
   |
   +---> JSON Log Format: { timestamp, level, correlationId, tenantId, userId, message, context }
   +---> Correlation ID: Injected at API boundary (`X-Correlation-ID`) and passed to all downstream calls
   +---> PII & Secret Redaction: Passwords, tokens, cookies, and transcript text masked automatically
   |
   v
 [ STORAGE & LOGGING SINKS ]
   |
   +---> Immutable Audit Table: `public.audit_logs` (retained according to enterprise retention policy)
   +---> Operational Logs: Structured log sink for engineering diagnostics and incident post-mortems
   +---> Metrics Collector: Aggregated time-series counters and latency percentiles (p50, p95, p99)
   |
   v
 [ ALERTING & INCIDENT MANAGEMENT ]
   |
   +---> P1 Critical: Production downtime, auth outage, data loss risk (Immediate PagerDuty alert)
   +---> P2 High: Degradation in AI inference, webhook failures >5%, elevated 500 error rates
   +---> P3 Warning: Tier limit warnings, slow queries >500ms, non-critical background job retries
```

### 11.1 Structured Logging Architecture

All system logs are emitted in JSON format containing standard diagnostic headers:
```json
{
  "timestamp": "2026-09-14T10:30:00.000Z",
  "level": "INFO",
  "service": "concludo-workspace-api",
  "correlationId": "req_88f9a21e4b",
  "organizationId": "org_77189a",
  "userId": "usr_99120b",
  "action": "copilot.query_executed",
  "durationMs": 142,
  "metadata": {
    "intent": "decision_retrieval",
    "confidenceTier": "very_high",
    "recordsAttributed": 4
  }
}
```

* **Data Redaction**: Sensitive information (passwords, JWTs, credit card numbers, personal telephone numbers, and raw audio files) is scrubbed at the logging boundary.

### 11.2 Metrics & Service Level Objectives (SLOs)

Concludo monitors four key performance metrics against formal SLOs:
* **Availability**: 99.95% uptime across all core workspace routes.
* **API Latency (p95)**: Under 150ms for relational queries; under 350ms for analytical graph traversals.
* **Error Rate**: Under 0.05% of requests resulting in HTTP 5xx responses.
* **Database Connection Saturation**: Connection pool utilisation kept below 70% of maximum pool allocation.

#### Key Telemetry Metrics
| Metric Name | Type | Target Threshold | Description |
| :--- | :--- | :--- | :--- |
| `concludo_api_requests_total` | Counter | N/A | Total HTTP requests handled by status code and route |
| `concludo_api_latency_ms` | Histogram | p95 < 150ms | Request duration across server API endpoints |
| `concludo_ai_inference_duration_ms` | Histogram | p95 < 2500ms | Inference latency for conversational copilot turns |
| `concludo_ai_tokens_consumed` | Counter | N/A | Input and output token usage by organisation and tier |
| `concludo_db_pool_active` | Gauge | < 70% | Active database connections in Supabase pool |
| `concludo_webhook_delivery_failures` | Counter | 0 | Failed webhook deliveries exceeding retry budget |

### 11.3 Distributed Request Tracing

Every request entering `/api/*` is stamped with a unique `X-Correlation-ID`. This identifier is:
1. Returned in the API response header.
2. Passed into database RPC invocations.
3. Stamped on audit log records.
4. Included in external integration webhooks.
Engineers can trace the complete lifecycle of a transaction from client click to database commit using a single correlation key.

### 11.4 AI Monitoring & Hallucination Prevention Tracking

The AI observability pipeline monitors:
* **Grounding Failure Rate**: Tracks the percentage of queries where the post-generation verification filter rejects or downgrades response confidence due to insufficient source citation.
* **Token Budget Efficiency**: Monitors prompt token usage versus response token usage to prevent prompt bloat.
* **Inference Latency Tracking**: Alerts when model inference times exceed 3.5 seconds.


## Section 12: Engineering Standards

This section establishes the mandatory coding conventions, naming rules, testing criteria, and code review standards that govern all technical contributions to Concludo Workspace.

### 12.1 Coding Standards

* **Strict TypeScript**:
  * `tsconfig.json` enforces `strict: true`, `noImplicitAny: true`, and `strictNullChecks: true`.
  * The `any` type is strictly prohibited in application code. Use `unknown` with type guards or explicit generics.
* **Functional Component Design**:
  * React components must be written as functional components using standard React hooks. Class components are forbidden.
  * Side-effects must be encapsulated inside `useEffect` with comprehensive dependency arrays or handled within service layers.
* **Pure Computational Engines**:
  * Analytical and scoring calculations must reside in pure functions or stateless classes under `src/lib/`.
  * Engines must never execute direct network requests, database mutations, or access browser globals.
* **Immutability**:
  * State transformations must never mutate existing objects or arrays in place. Use object spread (`...`), array mapping, or structured cloning.

### 12.2 Naming Conventions

To maintain consistency across the codebase, engineers must follow these naming patterns:

| Entity Type | Convention | Examples |
| :--- | :--- | :--- |
| **React Components** | PascalCase | `WorkspaceLayout.tsx`, `DecisionDetailPage.tsx`, `CopilotPage.tsx` |
| **TypeScript Interfaces** | PascalCase | `DecisionRecord`, `ActionRecord`, `StrategicHealthScore` |
| **Domain Services & Clients** | camelCase with suffix | `decisionClient.ts`, `copilotEngine.ts`, `auditService.ts` |
| **Custom React Hooks** | camelCase with `use` prefix | `usePermissions.ts`, `useAuth.ts`, `useDebounce.ts` |
| **Database Tables** | snake_case, plural | `projects`, `decision_memory`, `action_tracker`, `knowledge_nodes` |
| **Database Columns** | snake_case | `created_at`, `owner_id`, `impact_level`, `definition_of_done` |
| **Database RPC Functions** | snake_case with verb | `restore_project`, `execute_retention_purge`, `get_active_legal_holds` |
| **Route Slugs & URLs** | kebab-case | `/decision-memory`, `/executive-command-center`, `/scenario-modeling` |
| **Constants & Enums** | UPPER_SNAKE_CASE | `ALL_FEATURE_KEYS`, `DEFAULT_PAGE_SIZE`, `MAX_RETRIES` |

### 12.3 Testing Standards

Every feature or database migration must be accompanied by automated verification tests:
* **Unit Tests**: Domain calculation engines (`strategicHealthEngine.ts`, `predictiveEngine.ts`, `confidenceScorer.ts`) must achieve 100% test coverage across all branches and edge cases.
* **Integration Tests**: API endpoints and database clients must be verified against live test databases using realistic tenant datasets.
* **Regression Test Suites**: Prior test suites (`test-tasklet12.ts` through `test-tasklet23.ts`) must pass 100% before any branch can be merged to `main`.
* **Zero Regressions Rule**: A pull request that breaks any existing test suite is blocked from merging.

### 12.4 Review Standards & Code Sign-Off

Code reviews must rigorously check the following criteria:
1. **Security & RLS**: Does every new database table include Row Level Security policies validating `auth.uid()` and tenant boundaries?
2. **Authoritative Backend Gating**: Are privileged operations validated on the server side via `canUseFeature`?
3. **Australian English**: Is all user-facing copy written in Australian English (`organisation`, `prioritise`, `colour`, `centre`)?
4. **No Em Dashes**: Is the code and documentation 100% free of em dashes?
5. **Retention Compliance**: Do soft-deleted entities include `deleted_at`, `deleted_by`, and `purge_after`? Are Legal Holds checked before permanent deletions?

### 12.5 Documentation Standards

* **Interface Documentation**: All exported TypeScript interfaces, types, and engine methods must include JSDoc comments describing parameters, return shapes, and business intent.
* **Architecture Decision Records (ADRs)**: Any architectural change that modifies database schemas, introduces external dependencies, or alters authentication protocols must be documented in an ADR under `docs/adr/`.
* **Living Documentation**: This technical architecture specification is a living document. Any software change that supersedes documented standards must update this specification concurrently.

---

### Document Certification

* **Author**: Engineering Architecture Team, Concludo Pty Ltd  
* **Approved By**: Anthony Cortez, Founder & Director, Concludo Pty Ltd  
* **Corporate Entity**: Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898), Melbourne, Australia  
* **Specification Version**: v1.0  
* **Effective Date**: 14 September 2026  
* **Verification Status**: Fully validated against Concludo Workspace SaaS codebase (Tasklets 1 through 23 and Output Architecture A1).
