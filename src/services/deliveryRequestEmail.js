import { escapeHtml, formatOptionalValue, sendEmail } from "./resendEmail.js";

const defaultEmailSubject = "New delivery request submission";

const buildDeliveryRequestText = (submission) => [
  "New delivery request submission",
  "",
  `Pickup location: ${submission.pickup}`,
  `Delivery location: ${submission.delivery}`,
  `Date / time needed: ${submission.datetime}`,
  `Request type: ${submission.vehicle}`,
  `Rush delivery required: ${submission.rush}`,
  "",
  `Name: ${submission.name}`,
  `Email: ${submission.email}`,
  `Phone: ${submission.phone}`,
  `Additional instructions: ${formatOptionalValue(submission.instructions)}`,
  "",
  `Source: ${submission.source}`,
  `Submitted at: ${submission.submittedAt}`,
];

const buildDeliveryRequestHtml = (submission) => {
  const rows = [
    ["Pickup location", submission.pickup],
    ["Delivery location", submission.delivery],
    ["Date / time needed", submission.datetime],
    ["Request type", submission.vehicle],
    ["Rush delivery required", submission.rush],
    ["Name", submission.name],
    ["Email", submission.email],
    ["Phone", submission.phone],
    ["Source", submission.source],
    ["Submitted at", submission.submittedAt],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New delivery request submission</h1>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; text-align: left; width: 180px;">
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
      <h2 style="font-size: 16px; margin: 24px 0 8px;">Additional instructions</h2>
      <p style="white-space: pre-wrap; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
        ${escapeHtml(formatOptionalValue(submission.instructions))}
      </p>
    </div>
  `;
};

export const sendDeliveryRequestEmail = async (submission) =>
  sendEmail({
    replyTo: submission.email,
    subject: process.env.DELIVERY_REQUEST_EMAIL_SUBJECT || defaultEmailSubject,
    text: buildDeliveryRequestText(submission).join("\n"),
    html: buildDeliveryRequestHtml(submission),
  });
