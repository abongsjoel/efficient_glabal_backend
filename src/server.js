import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import requestInformationRoutes from "./routes/requestInformation.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || "127.0.0.1";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (_req, res) => {
  res.json({
    name: "Efficient Global Backend",
    status: "ok",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/request-information", requestInformationRoutes);

app.listen(port, host, () => {
  console.log(`Efficient Global backend listening at http://${host}:${port}`);
});
