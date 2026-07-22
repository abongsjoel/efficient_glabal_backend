import dotenv from "dotenv";
import {
  closeDatabaseConnection,
  connectToDatabase,
} from "../src/config/database.js";
import { adminRoles } from "../src/constants/admin.js";
import { findAdminByEmail } from "../src/repositories/adminRepository.js";
import {
  createAdminAccount,
  initializeAdminCollection,
} from "../src/services/adminService.js";

dotenv.config();

const requiredEnvironmentVariables = [
  "ADMIN_SEED_NAME",
  "ADMIN_SEED_EMAIL",
  "ADMIN_SEED_PASSWORD",
];

const getRequiredEnvironmentValue = (key) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to seed the first admin.`);
  }

  return value;
};

const seedAdmin = async () => {
  await connectToDatabase();
  await initializeAdminCollection();

  requiredEnvironmentVariables.forEach(getRequiredEnvironmentValue);

  const name = getRequiredEnvironmentValue("ADMIN_SEED_NAME");
  const email = getRequiredEnvironmentValue("ADMIN_SEED_EMAIL");
  const password = getRequiredEnvironmentValue("ADMIN_SEED_PASSWORD");
  const username = process.env.ADMIN_SEED_USERNAME?.trim();
  const existingAdmin = await findAdminByEmail(email);

  if (existingAdmin) {
    console.log(`Admin seed skipped. Admin already exists for ${email}.`);
    return;
  }

  const admin = await createAdminAccount({
    name,
    email,
    password,
    role: adminRoles.SUPER_ADMIN,
    username,
  });

  console.log(`Seeded super admin ${admin.email} (${admin.username}).`);
};

try {
  await seedAdmin();
} catch (error) {
  console.error("Failed to seed admin", error);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
