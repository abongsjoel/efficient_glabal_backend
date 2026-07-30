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
  findAdminByIdentifier,
  findAdminById,
  removeAdminProfileImage as removeAdminProfileImageById,
  touchAdminSession,
  updateAdminName as updateAdminNameById,
  updateAdminProfileImage as updateAdminProfileImageById,
} from "../repositories/adminRepository.js";

const passwordSaltRounds = 12;
const defaultSessionTtlHours = 8;
const defaultRememberedSessionTtlHours = 72;
const maxAdminNameLength = 80;
const maxProfileImageBytes = 1_000_000;
const profileImageDataUrlPattern =
  /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i;

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
  profileImage: admin.profileImage || "",
});

const normalizeAdminName = (name) =>
  typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

export const validateAdminName = (name) => {
  const normalizedName = normalizeAdminName(name);

  if (!normalizedName) {
    return "Enter your display name.";
  }

  if (normalizedName.length > maxAdminNameLength) {
    return `Display name must be ${maxAdminNameLength} characters or fewer.`;
  }

  return "";
};

const getDataUrlBase64Payload = (dataUrl) => dataUrl.split(",")[1] || "";

const getBase64ByteLength = (base64Value) => {
  const padding = base64Value.endsWith("==")
    ? 2
    : base64Value.endsWith("=")
      ? 1
      : 0;

  return (base64Value.length * 3) / 4 - padding;
};

export const validateAdminProfileImage = (profileImage) => {
  if (typeof profileImage !== "string" || !profileImage.trim()) {
    return "Choose a profile image to upload.";
  }

  const trimmedProfileImage = profileImage.trim();

  if (!profileImageDataUrlPattern.test(trimmedProfileImage)) {
    return "Upload a PNG, JPG, or WebP profile image.";
  }

  const imageBytes = getBase64ByteLength(
    getDataUrlBase64Payload(trimmedProfileImage),
  );

  if (imageBytes > maxProfileImageBytes) {
    return "Profile image must be 1 MB or smaller.";
  }

  return "";
};

const getUpdatedAdminDocument = (updateResult) =>
  updateResult?.value ?? updateResult;

export const authenticateAdmin = async ({ identifier, password }) => {
  const admin = await findAdminByIdentifier(identifier);

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

export const updateAdminProfile = async ({ adminId, name }) => {
  const validationMessage = validateAdminName(name);

  if (validationMessage) {
    const error = new Error(validationMessage);
    error.code = "INVALID_ADMIN_PROFILE";
    throw error;
  }

  const updatedAdmin = await updateAdminNameById(
    adminId,
    normalizeAdminName(name),
  );
  const updatedAdminDocument = getUpdatedAdminDocument(updatedAdmin);

  return updatedAdminDocument ? toSafeAdmin(updatedAdminDocument) : null;
};

export const updateAdminProfileImage = async ({ adminId, profileImage }) => {
  const validationMessage = validateAdminProfileImage(profileImage);

  if (validationMessage) {
    const error = new Error(validationMessage);
    error.code = "INVALID_PROFILE_IMAGE";
    throw error;
  }

  const updatedAdmin = await updateAdminProfileImageById(
    adminId,
    profileImage.trim(),
  );
  const updatedAdminDocument = getUpdatedAdminDocument(updatedAdmin);

  return updatedAdminDocument ? toSafeAdmin(updatedAdminDocument) : null;
};

export const removeAdminProfileImage = async (adminId) => {
  const updatedAdmin = await removeAdminProfileImageById(adminId);
  const updatedAdminDocument = getUpdatedAdminDocument(updatedAdmin);

  return updatedAdminDocument ? toSafeAdmin(updatedAdminDocument) : null;
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
