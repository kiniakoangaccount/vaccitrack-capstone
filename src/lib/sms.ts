export function normalizePhilippineNumber(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(compact)) return compact;
  if (/^\+639\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^639\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return null;
}

export type SmsDelivery = { messageId?: string; error?: string; providerDetail?: string };

export type SmsBatchDelivery = {
  results: SmsDelivery[];
  error?: string;
  providerDetail?: string;
};

function getProviderMessage(value: unknown): string | undefined {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry || typeof entry !== "object") return undefined;
  if ("error" in entry && typeof entry.error === "string") return entry.error;
  if ("message" in entry && typeof entry.message === "string") return entry.message;
  return undefined;
}

function sanitizeProviderDetail(value: string): string | undefined {
  const detail = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:\+?63|0)9[\d\s()-]{8,}/g, "[redacted phone]")
    .replace(/\b[a-f\d]{32}\b/gi, "[redacted token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return detail || undefined;
}

export async function sendSmsBatch(recipients: string[], message: string): Promise<SmsBatchDelivery> {
  if (recipients.length === 0) return { results: [], error: "No SMS recipients were provided." };
  if (recipients.length > 1000) return { results: [], error: "Semaphore allows up to 1,000 recipients per batch." };

  const normalizedRecipients: string[] = [];
  for (const recipient of recipients) {
    const normalized = normalizePhilippineNumber(recipient);
    if (!normalized) return { results: [], error: "One or more recipient numbers are invalid." };
    normalizedRecipients.push(normalized);
  }

  const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
  const senderName = process.env.SEMAPHORE_SENDER_NAME?.trim();
  if (!apiKey) return { results: [], error: "Semaphore SMS configuration is incomplete." };
  const apiUrl = process.env.SMS_API_URL?.trim() || "https://api.semaphore.co/api/v4/messages";
  if (!apiUrl.startsWith("https://")) return { results: [], error: "SMS_API_URL must use HTTPS." };

  const body = new URLSearchParams({
    apikey: apiKey,
    number: normalizedRecipients.map((recipient) => recipient.replace(/^\+63/, "0")).join(","),
    message,
  });
  if (senderName) body.set("sendername", senderName);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    return { results: [], error: error instanceof Error ? error.message : "Semaphore request failed." };
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    return { results: [], error: `Semaphore returned an invalid response (HTTP ${response.status}).` };
  }
  let result: unknown;
  try {
    result = JSON.parse(responseText);
  } catch {
    return {
      results: [],
      error: `Semaphore returned an invalid response (HTTP ${response.status}).`,
      providerDetail: sanitizeProviderDetail(responseText),
    };
  }
  if (!response.ok) {
    const providerMessage = getProviderMessage(result);
    return {
      results: [],
      error: providerMessage ?? `Semaphore returned HTTP ${response.status}.`,
      providerDetail: providerMessage ? undefined : sanitizeProviderDetail(responseText),
    };
  }

  const entries = Array.isArray(result) ? result : [result];
  const results = normalizedRecipients.map((_, index): SmsDelivery => {
    const entry = entries[index];
    if (!entry || typeof entry !== "object") return { error: "Semaphore returned no result for this recipient." };

    let status: string | undefined;
    if ("status" in entry && typeof entry.status === "string") {
      status = entry.status.toLowerCase();
      if (status === "failed" || status === "refunded") {
        return { error: `Semaphore did not send the SMS (status: ${entry.status}).` };
      }
    }

    if ("message_id" in entry && (typeof entry.message_id === "string" || typeof entry.message_id === "number")) {
      return { messageId: String(entry.message_id) };
    }
    if (status === "pending" || status === "queued") return {};

    return {
      error: "Semaphore response did not include a message ID.",
      providerDetail: sanitizeProviderDetail(
        `status=${status ?? "unknown"}; fields=${Object.keys(entry).join(",")}`,
      ),
    };
  });

  return { results };
}

export async function sendSms(recipient: string, message: string): Promise<SmsDelivery> {
  const result = await sendSmsBatch([recipient], message);
  if (result.error) return { error: result.error, providerDetail: result.providerDetail };
  return result.results[0] ?? { error: "Semaphore returned no result for the recipient." };
}
