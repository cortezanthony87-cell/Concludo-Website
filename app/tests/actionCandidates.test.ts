import { describe, it, expect } from 'bun:test';
import { normaliseCandidateTitle, computeCandidateFingerprint } from '../src/lib/actions/actionCandidates';
import {
  saveCandidate,
  fetchCandidates,
  approveCandidate,
  dismissCandidate,
} from '../src/lib/actions/actionCandidates';

describe('Action Command Hub - Candidate Fingerprinting and Normalisation', () => {
  it('normalises candidate title by lowercasing, trimming, stripping punctuation and collapsing whitespace', () => {
    const raw = '   Send   Revised Scope, to Priya!!  ';
    expect(normaliseCandidateTitle(raw)).toBe('send revised scope to priya');
  });

  it('produces identical deterministic fingerprints for duplicate inputs', () => {
    const cand1 = {
      workspace_id: 'ws-123',
      user_id: 'user-456',
      source_type: 'meeting',
      source_id: 'meet-789',
      title: 'Send revised scope to Priya',
      proposed_owner_label: 'you',
    };

    const cand2 = {
      workspace_id: 'ws-123',
      user_id: 'user-456',
      source_type: 'meeting',
      source_id: 'meet-789',
      title: '   send   revised scope to priya!  ',
      proposed_owner_label: 'you',
    };

    expect(computeCandidateFingerprint(cand1)).toBe(computeCandidateFingerprint(cand2));
  });

  it('produces distinct fingerprints for different sources or titles', () => {
    const cand1 = {
      workspace_id: 'ws-123',
      user_id: 'user-456',
      source_type: 'meeting',
      source_id: 'meet-789',
      title: 'Task A',
    };
    const cand2 = {
      workspace_id: 'ws-123',
      user_id: 'user-456',
      source_type: 'meeting',
      source_id: 'meet-789',
      title: 'Task B',
    };
    expect(computeCandidateFingerprint(cand1)).not.toBe(computeCandidateFingerprint(cand2));
  });

  it('saves candidate idempotently using upsert with fingerprint', async () => {
    const upsertCalls: any[] = [];
    const mockSupabase: any = {
      from: (table: string) => {
        expect(table).toBe('action_candidates');
        return {
          upsert: (payload: any, opts: any) => {
            upsertCalls.push({ payload, opts });
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'cand-1', ...payload }, error: null }),
              }),
            };
          },
        };
      },
    };

    const input = {
      user_id: 'user-456',
      title: 'Prepare board slides',
      proposed_priority: 'high' as const,
      proposed_due: '2026-11-05',
      source_type: 'meeting_output',
      source_id: 'out-1',
    };

    const res = await saveCandidate(mockSupabase, input);
    expect(res.data?.id).toBe('cand-1');
    expect(res.data?.state).toBe('new');
    expect(upsertCalls[0].opts.onConflict).toBe('user_id,fingerprint');
    expect(upsertCalls[0].opts.ignoreDuplicates).toBe(true);
  });

  it('approves candidate, creates action, and records approval and audit events', async () => {
    const tablesTouched: string[] = [];
    const mockSupabase: any = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-456' } } }),
      },
      from: (table: string) => {
        tablesTouched.push(table);
        return {
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({ data: { id: 'act-99', ...data }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    };

    const candidate = {
      id: 'cand-1',
      title: 'Review Q4 financials',
      proposed_priority: 'high',
      proposed_due: '2026-11-10',
      proposed_owner_label: 'Anthony Cortez',
      source_type: 'meeting_output',
      source_id: 'out-1',
    };

    const res = await approveCandidate(mockSupabase, candidate);
    expect(res.action?.id).toBe('act-99');
    expect(res.action?.action_title).toBe('Review Q4 financials');
    expect(tablesTouched).toContain('action_tracker');
    expect(tablesTouched).toContain('action_candidates');
    expect(tablesTouched).toContain('action_approval_events');
    expect(tablesTouched).toContain('action_audit_events');
  });
});
