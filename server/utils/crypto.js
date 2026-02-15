const crypto = require("crypto");

const SERVER_KEY_BYTES = 32;

function generateKey() {
  return crypto.randomBytes(SERVER_KEY_BYTES);
}

function encrypt(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv,
    authTag,
  };
}

function decrypt(encrypted, key, iv, authTag) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function getServerEncryptionKey() {
  const rawKey = process.env.MASTER_SHARE_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("MASTER_SHARE_ENCRYPTION_KEY is required for share encryption");
  }

  const normalizedKey = String(rawKey).trim();
  const isHexKey = /^[0-9a-fA-F]{64}$/.test(normalizedKey);
  const key = isHexKey ? Buffer.from(normalizedKey, "hex") : Buffer.from(normalizedKey, "base64");

  if (key.length !== SERVER_KEY_BYTES) {
    throw new Error("MASTER_SHARE_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex)");
  }

  return key;
}

function encryptText(plainText, key) {
  const payload = Buffer.from(plainText, "utf8");
  const { encrypted, iv, authTag } = encrypt(payload, key);

  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptText(payload, key) {
  const encrypted = Buffer.from(payload.cipherText, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  return decrypt(encrypted, key, iv, authTag).toString("utf8");
}

module.exports = {
  generateKey,
  encrypt,
  decrypt,
  getServerEncryptionKey,
  encryptText,
  decryptText,
};
