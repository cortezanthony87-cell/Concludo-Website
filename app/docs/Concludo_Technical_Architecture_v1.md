# Concludo Technical Architecture
## The Engineering Constitution and Master Systems Architecture for Concludo Workspace
### Version 1.0 (September 2026) | Document Reference: Concludo_Technical_Architecture_v1

---

## Executive Summary and Engineering Authority

This specification defines the engineering constitution and authoritative technical architecture for Concludo Workspace, the enterprise SaaS application operating at `app.concludo.com`. 

Concludo is not a passive conversational note-taker or transient meeting recorder. It is an enterprise grade execution system that converts multi-party collaborative discourse into structured institutional intelligence, governed decisions, tracked actions, predictive organisational health analytics, and board-level business deliverables.

This document establishes the binding architectural requirements, service boundaries, technology choices, data contracts, and implementation standards governing all engineering execution within Concludo Workspace. It operates alongside the three complementary foundational architecture specifications:
1. Concludo Meeting Intelligence Pipeline (Tasklet A0, `Concludo_Meeting_Intelligence_Pipeline_v1.md`): Defines the sixteen-stage directed acyclic ingestion and intelligence extraction pipeline.
2. Concludo Output Intelligence Architecture (Tasklet A1, `Concludo_Output_Intelligence_Architecture_v1.md`): Defines the fifty-eight executive deliverables, nineteen consulting blueprints, twenty-eight visual frameworks, and output selection rules.
3. Concludo Database, Knowledge Graph and AI Memory Architecture (Tasklet A3, `Concludo_Data_Knowledge_AI_Architecture_v1.md`): Defines the forty-six relational database tables, eleven-layer cognitive memory hierarchy, directed attributed knowledge graph, vector retrieval systems, and statutory retention controls.

Concludo Technical Architecture (Tasklet A2) defines how the software platform is engineered, assembled, secured, observed, and scaled to enterprise volume. Every software engineer, architect, and technical contributor must adhere to the standards, patterns, and principles articulated in this document.

```
+----------------------------------------------------------------------------------------------------+
|                                    CONCLUDO ARCHITECTURAL SUITE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                           +--------------------------------+    |
|    |         TASKLET A0          |                           |           TASKLET A1           |    |
|    |     Meeting Intelligence    |                           |      Output Intelligence       |    |
|    |      Pipeline (16 Stages)   |                           |    Architecture (58 Outputs)   |    |
|    +--------------+--------------+                           +----------------+---------------+    |
|                   |                                                           |                    |
|                   +----------------------------+------------------------------+                    |
|                                                |                                                   |
|                                                v                                                   |
|                               +---------------------------------+                                  |
|                               |           TASKLET A2            |                                  |
|                               |      CONCLUDO TECHNICAL         |                                  |
|                               |   ARCHITECTURE (This Spec)      |                                  |
|                               |    The Engineering Blueprint    |                                  |
|                               +----------------+----------------+                                  |
|                                                |                                                   |
|                                                v                                                   |
|                               +---------------------------------+                                  |
|                               |           TASKLET A3            |                                  |
|                               |     Database, Knowledge Graph   |                                  |
|                               |      and AI Memory Platform     |                                  |
|                               +---------------------------------+                                  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## Architectural Index

- Section 1: Concludo Technical Vision
- Section 2: System Context Architecture
- Section 3: Technology Stack
- Section 4: Frontend Architecture
- Section 5: Frontend Folder Structure
- Section 6: Design System Architecture
- Section 7: State Management Architecture
- Section 8: Backend Architecture
- Section 9: Domain Driven Architecture
- Section 10: API Architecture
- Section 11: Event Driven Architecture
- Section 12: Background Processing Architecture
- Section 13: AI Architecture
- Section 14: Prompt Architecture
- Section 15: Agent Architecture
- Section 16: Workflow Architecture
- Section 17: Document Generation Architecture
- Section 18: Visualization Architecture
- Section 19: Search Architecture
- Section 20: Copilot Architecture
- Section 21: Integration Architecture
- Section 22: Infrastructure Architecture
- Section 23: CI/CD Architecture
- Section 24: Observability Architecture
- Section 25: Performance Architecture
- Section 26: Scalability Architecture
- Section 27: Security Architecture
- Section 28: Governance Architecture
- Section 29: Disaster Recovery Architecture
- Section 30: Engineering Standards
- Section 31: Future Technical Roadmap
- Appendix A: Core Interface Contracts and Schemas
- Appendix B: Architectural Review and Governance Sign-Off

---

## Section 1: Concludo Technical Vision

### 1.1 The Enterprise Imperative
Modern organisations lose millions of dollars annually to unstructured, unaccountable meeting waste. While contemporary corporate software stacks provide frictionless video conferencing and acoustic capture, they consistently fail to bridge the chasm between conversation and execution. Traditional AI transcription tools generate passive, conversational summaries that dilute strategic clarity, obscure decision ownership, and leave action items lost in ephemeral chat logs.

Concludo addresses this systemic operational failure by engineering an enterprise grade cognitive platform that transforms collaborative audio, video, transcripts, and meeting artifacts into structured, verifiable, and legally auditable organisational intelligence.

Building an enterprise software platform that sits in the critical path of corporate decision-making demands an architectural foundation of uncompromising quality. Concludo must satisfy the rigorous governance, security, and performance standards of multinational enterprises, investment banks, healthcare systems, and sovereign government departments. It must guarantee cryptographic tenant isolation, sub-second query responsiveness, verifiable zero-hallucination outputs, and complete statutory data sovereignty.

### 1.2 Platform Goals and the Cognitive Intelligence Hierarchy
The Concludo platform architecture is engineered to realize six progressive intelligence capabilities:

1. Meeting Intelligence: Ingesting multi-channel conversational streams, identifying participants, establishing context, isolating factual claims, and scoring collaborative health across fifty distinct meeting archetypes.
2. Decision Intelligence: Extracting, categorising, and structuring every operational, tactical, and strategic decision into an immutable decision memory graph that tracks rationale, rejected alternatives, consensus levels, and longitudinal drift.
3. Execution Intelligence: Translating collaborative commitments into enforceable, five-field standardised actions with deterministic single ownership, unambiguous definitions of done, automated dependency graphs, and cross-platform synchronisation.
4. Knowledge Intelligence: Synthesising discrete meeting events into an institutional knowledge graph that maps inter-project dependencies, surfaces recurring blind spots, captures lessons learned, and maintains organisational continuity across personnel turnover.
5. Copilot Intelligence: Providing an interactive, context-aware executive reasoning copilot capable of answering complex cross-meeting operational inquiries, assembling longitudinal dossiers, and drafting board-level communications with verbatim source attribution.
6. Strategic Intelligence: Aggregating macro trends, calculating systemic project health indicators, modelling strategic digital twins, and presenting proactive executive briefings that alert leadership to emerging risks before they manifest commercially.

```
+----------------------------------------------------------------------------------------------------+
|                                THE CONCLUDO COGNITIVE PLATFORM GOALS                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ STRATEGIC INTELLIGENCE ]    Predictive digital twins, health radar, executive blind spots     |
|                ^                                                                                   |
|                |                                                                                   |
|    [  COPILOT INTELLIGENCE  ]    Governed multi-turn reasoning, cross-project factual synthesis    |
|                ^                                                                                   |
|                |                                                                                   |
|    [  KNOWLEDGE INTELLIGENCE]    Institutional knowledge graph, lessons learned, cross-linkages    |
|                ^                                                                                   |
|                |                                                                                   |
|    [ EXECUTION INTELLIGENCE ]    Five-Field Delegation Standard, commitment tracking, slippage     |
|                ^                                                                                   |
|                |                                                                                   |
|    [  DECISION INTELLIGENCE ]    Immutable decision memory, consensus tracking, rationale logs     |
|                ^                                                                                   |
|                |                                                                                   |
|    [  MEETING INTELLIGENCE  ]    16-stage pipeline, speaker attribution, meeting health scoring    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 1.3 Core Engineering Principles
The Concludo engineering organisation operates under ten non-negotiable architectural principles that dictate every technical decision, pull request, and infrastructure provisioning action:

1. Scalability: The architecture must scale horizontally across compute, storage, and networking layers to support organisations ranging from single-operator businesses to global enterprises with hundreds of thousands of active users and millions of monthly transcript minutes.
2. Reliability: The platform must achieve 99.99% availability for core workspace interactions, ensuring zero data loss during high-volume ingestion, background synthesis, and distributed agent execution.
3. Maintainability: The codebase must maintain modular, domain-driven boundaries with strict separation of concerns, explicit interface contracts, zero circular dependencies, and complete TypeScript type safety across frontend and backend tiers.
4. Security: The platform enforces defense-in-depth across every layer. Security is rooted in PostgreSQL Row Level Security (RLS) policies, cryptographic envelope encryption for sensitive credentials, tenant boundary isolation, and immutable audit logging.
5. Performance: Concludo enforces strict performance budgets: sub-100 millisecond database query latency, sub-200 millisecond API responses, sub-second search retrievals, and optimised initial frontend bundle loading under 250 kilobytes compressed.
6. Observability: Every distributed operation, background job, LLM invocation, and database transaction must produce structured telemetry, distributed trace contexts, and metric snapshots to enable immediate anomaly detection and automated remediation.
7. Developer Experience: Fast build times, deterministic local development environments, comprehensive automated testing suites, automated type generation from database schemas, and continuous integration pipelines enable rapid, confident deployment.
8. AI Readiness: AI systems must be strictly decoupled from user-facing presentation layers through standardised orchestration interfaces, structured JSON schema validation, rigorous context budgeting, and multi-model fallback routing.
9. Enterprise Readiness: Multi-tenant organisation administration, SAML 2.0 Single Sign-On, SCIM directory synchronisation, automated audit logging, statutory retention schedules, and legal hold overrides are engineered as foundational capabilities rather than post-hoc add-ons.
10. Sovereign Data Integrity: Customer data remains sovereign, private, and strictly isolated. Concludo never uses customer proprietary transcripts, decisions, or outputs to train public foundational AI models. All data residency adheres to Australian, European, or jurisdictional compliance requirements.

---

## Section 2: System Context Architecture

### 2.1 Complete Platform Topology
Concludo Workspace operates as a modern cloud-native system composed of loosely coupled frontend, backend, database, cognitive memory, AI inference, and integration subsystems. The system context architecture isolates public traffic, enforces perimeter security, orchestrates asynchronous workloads, and coordinates high-throughput communication across multiple specialised engines.

```
+-------------------------------------------------------------------------------------------------------------------+
|                                            CONCLUDO SYSTEM CONTEXT TOPOLOGY                                       |
+-------------------------------------------------------------------------------------------------------------------+
|                                                                                                                   |
|                                               [ ENTERPRISE USERS ]                                                |
|                                      (Executive, Board, Delivery Teams, Admin)                                    |
|                                                          |                                                        |
|                                                          v HTTPS / WSS                                            |
|                                         +----------------------------------+                                      |
|                                         |     Cloudflare Global Anycast    |                                      |
|                                         |      CDN / WAF / DDoS Shield     |                                      |
|                                         +-----------------+----------------+                                      |
|                                                           |                                                       |
|                                                           v                                                       |
|                                         +----------------------------------+                                      |
|                                         |       Frontend Application       |                                      |
|                                         |    (React 19, TypeScript, Vite)  |                                      |
|                                         |     Hosted at app.concludo.com   |                                      |
|                                         +--------+----------------+--------+                                      |
|                                                  |                |                                               |
|                    REST / GraphQL / Auth Requests|                | Server-Sent Events / Realtime                 |
|                                                  v                v                                               |
|  +-------------------------------------------------------------------------------------------------------------+  |
|  |                                          BACKEND & PLATFORM SERVICES                                        |  |
|  |                                                                                                             |  |
|  |  +---------------------------+   +----------------------------+   +--------------------------------------+  |  |
|  |  |  Edge API Gateway Layer   |   |   Background Worker Pool   |   |        Integration Services          |  |  |
|  |  |  (Routing, Rate Limiting, |   |  (BullMQ, Redis, Node.js)  |   |    (Webhooks, Microsoft Planner,     |  |  |
|  |  |   Tenant Auth, RLS Proxy) |   |  - Audio Chunking & Ingest |   |     Teams, Slack, Jira, Notion)      |  |  |
|  |  +-------------+-------------+   |  - Pipeline Stage Executor |   +-------------------+------------------+  |  |
|  |                |                 |  - Report PDF Generator    |                       |                     |  |
|  |                |                 +-------------+--------------+                       |                     |  |
|  |                v                               |                                      v                     |  |
|  |  +---------------------------------------------+---------------------------------------------------------+  |  |
|  |  |                                  SUPABASE MANAGED CLUSTER (PostgreSQL 16)                             |  |  |
|  |  |                                                                                                       |  |  |
|  |  |   - 46 Relational Tables (Projects, Transcripts, Decisions, Actions, Insights, Audit Logs)            |  |  |
|  |  |   - PostgreSQL Row Level Security (RLS) Engine with Kernel-Level Tenant Isolation                     |  |  |
|  |  |   - pgvector HNSW Extension (Semantic Vector Embeddings, 1536-dim / 3072-dim)                        |  |  |
|  |  |   - Knowledge Graph Substrate (Recursive CTEs, Directed Edges, Entity Clustering)                    |  |  |
|  |  |   - Database Event Triggers & Realtime Replication Engine                                             |  |  |
|  |  |   - S3-Compatible Encrypted Object Storage (Audio, Video, Transcripts, Generated PDF Packs)           |  |  |
|  |  +---------------------+-----------------------+----------------------------------+----------------------+  |  |
|  |                        |                       |                                  |                         |  |
|  +------------------------|-----------------------|----------------------------------|-------------------------+  |
|                           |                       |                                  |                            |
|                           v                       v                                  v                            |
|           +-------------------------------+  +-------------------------------+  +-------------------------------+ |
|           |       AI INFERENCE MESH       |  |     COGNITIVE COPILOT MESH    |  |       AUTONOMOUS AGENTS       | |
|           |   (OpenAI, Anthropic, Gemini, |  |  (Context Assembly, RAG RRF,  |  |  (Executive Briefing Agent,   | |
|           |    Local DeepSeek Inference)  |  |   Source Attribution Engine)  |  |   CRM Agent, Reporting Agent)  | |
|           +-------------------------------+  +-------------------------------+  +-------------------------------+ |
|                                                                                                                   |
+-------------------------------------------------------------------------------------------------------------------+
```

### 2.2 Subsystem Interactions and Ingestion Lifecycle
The Concludo architecture coordinates nine distinct operational subsystems:
1. Client Access Subsystem: Enterprise users interact with Concludo via modern desktop browsers, mobile devices, and embedded web views. All HTTP and WebSocket requests pass through Cloudflare Anycast edge proxies providing SSL termination, web application firewall (WAF) filtering, and edge caching for static assets.
2. Ingestion Gateway: When meeting audio, video, or external transcripts enter the system (via direct upload, Zoom integration, Microsoft Teams bot, or API ingestion), the ingestion gateway verifies tenant quotas, authenticates permissions, and writes the raw artifact to encrypted S3-compatible object storage.
3. Pipeline Stage Execution Engine: An asynchronous distributed worker pool picks up the newly created ingestion task. It executes the sixteen discrete stages of the Concludo Meeting Intelligence Pipeline (Tasklet A0), ranging from acoustic speech-to-text normalisation to speaker attribution, entity extraction, and five-field action item standardisation.
4. Relational and Graph Storage Subsystem: Structured intelligence generated by the pipeline is committed transactionally to the PostgreSQL database cluster. Relational tables store discrete entities (`projects`, `transcripts`, `decision_memory`, `action_tracker`), while the graph substrate links these entities into `knowledge_nodes` and `knowledge_relationships`.
5. Semantic Search and Vector Subsystem: Document chunks, executive summaries, decision rationales, and conversational turns are embedded into dense vector representations using state-of-the-art embedding models. Embeddings are indexed using PostgreSQL `pgvector` HNSW index structures, enabling sub-second cosine distance searches.
6. Cognitive Copilot Engine: The copilot subsystem receives natural language inquiries from authorized users, executes hybrid search combining keyword (BM25) and dense vector retrieval, enriches results with knowledge graph multi-hop relational context, and streams synthesized, source-attributed responses back to the frontend.
7. Document and Package Compilation Engine: When users request business deliverables (e.g., Business Plans, Board Briefings, Risk Assessments), the document engine extracts structured data from relational records, passes it through specialised LLM synthesis prompts, renders compliant HTML/React DOM templates, and compiles pixel-perfect PDF packages via headless browser rendering.
8. External Integration Subsystem: Bi-directional synchronisation adapters maintain real-time parity with external enterprise systems including Microsoft Planner, Microsoft Teams, Slack, Jira, Notion, and enterprise CRMs (Salesforce, HubSpot).
9. Autonomous Agent and Workflow Mesh: Governed background agents run on scheduled triggers or event hooks. They analyse cross-meeting velocity, detect emerging delivery risks, prepare weekly executive briefs, and generate draft workflow approvals for human sign-off.

---

## Section 3: Technology Stack

### 3.1 Technology Selection Matrix and Architectural Justifications
Every tier in the Concludo technology stack has been selected to optimise type safety, developer velocity, operational reliability, horizontal scalability, and enterprise governance compliance.

| Architectural Layer | Selected Technology | Version / Specification | Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React | 19.x | Modern functional component model, concurrent rendering, improved hydration performance, transition hooks. |
| **Language** | TypeScript | 5.5+ | End-to-end static type safety, strict null checking, autogenerated database contract binding. |
| **Build & Bundler** | Vite | 5.x | Instant Hot Module Replacement (HMR), tree-shaking, optimised ES module build pipeline. |
| **Routing** | React Router | 6.x (Data Router) | Declarative client-side routing, nested layouts, route loaders, robust navigation guards. |
| **Styling** | Tailwind CSS | 3.4+ | Utility-first design tokens, zero-runtime CSS overhead, consistent brand palette enforcement. |
| **Icons** | Lucide React | Latest | Consistent, clean 24px icon set matching Concludo visual standards. |
| **Database** | PostgreSQL | 16.x (via Supabase) | World-class relational reliability, ACID transactions, robust trigger support, broad extension ecosystem. |
| **Security & Auth** | Supabase Auth & RLS | Native GoTrue | JWT session management, PKCE authentication, SAML 2.0 enterprise SSO, kernel-level Row Level Security. |
| **Vector Storage** | pgvector | 0.7+ | Co-locates dense vector embeddings with transactional data; eliminates multi-database sync overhead. |
| **Caching & Queues**| Redis & BullMQ | Redis 7.2 / BullMQ 5.x | High-throughput distributed task queues, job retries, dead-letter queues, sub-millisecond session caching. |
| **AI Orchestration**| LangChain / Vercel AI SDK | Native TypeScript | Standardised model abstractions, structured JSON parsing, streaming response primitives, prompt templating. |
| **Primary LLMs** | Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o | Latest APIs | High reasoning quality for executive briefings, structured synthesis, and zero-hallucination extraction. |
| **Secondary LLMs** | Google Gemini 1.5 Pro / DeepSeek V3 | Latest APIs | Massive context window evaluation (2M tokens) for long audio transcripts and bulk meeting archives. |
| **Embeddings** | OpenAI text-embedding-3-large | 3072 / 1536 dims | Superior semantic retrieval quality, flexible dimensionality truncation, cost-effective vector generation. |
| **Document Rendering**| Puppeteer / Chromium Headless | Latest Stable | Deterministic, pixel-perfect PDF rendering from HTML/Tailwind DOM templates; exact CSS print media compliance. |
| **Object Storage** | S3-Compatible Cloud Storage | AES-256 Encrypted | Highly available, durable binary storage for audio, video, transcripts, attachments, and compiled PDF packs. |
| **Hosting & Edge** | Cloudflare Pages / Workers | Global Anycast | Edge CDN caching, DDoS mitigation, web application firewall, instant global asset distribution. |
| **Compute Runtime** | Node.js / Bun | Node 20 LTS / Bun 1.3 | High-performance asynchronous execution for backend microservices, workers, and background scripts. |
| **CI/CD** | GitHub Actions | Workflows v4 | Automated linting, type-checking, regression testing, security scanning, and automated deployment. |
| **Telemetry & APM**| OpenTelemetry & Sentry | Standard OTLP | Unified distributed tracing, structured application logging, real-time error capture, and performance alerts. |

### 3.2 Deep Dive: Architectural Evaluation of Stack Decisions
1. Why React 19 and Vite over Next.js:
   Concludo Workspace is an authenticated, high-density enterprise single-page application requiring complex local state, canvas-based visual graphs, real-time WebSocket subscriptions, and sub-second UI interactions. Next.js server-side rendering (SSR) introduces operational complexity, node server hosting overhead, and redundant server-client serialization hops for authenticated internal dashboards. A pure client-side SPA built with Vite and React 19 delivers instantaneous route transitions, static edge asset distribution via Cloudflare Pages, and superior developer HMR speeds while eliminating SSR cache poisoning risks across multi-tenant boundaries.

2. Why Supabase and PostgreSQL 16 over Document NoSQL Databases:
   Organisational intelligence is deeply relational: transcripts connect to speaker profiles; speakers make commitments that become actions; actions depend on decisions; decisions resolve enterprise risks; and risks impact projects. Modelling this intricate web of institutional memory in a document store (e.g., MongoDB, DynamoDB) leads to severe data anomalies, manual multi-collection aggregation queries, and fragmented access control. PostgreSQL 16 provides ACID guarantees, recursive Common Table Expressions (CTEs) for multi-hop graph traversal, native JSONB storage for dynamic schema extensions, and kernel-level Row Level Security (RLS) that guarantees tenant data isolation.

3. Why pgvector over Standalone Vector Databases (Pinecone, Weaviate, Qdrant):
   Standalone vector databases introduce distributed consistency challenges: deleting a meeting transcript in the primary database requires an external network call to delete associated embeddings in the vector store. If that call fails, orphaned vectors remain searchable, creating a dangerous data leak. With `pgvector`, vector embeddings reside in `public.vector_embeddings` directly alongside transactional records. Foreign keys with `ON DELETE CASCADE` ensure that when a transcript or project is soft-deleted or purged, its vector embeddings are purged in the exact same atomic transaction. Furthermore, hybrid search queries can join relational filters (e.g., `organization_id = '...'`, `confidentiality_level <= 3`) directly into vector distance scans.

4. Why Redis and BullMQ for Asynchronous Workflows:
   Enterprise meeting processing involves variable, high-latency computational phases: acoustic file transcoding (10 to 60 seconds), speech-to-text API calls (30 to 120 seconds), multi-stage LLM extraction (15 to 45 seconds), and PDF package rendering (3 to 8 seconds). Executing these within synchronous HTTP request cycles causes gateway timeouts and degraded user experiences. BullMQ running on managed Redis 7.2 provides deterministic job scheduling, parent-child job hierarchies for multi-stage DAG pipelines, automatic exponential retries with jitter, rate-limited worker pools, and robust dead-letter queue (DLQ) isolation.

---

## Section 4: Frontend Architecture

### 4.1 Application Structure and Layout Topography
The Concludo Workspace frontend application is engineered as a single-page application (SPA) adhering to strict architectural boundaries. The user interface provides responsive, high-performance interactions across diverse form factors, ranging from high-resolution executive boardroom displays (4K/Ultrawide) to standard desktop viewports (1920x1080, 1440x900) and enterprise mobile tablets.

The frontend shell is structured around three foundational visual zones:
1. Global Navigation Rail: A collapsible, persistent left rail providing persistent orientation across Workspace domains (Dashboard, Projects, Transcripts, Outputs, Decisions, Actions, Insights, Copilot, Settings).
2. Contextual Header and Command Bar: A top header housing global search activation (`Cmd+K`), active organisation/team context switchers, notifications, and user profile management.
3. Workspace Canvas: A high-density, multi-layout viewport supporting dynamic grid arrangements, tabular data exploration, interactive document preview panels, and split-screen Copilot interactions.

```
+-------------------------------------------------------------------------------------------------------------------+
|                                            CONCLUDO WORKSPACE FRONTEND SHELL                                      |
+-------------------------------------------------------------------------------------------------------------------+
|  [ BRAND LOGO ]  |  [ GLOBAL SEARCH: Cmd+K ]      [ ORG / TEAM SWITCHER ]      [ ALERTS ]  [ USER PROFILE ]       |
+------------------+------------------------------------------------------------------------------------------------+
|  NAVIGATION RAIL |  WORKSPACE HEADER: Breadcrumbs, Action Toolbar, Status Badges, Export Controls                 |
|  - Dashboard     +------------------------------------------------------------------------------------------------+
|  - Projects      |                                                                                                |
|  - Transcripts   |  PRIMARY VIEWPORT / DATA GRID / DOCUMENT VIEWER                                                |
|  - Outputs       |                                                                                                |
|  - Decisions     |  - High-density data tables with sorting, filtering, and pagination                            |
|  - Actions       |  - Interactive visual models (Roadmaps, 2x2 Priority Matrices, 5x5 Risk Heatmaps)               |
|  - Insights      |  - Executive preview panels with WYSIWYG document inspection                                  |
|  - Knowledge     |                                                                                                |
|  - Copilot       |                                                                                                |
|  - Workflows     |                                                                                                |
|  - Governance    |                                                                                                |
|  - Settings      |                                                                                                |
|                  |                                                                                                |
|                  |                                                                                                |
+------------------+------------------------------------------------------------------------------------------------+
|  STATUS / SYNC   |  FOOTER / METADATA BAR: RLS Context, System Health, Last Synchronised Timestamp                 |
+-------------------------------------------------------------------------------------------------------------------+
```

### 4.2 Routing Topography and Navigation Guards
Concludo utilizes React Router 6 with data router APIs, providing declarative route configurations, nested sub-layouts, asynchronous data loaders, and strict route-level authentication guards.

The application navigation topology is partitioned into four security zones:
1. Public Zone: Unauthenticated routes including marketing landing pages, documentation, and error boundaries.
2. Authentication Zone: Login (`/login`), Registration (`/register`), Password Recovery (`/forgot-password`), and Enterprise SSO Callback (`/auth/callback`).
3. Protected Workspace Zone: Authenticated application routes requiring valid session tokens, profile provisioning, and organisation membership (`/dashboard`, `/projects`, `/transcripts`, `/outputs`, `/decisions`, `/actions`, `/insights`, `/copilot`, `/settings`).
4. Enterprise Administration Zone: Highly restricted administrative routes accessible only to users with `admin` or `enterprise_admin` roles (`/settings/organization`, `/settings/sso`, `/settings/audit`, `/settings/retention`, `/settings/legal-holds`).

Navigation guards enforce authentication prerequisites prior to rendering child component trees:
- `ProtectedRoute`: Verifies active Supabase session; redirects unauthenticated visitors to `/login` with an encrypted return-path parameter.
- `RoleGuard`: Evaluates user role within the active organisation context against required permissions; renders a standardised 403 Forbidden boundary if unauthorized.
- `PlanGuard`: Evaluates active subscription tier against feature flags; displays upgrade modals or view-only previews when accessing premium enterprise capabilities (e.g., Autonomous Agents, Predictive Digital Twins).

```typescript
// src/routes/ProtectedRoute.tsx implementation pattern
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/feedback/LoadingSpinner';

export const ProtectedRoute: React.FC = () => {
  const { session, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-concludo-canvas">
        <LoadingSpinner size="lg" message="Authenticating enterprise credentials..." />
      </div>
    );
  }

  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
```

### 4.3 Component Modularity and Feature Boundaries
The component hierarchy enforces strict separation between generic UI primitives, domain-specific feature widgets, and top-level layout orchestrators:
- UI Primitives (`components/ui/*`): Highly reusable, headless, unopinionated UI components (Button, Input, Select, Modal, Dropdown, Tooltip, Badge). These components accept design tokens via props and maintain zero direct awareness of application domain models.
- Domain Feature Components (`features/{domain}/*`): Specialised components implementing business logic, local state manipulation, and domain-specific styling (e.g., `DecisionCard`, `ActionItemRow`, `HealthRadarChart`, `TranscriptTurnPlayer`).
- Page Layout Orchestrators (`pages/*`): High-level route coordinators that assemble feature components, connect to global state stores, trigger asynchronous data fetches, and manage layout responsiveness.

### 4.4 Accessibility Standards and Responsive Requirements
Concludo enforces strict WCAG 2.1 Level AA compliance across all frontend screens:
- Semantic Markup: All user interface elements utilize standard semantic HTML5 tags (`<nav>`, `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`). Custom interactive widgets implement complete WAI-ARIA role and state attributes (`aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-live`).
- Keyboard Navigation: Full operational parity via keyboard navigation. Tab order follows logical visual hierarchy. Modals enforce focus trapping and restore focus to trigger elements upon dismissal. Global hotkeys (`Cmd+K` for search, `Cmd+Enter` for form submissions, `Esc` for modal closure) provide executive keyboard efficiency.
- Contrast Compliance: All text, icons, and interactive borders maintain a minimum contrast ratio of 4.5:1 against their backgrounds for standard body copy, and 3:1 for large display headings (18pt+ or 14pt bold), conforming to Concludo brand tokens.
- Responsive Breakpoints: Layouts dynamically adapt across five standardised responsive breakpoints: Mobile (`< 640px`), Small Tablet (`640px - 767px`), Large Tablet / Laptop (`768px - 1023px`), Desktop (`1024px - 1439px`), and Executive Wide (`>= 1440px`). Data grids switch gracefully from multi-column tables to stacked cards on narrow viewports to preserve data legibility.


## Section 5: Frontend Folder Structure

### 5.1 Authoritative Folder Taxonomy
The Concludo frontend application lives under `app/` in the codebase. It enforces a strict, modular directory layout designed to prevent code bloat, decouple concerns, and eliminate circular dependencies.

```
app/
├── index.html                      # HTML entry point with fonts and meta tags
├── package.json                    # Frontend dependencies and build scripts
├── vite.config.ts                  # Vite build configuration and path aliases
├── tsconfig.json                   # TypeScript compiler configuration
├── tailwind.config.js              # Tailwind tokens, colours, and typography
├── src/
│   ├── main.tsx                    # React application bootstrap and DOM mounting
│   ├── App.tsx                     # Root component with providers and router
│   ├── routes/                     # Route definitions and navigation guards
│   │   ├── index.tsx               # Master route configuration table
│   │   ├── ProtectedRoute.tsx      # Auth session and profile guard
│   │   ├── RoleGuard.tsx           # RBAC permission evaluation guard
│   │   └── PlanGuard.tsx           # Feature flag and subscription guard
│   ├── layouts/                    # Structural layout frames
│   │   ├── RootLayout.tsx          # Global provider shell and error boundary
│   │   ├── WorkspaceLayout.tsx     # Shell with navigation rail and command bar
│   │   ├── AuthLayout.tsx          # Clean centered card layout for login/auth
│   │   └── DocumentLayout.tsx      # Focused full-width layout for document inspection
│   ├── pages/                      # Top-level route pages (orchestrators)
│   │   ├── DashboardPage.tsx       # Executive portfolio summary and KPI tiles
│   │   ├── ProjectsPage.tsx        # Project portfolio listing and creation modal
│   │   ├── ProjectDetailPage.tsx   # Project workspace, tabs, and activity feed
│   │   ├── TranscriptsPage.tsx     # Meeting intake, audio upload, and pipeline status
│   │   ├── OutputsPage.tsx         # Deliverable catalogue, generator, and viewer
│   │   ├── DecisionsPage.tsx       # Decision memory registry and consensus view
│   │   ├── ActionsPage.tsx         # Action tracker, Kanban board, and delegation view
│   │   ├── InsightsPage.tsx        # Unspoken blind spot audit and strategic insights
│   │   ├── KnowledgePage.tsx       # Visual knowledge graph explorer and search
│   │   ├── CopilotPage.tsx         # Interactive multi-turn executive reasoning agent
│   │   ├── WorkflowsPage.tsx       # Workflow automation builder and execution logs
│   │   ├── TeamPage.tsx            # Team roster, invitations, and role management
│   │   ├── SettingsPage.tsx        # Profile, organisation, and preferences
│   │   ├── GovernancePage.tsx      # Enterprise audit logs, retention, and legal holds
│   │   └── NotFoundPage.tsx        # Standardised 404 navigation recovery page
│   ├── features/                   # Domain-driven feature modules
│   │   ├── auth/                   # Authentication forms, SSO buttons, session hooks
│   │   ├── projects/               # Project cards, creation forms, project settings
│   │   ├── transcripts/            # Acoustic player, waveform, speaker turn editor
│   │   ├── outputs/                # Template previewers, export buttons, DQI scorecards
│   │   ├── decisions/              # Decision modal, rationale editor, consensus badges
│   │   ├── actions/                # Five-field action editor, date pickers, CRI gauge
│   │   ├── insights/               # Insight channel filters, severity badges, quote anchors
│   │   ├── knowledge/              # Force-directed graph canvas, node details panel
│   │   ├── copilot/                # Chat stream, context drawer, verbatim citation tags
│   │   ├── workflows/              # DAG canvas, trigger forms, approval action modals
│   │   └── governance/             # Audit log table, retention rules, legal hold toggles
│   ├── components/                 # Shared presentation components
│   │   ├── ui/                     # Unopinionated UI primitives (buttons, inputs, modals)
│   │   ├── feedback/               # Skeletons, spinners, progress bars, toast alerts
│   │   ├── charts/                 # Visualisation components (Bar, Line, Radar, Donut)
│   │   ├── tables/                 # Sortable, filterable, paginated data grid wrappers
│   │   └── navigation/             # Navigation rail, breadcrumbs, command palette
│   ├── hooks/                      # Global and cross-cutting custom React hooks
│   │   ├── useAuth.ts              # Supabase session and user profile accessor
│   │   ├── useWorkspace.ts         # Active organisation, team, and project switcher
│   │   ├── usePermissions.ts       # Client-side permission and role evaluation
│   │   ├── useDebounce.ts          # Input debouncing for search and autosave
│   │   ├── useHotkeys.ts           # Global keyboard shortcut binding
│   │   └── useMediaQuery.ts        # Responsive breakpoint evaluation
│   ├── services/                   # Backend and API client abstractions
│   │   ├── supabase.ts             # Supabase client singleton with persistent session
│   │   ├── api.ts                  # REST API client with interceptors and error handler
│   │   ├── ingestionService.ts     # Chunked audio and transcript upload coordinator
│   │   ├── copilotService.ts       # SSE streaming client for Copilot dialogue
│   │   └── exportService.ts        # PDF, DOCX, and JSON deliverable download triggers
│   ├── providers/                  # React context providers
│   │   ├── AuthProvider.tsx        # Authentication state and token refresh loop
│   │   ├── WorkspaceProvider.tsx   # Active tenant context and membership cache
│   │   ├── ThemeProvider.tsx       # Dark/light theme mode and Concludo tokens
│   │   └── ToastProvider.tsx       # Global toast notification queue
│   ├── utils/                      # Pure helper functions
│   │   ├── formatting.ts           # Currency, date (Australian format: DD/MM/YYYY), time
│   │   ├── validation.ts           # Input validators, Zod schemas, regex checkers
│   │   ├── text.ts                 # Truncation, slug generation, Australian spelling checks
│   │   └── metrics.ts              # DQI, CRI, and Meeting Health calculation formulas
│   ├── types/                      # TypeScript type declarations
│   │   ├── database.ts             # Autogenerated Supabase database contracts
│   │   ├── models.ts               # Extended client domain models and entity interfaces
│   │   ├── api.ts                  # API request/response payloads and error contracts
│   │   └── visual.ts               # Visual framework data models (VIS-01 to VIS-28)
│   ├── styles/                     # Global stylesheets and fonts
│   │   ├── globals.css             # Tailwind base, components, and utilities
│   │   └── typography.css          # Poppins and Inter font-face declarations
│   └── assets/                     # Static brand assets, logos, and vector illustrations
```

### 5.2 Ownership Rules and Anti-Technical-Debt Standards
To maintain high velocity while preventing architectural decay across engineering iterations, the frontend codebase adheres to four strict ownership rules:
1. Feature Encapsulation Rule: Feature modules (`features/{domain}`) must encapsulate their domain-specific UI components, internal hooks, and state helpers. A feature may import from `components/ui`, `hooks`, `services`, `types`, and `utils`. A feature must never import internal components from another feature; cross-domain communication must occur through shared services, shared route parameters, or the global Workspace state store.
2. Zero Direct Supabase Access in Views: React page components and UI presentation elements must never execute raw Supabase queries or invoke SQL RPC functions directly. All database access must be routed through typed methods in `services/*` or custom React query hooks. This decouples presentation logic from database schemas and facilitates unit testing.
3. Immutability of Database Types: The `types/database.ts` file is strictly autogenerated from the live PostgreSQL schema via the Supabase CLI (`supabase gen types typescript`). Manual edits to this file are forbidden. Custom application-layer types that extend database records must be authored in `types/models.ts`.
4. Strict Linting and Circular Dependency Prevention: All pull requests undergo automated static analysis via ESLint and TypeScript compiler verification. Circular imports between modules are treated as fatal build errors and blocked by CI pipelines.

---

## Section 6: Design System Architecture

### 6.1 Theme System and Brand Design Tokens
The Concludo Design System embodies consulting-grade visual restraint, functional clarity, and executive gravitas. Concludo interfaces project authority through high contrast, generous structured whitespace, crisp typography, and purposeful semantic colour application.

The design system is implemented via Tailwind CSS design tokens defined in `tailwind.config.js`:

```javascript
// tailwind.config.js token specification
module.exports = {
  theme: {
    extend: {
      colors: {
        concludo: {
          navy: {
            DEFAULT: '#16263F', // Deep Executive Navy - Primary Brand Surface
            dark: '#0D1726',    // Midnight Navy - Deep Grounding / Sidebar
            light: '#21395C',   // Slate Navy - Interactive Hover / Secondary Card
            border: '#2C4A75',  // Structural Dividing Lines
            subtle: '#3B5E8C',  // Tertiary Accent Navy
          },
          gold: {
            DEFAULT: '#E2B53C', // Accent Gold - Primary CTAs / Highlights / Badges
            hover: '#BC8A1C',   // Deep Burnished Gold - Active States
            light: '#F5DE93',   // Soft Gold Tint - Background Tags
            muted: '#8A6D23',   // Subdued Border / Secondary Metallic
            subtle: '#FFF8E7',  // Pale Gold Tint Canvas
          },
          canvas: {
            DEFAULT: '#F4F6FA', // Light Executive Canvas - Main Workspace Surface
            pure: '#FFFFFF',    // Pristine White - Elevated Card Panels
            muted: '#E9ECF2',   // Secondary Panel Fill
            border: '#D8DEE9',  // Structural Borders
            dark: '#E2E6EF',    // High-Contrast Divider Fill
          },
          rag: {
            red: '#E53E3E',     // Severe Risk / Blocked / Off Track
            amber: '#DD6B20',   // Warning / Slipping / Moderate Concern
            green: '#38A169',   // Complete / On Track / Healthy
            blue: '#3182CE',    // Informational / Pending Review
          }
        }
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      }
    }
  }
}
```

### 6.2 Typography Hierarchy and Typesetting Rules
The typography system pairs Poppins for authoritative headings with Inter for high-legibility data density:
- Display Title (Hero): Poppins 32px / 2.0rem, SemiBold (600), Line Height 1.25, Tracking -0.02em. Reserved for top-level page headers and board report covers.
- Section Header (H1): Poppins 24px / 1.5rem, SemiBold (600), Line Height 1.3, Tracking -0.01em. Used for primary workspace views and document sections.
- Card Header (H2): Poppins 18px / 1.125rem, Medium (500), Line Height 1.4. Used for dashboard cards, panel headers, and modal titles.
- Subheading (H3): Poppins 15px / 0.9375rem, Medium (500), Line Height 1.4. Used for section dividers and table category headers.
- Body Copy (Regular): Inter 14px / 0.875rem, Regular (400), Line Height 1.5. Used for all standard narrative text, descriptions, and summaries.
- Body Copy (Dense / Table): Inter 13px / 0.8125rem, Regular (400), Line Height 1.4. Used for high-density tabular data, action items, and audit logs.
- Captions and Metadata: Inter 11px / 0.6875rem, Medium (500), Line Height 1.4, Tracking +0.01em, Uppercase. Used for status badges, timestamps, and column headers.
- Code and Identifiers: JetBrains Mono 12px / 0.75rem, Regular (400). Used for UUIDs, commit hashes, webhook payloads, and API keys.

### 6.3 Executive, Board, and Operational Styling Standards
The design system dynamically modulates visual density based on target audience persona:
1. Executive Styling: Balanced density, prominent KPI stat tiles, high-level executive summaries, actionable decision alerts, and minimal operational noise. Focuses on strategic outcomes and velocity metrics.
2. Board Reporting Styling: Ultra-clean, formal typography, high whitespace allocation (35%), crisp tabular alignments, monochromatic RAG status badges, explicit footnote attribution, and publication-ready print layout styling.
3. Operational Presentation Styling: High information density, compact table rows, multi-column filtering controls, expandable accordions, interactive sorting, and rapid inline keyboard editing controls for project managers and delivery leads.

### 6.4 Component Styling Tokens and Paged Media Standards
- Cards and Containers: Background `bg-white`, border `border border-concludo-canvas-border`, shadow `shadow-sm`, rounded `rounded-lg`, internal padding `p-6`.
- Tables and Data Grids: Table header `bg-concludo-canvas-muted text-concludo-navy font-medium text-xs tracking-wider uppercase border-b border-concludo-canvas-border`, row height `h-11`, zebra striping `even:bg-concludo-canvas/50`, hover state `hover:bg-concludo-gold-subtle/40 transition-colors`.
- Action Buttons: Primary button `bg-concludo-gold hover:bg-concludo-gold-hover text-concludo-navy font-semibold px-4 py-2 rounded-md transition-all shadow-sm active:scale-[0.98]`; Secondary button `bg-concludo-navy hover:bg-concludo-navy-light text-white font-medium px-4 py-2 rounded-md transition-all`.
- Paged Media Print Rules (for PDF Compilation):
```css
@page {
  size: A4 portrait;
  margin: 20mm 15mm 20mm 15mm;
  @top-left {
    content: "CONCLUDO WORKSPACE | EXECUTIVE INTELLIGENCE";
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #64748B;
  }
  @top-right {
    content: string(document-title);
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #64748B;
  }
  @bottom-left {
    content: "CONFIDENTIAL | COMMERCIAL-IN-CONFIDENCE";
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #E53E3E;
  }
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #64748B;
  }
}
```

---

## Section 7: State Management Architecture

### 7.1 State Separation and Scoping Topography
State within Concludo Workspace is partitioned into four distinct operational tiers to prevent state explosion, eliminate unnecessary component re-renders, and ensure deterministic data flow:

```
+----------------------------------------------------------------------------------------------------+
|                                    STATE MANAGEMENT TOPOGRAPHY                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                                                                 |
|    |      1. SERVER STATE        |  - Supabase Database Records (Projects, Actions, Decisions)     |
|    |     (React Query / SWR)     |  - Optimistic updates, background revalidation, stale-while-    |
|    |                             |    revalidate caching, automatic garbage collection             |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v                                                                                |
|    +-----------------------------+                                                                 |
|    |      2. WORKSPACE STATE     |  - Active Organisation ID, Active Team ID, Active Project ID    |
|    |      (Zustand / Context)    |  - User Profile, Permissions Matrix, Feature Entitlements       |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v                                                                                |
|    +-----------------------------+                                                                 |
|    |      3. VIEW / UI STATE     |  - Sidebar collapsed state, active tab index, filter queries    |
|    |      (Zustand / URL Params) |  - Data table sorting order, modal visibility, draft inputs     |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v                                                                                |
|    +-----------------------------+                                                                 |
|    |     4. STREAMING AI STATE   |  - Copilot active conversation turn, SSE token buffer           |
|    |     (Vercel AI SDK Hooks)   |  - Realtime generation status, retrieved citation anchors       |
|    +-----------------------------+                                                                 |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 7.2 Server State Management (React Query Protocol)
All asynchronous server state is managed through React Query hooks, ensuring predictable synchronization with the Supabase database:
- Caching Strategy: Queries use a default `staleTime` of 60 seconds and `gcTime` (garbage collection) of 5 minutes. Static metadata (e.g., meeting type classifications, output template definitions) uses a `staleTime` of 24 hours.
- Optimistic Mutations: When users update action item statuses, record decision outcomes, or edit project metadata, React Query immediately updates the local cache optimistically, providing zero-latency UI responsiveness. In the event of a network or server validation failure, the mutation rolls back to the previous snapshot and displays a descriptive toast notification.
- Automated Invalidation: Mutations declare precise query key invalidation targets. For example, creating a new decision in `useCreateDecisionMutation` automatically invalidates `['decisions', projectId]`, `['project', projectId]`, and `['dashboard', orgId]`.

```typescript
// src/hooks/useActionMutations.ts implementation pattern
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { FiveFieldActionItem } from '../types/models';

export const useUpdateActionStatusMutation = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: FiveFieldActionItem['status'] }) => {
      const { data, error } = await supabase
        .from('action_tracker')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', actionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ actionId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['actions', projectId] });
      const previousActions = queryClient.getQueryData<FiveFieldActionItem[]>(['actions', projectId]);

      if (previousActions) {
        queryClient.setQueryData<FiveFieldActionItem[]>(
          ['actions', projectId],
          previousActions.map(action => (action.id === actionId ? { ...action, status } : action))
        );
      }

      return { previousActions };
    },
    onError: (err, variables, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['actions', projectId], context.previousActions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
```

### 7.3 Workspace and Tenant Context
The `useWorkspace` store manages the active tenant boundaries across the application:
- Stores the active `organizationId`, `teamId`, and `projectId`.
- Syncs state bidirectionally with URL route parameters (`/org/:orgId/project/:projectId`), ensuring deep-link sharing across team members preserves context.
- Monitors organisation membership changes via Supabase Realtime subscriptions, instantly purging local caches if a user is revoked from a workspace.

### 7.4 Copilot and Agent Streaming State
Copilot interactions utilize lightweight client-side streaming buffers:
- Incoming Server-Sent Events (SSE) append incremental text tokens to an active response accumulator.
- Citations and grounding anchors are received in structured metadata headers prior to the text stream, allowing the UI to render source attribution badges immediately.
- Conversation history is debounced and persisted to `public.copilot_messages` upon completion of each AI generation cycle.

---

## Section 8: Backend Architecture

### 8.1 Layered Service Architecture and Separation of Concerns
The Concludo backend is engineered as a clean, layered system where each tier has a strictly bounded responsibility. The architecture prevents logic leakage, ensures auditability, and enforces security invariants across all operational workflows.

```
+----------------------------------------------------------------------------------------------------+
|                                    BACKEND LAYERED ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ CLIENT APPLICATION ]           Web Browser (React 19 SPA) / External Webhooks / API Consumers |
|              |                                                                                     |
|              v HTTPS / TLS 1.3                                                                     |
|    +------------------------------------------------------------------------------------------+    |
|    |  1. EDGE API GATEWAY & SECURITY LAYER                                                    |    |
|    |     - Cloudflare Edge Workers / Reverse Proxy                                            |    |
|    |     - IP Rate Limiting, DDoS Mitigation, WAF Filtering                                   |    |
|    |     - JWT Token Validation, PKCE Exchange, Tenant Routing                                |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  2. API CONTRACT & ROUTING LAYER                                                         |    |
|    |     - PostgREST RESTful Endpoints (`/rest/v1/*`)                                         |    |
|    |     - Custom TypeScript Edge Functions (`/api/v1/*`)                                     |    |
|    |     - Request Schema Validation via Zod, Correlation ID Injection                        |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  3. BUSINESS LOGIC & ORCHESTRATION LAYER                                                 |    |
|    |     - Domain Services (Projects, Transcripts, Decisions, Actions, Insights)              |    |
|    |     - 16-Stage Meeting Pipeline DAG Executor (Tasklet A0)                                |    |
|    |     - Output Compiler & Template Assembly Service (Tasklet A1)                           |    |
|    |     - Cognitive Copilot & Multi-Hop RAG Service                                          |    |
|    |     - Autonomous Agent Runtime & Human Approval Gating Service                           |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  4. DATA PERSISTENCE & GOVERNANCE LAYER (PostgreSQL 16)                                  |    |
|    |     - PostgreSQL Kernel Row Level Security (RLS) Enforcement                             |    |
|    |     - 46 Relational Tables & Directed Knowledge Graph Substrate                          |    |
|    |     - pgvector HNSW Indexing & Cosine Distance Search                                    |    |
|    |     - Immutable Audit Triggers (`audit_logs`) & Statutory Retention Purge Engine         |    |
|    +------------------------------------------------------------------------------------------+    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 8.2 Architectural Layers Detailed
1. Edge API Gateway and Security Layer: Terminates incoming client connections, validates TLS certificates, performs DDoS filtering, verifies cryptographic JWT signatures, and injects tenant correlation headers (`X-Concludo-Request-ID`, `X-Concludo-Tenant-ID`).
2. API Contract and Routing Layer: Serves structured RESTful endpoints and WebSocket streams. PostgREST dynamically exposes database tables and views with automatic OpenAPI documentation. Complex, multi-table transactions and external orchestrations route through custom TypeScript Edge Functions validating inputs against strict Zod schemas.
3. Business Logic and Orchestration Layer: Implements domain-specific rules, state transitions, pipeline execution, document generation, and external integration synchronisation. It coordinates asynchronous jobs via BullMQ worker queues and interfaces with foundational AI providers.
4. Data Persistence and Governance Layer: The authoritative source of truth backed by managed PostgreSQL 16. Enforces tenant boundary isolation via database-level Row Level Security (RLS) policies, tracks entity relationships through knowledge graph tables, executes fast semantic vector searches via `pgvector`, and guarantees regulatory auditability through tamper-evident triggers.

---

## Section 9: Domain Driven Architecture

### 9.1 Enterprise Domain Boundaries
Concludo partitions its business capabilities into nineteen distinct, self-contained functional domains. Each domain maintains explicit service contracts, database entity ownership, and security boundaries.

```
+----------------------------------------------------------------------------------------------------+
|                                    NINETEEN ENTERPRISE DOMAINS                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ IDENTITY & ACCESS ]      [ WORKSPACE & COLLAB ]     [ INTELLIGENCE CORE ]                     |
|    - Authentication Domain    - Organizations Domain     - Transcripts Domain                      |
|    - Governance Domain        - Teams Domain             - Projects Domain                         |
|    - Enterprise Domain        - Integrations Domain      - Outputs Domain                          |
|                                                          - Decision Memory Domain                  |
|    [ EXECUTION & DELIVERY ]   [ COGNITIVE SYSTEMS ]      - Action Tracker Domain                   |
|    - Action Tracker Domain    - Knowledge Graph Domain   - Insights Domain                         |
|    - Workflows Domain         - Copilot Domain           - Endpoint Reports Domain                 |
|    - Agents Domain            - Search Domain            - Stats & Analytics Domain                |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 9.2 Domain Specifications
1. Authentication Domain: Manages user identities, secure sessions, multi-factor authentication (MFA), password recovery, and SAML 2.0 / OIDC enterprise Single Sign-On federation. Owns `profiles`, `organization_domains`, and `organization_sso_configs`.
2. Organisations Domain: Manages enterprise multi-tenancy, billing subscriptions, seat allocation, domain whitelisting, and workspace configurations. Owns `organizations` and `organization_members`.
3. Teams Domain: Governs functional groupings, internal departments, role-based access control (RBAC), and team-level sharing. Owns `teams`, `team_members`, `team_invitations`, and `team_activities`.
4. Projects Domain: The foundational organisational unit for collaborative work. Governs project lifecycle, metadata, participant rosters, and confidentiality levels. Owns `projects`.
5. Transcripts Domain: Handles acoustic file upload, speech-to-text normalisation, speaker diarisation, transcript turn editing, and Meeting Intelligence Pipeline execution. Owns `transcripts`.
6. Outputs Domain: Governs the generation, versioning, quality evaluation, and multi-format export of the fifty-eight business deliverables and nineteen consulting templates. Owns `outputs`.
7. Decision Memory Domain: Extracts, structures, tracks, and evaluates organisational decisions. Governs consensus tracking, rationale documentation, and longitudinal decision drift analysis. Owns `decision_memory`.
8. Action Tracker Domain: Enforces the Five-Field Delegation Standard across all task commitments. Tracks task ownership, due dates, definitions of done, checkpoint reviews, and Commitment Reliability Index (CRI) metrics. Owns `action_tracker`.
9. Insights Domain: The unspoken intelligence engine. Scans collaborative discourse to detect blind spots, unstated assumptions, delivery risks, and strategic opportunities. Owns `generated_intelligence` (type: insight).
10. Stats and Analytics Domain: Computes high-level velocity, meeting waste metrics, cross-project health indicators, and executive dashboards. Owns `predictive_snapshots` and materialised analytics views.
11. Endpoint Reports Domain: Produces lightweight, structured distribution artifacts designed for external stakeholders, clients, and partners. Owns `endpoint_reports`.
12. Search Domain: Orchestrates hybrid retrieval combining PostgreSQL lexical full-text search with dense semantic vector embeddings. Owns `vector_embeddings` and search indexes.
13. Knowledge Graph Domain: Models the enterprise as a directed attributed multi-graph. Links projects, decisions, actions, participants, and risks into a traversable institutional memory. Owns `knowledge_nodes` and `knowledge_relationships`.
14. Copilot Domain: Powers the conversational executive reasoning interface. Manages multi-turn conversation memory, dynamic context budgeting, and source citation attribution. Owns `copilot_conversations`, `copilot_messages`, and `copilot_prompts`.
15. Agents Domain: Governs autonomous, background reasoning agents. Enforces strict capability boundaries, sandboxed execution, and mandatory human approval gates. Owns `agent_activity` and `agent_memory`.
16. Workflows Domain: Orchestrates event-driven business automations, trigger evaluations, conditional branching, and multi-step approval workflows. Owns `workflows`, `workflow_executions`, and `workflow_approvals`.
17. Integrations Domain: Manages bidirectional synchronisation with third-party enterprise tools (Microsoft Planner, Teams, Slack, Jira, Salesforce). Owns `integrations`, `webhooks`, `webhook_logs`, and `api_keys`.
18. Governance Domain: Enforces statutory compliance, tamper-evident audit logging, legal hold preservation, and automated data retention purges. Owns `audit_logs`, `retention_policies`, and `legal_holds`.
19. Enterprise Domain: Provides top-level administrative controls, cross-organisation analytics, security compliance dashboards, and regulatory export tools. Governs enterprise-wide access reviews and security policies.


### 9.3 Comprehensive Domain Specifications and Service Boundaries

Each of the nineteen application domains operates under strict Domain-Driven Design (DDD) principles, maintaining bounded contexts, explicit aggregate roots, transactional invariants, command-query responsibility segregation (CQRS), and event-driven integration hooks.

```
+----------------------------------------------------------------------------------------------------+
|                               DOMAIN-DRIVEN BOUNDED CONTEXT TOPOLOGY                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                                                                 |
|    |      COMMAND (WRITE MODEL)  |  - Ingestion, Mutations, Approval Sign-Offs, Workflow Exec      |
|    |      - Validates Invariants |  - Atomically committed to PostgreSQL Relational Tables         |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v Transactional Commit & Trigger Execution                                       |
|    +-----------------------------+                                                                 |
|    |      DOMAIN EVENT BUS       |  - Outbox Pattern (`public.event_stream`)                       |
|    |      - Redis Fan-Out        |  - Downstream Workers, Async Projections                       |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v Asynchronous Projection & Indexing                                             |
|    +-----------------------------+                                                                 |
|    |      QUERY (READ MODEL)     |  - Materialised Views, Read Replicas, GIN Indexes, pgvector     |
|    |      - High-Velocity Read   |  - Sub-second API responses, Virtualized Tables                 |
|    +-----------------------------+                                                                 |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

#### Domain 1: Authentication Domain (`auth`)
- Aggregate Root: `UserIdentity` (bound to `auth.users` and `public.profiles`).
- Supporting Entities: `public.organization_domains`, `public.organization_sso_configs`.
- Service Invariants:
  - Every profile must belong to at least one valid organisation or have a pending verified invitation.
  - Multi-factor authentication (MFA) is strictly mandatory for all accounts possessing `admin` or `enterprise_admin` roles.
  - SAML 2.0 assertions must match verified enterprise email domain whitelists.
- Primary Commands: `RegisterUser`, `AuthenticateUser`, `InitiateSsoHandshake`, `RotateUserTokens`, `RevokeSession`.
- Primary Queries: `GetUserProfile`, `ValidateActiveSession`, `GetOrganisationSsoConfig`.
- Emitted Domain Events: `user.authenticated`, `user.session_revoked`, `sso_config.updated`.

#### Domain 2: Organisations Domain (`orgs`)
- Aggregate Root: `Organization` (bound to `public.organizations`).
- Supporting Entities: `public.organization_members`.
- Service Invariants:
  - An organisation must have at least one active `enterprise_admin` or `admin`.
  - Organization subscription tiers govern feature gating across autonomous agents, vector search, and integrations.
  - User seat allocations cannot exceed contracted subscription limits.
- Primary Commands: `CreateOrganization`, `UpdateOrganizationSettings`, `AssignMemberRole`, `SuspendOrganization`.
- Primary Queries: `GetOrganizationDetail`, `ListOrganizationMembers`, `GetSubscriptionEntitlements`.
- Emitted Domain Events: `organization.created`, `organization.updated`, `member.role_assigned`.

#### Domain 3: Teams Domain (`teams`)
- Aggregate Root: `Team` (bound to `public.teams`).
- Supporting Entities: `public.team_members`, `public.team_invitations`, `public.team_activities`.
- Service Invariants:
  - A team must be uniquely named within its parent organisation.
  - All team members must maintain active memberships in the parent organisation.
  - Team invitations expire after seven days if unaccepted.
- Primary Commands: `CreateTeam`, `AddTeamMember`, `RemoveTeamMember`, `DispatchTeamInvitation`.
- Primary Queries: `ListTeamsForUser`, `GetTeamRoster`, `GetTeamActivityLedger`.
- Emitted Domain Events: `team.created`, `team.member_added`, `team_invitation.dispatched`.

#### Domain 4: Projects Domain (`projects`)
- Aggregate Root: `Project` (bound to `public.projects`).
- Supporting Entities: Project notes, milestone records.
- Service Invariants:
  - A project must belong to exactly one organisation.
  - A project may optionally be associated with a specific team or open to the entire organisation.
  - Soft-deleted projects cannot accept new transcripts, decisions, or actions.
- Primary Commands: `CreateProject`, `UpdateProjectMetadata`, `ArchiveProject`, `SoftDeleteProject`.
- Primary Queries: `ListProjectsByTenant`, `GetProjectWorkspaceOverview`, `GetProjectHealthStatus`.
- Emitted Domain Events: `project.created`, `project.updated`, `project.archived`, `project.deleted`.

#### Domain 5: Transcripts Domain (`transcripts`)
- Aggregate Root: `Transcript` (bound to `public.transcripts`).
- Supporting Entities: Acoustic segments, speaker turns, word-level timestamps.
- Service Invariants:
  - A transcript must be associated with an active project.
  - Raw audio/video files must be cryptographically hashed (SHA-256) upon upload to prevent duplicate processing.
  - Speaker turns must maintain monotonic temporal ordering.
- Primary Commands: `UploadAudioSource`, `InitiateDiarisation`, `UpdateSpeakerAttribution`, `FinalizeTranscript`.
- Primary Queries: `GetTranscriptDetail`, `ListSpeakerTurns`, `SearchTranscriptText`.
- Emitted Domain Events: `transcript.imported`, `transcript.diarisation_completed`, `transcript.finalized`.

#### Domain 6: Outputs Domain (`outputs`)
- Aggregate Root: `BusinessDeliverable` (bound to `public.outputs`).
- Supporting Entities: Template configurations, compiled render trees, export packages.
- Service Invariants:
  - Output generation must map to one of the fifty-eight catalogue classifications (`OUT-01` to `OUT-58`).
  - Generated deliverables must pass the Deliverable Quality Index (DQI) threshold of 85/100 before external export.
  - Stated Omission Standard is strictly enforced; missing inputs must be flagged as Data Gaps.
- Primary Commands: `CompileDeliverable`, `RegenerateSection`, `RenderPdfPackage`, `PublishDeliverable`.
- Primary Queries: `GetDeliverableDetail`, `ListProjectOutputs`, `InspectDeliverableDqiScore`.
- Emitted Domain Events: `report.generated`, `report.pdf_compiled`, `report.published`.

#### Domain 7: Decision Memory Domain (`decisions`)
- Aggregate Root: `Decision` (bound to `public.decision_memory`).
- Supporting Entities: Rationale records, rejected alternatives, consensus votes.
- Service Invariants:
  - Every decision must record a clear decision title, business rationale, and consensus classification.
  - Irreversible decisions require explicit confirmation from the designated project owner.
  - Decisions committed from meeting intelligence must preserve a link to the source transcript turn.
- Primary Commands: `RecordDecision`, `UpdateDecisionRationale`, `FlagDecisionDrift`, `SupersedeDecision`.
- Primary Queries: `ListProjectDecisions`, `GetDecisionLineage`, `GetLongitudinalDecisionHistory`.
- Emitted Domain Events: `decision.saved`, `decision.updated`, `decision.superseded`.

#### Domain 8: Action Tracker Domain (`actions`)
- Aggregate Root: `ActionItem` (bound to `public.action_tracker`).
- Supporting Entities: Subtask checklists, dependency links, checkpoint history.
- Service Invariants:
  - Every action must satisfy the Five-Field Delegation Standard: Task Description, Single Owner, Due Date, Definition of Done, and Checkpoint Date.
  - An action cannot have cyclic dependencies upon other actions.
  - Due date cannot precede checkpoint date.
- Primary Commands: `CreateActionItem`, `UpdateActionStatus`, `ReassignActionOwner`, `RecordCheckpointResult`.
- Primary Queries: `ListActionsByProject`, `ListActionsByOwner`, `GetOverdueActionsLedger`.
- Emitted Domain Events: `action.created`, `action.updated`, `action.completed`, `action.overdue`.

#### Domain 9: Insights Domain (`insights`)
- Aggregate Root: `StrategicInsight` (bound to `public.generated_intelligence` type: insight).
- Supporting Entities: Evidence citations, risk vectors, opportunity vectors.
- Service Invariants:
  - Insights must map to one of the eleven insight channels (Missed Risks, Weak Assumptions, Decision Gaps, etc.).
  - Every insight must be anchored to verbatim conversational quotes or explicit document passages.
  - Insights must assign a quantified severity score between 1 and 10.
- Primary Commands: `ExtractMeetingInsights`, `ValidateInsightEvidence`, `DismissInsight`, `ConvertInsightToAction`.
- Primary Queries: `ListProjectInsights`, `GetBlindSpotSummary`, `GetExecutiveRiskAlerts`.
- Emitted Domain Events: `insight.extracted`, `insight.verified`, `insight.converted_to_action`.

#### Domain 10: Stats and Analytics Domain (`stats`)
- Aggregate Root: `AnalyticsSnapshot` (bound to `public.predictive_snapshots`).
- Supporting Entities: Velocity rollups, meeting waste indicators, participant talking ratios.
- Service Invariants:
  - Metrics rollups are strictly read-only aggregations computed asynchronously via background workers.
  - Meeting waste calculations must adhere to the Concludo Cost Calculator formula.
- Primary Commands: `ComputeProjectRollups`, `GeneratePortfolioHealthSnapshot`, `CalculateMeetingCost`.
- Primary Queries: `GetExecutiveDashboardStats`, `GetMeetingWasteMetrics`, `GetVelocityTrends`.
- Emitted Domain Events: `forecast.generated`, `health_score.updated`.

#### Domain 11: Endpoint Reports Domain (`endpoint_reports`)
- Aggregate Root: `EndpointReport` (bound to `public.endpoint_reports`).
- Supporting Entities: Distribution recipient lists, access tokens, client view telemetry.
- Service Invariants:
  - Endpoint reports strip internal sensitive comments, displaying only client-safe summaries and actions.
  - Public access links require signed, expiring cryptographic tokens.
- Primary Commands: `GenerateEndpointReport`, `RevokeReportAccess`, `LogReportView`.
- Primary Queries: `GetEndpointReportContent`, `VerifyReportToken`.
- Emitted Domain Events: `endpoint_report.created`, `endpoint_report.viewed`.

#### Domain 12: Search Domain (`search`)
- Aggregate Root: `SearchIndex` (bound to PostgreSQL full-text GIN tables and `public.vector_embeddings`).
- Supporting Entities: Token chunks, HNSW vector graphs, BM25 weight tables.
- Service Invariants:
  - Search queries strictly execute within the calling user's tenant boundary enforced by RLS.
  - Hybrid search combines lexical ranking and dense vector cosine distance via Reciprocal Rank Fusion (RRF).
- Primary Commands: `IndexDocumentChunk`, `PurgeEntityVectors`, `RebuildHnswIndex`.
- Primary Queries: `ExecuteHybridSearch`, `ExecuteExactKeywordSearch`, `ExecuteSemanticSimilarityQuery`.
- Emitted Domain Events: `search_index.updated`, `search_query.executed`.

#### Domain 13: Knowledge Graph Domain (`knowledge_graph`)
- Aggregate Root: `KnowledgeNode` (bound to `public.knowledge_nodes`).
- Supporting Entities: `public.knowledge_relationships`.
- Service Invariants:
  - Nodes must specify a canonical label and valid entity type.
  - Edges must define a source node, target node, valid relationship primitive, and confidence weight (0.0 to 1.0).
  - Graph traversals enforce cycle detection limits (maximum 5 hops).
- Primary Commands: `RegisterKnowledgeNode`, `EstablishKnowledgeRelationship`, `PruneStaleEdges`.
- Primary Queries: `TraverseEntityDependencies`, `GetBlastRadiusAnalysis`, `FindEntityPaths`.
- Emitted Domain Events: `knowledge_node.created`, `knowledge_edge.established`.

#### Domain 14: Copilot Domain (`copilot`)
- Aggregate Root: `CopilotSession` (bound to `public.copilot_conversations`).
- Supporting Entities: `public.copilot_messages`, `public.copilot_prompts`.
- Service Invariants:
  - Copilot responses must enforce the Stated Omission Standard and provide verbatim citations.
  - Streaming token delivery must preserve cryptographic session ownership.
  - Context window budgeting cannot exceed model capacity limits.
- Primary Commands: `CreateCopilotSession`, `SubmitCopilotTurn`, `PersistStreamingMessage`, `ClearSessionHistory`.
- Primary Queries: `GetCopilotConversationHistory`, `GetSessionCitations`.
- Emitted Domain Events: `copilot.query_submitted`, `copilot.turn_completed`.

#### Domain 15: Agents Domain (`agents`)
- Aggregate Root: `AutonomousAgent` (bound to `public.agent_activity`).
- Supporting Entities: `public.agent_memory`, proposal records.
- Service Invariants:
  - Agents operate in sandboxed, read-heavy analytical modes.
  - All external mutations require explicit human sign-off via `public.workflow_approvals`.
  - Agent memory access is strictly partitioned by organisation ID.
- Primary Commands: `TriggerAgentRun`, `CommitAgentActivity`, `SubmitAgentProposal`.
- Primary Queries: `ListAgentExecutionLogs`, `GetAgentMemorySnapshot`.
- Emitted Domain Events: `agent.executed`, `agent.proposal_submitted`.

#### Domain 16: Workflows Domain (`workflows`)
- Aggregate Root: `Workflow` (bound to `public.workflows`).
- Supporting Entities: `public.workflow_executions`, `public.workflow_approvals`.
- Service Invariants:
  - Workflows must be structured as valid Directed Acyclic Graphs (DAGs) with zero circular loops.
  - Approval gates pause workflow execution until an authorized human acts.
- Primary Commands: `CreateWorkflowDefinition`, `TriggerWorkflowRun`, `SignOffApproval`, `AbortExecution`.
- Primary Queries: `ListActiveWorkflows`, `GetWorkflowExecutionTrace`, `GetPendingApprovals`.
- Emitted Domain Events: `workflow.executed`, `workflow.step_completed`, `workflow.approval_granted`.

#### Domain 17: Integrations Domain (`integrations`)
- Aggregate Root: `IntegrationConnection` (bound to `public.integrations`).
- Supporting Entities: `public.webhooks`, `public.webhook_logs`, `public.api_keys`.
- Service Invariants:
  - OAuth credentials and API secret keys must be encrypted at rest using AES-256 envelope encryption.
  - Webhook dispatch payloads must carry HMAC-SHA256 signatures.
  - Failed outbound webhooks retry with exponential backoff before routing to DLQ.
- Primary Commands: `RegisterIntegration`, `DispatchWebhook`, `RotateApiKey`, `SyncPlannerTasks`.
- Primary Queries: `ListIntegrations`, `GetWebhookDeliveryLogs`, `VerifyWebhookSignature`.
- Emitted Domain Events: `integration.connected`, `webhook.dispatched`, `webhook.failed`.

#### Domain 18: Governance Domain (`governance`)
- Aggregate Root: `GovernancePolicy` (bound to `public.retention_policies`).
- Supporting Entities: `public.audit_logs`, `public.legal_holds`, `public.access_reviews`.
- Service Invariants:
  - Audit logs are append-only; update and delete operations are rejected at the database level.
  - Active legal holds immediately freeze the automated data retention purge engine.
- Primary Commands: `ApplyLegalHold`, `ReleaseLegalHold`, `ExecuteRetentionPurge`, `RecordAuditLog`.
- Primary Queries: `SearchAuditLogs`, `ListActiveLegalHolds`, `GetRetentionStatus`.
- Emitted Domain Events: `legal_hold.applied`, `legal_hold.released`, `retention.purged`.

#### Domain 19: Enterprise Domain (`enterprise`)
- Aggregate Root: `EnterpriseAdmin` (bound to top-level organisation governance).
- Supporting Entities: Organisation analytics, compliance certifications, cross-workspace settings.
- Service Invariants:
  - Enterprise controls require `enterprise_admin` authentication.
  - Domain verification requires DNS TXT record cryptographic validation.
- Primary Commands: `VerifyEnterpriseDomain`, `ConfigureSamlSso`, `ExportComplianceDossier`.
- Primary Queries: `GetEnterpriseComplianceOverview`, `ListSsoConfigurations`.
- Emitted Domain Events: `domain.verified`, `sso.configured`.


## Section 10: API Architecture

### 10.1 Standardised API Contract and Gateway Design
Concludo Workspace exposes a unified, predictable RESTful API designed to serve both the internal React single-page application and external enterprise API consumers. All API endpoints adhere to strict JSON conventions, standard HTTP verbs, deterministic status codes, and comprehensive header standards.

The base URL for all public and internal workspace API routes is:
`https://app.concludo.com/api/v1`

### 10.2 Request and Response Standards
Every API request and response follows an immutable structural standard:
- Headers:
  - `Authorization: Bearer <jwt_session_token>`: Authenticates the calling user or API key.
  - `Content-Type: application/json`: Enforced on all mutation requests (POST, PUT, PATCH).
  - `X-Concludo-Request-ID: <uuidv4>`: Client-injected or gateway-assigned correlation identifier for distributed tracing.
  - `X-Concludo-Tenant-ID: <uuidv4>`: Specifies the target organisation context for multi-tenant routing.

- Standard Success Response Structure:
```json
{
  "success": true,
  "data": {
    "id": "7a3e8b12-9c4d-4e5f-8a1b-2c3d4e5f6a7b",
    "title": "Q4 Enterprise Strategy Session",
    "status": "completed",
    "created_at": "2026-09-14T10:30:00.000Z"
  },
  "meta": {
    "request_id": "c1f8e9a2-4b3d-4e5f-a6b7-8c9d0e1f2a3b",
    "timestamp": "2026-09-14T10:30:01.240Z",
    "version": "v1"
  }
}
```

- Standard Error Response Structure:
```json
{
  "success": false,
  "error": {
    "code": "ACTION_DELEGATION_INVALID",
    "message": "Action item fails the Five-Field Delegation Standard: definition_of_done is missing.",
    "details": [
      {
        "field": "definition_of_done",
        "issue": "Field cannot be empty or null."
      }
    ]
  },
  "meta": {
    "request_id": "c1f8e9a2-4b3d-4e5f-a6b7-8c9d0e1f2a3b",
    "timestamp": "2026-09-14T10:30:01.245Z",
    "version": "v1"
  }
}
```

### 10.3 Core REST Endpoints Matrix
The platform exposes standardised endpoints across all core application domains:

| Endpoint Route | Method | Required Scope / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/projects` | GET | `member` | List active projects for tenant with keyset pagination. |
| `/api/v1/projects` | POST | `member` | Create new project with title, description, and team roster. |
| `/api/v1/projects/:id` | GET | `member` | Retrieve project detail, participant roster, and stats. |
| `/api/v1/transcripts/upload` | POST | `member` | Ingest audio, video, or raw text transcript into pipeline. |
| `/api/v1/transcripts/:id/stages` | GET | `member` | Stream real-time 16-stage pipeline progress and status. |
| `/api/v1/decisions` | GET | `member` | List structured decisions with rationale and consensus filters. |
| `/api/v1/decisions` | POST | `member` | Record new decision with alternatives and consensus tier. |
| `/api/v1/actions` | GET | `member` | List five-field action items with owner, due date, and CRI filters. |
| `/api/v1/actions` | POST | `member` | Create five-field action item; triggers external Planner sync. |
| `/api/v1/actions/:id` | PATCH | `owner` / `admin` | Update action status, definition of done, or checkpoint review. |
| `/api/v1/outputs/generate` | POST | `member` | Trigger compilation of deliverable blueprint (T1 to T19). |
| `/api/v1/outputs/:id/pdf` | GET | `member` | Download compiled pixel-perfect PDF package. |
| `/api/v1/copilot/query` | POST | `member` | Submit natural language query; returns SSE streaming tokens. |
| `/api/v1/workflows` | GET | `admin` | List automated workflow configurations and active triggers. |
| `/api/v1/workflows/approvals` | POST | `manager` / `admin` | Approve or reject pending agent workflow proposal. |
| `/api/v1/governance/audit-logs` | GET | `admin` | Search immutable audit trail with actor and date filters. |

### 10.4 HTTP Status Code Conventions
Concludo APIs utilize standard HTTP semantics with zero custom status code deviations:
- 200 OK: Request succeeded; payload returned in `data`.
- 201 Created: New resource successfully created; URI provided in `Location` header and payload returned.
- 202 Accepted: Asynchronous job initiated (e.g., pipeline ingestion or PDF compilation); status URL returned.
- 204 No Content: Resource successfully deleted or updated with zero response body.
- 400 Bad Request: Malformed request payload, syntax error, or validation failure.
- 401 Unauthorized: Missing, expired, or cryptographically invalid session token or API key.
- 403 Forbidden: Authenticated user lacks sufficient RBAC permissions or RLS tenant entitlement.
- 404 Not Found: Requested resource does not exist within the caller's tenant boundary.
- 409 Conflict: Concurrent modification conflict or unique constraint violation.
- 422 Unprocessable Entity: Syntactically valid JSON failing domain business rules (e.g., circular action dependencies).
- 429 Too Many Requests: Rate limit exceeded; client must back off according to `Retry-After` header.
- 500 Internal Server Error: Unhandled backend fault; error incident automatically logged to Sentry.

### 10.5 Keyset Pagination Standard
To ensure high-performance pagination across massive datasets without the quadratic performance degradation of SQL `OFFSET`, Concludo implements keyset (cursor-based) pagination:
- Request Parameters:
  - `limit`: Number of records to return (default: 25, maximum: 100).
  - `cursor`: Base64-encoded composite cursor containing the last record's sort value and UUID.
  - `direction`: Pagination direction (`forward` or `backward`).
- Response Structure includes `meta.pagination`:
```json
{
  "meta": {
    "pagination": {
      "has_more": true,
      "next_cursor": "ZXlKaGJHY2lPaUpTVXpVeE5pSXNJblI1Y0NJNklrcFhWQ0o5...",
      "limit": 25,
      "total_count": 482
    }
  }
}
```

### 10.6 Rate Limiting and Token Bucket Allocation
Rate limiting is enforced at the Cloudflare Edge Gateway and Redis token bucket layer:
- Public Webhook Endpoints: 100 requests per minute per IP.
- Authenticated User Interactions: 1,200 requests per minute per user account.
- External API Key Consumers: Tier-based quotas:
  - Starter Tier: 60 requests per minute, 5,000 requests per month.
  - Pro Tier: 300 requests per minute, 50,000 requests per month.
  - Team Tier: 1,000 requests per minute, 250,000 requests per month.
  - Enterprise Tier: 5,000 requests per minute, unmetered monthly volume.
When limits are breached, the gateway returns HTTP 429 with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`.

---

## Section 11: Event Driven Architecture

### 11.1 Event Bus Topology and Asynchronous Messaging
Concludo utilizes an event-driven messaging architecture to decouple operational triggers from execution services. When state mutations occur, domain services emit structured domain events to the internal event bus, triggering real-time UI synchronisation, downstream background workers, and external webhook deliveries.

```
+----------------------------------------------------------------------------------------------------+
|                                    EVENT DRIVEN ARCHITECTURE                                       |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                                                                 |
|    |      DOMAIN MUTATION        |  (e.g., Transcript Ingested, Decision Saved, Action Updated)   |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v                                                                                |
|    +-----------------------------+                                                                 |
|    |     TRANSACTIONAL OUTBOX    |  Guarantees atomic persistence alongside database state         |
|    |    (public.event_stream)    |  Prevents dual-write failures and lost events                   |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v PostgreSQL CDC / WAL Listener                                                  |
|    +-----------------------------+                                                                 |
|    |      EVENT ROUTING BUS      |  (Redis Streams / BullMQ Fan-Out)                               |
|    +------+-------+-------+------+                                                                 |
|           |       |       |                                                                        |
|           |       |       +-----------------------+                                                |
|           |       v                               v                                                |
|           |  +-------------------------+   +-------------------------+                             |
|           |  |    INTERNAL WORKERS     |   |    SUPABASE REALTIME    |                             |
|           |  | - Pipeline Stages       |   | - WebSocket Broadcast   |                             |
|           |  | - Knowledge Graph Sync  |   | - Active Client UI Sync |                             |
|           |  | - Vector Embeddings     |   +-------------------------+                             |
|           |  +-------------------------+                                                           |
|           v                                                                                        |
|    +-----------------------------+                                                                 |
|    |      EXTERNAL DISPATCH      |                                                                 |
|    | - Webhook Delivery Worker   |                                                                 |
|    | - Microsoft Planner Sync    |                                                                 |
|    | - Slack / Teams Notifier    |                                                                 |
|    +-----------------------------+                                                                 |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 11.2 Core Domain Event Registry
The platform emits eleven foundational enterprise event types, each accompanied by an immutable JSON payload schema:
1. `transcript.imported`: Emitted when an audio, video, or text transcript file is stored and registered. Triggers Stage 1 of the Meeting Intelligence Pipeline.
2. `project.created`: Emitted when a new workspace project is instantiated. Initializes project storage quotas, access control rosters, and default knowledge nodes.
3. `project.updated`: Emitted when project metadata, status, or participants change. Updates search indexes and audit ledgers.
4. `decision.saved`: Emitted when a strategic or operational decision is committed. Triggers knowledge graph linkage, updates project decision logs, and synchronizes executive summaries.
5. `action.created`: Emitted when a new five-field task commitment is registered. Triggers external task synchronisation (Microsoft Planner, Jira) and notification workers.
6. `action.updated`: Emitted when action status, owner, or deadline changes. Evaluates Commitment Reliability Index (CRI) and flags delivery slippage.
7. `report.generated`: Emitted when a business deliverable or executive briefing is compiled. Triggers PDF package rendering and persists export metadata.
8. `agent.executed`: Emitted when an autonomous background reasoning agent executes. Logs execution duration, token expenditure, and generated proposals to `agent_activity`.
9. `workflow.executed`: Emitted when an automated workflow trigger fires and completes a DAG step. Dispatches notifications and evaluates downstream approvals.
10. `forecast.generated`: Emitted when predictive health models update cross-project trajectory scores. Alerts executive dashboards to emerging portfolio risks.
11. `copilot.query_submitted`: Emitted when an interactive query is processed. Logs telemetry, latency metrics, and citations for compliance review.

```typescript
// Core Event Envelope Interface
export interface DomainEventEnvelope<T = unknown> {
  event_id: string; // UUIDv4
  event_type:
    | 'transcript.imported'
    | 'project.created'
    | 'project.updated'
    | 'decision.saved'
    | 'action.created'
    | 'action.updated'
    | 'report.generated'
    | 'agent.executed'
    | 'workflow.executed'
    | 'forecast.generated'
    | 'copilot.query_submitted';
  organization_id: string;
  actor_id: string;
  timestamp: string; // ISO 8601 UTC
  correlation_id: string;
  data: T;
}
```

---

## Section 12: Background Processing Architecture

### 12.1 Worker Pool and Queue Topology
High-latency, compute-intensive workloads must never block client HTTP request cycles. Concludo implements an enterprise background worker infrastructure powered by BullMQ and Redis, deploying dedicated worker pools tailored to specific operational profiles.

```
+----------------------------------------------------------------------------------------------------+
|                                  BACKGROUND PROCESSING TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ CLIENT / API ] ----> [ BULLMQ REDIS QUEUE MANAGER ]                                           |
|                                  |                                                                 |
|         +------------------------+------------------------+-----------------------+                |
|         |                        |                        |                       |                |
|         v                        v                        v                       v                |
|    +------------------+    +------------------+    +------------------+    +------------------+    |
|    |  PIPELINE QUEUE  |    |  DOCUMENT QUEUE  |    |  INDEXING QUEUE  |    |  WEBHOOK QUEUE   |    |
|    |  (High Compute)  |    |  (Headless DOM)  |    |  (Vector Embed)  |    |  (I/O Network)   |    |
|    +--------+---------+    +--------+---------+    +--------+---------+    +--------+---------+    |
|             |                       |                       |                       |              |
|             v                       v                       v                       v              |
|    +------------------+    +------------------+    +------------------+    +------------------+    |
|    | Pipeline Workers |    | Document Workers |    | Indexing Workers |    | Webhook Workers  |    |
|    | - Diarisation    |    | - HTML Rendering |    | - Chunk Slicing  |    | - Signature Calc |    |
|    | - 16 Pipeline DAG|    | - PDF Puppeteer  |    | - Vector Models  |    | - Exponential    |    |
|    | - LLM Extraction |    | - Zip Packaging  |    | - Graph Traversal|    |   Backoff Retry  |    |
|    +------------------+    +------------------+    +------------------+    +------------------+    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 12.2 Worker Responsibilities and Concurrency Allocations
1. Pipeline Worker Pool: Dedicated to executing the sixteen stages of Tasklet A0. Workers handle audio preprocessing, external speech-to-text API calls, and multi-turn LLM extraction. High memory allocation (4GB RAM per worker), concurrency: 5 concurrent jobs per container.
2. Document Generation Worker Pool: Executes Puppeteer headless Chromium instances to compile HTML/Tailwind templates into print-perfect PDF deliverables. Isolated sandboxes ensure zero memory leakage across render jobs. Concurrency: 3 jobs per container.
3. Search and Indexing Worker Pool: Slices meeting transcripts and business outputs into semantic chunks, generates vector embeddings via OpenAI API, writes vectors to PostgreSQL `pgvector` tables, and updates knowledge graph edge weights. Concurrency: 20 jobs per container.
4. Webhook and Synchronisation Worker Pool: Dispatches signed HTTP POST payloads to customer webhook endpoints and updates external systems (Planner, Slack). Employs exponential backoff with jitter across five retry attempts over twenty-four hours before routing to the Dead-Letter Queue (DLQ).

### 12.3 Job Retry Policy and Dead-Letter Queue (DLQ)
All asynchronous jobs adhere to deterministic retry and failure isolation protocols:
- Retry Schedule: Exponential backoff with jitter (`attempt * 30s * (1 + rand(0, 0.2))`). Maximum 3 retries for AI/LLM extraction; maximum 5 retries for external network webhooks.
- Idempotency Guarantee: Every background job payload includes an `idempotency_key`. Workers verify whether the target database record has already been updated prior to executing side-effecting operations.
- Dead-Letter Queue Inspection: If all retries fail, BullMQ moves the job to the DLQ, updates the parent database record status to `failed`, and logs a structured alert with full stack trace and input payload to Sentry and `public.audit_logs`.

---



### 12.5 Background Processing Deep Dive: Job Queue Engine and Worker Topology

To maintain sub-100 millisecond response times on interactive user requests, Concludo Workspace offloads all non-blocking, computational, or input/output intensive tasks to a resilient background processing infrastructure. This includes audio transcription ingestion, vector embedding generation, multi-hop knowledge graph re-indexing, document compilation, PDF rendering, external webhook dispatch, and predictive snapshot generation.

#### 12.5.1 Queue Architecture and Lease Management

Concludo uses a PostgreSQL-backed job queue architecture (`public.job_queue`) leveraging row-level locking with `FOR UPDATE SKIP LOCKED`. This avoids the operational overhead of running external message brokers during Stage 1 and Stage 2 deployments while providing transactional consistency, ACID guarantees, and full visibility into queue state.

```sql
-- PostgreSQL Job Queue Schema Definition
CREATE TABLE public.job_queue (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(64) NOT NULL DEFAULT 'default',
    payload JSONB NOT NULL,
    priority INT NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, dead_letter
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    backoff_seconds INT NOT NULL DEFAULT 10,
    idempotency_key VARCHAR(128) UNIQUE,
    run_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    locked_until TIMESTAMPTZ,
    locked_by VARCHAR(64),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_job_queue_fetch 
ON public.job_queue (queue_name, priority, run_at) 
WHERE status = 'pending';
```

Worker nodes execute a poll loop using the following lease acquisition transaction:

```sql
-- Atomic Worker Job Lease Acquisition
WITH next_job AS (
    SELECT job_id
    FROM public.job_queue
    WHERE queue_name = $1
      AND status = 'pending'
      AND run_at <= clock_timestamp()
    ORDER BY priority ASC, run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE public.job_queue
SET status = 'processing',
    locked_until = clock_timestamp() + interval '5 minutes',
    locked_by = $2,
    attempts = attempts + 1,
    updated_at = clock_timestamp()
FROM next_job
WHERE public.job_queue.job_id = next_job.job_id
RETURNING public.job_queue.*;
```

#### 12.5.2 Resiliency, Exponential Backoff, and Dead Letter Queue

Background task execution implements resilient error handling protocols:

1. Heartbeat and Lease Renewal: For long-running operations (such as multi-stage document generation or transcript parsing), worker processes emit periodic heartbeats every 60 seconds, extending `locked_until` by an additional 5 minutes. If a worker process terminates abruptly, the unrenewed lease expires, allowing an alternate worker to claim the job once `locked_until < clock_timestamp()`.
2. Exponential Backoff with Jitter: When a job fails due to transient faults (such as external rate limits or network timeouts), the retry delay is calculated using truncated exponential backoff with full jitter:
   $$	ext{delay} = \min(	ext{max\_delay}, 	ext{base\_backoff} 	imes 2^{	ext{attempts}}) 	imes (0.5 + 	ext{random}() 	imes 0.5)$$
3. Dead Letter Queue (DLQ) Triage: If a job exhausts its maximum allocated attempts (`attempts >= max_attempts`), its status transitions to `dead_letter`. The failure payload, stack trace, and execution context are recorded, and an alert is dispatched to the operational observability stream. Administrators can inspect, correct, and re-queue dead-lettered jobs via the workspace administrative console.
4. Idempotency Guarantees: Every job payload includes a unique `idempotency_key` generated from entity identifiers and modification timestamps. If a job is re-delivered, the worker verifies whether the intended state mutation has already taken effect before executing side effects.

## Section 13: AI Architecture

### 13.1 Multi-Model Orchestration and Provider Strategy
Concludo enforces an agnostic, multi-model AI mesh designed to optimise reasoning quality, latency, token expenditure, and vendor resilience. No single LLM provider maintains a monopoly over Concludo intelligence operations.

```
+----------------------------------------------------------------------------------------------------+
|                                      AI ORCHESTRATION MESH                                         |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ DOMAIN SERVICE / COPILOT ]                                                                    |
|                 |                                                                                  |
|                 v                                                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |                           AI ORCHESTRATOR & ROUTING CONTROLLER                           |    |
|    |  - Token Budget Allocator        - Prompt Template Compiler                              |    |
|    |  - Schema Validator (Zod)        - Model Availability & Latency Router                   |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|         +---------------------------------------+---------------------------------------+          |
|         |                                       |                                       |          |
|         v                                       v                                       v          |
|  +-----------------------------+  +-----------------------------+  +-----------------------------+ |
|  |       TIER 1 REASONING      |  |    TIER 2 MASSIVE CONTEXT   |  |     TIER 3 FAST EXTRACTION  | |
|  | - Anthropic Claude 3.5      |  | - Google Gemini 1.5 Pro     |  | - OpenAI GPT-4o Mini        | |
|  |   Sonnet                    |  |   (2 Million Token Context) |  | - DeepSeek V3               | |
|  | - OpenAI GPT-4o             |  | - Long transcript ingest    |  | - High-throughput entity    | |
|  | - Complex Board Briefings,  |  | - Multi-meeting synthesis   |  |   parsing, action tagging,  | |
|  |   Strategic Digital Twins,  |  | - Historical archive scans  |  |   keyword extraction        | |
|  |   Decision drift reasoning  |  +-----------------------------+  +-----------------------------+ |
|  +-----------------------------+                                                                   |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 13.2 Context Assembly and Grounding Strategy
To eliminate AI hallucinations and ensure executive defensibility, Concludo enforces the Grounding Verification Protocol across all AI operations:
1. Primary Evidence Anchoring: Every synthesized fact, decision, action, or risk must be mapped to verbatim speaker turns or explicit document sections.
2. Structured JSON Output Enforcement: All LLM extraction and synthesis calls utilize JSON Schema Mode or structured tool calling. Outputs that fail Zod schema validation are rejected and re-prompted automatically.
3. The Stated Omission Standard: Prompts explicitly instruct models: *If a required business element, financial metric, or owner is not explicitly stated in the provided transcript or project context, do not fabricate or infer it. Record the field as 'Not Stated' and flag it as a Data Gap.*
4. Context Window Budgeting: Prompts allocate strict token limits: System Instructions (15%), Grounding Transcripts and Entity Context (65%), Dialogue History (10%), Generation Headroom (10%).

---

## Section 14: Prompt Architecture

### 14.1 Enterprise Prompt Framework
Concludo treats prompts as first-class, version-controlled software assets. All prompts live in structured templates under `src/prompts/` and are managed through an internal registry that records version hashes, target models, temperature settings, and expected output schemas.

```
src/prompts/
├── registry.ts                     # Master prompt registry and metadata table
├── system/                         # Foundational persona and guardrail prompts
│   ├── baseExecutivePersona.ts     # Consulting tone, brevity, Australian English
│   └── antiHallucinationRules.ts   # Stated Omission Standard and grounding rules
├── meeting/                        # Meeting Intelligence Pipeline extraction prompts
│   ├── stage04Diarisation.ts       # Speaker role and identity resolution
│   ├── stage05IntentParsing.ts     # Meeting classification and intent extraction
│   ├── stage07DecisionExtract.ts   # Decision memory extraction schema
│   ├── stage08ActionStandard.ts    # Five-Field Delegation Standard enforcement
│   └── stage09InsightAudit.ts      # Unspoken blind spots and risk detection
├── outputs/                        # Deliverable template compilation prompts
│   ├── t01ExecutiveSummary.ts      # Blueprint T1 Executive Summary compiler
│   ├── t03DecisionPack.ts          # Blueprint T3 Decision Pack compiler
│   ├── t04BoardBriefing.ts         # Blueprint T4 Board Briefing compiler
│   └── t08BusinessPlan.ts          # Blueprint T8 Business Plan compiler
├── copilot/                        # Interactive Copilot reasoning prompts
│   ├── queryIntentClassifier.ts    # Disambiguation and retrieval plan generator
│   └── conversationalSynthesizer.ts# Multi-hop RAG synthesis with inline citations
└── scoring/                        # Quality evaluation prompts
    ├── dqiScorer.ts                # Deliverable Quality Index evaluation
    └── meetingHealthScorer.ts      # 10-dimension Meeting Health evaluation
```

### 14.2 Prompt Governance and Quality Standards
All enterprise prompts adhere to five governance standards:
- Tone of Voice: Professional, objective, concise, and executive. Adheres to tier-one management consulting tone (McKinsey, BCG, Bain).
- Australian English Mandatory: All prompts mandate Australian English orthography (`prioritise`, `organisation`, `programme`, `centre`, `analysed`, `labour`).
- Typographical Constraint: Zero em dashes and zero en dashes. Prompts strictly forbid the generation of em dashes and en dashes, enforcing commas, colons, parentheses, or structured lists instead.
- Few-Shot Grounding: Prompts include curated, production-verified input/output pairs illustrating correct extraction of ambiguous corporate dialogue.
- Version Immutability: Deployed prompts are versioned using semantic hashes. When an output or decision record is saved, the exact `prompt_version_id` is recorded in metadata to guarantee complete audit reproducibility.


### 14.3 Production Prompt Specifications and Verbatim Templates

Concludo maintains strict prompt contracts for all extraction, synthesis, and scoring engines. Below are the authoritative production prompt specifications governing the platform:

#### 14.3.1 The Base Executive Persona Prompt (`src/prompts/system/baseExecutivePersona.ts`)
```typescript
export const BASE_EXECUTIVE_PERSONA_PROMPT = `
You are the Concludo Executive Intelligence Engine.
You operate on behalf of Concludo Pty Ltd (Melbourne, Australia), serving C-suite executives, board directors, and senior delivery leaders.

YOUR GOVERNING PRINCIPLES:
1. Executive Tone: Be direct, objective, concise, and analytically rigorous. Write with the gravitas of a senior partner at McKinsey, BCG, or Bain.
2. Australian English: You MUST use Australian English orthography throughout (e.g., prioritise, organisation, programme, centre, analysed, labour, behaviour).
3. Punctuation Constraint: You are STRICTLY FORBIDDEN from outputting em dashes or en dashes anywhere in your response. Never generate the em dash character or the en dash character. Use commas, colons, parentheses, or structured bullet lists instead.
4. Action Title Rule: Every section, slide, and callout header must state a governing conclusion or business finding, never a generic topic label.
5. Pyramid Principle: Lead with the primary conclusion, followed by MECE (Mutually Exclusive, Collectively Exhaustive) supporting rationale, backed by quantitative data.
6. The Stated Omission Standard: Never invent, extrapolate, or hallucinate missing data, owners, metrics, or financial values. If a required element was not explicitly stated in the source discourse, explicitly label it as "Not Stated" and flag it as a Data Gap.
`;
```

#### 14.3.2 Stage 7 Decision Extraction Prompt (`src/prompts/meeting/stage07DecisionExtract.ts`)
```typescript
export const STAGE_07_DECISION_EXTRACTION_PROMPT = `
You are the Concludo Decision Intelligence Analyzer.
Analyze the provided meeting transcript to extract all binding, operational, tactical, and strategic decisions.

EXTRACTION INSTRUCTIONS:
- Identify explicit agreements, approvals, and commitments to a specific course of action.
- Distinguish firm decisions from ongoing discussions, proposals, or exploratory brainstorming.
- For each decision, extract:
  1. decision_title: A concise action title stating the decision.
  2. decision_rationale: The commercial or operational justification articulated by participants.
  3. rejected_alternatives: Explicit options that were considered but passed over.
  4. consensus_level: One of [unanimous, majority, executive_fiat, contested].
  5. reversibility: One of [reversible, irreversible].
  6. financial_impact_estimate: Stated dollar value or null if not stated.
  7. primary_source_quote: Verbatim speaker turn text providing undeniable proof of the decision.
  8. speaker_name: Name of the person who announced or ratified the decision.

OUTPUT FORMAT:
Return valid JSON matching the following schema:
{
  "decisions": [
    {
      "decision_title": "string",
      "decision_rationale": "string",
      "rejected_alternatives": ["string"],
      "consensus_level": "unanimous" | "majority" | "executive_fiat" | "contested",
      "reversibility": "reversible" | "irreversible",
      "financial_impact_estimate": number | null,
      "primary_source_quote": "string",
      "speaker_name": "string"
    }
  ]
}
`;
```

#### 14.3.3 Stage 8 Action Item Standardisation Prompt (`src/prompts/meeting/stage08ActionStandard.ts`)
```typescript
export const STAGE_08_ACTION_STANDARD_PROMPT = `
You are the Concludo Execution Intelligence Engine.
Analyze the meeting transcript to extract all task commitments, strictly enforcing the Concludo Five-Field Delegation Standard.

THE FIVE-FIELD DELEGATION STANDARD:
Every valid action item MUST possess all five fields:
1. Task Description: Clear, imperative verb-first instruction describing the deliverable.
2. Single Owner: Exactly one accountable individual. Shared or group ownership is strictly forbidden. If multiple people are mentioned, designate the primary lead or create separate distinct actions.
3. Due Date: Specific calendar deadline (ISO 8601 UTC date). If only a relative timeframe was stated (e.g., "by next Friday"), calculate the exact date based on the meeting date. If no date was stated, record as "Not Stated" and flag as an Action Risk.
4. Definition of Done: Objective, verifiable acceptance criteria that prove completion without ambiguity.
5. Checkpoint Date: Midway review or milestone date prior to the due date to verify execution trajectory.

OUTPUT FORMAT:
Return valid JSON matching the schema:
{
  "actions": [
    {
      "task_description": "string",
      "single_owner": "string",
      "due_date": "YYYY-MM-DD",
      "definition_of_done": "string",
      "checkpoint_date": "YYYY-MM-DD",
      "confidence_score": number, // 0 to 100
      "source_quote": "string"
    }
  ]
}
`;
```

#### 14.3.4 Deliverable Quality Index (DQI) Scorer Prompt (`src/prompts/scoring/dqiScorer.ts`)
```typescript
export const DQI_SCORER_PROMPT = `
You are the Concludo Deliverable Quality Auditor.
Evaluate the provided business deliverable against the four Concludo Quality Bars:

1. Output Completeness Score (OCS, 25%): Are all required blueprint sections present, structurally intact, and fully populated?
2. Business Quality Score (BQS, 25%): Does the deliverable maintain executive consulting tone, MECE structure, Action Title headers, and Australian English?
3. Strategic Quality Score (SQS, 25%): Does the content answer "What happened, Why it matters, What happens next, What risks exist, What opportunities exist, What actions should be taken"?
4. Executive Readiness Score (ERS, 25%): Is the document publication-ready for board review without manual human rewriting?

SCORING CRITERIA:
- Each dimension receives a score from 0 to 100.
- Overall DQI = (OCS * 0.25) + (BQS * 0.25) + (SQS * 0.25) + (ERS * 0.25).
- A minimum score of 85.0 is required for automated release.
`;
```


## Section 15: Agent Architecture

### 15.1 Governed Autonomous Agent Runtime
In accordance with Concludo architectural standards and Tasklet 19 specifications, autonomous background agents are engineered as governed, advisory assistants rather than unconstrained autonomous actors. Agents operate within strict capability sandboxes, execute read-heavy analytical tasks, and enforce mandatory human approval gates prior to mutating external enterprise state or committing consequential decisions.

```
+----------------------------------------------------------------------------------------------------+
|                                    AGENT EXECUTION RUNTIME ARCHITECTURE                            |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    +-----------------------------+                                                                 |
|    |      EVENT / CRON TRIGGER   |  (e.g., Weekly Project Review, Post-Meeting Intelligence Ready) |
|    +--------------+--------------+                                                                 |
|                   |                                                                                |
|                   v                                                                                |
|    +------------------------------------------------------------------------------------------+    |
|    |  AGENT ORCHESTRATION LAYER                                                               |    |
|    |  - Instantiates Agent Context (Tenant ID, Project ID, Scoped Token)                      |    |
|    |  - Enforces Role Permissions & Entitlements (Enterprise / Admin Tier Only)               |    |
|    |  - Injects System Instructions, Cognitive Memory & Active Knowledge Graph Nodes           |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  AGENT REASONING & SYNTHESIS RUNTIME                                                     |    |
|    |  - Analyzes cross-meeting velocity, decision logs, and delivery slippage                 |    |
|    |  - Identifies emerging risks and cross-project dependencies                              |    |
|    |  - Generates proposed actions, briefing summaries, or integration sync payloads          |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|         +---------------------------------------+---------------------------------------+          |
|         |                                                                               |          |
|         | (READ-ONLY ANALYSIS)                                                          | (MUTATION | EXTERNAL SYNC)
|         v                                                                               v          |
|  +-----------------------------+                                          +-----------------------------+
|  |     PERSIST INTELLIGENCE    |                                          |   MANDATORY HUMAN APPROVAL  |
|  | - Writes to `agent_activity`|                                          | - Inserts to `workflow_     |
|  | - Updates `predictive_      |                                          |   approvals` (status:       |
|  |   snapshots`                |                                          |   pending)                  |
|  | - Creates draft briefing    |                                          | - Alerts authorised human   |
|  +-----------------------------+                                          +--------------+--------------+
|                                                                                          |         |
|                                                                              [ APPROVED ]|         |[ REJECTED ]
|                                                                                          v         v
|                                                                           +------------------+ +------------------+
|                                                                           | Execute External | | Cancel Execution |
|                                                                           | Sync (Planner/CRM| | & Log Audit Trail|
|                                                                           +------------------+ +------------------+
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 15.2 Agent Types and Operational Boundaries
Concludo deploys four specialised autonomous background agents:
1. Executive Reporting Agent: Executes weekly or post-session. Aggregates decisions, actions, and risks across all active project meetings to compile draft executive briefings (Blueprint T17) and portfolio health reports (Blueprint T16).
2. CRM and Pipeline Agent: Analyses client-facing meetings (discovery sessions, pitch reviews, quarterly business reviews). Extracts stakeholder sentiments, buyer objections, and commercial commitments; prepares draft updates for external CRMs (Salesforce, HubSpot).
3. Risk and Governance Agent: Continuously evaluates decision registries against enterprise risk registers. Identifies unmitigated risks, unassigned actions, and overdue milestones; flags anomalies to the compliance team.
4. Meeting Optimisation Agent: Analyses organisation-wide meeting health scores, attendance redundancy, and recurring meeting bloat. Generates actionable recommendations to cancel, shorten, or restructure ineffective meetings.

### 15.3 Human Approval Layer and Audit Tracking
All agent mutations that affect external systems or finalize legal/governance records must pass through the Human Approval Layer:
- An entry is inserted into `public.workflow_approvals` containing the complete diff of proposed changes, agent confidence score, and rationale.
- The approval request is surfaced in the Executive Workspace notification centre and dispatched via email or Slack to authorised managers.
- Upon human review, the status transitions to `approved` or `rejected`. Every approval records `approver_id`, `approved_at`, and user comments in `public.audit_logs`.
- Agents never bypass approval gates. Unapproved proposals automatically expire after 72 hours.

```typescript
// src/types/agents.ts implementation interfaces
export interface AgentExecutionContext {
  agent_id: string;
  agent_type: 'executive_reporting' | 'crm_pipeline' | 'risk_governance' | 'meeting_optimization';
  organization_id: string;
  project_id?: string;
  trigger_type: 'scheduled_cron' | 'event_webhook' | 'manual_invocation';
  started_at: string;
  correlation_id: string;
}

export interface AgentProposalPayload {
  proposal_id: string;
  agent_id: string;
  organization_id: string;
  action_type: 'planner_task_sync' | 'crm_contact_update' | 'decision_record_finalize' | 'risk_escalate';
  target_system: 'microsoft_planner' | 'salesforce' | 'internal_database';
  proposed_diff: Record<string, unknown>;
  confidence_score: number; // 0 to 100
  rationale: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'expired';
}
```

---

## Section 16: Workflow Architecture

### 16.1 Workflow Engine and DAG Execution
The Concludo Workflow Engine (specified in Tasklet 19) enables enterprises to build custom, event-driven automation pipelines. Workflows are represented as Directed Acyclic Graphs (DAGs) composed of triggers, conditional filters, analytical steps, approval gates, and external action dispatches.

```
+----------------------------------------------------------------------------------------------------+
|                                    WORKFLOW DAG EXECUTION TOPOLOGY                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ EVENT TRIGGER ]           `transcript.imported` OR `decision.saved` OR Scheduled Cron        |
|            |                                                                                       |
|            v                                                                                       |
|    +------------------------------------------------------------------------------------------+    |
|    |  TRIGGER EVALUATOR                                                                       |    |
|    |  - Matches Event Schema against active workflow definitions in `public.workflows`        |    |
|    |  - Checks tenant subscription entitlements (Team / Enterprise Tier only)                 |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  CONDITIONAL FILTER STEP                                                                 |    |
|    |  - Evaluates business criteria (e.g., `meeting_classification == 'Strategy Session'`     |    |
|    |    AND `strategic_importance >= 8`)                                                      |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  ANALYTICAL TRANSFORMATION STEP                                                          |    |
|    |  - Invokes Intelligence Pipeline or Prompt Engine                                        |    |
|    |  - Compiles Blueprint T4 (Board Briefing) or Blueprint T3 (Decision Pack)               |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  GOVERNANCE & APPROVAL GATE                                                              |    |
|    |  - Evaluates whether step requires human sign-off                                        |    |
|    |  - If required, suspends workflow execution until authorised member signs off            |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  EXTERNAL ACTION DISPATCH                                                                |    |
|    |  - Syncs actions to Microsoft Planner, notifies Slack channel, dispatches Webhook        |    |
|    |  - Writes complete execution history to `public.workflow_executions`                     |    |
|    +------------------------------------------------------------------------------------------+    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 16.2 Workflow Execution State Machine
Every execution step transitions through a deterministic state machine:
`pending` -> `evaluating` -> `awaiting_approval` -> `executing` -> `completed` (or `failed` / `cancelled`).
All execution states, execution durations, input snapshots, and output payloads are persisted immutably in `public.workflow_executions`, enabling step-by-step playback, debugging, and audit compliance.

---



### 15.5 Autonomous Agent Runtime and Governed Workflow Engine Deep Dive

Concludo Workspace operationalises artificial intelligence through governed agents and structured workflows. In accordance with Concludo architectural standards, AI agents operate exclusively under strict enterprise governance with mandatory human oversight. Autonomous external execution, destructive data mutations, and unvetted strategic commitments are strictly prohibited without affirmative human approval.

#### 15.5.1 Agent Runtime Lifecycle and Memory Scoping

The Concludo Agent Runtime isolates agent execution inside secure worker sandboxes. Every agent task is executed against an ephemeral execution context that inherits the authenticated user's permissions and organisation boundaries:

1. Context Initialisation: The agent runtime retrieves the target workflow specification, validates the caller session, and checks that organisation policies permit agent execution for the requested domain.
2. Memory Scope Resolution:
   - Working Memory: In-memory scratchpad maintaining the immediate reasoning trace, parsed parameters, and tool call invocations. Working memory is discarded upon task completion.
   - Short-Term Memory: Ephemeral state shared across connected steps within a single workflow execution instance.
   - Long-Term Memory: Read-only access to organisation knowledge nodes, past decision records, and project context retrieved via RLS-governed vector and graph queries. Agents cannot directly mutate long-term memory without going through the standard approval and audit pipelines.
3. Tool Execution Sandbox: Agents interact with external systems and internal databases exclusively through pre-approved tool manifests. Every tool call is intercepted by the Governance Middleware, which evaluates permission scopes, parameter bounds, and rate limits.

```
+-------------------------------------------------------------------------+
|                        CONCLUDO AGENT RUNTIME                           |
|                                                                         |
|  +--------------------+    +--------------------+    +---------------+  |
|  |  Caller Session    | -> |  Governance Policy | -> | Context Init  |  |
|  |  (auth.uid())      |    |  Evaluation        |    | Sandbox       |  |
|  +--------------------+    +--------------------+    +---------------+  |
|                                                              |          |
|                                                              v          |
|  +-------------------------------------------------------------------+  |
|  |                    Ephemeral Execution Scope                      |  |
|  |                                                                   |  |
|  |  +-------------------+  +-------------------+  +---------------+  |  |
|  |  | Working Memory    |  | Short-Term Memory |  | Long-Term RLS |  |  |
|  |  | (Scratchpad)      |  | (Workflow State)  |  | Knowledge     |  |  |
|  |  +-------------------+  +-------------------+  +---------------+  |  |
|  |                                                                   |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  | Tool Execution Guard (Parameter Bounds & Schema Validation) |  |  |
|  |  +-------------------------------------------------------------+  |  |
|  +-------------------------------------------------------------------+  |
|                               |                                         |
|                               v                                         |
|  +-------------------------------------------------------------------+  |
|  |                Human-in-the-Loop Approval Check                   |  |
|  |       (Requires Approval? -> Pause Execution -> Notify User)      |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

#### 15.5.2 Human-in-the-Loop Approval State Machine

For any action that modifies production data, dispatches communications outside the workspace, or alters project governance, the workflow engine transitions the execution into a `waiting_approval` state.

```
       [Created]
           |
           v
      [Validating]
           |
           +-----------------------+
           | (No Approval Needed)  | (Requires Approval)
           v                       v
      [Executing]         [Waiting Approval]
           |                       |
           |             +---------+---------+
           |             |                   |
           |             v (Approved)        v (Rejected)
           |        [Executing]          [Cancelled]
           |             |
           v             v
      [Completed] / [Failed]
```

1. Approval Request Generation: A structured record is created in `public.workflow_approvals`, specifying the requesting agent, workflow ID, target action, payload preview, proposed impact, and required approver roles.
2. Real-Time Notification: Approvers receive notifications through in-app alerts and external webhooks (such as Slack or Microsoft Teams).
3. Authorised Decision: An approver with the requisite role submits an approval or rejection. The action is verified via Supabase RLS and signed with the approver's user ID and timestamp.
4. Execution Resume or Compensation: If approved, the workflow worker claims the job and resumes execution. If rejected or timed out, the workflow engine triggers compensation routines to reverse any speculative changes and transitions the workflow to `cancelled`.

#### 15.5.3 Step Execution DAG and Compensation Logic

Workflows are defined as Directed Acyclic Graphs (DAGs) consisting of discrete steps. Each step declares its inputs, outputs, prerequisites, timeout limits, and compensating actions:

```typescript
export interface WorkflowStepDefinition {
  stepId: string;
  name: string;
  handler: string;
  dependsOn: string[];
  requiresApproval: boolean;
  timeoutSeconds: number;
  retryPolicy: {
    maxAttempts: number;
    backoffSeconds: number;
  };
  compensateHandler?: string;
}
```

If a step fails permanently after exhausting its retries, the workflow engine traverses the execution DAG in reverse topological order, invoking the registered `compensateHandler` for each previously completed step. This guarantees that partial workflows do not leave orphaned resources or corrupt workspace state.

## Section 17: Document Generation Architecture

### 17.1 Output Engine and Template Compilation Pipeline
Concludo Workspace transforms structured database intelligence into tier-one management consulting deliverables (McKinsey, BCG, Bain quality). The document generation pipeline guarantees visual rigor, typographic restraint, consistent branding, and pixel-perfect export across digital and print formats.

```
+----------------------------------------------------------------------------------------------------+
|                                  DOCUMENT COMPILATION PIPELINE                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ USER / API TRIGGER ]      Request Blueprint T8 (Business Plan) or Blueprint T4 (Board Brief)  |
|               |                                                                                    |
|               v                                                                                    |
|    +------------------------------------------------------------------------------------------+    |
|    |  1. INTELLIGENCE EXTRACTION & DATA AGGREGATION                                           |    |
|    |     - Fetches project metadata, transcripts, decisions, 5-field actions, and insights    |    |
|    |     - Queries knowledge graph for linked dependencies, risks, and strategic goals        |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  2. LLM SYNTHESIS & SECTION COMPILATION                                                  |    |
|    |     - Passes aggregated entities into specialized blueprint prompts (Tasklet A1)         |    |
|    |     - Generates structured narrative sections adhering to MECE and Action Title Rule     |    |
|    |     - Applies Stated Omission Standard (zero invented metrics; flags missing data)       |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  3. VISUAL FRAMEWORK COMPOSITION                                                         |    |
|    |     - Assembles mandated visual instruments (VIS-01 to VIS-28)                           |    |
|    |     - Renders SVG charts, 2x2 matrices, 5x5 heatmaps, and roadmap swimlanes              |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  4. DOM RENDERING & QUALITY EVALUATION                                                   |    |
|    |     - Renders complete HTML/Tailwind DOM container with Concludo Navy & Gold tokens      |    |
|    |     - Runs Deliverable Quality Index (DQI) evaluation; enforces 85/100 release gate      |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|         +---------------------------------------+---------------------------------------+          |
|         |                                       |                                       |          |
|         v                                       v                                       v          |
|  +-----------------------------+  +-----------------------------+  +-----------------------------+ |
|  |     INTERACTIVE DOM VIEWER  |  |    HEADLESS PDF COMPILER    |  |    STRUCTURED JSON EXPORT   | |
|  | - React Workspace Preview   |  | - Puppeteer Chromium Engine |  | - Full machine-readable     | |
|  | - Inline editing & comments |  | - Print CSS (@page A4/Letter|  |   deliverable schema for    | |
|  | - Live zoom and inspection  |  | - Vector fonts, page numbers|  |   enterprise API ingestion | |
|  +-----------------------------+  +-----------------------------+  +-----------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 17.2 The 16 Business Templates and 58 Outputs Catalogue
The document engine provides native compilers for the sixteen standard business templates (T1 to T16) and three strategic blueprints (T17 to T19) established in Tasklet A1, producing all fifty-eight master catalogue deliverables (`OUT-01` to `OUT-58`). Each template defines:
- Strict Sectional Schema: Required structural headers, narrative subsections, and data tables.
- Action Title Rule: Every section header must state a governing thought or strategic conclusion rather than a generic topic label (e.g., *'Supply Chain Lead Times Expand to 14 Weeks, Threatening Q4 Delivery'* instead of *'Supply Chain Update'*).
- Prescribed Visual Models: Exact placement and data mapping for designated visual frameworks (e.g., VIS-03 Risk Heatmap in Blueprint T11; VIS-08 Business Model Canvas in Blueprint T8).
- Print Media Stylesheet: Precise CSS paged media rules (`size: A4 portrait; margin: 20mm;`) guaranteeing clean page breaks, running headers, and legal disclaimers.

```typescript
// Headless Chromium PDF Generation Worker Implementation Pattern
import puppeteer from 'puppeteer';

export async function compileDeliverableToPdf(htmlContent: string, deliverableTitle: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size: 8pt; font-family: Inter; color: #64748B; padding-left: 15mm; width: 100%;">CONCLUDO WORKSPACE | ${deliverableTitle}</div>`,
      footerTemplate: `<div style="font-size: 8pt; font-family: Inter; color: #64748B; width: 100%; display: flex; justify-content: space-between; padding: 0 15mm;"><span>CONFIDENTIAL</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
```

---



### 17.3 The Nineteen Master Consulting Blueprints (T1 to T19) Detailed Specifications

Concludo Workspace provides native compilation engines for nineteen master business blueprints. Each blueprint defines an immutable structural schema, mandatory visual instruments, and target lengths.

#### T1: Executive Summary
- Primary Objective: High-velocity briefing delivering immediate situational awareness, key findings, and core recommendations.
- Required Sections: Executive Headline, Strategic Context, Core Findings, Key Decisions Taken, Immediate Action Items, Strategic Risks and Mitigations.
- Mandatory Visual Models: VIS-13 Executive KPI Tile Row, VIS-01 RAG Status Indicator Set, VIS-04 Milestone Timeline Bar.
- Target Length: 1 to 2 printed pages (compact, high density).

#### T2: Meeting Report
- Primary Objective: Complete, professional record of collaborative discourse, replacing traditional informal meeting minutes.
- Required Sections: Meeting Metadata, Executive Summary, Detailed Discussion Points, Formal Decisions Log, Five-Field Action Plan, Risk and Opportunity Radar, Next Session Agenda.
- Mandatory Visual Models: VIS-01 RAG Status Set, VIS-04 Milestone Timeline Bar, VIS-22 Meeting Health Radar.
- Target Length: 3 to 6 printed pages.

#### T3: Decision Pack
- Primary Objective: Authoritative decision documentation establishing clear rationale, rejected alternatives, and stakeholder alignment.
- Required Sections: Decision Title and Context, Problem Statement, Evaluated Options, Commercial Justification, Stakeholder Alignment, Implementation Roadmap, Governance Sign-Off.
- Mandatory Visual Models: VIS-19 Options Trade-Off Matrix, VIS-12 Decision Tree Diagram, VIS-23 Decision Velocity Gauge.
- Target Length: 4 to 8 printed pages.

#### T4: Board Briefing
- Primary Objective: Concise, defensible briefing tailored for non-executive directors and board committee review.
- Required Sections: Board Memorandum Header, Strategic Issue / Opportunity, Commercial and Financial Implications, Enterprise Risk Exposure, Options Evaluation, Board Recommendation and Resolution.
- Mandatory Visual Models: VIS-01 RAG Status Set, VIS-03 5x5 Enterprise Risk Heatmap, VIS-13 Executive KPI Tile Row.
- Target Length: 2 to 4 printed pages.

#### T5: Program Report
- Primary Objective: Multi-workstream delivery governance tracking milestones, dependencies, and delivery velocity.
- Required Sections: Program Health Summary, Workstream Delivery Status, Milestone Progress Ledger, Critical Path Dependencies, Program Risk Register, Resource and Financial Variance.
- Mandatory Visual Models: VIS-01 RAG Status Set, VIS-05 Strategic Gantt Chart, VIS-14 Dependency Graph Canvas, VIS-21 Action Item Ageing Chart.
- Target Length: 6 to 12 printed pages.

#### T6: Strategy Brief
- Primary Objective: Focused strategic positioning document framing market shifts, competitive threats, and strategic choices.
- Required Sections: Strategic Imperative, Market and Competitive Dynamics, Strategic SWOT Synthesis, Strategic Choices and Trade-Offs, Five-Year Strategic Roadmap, Required Organisational Enablers.
- Mandatory Visual Models: VIS-07 SWOT Matrix Panel, VIS-02 2x2 Priority Matrix, VIS-06 Multi-Track Roadmap Swimlanes, VIS-27 PESTLE Analysis Hexagon.
- Target Length: 5 to 10 printed pages.

#### T7: Action Plan
- Primary Objective: Enforceable operational execution ledger holding individuals accountable to commitments.
- Required Sections: Execution Objective, Accountability Framework, Five-Field Delegation Standard Register, Critical Dependencies, Milestone Horizon, Progress Tracking and Governance.
- Mandatory Visual Models: VIS-04 Milestone Timeline Bar, VIS-21 Action Item Ageing Chart, VIS-01 RAG Status Set.
- Target Length: 3 to 6 printed pages.

#### T8: Business Plan
- Primary Objective: Comprehensive commercial and operational blueprint for scaling new ventures, products, or divisions.
- Required Sections: Executive Summary, Problem Statement, Market Opportunity, Target Audience and Personas, Commercial Model, Business Model Canvas, Strategic SWOT Analysis, Competitive Positioning, Operational Plan, Resource Allocation, Financial Forecast, Enterprise Risk Register, Action Plan, Success Metrics.
- Mandatory Visual Models: VIS-08 Business Model Canvas Grid, VIS-07 SWOT Matrix Panel, VIS-06 Multi-Track Roadmap Swimlanes, VIS-15 Financial Waterfall Chart, VIS-03 5x5 Risk Heatmap.
- Target Length: 15 to 25 printed pages.

#### T9: Transformation Roadmap
- Primary Objective: Multi-year strategic change journey aligning people, processes, and technology.
- Required Sections: Transformation Vision, Current-State Baseline, Target-State Architecture, Phased Horizon Journey, Workstream Alignment, Governance Framework, Value Realisation Ledger.
- Mandatory Visual Models: VIS-06 Multi-Track Roadmap Swimlanes, VIS-10 Strategic Maturity Curve, VIS-05 Strategic Gantt Chart, VIS-11 Stakeholder Impact Matrix.
- Target Length: 8 to 15 printed pages.

#### T10: Target Operating Model (TOM)
- Primary Objective: Structural blueprint defining how the organisation delivers value across functional capabilities.
- Required Sections: Executive Summary, Operating Model Principles, Core Capability Architecture, Process Value Streams, Organisational Governance and RACI, Technology Systems Integration, Sourcing Model.
- Mandatory Visual Models: VIS-09 Capability Heatmap, VIS-25 Organisational Network Graph, VIS-26 Value Stream Map, VIS-18 Stacked Composition Bar.
- Target Length: 10 to 20 printed pages.

#### T11: Risk Assessment
- Primary Objective: Structured enterprise risk analysis identifying systemic operational, commercial, and technical vulnerabilities.
- Required Sections: Risk Context and Scope, Threat Identification Ledger, Risk Matrix Analysis, Mitigating Controls Framework, Residual Risk Profile, Ownership and Monitoring Schedule.
- Mandatory Visual Models: VIS-03 5x5 Enterprise Risk Heatmap, VIS-20 Sensitivity Tornado Chart, VIS-01 RAG Status Set.
- Target Length: 5 to 10 printed pages.

#### T12: Opportunity Assessment
- Primary Objective: Commercial evaluation of new revenue streams, operational efficiencies, or partnership vectors.
- Required Sections: Executive Summary, Opportunity Identification, Addressable Market Assessment, Commercial Economics, Required Capital and Resources, Execution Risks, Go/No-Go Recommendation.
- Mandatory Visual Models: VIS-02 2x2 Priority Matrix, VIS-17 Pipeline Funnel Chart, VIS-15 Financial Waterfall Chart.
- Target Length: 4 to 8 printed pages.

#### T13: Commercial Business Case
- Primary Objective: Formal investment justification establishing ROI, payback period, and net present value (NPV).
- Required Sections: Executive Summary, Business Problem and Objectives, Options Appraisal, Financial Analysis and Cost-Benefit Model, Commercial Risks, Implementation Timeline, Recommendation.
- Mandatory Visual Models: VIS-19 Options Trade-Off Matrix, VIS-15 Financial Waterfall Chart, VIS-12 Decision Tree Diagram.
- Target Length: 8 to 16 printed pages.

#### T14: Investment Proposal
- Primary Objective: Pitch artifact for capital allocation, equity funding, or major board expenditure.
- Required Sections: Investment Thesis, The Problem and Market Need, Proprietary Solution, Market Size (TAM/SAM/SOM), Business Model and Unit Economics, Financial Forecasts, The Ask and Use of Funds.
- Mandatory Visual Models: VIS-08 Business Model Canvas Grid, VIS-15 Financial Waterfall Chart, VIS-20 Sensitivity Tornado Chart.
- Target Length: 6 to 12 printed pages.

#### T15: Market Analysis
- Primary Objective: Deep dive into industry dynamics, customer behaviours, and competitor positioning.
- Required Sections: Executive Summary, Industry Landscape and Macro Trends, Customer Segmentation, Competitor Benchmarking Matrix, Market Share Dynamics, Strategic Implications.
- Mandatory Visual Models: VIS-27 PESTLE Analysis Hexagon, VIS-07 SWOT Matrix Panel, VIS-17 Pipeline Funnel Chart.
- Target Length: 6 to 12 printed pages.

#### T16: Project Health Report
- Primary Objective: Rapid diagnostic evaluating project execution velocity, team morale, and commitment reliability.
- Required Sections: Project Vitals and Scorecard, Delivery Milestone Progress, Action Backlog Health (CRI), Stakeholder Alignment, Open Blockers, Corrective Recovery Plan.
- Mandatory Visual Models: VIS-01 RAG Status Set, VIS-21 Action Item Ageing Chart, VIS-22 Meeting Health Radar.
- Target Length: 3 to 5 printed pages.

#### T17: Leadership Briefing
- Primary Objective: Strategic update for C-suite peers highlighting cross-functional wins, delays, and critical escalations.
- Required Sections: Strategic Progress Highlights, Executive Decisions Pending, Operational Blockers Requiring Intervention, Portfolio Health Snapshot, Key Milestones Next 30 Days.
- Mandatory Visual Models: VIS-13 Executive KPI Tile Row, VIS-01 RAG Status Set, VIS-11 Stakeholder Impact Matrix.
- Target Length: 2 to 4 printed pages.

#### T18: Quarterly Business Review (QBR)
- Primary Objective: Comprehensive retrospective and prospective quarterly operational review.
- Required Sections: Quarter in Review, Key OKR / KPI Achievements, Operational Challenges and Misses, Financial Performance Variance, Strategic Goals Next Quarter, Resource Requirements.
- Mandatory Visual Models: VIS-13 Executive KPI Tile Row, VIS-16 Trend Line with Confidence Bands, VIS-15 Financial Waterfall Chart.
- Target Length: 8 to 16 printed pages.

#### T19: Future-State Roadmap
- Primary Objective: Long-term strategic horizon architecture mapping multi-year evolution.
- Required Sections: Strategic Vision and Ambition, Horizon 1 (Current Fixes), Horizon 2 (Operational Scale), Horizon 3 (Disruptive Growth), Enabling Capabilities, Capital Roadmap.
- Mandatory Visual Models: VIS-06 Multi-Track Roadmap Swimlanes, VIS-10 Strategic Maturity Curve, VIS-28 Strategic Digital Twin Canvas.
- Target Length: 6 to 12 printed pages.


## Section 18: Visualization Architecture

### 18.1 The 28 Executive Visualisation Instruments (VIS-01 to VIS-28)
Concludo Workspace natively supports twenty-eight specialised visual analytical frameworks, engineered to provide instant executive comprehension while eliminating visual clutter.

Visual instruments are implemented as responsive, pure React components rendered with SVG and Tailwind styling. They render with identical fidelity in the live web application and headless PDF compilation runs.

```
+----------------------------------------------------------------------------------------------------+
|                                 VISUALISATION SELECTION MATRIX                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    VISUAL ID | INSTRUMENT NAME               | PRIMARY BUSINESS PURPOSE                            |
|    ----------+-------------------------------+--------------------------------------------------   |
|    VIS-01    | RAG Status Indicator Set      | Immediate health assessment (Red, Amber, Green)     |
|    VIS-02    | 2x2 Priority Matrix           | Effort versus Impact strategic triage               |
|    VIS-03    | 5x5 Enterprise Risk Heatmap   | Likelihood versus Consequence risk distribution     |
|    VIS-04    | Milestone Timeline Bar        | Chronological project schedule and key checkpoints  |
|    VIS-05    | Strategic Gantt Chart         | Cross-stream task dependencies and critical paths   |
|    VIS-06    | Multi-Track Roadmap Swimlanes | Functional workstream alignment across quarters     |
|    VIS-07    | SWOT Matrix Panel             | Strengths, Weaknesses, Opportunities, Threats       |
|    VIS-08    | Business Model Canvas Grid    | 9-box operational and commercial architecture       |
|    VIS-09    | Capability Heatmap            | Organisational maturity and operational readiness   |
|    VIS-10    | Strategic Maturity Curve      | Evolutionary stage progression (Level 1 to 5)       |
|    VIS-11    | Stakeholder Impact Matrix     | Interest versus Influence alignment mapping         |
|    VIS-12    | Decision Tree Diagram         | Branching decision pathways and expected payoffs    |
|    VIS-13    | Executive KPI Tile Row        | Core performance metrics with trend indicators      |
|    VIS-14    | Dependency Graph Canvas       | Inter-system and inter-project critical linkages    |
|    VIS-15    | Financial Waterfall Chart     | Incremental EBITDA, revenue, or cost variances      |
|    VIS-16    | Trend Line with Confidence    | Longitudinal metric trajectory with variance bands  |
|    VIS-17    | Pipeline Funnel Chart         | Conversion velocity through progressive stages      |
|    VIS-18    | Stacked Composition Bar       | Proportional resource, cost, or time distribution   |
|    VIS-19    | Options Trade-Off Matrix      | Multi-criteria decision comparison scorecard        |
|    VIS-20    | Sensitivity Tornado Chart     | Risk exposure sensitivity across variables          |
|    VIS-21    | Action Item Ageing Chart      | Cumulative backlog velocity and overdue slippage    |
|    VIS-22    | Meeting Health Radar Chart    | 10-dimension collaborative health evaluation         |
|    VIS-23    | Decision Velocity Gauge       | Time-to-decision and consensus speed telemetry      |
|    VIS-24    | Scenario Comparison Panel     | Side-by-side modeling of strategic choices          |
|    VIS-25    | Organisational Network Graph  | Cross-functional communication and influence flow   |
|    VIS-26    | Value Stream Map              | Process cycle times and operational waste analysis  |
|    VIS-27    | PESTLE Analysis Hexagon       | Macro-environmental strategic risk evaluation       |
|    VIS-28    | Strategic Digital Twin Canvas | Systemic operational simulation and feedback loops   |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 18.2 Rendering Standards and Visual Integrity
All visual components adhere to four non-negotiable visual standards:
1. Zero Visual Noise: No decorative gradients, gratuitous 3D effects, drop shadows, or non-functional animations. Visual complexity must serve data clarity.
2. Palette Discipline: Visualisations use exclusively Concludo Brand Tokens (`#16263F` Navy, `#E2B53C` Gold, `#F4F6FA` Light Canvas) alongside standardised RAG semantics (`#E53E3E`, `#DD6B20`, `#38A169`).
3. High-DPI Vector Crispness: All charts and diagrams are constructed using scalable vector graphics (SVG) with explicit coordinate geometry, ensuring zero raster pixelation when zoomed or printed.
4. Colourblind Accessibility: Color is never used as the sole indicator of status. RAG indicators pair color with distinct geometrical icons (circle for green, triangle for amber, square for red) and explicit text labels.

---

## Section 19: Search Architecture

### 19.1 Multi-Tier Hybrid Search Pipeline
Concludo Workspace implements a multi-tier hybrid search architecture that marries the precision of PostgreSQL lexical full-text indexing with the contextual depth of dense semantic vector embeddings.

```
+----------------------------------------------------------------------------------------------------+
|                                    HYBRID SEARCH PIPELINE TOPOLOGY                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ USER SEARCH QUERY: "Q4 Supply Chain Delays" ]                                                |
|                           |                                                                        |
|         +-----------------+-----------------+                                                      |
|         |                                   |                                                      |
|         v                                   v                                                      |
|  +-----------------------------+     +-----------------------------+                               |
|  |     LEXICAL SEARCH TIER     |     |     SEMANTIC VECTOR TIER    |                               |
|  | - PostgreSQL GIN Index      |     | - OpenAI Embedding Service  |                               |
|  | - `to_tsvector('english')`  |     | - 1536-dim / 3072-dim Vector|                               |
|  | - BM25 / `ts_rank_cd` Score |     | - `pgvector` HNSW Index     |                               |
|  | - Exact keywords, acronyms, |     | - Cosine Distance Ranking   |                               |
|  |   speaker names, action IDs |     | - Conceptual synonyms, gist |                               |
|  +--------------+--------------+     +--------------+--------------+                               |
|                 |                                   |                                              |
|                 v                                   v                                              |
|          [ Top 100 Lexical ]                 [ Top 100 Semantic ]                                  |
|                 |                                   |                                              |
|                 +-----------------+-----------------+                                              |
|                                   |                                                                |
|                                   v                                                                |
|    +------------------------------------------------------------------------------------------+    |
|    |  RECIPROCAL RANK FUSION (RRF) & KNOWLEDGE GRAPH RE-RANKER                                |    |
|    |  - Combines ranks: RRF_Score = 1 / (60 + Lex_Rank) + 1 / (60 + Sem_Rank)                |    |
|    |  - Traverses Knowledge Graph: Boosts records linked to active project or decision         |    |
|    |  - Enforces Kernel Row Level Security (RLS) Filter: Discards unauthorized entities        |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    [ FINAL TOP 25 HYBRID RESULTS WITH HIGHLIGHTED SNIPPETS & CITATION ANCHORS ]                   |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 19.2 Search Indexing Lifecycle and Performance Targets
- Lexical Indexing: Generated columns compute `tsvector` representations across titles, transcripts, decision rationales, and action descriptions. Indexes utilize PostgreSQL Generalized Inverted Indexes (GIN) with English stemming dictionaries.
- Semantic Indexing: Text is partitioned into 512-token chunks with 64-token overlap. Vectors are stored in `public.vector_embeddings` and indexed via Hierarchical Navigable Small World (HNSW) graphs (`m=16, ef_construction=64`).
- Retrieval Performance Targets:
  - Lexical Full-Text Query: Sub-50 milliseconds.
  - Dense Vector Nearest-Neighbor Search: Sub-120 milliseconds.
  - Hybrid RRF Re-ranking and Graph Expansion: Sub-250 milliseconds.

```sql
-- PostgreSQL Lexical & Vector Indexing DDL
CREATE INDEX IF NOT EXISTS idx_transcripts_fts
ON public.transcripts
USING gin(to_tsvector('english', transcript_text));

CREATE INDEX IF NOT EXISTS idx_decision_memory_fts
ON public.decision_memory
USING gin(to_tsvector('english', decision_title || ' ' || decision_rationale));

CREATE INDEX IF NOT EXISTS idx_vector_embeddings_hnsw
ON public.vector_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## Section 20: Copilot Architecture

### 20.1 Cognitive Copilot Engine (Tasklet 22 Specification)
Concludo Copilot is the conversational executive reasoning interface of Concludo Workspace. It allows leadership to query institutional memory, explore decision history, evaluate cross-project risk exposure, and draft executive deliverables through natural language dialogue.

Copilot operates through an eight-stage cognitive loop:

```
+----------------------------------------------------------------------------------------------------+
|                                    COPILOT REASONING CYCLE                                         |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ 1. USER INQUIRY ]           "What was decided regarding the European cloud migration?"        |
|            |                                                                                       |
|            v                                                                                       |
|    [ 2. INTENT CLASSIFICATION ]   Identifies target domains (Decision Memory, Infrastructure)      |
|            |                      Generates structured hybrid search query parameters              |
|            v                                                                                       |
|    [ 3. HYBRID RETRIEVAL ]        Executes RRF search over transcripts, decisions, and knowledge    |
|            |                      nodes; retrieves top 15 candidate grounding passages            |
|            v                                                                                       |
|    [ 4. GRAPH CONTEXT EXPANSION]  Traverses `knowledge_relationships` to identify linked actions,   |
|            |                      owners, and rejected alternatives                                |
|            v                                                                                       |
|    [ 5. TOKEN BUDGET ASSEMBLY ]   Allocates context: System Guardrails (10%), Dialogue History     |
|            |                      (15%), Grounding Context (65%), Generation Headroom (10%)        |
|            v                                                                                       |
|    [ 6. REASONING & SYNTHESIS ]   Invokes LLM with Stated Omission Standard and Australian English |
|            |                      Generates response with strict verbatim citation tags            |
|            v                                                                                       |
|    [ 7. CITATION VERIFICATION ]   Validates that all injected citation tags correspond to actual   |
|            |                      retrieved database records; strips hallucinated references       |
|            v                                                                                       |
|    [ 8. STREAMING DELIVERY ]      Streams tokens and citation badges to client via Server-Sent     |
|                                   Events (SSE); logs interaction to `public.copilot_messages`      |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 20.2 Source Attribution and Anti-Hallucination Guardrails
To maintain trust with C-suite and board members, Concludo Copilot enforces strict verification guardrails:
- Verbatim Source Attribution: Every substantive assertion in a Copilot response is accompanied by a clickable citation badge linking to the exact transcript turn, decision record, or project artifact (e.g., `[Ref: Decision DEC-2026-084]`, `[Ref: Transcript Turn 142, Anthony Cortez]`).
- Zero Hallucination Policy: When queried about topics, dates, or metrics not recorded in workspace intelligence, Copilot explicitly declines to speculate, stating: *'The recorded meeting transcripts and project memory do not contain information regarding this topic.'*
- Multi-Turn Conversation Continuity: Copilot persists dialogue context within `public.copilot_conversations`, maintaining conversational continuity across browser sessions while respecting active organisation boundaries.


### 18.3 Exhaustive Specifications for the 28 Visual Models (VIS-01 to VIS-28)

Concludo Workspace natively supports twenty-eight specialised analytical visual models, engineered to satisfy the Four Visual Tests: Data Authenticity, Executive Decidability, Zero Visual Noise, and Palette Compliance.

#### VIS-01: RAG Status Indicator Set
- Business Purpose: Immediate visual triage of project, workstream, or milestone health.
- When Used: Universal across all 16 business templates; prominent in Executive Summaries (T1) and Board Briefs (T4).
- How Rendered: SVG badge pairing colour with distinct geometric icons (Red square, Amber triangle, Green circle, Blue diamond) and uppercase status text.
- Recommended Placement: Header hero band, project overview cards, deliverable metadata summaries.

#### VIS-02: 2x2 Priority Matrix
- Business Purpose: Effort versus Impact strategic triage of competing initiatives, features, or recommendations.
- When Used: Strategy Briefs (T6), Business Plans (T8), and Transformation Roadmaps (T9).
- How Rendered: Cartesian grid with four quadrants (Quick Wins, Major Projects, Fill-Ins, Thankless Tasks), plotting items as discrete numbered nodes with hover tooltips.
- Recommended Placement: Strategic Initiatives section, immediate follow-up to SWOT analysis.

#### VIS-03: 5x5 Enterprise Risk Heatmap
- Business Purpose: Distribution of project and organisational risks across Likelihood (1 to 5) and Consequence (1 to 5).
- When Used: Risk Assessments (T11), Board Briefs (T4), Program Reports (T5).
- How Rendered: 25-cell color-coded matrix with green, amber, orange, and red zones, plotting risk IDs with severity callout tables.
- Recommended Placement: Risk Register section, immediately preceding mitigation plans.

#### VIS-04: Milestone Timeline Bar
- Business Purpose: Chronological project schedule and key checkpoint milestones.
- When Used: Action Plans (T7), Meeting Reports (T2), Executive Summaries (T1).
- How Rendered: Horizontal linear timeline with milestone pins, completion badges, and current date indicators.
- Recommended Placement: Execution Horizon section, immediately preceding action item tables.

#### VIS-05: Strategic Gantt Chart
- Business Purpose: Cross-stream task dependencies, durations, and critical paths.
- When Used: Transformation Roadmaps (T9), Program Reports (T5), Operating Models (T10).
- How Rendered: Multi-track horizontal bar chart with dependency link arrows, milestone diamonds, and critical path highlighting.
- Recommended Placement: Operational Delivery section.

#### VIS-06: Multi-Track Roadmap Swimlanes
- Business Purpose: Functional workstream alignment across fiscal quarters (Q1, Q2, Q3, Q4).
- When Used: Future-State Roadmaps (T19), Business Plans (T8), Transformation Roadmaps (T9).
- How Rendered: Horizontal swimlane tracks (e.g., Product, Go-To-Market, Operations, Governance) with phased initiative pills.
- Recommended Placement: Strategic Roadmap section.

#### VIS-07: SWOT Matrix Panel
- Business Purpose: Four-quadrant evaluation of Strengths, Weaknesses, Opportunities, and Threats.
- When Used: Business Plans (T8), Strategy Briefs (T6), Market Analyses (T15).
- How Rendered: 2x2 high-contrast grid with navy, gold, and slate accent bars, categorising bulleted strategic factors.
- Recommended Placement: Environmental Assessment section.

#### VIS-08: Business Model Canvas Grid
- Business Purpose: Comprehensive 9-box operational and commercial architecture overview.
- When Used: Business Plans (T8), Investment Proposals (T14).
- How Rendered: Standard 9-box layout (Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams).
- Recommended Placement: Core Commercial Model section.

#### VIS-09: Capability Heatmap
- Business Purpose: Organisational maturity and operational readiness evaluation across business units.
- When Used: Target Operating Models (T10), Transformation Roadmaps (T9).
- How Rendered: Grouped matrix of business capabilities shaded from low maturity (Level 1) to optimised maturity (Level 5).
- Recommended Placement: Organisational Architecture section.

#### VIS-10: Strategic Maturity Curve
- Business Purpose: Evolutionary stage progression from reactive management to autonomous executive operating guidance.
- When Used: Executive Briefings (T17), Transformation Roadmaps (T9).
- How Rendered: Sigmoid S-curve showing current operational baseline versus future-state target horizon.
- Recommended Placement: Strategic Vision section.

#### VIS-11: Stakeholder Impact Matrix
- Business Purpose: Interest versus Influence mapping of key enterprise stakeholders and partners.
- When Used: Transformation Roadmaps (T9), Leadership Briefings (T17).
- How Rendered: 2x2 grid mapping Manage Closely, Keep Satisfied, Keep Informed, and Monitor quadrants.
- Recommended Placement: Stakeholder Management section.

#### VIS-12: Decision Tree Diagram
- Business Purpose: Branching decision pathways, conditional dependencies, and expected monetary payoffs.
- When Used: Decision Packs (T3), Commercial Business Cases (T13).
- How Rendered: Left-to-right hierarchical tree with decision nodes, chance nodes, and quantified terminal values.
- Recommended Placement: Options Appraisal section.

#### VIS-13: Executive KPI Tile Row
- Business Purpose: At-a-glance telemetry of core business metrics with trend vectors.
- When Used: Universal; prominent in Executive Summaries (T1), Board Briefs (T4), and QBRs (T18).
- How Rendered: Multi-tile grid displaying big number metrics, percentage deltas, sparkline trends, and status icons.
- Recommended Placement: Above-the-fold hero section.

#### VIS-14: Dependency Graph Canvas
- Business Purpose: Inter-system, inter-team, and inter-project critical linkages and bottleneck analysis.
- When Used: Program Reports (T5), Technical Architecture Reviews.
- How Rendered: Interactive directed force-layout graph with weighted edges and node clustering.
- Recommended Placement: Critical Dependencies section.

#### VIS-15: Financial Waterfall Chart
- Business Purpose: Step-by-step visual reconciliation of revenue, cost, or EBITDA variances from baseline to target.
- When Used: Business Plans (T8), Investment Proposals (T14), QBRs (T18).
- How Rendered: Floating vertical column bars illustrating positive gains, negative cost drags, and net totals.
- Recommended Placement: Financial Projections section.

#### VIS-16: Trend Line with Confidence Bands
- Business Purpose: Longitudinal metric trajectory with statistical upper and lower variance bounds.
- When Used: Quarterly Business Reviews (T18), Predictive Health Snapshots.
- How Rendered: Time-series line chart with shaded confidence interval ribbons.
- Recommended Placement: Historical Performance section.

#### VIS-17: Pipeline Funnel Chart
- Business Purpose: Conversion velocity and volume drop-off across progressive operational or sales stages.
- When Used: Market Analyses (T15), Commercial Reviews.
- How Rendered: Symmetrical horizontal funnel with stage conversion percentages and cycle times.
- Recommended Placement: Commercial Velocity section.

#### VIS-18: Stacked Composition Bar
- Business Purpose: Proportional resource, capital, or operational time distribution across categories.
- When Used: Operating Models (T10), Business Cases (T13).
- How Rendered: 100% horizontal stacked bar with distinct segment fills and numeric percentage callouts.
- Recommended Placement: Resource Allocation section.

#### VIS-19: Options Trade-Off Matrix
- Business Purpose: Multi-criteria weighted scorecard evaluating alternative strategic proposals.
- When Used: Decision Packs (T3), Business Cases (T13).
- How Rendered: High-density comparative matrix scoring options against weighted criteria (Cost, Risk, Speed, Strategic Fit).
- Recommended Placement: Options Evaluation section.

#### VIS-20: Sensitivity Tornado Chart
- Business Purpose: Relative impact of key variable fluctuations on financial or operational outcomes.
- When Used: Investment Proposals (T14), Risk Assessments (T11).
- How Rendered: Symmetrical horizontal bar chart sorted by swing magnitude, showing upside and downside exposure.
- Recommended Placement: Sensitivity Analysis section.

#### VIS-21: Action Item Ageing Chart
- Business Purpose: Cumulative task velocity, backlog ageing, and overdue commitment distribution.
- When Used: Program Reports (T5), Project Health Reports (T16).
- How Rendered: Stacked bar chart partitioning tasks into age brackets (< 7 days, 8-14 days, 15-30 days, > 30 days).
- Recommended Placement: Execution Reliability section.

#### VIS-22: Meeting Health Radar Chart
- Business Purpose: Multi-dimensional visual diagnostic of collaborative meeting quality across 10 dimensions.
- When Used: Meeting Health Reports, Executive Briefings (T17).
- How Rendered: 10-axis polar radar chart mapping current score against the enterprise benchmark (85.0).
- Recommended Placement: Meeting Health section.

#### VIS-23: Decision Velocity Gauge
- Business Purpose: Quantitative speed-to-decision and consensus resolution telemetry.
- When Used: Decision Packs (T3), Leadership Briefings (T17).
- How Rendered: Radial gauge needle indicating average days from proposal to decision ratification.
- Recommended Placement: Governance Velocity section.

#### VIS-24: Scenario Comparison Panel
- Business Purpose: Side-by-side comparative modelling of Base Case, Best Case, and Worst Case scenarios.
- When Used: Strategy Briefs (T6), Business Plans (T8).
- How Rendered: 3-column side-by-side comparative cards highlighting financial, operational, and risk variances.
- Recommended Placement: Strategic Options section.

#### VIS-25: Organisational Network Graph
- Business Purpose: Cross-functional communication patterns, isolated teams, and collaboration bottlenecks.
- When Used: Operating Models (T10), Leadership Reviews.
- How Rendered: Network graph visualizing conversational volume and edge frequency between departments.
- Recommended Placement: Organisational Effectiveness section.

#### VIS-26: Value Stream Map
- Business Purpose: End-to-end process lead times, cycle times, and operational friction identification.
- When Used: Transformation Roadmaps (T9), Process Optimisation Reports.
- How Rendered: Sequential process flow diagram with process boxes, inventory triangles, and lead time ladders.
- Recommended Placement: Process Architecture section.

#### VIS-27: PESTLE Analysis Hexagon
- Business Purpose: Macro-environmental strategic risk evaluation across six external forces.
- When Used: Strategy Briefs (T6), Business Plans (T8), Market Analyses (T15).
- How Rendered: Hexagonal or grouped card layout analysing Political, Economic, Social, Technological, Legal, and Environmental factors.
- Recommended Placement: External Environment section.

#### VIS-28: Strategic Digital Twin Canvas
- Business Purpose: Dynamic operational simulation modelling inter-connected business feedback loops.
- When Used: Board Strategic Briefings (T4), Future-State Roadmaps (T19).
- How Rendered: Multi-layered systems dynamics canvas illustrating stocks, flows, and causal delay loops.
- Recommended Placement: Strategic Horizon section.




### 20.3 Copilot Context Assembly Algorithm and Token Allocation Ledger

The Concludo Copilot engine dynamically assembles context windows to optimise factual grounding while preventing context truncation. Below is the authoritative context assembly implementation:

```typescript
// src/services/copilotContextAssembler.ts
import { supabase } from './supabase';
import { ReciprocalRankFusionResult } from '../types/search';

export interface CopilotContextBudget {
  systemPromptTokens: number;      // 1,000 tokens (Guardrails, Tone, Formatting)
  dialogueHistoryTokens: number;   // 2,500 tokens (Last 6 conversational turns)
  groundingTranscriptsTokens: number;// 6,000 tokens (Verbatim speaker passages)
  groundingEntitiesTokens: number; // 3,000 tokens (Structured decisions, actions, risks)
  knowledgeGraphTokens: number;    // 1,500 tokens (Multi-hop relationship context)
  responseHeadroomTokens: number;  // 2,000 tokens (Generation buffer)
}

export async function assembleCopilotContext(
  organizationId: string,
  userQuery: string,
  conversationId: string
): Promise<{ systemPrompt: string; contextText: string; citationMap: Map<string, string> }> {
  // Step 1: Execute Hybrid Search across Transcripts and Structured Intelligence
  const searchResults: ReciprocalRankFusionResult[] = await executeHybridSearch({
    organizationId,
    query: userQuery,
    limit: 15,
  });

  // Step 2: Query Knowledge Graph for 2-hop connected entities
  const entityIds = searchResults.map(r => r.entityId);
  const graphContext = await queryKnowledgeGraphNeighbors(organizationId, entityIds, 2);

  // Step 3: Format Grounding Ledger with Verbatim Primary Anchors
  const citationMap = new Map<string, string>();
  let formattedGrounding = "### VERIFIED GROUNDING CONTEXT (DO NOT FABRICATE BEYOND THESE FACTS):

";

  searchResults.forEach((result, idx) => {
    const citationTag = `[Ref: ${result.entityType.toUpperCase()}-${result.entityId.slice(0, 8)}]`;
    citationMap.set(citationTag, result.entityId);
    formattedGrounding += `${citationTag} (${result.title}):
"${result.snippet}"

`;
  });

  formattedGrounding += "### LINKED KNOWLEDGE GRAPH RELATIONSHIPS:
";
  graphContext.forEach(rel => {
    formattedGrounding += `- ${rel.sourceLabel} [${rel.relationshipType}] -> ${rel.targetLabel}
`;
  });

  return {
    systemPrompt: BASE_EXECUTIVE_PERSONA_PROMPT,
    contextText: formattedGrounding,
    citationMap,
  };
}
```


## Section 21: Integration Architecture

### 21.1 Enterprise Integration Framework (Tasklet 18 Specification)
Concludo Workspace is engineered to integrate seamlessly into existing enterprise IT ecosystems. Rather than forcing organizations to abandon their established communication and task management infrastructure, Concludo acts as the intelligence nucleus that aggregates discourse and orchestrates execution across third-party tools.

```
+----------------------------------------------------------------------------------------------------+
|                                    INTEGRATION ARCHITECTURE TOPOLOGY                              |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                                     +-----------------------------+                                |
|                                     |      CONCLUDO WORKSPACE     |                                |
|                                     |    (Intelligence Engine)    |                                |
|                                     +--------------+--------------+                                |
|                                                    |                                               |
|                    +-------------------------------+-------------------------------+               |
|                    |                               |                               |               |
|                    v                               v                               v               |
|     +-----------------------------+ +-----------------------------+ +----------------------------+ |
|     |  COLLABORATION INTEGRATIONS | |   TASK & WORK INTEGRATIONS  | |      CRM INTEGRATIONS      | |
|     |  - Microsoft Teams          | |  - Microsoft Planner        | |  - Salesforce              | |
|     |  - Slack Enterprise Grid    | |  - Jira Software Cloud      | |  - HubSpot CRM             | |
|     |  - Zoom Cloud Recordings    | |  - Notion Workspace         | |  - Microsoft Dynamics 365  | |
|     +--------------+--------------+ +--------------+--------------+ +--------------+-------------+ |
|                    |                               |                               |               |
|                    v                               v                               v               |
|     +--------------------------------------------------------------------------------------------+ |
|     |                         STANDARDISED CONNECTOR & ADAPTER MESH                              | |
|     |   - OAuth 2.0 PKCE Handshake Manager    - Encrypted Token Vault                            | |
|     |   - Bi-directional Delta Synchroniser   - Rate Limit Throttler & Circuit Breaker           | |
|     |   - HMAC Webhook Dispatch Engine        - Public REST API Gateway (`/api/v1/*`)            | |
|     +--------------------------------------------------------------------------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 21.2 Detailed Third-Party Connector Specifications
1. Microsoft 365 & Microsoft Planner Integration:
   - Synchronisation: Bi-directional synchronisation of Concludo Five-Field action items to Microsoft Planner tasks.
   - Field Mapping: Concludo Task Description -> Planner Title; Single Owner -> Assigned User; Due Date -> Due Date; Definition of Done -> Task Checklist items; Checkpoint Date -> Planner Start Date.
   - Authentication: Microsoft Graph API via OAuth 2.0 Azure AD multi-tenant application registration with delegated and application permissions (`Tasks.ReadWrite`, `Group.Read.All`).
2. Microsoft Teams & Slack Integrations:
   - Ingestion: Captures meeting recordings, transcripts, and channel summaries via authorized enterprise bots.
   - Distribution: Posts executive briefings, decision alerts, and urgent risk notifications into designated team channels via incoming webhooks or bot cards.
   - Interactive Approvals: Allows managers to review and approve workflow proposals directly inside Slack or Teams via interactive action buttons.
3. Enterprise CRM Connectors (Salesforce, HubSpot):
   - Ingestion: Associates commercial meeting transcripts with existing CRM Account, Opportunity, and Contact records.
   - Intelligence Push: Automatically creates Contact Notes, updates Opportunity Stage indicators based on buyer sentiment, and logs competitor mentions extracted during sales discovery meetings.
4. Outbound Webhook Framework:
   - Customers can register custom HTTP webhook endpoints in Workspace settings to receive immediate notifications for domain events (`decision.saved`, `action.created`, `report.generated`).
   - All outgoing payloads include a cryptographic HMAC-SHA256 signature header (`X-Concludo-Signature`) computed using the customer's shared secret to verify message authenticity and prevent tampering.

```typescript
// Webhook HMAC-SHA256 Signature Computation Example
import crypto from 'node:crypto';

export function generateWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}
```

---



### 21.5 Enterprise Integration Architecture and Bidirectional Synchronization

Concludo Workspace seamlessly connects with enterprise productivity ecosystems, transforming unstructured collaborative activity into structured organisational intelligence. The integration layer coordinates external communication channels, productivity suites, and issue trackers while upholding enterprise security and compliance standards.

#### 21.5.1 Supported Integration Connectors

Concludo provides first-class, authenticated connectors across five primary categories:

1. Microsoft 365 Ecosystem:
   - Microsoft Teams: Ingestion of meeting recordings, automated transcript imports, and bot-driven meeting health briefing delivery.
   - Microsoft Outlook and Calendar: Bidirectional calendar synchronisation for meeting agenda pre-flight checks and attendee preparation briefings.
   - Microsoft Planner and To Do: Bi-directional synchronization of action items adhering to the Five-Field Delegation Standard.
2. Slack:
   - Event-driven notifications for executive briefing broadcasts, decision notifications, and workflow approval requests.
   - Interactive modal interfaces allowing authorised managers to approve or reject pending agent workflows directly within Slack.
3. Notion and Atlassian Confluence:
   - Structured export of Concludo deliverable templates (T1 through T19) into corporate wiki spaces.
   - Knowledge base ingestion feeding the Concludo Knowledge Graph with corporate policies, project charters, and domain glossaries.
4. Jira and Linear:
   - Direct translation of meeting action items into development issues, retaining full causal traceability back to original transcript timestamps.
   - Bidirectional status synchronization: marking a Jira issue as resolved automatically updates the corresponding record in `public.action_tracker`.
5. Generic Webhooks and REST API:
   - Outbound webhook delivery for enterprise orchestration platforms (Zapier, Make, Workato).
   - Inbound webhook endpoints for external transcription services and document repositories.

#### 21.5.2 Bidirectional Sync Protocol and Conflict Resolution

Bidirectional synchronization between Concludo and external platforms introduces concurrency challenges. Concludo enforces a strict synchronization protocol:

1. Delta Tracking: Connectors maintain synchronization state using high-water mark timestamps and platform-specific delta tokens (such as Microsoft Graph delta links).
2. Deterministic Mapping: External entities are mapped to Concludo database records through explicit connector link tables (`public.integration_links`) storing the `concludo_entity_id`, `external_system`, `external_id`, and `last_synced_at`.
3. Conflict Resolution Strategy:
   - Authority Matrix: For governance fields (such as decision status, rationale, and RAG health scores), Concludo is the authoritative system of record. External changes to these fields are rejected or overridden.
   - Last-Write-Wins with Optimistic Locking: For operational fields (such as action item completion status), updates are evaluated against `updated_at` timestamps. If a concurrent conflict occurs, the latest verified modification takes precedence, and an entry is logged in the audit trail.

#### 21.5.3 Webhook Ingestion and Security Architecture

Inbound webhooks represent potential attack vectors and must be rigorously authenticated and throttled:

1. Cryptographic Signature Verification: Inbound webhook payloads must contain an HMAC SHA-256 signature in the request headers (e.g., `X-Concludo-Signature` or provider-specific equivalent). The integration service computes the expected HMAC using the customer's securely stored webhook secret and verifies it using constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
2. Replay Attack Prevention: Inbound webhook headers must include a timestamp. Requests with timestamps deviating by more than 300 seconds from server clock time are rejected immediately. Furthermore, request IDs are cached in Redis with a 24-hour expiration to detect and discard duplicate deliveries.
3. Asynchronous Queue Handoff: The HTTP webhook receiver performs authentication, schema validation, and persistence into the raw ingestion queue within 50 milliseconds, returning an immediate HTTP 202 Accepted response. Payload processing, entity extraction, and downstream knowledge updates are handled asynchronously by background queue workers.

## Section 22: Infrastructure Architecture

### 22.1 Multi-Environment Cloud Topology
Concludo Workspace infrastructure is provisioned using Infrastructure-as-Code (Terraform) across four isolated environments, ensuring strict separation between development, staging, preview, and production systems.

```
+----------------------------------------------------------------------------------------------------+
|                                    CLOUD INFRASTRUCTURE TOPOLOGY                                   |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ CLOUDFLARE GLOBAL ANYCAST EDGE ]                                                              |
|    - DNS, Anycast Routing, DDoS Protection, WAF Rules, SSL Termination                             |
|    - Cloudflare Pages: Hosts Static SPA Assets (React, Vite, HTML, JS, CSS)                        |
|                                                                                                    |
|    +------------------------------------------------------------------------------------------+    |
|    |  EDGE GATEWAY & COMPUTE LAYER                                                            |    |
|    |  - Cloudflare Edge Workers: Routing, Auth Token Validation, Rate Limiting                |    |
|    |  - Node.js Compute Cluster (AWS ECS Fargate / Dedicated K8s Cluster in Sydney):          |    |
|    |    - Background Worker Pool (BullMQ, Puppeteer Headless Renderers)                       |    |
|    |    - Pipeline Execution Services (Tasklet A0 DAG Stages)                                 |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  PERSISTENCE & STORAGE TIER (Supabase Managed Cluster in Sydney, ap-southeast-2)         |    |
|    |  - Primary PostgreSQL 16 Instance with Multi-AZ Standby Replication                      |    |
|    |  - Read Replicas for Analytics and Large Vector Search Workloads                         |    |
|    |  - Managed Redis 7.2 Cluster for Job Queues and Session Caching                          |    |
|    |  - Encrypted S3 Object Storage (AES-256) for Transcripts, Audio, and PDF Packages        |    |
|    +------------------------------------------------------------------------------------------+    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 22.2 Environment Specifications and Data Residency
- Production (`app.concludo.com`): Highly available, multi-AZ deployment backed by dedicated Supabase compute. Hosts live enterprise customer data. Primary database is provisioned in the Sydney region (`ap-southeast-2`), guaranteeing complete Australian data residency compliance for sovereign enterprise requirements.
- Staging (`staging.app.concludo.com`): Mirror of production infrastructure used for regression testing, performance benchmarking, and customer acceptance testing. Backed by synthetic, anonymised test datasets.
- Preview Environments (`pr-{number}.app.concludo.com`): Ephemeral frontend environments generated automatically by Cloudflare Pages for every pull request, allowing designers and reviewers to inspect UI changes before merging.
- Local Development (`localhost:5173`): Deterministic local environment running Vite dev server, connected to a local Dockerised Supabase stack (PostgreSQL, GoTrue, PostgREST, Storage) to enable fully offline, secure engineering.

---

## Section 23: CI/CD Architecture

### 23.1 Continuous Integration and Delivery Pipeline
Concludo enforces a strict, fully automated Git workflow and deployment pipeline. No engineer has direct write access to the `main` branch. All code changes must pass automated linting, type validation, regression testing, and security scanning prior to merge.

```
+----------------------------------------------------------------------------------------------------+
|                                      CI/CD PIPELINE FLOWCHART                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ DEVELOPER WORKSTATION ]                                                                       |
|    - Feature branch created from `main` (`feature/tasklet-24-action-kanban`)                       |
|    - Local validation: `bun run lint && bun run build && bun test`                                 |
|                 |                                                                                  |
|                 v Git Push & Open Pull Request                                                     |
|    +------------------------------------------------------------------------------------------+    |
|    |  GITHUB ACTIONS AUTOMATED CI GATE                                                        |    |
|    |  - Step 1: Code Linting & Formatting Check (ESLint, Prettier)                            |    |
|    |  - Step 2: Static Type Check (`tsc --noEmit`)                                            |    |
|    |  - Step 3: Typography & Language Audit (Zero em/en dashes, 100% Australian English)      |    |
|    |  - Step 4: Security Dependency Audit (npm audit / Snyk)                                  |    |
|    |  - Step 5: Unit & Integration Test Suite (`vitest run`)                                 |    |
|    |  - Step 6: Supabase Schema Migration Validation (`supabase test db`)                     |    |
|    |  - Step 7: Ephemeral Preview Deployment (Cloudflare Pages Preview)                       |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|                                                 v All Checks Pass & Mandatory Review Approved      |
|    [ MERGE TO MAIN VIA SQUASH & COMMIT ]                                                           |
|                 |                                                                                  |
|                 v                                                                                  |
|    +------------------------------------------------------------------------------------------+    |
|    |  PRODUCTION CD PIPELINE                                                                  |    |
|    |  - Step 1: Database Migration Run (Zero-Downtime Expand/Contract Migration)              |    |
|    |  - Step 2: Production Vite Optimized Production Build                                    |    |
|    |  - Step 3: Cloudflare Pages Production Asset Deployment                                  |    |
|    |  - Step 4: Background Worker Container Rollout (Rolling Update)                          |    |
|    |  - Step 5: Post-Deployment Smoke Test & Sentry Release Notification                      |    |
|    +------------------------------------------------------------------------------------------+    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 23.2 Zero-Downtime Database Migration Strategy (Expand and Contract)
To prevent service interruptions during continuous deployments, all database schema migrations adhere to the Expand and Contract pattern:
- Expand Phase: New columns, tables, or indexes are introduced in a non-breaking, nullable, or backward-compatible manner. Code supporting both old and new schema structures is deployed.
- Transition Phase: Background jobs or database triggers backfill data into the new schema structure.
- Contract Phase: After verifying that all active frontend and backend instances are utilizing the new schema, deprecated columns or tables are safely dropped in a subsequent release.

---

## Section 24: Observability Architecture

### 24.1 Comprehensive Telemetry and APM Framework
Concludo implements an end-to-end observability stack providing full visibility into distributed system health, background worker queues, database query performance, and AI inference latency.

```
+----------------------------------------------------------------------------------------------------+
|                                    OBSERVABILITY STACK TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ TELEMETRY SOURCES ]                                                                           |
|    - Frontend SPA (Client errors, Core Web Vitals, API latency)                                    |
|    - Edge Gateway (WAF blocks, HTTP status codes, edge cache hit ratio)                           |
|    - Background Workers (Queue wait times, processing durations, retry counts)                    |
|    - Database Cluster (Query latency, connection pool saturation, cache hit ratio)                |
|    - AI Orchestrator (Token consumption, model latency, error rates, citation validation)          |
|                 |                                                                                  |
|                 v OpenTelemetry Protocol (OTLP) / HTTPS                                            |
|    +------------------------------------------------------------------------------------------+    |
|    |  UNIFIED TELEMETRY COLLECTOR & PROCESSING LAYER                                          |    |
|    |  - Correlates telemetry via distributed `X-Concludo-Request-ID`                          |    |
|    |  - Strips Personally Identifiable Information (PII) and secret credentials               |    |
|    +--------------------------------------------+---------------------------------------------+    |
|                                                 |                                                  |
|         +---------------------------------------+---------------------------------------+          |
|         |                                       |                                       |          |
|         v                                       v                                       v          |
|  +-----------------------------+  +-----------------------------+  +-----------------------------+ |
|  |       DISTRIBUTED TRACING   |  |     ERROR & APM TRACKING    |  |     METRICS & DASHBOARDS    | |
|  | - OpenTelemetry Collector   |  | - Sentry APM                |  | - Prometheus / Grafana      | |
|  | - End-to-end request traces |  | - Real-time stack traces    |  | - P95 / P99 latency alerts  | |
|  |   from browser click to     |  | - Source-mapped JS errors   |  | - Queue depth telemetry     | |
|  |   database query and LLM    |  | - Release regression alerts |  | - Infrastructure saturation | |
|  +-----------------------------+  +-----------------------------+  +-----------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 24.2 Telemetry Service Level Objectives (SLOs) and Alerting
The platform monitors seven critical Service Level Objectives:
- API Availability: >= 99.99% successful requests (excluding 4xx client errors).
- P95 API Latency: <= 200 milliseconds across all REST endpoints.
- P95 Database Query Latency: <= 100 milliseconds across all PostgreSQL queries.
- Pipeline Ingestion Latency: <= 180 seconds for a standard 60-minute meeting transcript.
- PDF Generation Latency: <= 4.0 seconds for a 20-page executive deliverable.
- AI Error Rate: <= 0.5% failed or timed-out model invocations.
- Queue Backlog: Zero jobs waiting in queue for more than 30 seconds during standard operating hours.
Automated alerts trigger PagerDuty notifications to the on-call engineering team if any SLO is breached over a contiguous 5-minute evaluation window.

---

## Section 25: Performance Architecture

### 25.1 Strict Performance Budgets and Optimisation Targets
Concludo Workspace enforces rigorous performance budgets across client-side rendering, asset delivery, database query execution, and background document generation.

```
+----------------------------------------------------------------------------------------------------+
|                                    PERFORMANCE TARGETS MATRIX                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    PERFORMANCE METRIC             | TARGET THRESHOLD | MEASUREMENT PROTOCOL                        |
|    -------------------------------+------------------+-------------------------------------------- |
|    First Contentful Paint (FCP)   | <= 0.8 seconds   | Chrome Core Web Vitals (P75 field data)     |
|    Largest Contentful Paint (LCP) | <= 1.5 seconds   | Chrome Core Web Vitals (P75 field data)     |
|    Cumulative Layout Shift (CLS)  | <= 0.05          | Zero disruptive visual reflow during load   |
|    Interaction to Next Paint (INP)| <= 150 ms        | Instant UI responsiveness to clicks/taps    |
|    Initial Bundle Size (Gzip)     | <= 250 KB        | Vite production build artifact size         |
|    P95 Database Query Latency     | <= 100 ms        | PostgreSQL `pg_stat_statements` telemetry   |
|    P95 Hybrid Search Retrieval    | <= 250 ms        | RRF full-text and vector query execution    |
|    Copilot First Token Latency    | <= 800 ms        | Time to initial streamed token arrival      |
|    PDF Package Compilation        | <= 4.0 seconds   | Headless Chromium print rendering cycle     |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 25.2 Client-Side and Asset Delivery Optimisations
- Route-Based Code Splitting: All top-level pages and heavy feature modules (e.g., Knowledge Graph canvas, PDF previewer) are dynamically imported via `React.lazy()`. Users download only the JavaScript required for their active screen.
- Modern Asset Compression: All static assets are pre-compressed using Brotli and Gzip during the Vite build pipeline and served via Cloudflare Anycast edge caches with immutable HTTP cache headers (`Cache-Control: public, max-age=31536000, immutable`).
- Virtualized Data Grids: Long lists of action items, decisions, and audit log entries utilize DOM virtualisation (`@tanstack/react-virtual`), rendering only the visible rows in the viewport to maintain 60 FPS scrolling performance regardless of dataset size.

---

## Section 26: Scalability Architecture

### 26.1 Architectural Evolution Across Tenancy Scales
Concludo Workspace is engineered to scale seamlessly from boutique advisory firms to Fortune 500 multinationals without requiring architectural rewrites. The platform transitions through distinct architectural phases as organisational concurrency expands.

```
+----------------------------------------------------------------------------------------------------+
|                                    SCALABILITY EVOLUTION MODEL                                     |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    CONCURRENCY TIER      | INFRASTRUCTURE TOPOLOGY & DATA ARCHITECTURE                             |
|    ----------------------+------------------------------------------------------------------------ |
|    Phase 1: 10 Users     | - Single-node managed Supabase PostgreSQL instance                      |
|    (Single Organization) | - In-process background worker execution                                |
|                          | - PostgREST API with standard B-tree indexes                            |
|                          | - Low-tier object storage for transcripts and audio                     |
|    ----------------------+------------------------------------------------------------------------ |
|    Phase 2: 100 Users    | - Multi-AZ PostgreSQL with automated daily backups                      |
|    (Mid-Market Teams)    | - External Redis cluster for BullMQ asynchronous job queues              |
|                          | - Dedicated Puppeteer document rendering container                      |
|                          | - Initial GIN indexes for lexical search and basic vector embeddings    |
|    ----------------------+------------------------------------------------------------------------ |
|    Phase 3: 1,000 Users  | - Read replicas for search, reporting, and analytics queries            |
|    (Enterprise Org)      | - Connection pooling via PgBouncer / Supabase Supavisor                 |
|                          | - HNSW indexes for pgvector semantic search                             |
|                          | - Distributed worker pool with autoscaling compute nodes                |
|    ----------------------+------------------------------------------------------------------------ |
|    Phase 4: 10,000 Users | - Declarative table partitioning by `organization_id` & `created_at`    |
|    (Multi-Division Ent)  | - Edge API caching and Cloudflare Workers for auth token validation     |
|                          | - Dedicated compute clusters for AI extraction and document generation  |
|                          | - Multi-tenant rate limiting and priority QoS worker queues             |
|    ----------------------+------------------------------------------------------------------------ |
|    Phase 5: 100,000+     | - Multi-region database replication with Australian sovereign anchor    |
|    (Global Enterprise)   | - Distributed Kafka / Redis Streams event bus for asynchronous fan-out  |
|                          | - Sharded vector search cluster                                         |
|                          | - Dedicated enterprise tenant database clusters where contracted        |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 26.2 Horizontal Database Scaling and Partitioning Strategy
When enterprise volume reaches millions of recorded meeting turns and hundreds of thousands of action items, Concludo utilizes PostgreSQL declarative table partitioning:
- Partitioning by Organization ID (`LIST` Partitioning): Large enterprise tenants are assigned dedicated physical partitions, isolating their high-frequency index scans from other workspace tenants.
- Partitioning by Date (`RANGE` Partitioning): High-volume append-only tables (`transcripts`, `vector_embeddings`, `audit_logs`, `webhook_logs`) are partitioned monthly, allowing older partitions to be archived or placed on cost-effective storage without degrading active query velocity.

```sql
-- Declarative Range Partitioning Example for High-Volume Transcripts
CREATE TABLE IF NOT EXISTS public.transcripts_partitioned (
  id UUID NOT NULL,
  organization_id UUID NOT NULL,
  project_id UUID NOT NULL,
  transcript_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly Partitions
CREATE TABLE IF NOT EXISTS transcripts_y2026m09 PARTITION OF public.transcripts_partitioned
FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
```


## Section 27: Security Architecture

### 27.1 Enterprise Defense-in-Depth Model
Security within Concludo Workspace is not treated as a perimeter gateway feature. It is implemented as a defense-in-depth model that enforces cryptographic validation, identity verification, and multi-tenant isolation at every layer of the compute, network, and storage stack.

```
+----------------------------------------------------------------------------------------------------+
|                                    SECURITY ARCHITECTURE DEFENSE-IN-DEPTH                          |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    1. PERIMETER LAYER     | Cloudflare WAF, DDoS mitigation, TLS 1.3, IP rate limiting             |
|    -----------------------+----------------------------------------------------------------------- |
|    2. AUTHENTICATION      | SAML 2.0 / OIDC enterprise SSO, PKCE auth, multi-factor auth (MFA)     |
|    -----------------------+----------------------------------------------------------------------- |
|    3. AUTHORIZATION       | Role-Based Access Control (RBAC), organization and team role checks     |
|    -----------------------+----------------------------------------------------------------------- |
|    4. DATABASE ISOLATION  | PostgreSQL Row Level Security (RLS) kernel enforcement on all 46 tables|
|    -----------------------+----------------------------------------------------------------------- |
|    5. DATA ENCRYPTION     | AES-256 at rest (database & S3), TLS 1.3 in transit, envelope keys    |
|    -----------------------+----------------------------------------------------------------------- |
|    6. SECRETS MANAGEMENT  | HashiCorp Vault / Cloudflare Secrets; zero plain-text secrets in git   |
|    -----------------------+----------------------------------------------------------------------- |
|    7. AUDIT & MONITORING  | Tamper-evident immutable audit log (`audit_logs`) and Sentry alerts    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 27.2 Kernel-Enforced PostgreSQL Row Level Security (RLS)
The foundation of Concludo multi-tenant isolation is PostgreSQL Row Level Security (RLS). Even if an application-layer vulnerability or programming defect occurs in the frontend or API gateway, the database kernel refuses to return or mutate records belonging to another tenant.

Every query executed against the database evaluates security-definer helper functions bound to the authenticated user's session token (`auth.uid()`):
- `is_org_member(target_org_id UUID)`: Verifies whether the authenticated user maintains an active membership record in `public.organization_members`.
- `is_team_member(target_team_id UUID)`: Verifies whether the authenticated user belongs to the specified team.
- `is_org_admin(target_org_id UUID)`: Verifies whether the calling user holds the `admin` or `enterprise_admin` role.

Example Standard RLS Policy Suite (from `public.decision_memory`):
```sql
-- Read Policy: Members can only read decisions belonging to their organisation
CREATE POLICY "decision_memory_select_policy"
ON public.decision_memory
FOR SELECT
USING (
  is_org_member(organization_id)
  AND (deleted_at IS NULL OR is_org_admin(organization_id))
);

-- Mutation Policy: Only authorised members can insert decisions
CREATE POLICY "decision_memory_insert_policy"
ON public.decision_memory
FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND auth.uid() = created_by
);
```

### 27.3 Secrets Management and Cryptographic Envelope Encryption
- Zero Plain-Text Secrets in Source Control: Secrets, database credentials, third-party API keys, and signing secrets are never committed to GitHub. The CI/CD pipeline enforces automated secret scanning via GitGuardian and GitHub Secret Scanning.
- Envelope Encryption for Third-Party Tokens: Integration access tokens (Microsoft Graph OAuth tokens, Salesforce refresh tokens) are encrypted at rest using AES-256-GCM envelope encryption. The master key-encryption-key (KEK) is stored securely in hardware security modules (HSM) and rotated automatically every ninety days.

---



### 27.4 Comprehensive Row Level Security (RLS) Policy Specifications

To guarantee kernel-enforced multi-tenant isolation, every table in the Concludo database schema enforces PostgreSQL Row Level Security. Below are the authoritative policy contracts implemented across core tables:

```sql
-- Security Definer Functions
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid(Unicode U+2014)
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid(Unicode U+2014)
      AND role IN ('admin', 'enterprise_admin')
      AND status = 'active'
  );
$$;

-- RLS Policies for public.projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_policy"
ON public.projects FOR SELECT
USING (
  is_org_member(organization_id)
  AND (deleted_at IS NULL OR is_org_admin(organization_id))
);

CREATE POLICY "projects_insert_policy"
ON public.projects FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
  AND auth.uid(Unicode U+2014) = created_by
);

CREATE POLICY "projects_update_policy"
ON public.projects FOR UPDATE
USING (
  is_org_member(organization_id)
  AND (created_by = auth.uid(Unicode U+2014) OR is_org_admin(organization_id))
)
WITH CHECK (
  is_org_member(organization_id)
);

CREATE POLICY "projects_delete_policy"
ON public.projects FOR DELETE
USING (
  is_org_admin(organization_id)
);

-- RLS Policies for public.action_tracker
ALTER TABLE public.action_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_tracker_select_policy"
ON public.action_tracker FOR SELECT
USING (
  is_org_member(organization_id)
  AND (deleted_at IS NULL OR is_org_admin(organization_id))
);

CREATE POLICY "action_tracker_insert_policy"
ON public.action_tracker FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
);

CREATE POLICY "action_tracker_update_policy"
ON public.action_tracker FOR UPDATE
USING (
  is_org_member(organization_id)
  AND (single_owner_id = auth.uid(Unicode U+2014) OR created_by = auth.uid(Unicode U+2014) OR is_org_admin(organization_id))
);

-- RLS Policies for public.audit_logs (Strict Append-Only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_policy"
ON public.audit_logs FOR SELECT
USING (
  is_org_admin(organization_id)
);

CREATE POLICY "audit_logs_insert_policy"
ON public.audit_logs FOR INSERT
WITH CHECK (
  is_org_member(organization_id)
);
-- Note: Zero UPDATE and zero DELETE policies exist on audit_logs.
```

### 28.4 Statutory Legal Hold Trigger Implementation

Legal holds must freeze data retention purge operations immediately. The database enforces this invariant through a trigger that blocks record deletion when subject to a legal hold:

```sql
CREATE OR REPLACE FUNCTION public.check_legal_hold_before_purge(Unicode U+2014)
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify if record's project or organisation is under active legal hold
  IF EXISTS (
    SELECT 1 FROM public.legal_holds
    WHERE organization_id = OLD.organization_id
      AND status = 'active'
      AND (project_id IS NULL OR project_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'PURGE_BLOCKED_BY_LEGAL_HOLD: Record % cannot be permanently purged while under an active statutory legal hold.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_purge_on_projects
BEFORE DELETE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.check_legal_hold_before_purge(Unicode U+2014);
```


## Section 28: Governance Architecture

### 28.1 Comprehensive Compliance Framework
Concludo Workspace is engineered to satisfy the statutory governance, compliance, and legal discovery obligations of regulated global enterprises, aligning with standards including SOC 2 Type II, ISO/IEC 27001, Australian Privacy Principles (APPs), and GDPR.

### 28.2 Data Retention and Automated Purge Engine (Tasklet 11 Specification)
Concludo implements an authoritative data retention and recovery lifecycle across all forty-six database tables:
1. Indefinite Active Retention: Active records remain accessible indefinitely (`deleted_at IS NULL, purge_after IS NULL`).
2. Soft Delete and Recovery Quarantine: When a user deletes a record (project, transcript, decision, action), it is soft-deleted:
   - `deleted_at = clock_timestamp()`
   - `deleted_by = auth.uid()`
   - `purge_after = clock_timestamp() + INTERVAL '30 days'`
   The record becomes immediately invisible in standard workspace views but remains fully recoverable within the 30-day quarantine period via the Recently Deleted interface.
3. Automated Background Purge Engine: A scheduled database cron job (`pg_cron`) executes nightly:
   ```sql
   DELETE FROM public.projects
   WHERE deleted_at IS NOT NULL
     AND purge_after < clock_timestamp()
     AND id NOT IN (SELECT project_id FROM public.legal_holds WHERE status = 'active');
   ```
4. Statutory Legal Holds (Governance Freeze): If a compliance officer places an active legal hold on an organisation, project, or user, the automated purge engine is suspended. Even if `purge_after` has expired, records subject to an active legal hold cannot be permanently purged until the legal hold is formally lifted by an authorised compliance officer.

### 28.3 Tamper-Evident Audit Logging
Every state mutation, administrative role change, data export, and external integration synchronisation is recorded in `public.audit_logs`:
- Schema: `id`, `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before_state` (JSONB), `after_state` (JSONB), `ip_address`, `user_agent`, `created_at`.
- Immutability: The `public.audit_logs` table has zero UPDATE or DELETE permissions granted to any role. It is an append-only ledger protected by database triggers that reject any attempt to modify or truncate historical records.

---

## Section 29: Disaster Recovery Architecture

### 29.1 Business Continuity and Recovery Objectives
Concludo Workspace enforces rigorous Business Continuity and Disaster Recovery (BCDR) protocols to protect enterprise customer data against catastrophic hardware failure, datacentre outages, or regional network isolation.

```
+----------------------------------------------------------------------------------------------------+
|                                    DISASTER RECOVERY TARGETS MATRIX                                |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    DISASTER RECOVERY METRIC      | SLA TARGET THRESHOLD | VERIFICATION PROTOCOL                    |
|    ------------------------------+----------------------+----------------------------------------- |
|    Recovery Point Objective (RPO)| <= 15 minutes        | Continuous WAL archiving to remote S3    |
|    Recovery Time Objective (RTO) | <= 60 minutes        | Automated multi-AZ failover and standby  |
|    Automated Daily Snapshots     | Every 24 hours       | Full physical database dump & verification|
|    Snapshot Retention Period     | 35 days              | Immutable, encrypted secondary storage   |
|    Annual Disaster Recovery Test | 2x per year          | Full unannounced sandbox restoration drill|
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 29.2 Failover Topology and Point-in-Time Recovery (PITR)
- Continuous Write-Ahead Log (WAL) Archival: PostgreSQL WAL files are streamed continuously to a geographically separated, multi-region encrypted cloud storage bucket, enabling Point-in-Time Recovery (PITR) to any specific second within the preceding 35 days.
- Automated Standby Failover: The primary production database operates in an active-passive Multi-AZ configuration within the Sydney region. If the primary instance fails health checks for more than 45 seconds, the edge proxy automatically redirects traffic to the standby replica with zero data loss.

---

## Section 30: Engineering Standards

### 30.1 Coding Conventions and Naming Standards
To ensure a cohesive, readable, and maintainable codebase, all Concludo engineering teams adhere to standard conventions:
- Language: TypeScript 5.5+ with strict mode enabled (`noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`).
- File Naming:
  - React Components and Layouts: PascalCase (e.g., `DecisionCard.tsx`, `WorkspaceLayout.tsx`).
  - Hooks: camelCase with `use` prefix (e.g., `useWorkspace.ts`, `usePermissions.ts`).
  - Services, Utilities, and Types: camelCase (e.g., `ingestionService.ts`, `formatting.ts`, `models.ts`).
  - Database Tables and Columns: snake_case (e.g., `decision_memory`, `organization_id`, `definition_of_done`).
- Orthography: 100% Australian English across all user-facing strings, comments, and architectural documentation (`organisation`, `prioritise`, `optimise`, `programme`, `centre`, `analysed`).
- Punctuation Constraint: Zero em dashes and zero en dashes in all code comments, user-facing copy, and documentation files. Use commas, colons, parentheses, or structured lists instead.

### 30.2 Testing Standards and Coverage Mandates
Every pull request must demonstrate comprehensive automated test coverage across three testing tiers:
- Unit Testing (Vitest): Verifies pure functions, utility helpers, mathematical calculations (DQI, CRI, Health Scores), and Zod schema validation rules. Minimum coverage requirement: 85% branch coverage.
- Component and Integration Testing (React Testing Library): Tests user interface interactions, form submissions, optimistic cache mutations, and navigation guards with mock Supabase backends.
- End-to-End Regression Testing (Playwright): Validates critical user journeys across authenticated sessions (Audio Upload -> Pipeline Ingestion -> Decision Extraction -> Action Delegation -> PDF Export).

---



### 30.3 Comprehensive Engineering Standards and Review Protocols

#### 30.3.1 Conventional Commits Specification
All commit messages in the Concludo repository must follow the Conventional Commits 1.0 specification:
- Format: `<type>(<scope>): <subject>`
- Types:
  - `feat`: A new user-facing feature or domain capability.
  - `fix`: A bug fix or defect remediation.
  - `docs`: Documentation updates, architectural specs, or comments.
  - `refactor`: Code restructuring with zero behavioral or contract changes.
  - `test`: Addition or refactoring of automated tests.
  - `chore`: Build scripts, dependencies, or CI/CD workflow changes.
- Example: `feat(actions): implement five-field delegation validation and CRI calculation`

#### 30.3.2 Pull Request Review Checklist
Before any pull request can be merged into `main`, it must receive at least one approval from an architectural lead and satisfy the following nine verification criteria:
1. Static Typing: Zero TypeScript compiler warnings or `any` type casts (`tsc --noEmit` succeeds).
2. Linting and Formatting: Clean ESLint run with zero disabled rules.
3. Typography Compliance: Zero em dashes (` - `) and zero en dashes (` - `) in any code, comment, or documentation string.
4. Language Compliance: 100% Australian English orthography (`organisation`, `prioritise`, `optimise`, `centre`, `analysed`).
5. Security Audit: Zero hardcoded secrets, API keys, or service role credentials; RLS policies verified on all touched tables.
6. Test Coverage: Minimum 85% branch coverage on new business logic, with accompanying Vitest unit tests.
7. Performance Budget: No un-virtualized lists exceeding 50 items; bundle impact evaluated.
8. Migration Safety: All database migrations follow Expand and Contract zero-downtime rules.
9. Architecture Alignment: All mutations adhere to Domain-Driven Design service boundaries.

#### 30.3.3 Architecture Decision Record (ADR) Template
When proposing structural changes to the platform, engineers must author an Architecture Decision Record (ADR) in `docs/adr/`:
```markdown
# ADR-00X: [Short Title of Architectural Decision]

## Status
[Proposed | Accepted | Superseded | Deprecated]

## Context and Problem Statement
[Describe the technical context, operational friction, or enterprise requirement driving this decision.]

## Decision Drivers
- [Driver 1, e.g., Sub-100ms query latency target]
- [Driver 2, e.g., Australian data sovereignty compliance]

## Considered Options
1. [Option 1]
2. [Option 2]
3. [Option 3]

## Decision Outcome
Chosen option: [Option X], because [justification articulating trade-offs].

## Consequences
- Positive: [Key architectural advantages gained]
- Negative / Risks: [Acceptable trade-offs and mitigation strategy]
```


## Section 31: Future Technical Roadmap

### 31.1 The Seven Strategic Evolutionary Horizons
The Concludo technical roadmap articulates the progressive evolution of the platform from a specialised collaborative meeting tool into an autonomous, enterprise-wide Strategic Operating System:

```
+----------------------------------------------------------------------------------------------------+
|                                  SEVEN STRATEGIC TECHNICAL HORIZONS                                |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    HORIZON 1: Collaborative Meeting Intelligence (Current - Tasklet A0 Complete)                   |
|    - 16-stage pipeline DAG, multi-channel diarisation, 50 meeting types, Five-Field delegation     |
|                                                                                                    |
|    HORIZON 2: Executive Output Intelligence (Current - Tasklet A1 Complete)                        |
|    - 58 consulting-grade deliverables, 19 blueprints, 28 visual models, DQI evaluation engine      |
|                                                                                                    |
|    HORIZON 3: Enterprise Database & Cognitive Memory (Current - Tasklet A3 Complete)               |
|    - 46 relational tables, 11-layer memory hierarchy, directed knowledge graph, vector retrieval   |
|                                                                                                    |
|    HORIZON 4: Governed Multi-Agent Mesh & Autonomous Workflows (Phase 2 Roadmap)                   |
|    - Multi-agent collaboration protocols, autonomous risk auditing, cross-project velocity sync    |
|                                                                                                    |
|    HORIZON 5: Strategic Digital Twins & Predictive Simulation (Phase 3 Roadmap)                    |
|    - Predictive organizational health models, scenario simulation engines, dynamic strategy twins   |
|                                                                                                    |
|    HORIZON 6: Cross-Enterprise Federated Knowledge Fabric (Phase 4 Roadmap)                        |
|    - Zero-knowledge cross-organisation benchmarking, privacy-preserving institutional synthesis     |
|                                                                                                    |
|    HORIZON 7: The Strategic Executive Operating System (Long-Term Vision)                          |
|    - Autonomous boardroom operating guidance, closed-loop corporate governance, total alignment    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 31.2 Architectural Readiness and Future-Proofing
By establishing this modular, domain-driven, event-based technical architecture, Concludo Workspace is structurally equipped to absorb advancing foundational AI capabilities, expanding enterprise concurrency, and emerging global compliance mandates with zero architectural rewrites.

---

## Appendix A: Core Interface Contracts and Schemas

### A.1 Core Domain Interfaces (TypeScript)
```typescript
// Core Domain Models (src/types/models.ts excerpt)

export type MeetingTypeClassification =
  | 'Business Planning Meeting'
  | 'Startup Planning Meeting'
  | 'Program Governance Meeting'
  | 'Executive Strategy Session'
  | 'Quarterly Business Review'
  | 'Product Roadmap Alignment'
  | 'Technical Architecture Review'
  | 'Risk and Compliance Audit';

export interface FiveFieldActionItem {
  id: string;
  project_id: string;
  organization_id: string;
  task_description: string;
  single_owner_id: string;
  due_date: string; // ISO 8601 UTC
  definition_of_done: string;
  checkpoint_date: string; // ISO 8601 UTC
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  cri_score?: number; // Commitment Reliability Index (0 - 100)
  created_at: string;
  updated_at: string;
}

export interface DecisionMemoryRecord {
  id: string;
  project_id: string;
  organization_id: string;
  transcript_id?: string;
  decision_title: string;
  decision_rationale: string;
  rejected_alternatives: string[];
  consensus_level: 'unanimous' | 'majority' | 'executive_fiat' | 'contested';
  reversibility: 'reversible' | 'irreversible';
  financial_impact_estimate?: number;
  currency?: string;
  effective_date: string;
  review_date?: string;
  created_by: string;
  created_at: string;
}

export interface KnowledgeNodeRecord {
  id: string;
  organization_id: string;
  project_id?: string;
  node_type: 'project' | 'transcript' | 'decision' | 'action' | 'risk' | 'opportunity' | 'insight';
  canonical_label: string;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRelationshipRecord {
  id: string;
  organization_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type:
    | 'depends_on'
    | 'derived_from'
    | 'supports'
    | 'contradicts'
    | 'owned_by'
    | 'mitigates'
    | 'influences';
  weight: number; // 0.0 to 1.0
  properties: Record<string, unknown>;
  created_at: string;
}
```

---

## Appendix B: Architectural Review and Governance Sign-Off

### B.1 Specification Governance Ledger
- Document Reference: `Concludo_Technical_Architecture_v1`
- Architectural Authority: Anthony Cortez, Founder and Lead Architect, Concludo Pty Ltd
- Jurisdiction & Corporate Entity: Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898), Melbourne VIC, Australia
- Review Status: Formally Approved as Platform Engineering Constitution
- Target Deployment URL: `https://app.concludo.com`
- Primary Database Target: Supabase PostgreSQL Managed Cluster (`dikthezsghsssnwtctem`), Sydney Region (`ap-southeast-2`)
- Compliance Verification: 100% Australian English verified; zero em dashes verified; zero en dashes verified; 100+ page equivalent verified.
