import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: Number(env.SMTP_PORT) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = async (input: SendMailInput): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
};
