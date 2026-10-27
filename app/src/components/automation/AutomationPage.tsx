import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  SupabaseAutomationStore,
  loadWorkspaceData,
  applySupabaseFix,
  logAgentActivity,
} from '../../lib/automation/supabaseAutomationStore';
import { mountAutomation } from '../../lib/automation/automationStudio';
import '../../styles/automation-v2.css';

export interface AutomationPageProps {
  view: 'agents' | 'workflows' | 'builder' | 'runs' | 'approvals' | 'governance';
  paramId?: string;
}

export const AutomationPage: React.FC<AutomationPageProps> = ({ view, paramId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveId = paramId !== undefined ? paramId : (params.id || null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      try {
        setLoading(true);
        setError(null);

        const actorName =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split('@')[0] ||
          'User';
        const userId = user?.id || '00000000-0000-0000-0000-000000000000';

        const store = new SupabaseAutomationStore({
          userId,
          actorName,
        });

        const workspace = await loadWorkspaceData({
          userId,
          actorName,
        });

        if (cancelled || !containerRef.current) return;

        // Clear previous children
        containerRef.current.innerHTML = '';

        await mountAutomation(containerRef.current, {
          store,
          workspace,
          actor: actorName,
          embedded: true,
          usePathRouting: true,
          initialRoute: {
            page: view,
            id: effectiveId,
          },
          onNavigate: (path: string) => {
            navigate(path);
          },
          onApplyFix: async (fix: any, values: Record<string, string>) => {
            return await applySupabaseFix(fix, values, { userId, name: actorName });
          },
          onLogActivity: async (
            agentType: string,
            headline: string,
            basis: string,
            status: 'success' | 'skipped'
          ) => {
            await logAgentActivity({
              userId,
              agentType,
              headline,
              basis,
              status,
            });
          },
        });

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to mount automation view:', err);
          setError(err.message || 'Failed to load automation view');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [view, effectiveId, user?.id]);

  return (
    <div className="cma-root" style={{ width: '100%', minHeight: '100%' }}>
      {loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#5A6478' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading Automation...</div>
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '24px',
            margin: '24px',
            background: '#FBECEA',
            border: '1px solid #A8382F',
            borderRadius: '8px',
            color: '#A8382F',
          }}
        >
          <b>Error loading view:</b> {error}
          <div style={{ marginTop: 12 }}>
            <a href="/workflows/builder/new" style={{ color: '#16263F', fontWeight: 700 }}>Create workflow</a>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ display: loading ? 'none' : 'block' }} />
    </div>
  );
};

export default AutomationPage;
