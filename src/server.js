import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  connectToDatabase,
  getDatabase,
  getDatabaseName,
} from "./config/database.js";
import adminRoutes from "./routes/admin.js";
import deliveryRequestRoutes from "./routes/deliveryRequest.js";
import requestInformationRoutes from "./routes/requestInformation.js";
import { initializeAdminCollection } from "./services/adminService.js";
import { initializeDeliveryRequestCollection } from "./services/deliveryRequestService.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5050;
const host = process.env.HOST || "127.0.0.1";
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "2mb";
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: requestBodyLimit }));

app.get("/", (_req, res) => {
  res.json({
    name: "Efficient Global Backend",
    status: "ok",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await getDatabase().command({ ping: 1 });

    res.json({
      status: "ok",
      database: {
        name: getDatabaseName(),
        connected: true,
      },
    });
  } catch (error) {
    console.error("MongoDB health check failed", error);

    res.status(503).json({
      status: "error",
      database: {
        name: getDatabaseName(),
        connected: false,
      },
    });
  }
});

app.use("/api/admin", adminRoutes);
app.use("/api/delivery-request", deliveryRequestRoutes);
app.use("/api/request-information", requestInformationRoutes);

const startServer = async () => {
  try {
    await connectToDatabase();
    await initializeAdminCollection();
    await initializeDeliveryRequestCollection();

    app.listen(port, host, () => {
      console.log(`Efficient Global backend listening at http://${host}:${port}`);
    });
  } catch (error) {
    console.error("Failed to start Efficient Global backend", error);
    process.exit(1);
  }
};

startServer();
