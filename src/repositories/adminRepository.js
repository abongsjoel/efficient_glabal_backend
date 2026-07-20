import { getDatabase } from "../config/database.js";
import { adminStatuses } from "../constants/admin.js";

const adminsCollectionName = "admins";

export const normalizeAdminEmail = (email) => email.trim().toLowerCase();

export const getAdminsCollection = () =>
  getDatabase().collection(adminsCollectionName);

export const ensureAdminIndexes = async () => {
  const admins = getAdminsCollection();

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
};

export const findAdminByEmail = (email) =>
  getAdminsCollection().findOne({ email: normalizeAdminEmail(email) });

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
