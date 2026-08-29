import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * Reusable Nodemailer transporter backed by Ethereal SMTP credentials
 * from environment variables. Call createTransporter() wherever you
 * need to send mail — in practice the worker is the only consumer.
 */
export const createTransporter = () => {
  return nodemailer.createTransport({
    host: env.ETHEREAL_HOST,
    port: env.ETHEREAL_PORT,
    secure: env.ETHEREAL_SECURE,
    auth: {
      user: env.ETHEREAL_USER,
      pass: env.ETHEREAL_PASS,
    },
  });
};
