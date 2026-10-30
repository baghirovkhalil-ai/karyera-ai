/* KarYera — ana səhifə və interfeys köməkçiləri (app.js və agent.js-dən sonra yüklənir) */
(() => {
  const SHOW = ["noir", "lux", "signature", "poster", "studio", "gradient"];
  let feedCount = null;

  function cvPower() {
    const t = ($("#score") || {}).textContent || "", m = t.match(/(\d+)%/);
    return m ? +m[1] : 0;
  }
  function renderHome() {
    const d = S.d, first = (d.ad || "").trim().split(/\s+/)[0];
    const p = isEmpty(d) ? 0 : cvPower(), n = (typeof apps !== "undefined" ? apps : []).length;
    $("#heb").textContent = first ? `Salam, ${first} · CV gücün ${p}%` : "AI karyera köməkçisi · Azərbaycan dilində";
    const stat = (k, v, s, go, extra = "") => `<button type="button" class="stat" data-go="${go}"><span class="lab">${k}</span><b>${v}</b><span class="ss">${s}</span>${extra}</button>`;
    $("#hstats").innerHTML =
      stat("CV gücü", p + "%", p ? (p >= 80 ? "Güclü CV" : "Gücləndirmək olar") : "Hələ başlamamısan", "cv", `<span class="sbar"><i style="width:${p}%"></i></span>`) +
      stat("Aktiv elan", feedCount == null ? "…" : feedCount, "Bu gün yenilənib", "job") +
      stat("Müraciətlər", n, n ? "İzləyicidə" : "Hələ müraciət yoxdur", "car") +
      stat("Kredit", credits, "Balans", "buy");
    $$("#hstats [data-go]").forEach(b => b.onclick = () => { const n = document.querySelector(`.tabs button[data-t="${b.dataset.go}"]`); n ? n.click() : tab(b.dataset.go); if (b.dataset.go === "car") openTracker() });
    const data = view();
    $("#hshow").innerHTML = SHOW.map(id => { const t = TPL.find(x => x[0] === id); return t ? `<button type="button" class="hs" data-tp="${id}"><span class="th">${build(data, opts(id))}</span><span class="hs-n">${t[1]}<small>${{ pre: "Premium", kre: "Kreativ", pro: "Peşəkar", sad: "Sadə" }[t[2]]}</small></span></button>` : "" }).join("");
    requestAnimationFrame(() => $$("#hshow .th, #fan .th").forEach(fit));
  }
  function openTracker() { const b = document.querySelector('#car .seg [data-p="cv4"]'); if (b) b.click() }

  $("#hshow").addEventListener("click", e => {
    const b = e.target.closest(".hs"); if (!b) return;
    S.tp = b.dataset.tp; save(); render(); tab("cv");
    toast("Şablon seçildi: " + TPL.find(t => t[0] === S.tp)[1]);
  });
  $("#htrack").onclick = () => { tab("car"); openTracker() };

  // tab() üzərinə: ana səhifə açılanda yenilə, sənəd başlığını dəyiş
  const TITLES = { home: "Ana səhifə", cv: "CV qurucu", job: "Uyğun işlər", mus: "Müsahibə məşqi", let: "Məktub və LinkedIn", car: "Karyera alətləri", buy: "Kredit", log: "Yeniliklər" };
  const base = window.tab;
  window.tab = function (t) {
    base(t);
    document.title = (TITLES[t] ? TITLES[t] + " · " : "") + "KarYera AI";
    if (t === "home") renderHome();
  };

  fetch("/data/jobs.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !Array.isArray(j.jobs)) return;
    feedCount = j.jobs.length;
    const h = $("#hjobs"); if (h) h.textContent = `${feedCount} aktiv elan, CV-nə görə sıralanır`;
    if (!$("#home").hidden) renderHome();
  }).catch(() => { });

  if (!$("#home").hidden) renderHome();
  window.addEventListener("resize", () => { if (!$("#home").hidden) $$("#hshow .th, #fan .th").forEach(fit) });
})();
