import { createTransport } from "nodemailer";

export type EmailTarget = { name: string; email: string };
export type EmailDelivery = { error?: string };

export async function sendEmailBatch(
  recipients: EmailTarget[],
  subject: string,
  message: string,
): Promise<{ results: EmailDelivery[]; error?: string }> {
  if (recipients.length === 0) return { results: [], error: "No email recipients were provided." };
  if (recipients.length > 100) return { results: [], error: "Gmail email batches are limited to 100 recipients." };

  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password) {
    return { results: recipients.map(() => ({ error: "Google SMTP configuration is incomplete." })), error: "Google SMTP configuration is incomplete." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    return { results: recipients.map(() => ({ error: "GMAIL_USER must be a valid email address." })), error: "GMAIL_USER must be a valid email address." };
  }

  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 5,
    auth: { user, pass: password },
  });

  try {
    const results = await Promise.all(recipients.map(async (recipient): Promise<EmailDelivery> => {
      try {
        await transporter.sendMail({
          from: `"VacciTrack" <${user}>`,
          to: recipient.email,
          subject,
          text: recipient.name ? `Dear ${recipient.name},\n\n${message}\n\nVacciTrack` : message,
        });
        return {};
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown SMTP error.";
        console.error(`Email delivery failed for a recipient: ${detail}`);
        return { error: detail };
      }
    }));
    return { results };
  } finally {
    transporter.close();
  }
}
