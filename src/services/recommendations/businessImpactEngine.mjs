/**
 * Tasklet 4.5: Business Impact Scoring Engine
 * 
 * Model business impact (1 to 10 scale) across Cost, Revenue, and Governance Protection.
 * Strict Boundary Rule: A dollar figure is produced ONLY if grounded in an explicit financial parameter stated in the record.
 * Rule: No saving is projected, and no waste is quantified.
 */

export class UnsupportedFinancialClaimError extends Error {
  constructor(claim) {
    super(`Unsupported financial claim: "${claim}". Concludo never projects savings, ROI, or unsourced financial gains.`);
    this.name = 'UnsupportedFinancialClaimError';
    this.code = 'UNSUPPORTED_FINANCIAL_CLAIM';
  }
}

export function scoreBusinessImpact({
  costPillar = 5,
  revenuePillar = 5,
  governancePillar = 6,
  explicitDollarAmount = null,
  savingsClaimed = null
}) {
  if (savingsClaimed !== null) {
    throw new UnsupportedFinancialClaimError('Savings or ROI calculation attempted');
  }

  // Check for unsourced dollar figures
  if (explicitDollarAmount !== null && typeof explicitDollarAmount === 'string') {
    if (/\$|\bAUD\b|\bdollars\b/i.test(explicitDollarAmount) && !explicitDollarAmount.includes('stated in transcript')) {
      throw new UnsupportedFinancialClaimError(`Unsourced dollar claim: "${explicitDollarAmount}"`);
    }
  }

  const cost = Math.max(1, Math.min(10, Number(costPillar)));
  const rev = Math.max(1, Math.min(10, Number(revenuePillar)));
  const gov = Math.max(1, Math.min(10, Number(governancePillar)));

  // Composite impact 1 to 10
  const impactScore = Math.max(1, Math.min(10, Math.round((cost * 0.3) + (rev * 0.3) + (gov * 0.4))));

  return {
    business_impact_score: impactScore,
    pillars: {
      cost,
      revenue: rev,
      governance_protection: gov
    },
    stated_basis: 'Evaluated across operational cost alignment, revenue enablement, and governance protection'
  };
}
