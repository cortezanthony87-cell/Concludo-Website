import React, { useEffect, useRef } from 'react';
import { mountMeetingDocument } from '../features/meeting-output/studio';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import '../features/meeting-output/meeting-output.css';
import type { MeetingModel } from '../lib/intelligence/meetingEngine';

/** True when an output's json_content is a v2 meeting record saved by the new studio. */
export function isMeetingRecordV2(x: unknown): x is MeetingModel {
  if (!x || typeof x !== 'object') return false;
  const r = x as { version?: unknown; decisions?: unknown; actions?: unknown };
  return r.version === '2.0' && Array.isArray(r.decisions) && Array.isArray(r.actions);
}

const TEMPLATE_FOR: Record<string, 'board' | 'actions' | 'decisions' | 'email'> = {
  summary: 'board',
  action_plan: 'actions',
  action_items: 'actions',
  decision_log: 'decisions',
  follow_up_email: 'email',
};

/** Read-only view of a saved v2 record in the boardroom templates. Used by OutputDocumentRenderer. */
export const MeetingRecordView: React.FC<{ model: MeetingModel; outputType?: string }> = ({ model, outputType }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { isAllowed: canDraftEmail } = useFeatureAccess('follow_up_email_draft');

  useEffect(() => {
    if (!ref.current) return undefined;
    return mountMeetingDocument(ref.current, JSON.parse(JSON.stringify(model)) as MeetingModel, {
      template: TEMPLATE_FOR[outputType || 'summary'] || 'board',
      canDraftEmail,
    });
  }, [model, outputType, canDraftEmail]);
  return <div ref={ref} className="cmo-host" />;
};

export default MeetingRecordView;
