import { Resend } from "resend";

const defaultEmailTo = "abongsjoel@gmail.com";

let resendClient;

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
};

const parseEmailRecipients = (value) =>
  value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const formatOptionalValue = (value) => value || "Not provided";

export const sendEmail = async ({ html, replyTo, subject, text }) => {
  const resend = getResendClient();
  const emailFrom = process.env.EMAIL_FROM;
  const emailTo = parseEmailRecipients(process.env.EMAIL_TO || defaultEmailTo);

  if (!emailFrom) {
    throw new Error("EMAIL_FROM is not configured.");
  }

  if (emailTo.length === 0) {
    throw new Error("EMAIL_TO is not configured.");
  }

  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: emailTo,
    replyTo,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Resend could not send the email.");
  }

  return data;
};
