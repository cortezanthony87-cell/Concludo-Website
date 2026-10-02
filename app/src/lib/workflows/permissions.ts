export type WorkflowPermission =
  | 'workflow.view'
  | 'workflow.create'
  | 'workflow.edit'
  | 'workflow.test'
  | 'workflow.dry_run'
  | 'workflow.submit'
  | 'workflow.approve'
  | 'workflow.publish'
  | 'workflow.pause'
  | 'workflow.resume'
  | 'workflow.retry'
  | 'workflow.cancel'
  | 'workflow.rollback'
  | 'workflow.archive'
  | 'connection.view'
  | 'connection.create'
  | 'connection.configure'
  | 'connection.test'
  | 'connection.revoke'
  | 'workflow.audit.view'
  | 'workflow.incident.manage'
  | 'workflow.policy.manage';

export type UserRole = 'owner' | 'admin' | 'operator' | 'builder' | 'viewer';

const ROLE_PERMISSIONS: Record<UserRole, Set<WorkflowPermission>> = {
  owner: new Set([
    'workflow.view',
    'workflow.create',
    'workflow.edit',
    'workflow.test',
    'workflow.dry_run',
    'workflow.submit',
    'workflow.approve',
    'workflow.publish',
    'workflow.pause',
    'workflow.resume',
    'workflow.retry',
    'workflow.cancel',
    'workflow.rollback',
    'workflow.archive',
    'connection.view',
    'connection.create',
    'connection.configure',
    'connection.test',
    'connection.revoke',
    'workflow.audit.view',
    'workflow.incident.manage',
    'workflow.policy.manage',
  ]),
  admin: new Set([
    'workflow.view',
    'workflow.create',
    'workflow.edit',
    'workflow.test',
    'workflow.dry_run',
    'workflow.submit',
    'workflow.approve',
    'workflow.publish',
    'workflow.pause',
    'workflow.resume',
    'workflow.retry',
    'workflow.cancel',
    'workflow.rollback',
    'workflow.archive',
    'connection.view',
    'connection.create',
    'connection.configure',
    'connection.test',
    'connection.revoke',
    'workflow.audit.view',
    'workflow.incident.manage',
    'workflow.policy.manage',
  ]),
  operator: new Set([
    'workflow.view',
    'workflow.test',
    'workflow.dry_run',
    'workflow.pause',
    'workflow.resume',
    'workflow.retry',
    'workflow.cancel',
    'connection.view',
    'connection.test',
    'workflow.audit.view',
    'workflow.incident.manage',
  ]),
  builder: new Set([
    'workflow.view',
    'workflow.create',
    'workflow.edit',
    'workflow.test',
    'workflow.dry_run',
    'workflow.submit',
    'connection.view',
  ]),
  viewer: new Set([
    'workflow.view',
    'connection.view',
  ]),
};

/**
 * Checks whether a user role has permission to execute an action.
 */
export function hasWorkflowPermission(role: UserRole | string, permission: WorkflowPermission): boolean {
  const allowed = ROLE_PERMISSIONS[role as UserRole];
  if (!allowed) return false;
  return allowed.has(permission);
}

/**
 * Validates tenant match and permission, throwing an error if unauthorized.
 */
export function enforceWorkflowPermission(
  userOrgId: string,
  targetOrgId: string,
  userRole: UserRole | string,
  permission: WorkflowPermission
): void {
  if (userOrgId !== targetOrgId) {
    throw new Error(`Permission Denied: Cross-tenant access attempted. User org '${userOrgId}' cannot access '${targetOrgId}'.`);
  }
  if (!hasWorkflowPermission(userRole, permission)) {
    throw new Error(`Permission Denied: Role '${userRole}' lacks required capability '${permission}'.`);
  }
}
