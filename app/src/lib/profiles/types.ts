export type PlanType =
  | 'free_preview'
  | 'starter_trial'
  | 'starter'
  | 'pro_trial'
  | 'pro'
  | 'team'
  | 'admin';

export type RoleType = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  plan: PlanType;
  role: RoleType;
  created_at: string;
  updated_at: string;
}

export const PLAN_LABELS: Record<PlanType, string> = {
  free_preview: 'Free Preview',
  starter_trial: 'Starter Trial',
  starter: 'Starter',
  pro_trial: 'Pro Trial',
  pro: 'Pro',
  team: 'Team',
  admin: 'Admin',
};

export const ROLE_LABELS: Record<RoleType, string> = {
  user: 'User',
  admin: 'Admin',
};
