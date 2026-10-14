import React, { useState } from 'react';
import { X, Mail, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { integrationsHubService } from '../../lib/integrations/hubRegistry';

export interface EmailConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (connection?: any) => void;
  defaultEmail?: string | null;
}

export const EmailConnectModal: React.FC<EmailConnectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEmail = '',
}) => {
  const [selectedProvider, setSelectedProvider] = useState<'microsoft_outlook' | 'gmail'>('microsoft_outlook');
  const [accountEmail, setAccountEmail] = useState(defaultEmail || '');
  const [step, setStep] = useState<'idle' | 'starting' | 'waiting_auth' | 'checking' | 'completed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setStep('idle');
      setErrorMsg(null);
      setSuccessMsg(null);
      setActiveConnectionId(null);
      if (defaultEmail && !accountEmail) {
        setAccountEmail(defaultEmail);
      }
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const isMicrosoft = selectedProvider === 'microsoft_outlook';
  const providerName = isMicrosoft ? 'Microsoft Outlook / 365' : 'Google Workspace / Gmail';

  const handleStartConnect = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setStep('starting');

    const emailHint = accountEmail.trim();

    try {
      sessionStorage.setItem('oauth_return_path', '/email');
      const nativeSession = await integrationsHubService.startNativeOAuth(selectedProvider, {
        email_hint: emailHint || undefined,
        is_new: true,
      });

      setActiveConnectionId(nativeSession.connection_id);
      setStep('waiting_auth');

      const width = 560;
      const height = 680;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
      const popup = window.open(
        nativeSession.auth_url,
        'concludo_email_oauth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = nativeSession.auth_url;
        return;
      }

      let finished = false;

      const finishSuccess = async (connectionData: any) => {
        if (finished) return;
        finished = true;
        setStep('checking');
        const connections = await integrationsHubService.getConnections();
        const targetId = connectionData?.connection_id || nativeSession.connection_id;
        const conn = targetId
          ? connections.find((c) => c.id === targetId) || connections.find((c) => c.provider_id === selectedProvider && c.status === 'connected')
          : connections.find((c) => c.provider_id === selectedProvider && c.status === 'connected');

        setStep('completed');
        const account = conn?.account_label || connectionData?.account_label || emailHint || providerName;
        setSuccessMsg(`Connected ${providerName} (${account}) successfully. Your mailbox is ready to scan.`);
        if (onSuccess) onSuccess(conn || connectionData);
      };

      const handleOAuthMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'CONCLUDO_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleOAuthMessage);
          if (timer) clearInterval(timer);
          finishSuccess(event.data.data);
        } else if (event.data?.type === 'CONCLUDO_OAUTH_ERROR') {
          window.removeEventListener('message', handleOAuthMessage);
          if (timer) clearInterval(timer);
          setStep('idle');
          setErrorMsg(event.data.error || 'Connection cancelled or denied on sign-in page.');
        }
      };

      window.addEventListener('message', handleOAuthMessage);

      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleOAuthMessage);

          if (!finished) {
            setStep('checking');
            const connections = await integrationsHubService.getConnections();
            const targetId = nativeSession.connection_id;
            const conn = targetId
              ? connections.find((c) => c.id === targetId) || connections.find((c) => c.provider_id === selectedProvider && c.status === 'connected')
              : connections.find((c) => c.provider_id === selectedProvider && c.status === 'connected');

            if (conn && conn.status === 'connected') {
              finishSuccess(conn);
            } else {
              setStep('idle');
              try {
                await integrationsHubService.cancelConnection(targetId, selectedProvider);
              } catch (_) {}
              setErrorMsg('Sign-in was closed before completion. Please try connecting again.');
            }
          }
        }
      }, 1000);
    } catch (err: any) {
      setStep('idle');
      setErrorMsg(err.message || 'Failed to initiate sign-in session.');
    }
  };

  const handleModalClose = async () => {
    if (step === 'checking' || step === 'starting') return;
    if (step !== 'completed' && activeConnectionId) {
      try {
        await integrationsHubService.cancelConnection(activeConnectionId, selectedProvider);
      } catch (_) {}
    }
    setStep('idle');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div
      className="ecc-connect-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(6, 10, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="ecc-connect-modal-box"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '32rem',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(226, 181, 60, 0.25)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          color: '#f8fafc',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '10px',
                backgroundColor: 'rgba(226, 181, 60, 0.12)',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                borderRadius: '12px',
                color: '#e2b53c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", color: '#ffffff' }}>
                Connect Your Mailbox
              </h2>
              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                One-click native OAuth sign-in with your email provider
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12.5px' }}>
          {/* Provider Selector Cards */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#e2b53c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Choose Email Provider
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedProvider('microsoft_outlook')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: selectedProvider === 'microsoft_outlook' ? '2px solid #e2b53c' : '1px solid #1e293b',
                  backgroundColor: selectedProvider === 'microsoft_outlook' ? 'rgba(226, 181, 60, 0.08)' : '#090d16',
                  color: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Microsoft 365
                </span>
                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                  Outlook, Live, Hotmail, M365 Work & Personal
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProvider('gmail')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: selectedProvider === 'gmail' ? '2px solid #e2b53c' : '1px solid #1e293b',
                  backgroundColor: selectedProvider === 'gmail' ? 'rgba(226, 181, 60, 0.08)' : '#090d16',
                  color: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Google Workspace
                </span>
                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                  Gmail & Google Workspace accounts
                </span>
              </button>
            </div>
          </div>

          {/* Account Email field */}
          <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
            <label htmlFor="ecc-modal-email-input" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '6px' }}>
              <span>Email address (optional)</span>
              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 400 }}>Directs sign-in to this account</span>
            </label>
            <input
              id="ecc-modal-email-input"
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder={isMicrosoft ? 'e.g. el_cortez87@live.com or you@company.com' : 'e.g. personal@gmail.com or you@company.com'}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Safe By Default Guarantee */}
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2b53c', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <ShieldCheck size={14} />
              <span>Concludo Proposes; A Person Disposes</span>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '11.5px', lineHeight: 1.5 }}>
              Concludo connects with <strong>read-only</strong> access ({isMicrosoft ? 'Mail.Read' : 'gmail.readonly'}) to audit messages, decisions, and deadlines. Concludo <strong>never</strong> sends, deletes, alters, or archives emails, and never sees your password.
            </p>
          </div>

          {/* Feedback states */}
          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'starting' && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <RefreshCw size={14} color="#e2b53c" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Preparing secure OAuth sign-in session...</span>
            </div>
          )}

          {step === 'waiting_auth' && (
            <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={14} color="#e2b53c" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Waiting for sign-in window to complete...</span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '22px' }}>
                Sign into your {isMicrosoft ? 'Microsoft' : 'Google'} account in the popup window and click Allow.
              </span>
            </div>
          )}

          {step === 'checking' && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#090d16', border: '1px solid #1e293b', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <RefreshCw size={14} color="#22c55e" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Securing tokens and verifying mailbox connection...</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
          {step === 'completed' ? (
            <button
              type="button"
              onClick={handleModalClose}
              style={{
                padding: '8px 20px',
                backgroundColor: '#e2b53c',
                color: '#060a12',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          ) : step === 'waiting_auth' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('idle')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartConnect}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#e2b53c',
                  color: '#060a12',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={14} /> Re-open sign-in window
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={step === 'checking' || step === 'starting'}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  opacity: step === 'checking' || step === 'starting' ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartConnect}
                disabled={step !== 'idle'}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#e2b53c',
                  color: '#060a12',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: step !== 'idle' ? 0.6 : 1,
                }}
              >
                <ExternalLink size={14} />
                <span>{isMicrosoft ? 'Connect with Microsoft' : 'Connect with Google'}</span>
              </button>
            </>
          )}
        </div>

        {/* Independence Disclaimer */}
        <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', margin: 0 }}>
          Concludo is an independent product. It is not affiliated with or endorsed by Microsoft, Google or any other app maker named here.
        </div>
      </div>
    </div>
  );
};
