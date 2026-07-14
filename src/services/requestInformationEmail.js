import { Resend } from "resend";

const defaultEmailTo = "abongsjoel@gmail.com";
const defaultEmailSubject = "New request information submission";

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

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatOptionalValue = (value) => value || "Not provided";

const buildRequestInformationText = (submission) => [
  "New request information submission",
  "",
  `Name: ${submission.name}`,
  `Email: ${submission.email}`,
  `Phone: ${submission.phone}`,
  `Organization: ${formatOptionalValue(submission.organization)}`,
  `Message: ${submission.message}`,
  "",
  `Source: ${submission.source}`,
  `Submitted at: ${submission.submittedAt}`,
];

const buildRequestInformationHtml = (submission) => {
  const rows = [
    ["Name", submission.name],
    ["Email", submission.email],
    ["Phone", submission.phone],
    ["Organization", formatOptionalValue(submission.organization)],
    ["Source", submission.source],
    ["Submitted at", submission.submittedAt],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New request information submission</h1>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; text-align: left; width: 160px;">
                    ${escapeHtml(label)}
                  </th>
                  <td style="border: 1px solid #e2e8f0; padding: 10px;">
                    ${escapeHtml(value)}
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <h2 style="font-size: 16px; margin: 24px 0 8px;">Message</h2>
      <p style="white-space: pre-wrap; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
        ${escapeHtml(submission.message)}
      </p>
    </div>
  `;
};

export const sendRequestInformationEmail = async (submission) => {
  const resend = getResendClient();
  const emailFrom = process.env.EMAIL_FROM;
  const emailTo = process.env.EMAIL_TO || defaultEmailTo;
  const emailSubject =
    process.env.REQUEST_INFORMATION_EMAIL_SUBJECT || defaultEmailSubject;

  if (!emailFrom) {
    throw new Error("EMAIL_FROM is not configured.");
  }

  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: [emailTo],
    replyTo: submission.email,
    subject: emailSubject,
    text: buildRequestInformationText(submission).join("\n"),
    html: buildRequestInformationHtml(submission),
  });

  if (error) {
    throw new Error(error.message || "Resend could not send the email.");
  }

  return data;
};
