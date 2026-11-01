import { describe, it, expect } from 'bun:test';
import { normaliseCandidateTitle, computeCandidateFingerprint } from '../src/lib/actions/actionCandidates';

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
});
