import nodemailer from 'nodemailer';
import { renderBriefHtml, renderBriefText } from './brief-format.js';

export function isMailEnvConfigured(env = process.env) {
  return Boolean(
    env.MAIL_TO &&
    env.SMTP_HOST &&
    env.SMTP_PORT &&
    env.SMTP_USER &&
    env.SMTP_PASS
  );
}

export function createMailer(env = process.env) {
  const configured = isMailEnvConfigured(env);
  const transporter = configured
    ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === 'true' || Number(env.SMTP_PORT) === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    })
    : null;

  return {
    isConfigured() {
      return configured;
    },
    async sendBrief(record) {
      if (!transporter) {
        throw new Error('SMTP is not configured');
      }
      return transporter.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to: env.MAIL_TO,
        subject: `Новая анкета: ${record.clinicName}`,
        text: renderBriefText(record),
        html: renderBriefHtml(record)
      });
    }
  };
}
