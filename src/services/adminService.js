import bcrypt from "bcryptjs";
import {
  adminRoleValues,
  adminRoles,
  adminStatusValues,
  adminStatuses,
} from "../constants/admin.js";
import {
  createAdmin,
  ensureAdminIndexes,
  findAdminByEmail,
} from "../repositories/adminRepository.js";

const passwordSaltRounds = 12;

const validateAdminRole = (role) => adminRoleValues.includes(role);
const validateAdminStatus = (status) => adminStatusValues.includes(status);

export const hashAdminPassword = (password) =>
  bcrypt.hash(password, passwordSaltRounds);

export const verifyAdminPassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

export const initializeAdminCollection = () => ensureAdminIndexes();

export const createAdminAccount = async ({
  name,
  email,
  password,
  role = adminRoles.VIEWER,
  status = adminStatuses.ACTIVE,
}) => {
  if (!name?.trim()) {
    throw new Error("Admin name is required.");
  }

  if (!email?.trim()) {
    throw new Error("Admin email is required.");
  }

  if (!password?.trim()) {
    throw new Error("Admin password is required.");
  }

  if (!validateAdminRole(role)) {
    throw new Error(`Invalid admin role "${role}".`);
  }

  if (!validateAdminStatus(status)) {
    throw new Error(`Invalid admin status "${status}".`);
  }

  const existingAdmin = await findAdminByEmail(email);

  if (existingAdmin) {
    throw new Error(`Admin with email "${email}" already exists.`);
  }

  const passwordHash = await hashAdminPassword(password);

  return createAdmin({
    name,
    email,
    passwordHash,
    role,
    status,
  });
};
