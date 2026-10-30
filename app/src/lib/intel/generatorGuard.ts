/**
 * Switch for the template generators that produced invented statements (defects D1 and D2).
 * Default is OFF. While off, those code paths fail closed: they return nothing or throw
 * GeneratorsDisabledError, so no invented text can be saved or shown.
 * Turning it on is a decision for the director and needs a written reason.
 */
export const TEMPLATE_GENERATORS_ENABLED = false;

export class GeneratorsDisabledError extends Error {
  constructor(feature: string) {
    super(`${feature} is unavailable until it can run on real saved records.`);
    this.name = 'GeneratorsDisabledError';
  }
}

export function assertGeneratorsEnabled(feature: string): void {
  if (!TEMPLATE_GENERATORS_ENABLED) throw new GeneratorsDisabledError(feature);
}
