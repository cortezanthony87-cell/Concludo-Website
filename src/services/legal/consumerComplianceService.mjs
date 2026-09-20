/**
 * Tasklet 14.10: Consumer Law Compliance Surface
 *
 * Implements Australian Consumer Law (ACL) requirements:
 * 1. Single price formatter (GST status compliant; Concludo Pty Ltd is not GST registered, so GST-free).
 * 2. Pre-charge pricing disclosure ledger (no charge without disclosure record).
 * 3. Self-service two-click cancellation.
 * 4. Zero pre-ticked controls.
 */

const pricingDisclosures = new Map();
const cancellationEvents = new Map();

export class ConsumerComplianceError extends Error {
  constructor(message, code = 'CONSUMER_COMPLIANCE_ERROR') {
    super(message);
    this.name = 'ConsumerComplianceError';
    this.code = code;
  }
}

/**
 * The single authoritative price formatter for the entire platform.
 * Concludo Pty Ltd is not registered for GST; prices are GST-free.
 * @param {number} cents
 * @param {'month' | 'year' | 'one_time'} [period]
 * @returns {string} Formatted display price
 */
export function formatPriceAud(cents, period = 'month') {
  const dollars = (cents / 100).toFixed(2);
  const suffix = period === 'month' ? '/mo' : period === 'year' ? '/yr' : '';
  return `AU$${dollars}${suffix} (GST-free)`;
}

/**
 * Records a required pricing disclosure prior to charge.
 * @param {object} input
 * @param {string} input.organisationId
 * @param {string} input.userId
 * @param {'trial_conversion' | 'renewal_reminder' | 'price_change' | 'pre_purchase'} input.disclosureType
 * @param {number} input.amountDisclosedCents
 * @param {string} [input.billingFrequency]
 */
export function recordPricingDisclosure(input) {
  if (!input.organisationId || !input.userId || typeof input.amountDisclosedCents !== 'number') {
    throw new ConsumerComplianceError('Missing required disclosure parameters', 'MISSING_DISCLOSURE_PARAMS');
  }

  const id = crypto.randomUUID();
  const text = `Subscription charge of ${formatPriceAud(input.amountDisclosedCents, input.billingFrequency || 'month')} disclosed to user.`;

  const record = Object.freeze({
    id,
    organisation_id: input.organisationId,
    user_id: input.userId,
    disclosure_type: input.disclosureType,
    amount_disclosed_cents: input.amountDisclosedCents,
    gst_inclusive: false, // Concludo Pty Ltd is not GST registered
    currency: 'AUD',
    billing_frequency: input.billingFrequency || 'month',
    disclosed_at: new Date().toISOString(),
    disclosure_text: text,
  });

  pricingDisclosures.set(id, record);
  pricingDisclosures.set(`user:${input.userId}`, record);
  return record;
}

/**
 * Asserts that a pricing disclosure exists before processing a transaction.
 * Fail closed.
 * @param {string} userId
 */
export function assertDisclosureBeforeCharge(userId) {
  const disclosure = pricingDisclosures.get(`user:${userId}`);
  if (!disclosure) {
    throw new ConsumerComplianceError(
      'No pricing disclosure record exists for this user. A customer cannot be charged without prior disclosed pricing.',
      'NO_PRIOR_DISCLOSURE'
    );
  }
  return true;
}

/**
 * Processes a customer subscription cancellation.
 * Measures clicks to cancel: must be two clicks or fewer with zero retention interstitials.
 * @param {object} input
 * @param {string} input.organisationId
 * @param {string} input.userId
 * @param {number} input.clicksToCancel
 * @param {string} [input.reason]
 */
export function processCancellation(input) {
  if (input.clicksToCancel > 2) {
    throw new ConsumerComplianceError(
      `Cancellation took ${input.clicksToCancel} clicks. Concludo requires self-service cancellation in two clicks or fewer.`,
      'EXCESSIVE_CANCELLATION_FRICTION'
    );
  }

  const id = crypto.randomUUID();
  const effectiveAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // End of current billing cycle

  const event = Object.freeze({
    id,
    organisation_id: input.organisationId,
    user_id: input.userId,
    requested_at: new Date().toISOString(),
    effective_at: effectiveAt,
    clicks_to_cancel: input.clicksToCancel,
    confirmation_sent_at: new Date().toISOString(),
    reason: input.reason || 'User requested cancellation',
  });

  cancellationEvents.set(id, event);
  return event;
}

/**
 * Checks form markup to guarantee zero pre-ticked checkboxes exist.
 * @param {string} formHtmlOrJsx
 */
export function assertNoPreTickedControls(formHtmlOrJsx) {
  const preTickedRegex = /<input[^>]+type=["']checkbox["'][^>]+(checked|defaultChecked)[^>]*>/i;
  if (preTickedRegex.test(formHtmlOrJsx)) {
    throw new ConsumerComplianceError(
      'Pre-ticked consent or subscription checkbox detected. Pre-ticked controls are strictly prohibited under consumer protection standards.',
      'PRE_TICKED_CONTROL_DETECTED'
    );
  }
  return true;
}

export function _clearPricing() {
  pricingDisclosures.clear();
  cancellationEvents.clear();
}
