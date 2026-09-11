# Concludo Workspace: Data Retention Architecture Specification
**Tasklet 11A — Database and Retention Foundation**
*Document Version: 1.0.0 | Date: 12 September 2026*

---

## 1. Overview & Objectives

Concludo Workspace requires an enterprise-grade, recoverable data lifecycle model across all meeting intelligence records. Data must remain safe from accidental deletion while honouring compliance, privacy, and storage hygiene requirements.

This architecture establishes a uniform 3-tier retention foundation for:
1. **Projects** (`public.projects`) — *Active & implemented*
2. **Outputs** (`public.outputs`) — *Active & implemented*
3. **Decision Memory** (`public.decisions` / `public.decision_memory`) — *Future architecture specification*
4. **Action Tracker** (`public.actions` / `public.action_tracker`) — *Future architecture specification*

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
- **Visibility:** Excluded from standard application queries. Preserved in database storage.
- **Security & Privacy:**
  - `deleted_by` is an internal audit field only and is **never exposed in the user interface**.
  - Row-Level Security (RLS) remains active: users cannot view or manipulate soft-deleted records belonging to other users.
- **Recovery:** Within 30 days, records can be restored by setting `deleted_at = NULL`, which automatically clears `deleted_by` and `purge_after`.

### Tier 3: Permanent Deletion (Purge After 30 Days)
- **Status:** Grace period expired.
- **Condition:** `deleted_at IS NOT NULL AND purge_after <= now()`.
- **Execution:** Automated scheduled maintenance (e.g. pg_cron or serverless retention worker) performs hard removal (`DELETE`).

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
- When `NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL` (restoration):
  - Clears `NEW.deleted_by := NULL;`
  - Clears `NEW.purge_after := NULL;`
- Enforces immutability on `user_id`, `created_at`, and parent relationships for authenticated users.

---

## 4. Future Tables Architecture Specification

The upcoming intelligence modules will adopt this exact retention pattern upon creation. **Do not create these tables prior to their respective tasklets.**

### 4.1 Decision Memory Table Specification (`decisions`)
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

### 4.2 Action Tracker Table Specification (`actions`)
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

## 5. Security & Row-Level Security (RLS) Rules

1. **User Isolation:** All RLS policies filter by `user_id = auth.uid()`. A user cannot read, update, or soft-delete another user's records.
2. **Audit Shielding:** The `deleted_by` column is strictly an audit artifact. It must never be projected in public UI components, API response payloads, or client views.
3. **Cascade Integrity:** Soft-deleting a project flags the project record; child records remain intact with their associations. If a permanent purge occurs at the project level, PostgreSQL foreign keys (`ON DELETE CASCADE`) remove child records cleanly.

---

## 6. Retention Maintenance Specification (Purge Worker)

When scheduled automation is enabled in future tasklets, an administrative worker will execute the following purge routine daily:

```sql
-- Scheduled Purge Routine (Service Role Only)
DELETE FROM public.outputs
WHERE deleted_at IS NOT NULL
  AND purge_after <= now();

DELETE FROM public.projects
WHERE deleted_at IS NOT NULL
  AND purge_after <= now();
```

*All active projects, outputs, and user data remain retained indefinitely until explicitly soft-deleted.*
