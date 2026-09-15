export function normalizePhilippineNumber(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) return compact;
  if (/^\+639\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^639\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return null;
}

export async function sendSms(recipient: string, message: string): Promise<{ messageId?: string; error?: string }> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) {
    return { error: "Semaphore SMS configuration is incomplete." };
  }

  const body = new URLSearchParams({ apikey: apiKey, number: recipient, message });
  const senderName = process.env.SEMAPHORE_SENDER_NAME;
  if (senderName) body.set("sendername", senderName);

  let response: Response;
  try {
    response = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Semaphore request failed." };
  }

  const result = await response.json().catch(() => null) as
    | { message_id: number | string }[]
    | Record<string, unknown>
    | null;

  if (!response.ok || !Array.isArray(result) || result.length === 0) {
    const errorMessage = result && !Array.isArray(result)
      ? JSON.stringify(result)
      : `Semaphore returned HTTP ${response.status}.`;
    return { error: errorMessage };
  }

  return { messageId: String(result[0].message_id) };
}
