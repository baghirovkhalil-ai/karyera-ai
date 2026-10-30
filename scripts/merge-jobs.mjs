// Elan bazasını yeniləyir: node scripts/merge-jobs.mjs raw.json [data/jobs.json]
// raw.json: [{ "source": "HelloJob.az", "remote": false, "ok": true, "items": [{ "title", "company", "url", "date", "location" }] }, ...]
// Qaydalar: yeni elan əlavə olunur; görülən elanın last_seen yenilənir;
// uğurla oxunan mənbədə 3 gündür (72 saat) görünməyən və ya 30 gündən köhnə elan silinir.
import fs from "node:fs";
import crypto from "node:crypto";

const [, , RAW = "raw.json", OUT = new URL("../data/jobs.json", import.meta.url).pathname] = process.argv;
const NOW = new Date(), NOWS = NOW.toISOString();
const H36 = 72 * 3600e3, D30 = 30 * 86400e3, MAX = 1500;

const AYLAR = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function parseDate(s) {
  s = String(s || "").trim().toLocaleLowerCase("az");
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  if (/bu gün|today|bugün/.test(s)) return NOWS;
  if (/dünən|yesterday/.test(s)) return new Date(NOW - 86400e3).toISOString();
  const m = s.match(/(\d{1,2})\s+([a-zəöüçşğı]+)(?:\s+(\d{4}))?/);
  if (m) {
    const mi = AYLAR.findIndex(a => m[2].startsWith(a.slice(0, 3)));
    if (mi >= 0) {
      let y = m[3] ? +m[3] : NOW.getFullYear();
      let d = new Date(Date.UTC(y, mi, +m[1], 8));
      if (!m[3] && d - NOW > 2 * 86400e3) d = new Date(Date.UTC(y - 1, mi, +m[1], 8));
      return d.toISOString();
    }
  }
  const t = Date.parse(s);
  return isNaN(t) ? "" : new Date(t).toISOString();
}

// [KarYera sahəsi, İşYeri kateqoriyası, nümunə]
const RULES = [
  ["tecrube", "telebe-tecrube", /təcrübəçi|təcrübə proqramı|\bintern|tələbə/],
  ["it", "it-proqramlasdirma", /developer|proqramçı|programmer|frontend|backend|full ?stack|data (engineer|analyst|scientist)|devops|\bqa\b|tester|(^|\s)it (dəstək|mütəxəssis|support)|sistem admin|şəbəkə|python|java\b|\.net|php|react|software/],
  ["dizayn", "dizayn-kreativ", /dizayn|designer|montaj|video|fotoqraf|motion|\bui\b|\bux\b/],
  ["marketinq", "satis-marketinq", /marketinq|marketing|smm|kontent|content|\bseo\b|brend|reklam|copywrit|sosial media/],
  ["turizm", "turizm-otel", /otel|hotel|turizm|travel|rezervasiya|hospitality/],
  ["maliyye", "muhasibat-maliyye", /mühasib|maliyyə|finans|financial|accountant|accounting|audit|kassir|kassa|iqtisadçı|kredit|büdcə|budget|xərc|klirinq|risk|komplayns|daxili nəzarət|sığorta/],
  ["hr", "ofis-inzibati", /\bhr\b|kadr|işə qəbul|recruit|insan resursları/],
  ["musteri", "musteri-xidmetleri", /operator|çağrı|call cent|müştəri (xidmət|əlaqə)|müştərilərlə|customer|support|dəstək|qarşılama|qeydiyyatçı|dispetçer/],
  ["satis", "satis-marketinq", /satış|satıcı|sales|merçendayzer|merchandis|məsləhətçi|konsultant|consultant|əmlak|makler|account (manager|executive)|mağaza|kateqoriya meneceri|satınalma|promouter|nümayəndə/],
  ["tehsil", "tehsil-terbiye", /müəllim|teacher|tutor|tərbiyəçi|dayə|məktəb|repetitor|pedaqoq/],
  ["tibb", "sehiyye", /həkim|tibb|nurse|stomatoloq|diş həkim|əczaçı|farmasevt|laborant|optometr|optik|klinika|healthcare|medical/],
  ["", "xidmet-iase", /ofisiant|aşpaz|barista|bartender|xadimə|təmizlik|kafe|restoran|\bchef\b|\bcook\b|qabyuyan/],
  ["logistika", "kuryer-catdirilma", /kuryer|courier|çatdırılma/],
  ["logistika", "neqliyyat-logistika", /logistika|logistic|anbar|sürücü|driver|ekspeditor|təchizat|supply|operations/],
  ["tikinti", "insaat-temir", /mühəndis|engineer|tikinti|inşaat|memar|usta|elektrik|santexnik|qaynaqçı|təmir|fəhlə|construction/],
  ["", "istehsalat-senaye", /istehsal|zavod|fabrik|tikiş|dərzi|mebel/],
  ["", "muhafize-tehlukesizlik", /mühafiz|təhlükəsizlik|security|qarovul/],
  ["", "huquq", /hüquq|vəkil|lawyer|legal|notarius/],
  ["", "ofis-inzibati", /ofis|katib|resepşn|reception|administrator|inzibati|sənəd|menecer|manager/],
];
function classify(title) {
  const t = String(title).toLocaleLowerCase("az");
  for (const [cat, isy, re] of RULES) if (re.test(t)) return { cat, isyeri_cat: isy };
  return { cat: "", isyeri_cat: "ofis-inzibati" };
}
const CITIES = [["sumqayit", /sumqayıt/i], ["gence", /gəncə/i], ["mingecevir", /mingəçevir/i], ["lenkeran", /lənkəran/i], ["seki", /şəki/i]];
const REGION = /naxçıvan|şərur|cəlilabad|sabirabad|qəbələ|şirvan|ismayıllı|salyan|xaçmaz|bərdə|biləsuvar|füzuli|goranboy|göygöl|samux|quba|qusar|şamaxı|zaqatala|masallı|astara|ağdam|şuşa|tovuz|qazax|ağcabədi|imişli|kürdəmir|göyçay|ucar|yevlax|region/i;
const city = s => (CITIES.find(([, re]) => re.test(s)) || [REGION.test(s) ? "region" : "baki"])[0];
const idOf = url => crypto.createHash("sha1").update(url).digest("base64url").slice(0, 12);
const clean = s => String(s || "").replace(/\s+/g, " ").trim();

const raw = JSON.parse(fs.readFileSync(RAW, "utf8"));
let db = { updated: "", jobs: [] };
try { db = JSON.parse(fs.readFileSync(OUT, "utf8")) } catch (e) { }
const byId = new Map(db.jobs.map(j => [j.id, j]));
const okSources = new Set(), seen = new Set();
let added = 0;

for (const src of raw) {
  const items = Array.isArray(src.items) ? src.items : [];
  if (src.ok !== false && items.length >= 3) okSources.add(src.source);
  for (let it of items) {
    if (Array.isArray(it)) it = { title: it[0], company: it[1], url: it[2], date: it[3], location: it[4] }; // qısa format: [başlıq, şirkət, link, tarix]
    const title = clean(it.title), url = clean(it.url);
    if (title.length < 3 || title.length > 160 || !/^https:\/\/[^\s]+$/.test(url)) continue;
    const id = idOf(url);
    seen.add(id);
    const prev = byId.get(id);
    const base = { title, company: clean(it.company).slice(0, 120), url, source: src.source, remote: !!src.remote, location: clean(it.location).slice(0, 80) };
    if (prev) Object.assign(prev, base, { last_seen: NOWS, date: prev.date || parseDate(it.date), ...classify(title), city: src.remote ? "" : city(title + " " + (it.location || "")) });
    else {
      byId.set(id, { id, ...base, date: parseDate(it.date), first_seen: NOWS, last_seen: NOWS, ...classify(title), city: src.remote ? "" : city(title + " " + (it.location || "")) });
      added++;
    }
  }
}

let removed = 0;
const jobs = [];
for (const j of byId.values()) {
  const posted = Date.parse(j.date || j.first_seen);
  const stale = okSources.has(j.source) && !seen.has(j.id) && NOW - Date.parse(j.last_seen) > H36;
  const old = NOW - posted > D30;
  if (stale || old) { removed++; continue }
  jobs.push(j);
}
jobs.sort((a, b) => Date.parse(b.date || b.first_seen) - Date.parse(a.date || a.first_seen));
const out = { updated: NOWS, count: Math.min(jobs.length, MAX), sources: [...okSources], jobs: jobs.slice(0, MAX) };
fs.mkdirSync(new URL(".", "file://" + OUT).pathname, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify({ added, removed, total: out.count, okSources: out.sources }));
