import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!env.SMTP_HOST) {
    console.log(`[mail] (SMTP_HOST unset — not sent)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    return;
  }
  await getTransporter().sendMail({ from: env.MAIL_FROM, ...message });
}
