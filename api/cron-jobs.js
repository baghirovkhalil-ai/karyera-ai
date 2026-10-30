// Hər səhər (vercel.json → crons) Telegram-a bağlı istifadəçilərə 3 uyğun vakansiya göndərir.
// AI istifadə etmir (pulsuz kvotaya qənaət): uyğunluq açar sözlərlə hesablanır.
import { enabled as supaOn, rest } from "../lib/supa.js";
import { collect } from "./jobs.js";
import { send } from "./tg.js";

const words = s => String(s || "").toLocaleLowerCase("az").split(/[^a-zəöüçşğıi0-9+#]+/).filter(w => w.length > 3);
const esc = s => String(s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export default async function handler(req, res) {
  const cs = process.env.CRON_SECRET;
  if (cs && req.headers.authorization !== "Bearer " + cs) return res.status(401).end();
  if (!supaOn()) return res.status(200).json({ ok: false, reason: "Supabase qoşulmayıb" });
  const users = await rest("profiles?tg_chat_id=not.is.null&select=id,tg_chat_id,job_query,job_remote,data&limit=500");
  const byQuery = new Map(); let sent = 0;
  for (const u of users || []) {
    const d = (u.data && u.data.d) || {};
    const q = (u.job_query || d.vez || "").trim();
    const k = q + "|" + (u.job_remote ? 1 : 0);
    if (!byQuery.has(k)) byQuery.set(k, (await collect({ q, remote: !!u.job_remote })).items);
    const prof = new Set(words([d.vez, d.bac, d.hq, ...(d.exps || []).map(e => e.v + " " + e.t)].join(" ")));
    const top = byQuery.get(k).map(it => ({ it, s: words(it.title + " " + (it.text || "")).filter(w => prof.has(w)).length })).sort((a, b) => b.s - a.s).slice(0, 3);
    if (!top.length) continue;
    const msg = "☀️ Bu gün sənə uyğun işlər" + (q ? " («" + esc(q) + "»)" : "") + ":\n\n" + top.map(({ it }, i) => `${i + 1}. <b>${esc(it.title)}</b>${it.company ? " — " + esc(it.company) : ""}\n${esc(it.source)} · <a href="${esc(it.url)}">elana bax</a>`).join("\n\n") + "\n\nMüraciət paketini saytda hazırla: karyera-ai.vercel.app";
    await send(u.tg_chat_id, msg); sent++;
  }
  return res.status(200).json({ ok: true, users: (users || []).length, sent });
}
