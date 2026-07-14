// Thin adapter to the n8n webhooks that own the LINE channel.
// See docs/crm/adr/0002-n8n-owns-line-ingestion.md. Fixlo never calls LINE
// directly; it POSTs intent to n8n, which does token routing + the LINE call.

import { logger } from "@/lib/logger";

export interface CrmSendPayload {
  project_id: number;
  user_id: string;
  admin_id: number;
  message_text: string;
}

export interface CrmEmbedPayload {
  rule_id: number;
}

async function postWebhook(
  url: string | undefined,
  body: unknown,
  label: string,
): Promise<boolean> {
  if (!url) {
    logger.error("n8nClient", `Missing webhook URL for ${label}`);
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.error("n8nClient", `${label} webhook ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error("n8nClient", `${label} webhook failed`, err);
    return false;
  }
}

/** Ask n8n to deliver an admin reply over LINE (token routing lives in n8n). */
export function sendCrmReply(payload: CrmSendPayload): Promise<boolean> {
  return postWebhook(process.env.N8N_CRM_SEND_URL, payload, "crm-send");
}

/** Ask n8n to (re)generate the embedding for a knowledge-base intent. */
export function embedCrmIntent(payload: CrmEmbedPayload): Promise<boolean> {
  return postWebhook(process.env.N8N_CRM_EMBED_URL, payload, "crm-embed");
}
