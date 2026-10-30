/* KarYera AI — v2 */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { g(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, s(k, v) { try { localStorage.setItem(k, v) } catch (e) { } } };
const YEAR = new Date().getFullYear();
const list = s => String(s || "").split(",").map(z => z.trim()).filter(Boolean);
const bullets = t => String(t || "").split(/[\n;]+|\.\s+|\.$/).map(z => z.trim().replace(/^[•\-–]\s*/, "")).filter(Boolean);
const initials = n => (n || "?").trim().split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase();
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- bildiriş ---------- */
let toastT;
function toast(m, ms = 3800) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); if (ms) toastT = setTimeout(() => t.classList.remove("on"), ms) }
function busy(b, on, txt) { if (on) { b.dataset.o = b.innerHTML; b.disabled = true; b.textContent = txt || "AI yazır…" } else { b.disabled = false; if (b.dataset.o) b.innerHTML = b.dataset.o } }
function copyText(btn, txt) {
  const done = () => { const o = btn.textContent; btn.textContent = "Kopyalandı"; setTimeout(() => btn.textContent = o, 1600) };
  try { navigator.clipboard.writeText(txt).then(done, () => toast("Kopyalanmadı: mətni seçib əl ilə kopyala.")) } catch (e) { toast("Kopyalanmadı: mətni seçib əl ilə kopyala.") }
}

/* ---------- kredit ---------- */
let credits = 3; // yeni istifadəçiyə hədiyyə
{ const v = ls.g("karyera_credits_v4") ?? ls.g("karyera_credits_v3"); if (v !== null && !isNaN(+v)) credits = +v }
const showCr = () => { $("#cr").textContent = credits; ls.s("karyera_credits_v4", credits) };
function need(n) {
  if (credits >= n) return true;
  const m = $("#buymsg"); m.hidden = false;
  m.textContent = "Kredit çatmır: bu əməliyyat " + n + " kredit tələb edir. Paket seç: kartla ödə, çeki yüklə, kredit dərhal əlavə olunsun.";
  tab("buy"); return false;
}
const spend = n => { credits -= n; showCr(); if (window.KYHook) KYHook.spend(n) };

/* ---------- AI ---------- */
async function ai(p) {
  const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
  if (!r.ok) throw new Error("ai " + r.status);
  const j = await r.json(); if (!j.text) throw new Error("boş");
  return j.text.trim();
}
async function aiJ(p) { const t = await ai(p); const m = t.match(/[\[{][\s\S]*[\]}]/); return JSON.parse(m ? m[0] : t) }

/* ---------- naviqasiya ---------- */
const TABS = ["cv", "job", "mus", "let", "car", "buy", "log"];
function tab(t) {
  TABS.forEach(x => $("#" + x).hidden = x !== t);
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  window.scrollTo({ top: 0 });
  if (t === "cv") requestAnimationFrame(fitAll);
  if (t === "let") requestAnimationFrame(fitLetter);
}
$$(".tabs button").forEach(b => b.onclick = () => tab(b.dataset.t));
$$("[data-go]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); tab(b.dataset.go) }));
$$(".seg[data-group]").forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest("button[data-p]"); if (!b) return;
  [...g.children].forEach(x => { x.classList.toggle("on", x === b); $("#" + x.dataset.p).hidden = x !== b });
  if (b.dataset.p === "lw") requestAnimationFrame(fitLetter);
}));

/* ============================================================ CV */
const DEMO = {
  ad: "Aysel Məmmədova", vez: "Satış meneceri", tel: "+994 50 123 45 67", em: "aysel@mail.com", seh: "Bakı", link: "linkedin.com/in/aysel",
  hq: "Pərakəndə satışda 4 illik təcrübəsi olan, rəqəmlərlə işləməyi sevən satış mütəxəssisi. Müştəri bazasını böyütmək və yeni əməkdaşları öyrətmək ən güclü tərəflərimdir.",
  exps: [
    { v: "Satış təmsilçisi", s: "Delta Market", m: "2022 – indi", t: "Müştəri bazasını 30% artırdım. Aylıq satış hesabatı hazırlayıram. 5 yeni əməkdaşı işə uyğunlaşdırdım." },
    { v: "Kassir-məsləhətçi", s: "Retail Plus", m: "2020 – 2022", t: "Gündəlik 80+ müştəriyə xidmət göstərirdim. Stok hesablamasında iştirak edirdim." }
  ],
  edu: [{ i: "Azərbaycan Dillər Universiteti", m: "Beynəlxalq münasibətlər, bakalavr", y: "2016 – 2020" }],
  bac: "Excel, CRM, danışıqlar, müştəri xidməti, satış planlaması, kommunikasiya",
  dil: "Azərbaycan (ana dili), İngilis (B2), Rus (B1)", ser: "Satış texnikaları təlimi, 2023", photo: ""
};
const blank = () => ({ ad: "", vez: "", tel: "", em: "", seh: "", link: "", hq: "", exps: [{ v: "", s: "", m: "", t: "" }], edu: [{ i: "", m: "", y: "" }], bac: "", dil: "", ser: "", photo: "" });

let S = { d: blank(), tp: "modern", ac: "#C2264B", font: "", photo: true, lang: "az", en: null, enSrc: "", paid: false };
{
  let raw = null; try { raw = JSON.parse(ls.g("karyera_v4")) } catch (e) { }
  if (raw && raw.d) S = Object.assign(S, raw);
  else { // köhnə versiyadan köçürmə
    try {
      const o = JSON.parse(ls.g("karyera_form_v3"));
      if (o) {
        const d = blank(); ["ad", "tel", "em", "seh", "vez", "hq", "bac", "dil", "ser"].forEach(k => d[k] = o[k] || "");
        if (o.top || o.tix) d.edu = [{ i: o.top || "", m: o.tix || "", y: "" }];
        if (Array.isArray(o.exps) && o.exps.length) d.exps = o.exps.map(e => ({ v: e.v || "", s: e.s || "", m: e.m || "", t: e.t || "" }));
        S.d = d;
      }
    } catch (e) { }
  }
  const b = blank(); Object.keys(b).forEach(k => { if (S.d[k] == null) S.d[k] = b[k] });
  if (!S.d.exps.length) S.d.exps = b.exps; if (!S.d.edu.length) S.d.edu = b.edu;
}
const save = () => { ls.s("karyera_v4", JSON.stringify(S)); if (window.KYHook) KYHook.saved() };

const isEmpty = d => !d.ad && !d.vez && !d.bac && !d.exps.some(e => e.t || e.s || e.v);
function yrs(d) {
  let n = 0; d.exps.forEach(e => { const m = (e.m || "").match(/(\d{4})\D+(\d{4}|indi|hal|hazır|now|present)/i); if (m) { const a = +m[1], b = /\d/.test(m[2]) ? +m[2] : YEAR; if (b >= a) n += b - a } }); return n;
}
const cvBrief = d => ({ ad: d.ad, vez: d.vez, il: yrs(d), haqqinda: d.hq, tecrube: d.exps.filter(e => e.v || e.s || e.t).map(e => ({ vezife: e.v, sirket: e.s, muddet: e.m, ne_etdi: e.t })), tehsil: d.edu.filter(e => e.i).map(e => e.i + (e.m ? ", " + e.m : "")), bacariqlar: d.bac, diller: d.dil, sertifikatlar: d.ser });

/* --- şablonlar --- */
const TPL = [["modern", "Müasir"], ["sidebar", "Yan panel"], ["creative", "Kreativ"], ["timeline", "Zaman xətti"], ["bento", "Bento"], ["magazine", "Jurnal"], ["diagonal", "Diaqonal"], ["monogram", "Monoqram"], ["executive", "Rəhbər"], ["classic", "Klassik"], ["minimal", "Minimal"], ["ats", "ATS (sadə)"]];
const NOPHOTO = new Set(["minimal", "ats", "executive"]);
const COL = [["#C2264B", "Nar"], ["#1F3A68", "Mürəkkəb"], ["#0E7C86", "Xəzər"], ["#4F7A28", "Zeytun"], ["#6D3FC0", "Bənövşə"], ["#C46F12", "Kəhrəba"], ["#2E3440", "Qrafit"], ["#C23F7A", "Qızılgül"], ["#8A4B2A", "Çay"], ["#127A52", "Zümrüd"]];
const FONTS = { onest: "'Onest',sans-serif", lora: "'Lora',serif", plex: "'IBM Plex Sans',sans-serif", unb: "'Unbounded',sans-serif" };
const LB = {
  az: { about: "Haqqında", exp: "İş təcrübəsi", edu: "Təhsil", sk: "Bacarıqlar", lg: "Dillər", ce: "Sertifikatlar", ct: "Əlaqə" },
  en: { about: "Profile", exp: "Experience", edu: "Education", sk: "Skills", lg: "Languages", ce: "Certificates", ct: "Contact" }
};

function mix(a, b, w) { // w = a-nın payı
  const h = x => { x = String(x).replace("#", ""); if (x.length === 3) x = x.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(x.substr(i, 2), 16) || 0) };
  const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v * w + B[i] * (1 - w)).toString(16).padStart(2, "0")).join("");
}
function parts(d, o) {
  const L = LB[o.lang] || LB.az, sk = list(d.bac);
  const ctItems = [d.tel, d.em, d.seh, d.link].filter(Boolean).map(esc);
  const ph = o.photo && !NOPHOTO.has(o.tp) ? `<div class="ph">${d.photo ? `<img src="${d.photo}" alt="">` : `<span>${esc(initials(d.ad))}</span>`}</div>` : "";
  const sec = (k, t, b) => b ? `<section class="s s-${k}"><h4>${t}</h4><div class="sb">${b}</div></section>` : "";
  const ex = d.exps.filter(e => e.s || e.v || e.t).map(e => {
    const b = bullets(e.t);
    return `<div class="x"><div class="xh"><b>${esc(e.v)}</b>${e.s ? `<span class="xc">${esc(e.s)}</span>` : ""}${e.m ? `<span class="xd">${esc(e.m)}</span>` : ""}</div>${b.length ? `<ul>${b.map(z => `<li>${esc(z)}</li>`).join("")}</ul>` : ""}</div>`;
  }).join("");
  const ed = d.edu.filter(e => e.i || e.m).map(e => `<div class="x"><div class="xh"><b>${esc(e.i)}</b>${e.m ? `<span class="xc">${esc(e.m)}</span>` : ""}${e.y ? `<span class="xd">${esc(e.y)}</span>` : ""}</div></div>`).join("");
  return {
    ph, ini: initials(d.ad),
    name: `<h1 class="nm">${esc(d.ad || "Ad Soyad")}</h1>`,
    role: d.vez ? `<p class="rl">${esc(d.vez)}</p>` : "",
    ct: ctItems.length ? `<div class="ct">${ctItems.map(c => `<span>${c}</span>`).join("")}</div>` : "",
    ctSec: sec("ct", L.ct, ctItems.map(c => `<p>${c}</p>`).join("")),
    about: sec("about", L.about, d.hq ? `<p>${esc(d.hq)}</p>` : ""),
    exp: sec("exp", L.exp, ex), edu: sec("edu", L.edu, ed),
    skl: sec("sk", L.sk, sk.length ? (o.tp === "ats" ? `<p>${sk.map(esc).join(", ")}</p>` : `<div class="chips">${sk.map(z => `<span>${esc(z)}</span>`).join("")}</div>`) : ""),
    lg: sec("lg", L.lg, d.dil ? `<p>${esc(d.dil)}</p>` : ""),
    ce: sec("ce", L.ce, d.ser ? `<p>${esc(d.ser)}</p>` : "")
  };
}
function build(d, o) {
  const p = parts(d, o), all = p.about + p.exp + p.edu + p.skl + p.lg + p.ce;
  const head = `<div>${p.name}${p.role}${p.ct}</div>`;
  let h;
  switch (o.tp) {
    case "modern": h = `<header class="hd">${head}${p.ph}</header><div class="bd">${all}</div>`; break;
    case "sidebar": h = `<aside class="sd">${p.ph}${p.name}${p.role}${p.ctSec}${p.skl}${p.lg}${p.ce}</aside><div class="mn">${p.about}${p.exp}${p.edu}</div>`; break;
    case "creative": h = `<i class="blob"></i><header class="hd">${p.ph}${head}</header>${p.about}${p.exp}<div class="two"><div>${p.edu}${p.ce}</div><div>${p.skl}${p.lg}</div></div>`; break;
    case "timeline": h = `<header class="hd">${p.ph}${head}</header>${p.about}${p.exp}<div class="two"><div>${p.edu}${p.ce}</div><div>${p.skl}${p.lg}</div></div>`; break;
    case "bento": h = `<header class="hd">${p.ph}${head}</header><div class="grid">${all}</div>`; break;
    case "magazine": h = `<header class="hd">${p.name}<div class="mt">${p.role || "<span></span>"}${p.ct}</div></header><div class="cols"><div class="mn">${p.about}${p.exp}</div><aside class="sd">${p.ph}${p.edu}${p.skl}${p.lg}${p.ce}</aside></div>`; break;
    case "diagonal": h = `<header class="hd">${head}${p.ph}</header><div class="cols"><div class="mn">${p.about}${p.exp}</div><aside class="sd">${p.edu}${p.skl}${p.lg}${p.ce}</aside></div>`; break;
    case "monogram": h = `<header class="hd"><div class="mono">${p.ph && d.photo ? p.ph : `<span>${esc(p.ini)}</span>`}</div><div>${p.name}${p.role}</div></header><div class="cols"><aside class="sd">${p.ctSec}${p.skl}${p.lg}${p.ce}</aside><div class="mn">${p.about}${p.exp}${p.edu}</div></div>`; break;
    case "executive": h = `<header class="hd"><div>${p.name}${p.role}</div>${p.ct}</header><div class="cols"><div class="mn">${p.about}${p.exp}</div><aside class="sd">${p.edu}${p.skl}${p.lg}${p.ce}</aside></div>`; break;
    case "classic": h = `<header class="hd">${p.ph}${p.name}${p.role}${p.ct}</header>${all}`; break;
    default: h = `<header class="hd">${p.name}${p.role}${p.ct}</header>${all}`;
  }
  const st = `--ac:${o.ac};--tint:${mix(o.ac, "#ffffff", .11)};--deep:${mix(o.ac, "#000000", .72)};--lite:${mix(o.ac, "#ffffff", .45)};` + (FONTS[o.font] ? `--cvf:${FONTS[o.font]};` : "");
  return `<div class="cv t-${o.tp}" style="${st}">${h}</div>`;
}

/* --- ingilis dili --- */
const trSrc = () => ({ vez: S.d.vez, hq: S.d.hq, bac: S.d.bac, dil: S.d.dil, ser: S.d.ser, exps: S.d.exps.map(e => ({ v: e.v, m: e.m, t: e.t })), edu: S.d.edu.map(e => ({ i: e.i, m: e.m, y: e.y })) });
function mergeEn(d, en) {
  const o = Object.assign({}, d); ["vez", "hq", "bac", "dil", "ser"].forEach(k => { if (typeof en[k] === "string") o[k] = en[k] });
  o.exps = d.exps.map((e, i) => Object.assign({}, e, (en.exps && en.exps[i]) || {}));
  o.edu = d.edu.map((e, i) => Object.assign({}, e, (en.edu && en.edu[i]) || {}));
  return o;
}
const useEn = () => S.lang === "en" && S.en && !isEmpty(S.d);
function view() { if (isEmpty(S.d)) return Object.assign(clone(DEMO), { photo: S.d.photo }); return useEn() ? mergeEn(S.d, S.en) : S.d }
const opts = tp => ({ tp: tp || S.tp, ac: S.ac, font: S.font, photo: S.photo, lang: useEn() ? "en" : "az" });

/* --- miqyas --- */
function fit(box) {
  const cv = box.firstElementChild; if (!cv || !box.clientWidth) return 0;
  const s = box.clientWidth / 794; cv.style.transform = `scale(${s})`; return s;
}
function fitAll() {
  const pv = $("#pv"), s = fit(pv); if (s) pv.style.height = Math.ceil(pv.firstElementChild.offsetHeight * s) + "px";
  $$(".th").forEach(fit);
}
window.addEventListener("resize", () => { fitAll(); fitLetter() });
if (window.ResizeObserver) new ResizeObserver(() => fitAll()).observe($("#pv"));

/* --- render --- */
let tmr; const sched = () => { clearTimeout(tmr); tmr = setTimeout(render, 160) };
function render() {
  const d = view();
  $("#pv").innerHTML = build(d, opts());
  $("#gal").innerHTML = TPL.map(t => `<button type="button" role="option" class="tpl${t[0] === S.tp ? " on" : ""}" aria-selected="${t[0] === S.tp}" data-tp="${t[0]}"><span class="th">${build(d, opts(t[0]))}</span><span class="tn">${t[1]}</span></button>`).join("");
  $("#fan").innerHTML = ["creative", S.tp === "creative" ? "modern" : S.tp, "sidebar"].map(t => `<span class="th">${build(d, opts(t))}</span>`).join("");
  $("#tpname").textContent = TPL.find(t => t[0] === S.tp)[1] + " · 12 şablon";
  score(); langNote();
  $("#pdfnote").textContent = (S.paid ? "Bu CV üçün ödənilib: yenidən yükləmək pulsuzdur." : "İlk yükləmə 1 kredit, sonrakılar pulsuz.") + " İşəgötürən proqramları (ATS) mətni oxusun deyə «Çap et» → «PDF kimi saxla» yolunu da seçə bilərsən.";
  fitAll();
}
function score() {
  const d = S.d, el = $("#score");
  if (isEmpty(d)) { el.innerHTML = `<p class="muted">Nümunə göstərilir. Formanı doldurduqca önizləmə sənin məlumatınla yenilənəcək.</p>`; return }
  const nb = d.exps.reduce((n, e) => n + bullets(e.t).length, 0), al = d.exps.map(e => e.t).join(" ");
  const C = [[d.ad, 10, "ad, soyad"], [d.tel || d.em, 10, "telefon və ya e-poçt"], [d.vez, 5, "hədəf vəzifə"], [d.hq.length >= 80, 10, "80+ simvolluq «Haqqında»"], [d.edu.some(e => e.i), 10, "təhsil"], [d.exps.some(e => e.s || e.t), 15, "iş təcrübəsi"], [nb >= 3, 5, "ən azı 3 təcrübə bəndi"], [/\d/.test(al), 10, "rəqəmli nəticə (məs: 30% artım)"], [list(d.bac).length >= 5, 10, "ən azı 5 bacarıq"], [d.dil, 5, "dillər"], [d.ser, 5, "sertifikat"], [d.photo || NOPHOTO.has(S.tp) || !S.photo, 5, "şəkil"]];
  const p = C.reduce((s, c) => s + (c[0] ? c[1] : 0), 0), miss = C.filter(c => !c[0]).map(c => c[2]);
  el.innerHTML = `<div class="sc-top"><span>CV gücü</span><span>${p}%</span></div><div class="meter"><i style="width:${p}%"></i></div><p>${miss.length ? "Gücləndirmək üçün: " + esc(miss.slice(0, 4).join(", ")) + "." : "Bütün əsas bölmələr doldurulub."}</p>`;
}
function langNote() {
  const n = $("#lnote");
  if (S.lang === "en" && S.en && S.enSrc !== JSON.stringify(trSrc()) && !isEmpty(S.d))
    n.innerHTML = `<div class="note-bar"><span>AZ mətnində dəyişiklik var, EN versiya köhnədir.</span><button class="btn ink sm" type="button" id="retr">Tərcüməni yenilə <span class="cost">1 kredit</span></button></div>`;
  else n.innerHTML = "";
  const r = $("#retr"); if (r) r.onclick = () => translate(r);
}

/* --- forma --- */
const LF = {
  exps: [["v", "Vəzifə", "Satış təmsilçisi"], ["s", "Şirkət", "Delta Market"], ["m", "Müddət", "2022 – indi"], ["t", "Nə etdin? Hər cümlə ayrı bənd olur", "Müştəri bazasını 30% artırdım. Aylıq hesabat hazırlayırdım.", 1]],
  edu: [["i", "Universitet / məktəb", "BDU"], ["m", "İxtisas, dərəcə", "İqtisadiyyat, bakalavr"], ["y", "İllər", "2018 – 2022", 1]]
};
const MAX = { exps: 5, edu: 3 };
function renderList(n) {
  $("#" + n).innerHTML = S.d[n].map((it, i) => `<div class="item"><div class="item-h"><span>${n === "exps" ? "Təcrübə" : "Təhsil"} ${i + 1}</span>${S.d[n].length > 1 ? `<button type="button" class="x-del" data-del="${n}:${i}">Sil</button>` : ""}</div><div class="g2">${LF[n].map(f => `<label class="${f[3] ? "full" : ""}">${f[1]}${f[3] && n === "exps" ? `<textarea data-l="${n}" data-i="${i}" data-f="${f[0]}" placeholder="${f[2]}">${esc(it[f[0]])}</textarea>` : `<input data-l="${n}" data-i="${i}" data-f="${f[0]}" placeholder="${f[2]}" value="${esc(it[f[0]])}">`}</label>`).join("")}</div></div>`).join("");
  $("#add-" + n).hidden = S.d[n].length >= MAX[n];
}
function fillForm() {
  $$("[data-k]").forEach(i => i.value = S.d[i.dataset.k] || "");
  renderList("exps"); renderList("edu");
  $("#picp").hidden = $("#picdel").hidden = !S.d.photo; if (S.d.photo) $("#picp").src = S.d.photo;
  $("#font").value = S.font; $("#phon").checked = S.photo;
  $$("#lang button").forEach(b => b.classList.toggle("on", b.dataset.l === S.lang));
  $$("#sw button").forEach(b => b.classList.toggle("on", b.dataset.c === S.ac));
}
$("#form").addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.k) S.d[t.dataset.k] = t.value;
  else if (t.dataset.l) S.d[t.dataset.l][+t.dataset.i][t.dataset.f] = t.value;
  else return;
  save(); sched();
});
$("#form").addEventListener("click", e => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const [n, i] = b.dataset.del.split(":"); S.d[n].splice(+i, 1); renderList(n); save(); sched();
});
$("#add-exps").onclick = () => { S.d.exps.push({ v: "", s: "", m: "", t: "" }); renderList("exps"); save(); $$("#exps .item").pop().querySelector("input").focus() };
$("#add-edu").onclick = () => { S.d.edu.push({ i: "", m: "", y: "" }); renderList("edu"); save(); $$("#edu .item").pop().querySelector("input").focus() };

$("#pic").onchange = function () {
  const f = this.files && this.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = c.height = 320; const m = Math.min(im.width, im.height);
        c.getContext("2d").drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 320, 320);
        S.d.photo = c.toDataURL("image/jpeg", .85); S.photo = true; save(); fillForm(); render();
      } catch (e) { toast("Şəkli oxumaq alınmadı, başqa fayl sına.") }
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
};
$("#picdel").onclick = () => { S.d.photo = ""; $("#pic").value = ""; save(); fillForm(); render() };

$("#demo").onclick = () => {
  if (!isEmpty(S.d) && !confirm("Formadakı məlumat nümunə ilə əvəz olunsun?")) return;
  S.d = Object.assign(clone(DEMO), { photo: S.d.photo }); S.en = null; S.lang = "az"; save(); fillForm(); render();
  toast("Nümunə dolduruldu. İndi şablon və rəngləri sına.");
};
$("#clear").onclick = () => {
  if (!confirm("Bütün CV məlumatı silinsin?")) return;
  S.d = blank(); S.en = null; S.enSrc = ""; S.lang = "az"; S.paid = false; $("#hqv").innerHTML = ""; save(); fillForm(); render();
};

/* --- dizayn idarəsi --- */
$("#gal").addEventListener("click", e => {
  const b = e.target.closest(".tpl"); if (!b) return;
  S.tp = b.dataset.tp; save();
  $$("#gal .tpl").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b) });
  $("#pv").innerHTML = build(view(), opts());
  $("#tpname").textContent = TPL.find(t => t[0] === S.tp)[1] + " · 12 şablon";
  score(); fitAll();
});
$("#sw").innerHTML = COL.map(c => `<button type="button" data-c="${c[0]}" title="${c[1]}" aria-label="${c[1]}" style="background:${c[0]}"></button>`).join("") + `<label class="cust" title="Öz rəngin"><input type="color" id="cust" value="#C2264B" aria-label="Öz rəngini seç"></label>`;
$("#sw").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.ac = b.dataset.c; save(); $$("#sw button").forEach(x => x.classList.toggle("on", x === b)); render() });
$("#cust").addEventListener("input", e => { S.ac = e.target.value; $$("#sw button").forEach(x => x.classList.remove("on")); save(); sched() });
$("#font").onchange = e => { S.font = e.target.value; save(); render() };
$("#phon").onchange = e => { S.photo = e.target.checked; save(); render() };
$("#lang").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.l === "en") {
    if (isEmpty(S.d)) { toast("Əvvəlcə öz CV məlumatını yaz, sonra tərcümə et."); return }
    if (!S.en && !(await translate(b))) return;
  }
  S.lang = b.dataset.l; save(); $$("#lang button").forEach(x => x.classList.toggle("on", x.dataset.l === S.lang)); render();
});
async function translate(btn) {
  if (!need(1)) return false;
  const src = trSrc(); busy(btn, true, "…"); toast("CV ingilis dilinə tərcümə olunur…", 0);
  try {
    const j = await aiJ("Translate this CV data from Azerbaijani into natural, professional English suitable for a CV. Keep the exact same JSON structure, keys and array lengths. Do not translate company names or personal names. Keep numbers and years; translate words like 'indi' as 'present'. Do not add any new facts. Return ONLY the JSON.\n" + JSON.stringify(src));
    if (!j || !Array.isArray(j.exps)) throw new Error("format");
    S.en = j; S.enSrc = JSON.stringify(src); S.lang = "en"; spend(1); save();
    toast("Tərcümə hazırdır. AZ və EN arasında pulsuz keçə bilərsən.");
    busy(btn, false); render(); $$("#lang button").forEach(x => x.classList.toggle("on", x.dataset.l === "en"));
    return true;
  } catch (e) { busy(btn, false); toast("Tərcümə alınmadı, kredit tutulmadı. Bir az sonra yenidən sına."); return false }
}

/* --- AI: Haqqında variantları --- */
function localHq(d) {
  const y = yrs(d), sk = list(d.bac).slice(0, 3), v = d.vez || "mütəxəssis", e0 = d.exps.find(e => e.s) || {};
  return [
    { n: "Peşəkar", t: `${y ? y + " illik təcrübəsi olan " : ""}${v}. ${sk.length ? "Əsas sahələrim: " + sk.join(", ") + ". " : ""}${e0.s ? e0.s + " şirkətindəki işimdə ölçülə bilən nəticələrə fokuslanmışam." : "Nəticəyönümlü işləməyə və komandada effektiv olmağa fokuslanıram."}` },
    { n: "Cəsarətli", t: `${v} kimi işimi rəqəmlərlə ölçürəm. ${sk[0] ? sk[0] + " və " + (sk[1] || "komanda işi") + " mənim güclü tərəfimdir. " : ""}Yeni komandada tez uyğunlaşır, ilk aylardan nəticə gətirirəm.` },
    { n: "Qısa", t: `${v}${y ? ", " + y + " il təcrübə" : ""}${sk.length ? ": " + sk.join(", ") : ""}.` }
  ];
}
$("#ai-hq").onclick = async () => {
  const d = S.d, b = $("#ai-hq");
  if (!d.vez && !d.exps.some(e => e.t)) { toast("Əvvəlcə hədəf vəzifəni və ya təcrübəni yaz."); return }
  if (!need(1)) return;
  busy(b, true); let v = null;
  try {
    const j = await aiJ(`Sən CV yazmaqda təcrübəli karyera məsləhətçisisən. Bu namizəd üçün CV-nin «Haqqında» bölməsinə Azərbaycan dilində 3 fərqli variant yaz, hər biri 2-3 cümlə (35-60 söz). Variantlar: "Peşəkar" (sakit, rəsmi), "Cəsarətli" (güclü fellər, nəticə önə çıxır), "Qısa" (1-2 cümlə, ən vacibi). Yalnız verilən faktlardan istifadə et, rəqəm və fakt uydurma. Cümləni «Mən» ilə başlama. YALNIZ JSON massiv qaytar: [{"n":"Peşəkar","t":"..."},{"n":"Cəsarətli","t":"..."},{"n":"Qısa","t":"..."}]\nNamizəd: ${JSON.stringify(cvBrief(d))}`);
    if (Array.isArray(j)) v = j.filter(x => x && typeof x.t === "string" && x.t.trim()).slice(0, 3);
  } catch (e) { }
  const isAi = !!(v && v.length); if (isAi) spend(1); else v = localHq(d);
  busy(b, false);
  $("#hqv").innerHTML = v.map((x, i) => `<div class="opt"><b>${esc(x.n || "Variant " + (i + 1))}</b><p>${esc(x.t)}</p><button class="btn ghost sm" type="button" data-hq="${i}">Bunu seç</button></div>`).join("") + `<p class="hint">${isAi ? "AI yazdı. Faktları yoxla." : "AI cavab vermədi: hazır şablon göstərildi, kredit tutulmadı."}</p>`;
  $$("[data-hq]").forEach(btn => btn.onclick = () => { S.d.hq = v[+btn.dataset.hq].t; $('[data-k="hq"]').value = S.d.hq; save(); render(); toast("«Haqqında» yeniləndi.") });
};

/* --- AI: bəndləri gücləndir --- */
$("#ai-bul").onclick = async () => {
  const idx = S.d.exps.map((e, i) => e.t.trim() ? i : -1).filter(i => i >= 0), b = $("#ai-bul");
  if (!idx.length) { toast("Əvvəlcə təcrübədə nə etdiyini yaz."); return }
  if (!need(1)) return;
  busy(b, true);
  try {
    const j = await aiJ("Aşağıdakı iş təcrübəsi mətnlərini peşəkar CV üslubunda yenidən yaz: hər cümlə güclü fəal feillə başlasın, qısa və konkret olsun. Mənanı və faktları dəyişmə, yeni rəqəm və ya fakt uydurma. Giriş hansı dildədirsə o dildə yaz. Hər təcrübə üçün bir mətn qaytar, cümlələr nöqtə ilə ayrılsın. Massivin uzunluğu girişlə eyni olsun. YALNIZ JSON massiv qaytar.\nGiriş: " + JSON.stringify(idx.map(i => S.d.exps[i].t)));
    let ch = 0;
    if (Array.isArray(j)) j.forEach((x, k) => { if (typeof x === "string" && x.trim() && idx[k] != null) { S.d.exps[idx[k]].t = x.trim(); ch++ } });
    if (!ch) throw new Error("boş");
    spend(1); save(); renderList("exps"); render(); toast("Bəndlər yeniləndi. Faktların düzgünlüyünü yoxla.");
  } catch (e) { toast("AI cavab vermədi, kredit tutulmadı.") }
  busy(b, false);
};

/* --- çap / kopya --- */
function printDoc(html) {
  $("#printArea").innerHTML = html; document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); $("#printArea").innerHTML = "" };
  setTimeout(() => { try { window.print() } catch (e) { toast("Çap pəncərəsi açılmadı. Mətni kopyalayıb Word-ə yapışdır.") } setTimeout(done, 500) }, 120);
}
const H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const loadJs = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s) });
let libs;
const pdfLibs = () => libs || (libs = Promise.all([window.html2canvas || loadJs(H2C), (window.jspdf && window.jspdf.jsPDF) || loadJs(JSPDF)]).catch(e => { libs = null; throw e }));
async function downloadPdf(html, name, btn) {
  busy(btn, true, "PDF hazırlanır…");
  const host = document.createElement("div");
  try {
    await pdfLibs(); if (document.fonts && document.fonts.ready) await document.fonts.ready;
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff"; host.innerHTML = html; document.body.appendChild(host);
    await new Promise(r => setTimeout(r, 60));
    const c = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 794 });
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true }), pageH = Math.floor(c.width * 297 / 210);
    for (let y = 0, i = 0; y < c.height - 8; y += pageH, i++) {
      const h = Math.min(pageH, c.height - y), pc = document.createElement("canvas"); pc.width = c.width; pc.height = pageH;
      const x = pc.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, pc.width, pc.height); x.drawImage(c, 0, y, c.width, h, 0, 0, c.width, h);
      if (i) pdf.addPage(); pdf.addImage(pc.toDataURL("image/jpeg", .92), "JPEG", 0, 0, 210, 297);
    }
    pdf.save(name); return true;
  } catch (e) { toast("PDF yaradıla bilmədi. «Çap et» düyməsi ilə «PDF kimi saxla» seç."); return false }
  finally { host.remove(); busy(btn, false) }
}
const fname = (suf) => ((S.d.ad || "KarYera").trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "") || "KarYera") + "_" + suf + ".pdf";
function payCv() {
  if (isEmpty(S.d)) { toast("Əvvəlcə öz məlumatını yaz və ya «Nümunə ilə doldur» düyməsini bas."); return false }
  if (!S.paid) { if (!need(1)) return false; spend(1); S.paid = true; save(); render() }
  return true;
}
$("#dl").onclick = () => { if (payCv()) downloadPdf(build(view(), opts()), fname(S.lang === "en" && useEn() ? "Resume" : "CV"), $("#dl")) };
$("#pdf").onclick = () => { if (payCv()) printDoc(build(view(), opts())) };
$("#copy").onclick = () => { const cv = $("#pv .cv"); if (cv) copyText($("#copy"), cv.innerText) };
$("#fab").onclick = () => $("#pvcol").scrollIntoView({ behavior: "smooth", block: "start" });

/* ============================================================ Müsahibə */
const AIQ = "Vakansiyama görə (AI)";
const Q = {
  "HR müsahibəsi": { t: "Keçmiş, indi, gələcək formatından istifadə et. Çətin vəziyyətdə STAR: situasiya, vəzifə, hərəkət, nəticə.", q: ["Özünüz haqqında danışın.", "Niyə məhz bizim şirkətdə işləmək istəyirsiniz?", "Ən güclü və ən zəif tərəfiniz nədir?", "Çətin bir vəziyyətdən necə çıxdığınızı danışın.", "5 il sonra özünüzü harada görürsünüz?"] },
  [AIQ]: { t: "Suallar elandakı tələblərə görə hazırlanır. Hər cavabda elandakı bir tələbi öz nümunənlə bağla.", q: [] },
  "Satış": { t: "Rəqəmlərlə danış: satış həcmi, faiz artımı, müştəri sayı. Müştərinin ehtiyacını necə tapdığını göstər.", q: ["Çətin müştərini necə razı salardınız?", "Satış hədəfinizi necə planlaşdırırsınız?", "Rədd cavabı alanda nə edirsiniz?", "Bu qələmi mənə 1 dəqiqəyə satın.", "Ən yaxşı satışınız hansı olub?"] },
  "Texniki (IT)": { t: "Konkret alətləri və nəticəni qeyd et. Problemi addım-addım izah et.", q: ["Ən maraqlı layihənizi izah edin.", "Səhvi (bug) necə tapıb düzəldirsiniz?", "Yeni texnologiyanı necə öyrənirsiniz?", "Komanda ilə Git ilə necə işləmisiniz?", "Kodunuzun keyfiyyətini necə təmin edirsiniz?"] },
  "Müştəri xidməti": { t: "Səbir, empatiya və həll yolunu göstər. Real hadisə nümunəsi ver.", q: ["Əsəbi müştəri ilə necə rəftar edərdiniz?", "Eyni anda bir neçə sorğu gəldikdə nə edirsiniz?", "Cavabını bilmədiyiniz sual gəlsə nə edərsiniz?", "Sizcə yaxşı xidmət nədir?", "Stresə necə dözürsünüz?"] },
  "Yeni məzun (təcrübəsiz)": { t: "Təcrübə yoxdursa, universitet layihələri, könüllü işlər və öyrənmə sürətini önə çıxar.", q: ["Təcrübəniz azdır, niyə sizi seçməliyik?", "Təhsil dövründə hansı layihədə iştirak etmisiniz?", "Bu sahəni niyə seçmisiniz?", "Komandada adətən hansı rolu oynayırsınız?", "Hansı bacarığı ilk növbədə inkişaf etdirmək istəyirsiniz?"] },
  "İngilis dilində": { t: "Answer in 3-4 sentences, add one concrete example and a result.", q: ["Tell me about yourself.", "Why should we hire you?", "Describe a challenge you overcame.", "What are your main strengths?", "Where do you see yourself in 3 years?"] },
  "Rəhbər / menecer": { t: "Neçə nəfəri idarə etdin, hansı göstərici necə dəyişdi: komanda, qərar, nəticə.", q: ["Komandanızı necə motivasiya edirsiniz?", "Komanda üzvü ilə münaqişəni necə həll etmisiniz?", "Prioritetləri və vaxtı necə idarə edirsiniz?", "Uğursuz olan bir qərarınız və ondan dərsiniz?", "Yeni əməkdaşı necə adaptasiya edirsiniz?"] },
  "Marketinq / SMM": { t: "Kampaniya nəticələrini rəqəmlə de: çatım, klik, satış, böyümə faizi. Alətləri qeyd et.", q: ["Uğurlu kampaniya nümunəsi göstərin.", "Büdcəni kanallar arasında necə bölürsünüz?", "Nəticəni hansı göstəricilərlə ölçürsünüz?", "Brend üçün kontent planını necə qurursunuz?", "Rəqiblərin təhlilini necə aparırsınız?"] },
  "Maaş danışığı": { t: "Bazar araşdırması et, aralıq de, dəyərini nəticələrlə əsaslandır, qapını bağlama.", q: ["Maaş gözləntiniz nə qədərdir?", "Təklif etdiyimiz maaş gözləntinizdən aşağıdır. Nə deyərsiniz?", "Niyə sizə daha çox ödəməliyik?", "Maaşdan başqa hansı şərtlər sizin üçün vacibdir?", "Əvvəlki iş yerinizdə maaşınız nə qədər idi?"] }
};
$("#mtip").innerHTML = Object.keys(Q).map(k => `<option>${esc(k)}</option>`).join("");
let cat, catName, qi = 0, res = [];
function mprev() {
  const k = $("#mtip").value, isAi = k === AIQ; $("#mvacw").hidden = !isAi;
  $("#mprev").innerHTML = isAi ? `<p class="hint">AI elandakı tələblərə uyğun 5 sual hazırlayacaq. AI cavab verməsə, HR sualları ilə davam edəcək.</p>` : `<b>Bu sessiyanın sualları</b><ol class="qlist">${Q[k].q.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
}
$("#mtip").onchange = mprev; mprev();
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function mui(a) { $("#mev").hidden = !a; $("#mic").hidden = !(a && SR); $("#mans").readOnly = !a; $("#mfb").hidden = a; $("#mnav").hidden = a }
function nextQ() {
  $("#mbar").style.width = (qi + 1) * 20 + "%"; $("#mnum").textContent = "Sual " + (qi + 1) + " / 5 · " + catName;
  $("#mq").textContent = cat.q[qi];
  $("#mhint").innerHTML = esc(cat.t) + "<br><br>Çərçivə: <b>Situasiya</b> (1 cümlə) → <b>Hərəkət</b> (nə etdin) → <b>Nəticə</b> (rəqəmlə).";
  $("#mh").open = false; $("#mans").value = ""; mui(true);
  if (window.KYHook) KYHook.question(cat.q[qi]);
}
$("#mgo").onclick = async () => {
  catName = $("#mtip").value;
  if (catName === AIQ && $("#mvac").value.trim().length < 60) { toast("Vakansiya elanını yapışdır (ən azı bir neçə cümlə)."); return }
  if (!need(2)) return; spend(2);
  cat = clone(Q[catName]);
  if (catName === AIQ) {
    const b = $("#mgo"); busy(b, true, "Suallar hazırlanır…");
    try {
      const j = await aiJ("Sən təcrübəli HR müsahibəçisisən. Aşağıdakı vakansiya elanına görə namizədə veriləcək 5 müsahibə sualı yaz: 2 davranış (keçmiş təcrübə), 2 rola xas texniki/peşəkar, 1 motivasiya sualı. " + (window.KYHook ? KYHook.qLang() : "Elan hansı dildədirsə o dildə yaz.") + " YALNIZ JSON massiv qaytar: [\"sual1\", ...]\nElan: " + $("#mvac").value.trim().slice(0, 3500));
      if (!Array.isArray(j) || j.length < 5) throw 0;
      cat.q = j.slice(0, 5).map(String);
    } catch (e) { cat = clone(Q["HR müsahibəsi"]); catName = "HR müsahibəsi"; toast("AI sualları hazırlaya bilmədi, HR sualları ilə davam edirik.") }
    busy(b, false);
  }
  qi = 0; res = []; $("#m0").hidden = true; $("#m2").hidden = true; $("#m1").hidden = false; nextQ();
};
$("#mic").onclick = () => {
  try {
    const r = new SR(); r.lang = window.KYHook ? KYHook.srLang(catName) : (catName === "İngilis dilində" ? "en-US" : "az-AZ"); $("#mic").textContent = "Dinləyirəm…";
    r.onresult = e => { $("#mans").value += ($("#mans").value ? " " : "") + e.results[0][0].transcript };
    r.onend = () => $("#mic").textContent = "Səslə cavab ver"; r.onerror = () => $("#mic").textContent = "Mikrofon icazəsi yoxdur"; r.start();
  } catch (e) { $("#mic").textContent = "Səs bu brauzerdə işləmir" }
};
function evLocal(a) {
  const w = a.split(/\s+/).length, dg = /\d/.test(a), c = re => (a.match(re) || []).length;
  const s = Math.min(10, Math.round(w / 12)), e = Math.min(10, c(/nümunə|layihə|məsələn|müştəri|komanda|şirkət|example|project|team|client/gi) * 3 + (dg ? 3 : 0)), r = Math.min(10, c(/nəticə|artır|azal|qazan|çat|nail|uğur|result|increas|achiev|%/gi) * 3 + (dg ? 3 : 0));
  const f = [];
  if (s < 6) f.push("Cavab qısadır: 3–4 cümləyə çatdır."); if (e < 6) f.push("Konkret nümunə əlavə et: hansı layihə, müştəri və ya vəziyyət."); if (r < 6) f.push("Sonda nəticəni rəqəmlə de, məs: satış 20% artdı."); if (!f.length) f.push("Güclü cavab. Sonda nəticəni bir cümlə ilə yekunla.");
  return { t: Math.max(1, Math.round(s * .3 + e * .35 + r * .35)), s: Math.max(1, s), e: Math.max(1, e), r: Math.max(1, r), f };
}
$("#mev").onclick = async () => {
  const a = $("#mans").value.trim(), fb = $("#mfb");
  if (a.split(/\s+/).length < 8) { fb.hidden = false; fb.innerHTML = `<p class="hint">Cavab çox qısadır. Ən azı 2 cümlə yaz.</p>`; return }
  busy($("#mev"), true, "AI oxuyur…");
  let r = evLocal(a), mdl = "", isAi = false;
  try {
    const j = await aiJ(`Sən təcrübəli HR müsahibəçisisən. Müsahibə növü: ${catName}. Namizədin hədəf vəzifəsi: ${S.d.vez || "göstərilməyib"}. Sual: ${cat.q[qi]}\nNamizədin cavabı: ${a}\n\nCavabı qiymətləndir. Rəyi ${window.KYHook ? KYHook.fbLang(catName) : "Azərbaycan dilində yaz (sual ingiliscədirsə ingiliscə)"}. YALNIZ JSON qaytar: {"s":struktur 1-10,"e":konkretlik 1-10,"r":nəticə 1-10,"f":["2-3 qısa, konkret məsləhət"],"m":"namizədin öz faktlarına əsaslanan 3-4 cümləlik daha güclü cavab nümunəsi, yeni fakt və rəqəm uydurma"}`);
    if (j && j.s && j.e && j.r) { const cl = x => Math.max(1, Math.min(10, Math.round(+x))); r = { s: cl(j.s), e: cl(j.e), r: cl(j.r), f: (j.f || []).map(String) }; r.t = cl(r.s * .3 + r.e * .35 + r.r * .35); mdl = j.m || ""; isAi = true }
  } catch (e) { }
  res[qi] = r; busy($("#mev"), false); mui(false);
  fb.innerHTML = `<div class="big">${r.t}/10</div><div class="stack mt">${[["Struktur", r.s], ["Konkretlik", r.e], ["Nəticə", r.r]].map(x => `<div class="crit"><span>${x[0]}</span><div class="meter"><i style="width:${x[1] * 10}%"></i></div><b>${x[1]}</b></div>`).join("")}</div><ul class="mt" style="padding-left:18px">${r.f.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${mdl ? `<div class="box ai-ex mt"><b>Daha güclü cavab nümunəsi</b><br>${esc(mdl)}</div>` : ""}<p class="hint mt">${isAi ? "AI rəyi" : "Əsas rəy (AI əlçatmaz idi)"}</p>`;
  $("#mnext").textContent = qi < 4 ? "Növbəti sual" : "Nəticəni gör";
};
$("#mretry").onclick = () => mui(true);
$("#mnext").onclick = () => { if (qi < 4) { qi++; nextQ() } else mfin() };
function mfin() {
  $("#m1").hidden = true;
  const av = res.reduce((x, y) => x + y.t, 0) / 5, m = k => res.reduce((x, y) => x + y[k], 0) / 5;
  const wk = [["Struktur", m("s")], ["Konkretlik", m("e")], ["Nəticə", m("r")]].sort((a, b) => a[1] - b[1])[0][0];
  const el = $("#m2"); el.hidden = false;
  el.innerHTML = `<div class="big">${av.toFixed(1)}/10</div><p>${av >= 8 ? "Çox yaxşı hazırlıq." : av >= 6 ? "Yaxşıdır: nümunə və rəqəmlərlə daha da gücləndir." : "Hələ məşq lazımdır, sualları yenidən keç."}</p><div class="mt">${res.map((r, i) => `<div class="res-row"><span>${i + 1}. ${esc(cat.q[i])}</span><b>${r.t}/10</b></div>`).join("")}</div><div class="box mt">Ən çox gücləndirməli olduğun cəhət: <b>${wk}</b>.\n${esc(cat.t)}</div><button class="btn mt" id="mre" type="button">Yeni sessiya</button>`;
  $("#mre").onclick = () => { el.hidden = true; $("#m0").hidden = false };
}

/* ============================================================ Məktub */
const LT = { app: ["Müraciət", "vakansiyaya"], thx: ["Təşəkkür", "müsahibədən sonra"], fu: ["Follow-up", "cavab gəlməyəndə"] };
const TONE = { formal: ["Rəsmi", "rəsmi və hörmətli"], warm: ["Səmimi", "səmimi, insani, amma peşəkar"], bold: ["Cəsarətli", "özünəinamlı, ilk cümlə diqqət çəksin, nəticələr önə çıxsın"], short: ["Qısa", "çox qısa və konkret"] };
const NOTE_L = { app: "Vurğulamaq istədiyin 1–2 üstünlük", thx: "Müsahibədə nə müzakirə olundu?", fu: "Nə vaxt müraciət etmisən?" };
const lt = { type: "app", tone: "formal", text: "" };
function pickers() {
  $("#ltype").innerHTML = Object.entries(LT).map(([k, v]) => `<button type="button" data-v="${k}" class="${k === lt.type ? "on" : ""}">${v[0]}<small>${v[1]}</small></button>`).join("");
  $("#ltone").innerHTML = Object.entries(TONE).map(([k, v]) => `<button type="button" data-v="${k}" class="${k === lt.tone ? "on" : ""}">${v[0]}</button>`).join("");
  $("#lnl").textContent = NOTE_L[lt.type];
}
$("#ltype").onclick = e => { const b = e.target.closest("button"); if (b) { lt.type = b.dataset.v; pickers() } };
$("#ltone").onclick = e => { const b = e.target.closest("button"); if (b) { lt.tone = b.dataset.v; pickers() } };
pickers();
const lc1 = s => s ? s.charAt(0).toLocaleLowerCase("az") + s.slice(1).replace(/\.$/, "") : "";
function localLetter(d, c, p, pn, note) {
  const f = lt.tone === "formal", nm = d.ad || "Ad Soyad", e0 = d.exps.find(e => e.t) || {}, b0 = bullets(e0.t)[0], y = yrs(d);
  const us = (lt.type === "app" && note) || list(d.bac).slice(0, 2).join(", ");
  const hi = pn ? (f ? "Hörmətli " + pn + "," : "Salam, " + pn + ",") : (f ? "Hörmətli " + c + " komandası," : "Salam, " + c + " komandası,");
  const end = (f ? "Hörmətlə," : "Təşəkkürlə,") + "\n" + nm;
  let body;
  if (lt.type === "thx") body = [`Bu gün ${p} vəzifəsi üzrə müsahibəyə vaxt ayırdığınız üçün təşəkkür edirəm. ${note ? "Söhbətimizdə " + lc1(note) + " mövzusu xüsusilə maraqlı oldu. " : ""}Eşitdiklərim bu rola marağımı daha da artırdı.`, b0 ? `Əvvəlki işimdə ${lc1(b0)}. Oxşar nəticəni ${c} üçün də yaratmağa hazıram.` : `Öyrəndiklərimi tez tətbiq edib nəticə yaratmağa hazıram.`, `Əlavə məlumat lazım olsa, məmnuniyyətlə göndərərəm.`];
  else if (lt.type === "fu") body = [`${note ? lc1(note).replace(/^./, m => m.toLocaleUpperCase("az")) + " " : "Bir müddət əvvəl "}${p} vəzifəsinə müraciət etmişdim və prosesin hansı mərhələdə olduğunu öyrənmək istərdim.`, `Bu rola marağım davam edir${us ? ": " + us + " sahəsindəki təcrübəmlə komandanıza töhfə verə biləcəyimi düşünürəm" : ""}.`, `Əlavə sənəd və ya məlumat lazım olsa, hazıram${d.tel ? ". Əlaqə: " + d.tel : ""}.`];
  else if (lt.tone === "bold") body = [`${b0 ? b0.replace(/\.$/, "") + " — " : ""}${c} komandasında ${p} kimi buna bənzər nəticələr yaratmaq istəyirəm.`, `${y ? y + " illik təcrübəm" : "Təcrübəm"}${e0.s ? " (" + e0.s + " daxil olmaqla)" : ""} və ${us || "nəticəyönümlü yanaşmam"} bu rol üçün güclü əsasdır.`, `Qısa görüşdə necə dəyər qata biləcəyimi danışmağa hazıram${d.tel ? ": " + d.tel : ""}.`];
  else body = [`${p} vakansiyası ilə maraqlanıram${f ? " və namizədliyimi təqdim etmək istəyirəm" : ", elanı oxuyanda özümü bu rolda gördüm"}. ${y ? y + " illik təcrübəm" : "Təcrübəm"}${e0.s ? " (" + e0.s + " daxil olmaqla)" : ""} bu vəzifədə dəyər qatmağa imkan verir.`, `${b0 ? "Əsas nəticələrimdən biri: " + lc1(b0) + ". " : ""}${us ? "Gətirəcəyim üstünlüklər: " + us + "." : ""}`, `Müsahibə üçün istənilən vaxt hazıram${d.tel ? ", " + d.tel + " nömrəsi ilə əlaqə saxlaya bilərsiniz" : ""}. Diqqətinizə görə təşəkkür edirəm.`];
  if (lt.tone === "short") body = [body[0], body[body.length - 1]];
  return hi + "\n\n" + body.filter(x => x.trim()).join("\n\n") + "\n\n" + end;
}
function letterDoc(txt) {
  const d = S.d, ct = [d.tel, d.em, d.seh, d.link].filter(Boolean).map(esc);
  const AY = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avqust","sentyabr","oktyabr","noyabr","dekabr"], dt = new Date(), date = dt.getDate() + " " + AY[dt.getMonth()] + " " + dt.getFullYear();
  return `<div class="lt" style="--ac:${S.ac}"><header><h1>${esc(d.ad || "Ad Soyad")}</h1>${d.vez ? `<p>${esc(d.vez)}</p>` : ""}${ct.length ? `<div class="ct">${ct.map(c => `<span>${c}</span>`).join("")}</div>` : ""}</header><time>${esc(date)}</time><div class="lb">${txt.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}</div></div>`;
}
function fitLetter() {
  const box = $("#lpv"); if (!box || $("#lres").hidden) return;
  const s = fit(box); if (s) box.style.height = Math.ceil(box.firstElementChild.offsetHeight * s) + "px";
}
function showLetter() { $("#lres").hidden = false; $("#ltx").value = lt.text; $("#lpv").innerHTML = letterDoc(lt.text); fitLetter() }
$("#ltx").addEventListener("input", () => { lt.text = $("#ltx").value; $("#lpv").innerHTML = letterDoc(lt.text); fitLetter() });
$("#lgo").onclick = async () => {
  const d = S.d, c = $("#lc").value.trim(), p = $("#lp").value.trim() || d.vez, pn = $("#lpn").value.trim(), note = $("#lnote2").value.trim();
  if (!c || !p) { toast("Şirkəti və vəzifəni yaz (və ya CV-də hədəf vəzifəni)."); return }
  if (!need(1)) return;
  const b = $("#lgo"); busy(b, true); let txt = "", isAi = false;
  const len = lt.tone === "short" ? "60-90 söz" : "140-200 söz";
  try {
    txt = await ai(`${LT[lt.type][0]} məktubu yaz (${LT[lt.type][1]}). Şirkət: ${c}. Vəzifə: ${p}. ${pn ? "Kimə: " + pn + ". " : ""}Üslub: ${TONE[lt.tone][1]}. ${NOTE_L[lt.type]}: ${note || "-"}. Dil: Azərbaycan. Uzunluq: ${len}, 2-3 qısa paraqraf. Yalnız namizədin verdiyi faktlardan istifadə et, fakt və rəqəm uydurma. Müraciət sözü ilə başla, imza ilə bitir (imza: ${d.ad || "Ad Soyad"}). Mövzu sətri, başlıq və izah yazma, yalnız məktub mətnini qaytar.\nNamizəd: ${JSON.stringify(cvBrief(d))}`);
    if (txt.length < 60) throw 0; isAi = true; spend(1);
  } catch (e) { txt = localLetter(d, c, p, pn, note); toast("AI cavab vermədi: hazır şablonla yazıldı, kredit tutulmadı.") }
  busy(b, false); lt.text = txt.replace(/\*\*/g, ""); showLetter();
  if (isAi) toast("Məktub hazırdır. Mətni sağda düzəldə bilərsən.");
  if (window.innerWidth < 1000) $("#lres").scrollIntoView({ behavior: "smooth" });
};
$("#lpdf").onclick = () => printDoc(letterDoc(lt.text));
$("#ldl").onclick = () => downloadPdf(letterDoc(lt.text), fname("Mektub"), $("#ldl"));
$("#lcp").onclick = () => copyText($("#lcp"), lt.text);

/* --- LinkedIn --- */
function localLi(d) {
  const sk = list(d.bac), v = d.vez || "Mütəxəssis", e0 = d.exps.find(e => e.s) || {}, lang = d.dil ? d.dil.split(",")[0].replace(/\(.*\)/, "").trim() : "";
  return {
    h: [v + (sk.length ? " | " + sk.slice(0, 3).join(" · ") : ""), v + (e0.s ? " @ " + e0.s : "") + " | Nəticəyönümlü", "Kömək etdiyim iş: " + (sk[0] || "nəticə") + " ilə böyümə | " + v + (lang ? " | " + lang : "")],
    a: (d.hq || v + " kimi işləyirəm.") + "\n\n" + d.exps.filter(e => e.s).slice(0, 2).map(e => "▪ " + e.v + ", " + e.s + (bullets(e.t)[0] ? ": " + lc1(bullets(e.t)[0]) : "")).join("\n") + "\n\nBacarıqlar: " + sk.join(", ") + "\n\nƏməkdaşlıq və vakansiyalar üçün mənə yaza bilərsiniz.",
    k: sk.slice(0, 10)
  };
}
$("#lkgo").onclick = async () => {
  const d = S.d; if (!d.vez && !d.bac && !d.exps.some(e => e.t)) { toast("Əvvəlcə CV bölməsində vəzifə, bacarıq və ya təcrübə yaz."); return }
  if (!need(1)) return;
  const b = $("#lkgo"); busy(b, true); let o = null, isAi = false;
  try {
    const j = await aiJ(`Bu namizəd üçün Azərbaycan dilində LinkedIn profil mətni yaz. YALNIZ JSON qaytar: {"h":["3 fərqli başlıq (headline), hər biri 220 simvoldan az: biri açar sözlərlə, biri dəyər təklifi ilə, biri yaradıcı"],"a":"Haqqımda bölməsi, 120-200 söz, 3 qısa abzas, birinci şəxsdə, sonda əməkdaşlığa çağırış","k":["10 açar söz / bacarıq"]}. Yalnız verilən faktlardan istifadə et, uydurma.\nNamizəd: ${JSON.stringify(cvBrief(d))}`);
    if (j && Array.isArray(j.h) && j.a) { o = { h: j.h.slice(0, 3).map(String), a: String(j.a), k: (j.k || []).map(String) }; isAi = true; spend(1) }
  } catch (e) { }
  if (!o) o = localLi(d);
  busy(b, false);
  $("#lkout").innerHTML = `<h3 class="mt" style="font-size:15px">Başlıq variantları</h3>${o.h.map((h, i) => `<div class="hl"><p>${esc(h)}</p><button class="btn ghost sm" type="button" data-cp="h${i}">Kopyala</button></div>`).join("")}<h3 class="mt" style="font-size:15px;margin-top:18px">Haqqımda</h3><div class="box mt">${esc(o.a)}</div><button class="btn ghost sm mt" type="button" data-cp="a">Kopyala</button>${o.k.length ? `<h3 style="font-size:15px;margin-top:18px">Bacarıqlar bölməsi üçün</h3><div class="kw mt">${o.k.map(k => `<span class="tag">${esc(k)}</span>`).join("")}</div>` : ""}<p class="hint mt">${isAi ? "AI yazdı. Faktları yoxla." : "AI cavab vermədi: hazır şablon göstərildi, kredit tutulmadı."}</p>`;
  $$("#lkout [data-cp]").forEach(btn => btn.onclick = () => copyText(btn, btn.dataset.cp === "a" ? o.a : o.h[+btn.dataset.cp.slice(1)]));
};

/* ============================================================ Karyera */
const cvText = d => [d.ad, d.vez, d.hq, d.bac, d.dil, d.ser, ...d.exps.map(e => e.v + " " + e.s + " " + e.t), ...d.edu.map(e => e.i + " " + e.m)].join(" ").toLowerCase();
const STOP = new Set("və ilə üçün bir bu olan olar daha çox ən kimi görə üzrə həm eləcə də olmaq bilik təcrübə işləmək tələblər vəzifə öhdəliklər the and for with you are our will have from your that this has not can who all any".split(" "));
let tailor = null;
$("#vgo").onclick = () => {
  const v = $("#vac").value.trim(); if (v.length < 40) { toast("Vakansiya elanını yapışdır (ən azı bir neçə cümlə)."); return }
  if (!need(1)) return; spend(1);
  const f = {}; v.toLowerCase().replace(/[^a-zəöüçşğıi0-9+#]+/g, " ").split(" ").forEach(w => { if (w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)) f[w] = (f[w] || 0) + 1 });
  const kw = Object.keys(f).sort((a, b) => f[b] - f[a] || b.length - a.length).slice(0, 16), txt = cvText(S.d);
  const hit = kw.filter(k => txt.includes(k.slice(0, Math.min(5, k.length)))), miss = kw.filter(k => !hit.includes(k)), p = Math.round(hit.length / Math.max(1, kw.length) * 100);
  tailor = { hit, miss, p };
  $("#vout").innerHTML = `<div class="mt"><div class="big">${p}%</div><p class="muted">elandakı açar sözlərin CV-də olan hissəsi</p><div class="meter"><i style="width:${p}%"></i></div><p class="mt"><b>CV-də var</b></p><div class="kw mt">${hit.map(k => `<span class="tag g">${esc(k)}</span>`).join("") || "<span class='hint'>yoxdur</span>"}</div><p class="mt"><b>CV-də yoxdur</b></p><div class="kw mt">${miss.map(k => `<span class="tag r">${esc(k)}</span>`).join("") || "<span class='hint'>hamısı var</span>"}</div><p class="hint mt">Qırmızı sözlərdən real olaraq sənə aid olanları bacarıq və ya təcrübə bəndlərinə əlavə et. Sahib olmadığın bacarığı yazma: müsahibədə yoxlanılır.</p><button class="btn ghost mt" id="vapp" type="button">Bacarıqları elana görə sırala</button></div>`;
  $("#vapp").onclick = () => {
    const sk = list(S.d.bac), pri = sk.filter(s => tailor.hit.some(k => s.toLowerCase().includes(k.slice(0, 5)))), rest = sk.filter(s => !pri.includes(s));
    S.d.bac = pri.concat(rest).join(", "); save(); fillForm(); render(); tab("cv"); toast("Bacarıqlar elana uyğun sıralandı.");
  };
};
const FIELDS = [["Satış / biznes inkişafı", "satış müştəri danışıq crm hədəf kommunikasiya", "CRM alətləri, B2B satış, danışıq texnikaları"], ["Marketinq / SMM", "marketinq smm kontent reklam meta instagram seo təhlil", "Meta Ads, Google Analytics, kontent strategiyası"], ["IT / proqramlaşdırma", "python javascript kod git sql proqram html react", "Git, SQL, bir proqramlaşdırma dili və portfolio layihəsi"], ["Maliyyə / mühasibat", "excel mühasib maliyyə hesabat vergi büdcə 1c", "Excel (irəli səviyyə), 1C, maliyyə modelləşdirməsi"], ["Müştəri xidməti", "müştəri xidmət dəstək zəng şikayət empatiya kommunikasiya", "CRM, ticket sistemləri, stress idarəetməsi"], ["HR / işə qəbul", "hr işə qəbul müsahibə kadr təlim adaptasiya", "İşə qəbul alətləri, əmək qanunvericiliyi"], ["Dizayn", "dizayn figma photoshop illustrator canva ui ux", "Figma, tipoqrafiya, portfolio"], ["Layihə idarəetməsi", "layihə plan komanda idarə scrum agile jira büdcə", "Scrum/Agile, Jira, risk idarəetməsi"], ["Logistika / təchizat", "logistika anbar stok təchizat daşıma satınalma", "Stok uçotu, təchizat zənciri, ERP"]];
$("#kgo").onclick = () => {
  if (isEmpty(S.d)) { toast("Əvvəlcə CV bölməsində bacarıq və təcrübəni yaz."); return }
  if (!need(1)) return; spend(1);
  const t = cvText(S.d);
  const R = FIELDS.map(f => { const w = f[1].split(" "), h = w.filter(k => t.includes(k.slice(0, 5))); return { n: f[0], h, p: Math.round(h.length / w.length * 100), l: f[2] } }).sort((a, b) => b.p - a.p).slice(0, 3);
  $("#kout").innerHTML = R.map(r => `<div class="box mt" style="white-space:normal"><div class="sc-top"><b>${esc(r.n)}</b><span>${r.p}%</span></div><div class="meter"><i style="width:${r.p}%"></i></div><div class="kw">${r.h.map(k => `<span class="tag g">${esc(k)}</span>`).join("") || "<span class='hint'>uyğun söz tapılmadı</span>"}</div><p class="hint mt">Öyrən: ${esc(r.l)}</p></div>`).join("");
};
const PLAN = ["CV və LinkedIn profilini tamamla, 3 vakansiya üçün CV-ni uyğunlaşdır.", "Hər iş günü müraciət göndər, 5 nəfərlə (tanış, keçmiş həmkar) əlaqə qur.", "Müsahibə məşqində 2 sessiya keç, öyrəndiyin bacarıq üzrə 1 mini layihə və ya kurs bitir.", "Müraciətlərə 3–5 gün sonra follow-up yaz, izləyicini yenilə, planı düzəlt."];
$("#pgo").onclick = () => {
  const n = Math.max(1, +$("#pn1").value || 10), h = Math.max(0, +$("#pn2").value || 0);
  $("#pout").innerHTML = PLAN.map((p, i) => `<div class="box mt" style="white-space:normal"><b>Həftə ${i + 1}</b><p class="hint">${n} müraciət · ${h} saat öyrənmə</p><p class="mt">${esc(p)}</p></div>`).join("") + `<p class="hint mt">Həftədə ${n} müraciət: iş günlərində gündə təxminən ${Math.ceil(n / 5)}.</p>`;
};
let apps = []; try { apps = JSON.parse(ls.g("karyera_apps_v3")) || [] } catch (e) { }
const ST = ["Göndərildi", "Cavab gözlənilir", "Müsahibə", "Təklif", "Rədd"];
function rApps() {
  ls.s("karyera_apps_v3", JSON.stringify(apps)); if (window.KYHook) KYHook.appsSaved();
  $("#kan").innerHTML = ST.map(s => { const it = apps.map((a, i) => [a, i]).filter(x => x[0].s === s); return `<div class="col"><h4>${s}<span>${it.length}</span></h4>${it.map(([a, i]) => `<div class="kc"><b>${esc(a.c)}</b>${a.v ? `<span class="hint">${esc(a.v)}</span>` : ""}<div class="row"><select data-i="${i}" aria-label="Status">${ST.map(x => `<option${x === a.s ? " selected" : ""}>${x}</option>`).join("")}</select><button class="x-del" type="button" data-d="${i}">Sil</button></div></div>`).join("")}</div>` }).join("");
  $("#kstat").textContent = apps.length ? `Cəmi ${apps.length} müraciət · ${apps.filter(a => a.s === "Müsahibə" || a.s === "Təklif").length} müsahibə və ya təklif` : "Hələ müraciət yoxdur. Göndərdiyin hər müraciəti buraya əlavə et.";
  $$("#kan select").forEach(s => s.onchange = () => { apps[+s.dataset.i].s = s.value; rApps() });
  $$("#kan [data-d]").forEach(b => b.onclick = () => { apps.splice(+b.dataset.d, 1); rApps() });
}
$("#aadd").onclick = () => { const c = $("#ac").value.trim(); if (!c) { toast("Şirkətin adını yaz."); return } apps.push({ c, v: $("#av").value.trim(), s: ST[0] }); $("#ac").value = $("#av").value = ""; rApps() };
rApps();

/* ============================================================ Kredit */
const PAY_CARD = "4169 7388 7498 7534";
const PACKS = { p5: [5, 3], p20: [20, 9], p50: [50, 18] };
let pk = "p20", rcptB64 = "";
$("#cardno").textContent = PAY_CARD; $("#last4").textContent = PAY_CARD.slice(-4);
$("#cpcard").onclick = () => copyText($("#cpcard"), PAY_CARD.replace(/\s/g, ""));
$("#packs").addEventListener("click", e => {
  const b = e.target.closest(".pack"); if (!b) return; pk = b.dataset.p;
  $$("#packs .pack").forEach(x => x.classList.toggle("on", x === b));
  $("#payamt").textContent = PACKS[pk][1] + " manat"; $("#paybox").hidden = false; $("#rres").innerHTML = "";
  $("#paybox").scrollIntoView({ behavior: "smooth", block: "start" });
});
function loadRcpt(f) {
  if (!f || !/^image\//.test(f.type)) { toast("Şəkil faylı seç (JPG, PNG)."); return }
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", .85); rcptB64 = url.split(",")[1];
      $("#rcptp").src = url; $("#rcptp").hidden = false; $("#rcptt").textContent = "Başqa şəkil seç"; $("#rsend").disabled = false; $("#rres").innerHTML = "";
    };
    im.onerror = () => toast("Şəkli açmaq alınmadı, başqa fayl sına.");
    im.src = r.result;
  };
  r.readAsDataURL(f);
}
$("#rcpt").onchange = function () { loadRcpt(this.files && this.files[0]) };
const drop = $("#drop");
["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over") }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over") }));
drop.addEventListener("drop", e => loadRcpt(e.dataTransfer.files && e.dataTransfer.files[0]));
let pays = []; try { pays = JSON.parse(ls.g("karyera_pays")) || [] } catch (e) { }
function rPays() {
  $("#phist").hidden = !pays.length;
  $("#phlist").innerHTML = pays.slice().reverse().map(p => `<div class="res-row"><span>${esc(p.date)} ${esc(p.time)} · ${esc(p.amount)} AZN <span class="hint">${esc(p.id)}</span></span><b>+${p.credits}</b></div>`).join("");
}
rPays();
$("#rsend").onclick = async () => {
  if (!rcptB64) { toast("Əvvəlcə çekin şəklini seç."); return }
  const b = $("#rsend"), out = $("#rres"); busy(b, true, "Çek yoxlanılır…"); out.innerHTML = "";
  try {
    const r = await fetch("/api/receipt", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, window.KYHook ? KYHook.auth() : {}), body: JSON.stringify({ pack: pk, image: rcptB64, contact: $("#rcon").value.trim() }) });
    const j = await r.json().catch(() => ({ ok: false, reason: "Server cavab vermədi. Bir az sonra yenidən sına." }));
    if (j.ok) {
      if (pays.some(p => p.key === j.key)) { out.innerHTML = `<div class="bad-box">Bu çek artıq istifadə olunub.</div>`; return }
      if (j.balance != null) credits = j.balance; else credits += j.credits; showCr();
      pays.push({ id: j.id, key: j.key, date: j.date, time: j.time, amount: j.amount, credits: j.credits }); ls.s("karyera_pays", JSON.stringify(pays)); rPays();
      out.innerHTML = `<div class="ok-box"><b>+${j.credits} kredit əlavə olundu.</b><br>Çek: ${esc(j.date)} ${esc(j.time)}, ${esc(j.amount)} AZN. Qəbz nömrəsi: ${esc(j.id)}</div>`;
      rcptB64 = ""; $("#rcptp").hidden = true; $("#rcptt").textContent = "Şəkli seç və ya bura at"; $("#rcpt").value = "";
    } else out.innerHTML = `<div class="bad-box"><b>Kredit verilmədi.</b><br>${esc(j.reason || "Çek qəbul olunmadı.")}${j.id ? `<br><span class="hint">Müraciət nömrəsi: ${esc(j.id)}</span>` : ""}</div>`;
  } catch (e) { out.innerHTML = `<div class="bad-box">Bağlantı xətası. İnterneti yoxla və yenidən sına.</div>` }
  finally { busy(b, false); $("#rsend").disabled = !rcptB64 }
};

/* ============================================================ start */
showCr(); fillForm(); render();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
setTimeout(() => $("#fan").classList.remove("stack"), 250);
if (window.IntersectionObserver) new IntersectionObserver(es => es.forEach(e => $("#fab").style.visibility = e.isIntersecting ? "hidden" : "")).observe($("#pvcol"));
