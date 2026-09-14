export function normalizePhilippineNumber(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return null;
}

export async function sendSms(recipient: string, message: string): Promise<{ messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    return { error: "Twilio SMS configuration is incomplete." };
  }

  const body = new URLSearchParams({ To: recipient, Body: message });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  else body.set("From", fromNumber as string);

  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Twilio request failed." };
  }

  const result = await response.json().catch(() => ({})) as { sid?: string; message?: string; code?: number };
  if (!response.ok) return { error: result.message ?? `Twilio returned HTTP ${response.status}.` };
  return { messageId: result.sid };
}
