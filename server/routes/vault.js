const express = require("express");

const router = express.Router();
const vaultService = require("../services/vaultService");

function normalizeNominees(nominees) {
  return nominees.map((nominee) => String(nominee).trim().toLowerCase()).filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

router.post("/create", async (req, res) => {
  try {
    const {
      ownerId: ownerIdFromBody,
      nominees,
      triggerTime = null,
      threshold = 3,
      vaultName = "Untitled Vault",
      checkInIntervalDays = 14,
      gracePeriodDays = 30,
      maxMissedCheckIns = 2,
    } = req.body;

    const ownerId = req.user?.userId || String(ownerIdFromBody || "dev-guest").trim();

    if (!Array.isArray(nominees) || nominees.length !== 3) {
      return res.status(400).json({ error: "Exactly 3 nominees are required" });
    }

    const cleanedNominees = normalizeNominees(nominees);
    if (cleanedNominees.length !== nominees.length) {
      return res.status(400).json({ error: "Nominee values cannot be empty" });
    }

    if (new Set(cleanedNominees).size !== cleanedNominees.length) {
      return res.status(400).json({ error: "Nominees must be unique" });
    }

    const thresholdValue = Number(threshold);
    if (thresholdValue !== 3) {
      return res.status(400).json({ error: "DEADLOCK requires 3-of-3 threshold" });
    }

    const interval = parsePositiveInt(checkInIntervalDays, 14);
    const grace = parsePositiveInt(gracePeriodDays, 30);
    const missedLimit = parsePositiveInt(maxMissedCheckIns, 2);

    if (!interval || !grace || !missedLimit) {
      return res.status(400).json({ error: "checkInIntervalDays, gracePeriodDays, maxMissedCheckIns must be positive integers" });
    }

    const vault = await vaultService.createVault({
      ownerId: String(ownerId).trim(),
      vaultName: String(vaultName).trim() || "Untitled Vault",
      nominees: cleanedNominees,
      threshold: thresholdValue,
      triggerTime,
      checkInIntervalDays: interval,
      gracePeriodDays: grace,
      maxMissedCheckIns: missedLimit,
    });

    return res.json({ success: true, vault });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Vault creation failed" });
  }
});

router.get("/:vaultId/dashboard", (req, res) => {
  try {
    const result = vaultService.getVaultDashboard(req.params.vaultId);
    return res.json({ success: true, vault: result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.post("/:vaultId/check-in", (req, res) => {
  try {
    const result = vaultService.checkIn(req.params.vaultId);
    return res.json({ success: true, vault: result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Check-in failed" });
  }
});

router.post("/:vaultId/request-unlock", (req, res) => {
  try {
    const { reason = "" } = req.body;
    const result = vaultService.requestUnlock(req.params.vaultId, String(reason));
    return res.json({ success: true, vault: result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Unlock request failed" });
  }
});

router.get("/:vaultId/approvals", (req, res) => {
  try {
    const result = vaultService.getApprovals(req.params.vaultId);
    return res.json({ success: true, approvals: result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to load approvals" });
  }
});

router.post("/:vaultId/approve", (req, res) => {
  try {
    const { nominee } = req.body;

    if (!nominee) {
      return res.status(400).json({ error: "Nominee is required" });
    }

    const result = vaultService.approveUnlock(req.params.vaultId, String(nominee).trim().toLowerCase());
    return res.json({ success: true, vault: result });
  } catch (err) {
    if (
      err.message === "Vault not found" ||
      err.message === "No active unlock request" ||
      err.message === "Nominee not found" ||
      err.message === "Nominee already approved"
    ) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Approval failed" });
  }
});

router.post("/:vaultId/shares", (req, res) => {
  try {
    const { shares, threshold = 3, totalShares = 3 } = req.body;
    const result = vaultService.storeEncryptedShares(req.params.vaultId, { shares, threshold, totalShares });
    return res.json({ success: true, result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes("shares") || err.message.includes("DEADLOCK") || err.message.includes("MASTER_SHARE")) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: "Failed to store shares" });
  }
});

router.post("/:vaultId/files", async (req, res) => {
  try {
    const { fileName, contentType, cipherTextBase64 } = req.body;
    const file = await vaultService.saveEncryptedFile(req.params.vaultId, {
      fileName,
      contentType,
      cipherTextBase64,
    });

    return res.json({ success: true, file });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes("cipherTextBase64")) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to store encrypted file" });
  }
});

router.post("/:vaultId/nominee-share", (req, res) => {
  try {
    const nominee = String(req.body.nominee || "").trim().toLowerCase();

    if (!nominee) {
      return res.status(400).json({ error: "nominee is required" });
    }

    const result = vaultService.releaseNomineeShare(req.params.vaultId, nominee);
    return res.json({ success: true, result });
  } catch (err) {
    if (err.message === "Vault not found") {
      return res.status(404).json({ error: err.message });
    }

    if (
      err.message.includes("Nominee") ||
      err.message.includes("shares") ||
      err.message.includes("unavailable") ||
      err.message.includes("MASTER_SHARE")
    ) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: "Failed to release nominee share" });
  }
});

router.post("/evaluate-deadman", (req, res) => {
  try {
    const result = vaultService.evaluateDeadManSwitches();
    return res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to evaluate dead man switches" });
  }
});

module.exports = router;
