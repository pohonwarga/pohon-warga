// Posting Reel harian ke Instagram lewat Graph API.
// Pakai: node scripts/post.js <video_url_publik> [--check]
//   --check : hanya memeriksa token dan izin (tidak memposting apa pun)
// Env: IG_TOKEN, IG_USER_ID (opsional IG_API_HOST)
const fs = require('fs'), path = require('path');
const BASE = `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/v21.0`;
const token = process.env.IG_TOKEN, uid = process.env.IG_USER_ID;
const args = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, p, params = {}) {
  const url = new URL(BASE + p);
  const body = new URLSearchParams({ access_token: token, ...params });
  let res;
  if (method === 'GET') { body.forEach((v, k) => url.searchParams.set(k, v)); res = await fetch(url); }
  else res = await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${p}: ${j.error ? j.error.message : res.status}`);
  return j;
}

function captionToday() {
  const f = path.join(__dirname, '..', 'site', 'data', 'days.json');
  let log = {};
  try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); log = d[d.length - 1] || {}; } catch {}
  const base = (log.caption || `Day ${log.day || ''} Pohon Warga.`).trim();
  return `${base}\n\n#pohonwarga #desaapung #lowpoly`;
}

(async () => {
  if (!token || !uid) throw new Error('IG_TOKEN / IG_USER_ID belum diisi');
  if (args.includes('--check')) {
    const me = await call('GET', `/${uid}`, { fields: 'username,followers_count' });
    console.log('Token OK untuk akun:', me.username, '| followers:', me.followers_count);
    try { await call('GET', `/${uid}/content_publishing_limit`, { fields: 'quota_usage,config' }); console.log('Izin posting: OK (content_publishing_limit terbaca)'); }
    catch (e) { console.log('Izin posting: BELUM ADA ->', e.message); process.exit(2); }
    return;
  }
  const videoUrl = args.find(a => a.startsWith('http'));
  if (!videoUrl) throw new Error('Butuh URL video publik sebagai argumen');
  const c = await call('POST', `/${uid}/media`, { media_type: 'REELS', video_url: videoUrl, caption: captionToday(), share_to_feed: 'true' });
  console.log('Container dibuat:', c.id);
  for (let i = 0; i < 40; i++) {
    const s = await call('GET', `/${c.id}`, { fields: 'status_code,status' });
    console.log('Status:', s.status_code);
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Pemrosesan video gagal: ' + (s.status || s.status_code));
    await sleep(15000);
  }
  const pub = await call('POST', `/${uid}/media_publish`, { creation_id: c.id });
  console.log('Terposting, media id:', pub.id);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
