require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const vaultRoutes = require("./routes/vault");
const authMiddleware = require("./middleware/auth");
const { evaluateDeadManSwitches } = require("./services/vaultService");

const app = express();
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.use("/auth", authRoutes);
app.use("/vault", AUTH_REQUIRED ? authMiddleware : (req, res, next) => next(), vaultRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = Number(process.env.PORT || 3000);
const MONITOR_INTERVAL_MS = Number(process.env.DEADMAN_MONITOR_INTERVAL_MS || 60_000);

setInterval(() => {
  try {
    const result = evaluateDeadManSwitches();
    if (result.updated > 0) {
      console.log("[deadman]", result);
    }
  } catch (error) {
    console.error("[deadman] evaluation error", error.message);
  }
}, MONITOR_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
