# Vakansiya bazasının yenilənməsi

Baza: `data/jobs.json`. Oxuyanlar: KarYera AI (İşlər bölməsi) və İşYeri.az (Vakansiyalar, `JOBS_FEED_URL`).

Gündə 4 dəfə (08:40, 12:40, 16:40, 21:40 Bakı) planlı tapşırıq işləyir:
1. Mənbə səhifələri oxunur (HelloJob.az 1-3-cü səhifə, Boss.az və JobSearch.az BirJob vasitəsilə).
2. Elanlar `raw.json`-a yazılır: `[{ "source": "HelloJob.az", "ok": true, "items": [["başlıq", "şirkət", "link", "tarix"]] }]`
3. `node scripts/merge-jobs.mjs raw.json` — yeni elanlar əlavə olunur, 3 gün görünməyən və 30 gündən köhnə elanlar silinir.
4. Dəyişiklik varsa commit + push → Vercel avtomatik yayımlayır.

Mənbəni çıxarmaq: tapşırığın təlimatından həmin URL-i sil.
