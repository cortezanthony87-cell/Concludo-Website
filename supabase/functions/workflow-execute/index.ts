import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  optionsResponse,
  requireUser,
  writeAuditEvent,
} from './nango-common.ts';
import { getOrRefreshAccessToken } from './native-oauth.ts';

interface ExecuteRequest {
  workflow_id: string;
  trigger_data?: Record<string, any>;
  approval_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, request);

  try {
    const { user } = await requireUser(request);
    const body = (await request.json().catch(() => ({}))) as ExecuteRequest;
    const workflowId = typeof body.workflow_id === 'string' ? body.workflow_id.trim() : '';
    const approvalId = typeof body.approval_id === 'string' ? body.approval_id.trim() : '';

    if (!workflowId) {
      return jsonResponse({ error: 'workflow_id is required' }, 400, request);
    }

    const service = createServiceClient();

    // 1. Fetch workflow
    const { data: workflow, error: wfError } = await service
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .is('deleted_at', null)
      .single();

    if (wfError || !workflow) {
      return jsonResponse({ error: 'Workflow not found or deleted' }, 404, request);
    }

    if (!workflow.is_active) {
      return jsonResponse({ error: 'Workflow is paused or inactive' }, 400, request);
    }

    // Verify caller ownership or team/org membership
    if (workflow.owner_id !== user.id) {
      let isAllowed = false;
      if (workflow.organization_id) {
        const { data: orgMem } = await service
          .from('organization_members')
          .select('id')
          .eq('organization_id', workflow.organization_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (orgMem) isAllowed = true;
      }
      if (!isAllowed) {
        return jsonResponse({ error: 'Unauthorized to execute this workflow' }, 403, request);
      }
    }

    const startTime = Date.now();
    const wfName = workflow.name || 'Automated Workflow';
    const executionType = workflow.execution_type || 'approval_required';

    // 2. Enforce Approval Gate & Single-Use Consumption ("Concludo proposes; a person disposes")
    let approvalRecord: any = null;
    if (approvalId) {
      const { data: appRow, error: appErr } = await service
        .from('workflow_approvals')
        .select('*')
        .eq('id', approvalId)
        .eq('workflow_id', workflow.id)
        .is('deleted_at', null)
        .single();

      if (appErr || !appRow) {
        return jsonResponse({ error: 'Specified approval request not found' }, 404, request);
      }

      if (appRow.status !== 'approved') {
        return jsonResponse({ error: 'Approval request has not been authorized. Concludo proposes; a person disposes.' }, 400, request);
      }

      // Check single-use consumption
      if (appRow.consumed_at) {
        return jsonResponse({
          error: 'This approval has already been consumed and dispatched.',
          already_dispatched: true,
          consumed_at: appRow.consumed_at,
        }, 409, request);
      }

      approvalRecord = appRow;
    }

    // 3. Identify target external actions
    const actions = workflow.actions || [];
    const hasMsTodoAction = actions.some((a: any) => (a.service || a.application || a.type) === 'microsoft_todo' || (a.type || '').includes('todo'));

    // 4. For Microsoft To Do dispatch
    let msTodoResult: any = { connected: false, dispatched: false };

    if (hasMsTodoAction) {
      // Enforce approval gate if workflow requires approval
      if (executionType === 'approval_required' && !approvalRecord) {
        return jsonResponse({
          error: 'External task dispatch requires explicit sign-off in the Approval Centre. Concludo proposes; a person disposes.',
          requires_approval: true,
        }, 403, request);
      }

      // Check if user has an active, verified native token connection
      const { data: msConn } = await service
        .from('integration_connections')
        .select('id, status, auth_mode, encrypted_access_token')
        .eq('user_id', user.id)
        .eq('provider_id', 'microsoft_todo')
        .eq('status', 'connected')
        .is('deleted_at', null)
        .maybeSingle();

      if (!msConn?.encrypted_access_token) {
        // Truthful connection check: not connected or token missing
        return jsonResponse({
          ok: false,
          error: 'Microsoft To Do is not connected or requires re-authorization. Please connect your account in Settings > Integrations.',
          provider_id: 'microsoft_todo',
          status: 'not_connected',
        }, 400, request);
      }

      // If connected, perform truthful dispatch using the approved payload or trigger items
      const payload = approvalRecord?.action_payload || body.trigger_data || {};
      let itemsToCreate: any[] = [];
      if (Array.isArray(payload.stagedItems)) {
        itemsToCreate = payload.stagedItems;
      } else if (Array.isArray(payload.tasks)) {
        itemsToCreate = payload.tasks;
      } else if (Array.isArray(payload.items)) {
        itemsToCreate = payload.items;
      } else if (Array.isArray(payload.messages)) {
        itemsToCreate = payload.messages.map((m: any) => ({
          title: m.title || `Review LinkedIn inquiry from ${m.sender || m.from || "Connection"}`,
          description: m.description || "Inquiry received on LinkedIn regarding Concludo automated workflow integration. Staged follow-up task.",
          sender: m.sender || m.from,
          message: m.message || m.body || m.preview || m.text,
          priority: m.priority || "high",
          due_date: m.due_date || new Date(Date.now() + 86400000).toISOString().split("T")[0],
          checklist: Array.isArray(m.checklist) ? m.checklist : [
            `Review incoming message from ${m.sender || m.from || "Connection"}`,
            "Draft and authorise response via Approval Centre",
            "Schedule discovery call if verified",
          ],
        }));
      }

      if (itemsToCreate.length === 0) {
        return jsonResponse({
          ok: false,
          error: 'No authentic action items found in the approval payload to dispatch.',
        }, 400, request);
      }

      try {
        const { accessToken } = await getOrRefreshAccessToken(service, msConn.id);

        // Determine target list name from workflow configuration or defaults
        const targetListName = (
          workflow.definition_json?.steps?.find((s: any) => s.application === 'microsoft_todo')?.inputMapping?.listName ||
          workflow.definition_json?.steps?.find((s: any) => s.application === 'microsoft_todo')?.configuration?.listName ||
          (wfName.toLowerCase().includes('linkedin') ? 'LinkedIn Follow-ups' : 'Concludo Tasks')
        );

        let listId = '';
        const listRes = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (listRes.ok) {
          const listJson = await listRes.json();
          const existingList = (listJson.value || []).find((l: any) => l.displayName?.toLowerCase() === targetListName.toLowerCase());
          if (existingList) {
            listId = existingList.id;
          } else {
            // Create the custom named list explicitly in Microsoft To Do
            const createListRes = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ displayName: targetListName }),
            });
            if (createListRes.ok) {
              const newListData = await createListRes.json();
              listId = newListData.id;
            } else {
              // Fallback to default list if list creation encounters permission issues
              const defaultList = (listJson.value || []).find((l: any) => l.wellknownListName === 'defaultList' || l.displayName === 'Tasks');
              listId = defaultList ? defaultList.id : 'default';
            }
          }
        } else {
          listId = 'default';
        }

        const createdTasks: any[] = [];
        for (const item of itemsToCreate) {
          const title = item.title || item.action_title || item.name;
          if (!title) continue;

          const desc = item.description || item.action_description || `Generated by Concludo workflow: ${wfName}`;
          const sender = item.sender || item.sender_name || item.from || item.author;
          const msg = item.message || item.sender_message || item.body || item.preview || item.text;

          let taskBodyContent = desc;
          if (msg) {
            taskBodyContent = `${desc}\n\n${sender ? `From: ${sender}\n` : ''}Message:\n"${msg}"`;
          }

          const taskPayload: Record<string, any> = {
            title,
            body: { content: taskBodyContent, contentType: 'text' },
            importance: item.priority === 'high' ? 'high' : 'normal',
          };

          if (item.due_date) {
            taskPayload.dueDateTime = { dateTime: `${item.due_date}T09:00:00`, timeZone: 'UTC' };
          }

          const createRes = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskPayload),
          });

          if (createRes.ok) {
            const taskData = await createRes.json();
            createdTasks.push({ id: taskData.id, title: taskData.title });

            // Checklist items if provided
            if (Array.isArray(item.checklist)) {
              for (const cl of item.checklist) {
                await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${taskData.id}/checklistItems`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ displayName: String(cl), isChecked: false }),
                }).catch(() => {});
              }
            }

            // Also mirror created task into Concludo Action Tracker
            try {
              await service.from('action_tracker').insert({
                user_id: user.id,
                action_title: title,
                action_description: taskBodyContent,
                status: 'not_started',
                ownership_type: 'personal',
                workflow_id: workflow.id,
                due_date: item.due_date || null,
              });
            } catch (err: any) {
              console.warn('Failed to mirror to action_tracker:', err.message);
            }
          } else {
            const errText = await createRes.text().catch(() => '');
            console.error('Failed to create Microsoft To Do task:', createRes.status, errText);
          }
        }

        msTodoResult = {
          connected: true,
          dispatched: createdTasks.length > 0,
          tasksCreated: createdTasks.length,
          listId,
          createdTasks,
        };
      } catch (err: any) {
        console.error('Error during Microsoft To Do dispatch:', err);
        return jsonResponse({
          ok: false,
          error: `Microsoft To Do dispatch failed: ${err.message}`,
        }, 500, request);
      }
    }

    // 5. Mark approval as consumed
    const now = new Date().toISOString();
    if (approvalRecord) {
      await service
        .from('workflow_approvals')
        .update({
          consumed_at: now,
          dispatch_result: { microsoft_todo: msTodoResult },
        })
        .eq('id', approvalRecord.id);
    }

    // 6. Record execution record with idempotency
    const duration = Date.now() - startTime;
    const idempotencyKey = approvalRecord ? `exec_approval_${approvalRecord.id}` : `exec_wf_${workflow.id}_${Date.now()}`;

    const { data: execution, error: execErr } = await service
      .from('workflow_executions')
      .insert({
        workflow_id: workflow.id,
        triggered_by: user.id,
        status: 'completed',
        idempotency_key: idempotencyKey,
        trigger_data: body.trigger_data || (approvalRecord ? { approval_id: approvalRecord.id } : {}),
        steps_completed: [
          { action: 'dispatch_external_tasks', result: msTodoResult, executedAt: now },
        ],
        execution_duration_ms: duration,
      })
      .select('*')
      .single();

    if (execErr) {
      console.error('Failed to record workflow execution:', execErr);
    }

    // 7. Audit log
    await writeAuditEvent(service, {
      user_id: user.id,
      organization_id: workflow.organization_id,
      provider_id: 'workflow_engine',
      event_type: 'action_succeeded',
      metadata: {
        workflow_id: workflow.id,
        workflow_name: wfName,
        ms_todo: msTodoResult,
      },
    });

    return jsonResponse({
      ok: true,
      workflow_id: workflow.id,
      execution_id: execution?.id,
      microsoft_todo: msTodoResult,
    }, 200, request);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('workflow-execute error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal server error' }, 500, request);
  }
});
