// HTML-dən mətn və vakansiya məlumatı çıxarmaq üçün köməkçilər (asılılıqsız).
export const UA = "KarYeraBot/1.0 (+https://karyera-ai.vercel.app)";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—" };
export function decode(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export function strip(html) {
  return decode(String(html || "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
const clean = s => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// JSON-LD JobPosting obyektləri (detal səhifələrində və bəzi siyahılarda olur)
export function jsonLdJobs(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data; try { data = JSON.parse(m[1].trim()) } catch (e) { continue }
    const walk = x => {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(walk);
      const t = x["@type"]; if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) out.push(x);
      if (x["@graph"]) walk(x["@graph"]);
      if (x.itemListElement) walk(x.itemListElement.map(e => e.item || e));
    };
    walk(data);
  }
  return out.map(j => ({
    title: clean(j.title),
    company: clean(j.hiringOrganization && (j.hiringOrganization.name || j.hiringOrganization)),
    url: j.url || "",
    date: j.datePosted || "",
    location: clean(j.jobLocation && j.jobLocation.address && (j.jobLocation.address.addressLocality || j.jobLocation.address.addressRegion)),
    remote: /TELECOMMUTE/i.test(j.jobLocationType || ""),
    text: strip(j.description || "")
  })).filter(j => j.title);
}

// Siyahı səhifəsindəki linklərdən vakansiya çıxarmaq: href nümunəyə uyğun gələn <a> elementləri
export function anchors(html, base, hrefRe, minLen = 6) {
  const out = [], seen = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!hrefRe.test(href)) continue;
    const title = clean(m[2]);
    if (title.length < minLen || title.length > 160) continue;
    let url; try { url = new URL(href, base).href } catch (e) { continue }
    if (seen.has(url)) continue; seen.add(url);
    out.push({ title, url, company: "", date: "" });
  }
  return out;
}

export function rssItems(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  const tag = (s, t) => { const x = s.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)<\\/" + t + ">", "i")); return x ? x[1].replace(/^<!\[CDATA\[|\]\]>$/g, "") : "" };
  while ((m = re.exec(xml))) {
    const it = m[1];
    out.push({ title: clean(tag(it, "title")), url: clean(tag(it, "link")), date: clean(tag(it, "pubDate")), text: strip(decode(tag(it, "description"))).slice(0, 600) });
  }
  return out.filter(x => x.title && x.url);
}

// Daxili şəbəkəyə sorğunun qarşısını almaq (SSRF)
export function safeUrl(u) {
  let x; try { x = new URL(String(u)) } catch (e) { return null }
  if (!/^https?:$/.test(x.protocol)) return null;
  const h = x.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "[::1]" || /^\[?(fc|fd|fe80)/i.test(h) || !h.includes(".")) return null;
  return x;
}

export async function fetchText(url, { timeout = 8000, headers = {}, max = 2_000_000 } = {}) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "az,en;q=0.8,ru;q=0.6", ...headers }, signal: ac.signal, redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const txt = await r.text();
    return txt.length > max ? txt.slice(0, max) : txt;
  } finally { clearTimeout(t) }
}
