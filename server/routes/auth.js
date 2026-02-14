const express = require("express");
const { registerUser, loginUser } = require("../services/authService");
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

module.exports = router;
