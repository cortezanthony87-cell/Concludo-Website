import { SupabaseClient } from '@supabase/supabase-js';
import {
  KnowledgeNode,
  KnowledgeRelationship,
  LessonLearned,
  KnowledgeCluster,
  EvidenceNetwork,
  DecisionNetwork,
  ProjectNetwork,
  KnowledgeSearchResult,
  KnowledgeTimelineItem,
  KnowledgeJourney,
  KnowledgeAnalyticsData,
  KnowledgeClusterCategory,
} from './types';
import { KnowledgeEngine, EngineOptions } from './knowledgeEngine';

export interface KnowledgeClientOptions {
  teamId?: string | null;
  organizationId?: string | null;
}

/**
 * Client service for Knowledge Network & Organizational Memory
 * Provides high-level SDK for interacting with knowledge graph nodes,
 * relationships, networks, executive explorer, and lessons learned.
 */
export class KnowledgeClient {
  private engine: KnowledgeEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new KnowledgeEngine(supabase);
  }

  async fetchNodes(options?: KnowledgeClientOptions): Promise<KnowledgeNode[]> {
    let query = this.supabase
      .from('knowledge_nodes')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (options?.organizationId) {
      query = query.eq('organization_id', options.organizationId);
    } else if (options?.teamId) {
      query = query.eq('team_id', options.teamId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async fetchRelationships(): Promise<KnowledgeRelationship[]> {
    const { data, error } = await this.supabase
      .from('knowledge_relationships')
      .select('*, source_node:knowledge_nodes!source_node_id(*), target_node:knowledge_nodes!target_node_id(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async syncKnowledgeGraph(options?: KnowledgeClientOptions): Promise<{ nodesCount: number; relationshipsCount: number }> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.syncKnowledgeGraph({
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async searchKnowledge(query: string, options?: KnowledgeClientOptions): Promise<KnowledgeSearchResult[]> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.searchKnowledge(query, {
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getDecisionNetwork(decisionId: string, options?: KnowledgeClientOptions): Promise<DecisionNetwork | null> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getDecisionNetwork(decisionId, {
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getProjectNetwork(projectId: string, options?: KnowledgeClientOptions): Promise<ProjectNetwork | null> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getProjectNetwork(projectId, {
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getEvidenceNetwork(entityType: string, entityId: string, options?: KnowledgeClientOptions): Promise<EvidenceNetwork> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getEvidenceNetwork(entityType, entityId, {
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getKnowledgeTimeline(options?: KnowledgeClientOptions): Promise<KnowledgeTimelineItem[]> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getKnowledgeTimeline({
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getKnowledgeJourney(targetId: string, options?: KnowledgeClientOptions): Promise<KnowledgeJourney> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getKnowledgeJourney(targetId, {
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getKnowledgeClusters(options?: KnowledgeClientOptions): Promise<KnowledgeCluster[]> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getKnowledgeClusters({
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async getKnowledgeAnalytics(options?: KnowledgeClientOptions): Promise<KnowledgeAnalyticsData> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    return this.engine.getKnowledgeAnalytics({
      userId: user.user.id,
      teamId: options?.teamId || null,
      organizationId: options?.organizationId || null,
    });
  }

  async fetchLessonsLearned(options?: KnowledgeClientOptions): Promise<LessonLearned[]> {
    let query = this.supabase
      .from('lessons_learned')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.organizationId) {
      query = query.eq('organization_id', options.organizationId);
    } else if (options?.teamId) {
      query = query.eq('team_id', options.teamId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createLessonLearned(lesson: {
    title: string;
    summary: string;
    outcome: string;
    cluster_category?: KnowledgeClusterCategory;
    tags?: string[];
    project_id?: string | null;
    team_id?: string | null;
    organization_id?: string | null;
  }): Promise<LessonLearned> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    const { data, error } = await this.supabase
      .from('lessons_learned')
      .insert({
        title: lesson.title,
        summary: lesson.summary,
        outcome: lesson.outcome,
        cluster_category: lesson.cluster_category || 'operational_excellence',
        tags: lesson.tags || [],
        project_id: lesson.project_id || null,
        team_id: lesson.team_id || null,
        organization_id: lesson.organization_id || null,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async softDeleteLesson(lessonId: string): Promise<boolean> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    const { error } = await this.supabase.rpc('soft_delete_lesson_learned', {
      p_lesson_id: lessonId,
      p_user_id: user.user.id,
    });
    if (error) throw error;
    return true;
  }

  async restoreLesson(lessonId: string): Promise<boolean> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    const { error } = await this.supabase.rpc('restore_lesson_learned', {
      p_lesson_id: lessonId,
      p_user_id: user.user.id,
    });
    if (error) throw error;
    return true;
  }

  async permanentDeleteLesson(lessonId: string): Promise<boolean> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user) throw new Error('Authentication required');

    const { error } = await this.supabase.rpc('permanent_delete_lesson_learned', {
      p_lesson_id: lessonId,
      p_user_id: user.user.id,
    });
    if (error) throw error;
    return true;
  }
}
