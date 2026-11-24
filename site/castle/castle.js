// Kastil Pohon Warga — viewer hex medieval (KayKit, CC0 by Kay Lousberg)
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || innerWidth, H = +Q.get('h') || innerHeight;
const TIME = Q.get('time') || 'sore';
const CAMNAME = Q.get('cam') || 'wide75';
const T0 = +Q.get('t') || 0;
const LABELS = Q.get('labels') !== '0';
const A = 'assets/';

// ---------- hex util (pointy-top, lebar tile 2.0) ----------
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const K = (q, r) => q + ',' + r;
const XZ = (q, r) => [2*q + r, 1.7320508*r];
const HD = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r));
const pop = m => { let c=0; while(m){c+=m&1;m>>=1} return c; };
const R = 16;
const rnd = (() => { let s = 1234567; return () => (s = (s*1664525 + 1013904223) >>> 0) / 4294967296; })();
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const JOBS = ['KNIGHT', 'MAGE', 'RANGER'];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W/H, 0.5, 500);

// ---------- loader ----------
const loader = new GLTFLoader();
const cache = {};
const load = url => cache[url] || (cache[url] = new Promise((res, rej) => loader.load(url, res, undefined, rej)));
const hexUrl = n => A + 'hex/' + n + '.gltf';
const natUrl = n => A + 'nature/' + n + '.gltf';
const wpnUrl = n => A + 'weapons/' + n + '.gltf';

// ---------- batch instancing untuk semua yang statis ----------
const batches = {};
function put(name, x, y, z, ry = 0, s = 1, sy) {
  (batches[name] = batches[name] || []).push({x, y, z, ry, sx: s, sy: sy ?? s, sz: s});
}
async function flushBatches() {
  for (const [name, list] of Object.entries(batches)) {
    const url = name.startsWith('N:') ? natUrl(name.slice(2)) : hexUrl(name);
    const g = await load(url);
    g.scene.updateMatrixWorld(true);
    const meshes = []; g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      const P = new THREE.Matrix4(), S = new THREE.Matrix4(), M = new THREE.Matrix4();
      list.forEach((p, i) => {
        P.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), p.ry), new THREE.Vector3(p.sx, p.sy, p.sz));
        M.multiplyMatrices(P, m.matrixWorld); im.setMatrixAt(i, M);
      });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      scene.add(im);
    }
  }
}

// ---------- tabel autotile dari masks.json ----------
const masks = await (await fetch(A + 'masks.json')).json();
const roadTab = {}, riverTab = {}, coastTab = {};
for (const e of masks) {
  if (e.n.startsWith('hex_road_') && !roadTab[e.s]) roadTab[e.s] = {n: e.n, rot: e.rot};
  if (/^hex_river_[A-L]$/.test(e.n) && !riverTab[e.w]) riverTab[e.w] = {n: e.n, rot: e.rot};
  if (/^hex_coast_[BCD]$/.test(e.n) && e.w && !coastTab[e.w]) coastTab[e.w] = {n: e.n, rot: e.rot};
}
function pick(tab, mask) {
  if (tab[mask]) return tab[mask];
  let best = null, bs = -99;
  for (const m in tab) { const mm = +m; const sc = pop(mm & mask)*2 - pop(mm & ~mask)*1.5 - pop(mask & ~mm)*3; if (sc > bs) { bs = sc; best = tab[m]; } }
  return best;
}

// ---------- DATA: followers → warga → rumah (1 rumah = 10 warga) ----------
let followers = [];
try { followers = (await (await fetch('_followers.txt')).text()).split(/\r?\n/)
  .map(s => s.trim()).filter(s => s && !s.startsWith('#')); } catch (e) {}
if (!followers.length) followers = Array.from({length: 230}, (_, i) => 'warga' + i);
const WARGA = followers.map((u, i) => ({u, job: JOBS[hash(u) % 3], house: Math.floor(i / 10)}));
const jobCount = {KNIGHT: 0, MAGE: 0, RANGER: 0}; WARGA.forEach(w => jobCount[w.job]++);
window.STATS = {warga: WARGA.length, rumah: Math.ceil(WARGA.length / 10), jobCount};

// ---------- peta ----------
const cells = {};
const set = (q, r, o) => { cells[K(q, r)] = Object.assign(cells[K(q, r)] || {}, o); };
const get = (q, r) => cells[K(q, r)] || {};
for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (HD(q, r) <= R) cells[K(q, r)] = {q, r};

// jalan
const roads = new Set();
const addRoad = (q, r) => roads.add(K(q, r));
for (const [dq, dr] of DIRS) addRoad(dq, dr); addRoad(0, 0);
[[-1,2],[-1,3],[-2,4],[-2,5],[-3,6],[-3,7],[-3,8],[-3,9],[-3,10],[-3,11],[-3,12],[-3,13],[-3,14],
 [1,-2],[2,-3],[2,-4],[2,-5],
 [-2,0],[-3,0],[-4,0],
 [2,0],[3,0],[4,0],
 ].forEach(([q, r]) => addRoad(q, r));
// kavling ring 3 jalan keliling dalam (d=5) sebagian
// sungai di baris r=9
const riverCells = new Set(); for (let q = -R; q <= R; q++) if (HD(q, 9) <= R) riverCells.add(K(q, 9));
// laut barat
const SEA = [-13, 4];
const seaIn = new Set(), seaCoast = new Set();
for (const k in cells) { const {q, r} = cells[k]; const d = HD(q - SEA[0], r - SEA[1]); if (d <= 2) seaIn.add(k); else if (d === 3) seaCoast.add(k); }

// bangunan publik & fasilitas (cell → fitur)
const FEAT = {
  castle: [2, -5], theater: [4, -2], barracks: [4, 1], archery: [5, -4], mage: [-5, 2], market1: [-4, 0], market2: [-4, -1],
  kebun: [[-2,-3], [-3,-2], [-1,-4], [-3,-3 + 1 - 1 + 1]], tavern: [-2, 2], parade: [1, 1], windmill: [8, -2], lighthouse: [-10, 4],
};
const reserved = new Set();
const resv = (q, r) => reserved.add(K(q, r));
[FEAT.castle, FEAT.theater, FEAT.barracks, FEAT.archery, FEAT.mage, FEAT.market1, FEAT.market2, FEAT.tavern, FEAT.parade, FEAT.windmill, FEAT.lighthouse, ...FEAT.kebun].forEach(p => resv(p[0], p[1]));
reserved.add(K(0, 0));
roads.forEach(k => reserved.add(k));

// tile dasar
for (const k in cells) {
  const c = cells[k], {q, r} = c; const [x, z] = XZ(q, r); c.x = x; c.z = z;
  if (seaIn.has(k)) { c.tile = {n: 'hex_water', rot: 0}; continue; }
  if (seaCoast.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { if (seaIn.has(K(q+dq, r+dr))) m |= 1 << d; });
    c.tile = m ? {...pick(coastTab, m)} : {n: 'hex_grass', rot: 0}; continue;
  }
  if (k === K(-3, 9)) { c.tile = {n: 'hex_river_crossing_A', rot: 0}; continue; }
  if (riverCells.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { if (riverCells.has(K(q+dq, r+dr))) m |= 1 << d; });
    c.tile = {...pick(riverTab, m || 9)}; continue;
  }
  if (roads.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { const nk = K(q+dq, r+dr); if (roads.has(nk) || nk === K(-3, 9)) m |= 1 << d; });
    c.tile = m ? {...pick(roadTab, m)} : {n: 'hex_grass', rot: 0}; continue;
  }
  c.tile = {n: 'hex_grass', rot: 0};
}
for (const k in cells) { const c = cells[k]; put(c.tile.n, c.x, 0, c.z, c.tile.rot * Math.PI / 3); }

const cellXZ = (q, r) => XZ(q, r);
const CENTER = [0, 0];

// ---------- tembok ring d=6 ----------
for (let k = 0; k < 6; k++) {
  const [cq, cr] = [DIRS[k][0]*6, DIRS[k][1]*6]; const [x, z] = XZ(cq, cr);
  put((k === 0 || k === 3 || k === 2) ? 'building_tower_A_yellow' : 'building_tower_catapult_yellow', x, 0, z, 0, 1);
  const sd = DIRS[(k + 2) % 6]; const ang = ((k + 2) % 6) * Math.PI / 3;
  for (let i = 1; i <= 5; i++) {
    const q = cq + sd[0]*i, r = cr + sd[1]*i; const [wx, wz] = XZ(q, r);
    const gate = (k === 4 && i === 3);
    put(gate ? 'wall_straight_gate' : 'wall_straight', wx, 0, wz, ang, 1);
  }
}

// ---------- rumah (3 per tile hex) ----------
const BLOCK = ['red', 'blue', 'green'];
const houseTiles = [];
{
  const blockedN = new Set(); [FEAT.theater, FEAT.castle, FEAT.mage, FEAT.barracks, FEAT.archery, FEAT.parade].forEach(([q, r]) => DIRS.forEach(([dq, dr]) => blockedN.add(K(q + dq, r + dr))));
  const cand = Object.values(cells).filter(c => { if (blockedN.has(K(c.q, c.r))) return false; const d = HD(c.q, c.r); return d >= 2 && d <= 5 && !reserved.has(K(c.q, c.r)) && c.tile.n === 'hex_grass'; });
  cand.sort((a, b) => HD(a.q, a.r) - HD(b.q, b.r) || Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const chosen = new Set();
  for (const c of cand) {
    if (houseTiles.length >= 22) break;
    if (HD(c.q, c.r) < 3) continue;
    if (DIRS.some(([dq, dr]) => chosen.has(K(c.q + dq, c.r + dr)))) continue;
    // beri jarak dari jalan: boleh bersebelahan jalan, tapi tidak di jalan
    chosen.add(K(c.q, c.r)); houseTiles.push(c);
  }
  // warna per sektor sudut
  for (const c of houseTiles) { const a = (Math.atan2(c.z, c.x) * 180 / Math.PI + 360) % 360; c.block = a < 120 ? 'green' : a < 240 ? 'blue' : 'red'; }
}
const houseSlots = [];
houseTiles.forEach(c => { for (let i = 0; i < 3; i++) { const a = Math.PI/2 + i * 2*Math.PI/3 + 0.3; houseSlots.push({c, x: c.x + Math.cos(a)*0.58, z: c.z + Math.sin(a)*0.58, i}); } });
const nHouse = Math.ceil(WARGA.length / 10);
houseSlots.forEach((s, idx) => {
  const yaw = Math.atan2(-s.x, -s.z);
  if (idx < nHouse) put('building_home_' + (idx % 2 ? 'B' : 'A') + '_' + s.c.block, s.x, 0, s.z, yaw, 1);
  else { put('building_scaffolding', s.x, 0, s.z, yaw, 0.9); }
});

// ---------- fasilitas & publik ----------
{
  const [cx, cz] = XZ(...FEAT.castle); put('building_castle_yellow', cx, 0, cz, Math.PI, 1);
  const [bx, bz] = XZ(...FEAT.barracks); put('building_barracks_yellow', bx, 0, bz, Math.atan2(-bx, -bz), 1);
  const [ax, az] = XZ(...FEAT.archery); put('building_archeryrange_yellow', ax, 0, az, Math.atan2(-ax, -az), 1); put('target', ax + 0.9, 0, az + 0.4, -0.6, 1);
  const [mx, mz] = XZ(...FEAT.mage); put('building_church_blue', mx, 0, mz, Math.atan2(-mx, -mz), 1);
  const [m1x, m1z] = XZ(...FEAT.market1); put('building_market_yellow', m1x - 0.3, 0, m1z + 0.2, Math.PI/2 + 0.3, 1); put('crate_A_big', m1x + 0.7, 0, m1z + 0.7, 0.4, 1); put('barrel', m1x + 0.9, 0, m1z - 0.3, 0, 1);
  const [m2x, m2z] = XZ(...FEAT.market2); put('building_market_green', m2x - 0.2, 0, m2z, Math.PI/2 - 0.2, 1); put('crate_long_A', m2x + 0.7, 0, m2z + 0.3, 0.5, 1); put('sack', m2x + 0.6, 0, m2z - 0.6, 0, 1);
  const [tx, tz] = XZ(...FEAT.tavern); put('building_tavern_yellow', tx, 0, tz, Math.atan2(-tx, -tz), 1);
  const [wx, wz] = XZ(...FEAT.windmill); put('building_windmill_yellow', wx, 0, wz, 0.5, 1.5);
  FEAT.kebun.forEach(([q, r], i) => { const [kx, kz] = XZ(q, r); put('building_grain', kx, 0, kz, i * Math.PI / 3, 1); });
  { const [kx, kz] = XZ(-2, -3); put('wheelbarrow', kx + 0.9, 0, kz + 0.9, 1.2, 1); put('sack', kx - 0.8, 0, kz + 1.0, 0, 1); put('bucket_water', kx + 0.2, 0, kz + 1.1, 0, 1); }
  // sumur di plaza
  const [px, pz] = XZ(0, 1); put('building_well_yellow', px + 0.6, 0, pz + 0.3, 0, 1);
}

// ---------- hutan di luar: Forest Nature + hex trees/hills/mountains ----------
const treeNames = ['N:Tree_1_A_Color1', 'N:Tree_1_B_Color1', 'N:Tree_1_C_Color1', 'N:Tree_2_A_Color1', 'N:Tree_2_B_Color1', 'N:Tree_3_A_Color1', 'N:Tree_3_B_Color1', 'N:Tree_4_A_Color1', 'N:Tree_4_B_Color1'];
const bushNames = ['N:Bush_1_A_Color1', 'N:Bush_2_A_Color1', 'N:Bush_3_A_Color1', 'N:Bush_4_A_Color1', 'N:Bush_1_C_Color1'];
const rockNames = ['N:Rock_1_A_Color1', 'N:Rock_1_C_Color1', 'N:Rock_2_A_Color1', 'N:Rock_3_B_Color1'];
const used = new Set([...reserved, K(-3, 9)]);
for (const c of Object.values(cells)) {
  const k = K(c.q, c.r), d = HD(c.q, c.r);
  if (c.tile.n !== 'hex_grass') continue;
  if (d >= 7 && d <= 9 + 1 && !roads.has(k)) {
    // hutan di luar tembok
    if (k === K(-10, 4)) continue;
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, rr = 0.2 + rnd() * 0.75; put(treeNames[Math.floor(rnd() * treeNames.length)], c.x + Math.cos(a)*rr, 0, c.z + Math.sin(a)*rr, rnd() * 6.28, 0.2 + rnd() * 0.08); }
    if (rnd() < 0.5) put(bushNames[Math.floor(rnd() * bushNames.length)], c.x + rnd() - 0.5, 0, c.z + rnd() - 0.5, rnd() * 6, 0.8);
  } else if (d > 10) {
    const south = c.z > 6, north = c.z < -8;
    if (d > 12 && (north || Math.abs(c.x) > 18) && rnd() < 0.45) { put(['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees'][Math.floor(rnd() * 3)], c.x, 0, c.z, Math.floor(rnd() * 6) * Math.PI / 3, 1.0); }
    else { const n = 3; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, rr = 0.2 + rnd() * 0.8; put(treeNames[Math.floor(rnd() * treeNames.length)], c.x + Math.cos(a)*rr, 0, c.z + Math.sin(a)*rr, rnd() * 6.28, 0.22 + rnd() * 0.08); } }
  } else if (d >= 7 && rnd() < 0.2) {
    put(rockNames[Math.floor(rnd() * rockNames.length)], c.x + rnd() - 0.5, 0, c.z + rnd() - 0.5, rnd() * 6, 0.5);
  }
}
// semak/batu kecil di dalam kota
for (const c of Object.values(cells)) {
  if (c.tile.n !== 'hex_grass' || reserved.has(K(c.q, c.r)) || HD(c.q, c.r) > 5 || houseTiles.includes(c)) continue;
  if (rnd() < 0.6) put(bushNames[Math.floor(rnd() * bushNames.length)], c.x + (rnd() - 0.5) * 1.2, 0, c.z + (rnd() - 0.5) * 1.2, rnd() * 6, 0.9);
  if (rnd() < 0.3) put('N:Grass_1_A_Color1', c.x + (rnd() - 0.5), 0, c.z + (rnd() - 0.5), rnd() * 6, 1);
}
// bendera di gerbang
{ const [gx, gz] = XZ(-3, 6); put('flag_yellow', gx - 1.0, 0, gz + 0.5, 0, 1); put('flag_yellow', gx + 1.0, 0, gz + 0.5, 0, 1); }

// ---------- POHON BESAR (ikon) ----------
put('N:Tree_1_A_Color1', 0, 0, 0, 0.4, 1.8, 1.9);
// Grand Theater: cincin tembok mini di tile hex
{ const [tx, tz] = XZ(...FEAT.theater);
  for (let k = 0; k < 6; k++) { if (k === 3) continue; const a = k * Math.PI / 3; put('wall_straight', tx + Math.cos(a) * 0.93, 0, tz - Math.sin(a) * 0.93, a + Math.PI / 2, 0.56, 0.6); } }

await flushBatches();

// ---------- objek kode: telur, theater, mercusuar, portal ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.7, metalness: 0}, o));
const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; scene.add(o); return o; };
const glowing = []; // objek yang berdenyut

// telur naga
{
  const egg = new THREE.Group(); egg.position.set(-1.45, 0, 1.55);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), mat(0x4b2a8f, {roughness: 0.35, emissive: 0x2a0f66, emissiveIntensity: 0.6}));
  body.scale.set(1, 1.35, 1); body.position.y = 0.62; body.castShadow = true; egg.add(body);
  const crackM = new THREE.MeshBasicMaterial({color: 0xc78bff});
  [[0, 0.95, 0.46, 0.2], [0.12, 0.78, 0.5, -0.5], [-0.1, 0.62, 0.5, 0.4], [0.15, 0.48, 0.47, -0.3]].forEach(([x, y, z, rz]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), crackM); c.position.set(x, y, z); c.rotation.z = rz; egg.add(c); });
  const sp = [0x8a5ae0, 0xb48bff]; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rnd()*0.03, 8, 8), new THREE.MeshBasicMaterial({color: sp[i % 2]})); s.position.set((rnd()-0.5)*1.1, 0.3 + rnd()*1.1, (rnd()-0.5)*1.1); egg.add(s); }
  const L = new THREE.PointLight(0xa86bff, 6, 5, 2); L.position.set(0, 0.7, 0.4); egg.add(L); glowing.push(L);
  scene.add(egg); window.EGG = egg;
}

// Grand Theater: panggung, tirai, tenda, bangku (primitif berwarna palet KayKit)
{
  const [tx, tz] = XZ(...FEAT.theater);
  const wood = mat(0xa8623a), red = mat(0xc23a3a), gold = mat(0xe6b23a), stone = mat(0x9aa7ad);
  // panggung di sisi timur (belakang arena)
  mesh(new THREE.BoxGeometry(0.6, 0.14, 1.0), wood, tx + 0.45, 0.07, tz);
  mesh(new THREE.BoxGeometry(0.06, 0.8, 1.05), red, tx + 0.72, 0.5, tz);                // tirai belakang
  mesh(new THREE.BoxGeometry(0.1, 0.12, 1.1), gold, tx + 0.4, 0.88, tz);                // lengkung atas
  [-0.5, 0.5].forEach(dz => mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), gold, tx + 0.4, 0.5, tz + dz));
  // bangku melengkung
  for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) { const a = Math.PI + i * 0.32; const rr = 0.35 + row * 0.2; mesh(new THREE.BoxGeometry(0.11, 0.07 + row*0.03, 0.2), row % 2 ? stone : mat(0xb9764a), tx + 0.1 + Math.cos(a) * rr * 0.9 - 0.3, 0.04 + row*0.015, tz + Math.sin(a) * rr * 0.9); }
}
// Mercusuar: tower_base KayKit diperpanjang + ruang lampu + atap
const LH = {};
{
  const [lx, lz] = XZ(...FEAT.lighthouse);
  const g = await load(hexUrl('building_tower_base_yellow'));
  const base = SkeletonUtils.clone(g.scene); base.scale.set(0.8, 2.3, 0.8); base.position.set(lx, 0, lz);
  base.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(base);
  const stripe = mat(0xd9362f); for (let i = 0; i < 4; i++) mesh(new THREE.CylinderGeometry(0.4 - i*0.012, 0.42 - i*0.012, 0.3, 18), stripe, lx, 0.4 + i * 0.85, lz);
  const topY = 2.3 * (g.scene.userData.h || 1.0) * 0.98;
  LH.topY = 3.45; LH.x = lx; LH.z = lz;
  mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.1, 18), mat(0x4a3b2a), lx, LH.topY, lz);
  const lamp = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 16), new THREE.MeshBasicMaterial({color: 0xfff3a8}), lx, LH.topY + 0.25, lz);
  mesh(new THREE.ConeGeometry(0.42, 0.42, 16), mat(0xd9362f), lx, LH.topY + 0.66, lz);
  const L = new THREE.PointLight(0xffe9a0, 8, 10, 2); L.position.set(lx, LH.topY + 0.3, lz); scene.add(L); glowing.push(L);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 24, 1, true), new THREE.MeshBasicMaterial({color: 0xfff1a0, transparent: true, opacity: TIME === 'malam' ? 0.25 : 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending}));
  beam.geometry.translate(0, -3, 0); beam.rotation.z = Math.PI / 2; const bg = new THREE.Group(); bg.position.set(lx, LH.topY + 0.25, lz); bg.add(beam); scene.add(bg); LH.beam = bg;
}

// ---------- karakter KayKit + animasi ----------
const CH = {};
for (const j of ['Knight', 'Mage', 'Ranger']) CH[j.toUpperCase()] = await load(A + 'chars/' + j + '.glb');
const clips = {};
for (const f of ['General', 'MovementBasic', 'CombatMelee', 'CombatRanged', 'Simulation', 'Tools']) {
  const g = await load(A + 'anim/Rig_Medium_' + f + '.glb'); g.animations.forEach(c => { clips[c.name] = c; });
}
const WPN = {};
for (const n of ['sword_1handed', 'shield_badge_color', 'staff', 'bow_withString', 'spellbook_open', 'wand']) WPN[n] = await load(wpnUrl(n));
const mixers = [];
const CHAR_SCALE = 0.19;
function spawn(job, x, z, yaw, clip, off = 0, scale = CHAR_SCALE, opts = {}) {
  const root = SkeletonUtils.clone(CH[job].scene);
  root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
  const g = new THREE.Group(); g.add(root); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(scale); scene.add(g);
  const hr = root.getObjectByName('handslotr'), hl = root.getObjectByName('handslotl');
  const give = (slot, name) => { if (slot && WPN[name]) slot.add(SkeletonUtils.clone(WPN[name].scene)); };
  if (job === 'KNIGHT') { give(hr, 'sword_1handed'); give(hl, 'shield_badge_color'); }
  if (job === 'MAGE' && !opts.noWeapon) { give(hr, 'staff'); }
  if (job === 'RANGER') { give(hl, 'bow_withString'); }
  if (opts.hideHelmet) { ['Knight_HelmetVisor'].forEach(n => { const o = root.getObjectByName(n); if (o) o.visible = false; }); }
  if (opts.hideHat) { const o = root.getObjectByName('Mage_Hat'); if (o) o.visible = false; }
  const mx = new THREE.AnimationMixer(root); const act = mx.clipAction(clips[clip]); act.play(); mixers.push({mx, off});
  return {g, root, hr, hl};
}

// Budi: Mage tanpa topi + top hat ungu tinggi, kumis, monokel, tongkat orb emas
let BUDI;
{
  BUDI = spawn('MAGE', 1.05, 2.35, 0.25, 'Idle_A', 0.3, 0.27, {hideHat: true, noWeapon: true});
  BUDI.head = BUDI.root.getObjectByName('head');
  const purple = mat(0x5a2d91), band = mat(0xf5c542), blk = mat(0x15101a), gold = mat(0xf0c040, {roughness: 0.3, metalness: 0.5});
  const mk = (g, m, x, y, z, grp) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
  const hat = new THREE.Group();
  mk(new THREE.CylinderGeometry(0.78, 0.78, 0.07, 28), purple, 0, 0, 0, hat);          // brim
  mk(new THREE.CylinderGeometry(0.5, 0.54, 1.25, 28), purple, 0, 0.62, 0, hat);         // crown tinggi
  mk(new THREE.CylinderGeometry(0.555, 0.555, 0.2, 28), band, 0, 0.18, 0, hat);          // pita kuning
  mk(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 28), purple, 0, 1.26, 0, hat);        // tutup
  const face = new THREE.Group();
  mk(new THREE.BoxGeometry(0.62, 0.1, 0.1), blk, 0, 0, 0, face);                          // kumis tebal
  [-0.3, 0.3].forEach(x => { const o = mk(new THREE.SphereGeometry(0.07, 8, 8), blk, x, -0.04, 0, face); });
  mk(new THREE.BoxGeometry(0.2, 0.05, 0.05), blk, -0.25, 0.47, 0.0, face);               // alis kiri
  mk(new THREE.BoxGeometry(0.2, 0.05, 0.05), blk, 0.25, 0.51, 0.0, face);                // alis kanan
  const mon = mk(new THREE.TorusGeometry(0.15, 0.025, 8, 20), gold, 0.27, 0.36, 0.02, face);    // monokel
  BUDI.g.add(hat, face); BUDI.hat = hat; BUDI.face = face;
  const cane = new THREE.Group();
  mk(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 10), gold, 0, 0.9, 0, cane);
  const orb = mk(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({color: 0xffe28a}), 0, 2.08, 0, cane); orb.castShadow = false;
  const L = new THREE.PointLight(0xffd36a, 4.0, 3, 2); L.position.y = 2.08; cane.add(L);
  BUDI.g.add(cane); BUDI.cane = cane;
}

// warga di kota: tersebar di jalan & alun-alun, job dari hash username (deterministik)
const POSES = ['Idle_A', 'Idle_B', 'Walking_A', 'Walking_B', 'Cheering', 'Waving', 'Idle_A'];
const slotsXZ = [];
const jitter = (x, z, rr) => [x + (rnd() - 0.5) * rr, z + (rnd() - 0.5) * rr];
for (const k of roads) { const [q, r] = k.split(',').map(Number); if (HD(q, r) > 6) continue; const [x, z] = XZ(q, r); if (HD(q, r) <= 1 && !(q === 0 && r === 0)) { for (let i = 0; i < 2; i++) slotsXZ.push(jitter(x, z, 1.1)); } else if (rnd() < 0.7) slotsXZ.push(jitter(x, z, 0.7)); }
FEAT.kebun.forEach(([q, r]) => { const [x, z] = XZ(q, r); slotsXZ.push(jitter(x, z, 1.2)); });
{ const [tx, tz] = XZ(...FEAT.theater); for (let i = 0; i < 6; i++) slotsXZ.push([tx - 0.1 + (rnd() - 0.5) * 0.9, tz + (rnd() - 0.5) * 1.2]); }
const filtered = slotsXZ.filter(([x, z]) => Math.hypot(x - 1.05, z - 2.35) > 0.9 && Math.hypot(x + 1.45, z - 1.55) > 0.9 && Math.hypot(x, z) > 1.2);
filtered.slice(0, 80).forEach(([x, z], i) => {
  const w = WARGA[i % WARGA.length]; const pose = POSES[i % POSES.length];
  spawn(w.job, x, z, rnd() * 6.28, pose, rnd() * 2, CHAR_SCALE * (0.92 + rnd() * 0.16), {hideHelmet: i % 3 === 0, hideHat: false});
});
// trio job untuk shot close-up (di lapangan parade cell (1,1))
{
  const [px, pz] = XZ(...FEAT.parade);
  spawn('KNIGHT', px - 0.42, pz + 0.1, 0.2, 'Melee_1H_Attack_Slice_Diagonal', 0.35, 0.21, {hideHelmet: true});
  spawn('MAGE', px, pz - 0.05, 0, 'Ranged_Magic_Spellcasting', 0.5, 0.21);
  spawn('RANGER', px + 0.42, pz + 0.1, -0.2, 'Ranged_Bow_Draw', 0.9, 0.21);
}

// ---------- label ----------
function label(text, x, y, z, w = 2.6, color = '#fff', bg = 'rgba(60,30,110,.92)') {
  const c = document.createElement('canvas'); c.width = 768; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = bg; const r = 40; g.beginPath(); g.roundRect(8, 16, 752, 128, r); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = color; let fs = 58; g.textAlign = 'center'; g.textBaseline = 'middle'; do { g.font = '800 ' + fs + 'px Poppins, Inter, Arial'; fs -= 2; } while (g.measureText(text).width > 700 && fs > 20); g.fillText(text, 384, 82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true})); s.scale.set(w, w * 160 / 768, 1); s.position.set(x, y, z); s.renderOrder = 10; scene.add(s); return s;
}
if (LABELS) {
  const [tx, tz] = XZ(...FEAT.theater); label('GRAND THEATER · usulan @its.vaw_', tx, 2.0, tz, 3.6, '#ffd84a');
  label('KASTIL MAYOR BUDI', ...(() => { const [x, z] = XZ(...FEAT.castle); return [x, 5.0, z]; })(), 3.0, '#ffd84a');
  label('MERCUSUAR · usulan @its.rvliaaa_', LH.x, 4.2, LH.z, 3.8, '#ffd84a');
  const [kx, kz] = XZ(-2, -3); label('KEBUN WARGA', kx, 1.4, kz, 2.2, '#9dff9d');
  const [m1x, m1z] = XZ(...FEAT.market1); label('PASAR', m1x, 1.6, m1z, 1.4);
  const [bx, bz] = XZ(...FEAT.barracks); label('MARKAS KNIGHT', bx, 1.9, bz, 2.4, '#ffb36a');
  const [ax, az] = XZ(...FEAT.archery); label('MARKAS RANGER', ax, 1.7, az, 2.5, '#9dff9d');
  const [mx, mz] = XZ(...FEAT.mage); label('MENARA MAGE', mx, 2.2, mz, 2.3, '#c9b0ff');
  const [px, pz] = XZ(...FEAT.parade); label('LAPANGAN JOB', px, 1.2, pz - 0.6, 1.8);
  label('@' + (WARGA[0] ? WARGA[0].u : 'warga') + ' +9 warga', ...(() => { const c = houseTiles[0]; return [c.x, 1.7, c.z]; })(), 2.4);
  label('KAVLING KOSONG', ...(() => { const c = houseTiles[houseTiles.length - 1]; return [c.x, 1.5, c.z]; })(), 2.0, '#fff', 'rgba(90,90,90,.9)');
}

// ---------- cahaya & kamera ----------
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
const PRESET = {
  sore: {bg: 0xd9a27a, sun: 0xffd9a8, si: 2.4, sp: [-26, 24, 18], hs: 0xbfd0ff, hg: 0x5a6a45, hi: 1.0, exp: 0.9},
  siang: {bg: 0x9cc8ee, sun: 0xfff3dc, si: 2.9, sp: [10, 40, 14], hs: 0xcfe6ff, hg: 0x77885a, hi: 1.15, exp: 1.0},
  malam: {bg: 0x0d1030, sun: 0x8fa8ff, si: 1.7, sp: [-18, 30, 12], hs: 0x4a5ca8, hg: 0x1c2240, hi: 1.7, exp: 1.25},
}[TIME];
scene.background = new THREE.Color(PRESET.bg);
sun.color.setHex(PRESET.sun); sun.intensity = PRESET.si; sun.position.set(...PRESET.sp); sun.target.position.set(0, 0, 0);
hemi.color.setHex(PRESET.hs); hemi.groundColor.setHex(PRESET.hg); hemi.intensity = PRESET.hi;
renderer.toneMappingExposure = PRESET.exp;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({color: TIME === 'malam' ? 0x16402a : 0x3e7a35, roughness: 1})); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.02; ground.receiveShadow = true; scene.add(ground);
if (TIME === 'malam') {
  // lampu di pohon besar, gerbang, jendela rumah (titik kuning)
  for (let i = 0; i < 28; i++) { const a = rnd() * 6.28, rr = 0.4 + rnd() * 1.6; const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({color: 0xffe38a})); s.position.set(Math.cos(a) * rr, 2.2 + rnd() * 2.3, Math.sin(a) * rr); scene.add(s); }
  const tl = new THREE.PointLight(0xffd27a, 30, 16, 2); tl.position.set(0, 2.5, 0.5); scene.add(tl);
  const [gx, gz] = XZ(-3, 6); [-1, 1].forEach(s => { const l = new THREE.PointLight(0xff9a3a, 5, 6, 2); l.position.set(gx + s * 1.0, 1.0, gz + 0.6); scene.add(l); const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({color: 0xffb04a})); f.position.copy(l.position); scene.add(f); });
  houseSlots.slice(0, nHouse).forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), new THREE.MeshBasicMaterial({color: 0xffd36a})); w.position.set(s.x, 0.3, s.z); w.lookAt(0, 0.3, 0); w.translateZ(0.34); scene.add(w); });
}
const CAMS = {
  wide75: {t: [0, 0, 1.5], el: 75, az: 0, d: 100, fov: 28},
  iso45: {t: [0, 0, 1], el: 40, az: -22, d: 78, fov: 30},
  budi: {t: [0.95, 0.65, 2.3], el: 10, az: 14, d: 4.8, fov: 32},
  jobs: {t: [3, 0.42, 2.0], el: 22, az: -4, d: 3.6, fov: 34},
  theater: {t: [6, 0.7, -3.3], el: 28, az: -35, d: 14, fov: 32},
  lighthouse: {t: [-16, 1.4, 6.9], el: 22, az: 38, d: 17, fov: 32},
  gate: {t: [-6, 0.6, 10.4], el: 18, az: 0, d: 12, fov: 32},
  castle: {t: [-1, 1.6, -8.6], el: 24, az: 62, d: 15, fov: 32},
};
const C = CAMS[CAMNAME] || CAMS.wide75;
const el = C.el * Math.PI / 180, az = C.az * Math.PI / 180;
camera.fov = C.fov; camera.updateProjectionMatrix();
camera.position.set(C.t[0] + C.d * Math.sin(az) * Math.cos(el), C.t[1] + C.d * Math.sin(el), C.t[2] + C.d * Math.cos(az) * Math.cos(el));
camera.lookAt(...C.t);

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function followBudi() {
  if (!BUDI) return;
  BUDI.g.updateMatrixWorld(true);
  BUDI.head.getWorldPosition(_v); BUDI.g.worldToLocal(_v);
  BUDI.hat.position.set(_v.x, _v.y + 0.8, _v.z + 0.02);
  BUDI.face.position.set(_v.x, _v.y + 0.2, _v.z + 0.53);
  BUDI.hr.getWorldPosition(_v2); BUDI.g.worldToLocal(_v2); BUDI.cane.position.copy(_v2); BUDI.cane.position.z += 0.12; BUDI.cane.position.x -= 0.05;
}
window.renderFrame = (t = T0) => {
  mixers.forEach(m => m.mx.setTime(t + m.off));
  followBudi();
  if (LH.beam) LH.beam.rotation.y = t * 1.2;
  glowing.forEach((l, i) => { l.intensity = l.intensity; });
  renderer.render(scene, camera);
};
window.renderFrame(T0); window.renderFrame(T0);
window.READY = 1; window.DBG = {BUDI, THREE};
