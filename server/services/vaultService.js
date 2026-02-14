const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const { encryptText, decryptText, getServerEncryptionKey } = require("../utils/crypto");
const { notifyNominee } = require("../utils/notifications");
const { isS3Enabled, getBucketNameForUser, ensureBucketExists, uploadObject } = require("../utils/s3");

const STORAGE_PATH = path.join(__dirname, "..", "storage", "vaults");

const STATUS = {
  ACTIVE: "active",
  MISSED_CHECKIN: "missed_checkin",
  GRACE_PERIOD: "grace_period",
  NOMINEES_NOTIFIED: "nominees_notified",
  UNLOCKED: "unlocked",
};

function ensureStorage() {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

function getVaultDir(vaultId) {
  return path.join(STORAGE_PATH, vaultId);
}

function getVaultPath(vaultId) {
  return path.join(getVaultDir(vaultId), "metadata.json");
}

function listVaultIds() {
  ensureStorage();
  return fs
    .readdirSync(STORAGE_PATH, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readVault(vaultId) {
  ensureStorage();
  const metadataPath = getVaultPath(vaultId);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
}

function writeVault(vault) {
  ensureStorage();
  const vaultPath = getVaultDir(vault.vaultId);
  fs.mkdirSync(vaultPath, { recursive: true });

  const metadataPath = path.join(vaultPath, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(vault, null, 2));
}

function requireVault(vaultId) {
  const vault = readVault(vaultId);
  if (!vault) {
    throw new Error("Vault not found");
  }
  return vault;
}

function addDays(isoDate, days) {
  const base = new Date(isoDate);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function startGracePeriod(vault, nowIso) {
  vault.status = STATUS.GRACE_PERIOD;
  vault.deadMan.graceStartedAt = nowIso;
  vault.deadMan.graceEndsAt = addDays(nowIso, vault.checkInPolicy.gracePeriodDays);
}

function normalizeNominees(nominees) {
  return nominees.map((email, index) => ({
    id: String(index + 1),
    email,
    status: "pending",
    approvedAt: null,
    notifiedAt: null,
    shareReleasedAt: null,
  }));
}

function buildDeadMan(nowIso, checkInIntervalDays) {
  return {
    checkInIntervalDays,
    missedCount: 0,
    lastCheckInAt: nowIso,
    nextCheckInDueAt: addDays(nowIso, checkInIntervalDays),
    graceStartedAt: null,
    graceEndsAt: null,
    nomineesNotifiedAt: null,
  };
}

function formatVaultSummary(vault) {
  const approvedNominees = vault.nominees.filter((nominee) => nominee.status === "approved");
  const pendingNominees = vault.nominees.filter((nominee) => nominee.status === "pending");

  return {
    vaultId: vault.vaultId,
    ownerId: vault.ownerId,
    vaultName: vault.vaultName,
    status: vault.status,
    threshold: vault.threshold,
    triggerTime: vault.triggerTime,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
    lastCheckIn: vault.lastCheckIn,
    checkInCount: vault.checkIns.length,
    checkInPolicy: vault.checkInPolicy,
    deadMan: vault.deadMan,
    unlockRequest: vault.unlockRequest,
    storage: vault.storage,
    sharesStored: vault.shares.fragments.length,
    approvals: {
      approved: approvedNominees.length,
      required: vault.threshold,
      pending: pendingNominees.map((nominee) => nominee.email),
      nominees: vault.nominees,
    },
  };
}

async function createVault({
  ownerId,
  vaultName,
  nominees,
  threshold,
  triggerTime,
  checkInIntervalDays,
  gracePeriodDays,
  maxMissedCheckIns,
}) {
  const vaultId = randomUUID();
  const now = new Date().toISOString();

  let bucketName = null;
  if (isS3Enabled()) {
    bucketName = getBucketNameForUser(ownerId);
    await ensureBucketExists(bucketName);
  }

  const metadata = {
    vaultId,
    ownerId,
    vaultName,
    nominees: normalizeNominees(nominees),
    threshold,
    triggerTime,
    status: STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
    checkInPolicy: {
      intervalDays: checkInIntervalDays,
      gracePeriodDays,
      maxMissedCheckIns,
    },
    deadMan: buildDeadMan(now, checkInIntervalDays),
    checkIns: [],
    lastCheckIn: now,
    unlockRequest: null,
    files: [],
    shares: {
      threshold,
      totalShares: nominees.length,
      fragments: [],
      updatedAt: null,
    },
    storage: {
      provider: isS3Enabled() ? "s3" : "local",
      bucketName,
      rootPrefix: `vaults/${vaultId}`,
    },
  };

  writeVault(metadata);
  return formatVaultSummary(metadata);
}

function getVaultDashboard(vaultId) {
  return formatVaultSummary(requireVault(vaultId));
}

function checkIn(vaultId) {
  const vault = requireVault(vaultId);
  const now = new Date().toISOString();

  vault.lastCheckIn = now;
  vault.checkIns.push(now);
  vault.status = STATUS.ACTIVE;
  vault.unlockRequest = null;
  vault.deadMan = buildDeadMan(now, vault.checkInPolicy.intervalDays);
  vault.nominees = vault.nominees.map((nominee) => ({
    ...nominee,
    status: "pending",
    approvedAt: null,
  }));
  vault.updatedAt = now;

  writeVault(vault);
  return formatVaultSummary(vault);
}

function requestUnlock(vaultId, reason = "") {
  const vault = requireVault(vaultId);
  const now = new Date().toISOString();

  vault.status = STATUS.NOMINEES_NOTIFIED;
  vault.unlockRequest = {
    requestedAt: now,
    reason,
    approvalsRequired: vault.threshold,
    approvedCount: 0,
    completedAt: null,
  };
  vault.nominees = vault.nominees.map((nominee) => ({
    ...nominee,
    status: "pending",
    approvedAt: null,
    notifiedAt: nominee.notifiedAt || now,
  }));
  vault.deadMan.nomineesNotifiedAt = vault.deadMan.nomineesNotifiedAt || now;
  vault.updatedAt = now;

  writeVault(vault);
  return formatVaultSummary(vault);
}

function approveUnlock(vaultId, nomineeIdOrEmail) {
  const vault = requireVault(vaultId);

  if (!vault.unlockRequest) {
    throw new Error("No active unlock request");
  }

  const nominee = vault.nominees.find(
    (candidate) => candidate.id === nomineeIdOrEmail || candidate.email === nomineeIdOrEmail
  );

  if (!nominee) {
    throw new Error("Nominee not found");
  }

  if (nominee.status === "approved") {
    throw new Error("Nominee already approved");
  }

  const now = new Date().toISOString();
  nominee.status = "approved";
  nominee.approvedAt = now;

  const approvedCount = vault.nominees.filter((candidate) => candidate.status === "approved").length;
  vault.unlockRequest.approvedCount = approvedCount;

  if (approvedCount >= vault.threshold) {
    vault.status = STATUS.UNLOCKED;
    vault.unlockRequest.completedAt = now;
  }

  vault.updatedAt = now;
  writeVault(vault);

  return formatVaultSummary(vault);
}

function getApprovals(vaultId) {
  const vault = requireVault(vaultId);

  return {
    vaultId: vault.vaultId,
    vaultName: vault.vaultName,
    status: vault.status,
    threshold: vault.threshold,
    unlockRequest: vault.unlockRequest,
    nominees: vault.nominees,
  };
}

function storeEncryptedShares(vaultId, { shares, threshold, totalShares }) {
  const vault = requireVault(vaultId);

  if (!Array.isArray(shares) || shares.length !== 3) {
    throw new Error("Exactly 3 encrypted shares are required");
  }

  if (Number(threshold) !== 3 || Number(totalShares) !== 3) {
    throw new Error("DEADLOCK requires 3-of-3 secret sharing");
  }

  const key = getServerEncryptionKey();
  const now = new Date().toISOString();

  const fragments = shares.map((share, index) => {
    if (!share || typeof share !== "string") {
      throw new Error("Each share must be a base64 string");
    }

    const serverEncrypted = encryptText(share, key);
    return {
      shareId: String(index + 1),
      encryptedShare: serverEncrypted,
      storedAt: now,
    };
  });

  vault.shares = {
    threshold: 3,
    totalShares: 3,
    fragments,
    updatedAt: now,
  };
  vault.updatedAt = now;

  writeVault(vault);

  return { vaultId: vault.vaultId, sharesStored: fragments.length, updatedAt: now };
}

function releaseNomineeShare(vaultId, nomineeEmail) {
  const vault = requireVault(vaultId);

  if (vault.status !== STATUS.NOMINEES_NOTIFIED && vault.status !== STATUS.UNLOCKED) {
    throw new Error("Nominee shares are unavailable before nominee notification");
  }

  if (vault.shares.fragments.length !== 3) {
    throw new Error("Encrypted shares are not fully stored");
  }

  const nominee = vault.nominees.find((item) => item.email === nomineeEmail);
  if (!nominee) {
    throw new Error("Nominee not found");
  }

  const shareRecord = vault.shares.fragments.find((item) => item.shareId === nominee.id);
  if (!shareRecord) {
    throw new Error("Share not found for nominee");
  }

  const key = getServerEncryptionKey();
  const encryptedShare = decryptText(shareRecord.encryptedShare, key);

  nominee.shareReleasedAt = new Date().toISOString();
  writeVault(vault);

  return {
    vaultId: vault.vaultId,
    nominee: nominee.email,
    share: encryptedShare,
  };
}

async function saveEncryptedFile(vaultId, { fileName, contentType, cipherTextBase64 }) {
  const vault = requireVault(vaultId);
  const now = new Date().toISOString();
  const fileId = randomUUID();

  if (!cipherTextBase64) {
    throw new Error("cipherTextBase64 is required");
  }

  const keyName = `${vault.storage.rootPrefix}/files/${fileId}-${String(fileName || "payload.bin").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = Buffer.from(cipherTextBase64, "base64");

  if (vault.storage.provider === "s3") {
    await uploadObject({
      bucketName: vault.storage.bucketName,
      key: keyName,
      body: buffer,
      contentType,
    });
  } else {
    const filePath = path.join(getVaultDir(vault.vaultId), "files");
    fs.mkdirSync(filePath, { recursive: true });
    fs.writeFileSync(path.join(filePath, `${fileId}.bin`), buffer);
  }

  const fileRecord = {
    id: fileId,
    fileName: fileName || "payload.bin",
    contentType: contentType || "application/octet-stream",
    storageKey: keyName,
    storedAt: now,
  };

  vault.files.push(fileRecord);
  vault.updatedAt = now;
  writeVault(vault);

  return fileRecord;
}

function notifyNomineesForVault(vault, nowIso) {
  vault.nominees = vault.nominees.map((nominee) => {
    if (!nominee.notifiedAt) {
      notifyNominee({
        vaultId: vault.vaultId,
        vaultName: vault.vaultName,
        nomineeEmail: nominee.email,
        ownerId: vault.ownerId,
      });
    }

    return {
      ...nominee,
      notifiedAt: nominee.notifiedAt || nowIso,
      status: nominee.status === "approved" ? nominee.status : "pending",
    };
  });
}

function evaluateSingleVault(vault, nowIso) {
  if (vault.status === STATUS.UNLOCKED) {
    return false;
  }

  const now = new Date(nowIso);
  const nextDueAt = new Date(vault.deadMan.nextCheckInDueAt);

  if ((vault.status === STATUS.ACTIVE || vault.status === STATUS.MISSED_CHECKIN) && now > nextDueAt) {
    vault.deadMan.missedCount += 1;
    vault.status = STATUS.MISSED_CHECKIN;
    vault.deadMan.nextCheckInDueAt = addDays(vault.deadMan.nextCheckInDueAt, vault.checkInPolicy.intervalDays);

    if (vault.deadMan.missedCount >= vault.checkInPolicy.maxMissedCheckIns) {
      startGracePeriod(vault, nowIso);
    }

    vault.updatedAt = nowIso;
    return true;
  }

  if (vault.status === STATUS.GRACE_PERIOD && vault.deadMan.graceEndsAt) {
    if (now >= new Date(vault.deadMan.graceEndsAt)) {
      vault.status = STATUS.NOMINEES_NOTIFIED;
      vault.deadMan.nomineesNotifiedAt = nowIso;
      notifyNomineesForVault(vault, nowIso);
      vault.unlockRequest = {
        requestedAt: nowIso,
        reason: "Dead man switch triggered",
        approvalsRequired: vault.threshold,
        approvedCount: vault.nominees.filter((nominee) => nominee.status === "approved").length,
        completedAt: null,
      };
      vault.updatedAt = nowIso;
      return true;
    }
  }

  return false;
}

function evaluateDeadManSwitches() {
  const nowIso = new Date().toISOString();
  const vaultIds = listVaultIds();
  let updated = 0;

  vaultIds.forEach((vaultId) => {
    const vault = readVault(vaultId);
    if (!vault) {
      return;
    }

    if (evaluateSingleVault(vault, nowIso)) {
      writeVault(vault);
      updated += 1;
    }
  });

  return { scanned: vaultIds.length, updated, evaluatedAt: nowIso };
}

module.exports = {
  STATUS,
  createVault,
  getVaultDashboard,
  checkIn,
  requestUnlock,
  approveUnlock,
  getApprovals,
  storeEncryptedShares,
  releaseNomineeShare,
  saveEncryptedFile,
  evaluateDeadManSwitches,
};
