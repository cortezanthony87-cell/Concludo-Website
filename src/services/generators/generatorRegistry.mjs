/**
 * Phase 5: Business Document Generator Registry (Tasklets 5.1 to 5.17)
 * 
 * Maps all 17 generators (GEN-01 to GEN-17) to their authoritative registry templates (T1 to T17)
 * and primary output identifiers (OUT-xx).
 */

export const GENERATOR_CATALOGUE = {
  'GEN-01': {
    tasklet: '5.1',
    generator_id: 'GEN-01',
    id: 'GEN-01',
    template_id: 'T4',
    template: 'T4',
    template_name: 'Business Plan',
    primary_output_id: 'OUT-23',
    primary_output: 'OUT-23',
    primary_output_name: 'Business plan draft',
    min_sections: 6,
    total_sections: 12
  },
  'GEN-02': {
    tasklet: '5.2',
    generator_id: 'GEN-02',
    id: 'GEN-02',
    template_id: 'T13',
    template: 'T13',
    template_name: 'Leadership Brief',
    primary_output_id: 'OUT-51',
    primary_output: 'OUT-51',
    primary_output_name: 'Leadership brief',
    target_pages: 1
  },
  'GEN-03': {
    tasklet: '5.3',
    generator_id: 'GEN-03',
    id: 'GEN-03',
    template_id: 'T14',
    template: 'T14',
    template_name: 'Board Briefing',
    primary_output_id: 'OUT-52',
    primary_output: 'OUT-52',
    primary_output_name: 'Board briefing paper',
    is_working_record: true,
    prohibits_minutes_claim: true
  },
  'GEN-04': {
    tasklet: '5.4',
    generator_id: 'GEN-04',
    id: 'GEN-04',
    template_id: 'T15',
    template: 'T15',
    template_name: 'Decision Pack',
    primary_output_id: 'OUT-53',
    primary_output: 'OUT-53',
    primary_output_name: 'Decision pack board grade',
    secondary_output_id: 'OUT-11'
  },
  'GEN-05': {
    tasklet: '5.5',
    generator_id: 'GEN-05',
    id: 'GEN-05',
    template_id: 'T7',
    template: 'T7',
    template_name: 'Action Plan',
    primary_output_id: 'OUT-07',
    primary_output: 'OUT-07',
    primary_output_name: 'Action plan now next later',
    secondary_output_id: 'OUT-03'
  },
  'GEN-06': {
    tasklet: '5.6',
    generator_id: 'GEN-06',
    id: 'GEN-06',
    template_id: 'T6',
    template: 'T6',
    template_name: 'Strategy Paper',
    primary_output_id: 'OUT-16',
    primary_output: 'OUT-16',
    primary_output_name: 'Strategy paper'
  },
  'GEN-07': {
    tasklet: '5.7',
    generator_id: 'GEN-07',
    id: 'GEN-07',
    template_id: 'T9',
    template: 'T9',
    template_name: 'Transformation Plan',
    primary_output_id: 'OUT-47',
    primary_output: 'OUT-47',
    primary_output_name: 'Transformation plan'
  },
  'GEN-08': {
    tasklet: '5.8',
    generator_id: 'GEN-08',
    id: 'GEN-08',
    template_id: 'T8',
    template: 'T8',
    template_name: 'Roadmap',
    primary_output_id: 'OUT-32',
    primary_output: 'OUT-32',
    primary_output_name: 'Milestone or roadmap view'
  },
  'GEN-09': {
    tasklet: '5.9',
    generator_id: 'GEN-09',
    id: 'GEN-09',
    template_id: 'T10',
    template: 'T10',
    template_name: 'Risk Assessment',
    primary_output_id: 'OUT-12',
    primary_output: 'OUT-12',
    primary_output_name: 'Strategic risk assessment',
    secondary_output_id: 'OUT-05'
  },
  'GEN-10': {
    tasklet: '5.10',
    generator_id: 'GEN-10',
    id: 'GEN-10',
    template_id: 'T11',
    template: 'T11',
    template_name: 'Opportunity Assessment',
    primary_output_id: 'OUT-13',
    primary_output: 'OUT-13',
    primary_output_name: 'Strategic opportunity assessment'
  },
  'GEN-11': {
    tasklet: '5.11',
    generator_id: 'GEN-11',
    id: 'GEN-11',
    template_id: 'T2',
    template: 'T2',
    template_name: 'Meeting Report',
    primary_output_id: 'OUT-37',
    primary_output: 'OUT-37',
    primary_output_name: 'Client ready meeting record'
  },
  'GEN-12': {
    tasklet: '5.12',
    generator_id: 'GEN-12',
    id: 'GEN-12',
    template_id: 'T17',
    template: 'T17',
    template_name: 'Meeting Performance Report',
    primary_output_id: 'OUT-09',
    primary_output: 'OUT-09',
    primary_output_name: 'Meeting Performance Report',
    internal_only: true,
    prohibits_restricted: true
  },
  'GEN-13': {
    tasklet: '5.13',
    generator_id: 'GEN-13',
    id: 'GEN-13',
    template_id: 'T1',
    template: 'T1',
    template_name: 'Executive Summary',
    primary_output_id: 'OUT-01',
    primary_output: 'OUT-01',
    primary_output_name: 'Executive Summary'
  },
  'GEN-14': {
    tasklet: '5.14',
    generator_id: 'GEN-14',
    id: 'GEN-14',
    template_id: 'T3',
    template: 'T3',
    template_name: 'Business Case',
    primary_output_id: 'OUT-27',
    primary_output: 'OUT-27',
    primary_output_name: 'Business case'
  },
  'GEN-15': {
    tasklet: '5.15',
    generator_id: 'GEN-15',
    id: 'GEN-15',
    template_id: 'T5',
    template: 'T5',
    template_name: 'Operating Model',
    primary_output_id: 'OUT-45',
    primary_output: 'OUT-45',
    primary_output_name: 'Operating model view',
    min_views: 3,
    total_views: 5
  },
  'GEN-16': {
    tasklet: '5.16',
    generator_id: 'GEN-16',
    id: 'GEN-16',
    template_id: 'T12',
    template: 'T12',
    template_name: 'Program Report',
    primary_output_id: 'OUT-33',
    primary_output: 'OUT-33',
    primary_output_name: 'Program report'
  },
  'GEN-17': {
    tasklet: '5.17',
    generator_id: 'GEN-17',
    id: 'GEN-17',
    template_id: 'T16',
    template: 'T16',
    template_name: 'Recommendation Paper',
    primary_output_id: 'OUT-54',
    primary_output: 'OUT-54',
    primary_output_name: 'Recommendation paper',
    secondary_output_id: 'OUT-42'
  }
};

export function getGeneratorForTemplate(templateId) {
  return Object.values(GENERATOR_CATALOGUE).find((g) => g.template_id === templateId) || null;
}

export const getGeneratorByTemplate = getGeneratorForTemplate;

export function getGeneratorById(generatorId) {
  return GENERATOR_CATALOGUE[generatorId] || null;
}
