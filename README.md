# Pohon Warga
- `site/` = viewer 3D (deploy ke Netlify, publish directory `site`)
- `engine/engine.js` = simulasi harian deterministik
- `scripts/daily.js` = satu hari: baca IG (atau data palsu) -> engine -> tulis `site/data/*.json`
- `.github/workflows/daily.yml` = jalan tiap 16:00 WIB (gerbang komen tutup jam 16:00); butuh secret `IG_TOKEN`
- Uji: `npm test` | Coba lokal: `node scripts/daily.js --fake`
Tanpa `IG_TOKEN`, skrip memakai komentar palsu (JANGAN aktifkan workflow di repo publik sebelum token ada, atau data palsu ikut ter-commit).
