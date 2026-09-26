import { trackPurchase } from '../../lib/analytics';
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Loader2,
  AlertCircle,
  Building2,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  getCheckoutStatus,
  getWorkbookDownloadUrl,
  type CheckoutStatusResult,
} from '../../lib/billing/billingClient';

export const CheckoutSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkoutSessionId = searchParams.get('checkout_session_id') || searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CheckoutStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutSessionId) {
      setError('No checkout session identifier was provided in the return link.');
      setLoading(false);
      return;
    }

    let pollAttempts = 0;
    const maxPollAttempts = 8;
    let timeoutId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const result = await getCheckoutStatus(checkoutSessionId);
        setStatus(result);

        const isPaid =
          result.checkout.status === 'paid' ||
          result.checkout.status === 'complete' ||
          result.workbookOrder?.payment_status === 'paid' ||
          result.subscription?.status === 'active' ||
          result.subscription?.status === 'trialing';

        if (isPaid || pollAttempts >= maxPollAttempts) {
          setLoading(false);
          if (isPaid && checkoutSessionId) {
            trackPurchase(checkoutSessionId, 49, 'AUD');
          }
        } else {
          pollAttempts += 1;
          timeoutId = setTimeout(checkStatus, 2000);
        }
      } catch (err: any) {
        console.error('Checkout verification error:', err);
        if (pollAttempts < maxPollAttempts) {
          pollAttempts += 1;
          timeoutId = setTimeout(checkStatus, 2000);
        } else {
          setError(err.message || 'Unable to confirm checkout status. If your payment succeeded, your entitlement is being activated.');
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkoutSessionId]);

  const handleDownloadWorkbook = async () => {
    if (!status?.workbookLicence?.id) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const { downloadUrl } = await getWorkbookDownloadUrl(status.workbookLicence.id);
      window.location.href = downloadUrl;
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Failed to generate secure download link. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getOfferTitle = (offerKey?: string) => {
    switch (offerKey) {
      case 'workbook_starter':
        return 'Meeting Mastery Workbook | Starter Pack (Edition 3.0)';
      case 'workbook_standard':
        return 'Meeting Mastery Workbook | Standard Pack (Edition 3.0)';
      case 'workbook_pro_edition':
        return 'Meeting Mastery Workbook | Pro Edition Pack + Workspace Team (Edition 3.0)';
      case 'workspace_starter':
        return 'Concludo Workspace | Starter Subscription';
      case 'workspace_pro_subscription':
        return 'Concludo Workspace | Pro Subscription';
      case 'workspace_team':
        return 'Concludo Workspace | Team Subscription';
      default:
        return 'Concludo Order';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#16263F',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#21395C',
          borderRadius: '16px',
          border: '1px solid rgba(226, 181, 60, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #16263F 0%, #21395C 100%)',
            padding: '24px 28px',
            borderBottom: '1px solid rgba(226, 181, 60, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Building2 size={24} color="#E2B53C" />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#E2B53C' }}>
              CONCLUDO PTY LTD | SECURE PAYMENT
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Order Confirmation
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '32px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Loader2 size={44} className="spin-animation" style={{ color: '#E2B53C', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
                Confirming Your Payment
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
                Securely verifying transaction completion with Stripe and activating your entitlement...
              </p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <AlertCircle size={44} style={{ color: '#f87171', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: '#f87171' }}>
                Payment Verification Notice
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '24px' }}>
                {error}
              </p>
              <Link
                to="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#E2B53C',
                  color: '#16263F',
                  fontWeight: 600,
                  padding: '10px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                Go to Workspace Dashboard <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <CheckCircle2 size={52} style={{ color: '#4ade80', margin: '0 auto 14px' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>
                  Payment Confirmed!
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.92rem' }}>
                  Thank you for your order. Your purchase has been processed securely via Stripe.
                </p>
              </div>

              {/* Order Details Card */}
              <div
                style={{
                  backgroundColor: '#16263F',
                  borderRadius: '10px',
                  padding: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                  <FileCheck size={22} color="#E2B53C" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Item Ordered</div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.98rem' }}>
                      {getOfferTitle(status?.checkout.offer_key)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.84rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#94a3b8' }}>Status: </span>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>Active & Verified</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Quantity: </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{status?.checkout.quantity || 1}</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>GST: </span>
                    <span style={{ color: '#f8fafc' }}>No GST charged</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Currency: </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>Australian Dollars (AUD)</span>
                  </div>
                </div>
              </div>

              {/* Download Section for Workbooks */}
              {status?.workbookLicence && (
                <div
                  style={{
                    backgroundColor: 'rgba(226, 181, 60, 0.08)',
                    border: '1px solid #E2B53C',
                    borderRadius: '10px',
                    padding: '20px',
                    marginBottom: '24px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#E2B53C', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px' }}>
                    <ShieldCheck size={16} />
                    {status?.checkout.offer_key === 'workbook_pro_edition'
                      ? 'ANNUAL ORGANISATION LICENCE & TEAM WORKSPACE ACTIVATED'
                      : 'PERMANENT LICENCE ACTIVATED'}
                  </div>
                  {status?.checkout.offer_key === 'workbook_pro_edition' && (
                    <div style={{ backgroundColor: '#16263F', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', border: '1px solid rgba(226, 181, 60, 0.25)', fontSize: '0.85rem' }}>
                      <span style={{ color: '#E2B53C', fontWeight: 600 }}>Included Workspace Team Access: </span>
                      <span style={{ color: '#f8fafc' }}>
                        {status.checkout.variant_key === 'up_to_20' ? '5 Team Seats' : status.checkout.variant_key === '21_to_100' ? '10 Team Seats' : '25 Team Seats'}
                      </span>
                    </div>
                  )}
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>
                    Your Download Pack is Ready
                  </h3>
                  <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '16px' }}>
                    Click below to generate a secure, authenticated download link directly to your device.
                  </p>

                  {downloadError && (
                    <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>
                      {downloadError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadWorkbook}
                    disabled={downloading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: '#E2B53C',
                      color: '#16263F',
                      fontWeight: 700,
                      fontSize: '0.96rem',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(226, 181, 60, 0.3)',
                    }}
                  >
                    {downloading ? (
                      <>
                        <Loader2 size={18} className="spin-animation" />
                        <span>Generating Secure Link...</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span>Download Complete Workbook Pack (ZIP)</span>
                      </>
                    )}
                  </button>

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px' }}>
                    Download links are time-limited for security. You can re-download this pack anytime from your Account page.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#16263F',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  Enter Workspace Dashboard <ArrowRight size={16} />
                </Link>

                <Link
                  to="/account"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: '#94a3b8',
                    padding: '8px 12px',
                    fontSize: '0.86rem',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  View Account & Licences
                </Link>
              </div>

              {/* Legal Disclaimer */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.72rem',
                  color: '#64748b',
                  textAlign: 'center',
                  lineHeight: '1.4',
                }}
              >
                All prices are indicative and in Australian dollars. Concludo Pty Ltd is not registered for GST, so no GST is charged. Melbourne, Australia. ACN 701 605 898.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
