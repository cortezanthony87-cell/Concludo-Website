import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { fetchProjects } from '../lib/projects/projectClient';
import { parseUploadedFile } from '../lib/intelligence/fileParser';
import { saveMeetingRecord } from '../lib/outputs/saveMeetingRecord';
import { mountMeetingStudio } from '../features/meeting-output/studio';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../features/meeting-output/meeting-output.css';

/**
 * Meeting output studio v2. Route: /meeting-output (unchanged).
 * The studio is a self-contained module scoped under .cmo. This page only supplies
 * the Workspace services it needs: the file parser, the project list and the save path.
 */
export const MeetingOutputPage: React.FC = () => {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { isAllowed: canDraftEmail } = useFeatureAccess('follow_up_email_draft');
  const { isAllowed: canExportDeck } = useFeatureAccess('deck_export');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supabase) return undefined;
    const unmount = mountMeetingStudio(host, {
      embedded: true,
      canDraftEmail,
      canExportDeck,
      parseFile: async (file) => {
        // Keep the matching PDF worker local instead of depending on a CDN version.
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const parsed = await parseUploadedFile(file);
        return { name: parsed.name, type: parsed.type, text: parsed.text };
      },
      listProjects: async () => {
        const res = await fetchProjects(supabase);
        return (res.data || []).map((p) => ({ id: p.id, title: p.title, client: p.client_name ?? null }));
      },
      onSave: (model, target, extras) => saveMeetingRecord(supabase, model, target, extras, { canDraftEmail }),
      onSaved: (projectId) => navigate(`/projects/${projectId}`),
    });
    return unmount;
  }, [supabase, navigate, canDraftEmail, canExportDeck]);

  return <div ref={hostRef} className="cmo-host" />;
};

export default MeetingOutputPage;
