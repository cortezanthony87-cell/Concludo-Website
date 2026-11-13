import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { fetchProjects } from '../lib/projects/projectClient';
import { parseUploadedFile } from '../lib/intelligence/fileParser';
import { saveMeetingRecord } from '../lib/outputs/saveMeetingRecord';
import { mountMeetingStudio } from '../features/meeting-output/studio';
import { TIMELINE_RELEASED, DECK_RELEASED } from '../features/meeting-output/releases';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../features/meeting-output/meeting-output.css';

/**
 * Meeting output studio v2. Route: /meeting-output (unchanged).
 * The studio is a self-contained module scoped under .cmo. This page only supplies
 * the Workspace services it needs: the file parser, the project list, edge function drafting,
 * and the save path.
 */
export const MeetingOutputPage: React.FC = () => {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { isAllowed: canDraftEmail } = useFeatureAccess('follow_up_email_draft');
  const { isAllowed: canExportDeck } = useFeatureAccess('deck_export');
  const { isAllowed: canExportTimeline } = useFeatureAccess('action_timeline_export');
  const { isAllowed: canUseModelDrafting } = useFeatureAccess('model_drafting');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supabase) return undefined;
    const unmount = mountMeetingStudio(host, {
      embedded: true,
      canDraftEmail,
      canExportDeck,
      canExportTimeline,
      timelineReleased: TIMELINE_RELEASED,
      deckReleased: DECK_RELEASED,
      canUseModelDrafting,
      parseFile: async (file) => {
        // Keep the matching PDF worker local instead of depending on a CDN version.
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const parsed = await parseUploadedFile(file);
        return { name: parsed.name, type: parsed.type, text: parsed.text };
      },
      draftMeetingRecord: async (srcs, meta) => {
        // Blocker 3 & Round 3: If no meeting date is entered, only signal missing_meeting_date
        // if the user has model drafting enabled; otherwise silent basic drafting
        if (!meta?.meetingDate) {
          return {
            drafting_method: 'basic',
            reason: canUseModelDrafting ? 'missing_meeting_date' : 'flag_off',
          };
        }

        // Concatenate sources (primary transcript)
        const transcript = srcs.map((s: any) => s.text || '').join('\n\n');
        const meetingDate = meta.meetingDate;
        const title = meta?.title || 'not stated';

        const { data, error } = await supabase.functions.invoke('draft-meeting-record', {
          body: {
            transcript,
            meetingDate,
            title,
          },
        });

        if (error || !data) {
          return { drafting_method: 'basic', reason: 'model_api_unavailable' };
        }
        return data;
      },
      listProjects: async () => {
        const res = await fetchProjects(supabase);
        return (res.data || []).map((p) => ({ id: p.id, title: p.title, client: p.client_name ?? null }));
      },
      onSave: (model, target, extras) => saveMeetingRecord(supabase, model, target, extras, { canDraftEmail }),
      onSaved: (projectId) => navigate(`/projects/${projectId}`),
    });
    return unmount;
  }, [supabase, navigate, canDraftEmail, canExportDeck, canExportTimeline]);

  return <div ref={hostRef} className="cmo-host" />;
};

export default MeetingOutputPage;
