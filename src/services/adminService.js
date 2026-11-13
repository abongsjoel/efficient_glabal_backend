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
  listAdmins,
  removeAdminProfileImage as removeAdminProfileImageById,
  touchAdminSession,
  updateAdminName as updateAdminNameById,
  updateAdminPassword as updateAdminPasswordById,
  updateAdminProfileImage as updateAdminProfileImageById,
} from "../repositories/adminRepository.js";

const passwordSaltRounds = 12;
const defaultSessionTtlHours = 8;
const defaultRememberedSessionTtlHours = 72;
const maxAdminNameLength = 80;
const minAdminPasswordLength = 8;
const maxAdminPasswordLength = 72;
const maxProfileImageBytes = 1_000_000;
const profileImageDataUrlPattern =
  /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i;
const adminPasswordRequirementMessage =
  "Password must include a lowercase letter, uppercase letter, number, and special character.";
const adminEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

const toIsoString = (value) =>
  value instanceof Date ? value.toISOString() : "";

export const getAdminsForAdmin = async () => {
  const admins = await listAdmins();

  return admins.map((admin) => ({
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    createdAt: toIsoString(admin.createdAt),
    updatedAt: toIsoString(admin.updatedAt),
  }));
};

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

export const validateAdminPasswordChange = ({
  currentPassword = "",
  newPassword = "",
  confirmPassword = "",
} = {}) => {
  const errors = {};

  if (!currentPassword.trim()) {
    errors.currentPassword = "Enter your current password.";
  }

  const newPasswordError = getAdminPasswordError(
    newPassword,
    "Enter a new password.",
  );

  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  }

  if (!confirmPassword.trim()) {
    errors.confirmPassword = "Confirm your new password.";
  } else if (newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

// Returns an empty string when the password meets every rule.
const getAdminPasswordError = (password, emptyMessage) => {
  if (!password.trim()) {
    return emptyMessage;
  }

  if (password.length < minAdminPasswordLength) {
    return `Password must be at least ${minAdminPasswordLength} characters.`;
  }

  if (password.length > maxAdminPasswordLength) {
    return `Password must be ${maxAdminPasswordLength} characters or fewer.`;
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  ) {
    return adminPasswordRequirementMessage;
  }

  return "";
};

export const validateNewAdminAccount = ({
  name = "",
  email = "",
  password = "",
  confirmPassword = "",
  role = "",
  status = "",
} = {}) => {
  const errors = {};
  const normalizedName = normalizeAdminName(name);
  const normalizedEmail = email.trim();

  if (!normalizedName) {
    errors.name = "Enter the admin's name.";
  } else if (normalizedName.length > maxAdminNameLength) {
    errors.name = `Name must be ${maxAdminNameLength} characters or fewer.`;
  }

  if (!normalizedEmail) {
    errors.email = "Enter the admin's email.";
  } else if (!adminEmailPattern.test(normalizedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validateAdminRole(role)) {
    errors.role = "Choose a valid role.";
  }

  if (!validateAdminStatus(status)) {
    errors.status = "Choose a valid status.";
  }

  const passwordError = getAdminPasswordError(password, "Enter a password.");

  if (passwordError) {
    errors.password = passwordError;
  }

  if (!confirmPassword.trim()) {
    errors.confirmPassword = "Confirm the password.";
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

const createNewAdminAccountError = (
  errors,
  message = "Please correct the highlighted fields.",
) => {
  const error = new Error(message);
  error.code = "INVALID_NEW_ADMIN";
  error.errors = errors;
  return error;
};

const duplicateAdminEmailMessage = "An admin with this email already exists.";

const isDuplicateKeyError = (error) => error?.code === 11000;

const createAdminPasswordError = (
  errors,
  message = "Please correct the highlighted fields.",
) => {
  const error = new Error(message);
  error.code = "INVALID_ADMIN_PASSWORD";
  error.errors = errors;
  return error;
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

export const updateAdminPassword = async ({
  adminId,
  currentPassword,
  newPassword,
  confirmPassword,
}) => {
  const errors = validateAdminPasswordChange({
    currentPassword,
    newPassword,
    confirmPassword,
  });

  if (Object.keys(errors).length > 0) {
    throw createAdminPasswordError(errors);
  }

  const admin = await findAdminById(adminId);

  if (!admin) {
    return null;
  }

  const isCurrentPasswordValid = await verifyAdminPassword(
    currentPassword,
    admin.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    throw createAdminPasswordError({
      currentPassword: "Current password is incorrect.",
    });
  }

  const isSamePassword = await verifyAdminPassword(
    newPassword,
    admin.passwordHash,
  );

  if (isSamePassword) {
    throw createAdminPasswordError({
      newPassword: "Choose a password different from your current password.",
    });
  }

  const passwordHash = await hashAdminPassword(newPassword);
  const updatedAdmin = await updateAdminPasswordById(adminId, passwordHash);
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

// Used by the admin dashboard. Unlike createAdminAccount (used by the seed
// script), this returns field-level errors the form can show.
export const addAdminAccount = async ({
  name,
  email,
  password,
  confirmPassword,
  role,
  status,
}) => {
  const errors = validateNewAdminAccount({
    name,
    email,
    password,
    confirmPassword,
    role,
    status,
  });

  if (Object.keys(errors).length > 0) {
    throw createNewAdminAccountError(errors);
  }

  const existingAdmin = await findAdminByEmail(email);

  if (existingAdmin) {
    throw createNewAdminAccountError(
      { email: duplicateAdminEmailMessage },
      duplicateAdminEmailMessage,
    );
  }

  const passwordHash = await hashAdminPassword(password);

  try {
    const admin = await createAdmin({
      name: normalizeAdminName(name),
      email,
      passwordHash,
      role,
      status,
    });

    return toSafeAdmin(admin);
  } catch (error) {
    // Two requests for the same email can both pass the lookup above; the
    // unique email index rejects the second one.
    if (isDuplicateKeyError(error)) {
      throw createNewAdminAccountError(
        { email: duplicateAdminEmailMessage },
        duplicateAdminEmailMessage,
      );
    }

    throw error;
  }
};

// Lets the add-admin form flag a taken email before submit. Returns null when
// the email isn't valid, so the route can reject it instead of looking it up.
export const checkAdminEmailAvailability = async (email) => {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";

  if (!adminEmailPattern.test(normalizedEmail)) {
    return null;
  }

  const existingAdmin = await findAdminByEmail(normalizedEmail);

  return {
    available: !existingAdmin,
    message: existingAdmin ? duplicateAdminEmailMessage : "",
  };
};
