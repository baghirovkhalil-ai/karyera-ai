// Brauzerə açıq (gizli olmayan) parametrlər: Supabase qoşulubsa hesab sistemi işə düşür.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300");
  const url = process.env.SUPABASE_URL || "", anon = process.env.SUPABASE_ANON_KEY || "";
  res.status(200).json({
    auth: !!(url && anon),
    supabaseUrl: url && anon ? url : "",
    supabaseAnon: url && anon ? anon : "",
    tgBot: process.env.TELEGRAM_BOT_USERNAME || "",
    jobs: true
  });
}
