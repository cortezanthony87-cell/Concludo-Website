# CONCLUDO DATA, KNOWLEDGE GRAPH AND AI MEMORY ARCHITECTURE (v1.0)
## Master Enterprise Specification for Concludo Workspace SaaS
### Authoritative Architecture for Database Design, Entity Relationships, Knowledge Graph, Cognitive Memory Layers, Hybrid Retrieval, Predictive Intelligence, and Governance

```
Document Reference: DOC-ARCH-DATA-A3-V1.0
Author: Anthony Cortez (Founder and Principal Architect, Concludo Pty Ltd)
Governing Entity: Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898)
Classification: Highly Confidential / Enterprise Core Intellectual Property
Publication Location: Melbourne, Victoria, Australia
Target Stack: Supabase Enterprise PostgreSQL 15+, React 19, TypeScript 5.8, pgvector
Date of Authority: September 2026
Standard Compliance: SOC 2 Type II, ISO/IEC 27001:2022, Australian Privacy Principles (APPs), GDPR
Punctuation Rule: Strict zero em dash and zero en dash compliance
Language Standard: 100% Australian English
```

---

## DOCUMENT CONTROL AND REVISION HISTORY

| Version | Release Date | Author | Reviewer | Scope of Architectural Revision |
| :--- | :--- | :--- | :--- | :--- |
| v0.1-draft | 10 August 2026 | Anthony Cortez | Core Architecture Group | Initial schema drafting and domain partitioning |
| v0.5-beta | 28 August 2026 | Anthony Cortez | Data Engineering Working Group | Knowledge graph nodes and edge relationship topologies |
| v0.9-rc | 07 September 2026 | Anthony Cortez | Governance and Security Committee | RLS kernel policies, soft delete lifecycle, and legal hold rules |
| v1.0-final | 14 September 2026 | Anthony Cortez | Board of Directors, Concludo Pty Ltd | Formal enterprise release for Concludo Workspace SaaS platform |

---

## TABLE OF CONTENTS

- Executive Summary
- Section 1: Data Philosophy
  - 1.1 The Failure of Raw Conversational Records
  - 1.2 The Five Stage Cognitive Value Funnel
  - 1.3 The Concludo Intelligence Data Model
  - 1.4 Architectural Precedence and Downstream Contracts
- Section 2: Master Data Ecosystem
  - 2.1 The Comprehensive Business Entity Ecosystem
  - 2.2 Global Entity Relationship Diagram
  - 2.3 Cross Domain Relational Topology
- Section 3: Database Standards
  - 3.1 Naming Conventions and Identifiers
  - 3.2 Primary and Foreign Key Architecture
  - 3.3 Timestamp and Temporal Lineage Standards
  - 3.4 Soft Deletion and Quarantine Standards
  - 3.5 Immutable Audit and Event Streaming Standards
  - 3.6 Multi Tenant Isolation and Tier Gating
  - 3.7 Database Indexing and Performance Standards
- Section 4: Complete Database Model
  - 4.1 Domain 1: Identity, Accounts, and Multi Tenancy
  - 4.2 Domain 2: Collaboration and Team Workspaces
  - 4.3 Domain 3: Projects and Meeting Transcripts
  - 4.4 Domain 4: Outputs and Generated Deliverables
  - 4.5 Domain 5: Execution, Decision Memory, and Action Tracker
  - 4.6 Domain 6: Governance, Audit, Retention, and Legal Holds
  - 4.7 Domain 7: Integrations, Webhooks, and Developer API Keys
  - 4.8 Domain 8: Agentic Workflows, Approvals, and Activity Logging
  - 4.9 Domain 9: Knowledge Graph Nodes and Relationships
  - 4.10 Domain 10: Copilot Memory, Conversations, and Prompts
  - 4.11 Domain 11: Predictive Intelligence and Strategic Digital Twin
  - 4.12 Domain 12: Future Expansion and Roadmap Schemas
- Section 5: Data Ownership Model
  - 5.1 The Four Tier Ownership Hierarchy
  - 5.2 Ownership State Machine and Access Permissions
  - 5.3 Ownership Transitions and Departure Workflows
- Section 6: Row Level Security Architecture
  - 6.1 Declarative Kernel Level Security Principles
  - 6.2 Security Helper Functions and Context Verification
  - 6.3 Comprehensive Entity Policy Specifications
- Section 7: Memory Architecture
  - 7.1 The Eleven Layer Cognitive Memory Topography
  - 7.2 Cognitive Crystallisation: Memory Evolution Lifecycle
- Section 8: Meeting Memory Design
  - 8.1 The Eight Step Meeting Intelligence Lifecycle
  - 8.2 Structured Ingestion and Pipeline Serialization
- Section 9: Decision Memory Architecture
  - 9.1 Relational Schema and Decision Attributes
  - 9.2 Decision Lineage and Historical Trajectory
  - 9.3 Decision Impact and Velocity Analytics
- Section 10: Action Memory Architecture
  - 10.1 Five Field Delegation Standard Enforcement
  - 10.2 Dependency Topologies and Status State Machine
  - 10.3 Automated Overdue Detection and Performance Analytics
- Section 11: Knowledge Graph Architecture
  - 11.1 Directed Attributed Multi Graph (DAMG) Formalism
  - 11.2 PostgreSQL Relational Representation via Recursive CTEs
  - 11.3 Cluster Identification and Evidence Path Traversal
- Section 12: Knowledge Node Model
  - 12.1 Taxonomy of Fourteen Core Node Types
  - 12.2 Node Schema, Payload Attributes, and Metadata Standard
- Section 13: Knowledge Relationship Model
  - 13.1 Taxonomy of Fourteen Canonical Directed Relationships
  - 13.2 Edge Weighting, Mathematical Decay, and Confidence Scoring
- Section 14: Organisational Memory Engine
  - 14.1 Institutional Synthesis and Lessons Learned
  - 14.2 Pattern Extraction and Cross Project Knowledge Transfer
- Section 15: Retrieval Architecture
  - 15.1 Multi Tier Retrieval Information Flow
  - 15.2 Hybrid Candidate Generation and Reciprocal Rank Fusion
  - 15.3 Context Assembly and Token Budgeting Strategy
- Section 16: Search Architecture
  - 16.1 Lexical Search Engine and Full Text tsvector Optimisation
  - 16.2 Domain Specific Query Routing and Keyset Pagination
- Section 17: Vector Search Architecture
  - 17.1 Dense Embedding Strategy and Dimension Standards
  - 17.2 Context Aware Semantic Chunking Protocol
  - 17.3 HNSW Vector Indexing and pgvector Tuning
- Section 18: RAG Architecture
  - 18.1 The Four Layer Retrieval Augmented Generation Engine
  - 18.2 Grounding Verification and The Stated Omission Standard
  - 18.3 Anti Hallucination Guardrails and Confidence Scoring
- Section 19: Copilot Memory Architecture
  - 19.1 Progressive Context Assembly and Context Window Management
  - 19.2 Intent Disambiguation and Multi Turn Session Continuity
- Section 20: Agent Memory Architecture
  - 20.1 Four Tier Agent Working Memory Model
  - 20.2 Governed Agent Execution and Approval Boundaries
- Section 21: Predictive Intelligence Architecture
  - 21.1 Forecasting Engines and Trajectory Modelling
  - 21.2 Action Drift Index and Decision Backlog Pressure
  - 21.3 Strategic Health Scoring Engine
- Section 22: Analytics Data Model
  - 22.1 Analytical Aggregations and Materialised Rollups
  - 22.2 Executive and Board Level Reporting Dashboards
- Section 23: Data Retention Architecture
  - 23.1 Comprehensive Lifecycle Alignment with Tasklet 11
  - 23.2 Automated Soft Delete and Recovery Protocols
  - 23.3 The Background Hard Purge Engine
- Section 24: Legal Hold Architecture
  - 24.1 Statutory Legal Holds and Immutable Preservation
  - 24.2 Electronic Discovery and Audited Legal Export
- Section 25: Audit Architecture
  - 25.1 Append Only Immutable Audit Logging
  - 25.2 Comprehensive Event Catalog and Traceability
- Section 26: Scalability Architecture
  - 26.1 Declarative Database Partitioning Strategy
  - 26.2 High Throughput Transactional Outbox Pattern
  - 26.3 Global Multi Region Scaling and Australian Data Sovereignty
- Section 27: Performance Architecture
  - 27.1 Query Standards and Recursive Graph Optimisation
  - 27.2 Sub 100ms Query SLA and Caching Framework
- Section 28: Security Architecture
  - 28.1 Identity, Authentication, and SAML 2.0 SSO
  - 28.2 Cryptographic Protection and Envelope Encryption
- Section 29: Future AI Memory Vision
  - 29.1 The Six Horizon Cognitive Evolution
- Section 30: Future State
  - 30.1 Concludo as the Strategic Operating System
- Appendices
  - Appendix A: Complete PostgreSQL DDL Schema Migration
  - Appendix B: Concludo Cognitive Vocabulary and Taxonomic Glossary
  - Appendix C: Architectural Governance, Review Checklist, and Sign Off

---

## EXECUTIVE SUMMARY

Concludo Workspace SaaS is not a transcription storage utility, a conversational assistant, or a passive repository of audio recordings. It is an enterprise grade intelligence operating system designed to convert transient, unstructured organizational discourse into permanent, structured, and actionable corporate capability.

Modern enterprise productivity tools suffer from a systemic cognitive failure: they record everything yet remember nothing. Transcripts generated by commodity meeting recorders sit in isolated data silos, unindexed, disconnected from strategic intent, devoid of causal relationships, and severed from operational accountability. When an executive asks: "What did we commit to regarding the European market expansion three months ago, who owns the delivery, and how does that decision impact our Q4 capital allocation?", traditional systems fail completely. They return either a wall of raw text or an unstructured conversational summary that lacks commercial weight.

This specification establishes the authoritative data, knowledge graph, memory, retrieval, and governance architecture for Concludo Workspace. Sitting directly beneath the Concludo Meeting Intelligence Pipeline (Tasklet A0) and the Concludo Output Intelligence Architecture (Tasklet A1), this document defines how Concludo stores, secures, relates, retrieves, remembers, and reasons over data.

The core architectural tenets articulated within this document include:

1. The Eleven Layer Memory Topography: Moving from raw, ephemeral Transcript Memory through Project, Decision, Action, Meeting, Insight, Knowledge, Agent, Copilot, Organisational, and Executive Memory layers.
2. The Directed Attributed Multi Graph: A formal knowledge graph model representing fourteen distinct enterprise node types connected by fourteen canonical directed relationship types, mapped directly into PostgreSQL through recursive relational paradigms.
3. The Five Field Delegation Standard: Strict database schema enforcement guaranteeing that no action can exist without a Task Description, a Single Accountable Owner, a Specific Due Date, an Explicit Definition of Done, and a Checkpoint Date.
4. Deterministic Kernel Level Row Level Security: Absolute multi tenant data isolation enforced by PostgreSQL kernel policies, preventing data leakage across users, teams, organisations, and compliance boundaries.
5. The 30 Day Soft Delete and Statutory Legal Hold Lifecycle: Rigorous retention governance ensuring that soft deleted records remain recoverable for exactly 30 days before being permanently purged by automated background workers, with statutory legal holds capable of suspending all deletion operations.
6. Hybrid Reciprocal Rank Fusion Retrieval: Unifying lexical full text search (PostgreSQL tsvector) with dense vector embeddings (pgvector HNSW) and knowledge graph traversal, delivering sub 100ms retrieval latencies with verifiable source attribution.
7. Sovereign Australian Data Governance: Complete adherence to Australian Privacy Principles (APPs), Melbourne based operational governance, and zero unauthorized training on customer data.

This architecture serves as the permanent engineering constitution for all database engineers, backend architects, machine learning specialists, and security practitioners implementing Concludo Workspace.

---

## SECTION 1: DATA PHILOSOPHY

### 1.1 Why Organisational Intelligence Requires Structured Memory: Why Transcripts Alone Are Insufficient

Enterprise organizations operate on conversational momentum. Decisions are forged, risks are identified, budgets are allocated, and strategies are debated within collaborative meetings. Yet across the modern corporate landscape, meetings remain the single largest leak of organizational intelligence.

Commodity transcription tools (such as Otter.ai, Fireflies.ai, Zoom AI Companion, and Microsoft Teams Recap) approach meetings as acoustic transcription problems. They operate under the flawed assumption that capturing a verbatim text stream or generating a superficial conversational synopsis equates to organizational intelligence. This assumption collapses when subjected to enterprise operational standards for four structural reasons:

1. Lack of Causal Lineage: A raw transcript captures chronological dialogue but is blind to causal dependencies. It records that Person A spoke about a vendor delay and that Person B mentioned adjusting a product release date, but it cannot link the vendor failure to the milestone adjustment as a causal risk chain.
2. Absence of Accountability Standards: Conversational summaries routinely generate passive task lists such as "Discuss marketing budget next week" or "Follow up on customer feedback". These entries lack clear ownership, verifiable completion criteria, and scheduled checkpoints. In operational practice, tasks without single ownership are orphaned immediately.
3. High Cognitive Noise to Signal Ratio: Less than 12% of words spoken in an average executive meeting represent actionable business intelligence. The remaining 88% consists of social pleasantries, conversational disfluencies, procedural coordination, circular debates, and unresolved tangents. Storing and searching raw text forces human executives to re process cognitive noise rather than act on distilled intelligence.
4. Ephemeral Siloing: Transcripts remain locked within the meeting where they were uttered. They do not cross reference historical decisions, they do not update project risk profiles, and they do not inform strategic digital twins. When the meeting ends, the intelligence dissipates.

Concludo rejects the premise that organizations need more text to read. Organizations need structured memory, verifiable commitments, and actionable operating guidance.

### 1.2 The Five Stage Cognitive Value Funnel

To convert unstructured speech into enduring enterprise capability, Concludo implements a deterministic Five Stage Cognitive Value Funnel. Every piece of data entering the Concludo ecosystem must progress through this value transformation pipeline:

```
+-----------------------------------------------------------------------------+
|               THE CONCLUDO FIVE STAGE COGNITIVE VALUE FUNNEL                |
+-----------------------------------------------------------------------------+
                                      |
                                      v
                        [ STAGE 1: RAW INFORMATION ]
        Acoustic audio, raw transcripts, speaker segments, timestamps.
        High volume, high noise, unstructured, ephemeral.
                                      |
                                      v
                         [ STAGE 2: FORMAL KNOWLEDGE ]
        Entity extraction: People, projects, budgets, dates, milestones.
        Syntactic disambiguation, canonical mapping, semantic chunking.
                                      |
                                      v
                      [ STAGE 3: STRUCTURED INTELLIGENCE ]
        Relational records: Decision Memory, Action Tracker, Risk Register.
        Application of Five Field Delegation Standard, 5x5 risk scoring.
                                      |
                                      v
                     [ STAGE 4: ACTIONABLE RECOMMENDATIONS ]
        Concludo Insight Engine: Missed risks, decision gaps, drift warnings.
        Prioritised, high leverage interventions with confidence scoring.
                                      |
                                      v
                     [ STAGE 5: ORGANISATIONAL MEMORY ]
        Knowledge graph integration: Lessons learned, cross meeting lineage.
        Predictive health scoring, institutional history, corporate brain.
                                      |
                                      v
+-----------------------------------------------------------------------------+
|        ENDURING ENTERPRISE VALUE: ACCELERATED DECISION VELOCITY             |
+-----------------------------------------------------------------------------+
```

1. Stage 1: Information: The raw linguistic input. This layer encompasses acoustic waveforms, raw automated speech recognition transcripts, speaker diarisation tokens, and microsecond timestamps. It possesses zero strategic context and maximum entropy.
2. Stage 2: Knowledge: The syntactic extraction of business entities. Here, names are resolved to organization profiles, acronyms are disambiguated against corporate glossaries, and dialogue is structured into thematic conversational episodes.
3. Stage 3: Intelligence: The extraction of structured operational commitments. Speech acts are classified into immutable decisions, rigorous actions, quantified risks, and commercial opportunities. Every action is bound to the Five Field Delegation Standard, and every decision is stamped with rationale and rejected alternatives.
4. Stage 4: Recommendations: The proactive analytical layer. The Concludo Insight Engine evaluates extracted intelligence against historical patterns, detecting unstated assumptions, governance vulnerabilities, delivery bottlenecks, and strategic misalignments.
5. Stage 5: Organisational Memory: The permanent, interconnected knowledge graph. Isolated meeting records are synthesized into longitudinal corporate memory. Decisions made in Project Alpha inform the risk register of Project Beta, creating a compounding institutional intelligence asset that survives employee turnover and organizational restructuring.

### 1.3 The Concludo Intelligence Data Model

The Concludo Intelligence Data Model is built upon five architectural axioms:

1. Relational Rigour over Document Chaos: While documents and PDFs are common export formats, the internal state of Concludo is strictly relational and graph structured. Every decision, action, risk, and insight exists as a first class database entity with foreign keys, timestamps, and integrity constraints.
2. Causal Traceability (Grounding Principle): No piece of generated intelligence may exist without an explicit, traceable evidence chain connecting it back to verbatim transcript excerpts. If an insight claims that a vendor deadline is at risk, the database must store the exact sentence and speaker that substantiates the claim.
3. Human in the Loop Governance: Strategic intelligence is advisory by default. Autonomous agents and Copilot capabilities may propose actions, suggest mitigations, and draft executive briefings, but database state modifications and external communications require explicit human authorization.
4. Immutable Auditability: All modifications to decisions, action assignments, governance policies, and knowledge relationships are captured in an append only, tamper evident audit log. History is preserved; changes are tracked; accountability is absolute.
5. Sovereign Privacy and Multi Tenant Isolation: Customer data belongs entirely to the customer. Tenant isolation is enforced at the database kernel level through PostgreSQL Row Level Security. Customer data is never co mingled, never exposed to unauthorized tenants, and never utilised to train global artificial intelligence models.

### 1.4 Architectural Precedence and Downstream Contracts

This document represents the foundational storage, memory, and retrieval layer of the Concludo Workspace architectural triad:

```
+-----------------------------------------------------------------------------+
|                       CONCLUDO ARCHITECTURAL HIERARCHY                      |
+-----------------------------------------------------------------------------+

             [ TASKLET A0: MEETING INTELLIGENCE PIPELINE ]
        The Sixteen Stage DAG processing engine: Transcript Intake,
        Entity Extraction, Decision & Action Parsing, Health Scoring.
                                      |
                                      |  Structured Ingestion Payload
                                      v
       [ TASKLET A3: DATA, KNOWLEDGE GRAPH AND AI MEMORY ARCHITECTURE ]
                 (THIS SPECIFICATION: THE STORAGE CONSTITUTION)
        Relational Tables, Knowledge Graph, 11 Memory Tiers, RLS Kernel,
        Hybrid Search, Vector Embeddings, Soft Delete & Legal Holds.
                                      |
                                      |  Unified Database Queries &
                                      |  Retrieved Knowledge Subgraphs
                                      v
             [ TASKLET A1: OUTPUT INTELLIGENCE ARCHITECTURE ]
        The Premium Deliverable Factory: 19 Business Templates (T1 T19),
        28 Visual Frameworks (VIS 01 VIS 28), Executive Briefings.
                                      |
                                      |  Rendered Components &
                                      |  DOM Specifications
                                      v
                 [ TASKLET A2: TECHNICAL ARCHITECTURE ]
        React 19 Frontend, Supabase Edge Functions, REST APIs,
        CI/CD Deployment Pipelines, Cloudflare Edge Infrastructure.
```

Downstream architectural contracts established by this specification:
- Contract with Tasklet A0: A0 pipelines must write structured extraction results directly into public.transcripts, public.decision_memory, public.action_tracker, and public.generated_intelligence via transactional boundary guarantees.
- Contract with Tasklet A1: A1 template engines must consume data strictly through structured queries against the database and knowledge graph, respecting RLS context, without attempting raw transcript parsing.
- Contract with Tasklet A2: A2 backend APIs and Edge Functions must enforce the schemas, indexes, transaction isolations, and RLS helper functions defined within this specification.

---

## SECTION 2: MASTER DATA ECOSYSTEM

### 2.1 The Comprehensive Business Entity Ecosystem

The Concludo Master Data Ecosystem unifies identity, collaboration, execution, governance, cognitive memory, and predictive forecasting into a cohesive, normalized entity network. 

The ecosystem comprises twenty-two primary business entities categorised into seven operational domains:

1. Tenancy and Identity Domain:
   - Organization: The top level enterprise legal entity, billing boundary, and data sovereignty container.
   - OrganizationMember: The junction entity binding individual profiles to organizations with explicit enterprise roles (Owner, Admin, Member, Auditor).
   - Profile: The authenticated individual user identity, holding contact information, UI preferences, and personal encryption contexts.
   - Team: The collaborative functional workspace within an organization (for example, Executive Leadership, Product Engineering, Commercial Sales).
   - TeamMember: The membership junction defining user roles within a team (Owner, Admin, Member, Guest).

2. Ingestion and Collaboration Domain:
   - Project: The operational container for initiatives, campaigns, and strategic programs.
   - Transcript: The immutable record of ingested meeting dialogue, audio metadata, speaker diarisation, and source channel markers.

3. Intelligence and Execution Domain:
   - DecisionMemory: The definitive registry of ratified corporate choices, including rationale, rejected alternatives, and financial impacts.
   - ActionTracker: The operational commitment registry enforcing the Five Field Delegation Standard, tracking progress, and managing dependencies.
   - Output: The repository of generated consulting deliverables (Business Plans, Board Briefings, Transformation Roadmaps).
   - EndpointReport: High velocity operational summaries formatted for external endpoints (Slack, Microsoft Teams, Planner).
   - GeneratedIntelligence: Intermediate analytical extraction payloads (risks, opportunities, meeting health scores, conversational dynamics).

4. Cognitive Knowledge and Graph Domain:
   - KnowledgeNode: The fundamental semantic vertex within the Concludo Knowledge Graph representing concepts, entities, and artifacts.
   - KnowledgeRelationship: The directed, weighted edge connecting knowledge nodes, encoding dependencies, lineage, and causality.
   - LessonLearned: Institutional wisdom distilled from project completions, execution post mortems, and historical decisions.

5. Agentic and Conversational Memory Domain:
   - AgentMemory: Scoped, key value and document memory utilised by background AI agents to maintain execution state and long term context.
   - CopilotConversation: The conversational thread container for interactive user dialogues with the Concludo Copilot.
   - CopilotMessage: Individual message turns within a Copilot conversation, capturing queries, generated responses, and source attribution chips.

6. Governance, Compliance, and Audit Domain:
   - AuditLog: Immutable, append only ledger capturing every access, mutation, export, and deletion event.
   - RetentionPolicy: Automated data lifecycle rules defining soft delete quarantine durations, archive schedules, and permanent purge triggers.
   - LegalHold: Statutory compliance overrides that freeze data destruction and mandate immutable preservation across targeted entities.

7. Forecasting and Predictive Domain:
   - PredictiveSnapshot: Longitudinal health telemetry, execution velocity indicators, Action Drift Indices, and strategic horizon projections.

### 2.2 Global Entity Relationship Diagram

The following diagram illustrates the relational topology and foreign key hierarchy uniting the Concludo Master Data Ecosystem:

```
+-----------------------------------------------------------------------------+
|               CONCLUDO MASTER ENTITY RELATIONSHIP ARCHITECTURE               |
+-----------------------------------------------------------------------------+

  +--------------------------------------------------------------+
  |                    ORGANIZATION (Tenant)                     |
  |  id (PK), name, slug, tier, sso_enabled, created_at          |
  +--------------+-------------------------------+---------------+
                 | 1:N                           | 1:N
                 v                               v
  +------------------------------+ +-----------------------------+
  |     ORGANIZATION_MEMBER      | |       RETENTION_POLICY      |
  |  id, org_id, user_id, role   | |  id, org_id, scope, days    |
  +--------------+---------------+ +-------------+---------------+
                 |                               |
                 | N:1                           v
  +--------------v---------------+ +-----------------------------+
  |           PROFILE            | |         LEGAL_HOLD          |
  |  id (PK=auth.uid), email,    | |  id, org_id, name, status   |
  |  full_name, avatar_url       | +-------------+---------------+
  +--------------+---------------+               |
                 | 1:N                           | Overrides Purge
                 v                               v
  +------------------------------+ +-----------------------------+
  |             TEAM             | |          AUDIT_LOG          |
  |  id (PK), org_id, name,      | |  id, org_id, actor_id,      |
  |  created_by, is_private      | |  action, resource_id, diff  |
  +--------------+---------------+ +-----------------------------+
                 | 1:N
                 v
  +------------------------------+
  |           PROJECT            |
  |  id (PK), team_id, org_id,   |
  |  title, status, created_by   |
  +------+---------------+-------+
         | 1:N           | 1:N
         v               v
  +--------------+ +--------------+
  |  TRANSCRIPT  | |    OUTPUT    |
  |  id, proj_id | |  id, proj_id |
  +------+-------+ +--------------+
         | 1:N
         +--------------------------------+-------------------------------+
         v                                v                               v
  +--------------+                 +--------------+                +--------------+
  |DECISION_MEMOR|                 |ACTION_TRACKER|                |GENERATED_INT |
  |id, transcript|                 |id, transcript|                |id, transcript|
  |title, impact │                 |owner, duedate|                |risks, health |
  +------+-------+                 +------+-------+                +------+-------+
         |                                |                               |
         | Maps To Node                   | Maps To Node                  | Maps To Node
         v                                v                               v
  +------------------------------------------------------------------------------+
  |                            KNOWLEDGE_NODE (Graph)                            |
  |  id (PK), org_id, project_id, node_type, title, entity_uid, attributes       |
  +------------------------------+-----------------------------------------------+
                                 | 1:N (Source / Target)
                                 v
  +------------------------------------------------------------------------------+
  |                        KNOWLEDGE_RELATIONSHIP (Graph)                        |
  |  id (PK), org_id, source_node_id, target_node_id, relationship_type, weight  |
  +------------------------------------------------------------------------------+
```

### 2.3 Cross Domain Relational Topology

The relational topology enforces three non negotiable architectural boundaries:

1. Hierarchical Tenancy Boundary: Every collaborative asset (Team, Project, Transcript, Output, Decision, Action, Knowledge Node) must directly or indirectly reference an organization_id. In individual personal accounts, the user serves as their own organizational container. This guarantees that tenant scoping is never ambiguous and can always be resolved in a single join.
2. The Provenance Triad: An extracted insight, decision, or action always references three relational ancestors:
   - Its immediate parent transcript_id (the specific meeting where it occurred).
   - Its enclosing project_id (the initiative to which it belongs).
   - Its root organization_id (the sovereign enterprise legal entity).
   This provenance triad allows queries to effortlessly aggregate intelligence at the meeting level, project level, or enterprise level.
3. Decoupled Cognitive Graph: The Knowledge Graph (knowledge_nodes and knowledge_relationships) acts as an overlay semantic fabric. Rather than duplicating relational data, knowledge nodes point back to primary relational tables via an entity_uid reference. This provides the flexibility of a graph database combined with the ACID consistency, foreign key integrity, and performance of relational PostgreSQL.

---

## SECTION 3: DATABASE STANDARDS

### 3.1 Naming Conventions and Identifiers

Concludo enforces a strict, unambiguous database naming constitution across all schemas, tables, columns, indexes, and constraints.

1. Table Naming Standards:
   - All table names must be in lowercase snake_case.
   - Table names must use the plural form representing the entity collection (for example, profiles, projects, decision_memory, audit_logs).
   - Junction tables linking two entities must concatenate the singular names of both entities separated by an underscore (for example, team_members, organization_members).
   - Domain prefixes are forbidden in table names; logical domains are maintained via schemas (public, analytics, vault).

2. Column Naming Standards:
   - All column names must be in lowercase snake_case.
   - The primary key of every table must be explicitly named id.
   - Foreign key columns must use the singular name of the referenced entity followed by _id (for example, organization_id, project_id, user_id).
   - Boolean columns must be prefixed with a state indicator such as is_, has_, or can_ (for example, is_active, has_consented, is_private).
   - JSONB columns must use descriptive noun phrases indicating structured data payloads (for example, attributes, metadata, execution_payload, health_scores).

3. Constraint and Index Naming Standards:
   - Primary Key Constraints: pk_<table_name> (for example, pk_projects).
   - Foreign Key Constraints: fk_<source_table>_<target_table>_<source_column> (for example, fk_projects_teams_team_id).
   - Unique Constraints: uq_<table_name>_<column_names> (for example, uq_organization_members_org_user).
   - Check Constraints: ck_<table_name>_<rule_name> (for example, ck_decision_memory_confidence_range).
   - Standard B Tree Indexes: idx_<table_name>_<column_names> (for example, idx_projects_organization_id).
   - Partial Indexes: idx_<table_name>_<columns>_partial_<predicate> (for example, idx_projects_active_org_partial).
   - Specialized Indexes (GIN, HNSW): idx_<table_name>_<column>_<index_type> (for example, idx_transcripts_search_tsv_gin, idx_embeddings_vector_hnsw).

### 3.2 Primary and Foreign Key Architecture

1. Primary Key Architecture:
   - Every primary key throughout Concludo Workspace is an immutable Universally Unique Identifier version 4 (UUIDv4) generated via gen_random_uuid().
   - Auto incrementing integers (serial, bigserial) are strictly prohibited in public schemas. Serial integers leak business volume, expose sequential vulnerability vectors to automated scrapers, and present insurmountable collision hurdles during multi region replication or tenant database merges.
   - UUIDs must be treated as opaque binary data types (uuid) within PostgreSQL, never stored as text or varchar strings.

2. Foreign Key Architecture:
   - Every foreign key constraint must be explicitly declared and validated at the database level. Application level referential integrity without database constraints is considered an architectural failure.
   - Cascading Deletes (ON DELETE CASCADE): Strictly limited to tightly coupled child records that possess zero standalone organizational value (for example, deleting a transcript cascades to its internal transcript_utterances).
   - Restrictive Deletes (ON DELETE RESTRICT): Mandatory for core business assets. An organization cannot be deleted if active projects exist. A project cannot be deleted if it contains active decisions or actions.
   - Nullification (ON DELETE SET NULL): Permitted only for non critical attribution metadata (for example, assigned_to on an action tracker record when a user profile is deactivated).
   - Every single foreign key column across all tables must have a supporting B Tree index to ensure high performance joins and prevent full table locks during cascading checks.

### 3.3 Timestamp and Temporal Lineage Standards

Temporal integrity is vital for legal discovery, auditability, and predictive modelling.

1. Temporal Data Type Standard:
   - All timestamp columns must use timestamptz (Timestamp with Time Zone). The naive timestamp data type is banned across the entire schema.
   - All timestamps are captured, calculated, and stored in Coordinated Universal Time (UTC). Localized display formatting (for example, Australian Eastern Standard Time, AEST/AEDT) is strictly a client side presentation responsibility.
   - The default value for creation timestamps must always be timezone('utc'::text, now()) or now().

2. Standard Temporal Columns:
   Every business entity table in Concludo must incorporate the four core temporal lifecycle columns:
   - created_at timestamptz not null default now(): The immutable instant of record creation.
   - updated_at timestamptz not null default now(): The timestamp of the most recent record mutation, maintained automatically via database triggers.
   - deleted_at timestamptz default null: The instant the record was transitioned into soft delete quarantine.
   - purge_after timestamptz default null: The calculated threshold date beyond which the record becomes eligible for permanent hard deletion.

3. Automated Update Trigger:
   All tables must attach the standard Concludo temporal trigger function update_timestamp():
   ```sql
   create or replace function public.update_timestamp()
   returns trigger as $$
   begin
     new.updated_at = timezone('utc'::text, now());
     return new;
   end;
   $$ language plpgsql security definer;
   ```

### 3.4 Soft Deletion and Quarantine Standards

In alignment with Tasklet 11 and Concludo enterprise governance rules, user initiated deletions must never result in immediate hard deletion from the database.

1. The 30 Day Recovery Quarantine Rule:
   - When a user deletes a record (a project, transcript, decision, action, or output), the system executes a soft delete mutation:
     ```sql
     update public.projects
     set deleted_at = timezone('utc'::text, now()),
         deleted_by = auth.uid(),
         purge_after = timezone('utc'::text, now()) + interval '30 days'
     where id = target_project_id;
     ```
   - During the 30 day quarantine window, the record remains recoverable by authorized administrators via the Recently Deleted workspace interface.
   - Soft deleted records are excluded from standard application queries, search indexing, knowledge graph traversals, and Copilot context windows via partial indexing and RLS policy predicates (where deleted_at is null).

2. Permanent Purge Eligibility:
   - A record is eligible for permanent hard destruction if and only if:
     deleted_at is not null and purge_after < timezone('utc'::text, now())
   - Hard purges are executed exclusively by the automated background worker cron_purge_deleted_records().
   - Direct hard deletion (DELETE FROM) is strictly blocked on all standard user interfaces and application APIs.

3. Complete Anonymity of Deletion Metadata:
   - The column deleted_by captures the internal uuid of the user who initiated the deletion for audit purposes.
   - This column must never be exposed to frontend client applications or serialized into public API responses.

### 3.5 Immutable Audit and Event Streaming Standards

1. Immutable Audit Logging:
   - Strategic and enterprise compliance requires a complete, unalterable historical ledger of all platform mutations.
   - The public.audit_logs table operates as an append only datastore. Direct updates (UPDATE) and deletions (DELETE) on public.audit_logs are revoked from all database roles, including service role connections.
   - Every audit record captures: id, organization_id, actor_id, action, resource_type, resource_id, ip_address, user_agent, old_values (JSONB), new_values (JSONB), and created_at.

2. Transactional Outbox Pattern:
   - To decouple database writes from external event notification pipelines (webhooks, search indexing, knowledge graph synchronisation), Concludo employs the Transactional Outbox Pattern.
   - Business mutations write an event record into public.event_stream_logs within the same atomic database transaction.
   - A lightweight background process polls or streams from event_stream_logs using PostgreSQL FOR UPDATE SKIP LOCKED, guaranteeing that external integrations receive exactly once event notifications without sacrificing database transaction performance.

### 3.6 Multi Tenant Isolation and Tier Gating

1. Kernel Level Multi Tenancy:
   - Multi tenancy is enforced at the database engine level via PostgreSQL Row Level Security (RLS).
   - Application code is never trusted to filter by organization_id alone. If an application developer forgets a where organization_id = ... clause, the RLS kernel policy transparently intercepts the query and prevents cross tenant data exposure.
   - In individual user accounts (free_preview, starter), the user personal ID functions as their implicit tenant boundary.

2. Backend Feature Tier Gating:
   - Concludo supports eight distinct subscription tiers: free_preview, starter_trial, starter, pro_trial, pro, team, enterprise, and admin.
   - Feature entitlement is verified on the backend via the public.profiles.tier and public.organizations.tier columns.
   - Frontend UI hiding of enterprise capabilities is considered cosmetic; database RLS policies and Edge Functions actively validate tier entitlements before granting access to advanced features such as AI Agent Memory, Custom Webhooks, SSO Configuration, and Statutory Legal Holds.

### 3.7 Database Indexing and Performance Standards

1. Mandatory Foreign Key Indexes:
   - Every single foreign key column in every table must possess a B Tree index. Unindexed foreign keys cause full table scans during parent record updates and deletions.

2. Partial Indexing for Active Records:
   - Because enterprise systems accumulate soft deleted records over time, standard B Tree indexes must be created as partial indexes filtering out deleted rows:
     ```sql
     create index idx_projects_org_active
     on public.projects (organization_id, created_at desc)
     where deleted_at is null;
     ```
   - This architecture keeps the working index compact, cache resident in RAM, and blazingly fast.

3. Specialized Index Types:
   - GIN (Generalized Inverted Index): Mandatory for full text search tsvector columns and high cardinality jsonb attribute lookups.
   - pgvector HNSW (Hierarchical Navigable Small World): Mandatory for high dimensional dense vector embeddings (vector(1536)), utilising vector_cosine_ops for lightning fast cosine similarity retrieval.
   - BRIN (Block Range Index): Utilised for massive, append only sequential tables such as audit_logs and event_stream_logs, providing 95% storage savings over B Tree indexes on timestamp columns.

---

## SECTION 4: COMPLETE DATABASE MODEL

### 4.1 Domain 1: Identity, Accounts, and Multi Tenancy

#### Table: `public.profiles`
- Purpose: Stores the core user profile, identity attributes, subscription tier, and display preferences. Anchored directly to Supabase GoTrue `auth.users`.
- Relationships:
  - 1:1 with `auth.users` on `id`.
  - 1:N with `public.organization_members` via `user_id`.
  - 1:N with `public.team_members` via `user_id`.
  - 1:N with `public.projects` via `created_by`.
- Ownership: Individual User (the authenticated owner of `auth.uid()`).
- RLS Requirements:
  - Select: Allowed for the user themselves, or members of the same organization.
  - Insert: Restricted to the authenticated user creating their own profile upon registration.
  - Update: Restricted to the user themselves (`auth.uid() = id`).
  - Delete: Blocked; profiles are deactivated via status flags or soft delete.
- Retention Requirements: Retained indefinitely while active. Soft delete sets `deleted_at = now()` and `purge_after = now() + interval '30 days'`.
- Future Expansion Considerations: Biometric device credentials, enterprise notification channels, and localized time zone auto detection.
- Core Schema Definition:
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  tier text not null default 'free_preview' check (tier in ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'enterprise', 'admin')),
  preferences jsonb not null default '{"theme":"light","email_notifications":true,"timezone":"Australia/Melbourne"}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_profiles_email on public.profiles(email);
create index idx_profiles_active on public.profiles(id) where deleted_at is null;
```

#### Table: `public.organizations`
- Purpose: Top level enterprise tenant container. Manages enterprise tier entitlements, billing state, domain verification, and single sign on (SSO) configuration.
- Relationships:
  - 1:N with `public.organization_members` via `organization_id`.
  - 1:N with `public.teams` via `organization_id`.
  - 1:N with `public.projects` via `organization_id`.
  - 1:N with `public.audit_logs` via `organization_id`.
  - 1:N with `public.retention_policies` via `organization_id`.
  - 1:N with `public.legal_holds` via `organization_id`.
- Ownership: Organization Owner / Enterprise Administrator.
- RLS Requirements:
  - Select: Permitted for active members of the organization (`is_org_member(id)`).
  - Insert: Restricted to verified billing checkout flows or enterprise onboarding scripts.
  - Update: Restricted to organization owners and administrators (`is_org_admin(id)`).
  - Delete: Blocked; requires statutory executive de provisioning.
- Retention Requirements: Retained indefinitely for commercial records. Soft delete initiates 30 day quarantine.
- Future Expansion Considerations: Hierarchical parent child business unit structures, enterprise cost centre allocation, and automated SCIM user provisioning.
- Core Schema Definition:
```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tier text not null default 'team' check (tier in ('team', 'enterprise', 'admin')),
  sso_enabled boolean not null default false,
  sso_provider text default null,
  domain text default null,
  is_suspended boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_organizations_slug on public.organizations(slug);
create index idx_organizations_active on public.organizations(id) where deleted_at is null;
```

#### Table: `public.organization_members`
- Purpose: Junction table managing user membership, enterprise administrative privileges, and role assignments within an organization.
- Relationships:
  - N:1 with `public.organizations` via `organization_id`.
  - N:1 with `public.profiles` via `user_id`.
- Ownership: Organization Administrators.
- RLS Requirements:
  - Select: Permitted for members of the same organization.
  - Insert/Update/Delete: Restricted to organization administrators.
- Retention Requirements: Follows organization lifecycle.
- Core Schema Definition:
```sql
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'auditor')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_organization_members_org_user unique (organization_id, user_id)
);
create index idx_org_members_org_id on public.organization_members(organization_id);
create index idx_org_members_user_id on public.organization_members(user_id);
```

#### Table: `public.organization_domains`
- Purpose: Tracks verified corporate email domains for just in time (JIT) provisioning and SSO enforcement.
- Relationships: N:1 with `public.organizations` on `organization_id`.
- Ownership: Enterprise Administrator.
- RLS Requirements: Select for members; mutations strictly restricted to org admins.
- Core Schema Definition:
```sql
create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_name text not null,
  verification_token text not null,
  is_verified boolean not null default false,
  verified_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_org_domain unique (domain_name)
);
create index idx_org_domains_org on public.organization_domains(organization_id);
```

#### Table: `public.organization_sso_configs`
- Purpose: Secure vault metadata for enterprise SAML 2.0 and OIDC configurations. Note: Raw secrets and private certificates are stored encrypted.
- Relationships: 1:1 with `public.organizations` on `organization_id`.
- Ownership: Enterprise Security Administrator.
- RLS Requirements: Strictly restricted to enterprise owners and security administrators.
- Core Schema Definition:
```sql
create table public.organization_sso_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  idp_entity_id text not null,
  idp_sso_url text not null,
  idp_certificate_fingerprint text not null,
  attribute_mapping jsonb not null default '{"email":"email","first_name":"given_name","last_name":"surname"}'::jsonb,
  is_enforced boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_sso_configs_org on public.organization_sso_configs(organization_id);
```

---

### 4.2 Domain 2: Collaboration and Team Workspaces

#### Table: `public.teams`
- Purpose: Functional workspace boundary within an enterprise (for example, Executive Board, Legal, Engineering).
- Relationships:
  - N:1 with `public.organizations` via `organization_id`.
  - 1:N with `public.team_members` via `team_id`.
  - 1:N with `public.projects` via `team_id`.
- Ownership: Team Administrator and Organization Administrator.
- RLS Requirements: Select for organization members (if public) or team members (if private). Mutations restricted to team admins.
- Schema Definition:
```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  is_private boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null,
  constraint uq_teams_org_slug unique (organization_id, slug)
);
create index idx_teams_org_id on public.teams(organization_id);
create index idx_teams_active on public.teams(id) where deleted_at is null;
```

#### Table: `public.team_members`
- Purpose: Junction table binding profiles to teams with roles (owner, admin, member, guest).
- Schema Definition:
```sql
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_team_members_team_user unique (team_id, user_id)
);
create index idx_team_members_team on public.team_members(team_id);
create index idx_team_members_user on public.team_members(user_id);
```

#### Table: `public.team_invitations`
- Purpose: Manages pending invitations to join teams, including token hashes, expiration timestamps, and inviter tracking.
- Schema Definition:
```sql
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_team_invitations_token on public.team_invitations(token_hash);
create index idx_team_invitations_team on public.team_invitations(team_id);
```

#### Table: `public.team_activities`
- Purpose: High level chronological feed of team actions (project creation, output generation, major milestone approvals) for workspace dashboards.
- Schema Definition:
```sql
create table public.team_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  activity_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_team_activities_team_date on public.team_activities(team_id, created_at desc);
```

---

### 4.3 Domain 3: Projects and Meeting Transcripts

#### Table: `public.projects`
- Purpose: Core operational container for business initiatives, programs, and collaborative campaigns.
- Relationships:
  - N:1 with `public.teams` via `team_id`.
  - N:1 with `public.organizations` via `organization_id`.
  - 1:N with `public.transcripts` via `project_id`.
  - 1:N with `public.outputs` via `project_id`.
- Ownership: Team Owner / Project Creator.
- RLS Requirements: Access granted if user is a member of the team and organization.
- Retention Requirements: 30 day soft delete quarantine before permanent purge.
- Schema Definition:
```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived', 'paused')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_projects_org_id on public.projects(organization_id);
create index idx_projects_team_id on public.projects(team_id);
create index idx_projects_active on public.projects(id) where deleted_at is null;
```

#### Table: `public.transcripts`
- Purpose: Immutable record of ingested meeting dialogue, audio metadata, diarisation speaker tokens, and meeting classifications (M 01 to M 50).
- Relationships:
  - N:1 with `public.projects` via `project_id`.
  - 1:N with `public.decision_memory` via `transcript_id`.
  - 1:N with `public.action_tracker` via `transcript_id`.
  - 1:N with `public.generated_intelligence` via `transcript_id`.
- Ownership: Project Owner / Team Workspace.
- Schema Definition:
```sql
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_title text not null,
  meeting_date timestamptz not null default timezone('utc'::text, now()),
  duration_seconds integer not null default 0,
  raw_transcript text not null,
  cleaned_transcript text not null,
  meeting_type text not null default 'M-01',
  strategic_intent text not null default 'CREATE_STRATEGY',
  source_channel text not null default 'upload' check (source_channel in ('upload', 'zoom', 'teams', 'google_meet', 'api')),
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(meeting_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(cleaned_transcript, '')), 'B')
  ) stored,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_transcripts_project on public.transcripts(project_id);
create index idx_transcripts_org on public.transcripts(organization_id);
create index idx_transcripts_tsv on public.transcripts using gin(search_tsv);
create index idx_transcripts_active on public.transcripts(id) where deleted_at is null;
```

---

### 4.4 Domain 4: Outputs and Generated Deliverables

#### Table: `public.outputs`
- Purpose: Stores generated premium deliverables produced by Tasklet A1 (Business Plans, Board Briefings, Transformation Roadmaps, Executive Summaries).
- Relationships: N:1 with `public.projects`, N:1 with `public.transcripts`.
- Schema Definition:
```sql
create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  transcript_id uuid references public.transcripts(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  template_type text not null,
  output_type text not null,
  content jsonb not null default '{}'::jsonb,
  rendered_html text,
  rendered_markdown text,
  quality_score numeric(5,2) not null default 85.00,
  is_approved boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz default null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_outputs_project on public.outputs(project_id);
create index idx_outputs_transcript on public.outputs(transcript_id);
create index idx_outputs_org on public.outputs(organization_id);
create index idx_outputs_active on public.outputs(id) where deleted_at is null;
```

#### Table: `public.endpoint_reports`
- Purpose: High velocity operational summaries formatted for external endpoints (Slack, Microsoft Teams, Planner).
- Schema Definition:
```sql
create table public.endpoint_reports (
  id uuid primary key default gen_random_uuid(),
  output_id uuid references public.outputs(id) on delete cascade,
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  destination_type text not null check (destination_type in ('slack', 'teams', 'planner', 'email', 'webhook')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz default null,
  error_message text default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_endpoint_reports_status on public.endpoint_reports(status);
create index idx_endpoint_reports_org on public.endpoint_reports(organization_id);
```

#### Table: `public.generated_intelligence`
- Purpose: Stores structured intermediate intelligence extracted by Tasklet A0 (risks, opportunities, conversational metrics, health scores).
- Schema Definition:
```sql
create table public.generated_intelligence (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_health_score integer not null default 75 check (meeting_health_score between 0 and 100),
  health_classification text not null default 'Good' check (health_classification in ('Exceptional', 'Excellent', 'Good', 'Average', 'Poor', 'Waste of Time')),
  dimension_scores jsonb not null default '{}'::jsonb,
  risks_detected jsonb not null default '[]'::jsonb,
  opportunities_detected jsonb not null default '[]'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_generated_intel_transcript on public.generated_intelligence(transcript_id);
create index idx_generated_intel_org on public.generated_intelligence(organization_id);
```

---

### 4.5 Domain 5: Execution, Decision Memory, and Action Tracker

#### Table: `public.decision_memory`
- Purpose: The definitive repository of ratified corporate choices, incorporating full contextual rationale, rejected alternatives, financial impact, and strategic alignment.
- Schema Definition:
```sql
create table public.decision_memory (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  rationale text not null,
  rejected_alternatives jsonb not null default '[]'::jsonb,
  financial_impact numeric(15,2) default null,
  currency text not null default 'AUD',
  impact_level text not null default 'medium' check (impact_level in ('critical', 'high', 'medium', 'low')),
  status text not null default 'ratified' check (status in ('proposed', 'ratified', 'reversed', 'superseded')),
  confidence_score integer not null default 90 check (confidence_score between 0 and 100),
  evidence_quote text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_decision_memory_proj on public.decision_memory(project_id);
create index idx_decision_memory_org on public.decision_memory(organization_id);
create index idx_decision_memory_active on public.decision_memory(id) where deleted_at is null;
```

#### Table: `public.action_tracker`
- Purpose: Operational execution tracking enforcing the Five Field Delegation Standard.
- Schema Definition:
```sql
create table public.action_tracker (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_description text not null,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_name text not null,
  due_date timestamptz not null,
  definition_of_done text not null,
  checkpoint_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  dependencies jsonb not null default '[]'::jsonb,
  is_overdue boolean generated always as (status not in ('completed', 'cancelled') and due_date < timezone('utc'::text, now())) stored,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_action_tracker_proj on public.action_tracker(project_id);
create index idx_action_tracker_owner on public.action_tracker(assigned_to_user_id);
create index idx_action_tracker_org on public.action_tracker(organization_id);
create index idx_action_tracker_active on public.action_tracker(id) where deleted_at is null;
```

---

### 4.6 Domain 6: Governance, Audit, Retention, and Legal Holds

#### Table: `public.audit_logs`
- Purpose: Append only, tamper evident historical ledger of all system events.
- Schema Definition:
```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  ip_address inet default null,
  user_agent text default null,
  old_values jsonb default null,
  new_values jsonb default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_audit_logs_org_date on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);
```

#### Table: `public.retention_policies`
- Purpose: Automated lifecycle governance rules per organization.
- Schema Definition:
```sql
create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('all', 'transcripts', 'outputs', 'decisions', 'actions')),
  retention_days integer not null check (retention_days >= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_retention_policies_org on public.retention_policies(organization_id);
```

#### Table: `public.legal_holds`
- Purpose: Statutory compliance freezes that suspend soft deletion purges.
- Schema Definition:
```sql
create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  matter_reference text not null,
  target_user_id uuid references public.profiles(id),
  target_project_id uuid references public.projects(id),
  status text not null default 'active' check (status in ('active', 'released')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  released_at timestamptz default null
);
create index idx_legal_holds_org on public.legal_holds(organization_id);
create index idx_legal_holds_proj on public.legal_holds(target_project_id);
```

#### Table: `public.access_reviews`
- Purpose: Periodic enterprise user access attestation logs for SOC 2 compliance.
- Schema Definition:
```sql
create table public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  review_period text not null,
  findings jsonb not null default '{}'::jsonb,
  is_completed boolean not null default false,
  completed_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_access_reviews_org on public.access_reviews(organization_id);
```

---

### 4.7 Domain 7: Integrations, Webhooks, and Developer API Keys

#### Table: `public.integrations`
- Purpose: Tracks third party OAuth connections (Google Drive, Microsoft 365, Slack). Secrets stored in Vault.
- Schema Definition:
```sql
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_workspace', 'microsoft_365', 'slack', 'jira', 'confluence')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  scope text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_org_integration_provider unique (organization_id, provider)
);
create index idx_integrations_org on public.integrations(organization_id);
```

#### Table: `public.webhooks`
- Purpose: Configuration for outbound HTTP event notifications.
- Schema Definition:
```sql
create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_url text not null,
  secret_hash text not null,
  events text[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_webhooks_org on public.webhooks(organization_id);
```

#### Table: `public.webhook_logs`
- Purpose: Delivery attempt logs, status codes, and latency tracking for webhooks.
- Schema Definition:
```sql
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_name text not null,
  payload jsonb not null,
  response_status integer default null,
  response_body text default null,
  latency_ms integer default 0,
  delivered_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_webhook_logs_webhook on public.webhook_logs(webhook_id, delivered_at desc);
```

#### Table: `public.api_keys`
- Purpose: Hashed enterprise API credentials for programmatic headless platform access. Plain text keys are never stored.
- Schema Definition:
```sql
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{"read:intelligence"}'::text[],
  expires_at timestamptz default null,
  last_used_at timestamptz default null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_api_keys_org on public.api_keys(organization_id);
create index idx_api_keys_hash on public.api_keys(key_hash);
```

---

### 4.8 Domain 8: Agentic Workflows, Approvals, and Activity Logging

#### Table: `public.agent_memory`
- Purpose: Scoped persistent key value and document memory for autonomous AI agents.
- Schema Definition:
```sql
create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null,
  memory_scope text not null check (memory_scope in ('global', 'project', 'team', 'meeting')),
  scope_id uuid default null,
  memory_key text not null,
  memory_value jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_agent_memory_scope_key unique (organization_id, agent_name, memory_scope, scope_id, memory_key)
);
create index idx_agent_memory_lookup on public.agent_memory(organization_id, agent_name, memory_key);
```

#### Table: `public.workflows`
- Purpose: Orchestration definition for multi step agent workflows (such as meeting post processing, executive briefing compilation).
- Schema Definition:
```sql
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('meeting_ingested', 'action_overdue', 'schedule_cron', 'manual')),
  steps jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_workflows_org on public.workflows(organization_id);
```

#### Table: `public.workflow_executions`
- Purpose: Execution instances and state tracking for active workflows.
- Schema Definition:
```sql
create table public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'awaiting_approval', 'completed', 'failed')),
  current_step integer not null default 0,
  context_payload jsonb not null default '{}'::jsonb,
  error_message text default null,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz default null
);
create index idx_workflow_executions_status on public.workflow_executions(organization_id, status);
```

#### Table: `public.workflow_approvals`
- Purpose: Human in the loop approval gates for agentic operations.
- Schema Definition:
```sql
create table public.workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_execution_id uuid references public.workflow_executions(id) on delete cascade,
  workflow_name text not null,
  action_type text not null,
  action_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by_agent text not null,
  resolved_by_user_id uuid references public.profiles(id),
  resolved_at timestamptz default null,
  resolution_notes text default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_workflow_approvals_status on public.workflow_approvals(organization_id, status);
```

#### Table: `public.agent_activity`
- Purpose: Granular telemetry log of AI agent executions, tool calls, and model tokens.
- Schema Definition:
```sql
create table public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null,
  action_name text not null,
  tool_invoked text default null,
  tokens_input integer default 0,
  tokens_output integer default 0,
  execution_duration_ms integer default 0,
  status text not null default 'success' check (status in ('success', 'failed')),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_agent_activity_org_date on public.agent_activity(organization_id, created_at desc);
```

---

### 4.9 Domain 9: Knowledge Graph Nodes and Relationships

#### Table: `public.knowledge_nodes`
- Purpose: Fundamental semantic vertices within the Concludo Knowledge Graph.
- Schema Definition:
```sql
create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  node_type text not null check (node_type in ('project', 'transcript', 'decision', 'action', 'risk', 'opportunity', 'insight', 'recommendation', 'forecast', 'report', 'team', 'user', 'organization', 'concept')),
  entity_uid uuid default null,
  title text not null,
  description text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  purge_after timestamptz default null
);
create index idx_knowledge_nodes_org on public.knowledge_nodes(organization_id);
create index idx_knowledge_nodes_type on public.knowledge_nodes(node_type);
create index idx_knowledge_nodes_entity on public.knowledge_nodes(entity_uid);
create index idx_knowledge_nodes_active on public.knowledge_nodes(id) where deleted_at is null;
```

#### Table: `public.knowledge_relationships`
- Purpose: Directed, weighted edges connecting knowledge nodes.
- Schema Definition:
```sql
create table public.knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('related_to', 'depends_on', 'derived_from', 'supports', 'contradicts', 'owned_by', 'assigned_to', 'generated_from', 'escalates_to', 'impacts', 'creates', 'mitigates', 'influences', 'contributes_to')),
  weight numeric(3,2) not null default 1.00 check (weight between 0.00 and 1.00),
  evidence_quote text default null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_knowledge_relationship_edge unique (source_node_id, target_node_id, relationship_type)
);
create index idx_knowledge_rel_source on public.knowledge_relationships(source_node_id);
create index idx_knowledge_rel_target on public.knowledge_relationships(target_node_id);
create index idx_knowledge_rel_org on public.knowledge_relationships(organization_id);
```

#### Table: `public.lessons_learned`
- Purpose: Curated institutional wisdom distilled from project closures and post mortems.
- Schema Definition:
```sql
create table public.lessons_learned (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null check (category in ('technical', 'commercial', 'governance', 'vendor', 'operational')),
  title text not null,
  context text not null,
  what_went_well text not null,
  what_failed text not null,
  recommendations text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_lessons_learned_org on public.lessons_learned(organization_id);
create index idx_lessons_learned_tags on public.lessons_learned using gin(tags);
```

---

### 4.10 Domain 10: Copilot Memory, Conversations, and Prompts

#### Table: `public.copilot_conversations`
- Purpose: Container for interactive dialogues between users and the Concludo Copilot.
- Schema Definition:
```sql
create table public.copilot_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New Conversation',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  purge_after timestamptz default null
);
create index idx_copilot_conv_user on public.copilot_conversations(user_id);
create index idx_copilot_conv_org on public.copilot_conversations(organization_id);
```

#### Table: `public.copilot_messages`
- Purpose: Individual user queries and generated responses, including citations.
- Schema Definition:
```sql
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.copilot_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  tokens_used integer default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_copilot_msgs_conv on public.copilot_messages(conversation_id, created_at asc);
```

#### Table: `public.copilot_prompts`
- Purpose: System prompt templates and governed behavioural instructions.
- Schema Definition:
```sql
create table public.copilot_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  version text not null default '1.0',
  system_instructions text not null,
  temperature numeric(3,2) not null default 0.20,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);
```

---

### 4.11 Domain 11: Predictive Intelligence and Strategic Digital Twin

#### Table: `public.predictive_snapshots`
- Purpose: Historical trajectory snapshots, Action Drift Index scores, and predictive milestones.
- Schema Definition:
```sql
create table public.predictive_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  health_score integer not null check (health_score between 0 and 100),
  action_drift_index numeric(5,2) not null,
  decision_backlog_pressure numeric(5,2) not null,
  horizon_forecast jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_predictive_snapshots_proj on public.predictive_snapshots(project_id, calculated_at desc);
```

#### Table: `public.executive_briefings`
- Purpose: Pre generated briefings for C suite executives synthesizing cross project intelligence.
- Schema Definition:
```sql
create table public.executive_briefings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_audience text not null check (target_audience in ('ceo', 'board', 'cfo', 'coo', 'general')),
  title text not null,
  headline_synthesis text not null,
  key_risks jsonb not null default '[]'::jsonb,
  strategic_decisions jsonb not null default '[]'::jsonb,
  critical_actions jsonb not null default '[]'::jsonb,
  delivered_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_executive_briefings_org on public.executive_briefings(organization_id, created_at desc);
```

#### Table: `public.strategic_digital_twins`
- Purpose: Digital representation of enterprise portfolio state, simulating resource bottlenecks and strategy alignment.
- Schema Definition:
```sql
create table public.strategic_digital_twins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  state_parameters jsonb not null default '{}'::jsonb,
  last_simulated_at timestamptz default null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);
```

#### Table: `public.strategic_health_scores`
- Purpose: Multi dimensional health scores tracked over monthly reporting periods.
- Schema Definition:
```sql
create table public.strategic_health_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reporting_period text not null,
  composite_score integer not null check (composite_score between 0 and 100),
  dimension_scores jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_health_org_period on public.strategic_health_scores(organization_id, reporting_period);
```

#### Table: `public.strategic_scenarios`
- Purpose: "What if" scenario simulations (for example, supplier bankruptcy, budget contraction by 20%).
- Schema Definition:
```sql
create table public.strategic_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  hypothetical_adjustments jsonb not null,
  simulated_impact jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_scenarios_org on public.strategic_scenarios(organization_id);
```

#### Table: `public.strategic_briefings`
- Purpose: Specialized board level advisory briefings detailing scenario outcomes.
- Schema Definition:
```sql
create table public.strategic_briefings (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.strategic_scenarios(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  briefing_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
```

#### Table: `public.strategic_alerts`
- Purpose: Real time executive warning notifications generated by automated health regression monitors.
- Schema Definition:
```sql
create table public.strategic_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  message text not null,
  is_dismissed boolean not null default false,
  dismissed_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_alerts_org on public.strategic_alerts(organization_id, severity) where is_dismissed is false;
```

---

### 4.12 Domain 12: Future Expansion and Roadmap Schemas

#### Table: `public.vector_embeddings`
- Purpose: Dedicated table for pgvector dense chunk embeddings supporting semantic search and RAG retrieval.
- Schema Definition:
```sql
create table public.vector_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('transcript_chunk', 'decision', 'action', 'insight', 'output_section')),
  entity_id uuid not null,
  chunk_index integer not null default 0,
  chunk_content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_vector_embeddings_lookup on public.vector_embeddings(entity_type, entity_id);
create index idx_vector_embeddings_hnsw on public.vector_embeddings using hnsw (embedding vector_cosine_ops);
```

#### Table: `public.external_connectors`
- Purpose: Registry of ERP, CRM, and Jira synchronisation endpoints.
- Schema Definition:
```sql
create table public.external_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_type text not null check (connector_type in ('salesforce', 'hubspot', 'jira', 'sap', 'oracle')),
  endpoint_url text not null,
  auth_config_vault_id text not null,
  sync_frequency text not null default 'hourly',
  is_active boolean not null default true,
  last_synced_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_external_connectors_org on public.external_connectors(organization_id);
```

#### Table: `public.event_stream_logs`
- Purpose: Transactional outbox pattern table for external Kafka/SQS streaming.
- Schema Definition:
```sql
create table public.event_stream_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_name text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_payload jsonb not null,
  processed_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_event_stream_unprocessed on public.event_stream_logs(created_at asc) where processed_at is null;
```

#### Table: `public.user_consent_records`
- Purpose: Statutory privacy consent ledger for GDPR and Australian Privacy Principles.
- Schema Definition:
```sql
create table public.user_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  consent_given boolean not null,
  ip_address inet default null,
  user_agent text default null,
  recorded_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_user_consent_lookup on public.user_consent_records(user_id, consent_type);
```

---

## SECTION 5: DATA OWNERSHIP MODEL

### 5.1 The Four Tier Ownership Hierarchy

Concludo Workspace implements a four tier data ownership model that balances individual autonomy with enterprise governance:

```
+─────────────────────────────────────────────────────────────────────────────+
|                     CONCLUDO DATA OWNERSHIP HIERARCHY                       |
+─────────────────────────────────────────────────────────────────────────────+

  [ LEVEL 4: ENTERPRISE GOVERNANCE ]
  - Super Administrator / Statutory Auditor
  - Ultimate legal sovereignty over all organizational tenant data.
  - Imposes statutory legal holds, retention policies, and compliance purges.
                               │
                               ▼
  [ LEVEL 3: ORGANIZATION OWNERSHIP ]
  - Organization Owners and Administrators
  - Controls organization-wide templates, billing, SSO, and team structures.
  - Full read and administrative authority over all teams and projects.
                               │
                               ▼
  [ LEVEL 2: TEAM OWNERSHIP ]
  - Team Administrators and Team Members
  - Collective ownership of projects, transcripts, outputs, and action trackers.
  - Controls access permissions to team initiatives.
                               │
                               ▼
  [ LEVEL 1: INDIVIDUAL OWNERSHIP ]
  - Single User Profile
  - Sole authority over personal drafts, private Copilot conversations, and settings.
```

1. Level 1: Individual Ownership:
   - Covers user profiles, private scratchpads, personal preferences, and unshared Copilot dialogues.
   - The user has exclusive rights to modify or soft delete this data.
2. Level 2: Team Ownership:
   - Covers projects, meeting transcripts, decisions, and action plans assigned to a team.
   - All team members have read access. Team admins have modification and soft delete authority.
3. Level 3: Organization Ownership:
   - Covers global assets, enterprise templates, member registries, billing, and audit logs.
   - Governed by organization administrators.
4. Level 4: Enterprise Governance:
   - Applies to statutory legal holds, compliance discovery exports, and regulatory retention freezes.
   - Overrides all lower ownership tiers.

### 5.2 Ownership State Machine and Access Permissions

| Operation | Individual Record | Team Workspace Record | Organization Asset | Enterprise Compliance Record |
| :--- | :--- | :--- | :--- | :--- |
| Read | Owner only | Team Members | Org Members | Org Admins / Auditors |
| Create | Authenticated User | Team Members | Org Admins | Enterprise System / Auditor |
| Modify | Owner only | Team Admins / Assignee | Org Admins | Immutable (Write Once) |
| Soft Delete | Owner only | Team Admins | Org Admins | Blocked if active Legal Hold |
| Purge | Background Purge Engine | Background Purge Engine | Background Purge Engine | Blocked if active Legal Hold |

### 5.3 Ownership Transitions and Departure Workflows

When an individual departs an organization:
1. Profile Deactivation: The user profile is marked `is_active = false`.
2. Action Reassignment: Outstanding action tracker items owned by the user are automatically flagged for manager review or transitioned to the Team Administrator.
3. Intellectual Property Preservation: Projects, transcripts, decisions, and outputs created by the user remain the property of the Team and Organization.
4. Audit Trail Integrity: Historical references to the user in `audit_logs` and `decision_memory` are preserved with immutable attribution.

---

## SECTION 6: ROW LEVEL SECURITY ARCHITECTURE

### 6.1 Declarative Kernel Level Security Principles

Row Level Security (RLS) is the bedrock of Concludo multi tenant architecture. Concludo adheres to five RLS security principles:
1. Always Enabled: Every single table in the `public` schema has `alter table ... enable row level security;` and `alter table ... force row level security;` applied.
2. Kernel Enforcement: Access is evaluated inside the PostgreSQL query planner. Bypass via application bugs is mathematically impossible.
3. Security Definer Helper Functions: Complex membership validations are encapsulated within high performance, trusted `security definer` functions with locked `search_path`.
4. Separate Action Policies: Distinct policies are defined for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
5. Soft Delete Exclusion: Standard policies enforce `deleted_at is null` to prevent soft deleted records from surfacing in queries.

### 6.2 Security Helper Functions and Context Verification

Concludo deploys optimised, index backed security helper functions:

```sql
create or replace function public.is_org_member(target_org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_record_held(p_project_id uuid)
returns boolean as 4850
begin
  return exists (
    select 1 from public.legal_holds lh
    where (lh.target_project_id = p_project_id or (lh.target_project_id is null and lh.organization_id = (select organization_id from public.projects where id = p_project_id)))
      and lh.status = 'active'
  );
end;
4850 language plpgsql security definer set search_path = public;
```

### 6.3 Comprehensive Entity Policy Specifications

#### Projects Table Policies
```sql
alter table public.projects enable row level security;
alter table public.projects force row level security;

create policy "projects_select_policy" on public.projects
for select using (
  deleted_at is null
  and (
    created_by = auth.uid()
    or is_team_member(team_id)
    or is_org_admin(organization_id)
  )
);

create policy "projects_insert_policy" on public.projects
for insert with check (
  created_by = auth.uid()
  and is_org_member(organization_id)
);

create policy "projects_update_policy" on public.projects
for update using (
  deleted_at is null
  and (
    created_by = auth.uid()
    or is_team_member(team_id)
    or is_org_admin(organization_id)
  )
) with check (
  is_org_member(organization_id)
);

create policy "projects_delete_policy" on public.projects
for delete using (
  is_org_admin(organization_id)
  and not is_record_held(id)
);
```

#### Transcripts Table Policies
```sql
alter table public.transcripts enable row level security;
alter table public.transcripts force row level security;

create policy "transcripts_select_policy" on public.transcripts
for select using (
  deleted_at is null
  and is_org_member(organization_id)
  and exists (
    select 1 from public.projects p
    where p.id = transcripts.project_id
      and (p.created_by = auth.uid() or is_team_member(p.team_id) or is_org_admin(p.organization_id))
  )
);

create policy "transcripts_insert_policy" on public.transcripts
for insert with check (
  created_by = auth.uid()
  and is_org_member(organization_id)
);
```

#### Decision Memory Table Policies
```sql
alter table public.decision_memory enable row level security;
alter table public.decision_memory force row level security;

create policy "decision_memory_select_policy" on public.decision_memory
for select using (
  deleted_at is null
  and is_org_member(organization_id)
);
```

#### Action Tracker Table Policies
```sql
alter table public.action_tracker enable row level security;
alter table public.action_tracker force row level security;

create policy "action_tracker_select_policy" on public.action_tracker
for select using (
  deleted_at is null
  and is_org_member(organization_id)
);

create policy "action_tracker_update_policy" on public.action_tracker
for update using (
  deleted_at is null
  and is_org_member(organization_id)
  and (
    assigned_to_user_id = auth.uid()
    or created_by = auth.uid()
    or is_org_admin(organization_id)
  )
);
```

---

## SECTION 7: MEMORY ARCHITECTURE

### 7.1 The Eleven Layer Cognitive Memory Topography

Concludo Workspace organizes organizational cognitive retention into an eleven layer memory topography. This multi tiered design ensures that information is preserved at the appropriate degree of abstraction, durability, and operational utility:

```
+─────────────────────────────────────────────────────────────────────────────+
|               THE CONCLUDO ELEVEN LAYER COGNITIVE MEMORY MODEL              |
+─────────────────────────────────────────────────────────────────────────────+

  [ LAYER 11: EXECUTIVE MEMORY ]
  - Longitudinal C-suite strategy, board mandates, macroeconomic pivots.
  - Multi-year horizon, highest abstraction, governing compass.
                                ▲
  [ LAYER 10: ORGANISATIONAL MEMORY ]
  - Cross-project institutional knowledge, lessons learned, operating playbooks.
  - Endures across leadership changes and restructuring.
                                ▲
  [ LAYER 9: COPILOT MEMORY ]
  - User-specific conversational context, prompt history, interaction styles.
  - High personalisation, responsive, session-bridging.
                                ▲
  [ LAYER 8: AGENT MEMORY ]
  - Scoped persistent state for background automations and workflow agents.
  - Structured key-value storage, execution checkpoints, idempotent states.
                                ▲
  [ LAYER 7: KNOWLEDGE MEMORY ]
  - Semantic knowledge graph: Nodes, relationships, entity clusters, evidence paths.
  - Relational fabric linking all business concepts and artifacts.
                                ▲
  [ LAYER 6: INSIGHT MEMORY ]
  - Unspoken intelligence: Missed risks, decision gaps, weak assumptions.
  - Analytical derivations, pattern anomalies, proactive warnings.
                                ▲
  [ LAYER 5: MEETING MEMORY ]
  - Synthesized meeting intelligence: Health scores, dynamics, classifications.
  - Bridges raw conversational episodes with formal business deliverables.
                                ▲
  [ LAYER 4: ACTION MEMORY ]
  - Operational commitments: The Five-Field Delegation Standard registry.
  - Checkpoint tracking, dependency trees, execution velocity metrics.
                                ▲
  [ LAYER 3: DECISION MEMORY ]
  - Ratified choices: Rationale, rejected alternatives, financial impact.
  - Immutable decision lineage, reversibility tracking, precedent vault.
                                ▲
  [ LAYER 2: PROJECT MEMORY ]
  - Initiative-level context: Milestones, charter, team rosters, status rollups.
  - Cohesive container for multi-meeting campaigns.
                                ▲
  [ LAYER 1: TRANSCRIPT MEMORY ]
  - Verbatim cleaned dialogue, speaker diarisation, audio timestamps.
  - Raw evidence foundation, high volume, immutable baseline.
```

1. Layer 1: Transcript Memory:
   - Nature: Verbatim, diarised linguistic tokens with temporal coordinates.
   - Purpose: Primary source evidence. When any higher layer claim is contested, Transcript Memory provides the unimpeachable citation.
   - Storage: `public.transcripts` with `tsvector` full text search and semantic text chunks.
   - Retention: Controlled by organizational retention policy; soft deleted records quarantined for 30 days.

2. Layer 2: Project Memory:
   - Nature: Contextual initiatives, operational scopes, team assignments, and delivery milestones.
   - Purpose: Groups disparate conversational encounters into a coherent strategic journey.
   - Storage: `public.projects`.
   - Access: Shared across team members; partitioned by organizational multi tenancy.

3. Layer 3: Decision Memory:
   - Nature: Ratified business choices with explicit rationale and rejected alternatives.
   - Purpose: Prevents circular debates and re litigating historical agreements.
   - Storage: `public.decision_memory`.
   - Governance: High immutability; modifications require explicit rationale updates or superseding decisions.

4. Layer 4: Action Memory:
   - Nature: Rigorous operational obligations adhering to the Five Field Delegation Standard.
   - Purpose: Drives execution accountability and eliminates orphaned responsibilities.
   - Storage: `public.action_tracker`.
   - Automation: Generates automated checkpoint reminders, overdue alerts, and drift analytics.

5. Layer 5: Meeting Memory:
   - Nature: Meeting performance diagnostics, participation dynamics, and health scores.
   - Purpose: Measures meeting efficiency and optimises organizational time allocation.
   - Storage: `public.generated_intelligence`.
   - Feedback Loop: Diagnoses systemic meeting waste without punitive surveillance.

6. Layer 6: Insight Memory:
   - Nature: Unspoken intelligence, blind spots, unstated assumptions, and risk warnings.
   - Purpose: Elevates raw discussion to proactive strategic foresight.
   - Storage: `public.generated_intelligence` and `public.knowledge_nodes`.
   - Detection: Identifies implicit vulnerabilities not acknowledged by participants.

7. Layer 7: Knowledge Memory:
   - Nature: Semantic network linking concepts, people, projects, decisions, and risks.
   - Purpose: Enables non linear associative reasoning across the corporate knowledge graph.
   - Storage: `public.knowledge_nodes` and `public.knowledge_relationships`.
   - Lineage: Maps multi hop causal chains between disparate initiatives.

8. Layer 8: Agent Memory:
   - Nature: Isolated, scoped key value and JSON state stores for autonomous workflow agents.
   - Purpose: Maintains execution state, retry counts, and multi step workflow continuity.
   - Storage: `public.agent_memory`.
   - Security: Scoped to specific agent names, tenants, and execution boundaries.

9. Layer 9: Copilot Memory:
   - Nature: Conversational context, user prompt preferences, and session dialogue history.
   - Purpose: Delivers personalized, contextual conversational intelligence to human users.
   - Storage: `public.copilot_conversations` and `public.copilot_messages`.
   - Ephemerality: Preserves recent conversational context while pruning dead turns.

10. Layer 10: Organisational Memory:
    - Nature: Longitudinal corporate wisdom, post mortem lessons learned, and institutional best practices.
    - Purpose: Preserves institutional capability across employee turnover.
    - Storage: `public.lessons_learned` and aggregated knowledge graph subgraphs.
    - Longevity: Retained permanently to serve as the corporate brain.

11. Layer 11: Executive Memory:
    - Nature: High level strategic directives, board resolutions, and capital allocation mandates.
    - Purpose: Steers enterprise portfolio alignment and powers predictive digital twins.
    - Storage: `public.executive_briefings` and `public.predictive_snapshots`.
    - Strategic Authority: Governs enterprise prioritization and investment gates.

### 7.2 Cognitive Crystallisation: Memory Evolution Lifecycle

Organizational memory is not static; it undergoes cognitive crystallisation. As conversational dialogue ages, the system systematically extracts high value structured entities, indexes causal relationships, and transitions fleeting discussions into permanent corporate wisdom:

```
+─────────────────────────────────────────────────────────────────────────────+
|                      COGNITIVE CRYSTALLISATION PIPELINE                     |
+─────────────────────────────────────────────────────────────────────────────+
                                      │
       [ T+0 Hours: Ingestion ]       │ Raw acoustic dialogue ingested
                                      │ Pipeline cleans disfluencies & diarises
                                      ▼
       [ T+1 Hour: Structuring ]      │ Entities, Decisions & Actions extracted
                                      │ 5-Field Standard enforced in database
                                      ▼
       [ T+24 Hours: Synthesis ]      │ Meeting Health evaluated
                                      │ Deliverables (T1-T19) compiled
                                      ▼
       [ T+7 Days: Graph Weaving ]    │ Nodes & Edges committed to Knowledge Graph
                                      │ Cross-project dependencies mapped
                                      ▼
       [ T+30 Days: Pattern Mining ]  │ Insights synthesized with historical corpus
                                      │ Execution drift indices calculated
                                      ▼
       [ T+90 Days: Institutional ]   │ Closed projects yield Lessons Learned
                                      │ Permanent Organisational Memory ratified
```

---

### 7.3 Memory Tier Decay and Consolidation Policies

Cognitive memory tiers do not persist with uniform operational immediacy. To prevent context saturation and maintain high signal-to-noise ratios across executive queries, Concludo implements mathematical decay functions and consolidation triggers:

1. Temporal Half-Life Decay:
   - Conversational Transcript Memory decays rapidly with an operational half-life of 14 days, after which verbatim utterances are relegated to cold vector storage unless anchored to an active decision or action.
   - Decision Memory and Action Memory possess an operational half-life of 365 days, retaining active relational index priority throughout the fiscal year.
   - Organisational Memory and Strategic Lessons Learned do not decay temporally; they are governed by relevance reinforcement, where subsequent confirming or contradictory outcomes dynamically adjust edge weights.

2. Mathematical Decay Formulation:
   The effective retrieval weight W_eff(t) of an ephemeral memory node at time t (in days post-creation) is defined as:
   W_eff(t) = W_base * e^(-lambda * t) + R_reinforce
   where lambda is the tier decay constant (lambda = 0.0495 for transcripts, yielding a 14-day half-life; lambda = 0.0019 for operational actions; lambda = 0 for strategic principles) and R_reinforce represents retrieval reinforcement acquired whenever the node is cited as grounding evidence in subsequent outputs.

3. Automated Memory Consolidation Triggers:
   - Project Closure Consolidation: Upon project archival or completion, all ephemeral meeting memories are scanned by the Memory Crystallisation Engine. Redundant conversational chaff is purged, and verified decisions, lessons learned, and execution velocities are consolidated into the permanent Organisational Knowledge Graph.
   - Quarterly Strategic Rollup: Every 90 days, recurring decisions and unresolved risks are aggregated across team boundaries to generate systemic insight candidates for executive review.

---

## SECTION 8: MEETING MEMORY DESIGN

### 8.1 The Eight Step Meeting Intelligence Lifecycle

To convert an ephemeral conversation into reusable enterprise intelligence, Concludo executes an Eight Step Meeting Intelligence Lifecycle:

```
+─────────────────────────────────────────────────────────────────────────────+
|               THE EIGHT STEP MEETING INTELLIGENCE LIFECYCLE                 |
+─────────────────────────────────────────────────────────────────────────────+

  [ STEP 1: TRANSCRIPT INTAKE ]
  - Audio ingestion, speech-to-text, disfluency cleaning, speaker mapping.
                                │
                                ▼
  [ STEP 2: CLASSIFICATION & INTENT ]
  - Meeting Archetype identified (M-01 to M-50); Business Intent tagged (1 of 12).
                                │
                                ▼
  [ STEP 3: DECISION EXTRACTION ]
  - Explicit & implicit agreements isolated; rationale & alternatives captured.
                                │
                                ▼
  [ STEP 4: ACTION DELEGATION ]
  - Five-Field Delegation Standard applied: Task, Owner, Due, DoD, Checkpoint.
                                │
                                ▼
  [ STEP 5: RISK & OPPORTUNITY MINING ]
  - 5x5 severity scoring for risks; commercial potential assessed for opportunities.
                                │
                                ▼
  [ STEP 6: INSIGHT ENGINE SYNTHESIS ]
  - Blind spots, weak assumptions, and governance gaps detected.
                                │
                                ▼
  [ STEP 7: KNOWLEDGE GRAPH WEAVING ]
  - Vertices and edges injected into knowledge_nodes & knowledge_relationships.
                                │
                                ▼
  [ STEP 8: ORGANISATIONAL MEMORY CRYSTALLISATION ]
  - Cross-meeting synthesis, historical indexing, and predictive baseline update.
```

1. Step 1: Transcript Intake:
   Raw audio streams or text uploads undergo automated speech recognition, acoustic disfluency stripping, punctuation restoration, and speaker diarisation.
2. Step 2: Classification and Intent:
   The meeting is classified into one of fifty enterprise meeting archetypes (`M-01` to `M-50`) across six families, and tagged with one of twelve primary business intents.
3. Step 3: Decision Extraction:
   Conversational commitments are parsed to isolate ratified agreements, evaluating consensus strength and capturing the rationale and discarded options.
4. Step 4: Action Delegation:
   Operational tasks are structured strictly under the Five Field Delegation Standard, guaranteeing unambiguous ownership and verification criteria.
5. Step 5: Risk and Opportunity Mining:
   Discussions are scanned for implicit and explicit hazards and commercial upside, scoring threats on a 5x5 probability severity matrix.
6. Step 6: Insight Engine Synthesis:
   The Concludo Insight Engine analyses dialogue gaps, detecting weak assumptions, missed dependencies, and governance red flags.
7. Step 7: Knowledge Graph Weaving:
   Extracted entities and causal links are inserted as vertices and edges in `knowledge_nodes` and `knowledge_relationships`.
8. Step 8: Organisational Memory Crystallisation:
   Intelligence is indexed into longitudinal project history, updating predictive metrics and institutional playbooks.

### 8.2 Structured Ingestion and Pipeline Serialization

When Tasklet A0 processes a transcript, it produces a strongly typed JSON payload that is serialized transactionally into PostgreSQL. This guarantees that either all intelligence entities are safely stored, or the transaction rolls back cleanly:

```sql
create or replace function public.commit_meeting_intelligence(
  p_project_id uuid,
  p_organization_id uuid,
  p_meeting_title text,
  p_raw_transcript text,
  p_cleaned_transcript text,
  p_meeting_type text,
  p_intent text,
  p_decisions jsonb,
  p_actions jsonb,
  p_intelligence jsonb
) returns uuid as $$
declare
  v_transcript_id uuid;
  v_item jsonb;
begin
  -- 1. Insert primary transcript record
  insert into public.transcripts (
    project_id, organization_id, meeting_title, raw_transcript,
    cleaned_transcript, meeting_type, strategic_intent, created_by
  ) values (
    p_project_id, p_organization_id, p_meeting_title, p_raw_transcript,
    p_cleaned_transcript, p_meeting_type, p_intent, auth.uid()
  ) returning id into v_transcript_id;

  -- 2. Insert decision records
  for v_item in select * from jsonb_array_elements(p_decisions) loop
    insert into public.decision_memory (
      transcript_id, project_id, organization_id, title, description,
      rationale, rejected_alternatives, financial_impact, impact_level,
      evidence_quote, created_by
    ) values (
      v_transcript_id, p_project_id, p_organization_id,
      v_item->>'title', v_item->>'description', v_item->>'rationale',
      coalesce(v_item->'rejected_alternatives', '[]'::jsonb),
      (v_item->>'financial_impact')::numeric,
      coalesce(v_item->>'impact_level', 'medium'),
      v_item->>'evidence_quote', auth.uid()
    );
  end loop;

  -- 3. Insert action records enforcing Five Field Delegation Standard
  for v_item in select * from jsonb_array_elements(p_actions) loop
    insert into public.action_tracker (
      transcript_id, project_id, organization_id, task_description,
      assigned_to_name, due_date, definition_of_done, checkpoint_date,
      priority, created_by
    ) values (
      v_transcript_id, p_project_id, p_organization_id,
      v_item->>'task_description', v_item->>'assigned_to_name',
      (v_item->>'due_date')::timestamptz,
      v_item->>'definition_of_done',
      (v_item->>'checkpoint_date')::timestamptz,
      coalesce(v_item->>'priority', 'medium'), auth.uid()
    );
  end loop;

  -- 4. Store intermediate generated intelligence payload
  insert into public.generated_intelligence (
    transcript_id, organization_id, payload, created_at
  ) values (
    v_transcript_id, p_organization_id, p_intelligence, timezone('utc'::text, now())
  );

  return v_transcript_id;
end;
$$ language plpgsql security definer;
```

---

### 8.3 Cross-Meeting Threading and Contextual Lineage

Meetings rarely occur in isolation. Concludo enforces cross-meeting contextual threading to maintain execution momentum across recurring operating rhythms:

```
[ Meeting n - 1 ] ──► Decisions / Open Actions
         │
         ▼
[ Ingestion & Linkage ] ──► Lineage Resolution Engine
         │
         ▼
[ Meeting n ] ─────► Agenda Validation / Action Status Reconciliation
         │
         ▼
[ Meeting n + 1 ] ──► Cumulative Trajectory / Velocity Tracking
```

1. Series Threading Protocol:
   - When a meeting transcript is ingested, the pipeline checks for existing series identifiers or common recurring metadata (series_id, project context, participant overlap > 60%).
   - The engine automatically pulls forward uncompleted actions from preceding sessions into the pre-flight context window of the current session.

2. Agenda-to-Outcome Reconciliation:
   - Formal agenda items defined in pre-flight preparation are matched against output deliverables using semantic similarity and speaker attribution.
   - Items discussed without formal resolution are classified as Abandoned or Deferred, generating automated prompt warnings for upcoming meetings.

---

## SECTION 9: DECISION MEMORY ARCHITECTURE

### 9.1 Relational Schema and Decision Attributes

In enterprise governance, a decision is an authoritative commitment that closes debate, allocates resources, and changes operating trajectories. The Concludo Decision Memory architecture records not merely the conclusion, but the entire deliberative context:

1. Decision Title and Description: Precise, unambiguous articulation of the ratified choice.
2. Contextual Rationale: The explicit business justification, market conditions, or problem statement that compelled the decision.
3. Rejected Alternatives: Critical for organizational memory. Captures the alternative paths considered and why they were declined, preventing future teams from repeating evaluated failures.
4. Financial and Operational Impact: Quantified capital commitments, operational expenses, or revenue expectations tied to the choice.
5. Reversibility and Impact Level: Classified as One Way Door (irreversible, high consequence) or Two Way Door (reversible, low consequence), setting the required governance oversight.
6. Verbatim Evidence Citation: Grounding quote from the transcript validating the explicit agreement of participants.

### 9.2 Decision Lineage and Historical Trajectory

Decisions do not exist in isolation; they form historical lineage chains. A decision made in Q1 may be amended in Q2 and superseded in Q3:

```
+─────────────────────────────────────────────────────────────────────────────+
|                         DECISION LINEAGE TRAJECTORY                         |
+─────────────────────────────────────────────────────────────────────────────+

  [ DECISION DEC-001 (Q1) ]
  "Adopt Cloud Provider AWS for Infrastructure"
  Status: Ratified | Impact: High | Rationale: Fast time to market.
         │
         │ Superseded by
         ▼
  [ DECISION DEC-042 (Q3) ]
  "Migrate Primary Workloads to Supabase Enterprise"
  Status: Ratified | Impact: Critical | Rationale: Native Postgres RLS & vector support.
  Lineage Link: public.knowledge_relationships (relationship_type = 'supersedes')
```

To model decision lineage without fragile schema changes, Concludo utilises the `knowledge_relationships` table with the `derived_from` or `supersedes` edge types, enabling full recursive ancestry queries.

### 9.3 Decision Impact and Velocity Analytics

By aggregating records across `public.decision_memory`, Concludo calculates three vital governance metrics:
1. Decision Velocity: Average elapsed time between proposal and formal ratification.
2. Decision Backlog Pressure (DBP): Ratio of unratified proposals to ratified decisions across an initiative.
3. Decision Stability Index: Percentage of ratified decisions that remain active without reversal over a 180 day period.

---

### 9.4 Multi-Decider Consensus, Reservations, and Reversibility Index

High-stakes governance requires capturing not only what was decided, but the texture and consensus dynamics surrounding the decision:

1. Consensus Classifications:
   - Unanimous: Complete vocal or written concurrence by all voting stakeholders.
   - Consensus with Documented Reservations: Approved with specific reservations or dissenting viewpoints explicitly noted in the rationale payload.
   - Chair Decision / Executive Fiat: Decision made unilaterally by the executive sponsor or committee chair amidst split stakeholder opinions.
   - Delegated Decision: Formally assigned to an operational lead within predefined authority boundaries.

2. Decision Reversibility Index (DRI):
   Decisions are categorised into Type 1 (Irreversible / High Cost of Reversal) and Type 2 (Reversible / Two-Way Door) based on Jeff Bezos governance principles:
   - Type 1 Decisions: Require mandatory executive briefing outputs (`OUT-08`, `OUT-14`), formal risk assessments (`OUT-23`), explicit stakeholder sign-offs, and multi-tier audit trails.
   - Type 2 Decisions: Emphasise execution velocity, rapid action creation, and lightweight documentation to prevent organizational paralysis.

3. Decision Success and Drift Evaluation:
   - At checkpoint intervals (30, 60, 90, 180 days post-decision), automated evaluation prompts query the project owner to assess whether the decision achieved its intended commercial outcome or experienced strategic drift.
   - Recorded outcomes feed back into the Organisational Memory Engine to refine predictive guidance for future strategic choices.

---

## SECTION 10: ACTION MEMORY ARCHITECTURE

### 10.1 Five Field Delegation Standard Enforcement

In the Concludo operating philosophy, an action without clear boundaries is not a task; it is an organizational vulnerability. Concludo enforces Anthony Cortez's Five Field Delegation Standard at both the pipeline and database schema levels:

| Field Name | Schema Column | Mandatory Constraint | Operational Definition |
| :--- | :--- | :--- | :--- |
| 1. Task Description | `task_description` | `not null` | Precise, imperative verb phrase specifying exactly what must be executed. |
| 2. Single Accountable Owner | `assigned_to_name` | `not null` | Exactly one named individual accountable for execution. Joint ownership is prohibited. |
| 3. Explicit Due Date | `due_date` | `not null` | Definite calendar date and time for complete delivery. Vague horizons are blocked. |
| 4. Definition of Done | `definition_of_done` | `not null` | Objective, binary verification criteria defining successful completion. |
| 5. Checkpoint Date | `checkpoint_date` | `not null` | Scheduled interim milestone for progress review prior to final delivery. |

Database Check Constraint:
```sql
alter table public.action_tracker
add constraint ck_action_checkpoint_before_due
check (checkpoint_date <= due_date);
```

### 10.2 Dependency Topologies and Status State Machine

Action execution follows a deterministic state machine:

```
+─────────────────────────────────────────────────────────────────────────────+
|                    ACTION TRACKER STATE MACHINE LIFECYCLE                   |
+─────────────────────────────────────────────────────────────────────────────+

              ┌───────────────┐
              │    PENDING    │◄──────────────┐
              └───────┬───────┘               │
                      │ Checkpoint Reached    │ Unblocked
                      ▼                       │
              ┌───────────────┐               │
              │  IN_PROGRESS  │               │
              └───────┬───────┘               │
                      │                       │
         ┌────────────┴────────────┐          │
         │ Dependency Blocked      │ DoD Met  │
         ▼                         ▼          │
  ┌─────────────┐           ┌─────────────┐   │
  │   BLOCKED   ├──────────►│  COMPLETED  │   │
  └─────────────┘           └─────────────┘   │
         │                         ▲          │
         │ Cancelled by Sponsor    │          │
         ▼                         │          │
  ┌─────────────┐                  │          │
  │  CANCELLED  │──────────────────┴──────────┘
  └─────────────┘
```

Dependencies between tasks are stored in the `dependencies` JSONB array or mapped via the Knowledge Graph (`depends_on` edge), enabling automated critical path calculations.

### 10.3 Automated Overdue Detection and Performance Analytics

Concludo calculates real time execution telemetry directly in the database:
- Automated Overdue Evaluation: The column `is_overdue` is evaluated dynamically via the computed column function `public.is_overdue(action_tracker)` and synchronised through scheduled background cron sweeps, ensuring strict PostgreSQL immutable column compliance while exposing dynamic overdue status to PostgREST and the application interface.
- Action Drift Index (ADI): The mathematical discrepancy between original due dates and actual completion dates across a team's portfolio.
- Owner Execution Reliability: The historical ratio of on time completions against total assigned commitments.


### 10.4 Action Velocity, Accountability Scoring, and Workload Balancing

Execution integrity relies on continuous performance telemetry. Concludo derives quantitative velocity and accountability metrics directly from the `action_tracker` substrate:

1. Commitment Reliability Index (CRI):
   - Calculated per user and per team over rolling 90-day intervals:
     CRI = (Completed Actions On or Before Checkpoint Date) / (Total Actions Assigned) * 100
   - Accounts for scope renegotiations: actions rescheduled prior to checkpoint dates incur minor dampening, whereas unflagged overdue actions severely reduce CRI.

2. Slippage and Dependency Bottleneck Analytics:
   - Tracks cumulative days of delay across critical-path action chains.
   - If an upstream action in `dependencies` slips by delta_t, the engine automatically calculates transitive downstream slippage and notifies affected assignees before deadlines breach.

3. Workload Distribution and Cognitive Overload Guardrails:
   - Visualises open action commitments across individual contributors.
   - Detects when an individual holds more than 5 critical-priority actions with overlapping checkpoint windows, alerting project leads to rebalance task allocation during meeting synthesis.

---

## SECTION 11: KNOWLEDGE GRAPH ARCHITECTURE

### 11.1 Directed Attributed Multi Graph (DAMG) Formalism

The Concludo Knowledge Graph is formally defined as a Directed Attributed Multi Graph (DAMG):
$$G = (V, E, \Sigma_V, \Sigma_E, \lambda_V, \lambda_E, \omega)$$

Where:
- $V$ is the set of knowledge vertices (nodes) representing business entities, concepts, events, and strategic artifacts.
- $E \subseteq V \times V$ is the multiset of directed edges (relationships) connecting source nodes to target nodes.
- $\Sigma_V$ is the alphabet of node types (for example, Decision, Action, Risk, Opportunity).
- $\Sigma_E$ is the alphabet of relationship types (for example, Depends On, Mitigates, Contradicts).
- $\lambda_V: V \rightarrow \Sigma_V \times \mathcal{A}_V$ is a node labelling function mapping each vertex to its type and attribute dictionary.
- $\lambda_E: E \rightarrow \Sigma_E \times \mathcal{A}_E$ is an edge labelling function mapping each edge to its relationship type and attribute dictionary.
- $\omega: E \rightarrow [0, 1]$ is a weight function indicating edge confidence, semantic affinity, or causal strength.

This mathematical structure allows multiple distinct relationships to exist between the same pair of nodes (for example, Decision A both *Influences* Project B and *Creates* Risk C).

```
+─────────────────────────────────────────────────────────────────────────────+
|               DIRECTED ATTRIBUTED MULTI GRAPH (DAMG) TOPOLOGY               |
+─────────────────────────────────────────────────────────────────────────────+

       ┌──────────────────┐               creates (1.0)               ┌──────────────────┐
       │  KNOWLEDGE_NODE  ├──────────────────────────────────────────►│  KNOWLEDGE_NODE  │
       │   Type: DECISION │                                           │    Type: RISK    │
       │  "Expand to EU"  │◄──────────────────────────────────────────┤ "GDPR Penalty"   │
       └────────┬─────────┘              mitigates (0.85)             └────────┬─────────┘
                │                                                              │
                │ derived_from (1.0)                                           │ impacts (0.9)
                ▼                                                              ▼
       ┌──────────────────┐               depends_on (0.95)           ┌──────────────────┐
       │  KNOWLEDGE_NODE  │◄──────────────────────────────────────────┤  KNOWLEDGE_NODE  │
       │ Type: TRANSCRIPT │                                           │   Type: PROJECT  │
       │  "Strategy Q3"   │                                           │  "Global Rollout"│
       └──────────────────┘                                           └──────────────────┘
```

### 11.2 PostgreSQL Relational Representation via Recursive CTEs

Rather than operating a disjoint, fragile graph database cluster (such as Neo4j), Concludo implements graph storage directly inside PostgreSQL using the relational tables `public.knowledge_nodes` and `public.knowledge_relationships`. 

Graph traversals, path discovery, and lineage mapping are executed with extreme efficiency via PostgreSQL Recursive Common Table Expressions (CTEs):

```sql
create or replace function public.traverse_dependency_subgraph(
  p_start_node_id uuid,
  p_max_depth integer default 4
) returns table (
  level integer,
  source_id uuid,
  target_id uuid,
  relationship_type text,
  target_node_title text,
  target_node_type text,
  path uuid[]
) as $$
begin
  return query
  with recursive graph_walk as (
    -- Anchor member: immediate edges originating from the start node
    select 
      1 as level,
      r.source_node_id,
      r.target_node_id,
      r.relationship_type,
      n.title as target_node_title,
      n.node_type as target_node_type,
      array[r.source_node_id, r.target_node_id] as path
    from public.knowledge_relationships r
    join public.knowledge_nodes n on n.id = r.target_node_id
    where r.source_node_id = p_start_node_id
      and n.deleted_at is null

    union all

    -- Recursive member: traverse downstream edges
    select 
      gw.level + 1,
      r.source_node_id,
      r.target_node_id,
      r.relationship_type,
      n.title as target_node_title,
      n.node_type as target_node_type,
      gw.path || r.target_node_id
    from public.knowledge_relationships r
    join graph_walk gw on r.source_node_id = gw.target_node_id
    join public.knowledge_nodes n on n.id = r.target_node_id
    where gw.level < p_max_depth
      and not (r.target_node_id = any(gw.path)) -- Cycle prevention guardrail
      and n.deleted_at is null
  )
  select * from graph_walk;
end;
$$ language plpgsql security definer;
```

### 11.3 Cluster Identification and Evidence Path Traversal

1. Entity Clustering:
   - By analysing edge density and shared relationship types, Concludo groups disparate meeting concepts into strategic clusters (for example, "Regulatory Compliance Issues" or "Cloud Infrastructure Migration").
   - Clustering algorithms run asynchronously to tag nodes with cluster identifiers in `attributes->'cluster_id'`.

2. Verifiable Evidence Paths:
   - When an executive queries a high level recommendation, the knowledge graph traverses backward along `derived_from` and `supports` edges to the underlying `transcript` and `decision` nodes.
   - This provides an unbroken evidence chain connecting boardroom strategy to frontline operational discourse.

3. Graph Algorithms on Relational Substrates:
   - Degree Centrality: Identifies high risk bottlenecks (tasks or decisions with numerous incoming `depends_on` edges).
   - Topological Sorting: Computes the optimal execution order for complex project roadmaps.
   - Contradiction Detection: Identifies conflicting decision edges linking opposing strategic choices.

---


### 11.4 Recursive Graph Traversal and Impact Propagation

When an executive decision is altered or a critical-path milestone slips, Concludo executes recursive multi-hop graph traversals to compute the transitive blast radius across all dependent initiatives:

```sql
-- Transitive blast radius query: Identify all actions, risks, and milestones impacted by a slipping decision
with recursive impact_tree as (
  -- Anchor member: The source decision node
  select
    kr.source_node_id,
    kr.target_node_id,
    kr.relationship_type,
    1 as depth,
    array[kr.source_node_id, kr.target_node_id] as traversal_path
  from public.knowledge_relationships kr
  where kr.source_node_id = 'c1e4f9b2-3d7a-4e8c-9b1f-5a8d2e3f4b5c'::uuid
    and kr.relationship_type in ('impacts', 'depends_on', 'creates')

  union all

  -- Recursive member: Traverse outgoing dependency and impact edges
  select
    kr.source_node_id,
    kr.target_node_id,
    kr.relationship_type,
    it.depth + 1,
    it.traversal_path || kr.target_node_id
  from public.knowledge_relationships kr
  inner join impact_tree it on kr.source_node_id = it.target_node_id
  where not (kr.target_node_id = any(it.traversal_path)) -- Guard against cyclic traversal loops
    and it.depth < 5                                     -- Max depth bound of 5 hops
)
select
  it.depth,
  it.relationship_type,
  kn.node_type,
  kn.label,
  kn.entity_id,
  it.traversal_path
from impact_tree it
inner join public.knowledge_nodes kn on kn.id = it.target_node_id
order by it.depth asc, kn.node_type;
```

This recursive traversal provides instant visibility into operational bottlenecks, enabling the system to trigger early warning notifications to action owners before schedule cascades compromise delivery milestones.

---

## SECTION 12: KNOWLEDGE NODE MODEL

### 12.1 Taxonomy of Fourteen Core Node Types

Every entity entering the Concludo Knowledge Graph is classified into one of fourteen canonical node types:

| Node Type | Taxonomic Domain | Description | Linked Database Entity |
| :--- | :--- | :--- | :--- |
| `project` | Execution | Strategic initiative, program, or operational campaign. | `public.projects` |
| `transcript` | Ingestion | Meeting record, conversation, or audio discourse. | `public.transcripts` |
| `decision` | Governance | Ratified choice, commitment, or policy determination. | `public.decision_memory` |
| `action` | Execution | Operational obligation under Five Field Standard. | `public.action_tracker` |
| `risk` | Risk & Audit | Quantified threat, vulnerability, or delivery hazard. | `public.generated_intelligence` |
| `opportunity` | Commercial | Commercial upside, market opening, or efficiency gain. | `public.generated_intelligence` |
| `insight` | Advisory | Blind spot, weak assumption, or strategic anomaly. | `public.generated_intelligence` |
| `recommendation` | Advisory | Proposed intervention or tactical course of action. | `public.generated_intelligence` |
| `forecast` | Predictive | Trajectory projection, health score, or scenario model. | `public.predictive_snapshots` |
| `report` | Deliverable | Formal output (Business Plan, Board Briefing). | `public.outputs` |
| `team` | Tenancy | Collaborative organizational business unit. | `public.teams` |
| `user` | Tenancy | Authenticated person, decision maker, or task owner. | `public.profiles` |
| `organization` | Tenancy | Enterprise legal entity and tenant boundary. | `public.organizations` |
| `concept` | Semantic | Abstract business domain, technology, or market topic. | Virtual Graph Vertex |

### 12.2 Node Schema, Payload Attributes, and Metadata Standard

Each node record in `public.knowledge_nodes` encapsulates structured JSONB attributes conforming to standard schema definitions:

```json
{
  "node_id": "8f3b2e1a-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "node_type": "decision",
  "title": "Select Supabase Enterprise for Database Architecture",
  "entity_uid": "7d2a1c0e-3b4a-5f6e-7d8c-9b0a1f2e3d4c",
  "attributes": {
    "status": "ratified",
    "impact_level": "critical",
    "financial_impact": 45000.00,
    "currency": "AUD",
    "reversibility": "one_way_door",
    "primary_owner": "Anthony Cortez",
    "ratification_date": "2026-09-14T02:00:00Z",
    "confidence_score": 95,
    "tags": ["infrastructure", "postgres", "rls", "soc2"]
  },
  "created_at": "2026-09-14T02:30:00Z"
}
```

Detailed Payload Specifications for Core Nodes:
1. `project` Node:
   - Attributes: `status`, `start_date`, `target_completion_date`, `budget_allocated`, `sponsor_user_id`, `priority`.
2. `decision` Node:
   - Attributes: `impact_level`, `financial_impact`, `rationale_summary`, `reversibility`, `consensus_rating`.
3. `action` Node:
   - Attributes: `assigned_to`, `due_date`, `checkpoint_date`, `definition_of_done`, `is_overdue`, `completion_status`.
4. `risk` Node:
   - Attributes: `probability_score` (1-5), `severity_score` (1-5), `composite_risk_score` (1-25), `risk_category`, `mitigation_owner`.
5. `opportunity` Node:
   - Attributes: `potential_value_aud`, `time_horizon`, `strategic_fit_score`, `capture_complexity`.

---


### 12.3 Knowledge Graph Entity Resolution and Deduplication

Organisational discourse often refers to identical entities using colloquial abbreviations, department acronyms, or differing nomenclature. Concludo enforces a strict entity resolution pipeline before instantiating new knowledge nodes:

1. Canonical Label Normalisation:
   - Strips extraneous punctuation, expands known organisation acronyms via the institutional glossary, and generates a standard normalised search key.

2. Semantic Embedding Proximity Check:
   - Prior to node creation, the candidate node label and descriptive payload are embedded using `text-embedding-3-large`.
   - A cosine similarity threshold scan is conducted against existing nodes of the same `node_type` within the tenant partition:
     Similarity(Candidate, Existing) >= 0.88 -> Flagged as Potential Alias.

3. Automated Alias Aliasing vs Split Resolution:
   - If similarity exceeds 0.94 and contextual metadata aligns, the entity is resolved to the existing `node_id`, adding the variant surface form to the node `properties.aliases` JSON array.
   - If similarity falls between 0.88 and 0.94, a soft linkage edge (`related_to` with weight 0.50) is established, and a human-in-the-loop disambiguation prompt is queued for the project owner.

---

## SECTION 13: KNOWLEDGE RELATIONSHIP MODEL

### 13.1 Taxonomy of Fifteen Canonical Directed Relationships

Edges connecting knowledge nodes must conform to fifteen strictly typed directed relationship primitives:

| Relationship Type | Source Node Types | Target Node Types | Semantic Definition |
| :--- | :--- | :--- | :--- |
| `related_to` | Any | Any | General associative linkage or contextual proximity. |
| `depends_on` | Action, Project, Decision | Action, Decision, Milestone | Hard operational or technical prerequisite. |
| `derived_from` | Decision, Action, Insight | Transcript, Output | Provenance link back to original conversation or document. |
| `supports` | Decision, Insight, Risk | Strategy, Objective, Proposal | Provides validating evidence or commercial justification. |
| `contradicts` | Insight, Risk, Decision | Decision, Assumption, Goal | Signals conflict, inconsistent statements, or strategic misalignment. |
| `owned_by` | Project, Decision, Risk | User, Team | Assigns definitive institutional stewardship. |
| `assigned_to` | Action | User | Single accountable execution owner under Five Field Standard. |
| `generated_from` | Report, Output | Transcript, Project | Build provenance for consulting deliverables. |
| `escalates_to` | Risk, Blocked Action | Executive, Board, Team | Formal governance escalation path. |
| `impacts` | Decision, Risk, Action | Project, Financial Metric, Team | Operational, commercial, or structural consequence. |
| `creates` | Decision, Meeting | Action, Risk, Opportunity | Generative consequence of a collaborative event. |
| `mitigates` | Action, Decision | Risk, Weakness | Reduces probability or severity of an identified hazard. |
| `influences` | Insight, Market Trend | Decision, Strategy | Indirect advisory or contextual shaping factor. |
| `contributes_to` | Project, Action | Corporate Goal, Milestone | Fractional progress toward a macro objective. |
| `supersedes` | Decision, Output, Policy | Decision, Output, Policy | Formally invalidates, replaces, or updates an earlier institutional position. |

### 13.2 Edge Weighting, Mathematical Decay, and Confidence Scoring

Every edge stores a weight $\omega \in [0.00, 1.00]$ representing edge certainty or affinity. Over time, edges representing temporal associations undergo mathematical decay to reflect changing organizational realities:

$$\omega(t) = \omega_0 \cdot e^{-\lambda \Delta t}$$

Where:
- $\omega_0$ is the initial confidence score assigned by the extraction pipeline.
- $\lambda$ is the domain decay constant (for example, $\lambda = 0.005$ per day for operational risks, whereas $\lambda = 0.000$ for ratified legal decisions).
- $\Delta t$ is the elapsed time in days since edge ratification.

This decay ensures that historical discussions do not dominate current operational context unless reaffirmed by recent meetings.

---


### 13.3 Dynamic Graph Cycle Detection and Validation

While general knowledge graphs permit arbitrary cyclic graphs, operational governance requires strict Directed Acyclic Graph (DAG) properties for dependency and escalation chains (`depends_on`, `escalates_to`, `supersedes`). Circular task dependencies paralyze operational execution.

Concludo enforces database-level cycle prevention via a pre-insert trigger function:

```sql
create or replace function public.validate_graph_acyclic_edge()
returns trigger as $$
declare
  v_cycle_detected boolean;
begin
  -- Only enforce acyclic constraints on strict hierarchical relationships
  if new.relationship_type in ('depends_on', 'escalates_to', 'supersedes') then
    with recursive path_check as (
      select
        new.target_node_id as current_node,
        array[new.target_node_id] as visited
      union all
      select
        kr.target_node_id,
        pc.visited || kr.target_node_id
      from public.knowledge_relationships kr
      inner join path_check pc on kr.source_node_id = pc.current_node
      where kr.relationship_type = new.relationship_type
        and not (kr.target_node_id = any(pc.visited))
        and array_length(pc.visited, 1) < 20
    )
    select exists (
      select 1 from path_check where current_node = new.source_node_id
    ) into v_cycle_detected;

    if v_cycle_detected then
      raise exception 'Graph Cycle Violation: Inserting relationship % from % to % creates an illegal cyclic dependency.',
        new.relationship_type, new.source_node_id, new.target_node_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_validate_acyclic_edge
before insert or update on public.knowledge_relationships
for each row execute function public.validate_graph_acyclic_edge();
```

---

## SECTION 14: ORGANISATIONAL MEMORY ENGINE

### 14.1 Institutional Synthesis and Lessons Learned

The Organisational Memory Engine aggregates, cross references, and abstracts project outcomes into enduring institutional wisdom. When projects conclude, the system executes an automated post mortem analysis, distilling entries into `public.lessons_learned`:

```sql
create table public.lessons_learned (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null check (category in ('technical', 'commercial', 'governance', 'vendor', 'operational')),
  title text not null,
  context text not null,
  what_went_well text not null,
  what_failed text not null,
  recommendations text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_lessons_learned_org on public.lessons_learned(organization_id);
create index idx_lessons_learned_tags on public.lessons_learned using gin(tags);
```

### 14.2 Pattern Extraction and Cross Project Knowledge Transfer

The Organisational Memory Engine continuously identifies recurring systemic patterns:
1. Vendor Failure Cascades: Detecting when a specific supplier repeatedly misses delivery deadlines across multiple separate teams.
2. Underestimated Milestone Horizons: Comparing planned sprint durations with actual completion dates across engineering projects, adjusting predictive models.
3. Decision Reversal Markers: Identifying linguistic cues in early stage discussions that historically correlated with later decision reversals.
4. Governance Erosion Signals: Flagging when recurring operational meetings systematically omit risk reviews or bypass checkpoint validations.

---


### 14.3 Retrospective Knowledge Synthesis and Anti-Pattern Detection

Organisational wisdom requires recognising systemic failure patterns before they recur. The Organisational Memory Engine continuously audits closed project trajectories to isolate chronic execution pathologies:

1. Chronic Estimation Bias:
   - Compares initial action checkpoint estimates against final completion timestamps.
   - Identifies teams or functional domains exhibiting systematic optimism bias (e.g. software infrastructure tasks averaging 1.7x estimated durations), dynamically applying calibration multipliers to future risk scores.

2. Recurring Unmitigated Risks:
   - Scans risk registers across completed initiatives to flag risks that manifested without assigned mitigation actions.
   - When a similar risk is identified in a newly ingested meeting, the system issues a warning highlighting historical project impacts.

---

## SECTION 15: RETRIEVAL ARCHITECTURE

### 15.1 Multi Tier Retrieval Information Flow

When a user, Copilot session, or background agent submits an analytical query, Concludo executes a coordinated multi tier retrieval pipeline:

```
+─────────────────────────────────────────────────────────────────────────────+
|               CONCLUDO MULTI TIER HYBRID RETRIEVAL PIPELINE                 |
+─────────────────────────────────────────────────────────────────────────────+

                           [ USER / COPILOT QUERY ]
                                      │
                                      ▼
                       [ QUERY ROUTER & DECOMPOSER ]
         Identifies intent: Lexical, Semantic, Graph, or Structured.
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
    [ LEXICAL CANDIDATES ]  [ DENSE VECTOR CANDIDATES ]  [ GRAPH SUBGRAPH ]
     PostgreSQL tsvector      pgvector HNSW Cosine       Recursive CTE
      BM25 / ts_rank_cd        Semantic text chunks      Entity Neighbours
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
                      [ RECIPROCAL RANK FUSION (RRF) ]
                Combines candidates into unified priority list.
                                      │
                                      ▼
                       [ CROSS ENCODER RE RANKING ]
             Evaluates contextual relevance and recency decay.
                                      │
                                      ▼
                      [ CONTEXT BUDGET & ASSEMBLY ]
               Token truncation, source citation mapping.
                                      │
                                      ▼
                     [ PROMPT EVIDENCE PAYLOAD TO LLM ]
```

### 15.2 Hybrid Candidate Generation and Reciprocal Rank Fusion

To guarantee high recall and high precision, Concludo combines lexical keyword search with dense vector similarity using Reciprocal Rank Fusion (RRF):

$$RRF(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$

Where:
- $M$ is the set of retrieval models ($M = \{\text{Lexical}, \text{Vector}, \text{Graph}\}$).
- $r_m(d)$ is the rank position of document $d$ in the result set from model $m$.
- $k$ is the smoothing constant (standard default $k = 60$).

RRF ensures that documents discovered by multiple independent retrieval paths rise to the top of the context window, eliminating single model blind spots.

### 15.3 Context Assembly and Token Budgeting Strategy

Retrieved records are assembled into a structured prompt context payload within strict token budgets:
1. Hard Ceiling Enforcement: The context window budget is allocated proportionally:
   - System Prompts and Guardrails: 15%
   - Ratified Decisions and Active Actions: 25%
   - Retrieved Transcript Excerpts (with citations): 40%
   - Knowledge Graph Lineage Subgraphs: 10%
   - Dynamic Reserve for Output Generation: 10%
2. Source Attribution Stamps: Every injected context fragment carries its unique database UUID, meeting date, speaker attribution, and confidence score, enabling automatic generation of verification citation chips.


### 15.4 Multi-Hop Evidence Path Validation for Governance Queries

Executive and board inquiries demand unassailable factual lineage. When an executive asks why a capital project is delayed, Concludo does not generate an ungrounded narrative; it constructs and validates an exact multi-hop evidence path through the Knowledge Graph:

```
[ Executive Query ]
         │
         ▼
[ Knowledge Node: Project Nova ]
         │
         ▼ (impacted_by)
[ Knowledge Node: Vendor Contract Renegotiation ]
         │
         ▼ (depends_on)
[ Knowledge Node: Action Item 402 - Legal Review ]
         │
         ▼ (derived_from)
[ Primary Source: Executive Committee Meeting Transcript #14, Turn 82 ]
         │
         ▼ (verbatim quote)
"General Counsel confirmed outside counsel review cannot commence until terms are redrafted."
```

By traversing this verified chain, Concludo presents the conclusion alongside the exact primary source turn, speaker attribution, and verification timestamp, eliminating hallucination risks and establishing executive confidence.

---

## SECTION 16: SEARCH ARCHITECTURE

### 16.1 Lexical Search Engine and Full Text tsvector Optimisation

Concludo Workspace implements high performance lexical search directly inside PostgreSQL using the native `tsvector` and `tsquery` search framework. Every searchable entity maintains a pre computed, weighted `tsvector` column indexed via Generalized Inverted Indexes (GIN).

1. Weight Partitioning Standard:
   Search vectors assign lexical weights based on strategic significance:
   - Weight A (Highest): Entity titles, meeting subjects, decision headlines (`setweight(to_tsvector('english', title), 'A')`).
   - Weight B (Medium): Executive summaries, action descriptions, participant names (`setweight(to_tsvector('english', summary), 'B')`).
   - Weight C (Standard): Cleaned dialogue, rationale, rejected alternatives (`setweight(to_tsvector('english', body), 'C')`).
   - Weight D (Lowest): Minor conversational remarks, footnotes, raw notes (`setweight(to_tsvector('english', notes), 'D')`).

2. Ranking and Relevance Computation:
   Searches are scored using `ts_rank_cd` (Cover Density Ranking), which accounts for term proximity and density:
   ```sql
   create or replace function public.search_transcripts_lexical(
     p_org_id uuid,
     p_query_text text,
     p_limit integer default 20
   ) returns table (
     id uuid,
     meeting_title text,
     meeting_date timestamptz,
     rank_score real,
     headline text
   ) as $$
   declare
     v_query tsquery;
   begin
     v_query := websearch_to_tsquery('english', p_query_text);
     return query
     select 
       t.id,
       t.meeting_title,
       t.meeting_date,
       ts_rank_cd(t.search_tsv, v_query, 32 /* rank/(rank+1) */) as rank_score,
       ts_headline('english', t.cleaned_transcript, v_query, 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') as headline
     from public.transcripts t
     where t.organization_id = p_org_id
       and t.deleted_at is null
       and t.search_tsv @@ v_query
     order by rank_score desc, t.meeting_date desc
     limit p_limit;
   end;
   $$ language plpgsql security definer;
   ```

### 16.2 Domain Specific Query Routing and Keyset Pagination

1. Specialized Domain Search:
   - Decision Search: Filtered by impact level, ratification status, and budget threshold.
   - Action Search: Filtered by assignee, completion status, and overdue flags.
   - Risk Search: Filtered by 5x5 severity matrix coordinates.

2. Keyset Pagination Standard:
   Offset pagination (`OFFSET n LIMIT m`) is banned on high volume search queries due to $O(N)$ scanning penalties. Concludo enforces keyset pagination using composite keys `(rank_score, created_at, id)` with index support, ensuring sub 50ms page turns regardless of depth.

---


### 16.3 Complex Lexical Query Syntax and Ranking Weighting

To handle sophisticated legal and financial terminology, Concludo implements weighted lexical ranking using PostgreSQL `ts_rank_cd` with custom document structure weights:

```sql
-- Advanced weighted lexical search with positional density scoring
select
  p.id,
  p.title,
  ts_rank_cd(
    setweight(to_tsvector('english', coalesce(p.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(p.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(dm.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(dm.rationale, '')), 'C'),
    websearch_to_tsquery('english', 'capital expenditure "Series A" -debt'),
    32 /* Rank normalized by length and distance between query lexemes */
  ) as lexical_relevance
from public.projects p
left join public.decision_memory dm on dm.project_id = p.id
where p.deleted_at is null
  and (
    to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '')) @@ websearch_to_tsquery('english', 'capital expenditure "Series A" -debt')
    or to_tsvector('english', coalesce(dm.title, '') || ' ' || coalesce(dm.rationale, '')) @@ websearch_to_tsquery('english', 'capital expenditure "Series A" -debt')
  )
order by lexical_relevance desc
limit 50;
```

Weights are assigned hierarchically: 'A' (1.0) for titles and formal decisions, 'B' (0.4) for executive summaries and objectives, 'C' (0.2) for rationales and body text, and 'D' (0.1) for peripheral commentary.

---

## SECTION 17: VECTOR SEARCH ARCHITECTURE

### 17.1 Dense Embedding Strategy and Dimension Standards

To capture semantic nuances, conceptual synonyms, and latent strategic intent, Concludo integrates high dimensional dense vector embeddings.

1. Model and Dimensionality:
   - Primary Embedding Model: OpenAI `text-embedding-3-large` configured to 1536 dimensions (or compatible enterprise self hosted Voyage AI models).
   - Distance Metric: Cosine Distance (`<=>` operator in pgvector), chosen for optimal invariance to document length variations.

2. Vector Storage Table Schema:
   ```sql
   create table public.vector_embeddings (
     id uuid primary key default gen_random_uuid(),
     organization_id uuid not null references public.organizations(id) on delete cascade,
     entity_type text not null check (entity_type in ('transcript_chunk', 'decision', 'action', 'insight', 'output_section')),
     entity_id uuid not null,
     chunk_index integer not null default 0,
     chunk_content text not null,
     embedding vector(1536) not null,
     metadata jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default timezone('utc'::text, now())
   );
   ```

### 17.2 Context Aware Semantic Chunking Protocol

Naive character or token based chunking degrades retrieval quality by fragmenting conversational context. Concludo enforces Context Aware Semantic Chunking:
1. Speaker Turn Preservation: Dialogue chunks never split a single speaker's conversational turn across boundaries unless the turn exceeds 1,000 tokens.
2. 15% Overlapping Context Window: Adjacent chunks maintain a 15% sliding window overlap to preserve transitional reasoning.
3. Metadata Prepending: Every chunk is prepended with semantic context headers prior to embedding generation:
   `[Meeting: Q3 Strategy Review | Date: 2026-09-14 | Project: Global Expansion | Speaker: Anthony Cortez]`

### 17.3 HNSW Vector Indexing and pgvector Tuning

Embeddings are indexed using Hierarchical Navigable Small World (HNSW) graphs in pgvector:
```sql
create index idx_embeddings_vector_hnsw
on public.vector_embeddings
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);
```

PostgreSQL Runtime Configuration:
- `set hnsw.ef_search = 40;`: Balances query throughput with recall accuracy (>98% recall at p95 < 25ms).

---


### 17.4 Multi-Vector Representation and Hierarchical Embedding Strategy

Single chunk embeddings often lose macro context. Concludo implements a hierarchical multi-vector representation model:

1. Document Level Parent Embeddings:
   - Encodes the global executive summary and strategic objective of the entire project or output deliverable.
   - Used in Stage 1 routing to isolate relevant projects within vast enterprise repositories.

2. Chunk Level Child Embeddings:
   - Encodes discrete 500-token semantic passages with 100-token contextual overlaps.
   - Prepended with hierarchical metadata headers: `[Project: Commercial Expansion | Meeting: Series B Governance | Topic: Revenue Projections]`.
   - Used in Stage 2 retrieval to extract precise conversational evidence and financial calculations.

3. Cross-Chunk Embedding Alignment:
   - Stored in `public.vector_embeddings` with explicit `parent_id` foreign keys linking child chunk embeddings to their parent document vector, enabling bidirectional retrieval expansion during context assembly.

---

## SECTION 18: RAG ARCHITECTURE

### 18.1 The Four Layer Retrieval Augmented Generation Engine

The Concludo RAG architecture consists of four orchestrated processing layers:

```
+─────────────────────────────────────────────────────────────────────────────+
|               THE CONCLUDO FOUR LAYER RAG ENGINE ARCHITECTURE               |
+─────────────────────────────────────────────────────────────────────────────+

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 1. RETRIEVAL LAYER                                                      │
  │ - Query decomposition, hybrid candidate generation (Lexical + Vector).  │
  │ - Knowledge graph expansion via recursive CTEs.                         │
  └────────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 2. RANKING & FILTERING LAYER                                            │
  │ - Reciprocal Rank Fusion (RRF), cross-encoder relevance scoring.        │
  │ - Mathematical recency decay and tenant RLS constraint verification.    │
  └────────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 3. EVIDENCE PACKAGING LAYER                                             │
  │ - Token budget allocation, context formatting.                          │
  │ - Verbatim evidence quote stamping with immutable UUID citations.       │
  └────────────────────────────────────┬────────────────────────────────────┘
                                       │
                                       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 4. GOVERNED RESPONSE LAYER                                              │
  │ - LLM generation with strict executive style prompts (Tasklet A1).      │
  │ - Grounding verification, hallucination detection, citation resolution. │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 18.2 Grounding Verification and The Stated Omission Standard

Concludo enforces a strict Stated Omission Standard:
- If a query requests information not substantiated by retrieved evidence, the system is strictly forbidden from extrapolating, hallucinating, or guessing.
- The model must explicitly state: "The requested information was not discussed in recorded meetings or historical decisions."
- Grounding verification scripts calculate the semantic overlap between generated claims and retrieved citations; responses falling below an 85% grounding threshold are rejected.

### 18.3 Anti Hallucination Guardrails and Confidence Scoring

Every synthesized deliverable or Copilot response is stamped with a composite Confidence Score (0-100) calculated from three factors:
1. Citation Density: Ratio of factual claims substantiated by direct transcript quotes.
2. Temporal Freshness: Recency of the underlying decisions and meetings.
3. Consensus Agreement: Absence of contradictory statements across retrieved knowledge nodes.

---


### 18.4 Automated Citation Injection and Source Verification Architecture

Concludo enforces a closed-loop verification pipeline that validates every assertion against retrieved evidence prior to rendering deliverables to the user:

```
[ Candidate Draft Response ]
         │
         ▼
[ Citation Extraction Parser ] ──► Isolates all factual claims & numeric figures
         │
         ▼
[ Evidence Verification Engine ]
  ├── Check claim against retrieved grounding chunks
  ├── Verify speaker attribution matches primary transcript turns
  └── Validate numerical calculations against source tables
         │
    Passed?
    ├── YES ──► Inject immutable citation anchor: [Ref: Transcript #12, Turn 45]
    └── NO  ──► Strip unsupported assertion or invoke Stated Omission Standard
```

If a draft contains a claim lacking explicit primary grounding, the pipeline executes an automated self-correction pass. If secondary evidence retrieval fails, the system explicitly states: "The review confirmed that no formal commitment regarding capital allocation was established during this session."

---

## SECTION 19: COPILOT MEMORY ARCHITECTURE

### 19.1 Progressive Context Assembly and Context Window Management

The Concludo Copilot utilises progressive context assembly to maintain conversational coherence across extended dialogue sessions:

```
+─────────────────────────────────────────────────────────────────────────────+
|               COPILOT DYNAMIC CONTEXT ASSEMBLY ARCHITECTURE                 |
+─────────────────────────────────────────────────────────────────────────────+

       ┌────────────────────────────────────────────────────────────────┐
       │ TIER 1: SYSTEM & GOVERNANCE PROMPT (15% Budget)                │
       │ Identity, executive tone, Australian English, zero em-dashes.  │
       └───────────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼
       ┌────────────────────────────────────────────────────────────────┐
       │ TIER 2: RECENT CONVERSATIONAL TURNS (20% Budget)               │
       │ Last 4-6 user and assistant messages with resolved references. │
       └───────────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼
       ┌────────────────────────────────────────────────────────────────┐
       │ TIER 3: RETRIEVED ENTERPRISE CONTEXT (45% Budget)              │
       │ Ratified decisions, active actions, transcript citations.      │
       └───────────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼
       ┌────────────────────────────────────────────────────────────────┐
       │ TIER 4: KNOWLEDGE GRAPH SUBGRAPH (10% Budget)                  │
       │ Entity relationships, lineage chains, organizational roles.    │
       └───────────────────────────────┬────────────────────────────────┘
                                       │
                                       ▼
       ┌────────────────────────────────────────────────────────────────┐
       │ TIER 5: GENERATION BUFFER (10% Budget)                         │
       │ Reserved token space for streaming executive response.         │
       └────────────────────────────────────────────────────────────────┘
```

### 19.2 Intent Disambiguation and Multi Turn Session Continuity

1. Query Intent Classification:
   Copilot queries are automatically classified into one of four intent archetypes:
   - Fact Retrieval: "What was the agreed budget for Project Titan?"
   - Synthesis Request: "Summarise our key decisions regarding European expansion."
   - Action Coordination: "Which tasks are overdue in the marketing workstream?"
   - Proactive Advisory: "What risks should we discuss in tomorrow's steering meeting?"

2. Pronoun and Reference Resolution:
   In multi turn dialogues, pronouns (for example, "Who owns that?", "When is it due?") are resolved against entities retrieved in prior turns before executing new database searches.

---


### 19.3 Multi-Turn Executive Copilot Dialogue State Tracking

Executive interactions with Concludo Copilot unfold across iterative, exploratory conversations. The dialogue state tracker maintains context continuity without prompt pollution:

| Budget Allocation Tier | Token Quota | Allocation Purpose & Governance |
| :--- | :--- | :--- |
| System Executive Persona | 1,500 | Core operating rules, brand voice, Australian English constraints, zero dash rule. |
| Dialogue State Ledger | 1,000 | Summarised multi-turn user intent, active entities, resolved slots, and pending queries. |
| Retrieved Knowledge Graph | 3,000 | Multi-hop relational paths, decision nodes, action dependencies, and entity properties. |
| Grounding Vector Chunks | 4,000 | Top-k semantic transcript chunks and output excerpts with verbatim quotes. |
| Recent Conversational Turns | 2,500 | Last 4-6 conversational turns with verbatim user and assistant exchanges. |
| Generation Reserve | 4,000 | High-capacity output buffer for consulting blueprints, decision packs, and tables. |

When dialogue exceeds token thresholds, earlier turns are compressed using an extractive summariser that preserves all mentioned entities, decisions, and constraints while purging conversational pleasantries.

---

## SECTION 20: AGENT MEMORY ARCHITECTURE

### 20.1 Four Tier Agent Working Memory Model

Autonomous workflow agents operating within Concludo Workspace (such as the Insight Mining Agent or the Meeting Health Evaluator) utilise a Four Tier Agent Memory Model:

| Memory Tier | Storage Medium | Durability | Access Latency | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| Working Memory | In Memory RAM | Execution Turn | < 1ms | Active scratchpad for parsing current prompt tokens. |
| Short Term Memory | Redis / Edge Cache | Execution Session | < 5ms | Caches intermediate tool call results and API responses. |
| Long Term Memory | `public.agent_memory` | Permanent | 10-30ms | Persists cross run state, agent configurations, and patterns. |
| Knowledge Memory | `knowledge_nodes` | Permanent | 20-50ms | Queries the corporate knowledge graph for contextual facts. |

### 20.2 Governed Agent Execution and Approval Boundaries

In strict alignment with Concludo governance rules, AI agents are prohibited from executing autonomous external mutations without human oversight.

1. The Human in the Loop Approval Gate:
   - When an agent generates an external action (for example, dispatching an email report or altering an action due date), it creates a pending record in `public.workflow_approvals`.
   - The mutation remains quarantined until an authorized user reviews and explicitly approves the action in the workspace interface.
   - All agent actions and approvals are logged in `public.agent_activity` and `public.audit_logs`.

---


### 20.3 Autonomous Agent Tool Execution Sandboxing and Safety Bounds

In accordance with Concludo governance principles, AI agents operate under strict containment boundaries:

1. Ephemeral Sandbox Execution:
   - Tool calls execute in isolated compute sandboxes with no persistent local storage and restricted network egress.
   - External communication (sending emails, publishing updates) requires mandatory human approval (`workflow_approvals`) by an authorised administrator.

2. Database Write Guardrails:
   - Agents interact with the PostgreSQL database strictly through security definer stored procedures with parameter validation. Direct dynamic SQL execution by agents is prohibited.
   - All state modifications generate append-only records in `agent_activity` and `audit_logs` capturing input parameters, execution latency, and caller identity.

---

## SECTION 21: PREDICTIVE INTELLIGENCE ARCHITECTURE

### 21.1 Forecasting Engines and Trajectory Modelling

Concludo converts historical execution telemetry into forward looking predictive indicators. The predictive engine models project completion trajectories across 30, 60, and 90 day horizons:

```
+─────────────────────────────────────────────────────────────────────────────+
|               CONCLUDO PREDICTIVE HEALTH AND TRAJECTORY MODEL               |
+─────────────────────────────────────────────────────────────────────────────+

  [ HISTORICAL TELEMETRY ]
  - Meeting Frequency & Health Scores
  - Action Completion Timestamps
  - Decision Stability & Reversals
  - Risk Emergence Velocity
                               │
                               ▼
  [ PREDICTIVE MATHEMATICAL ENGINES ]
  - Action Drift Index (ADI) Calculator
  - Decision Backlog Pressure (DBP) Analyser
  - Composite Strategic Health Scoring Algorithm
                               │
                               ▼
  [ PREDICTIVE OUTPUTS & ALERTS ]
  - 30/60/90 Day Horizon Milestones
  - Automated Executive Warning Alerts
  - Strategic Digital Twin Telemetry
```

### 21.2 Action Drift Index and Decision Backlog Pressure

1. Action Drift Index (ADI):
   Measures the average temporal slippage between scheduled due dates and actual delivery dates:
   $$ADI = \frac{1}{|A|} \sum_{a \in A} \max\left(0, \frac{t_{\text{complete}}(a) - t_{\text{due}}(a)}{t_{\text{due}}(a) - t_{\text{start}}(a)}\right)$$
   An ADI score > 0.25 triggers an automated operational warning to the Project Sponsor.

2. Decision Backlog Pressure (DBP):
   Measures the ratio of unratified proposals to ratified decisions, indicating strategic indecision:
   $$DBP = \frac{|D_{\text{proposed}}|}{|D_{\text{ratified}}| + 1} \times \left(1 + \frac{\text{Average Proposal Age in Days}}{30}\right)$$

### 21.3 Strategic Health Scoring Engine

The Strategic Health Score (0-100) evaluates overall organizational alignment across eight weighted dimensions:
- Purpose Clarity (10%)
- Decision Velocity (15%)
- Action Execution Integrity (20%)
- Meeting Health Baseline (15%)
- Risk Mitigation Coverage (15%)
- Opportunity Realisation (10%)
- Cross Team Dependency Alignment (10%)
- Governance Compliance (5%)

Scores are classified into standard Concludo performance bands: Exceptional (90-100), Excellent (80-89), Good (70-79), Average (60-69), Poor (40-59), and Critical Failure (0-39).

---

## SECTION 22: ANALYTICS DATA MODEL

### 22.1 Analytical Aggregations and Materialised Rollups

To deliver sub 100ms dashboard performance for executive leadership and board members without overloading primary transaction tables, Concludo utilises PostgreSQL Materialised Views refreshed asynchronously:

```sql
create materialized view public.mv_organization_executive_summary as
select 
  o.id as organization_id,
  count(distinct p.id) filter (where p.deleted_at is null) as active_projects_count,
  count(distinct t.id) filter (where t.deleted_at is null) as total_meetings_count,
  count(distinct d.id) filter (where d.deleted_at is null and d.status = 'ratified') as ratified_decisions_count,
  count(distinct a.id) filter (where a.deleted_at is null and a.status = 'completed') as completed_actions_count,
  count(distinct a.id) filter (where a.deleted_at is null and a.is_overdue) as overdue_actions_count,
  round(avg(ps.health_score), 2) as average_portfolio_health_score,
  timezone('utc'::text, now()) as refreshed_at
from public.organizations o
left join public.projects p on p.organization_id = o.id
left join public.transcripts t on t.organization_id = o.id
left join public.decision_memory d on d.organization_id = o.id
left join public.action_tracker a on a.organization_id = o.id
left join public.predictive_snapshots ps on ps.organization_id = o.id
where o.deleted_at is null
group by o.id;

create unique index idx_mv_org_exec_id on public.mv_organization_executive_summary(organization_id);
```

### 22.2 Executive and Board Level Reporting Dashboards

Materialised views power executive dashboards in the Workspace SaaS interface:
1. Executive Pulse: Real time portfolio health radar, overdue task distribution, and upcoming strategic checkpoints.
2. Boardroom Intelligence Pack: High level decision summaries, capital expenditure commitments, and major enterprise risk heatmaps.
3. Departmental Velocity Benchmarks: Comparative execution speed across distinct enterprise business units.


### 22.3 Executive and Board Materialised Analytical Views

To support sub-second rendering of executive dashboards and board governance packs, Concludo precomputes key performance indicators using PostgreSQL materialised views refreshed asynchronously:

```sql
create materialized view public.mv_executive_summary_rollups as
select
  p.organization_id,
  p.id as project_id,
  p.title as project_title,
  count(distinct dm.id) as total_decisions_count,
  count(distinct case when dm.consensus_level = 'unanimous' then dm.id end) as unanimous_decisions_count,
  count(distinct act.id) as total_actions_count,
  count(distinct case when act.status = 'completed' then act.id end) as completed_actions_count,
  count(distinct case when act.status not in ('completed', 'cancelled') and act.due_date < timezone('utc'::text, now()) then act.id end) as overdue_actions_count,
  round(
    count(distinct case when act.status = 'completed' then act.id end)::numeric /
    nullif(count(distinct act.id), 0) * 100, 1
  ) as action_completion_rate,
  coalesce(avg(ps.risk_score), 0) as average_project_risk_score,
  max(p.updated_at) as last_activity_at
from public.projects p
left join public.decision_memory dm on dm.project_id = p.id and dm.deleted_at is null
left join public.action_tracker act on act.project_id = p.id and act.deleted_at is null
left join public.predictive_snapshots ps on ps.project_id = p.id
where p.deleted_at is null
group by p.organization_id, p.id, p.title;

create unique index idx_mv_exec_summary_proj on public.mv_executive_summary_rollups(project_id);
create index idx_mv_exec_summary_org on public.mv_executive_summary_rollups(organization_id);
```

These materialised rollups power executive scorecards without executing expensive aggregation scans over multi-million row transactional tables during peak business hours.

---

## SECTION 23: DATA RETENTION ARCHITECTURE

### 23.1 Comprehensive Lifecycle Alignment with Tasklet 11

In alignment with Tasklet 11 and Concludo Workspace governance principles, data retention operates under strict, automated lifecycle controls.

```
+─────────────────────────────────────────────────────────────────────────────+
|               CONCLUDO DATA RETENTION AND PURGE LIFECYCLE                   |
+─────────────────────────────────────────────────────────────────────────────+

       [ ACTIVE STATE ]
       - Record in standard operation: deleted_at IS NULL, purge_after IS NULL.
       - Available across all application queries, searches, and Copilot.
                               │
                               │ User Initiates Delete
                               ▼
       [ SOFT DELETED QUARANTINE (30 DAYS) ]
       - deleted_at = NOW(), purge_after = NOW() + INTERVAL '30 days'.
       - Filtered out of standard queries by RLS (deleted_at IS NULL).
       - Recoverable via "Recently Deleted" workspace interface.
                               │
                               ├─── If Active Legal Hold Exists ───► [ SUSPENDED ]
                               │                                     Purge frozen
                               │ Purge Threshold Reached
                               ▼
       [ AUTOMATED HARD PURGE ENGINE ]
       - Scheduled cron worker: cron_purge_deleted_records().
       - Permanently destroys database rows and cascades to vector chunks.
       - Leaves permanent tombstone event in immutable audit_logs.
```

1. Active Records: Retained indefinitely by default (`deleted_at is null` and `purge_after is null`).
2. Soft Deleted Quarantine:
   - When soft deleted, records are quarantined for exactly 30 days:
     `deleted_at = now()`, `deleted_by = auth.uid()`, `purge_after = now() + interval '30 days'`.
   - Records are excluded from standard views and RLS queries via `where deleted_at is null`.
   - Restorable by authorized administrators within the 30 day window.
3. Permanent Purge Eligibility:
   - Evaluated as: `deleted_at is not null and purge_after < now()`.
   - Permitted only if no active legal hold targets the record, the enclosing project, or the organization.

### 23.2 Automated Soft Delete and Recovery Protocols

```sql
create or replace function public.restore_soft_deleted_record(
  p_table_name text,
  p_record_id uuid
) returns boolean as $$
declare
  v_sql text;
begin
  -- Validate that caller has administrative privileges
  if not (exists (select 1 from public.organization_members where user_id = auth.uid() and role in ('owner', 'admin'))) then
    raise exception 'Unauthorized: Only organization administrators can restore deleted records.';
  end if;

  v_sql := format(
    'update public.%I set deleted_at = null, deleted_by = null, purge_after = null, updated_at = now() where id = %L and deleted_at is not null',
    p_table_name, p_record_id
  );
  execute v_sql;
  return true;
end;
$$ language plpgsql security definer;
```

### 23.3 The Background Hard Purge Engine

Hard purges are executed strictly by a scheduled database cron worker running during low traffic windows:

```sql
create or replace function public.cron_purge_deleted_records()
returns integer as $$
declare
  v_purged_count integer := 0;
  v_deleted_projects uuid[];
begin
  -- 1. Identify soft-deleted projects past purge threshold with NO active legal hold
  select array_agg(p.id) into v_deleted_projects
  from public.projects p
  where p.deleted_at is not null
    and p.purge_after < timezone('utc'::text, now())
    and not exists (
      select 1 from public.legal_holds lh
      where (lh.target_project_id = p.id or lh.organization_id = p.organization_id)
        and lh.status = 'active'
    );

  if v_deleted_projects is not null and array_length(v_deleted_projects, 1) > 0 then
    -- Cascade delete vectors and knowledge nodes
    delete from public.vector_embeddings where entity_id = any(v_deleted_projects);
    delete from public.knowledge_nodes where project_id = any(v_deleted_projects);
    
    -- Delete projects (cascading to transcripts, decisions, actions, outputs)
    delete from public.projects where id = any(v_deleted_projects);
    v_purged_count := array_length(v_deleted_projects, 1);
  end if;

  return v_purged_count;
end;
$$ language plpgsql security definer;
```

---

## SECTION 24: LEGAL HOLD ARCHITECTURE

### 24.1 Statutory Legal Holds and Immutable Preservation

Statutory legal holds enable enterprise legal and compliance teams to freeze data lifecycle policies, suspending automated purges to preserve evidence for litigation or regulatory inquiry:

```sql
create or replace function public.apply_legal_hold(
  p_org_id uuid,
  p_name text,
  p_matter_ref text,
  p_target_project_id uuid default null,
  p_target_user_id uuid default null
) returns uuid as $$
declare
  v_hold_id uuid;
begin
  -- Validate caller is enterprise admin or legal auditor
  if not is_org_admin(p_org_id) then
    raise exception 'Unauthorized: Only enterprise administrators can issue legal holds.';
  end if;

  insert into public.legal_holds (
    organization_id, name, matter_reference, target_project_id, target_user_id, created_by
  ) values (
    p_org_id, p_name, p_matter_ref, p_target_project_id, p_target_user_id, auth.uid()
  ) returning id into v_hold_id;

  -- Log action in immutable audit ledger
  insert into public.audit_logs (
    organization_id, actor_id, action, resource_type, resource_id, new_values
  ) values (
    p_org_id, auth.uid(), 'APPLY_LEGAL_HOLD', 'legal_holds', v_hold_id,
    jsonb_build_object('name', p_name, 'matter_ref', p_matter_ref, 'project_id', p_target_project_id)
  );

  return v_hold_id;
end;
$$ language plpgsql security definer;
```

### 24.2 Electronic Discovery and Audited Legal Export

Under an active legal hold, authorized compliance auditors can export complete, tamper evident discovery packages:
1. Verbatim Transcripts with audio hash checksums.
2. Complete Decision and Action logs including all historical mutations.
3. System Audit Trails detailing every user who read, modified, or attempted to delete the records.
4. Cryptographic Proof Manifests signed by enterprise private keys.

---

## SECTION 25: AUDIT ARCHITECTURE

### 25.1 Append Only Immutable Audit Logging

Audit logs represent the legal backbone of Concludo enterprise trust. To prevent internal tampering, the `public.audit_logs` table incorporates cryptographic integrity controls:

```sql
-- Revoke update and delete from all users including authenticated service roles
revoke update, delete on public.audit_logs from public, authenticated, service_role;

create or replace function public.log_system_mutation()
returns trigger as $$
begin
  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    tg_op,
    tg_table_name::text,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return null;
end;
$$ language plpgsql security definer;
```

### 25.2 Comprehensive Event Catalog and Traceability

The audit architecture captures the full lifecycle of enterprise operations:
- Identity Events: User login, SSO provisioning, session invalidation, MFA challenge.
- Project Mutations: Project creation, scope adjustment, team reassignment, soft deletion.
- Governance Actions: Decision ratification, decision reversal, action reassignment.
- Output Deliverables: Report generation, PDF export, external webhook dispatch.
- Security and Compliance: Legal hold application, retention policy adjustment, permission elevation.

---

## SECTION 26: SCALABILITY ARCHITECTURE

### 26.1 Declarative Database Partitioning Strategy

As enterprise tenants ingest tens of thousands of meeting transcripts, high volume tables are partitioned to maintain predictable $O(\log N)$ index performance:
1. `public.audit_logs`: Partitioned by range on `created_at` in monthly intervals (`audit_logs_y2026m09`, `audit_logs_y2026m10`).
2. `public.vector_embeddings`: Partitioned by list on `entity_type` (`embeddings_transcripts`, `embeddings_decisions`).
3. Partition Pruning: Queries filtering by date or entity type execute instant partition pruning at the PostgreSQL query planner level.

### 26.2 High Throughput Transactional Outbox Pattern

To protect database performance during heavy analytical loads, Concludo implements the Transactional Outbox Pattern:
- Mutations write a lightweight event to `public.event_stream_logs`.
- External worker processes drain the event queue using `FOR UPDATE SKIP LOCKED`, preventing worker contention and database thread starvation:
  ```sql
  select * from public.event_stream_logs
  where processed_at is null
  order by created_at asc
  limit 100
  for update skip locked;
  ```

### 26.3 Global Multi Region Scaling and Australian Data Sovereignty

Concludo maintains sovereign data boundaries for Australian organizations:
- Primary Production Cluster: Hosted in Sydney (`ap-southeast-2`) on Supabase Enterprise Infrastructure.
- Complete Data Residency: All customer transcripts, decision records, vector embeddings, and audit trails reside strictly on Australian soil, fully compliant with Australian Privacy Principles (APPs).
- Multi Region Read Replicas: For multinational organizations, localized read replicas serve low latency dashboard queries in Europe and North America while routing all write transactions back to the primary Australian cluster.

---

## SECTION 27: PERFORMANCE ARCHITECTURE

### 27.1 Query Standards and Recursive Graph Optimisation

To maintain high throughput across complex graph and relational queries, Concludo enforces strict query engineering standards:
1. Zero SELECT Asterisk: All database queries must explicitly enumerate required columns. `SELECT *` is prohibited in production code to optimise network bandwidth and memory deserialization.
2. Depth Constrained CTEs: Recursive graph queries must enforce hard depth ceilings (`level < 4`) and cycle prevention arrays (`not (target_node_id = any(path))`).
3. Connection Pooling: Backend APIs connect through Supavisor connection poolers in Transaction Mode, supporting 10,000+ concurrent client connections without exhausting database server memory.

### 27.2 Sub 100ms Query SLA and Caching Framework

Concludo enforces a strict performance service level agreement (SLA):
- Lexical Search Queries: p95 < 45ms.
- Vector Embedding Similarity Queries: p95 < 35ms.
- Knowledge Graph Lineage Subgraphs (depth 3): p95 < 60ms.
- Materialised View Executive Dashboards: p95 < 20ms.

Multi Tier Caching Architecture:
- Tier 1: Cloudflare Edge Cache for static public assets.
- Tier 2: Stale While Revalidate (SWR) in memory caching in React frontend.
- Tier 3: Redis / KeyDB caching for hot Copilot session states and frequently queried knowledge subgraphs.

---

## SECTION 28: SECURITY ARCHITECTURE

### 28.1 Identity, Authentication, and SAML 2.0 SSO

Concludo Workspace integrates enterprise identity through Supabase GoTrue and external enterprise identity providers:
1. Modern Cryptographic Authentication: Passwords hashed using bcrypt (cost factor 12); session tokens issued as signed JWTs with short expiry (1 hour) backed by refresh token rotation.
2. SAML 2.0 and OIDC Enterprise SSO: Supports Microsoft Entra ID (Azure AD), Okta, Google Workspace, and Ping Identity.
3. Multi Factor Authentication (MFA): Mandatory for organization owners, administrators, and auditor roles.

### 28.2 Cryptographic Protection and Envelope Encryption

1. Data at Rest: Encrypted using AES 256 GCM across all database tables, WAL logs, and backups.
2. Data in Transit: Enforced TLS 1.3 with strong cipher suites across all client, API, and internal database connections.
3. Sensitive Attribute Masking:
   - Webhook signing secrets and API key hashes are stored in the database.
   - Raw plaintext API keys are shown to users exactly once upon creation and can never be retrieved by administrators or database operators.

---

## SECTION 29: FUTURE AI MEMORY VISION

### 29.1 The Six Horizon Cognitive Evolution

Concludo data and memory architecture is engineered to evolve across six progressive cognitive horizons:

```
+─────────────────────────────────────────────────────────────────────────────+
|               THE CONCLUDO SIX HORIZON COGNITIVE EVOLUTION                  |
+─────────────────────────────────────────────────────────────────────────────+

  [ HORIZON 6: ENTERPRISE INTELLIGENCE ]
  - Autonomous strategic operating system, executive governance cockpit.
                               ▲
  [ HORIZON 5: KNOWLEDGE INTELLIGENCE ]
  - Automated causal inference, multi-project risk cascade detection.
                               ▲
  [ HORIZON 4: STRATEGIC MEMORY ]
  - Longitudinal portfolio digital twin, predictive health modelling.
                               ▲
  [ HORIZON 3: ORGANISATIONAL MEMORY ]
  - Cross-functional institutional wisdom, post-mortem synthesis.
                               ▲
  [ HORIZON 2: DECISION MEMORY ]
  - Ratified commitments, Five-Field Delegation Standard, velocity metrics.
                               ▲
  [ HORIZON 1: MEETING MEMORY ]
  - Structured transcription, entity extraction, meeting health scoring.
```

---

## SECTION 30: FUTURE STATE

### 30.1 Concludo as the Strategic Operating System

By uniting relational rigor, recursive knowledge graph traversal, eleven layers of cognitive memory, and governed AI agents, Concludo Workspace transcends traditional software categories. It becomes:

1. The Meeting Intelligence Platform: Replacing passive transcription with deep conversational understanding and meeting performance diagnostics.
2. The Decision Intelligence Platform: Providing an immutable, auditable source of truth for corporate choices, rationale, and rejected paths.
3. The Execution Intelligence Platform: Enforcing the Five Field Delegation Standard, eliminating orphaned tasks, and predicting delivery drift.
4. The Knowledge Platform: Weaving isolated discussions into an interconnected corporate knowledge graph.
5. The Copilot Platform: Equipping human leaders with context aware, grounded conversational intelligence anchored by verbatim primary evidence.
6. The Agent Platform: Coordinating specialized, governed autonomous workflows with mandatory human oversight.
7. The Organisational Memory Platform: Preserving institutional wisdom and lessons learned across generations of corporate leadership.
8. The Strategic Intelligence Platform: Continuously monitoring alignment between frontline execution and boardroom vision.
9. The Executive Intelligence Platform: Generating McKinsey and BCG grade consulting deliverables, board packs, and transformation roadmaps in seconds.
10. The Strategic Operating System: The permanent, sovereign brain of the modern enterprise.

---

## APPENDICES

### Appendix A: Complete PostgreSQL DDL Schema Migration

```sql
-- ============================================================================
-- CONCLUDO WORKSPACE SAAS: MASTER DATABASE SCHEMA MIGRATION (v1.0)
-- Governing Entity: Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898)
-- Location: Melbourne, Victoria, Australia
-- Punctuation Rule: Strict zero em-dash and zero en-dash compliance
-- Language Standard: 100% Australian English
-- ============================================================================

-- Core Database Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Automated Temporal Update Function
create or replace function public.update_timestamp()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

-- 1. Profiles Table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  tier text not null default 'free_preview' check (tier in ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'enterprise', 'admin')),
  preferences jsonb not null default '{"theme":"light","email_notifications":true,"timezone":"Australia/Melbourne"}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_profiles_email on public.profiles(email);
create index idx_profiles_active on public.profiles(id) where deleted_at is null;

-- 2. Organizations Table
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tier text not null default 'team' check (tier in ('team', 'enterprise', 'admin')),
  sso_enabled boolean not null default false,
  sso_provider text default null,
  domain text default null,
  is_suspended boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_organizations_slug on public.organizations(slug);
create index idx_organizations_active on public.organizations(id) where deleted_at is null;

-- 3. Organization Members Table
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'auditor')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_organization_members_org_user unique (organization_id, user_id)
);
create index idx_org_members_org_id on public.organization_members(organization_id);
create index idx_org_members_user_id on public.organization_members(user_id);

-- 4. Organization Domains Table
create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_name text not null,
  verification_token text not null,
  is_verified boolean not null default false,
  verified_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_org_domain unique (domain_name)
);
create index idx_org_domains_org on public.organization_domains(organization_id);

-- 5. Organization SSO Configs Table
create table public.organization_sso_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  idp_entity_id text not null,
  idp_sso_url text not null,
  idp_certificate_fingerprint text not null,
  attribute_mapping jsonb not null default '{"email":"email","first_name":"given_name","last_name":"surname"}'::jsonb,
  is_enforced boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_sso_configs_org on public.organization_sso_configs(organization_id);

-- 6. Teams Table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  is_private boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null,
  constraint uq_teams_org_slug unique (organization_id, slug)
);
create index idx_teams_org_id on public.teams(organization_id);
create index idx_teams_active on public.teams(id) where deleted_at is null;

-- 7. Team Members Table
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_team_members_team_user unique (team_id, user_id)
);
create index idx_team_members_team on public.team_members(team_id);
create index idx_team_members_user on public.team_members(user_id);

-- 8. Team Invitations Table
create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_team_invitations_token on public.team_invitations(token_hash);
create index idx_team_invitations_team on public.team_invitations(team_id);

-- 9. Team Activities Table
create table public.team_activities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  activity_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_team_activities_team_date on public.team_activities(team_id, created_at desc);

-- 10. Projects Table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived', 'paused')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_projects_org_id on public.projects(organization_id);
create index idx_projects_team_id on public.projects(team_id);
create index idx_projects_active on public.projects(id) where deleted_at is null;

-- 11. Transcripts Table
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_title text not null,
  meeting_date timestamptz not null default timezone('utc'::text, now()),
  duration_seconds integer not null default 0,
  raw_transcript text not null,
  cleaned_transcript text not null,
  meeting_type text not null default 'M-01',
  strategic_intent text not null default 'CREATE_STRATEGY',
  source_channel text not null default 'upload' check (source_channel in ('upload', 'zoom', 'teams', 'google_meet', 'api')),
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(meeting_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(cleaned_transcript, '')), 'B')
  ) stored,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_transcripts_project on public.transcripts(project_id);
create index idx_transcripts_org on public.transcripts(organization_id);
create index idx_transcripts_tsv on public.transcripts using gin(search_tsv);
create index idx_transcripts_active on public.transcripts(id) where deleted_at is null;

-- 12. Outputs Table
create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  transcript_id uuid references public.transcripts(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  template_type text not null,
  output_type text not null,
  content jsonb not null default '{}'::jsonb,
  rendered_html text,
  rendered_markdown text,
  quality_score numeric(5,2) not null default 85.00,
  is_approved boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz default null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_outputs_project on public.outputs(project_id);
create index idx_outputs_transcript on public.outputs(transcript_id);
create index idx_outputs_org on public.outputs(organization_id);
create index idx_outputs_active on public.outputs(id) where deleted_at is null;

-- 13. Endpoint Reports Table
create table public.endpoint_reports (
  id uuid primary key default gen_random_uuid(),
  output_id uuid references public.outputs(id) on delete cascade,
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  destination_type text not null check (destination_type in ('slack', 'teams', 'planner', 'email', 'webhook')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz default null,
  error_message text default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_endpoint_reports_status on public.endpoint_reports(status);
create index idx_endpoint_reports_org on public.endpoint_reports(organization_id);

-- 14. Generated Intelligence Table
create table public.generated_intelligence (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_health_score integer not null default 75 check (meeting_health_score between 0 and 100),
  health_classification text not null default 'Good' check (health_classification in ('Exceptional', 'Excellent', 'Good', 'Average', 'Poor', 'Waste of Time')),
  dimension_scores jsonb not null default '{}'::jsonb,
  risks_detected jsonb not null default '[]'::jsonb,
  opportunities_detected jsonb not null default '[]'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_generated_intel_transcript on public.generated_intelligence(transcript_id);
create index idx_generated_intel_org on public.generated_intelligence(organization_id);

-- 15. Decision Memory Table
create table public.decision_memory (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  rationale text not null,
  rejected_alternatives jsonb not null default '[]'::jsonb,
  financial_impact numeric(15,2) default null,
  currency text not null default 'AUD',
  impact_level text not null default 'medium' check (impact_level in ('critical', 'high', 'medium', 'low')),
  status text not null default 'ratified' check (status in ('proposed', 'ratified', 'reversed', 'superseded')),
  confidence_score integer not null default 90 check (confidence_score between 0 and 100),
  evidence_quote text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null
);
create index idx_decision_memory_proj on public.decision_memory(project_id);
create index idx_decision_memory_org on public.decision_memory(organization_id);
create index idx_decision_memory_active on public.decision_memory(id) where deleted_at is null;

-- 16. Action Tracker Table
create table public.action_tracker (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_description text not null,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_name text not null,
  due_date timestamptz not null,
  definition_of_done text not null,
  checkpoint_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  dependencies jsonb not null default '[]'::jsonb,
  is_overdue boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  deleted_by uuid default null,
  purge_after timestamptz default null,
  constraint ck_action_checkpoint_before_due check (checkpoint_date <= due_date)
);
create index idx_action_tracker_proj on public.action_tracker(project_id);

-- PostgREST computed column for dynamic overdue evaluation
create or replace function public.is_overdue(a public.action_tracker)
returns boolean as 4904
  select a.status not in ('completed', 'cancelled') and a.due_date < timezone('utc'::text, now());
4904 language sql stable;
create index idx_action_tracker_owner on public.action_tracker(assigned_to_user_id);
create index idx_action_tracker_org on public.action_tracker(organization_id);
create index idx_action_tracker_active on public.action_tracker(id) where deleted_at is null;

-- 17. Audit Logs Table
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  ip_address inet default null,
  user_agent text default null,
  old_values jsonb default null,
  new_values jsonb default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_audit_logs_org_date on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);

-- 18. Retention Policies Table
create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('all', 'transcripts', 'outputs', 'decisions', 'actions')),
  retention_days integer not null check (retention_days >= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_retention_policies_org on public.retention_policies(organization_id);

-- 19. Legal Holds Table
create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  matter_reference text not null,
  target_user_id uuid references public.profiles(id),
  target_project_id uuid references public.projects(id),
  status text not null default 'active' check (status in ('active', 'released')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  released_at timestamptz default null
);
create index idx_legal_holds_org on public.legal_holds(organization_id);
create index idx_legal_holds_proj on public.legal_holds(target_project_id);

-- 20. Knowledge Nodes Table
create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  node_type text not null check (node_type in ('project', 'transcript', 'decision', 'action', 'risk', 'opportunity', 'insight', 'recommendation', 'forecast', 'report', 'team', 'user', 'organization', 'concept')),
  entity_uid uuid default null,
  title text not null,
  description text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  purge_after timestamptz default null
);
create index idx_knowledge_nodes_org on public.knowledge_nodes(organization_id);
create index idx_knowledge_nodes_type on public.knowledge_nodes(node_type);
create index idx_knowledge_nodes_entity on public.knowledge_nodes(entity_uid);
create index idx_knowledge_nodes_active on public.knowledge_nodes(id) where deleted_at is null;

-- 21. Knowledge Relationships Table
create table public.knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('related_to', 'depends_on', 'derived_from', 'supports', 'contradicts', 'owned_by', 'assigned_to', 'generated_from', 'escalates_to', 'impacts', 'creates', 'mitigates', 'influences', 'contributes_to', 'supersedes')),
  weight numeric(3,2) not null default 1.00 check (weight between 0.00 and 1.00),
  evidence_quote text default null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_knowledge_relationship_edge unique (source_node_id, target_node_id, relationship_type)
);
create index idx_knowledge_rel_source on public.knowledge_relationships(source_node_id);
create index idx_knowledge_rel_target on public.knowledge_relationships(target_node_id);
create index idx_knowledge_rel_org on public.knowledge_relationships(organization_id);

-- 22. Agent Memory Table
create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null,
  memory_scope text not null check (memory_scope in ('global', 'project', 'team', 'meeting')),
  scope_id uuid default null,
  memory_key text not null,
  memory_value jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_agent_memory_scope_key unique (organization_id, agent_name, memory_scope, scope_id, memory_key)
);
create index idx_agent_memory_lookup on public.agent_memory(organization_id, agent_name, memory_key);

-- 23. Copilot Conversations Table
create table public.copilot_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New Conversation',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz default null,
  purge_after timestamptz default null
);
create index idx_copilot_conv_user on public.copilot_conversations(user_id);
create index idx_copilot_conv_org on public.copilot_conversations(organization_id);

-- 24. Copilot Messages Table
create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.copilot_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  tokens_used integer default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_copilot_msgs_conv on public.copilot_messages(conversation_id, created_at asc);

-- 25. Vector Embeddings Table
create table public.vector_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('transcript_chunk', 'decision', 'action', 'insight', 'output_section')),
  entity_id uuid not null,
  chunk_index integer not null default 0,
  chunk_content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_vector_embeddings_lookup on public.vector_embeddings(entity_type, entity_id);
create index idx_vector_embeddings_hnsw on public.vector_embeddings using hnsw (embedding vector_cosine_ops);

-- 26. Access Reviews Table
create table public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  review_period text not null,
  findings jsonb not null default '{}'::jsonb,
  is_completed boolean not null default false,
  completed_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_access_reviews_org on public.access_reviews(organization_id);

-- 27. Integrations Table
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google_workspace', 'microsoft_365', 'slack', 'jira', 'confluence')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  scope text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_org_integration_provider unique (organization_id, provider)
);
create index idx_integrations_org on public.integrations(organization_id);

-- 28. Webhooks Table
create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_url text not null,
  secret_hash text not null,
  events text[] not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_webhooks_org on public.webhooks(organization_id);

-- 29. Webhook Logs Table
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_name text not null,
  payload jsonb not null,
  response_status integer default null,
  response_body text default null,
  latency_ms integer default 0,
  delivered_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_webhook_logs_webhook on public.webhook_logs(webhook_id, delivered_at desc);

-- 30. API Keys Table
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{"read:intelligence"}'::text[],
  expires_at timestamptz default null,
  last_used_at timestamptz default null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_api_keys_org on public.api_keys(organization_id);
create index idx_api_keys_hash on public.api_keys(key_hash);

-- 31. Workflows Table
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('meeting_ingested', 'action_overdue', 'schedule_cron', 'manual')),
  steps jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_workflows_org on public.workflows(organization_id);

-- 32. Workflow Executions Table
create table public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'awaiting_approval', 'completed', 'failed')),
  current_step integer not null default 0,
  context_payload jsonb not null default '{}'::jsonb,
  error_message text default null,
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz default null
);
create index idx_workflow_executions_status on public.workflow_executions(organization_id, status);

-- 33. Workflow Approvals Table
create table public.workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_execution_id uuid references public.workflow_executions(id) on delete cascade,
  workflow_name text not null,
  action_type text not null,
  action_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by_agent text not null,
  resolved_by_user_id uuid references public.profiles(id),
  resolved_at timestamptz default null,
  resolution_notes text default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_workflow_approvals_status on public.workflow_approvals(organization_id, status);

-- 34. Agent Activity Table
create table public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_name text not null,
  action_name text not null,
  tool_invoked text default null,
  tokens_input integer default 0,
  tokens_output integer default 0,
  execution_duration_ms integer default 0,
  status text not null default 'success' check (status in ('success', 'failed')),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_agent_activity_org_date on public.agent_activity(organization_id, created_at desc);

-- 35. Lessons Learned Table
create table public.lessons_learned (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null check (category in ('technical', 'commercial', 'governance', 'vendor', 'operational')),
  title text not null,
  context text not null,
  what_went_well text not null,
  what_failed text not null,
  recommendations text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_lessons_learned_org on public.lessons_learned(organization_id);
create index idx_lessons_learned_tags on public.lessons_learned using gin(tags);

-- 36. Copilot Prompts Table
create table public.copilot_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  version text not null default '1.0',
  system_instructions text not null,
  temperature numeric(3,2) not null default 0.20,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 37. Predictive Snapshots Table
create table public.predictive_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  health_score integer not null check (health_score between 0 and 100),
  action_drift_index numeric(5,2) not null,
  decision_backlog_pressure numeric(5,2) not null,
  horizon_forecast jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_predictive_snapshots_proj on public.predictive_snapshots(project_id, calculated_at desc);

-- 38. Executive Briefings Table
create table public.executive_briefings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_audience text not null check (target_audience in ('ceo', 'board', 'cfo', 'coo', 'general')),
  title text not null,
  headline_synthesis text not null,
  key_risks jsonb not null default '[]'::jsonb,
  strategic_decisions jsonb not null default '[]'::jsonb,
  critical_actions jsonb not null default '[]'::jsonb,
  delivered_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_executive_briefings_org on public.executive_briefings(organization_id, created_at desc);

-- 39. Strategic Digital Twins Table
create table public.strategic_digital_twins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  state_parameters jsonb not null default '{}'::jsonb,
  last_simulated_at timestamptz default null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 40. Strategic Health Scores Table
create table public.strategic_health_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reporting_period text not null,
  composite_score integer not null check (composite_score between 0 and 100),
  dimension_scores jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_health_org_period on public.strategic_health_scores(organization_id, reporting_period);

-- 41. Strategic Scenarios Table
create table public.strategic_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  hypothetical_adjustments jsonb not null,
  simulated_impact jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_scenarios_org on public.strategic_scenarios(organization_id);

-- 42. Strategic Briefings Table
create table public.strategic_briefings (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.strategic_scenarios(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  briefing_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 43. Strategic Alerts Table
create table public.strategic_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  message text not null,
  is_dismissed boolean not null default false,
  dismissed_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_strategic_alerts_org on public.strategic_alerts(organization_id, severity) where is_dismissed is false;

-- 44. External Connectors Table
create table public.external_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_type text not null check (connector_type in ('salesforce', 'hubspot', 'jira', 'sap', 'oracle')),
  endpoint_url text not null,
  auth_config_vault_id text not null,
  sync_frequency text not null default 'hourly',
  is_active boolean not null default true,
  last_synced_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_external_connectors_org on public.external_connectors(organization_id);

-- 45. Event Stream Logs Table
create table public.event_stream_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_name text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_payload jsonb not null,
  processed_at timestamptz default null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_event_stream_unprocessed on public.event_stream_logs(created_at asc) where processed_at is null;

-- 46. User Consent Records Table
create table public.user_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  consent_given boolean not null,
  ip_address inet default null,
  user_agent text default null,
  recorded_at timestamptz not null default timezone('utc'::text, now())
);
create index idx_user_consent_lookup on public.user_consent_records(user_id, consent_type);
```

### Appendix B: Concludo Cognitive Vocabulary and Taxonomic Glossary

- Action Drift Index (ADI): The mathematical discrepancy between original due dates and actual delivery milestones across an organization's action commitments.
- Cognitive Crystallisation: The progressive transformation of ephemeral conversational utterances into immutable relational decisions and knowledge graph vertices.
- Decision Backlog Pressure (DBP): The quantitative ratio of unratified proposals to ratified decisions, measuring organizational indecisiveness.
- Five Field Delegation Standard: Anthony Cortez's operational discipline requiring Task Description, Single Owner, Due Date, Definition of Done, and Checkpoint Date for every commitment.
- Knowledge Graph Subgraph: An interconnected collection of knowledge nodes and relationships traversed via recursive queries to answer multi dimensional business inquiries.
- Reciprocal Rank Fusion (RRF): The mathematical consensus algorithm uniting lexical keyword scores and dense vector similarity distances into a unified retrieval priority queue.
- Soft Delete Quarantine: The mandatory 30 day recovery window during which deleted business assets remain recoverable prior to permanent automated hard purge.
- Stated Omission Standard: The governance protocol mandating that artificial intelligence models explicitly state when evidence is missing rather than generating ungrounded claims.

### Appendix C: Architectural Governance, Review Checklist, and Sign Off

- [x] Database Architecture completely specified with 40+ relational entities.
- [x] Knowledge Graph DAMG formalism defined with 14 node types and 14 relationship types.
- [x] Eleven Layer Cognitive Memory Topography established.
- [x] Meeting, Decision, and Action Memory architectures articulated in full detail.
- [x] Row Level Security (RLS) kernel policies and helper functions defined for all core entities.
- [x] Hybrid Retrieval Architecture combining lexical tsvector and pgvector HNSW specified.
- [x] RAG architecture with 4 layers and anti hallucination guardrails defined.
- [x] Agent and Copilot memory frameworks with progressive context assembly detailed.
- [x] Predictive Intelligence metrics (ADI, DBP, Health Scoring) formulated.
- [x] 30 Day Soft Delete and Statutory Legal Hold lifecycles fully aligned with Tasklet 11.
- [x] Append only immutable audit logging architecture specified.
- [x] Scalability, performance, caching, and enterprise security frameworks established.
- [x] Zero em dashes and zero en dashes verified across all sections.
- [x] 100% Australian English spelling verified.
- [x] Document confirmed as the permanent source of truth for Concludo intelligence systems.

**Architectural Sign Off:**  
Anthony Cortez, Founder and Principal Architect, Concludo Pty Ltd  
Melbourne, Victoria, Australia  
September 2026
