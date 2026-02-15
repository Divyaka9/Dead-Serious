const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: false })

const { initPostgres, query } = require('../db/postgres')

const USERS_FILE = path.join(__dirname, '..', 'storage', 'users', 'users.json')

function readJsonUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return []
  }

  const raw = fs.readFileSync(USERS_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

async function migrate() {
  if (!String(process.env.DATABASE_URL || '').trim()) {
    throw new Error('DATABASE_URL is required to migrate users')
  }

  await initPostgres()
  const users = readJsonUsers()

  let inserted = 0
  let skipped = 0

  for (const user of users) {
    const userId = user.userId || user.user_id
    const email = String(user.email || '').trim().toLowerCase()
    const name = String(user.name || email.split('@')[0] || 'User').trim()
    const passwordHash = user.passwordHash || user.password_hash
    const createdAt = user.createdAt || user.created_at || new Date().toISOString()
    const updatedAt = user.updatedAt || user.updated_at || createdAt

    if (!userId || !email || !passwordHash) {
      skipped += 1
      continue
    }

    const existing = await query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [email])
    if (existing.rows.length) {
      skipped += 1
      continue
    }

    await query(
      `
        INSERT INTO users (user_id, email, name, password_hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [userId, email, name, passwordHash, createdAt, updatedAt]
    )

    inserted += 1
  }

  console.log(`migration complete. inserted=${inserted} skipped=${skipped}`)
}

migrate().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
