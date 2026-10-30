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

async function callGemini(key, prompt, file, maxTokens, json) {
  const parts = [{ text: prompt }];
  let last = { ok: false, status: 404, message: "Heç bir model tapılmadı: " + MODELS.join(", ") };
  if (file) parts.push({ inline_data: { mime_type: file.mime, data: file.data } });
  for (const m of MODELS) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: Object.assign({ maxOutputTokens: maxTokens, temperature: json ? 0.2 : 0.7 }, json ? { responseMimeType: "application/json" } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    // 404: model adı yoxdur; 429/500/503: limit və ya yüklənmə — növbəti modeli sına (hər modelin öz limiti var)
    if (!r.ok) { last = { ok: false, status: r.status, model: m, message: (j.error && j.error.message) || "" }; if ([404, 429, 500, 503].includes(r.status)) continue; return last; }
    const c = (j.candidates && j.candidates[0]) || {};
    const text = ((c.content && c.content.parts) || []).map((p) => (p.thought ? "" : p.text || "")).join("");
    if (!text) { last = { ok: false, status: 502, model: m, message: "Boş cavab (" + (c.finishReason || (j.promptFeedback && j.promptFeedback.blockReason) || "?") + ")" }; continue; }
    return { ok: true, model: m, text, finish: c.finishReason || "" };
  }
  return last;
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
  // Qeyd: yeni Gemini modellərində «düşünmə» tokenləri də bu limitdən yeyir, ona görə fayl oxuma üçün limit böyükdür
  // Alt hədd 6144: kiçik limitdə model düşünməyə xərcləyib cavabı yarımçıq kəsir (JSON pozulur)
  const maxTokens = Math.min(file ? 12000 : 8192, Math.max(6144, +b.max || 8192));

  try {
    const out = await callGemini(key, prompt, file, maxTokens, !!b.json);
    if (!out.ok) return res.status(out.status === 429 ? 429 : 502).json({ error: out.status === 429 ? "limit" : "AI xətası", status: out.status, message: out.message });
    return res.status(200).json({ text: out.text, finish: out.finish });
  } catch (e) {
    return res.status(500).json({ error: "Server xətası" });
  }
}
