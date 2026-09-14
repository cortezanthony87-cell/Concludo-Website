import { SupabaseClient } from '@supabase/supabase-js';
import { CopilotEngine, CopilotQueryOptions } from './copilotEngine';
import { CopilotResponse } from './types';

/**
 * Specialized Assistants Layer
 * Wraps CopilotEngine with domain-focused contexts and constraints.
 */
export class SpecializedAssistants {
  private engine: CopilotEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new CopilotEngine(supabase);
  }

  /**
   * Project Assistant:
   * Focuses on project milestones, deliverables, connected decisions, and risks.
   */
  async askProjectAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'project_assistant',
    });
  }

  /**
   * Decision Assistant:
   * Explains why decisions were made, who approved, evidence, and outcomes.
   */
  async askDecisionAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'decision_assistant',
    });
  }

  /**
   * Action Assistant:
   * Identifies overdue actions, workload backlog, blockers, and owners.
   */
  async askActionAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'action_assistant',
    });
  }

  /**
   * Risk Assistant:
   * Detects repeated delays, recurring risks across programs, and bottlenecks.
   */
  async askRiskAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'risk_assistant',
    });
  }

  /**
   * Executive Assistant:
   * High-level strategic overview, business momentum, executive briefings, and focus areas.
   */
  async askExecutiveAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'executive_assistant',
    });
  }

  /**
   * Knowledge Assistant:
   * Cross-team knowledge discovery, lessons learned, and knowledge graph exploration.
   */
  async askKnowledgeAssistant(
    query: string,
    options: Omit<CopilotQueryOptions, 'assistantType'>
  ): Promise<CopilotResponse> {
    return this.engine.processQuery(query, {
      ...options,
      assistantType: 'knowledge_assistant',
    });
  }
}
