import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import {
  adminRoleValues,
  adminRoles,
  adminStatusValues,
  adminStatuses,
} from "../constants/admin.js";
import {
  createAdmin,
  createAdminSession,
  deleteAdminSessionByTokenHash,
  ensureAdminIndexes,
  findActiveAdminSessionByTokenHash,
  findAdminByEmail,
  findAdminById,
  touchAdminSession,
} from "../repositories/adminRepository.js";

const passwordSaltRounds = 12;
const defaultSessionTtlHours = 8;
const defaultRememberedSessionTtlHours = 72;

const validateAdminRole = (role) => adminRoleValues.includes(role);
const validateAdminStatus = (status) => adminStatusValues.includes(status);

export const hashAdminPassword = (password) =>
  bcrypt.hash(password, passwordSaltRounds);

export const verifyAdminPassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);

export const initializeAdminCollection = () => ensureAdminIndexes();

const getPositiveEnvironmentNumber = (key, fallback) => {
  const configuredValue = Number(process.env[key]);

  return Number.isFinite(configuredValue) && configuredValue > 0
    ? configuredValue
    : fallback;
};

const getSessionTtlHours = () =>
  getPositiveEnvironmentNumber(
    "ADMIN_SESSION_TTL_HOURS",
    defaultSessionTtlHours,
  );

const getRememberedSessionTtlHours = () =>
  getPositiveEnvironmentNumber(
    "ADMIN_REMEMBERED_SESSION_TTL_HOURS",
    defaultRememberedSessionTtlHours,
  );

export const getAdminSessionMaxAgeMs = ({ keepMeLoggedIn = false } = {}) => {
  const sessionTtlHours = keepMeLoggedIn
    ? getRememberedSessionTtlHours()
    : getSessionTtlHours();

  return sessionTtlHours * 60 * 60 * 1000;
};

export const hashSessionToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const toSafeAdmin = (admin) => ({
  id: admin._id.toString(),
  name: admin.name,
  email: admin.email,
  role: admin.role,
  status: admin.status,
});

export const authenticateAdmin = async ({ email, password }) => {
  const admin = await findAdminByEmail(email);

  if (!admin) {
    return null;
  }

  if (admin.status !== adminStatuses.ACTIVE) {
    return null;
  }

  const isPasswordValid = await verifyAdminPassword(
    password,
    admin.passwordHash,
  );

  return isPasswordValid ? toSafeAdmin(admin) : null;
};

export const createSessionForAdmin = async (
  adminId,
  { keepMeLoggedIn = false } = {},
) => {
  const token = randomBytes(32).toString("base64url");
  const maxAgeMs = getAdminSessionMaxAgeMs({ keepMeLoggedIn });
  const expiresAt = new Date(Date.now() + maxAgeMs);

  await createAdminSession({
    adminId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return {
    token,
    maxAgeMs,
    expiresAt,
  };
};

export const getAdminFromSessionToken = async (token) => {
  if (!token) {
    return null;
  }

  const session = await findActiveAdminSessionByTokenHash(
    hashSessionToken(token),
  );

  if (!session) {
    return null;
  }

  const admin = await findAdminById(session.adminId);

  if (!admin || admin.status !== adminStatuses.ACTIVE) {
    return null;
  }

  await touchAdminSession(session._id);

  return toSafeAdmin(admin);
};

export const deleteAdminSession = (token) => {
  if (!token) {
    return null;
  }

  return deleteAdminSessionByTokenHash(hashSessionToken(token));
};

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
