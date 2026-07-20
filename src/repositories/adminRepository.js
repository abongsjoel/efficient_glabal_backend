import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";
import { adminStatuses } from "../constants/admin.js";

const adminsCollectionName = "admins";
const adminSessionsCollectionName = "admin_sessions";

export const normalizeAdminEmail = (email) => email.trim().toLowerCase();

export const getAdminsCollection = () =>
  getDatabase().collection(adminsCollectionName);

export const getAdminSessionsCollection = () =>
  getDatabase().collection(adminSessionsCollectionName);

export const ensureAdminIndexes = async () => {
  const admins = getAdminsCollection();
  const adminSessions = getAdminSessionsCollection();

  await admins.createIndex(
    { email: 1 },
    {
      unique: true,
      name: "unique_admin_email",
    },
  );
  await admins.createIndex(
    { role: 1, status: 1 },
    {
      name: "admin_role_status",
    },
  );
  await adminSessions.createIndex(
    { tokenHash: 1 },
    {
      unique: true,
      name: "unique_admin_session_token_hash",
    },
  );
  await adminSessions.createIndex(
    { expiresAt: 1 },
    {
      expireAfterSeconds: 0,
      name: "admin_session_expiry",
    },
  );
  await adminSessions.createIndex(
    { adminId: 1 },
    {
      name: "admin_session_admin",
    },
  );
};

export const findAdminByEmail = (email) =>
  getAdminsCollection().findOne({ email: normalizeAdminEmail(email) });

export const findAdminById = (id) => {
  const objectId = id instanceof ObjectId ? id : ObjectId.isValid(id) && new ObjectId(id);

  if (!objectId) {
    return null;
  }

  return getAdminsCollection().findOne({ _id: objectId });
};

export const createAdmin = async ({
  name,
  email,
  passwordHash,
  role,
  status = adminStatuses.ACTIVE,
}) => {
  const now = new Date();
  const admin = {
    name: name.trim(),
    email: normalizeAdminEmail(email),
    passwordHash,
    role,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getAdminsCollection().insertOne(admin);

  return {
    ...admin,
    _id: result.insertedId,
  };
};

export const createAdminSession = async ({ adminId, tokenHash, expiresAt }) => {
  const now = new Date();
  const session = {
    adminId: new ObjectId(adminId),
    tokenHash,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    expiresAt,
  };

  const result = await getAdminSessionsCollection().insertOne(session);

  return {
    ...session,
    _id: result.insertedId,
  };
};

export const findActiveAdminSessionByTokenHash = (tokenHash) =>
  getAdminSessionsCollection().findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

export const touchAdminSession = (sessionId) =>
  getAdminSessionsCollection().updateOne(
    { _id: sessionId },
    {
      $set: {
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

export const deleteAdminSessionByTokenHash = (tokenHash) =>
  getAdminSessionsCollection().deleteOne({ tokenHash });
