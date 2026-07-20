import { MongoClient } from "mongodb";

let client;
let database;

const getDatabaseName = () => process.env.MONGODB_DB_NAME || "efficient_global";

export const connectToDatabase = async () => {
  if (database) {
    return database;
  }

  const mongoUri = process.env.MONGODB_URI?.trim();

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  const databaseName = getDatabaseName();

  client = new MongoClient(mongoUri);
  await client.connect();
  database = client.db(databaseName);

  console.log(`Connected to MongoDB database "${databaseName}"`);

  return database;
};

export const getDatabase = () => {
  if (!database) {
    throw new Error("MongoDB has not been connected yet.");
  }

  return database;
};

export const closeDatabaseConnection = async () => {
  if (!client) {
    return;
  }

  await client.close();
  client = undefined;
  database = undefined;
};
