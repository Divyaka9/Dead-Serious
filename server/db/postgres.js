const fs = require('fs');
const path = require('path');

let pool;

const LOCAL_DB_PATH = path.join(__dirname, '..', 'storage', 'db.local.json');

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

function getPgModule() {
  try {
    return require('pg');
  } catch {
    throw new Error('pg package is required when DATABASE_URL is set');
  }
}

function getPool() {
  if (!pool) {
    const { Pool } = getPgModule();
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

function ensureLocalDb() {
  const dir = path.dirname(LOCAL_DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ users: [], vaults: [] }, null, 2));
  }
}

function readLocalDb() {
  ensureLocalDb();
  return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
}

function writeLocalDb(db) {
  ensureLocalDb();
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
}

function result(rows = []) {
  return { rows, rowCount: rows.length };
}

function localQuery(text, params = []) {
  const sql = String(text).replace(/\s+/g, ' ').trim();
  const db = readLocalDb();

  if (sql.startsWith('CREATE TABLE') || sql.startsWith('CREATE INDEX')) {
    return result([]);
  }

  if (sql === 'SELECT vault_id, metadata FROM vaults WHERE owner_id = $1 LIMIT 1') {
    const row = db.vaults.find((vault) => vault.owner_id === params[0]);
    return result(row ? [row] : []);
  }

  if (sql === 'SELECT vault_id, owner_id, metadata FROM vaults WHERE vault_id = $1 LIMIT 1') {
    const row = db.vaults.find((vault) => vault.vault_id === params[0]);
    return result(row ? [row] : []);
  }

  if (sql === 'UPDATE vaults SET metadata = $2, updated_at = NOW() WHERE vault_id = $1') {
    const index = db.vaults.findIndex((vault) => vault.vault_id === params[0]);
    if (index >= 0) {
      db.vaults[index].metadata = params[1];
      db.vaults[index].updated_at = new Date().toISOString();
      writeLocalDb(db);
      return result([db.vaults[index]]);
    }
    return result([]);
  }

  if (sql.includes('INSERT INTO vaults')) {
    const [vaultId, ownerId, metadata, createdAt] = params;
    const row = {
      vault_id: vaultId,
      owner_id: ownerId,
      metadata,
      created_at: createdAt,
      updated_at: createdAt,
    };
    db.vaults.push(row);
    writeLocalDb(db);
    return result([row]);
  }

  if (sql === 'SELECT vault_id, metadata FROM vaults') {
    return result(db.vaults.map((vault) => ({ vault_id: vault.vault_id, metadata: vault.metadata })));
  }

  if (sql === 'SELECT user_id, email, name, password_hash, created_at FROM users WHERE email = $1 LIMIT 1') {
    const row = db.users.find((user) => user.email === params[0]);
    return result(row ? [row] : []);
  }

  if (sql.includes('INSERT INTO users')) {
    const [userId, email, name, passwordHash, createdAt] = params;
    const row = {
      user_id: userId,
      email,
      name,
      password_hash: passwordHash,
      created_at: createdAt,
      updated_at: createdAt,
    };
    db.users.push(row);
    writeLocalDb(db);
    return result([row]);
  }

  throw new Error(`Unsupported local DB query: ${sql}`);
}

async function query(text, params = []) {
  if (isDatabaseConfigured()) {
    const activePool = getPool();
    return activePool.query(text, params);
  }

  return localQuery(text, params);
}

async function initPostgres() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vaults (
      vault_id UUID PRIMARY KEY,
      owner_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
      metadata JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults(owner_id)');
}

module.exports = {
  query,
  initPostgres,
};
