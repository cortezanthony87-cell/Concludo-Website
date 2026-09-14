# CONCLUDO DATA, KNOWLEDGE GRAPH AND AI MEMORY ARCHITECTURE (v1.0)

**Document Reference:** Concludo_Data_Knowledge_AI_Architecture_v1  
**Entity:** Concludo Pty Ltd (ACN: 701 605 898 | ABN: 61 701 605 898)  
**Location:** Melbourne, Victoria, Australia  
**Founder and Operator:** Anthony Cortez  
**Classification:** Enterprise Technical Standard and Architectural Source of Truth  
**Target Environment:** Concludo Workspace SaaS (app.concludo.com)  
**Supabase Infrastructure:** PostgreSQL 15+ (Sydney Region: ap-southeast-2)  
**Release Date:** September 2026  
**Document Status:** Approved Master Architecture  

---

## EXECUTIVE SUMMARY

Concludo Workspace is built on a transformative premise: enterprise value is not created by the mere accumulation of conversational transcripts, but by the continuous extraction, structural contextualisation, semantic synthesis, and governed retrieval of organisational knowledge. Where conventional transcription and productivity tools act as lossy recording devices, Concludo operates as an active, persistent cognitive substrate.

This document, **Concludo_Data_Knowledge_AI_Architecture_v1**, defines the authoritative architectural constitution for all data persistence, graph networking, contextual memory, semantic search, predictive modelling, and retrieval-augmented generation (RAG) across Concludo Workspace. It establishes the technical standards that guarantee enterprise tenant isolation, immutable auditability, deterministic evidence attribution, long-term memory continuity, and mathematical grounding for the Concludo Copilot and foundational AI agents.

```
+====================================================================================================+
|                                    CONCLUDO COGNITIVE STACK                                        |
+====================================================================================================+
| 6. CONVERSATIONAL & EXECUTIVE INTERFACE: Concludo Copilot, Command Centre, Board Reporting         |
+----------------------------------------------------------------------------------------------------+
| 5. PREDICTIVE & DECISION INTELLIGENCE: Strategic Health Scoring, Scenario Engine, Risk Forecasts   |
+----------------------------------------------------------------------------------------------------+
| 4. AGENT & RETRIEVAL COORDINATION: Multi-Tier Agent Memory, Hybrid RAG, Reciprocal Rank Fusion     |
+----------------------------------------------------------------------------------------------------+
| 3. ORGANISATIONAL KNOWLEDGE GRAPH: 14 Node Types, 15 Relationship Types, Provenance & Evidence     |
+----------------------------------------------------------------------------------------------------+
| 2. DECISION & ACTION TRACKING: Decision Memory, Five-Field Delegation Standard, Audit Logging      |
+----------------------------------------------------------------------------------------------------+
| 1. CORE RELATIONAL PERSISTENCE & RLS: PostgreSQL 15+ on Supabase, Sydney Cloud, 30-Day Recovery    |
+====================================================================================================+
```

---

## SECTION 1: DATABASE PHILOSOPHY

The database architecture of Concludo Workspace is grounded in six core philosophical pillars designed to satisfy the rigorous security, sovereignty, and operational demands of enterprise organisations, government bodies, and commercial institutions.

### 1.1 Data Ownership and Sovereignty
1. **Absolute Customer Ownership:** All data ingested, processed, generated, and stored within Concludo Workspace remains the exclusive intellectual and proprietary property of the customer organization. Concludo Pty Ltd claims zero intellectual property rights over customer transcripts, decisions, actions, outputs, or derived intelligence.
2. **Zero Model Training on Customer Data:** Customer data is never utilised to train, retrain, fine-tune, or calibrate public or shared artificial intelligence models. Every machine learning inference, semantic embedding, and large language model prompt executes within strictly isolated tenant boundaries with zero data retention by underlying inference providers.
3. **Data Residency and Sovereign Storage:** All customer databases, file storage buckets, backups, and transaction logs are physically hosted within Australian borders in the AWS Sydney region (`ap-southeast-2`) via Supabase infrastructure, complying with the Australian Privacy Principles (APPs) under the *Privacy Act 1988 (Cth)*.
4. **Complete Data Portability:** Organisations maintain the programmatic and manual right to export their complete organizational dataset (including raw transcripts, relational entities, knowledge graph topologies, and audit logs) in structured open formats (JSON, CSV, and PDF) at any point without vendor lock-in.

### 1.2 Data Lifecycle Management
The lifecycle of every data entity within Concludo follows a deterministic, state-governed progression from initial creation to eventual cryptographic purging:

```
[ Ingest / Create ] 
       │
       ▼
[ Active State ] ──( Updates / Graph Linkages / Versioning )
       │
       ▼
[ Soft Deletion ] ──( deleted_at = now(), deleted_by = auth.uid(), purge_after = now() + 30 days )
       │
       ├───► [ 30-Day Quarantine & Recovery Window ] ───► [ Restore to Active State ]
       │                                                         ▲
       │                                                         │ (User/Admin Action)
       ▼
[ Retention & Legal Hold Assessment ]
       │
       ├───► [ Active Legal Hold Detected ] ───► [ Suspend Purge Indefinitely ]
       │
       ▼ (No Active Legal Holds AND purge_after < now())
[ Cryptographic Permanent Purge ] (Physical Cascading Delete)
```

1. **Active State:** Records are created with `deleted_at = NULL` and `purge_after = NULL`. Active records are indexed, searchable, and fully accessible according to Row-Level Security policies.
2. **Soft Deletion State:** When a user or system process deletes a record, the record is flagged with `deleted_at = timezone('utc'::text, now())`, `deleted_by = auth.uid()`, and `purge_after = timezone('utc'::text, now() + interval '30 days')`. The record is immediately hidden from standard application queries.
3. **Quarantine and Recovery Window:** For exactly 30 days following soft deletion, records remain physically intact in the database. Authorized users and administrators can inspect and restore soft-deleted items via the Recently Deleted interface and dedicated restoration RPCs (`restore_project`, `restore_decision`, `restore_action`, `restore_copilot_conversation`, `restore_knowledge_node`).
4. **Permanent Purge State:** When a record's `purge_after` timestamp matures past the current time, it becomes eligible for permanent cryptographic deletion. Automated background workers execute hard deletion only after verifying that no active legal holds apply.

### 1.3 Retention Architecture
Data retention within Concludo Workspace is governed by dual operational tiers:
- **Default System Retention:** Active records are retained indefinitely by default. Soft-deleted records are retained for a 30-day recovery grace period.
- **Enterprise Policy Retention:** Enterprise administrators can configure custom retention rules via the `retention_policies` table. Policies specify retention windows (in days) per entity type (`projects`, `transcripts`, `outputs`, `decisions`, `actions`, `audit_logs`, `copilot_conversations`, `knowledge_nodes`). Once active records exceed their configured lifespan, automated retention jobs gracefully transition them to the soft-deleted quarantine workflow.

### 1.4 Disaster Recovery and Business Continuity
Concludo enforces institutional disaster recovery standards across all database infrastructure:
1. **Continuous Write-Ahead Logging (WAL):** Every database transaction is streamed to secure secondary storage, enabling Point-In-Time Recovery (PITR) with a Recovery Point Objective (RPO) of less than 5 minutes.
2. **Automated Daily Backups:** Complete database snapshots are captured every 24 hours, encrypted with AES-256, and replicated across geographically redundant availability zones within Australia.
3. **Recovery Time Objective (RTO):** Full database restoration and integrity verification are architected to complete within 60 minutes in the event of catastrophic regional infrastructure failure.
4. **Zero-Loss Migration Reversibility:** All schema migrations follow expand-and-contract engineering protocols, ensuring backward compatibility and zero data loss during schema upgrades or rollbacks.

### 1.5 Governance and Authoritative Source of Truth
- **Database-Level Authority:** The PostgreSQL database engine is the sole and authoritative enforcement point for data validation, tenant isolation, and referential integrity. Frontend user interface logic and intermediate API servers act as presentation layers and must never be trusted as security boundaries.
- **Immutability of Audit Trails:** The `audit_logs` table operates as an append-only ledger. Row-level security strictly prohibits `UPDATE` or `DELETE` operations on audit logs by any application role, guaranteeing evidential validity for regulatory compliance.

### 1.6 Enterprise Requirements and Compliance Framework
Concludo Workspace is engineered to satisfy the compliance criteria of major enterprise governance frameworks:
- **SOC 2 Type II:** Enforcing continuous audit logging, role-based access control, cryptographic encryption at rest (AES-256) and in transit (TLS 1.3), and strict change management.
- **ISO/IEC 27001:** Adhering to rigorous information security management standards, vulnerability scanning, and credential segregation.
- **Australian Privacy Principles (APPs):** Upholding APP 1 (Open and transparent management of personal information), APP 6 (Use or disclosure of personal information), APP 8 (Cross-border disclosure restrictions), and APP 11 (Security of personal information).

---

## SECTION 2: COMPLETE DATABASE SCHEMA

The Concludo database architecture comprises 42 relational tables categorised into 12 distinct functional domains. Below is the complete specification of all current and planned schemas, including columns, data types, constraints, default values, foreign key cascades, indexes, and performance characteristics.

### 2.1 Domain 1: Core Identity, Accounts, and Multi-Tenancy

#### Table: `public.profiles`
Stores user profile information, authentication metadata, subscription plan, and system administrative flags.
- `id` (UUID, Primary Key, References `auth.users(id)` ON DELETE CASCADE)
- `email` (TEXT, NOT NULL, Unique)
- `full_name` (TEXT, Default NULL)
- `avatar_url` (TEXT, Default NULL)
- `plan` (TEXT, NOT NULL, Default 'free_preview', Check: plan IN ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'enterprise', 'admin'))
- `trial_ends_at` (TIMESTAMPTZ, Default NULL)
- `is_suspended` (BOOLEAN, NOT NULL, Default false)
- `suspended_at` (TIMESTAMPTZ, Default NULL)
- `suspension_reason` (TEXT, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_profiles_plan`, `idx_profiles_is_suspended`, `idx_profiles_deleted_at`, `idx_profiles_email`.

#### Table: `public.organizations`
Top-level multi-tenant enterprise boundary for organizations.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `name` (TEXT, NOT NULL)
- `slug` (TEXT, NOT NULL, Unique)
- `plan` (TEXT, NOT NULL, Default 'enterprise', Check: plan IN ('team', 'enterprise', 'admin'))
- `created_by` (UUID, NOT NULL, References `auth.users(id)`)
- `allow_team_agents` (BOOLEAN, NOT NULL, Default false)
- `allow_team_predictive` (BOOLEAN, NOT NULL, Default false)
- `allow_team_knowledge` (BOOLEAN, NOT NULL, Default false)
- `allow_team_copilot` (BOOLEAN, NOT NULL, Default false)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_organizations_slug`, `idx_organizations_created_by`, `idx_organizations_deleted_at`.

#### Table: `public.organization_members`
Maps users to organizations with granular enterprise roles.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `role` (TEXT, NOT NULL, Check: role IN ('org_admin', 'security_officer', 'compliance_auditor', 'member', 'guest'))
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Constraints:* UNIQUE (`organization_id`, `user_id`)
- *Indexes:* `idx_org_members_org_user`, `idx_org_members_user`.

#### Table: `public.organization_domains`
Verified corporate email domains for auto-provisioning and SSO.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `domain` (TEXT, NOT NULL, Unique)
- `verification_token` (TEXT, NOT NULL)
- `is_verified` (BOOLEAN, NOT NULL, Default false)
- `verified_at` (TIMESTAMPTZ, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_org_domains_domain`, `idx_org_domains_org_id`.

#### Table: `public.organization_sso_configs`
Stores enterprise SAML 2.0 and OIDC Identity Provider (IdP) configurations.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE, Unique)
- `idp_entity_id` (TEXT, NOT NULL)
- `idp_sso_url` (TEXT, NOT NULL)
- `idp_x509_cert` (TEXT, NOT NULL)
- `enforce_sso` (BOOLEAN, NOT NULL, Default false)
- `allow_password_fallback` (BOOLEAN, NOT NULL, Default true)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())

### 2.2 Domain 2: Collaboration and Team Workspaces

#### Table: `public.teams`
Team workspaces facilitating collaborative projects, decisions, and actions.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `name` (TEXT, NOT NULL)
- `description` (TEXT, Default NULL)
- `owner_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_teams_owner_id`, `idx_teams_org_id`, `idx_teams_deleted_at`.

#### Table: `public.team_members`
Team membership and role assignments.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `team_id` (UUID, NOT NULL, References `public.teams(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `role` (TEXT, NOT NULL, Check: role IN ('owner', 'admin', 'editor', 'viewer'))
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Constraints:* UNIQUE (`team_id`, `user_id`)
- *Indexes:* `idx_team_members_team_user`, `idx_team_members_user_id`.

#### Table: `public.team_invitations`
Pending email invitations to join a team workspace.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `team_id` (UUID, NOT NULL, References `public.teams(id)` ON DELETE CASCADE)
- `email` (TEXT, NOT NULL)
- `role` (TEXT, NOT NULL, Default 'editor')
- `token` (TEXT, NOT NULL, Unique)
- `invited_by` (UUID, NOT NULL, References `auth.users(id)`)
- `expires_at` (TIMESTAMPTZ, NOT NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_team_invitations_token`, `idx_team_invitations_email`.

#### Table: `public.team_activities`
Auditable activity stream of actions within a team.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `team_id` (UUID, NOT NULL, References `public.teams(id)` ON DELETE CASCADE)
- `actor_id` (UUID, NOT NULL, References `auth.users(id)`)
- `action` (TEXT, NOT NULL)
- `target_type` (TEXT, NOT NULL)
- `target_id` (TEXT, NOT NULL)
- `metadata` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_team_activities_team_created`, `idx_team_activities_actor`.

### 2.3 Domain 3: Projects and Meeting Transcripts

#### Table: `public.projects`
Core organizing entity for meetings, documents, decisions, and intelligence.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `description` (TEXT, Default NULL)
- `ownership_type` (TEXT, NOT NULL, Default 'personal', Check: ownership_type IN ('personal', 'team'))
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `notes` (TEXT, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_projects_user_id`, `idx_projects_team_id`, `idx_projects_org_id`, `idx_projects_deleted_at`.

#### Table: `public.transcripts`
Stores raw and formatted meeting transcripts with speaker metadata.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `ownership_type` (TEXT, NOT NULL, Default 'personal', Check: ownership_type IN ('personal', 'team'))
- `title` (TEXT, NOT NULL)
- `source_type` (TEXT, NOT NULL, Check: source_type IN ('manual_paste', 'file_upload', 'direct_recording', 'webhook_ingest'))
- `content` (TEXT, NOT NULL)
- `speaker_data` (JSONB, NOT NULL, Default '[]'::jsonb)
- `duration_seconds` (INTEGER, Default NULL)
- `word_count` (INTEGER, NOT NULL, Default 0)
- `tsv_content` (TSVECTOR, Generated via trigger or index for full-text search)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_transcripts_project_id`, `idx_transcripts_user_id`, `idx_transcripts_team_id`, `idx_transcripts_deleted_at`, `idx_transcripts_tsv` (GIN).

### 2.4 Domain 4: Outputs and Generated Intelligence

#### Table: `public.outputs`
Generated business deliverables, executive summaries, and action plans.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `transcript_id` (UUID, References `public.transcripts(id)` ON DELETE SET NULL)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `ownership_type` (TEXT, NOT NULL, Default 'personal', Check: ownership_type IN ('personal', 'team'))
- `template_type` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL)
- `content` (TEXT, NOT NULL)
- `structured_data` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_outputs_project_id`, `idx_outputs_user_id`, `idx_outputs_template_type`, `idx_outputs_deleted_at`.

#### Table: `public.generated_intelligence`
Granular insights, risk detections, opportunities, and strategic flags extracted from meetings.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `transcript_id` (UUID, References `public.transcripts(id)` ON DELETE CASCADE)
- `intelligence_type` (TEXT, NOT NULL, Check: intelligence_type IN ('insight', 'risk', 'opportunity', 'blind_spot', 'governance_gap'))
- `headline` (TEXT, NOT NULL)
- `detail` (TEXT, NOT NULL)
- `evidence_quote` (TEXT, Default NULL)
- `confidence_score` (NUMERIC, NOT NULL, Default 85)
- `metadata` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_gen_intel_project`, `idx_gen_intel_type`, `idx_gen_intel_deleted_at`.

#### Table: `public.endpoint_reports`
Machine-ready reports formatted for downstream API consumption and CRM ingest.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `report_type` (TEXT, NOT NULL)
- `payload` (JSONB, NOT NULL)
- `status` (TEXT, NOT NULL, Default 'generated', Check: status IN ('generated', 'delivered', 'failed'))
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_endpoint_reports_project`, `idx_endpoint_reports_status`.

### 2.5 Domain 5: Decision Memory and Action Tracker

#### Table: `public.decision_memory`
Enterprise repository of formal organizational decisions, rationales, and outcomes.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `ownership_type` (TEXT, NOT NULL, Default 'personal', Check: ownership_type IN ('personal', 'team'))
- `title` (TEXT, NOT NULL)
- `decision_text` (TEXT, NOT NULL)
- `context_rationale` (TEXT, Default NULL)
- `alternatives_considered` (JSONB, NOT NULL, Default '[]'::jsonb)
- `approved_by` (TEXT, Default NULL)
- `decision_date` (DATE, NOT NULL, Default CURRENT_DATE)
- `status` (TEXT, NOT NULL, Default 'approved', Check: status IN ('draft', 'approved', 'superseded', 'reversed'))
- `financial_impact` (NUMERIC, Default NULL)
- `tags` (TEXT[], NOT NULL, Default '{}'::text[])
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_decisions_project_id`, `idx_decisions_team_id`, `idx_decisions_status`, `idx_decisions_deleted_at`.

#### Table: `public.action_tracker`
Operational accountability register enforcing the Five-Field Delegation Standard.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `project_id` (UUID, NOT NULL, References `public.projects(id)` ON DELETE CASCADE)
- `decision_id` (UUID, References `public.decision_memory(id)` ON DELETE SET NULL)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `ownership_type` (TEXT, NOT NULL, Default 'personal', Check: ownership_type IN ('personal', 'team'))
- `task_description` (TEXT, NOT NULL)
- `single_owner` (TEXT, NOT NULL)
- `due_date` (DATE, NOT NULL)
- `definition_of_done` (TEXT, NOT NULL)
- `checkpoint_date` (DATE, NOT NULL)
- `status` (TEXT, NOT NULL, Default 'open', Check: status IN ('open', 'in_progress', 'completed', 'blocked', 'cancelled'))
- `priority` (TEXT, NOT NULL, Default 'medium', Check: priority IN ('low', 'medium', 'high', 'critical'))
- `completed_at` (TIMESTAMPTZ, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_actions_project_id`, `idx_actions_team_id`, `idx_actions_status`, `idx_actions_due_date`, `idx_actions_deleted_at`.

### 2.6 Domain 6: Governance, Audit, and Compliance

#### Table: `public.audit_logs`
Immutable, append-only security and operational audit trail.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `actor_id` (UUID, References `auth.users(id)` ON DELETE SET NULL)
- `action` (TEXT, NOT NULL)
- `entity_type` (TEXT, NOT NULL)
- `entity_id` (TEXT, NOT NULL)
- `details` (JSONB, NOT NULL, Default '{}'::jsonb)
- `ip_address` (TEXT, Default NULL)
- `user_agent` (TEXT, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_audit_logs_org_created`, `idx_audit_logs_actor`, `idx_audit_logs_action`.

#### Table: `public.retention_policies`
Enterprise data lifecycle and retention policies.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `entity_type` (TEXT, NOT NULL, Check: entity_type IN ('transcripts', 'outputs', 'decisions', 'actions', 'audit_logs', 'copilot_conversations', 'knowledge_nodes'))
- `retention_days` (INTEGER, NOT NULL CHECK (retention_days >= 30))
- `created_by` (UUID, NOT NULL, References `auth.users(id)`)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Constraints:* UNIQUE (`organization_id`, `entity_type`)
- *Indexes:* `idx_retention_policies_org_entity`.

#### Table: `public.legal_holds`
Statutory and regulatory legal hold directives that strictly freeze records from deletion.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `matter_reference` (TEXT, NOT NULL)
- `description` (TEXT, Default NULL)
- `status` (TEXT, NOT NULL, Default 'active', Check: status IN ('active', 'released'))
- `target_type` (TEXT, NOT NULL, Check: target_type IN ('organization', 'user', 'project', 'team'))
- `target_id` (TEXT, NOT NULL)
- `applied_by` (UUID, NOT NULL, References `auth.users(id)`)
- `applied_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `released_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `released_at` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_legal_holds_org_status`, `idx_legal_holds_target`.

#### Table: `public.access_reviews`
Enterprise compliance access recertification records.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `reviewer_id` (UUID, NOT NULL, References `auth.users(id)`)
- `target_user_id` (UUID, NOT NULL, References `auth.users(id)`)
- `status` (TEXT, NOT NULL, Default 'pending', Check: status IN ('pending', 'approved', 'revoked'))
- `notes` (TEXT, Default NULL)
- `completed_at` (TIMESTAMPTZ, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())

### 2.7 Domain 7: Integrations, Webhooks, and API Keys

#### Table: `public.integrations`
Configured third-party service connections (Microsoft Teams, Planner, Slack, CRM).
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `provider` (TEXT, NOT NULL, Check: provider IN ('microsoft_teams', 'microsoft_planner', 'slack', 'salesforce', 'hubspot', 'jira'))
- `status` (TEXT, NOT NULL, Default 'active', Check: status IN ('active', 'error', 'disabled'))
- `credentials_encrypted` (TEXT, NOT NULL)
- `settings` (JSONB, NOT NULL, Default '{}'::jsonb)
- `last_sync_at` (TIMESTAMPTZ, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())

#### Table: `public.webhooks`
Outbound event notification configurations.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `url` (TEXT, NOT NULL)
- `signing_secret` (TEXT, NOT NULL)
- `events` (TEXT[], NOT NULL)
- `is_active` (BOOLEAN, NOT NULL, Default true)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())

#### Table: `public.api_keys`
Cryptographically hashed API access keys.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `key_hash` (TEXT, NOT NULL, Unique)
- `key_prefix` (TEXT, NOT NULL)
- `scopes` (TEXT[], NOT NULL, Default '{read}'::text[])
- `last_used_at` (TIMESTAMPTZ, Default NULL)
- `expires_at` (TIMESTAMPTZ, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())

### 2.8 Domain 8: AI Agents, Workflows, and Approvals

#### Table: `public.agent_memory`
Scoped, persistent key-value cognitive memory for AI agents.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `agent_id` (TEXT, NOT NULL)
- `scope_type` (TEXT, NOT NULL, Check: scope_type IN ('personal', 'team', 'organization'))
- `scope_id` (UUID, NOT NULL)
- `memory_key` (TEXT, NOT NULL)
- `memory_value` (JSONB, NOT NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Constraints:* UNIQUE (`agent_id`, `scope_type`, `scope_id`, `memory_key`)
- *Indexes:* `idx_agent_memory_lookup`, `idx_agent_memory_scope`.

#### Table: `public.workflows`
Defined multi-step automated operational workflows.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `title` (TEXT, NOT NULL)
- `description` (TEXT, Default NULL)
- `trigger_type` (TEXT, NOT NULL)
- `steps` (JSONB, NOT NULL, Default '[]'::jsonb)
- `is_active` (BOOLEAN, NOT NULL, Default true)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)

#### Table: `public.workflow_executions`
Execution runs of defined workflows.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `workflow_id` (UUID, NOT NULL, References `public.workflows(id)` ON DELETE CASCADE)
- `status` (TEXT, NOT NULL, Default 'running', Check: status IN ('running', 'paused_for_approval', 'completed', 'failed', 'cancelled'))
- `current_step` (INTEGER, NOT NULL, Default 0)
- `execution_state` (JSONB, NOT NULL, Default '{}'::jsonb)
- `error_message` (TEXT, Default NULL)
- `started_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `completed_at` (TIMESTAMPTZ, Default NULL)

#### Table: `public.workflow_approvals`
Mandatory human governance checkpoints for workflow execution.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `workflow_execution_id` (UUID, NOT NULL, References `public.workflow_executions(id)` ON DELETE CASCADE)
- `step_index` (INTEGER, NOT NULL)
- `action_type` (TEXT, NOT NULL)
- `action_payload` (JSONB, NOT NULL)
- `status` (TEXT, NOT NULL, Default 'pending', Check: status IN ('pending', 'approved', 'rejected'))
- `requested_by` (UUID, NOT NULL, References `auth.users(id)`)
- `reviewed_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `review_comments` (TEXT, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `reviewed_at` (TIMESTAMPTZ, Default NULL)

#### Table: `public.agent_activity`
Operational audit log of agent invocations, tool uses, and recommendations.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `agent_id` (TEXT, NOT NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE SET NULL)
- `user_id` (UUID, NOT NULL, References `auth.users(id)`)
- `activity_type` (TEXT, NOT NULL)
- `summary` (TEXT, NOT NULL)
- `metadata` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())

### 2.9 Domain 9: Knowledge Graph and Organizational Memory

#### Table: `public.knowledge_nodes`
Canonical graph nodes representing entities, outcomes, and intelligence.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `node_type` (TEXT, NOT NULL, Check: node_type IN ('project', 'transcript', 'output', 'decision', 'action', 'insight', 'risk', 'opportunity', 'recommendation', 'report', 'forecast', 'team', 'user', 'organization'))
- `source_entity_type` (TEXT, NOT NULL)
- `source_entity_id` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL)
- `summary` (TEXT, Default NULL)
- `owner_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE CASCADE)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `metadata` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_knowledge_nodes_type`, `idx_knowledge_nodes_source`, `idx_knowledge_nodes_org`, `idx_knowledge_nodes_deleted_at`.

#### Table: `public.knowledge_relationships`
Directed semantic edges connecting knowledge nodes with confidence scores.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `source_node_id` (UUID, NOT NULL, References `public.knowledge_nodes(id)` ON DELETE CASCADE)
- `target_node_id` (UUID, NOT NULL, References `public.knowledge_nodes(id)` ON DELETE CASCADE)
- `relationship_type` (TEXT, NOT NULL, Check: relationship_type IN ('references', 'related_to', 'depends_on', 'caused_by', 'resulted_in', 'blocks', 'supports', 'conflicts_with', 'owned_by', 'assigned_to', 'derived_from', 'influences', 'contributes_to', 'escalates_to', 'mitigates'))
- `confidence_score` (NUMERIC, NOT NULL, Default 85, Check: confidence_score >= 0 AND confidence_score <= 100)
- `context_notes` (TEXT, Default NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_knowledge_rel_source`, `idx_knowledge_rel_target`, `idx_knowledge_rel_type`.

#### Table: `public.lessons_learned`
Synthesized institutional retrospective findings, root causes, and recommendations.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE CASCADE)
- `project_id` (UUID, References `public.projects(id)` ON DELETE SET NULL)
- `category` (TEXT, NOT NULL, Check: category IN ('delivery', 'process', 'technical', 'commercial', 'governance', 'people'))
- `summary` (TEXT, NOT NULL)
- `context_observed` (TEXT, NOT NULL)
- `root_cause` (TEXT, NOT NULL)
- `recommendation` (TEXT, NOT NULL)
- `is_verified` (BOOLEAN, NOT NULL, Default false)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_lessons_org`, `idx_lessons_category`, `idx_lessons_deleted_at`.

### 2.10 Domain 10: Predictive Intelligence and Strategic Briefings

#### Table: `public.predictive_snapshots`
Forward-looking projections, delivery forecasts, and organizational risk assessments.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE CASCADE)
- `project_id` (UUID, References `public.projects(id)` ON DELETE SET NULL)
- `snapshot_type` (TEXT, NOT NULL, Check: snapshot_type IN ('delivery_velocity', 'action_backlog', 'risk_drift', 'decision_impact', 'org_health'))
- `forecast_horizon_days` (INTEGER, NOT NULL)
- `metrics` (JSONB, NOT NULL)
- `confidence_score` (NUMERIC, NOT NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)

#### Table: `public.executive_briefings`
Synthesized executive leadership briefings and board updates.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `title` (TEXT, NOT NULL)
- `briefing_type` (TEXT, NOT NULL, Check: briefing_type IN ('weekly_pulse', 'monthly_review', 'quarterly_board', 'strategic_transformation', 'critical_risk'))
- `content` (TEXT, NOT NULL)
- `structured_metrics` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)

### 2.11 Domain 11: Concludo Copilot and Natural Language Intelligence

#### Table: `public.copilot_conversations`
Interactive conversational sessions with the Concludo Copilot.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `session_id` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL, Default 'New Exploration')
- `is_archived` (BOOLEAN, NOT NULL, Default false)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_copilot_conv_user`, `idx_copilot_conv_session`, `idx_copilot_conv_deleted_at`.

#### Table: `public.copilot_messages`
Individual message turns within a Copilot conversation.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `conversation_id` (UUID, NOT NULL, References `public.copilot_conversations(id)` ON DELETE CASCADE)
- `role` (TEXT, NOT NULL, Check: role IN ('user', 'assistant', 'system'))
- `message` (TEXT, NOT NULL)
- `response` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_copilot_msg_conv`, `idx_copilot_msg_created`.

#### Table: `public.copilot_prompts`
Personal, team, and organization-wide saved prompt templates.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, References `auth.users(id)` ON DELETE CASCADE)
- `team_id` (UUID, References `public.teams(id)` ON DELETE SET NULL)
- `organization_id` (UUID, References `public.organizations(id)` ON DELETE CASCADE)
- `scope` (TEXT, NOT NULL, Default 'personal', Check: scope IN ('personal', 'team', 'organization', 'role'))
- `title` (TEXT, NOT NULL)
- `prompt_text` (TEXT, NOT NULL)
- `category` (TEXT, NOT NULL, Default 'general')
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `updated_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_copilot_prompts_user`, `idx_copilot_prompts_org`, `idx_copilot_prompts_deleted_at`.

### 2.12 Domain 12: Autonomous Strategic Operations and Digital Twin

#### Table: `public.strategic_digital_twins`
Comprehensive mathematical digital twin snapshot of organizational performance.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `snapshot_timestamp` (TIMESTAMPTZ, NOT NULL, Default now())
- `overall_score` (NUMERIC, NOT NULL, Check: overall_score >= 0 AND overall_score <= 100)
- `health_classification` (TEXT, NOT NULL, Check: health_classification IN ('exceptional', 'strong', 'stable', 'watch_required', 'at_risk', 'critical_attention'))
- `operational_health` (NUMERIC, NOT NULL)
- `strategic_health` (NUMERIC, NOT NULL)
- `execution_health` (NUMERIC, NOT NULL)
- `collaboration_health` (NUMERIC, NOT NULL)
- `decision_health` (NUMERIC, NOT NULL)
- `knowledge_health` (NUMERIC, NOT NULL)
- `risk_exposure` (NUMERIC, NOT NULL)
- `opportunity_signals` (JSONB, NOT NULL, Default '[]'::jsonb)
- `model_metrics` (JSONB, NOT NULL, Default '{}'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_digital_twins_org_time`, `idx_digital_twins_deleted_at`.

#### Table: `public.strategic_health_scores`
Longitudinal tracking of the 8 core strategic health dimensions.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `recorded_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `overall_score` (NUMERIC, NOT NULL)
- `vision_execution` (NUMERIC, NOT NULL)
- `program_delivery` (NUMERIC, NOT NULL)
- `decision_velocity` (NUMERIC, NOT NULL)
- `operational_alignment` (NUMERIC, NOT NULL)
- `team_effectiveness` (NUMERIC, NOT NULL)
- `knowledge_utilization` (NUMERIC, NOT NULL)
- `risk_management` (NUMERIC, NOT NULL)
- `organizational_learning` (NUMERIC, NOT NULL)
- `classification` (TEXT, NOT NULL)
- `supporting_rationale` (JSONB, NOT NULL, Default '[]'::jsonb)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_health_scores_org_time`.

#### Table: `public.strategic_scenarios`
Simulated hypothetical what-if scenarios and operational stress tests.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `title` (TEXT, NOT NULL)
- `scenario_type` (TEXT, NOT NULL)
- `assumptions` (JSONB, NOT NULL, Default '[]'::jsonb)
- `possible_outcomes` (JSONB, NOT NULL, Default '[]'::jsonb)
- `risk_impact` (TEXT, NOT NULL)
- `resource_impact` (TEXT, NOT NULL)
- `project_impact` (TEXT, NOT NULL)
- `decision_impact` (TEXT, NOT NULL)
- `operational_impact` (TEXT, NOT NULL)
- `confidence_level` (TEXT, NOT NULL, Check: confidence_level IN ('low', 'moderate', 'high', 'very_high'))
- `supporting_evidence` (JSONB, NOT NULL, Default '[]'::jsonb)
- `created_by` (UUID, NOT NULL, References `auth.users(id)`)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_scenarios_org`, `idx_scenarios_deleted_at`.

#### Table: `public.strategic_briefings`
Formal board reports, quarterly operating reviews, and executive transformation briefings.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `briefing_type` (TEXT, NOT NULL, Check: briefing_type IN ('board_update', 'strategic_briefing', 'quarterly_review', 'transformation_report', 'performance_report', 'risk_review', 'opportunity_review'))
- `title` (TEXT, NOT NULL)
- `executive_summary` (TEXT, NOT NULL)
- `content` (TEXT, NOT NULL)
- `structured_sections` (JSONB, NOT NULL, Default '{}'::jsonb)
- `initiative_health` (JSONB, NOT NULL, Default '[]'::jsonb)
- `risk_exposure` (JSONB, NOT NULL, Default '{}'::jsonb)
- `forecast_outlook` (JSONB, NOT NULL, Default '{}'::jsonb)
- `recommendation_summaries` (JSONB, NOT NULL, Default '[]'::jsonb)
- `created_by` (UUID, NOT NULL, References `auth.users(id)`)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- `deleted_at` (TIMESTAMPTZ, Default NULL)
- `deleted_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `purge_after` (TIMESTAMPTZ, Default NULL)
- *Indexes:* `idx_strat_briefings_org`, `idx_strat_briefings_type`.

#### Table: `public.strategic_alerts`
Active strategic risk alerts, delivery warnings, and emerging opportunity notifications.
- `id` (UUID, Primary Key, Default `gen_random_uuid()`)
- `organization_id` (UUID, NOT NULL, References `public.organizations(id)` ON DELETE CASCADE)
- `alert_type` (TEXT, NOT NULL, Check: alert_type IN ('critical_risk', 'initiative_delayed', 'health_declining', 'decision_backlog', 'knowledge_gap', 'strategic_opportunity'))
- `severity` (TEXT, NOT NULL, Check: severity IN ('low', 'medium', 'high', 'critical'))
- `headline` (TEXT, NOT NULL)
- `description` (TEXT, NOT NULL)
- `recommended_action` (TEXT, NOT NULL)
- `is_dismissed` (BOOLEAN, NOT NULL, Default false)
- `dismissed_at` (TIMESTAMPTZ, Default NULL)
- `dismissed_by` (UUID, References `auth.users(id)` DEFAULT NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, Default now())
- *Indexes:* `idx_strat_alerts_org_active`.

---

### 2.13 Future Database Schemas (Roadmap Specifications)

To ensure long-term architectural stability, the following four tables are pre-specified for future platform expansion:

#### Table: `public.vector_embeddings` (Planned)
Stores high-dimensional dense vector embeddings generated from meeting transcripts, decisions, and knowledge nodes.
```sql
CREATE TABLE IF NOT EXISTS public.vector_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_entity_type TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- Configured for pgvector
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vec_embed_source ON public.vector_embeddings(source_entity_type, source_entity_id);
-- HNSW Index for approximate nearest neighbour search
-- CREATE INDEX idx_vec_embed_hnsw ON public.vector_embeddings USING hnsw (embedding vector_cosine_ops);
```

#### Table: `public.external_connectors` (Planned)
Deep two-way synchronization metadata for enterprise ERPs and project portfolio systems.
```sql
CREATE TABLE IF NOT EXISTS public.external_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    connector_type TEXT NOT NULL CHECK (connector_type IN ('sap', 'workday', 'servicenow', 'asana', 'monday')),
    sync_frequency_minutes INTEGER NOT NULL DEFAULT 60,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_successful_sync TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Table: `public.event_stream_logs` (Planned)
High-throughput distributed event telemetry capturing live agent execution micro-steps and user interactions.
```sql
CREATE TABLE IF NOT EXISTS public.event_stream_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_ms NUMERIC NOT NULL DEFAULT 0,
    emitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_stream_trace ON public.event_stream_logs(trace_id);
```

#### Table: `public.user_consent_records` (Planned)
Granular user consent tracking for specific AI assistive workflows under evolving global compliance standards.
```sql
CREATE TABLE IF NOT EXISTS public.user_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ DEFAULT NULL
);
```

---

### 2.14 Database Relationships and Foreign Key Topography

The relational topology of Concludo Workspace enforces strict referential cascading behaviour and orphaned-data prevention:

```
[ organizations ] (Root Tenant)
       │
       ├───► [ organization_members ] ──────────► [ profiles ]
       ├───► [ organization_domains ]
       ├───► [ organization_sso_configs ]
       ├───► [ retention_policies ]
       ├───► [ legal_holds ]
       ├───► [ audit_logs ]
       ├───► [ strategic_digital_twins ]
       ├───► [ strategic_health_scores ]
       ├───► [ strategic_scenarios ]
       ├───► [ strategic_briefings ]
       ├───► [ strategic_alerts ]
       │
       └───► [ teams ] 
               │
               ├───► [ team_members ] ──────────► [ profiles ]
               ├───► [ team_activities ]
               │
               └───► [ projects ] 
                       │
                       ├───► [ transcripts ]
                       ├───► [ outputs ]
                       ├───► [ decision_memory ]
                       │         │
                       │         └───► [ action_tracker ] (Five-Field Delegation)
                       │
                       ├───► [ generated_intelligence ]
                       └───► [ endpoint_reports ]

[ knowledge_nodes ] ──( 1:N )──► [ knowledge_relationships ] ◄──( 1:N )── [ knowledge_nodes ]
       ▲
       └── References source_entity_id across projects, decisions, actions, outputs

[ copilot_conversations ] ──( 1:N )──► [ copilot_messages ]
[ workflows ] ──( 1:N )──► [ workflow_executions ] ──( 1:N )──► [ workflow_approvals ]
```

---

### 2.15 Indexing Strategy and Query Optimization

To maintain sub-100ms query performance at scale, Concludo implements four classes of database indexes:
1. **Primary Foreign Key B-Tree Indexes:** Every foreign key column (`user_id`, `project_id`, `team_id`, `organization_id`) is indexed to accelerate joins and enforce cascading constraints without sequential table scans.
2. **Partial Soft-Delete Indexes:** High-frequency operational tables feature partial B-tree indexes filtering on active records:
   ```sql
   CREATE INDEX idx_projects_active ON public.projects(user_id, team_id) WHERE deleted_at IS NULL;
   CREATE INDEX idx_actions_active ON public.action_tracker(status, due_date) WHERE deleted_at IS NULL;
   CREATE INDEX idx_decisions_active ON public.decision_memory(project_id, status) WHERE deleted_at IS NULL;
   ```
3. **Full-Text Search GIN Indexes:** The `transcripts` table utilizes Generalized Inverted Index (GIN) structures over English-stemmed `tsvector` columns for high-speed lexical search.
4. **JSONB Path Indexes (GIN):** Complex metadata columns in `outputs`, `knowledge_nodes`, and `audit_logs` utilise expression indexes using the `jsonb_path_ops` operator class, allowing instantaneous deep attribute lookups.

---

## SECTION 3: ROW-LEVEL SECURITY (RLS) ARCHITECTURE

Row-Level Security (RLS) in PostgreSQL is the core architectural boundary ensuring mathematical tenant isolation across Concludo Workspace. Security policies execute directly inside the database kernel on every query, ensuring that no client-side defect, network proxy error, or application-layer flaw can expose unauthorized records.

```
+====================================================================================================+
|                                  ROW-LEVEL SECURITY HIERARCHY                                      |
+====================================================================================================+
| 5. ENTERPRISE ISOLATION: Plan Gates ('enterprise', 'admin'), SAML SSO, Domain Verification        |
+----------------------------------------------------------------------------------------------------+
| 4. ORGANISATION ISOLATION: organization_members membership check, role checks (org_admin, etc.)   |
+----------------------------------------------------------------------------------------------------+
| 3. TEAM ISOLATION: team_members membership check (owner, admin, editor, viewer)                    |
+----------------------------------------------------------------------------------------------------+
| 2. USER ISOLATION: Personal ownership check (auth.uid() = user_id AND ownership_type = 'personal')|
+----------------------------------------------------------------------------------------------------+
| 1. SYSTEM BASELINE: auth.uid() NOT NULL, soft-delete filtering (deleted_at IS NULL), active RLS    |
+====================================================================================================+
```

### 3.1 Tenant Isolation Principles
- **No Shared Tenant Scope:** Every query executed by an authenticated user is bound to their verified identity (`auth.uid()`). A user belongs to one or more organizations, but database policies strictly limit visibility to the organizations in which the user holds an active membership in `organization_members`.
- **Service Role Segregation:** Client-side browser applications connect exclusively using the anonymous public key (`VITE_SUPABASE_ANON_KEY`) paired with a valid JSON Web Token (JWT). The Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) is strictly confined to internal backend servers, background workers, and administrative CLI tools, and is never bundled in frontend JavaScript.
- **Fail-Closed Default:** If an RLS policy evaluation encounters an ambiguity, null check failure, or unmapped user identifier, PostgreSQL defaults to denying the query (returning zero rows or throwing an access violation).

### 3.2 User Isolation (Personal Workspaces)
Personal workspace records represent private individual work where `ownership_type = 'personal'`.
- **Policy Rule:** A personal record is accessible if and only if the current user matches the record's creator:
```sql
CREATE POLICY "Users can access their own personal projects"
ON public.projects
FOR ALL
TO authenticated
USING (
    ownership_type = 'personal' 
    AND user_id = auth.uid()
);
```
- **Cross-User Protection:** Even within the same organization, other team members and organizational administrators cannot view another user's personal projects, transcripts, or decisions unless the owner explicitly shares or converts the project into a team workspace.

### 3.3 Team Isolation (Collaborative Workspaces)
Team workspaces (`ownership_type = 'team'`) allow controlled collaboration between designated team members.
- **Policy Rule:** A team record is accessible if the authenticated user is an active member of the designated team:
```sql
CREATE POLICY "Team members can view team projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
    ownership_type = 'team' 
    AND team_id IN (
        SELECT tm.team_id 
        FROM public.team_members tm 
        WHERE tm.user_id = auth.uid()
    )
);
```
- **Role-Based Mutation Rights:** Write, update, and soft-delete operations require editor or admin privileges:
```sql
CREATE POLICY "Team editors can update team projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
    ownership_type = 'team' 
    AND team_id IN (
        SELECT tm.team_id 
        FROM public.team_members tm 
        WHERE tm.user_id = auth.uid() 
        AND tm.role IN ('owner', 'admin', 'editor')
    )
);
```

### 3.4 Organization Isolation (Enterprise Boundaries)
Organization-wide entities (such as strategic digital twins, corporate policies, and executive briefings) belong directly to the enterprise tenant.
- **Policy Rule:** Membership in the parent organization is required for read access:
```sql
CREATE POLICY "Organization members can view organizational assets"
ON public.strategic_digital_twins
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM public.organization_members om 
        WHERE om.user_id = auth.uid()
    )
);
```
- **Administrative Privileges:** Administrative actions (such as configuring SSO, modifying retention rules, or executing legal holds) require the `org_admin` role verified against `organization_members`:
```sql
CREATE POLICY "Only org admins can manage retention policies"
ON public.retention_policies
FOR ALL
TO authenticated
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM public.organization_members om 
        WHERE om.user_id = auth.uid() 
        AND om.role = 'org_admin'
    )
);
```

### 3.5 Enterprise Tier Isolation
Advanced intelligence and automation capabilities are strictly gated by subscription plan in both the application code and the database policies:
1. **Tier-Gated Feature Flags:** Advanced features (`concludo_copilot`, `decision_assistant`, `knowledge_assistant`, `executive_command_center`, `digital_twin`, `scenario_modeling`) are granted exclusively to `enterprise` and `admin` tiers.
2. **Optional Team Overrides:** Team-tier organizations may access select advanced modules (such as Copilot or Knowledge Network) only when an organization administrator explicitly enables the respective boolean flag (`organizations.allow_team_copilot = true`, `organizations.allow_team_knowledge = true`, `organizations.allow_team_agents = true`, `organizations.allow_team_predictive = true`).
3. **Suspension Enforcement:** Users with `profiles.is_suspended = true` are immediately blocked from all authenticated queries by a base RLS check:
```sql
CREATE POLICY "Suspended users denied all access"
ON public.profiles
FOR ALL
TO authenticated
USING (
    id = auth.uid() 
    AND is_suspended = false
);
```

---

## SECTION 4: SEARCH ARCHITECTURE

Concludo Workspace implements a multi-modal search engine combining keyword, lexical full-text, graph traversal, and vector search. This architecture guarantees that users and autonomous agents can rapidly discover exact conversational phrases as well as abstract strategic concepts.

```
                                  [ User Query ]
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
       [ Lexical & Keyword Path ]              [ Dense Semantic Vector Path ]
                    │                                       │
     PostgreSQL tsvector / tsquery              Dense Embedding Generation
     (English Stemming, Stop Words)             (Cosine Similarity / HNSW)
                    │                                       │
                    ▼                                       ▼
       [ Sparse BM25-Style Hits ]              [ Dense Semantic Hits ]
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                       [ Reciprocal Rank Fusion (RRF) ]
                       Score = (0.6 * R_lex) + (0.4 * R_vec)
                                        │
                                        ▼
                      [ Knowledge Graph Entity Expansion ]
                      (Traverse 1-Hop Connected Relationships)
                                        │
                                        ▼
                       [ Final Re-Ranked Result Set ]
```

### 4.1 Transcript Search
Transcripts represent large, unstructured conversational documents containing speaker-attributed dialogue.
- **Lexical Processing:** On ingest, transcript text is parsed, stripped of punctuation, normalized, and stemmed using PostgreSQL's `to_tsvector('english', content)`.
- **Dialogue-Aware Chunking:** Transcripts are partitioned into conversational utterances with speaker IDs and time offsets. Searches match both specific speaker dialogue (*"What did Sarah state regarding the budget?"*) and general meeting themes.
- **Snippet Generation:** Search queries utilize `ts_headline` to return contextual excerpts with highlighted matching terms for rapid scanning in the search interface.

### 4.2 Decision Search
Decision Memory stores structured institutional choices.
- **Searchable Attributes:** Searches operate across `title`, `decision_text`, `context_rationale`, `approved_by`, and `tags`.
- **Faceted Filtering:** Queries can be constrained by date ranges, project boundaries, status (`approved`, `superseded`, `reversed`), and financial impact thresholds.

### 4.3 Action Search
The Action Tracker enforces accountability through targeted attribute search.
- **Accountability Indexing:** Full indexing across `task_description`, `single_owner`, `definition_of_done`, and `priority`.
- **Operational Status Facets:** Rapid filtering by overdue status (`due_date < CURRENT_DATE AND status != 'completed'`), blocked status, and checkpoint milestones.

### 4.4 Knowledge Search
Knowledge Search operates across the unified `knowledge_nodes` table.
- **Multi-Entity Discovery:** Users can search across all 14 knowledge node types simultaneously, allowing a query like *"Atlas"* to return projects, linked decisions, open actions, forecast models, and identified delivery risks in a single cohesive view.

### 4.5 Keyword and Full-Text Search Implementation
Keyword search is implemented natively in PostgreSQL using GiST/GIN indexes:
```sql
-- Full-text search expression on transcripts
SELECT 
    t.id, 
    t.title, 
    ts_rank_cd(to_tsvector('english', t.content), query) AS relevance,
    ts_headline('english', t.content, query, 'StartSel=<b>, StopSel=</b>, MaxWords=50, MinWords=20') AS snippet
FROM 
    public.transcripts t, 
    plainto_tsquery('english', 'vendor selection criteria') query
WHERE 
    to_tsvector('english', t.content) @@ query
    AND t.deleted_at IS NULL
ORDER BY 
    relevance DESC 
LIMIT 20;
```

### 4.6 Dense Semantic Vector Search (pgvector)
For semantic discovery where users search by meaning rather than exact keywords:
- **Embedding Generation:** Source texts are transformed into 1536-dimensional vectors using standard embedding models.
- **Cosine Distance Retrieval:** Embeddings are indexed using Hierarchical Navigable Small World (HNSW) graphs, achieving sub-10ms nearest-neighbour retrieval:
```sql
SELECT 
    ve.source_entity_type,
    ve.source_entity_id,
    1 - (ve.embedding <=> $1::vector) AS cosine_similarity
FROM 
    public.vector_embeddings ve
WHERE 
    ve.organization_id = $2
ORDER BY 
    ve.embedding <=> $1::vector ASC
LIMIT 15;
```

### 4.7 Hybrid Search and Reciprocal Rank Fusion (RRF)
To eliminate the blind spots of purely keyword-based or purely vector-based search, Concludo utilizes Reciprocal Rank Fusion (RRF):
1. **Execute Parallel Queries:** Run a sparse full-text search query and a dense vector search query independently.
2. **Assign Reciprocal Scores:** For each document $d$ appearing in either result set, calculate its fused score:
   $$RRF(d) = rac{lpha}{k + rank_{lexical}(d)} + rac{1 - lpha}{k + rank_{vector}(d)}$$
   where $k = 60$ (constant damping factor) and $lpha = 0.6$ (prioritising exact lexical matches).
3. **Graph Expansion:** For the top 5 fused results, retrieve all connected nodes from `knowledge_relationships` to surface contextually related records that did not match the text query directly.

---

## SECTION 5: KNOWLEDGE GRAPH ARCHITECTURE

The Concludo Knowledge Graph transforms isolated database tables into a rich, navigable organizational memory network. It maps how meetings lead to decisions, how decisions generate actions, how actions uncover risks, and how project outcomes yield institutional lessons learned.

```
       [ Project Node ]
              │
              ├───( resulted_in )────► [ Decision Node ]
              │                               │
              │                               ├───( resulted_in )──► [ Action Node ]
              │                               │                             │
              ├───( influences )              └───( mitigates )             └──( blocks )
              │          │                             │                           │
              ▼          ▼                             ▼                           ▼
       [ Forecast Node ] ◄──( derived_from )── [ Risk Node ] ◄─────────────────────┘
              │
              └───( contributes_to )──► [ Strategic Health Node ]
```

### 5.1 Knowledge Node Taxonomy
The graph defines 14 foundational node types across 7 strategic clusters:

| Node Type | Description | Source Entity Table | Cluster |
| :--- | :--- | :--- | :--- |
| `project` | Core project initiative or workspace | `projects` | Delivery |
| `transcript` | Verified conversational meeting record | `transcripts` | Operational |
| `output` | Generated business document or plan | `outputs` | Operational |
| `decision` | Formal decision choice and rationale | `decision_memory` | Governance |
| `action` | Delegated operational commitment | `action_tracker` | Delivery |
| `insight` | Extracted strategic finding | `generated_intelligence` | Commercial |
| `risk` | Identified threat or delivery obstacle | `generated_intelligence` | Governance |
| `opportunity` | Commercial or efficiency opportunity | `generated_intelligence` | Commercial |
| `recommendation` | Advisory guidance for leadership | `predictive_snapshots` | Governance |
| `report` | Compiled executive or board update | `executive_briefings` | Governance |
| `forecast` | Predictive projection model | `predictive_snapshots` | Delivery |
| `team` | Collaborative operational unit | `teams` | People |
| `user` | Participant, owner, or executive actor | `profiles` | People |
| `organization` | Enterprise tenant boundary | `organizations` | Governance |

### 5.2 Directed Relationship Types
Edges in the knowledge graph are directed, typed, and weighted with confidence scores (0 to 100):

1. `references`: Entity explicitly cites or mentions another entity.
2. `related_to`: Conceptual or contextual association without strict causality.
3. `depends_on`: Entity requires completion or resolution of another entity before proceeding.
4. `caused_by`: Root cause attribution linking an event or risk to a preceding factor.
5. `resulted_in`: Direct generative consequence (e.g., meeting resulted in a decision).
6. `blocks`: Active impediment preventing progress on a task or project.
7. `supports`: Evidential or operational reinforcement of an argument or initiative.
8. `conflicts_with`: Contradiction or friction between competing priorities or decisions.
9. `owned_by`: Accountability linkage attaching an entity to a team or user.
10. `assigned_to`: Delegation edge mapping an action to a specific individual.
11. `derived_from`: Analytical derivation of an insight or forecast from raw source data.
12. `influences`: Significant effect on the trajectory or outcome of another node.
13. `contributes_to`: Direct positive contribution toward a strategic objective or metric.
14. `escalates_to`: Upward notification or governance routing of an unresolved risk.
15. `mitigates`: Proactive control or action designed to reduce risk exposure.

### 5.3 Evidence Chains and Provenance
Every synthesized statement, strategic recommendation, and Copilot response in Concludo must trace back to immutable ground-truth evidence:
- **Traceability Linkages:** High-level strategic recommendations point to risk and forecast nodes; risk nodes point to decision and action nodes; decision nodes point to meeting transcripts; meeting transcripts point to timestamped dialogue utterances.
- **Non-Invention Guarantee:** If an evidence chain breaks or lacks primary source grounding, the system flags the claim as low confidence or suppresses it entirely, preventing artificial extrapolation.

### 5.4 Organizational Dependency Mapping
Dependency mapping utilizes recursive graph traversal Common Table Expressions (CTEs) to detect bottlenecks and critical paths across programs:
```sql
WITH RECURSIVE dependency_chain AS (
    -- Anchor: Find immediate blockers for a target initiative
    SELECT 
        kr.source_node_id, 
        kr.target_node_id, 
        kr.relationship_type, 
        1 AS depth
    FROM 
        public.knowledge_relationships kr
    WHERE 
        kr.source_node_id = $1 
        AND kr.relationship_type = 'depends_on'
    
    UNION ALL
    
    -- Recursive step: Follow dependency edges up to 5 hops deep
    SELECT 
        kr.source_node_id, 
        kr.target_node_id, 
        kr.relationship_type, 
        dc.depth + 1
    FROM 
        public.knowledge_relationships kr
    INNER JOIN 
        dependency_chain dc ON kr.source_node_id = dc.target_node_id
    WHERE 
        kr.relationship_type = 'depends_on' 
        AND dc.depth < 5
)
SELECT * FROM dependency_chain;
```

### 5.5 Knowledge Clusters
Nodes and relationships naturally coalesce into 7 strategic knowledge clusters:
1. **Governance Cluster:** Decisions, statutory resolutions, legal holds, compliance reviews, and audit trails.
2. **Commercial Cluster:** Market opportunities, vendor selections, pricing models, and financial commitments.
3. **Delivery Cluster:** Projects, milestones, action trackers, Gantt timelines, and implementation roadmaps.
4. **Product Cluster:** Specifications, architectural blueprints, user stories, and feature trade-offs.
5. **Operational Cluster:** Transcripts, routine outputs, meeting health scores, and recurring workflows.
6. **People Cluster:** Teams, stakeholder ownership, RACI delegations, and executive oversight.
7. **Customer Cluster:** Client discovery insights, account retrospectives, customer feedback, and service commitments.

### 5.6 Lessons Learned Architecture
The `lessons_learned` table acts as the permanent institutional memory of what worked, what failed, and why:
- **Root Cause Categorisation:** Findings are tagged by operational domain (`delivery`, `process`, `technical`, `commercial`, `governance`, `people`).
- **Retrospective Linkage:** Every lesson references the historical project where the finding occurred.
- **Verification Gate:** Institutional lessons remain in an unverified state until reviewed and confirmed by an organizational leader or designated quality owner (`is_verified = true`).

---

## SECTION 6: MEMORY ARCHITECTURE

Memory in Concludo Workspace is not a monolithic text buffer, but a multi-layered cognitive architecture that preserves context across time horizons ranging from seconds (active prompt generation) to years (multi-year enterprise programs).

```
+====================================================================================================+
|                                  CONCLUDO MEMORY TOPOGRAPHY                                        |
+====================================================================================================+
| 7. ORGANISATIONAL MEMORY: Macro knowledge graph, enterprise lessons learned, policy precedents     |
+----------------------------------------------------------------------------------------------------+
| 6. LONG-TERM AGENT MEMORY: Scoped persistent key-value store (agent_memory) across runs            |
+----------------------------------------------------------------------------------------------------+
| 5. PROJECT MEMORY: Cumulative history of documents, transcripts, and scope shifts within a project |
+----------------------------------------------------------------------------------------------------+
| 4. DECISION & ACTION MEMORY: Formal choices, rationale, outcomes, and five-field delegations       |
+----------------------------------------------------------------------------------------------------+
| 3. MEETING MEMORY: Speaker contributions, longitudinal sentiment, and recurring agenda tracking    |
+----------------------------------------------------------------------------------------------------+
| 2. SESSION & WORKING MEMORY: Interactive Copilot chat context and multi-step workflow states       |
+----------------------------------------------------------------------------------------------------+
| 1. SHORT-TERM AI MEMORY: Ephemeral in-memory context window during active prompt inference         |
+====================================================================================================+
```

### 6.1 Project Memory
Project Memory records the cumulative lifecycle of an initiative. It links all meeting sessions, document iterations, status reports, and participant logs to a single persistent root (`projects`).
- **Context Preservation:** When a new transcript or output is added to a project, it automatically inherits the project's historical context, allowing agents to understand prior scope changes, budget discussions, and milestone achievements without manual re-prompting.
- **Project Notes Substrate:** The `projects.notes` field serves as an unstructured scratchpad where project leads record strategic context that is automatically indexed alongside formal outputs.

### 6.2 Decision Memory
Decision Memory (`decision_memory`) captures the authoritative historical record of organizational governance.
- **Comprehensive Record Structure:** Beyond the decision statement itself, each record stores context and rationale, rejected alternatives considered, named approving authorities, financial impact assessments, and operational tags.
- **Lifecycle Tracking:** Decisions transition through distinct states (`draft`, `approved`, `superseded`, `reversed`), ensuring that when a policy or vendor choice changes, the historical decision is not erased but explicitly linked to the superseding choice.

### 6.3 Action Memory
Action Memory (`action_tracker`) maintains operational follow-through and delegation accountability.
- **The Five-Field Delegation Standard:** Based on Anthony Cortez's operational methodology, every action record must satisfy five mandatory parameters:
  1. *Task Description:* Unambiguous statement of the required deliverable.
  2. *Single Owner:* Exactly one named accountable person (eliminating shared ambiguity).
  3. *Due Date:* Hard completion deadline.
  4. *Definition of Done:* Explicit, verifiable objective criteria indicating completion.
  5. *Checkpoint Date:* Intermediate progress review milestone prior to the due date.
- **Velocity and Drift Metrics:** The system tracks completion velocity, overdue drift, and blockages across teams and departments, feeding directly into the Strategic Health Engine.

### 6.4 Meeting Memory
Meeting Memory captures the human dynamics, agenda evolution, and conversational cadence of organizational forums:
- **Longitudinal Dialogue Analysis:** Tracks recurring topics across weekly or monthly meeting series, flagging items that are discussed repeatedly without reaching decisions or concrete action assignments.
- **Speaker Attribution Tracking:** Analyzes participant contribution distribution, speaking balance, and engagement dynamics across sessions to compute Meeting Health Scores.

### 6.5 Organizational Memory
Organizational Memory represents the macro-level intelligence of the entire enterprise. It is embodied by the interconnected graph of `knowledge_nodes`, `knowledge_relationships`, and `lessons_learned`.
- **Institutional Precedent:** Provides new team members and leaders with instantaneous visibility into why past initiatives succeeded or failed, preventing the repetition of historical organizational errors.
- **Decoupled from Personnel Turnover:** By converting tacit conversational knowledge into structured graph relationships, institutional wisdom remains preserved even when key personnel depart the organization.

### 6.6 AI Memory
AI Memory encompasses the models, prompts, parameters, and ground-truth contexts that govern artificial intelligence inferences:
- **Deterministic Prompt Blueprints:** System prompts enforce strict corporate branding, Australian English terminology, tone standards, and anti-hallucination constraints.
- **Zero-Invention Parameters:** Temperature and nucleus sampling parameters are strictly tuned for high fidelity (temperature <= 0.2 for retrieval, extraction, and decision synthesis).

### 6.7 Agent Memory
Agent Memory (`agent_memory`) provides persistent stateful storage for autonomous background workers and intelligent workflows, as detailed in Section 7 below.

---

## SECTION 7: AGENT MEMORY MODEL

Concludo AI Agents (including Meeting Follow-Up, Decision Follow-Up, Action Accountability, Project Intelligence, Risk Monitoring, Report Generation, and Workflow Coordinator) operate using a structured five-tier memory model:

```
[ Short-Term Memory ]      Ephemeral Prompt Context (Model Token Window, 8k-128k tokens)
        │
        ▼
[ Working Memory ]         Active Workflow Execution State (workflow_executions.execution_state)
        │
        ▼
[ Session Memory ]         Interactive Turn Continuity (copilot_conversations & copilot_messages)
        │
        ▼
[ Long-Term Memory ]       Persistent Scoped Key-Value Store (public.agent_memory)
        │
        ▼
[ Organizational Memory ]  Knowledge Graph Nodes, Edges, and Verified Lessons Learned
```

### 7.1 Short-Term Memory
- **Nature:** Highly ephemeral, in-memory context window passed during a single model inference.
- **Lifecycle:** Exists only for the duration of the API call; garbage collected upon response completion.
- **Content:** The assembled system prompt, user query, retrieved ground-truth chunks, and formatted output schemas.

### 7.2 Working Memory
- **Nature:** Stateful multi-step execution memory for complex, long-running agent workflows.
- **Storage:** Persisted in PostgreSQL within `workflow_executions.execution_state` as JSONB.
- **Functionality:** Allows an agent to pause during execution (for example, awaiting human governance sign-off in `workflow_approvals`), retain intermediate computational results, and resume execution without repeating earlier steps.

### 7.3 Session Memory
- **Nature:** Conversational continuity during an interactive user session.
- **Storage:** Maintained across `copilot_conversations` and `copilot_messages`.
- **Functionality:** Enables users to ask progressive follow-up questions (*"Show the decisions made for Project Atlas"*, followed by *"Which of those remain unresolved?"*, followed by *"Who owns the supporting actions?"*) where each turn inherits the entity references of the preceding turns.

### 7.4 Long-Term Memory
- **Nature:** Persistent, indexed cognitive memory that outlives individual executions and sessions.
- **Storage:** The `public.agent_memory` table, configured with unique compound keys:
  ```sql
  CONSTRAINT uq_agent_memory UNIQUE (agent_id, scope_type, scope_id, memory_key)
  ```
- **Hierarchical Scopes:**
  1. *Personal Scope (`scope_type = 'personal'`):* Preferences, recurring search patterns, and individual working styles tied to a single user (`scope_id = user_id`).
  2. *Team Scope (`scope_type = 'team'`):* Team-specific acronyms, delivery cadences, and review standards tied to a collaborative team (`scope_id = team_id`).
  3. *Organization Scope (`scope_type = 'organization'`):* Enterprise-wide governance guidelines, fiscal year boundaries, and strategic imperatives tied to the organization (`scope_id = organization_id`).

### 7.5 Organizational Memory Integration
Agents interface directly with the Knowledge Graph to read and write organizational intelligence:
- **Graph Querying:** When evaluating delivery risk, the Risk Monitoring Agent queries `knowledge_relationships` to identify circular dependencies between project milestones.
- **Graph Inscription:** When the Project Intelligence Agent analyzes a project completion review, it automatically provisions a new `lessons_learned` record and links it to the parent project via a `resulted_in` relationship edge.

---

## SECTION 8: RETRIEVAL ARCHITECTURE

Concludo Workspace employs an advanced Retrieval-Augmented Generation (RAG) architecture engineered for deterministic factual grounding, zero artificial extrapolation, and transparent evidential explainability.

```
[ User Prompt / Agent Goal ]
            │
            ▼
   [ Query Understanding ] ──► (Intent Classification, Entity Extraction, Temporal Parsing)
            │
            ▼
   [ Multi-Index Retrieval ]
            ├──► Lexical tsvector Full-Text Search
            ├──► Dense Semantic Vector Search (pgvector)
            └──► Knowledge Graph Subgraph Expansion
            │
            ▼
   [ Candidate Assembly ] (Top 50 raw candidates)
            │
            ▼
   [ Cross-Encoder Re-Ranking ] ──► (Semantic Relevance, Recency Decay, Authority Weighting)
            │
            ▼
   [ Evidence Filtering ] (Confidence >= 70, Tenant Boundary Verification)
            │
            ▼
   [ Context Construction ] ──► (Token Budget Allocation, Prompt Schema Assembly)
            │
            ▼
   [ Grounded Generation ] ──► (Inference with strict Temperature <= 0.2)
            │
            ▼
   [ Attribution & Confidence Scoring ] ──► (Calculated Score, Cited Source Records)
```

### 8.1 RAG Framework and Retrieval Pipeline
1. **Query Parsing and Intent Decomposition:** The query is parsed to identify target entities (e.g., project names, people), temporal constraints (e.g., *"last quarter"*, *"between January and March"*), and query intent (decision inquiry, risk evaluation, action status).
2. **Multi-Index Retrieval:** Parallel queries execute across PostgreSQL full-text search indexes (`tsvector`), dense vector embeddings, and the relational `knowledge_nodes` table.
3. **Candidate Aggregation:** Raw retrieved candidates are normalized into a unified schema containing text content, source entity ID, entity type, creation timestamp, and lexical score.

### 8.2 Ranking Logic and Evidence Selection
Candidates are evaluated by a multi-factor re-ranking scoring function:
$$Score(candidate) = w_1 \cdot Sim_{semantic} + w_2 \cdot Rel_{lexical} + w_3 \cdot Decay(t) + w_4 \cdot Auth_{entity}$$

- **Semantic Similarity ($Sim_{semantic}$):** Cosine similarity between query embedding and chunk embedding ($w_1 = 0.40$).
- **Lexical Relevance ($Rel_{lexical}$):** Normalized BM25 / ts_rank score from PostgreSQL full-text search ($w_2 = 0.30$).
- **Recency Decay ($Decay(t)$):** Exponential decay function favouring recent operational data while preserving permanent decision records ($w_3 = 0.15$):
  $$Decay(t) = e^{-\lambda \cdot \Delta t}$$
- **Entity Authority ($Auth_{entity}$):** Weighting multiplier based on verified record status (e.g., approved decisions and verified lessons learned receive a higher authority weight than raw draft transcripts) ($w_4 = 0.15$).

### 8.3 Context Window Budgeting and Packaging
- **Token Budget Allocation:** Total available context is partitioned strictly: 15% System Persona and Governance Rules, 60% Ground-Truth Retrieved Chunks, 15% Dynamic Conversation History, 10% Output Schema Constraints.
- **Strict Chunk Isolation:** Retrieved excerpts are presented inside explicit boundary tags (e.g., `<evidence id="rec_123" type="decision">...<evidence>`), preventing prompt injection attacks originating from uploaded transcript files.

### 8.4 Source Attribution and Citation
Every generated output, briefing section, and Copilot response must include explicit source attribution metadata:
- **Attribution Fields:**
  - `projects_used`: Array of project UUIDs and titles.
  - `decisions_used`: Array of decision UUIDs, approval dates, and approvers.
  - `actions_used`: Array of action UUIDs, single owners, and due dates.
  - `reports_used`: Array of executive briefing UUIDs and titles.
  - `knowledge_relationships_used`: Array of graph relationship IDs and edge types.
- **Interactive UI Chips:** In the user interface, source citations render as clickable chips that navigate directly to the verified source record in Concludo Workspace.

### 8.5 Mathematical Confidence Scoring
Every synthesized answer and predictive forecast is assigned a mathematically calculated Confidence Score between 0 and 100:
$$Confidence = \min\left(100, \; 30 \cdot \min(1, \frac{N_{sources}}{3}) + 30 \cdot \overline{Sim}_{top3} + 20 \cdot G_{connected} + 20 \cdot V_{verified}\right)$$

Where:
- $N_{sources}$: Count of distinct ground-truth source records cited (max score 30 for 3+ sources).
- $\overline{Sim}_{top3}$: Average cosine/lexical similarity of the top 3 retrieved evidence chunks (max score 30).
- $G_{connected}$: Graph connectedness score (1.0 if cited sources are connected via direct knowledge relationships; 0.5 if unconnected) (max score 20).
- $V_{verified}$: Verification status (1.0 if sources are formal approved decisions or verified lessons; 0.5 for raw transcripts) (max score 20).

**Confidence Tiers:**
- *Very High (90 to 100):* Multiple verified records, direct graph edges, high similarity.
- *High (75 to 89):* Solid multi-source grounding with strong contextual relevance.
- *Moderate (60 to 74):* Single strong source or several indirect references; user review recommended.
- *Low (0 to 59):* Limited grounding; system displays prominent caveat and highlights data gaps.

---

## SECTION 9: PREDICTIVE INTELLIGENCE ARCHITECTURE

Concludo Workspace includes a sophisticated predictive intelligence architecture that moves beyond historical reporting into forward-looking operational forecasting, risk detection, and strategic decision guidance.

```
+====================================================================================================+
|                              PREDICTIVE INTELLIGENCE PIPELINE                                      |
+====================================================================================================+
| 5. STRATEGIC RECOMMENDATION ENGINE: Prioritised Guidance, Human Governance Review Gate             |
+----------------------------------------------------------------------------------------------------+
| 4. STRATEGIC HEALTH SCORING ENGINE: 8 Dimensions (0-100), Classification, Longitudinal Trends      |
+----------------------------------------------------------------------------------------------------+
| 3. RISK & OPPORTUNITY PREDICTIVE MODELS: Delivery Velocity, Action Drift, Bottleneck Detection     |
+----------------------------------------------------------------------------------------------------+
| 2. TIME-HORIZON PROJECTION ENGINE: 30-Day, 60-Day, and 90-Day Delivery Forecasts                   |
+----------------------------------------------------------------------------------------------------+
| 1. HISTORICAL GROUND TRUTH: Decisions, Actions, Transcripts, Knowledge Relationships, Lessons      |
+====================================================================================================+
```

### 9.1 Forecast Data Modeling
The `predictive_snapshots` table captures time-horizon forecast trajectories:
- **Forecast Horizons:** Standardized forward projections covering 30-day (operational tactical), 60-day (program milestone), and 90-day (strategic quarterly) horizons.
- **Velocity Metrics:** Computes rolling completion velocity ($V_{comp} = \frac{\Delta Actions_{completed}}{\Delta t}$) and compares it against outstanding action backlogs to predict milestone slippage dates.
- **Probabilistic Modeling:** Projections present best-case, expected, and worst-case outcomes rather than asserting false certainty, displaying explicit confidence bands.

### 9.2 Risk Prediction Models
Risk models continuously evaluate delivery drift across projects and teams:
1. **Action Drift Index ($ADI$):** Measures the divergence between committed completion dates and intermediate checkpoint milestones:
   $$ADI = \frac{\sum_{i=1}^{n} (t_{current} - t_{checkpoint, i}) \cdot \mathbb{I}(status_i \neq 'completed')}{N_{open}}$$
2. **Decision Backlog Pressure ($DBP$):** Quantifies open initiatives awaiting formal governance decisions, highlighting organizational paralysis:
   $$DBP = \frac{N_{pending\_decisions}}{N_{active\_projects}}$$
3. **Recurring Risk Pattern Recognition:** Matches emerging conversational risk statements against historical failure patterns recorded in `lessons_learned`, alerting leadership when known risk patterns reappear.

### 9.3 Opportunity Models
The opportunity engine identifies latent strategic advantages:
- **Capability Reuse Detection:** Surfaces when two independent project teams are solving identical technical or commercial problems, recommending cross-team consolidation.
- **Decision Velocity Acceleration:** Identifies approval workflows that consistently execute faster than average, extracting organizational best practices for wider deployment.

### 9.4 Health Models and Strategic Scoring Engine
The Strategic Health Engine synthesizes 8 operational categories into a single institutional performance score (0 to 100):

| Dimension | Description | Underlying Data Inputs | Weight |
| :--- | :--- | :--- | :--- |
| **Vision Execution** | Alignment of active tasks with strategic objectives | Project tags, executive briefing priorities | 15% |
| **Program Delivery** | Milestone delivery progress against deadlines | Action Tracker completion rates, due date drift | 15% |
| **Decision Velocity** | Speed and clarity of formal decision-making | Decision Memory dates, approval turnaround | 15% |
| **Operational Alignment** | Inter-team coordination and dependency management | Dependency graphs, blocked action counts | 15% |
| **Team Effectiveness** | Delegation balance and ownership clarity | Five-Field compliance, owner distribution | 10% |
| **Knowledge Utilisation** | Active reuse of institutional knowledge | Graph link density, lessons learned citations | 10% |
| **Risk Management** | Proactive identification and mitigation of threats | Risk flags, mitigation action coverage | 10% |
| **Organisational Learning**| Retention and application of retrospective findings | Verified lessons learned, repeat error rate | 10% |

**Health Classifications:**
- *Exceptional (90 to 100):* Outstanding cross-functional alignment and execution velocity.
- *Strong (80 to 89):* Healthy delivery rhythms with isolated minor bottlenecks.
- *Stable (70 to 79):* Consistent operational output; key delivery dates require monitoring.
- *Watch Required (60 to 69):* Noticeable action drift or decision backlog; leadership attention needed.
- *At Risk (40 to 59):* Multiple program delays, unresolved blocks, and compounding delivery risks.
- *Critical Attention Required (0 to 39):* Severe operational paralysis requiring immediate intervention.

### 9.5 Strategic Recommendation Engine
Recommendations are generated as prioritized, evidence-backed advisory cards:
- **Categorisation:** Structured into *Immediate Priorities*, *Strategic Priorities*, *Emerging Concerns*, *Quick Wins*, and *Long-Term Opportunities*.
- **Mandatory Human Approval:** In accordance with Concludo governance principles, recommendations are advisory only. Agents and automated pipelines cannot autonomously enact recommendations without explicit human review in the Approval Centre (`/approvals`).

---

## SECTION 10: COPILOT INTELLIGENCE ARCHITECTURE

Concludo Copilot serves as the primary natural language interaction layer for the entire platform. It allows users to query, analyze, and synthesize organizational knowledge using conversational dialogue grounded strictly in verified data.

```
[ User Dialogue Input ] ──► (e.g. "What decisions were made about Project Atlas?")
           │
           ▼
[ Intent & Entity Classification ] ──► Intent: decision_retrieval | Target: "Project Atlas"
           │
           ▼
[ Session Context Resolution ] ──► (Inherit prior turn context, resolved entity IDs)
           │
           ▼
[ Grounded Knowledge Retrieval ] ──► (Query projects, decision_memory, action_tracker)
           │
           ▼
[ Knowledge Graph Subgraph Expansion ] ──► (Traverse 1-hop relationships: resulted_in, blocks)
           │
           ▼
[ Factual Grounding Verification ] ──► (Assert zero extrapolation, verify tenant boundaries)
           │
           ▼
[ Structured Copilot Response Generation ]
           ├── Grounded Executive Markdown Answer
           ├── Supporting Evidence Chunks
           ├── Source Attribution Chips (Projects, Decisions, Actions)
           ├── Mathematical Confidence Tier (Low, Moderate, High, Very High)
           ├── Reasoning Chain Explanation ("Why this answer?")
           └── Suggested Follow-Up Explorations
```

### 10.1 Query Interpretation and Intent Classification
The Copilot Engine classifies incoming user utterances into 10 deterministic intent categories:
1. `decision_retrieval`: Inquiries into what decisions were made, why, who approved them, and alternative choices considered.
2. `project_retrieval`: Summaries of project progress, scope boundaries, and active status.
3. `action_retrieval`: Queries regarding open actions, overdue deadlines, ownership distribution, and blocked milestones.
4. `timeline_query`: Chronological cross-entity questions (*"What major decisions occurred between January and March?"*).
5. `risk_analysis`: Detection of high-risk projects, recurring blockers, and delivery impediments.
6. `forecast_query`: Forward-looking projections regarding project completion dates and velocity.
7. `recommendation_query`: Requests for advisory guidance on resolving bottlenecks or improving delivery.
8. `knowledge_discovery`: Historical lookups of past lessons learned and similar project precedents.
9. `executive_query`: Broad strategic health summaries and leadership focus areas.
10. `action_execution_request`: User requests to generate reports, stage workflows, or prepare briefings (enforcing human governance gates).

### 10.2 Memory Retrieval and Multi-Turn Continuity
- **Conversation State Resolution:** When a user asks a follow-up question (*"Which of those remain unresolved?"*), the engine queries `copilot_messages` to resolve pronoun and demonstrative references against the entities retrieved in the preceding turn.
- **Session Scoping:** Conversations are isolated by `session_id`, `user_id`, and `organization_id`, ensuring strict tenant isolation across dialogue sessions.

### 10.3 Dynamic Context Assembly
The context assembly engine constructs prompts dynamically:
```
System Instructions:
- Role: Concludo Enterprise Decision Assistant
- Brand Standards: Australian English, Professional, Direct, Zero Em Dashes
- Non-Invention Rule: Rely strictly on provided evidence. If unrecorded, state explicitly.

Retrieved Ground-Truth Evidence:
[EVIDENCE_1 (Decision)] Title: Acuity Cloud Migration | Date: 2026-08-15 | Status: Approved
[EVIDENCE_2 (Action)] Task: Provision VPC peering | Owner: Anthony Cortez | Due: 2026-09-30

Conversation History:
User: "What decisions were made regarding infrastructure?"
Assistant: [Prior grounded response]

Current User Query:
"Who owns the follow-up actions resulting from that decision?"
```

### 10.4 Knowledge Graph Usage and Structural Context
Copilot leverages graph connectivity to enrich answers:
- **Relational Context:** When a decision is identified, Copilot retrieves all nodes linked via `resulted_in` (actions) and `mitigates` (risks), presenting a complete holistic picture of decision impact without requiring separate manual queries.

### 10.5 Structured Response Schema
Copilot outputs a unified structured JSON payload matching the `CopilotResponse` TypeScript interface:
- `answer` (string): The natural language markdown response.
- `supportingEvidence` (array): Exact quotes and factual excerpts retrieved from source records.
- `sourceRecords` (object): Granular citation lists (`projects`, `decisions`, `actions`, `reports`, `relationships`).
- `confidenceLevel` (enum): `'low' | 'moderate' | 'high' | 'very_high'`.
- `confidenceScore` (number): Mathematical score from 0 to 100.
- `reasoningPath` (array): Step-by-step audit trail explaining how the answer was derived.
- `relatedKnowledgeGraph` (array): Graph edges linking cited entities.
- `suggestedFollowUps` (array): Three contextually relevant next questions.

### 10.6 Hallucination Prevention and Grounding Controls
To prevent artificial fabrication and hallucination, Concludo implements six structural safeguards:
1. **The Grounding Rule:** Every factual assertion must be directly substantiated by at least one retrieved database record. Extrapolation is programmatically forbidden.
2. **Stated Omission Standard:** When asked about topics, projects, or decisions not present in the customer's dataset, Copilot must explicitly state that no verified records exist rather than attempting to guess or infer plausible answers.
3. **Strict Temperature Clamping:** Inferences for factual retrieval use a model temperature of 0.1 to 0.2, drastically reducing probabilistic divergence.
4. **Post-Generation Source Verification:** An internal validator verifies that entity IDs mentioned in the generated response exist in the retrieved evidence candidate set before streaming to the client.
5. **No Speculative Advice:** Copilot provides advisory recommendations only when grounded in historical lessons learned or explicit forecast metrics.
6. **Immutable Audit Logging:** Every user query and generated response is recorded in `audit_logs` with actor ID, timestamp, and citation metadata for compliance auditability.

---

## SECTION 11: PERFORMANCE ARCHITECTURE

The performance architecture of Concludo Workspace is engineered to maintain low-latency responsiveness (p95 latency < 150ms for relational queries, < 350ms for hybrid search, and < 1500ms for Copilot synthesis) as enterprise organizations scale to millions of conversational records and graph connections.

```
+====================================================================================================+
|                                 PERFORMANCE ACCELERATION STACK                                     |
+====================================================================================================+
| 5. EDGE & IN-MEMORY CACHING: SWR Client Caching, Session State, Computed Health Score Memoization   |
+----------------------------------------------------------------------------------------------------+
| 4. GRAPH QUERY OPTIMISATION: Indexed Edge Tables, Depth-Limited Traversal, Materialised Views     |
+----------------------------------------------------------------------------------------------------+
| 3. VECTOR ACCELERATION: pgvector HNSW Graph Indexing, m=16, efConstruction=64, Cosine Distance    |
+----------------------------------------------------------------------------------------------------+
| 2. ADVANCED INDEXING: Partial Indexes (WHERE deleted_at IS NULL), Compound Tenant Keys, GIN Indexes|
+----------------------------------------------------------------------------------------------------+
| 1. DATABASE PARTITIONING: Declarative Range & List Partitioning by organization_id & created_at   |
+====================================================================================================+
```

### 11.1 Table Partitioning Strategy
For high-volume append-heavy tables (`audit_logs`, `transcripts`, `webhook_logs`, `copilot_messages`), Concludo implements declarative PostgreSQL partitioning:
1. **Range Partitioning by Timestamp:** `audit_logs` are partitioned by monthly creation ranges:
   ```sql
   CREATE TABLE public.audit_logs_partitioned (
       id UUID NOT NULL DEFAULT gen_random_uuid(),
       organization_id UUID,
       actor_id UUID,
       action TEXT NOT NULL,
       entity_type TEXT NOT NULL,
       entity_id TEXT NOT NULL,
       details JSONB NOT NULL DEFAULT '{}'::jsonb,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       PRIMARY KEY (id, created_at)
   ) PARTITION BY RANGE (created_at);

   -- Example partition for September 2026
   CREATE TABLE public.audit_logs_y2026m09 PARTITION OF public.audit_logs_partitioned
       FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
   ```
2. **List Partitioning by Tenant:** For enterprise tenants with tens of thousands of active users, data tables support dedicated partition boundaries, completely isolating physical disk pages between large corporate accounts.

### 11.2 Index Maintenance and Optimization
- **Zero Unindexed Foreign Keys:** An automated continuous integration check asserts that every foreign key relationship in the database is covered by a corresponding B-tree index, preventing catastrophic table-level locks during cascade operations.
- **Partial Indexing on Active Records:** Because 99% of user interactions touch active records, indexes on operational tables explicitly exclude soft-deleted rows (`WHERE deleted_at IS NULL`), cutting index size by up to 40% and keeping index pages in PostgreSQL buffer cache memory.
- **Automated Vacuum and Bloat Mitigation:** PostgreSQL `autovacuum` parameters are aggressively tuned on high-churn tables (`copilot_messages`, `team_activities`), preventing index bloat and dead-tuple accumulation:
  ```sql
  ALTER TABLE public.copilot_messages SET (
      autovacuum_vacuum_scale_factor = 0.05,
      autovacuum_analyze_scale_factor = 0.02
  );
  ```

### 11.3 Multi-Tier Caching Architecture
1. **HTTP and CDN Edge Caching:** Static assets, immutable export packages, and public schemas are cached at Australian Cloudflare edge points with strict `Cache-Control` directives.
2. **Client-Side SWR (Stale-While-Revalidate):** The React frontend utilizes SWR caching for project lists, team memberships, and profile metadata, eliminating duplicate network fetches on route transitions.
3. **Engine-Level Memoization:** Pure computational engines (`strategicHealthEngine`, `riskNetworkEngine`) memoize intermediate graph calculations during a request cycle, avoiding redundant recalculations of health scores.

### 11.4 Vector Storage Acceleration (pgvector)
- **HNSW Indexing Configuration:** Dense embeddings utilise Hierarchical Navigable Small World (HNSW) indexes configured with `m = 16` (bi-directional links per node) and `ef_construction = 64` (construction exploration depth), striking the optimal balance between indexing build speed and nearest-neighbour recall accuracy (> 98%).
- **Dimension Normalization:** Embeddings are L2-normalized upon ingestion, allowing nearest-neighbour queries to utilise inner product operators (`<#>`) which execute up to 30% faster than standard cosine distance calculations.

### 11.5 Graph Optimization and Query Acceleration
- **Depth-Constrained Traversal:** All recursive graph traversal CTEs enforce hard depth limits (`dc.depth < 5`), preventing recursive infinite loops in cyclic relationship graphs.
- **Bidirectional Compound Indexes:** The `knowledge_relationships` table features mirrored compound indexes to accelerate both forward and backward edge traversals:
  ```sql
  CREATE INDEX idx_kr_forward ON public.knowledge_relationships(source_node_id, relationship_type, target_node_id);
  CREATE INDEX idx_kr_backward ON public.knowledge_relationships(target_node_id, relationship_type, source_node_id);
  ```

### 11.6 Large Dataset Strategy and Keyset Pagination
- **Transactional Streaming Ingest:** Massive audio transcriptions (100,000+ words) are processed in 500-word segments through asynchronous database workers, avoiding long-running transaction timeouts.
- **Cursor-Based Pagination:** All list endpoints across the REST API and Supabase client use deterministic keyset pagination (`WHERE id > $last_seen_id ORDER BY id ASC LIMIT 50`) rather than offset pagination, guaranteeing consistent sub-10ms query execution regardless of dataset depth.

---

## SECTION 12: GOVERNANCE, COMPLIANCE AND DATA PROTECTION ARCHITECTURE

Enterprise credibility requires an uncompromising governance architecture where data access, modification, retention, and deletion are auditable, verifiable, and strictly controlled.

```
+====================================================================================================+
|                                  GOVERNANCE CONTROL FRAMEWORK                                      |
+====================================================================================================+
| 6. COMPLIANCE ASSURANCE: ISO 27001, SOC 2 Type II, Australian Privacy Principles (APPs) Audit      |
+----------------------------------------------------------------------------------------------------+
| 5. LEGAL HOLD PROTECTION: Statutory Purge Suspension, Override of Automated Retention Jobs         |
+----------------------------------------------------------------------------------------------------+
| 4. RETENTION AUTOMATION: Automated 30-Day Recovery Window, Configurable Lifespan per Data Class    |
+----------------------------------------------------------------------------------------------------+
| 3. IMMUTABLE AUDIT LOGGING: Append-Only Ledger, Actor ID, IP Address, JSONB Mutation Context       |
+----------------------------------------------------------------------------------------------------+
| 2. CRYPTOGRAPHIC DATA PROTECTION: TLS 1.3 in Transit, AES-256 at Rest, SHA-256 API Key Hashing    |
+----------------------------------------------------------------------------------------------------+
| 1. AUTHORITATIVE RLS KERNEL: Database-Enforced Tenant Boundaries, auth.uid() Security Source       |
+====================================================================================================+
```

### 12.1 Tamper-Evident Audit Logging
Every security-relevant operation within Concludo Workspace emits an immutable record to `public.audit_logs`:
- **Captured Operations:** User authentication, role alterations, project creations, soft deletions, permanent purges, legal hold impositions, permission overrides, Copilot queries, scenario simulations, and export generation.
- **Context Metadata:** Captures `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, client IP address, User-Agent header, and a full `details` JSONB snapshot of the state change.
- **Append-Only Immutability:** Row-level security strictly prohibits `UPDATE`, `DELETE`, and `TRUNCATE` operations on `audit_logs` for all application users.

### 12.2 Statutory Legal Holds
The `legal_holds` system provides an authoritative legal freeze mechanism for enterprise litigations and regulatory investigations:
- **Scope Targeting:** Legal holds can be targeted at an entire organization, a specific team, an individual user, or an isolated project.
- **Purge Blockade:** When an entity is covered by an active legal hold (`status = 'active'`), all permanent deletion routines (`permanent_delete_project`, `permanent_delete_decision`, `purge_expired_records`) are hard-blocked by database-level RPC checks:
  ```sql
  -- Database check inside permanent deletion RPC
  IF EXISTS (
      SELECT 1 FROM public.legal_holds lh
      WHERE lh.organization_id = target_org_id
      AND lh.status = 'active'
      AND (
          lh.target_type = 'organization'
          OR (lh.target_type = 'project' AND lh.target_id = target_project_id::text)
          OR (lh.target_type = 'user' AND lh.target_id = target_user_id::text)
      )
  ) THEN
      RAISE EXCEPTION 'Permanent deletion blocked: entity is subject to an active legal hold';
  END IF;
  ```
- **Auditable Release Lifecycle:** Releasing a legal hold requires administrative authentication and records `released_by`, `released_at`, and mandatory justification notes.

### 12.3 Automated Retention and Recovery Pipeline
Data retention follows a strict, predictable two-stage pipeline:
1. **Stage 1 (Soft Deletion):** Records marked for deletion set `deleted_at = now()`, `deleted_by = auth.uid()`, and `purge_after = now() + interval '30 days'`. During this 30-day window, records are excluded from standard views but can be completely restored via restoration RPCs.
2. **Stage 2 (Automated Nightly Purge):** An automated background worker executes the `purge_expired_records()` stored procedure every 24 hours. The worker deletes only records where `deleted_at IS NOT NULL`, `purge_after < now()`, and no active legal holds apply.

### 12.4 Regulatory Compliance Mapping
Concludo Workspace is designed to comply with Australian and international data privacy and security standards:

| Standard / Regulation | Compliance Mechanism | Verification Evidence |
| :--- | :--- | :--- |
| **Australian Privacy Principles (APPs)** | Data stored within Australian borders (Sydney AWS); strict purpose limitation | Supabase Sydney Region (`ap-southeast-2`), Privacy Policy |
| **Privacy Act 1988 (Cth)** | Customer data sovereignty; explicit export rights; data breach notification | Automated audit trail, customer data export tools |
| **SOC 2 Type II** | Continuous logging, RLS tenant isolation, encrypted secrets, access recertification | `audit_logs`, `access_reviews`, automated CI/CD security tests |
| **ISO/IEC 27001** | Cryptographic data protection, role-based access control, least privilege model | AES-256 storage, TLS 1.3 encryption, database RLS |
| **GDPR (Articles 15, 17, 20)** | Right of access, right to erasure (via soft-delete/purge), right to data portability | 30-day recovery quarantine, permanent purge RPCs, JSON/CSV export |

### 12.5 Enterprise Controls and Identity Federation
- **SAML 2.0 and OIDC Single Sign-On:** Allows enterprise identity federation via Okta, Microsoft Entra ID (Azure AD), Google Workspace, and Ping Identity.
- **Domain Auto-Verification:** Automated DNS TXT token verification (`organization_domains`) binds corporate email domains to the enterprise tenant, preventing unmanaged account creation.
- **Session Timeout and Revocation:** Enterprise administrators can enforce mandatory session idle timeouts and immediately revoke all active JWT sessions for suspended users.

### 12.6 Cryptographic Data Protection
- **Encryption at Rest:** All PostgreSQL database tables, disk volumes, automated backups, and object storage buckets are encrypted using industry-standard AES-256 encryption managed by Supabase and AWS KMS.
- **Encryption in Transit:** All network traffic between client browsers, application servers, Supabase APIs, and external webhooks requires TLS 1.3 with strong cipher suites. Unencrypted HTTP traffic is rejected.
- **Cryptographic Key Hashing:** API keys are never stored in plaintext. Keys are hashed using SHA-256 with a unique salt prior to database storage (`api_keys.key_hash`). Only the key prefix (`key_prefix`) is visible in the user interface.
- **Webhook HMAC Signatures:** Outbound webhook payloads include a cryptographic SHA-256 HMAC signature in the `X-Concludo-Signature` header, allowing external recipient systems to verify payload authenticity.

---

## APPENDIX A: SCHEMA MIGRATION SCRIPT TEMPLATE

To ensure all future database alterations preserve Concludo's RLS, retention, and audit standards, every migration script must adhere to this boilerplate structure:

```sql
-- Migration: {YYYYMMDDHHMMSS}_{descriptive_name}.sql
-- Author: Anthony Cortez / Concludo Engineering
-- Entity: Concludo Pty Ltd (ACN: 701 605 898)

BEGIN;

-- 1. Create table with retention metadata
CREATE TABLE IF NOT EXISTS public.example_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

-- 2. Enable Row-Level Security
ALTER TABLE public.example_entities ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Users can view active entities within their organization"
ON public.example_entities
FOR SELECT
TO authenticated
USING (
    deleted_at IS NULL
    AND organization_id IN (
        SELECT om.organization_id 
        FROM public.organization_members om 
        WHERE om.user_id = auth.uid()
    )
);

-- 4. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_example_org_active 
ON public.example_entities(organization_id) 
WHERE deleted_at IS NULL;

-- 5. Record Migration in Audit Log
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES ('schema_migration', 'database', 'example_entities', '{"migration": "applied"}'::jsonb);

COMMIT;
```

---

## APPENDIX B: CONCLUDO COGNITIVE VOCABULARY REFERENCE

For precision across all engineering teams, documentation, and agent prompts, the following definitions are normative:

- **Conversational Substrate:** The raw, unstructured stream of dialogue captured from meeting sessions.
- **Knowledge Node:** A discrete, typed, addressable entity within the organizational graph representing a project, decision, action, insight, risk, or milestone.
- **Knowledge Edge (Relationship):** A directed, typed semantic connection between two knowledge nodes carrying a calculated confidence score.
- **Decision Memory:** The immutable institutional record of formal choices made, including context, rejected alternatives, and approvals.
- **Five-Field Delegation Standard:** The mandatory operational schema requiring Task Description, Single Owner, Due Date, Definition of Done, and Checkpoint Date for every action.
- **Reciprocal Rank Fusion (RRF):** The algorithmic technique combining sparse lexical and dense semantic vector search scores into a single unified relevance ranking.
- **Grounded Answer:** An AI-generated response where every factual statement maps directly to one or more retrieved database records with zero extrapolation.
- **Strategic Health Score:** A composite metric (0 to 100) reflecting an organization's holistic performance across 8 operational categories.
- **Digital Twin:** A continuously updated mathematical model reflecting the real-time operational health, dependencies, and risks of an enterprise organization.
- **Legal Hold:** A statutory freeze directive that suspends automated retention purges and blocks permanent deletion of targeted records.

---

**END OF MASTER ARCHITECTURE DOCUMENT**  
*Concludo Pty Ltd | Melbourne, Victoria, Australia*
