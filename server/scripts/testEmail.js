const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true })
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: false })

const { sendMail } = require('../utils/notifications')

async function run() {
  const to = String(process.argv[2] || '').trim()
  if (!to) {
    throw new Error('Usage: node server/scripts/testEmail.js <recipient_email>')
  }

  await sendMail({
    to,
    subject: 'Dead Serious SMTP Test',
    text: `SMTP test from Dead Serious at ${new Date().toISOString()}`,
  })

  console.log(`[mail-test] success to=${to}`)
}

run().catch((error) => {
  console.error(`[mail-test] failed: ${error.message}`)
  process.exit(1)
})
