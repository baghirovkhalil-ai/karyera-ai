// Supabase ilə server tərəfdən işləmək (REST, asılılıqsız).
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Yoxdursa enabled() = false.
const URL_ = () => (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SRV = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const enabled = () => !!(URL_() && SRV());

const H = () => ({ apikey: SRV(), authorization: "Bearer " + SRV(), "content-type": "application/json" });

// Brauzerdən gələn istifadəçi tokenini yoxla → {id, email} və ya null
export async function userFrom(req) {
  if (!enabled()) return null;
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || tok.length < 20) return null;
  try {
    const r = await fetch(URL_() + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_ANON_KEY || SRV(), authorization: "Bearer " + tok } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch (e) { return null }
}

export async function rest(path, { method = "GET", body, prefer } = {}) {
  const r = await fetch(URL_() + "/rest/v1/" + path, { method, headers: { ...H(), ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null } catch (e) { }
  if (!r.ok) { const err = new Error((j && (j.message || j.code)) || "supabase " + r.status); err.status = r.status; err.code = j && j.code; throw err }
  return j;
}

export const rpc = (fn, args) => rest("rpc/" + fn, { method: "POST", body: args });
