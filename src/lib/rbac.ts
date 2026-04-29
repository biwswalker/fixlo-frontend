export type AppRole = 'owner' | 'admin' | 'staff' | 'viewer';

// Define the permissions mapping for each role
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  owner: ['manage_users', 'view_reports', 'manage_projects', 'approve_transactions'],
  admin: ['manage_users', 'view_reports', 'manage_projects', 'approve_transactions'],
  staff: ['view_reports', 'approve_transactions'],
  viewer: ['view_reports']
};

/**
 * Checks if a user has a specific role
 * @param userRoles Roles assigned to the user
 * @param requiredRoles Roles allowed to access
 */
export function hasRole(userRoles: string[] | string | undefined, requiredRoles: string[]): boolean {
  if (!userRoles) return false;
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  return roles.some(role => requiredRoles.includes(role));
}

/**
 * Checks if a user has a specific permission based on their roles
 * @param userRoles Roles assigned to the user
 * @param requiredPermission The specific permission needed
 */
export function hasPermission(userRoles: string[] | string | undefined, requiredPermission: string): boolean {
  if (!userRoles) return false;
  
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  
  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role as AppRole];
    if (permissions && permissions.includes(requiredPermission)) {
      return true;
    }
  }
  
  return false;
}
