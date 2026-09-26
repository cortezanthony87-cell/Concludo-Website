// Google Tag Manager / GA4 / Google Ads Consent Mode v2 & Conversion Tracking helper

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function trackGoogleEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch (err) {
    console.error('Failed to dispatch Google conversion event:', err);
  }
}

export function trackPurchase(transactionId: string, value: number = 49, currency: string = 'AUD') {
  trackGoogleEvent('purchase', {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    send_to: 'AW-18475178480/9_M8CLakzoUdEPCz0-lE'
  });
}

export function trackSignup() {
  trackGoogleEvent('sign_up', {
    method: 'email',
    send_to: 'AW-18475178480/J0anCLmkzoUdEPCz0-lE'
  });
}
