const { verifyToken } = require("../services/authService");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
