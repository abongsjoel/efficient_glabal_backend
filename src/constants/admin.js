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
