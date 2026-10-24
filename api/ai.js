// Vercel serverless funksiyası: brauzerdən gələn sorğunu Google Gemini API-yə ötürür.
// API açarı yalnız Vercel-də (Environment Variables) saxlanır, brauzerə çıxmır.
const hits = new Map();
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.5-flash"].filter(Boolean);

function limited(req) {
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 30) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function callGemini(key, prompt) {
  for (const m of MODELS) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    });
    if (r.status === 404) continue; // model adı tapılmadı, növbətini sına
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, model: m, message: (j.error && j.error.message) || "" };
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return { ok: true, model: m, text: parts.map((p) => p.text || "").join("") };
  }
  return { ok: false, status: 404, message: "Heç bir model tapılmadı: " + MODELS.join(", ") };
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  // Yoxlama rejimi: brauzerdə /api/ai və ya /api/ai?test=1 aç
  if (req.method === "GET") {
    if (!(req.query && req.query.test)) return res.status(200).json({ hasKey: !!key, models: MODELS });
    if (!key) return res.status(200).json({ ok: false, message: "GEMINI_API_KEY yoxdur (Vercel-də əlavə edib Redeploy et)" });
    if (limited(req)) return res.status(429).json({ error: "Çox sorğu" });
    try { return res.status(200).json(await callGemini(key, "Bir cümlə ilə Azərbaycan dilində salam de.")); }
    catch (e) { return res.status(200).json({ ok: false, message: String(e && e.message) }); }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST lazımdır" });
  if (limited(req)) return res.status(429).json({ error: "Çox sorğu, bir az sonra yenidən cəhd et" });
  const prompt = String((req.body && req.body.prompt) || "").slice(0, 6000);
  if (!prompt) return res.status(400).json({ error: "Boş sorğu" });
  if (!key) return res.status(500).json({ error: "API açarı qurulmayıb" });

  try {
    const out = await callGemini(key, prompt);
    if (!out.ok) return res.status(502).json({ error: "AI xətası", status: out.status, message: out.message });
    return res.status(200).json({ text: out.text });
  } catch (e) {
    return res.status(500).json({ error: "Server xətası" });
  }
}
