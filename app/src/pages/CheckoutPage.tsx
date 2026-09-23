import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  Shield,
  BookOpen,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock,
  Layers,
  Users,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import {
  fetchBillingCatalog,
  createCheckoutSession,
  type BillingCatalogItem,
} from '../lib/billing/billingClient';

export const CheckoutPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signIn, signUp, authStatus } = useAuth();

  const urlOffer = searchParams.get('offer');
  const urlVariant = searchParams.get('variant');

  const [catalog, setCatalog] = useState<BillingCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedOfferKey, setSelectedOfferKey] = useState<string>(urlOffer || 'workbook_starter');
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>(urlVariant || 'one_time');
  const [teamSeats, setTeamSeats] = useState<number>(5);
  const [teamName, setTeamName] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'workbooks' | 'subscriptions'>(
    urlOffer?.startsWith('workspace') ? 'subscriptions' : 'workbooks'
  );

  // Auth form states for unauthenticated visitors
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Load active catalog from database
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const items = await fetchBillingCatalog();
        setCatalog(items);
      } catch (err) {
        console.error('Failed to load catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, []);

  // Update selection if URL parameters change
  useEffect(() => {
    if (urlOffer) {
      setSelectedOfferKey(urlOffer);
      if (urlOffer.startsWith('workspace')) {
        setActiveTab('subscriptions');
      } else {
        setActiveTab('workbooks');
      }
    }
    if (urlVariant) {
      setSelectedVariantKey(urlVariant);
    }
  }, [urlOffer, urlVariant]);

  const selectedItem = catalog.find(
    (item) => item.offer_key === selectedOfferKey && item.variant_key === selectedVariantKey
  );

  const handleSelectOffer = (offerKey: string, variantKey: string) => {
    setSelectedOfferKey(offerKey);
    let effectiveVariant = variantKey;
    if (offerKey === 'workbook_pro_edition' && (variantKey === 'one_time' || variantKey === 'monthly' || variantKey === 'annual')) {
      effectiveVariant = 'up_to_20';
    }
    setSelectedVariantKey(effectiveVariant);
    setCheckoutError(null);
    setSearchParams({ offer: offerKey, variant: effectiveVariant });
  };

  const handleInitiateCheckout = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const options = {
        offerKey: selectedOfferKey,
        variantKey: selectedVariantKey,
        quantity: selectedOfferKey === 'workspace_team' ? teamSeats : 1,
        teamName: (selectedOfferKey === 'workspace_team' || selectedOfferKey === 'workbook_pro_edition') ? teamName || 'My Team Workspace' : undefined,
      };

      const { checkoutUrl } = await createCheckoutSession(options);
      // Redirect to Stripe's secure hosted payment page
      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Unable to open checkout session. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);

    try {
      if (authMode === 'signup') {
        const res = await signUp(authEmail, authPassword, authFullName);
        if (res.error) {
          setAuthError(res.error.message);
          setSubmittingAuth(false);
          return;
        }
      } else {
        const res = await signIn(authEmail, authPassword);
        if (res.error) {
          setAuthError(res.error.message);
          setSubmittingAuth(false);
          return;
        }
      }

      // Once signed in, immediately trigger checkout
      const options = {
        offerKey: selectedOfferKey,
        variantKey: selectedVariantKey,
        quantity: selectedOfferKey === 'workspace_team' ? teamSeats : 1,
        teamName: (selectedOfferKey === 'workspace_team' || selectedOfferKey === 'workbook_pro_edition') ? teamName || 'My Team Workspace' : undefined,
      };

      const { checkoutUrl } = await createCheckoutSession(options);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error('Auth & Checkout error:', err);
      setAuthError(err.message || 'Failed to authenticate and launch checkout.');
      setSubmittingAuth(false);
    }
  };

  const formatPrice = (cents: number) => {
    const dollars = cents / 100;
    return `AU$${dollars.toLocaleString('en-AU')}`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#16263F',
        color: '#f8fafc',
        padding: '36px 16px 60px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        {/* Top Branding Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={28} color="#E2B53C" />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Concludo
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E2B53C', fontSize: '0.82rem', fontWeight: 600 }}>
            <Shield size={16} />
            <span>256-bit Encrypted Checkout | Powered by Stripe</span>
          </div>
        </div>

        {/* Page Title */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ color: '#E2B53C', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>
            PACKAGES & PRICING
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, margin: '0 0 12px', color: '#f8fafc' }}>
            Complete Your Concludo Order
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.98rem', maxWidth: '620px', margin: '0 auto' }}>
            Select your workbook package or workspace tier below. All orders include digital delivery, instant licensing, and Australian support.
          </p>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div
            style={{
              backgroundColor: '#21395C',
              padding: '4px',
              borderRadius: '10px',
              display: 'inline-flex',
              gap: '4px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('workbooks');
                if (!selectedOfferKey.startsWith('workbook')) {
                  handleSelectOffer('workbook_starter', 'one_time');
                }
              }}
              style={{
                backgroundColor: activeTab === 'workbooks' ? '#E2B53C' : 'transparent',
                color: activeTab === 'workbooks' ? '#16263F' : '#cbd5e1',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Meeting Mastery Workbooks (One-off)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('subscriptions');
                if (!selectedOfferKey.startsWith('workspace')) {
                  handleSelectOffer('workspace_starter', 'monthly');
                }
              }}
              style={{
                backgroundColor: activeTab === 'subscriptions' ? '#E2B53C' : 'transparent',
                color: activeTab === 'subscriptions' ? '#16263F' : '#cbd5e1',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Workspace Subscriptions (SaaS)
            </button>
          </div>
        </div>

        {/* Main Grid: Catalog Cards + Checkout Pane */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '28px', alignItems: 'start' }}>
          {/* Left Column: Product Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeTab === 'workbooks' ? (
              <>
                {/* Workbook Starter */}
                <div
                  onClick={() => handleSelectOffer('workbook_starter', 'one_time')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workbook_starter' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workbook_starter' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        INDIVIDUAL PRACTITIONER
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Meeting Mastery Workbook | Starter
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        80-page core guide for Australian professionals and consultants.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>AU$49</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>one-off payment</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginTop: '12px' }}>
                    <div>✓ Complete 80-page Workbook (Edition 3.0)</div>
                    <div>✓ The Ten Questions Decision Framework</div>
                    <div>✓ Meeting Cost Formula Worksheets</div>
                    <div>✓ Individual Single-User Licence</div>
                  </div>
                </div>

                {/* Workbook Standard */}
                <div
                  onClick={() => handleSelectOffer('workbook_standard', 'one_time')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workbook_standard' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workbook_standard' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        ADVANCED IMPLEMENTATION
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Meeting Mastery Workbook | Standard
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        232-page comprehensive reference guide with decision logs and specimens.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>AU$199</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>one-off payment</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginTop: '12px' }}>
                    <div>✓ Full 232-page Workbook Reference</div>
                    <div>✓ Decision Log Specimens & Templates</div>
                    <div>✓ Meeting Audit Scorecard System</div>
                    <div>✓ Lifetime Individual Licence</div>
                  </div>
                </div>

                {/* Workbook Pro Edition */}
                <div
                  onClick={() => handleSelectOffer('workbook_pro_edition', (selectedOfferKey === 'workbook_pro_edition' && selectedVariantKey !== 'one_time') ? selectedVariantKey : 'up_to_20')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workbook_pro_edition' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workbook_pro_edition' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        ORGANISATION & TEAM BUNDLE
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Meeting Mastery Workbook | Pro Edition + Workspace Team
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        232-page Workbook, Facilitator Guide, Workshop Decks, Run Sheets, plus full Workspace Team access.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>
                        {selectedVariantKey === 'up_to_20'
                          ? 'AU$950'
                          : selectedVariantKey === '21_to_100'
                          ? 'AU$2,400'
                          : 'AU$4,800'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>per year (annual subscription, renews annually until cancelled)</div>
                    </div>
                  </div>

                  {/* Team Size Selector for Pro Edition */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workbook_pro_edition', 'up_to_20');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 6px',
                        borderRadius: '6px',
                        border: selectedVariantKey === 'up_to_20' && selectedOfferKey === 'workbook_pro_edition' ? '1px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: selectedVariantKey === 'up_to_20' && selectedOfferKey === 'workbook_pro_edition' ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        lineHeight: 1.35,
                      }}
                    >
                      Up to 20 People<br /><span style={{ color: '#E2B53C' }}>+ 5 Team Seats</span><br />(AU$950/yr)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workbook_pro_edition', '21_to_100');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 6px',
                        borderRadius: '6px',
                        border: selectedVariantKey === '21_to_100' && selectedOfferKey === 'workbook_pro_edition' ? '1px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: selectedVariantKey === '21_to_100' && selectedOfferKey === 'workbook_pro_edition' ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        lineHeight: 1.35,
                      }}
                    >
                      21 to 100 People<br /><span style={{ color: '#E2B53C' }}>+ 10 Team Seats</span><br />(AU$2,400/yr)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workbook_pro_edition', '101_to_500');
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 6px',
                        borderRadius: '6px',
                        border: selectedVariantKey === '101_to_500' && selectedOfferKey === 'workbook_pro_edition' ? '1px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: selectedVariantKey === '101_to_500' && selectedOfferKey === 'workbook_pro_edition' ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        lineHeight: 1.35,
                      }}
                    >
                      101 to 500 People<br /><span style={{ color: '#E2B53C' }}>+ 25 Team Seats</span><br />(AU$4,800/yr)
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    <div>✓ 232-page Workbook + Facilitator Guide</div>
                    <div>✓ Workshop Slides (Keynote & PPTX) + Run Sheets</div>
                    <div>✓ 12-Month Organisation Internal Licence</div>
                    <div style={{ color: '#E2B53C', fontWeight: 600 }}>
                      ✓ Included Workspace Team ({selectedVariantKey === 'up_to_20' ? '5 seats' : selectedVariantKey === '21_to_100' ? '10 seats' : '25 seats'})
                    </div>
                  </div>

                  {/* Team Workspace Name for Pro Edition */}
                  {selectedOfferKey === 'workbook_pro_edition' && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                      <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                        Team Workspace Name (for included Workspace subscription):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Organisation Workspace"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: '#16263F',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#f8fafc',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          width: '100%',
                          maxWidth: '300px',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Workspace Starter */}
                <div
                  onClick={() => handleSelectOffer('workspace_starter', selectedVariantKey === 'annual' ? 'annual' : 'monthly')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workspace_starter' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workspace_starter' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        INDIVIDUAL WORKSPACE
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Workspace Starter
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        Turn transcripts into structured summaries and tracked action items.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>
                        {selectedVariantKey === 'annual' ? 'AU$99' : 'AU$12'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {selectedVariantKey === 'annual' ? 'per year (annual subscription, renews annually until cancelled)' : 'per month (renews monthly until cancelled)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', marginBottom: '10px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workspace_starter', 'monthly');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: selectedVariantKey === 'monthly' && selectedOfferKey === 'workspace_starter' ? '1px solid #E2B53C' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedVariantKey === 'monthly' && selectedOfferKey === 'workspace_starter' ? 'rgba(226,181,60,0.2)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Monthly (AU$12/mo)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workspace_starter', 'annual');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: selectedVariantKey === 'annual' && selectedOfferKey === 'workspace_starter' ? '1px solid #E2B53C' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedVariantKey === 'annual' && selectedOfferKey === 'workspace_starter' ? 'rgba(226,181,60,0.2)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Annual (AU$99/yr)
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    <div>✓ Up to 10 Transcripts / month</div>
                    <div>✓ Action Item Tracker & Exports</div>
                    <div>✓ Up to 3 Active Projects</div>
                    <div>✓ Australian Cloud Storage</div>
                  </div>
                </div>

                {/* Workspace Pro Subscription */}
                <div
                  onClick={() => handleSelectOffer('workspace_pro_subscription', selectedVariantKey === 'annual' ? 'annual' : 'monthly')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workspace_pro_subscription' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workspace_pro_subscription' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ position: 'absolute', top: '-10px', right: '18px', backgroundColor: '#E2B53C', color: '#16263F', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    PROFESSIONAL
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        PROFESSIONAL CONSULTANT
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Workspace Pro
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        Unlimited projects, Decision Memory, Copilot intelligence and briefings.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>
                        {selectedVariantKey === 'annual' ? 'AU$290' : 'AU$29'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {selectedVariantKey === 'annual' ? 'per year (annual subscription, renews annually until cancelled)' : 'per month (renews monthly until cancelled)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', marginBottom: '10px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workspace_pro_subscription', 'monthly');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: selectedVariantKey === 'monthly' && selectedOfferKey === 'workspace_pro_subscription' ? '1px solid #E2B53C' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedVariantKey === 'monthly' && selectedOfferKey === 'workspace_pro_subscription' ? 'rgba(226,181,60,0.2)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Monthly (AU$29/mo)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOffer('workspace_pro_subscription', 'annual');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: selectedVariantKey === 'annual' && selectedOfferKey === 'workspace_pro_subscription' ? '1px solid #E2B53C' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedVariantKey === 'annual' && selectedOfferKey === 'workspace_pro_subscription' ? 'rgba(226,181,60,0.2)' : 'transparent',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Annual (AU$290/yr)
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    <div>✓ Unlimited Transcripts & Projects</div>
                    <div>✓ Full Decision Memory System</div>
                    <div>✓ Concludo Copilot AI Assistant</div>
                    <div>✓ Priority Australian Support</div>
                  </div>
                </div>

                {/* Workspace Team */}
                <div
                  onClick={() => handleSelectOffer('workspace_team', 'monthly')}
                  style={{
                    backgroundColor: selectedOfferKey === 'workspace_team' ? '#21395C' : 'rgba(33, 57, 92, 0.4)',
                    border: selectedOfferKey === 'workspace_team' ? '2px solid #E2B53C' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.05em' }}>
                        COLLABORATION & TEAMS
                      </span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0', color: '#f8fafc' }}>
                        Workspace Team
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                        Multi-user workspace, shared projects, team intelligence. Minimum 5 seats.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E2B53C' }}>
                        AU${25 * teamSeats}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        per month ({teamSeats} seats @ AU$25/seat)
                      </div>
                    </div>
                  </div>

                  {selectedOfferKey === 'workspace_team' && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                          Number of Team Seats (Minimum 5):
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={100}
                          value={teamSeats}
                          onChange={(e) => setTeamSeats(Math.max(5, parseInt(e.target.value) || 5))}
                          style={{
                            backgroundColor: '#16263F',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#f8fafc',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            width: '100px',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                          Team Workspace Name:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Apex Consulting Group"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          style={{
                            backgroundColor: '#16263F',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#f8fafc',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            width: '100%',
                            maxWidth: '300px',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginTop: '12px' }}>
                    <div>✓ Team Workspace & Shared Library</div>
                    <div>✓ Role-Based Access Controls</div>
                    <div>✓ Cross-Team Decision Alignment</div>
                    <div>✓ Dedicated Australian Support</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Checkout Summary & Action Pane */}
          <div
            style={{
              backgroundColor: '#21395C',
              borderRadius: '16px',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              padding: '28px',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3)',
              position: 'sticky',
              top: '24px',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#f8fafc' }}>
              Order Summary
            </h2>

            {/* Selected item card */}
            <div
              style={{
                backgroundColor: '#16263F',
                borderRadius: '10px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#E2B53C', fontWeight: 700, letterSpacing: '0.05em' }}>
                SELECTED OFFER
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: '4px 0' }}>
                {selectedItem?.display_name || 'Meeting Mastery Workbook | Starter'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.86rem' }}>Total Amount</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E2B53C' }}>
                  {selectedOfferKey === 'workspace_team'
                    ? `AU$${25 * teamSeats}`
                    : selectedItem
                    ? formatPrice(selectedItem.amount_cents)
                    : 'AU$49'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '8px', textAlign: 'right', lineHeight: 1.4 }}>
                {selectedOfferKey === 'workbook_pro_edition' || selectedVariantKey === 'annual'
                  ? 'Renews automatically annually until cancelled. Cancel anytime self-serve in the billing portal. A renewal reminder email is sent before each annual charge.'
                  : selectedOfferKey === 'workspace_team' || selectedVariantKey === 'monthly'
                  ? 'Renews automatically monthly until cancelled. Cancel anytime self-serve in the billing portal.'
                  : 'One-off payment. Perpetual licence for version supplied. Does not renew.'}
              </div>
            </div>

            {/* Entity & Tax Disclaimer */}
            <div
              style={{
                backgroundColor: 'rgba(22, 38, 63, 0.6)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.75rem',
                color: '#cbd5e1',
                lineHeight: '1.45',
                marginBottom: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              All prices are in Australian dollars. Concludo Pty Ltd is not registered for GST, so no GST is charged.
            </div>

            {checkoutError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(248, 113, 113, 0.15)',
                  border: '1px solid #f87171',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fca5a5',
                  fontSize: '0.84rem',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Authenticated State: Instant Checkout Button */}
            {user ? (
              <div>
                <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '16px' }}>
                  Signed in as: <strong style={{ color: '#f8fafc' }}>{user.email}</strong>
                </div>

                <button
                  type="button"
                  onClick={handleInitiateCheckout}
                  disabled={checkoutLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    backgroundColor: '#E2B53C',
                    color: '#16263F',
                    border: 'none',
                    padding: '14px 20px',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(226, 181, 60, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 size={20} className="spin-animation" />
                      <span>Redirecting to Stripe...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Proceed to Secure Stripe Checkout</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Unauthenticated State: Inline Sign-in / Create Account */
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: authMode === 'signup' ? '#E2B53C' : 'rgba(255, 255, 255, 0.08)',
                      color: authMode === 'signup' ? '#16263F' : '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    1. Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: authMode === 'signin' ? '#E2B53C' : 'rgba(255, 255, 255, 0.08)',
                      color: authMode === 'signin' ? '#16263F' : '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    1. Sign In
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px' }}>
                  {authMode === 'signup'
                    ? 'Enter your details below to bind your licence and proceed directly to Stripe.'
                    : 'Sign in to your existing Concludo account to continue to checkout.'}
                </p>

                {authError && (
                  <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '12px', lineHeight: '1.4' }}>
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {authMode === 'signup' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          backgroundColor: '#16263F',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          color: '#f8fafc',
                          fontSize: '0.88rem',
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <input
                      type="email"
                      placeholder="Work Email Address"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        backgroundColor: '#16263F',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>

                  <div>
                    <input
                      type="password"
                      placeholder="Choose Password (min 8 chars)"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      minLength={8}
                      style={{
                        width: '100%',
                        backgroundColor: '#16263F',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAuth}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      backgroundColor: '#E2B53C',
                      color: '#16263F',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontSize: '0.96rem',
                      fontWeight: 700,
                      cursor: submittingAuth ? 'not-allowed' : 'pointer',
                      marginTop: '6px',
                      boxShadow: '0 4px 12px rgba(226, 181, 60, 0.3)',
                    }}
                  >
                    {submittingAuth ? (
                      <>
                        <Loader2 size={18} className="spin-animation" />
                        <span>Connecting to Stripe...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={16} />
                        <span>Continue to Stripe Checkout</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Footer Trust Badges */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.74rem', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
              🔒 Protected by Stripe SSL checkout. Instant digital licence issuing upon payment completion.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
