/* KarYera AI — v3 agent qatı: İşlər, müraciət paketi, səslə profil, müsahibə dili, bacarıq tərcüməçisi, hesab */
"use strict";
(() => {
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) };
  const azDate = d => { if (!d) return ""; const t = Date.parse(d); if (isNaN(t)) return ""; const x = new Date(t); return x.getDate() + " " + ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"][x.getMonth()] };
  const words = s => String(s || "").toLocaleLowerCase("az").split(/[^a-zəöüçşğıi0-9+#]+/).filter(w => w.length > 2);
  const KY = { cfg: null, sb: null, user: null, token: "", t1: 0, t2: 0 };

  async function aiX(prompt, { file, max } = {}) {
    const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, file, max }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.text) throw new Error(j.error || ("ai " + r.status));
    const m = j.text.match(/[\[{][\s\S]*[\]}]/);
    return JSON.parse(m ? m[0] : j.text);
  }
  const toB64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob) });

  /* ======================= Hook-lar (app.js çağırır) ======================= */
  const mlang = () => ($("#mlang") || {}).value || "az";
  const catLang = cat => cat === "İngilis dilində" ? "en" : cat === "Rus dilində" ? "ru" : mlang();
  window.KYHook = {
    spend(n) {
      if (!(KY.sb && KY.user)) return;
      KY.sb.rpc("spend_credits", { n }).then(({ data, error }) => {
        if (!error && typeof data === "number") { credits = data; showCr() }
        else loadProfile(false);
      });
    },
    saved() { if (KY.sb && KY.user) { clearTimeout(KY.t1); KY.t1 = setTimeout(() => KY.sb.from("profiles").update({ data: S, updated_at: new Date().toISOString() }).eq("id", KY.user.id).then(() => { }), 1500) } },
    appsSaved() {
      if (KY.sb && KY.user) { clearTimeout(KY.t2); KY.t2 = setTimeout(() => KY.sb.from("profiles").update({ apps, updated_at: new Date().toISOString() }).eq("id", KY.user.id).then(() => { }), 1200) }
      followups();
    },
    auth() { return KY.token ? { Authorization: "Bearer " + KY.token } : {} },
    question() { }, // AI səslə oxuma çıxarıldı (brauzerlərdə Azərbaycan səsi yoxdur)
    srLang(cat) { return { az: "az-AZ", en: "en-US", ru: "ru-RU" }[catLang(cat)] },
    fbLang(cat) { return { az: "Azərbaycan dilində yaz", en: "ingilis dilində yaz", ru: "rus dilində yaz" }[catLang(cat)] },
    qLang() { return { az: "Sualları Azərbaycan dilində yaz.", en: "Sualları ingilis dilində yaz.", ru: "Sualları rus dilində yaz." }[mlang()] }
  };

  /* ======================= Müsahibə: dil ======================= */
  Q["Rus dilində"] = { t: "Отвечай 3–4 предложениями: ситуация, действие, результат (с цифрой).", q: ["Расскажите о себе.", "Почему вы хотите работать в нашей компании?", "Расскажите о сложной ситуации на работе и как вы её решили.", "Какие ваши сильные и слабые стороны?", "Где вы видите себя через 3 года?"] };
  $("#mtip").innerHTML = Object.keys(Q).map(k => `<option>${esc(k)}</option>`).join("");
  mprev();
  $("#mlang").onchange = () => {
    const l = mlang(), cur = $("#mtip").value;
    if (cur !== AIQ && !String(cur).startsWith("Bu vakansiya")) $("#mtip").value = l === "en" ? "İngilis dilində" : l === "ru" ? "Rus dilində" : (cur === "İngilis dilində" || cur === "Rus dilində" ? "HR müsahibəsi" : cur);
    mprev();
  };
  /* ======================= İşlər ======================= */
  let jobs = [], jmode = "az", lastSrc = [];
  const cvSet = () => new Set(words([S.d.vez, S.d.bac, S.d.hq, ...S.d.exps.map(e => e.v + " " + e.t), ...S.d.edu.map(e => e.m)].join(" ")));
  function match(it) {
    if (isEmpty(S.d)) return null;
    const cv = cvSet(), tw = words(it.title), body = words(it.title + " " + (it.text || "") + " " + (it.company || ""));
    const role = words(S.d.vez), sk = list(S.d.bac).map(s => s.toLocaleLowerCase("az"));
    let p = 18;
    if (role.some(r => tw.some(t => t.startsWith(r.slice(0, 5))))) p += 38;
    p += Math.min(30, tw.filter(t => cv.has(t)).length * 8);
    p += Math.min(16, sk.filter(s => body.join(" ").includes(s.slice(0, 6))).length * 4);
    return Math.min(96, p);
  }
  const ringCol = p => p == null ? "var(--line)" : p >= 65 ? "var(--ok)" : p >= 40 ? "var(--saf)" : "var(--nar)";
  const ring = p => `<div class="ring" style="--p:${p ?? 0};--rc:${ringCol(p)}" title="CV-nə uyğunluq (təxmini)"><span>${p == null ? "?" : p + "%"}</span></div>`;

  function renderJobs() {
    const box = $("#jlist");
    const ok = lastSrc.filter(s => s.ok && s.count), bad = lastSrc.filter(s => !s.ok);
    $("#jsrc").textContent = lastSrc.length ? "Mənbələr: " + (ok.map(s => s.name + " " + s.count).join(", ") || "heç biri cavab vermədi") + (bad.length ? ". Açılmadı: " + bad.map(s => s.name).join(", ") : "") : "";
    if (!jobs.length) {
      box.innerHTML = lastSrc.length ? `<div class="jl"><div class="jempty">Bu axtarışa uyğun elan tapılmadı. Başqa söz yaz və ya «Elanın linkini əlavə et» ilə istənilən saytdan elan gətir.</div></div>` : "";
      return;
    }
    const rows = jobs.map((it, i) => `<div class="jrow">${ring(it.m)}<div><h4><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h4><div class="jmeta">${it.company ? `<span>${esc(it.company)}</span>` : ""}<span>${esc(it.source)}</span>${it.location ? `<span>${esc(it.location)}</span>` : it.city === "region" ? "<span>Region</span>" : ""}${azDate(it.date) ? `<span>${azDate(it.date)}</span>` : ""}${it.remote && it.eligible ? `<span class="el-${it.eligible === "yes" ? "yes" : "check"}">${it.eligible === "yes" ? "Azərbaycandan müraciət olar" : "Ölkə şərtini yoxla"}</span>` : ""}</div></div><div class="jact"><button class="btn sm" type="button" data-pk="${i}">Müraciət paketi <span class="cost">2</span></button><button class="btn ghost sm" type="button" data-ap="${i}">Müraciət etdim</button></div></div>`).join("");
    const cn = (CATL.find(c => c[0] === jcat) || [, ""])[1];
    box.innerHTML = `<div class="jhead"><b>${jobs.length} elan${cn && jcat !== "yeni" ? " · " + esc(cn) : ""}${isEmpty(S.d) ? ", ən yenilər əvvəl" : ", uyğunluğa görə"}</b><span class="hint">${feedAt && jmode !== "remote" ? "Baza yeniləndi: " + esc(feedAt) + ". " : ""}${isEmpty(S.d) ? "Uyğunluq faizi üçün CV-ni doldur." : "Faiz təxminidir; dəqiq faiz müraciət paketində."}</span></div><div class="jl">${rows}</div>`;
  }
  const CATL = [["yeni", "Ən yeni"], ["satis", "Satış"], ["marketinq", "Marketinq / SMM"], ["it", "IT"], ["maliyye", "Maliyyə / Mühasibat"], ["musteri", "Müştəri xidməti"], ["hr", "HR"], ["dizayn", "Dizayn"], ["logistika", "Logistika"], ["tehsil", "Təhsil"], ["tibb", "Tibb"], ["turizm", "Turizm / Otel"], ["tikinti", "Tikinti / Mühəndislik"], ["tecrube", "Təcrübə proqramı"]];
  let jcat = "", feed = null, feedAt = "";
  $("#jcats").innerHTML = CATL.map(([k, n]) => `<button type="button" data-cat="${k}" aria-pressed="false">${esc(n)}</button>`).join("");
  $("#jcats").addEventListener("click", e => {
    const b = e.target.closest("button[data-cat]"); if (!b) return;
    jcat = jcat === b.dataset.cat ? "" : b.dataset.cat;
    $$("#jcats button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.cat === jcat)));
    if (jcat) $("#jq").value = "";
    loadJobs();
  });
  async function getFeed() {
    if (feed) return feed;
    try { const r = await fetch("/data/jobs.json", { cache: "no-cache" }); if (r.ok) feed = await r.json() } catch (e) { }
    if (feed && feed.updated) { const d = new Date(feed.updated); feedAt = (d.toDateString() === new Date().toDateString() ? "bu gün " : azDate(feed.updated) + ", ") + d.toLocaleTimeString("az", { hour: "2-digit", minute: "2-digit" }) }
    return feed;
  }
  async function loadJobs() {
    const q = $("#jq").value.trim(), b = $("#jgo"), remote = jmode === "remote";
    if (q && jcat) { jcat = ""; $$("#jcats button").forEach(x => x.setAttribute("aria-pressed", "false")) }
    busy(b, true, "Axtarılır…");
    $("#jlist").innerHTML = `<div class="jl">${"<div class='sk'></div>".repeat(4)}</div>`;
    let items = [], src = {};
    const add = (arr, live) => arr.forEach(it => { if (!it.url || items.some(x => x.url === it.url)) return; items.push(it); const s = src[it.source] || (src[it.source] = { name: it.source, ok: true, count: 0, live }); s.count++ });
    if (!remote) {
      const f = await getFeed();
      if (f && Array.isArray(f.jobs)) {
        const toks = words(q);
        add(f.jobs.filter(j => !j.remote && (!jcat || jcat === "yeni" || j.cat === jcat) && (!toks.length || toks.some(t => words(j.title + " " + j.company).some(w => w.startsWith(t.slice(0, 5)))))).map(j => ({ ...j })), false);
      }
    }
    let liveSrc = [];
    if (remote || (q && items.length < 8) || (!items.length && !feed)) {
      try {
        const r = await fetch("/api/jobs?" + (jcat && jcat !== "yeni" ? "cat=" + jcat : "q=" + encodeURIComponent(q)) + (remote ? "&remote=1" : ""));
        const j = await r.json(); liveSrc = j.sources || []; add(j.items || [], true);
      } catch (e) { if (!items.length) { $("#jlist").innerHTML = `<div class="bad-box">Elanları yükləmək alınmadı. İnterneti yoxla və yenidən sına.</div>`; busy(b, false); return } }
    }
    lastSrc = Object.values(src).concat(liveSrc.filter(s => !s.ok));
    const hasCv = !isEmpty(S.d);
    jobs = items.map(it => Object.assign(it, { m: match(it) })).sort((a, b) => (hasCv ? (b.m ?? -1) - (a.m ?? -1) : 0) || (Date.parse(b.date || b.first_seen || 0) || 0) - (Date.parse(a.date || a.first_seen || 0) || 0));
    busy(b, false); renderJobs();
    if (KY.sb && KY.user) KY.sb.from("profiles").update({ job_query: q || (CATL.find(c => c[0] === jcat) || [, ""])[1], job_remote: remote }).eq("id", KY.user.id).then(() => { });
  }
  $("#jform").addEventListener("submit", loadJobs);
  $("#jmode").addEventListener("click", e => {
    const b = e.target.closest("button[data-m]"); if (!b) return;
    jmode = b.dataset.m; $$("#jmode button").forEach(x => x.classList.toggle("on", x === b));
    $("#jremote").hidden = jmode !== "remote"; loadJobs();
  });
  $("#jen").onclick = async () => { const b = $("#jen"); if (await translate(b)) toast("CV ingiliscədir. Paketlər xarici elanlar üçün ingiliscə hazırlanacaq.") };
  $("#jats").onclick = () => { S.tp = "ats"; save(); render(); toast("ATS (sadə) şablonu seçildi: xarici şirkətlərin sistemi onu asan oxuyur.") };
  $("#jlist").addEventListener("click", e => {
    const p = e.target.closest("[data-pk]"), a = e.target.closest("[data-ap]");
    if (p) openPkg(jobs[+p.dataset.pk]);
    if (a) markApplied(jobs[+a.dataset.ap]);
  });
  $("#jadd").onclick = () => { $("#jpaste").hidden = !$("#jpaste").hidden; if (!$("#jpaste").hidden) $("#jurl").focus() };
  $("#jpx").onclick = () => $("#jpaste").hidden = true;
  $("#jpgo").onclick = () => {
    const url = $("#jurl").value.trim(), txt = $("#jtxt").value.trim();
    if (!url && txt.length < 60) { toast("Elanın linkini və ya mətnini yapışdır."); return }
    openPkg({ title: "", company: "", url, text: txt, source: url ? (() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch (e) { return "Link" } })() : "Əlavə etdiyin elan" });
  };

  /* --- treker və follow-up --- */
  function markApplied(it, silent) {
    const c = it.company || it.source || "Şirkət", v = it.title || "";
    if (apps.some(a => a.url && a.url === it.url)) { if (!silent) toast("Bu elan artıq trekerdədir."); return }
    apps.push({ c, v, s: ST[0], url: it.url || "", at: today(), fu: addDays(today(), 5) }); rApps();
    if (!silent) toast("Trekerə əlavə olundu. 5 gün sonra follow-up xatırladacağam.");
  }
  function followups() {
    const box = $("#jfollow"); if (!box) return;
    const due = apps.map((a, i) => [a, i]).filter(([a]) => a.fu && a.fu <= today() && (a.s === ST[0] || a.s === ST[1]));
    if (!due.length) { box.hidden = true; return }
    const [a, i] = due[0];
    box.hidden = false;
    box.innerHTML = `<b>Follow-up vaxtıdır:</b> ${esc(a.c)}${a.v ? ", " + esc(a.v) : ""}. ${a.at ? azDate(a.at) + " müraciət etmisən, cavab yoxdur." : ""}${due.length > 1 ? ` Daha ${due.length - 1} müraciət gözləyir.` : ""}<div class="row mt"><button class="btn sm" type="button" id="fuw">Follow-up məktubu yaz</button><button class="btn ghost sm" type="button" id="fus">3 gün sonra xatırlat</button></div>`;
    $("#fuw").onclick = () => { lt.type = "fu"; pickers(); $("#lc").value = a.c; $("#lp").value = a.v || S.d.vez; $("#lnote2").value = a.at ? azDate(a.at) + " tarixində müraciət etmişəm." : ""; a.fu = addDays(today(), 5); rApps(); tab("let") };
    $("#fus").onclick = () => { apps[i].fu = addDays(today(), 3); rApps() };
  }

  /* --- müraciət paketi --- */
  const dlgP = $("#pdlg");
  async function openPkg(it) {
    if (isEmpty(S.d)) { toast("Əvvəlcə CV-ni doldur: paket CV-nə görə hazırlanır."); tab("cv"); return }
    $("#pbody").innerHTML = `<h3 id="pdlg-h">${esc(it.title || "Müraciət paketi")}</h3><p class="muted">${esc([it.company, it.source].filter(Boolean).join(", "))}</p><div class="mt">${"<div class='sk' style='border-radius:10px;margin-top:8px'></div>".repeat(3)}</div><p class="hint mt" id="pstat">Elan oxunur…</p>`;
    dlgP.showModal();
    let text = it.text || "";
    if (text.length < 200 && it.url) {
      try {
        const r = await fetch("/api/fetch?url=" + encodeURIComponent(it.url)), j = await r.json();
        if (j.ok) { text = j.text; it.title = it.title || j.title; it.company = it.company || j.company }
      } catch (e) { }
    }
    if (text.length < 120 && (it.title || "").length) text = (it.title + ". " + (it.company || "") + ". " + text).trim();
    if (text.length < 60) {
      $("#pbody").innerHTML = `<h3>Elan mətni lazımdır</h3><p class="muted">Saytdan mətni oxumaq alınmadı. Elanı açıb mətni kopyala və bura yapışdır.</p><textarea id="ptx" style="min-height:140px;width:100%" class="mt"></textarea><div class="row mt"><button class="btn" id="ptgo" type="button">Paketi hazırla <span class="cost">2 kredit</span></button>${it.url ? `<a class="btn ghost" href="${esc(it.url)}" target="_blank" rel="noopener">Elanı aç</a>` : ""}</div>`;
      $("#ptgo").onclick = () => { const t = $("#ptx").value.trim(); if (t.length < 60) { toast("Elanın tam mətnini yapışdır."); return } it.text = t; openPkg(it) };
      return;
    }
    if (!need(2)) { dlgP.close(); return }
    $("#pstat").textContent = "AI paketi hazırlayır: uyğunluq, məktub, email, suallar…";
    const remote = !!it.remote || jmode === "remote";
    let P;
    try {
      P = await aiX(`Sən Azərbaycanda işə qəbul üzrə təcrübəli karyera məsləhətçisisən. Namizədin CV məlumatı və vakansiya elanı verilib. YALNIZ JSON qaytar:
{"match": 0-100 arası tam ədəd (namizədin bu elana real uyğunluğu, şişirtmə),
 "title": "vakansiyanın adı", "company": "şirkət adı və ya boş",
 "why": ["namizədin uyğun olduğu 3 konkret səbəb, CV faktlarına əsaslan"],
 "gaps": ["çatışmayan 2-3 tələb və hər birini müraciətdə necə kompensasiya etmək"],
 "summary": "bu vakansiya üçün CV-nin «Haqqında» bölməsi, 2-3 cümlə, «Mən» ilə başlama",
 "skills": ["namizədin CV-də olan və bu elana uyğun bacarıqları, ən vacibi əvvəl, ən çox 8"],
 "letter": "müraciət məktubu, 120-170 söz, müraciət sözü ilə başla, imza: ${(S.d.ad || "Ad Soyad").replace(/"/g, "")}",
 "email": {"subject": "email mövzusu", "body": "qısa email mətni, 50-80 söz, CV-nin əlavədə olduğunu qeyd et, imza ilə bitir"},
 "questions": ["bu elan üçün ehtimal olunan 5 müsahibə sualı"]${remote ? `,
 "eligible": "yes" | "no" | "unclear" (elan Azərbaycanda yaşayan namizədin müraciətinə açıqdırmı: ölkə/saat qurşağı/iş icazəsi şərtlərinə bax),
 "eligible_reason": "bir cümlə, Azərbaycan dilində"` : ""}}
Dil qaydası: elan ingiliscədirsə summary, letter, email və questions ingiliscə, rus dilindədirsə rusca, əks halda Azərbaycan dilində yazılsın. why, gaps və eligible_reason həmişə Azərbaycan dilində.
Yalnız CV-dəki faktlardan istifadə et: təcrübə, rəqəm, bacarıq uydurma.
Namizəd: ${JSON.stringify(cvBrief(S.d))}
Vakansiya: ${JSON.stringify({ basliq: it.title, sirket: it.company, metn: text.slice(0, 5000) })}`, { max: 3200 });
      if (!P || !P.letter || !Array.isArray(P.questions)) throw new Error("format");
    } catch (e) {
      $("#pbody").innerHTML = `<h3>Paket hazırlanmadı</h3><p class="muted">AI cavab vermədi, kredit tutulmadı. Bir az sonra yenidən sına.</p>`;
      return;
    }
    spend(2);
    it.title = it.title || P.title || "Vakansiya"; it.company = it.company || P.company || "";
    renderPkg(it, P, text);
  }
  function renderPkg(it, P, text) {
    const m = Math.max(0, Math.min(100, Math.round(+P.match || 0)));
    const em = (String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
    const li = a => (Array.isArray(a) ? a : []).map(x => `<li>${esc(x)}</li>`).join("");
    const el = P.eligible ? `<div class="pk-sec full"><h4>Azərbaycandan müraciət</h4><p class="${P.eligible === "yes" ? "ok-box" : P.eligible === "no" ? "bad-box" : "msg"}" style="margin:0">${P.eligible === "yes" ? "Açıqdır." : P.eligible === "no" ? "Açıq deyil." : "Aydın deyil."} ${esc(P.eligible_reason || "")}</p></div>` : "";
    $("#pbody").innerHTML = `<div class="pk-h">${ring(m)}<div><h3 id="pdlg-h">${esc(it.title)}</h3><p class="muted">${esc([it.company, it.source].filter(Boolean).join(", "))}</p></div></div>
    <div class="pk-grid">
      ${el}
      <div class="pk-sec"><h4>Niyə uyğunsan</h4><ul>${li(P.why)}</ul></div>
      <div class="pk-sec"><h4>Nə çatmır və necə kompensasiya etmək</h4><ul>${li(P.gaps)}</ul></div>
      <div class="pk-sec full"><h4>Bu elan üçün «Haqqında»</h4><p class="txt">${esc(P.summary)}</p><div class="row mt"><button class="btn ghost sm" id="pk-hq" type="button">CV-yə tətbiq et</button>${Array.isArray(P.skills) && P.skills.length ? `<button class="btn ghost sm" id="pk-sk" type="button">Bacarıqları elana görə sırala</button>` : ""}</div></div>
      <div class="pk-sec full"><h4>Müraciət məktubu</h4><p class="txt">${esc(P.letter)}</p><div class="row mt"><button class="btn ghost sm" id="pk-lt" type="button">Məktub bölməsində aç (PDF)</button><button class="btn ghost sm" id="pk-lc" type="button">Kopyala</button></div></div>
      <div class="pk-sec"><h4>Email</h4><p class="txt"><b>${esc((P.email || {}).subject)}</b>\n\n${esc((P.email || {}).body)}</p><button class="btn ghost sm mt" id="pk-em" type="button">Kopyala</button></div>
      <div class="pk-sec"><h4>Ehtimal olunan suallar</h4><ol>${li(P.questions)}</ol><button class="btn ghost sm mt" id="pk-mq" type="button">Bu suallarla məşq et</button></div>
    </div>
    <div class="pk-foot">${em ? `<button class="btn ghost" id="pk-pdf" type="button">1. CV-ni PDF yüklə</button><a class="btn" id="pk-mail" href="mailto:${esc(em)}?subject=${encodeURIComponent((P.email || {}).subject || it.title)}&body=${encodeURIComponent((P.email || {}).body || "")}">2. Email ilə müraciət et</a>` : ""}${it.url ? `<a class="btn ${em ? "ghost" : ""}" href="${esc(it.url)}" target="_blank" rel="noopener" id="pk-open">${em ? "Elanı aç" : "Elanı aç və müraciət et"}</a>` : ""}<button class="btn ghost" id="pk-ap" type="button">Müraciət etdim</button></div>
    <p class="hint mt">${em ? "Elanda email var: " + esc(em) + ". Email proqramı açılanda yüklədiyin CV PDF-ni əlavə et. " : "Müraciət iş saytında edilir. "}AI yazdı: faktları yoxla, sonra göndər.</p>`;
    $("#pk-hq").onclick = () => { S.d.hq = P.summary; save(); fillForm(); render(); toast("«Haqqında» bu elana uyğunlaşdırıldı.") };
    const sk = $("#pk-sk"); if (sk) sk.onclick = () => {
      const cur = list(S.d.bac), pri = cur.filter(s => P.skills.some(k => s.toLocaleLowerCase("az").includes(String(k).toLocaleLowerCase("az").slice(0, 5)) || String(k).toLocaleLowerCase("az").includes(s.toLocaleLowerCase("az").slice(0, 5))));
      S.d.bac = pri.concat(cur.filter(s => !pri.includes(s))).join(", "); save(); fillForm(); render(); toast("Bacarıqlar elana görə sıralandı.");
    };
    $("#pk-lt").onclick = () => { lt.type = "app"; pickers(); lt.text = P.letter; $("#lc").value = it.company || ""; $("#lp").value = it.title || ""; dlgP.close(); tab("let"); showLetter() };
    $("#pk-lc").onclick = () => copyText($("#pk-lc"), P.letter);
    $("#pk-em").onclick = () => copyText($("#pk-em"), ((P.email || {}).subject || "") + "\n\n" + ((P.email || {}).body || ""));
    $("#pk-mq").onclick = () => {
      const k = "Bu vakansiya: " + String(it.title).slice(0, 40);
      Q[k] = { t: "Hər cavabda elandakı bir tələbi öz nümunənlə bağla: situasiya, hərəkət, nəticə (rəqəmlə).", q: P.questions.slice(0, 5).map(String) };
      while (Q[k].q.length < 5) Q[k].q.push(Q["HR müsahibəsi"].q[Q[k].q.length]);
      $("#mtip").innerHTML = Object.keys(Q).map(x => `<option>${esc(x)}</option>`).join(""); $("#mtip").value = k; mprev();
      dlgP.close(); tab("mus");
    };
    $("#pk-ap").onclick = () => { markApplied(it); dlgP.close() };
    const pdfB = $("#pk-pdf"); if (pdfB) pdfB.onclick = () => $("#dl").click();
    const mailB = $("#pk-mail"); if (mailB) mailB.addEventListener("click", () => markApplied(it, true));
  }

  /* ======================= Səslə profil və köhnə CV ======================= */
  const PROFILE_JSON = `YALNIZ JSON qaytar: {"ad":"","vez":"hədəf vəzifə","tel":"","em":"","seh":"şəhər","link":"","hq":"2-3 cümləlik peşəkar «Haqqında», «Mən» ilə başlama","exps":[{"v":"vəzifə","s":"şirkət","m":"məs. 2021 – 2023 və ya 2022 – indi","t":"nə etdi, nəticələr; cümlələr nöqtə ilə ayrılsın"}],"edu":[{"i":"universitet/məktəb","m":"ixtisas, dərəcə","y":"illər"}],"bac":"bacarıqlar vergüllə","dil":"dillər və səviyyə","ser":"kurs və sertifikatlar"}. Deyilməyən və ya görünməyən sahəni boş string yaz. Fakt, rəqəm və tarix uydurma. Mətn Azərbaycan dilində olsun (şirkət və proqram adları olduğu kimi).`;
  function applyProfile(j) {
    if (!j || typeof j !== "object") throw new Error("format");
    const d = blank();
    ["ad", "vez", "tel", "em", "seh", "link", "hq", "bac", "dil", "ser"].forEach(k => { if (typeof j[k] === "string") d[k] = j[k].trim() });
    if (Array.isArray(j.exps) && j.exps.length) d.exps = j.exps.slice(0, 5).map(e => ({ v: String(e.v || ""), s: String(e.s || ""), m: String(e.m || ""), t: String(e.t || "") }));
    if (Array.isArray(j.edu) && j.edu.length) d.edu = j.edu.slice(0, 3).map(e => ({ i: String(e.i || ""), m: String(e.m || ""), y: String(e.y || "") }));
    if (isEmpty(d)) throw new Error("bos");
    d.photo = S.d.photo; S.d = d; S.en = null; S.enSrc = ""; S.lang = "az"; S.paid = false;
    save(); fillForm(); render();
  }
  const dlgV = $("#vdlg"); let rec = null, chunks = [], recBlob = null, recT = 0, recStart = 0;
  const MAXS = 180;
  $("#vprof").onclick = () => {
    if (!(navigator.mediaDevices && window.MediaRecorder)) { toast("Bu brauzerdə səs yazmaq işləmir. «Köhnə CV-ni yüklə» seçimini sına."); return }
    recBlob = null; $("#vsend").disabled = true; $("#vstat").textContent = "Başlamaq üçün dairəyə bas"; $("#vtime").textContent = "0:00 / 3:00"; $("#vnote").textContent = "";
    dlgV.showModal();
  };
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function stopRec() { if (rec && rec.state === "recording") rec.stop(); clearInterval(recT); $("#vrec").setAttribute("aria-pressed", "false") }
  $("#vrec").onclick = async () => {
    if (rec && rec.state === "recording") { stopRec(); return }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
      rec = new MediaRecorder(st, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = () => { st.getTracks().forEach(t => t.stop()); recBlob = new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] }); $("#vstat").textContent = "Yazı hazırdır: " + fmt((Date.now() - recStart) / 1000) + ". Yenidən yazmaq üçün dairəyə bas."; $("#vsend").disabled = false };
      rec.start(1000); recStart = Date.now(); $("#vrec").setAttribute("aria-pressed", "true"); $("#vstat").textContent = "Dinləyirəm… bitirəndə dairəyə bas"; $("#vsend").disabled = true;
      recT = setInterval(() => { const s = (Date.now() - recStart) / 1000; $("#vtime").textContent = fmt(s) + " / 3:00"; if (s >= MAXS) stopRec() }, 500);
    } catch (e) { $("#vstat").textContent = "Mikrofona icazə verilmədi. Brauzerin ünvan sətrindən mikrofonu aç."; }
  };
  dlgV.addEventListener("close", stopRec);
  async function profileFromFile(blob, mime, kind, btn) {
    if (!isEmpty(S.d) && !confirm("CV formasındakı məlumat yenisi ilə əvəz olunsun?")) return;
    if (!need(2)) { dlgV.open && dlgV.close(); return }
    busy(btn, true, kind === "audio" ? "Dinlənilir…" : "Oxunur…");
    try {
      const data = await toB64(blob);
      if (data.length > 4_000_000) throw new Error("boyuk");
      const j = await aiX((kind === "audio" ? "Bu səs yazısında namizəd özü haqqında danışır (Azərbaycan dilində, bəzən rus və ya ingilis sözləri ilə). Danışılanları CV məlumatına çevir. " : "Bu fayl namizədin köhnə CV-sidir. Ondan bütün məlumatı çıxar. ") + PROFILE_JSON, { file: { mime, data }, max: 3000 });
      applyProfile(j); spend(2);
      if (dlgV.open) dlgV.close();
      tab("cv"); toast("CV forması dolduruldu. Hər sahəni yoxla, sonra şablon seç.", 6000);
    } catch (e) {
      const msg = String(e && e.message) === "boyuk" ? "Fayl çox böyükdür (maksimum ~3 MB)." : "Məlumatı çıxarmaq alınmadı, kredit tutulmadı. Daha aydın səs və ya fayl sına.";
      if (dlgV.open) $("#vnote").textContent = msg; else toast(msg);
    } finally { busy(btn, false) }
  }
  $("#vsend").onclick = () => recBlob && profileFromFile(recBlob, recBlob.type || "audio/webm", "audio", $("#vsend"));
  $("#oldcv").onclick = () => $("#oldf").click();
  $("#oldf").onchange = async function () {
    const f = this.files && this.files[0]; this.value = ""; if (!f) return;
    if (f.type === "application/pdf") { if (f.size > 2_900_000) { toast("PDF çox böyükdür (maksimum ~3 MB)."); return } return profileFromFile(f, "application/pdf", "file", $("#oldcv")) }
    if (!/^image\//.test(f.type)) { toast("PDF və ya şəkil faylı seç."); return }
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => profileFromFile(b, "image/jpeg", "file", $("#oldcv")), "image/jpeg", .88);
    };
    im.onerror = () => toast("Şəkli açmaq alınmadı.");
    im.src = url;
  };

  /* ======================= Bacarıq tərcüməçisi ======================= */
  $("#stgo").onclick = async () => {
    if (isEmpty(S.d) && !$("#stin").value.trim()) { toast("CV-ni doldur və ya ixtisasını yaz."); return }
    if (!need(1)) return;
    const b = $("#stgo"); busy(b, true, "AI düşünür…");
    try {
      const j = await aiX(`Sən Azərbaycan əmək bazarını yaxşı bilən karyera məsləhətçisisən. Namizədin ixtisası üzrə iş tapmaq çətin ola bilər (məsələn, humanitar ixtisas). Onun bacarıqlarının köçürülə biləcəyi, Azərbaycanda real tələbatı olan 3 peşə tap. YALNIZ JSON qaytar:
{"roles":[{"name":"peşə adı","why":"niyə bu namizədə uyğundur, 1-2 cümlə","transfer":["CV-dəki köçürülə bilən 2-4 bacarıq"],"gaps":["öyrənməli olduğu 2-3 şey"],"search":"iş saytlarında axtarış üçün 1-3 sözlük açar söz","weeks":["Həftə 1: ...","Həftə 2: ...","Həftə 3: ...","Həftə 4: ..."]}]}
Həftəlik planda yalnız pulsuz resurs növlərinin və platformaların adını yaz (məs. Coursera-da pulsuz dinləmə rejimi, Google Digital Garage, YouTube), link yazma. Faktları uydurma. Dil: Azərbaycan.
Namizəd: ${JSON.stringify(cvBrief(S.d))}
Özü haqqında əlavə: ${$("#stin").value.trim().slice(0, 300) || "-"}`, { max: 2600 });
      if (!j || !Array.isArray(j.roles) || !j.roles.length) throw new Error("format");
      spend(1);
      $("#stout").innerHTML = j.roles.slice(0, 3).map((r, i) => `<div class="st-role"><h4>${esc(r.name)}</h4><p class="mt" style="margin-top:6px">${esc(r.why)}</p><p class="hint mt"><b>Səndə var:</b> ${esc((r.transfer || []).join(", "))}</p><p class="hint"><b>Öyrən:</b> ${esc((r.gaps || []).join(", "))}</p><div class="st-weeks">${(r.weeks || []).slice(0, 4).map(w => `<div>${esc(w)}</div>`).join("")}</div><button class="btn ghost sm mt" type="button" data-st="${i}">Bu peşə üzrə iş axtar</button></div>`).join("") + `<p class="hint mt">AI təklifidir: real elanlarla yoxla.</p>`;
      $$("#stout [data-st]").forEach(x => x.onclick = () => { const r = j.roles[+x.dataset.st]; $("#jq").value = r.search || r.name; tab("job"); loadJobs() });
    } catch (e) { toast("AI cavab vermədi, kredit tutulmadı.") }
    busy(b, false);
  };

  /* ======================= Hesab (Supabase, qoşulubsa) ======================= */
  const SB_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  async function loadProfile(merge) {
    if (!(KY.sb && KY.user)) return;
    const { data: p, error } = await KY.sb.from("profiles").select("credits,data,apps").eq("id", KY.user.id).single();
    if (error || !p) return;
    credits = p.credits; showCr();
    if (!merge) return;
    if (p.data && p.data.d) { Object.assign(S, p.data); ls.s("karyera_v4", JSON.stringify(S)); fillForm(); render() }
    else if (!isEmpty(S.d)) window.KYHook.saved();
    if (Array.isArray(p.apps)) { apps.length = 0; p.apps.forEach(a => apps.push(a)); rApps() }
    else if (apps.length) window.KYHook.appsSaved();
  }
  function authUi() {
    const a = $("#acct"); a.hidden = false;
    a.textContent = KY.user ? (KY.user.email || "Hesab").split("@")[0] : "Daxil ol";
    a.title = KY.user ? "Hesabdan çıx" : "Hesaba daxil ol";
    $("#fcred").textContent = KY.user ? "Kredit, CV və müraciətlərin hesabında saxlanır." : "Kredit bu brauzerdə saxlanır. Bütün cihazlarda saxlamaq üçün hesaba daxil ol.";
    $("#jtg").hidden = !(KY.user && KY.cfg.tgBot);
  }
  async function initAuth() {
    try { KY.cfg = await (await fetch("/api/config")).json() } catch (e) { return }
    if (!KY.cfg || !KY.cfg.auth) return;
    try { if (!window.supabase) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = SB_JS; s.onload = ok; s.onerror = no; document.head.appendChild(s) }) } catch (e) { return }
    KY.sb = window.supabase.createClient(KY.cfg.supabaseUrl, KY.cfg.supabaseAnon);
    const { data } = await KY.sb.auth.getSession();
    const setS = async (sess, merge) => { KY.user = sess ? sess.user : null; KY.token = sess ? sess.access_token : ""; authUi(); if (KY.user) await loadProfile(merge) };
    await setS(data.session, true);
    KY.sb.auth.onAuthStateChange((ev, sess) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "TOKEN_REFRESHED") setS(sess, ev === "SIGNED_IN") });
    $("#acct").onclick = async () => {
      if (KY.user) { if (confirm("Hesabdan çıxılsın?")) { await KY.sb.auth.signOut(); toast("Hesabdan çıxdın.") } return }
      $("#abody").innerHTML = `<label class="mt">Email<input id="aem" type="email" autocomplete="email" placeholder="ad@mail.com"></label><button class="btn wide mt" id="ago" type="button">Giriş linkini göndər</button>`;
      $("#ago").onclick = async () => {
        const em = $("#aem").value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { toast("Email ünvanını düzgün yaz."); return }
        busy($("#ago"), true, "Göndərilir…");
        const { error } = await KY.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin } });
        busy($("#ago"), false);
        $("#abody").innerHTML = error ? `<div class="bad-box mt">Link göndərilmədi: ${esc(error.message)}</div>` : `<div class="ok-box mt">Link ${esc(em)} ünvanına göndərildi. Emailindəki linkə bas, bu səhifəyə daxil olmuş halda qayıdacaqsan.</div>`;
      };
      $("#adlg").showModal();
    };
    $("#jtg").onclick = async () => {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => (x % 36).toString(36)).join("");
      const { error } = await KY.sb.from("tg_links").insert({ code, user_id: KY.user.id });
      if (error) { toast("Telegram bağlantısı yaradılmadı. Bir az sonra yenidən sına."); return }
      KY.sb.from("profiles").update({ job_query: $("#jq").value.trim() || S.d.vez, job_remote: jmode === "remote" }).eq("id", KY.user.id).then(() => { });
      const a = document.createElement("a"); a.href = "https://t.me/" + KY.cfg.tgBot + "?start=" + code; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    };
  }

  /* ======================= start ======================= */
  if (!$("#jq").value) $("#jq").value = S.d.vez || "";
  followups();
  const h = location.hash.slice(1);
  const autoJobs = () => { if (!$("#jq").value.trim() && !jcat) { if (S.d.vez) $("#jq").value = S.d.vez; else { jcat = "yeni"; $$("#jcats button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.cat === "yeni"))) } } if (!lastSrc.length && !jobs.length) loadJobs() };
  $$('.tabs button[data-t="job"], [data-go="job"]').forEach(x => x.addEventListener("click", autoJobs));
  if (TABS.includes(h)) tab(h); else tab("home");
  if (!$("#job").hidden) autoJobs();
  window.addEventListener("hashchange", () => { const x = location.hash.slice(1); if (TABS.includes(x)) tab(x) });
  initAuth();
})();
