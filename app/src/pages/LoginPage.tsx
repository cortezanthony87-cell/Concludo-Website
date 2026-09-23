import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Sparkles, Lock, Mail, AlertCircle, Loader2, Shield, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { getAuthErrorMessage } from '../lib/auth/authErrors';
import { lookupSSOByEmail, logAuditEvent } from '../lib/enterprise/enterpriseClient';
import type { OrganizationSSOConfig } from '../lib/enterprise/types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, supabase } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // SSO state
  const [ssoData, setSsoData] = useState<{
    ssoEnabled: boolean;
    ssoConfig?: OrganizationSSOConfig;
    domain?: string;
  } | null>(null);
  const [checkingSSO, setCheckingSSO] = useState(false);
  const [ssoRedirecting, setSsoRedirecting] = useState(false);

  // Check SSO when email domain changes
  const checkEmailSSO = useCallback(
    async (emailToTest: string) => {
      const parts = emailToTest.trim().split('@');
      if (parts.length === 2 && parts[1].includes('.')) {
        setCheckingSSO(true);
        try {
          const res = await lookupSSOByEmail(supabase, emailToTest.trim());
          if (res.ssoEnabled) {
            setSsoData(res);
          } else {
            setSsoData(null);
          }
        } catch {
          setSsoData(null);
        } finally {
          setCheckingSSO(false);
        }
      } else {
        setSsoData(null);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.includes('@')) {
        checkEmailSSO(email);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [email, checkEmailSSO]);


  const handleQuickDemoAccess = async () => {
    setLoading(true);
    setErrorMessage("");
    const { error } = await signIn("demo@concludo.au", "ConcludoDemo2026!");
    setLoading(false);
    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "true") {
      handleQuickDemoAccess();
    }
  }, [location.search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(trimmedEmail, password);
    setLoading(false);

    if (error) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }

    const from = (location.state as any)?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleSSOLogin = async () => {
    if (!ssoData?.ssoConfig) return;
    setSsoRedirecting(true);

    try {
      // Log SSO login attempt in enterprise audit trail
      await logAuditEvent(supabase, {
        organizationId: ssoData.ssoConfig.organization_id,
        action: 'sso_login',
        entityType: 'authentication',
        entityId: email.trim(),
        details: {
          provider: ssoData.ssoConfig.provider_name,
          protocol: ssoData.ssoConfig.protocol,
          domain: ssoData.domain,
        },
      });

      // If IdP Login URL is configured, redirect
      if (ssoData.ssoConfig.login_url) {
        window.location.href = ssoData.ssoConfig.login_url;
      } else {
        setErrorMessage(
          `SSO configuration for ${ssoData.ssoConfig.provider_name} has no login URL configured. Please contact your enterprise administrator.`
        );
        setSsoRedirecting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Single Sign-On.');
      setSsoRedirecting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-logo">
            <div className="brand-emblem" style={{ width: '36px', height: '36px' }}>
              <div className="brand-emblem-inner" style={{ width: '14px', height: '14px' }} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>CONCLUDO</span>
            <span className="brand-title-badge">WORKSPACE</span>
          </div>
          <h1 className="auth-title">Log in to Workspace</h1>
          <p className="auth-subtitle">
            Enter your email and password to access your workspace
          </p>
        </div>

        {errorMessage && (
          <div className="auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* SSO Detected Banner */}
        {ssoData?.ssoEnabled && ssoData.ssoConfig && (
          <div
            style={{
              marginBottom: '20px',
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(226, 181, 60, 0.08)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <KeyRound size={16} color="#e2b53c" />
              <span
                style={{
                  fontWeight: 600,
                  color: '#f8fafc',
                  fontSize: '0.88rem',
                }}
              >
                Single Sign-On Available for {ssoData.domain}
              </span>
            </div>
            <p
              style={{
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '12px',
                lineHeight: 1.4,
              }}
            >
              Your enterprise organization supports authentication via{' '}
              <strong style={{ color: '#e2b53c' }}>
                {ssoData.ssoConfig.provider_name}
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={handleSSOLogin}
              disabled={ssoRedirecting}
              className="btn-gold"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                fontWeight: 600,
              }}
            >
              {ssoRedirecting ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Connecting to IdP...</span>
                </>
              ) : (
                <>
                  <Shield size={16} />
                  <span>Continue with SSO ({ssoData.ssoConfig.provider_name})</span>
                </>
              )}
            </button>
            <div
              style={{
                textAlign: 'center',
                marginTop: '12px',
                fontSize: '0.78rem',
                color: '#94a3b8',
              }}
            >
              or sign in with password below
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="login-email"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Mail size={15} color="#f3c958" />
              <span>Email address</span>
              {checkingSSO && (
                <Loader2 size={12} className="spin-animation" color="#94a3b8" style={{ marginLeft: 'auto' }} />
              )}
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              onBlur={() => checkEmailSSO(email)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                alignItems: 'center',
              }}
            >
              <label
                className="form-label"
                htmlFor="login-password"
                style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Lock size={15} color="#f3c958" />
                <span>Password</span>
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 500 }}
              >
                Forgot Password
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-gold"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div style={{ marginTop: "18px", marginBottom: "16px", position: "relative", textAlign: "center" }}>
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(226, 181, 60, 0.2)" }} />
            <span style={{ position: "relative", background: "#0d1626", padding: "0 12px", fontSize: "0.78rem", color: "#94a3b8", letterSpacing: "0.04em" }}>
              OR TRY THE WORKSPACE DIRECTLY
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoAccess}
            disabled={loading}
            className="btn-secondary"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "11px 16px",
              fontWeight: 600,
              fontSize: "0.92rem",
              background: "rgba(226, 181, 60, 0.12)",
              border: "1px solid rgba(226, 181, 60, 0.45)",
              color: "#f7d57a",
              cursor: "pointer",
              borderRadius: "8px",
              transition: "all 0.2s ease"
            }}
          >
            <Sparkles size={16} color="#e2b53c" />
            <span>⚡ Quick Preview Access (Interactive Demo)</span>
          </button>
        </form>

        <div
          className="auth-footer"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}
        >
          <span>Don't have an account yet?</span>
          <Link to="/signup" style={{ color: '#f3c958', fontWeight: 600 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};
