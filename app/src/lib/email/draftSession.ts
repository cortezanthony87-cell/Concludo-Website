/**
 * Editable draft state and approvals, for the length of one visit.
 *
 * Nothing here writes to a mailbox, because nothing can. Approving a draft
 * records that a person agreed to this exact text being SAVED as a draft later.
 * The saving itself is not built, and neither is sending.
 *
 * The approval rule is enforced here rather than in a component: every edit
 * goes through `updateDraft`, which recomputes approval status, so there is no
 * route by which a body can change while an approval survives.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DraftStyle, ReplyDraft } from './model';
import {
  ApprovalRecord,
  ApprovalStatus,
  DraftFingerprintInput,
  DraftRecipient,
  approvalStatus,
  createApproval,
} from './draftReview';

/** One thread's working draft, as the person currently has it. */
export interface WorkingDraft {
  threadId: string;
  accountId: string;
  fromAddress: string;
  recipients: DraftRecipient[];
  subject: string;
  body: string;
  attachmentIds: string[];
  /** Which written style the body came from, before any editing. */
  style: DraftStyle;
  /** True once the person has edited the body away from a generated style. */
  edited: boolean;
  /** Set when the person marked it as needing clarification. */
  clarificationRequested: boolean;
  clarificationNote: string | null;
  /** Set when the person discarded it this visit. */
  discarded: boolean;
  /** The last version explicitly kept with "Save as proposed draft". */
  savedAt: string | null;
}

export interface DraftSessionApi {
  /** The working draft for a thread, or null if none has been started. */
  draftFor: (threadId: string) => WorkingDraft | null;
  /** Seeds a working draft from the analysed one. Idempotent. */
  ensureDraft: (threadId: string, seed: Omit<WorkingDraft, 'edited' | 'clarificationRequested' | 'clarificationNote' | 'discarded' | 'savedAt'>) => void;
  updateDraft: (threadId: string, patch: Partial<WorkingDraft>) => void;
  setStyle: (threadId: string, style: DraftStyle, body: string) => void;
  saveProposed: (threadId: string) => void;
  requestClarification: (threadId: string, note: string) => void;
  discard: (threadId: string) => void;
  restore: (threadId: string) => void;
  approve: (threadId: string) => void;
  statusFor: (threadId: string) => ApprovalStatus;
  /** The last thing that happened, for the live region. */
  lastAnnouncement: string | null;
}

const EMPTY_STATUS: ApprovalStatus = {
  state: 'none',
  changed: [],
  message: 'Not approved. Nothing is saved to a mailbox without your approval of this exact text.',
  record: null,
};

const DraftSessionContext = createContext<DraftSessionApi>({
  draftFor: () => null,
  ensureDraft: () => undefined,
  updateDraft: () => undefined,
  setStyle: () => undefined,
  saveProposed: () => undefined,
  requestClarification: () => undefined,
  discard: () => undefined,
  restore: () => undefined,
  approve: () => undefined,
  statusFor: () => EMPTY_STATUS,
  lastAnnouncement: null,
});

export function useDraftSession(): DraftSessionApi {
  return useContext(DraftSessionContext);
}

export function fingerprintInputOf(draft: WorkingDraft): DraftFingerprintInput {
  return {
    accountId: draft.accountId,
    fromAddress: draft.fromAddress,
    recipients: draft.recipients,
    subject: draft.subject,
    body: draft.body,
    attachmentIds: draft.attachmentIds,
  };
}

export const DraftSessionProvider: React.FC<{ children: React.ReactNode; now: string }> = ({
  children,
  now,
}) => {
  const [drafts, setDrafts] = useState<Record<string, WorkingDraft>>({});
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>({});
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);

  const announce = useCallback((text: string) => setLastAnnouncement(text), []);

  const draftFor = useCallback((threadId: string) => drafts[threadId] ?? null, [drafts]);

  const ensureDraft = useCallback<DraftSessionApi['ensureDraft']>((threadId, seed) => {
    setDrafts((current) => {
      if (current[threadId]) return current;
      return {
        ...current,
        [threadId]: {
          ...seed,
          edited: false,
          clarificationRequested: false,
          clarificationNote: null,
          discarded: false,
          savedAt: null,
        },
      };
    });
  }, []);

  /**
   * Every change to a draft comes through here, and every change clears an
   * approval that no longer matches. The clearing is not done by the caller,
   * because a caller can forget.
   */
  const updateDraft = useCallback<DraftSessionApi['updateDraft']>(
    (threadId, patch) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        const next = { ...existing, ...patch };
        if (patch.body !== undefined && patch.body !== existing.body) next.edited = true;
        return { ...current, [threadId]: next };
      });

      setApprovals((current) => {
        const record = current[threadId];
        if (!record) return current;
        // The approval is not deleted. It is kept so the interface can say what
        // changed against what was approved, which is more useful than the
        // approval simply vanishing.
        return current;
      });

      announce('Draft changed. Any approval given earlier no longer applies to this version.');
    },
    [announce]
  );

  const setStyle = useCallback<DraftSessionApi['setStyle']>(
    (threadId, style, body) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        return { ...current, [threadId]: { ...existing, style, body, edited: false } };
      });
      announce(
        `Draft replaced with the ${style} version. This is a change to the body, so any approval no longer applies.`
      );
    },
    [announce]
  );

  const saveProposed = useCallback(
    (threadId: string) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        return { ...current, [threadId]: { ...existing, savedAt: now } };
      });
      announce('Saved for review only. Nothing has been sent and nothing was written to a mailbox.');
    },
    [announce, now]
  );

  const requestClarification = useCallback<DraftSessionApi['requestClarification']>(
    (threadId, note) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        return {
          ...current,
          [threadId]: { ...existing, clarificationRequested: true, clarificationNote: note },
        };
      });
      setApprovals((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
      announce('Marked as needing clarification. Any approval has been cleared.');
    },
    [announce]
  );

  const discard = useCallback(
    (threadId: string) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        return { ...current, [threadId]: { ...existing, discarded: true } };
      });
      setApprovals((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
      announce('Draft discarded for this visit. Nothing in a mailbox was touched, because nothing was written there.');
    },
    [announce]
  );

  const restore = useCallback(
    (threadId: string) => {
      setDrafts((current) => {
        const existing = current[threadId];
        if (!existing) return current;
        return { ...current, [threadId]: { ...existing, discarded: false } };
      });
      announce('Draft restored.');
    },
    [announce]
  );

  const approve = useCallback(
    (threadId: string) => {
      setDrafts((current) => {
        const draft = current[threadId];
        if (!draft) return current;
        setApprovals((existing) => ({
          ...existing,
          [threadId]: createApproval(threadId, fingerprintInputOf(draft), 'you', now),
        }));
        return current;
      });
      announce(
        'Approved for saving as a draft. Nothing has been sent, and nothing has been written to a mailbox.'
      );
    },
    [announce, now]
  );

  const statusFor = useCallback(
    (threadId: string): ApprovalStatus => {
      const draft = drafts[threadId];
      const record = approvals[threadId] ?? null;
      if (!draft) return EMPTY_STATUS;
      return approvalStatus(fingerprintInputOf(draft), record);
    },
    [drafts, approvals]
  );

  const value = useMemo<DraftSessionApi>(
    () => ({
      draftFor,
      ensureDraft,
      updateDraft,
      setStyle,
      saveProposed,
      requestClarification,
      discard,
      restore,
      approve,
      statusFor,
      lastAnnouncement,
    }),
    [
      draftFor,
      ensureDraft,
      updateDraft,
      setStyle,
      saveProposed,
      requestClarification,
      discard,
      restore,
      approve,
      statusFor,
      lastAnnouncement,
    ]
  );

  return React.createElement(DraftSessionContext.Provider, { value }, children);
};

/** Seeds a working draft from an analysed one. Pure, so it can be tested. */
export function seedFromReplyDraft(
  draft: ReplyDraft,
  accountId: string,
  fromAddress: string,
  subject: string,
  style: DraftStyle
): Omit<WorkingDraft, 'edited' | 'clarificationRequested' | 'clarificationNote' | 'discarded' | 'savedAt'> {
  const body = draft.variants ? draft.variants[style] : '';
  return {
    threadId: draft.threadId,
    accountId,
    fromAddress,
    recipients: draft.recipients.map((r) => ({
      address: r.address,
      displayName: r.displayName,
      field: r.role,
    })),
    subject: subject.startsWith('RE:') ? subject : `RE: ${subject}`,
    body,
    attachmentIds: [],
    style,
  };
}
