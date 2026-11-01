import { createHash } from 'crypto';

export interface ActionCandidateInput {
  workspace_id?: string | null;
  user_id: string;
  proposed_owner_id?: string | null;
  proposed_owner_label?: string | null;
  title: string;
  proposed_priority?: 'high' | 'medium' | 'low' | null;
  proposed_due?: string | null;
  due_basis?: 'stated' | 'inferred' | 'none';
  owner_basis?: 'stated' | 'inferred' | 'unresolved';
  source_type?: string | null;
  source_id?: string | null;
  source_revision?: string | null;
  source_excerpt?: string | null;
  project_id?: string | null;
}

export function normaliseCandidateTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ');   // collapse whitespace
}

/**
 * Computes deterministic fingerprint:
 * sha256(workspace_id | source_type | source_id | normalised_title | resolved_owner_or_label)
 */
export function computeCandidateFingerprint(input: ActionCandidateInput): string {
  const parts = [
    input.workspace_id || '',
    input.source_type || '',
    input.source_id || '',
    normaliseCandidateTitle(input.title),
    input.proposed_owner_id || input.proposed_owner_label || '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
