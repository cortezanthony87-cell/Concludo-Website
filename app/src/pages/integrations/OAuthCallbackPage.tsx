import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react';
import { integrationsHubService } from '../../lib/integrations/hubRegistry';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'initializing' | 'exchanging' | 'success' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for provider error (e.g. user denied or cancelled authorization)
    if (error) {
      setStatus('error');
      const desc = errorDescription || error;
      const friendlyMsg =
        error === 'access_denied'
          ? 'Authorisation was cancelled or denied on the sign-in page.'
          : `Authorisation error from provider: ${desc}`;
      setErrorMessage(friendlyMsg);

      if (window.opener) {
        try {
          window.opener.postMessage(
            {
              type: 'CONCLUDO_OAUTH_ERROR',
              error: friendlyMsg,
            },
            window.location.origin
          );
        } catch (e) {
          console.warn('Could not postMessage to opener:', e);
        }
      }
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMessage('Missing required authorization code or state parameter.');
      return;
    }

    // Exchange code and state
    setStatus('exchanging');
    let isSubscribed = true;

    integrationsHubService
      .completeNativeOAuth({ code, state })
      .then((res) => {
        if (!isSubscribed) return;
        setStatus('success');
        setAccountEmail(res.account_label || null);
        setProviderId(res.provider_id || null);

        if (window.opener) {
          try {
            window.opener.postMessage(
              {
                type: 'CONCLUDO_OAUTH_SUCCESS',
                data: res,
              },
              window.location.origin
            );
          } catch (e) {
            console.warn('Could not postMessage to opener:', e);
          }
          setTimeout(() => {
            window.close();
          }, 1200);
        } else {
          setTimeout(() => {
            navigate(`/integrations?connected=${res.provider_id || ''}`);
          }, 2000);
        }
      })
      .catch((err: any) => {
        if (!isSubscribed) return;
        setStatus('error');
        const errDetail = err.message || 'Verification failed. Please try connecting again.';
        setErrorMessage(errDetail);

        if (window.opener) {
          try {
            window.opener.postMessage(
              {
                type: 'CONCLUDO_OAUTH_ERROR',
                error: errDetail,
              },
              window.location.origin
            );
          } catch (e) {
            console.warn('Could not postMessage to opener:', e);
          }
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#060a12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', sans-serif",
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#16263F',
          borderRadius: '16px',
          border: '1px solid rgba(226, 181, 60, 0.25)',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}
      >
        {/* Concludo Brand Header */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 14px',
              borderRadius: '24px',
              backgroundColor: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              color: '#e2b53c',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '14px',
            }}
          >
            <ShieldCheck size={15} color="#e2b53c" />
            Native Integration Security
          </div>
          <h1
            style={{
              margin: '0 0 6px 0',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '22px',
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            Concludo Workspace
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Direct encrypted authentication
          </p>
        </div>

        {/* Status Content */}
        {(status === 'initializing' || status === 'exchanging') && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'inline-block', marginBottom: '20px' }}>
              <Loader2
                size={48}
                color="#e2b53c"
                style={{ animation: 'spin 1s linear infinite' }}
              />
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 8px 0',
                color: '#ffffff',
              }}
            >
              Verifying Account Authorisation
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 auto', maxWidth: '340px', lineHeight: 1.5 }}>
              Exchanging code and securing connection credentials directly in your Concludo workspace...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                marginBottom: '18px',
              }}
            >
              <CheckCircle2 size={36} color="#22c55e" />
            </div>
            <h2
              style={{
                fontSize: '19px',
                fontWeight: 600,
                margin: '0 0 8px 0',
                color: '#ffffff',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Connected Successfully
            </h2>
            {accountEmail && (
              <div
                style={{
                  display: 'inline-block',
                  margin: '8px 0 16px 0',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {accountEmail}
              </div>
            )}
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              {window.opener
                ? 'Returning to Concludo Workspace...'
                : 'Redirecting to your Integrations dashboard...'}
            </p>
            {window.opener ? (
              <button
                onClick={() => window.close()}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#e2b53c',
                  color: '#0b1220',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Window
              </button>
            ) : (
              <Link
                to="/integrations"
                style={{
                  display: 'inline-block',
                  padding: '8px 18px',
                  backgroundColor: '#e2b53c',
                  color: '#0b1220',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open Integrations
              </Link>
            )}
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                marginBottom: '18px',
              }}
            >
              <AlertTriangle size={34} color="#ef4444" />
            </div>
            <h2
              style={{
                fontSize: '19px',
                fontWeight: 600,
                margin: '0 0 8px 0',
                color: '#ffffff',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Authorisation Incomplete
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: '#f87171',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                padding: '10px 14px',
                borderRadius: '8px',
                margin: '12px 0 20px 0',
                lineHeight: 1.45,
              }}
            >
              {errorMessage || 'Unable to complete connection.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {window.opener && (
                <button
                  onClick={() => window.close()}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Close Window
                </button>
              )}
              <Link
                to="/integrations"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  backgroundColor: '#e2b53c',
                  color: '#0b1220',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} />
                Return to Integrations
              </Link>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
