import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pure synchronous SHA-256 implementation without Node or browser crypto dependencies.
 * Generates an exact 64-character hexadecimal SHA-256 checksum across any runtime.
 */
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let c = candidate * candidate; c < 312; c += candidate) {
        isComposite[c] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s1_ = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const s0_ = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const temp1 = (hash[7] + s1_ + ch + k[i] + w[i]) | 0;
      const temp2 = (s0_ + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}
import type { ActionRecord, CreateActionInput } from './types';
import { saveAction } from './actionClient';

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
  return sha256(parts.join('|'));
}

/**
 * Save candidate action proposed by intelligence or meeting extraction.
 * Idempotent: duplicate fingerprint for same user is ignored without failing.
 */
export async function saveCandidate(
  supabase: SupabaseClient,
  input: ActionCandidateInput
): Promise<{ data: any; error: any }> {
  const fingerprint = computeCandidateFingerprint(input);
  const payload = {
    workspace_id: input.workspace_id || null,
    user_id: input.user_id,
    proposed_owner_id: input.proposed_owner_id || null,
    proposed_owner_label: input.proposed_owner_label || null,
    title: input.title,
    proposed_priority: input.proposed_priority || 'medium',
    proposed_due: input.proposed_due || null,
    due_basis: input.due_basis || (input.proposed_due ? 'stated' : 'none'),
    owner_basis: input.owner_basis || (input.proposed_owner_label ? 'stated' : 'unresolved'),
    source_type: input.source_type || 'meeting_output',
    source_id: input.source_id || null,
    source_revision: input.source_revision || null,
    source_excerpt: input.source_excerpt || null,
    project_id: input.project_id || null,
    fingerprint,
    state: 'new',
  };

  const { data, error } = await supabase
    .from('action_candidates')
    .upsert(payload, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true })
    .select()
    .maybeSingle();

  return { data, error };
}

/**
 * Fetch candidates awaiting review for the current user.
 */
export async function fetchCandidates(
  supabase: SupabaseClient
): Promise<{ data: any[]; error: any }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('action_candidates')
    .select('*')
    .eq('user_id', userId)
    .eq('state', 'new')
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Approve a candidate:
 * 1. Inserts verified task into action_tracker
 * 2. Marks candidate state = 'approved'
 * 3. Records approval event
 * 4. Records audit event
 */
export async function approveCandidate(
  supabase: SupabaseClient,
  candidate: any,
  overrides?: Partial<CreateActionInput>
): Promise<{ action: ActionRecord | null; error: any }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { action: null, error: new Error('Not authenticated') };

  const actionPayload: CreateActionInput = {
    action_title: overrides?.action_title || candidate.title,
    action_description:
      overrides?.action_description !== undefined
        ? overrides.action_description
        : candidate.source_excerpt || null,
    project_id:
      overrides?.project_id !== undefined ? overrides.project_id : candidate.project_id || null,
    owner_name:
      overrides?.owner_name !== undefined
        ? overrides.owner_name
        : candidate.proposed_owner_label || null,
    assigned_user_id:
      overrides?.assigned_user_id !== undefined
        ? overrides.assigned_user_id
        : candidate.proposed_owner_id || null,
    due_date:
      overrides?.due_date !== undefined ? overrides.due_date : candidate.proposed_due || null,
    priority: overrides?.priority || candidate.proposed_priority || 'medium',
    status: overrides?.status || 'not_started',
    source_type: candidate.source_type || 'candidate_approved',
    source_id: candidate.source_id || null,
    source_url: candidate.source_excerpt || null,
    approval_state: 'approved_from_candidate',
    approved_by: userId,
    approved_at: new Date().toISOString(),
  };

  const { data: action, error: actError } = await saveAction(supabase, actionPayload);
  if (actError || !action) {
    return { action: null, error: actError || new Error('Failed to create action from candidate') };
  }

  // Update candidate state to 'approved'
  await supabase
    .from('action_candidates')
    .update({
      state: 'approved',
      approved_action_id: action.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidate.id);

  // Record approval event
  await supabase.from('action_approval_events').insert({
    candidate_id: candidate.id,
    action_id: action.id,
    actor_id: userId,
    decision: 'approved',
    edited_fields: overrides ? Object.keys(overrides) : [],
  });

  // Record audit event
  await supabase.from('action_audit_events').insert({
    action_id: action.id,
    actor_id: userId,
    event: 'candidate_approved',
    changed_fields: { candidate_id: candidate.id, source_type: candidate.source_type },
  });

  return { action, error: null };
}

/**
 * Dismiss candidate:
 * Marks state = 'dismissed' for current user.
 */
export async function dismissCandidate(
  supabase: SupabaseClient,
  candidateId: string
): Promise<{ error: any }> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { error: new Error('Not authenticated') };

  const { error } = await supabase
    .from('action_candidates')
    .update({
      state: 'dismissed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId)
    .eq('user_id', userId);

  return { error };
}
