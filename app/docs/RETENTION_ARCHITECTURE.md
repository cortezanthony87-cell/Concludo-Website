# Concludo Workspace: Data Retention Architecture Specification
**Tasklet 11E — Automatic Purge and Settings Integration**
*Document Version: 1.1.0 | Date: 12 September 2026*

---

## 1. Overview & Objectives

Concludo Workspace requires an enterprise-grade, recoverable data lifecycle model across all meeting intelligence records. Data must remain safe from accidental deletion while honouring compliance, privacy, and storage hygiene requirements.

This architecture establishes a uniform 3-tier retention foundation for:
1. **Projects** (`public.projects`) — *Active & implemented*
2. **Outputs** (`public.outputs`) — *Active & implemented*
3. **Transcripts** (`public.transcripts`) — *Active & implemented with cascading retention*
4. **Decision Memory** (`public.decisions` / `public.decision_memory`) — *Future architecture specification*
5. **Action Tracker** (`public.actions` / `public.action_tracker`) — *Future architecture specification*

---

## 2. Retention Lifecycle Model

```
 ┌──────────────────────┐
 │    Active Record     │
 │  deleted_at = NULL   │ ──(User initiates delete)──┐
 │  purge_after = NULL  │                            │
 └──────────────────────┘                            ▼
            ▲                             ┌──────────────────────────────┐
            │                             │     Soft-Deleted Record      │
     (30-day restore)                     │      deleted_at = now()      │
            │                             │    deleted_by = auth.uid()   │
            └─────────────────────────────│ purge_after = now() + 30 days│
                                          └──────────────────────────────┘
                                                         │
                                               (30-day window expires)
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │      Eligible for Purge      │
                                          │   Permanent hard deletion    │
                                          │     now() >= purge_after     │
                                          │     Automatic daily purge    │
                                          └──────────────────────────────┘
```

### Tier 1: Active Records (Indefinite Retention)
- **Status:** Standard operational state.
- **Fields:** `deleted_at = NULL`, `deleted_by = NULL`, `purge_after = NULL`.
- **Visibility:** Visible in normal workspace queries, project listings, detail pages, and dashboards.
- **Query Standard:** All application read queries enforce `.is('deleted_at', null)`.

### Tier 2: Soft-Deleted Records (30-Day Recovery Window)
- **Status:** Record has been deleted by a user or administrator.
- **Fields:**
  - `deleted_at`: Timestamp of deletion (`timestamptz`, default `now()`).
  - `deleted_by`: UUID of the authenticated user who initiated the deletion (`uuid REFERENCES auth.users(id)`).
  - `purge_after`: Exact deadline after which the record becomes eligible for permanent destruction (`timestamptz`, set to `deleted_at + interval '30 days'`).
- **Visibility:** Excluded from standard application queries. Preserved in database storage. Accessible exclusively via Recently Deleted (`/settings/deleted`).
- **Security & Privacy:**
  - `deleted_by` is an internal audit field only and is **never exposed in the user interface**.
  - Row-Level Security (RLS) remains active: users cannot view or manipulate soft-deleted records belonging to other users.
- **Recovery:** Within 30 days, records can be restored by calling `restore_project` or `restore_output`, which atomically clears `deleted_at`, `deleted_by`, and `purge_after`.

### Tier 3: Permanent Deletion (Purge After 30 Days)
- **Status:** Grace period expired.
- **Condition:** `deleted_at IS NOT NULL AND purge_after < now()`.
- **Execution:** Automated daily background purge worker (`purge_expired_records`) performs true database deletion (`DELETE`).

---

## 3. Database Schema Implementation

### 3.1 `projects` Table
```sql
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS purge_after timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_by ON public.projects(deleted_by);
CREATE INDEX IF NOT EXISTS idx_projects_purge_after ON public.projects(purge_after);
```

### 3.2 `outputs` Table
```sql
ALTER TABLE public.outputs
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS purge_after timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_outputs_deleted_at ON public.outputs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_outputs_deleted_by ON public.outputs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_outputs_purge_after ON public.outputs(purge_after);
```

### 3.3 Database Triggers & Automated Lifecycle Management
Each table is equipped with a `BEFORE UPDATE` trigger function (`handle_project_update`, `handle_output_update`):
- When `NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL`:
  - Automatically sets `NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid(), NEW.user_id);`
  - Automatically calculates `NEW.purge_after := COALESCE(NEW.purge_after, NEW.deleted_at + interval '30 days');`
  - Cascades soft-delete to project outputs and transcripts.
- When `NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL` (restoration):
  - Clears `NEW.deleted_by := NULL;`
  - Clears `NEW.purge_after := NULL;`
  - Cascades restore to project outputs and transcripts.
- Enforces immutability on `user_id`, `created_at`, and parent relationships for authenticated users.

---

## 4. Automated Retention Enforcement (Backend Purge Process)

### 4.1 Purge Criteria
Records are automatically eligible for permanent hard deletion when:
$$\text{deleted\_at IS NOT NULL} \quad \text{AND} \quad \text{purge\_after} < \text{now()}$$

### 4.2 System-Wide Purge Function (`purge_expired_records`)
```sql
CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purged_outputs_count int := 0;
    v_purged_projects_count int := 0;
    v_now timestamptz := now();
BEGIN
    -- 1. Purge expired standalone outputs
    WITH deleted_outputs AS (
        DELETE FROM public.outputs
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_outputs_count FROM deleted_outputs;

    -- 2. Purge transcripts of expired projects
    DELETE FROM public.transcripts
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 3. Purge outputs of expired projects
    DELETE FROM public.outputs
    WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
    );

    -- 4. Purge expired projects
    WITH deleted_projects AS (
        DELETE FROM public.projects
        WHERE deleted_at IS NOT NULL
          AND purge_after < v_now
        RETURNING id
    )
    SELECT count(*) INTO v_purged_projects_count FROM deleted_projects;

    RETURN jsonb_build_object(
        'success', true,
        'executed_at', v_now,
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count
    );
END;
$$;
```

### 4.3 Execution & Scheduling Architecture
1. **Frequency:** Daily (e.g. 03:00 UTC / 13:00 AEST).
2. **PostgreSQL Security Boundary:**
   - `EXECUTE` on `purge_expired_records` is granted strictly to `service_role`.
   - Revoked from `anon` and `authenticated`.
3. **Backend Worker / Endpoint:**
   - Backend API endpoint `POST /api/retention/purge` runs in `src/server/apiRouter.ts`.
   - Secured via cron authorization token (`x-cron-secret`) or service role authentication.
   - Script runner available at `scripts/retention-purge-worker.ts`.

---

## 5. Future Tables Architecture Specification

The upcoming intelligence modules will adopt this exact retention pattern upon creation. **Do not create these tables prior to their respective tasklets.**

### 5.1 Decision Memory Table Specification (`decisions`)
```sql
-- Architectural Specification for Future Decision Memory
CREATE TABLE public.decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    decision_text text NOT NULL,
    context text,
    stakeholders text[],
    decision_date date DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Retention Foundation Fields
    deleted_at timestamptz DEFAULT NULL,
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL,
    purge_after timestamptz DEFAULT NULL
);

CREATE INDEX idx_decisions_user_id ON public.decisions(user_id);
CREATE INDEX idx_decisions_project_id ON public.decisions(project_id);
CREATE INDEX idx_decisions_deleted_at ON public.decisions(deleted_at);
CREATE INDEX idx_decisions_purge_after ON public.decisions(purge_after);
```

### 5.2 Action Tracker Table Specification (`actions`)
```sql
-- Architectural Specification for Future Action Tracker
CREATE TABLE public.actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_text text NOT NULL,
    owner_name text,
    due_date date,
    status text DEFAULT 'pending' NOT NULL,
    priority text DEFAULT 'medium',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Retention Foundation Fields
    deleted_at timestamptz DEFAULT NULL,
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL,
    purge_after timestamptz DEFAULT NULL
);

CREATE INDEX idx_actions_user_id ON public.actions(user_id);
CREATE INDEX idx_actions_project_id ON public.actions(project_id);
CREATE INDEX idx_actions_deleted_at ON public.actions(deleted_at);
CREATE INDEX idx_actions_purge_after ON public.actions(purge_after);
```

---

## 6. Security & Row-Level Security (RLS) Rules

1. **User Isolation:** All RLS policies filter by `user_id = auth.uid()`. A user cannot read, update, or soft-delete another user's records.
2. **Audit Shielding:** The `deleted_by` column is strictly an audit artifact. It must never be projected in public UI components, API response payloads, or client views.
3. **Cascade Integrity:** Soft-deleting a project flags the project record; child records remain intact with their associations. If a permanent purge occurs at the project level, PostgreSQL foreign keys (`ON DELETE CASCADE`) remove child records cleanly.

---

## 7. Future Team Retention Support Architecture

### 7.1 Architecture Design
When the Team Workspace tier ships, organizations will require configurable data retention windows to comply with corporate governance policies (e.g. 14 days, 30 days, 60 days, 90 days, or 365 days).

The architecture is designed to support:
1. `retention_policy_days`: Number of days soft-deleted records remain recoverable before permanent purge.
2. `team_retention_override`: Boolean flag determining whether the organization policy overrides individual user preferences.

### 7.2 Schema Specification (Future Implementation)
```sql
-- Architectural Specification for Future Organization/Team Retention Settings
-- (To be applied when Team Workspace is built in upcoming tasklets)

ALTER TABLE public.organizations -- or public.teams
    ADD COLUMN IF NOT EXISTS retention_policy_days integer DEFAULT 30 CHECK (retention_policy_days >= 1),
    ADD COLUMN IF NOT EXISTS team_retention_override boolean DEFAULT false;

-- Trigger logic expansion for Team Retention:
-- In handle_project_update() and handle_output_update():
-- IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
--     SELECT retention_policy_days INTO v_team_days
--     FROM public.organizations
--     WHERE id = NEW.team_id AND team_retention_override = true;
--     
--     NEW.purge_after := NEW.deleted_at + make_interval(days => COALESCE(v_team_days, 30));
-- END IF;
```

### 7.3 TypeScript Interface
```ts
export interface TeamRetentionSettings {
  team_id: string;
  retention_policy_days: number; // e.g. 14, 30, 60, 90, 365
  team_retention_override: boolean;
  enforce_immutable_audit?: boolean;
}
```

*All active projects, outputs, and user data remain retained indefinitely until explicitly soft-deleted.*
