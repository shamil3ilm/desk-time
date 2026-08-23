// Minimal Telegram Bot API sender — one small POST, no dependencies.
// Bot token is a shared secret across all users; per-user routing is by chat_id.
// Users set their chat_id by messaging the bot and copying the ID it echoes back
// (or by asking @userinfobot). Chat_id is stored in users.telegram_chat_id.

const TG_API = "https://api.telegram.org";

export interface TelegramTarget {
  botToken: string;
  chatId: string;
}

export async function sendTelegramMessage(target: TelegramTarget, text: string): Promise<void> {
  const res = await fetch(`${TG_API}/bot${target.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: target.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage ${res.status}: ${body.slice(0, 300)}`);
  }
}
