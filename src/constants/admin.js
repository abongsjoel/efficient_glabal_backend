export const adminRoles = Object.freeze({
  SUPER_ADMIN: "super_admin",
  MANAGER: "manager",
  DISPATCHER: "dispatcher",
  VIEWER: "viewer",
});

export const adminRoleValues = Object.freeze(Object.values(adminRoles));

export const adminStatuses = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

export const adminStatusValues = Object.freeze(Object.values(adminStatuses));

// Which roles each role may activate or deactivate. Roles left out can't change
// anyone's status. Mirrored in the frontend's constants/admin.ts.
export const adminStatusManageableRoles = Object.freeze({
  [adminRoles.SUPER_ADMIN]: adminRoleValues,
  [adminRoles.MANAGER]: Object.freeze([
    adminRoles.DISPATCHER,
    adminRoles.VIEWER,
  ]),
});

export const canManageAdminStatus = (actingRole, targetRole) =>
  adminStatusManageableRoles[actingRole]?.includes(targetRole) ?? false;
