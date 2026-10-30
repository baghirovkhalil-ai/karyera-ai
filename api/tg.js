// Telegram bot webhook: istifadəçi saytdakı «Telegram-da al» düyməsi ilə gəlir (/start KOD), hesabı bota bağlanır.
// Qurmaq: Vercel-də TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TG_WEBHOOK_SECRET əlavə et, sonra brauzerdə bir dəfə aç:
//   https://SAYT/api/tg?setup=1&secret=TG_WEBHOOK_SECRET
import { enabled as supaOn, rest } from "../lib/supa.js";

const TOK = () => process.env.TELEGRAM_BOT_TOKEN || "";
export async function send(chat, text, extra = {}) {
  if (!TOK()) return;
  await fetch(`https://api.telegram.org/bot${TOK()}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra })
  }).catch(() => { });
}

export default async function handler(req, res) {
  const secret = process.env.TG_WEBHOOK_SECRET || "";
  if (req.method === "GET") {
    if (!req.query.setup) return res.status(200).json({ bot: !!TOK(), db: supaOn() });
    if (!secret || req.query.secret !== secret) return res.status(403).json({ ok: false, reason: "secret uyğun deyil" });
    const url = "https://" + req.headers.host + "/api/tg";
    const r = await fetch(`https://api.telegram.org/bot${TOK()}/setWebhook`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }) });
    return res.status(200).json(await r.json());
  }
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) return res.status(403).end();
  const m = (req.body && req.body.message) || {};
  const chat = m.chat && m.chat.id, text = String(m.text || "").trim();
  if (!chat) return res.status(200).end();
  try {
    if (/^\/start\s+\S+/.test(text) && supaOn()) {
      const code = text.split(/\s+/)[1].replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
      const rows = await rest("tg_links?code=eq." + code + "&select=user_id");
      if (!rows || !rows.length) await send(chat, "Kod tapılmadı və ya köhnədir. Saytda «Telegram-da al» düyməsini yenidən bas.");
      else {
        await rest("profiles?tg_chat_id=eq." + chat, { method: "PATCH", body: { tg_chat_id: null } });
        await rest("profiles?id=eq." + rows[0].user_id, { method: "PATCH", body: { tg_chat_id: chat } });
        await rest("tg_links?code=eq." + code, { method: "DELETE" });
        await send(chat, "Hazırdır. Hər səhər saat 9-da sənə uyğun 3 vakansiya göndərəcəyəm. Dayandırmaq üçün /stop yaz.");
      }
    } else if (text === "/stop" && supaOn()) {
      await rest("profiles?tg_chat_id=eq." + chat, { method: "PATCH", body: { tg_chat_id: null } });
      await send(chat, "Bildirişlər dayandırıldı. Yenidən başlamaq üçün saytda «Telegram-da al» düyməsini bas.");
    } else {
      await send(chat, "Salam! Bu KarYera AI botudur. Bildiriş almaq üçün saytda «İşlər» bölməsində «Telegram-da al» düyməsini bas.");
    }
  } catch (e) { console.error("tg", e && e.message) }
  return res.status(200).end();
}
