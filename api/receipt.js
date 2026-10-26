// Kart-kart ödəniş çekinin yoxlanması.
// 1) Gemini çekin şəklini oxuyur: tarix-saat, məbləğ, alıcı kartın son 4 rəqəmi, status.
// 2) Qaydalar ödənilsə kredit verilir, ödənilməsə səbəbi qaytarılır.
// 3) Hər çek (qəbul və ya rədd) Telegram-a göndərilir və Vercel loglarına yazılır.
// Vercel Environment Variables: GEMINI_API_KEY (vacib), TELEGRAM_BOT_TOKEN və TELEGRAM_CHAT_ID (izləmək üçün), CARD_LAST4 (istəyə bağlı).

const PACKS = { p5: { credits: 5, price: 3 }, p20: { credits: 20, price: 9 }, p50: { credits: 50, price: 18 } };
const LAST4 = process.env.CARD_LAST4 || "7534";
const MAX_AGE_H = 48;          // köhnə çek qəbul olunmur
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.5-flash"].filter(Boolean);
const seen = new Map();        // eyni çekin təkrar istifadəsinə qarşı (funksiya canlı qaldıqca)
const hits = new Map();

function limited(ip) {
  const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (r.length >= 10) return true; r.push(now); hits.set(ip, r); return false;
}

async function readReceipt(key, b64) {
  const prompt = `Bu şəkil bank kartından karta pul köçürməsinin çeki (qəbz, skrinşot) olmalıdır. Şəkildən məlumatları çıxar və YALNIZ JSON qaytar:
{"is_receipt": true/false (bu doğrudan köçürmə/ödəniş çekidirmi),
 "success": true/false (əməliyyat uğurludurmu; "uğurlu", "icra olundu", "success" və s.),
 "date": "YYYY-MM-DD" və ya null,
 "time": "HH:MM" (24 saat) və ya null — saat şəkildə açıq görünmürsə null,
 "amount": rəqəm (AZN, komissiyasız köçürülən məbləğ) və ya null,
 "currency": "AZN" və ya başqa,
 "recipient_last4": alıcı kartın son 4 rəqəmi (string) və ya null,
 "transaction_id": əməliyyat/çek nömrəsi və ya null}
Heç nə uydurma: şəkildə olmayan sahəni null yaz.`;
  for (const m of MODELS) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 512, responseMimeType: "application/json" },
      }),
    });
    if (r.status === 404) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("gemini " + r.status + " " + ((j.error && j.error.message) || ""));
    const t = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || "").join("");
    const mm = t.match(/\{[\s\S]*\}/);
    return JSON.parse(mm ? mm[0] : t);
  }
  throw new Error("model tapılmadı");
}

function check(x, pack) {
  if (!x || !x.is_receipt) return "Şəkildə köçürmə çeki tanınmadı. Bankın tətbiqindən çekin skrinşotunu yüklə.";
  if (x.success === false) return "Çekdə əməliyyat uğurlu görünmür.";
  if (!x.date || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !x.time || !/^\d{1,2}:\d{2}/.test(x.time))
    return "Çekdə köçürmənin dəqiq tarixi və saatı görünmür. Tarix və saat olan tam çeki yüklə.";
  const when = new Date(x.date + "T" + x.time.padStart(5, "0") + ":00+04:00"), now = Date.now();
  if (isNaN(when)) return "Çekdəki tarix və saat oxunmadı.";
  if (when.getTime() > now + 15 * 60000) return "Çekdəki tarix gələcək zamandır.";
  if (now - when.getTime() > MAX_AGE_H * 3600000) return "Çek köhnədir: son " + MAX_AGE_H + " saatda edilmiş köçürmənin çeki qəbul olunur.";
  if (x.currency && !/azn|manat|₼/i.test(String(x.currency))) return "Köçürmə AZN ilə olmalıdır.";
  const amt = Number(String(x.amount).replace(",", "."));
  if (!(amt > 0)) return "Çekdə məbləğ oxunmadı.";
  if (amt + 0.01 < pack.price) return `Məbləğ azdır: bu paket üçün ${pack.price} AZN köçürülməlidir, çekdə ${amt} AZN görünür.`;
  if (x.recipient_last4 && String(x.recipient_last4).replace(/\D/g, "").slice(-4) !== LAST4) return "Çekdəki alıcı kart bizim kart deyil.";
  return "";
}

async function notify(ok, info, b64) {
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!tok || !chat) return;
  const cap = (ok ? "✅ KREDİT VERİLDİ" : "❌ RƏDD") + "\n" + info;
  try {
    const fd = new FormData();
    fd.append("chat_id", chat); fd.append("caption", cap.slice(0, 1000));
    fd.append("photo", new Blob([Buffer.from(b64, "base64")], { type: "image/jpeg" }), "cek.jpg");
    await fetch(`https://api.telegram.org/bot${tok}/sendPhoto`, { method: "POST", body: fd });
  } catch (e) { console.error("telegram", e && e.message) }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST lazımdır" });
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ ok: false, reason: "Çox cəhd oldu, bir saat sonra yenidən sına." });
  const key = process.env.GEMINI_API_KEY;
  const b = req.body || {}, pack = PACKS[b.pack];
  const b64 = String(b.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!pack) return res.status(400).json({ ok: false, reason: "Paket seçilməyib." });
  if (b64.length < 1000 || b64.length > 4_000_000) return res.status(400).json({ ok: false, reason: "Şəkil yüklənmədi və ya çox böyükdür." });
  if (!key) return res.status(500).json({ ok: false, reason: "Yoxlama hazırda işləmir. Bir az sonra yenidən sına." });

  const id = "K" + Date.now().toString(36).toUpperCase();
  let x;
  try { x = await readReceipt(key, b64) }
  catch (e) { console.error("receipt read", e && e.message); return res.status(502).json({ ok: false, reason: "Çeki oxumaq alınmadı. Bir az sonra yenidən sına." }) }

  let reason = check(x, pack);
  const dupKey = [x.date, x.time, x.amount, x.transaction_id || ""].join("|");
  if (!reason && seen.has(dupKey)) reason = "Bu çek artıq istifadə olunub.";
  const ok = !reason;
  if (ok) seen.set(dupKey, id);

  const info = [
    "ID: " + id, "Paket: " + pack.credits + " kredit / " + pack.price + " AZN",
    "Çek: " + (x.date || "?") + " " + (x.time || "?") + " · " + (x.amount ?? "?") + " " + (x.currency || "") + " · kart ..." + (x.recipient_last4 || "?") + (x.transaction_id ? " · №" + x.transaction_id : ""),
    "Əlaqə: " + (String(b.contact || "").slice(0, 80) || "-"), "IP: " + ip, reason ? "Səbəb: " + reason : ""
  ].filter(Boolean).join("\n");
  console.log("RECEIPT", ok ? "OK" : "REJECT", info.replace(/\n/g, " | "));
  await notify(ok, info, b64);

  if (!ok) return res.status(200).json({ ok: false, reason, id });
  return res.status(200).json({ ok: true, id, credits: pack.credits, key: dupKey, date: x.date, time: x.time, amount: x.amount });
}
