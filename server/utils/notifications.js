let cachedTransporter = null;
let transporterVerified = false;
let loggedMissingConfig = false;
let loggedMissingPackage = false;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || (user && user.includes('gmail.com') ? 'smtp.gmail.com' : '');
  const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 587 : 587));
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    if (!loggedMissingConfig) {
      console.warn('[mail] SMTP not configured. Set SMTP_* or EMAIL_* env vars.');
      loggedMissingConfig = true;
    }
    return null;
  }

  try {
    const nodemailer = require('nodemailer');
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return cachedTransporter;
  } catch (error) {
    if (!loggedMissingPackage) {
      console.warn(`[mail] nodemailer unavailable (${error.message}). Install with: npm install nodemailer`);
      loggedMissingPackage = true;
    }
    return null;
  }
}

async function sendMail({ to, subject, text }) {
  const transporter = getTransporter();
  const allowFallback = process.env.MAIL_FALLBACK_TO_LOG === 'true';
  if (!transporter) {
    const reason = 'SMTP not configured. Set SMTP_* or EMAIL_* env vars.'
    if (allowFallback) {
      console.log(`[mail-fallback] to=${to} subject="${subject}" body="${text}"`);
      return;
    }
    throw new Error(reason);
  }

  try {
    if (!transporterVerified) {
      await transporter.verify();
      transporterVerified = true;
      console.log('[mail] transporter verified');
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log(`[mail] sent to=${to} messageId=${info?.messageId || 'n/a'}`);
  } catch (error) {
    console.error(`[mail] failed to=${to}: ${error.message}`);
    throw error;
  }
}

async function notifyNominee({ vaultId, vaultName, nomineeEmail, ownerId, nomineeShare }) {
  const subject = `DEAD SERIOUS Nominee Notification for ${vaultName}`;
  const text = [
    `You have been designated as a nominee key holder for vault "${vaultName}".`,
    `Vault ID: ${vaultId}`,
    `Owner ID: ${ownerId}`,
    `Your share fragment: ${nomineeShare}`,
    '',
    'Keep this share private. You will need it for nominee unlock.',
  ].join('\n');

  await sendMail({ to: nomineeEmail, subject, text });
}

async function sendNomineeVerificationCode({ vaultId, nomineeEmail, code }) {
  const subject = 'DEAD SERIOUS nominee verification code';
  const text = [`Vault ID: ${vaultId}`, `Your nominee verification code is: ${code}`, '', 'This code expires in 10 minutes.'].join('\n');

  await sendMail({ to: nomineeEmail, subject, text });
}

module.exports = {
  sendMail,
  notifyNominee,
  sendNomineeVerificationCode,
};
