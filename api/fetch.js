// İstifadəçinin yapışdırdığı vakansiya linkini açıb elan mətnini çıxarır.
// GET /api/fetch?url=https://...
import { fetchText, jsonLdJobs, strip, decode, safeUrl } from "../lib/html.js";

const hits = new Map();
function limited(ip) {
  const now = Date.now(), r = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (r.length >= 40) return true; r.push(now); hits.set(ip, r); return false;
}

export default async function handler(req, res) {
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ ok: false, reason: "Çox sorğu. Bir az sonra yenidən sına." });
  const u = safeUrl(req.query && req.query.url);
  if (!u) return res.status(400).json({ ok: false, reason: "Link düzgün deyil. Tam linki yapışdır (https:// ilə)." });
  try {
    const html = await fetchText(u.href, { timeout: 9000 });
    const ld = jsonLdJobs(html)[0];
    if (ld && ld.text && ld.text.length > 80) {
      return res.status(200).json({ ok: true, url: u.href, title: ld.title, company: ld.company, location: ld.location, text: ld.text.slice(0, 7000), via: "jsonld" });
    }
    const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
    const tt = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const main = (html.match(/<(main|article)[\s\S]*?<\/\1>/i) || [])[0] || html;
    const text = strip(main);
    if (text.length < 120) return res.status(200).json({ ok: false, reason: "Səhifədən elan mətni oxunmadı. Elanın mətnini kopyalayıb yapışdır." });
    return res.status(200).json({ ok: true, url: u.href, title: decode(og || tt || "").trim(), company: "", text: text.slice(0, 7000), via: "text" });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "Sayt açılmadı (" + String(e && e.message).slice(0, 60) + "). Elanın mətnini kopyalayıb yapışdır." });
  }
}
