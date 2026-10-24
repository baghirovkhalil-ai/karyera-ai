// Vercel serverless funksiyası: brauzerdən gələn sorğunu Anthropic API-yə ötürür.
// API açarı yalnız Vercel-də (Environment Variables) saxlanır, brauzerə çıxmır.
const hits = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST lazımdır" });

  // Sadə qorunma: eyni IP-dən saatda 30 sorğu
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= 30) return res.status(429).json({ error: "Çox sorğu, bir az sonra yenidən cəhd et" });
  recent.push(now);
  hits.set(ip, recent);

  const prompt = String((req.body && req.body.prompt) || "").slice(0, 6000);
  if (!prompt) return res.status(400).json({ error: "Boş sorğu" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "API açarı qurulmayıb" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: "AI xətası" });
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Server xətası" });
  }
}
