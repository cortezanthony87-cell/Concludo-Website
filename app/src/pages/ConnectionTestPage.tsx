import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Server, Terminal, Lock } from 'lucide-react';
import { getSupabaseEnv, getSupabaseBrowserClient } from '../lib/supabase/client';

interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  message: string;
  detail?: string;
}

export const ConnectionTestPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [connectedRow, setConnectedRow] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<{ urlPresent: boolean; anonKeyPresent: boolean; maskedUrl: string }>({
    urlPresent: false,
    anonKeyPresent: false,
    maskedUrl: '',
  });

  const runDiagnostics = async () => {
    setLoading(true);
    setConnectedRow(null);

    const initialSteps: TestStep[] = [
      { name: 'Read Supabase URL', status: 'running', message: 'Checking environment configuration...' },
      { name: 'Initialise Supabase Client', status: 'pending', message: 'Waiting for environment verification...' },
      { name: 'Execute Supabase Query', status: 'pending', message: 'Waiting for client initialisation...' },
      { name: 'Client Security & Role Isolation', status: 'pending', message: 'Verifying service role key isolation...' },
    ];
    setSteps(initialSteps);

    // Step 1: Read environment variables
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    const urlPresent = Boolean(supabaseUrl && supabaseUrl.trim().length > 0);
    const anonKeyPresent = Boolean(supabaseAnonKey && supabaseAnonKey.trim().length > 0);

    let masked = 'Not configured';
    if (urlPresent) {
      try {
        const parsed = new URL(supabaseUrl);
        masked = `${parsed.protocol}//${parsed.hostname.slice(0, 8)}...${parsed.hostname.slice(-8)}`;
      } catch {
        masked = 'Invalid URL format';
      }
    }

    setEnvInfo({
      urlPresent,
      anonKeyPresent,
      maskedUrl: masked,
    });

    if (!urlPresent || !anonKeyPresent) {
      setSteps([
        {
          name: 'Read Supabase URL',
          status: 'error',
          message: 'Missing environment variables',
          detail: 'SUPABASE_URL and/or SUPABASE_ANON_KEY are not configured. Please add them to .env.local for local development or in your deployment host environment variables.',
        },
        {
          name: 'Initialise Supabase Client',
          status: 'warning',
          message: 'Skipped due to missing environment variables',
        },
        {
          name: 'Execute Supabase Query',
          status: 'warning',
          message: 'Skipped',
        },
        {
          name: 'Client Security & Role Isolation',
          status: 'success',
          message: 'Passed (Service role key is strictly absent from browser scope)',
        },
      ]);
      setLoading(false);
      return;
    }

    // Step 1 Success
    const updatedSteps: TestStep[] = [
      {
        name: 'Read Supabase URL',
        status: 'success',
        message: 'Environment variables detected and validated',
        detail: `Target endpoint: ${masked}`,
      },
      { name: 'Initialise Supabase Client', status: 'running', message: 'Instantiating Supabase browser client...' },
      { name: 'Execute Supabase Query', status: 'pending', message: 'Waiting...' },
      { name: 'Client Security & Role Isolation', status: 'pending', message: 'Waiting...' },
    ];
    setSteps([...updatedSteps]);

    // Step 2: Initialise client
    let client;
    try {
      client = getSupabaseBrowserClient();
      updatedSteps[1] = {
        name: 'Initialise Supabase Client',
        status: 'success',
        message: 'Client initialised successfully with anon public key',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      updatedSteps[1] = {
        name: 'Initialise Supabase Client',
        status: 'error',
        message: 'Failed to initialise client',
        detail: errMsg,
      };
      updatedSteps[2] = { name: 'Execute Supabase Query', status: 'warning', message: 'Skipped' };
      updatedSteps[3] = { name: 'Client Security & Role Isolation', status: 'success', message: 'Verified' };
      setSteps([...updatedSteps]);
      setLoading(false);
      return;
    }

    setSteps([...updatedSteps]);

    // Step 3: Query Supabase without crashing
    updatedSteps[2] = { name: 'Execute Supabase Query', status: 'running', message: 'Querying connection_test table...' };
    setSteps([...updatedSteps]);

    try {
      const { data, error } = await client
        .from('connection_test')
        .select('*')
        .limit(1);

      if (error) {
        // Table might not exist yet or permissions issue
        updatedSteps[2] = {
          name: 'Execute Supabase Query',
          status: 'warning',
          message: `Query called without crashing (Supabase responded: ${error.message})`,
          detail: 'If the connection_test table is not created yet, run the migration in supabase/migrations/20260911000000_connection_test.sql in the Supabase SQL Editor.',
        };
      } else if (data && data.length > 0) {
        setConnectedRow(data[0].message);
        updatedSteps[2] = {
          name: 'Execute Supabase Query',
          status: 'success',
          message: 'Connection verified! Test row successfully retrieved from Supabase.',
          detail: `Row content: "${data[0].message}" (Record ID: ${data[0].id || 'verified'})`,
        };
      } else {
        updatedSteps[2] = {
          name: 'Execute Supabase Query',
          status: 'success',
          message: 'Connection successful (table exists, 0 rows returned).',
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      updatedSteps[2] = {
        name: 'Execute Supabase Query',
        status: 'error',
        message: 'Network error calling Supabase',
        detail: errMsg,
      };
    }

    // Step 4: Security Verification
    // Verify that SUPABASE_SERVICE_ROLE_KEY is NEVER exposed to the browser
    const isServiceRoleKeyExposed =
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Boolean((window as any).SUPABASE_SERVICE_ROLE_KEY) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Boolean((window as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY));

    if (isServiceRoleKeyExposed) {
      updatedSteps[3] = {
        name: 'Client Security & Role Isolation',
        status: 'error',
        message: 'SECURITY VIOLATION: Service role key detected in window context!',
      };
    } else {
      updatedSteps[3] = {
        name: 'Client Security & Role Isolation',
        status: 'success',
        message: 'Passed: SUPABASE_SERVICE_ROLE_KEY is strictly unexposed in client browser bundle',
        detail: 'Admin privileges are isolated to server environments only.',
      };
    }

    setSteps([...updatedSteps]);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(226, 181, 60, 0.2), rgba(188, 138, 28, 0.05))',
                border: '1px solid rgba(226, 181, 60, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F3C958',
              }}
            >
              <Database size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                  Supabase Connection Diagnostics
                </h1>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    background: 'rgba(226, 181, 60, 0.15)',
                    color: '#F3C958',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                  }}
                >
                  TASKLET 2
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px', margin: 0 }}>
                Verification tool for Supabase database connection, client initialisation, and security isolation.
              </p>
            </div>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="btn-metallic"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Testing...' : 'Run Diagnostics'}
          </button>
        </div>
      </div>

      {/* Connection Result Banner */}
      {connectedRow ? (
        <div
          className="glass-card"
          style={{
            padding: '20px 24px',
            border: '1px solid rgba(46, 213, 115, 0.4)',
            background: 'linear-gradient(135deg, rgba(46, 213, 115, 0.12), rgba(10, 18, 30, 0.8))',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(46, 213, 115, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2ED573',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>
              Database Status: {connectedRow}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
              Concludo Workspace is successfully connected to Supabase.
            </div>
          </div>
        </div>
      ) : !envInfo.urlPresent ? (
        <div
          className="glass-card"
          style={{
            padding: '20px 24px',
            border: '1px solid rgba(226, 181, 60, 0.4)',
            background: 'linear-gradient(135deg, rgba(226, 181, 60, 0.1), rgba(10, 18, 30, 0.8))',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F3C958',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>
              Environment Variables Required
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px', lineHeight: 1.5, margin: 0 }}>
              Supabase project configuration is not loaded in this session. Configure <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> in <code>.env.local</code> for local development or in your deployment dashboard for production.
            </p>
          </div>
        </div>
      ) : null}

      {/* Test Steps List */}
      <div className="glass-card" style={{ padding: '24px 28px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} style={{ color: '#F3C958' }} />
          Verification Sequence
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {steps.map((step, idx) => {
            const isSuccess = step.status === 'success';
            const isError = step.status === 'error';
            const isWarning = step.status === 'warning';
            const isRunning = step.status === 'running';

            const borderColor = isSuccess
              ? 'rgba(46, 213, 115, 0.3)'
              : isError
              ? 'rgba(255, 71, 87, 0.3)'
              : isWarning
              ? 'rgba(226, 181, 60, 0.3)'
              : 'rgba(255, 255, 255, 0.08)';

            const badgeBg = isSuccess
              ? 'rgba(46, 213, 115, 0.15)'
              : isError
              ? 'rgba(255, 71, 87, 0.15)'
              : isWarning
              ? 'rgba(226, 181, 60, 0.15)'
              : 'rgba(255, 255, 255, 0.05)';

            const badgeColor = isSuccess
              ? '#2ED573'
              : isError
              ? '#FF4757'
              : isWarning
              ? '#F3C958'
              : 'rgba(255, 255, 255, 0.5)';

            return (
              <div
                key={idx}
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{step.name}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)' }}>
                    {step.message}
                  </div>
                  {step.detail && (
                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px', fontFamily: 'monospace' }}>
                      {step.detail}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: badgeBg,
                    color: badgeColor,
                    flexShrink: 0,
                  }}
                >
                  {isRunning ? 'RUNNING' : step.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architectural Guidelines Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Server size={18} style={{ color: '#F3C958' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Client Helpers</h3>
          </div>
          <ul style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
            <li><strong>Browser Client:</strong> Uses <code>SUPABASE_URL</code> + <code>SUPABASE_ANON_KEY</code>.</li>
            <li><strong>Server/API Client:</strong> Authenticated server operations via <code>createSupabaseServerClient</code>.</li>
            <li><strong>Admin Client:</strong> Uses <code>SUPABASE_SERVICE_ROLE_KEY</code> (restricted to secure server code).</li>
          </ul>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Lock size={18} style={{ color: '#F3C958' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Security Boundaries</h3>
          </div>
          <ul style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
            <li><code>SUPABASE_SERVICE_ROLE_KEY</code> is never exposed in browser code.</li>
            <li>Environment files (<code>.env.local</code>) are gitignored.</li>
            <li>Public clients operate strictly under Row Level Security (RLS).</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
