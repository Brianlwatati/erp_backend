import nodemailer from "nodemailer";
import { env } from "../../../config/env.js";

// Lazily created — building the transporter touches env vars that are only
// required if email delivery is actually configured, so we don't want to
// throw at module-load time for companies that only use WhatsApp.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPassword },
    });
  }
  return transporter;
}

export async function sendReportEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: env.smtpFromAddress,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
