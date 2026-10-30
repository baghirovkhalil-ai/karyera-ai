// Vakansiya toplayıcı: bir neçə iş saytından elanları gətirir, vahid formata salır.
// Mənbələri Vercel-də JOBS_SOURCES ilə idarə et, məs: "boss,jobsearch,remotive" (boş = hamısı).
// Yoxlama: /api/jobs?debug=1&q=satış  → hər mənbənin vəziyyəti və nümunə elanlar.
// QEYD: saytların istifadə şərtlərini yoxla; icazə verməyən mənbəni siyahıdan çıxar.
import { fetchText, jsonLdJobs, anchors, rssItems, decode } from "../lib/html.js";

const enc = encodeURIComponent;
const clean = s => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function parseBoss(html, base) {
  const out = [];
  for (const blk of html.split(/class=["'](?:[^"']*\s)?results-i(?=[\s"'])[^"']*["']/).slice(1)) {
    const href = (blk.match(/href=["'](\/vacancies\/\d+)["']/) || [])[1];
    const title = clean((blk.match(/results-i-title[^>]*>([\s\S]*?)<\/(h3|a|div)>/) || [])[1]);
    const company = clean((blk.match(/results-i-company[^>]*>([\s\S]*?)<\/(a|div|span)>/) || [])[1]);
    if (href && title) out.push({ title, company, url: new URL(href, base).href, date: "" });
  }
  return out.length ? out : anchors(html, base, /^\/?vacancies\/\d+/);
}
function parseJobsearch(txt) {
  const j = JSON.parse(txt), items = j.items || j.data || j.results || [];
  return items.map(it => ({
    title: clean(it.title), company: clean(it.company && (it.company.title || it.company.name)),
    url: it.url || (it.slug ? "https://jobsearch.az/vacancies/" + it.slug : ""), date: it.created_at || it.created || ""
  })).filter(x => x.title && x.url);
}
const ELIG = /worldwide|anywhere|global|europe|emea|asia|azerbaijan|caucasus|cet|gmt/i;
function parseRemotive(txt) {
  const j = JSON.parse(txt);
  return (j.jobs || []).map(it => ({
    title: clean(it.title), company: clean(it.company_name), url: it.url, date: it.publication_date || "",
    location: it.candidate_required_location || "", remote: true,
    eligible: ELIG.test(it.candidate_required_location || "") ? "yes" : "check",
    salary: it.salary || "", text: clean(it.description).slice(0, 700)
  }));
}
function parseWwr(xml) {
  return rssItems(xml).map(it => {
    const [company, ...rest] = it.title.split(": ");
    const region = (xml.slice(xml.indexOf(it.url)).match(/<region>([\s\S]*?)<\/region>/i) || [])[1] || "";
    return { title: rest.join(": ") || it.title, company: rest.length ? company : "", url: it.url, date: it.date, remote: true, location: clean(region), eligible: ELIG.test(region) ? "yes" : "check", text: it.text };
  });
}

const SOURCES = {
  boss: { name: "Boss.az", url: q => "https://boss.az/vacancies" + (q ? "?search%5Bkeyword%5D=" + enc(q) : ""), parse: parseBoss },
  jobsearch: { name: "JobSearch.az", url: q => "https://jobsearch.az/api-az/vacancies-az?hl=az&q=" + enc(q || ""), headers: { "x-requested-with": "XMLHttpRequest", accept: "application/json" }, parse: parseJobsearch },
  hellojob: { name: "HelloJob.az", url: q => "https://www.hellojob.az/vakansiyalar" + (q ? "?search=" + enc(q) : ""), parse: (h, b) => anchors(h, b, /\/vakansiya\/[a-z0-9-]{6,}/i) },
  smartjob: { name: "SmartJob.az", url: q => "https://smartjob.az/vacancies" + (q ? "?keyword=" + enc(q) : ""), parse: (h, b) => anchors(h, b, /\/vacanc(y|ies)\/\d+/i) },
  remotive: { name: "Remotive", remote: true, url: q => "https://remotive.com/api/remote-jobs?limit=60" + (q ? "&search=" + enc(q) : ""), parse: parseRemotive },
  wwr: { name: "We Work Remotely", remote: true, local: true, url: () => "https://weworkremotely.com/remote-jobs.rss", parse: parseWwr },
};

const cache = new Map(); // açar → {t, items}
const TTL = 30 * 60 * 1000;

async function runSource(id, q) {
  const s = SOURCES[id], url = s.url(q), ck = id + "|" + q;
  const c = cache.get(ck);
  if (c && Date.now() - c.t < TTL) return { id, name: s.name, ok: true, cached: true, items: c.items };
  try {
    const txt = await fetchText(url, { headers: s.headers || {} });
    let items = s.parse(txt, url);
    if (!items.length) items = jsonLdJobs(txt); // ümumi ehtiyat yol
    items = items.slice(0, 60).map(x => ({ ...x, source: s.name, sourceId: id, remote: !!(x.remote || s.remote) }));
    cache.set(ck, { t: Date.now(), items });
    return { id, name: s.name, ok: true, items };
  } catch (e) {
    return { id, name: s.name, ok: false, error: String((e && e.message) || e).slice(0, 140), items: [] };
  }
}

// Sahələr: Azərbaycan saytları üçün azərbaycanca, uzaqdan iş mənbələri üçün ingiliscə açar sözlər
export const CATS = {
  yeni: { az: [""], en: [""] },
  satis: { az: ["satış"], en: ["sales"] },
  marketinq: { az: ["marketinq", "smm"], en: ["marketing"] },
  it: { az: ["proqramçı", "developer"], en: ["developer", "engineer"] },
  maliyye: { az: ["mühasib", "maliyyə"], en: ["accounting", "finance"] },
  musteri: { az: ["operator", "müştəri xidməti"], en: ["customer support"] },
  hr: { az: ["HR", "kadr"], en: ["recruiter", "HR"] },
  dizayn: { az: ["dizayner"], en: ["designer"] },
  logistika: { az: ["logistika", "anbar"], en: ["logistics", "operations"] },
  tehsil: { az: ["müəllim"], en: ["teacher", "tutor"] },
  tibb: { az: ["həkim", "tibb bacısı"], en: ["healthcare", "nurse"] },
  turizm: { az: ["otel", "turizm"], en: ["travel", "hospitality"] },
  tikinti: { az: ["mühəndis", "tikinti"], en: ["civil engineer", "construction"] },
  tecrube: { az: ["təcrübə proqramı", "intern"], en: ["intern", "junior"] }
};

export async function collect({ q = "", remote = false, src = "", cat = "" } = {}) {
  q = String(q).trim().slice(0, 80);
  const allowed = String(process.env.JOBS_SOURCES || Object.keys(SOURCES).join(",")).split(",").map(s => s.trim()).filter(id => SOURCES[id]);
  let ids = allowed.filter(id => remote ? SOURCES[id].remote : !SOURCES[id].remote);
  if (src) { const want = String(src).split(","); ids = ids.filter(id => want.includes(id)) }
  const qs = CATS[cat] ? CATS[cat][remote ? "en" : "az"] : [q];
  const runs = await Promise.all(qs.flatMap(qq => ids.map(id => runSource(id, qq).then(r => ({ ...r, qq })))));
  const seen = new Set(), items = [], agg = {};
  for (const r of runs) {
    const toks = r.qq.toLocaleLowerCase("az").split(/\s+/).filter(w => w.length > 2);
    const a = agg[r.id] || (agg[r.id] = { id: r.id, name: r.name, ok: false, count: 0, cached: true });
    a.ok = a.ok || r.ok; a.cached = a.cached && !!r.cached; if (!r.ok && !a.error) a.error = r.error;
    for (const it of r.items) {
      if (SOURCES[r.id].local && toks.length && !toks.some(t => (it.title + " " + it.company).toLocaleLowerCase("az").includes(t))) continue;
      const key = (it.title + "|" + it.company).toLowerCase();
      if (seen.has(key)) continue; seen.add(key); a.count++;
      items.push({ ...it, id: Buffer.from(it.url).toString("base64url").slice(-24) });
    }
  }
  const sources = Object.values(agg).map(a => (a.ok ? { ...a, error: undefined } : a));
  return { q, cat: CATS[cat] ? cat : "", remote, enabled: allowed, sources, items };
}

export default async function handler(req, res) {
  const qy = req.query || {};
  const out = await collect({ q: qy.q, remote: qy.remote === "1", src: qy.src, cat: qy.cat });
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  if (qy.debug) return res.status(200).json({ q: out.q, cat: out.cat, remote: out.remote, enabled: out.enabled, sources: out.sources, sample: out.items.slice(0, 5) });
  return res.status(200).json({ q: out.q, cat: out.cat, remote: out.remote, sources: out.sources, items: out.items.slice(0, 150) });
}
