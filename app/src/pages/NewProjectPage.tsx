import React, { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
 * Create New Project Page.
 * Mounts the bright transcript studio with Step 1 title "Create New Project"
 * for the Dashboard / Projects creation flow.
 * Leaves the Meeting Output Studio template under the Work side menu bar (/meeting-output) unchanged.
 */
export const NewProjectPage: React.FC = () => {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { isAllowed: canDraftEmail } = useFeatureAccess('follow_up_email_draft');
  const { isAllowed: canExportDeck } = useFeatureAccess('deck_export');
  const { isAllowed: canUseModelDrafting } = useFeatureAccess('model_drafting');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supabase) return undefined;
    const unmount = mountMeetingStudio(host, {
      embedded: true,
      step1Title: 'Create New Project',
      crumbTitle: 'Create New Project',
      defaultSaveMode: 'new',
      canDraftEmail,
      canExportDeck,
      canUseModelDrafting,
      parseFile: async (file) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const parsed = await parseUploadedFile(file);
        return { name: parsed.name, type: parsed.type, text: parsed.text };
      },
      draftMeetingRecord: async (srcs, meta) => {
        if (!meta?.meetingDate) {
          return {
            drafting_method: 'basic',
            reason: canUseModelDrafting ? 'missing_meeting_date' : 'flag_off',
          };
        }

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
  }, [supabase, navigate, canDraftEmail, canExportDeck]);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <Link
          to="/projects"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#64748b',
            fontSize: '0.88rem',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>
      <div ref={hostRef} className="cmo-host" style={{ flex: 1 }} />
    </div>
  );
};

export default NewProjectPage;
