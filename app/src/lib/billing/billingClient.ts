import { getSupabaseBrowserClient } from '../supabase/client';

export interface BillingCatalogItem {
  id: string;
  offer_key: string;
  variant_key: string;
  display_name: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  checkout_mode: 'payment' | 'subscription';
  entitlement_tier: string;
  trial_days: number;
  minimum_quantity: number;
  licence_type: string;
  licence_term_months: number | null;
  active: boolean;
  stripe_price_id: string;
}

export interface CreateCheckoutOptions {
  offerKey: string;
  variantKey: string;
  quantity?: number;
  teamName?: string;
  teamId?: string;
}

export interface CheckoutStatusResult {
  checkout: {
    id: string;
    offer_key: string;
    variant_key: string;
    checkout_mode: 'payment' | 'subscription';
    quantity: number;
    status: string;
    completed_at: string | null;
  };
  subscription?: {
    status: string;
    tier: string;
    quantity: number;
    current_period_end: string | null;
    trial_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  workbookOrder?: {
    payment_status: string;
    paid_at: string | null;
  } | null;
  workbookLicence?: {
    id: string;
    asset_key: string;
    licence_type: string;
    valid_from: string;
    valid_until: string | null;
  } | null;
}

export interface UserWorkbookLicence {
  id: string;
  order_id: string;
  billing_account_id: string;
  buyer_user_id: string;
  asset_key: string;
  licence_type: string;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  billing_account_id: string;
  tier: string;
  status: string;
  quantity: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
}

export async function fetchBillingCatalog(): Promise<BillingCatalogItem[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('billing_catalog')
    .select('*')
    .eq('active', true)
    .order('amount_cents', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to fetch billing catalog');
  }
  return (data as BillingCatalogItem[]) || [];
}

export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<{ checkoutUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      offerKey: options.offerKey,
      variantKey: options.variantKey,
      quantity: options.quantity,
      teamName: options.teamName,
      teamId: options.teamId,
    },
  });

  if (error) {
    let errorMsg = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) errorMsg = body.error;
      } catch {}
    }
    throw new Error(errorMsg || 'Failed to initialize checkout session');
  }
  if (!data?.checkoutUrl) {
    throw new Error('Stripe checkout URL was not returned by server');
  }
  return { checkoutUrl: data.checkoutUrl };
}

export async function getCheckoutStatus(
  checkoutSessionId: string
): Promise<CheckoutStatusResult> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke('checkout-status', {
    body: { checkoutSessionId },
  });

  if (error) {
    let errorMsg = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) errorMsg = body.error;
      } catch {}
    }
    throw new Error(errorMsg || 'Unable to confirm checkout status');
  }
  return data as CheckoutStatusResult;
}

export async function getWorkbookDownloadUrl(
  licenceId: string
): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke('workbook-download', {
    body: { licenceId },
  });

  if (error) {
    let errorMsg = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) errorMsg = body.error;
      } catch {}
    }
    throw new Error(errorMsg || 'Failed to generate secure download link');
  }
  if (!data?.downloadUrl) {
    throw new Error('Secure download URL was not returned');
  }
  return { downloadUrl: data.downloadUrl, expiresInSeconds: data.expiresInSeconds || 300 };
}

export async function openBillingPortal(
  teamId?: string
): Promise<{ portalUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke('billing-portal', {
    body: { teamId },
  });

  if (error) {
    let errorMsg = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (body?.error) errorMsg = body.error;
      } catch {}
    }
    throw new Error(errorMsg || 'Failed to open customer billing portal');
  }
  if (!data?.portalUrl) {
    throw new Error('Billing portal URL was not returned');
  }
  return { portalUrl: data.portalUrl };
}

export async function fetchUserWorkbookLicences(): Promise<UserWorkbookLicence[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('workbook_licenses')
    .select('*')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching workbook licences:', error);
    return [];
  }
  return (data as UserWorkbookLicence[]) || [];
}

export async function fetchUserSubscription(): Promise<UserSubscription | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('workspace_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
  return data as UserSubscription | null;
}
