# KarYera AI v3 — quraşdırma

Sayt heç bir əlavə ayar olmadan işləyir (brauzer rejimi). Aşağıdakılar əlavə imkanları açır.

## 1. Vakansiya mənbələri
- Yoxlama: `https://SAYT/api/jobs?debug=1&q=satış` — hər mənbənin işləyib-işləmədiyini göstərir.
- Mənbəni söndürmək: Vercel → Settings → Environment Variables → `JOBS_SOURCES=boss,jobsearch,remotive,wwr` (siyahıda olmayan söndürülür).
- Mənbələr: boss, jobsearch, hellojob, smartjob (Azərbaycan), remotive, wwr (uzaqdan iş).
- Saytların istifadə şərtlərini yoxla; icazə verməyəni siyahıdan çıxar. Remotive və WWR açıq API/RSS verir.

## 2. Hesab və serverdə kredit (Supabase)
1. supabase.com → New project.
2. SQL Editor → `supabase/schema.sql` faylını yapışdır → Run.
3. Authentication → URL Configuration → Site URL: `https://karyera-ai.vercel.app` (və preview domenləri Redirect URLs-ə).
4. Project Settings → API-dən götür və Vercel-ə əlavə et:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (gizli, yalnız serverdə)
5. Redeploy. Başlıqda «Daxil ol» düyməsi görünəcək.

Nə dəyişir: kredit serverdə saxlanır, CV və treker cihazlar arasında sinxron olur, hər çek bazaya yazılır və təkrar istifadə həmişəlik bloklanır.

## 3. Telegram-da hər səhər 3 uyğun iş
Supabase qoşulduqdan sonra:
- `TELEGRAM_BOT_TOKEN` (artıq var), `TELEGRAM_BOT_USERNAME` (məs. karyera_ai_bot, @ olmadan), `TG_WEBHOOK_SECRET` (istənilən uzun söz), `CRON_SECRET` (istənilən uzun söz).
- Redeploy, sonra bir dəfə aç: `https://SAYT/api/tg?setup=1&secret=TG_WEBHOOK_SECRET`.
- Göndəriş hər gün 09:00 (Bakı) `vercel.json` cron ilə işləyir.

## 4. AI məxfiliyi
Gemini pulsuz rejimdə göndərilən mətn Google tərəfindən məhsulları yaxşılaşdırmaq üçün istifadə oluna bilər. Google AI Studio-da billing aktivləşdirəndə bu dayanır; kod dəyişmir.
