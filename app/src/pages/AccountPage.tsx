import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Zap,
  Calendar,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Save,
  BookOpen,
  Download,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS, ROLE_LABELS } from '../lib/profiles/types';
import {
  fetchUserWorkbookLicences,
  fetchUserSubscription,
  getWorkbookDownloadUrl,
  openBillingPortal,
  type UserWorkbookLicence,
  type UserSubscription,
} from '../lib/billing/billingClient';

export const AccountPage: React.FC = () => {
  const { user, profile, profileLoading, updateFullName, refreshProfile } = useAuth();

  const [fullNameInput, setFullNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [repairing, setRepairing] = useState(false);

  // Billing & Workbook States
  const [licences, setLicences] = useState<UserWorkbookLicence[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Sync input with profile when loaded
  useEffect(() => {
    if (profile) {
      setFullNameInput(profile.full_name || '');
    }
  }, [profile]);

  // Load billing & workbook data
  useEffect(() => {
    const loadBillingData = async () => {
      try {
        const [userLicences, userSub] = await Promise.all([
          fetchUserWorkbookLicences(),
          fetchUserSubscription(),
        ]);
        setLicences(userLicences);
        setSubscription(userSub);
      } catch (err) {
        console.error('Error loading billing records:', err);
      } finally {
        setLoadingBilling(false);
      }
    };

    if (user) {
      loadBillingData();
    }
  }, [user]);

  const handleUpdateFullName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    setSaving(true);
    const { profile: updated, error } = await updateFullName(fullNameInput);
    setSaving(false);

    if (error) {
      setErrorMessage(error.message || 'Failed to update full name. Please try again.');
    } else if (updated) {
      setSuccessMessage('Full name updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  const handleManualRepair = async () => {
    setRepairing(true);
    setErrorMessage('');
    try {
      await refreshProfile();
    } catch (err: any) {
      setErrorMessage(err.message || 'Profile repair attempt failed.');
    } finally {
      setRepairing(false);
    }
  };

  const handleDownloadWorkbook = async (licenceId: string) => {
    setDownloadingId(licenceId);
    try {
      const { downloadUrl } = await getWorkbookDownloadUrl(licenceId);
      window.location.href = downloadUrl;
    } catch (err: any) {
      alert(err.message || 'Failed to generate download URL. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { portalUrl } = await openBillingPortal();
      window.location.href = portalUrl;
    } catch (err: any) {
      setPortalError(err.message || 'Unable to open billing portal.');
      setPortalLoading(false);
    }
  };

  // Format created date to Australian English locale
  const formatAustralianDate = (isoString?: string) => {
    if (!isoString) return 'Not available';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const getWorkbookTitle = (assetKey: string) => {
    switch (assetKey) {
      case 'workbook_starter':
        return 'Meeting Mastery Workbook | Starter Pack (Edition 3.0)';
      case 'workbook_standard':
        return 'Meeting Mastery Workbook | Standard Pack (Edition 3.0)';
      case 'workbook_pro_edition':
        return 'Meeting Mastery Workbook | Pro Edition Pack (Edition 3.0)';
      default:
        return 'Meeting Mastery Workbook Pack';
    }
  };

  // 1. Loading State
  if (profileLoading && !profile) {
    return (
      <div>
        <div className="page-header">
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>IDENTITY & CREDENTIALS</span>
          </div>
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">Manage personal profile details and security credentials.</p>
        </div>

        <div className="content-card" style={{ maxWidth: '680px', padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={36} className="spin-animation" style={{ color: '#f3c958', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Retrieving Profile Data
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
            Loading your identity credentials and permissions from Supabase...
          </p>
        </div>
      </div>
    );
  }

  // 2. Error / Missing Profile State
  if (!profile) {
    return (
      <div>
        <div className="page-header">
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>IDENTITY & CREDENTIALS</span>
          </div>
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">Manage personal profile details and security credentials.</p>
        </div>

        <div className="content-card" style={{ maxWidth: '680px', textAlign: 'center', padding: '36px 24px' }}>
          <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            Profile Record Not Found
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 20px', lineHeight: '1.5' }}>
            Your authentication session is active, but your profile details could not be retrieved. Click below to self-repair.
          </p>
          <button
            type="button"
            className="btn-gold"
            onClick={handleManualRepair}
            disabled={repairing}
            style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {repairing ? <Loader2 size={16} className="spin-animation" /> : <RefreshCw size={16} />}
            <span>Repair Profile Record</span>
          </button>
        </div>
      </div>
    );
  }

  const planLabel = PLAN_LABELS[profile.plan] || profile.plan;
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const userInitial = (profile.full_name?.trim() || profile.email || 'A')[0].toUpperCase();

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>IDENTITY & CREDENTIALS</span>
        </div>
        <h1 className="page-title">Account & Purchases</h1>
        <p className="page-subtitle">Manage personal profile details, active subscriptions and purchased workbook packs.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '780px' }}>
        {/* Profile Card */}
        <div className="content-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '28px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #16263f 0%, #21395c 100%)',
                border: '2px solid #e2b53c',
                color: '#f3c958',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.4rem',
                boxShadow: '0 0 16px rgba(226, 181, 60, 0.25)',
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc' }}>
                {profile.full_name || 'Anonymous User'}
              </h2>
              <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '2px' }}>
                {profile.email}
              </div>
            </div>
          </div>

          {successMessage && (
            <div
              style={{
                background: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#34d399',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="auth-alert-error" style={{ marginBottom: '20px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleUpdateFullName} style={{ marginBottom: '28px' }}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="profile-full-name">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="#f3c958" />
                  <span>Full name</span>
                </span>
              </label>
              <input
                id="profile-full-name"
                type="text"
                className="form-input"
                placeholder="e.g. Anthony Cortez"
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-gold"
                disabled={saving || fullNameInput.trim() === (profile.full_name || '').trim()}
                style={{ padding: '8px 20px', fontSize: '0.88rem' }}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="spin-animation" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Save Full Name</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* System Attributes */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '22px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>
              System Attributes
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Mail size={16} color="#94a3b8" />
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Email address</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8fafc' }}>{profile.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                  <Lock size={12} /> Auth Managed
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(9, 14, 26, 0.6)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Calendar size={16} color="#94a3b8" />
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Account Created</div>
                    <div style={{ fontWeight: 500, fontSize: '0.88rem', color: '#f8fafc' }}>
                      {formatAustralianDate(profile.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                  <Lock size={12} /> Immutable
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="content-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E2B53C', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                <CreditCard size={16} />
                WORKSPACE SUBSCRIPTION
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                Billing & Plan Details
              </h2>
            </div>
            <Link
              to="/checkout"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(226, 181, 60, 0.15)',
                color: '#E2B53C',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Browse All Plans <ArrowRight size={14} />
            </Link>
          </div>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(9, 14, 26, 0.6)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Current Tier</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>
                  {planLabel}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#4ade80',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.25)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontWeight: 600,
                }}
              >
                {subscription ? subscription.status.toUpperCase() : 'ACTIVE'}
              </span>
            </div>

            {subscription?.current_period_end && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8rem', color: '#94a3b8' }}>
                Next renewal date: {formatAustralianDate(subscription.current_period_end)}
              </div>
            )}
          </div>

          {portalError && (
            <div style={{ color: '#f87171', fontSize: '0.84rem', marginBottom: '12px' }}>
              {portalError}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenCustomerPortal}
            disabled={portalLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#21395C',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: portalLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {portalLoading ? (
              <>
                <Loader2 size={16} className="spin-animation" />
                <span>Opening Stripe Portal...</span>
              </>
            ) : (
              <>
                <ExternalLink size={16} />
                <span>Manage Payment Methods & Invoices in Stripe</span>
              </>
            )}
          </button>
        </div>

        {/* Purchased Workbooks Card */}
        <div className="content-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E2B53C', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                <BookOpen size={16} />
                PURCHASED WORKBOOKS
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                Meeting Mastery Workbook Licences
              </h2>
            </div>
            <Link
              to="/checkout?offer=workbook_starter"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(226, 181, 60, 0.15)',
                color: '#E2B53C',
                border: '1px solid rgba(226, 181, 60, 0.3)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Order Workbook <ArrowRight size={14} />
            </Link>
          </div>

          {loadingBilling ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Loader2 size={24} className="spin-animation" style={{ color: '#E2B53C', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>Loading licences...</div>
            </div>
          ) : licences.length === 0 ? (
            <div
              style={{
                padding: '24px',
                backgroundColor: 'rgba(9, 14, 26, 0.6)',
                borderRadius: '10px',
                textAlign: 'center',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
              }}
            >
              <BookOpen size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                No Workbook Licences Yet
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', maxWidth: '360px', margin: '0 auto 16px' }}>
                You have not purchased a Meeting Mastery Workbook package yet. Get the complete Edition 3.0 guide and templates.
              </p>
              <Link
                to="/checkout?offer=workbook_starter"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#E2B53C',
                  color: '#16263F',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  textDecoration: 'none',
                }}
              >
                Browse Workbook Packages (from AU$49)
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {licences.map((licence) => (
                <div
                  key={licence.id}
                  style={{
                    backgroundColor: 'rgba(9, 14, 26, 0.6)',
                    borderRadius: '10px',
                    padding: '16px',
                    border: '1px solid rgba(226, 181, 60, 0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#E2B53C" />
                      <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#f8fafc' }}>
                        {getWorkbookTitle(licence.asset_key)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                      Licence Type: <strong style={{ color: '#cbd5e1' }}>{licence.licence_type}</strong> | Issued: {formatAustralianDate(licence.valid_from)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadWorkbook(licence.id)}
                    disabled={downloadingId === licence.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#E2B53C',
                      color: '#16263F',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: downloadingId === licence.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {downloadingId === licence.id ? (
                      <>
                        <Loader2 size={16} className="spin-animation" />
                        <span>Generating Link...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Download Pack (ZIP)</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
