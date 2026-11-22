// Pohon Warga - simulation engine v0.1 (deterministic, no LLM). state' = step(state, input)
'use strict';
const CFG = {
  rtCapacity: 300, houseCap: 8, startEnergy: 100,
  stages: [[0, 30], [31, 100], [101, 200], [201, 300]], // stage 1..4 by RT population
  cost: { rumah: 4, warung: 6, balai: 8, sumur: 5, menara: 10, kebun: 4, jembatan: 6, lampion: 3 },
  buildDays: { rumah: 1, warung: 2, balai: 3, sumur: 2, menara: 3, kebun: 1, jembatan: 2, lampion: 1 },
  buildKeys: { rumah: ['rumah', 'tinggal'], warung: ['warung', 'makan'], balai: ['balai', 'kumpul'], sumur: ['sumur', 'air'],
    menara: ['menara'], mercusuar: ['mercusuar'], kebun: ['kebun', 'taman'], jembatan: ['jembatan'], lampion: ['lampu', 'lampion'] },
  taskKeys: { RONDA: ['ronda', 'jaga', 'siaga'], MASAK: ['masak', 'dapur'], CARI: ['cari', 'kayu'], PERBAIKI: ['perbaiki', 'tukang'], RAWAT: ['rawat', 'siram'], TIDUR: ['tidur', 'istirahat'], KERJA: ['kerja', 'bangun', 'proyek'] },
  energyCost: { RONDA: 15, MASAK: 10, CARI: 12, PERBAIKI: 12, RAWAT: 10, TIDUR: -40, KERJA: 12 },
  banned: ['anjing', 'bangsat', 'kontol', 'memek', 'babi', 'jancok', 'jancuk', 'bajingan', 'keparat', 'sialan', 'kampret', 'brengsek', 'goblok', 'tolol', 'ngentot', 'lonte', 'pantek', 'bokep', 'togel', 'pinjol', 'porno', 'kimak', 'cukimai', 'pepek', 'bangke', 'idiot'],
  // v0.3 (spesifikasi bagian 10): kas, proyek bertahap. Angka awal = tebakan, disetel setelah uji 14 hari.
  startKas: 30, kasPerActive: 0.2, belanjaBesar: 200,
  project: { rumah: { stages: 1, days: 1, need: 1, biaya: 1 }, warung: { stages: 1, days: 2, need: 2, biaya: 3 }, balai: { stages: 2, days: 2, need: 3, biaya: 4 },
    sumur: { stages: 1, days: 2, need: 2, biaya: 3 }, menara: { stages: 3, days: 2, need: 3, biaya: 5 }, kebun: { stages: 1, days: 1, need: 1, biaya: 2 },
    jembatan: { stages: 3, days: 2, need: 3, biaya: 5 }, lampion: { stages: 1, days: 1, need: 1, biaya: 1 },
    mercusuar: { stages: 2, days: 2, need: 2, biaya: 4 } },
  effects: { rumah: { kas: 2, line: 'Rumah baru berdiri, warga makin betah.' }, warung: { food: 10, wood: -2, line: 'Warung buka, kayu habis jadi meja.' },
    balai: { kas: 5, line: 'Balai ramai, rapat tak pernah selesai.' }, sumur: { food: 8, line: 'Air bersih mengalir, kebun makin subur.' },
    menara: { line: 'Menara tinggi, penjaga betah begadang.' }, mercusuar: { line: 'Cahayanya terlihat sampai ke tepi sungai.' }, kebun: { food: 6, line: 'Kebun bunga mekar, lebah ikut pindah.' },
    jembatan: { kas: 3, line: 'Warga tak perlu berenang lagi.' }, lampion: { kas: 1, line: 'Malam terang, anak-anak susah disuruh tidur.' } },
  // v0.4 (spesifikasi bagian 11, 13): job acak, EXP, level. 3 job; ganti job 1x seminggu lewat komen 'JOB <nama>'.
  jobs: ['ARCHER', 'SWORDMAN', 'MAGE'], expPerComment: 10, expMaxPerDay: 3, expPerLevel: 50, jobChangeDays: 7,
  // v0.5 (spesifikasi bagian 13): quest harian 1 baris, hadiah 1 koin pribadi; 1 koin pribadi per hari komen.
  quests: [
    { id: 'komen3', text: 'Komen 3 kali hari ini', check: cs => cs.length >= 3 },
    { id: 'bangun', text: 'Minta satu bangunan di komentar', check: cs => cs.some(c => parseBuild(c.text)) },
    { id: 'tugas', text: 'Pilih tugas: RONDA, MASAK, atau KERJA', check: cs => cs.some(c => /\b(ronda|masak|kerja)\b/i.test(c.text)) },
    { id: 'tag', text: 'Tag satu teman di komentar (@nama)', check: cs => cs.some(c => /@\w/.test(c.text)) },
    { id: 'job', text: 'Sebut jobmu: ARCHER, SWORDMAN, atau MAGE', check: cs => cs.some(c => /archer|swordsman|swordman|mage/i.test(c.text)) },
  ],
  // v0.6 (spesifikasi bagian 12): toko kosmetik. Komen 'BELI <item>' (otomatis dipakai), 'PAKAI <item>' untuk ganti. Hanya tampilan.
  shop: [
    { id: 'syal', nama: 'Syal', harga: 3, slot: 'scarf', keys: ['syal'], look: { scarf: 0xff7fb0 } },
    { id: 'kacamata', nama: 'Kacamata', harga: 3, slot: 'glasses', keys: ['kacamata'], look: { glasses: 1 } },
    { id: 'tas', nama: 'Tas punggung', harga: 3, slot: 'pack', keys: ['tas'], look: { pack: 0xc89a58 } },
    { id: 'cap', nama: 'Topi cap', harga: 3, slot: 'hat', keys: ['cap'], look: { hat: 'cap' } },
    { id: 'jerami', nama: 'Topi jerami', harga: 3, slot: 'hat', keys: ['jerami'], look: { hat: 'straw' } },
    { id: 'kelinci', nama: 'Kuping kelinci', harga: 8, slot: 'hat', keys: ['kelinci'], look: { hat: 'bunny' } },
    { id: 'kucing', nama: 'Kuping kucing', harga: 8, slot: 'hat', keys: ['kucing'], look: { hat: 'cat' } },
    { id: 'tanduk', nama: 'Topi tanduk', harga: 8, slot: 'hat', keys: ['tanduk'], look: { hat: 'horns' } },
    { id: 'jubah', nama: 'Jubah', harga: 8, slot: 'cape', keys: ['jubah'], look: { cape: 0x3a78d0 } },
    { id: 'sayap', nama: 'Sayap hitam kecil', harga: 8, slot: 'wings', keys: ['sayap'], look: { wings: 0x15121c } },
  ],
  nama: { rumah: 'Rumah', warung: 'Warung', balai: 'Balai', sumur: 'Sumur', menara: 'Menara', kebun: 'Kebun', jembatan: 'Jembatan', lampion: 'Lampion', mercusuar: 'Mercusuar' },
};
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seedStr) { let a = hash(seedStr); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

function newWorld(startDate, worldId = 'pohon-warga') {
  return { worldId, day: 0, date: addDays(startDate, -1), population: 1, kas: CFG.startKas, pools: { food: 50, wood: 12 },
    rts: [{ id: 'rt01', number: 1, stage: 1, treeHealth: 100, pop: 1 }],
    residents: { budi: { id: 'budi', username: 'Pak RT Budi', rt: 'rt01', house: 'balai', task: 'RAWAT', energy: 100, joinedDay: 0, optOut: false } },
    buildings: [{ id: 'b0', type: 'balai', rt: 'rt01', status: 'done', damage: 0, by: 'budi', comment: null, day: 0 }],
    queue: [], dragon: { lastAttackDay: -99, pendingAttack: false, warning: false }, log: [] };
}
const norm = s => s.toLowerCase();
const hasKey = (text, keys) => keys.some(k => norm(text).includes(k));
function parseTask(text) { for (const [t, ks] of Object.entries(CFG.taskKeys)) if (hasKey(text, ks)) return t; return null; }
function parseBuild(text) { for (const [t, ks] of Object.entries(CFG.buildKeys)) if (hasKey(text, ks)) return t; return null; }
const levelOf = exp => 1 + Math.floor((exp || 0) / CFG.expPerLevel);
const randomJob = (key, worldId) => CFG.jobs[hash(key + '|job|' + worldId) % CFG.jobs.length];
function parseJob(text) { const m = /\bjob\s+(archer|swordsman|swordman|mage)\b/i.exec(text); return m ? (m[1].toUpperCase() === 'SWORDSMAN' ? 'SWORDMAN' : m[1].toUpperCase()) : null; }
const questFor = (worldId, day) => CFG.quests[hash(worldId + '|quest|' + day) % CFG.quests.length];
const sayText = t => { const x = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 48); return CFG.banned.some(b => x.toLowerCase().includes(b)) ? '...' : x; };
const shopItem = text => CFG.shop.find(i => hasKey(text, i.keys));
function parseShop(text) { const t = norm(text); const m = /\b(beli|pakai)\b/.exec(t); if (!m) return null; const it = shopItem(t.slice(m.index)); return it ? { act: m[1], item: it } : null; }
const cleanName = u => CFG.banned.some(b => u.toLowerCase().includes(b)) ? 'warga' : u;

function caption(S, prev, log) {
  const homes = s => s.buildings.filter(b => b.type === 'rumah' && b.status === 'done').length;
  const built = log.events.filter(e => e.type === 'built');
  const workers = Object.values(S.residents).filter(r => r.task === 'KERJA' && !r.optOut && r.id !== 'budi').map(r => '@' + r.username).sort().slice(0, 3);
  const pick = (k, list) => list[hash(S.worldId + '|cap|' + k + '|' + S.day) % list.length];
  const EMO = { rumah: '🏠', warung: '🍜', balai: '🏛️', sumur: '💧', menara: '🗼', kebun: '🌷', jembatan: '🌉', lampion: '🏮' };
  const clean = t => { const x = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60); return CFG.banned.some(w => x.toLowerCase().includes(w)) ? '...' : x; };
  const top = log.usul_teratas, L = [];
  // hook
  if (top) L.push(pick('hook', [`Aku baca semua komentar kalian. Usul terpopuler hari ini: ${clean(top.text)} ${EMO[top.building] || ''}`.trim(), `Hari ini kalian ramai juga ya. Aku catat dulu semuanya 😅`, `Mayor Budi lapor: ada usulan baru, dan aku sudah baca semuanya 👀`]));
  else L.push(pick('sepi', ['Hari ini belum ada yang usul. Mayor Budi bengong 🥲 Mau bangun apa?', 'Sepi banget hari ini. Aku sendirian di balai 🥲 Kasih usul dong!']));
  L.push('');
  L.push(`📍 Day ${S.day} di Pohon Warga`);
  if (top) {
    const nx0 = S.queue[0], next = nx0 && nx0.user === top.user && nx0.type === top.building;
    const like = top.likes > 0 ? `${top.likes} like, paling banyak hari ini` : 'usul pertama hari ini';
    L.push(`🗳️ Usul terpopuler dari @${top.user}: "${clean(top.text)}" ${EMO[top.building] || ''} (${like}${next ? ', jadi dibangun besok' : ', masuk antrean'})`.replace(/ +/g, ' ').trim());
  }
  if (built.length) L.push(...built.map(e => `${EMO[e.building] || '✅'} ${CFG.nama[e.building]} sudah jadi. ${(e.effect || (CFG.effects[e.building] || {}).line || '')}`.trim()));
  if (log.proyek.length) L.push('🔨 Lagi dikerjakan: ' + log.proyek.map(p => CFG.nama[p.building] + (p.total > 1 ? ` (tahap ${p.tahap} dari ${p.total})` : '')).join(', ') + (workers.length ? ' oleh ' + workers.join(', ') : ''));
  if (S.population !== prev.population) L.push(`👥 Warga: ${prev.population} → ${S.population} (${S.population > prev.population ? pick('naik', ['makasih yang baru gabung!', 'selamat datang di desa!', 'desa makin ramai!']) : 'ada yang pindah'})`);
  else L.push(`👥 Warga: ${S.population}`);
  if (homes(S) !== homes(prev)) L.push(`🏠 Rumah: ${homes(prev)} → ${homes(S)}`);
  L.push('');
  const nx = S.queue[0];
  L.push(nx ? `Besok aku bangun ${CFG.nama[nx.type].toLowerCase()} ${EMO[nx.type] || ''}`.trim() : pick('besok', ['Besok bangun apa ya? Kalian yang tentukan 👇', 'Besok masih kosong. Isi dulu lewat komentar 👇']));
  L.push('');
  L.push(pick('cta', ['Follow = jadi warga 🏡', 'Follow dulu biar kebagian rumah 🏡', 'Follow = otomatis jadi warga desa 🏡']));
  L.push('Komen = minta bangunan 💬');
  L.push(pick('cta2', ['Ketik bangunan apa pun, aku baca satu-satu.', 'Usul yang paling banyak di-like dibangun duluan.']));
  return L.join('\n');
}

function step(prev, input) {
  const S = JSON.parse(JSON.stringify(prev));
  if (S.kas === undefined) S.kas = CFG.startKas;
  S.day += 1; S.date = addDays(prev.date, 1);
  const rand = rng(S.date + S.worldId);
  const log = { day: S.day, date: S.date, events: [], featured_comments: [], notes: [] };
  const named = () => Object.values(S.residents).filter(r => !r.optOut);

  // 1. comments (only those before the gate are passed in by the caller)
  const requests = [], byUser = {};
  for (const c of input.comments) {
    const key = c.user.toLowerCase();
    if (hasKey(c.text, ['keluar'])) { if (S.residents[key]) { S.residents[key].optOut = true; log.events.push({ type: 'opt_out', user: cleanName(c.user) }); } continue; }
    let r = S.residents[key];
    if (!r || r.optOut) {
      r = S.residents[key] = { id: key, username: cleanName(c.user), rt: null, house: null, task: 'CARI', energy: CFG.startEnergy, joinedDay: S.day, optOut: false, job: randomJob(key, S.worldId), exp: 0, level: 1, jobChangedDay: -99 };
      log.events.push({ type: 'join', user: r.username });
    }
    if (r.id !== 'budi') {
      if (!r.job) { r.job = randomJob(key, S.worldId); r.exp = r.exp || 0; r.level = levelOf(r.exp); r.jobChangedDay = -99; }
      const nj = parseJob(c.text);
      if (nj && nj !== r.job && S.day - (r.jobChangedDay === undefined ? -99 : r.jobChangedDay) >= CFG.jobChangeDays) { log.events.push({ type: 'job_change', user: r.username, from: r.job, to: nj }); r.job = nj; r.jobChangedDay = S.day; }
      if (r.expDay !== S.day) { r.expDay = S.day; r.expN = 0; }
      if (r.expN < CFG.expMaxPerDay) { r.expN++; r.exp = (r.exp || 0) + CFG.expPerComment; const lv = levelOf(r.exp); if (lv > (r.level || 1)) { log.events.push({ type: 'level_up', user: r.username, level: lv, job: r.job }); r.level = lv; } }
    }
    if (r.id !== 'budi') {
      const sh = parseShop(c.text);
      if (sh) { r.items = r.items || []; r.look = r.look || {};
        const own = r.items.includes(sh.item.id);
        if (sh.act === 'beli' && !own && r.buyDay === S.day) log.events.push({ type: 'beli_gagal', user: r.username, item: sh.item.nama, alasan: 'maks 1 barang per hari' });
        else if (sh.act === 'beli' && !own && (r.koin || 0) >= sh.item.harga) { r.buyDay = S.day; r.koin -= sh.item.harga; r.items.push(sh.item.id); r.look = { ...r.look, ...Object.fromEntries(CFG.shop.filter(i => i.slot === sh.item.slot).flatMap(i => Object.keys(i.look)).map(k => [k, null])), ...sh.item.look }; r.look = Object.fromEntries(Object.entries(r.look).filter(([, v]) => v !== null)); log.events.push({ type: 'beli', user: r.username, item: sh.item.nama, harga: sh.item.harga }); }
        else if (sh.act === 'pakai' && own) { r.look = { ...Object.fromEntries(Object.entries(r.look).filter(([k]) => !CFG.shop.filter(i => i.slot === sh.item.slot).some(i => k in i.look))), ...sh.item.look }; log.events.push({ type: 'pakai', user: r.username, item: sh.item.nama }); }
        else log.events.push({ type: 'beli_gagal', user: r.username, item: sh.item.nama, alasan: own ? 'sudah punya' : 'koin kurang' });
      }
    }
    if (r.id !== 'budi' && sayText(c.text)) r.say = { day: S.day, text: sayText(c.text) };
    (byUser[key] = byUser[key] || []).push(c);
    const t = parseTask(c.text); if (t) { r.task = t; r.explicit = S.day; }
    const b = parseBuild(c.text);
    if (b) requests.push({ type: b, user: key, username: r.username, text: c.text, likes: c.likes || 0, ts: c.ts || 0 });
    else if (!t && !parseJob(c.text) && !parseShop(c.text)) log.events.push({ type: 'unmatched', user: r.username });
  }
  // 1b. koin pribadi + quest harian
  const q = questFor(S.worldId, S.day); let qDone = 0; const qNames = [];
  for (const [key, cs] of Object.entries(byUser)) { const r = S.residents[key]; if (!r || r.optOut || r.id === 'budi') continue;
    r.koin = (r.koin || 0) + 1; if (q.check(cs)) { r.koin += 1; qDone++; qNames.push(r.username); } }
  log.quest = { id: q.id, text: q.text, selesai: qDone, nama: qNames.slice(0, 3) }; S.questNext = questFor(S.worldId, S.day + 1).text; S.questLast = { text: q.text, selesai: qDone, nama: qNames.slice(0, 3) }; log.questBesok = questFor(S.worldId, S.day + 1).text;
  // 2. population & RT assignment
  S.population = Math.max(input.followers, named().length);
  let left = S.population;
  for (const rt of S.rts) { rt.pop = Math.min(CFG.rtCapacity, left); left -= rt.pop; }
  const lastRt = S.rts[S.rts.length - 1];
  if (left > 0 && lastRt.pop >= CFG.rtCapacity && lastRt.stage === 4) {
    const n = S.rts.length + 1; S.rts.push({ id: 'rt' + String(n).padStart(2, '0'), number: n, stage: 1, treeHealth: 100, pop: 0 });
    log.events.push({ type: 'new_rt', rt: 'rt' + String(n).padStart(2, '0') });
    left = S.population; for (const rt of S.rts) { rt.pop = Math.min(CFG.rtCapacity, left); left -= rt.pop; }
  }
  for (const r of named()) if (!r.rt) r.rt = S.rts.find(x => x.pop > 0 && named().filter(n => n.rt === x.id).length < x.pop)?.id || S.rts[0].id;
  for (const rt of S.rts) rt.stage = 1 + CFG.stages.findIndex(([a, b]) => rt.pop >= a && rt.pop <= b) || 1;

  // 3. tasks, energy, production
  const unnamed = S.population - named().length;
  let food = 0, wood = 0, D = 0, repairers = 0, ronda = 0, workers = 0, active = 0;
  let slots = S.buildings.filter(b => b.status === 'building' && b.need).reduce((a, b) => a + b.need, 0);
  const need = S.population * 0.5, warned = prev.dragon.pendingAttack;
  for (const r of named()) {
    if (r.explicit !== S.day && r.id !== 'budi') r.task = warned ? 'RONDA' : (S.pools.food < need * 0.5 ? 'MASAK' : (slots > 0 ? (slots--, 'KERJA') : 'CARI')); // auto-assign (kerja bakti) unless chosen today
    if (r.energy < 30) r.task = 'TIDUR';
    const t = r.task;
    if (t === 'TIDUR') r.energy = clamp(r.energy + 40, 0, 100);
    else {
      r.energy = clamp(r.energy - CFG.energyCost[t], 0, 100); active++;
      if (t === 'KERJA') workers++;
      if (t === 'MASAK') food += 8; if (t === 'CARI') wood += 2; if (t === 'PERBAIKI') repairers++;
      if (t === 'RONDA') { D += 3; ronda++; } if (t === 'RAWAT') D += 1;
    }
  }
  S.kas += Math.floor(active * CFG.kasPerActive);
  food += unnamed * 0.5; wood += Math.floor(unnamed / 20); D += unnamed * 0.1;
  S.pools.food += food; S.pools.wood += wood;
  S.pools.food = Math.round((S.pools.food - S.population * 0.5) * 10) / 10;
  if (S.pools.food < 0) { S.pools.food = 0; for (const r of named()) r.energy = clamp(r.energy - 10, 0, 100); log.events.push({ type: 'paceklik' }); }

  // 4. houses (auto) + building queue
  for (const rt of S.rts) {
    if (!S.buildings.some(x => x.rt === rt.id && x.type === 'balai')) S.buildings.push({ id: 'b' + S.buildings.length, type: 'balai', rt: rt.id, status: 'done', damage: 0, by: null, comment: null, day: S.day });
    const homes = S.buildings.filter(x => x.rt === rt.id && x.type === 'rumah' && x.status === 'done').length;
    const inRt = named().filter(r => r.rt === rt.id).length;
    if (inRt > homes * CFG.houseCap || homes < Math.min(6, Math.ceil(rt.pop / 40))) { S.buildings.push({ id: 'b' + S.buildings.length, type: 'rumah', rt: rt.id, status: 'done', damage: 0, by: null, comment: null, day: S.day }); log.events.push({ type: 'auto_house', rt: rt.id }); }
  }
  if (S.kas >= CFG.belanjaBesar && !S.queue.some(q => q.budi) && !S.buildings.some(b => b.status === 'building' && b.by === 'budi')) {
    const t = ['sumur', 'menara', 'kebun', 'jembatan'][Math.floor(rand() * 4)];
    S.queue.unshift({ type: t, user: 'budi', username: 'Pak RT Budi', text: 'Belanja besar dari kas desa', likes: 0, ts: 0, wait: 0, day: S.day, budi: true });
    log.events.push({ type: 'belanja_besar', building: t });
  }
  requests.sort((a, b) => b.likes - a.likes || a.ts - b.ts);
  S.queue = S.queue.filter(q => { if (S.day - q.day > 3) { log.events.push({ type: 'request_expired', user: q.username, building: q.type }); return false; } return true; });
  for (const q of requests) S.queue.push({ ...q, wait: 0, day: S.day });
  const cap = Math.min(5, 1 + Math.floor(S.population / 50));
  let started = 0, blocked = false, pool = workers;
  let busyNeed = S.buildings.filter(b => b.status === 'building' && b.need).reduce((x, b) => x + b.need, 0); // pekerja yang dibutuhkan proyek berjalan
  for (const b of S.buildings.filter(x => x.status === 'building')) {
    if (!b.need) { b.left -= 1; if (b.left <= 0) { b.status = 'done'; b.doneDay = S.day; log.events.push({ type: 'built', building: b.type, by: b.byName }); } continue; } // proyek lama (v0.1)
    const w = Math.min(pool, b.need); pool -= w;
    b.progress = (b.progress || 0) + (w >= b.need ? 1 : w / b.need);
    if (b.progress + 1e-9 >= b.days) {
      b.progress = 0;
      if (b.tahap >= b.tahapTotal) {
        b.status = 'done'; b.doneDay = S.day; const fx = CFG.effects[b.type] || {};
        S.kas += fx.kas || 0; S.pools.food = Math.max(0, S.pools.food + (fx.food || 0)); S.pools.wood = Math.max(0, S.pools.wood + (fx.wood || 0));
        log.events.push({ type: 'built', building: b.type, by: b.byName, effect: fx.line });
      } else { b.tahap += 1; S.kas -= b.biaya; log.events.push({ type: 'stage_done', building: b.type, tahap: b.tahap - 1, total: b.tahapTotal }); }
    }
  }
  for (const q of [...S.queue]) {
    if (started >= cap) break; if (S.pools.wood < CFG.cost[q.type]) continue;
    const pd = CFG.project[q.type];
    if (busyNeed + pd.need > Math.max(3, Math.floor(named().length * 0.6))) continue; // jangan mulai proyek baru kalau pekerja tidak cukup
    if (pd.stages > 1 && S.kas < 0) { blocked = true; continue; } // utang menahan proyek besar
    S.pools.wood -= CFG.cost[q.type]; S.kas -= pd.biaya; started++; busyNeed += pd.need; S.queue.splice(S.queue.indexOf(q), 1);
    S.buildings.push({ id: 'b' + S.buildings.length, type: q.type, rt: (S.residents[q.user] && S.residents[q.user].rt) || 'rt01', status: 'building', tahap: 1, tahapTotal: pd.stages, days: pd.days, need: pd.need, biaya: pd.biaya, progress: 0, damage: 0, by: q.user, byName: q.username, comment: q.text, day: S.day });
    log.events.push({ type: 'build_start', building: q.type, by: q.username });
    if (!q.budi && log.featured_comments.length < 4) log.featured_comments.push({ user: q.username, text: q.text, likes: q.likes, building: q.type });
  }
  if (blocked) log.events.push({ type: 'utang_menahan_proyek' });
  // repairs
  let rep = repairers * 1;
  for (const b of S.buildings) while (b.damage > 0 && rep > 0 && S.pools.wood > 0) { b.damage--; rep--; S.pools.wood--; }

  // 5. dragon: resolve today's pending attack, then roll for tomorrow
  const dr = S.dragon; dr.warning = false;
  const done = S.buildings.filter(b => b.status === 'done');
  if (dr.pendingAttack) {
    const pop = S.population, Sp = 10 + 0.2 * pop, tower = done.filter(b => b.type === 'menara').length * 5, Dt = D + tower;
    dr.pendingAttack = false; dr.lastAttackDay = S.day;
    if (Dt >= Sp) log.events.push({ type: 'dragon', result: 'driven_off', S: +Sp.toFixed(1), D: Dt });
    else {
      const dmg = Math.min(6, Math.ceil((Sp - Dt) / 5)); let hit = 0;
      for (const b of done) { if (hit >= dmg) break; if (b.type !== 'balai' && b.damage < 2) { b.damage++; hit++; } }
      for (const rt of S.rts) rt.treeHealth = clamp(rt.treeHealth - 10, 0, 100);
      log.events.push({ type: 'dragon', result: 'damage', S: +Sp.toFixed(1), D: Dt, houses_damaged: hit });
    }
    log.deaths = 0;
  } else {
    for (const rt of S.rts) rt.treeHealth = clamp(rt.treeHealth + named().filter(r => r.task === 'RAWAT').length, 0, 100);
  }
  const p = Math.min(0.35, 0.14 + 0.01 * S.population / 100);
  if (S.day >= 4 && S.day - dr.lastAttackDay >= 2 && !dr.pendingAttack && rand() < p) { dr.pendingAttack = true; dr.warning = true; log.events.push({ type: 'dragon_warning' }); }
  log.stats = { population: S.population, named: named().length, food: S.pools.food, wood: S.pools.wood, kas: S.kas, utang: Math.max(0, -S.kas), buildings: S.buildings.filter(b => b.status === 'done').length, queue: S.queue.length };
  const top = requests[0];
  log.usul_teratas = top ? { user: top.username, text: top.text, likes: top.likes, building: top.type } : null;
  log.proyek = S.buildings.filter(b => b.status === 'building').map(b => ({ building: b.type, tahap: b.tahap || 1, total: b.tahapTotal || 1, by: b.byName }));
  log.caption = caption(S, prev, log);
  S.log = undefined; return { state: S, log };
}
module.exports = { step, newWorld, CFG, rng, hash, parseBuild };
