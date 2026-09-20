/**
 * Tasklet 14.7: Breach Detection and Notification Workflow
 *
 * Runs data breach assessment against OAIC Notifiable Data Breaches scheme
 * with a mandatory statutory 30-day assessment clock from discovery.
 *
 * Enforces mandatory reasoning: a documented decision not to notify is evidence.
 */

const breachesLedger = new Map();

export class BreachResponseError extends Error {
  constructor(message, code = 'BREACH_RESPONSE_ERROR') {
    super(message);
    this.name = 'BreachResponseError';
    this.code = code;
  }
}

/**
 * Discovers and records a security incident, starting the 30-day assessment clock.
 * @param {object} input
 * @param {string} input.description
 * @param {Date | string} [input.discoveredAt]
 * @param {string[]} [input.affectedOrganisationIds]
 * @param {number} [input.estimatedPeopleAffected]
 * @param {string[]} [input.dataCategories]
 * @param {string} [input.createdBy]
 */
export function recordBreachIncident(input) {
  if (!input.description) {
    throw new BreachResponseError('Incident description is required', 'MISSING_DESCRIPTION');
  }

  const id = crypto.randomUUID();
  const reference = `NDB-${new Date().getUTCFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const discovered = input.discoveredAt ? new Date(input.discoveredAt) : new Date();
  const due = new Date(discovered.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days statutory clock

  const incident = {
    id,
    reference,
    discovered_at: discovered.toISOString(),
    description: input.description,
    affected_organisation_ids: input.affectedOrganisationIds || [],
    estimated_people_affected: input.estimatedPeopleAffected || 0,
    data_categories: input.dataCategories || [],
    containment_actions: null,
    contained_at: null,
    assessment_status: 'ASSESSING',
    likely_serious_harm: null,
    assessment_reasoning: null,
    regulator_notified_at: null,
    individuals_notified_at: null,
    assessment_due_at: due.toISOString(),
    created_by: input.createdBy || null,
    created_at: new Date().toISOString(),
  };

  breachesLedger.set(id, incident);
  breachesLedger.set(reference, incident);
  return incident;
}

/**
 * Completes breach assessment with mandatory reasoning.
 * @param {string} incidentIdOrRef
 * @param {object} assessment
 * @param {boolean} assessment.likelySeriousHarm
 * @param {string} assessment.assessmentReasoning
 * @param {'NOT_ELIGIBLE' | 'ELIGIBLE'} assessment.status
 */
export function completeBreachAssessment(incidentIdOrRef, assessment) {
  const incident = breachesLedger.get(incidentIdOrRef);
  if (!incident) {
    throw new BreachResponseError('Incident not found', 'INCIDENT_NOT_FOUND');
  }

  if (!assessment.assessmentReasoning || assessment.assessmentReasoning.trim().length < 15) {
    throw new BreachResponseError(
      'Assessment reasoning is mandatory when completing a breach assessment. Documented reasoning is a required legal defence.',
      'MANDATORY_REASONING_MISSING'
    );
  }

  incident.assessment_status = assessment.status;
  incident.likely_serious_harm = Boolean(assessment.likelySeriousHarm);
  incident.assessment_reasoning = assessment.assessmentReasoning;

  return incident;
}

/**
 * Drafts OAIC regulator notification from the incident record.
 * @param {string} incidentIdOrRef
 */
export function draftRegulatorNotification(incidentIdOrRef) {
  const incident = breachesLedger.get(incidentIdOrRef);
  if (!incident) throw new BreachResponseError('Incident not found');

  return {
    recipient: 'Office of the Australian Information Commissioner (OAIC)',
    statutory_scheme: 'Privacy Act 1988 (Cth) Part IIIC Notifiable Data Breaches',
    entity_name: 'Concludo Pty Ltd (ACN 701 605 898)',
    reference: incident.reference,
    discovered_at: incident.discovered_at,
    description_of_breach: incident.description,
    data_categories_involved: incident.data_categories,
    estimated_individuals_affected: incident.estimated_people_affected,
    containment_measures: incident.containment_actions || 'Containment implemented.',
    assessment_findings: incident.assessment_reasoning,
    contact_email: 'hello@concludo.au',
  };
}

export function _clearBreaches() {
  breachesLedger.clear();
}
