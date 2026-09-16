import axios from "axios";
import { env } from "../../../config/env.js";

// Sends through a self-hosted OpenWA gateway (github.com/rmyndharis/OpenWA)
// instead of Meta's Cloud API — Meta's service is restricted in-region.
// Unlike Meta, OpenWA drives a real WhatsApp client under the hood, so it
// can send free-form text at any time; no pre-approved template needed.
//
// Caveats worth remembering (see OpenWA's own README):
// - It's an unofficial client (whatsapp-web.js/baileys), so there's a
//   non-zero risk of the linked number being restricted by WhatsApp.
// - The session (`env.openwaSessionId`) must already be created, started,
//   and QR-linked to a dedicated number via OpenWA's own dashboard/API —
//   this sender only calls an existing, already-linked session.
// - Keep sends to opted-in recipients (your own clients expecting a
//   report) and respect OpenWA's rate limiting; this isn't a bulk/cold
//   messaging channel.
function toChatId(recipient: string): string {
  const digits = recipient.replace(/\D/g, "");
  return `${digits}@c.us`;
}

export async function sendReportWhatsApp(params: {
  to: string;
  text: string;
}): Promise<void> {
  const url = `${env.openwaBaseUrl}/api/sessions/${env.openwaSessionId}/messages/send-text`;

  await axios.post(
    url,
    {
      chatId: toChatId(params.to),
      text: params.text,
    },
    {
      headers: {
        "X-API-Key": env.openwaApiKey,
        "Content-Type": "application/json",
      },
    },
  );
}
