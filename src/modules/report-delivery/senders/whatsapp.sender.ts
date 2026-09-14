import axios from "axios";
import { env } from "../../../config/env.js";

// Meta requires outbound messages sent outside a 24h customer-initiated
// window to use a pre-approved template — plain free text will be
// rejected for a scheduled report like this. `templateName` must match a
// template already approved in Meta Business Manager, with the same
// number/order of {{n}} variables as `bodyParams`.
export async function sendReportWhatsApp(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams: string[];
}): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.languageCode ?? "en_US" },
        components: [
          {
            type: "body",
            parameters: params.bodyParams.map((text) => ({
              type: "text",
              text,
            })),
          },
        ],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
}
