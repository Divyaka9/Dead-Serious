const express = require("express");
const { registerUser, loginUser } = require("../services/authService");
const vaultService = require("../services/vaultService");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await registerUser({ email, password, name });
    const session = await loginUser({ email, password });

    return res.status(201).json({ success: true, user, token: session.token });
  } catch (error) {
    if (
      error.message === "Email already registered" ||
      error.message === "Email is required" ||
      error.message === "Password must be at least 8 characters"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const session = await loginUser({ email, password });

    return res.json({ success: true, ...session });
  } catch (error) {
    if (
      error.message === "Email and password are required" ||
      error.message === "Invalid credentials"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authMiddleware, (req, res) => {
  return res.json({ success: true, user: req.user });
});

router.post("/nominee/start", async (req, res) => {
  try {
    const vaultId = String(req.body.vaultId || "").trim();
    const nomineeEmail = String(req.body.nomineeEmail || "").trim().toLowerCase();

    if (!vaultId || !nomineeEmail) {
      return res.status(400).json({ error: "vaultId and nomineeEmail are required" });
    }

    const result = await vaultService.startNomineeLogin(vaultId, nomineeEmail);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (
      error.message.includes("Nominee") ||
      error.message.includes("Vault not found") ||
      error.message.includes("unavailable") ||
      error.message.includes("verification email")
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to start nominee login"
          : error.message || "Failed to start nominee login",
    });
  }
});

router.post("/nominee/verify", async (req, res) => {
  try {
    const challengeToken = String(req.body.challengeToken || "").trim();
    const code = String(req.body.code || "").trim();
    const result = await vaultService.verifyNomineeLogin(challengeToken, code);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (
      error.message.includes("required") ||
      error.message.includes("Invalid") ||
      error.message.includes("Nominee") ||
      error.message.includes("unavailable")
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: "Failed to verify nominee login" });
  }
});

module.exports = router;
