/**
 * Data Retention & Lifecycle Types
 * Concludo Workspace - Tasklet 11E & Tasklet 14
 */

export interface RetentionPolicy {
  /**
   * The duration in days for which soft-deleted records remain recoverable
   * before permanent removal. Default: 30 days.
   */
  retention_policy_days: number;

  /**
   * Human-readable description of the recovery window.
   */
  recovery_window_display: string;

  /**
   * Frequency of automated backend purge worker execution.
   */
  purge_frequency: 'daily';

  /**
   * Database criteria for automated purge.
   * Format: "deleted_at is not null and purge_after < now()"
   */
  purge_criteria: string;

  /**
   * Protected entity types covered under data retention.
   */
  protected_types: ('projects' | 'outputs' | 'transcripts' | 'decisions' | 'actions')[];

  /**
   * Future Team Workspace Support:
   * Indicates whether an organization/team-level retention override is configured.
   */
  team_retention_override: boolean;

  /**
   * Future Team Workspace Support:
   * Organization-level custom retention window in days, if overridden.
   */
  team_retention_policy_days?: number | null;
}

export interface PurgeResult {
  success: boolean;
  executed_at: string;
  purged_projects: number;
  purged_outputs: number;
  purged_decisions?: number;
  purged_actions?: number;
  user_id?: string;
  error?: string;
}

/**
 * Standard default data retention configuration for Concludo Workspace.
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  retention_policy_days: 30,
  recovery_window_display: '30 days',
  purge_frequency: 'daily',
  purge_criteria: 'deleted_at is not null and purge_after < now()',
  protected_types: ['projects', 'outputs', 'transcripts', 'decisions', 'actions'],
  team_retention_override: false,
  team_retention_policy_days: null,
};
