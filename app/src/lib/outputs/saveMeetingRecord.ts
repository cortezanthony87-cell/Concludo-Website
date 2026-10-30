import type { SupabaseClient } from '@supabase/supabase-js';
import { createProject } from '../projects/projectClient';
import { createProjectFile } from '../projects/projectFilesClient';
import { saveOutput } from './outputClient';
import { saveDecision } from '../decisions/decisionClient';
import { saveAction } from '../actions/actionClient';
import { refreshAllIntelligence } from '../intelligence/intelligenceClient';
import type { MeetingModel, Review } from '../intelligence/meetingEngine';
import type { SaveTarget, SaveExtras } from '../../features/meeting-output/studio';

const MODEL = 'Concludo Meeting Engine v2';
const kept = <T extends { review: Review }>(xs: T[]) => xs.filter((x) => x.review !== 'excluded');

/**
 * Persist a reviewed v2 meeting record. Only items the person did not exclude are written.
 *
 * Rules that must survive any edit to this file:
 *  - Nothing is written that the record does not contain. No placeholder owner ("Project Team"),
 *    no template rationale, no default due date. action_tracker.owner_name is nullable: use NULL.
 *  - decision_reasoning stays NULL. v2 does not extract a stated rationale, and the old
 *    template text ("Confirmed in meeting output.") was invented.
 *  - output_type stays inside outputs_output_type_check (summary, action_items, follow_up_email,
 *    decision_log, action_plan, endpoint_report). The full record rides in summary.json_content.
 */
export async function saveMeetingRecord(
  supabase: SupabaseClient,
  model: MeetingModel,
  target: SaveTarget,
  extras: SaveExtras,
  options?: { canDraftEmail?: boolean }
): Promise<{ projectId: string }> {
  const m = model;
  let projectId = target.projectId || '';

  if (target.mode === 'new') {
    const transcript = extras.sources.filter((s) => s.kind === 'transcript').map((s) => s.text).join('\n\n---\n\n');
    const notes = extras.sources.filter((s) => s.kind !== 'transcript').map((s) => s.text).join('\n\n---\n\n');
    const res = await createProject(supabase, {
      title: target.title || m.meta.title,
      meeting_type: m.meta.meetingType,
      client_name: target.client || m.meta.organisation || null,
      project_name: m.meta.project || target.title || m.meta.title,
      meeting_date: m.meta.meetingDate,
      transcript: transcript || null,
      notes: notes || null,
    });
    if (res.error || !res.data) throw new Error(res.error?.message || 'The project could not be created.');
    projectId = res.data.id;
  }
  if (!projectId) throw new Error('Choose a project to save into.');

  // Decisions and actions inherit the project's ownership, as v1 did.
  const { data: proj, error: ownershipError } = await supabase.from('projects').select('ownership_type, team_id').eq('id', projectId).single();
  if (ownershipError || !proj) throw new Error('The project ownership could not be verified. No meeting outputs were saved.');
  const ownership_type: 'personal' | 'team' = proj?.ownership_type === 'team' && proj?.team_id ? 'team' : 'personal';
  const team_id: string | null = ownership_type === 'team' ? (proj?.team_id as string) : null;

  const fail = (what: string, err?: { message?: string } | null): never => {
    throw new Error(`${what} could not be saved: ${err?.message || 'unknown error'}. Items saved before this point remain in the project.`);
  };

  // 1. The full record. ProjectDetailPage detects json_content.version === '2.0' (see PATCH_OutputDocumentRenderer.md).
  const summary = await saveOutput(supabase, { project_id: projectId, output_type: 'summary', content: extras.markdown, json_content: m, model_used: MODEL });
  if (summary.error || !summary.data) fail('The meeting record', summary.error);

  // 2. Readable copies for the existing output tabs. Each carries the full record too, so the project page
  //    can open it in the matching v2 template (MeetingRecordView).
  const actionsMd = kept(m.actions).map((a) => `- **${a.id}** ${a.task} | Owner: ${a.owner ?? 'not named'} | Due: ${a.due ?? 'not stated'}${a.gaps.length ? ` | Gaps: ${a.gaps.join('; ')}` : ''}`).join('\n');
  const decisionsMd = kept(m.decisions).map((d) => `- **${d.id}** ${d.statement}${d.status === 'conditional' ? ` (conditional: ${d.condition})` : ''}\n  Evidence: "${d.evidence[0]?.quote ?? ''}"`).join('\n');
  const plan = await saveOutput(supabase, { project_id: projectId, output_type: 'action_plan', content: `# Action plan: ${m.meta.title}\n\n${actionsMd || 'No actions recorded.'}`, json_content: m, model_used: MODEL });
  if (plan.error) fail('The action plan', plan.error);
  const log = await saveOutput(supabase, { project_id: projectId, output_type: 'decision_log', content: `# Decision log: ${m.meta.title}\n\n${decisionsMd || 'No decisions recorded.'}`, json_content: m, model_used: MODEL });
  if (log.error) fail('The decision log', log.error);

  // Plan gate: follow_up_email output is saved on Pro and Team only. Starter skips this write.
  let canDraft = options?.canDraftEmail;
  if (canDraft === undefined) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (userId) {
        const { data: allowed } = await supabase.rpc('can_use_feature', {
          p_user_id: userId,
          p_feature_key: 'follow_up_email_draft',
        });
        if (typeof allowed === 'boolean') {
          canDraft = allowed;
        } else {
          const { data: prof } = await supabase.from('profiles').select('plan').eq('id', userId).single();
          const p = prof?.plan;
          canDraft = p ? (p !== 'starter' && p !== 'starter_trial' && p !== 'free_preview') : false;
        }
      }
    } catch {
      canDraft = true;
    }
  }
  if (canDraft) {
    const email = await saveOutput(supabase, { project_id: projectId, output_type: 'follow_up_email', content: `Subject: ${extras.email.subject}\n\n${extras.email.body}`, model_used: MODEL });
    if (email.error) fail('The follow-up email draft', email.error);
  }

  // 3. Registers.
  for (const d of kept(m.decisions)) {
    const r = await saveDecision(supabase, {
      project_id: projectId,
      decision_title: d.title,
      decision_summary: d.status === 'conditional' && d.condition && !d.statement.includes(d.condition) ? `${d.statement} (conditional: ${d.condition})` : d.statement,
      decision_reasoning: null,
      decision_date: m.meta.meetingDate,
      decision_owner: d.calledBy ?? null,
      source_output_id: log.data?.id ?? summary.data!.id,
      ownership_type,
      team_id,
    });
    if (r.error) fail(`Decision ${d.id}`, r.error);
  }
  for (const a of kept(m.actions)) {
    const ev = a.evidence[0];
    const r = await saveAction(supabase, {
      project_id: projectId,
      action_title: a.task,
      action_description: ev ? `"${ev.quote}" (${ev.sourceName}, line ${ev.line}${ev.timestamp ? `, ${ev.timestamp}` : ''})` : a.task,
      owner_name: a.owner ?? null,
      due_date: a.due ?? null,
      status: 'not_started',
      source_output_id: plan.data?.id ?? summary.data!.id,
      ownership_type,
      team_id,
    });
    if (r.error) fail(`Action ${a.id}`, r.error);
  }

  // 4. Sources into project file storage.
  for (const s of extras.sources) {
    const r = await createProjectFile(supabase, {
      project_id: projectId,
      name: s.name.includes('.') ? s.name : `${s.name}.txt`,
      file_type: s.kind === 'transcript' ? 'transcript' : 'document',
      mime_type: 'text/plain',
      source: 'meeting_output',
      content: s.text,
      description: `Source for ${m.meta.title} (${m.meta.meetingDate})`,
    });
    if (r.error || !r.data) fail(`Source ${s.name}`, r.error);
  }

  refreshAllIntelligence({ supabase }).catch(() => undefined);
  return { projectId };
}
