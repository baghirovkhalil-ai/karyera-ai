// Vercel serverless funksiyası: brauzerdən gələn sorğunu Google Gemini API-yə ötürür.
// API açarı yalnız Vercel-də (Environment Variables) saxlanır, brauzerə çıxmır.
// v3: səs (audio), PDF və şəkil faylı qəbul edir (səslə profil, köhnə CV-ni oxumaq).
const hits = new Map();
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.5-flash"].filter(Boolean);
const FILE_TYPES = /^(audio\/(webm|ogg|mp4|mpeg|wav|aac|x-m4a)|application\/pdf|image\/(jpeg|png|webp))$/;

function limited(req, max) {
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= max) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function callGemini(key, prompt, file, maxTokens) {
  const parts = [{ text: prompt }];
  if (file) parts.push({ inline_data: { mime_type: file.mime, data: file.data } });
  for (const m of MODELS) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    });
    if (r.status === 404) continue; // model adı tapılmadı, növbətini sına
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, model: m, message: (j.error && j.error.message) || "" };
    const out = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return { ok: true, model: m, text: out.map((p) => p.text || "").join("") };
  }
  return { ok: false, status: 404, message: "Heç bir model tapılmadı: " + MODELS.join(", ") };
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  // Yoxlama rejimi: brauzerdə /api/ai və ya /api/ai?test=1 aç
  if (req.method === "GET") {
    if (!(req.query && req.query.test)) return res.status(200).json({ hasKey: !!key, models: MODELS });
    if (!key) return res.status(200).json({ ok: false, message: "GEMINI_API_KEY yoxdur (Vercel-də əlavə edib Redeploy et)" });
    if (limited(req, 40)) return res.status(429).json({ error: "Çox sorğu" });
    try { return res.status(200).json(await callGemini(key, "Bir cümlə ilə Azərbaycan dilində salam de.", null, 256)); }
    catch (e) { return res.status(200).json({ ok: false, message: String(e && e.message) }); }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST lazımdır" });
  if (limited(req, 40)) return res.status(429).json({ error: "Çox sorğu, bir az sonra yenidən cəhd et" });
  const b = req.body || {};
  const prompt = String(b.prompt || "").slice(0, 14000);
  if (!prompt) return res.status(400).json({ error: "Boş sorğu" });
  if (!key) return res.status(500).json({ error: "API açarı qurulmayıb" });

  let file = null;
  if (b.file && b.file.data) {
    const mime = String(b.file.mime || "").split(";")[0].trim().toLowerCase();
    const data = String(b.file.data).replace(/^data:[^,]+,/, "");
    if (!FILE_TYPES.test(mime)) return res.status(400).json({ error: "Bu fayl növü qəbul olunmur" });
    if (data.length > 4_000_000) return res.status(400).json({ error: "Fayl çox böyükdür (maksimum ~3 MB)" }); // Vercel sorğu limiti 4.5 MB
    file = { mime, data };
  }
  const maxTokens = Math.min(4096, Math.max(256, +b.max || 2048));

  try {
    const out = await callGemini(key, prompt, file, maxTokens);
    if (!out.ok) return res.status(502).json({ error: "AI xətası", status: out.status, message: out.message });
    return res.status(200).json({ text: out.text });
  } catch (e) {
    return res.status(500).json({ error: "Server xətası" });
  }
}
