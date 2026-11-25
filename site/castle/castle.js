// Kastil Pohon Warga — viewer hex medieval (KayKit, CC0 by Kay Lousberg)
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || innerWidth, H = +Q.get('h') || innerHeight;
const LIVE = !Q.get('w');
const TIME = Q.get('time') || 'siang';
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
const MOBILE = LIVE && (Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer:coarse)').matches);
renderer.setPixelRatio(LIVE ? Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2) : 1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W/H, 0.5, 500);

// ---------- loader ----------
const loader = new GLTFLoader();
const cache = {};
const LDP = {d: 0, t: 0, m: 0};
const trk = p => { LDP.t++; const f = () => { LDP.d++; const v = Math.min(96, Math.round(LDP.d / LDP.t * 100)); if (v > LDP.m) LDP.m = v; const e = document.getElementById('ldp'), b = document.getElementById('ldb'); if (e) e.textContent = LDP.m + '%'; if (b) b.style.width = LDP.m + '%'; }; p.then(f, f); return p; };
const load = url => cache[url] || (cache[url] = trk(new Promise((res, rej) => loader.load(url, res, undefined, rej))));
const hexUrl = n => A + 'hex/' + n + '.gltf';
const natUrl = n => A + 'nature/' + n + '.gltf';
const wpnUrl = n => A + 'weapons/' + n + '.gltf';

// ---------- batch instancing untuk semua yang statis ----------
const batches = {};
function put(name, x, y, z, ry = 0, s = 1, sy, sxo) {
  (batches[name] = batches[name] || []).push({x, y, z, ry, sx: sxo ?? s, sy: sy ?? s, sz: s});
}
async function flushBatches() {
  for (const [name, list] of Object.entries(batches)) {
    const url = name.startsWith('L:') ? A + 'lpf/' + name.slice(2) + '.glb' : name.startsWith('N:') ? natUrl(name.slice(2)) : hexUrl(name);
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

// ---------- DATA: followers → warga → rumah ----------
let followers = [];
try { followers = (await (await fetch('_followers.txt')).text()).split(/\r?\n/)
  .map(s => s.trim()).filter(s => s && !s.startsWith('#')); } catch (e) {}
if (!followers.length) followers = Array.from({length: 230}, (_, i) => 'warga' + i);
let JD = {}; try { JD = await (await fetch('jobs.json')).json(); } catch (e) {}
const JMAP = {MAGE: 'MAGE', ARCHER: 'RANGER', SWORDMAN: 'KNIGHT'};
const WARGA = followers.map((u, i) => ({u, job: JMAP[JD[u]] || JOBS[hash(u) % 3], house: Math.floor(i / 10)}));
const JEMO = {KNIGHT: '🛡️', MAGE: '🔮', RANGER: '🏹'};
const titleOf = i => i < 40 ? '🌟 Perintis' : i < 120 ? '🌿 Warga Awal' : '🌱 Warga Baru';   // gelar berdasar urutan bergabung
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
 [2,0],[3,0],
 ].forEach(([q, r]) => addRoad(q, r));
// kavling ring 3 jalan keliling dalam (d=5) sebagian
// sungai di baris r=9
const riverCells = new Set(); for (let q = -R; q <= R; q++) if (HD(q, 9) <= R) riverCells.add(K(q, 9));
// laut barat
const SEA = [-15, 9];
const LHPOS = [7.2, 13.3];
const ARCH = [7, -1.7321]; // markas Ranger (posisi bekas markas Mage)
const KEB = [-6.1, -5.8]; // kebun menempel di dalam pagar barat laut, sisi panjang sejajar tembok
const seaIn = new Set(), seaCoast = new Set();
const seaOut = [];
for (let q = -R - 12; q <= R + 12; q++) for (let r = -R - 12; r <= R + 12; r++) {
  const d = HD(q - SEA[0], r - SEA[1]); const inside = HD(q, r) <= R;
  if (inside ? d <= 4 : d <= 9) { seaIn.add(K(q, r)); if (!inside) seaOut.push([q, r]); }
}
for (const k in cells) { const {q, r} = cells[k]; if (seaIn.has(k)) continue; if (DIRS.some(([dq, dr]) => seaIn.has(K(q+dq, r+dr)))) seaCoast.add(k); }

// bangunan publik & fasilitas (cell → fitur)
const FEAT = {
  balai: [2, -5], theater: [-4, -1], barracks: [4, 0], mage: [4, -1], archery: [5, -1],
  kebun: [[-1,-3], [-2,-2]], tavern: [-2, 2], parade: [1, 1],
};
const reserved = new Set();
const resv = (q, r) => reserved.add(K(q, r));
[FEAT.balai, FEAT.theater, FEAT.barracks, FEAT.archery, FEAT.mage, FEAT.tavern, FEAT.parade, ...FEAT.kebun].forEach(p => resv(p[0], p[1]));
reserved.add(K(0, 0));
roads.forEach(k => reserved.add(k));

// tile dasar
for (const k in cells) {
  const c = cells[k], {q, r} = c; const [x, z] = XZ(q, r); c.x = x; c.z = z;
  if (seaIn.has(k)) { c.tile = {n: 'hex_water', rot: 0}; continue; }
  if (seaCoast.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { if (seaIn.has(K(q+dq, r+dr))) m |= 1 << d; });
    if (m) { c.tile = {...pick(coastTab, m)}; continue; }
  }
  if (k === K(-3, 9)) { c.tile = {n: 'hex_river_crossing_A', rot: 0}; continue; }
  if (riverCells.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { if (riverCells.has(K(q+dq, r+dr)) || seaIn.has(K(q+dq, r+dr))) m |= 1 << d; });
    c.tile = {...pick(riverTab, m || 9)}; continue;
  }
  if (roads.has(k)) {
    let m = 0; DIRS.forEach(([dq, dr], d) => { const nk = K(q+dq, r+dr); if (roads.has(nk) || nk === K(-3, 9)) m |= 1 << d; });
    c.tile = m ? {...pick(roadTab, m)} : {n: 'hex_grass', rot: 0}; continue;
  }
  c.tile = {n: 'hex_grass', rot: 0};
}
const grassCells = [];
for (const k in cells) { const c = cells[k]; if (c.tile.n === 'hex_grass') { grassCells.push(c); continue; } put(c.tile.n, c.x, 0, c.z, c.tile.rot * Math.PI / 3, 1.025, 1, 1.025); }
seaOut.forEach(([q, r]) => { const [x, z] = XZ(q, r); put('hex_water', x, 0, z, 0, 1.025, 1, 1.025); });

const cellXZ = (q, r) => XZ(q, r);
const CENTER = [0, 0];

// ---------- tembok ring d=6 ----------
for (let k = 0; k < 6; k++) {
  const [cq, cr] = [DIRS[k][0]*6, DIRS[k][1]*6]; const [x, z] = XZ(cq, cr); (window.TOWERS = window.TOWERS || []).push([x, z]);
  put((k === 0 || k === 3 || k === 2) ? 'building_tower_A_yellow' : 'building_tower_catapult_yellow', x, 0, z, 0, 1);
  const sd = DIRS[(k + 2) % 6]; const ang = ((k + 2) % 6) * Math.PI / 3;
  const segs = (k === 4) ? [[0.5, 1], [1.5, 1], [2.25, 0.5], [3, 0], [3.75, 0.5], [4.5, 1], [5.5, 1]] : [[0.5, 1], [1.5, 1], [2.5, 1], [3.5, 1], [4.5, 1], [5.5, 1]];
  for (const [i, ls] of segs) {
    const q = cq + sd[0]*i, r = cr + sd[1]*i; const [wx, wz] = XZ(q, r);
    if (ls === 0) put('wall_straight_gate', wx, 0, wz, ang, 1); else put('wall_straight', wx, 0, wz, ang, 1, 1, ls);
  }
}

// ---------- rumah warga: kecil, baris rapi (1 rumah = 10 warga) ----------
const nHouse = Math.ceil(WARGA.length / 10);
const HOUSE_SC = 0.95;
const houseSlots = [];
{
  const colsL = [-1.8, -3.0, -4.2, -5.4, -6.6], colsR = [2.8, 4.0, 5.2, 6.4, 7.6], rows = [4.6, 5.85, 7.1];
  const pts = [];
  for (const x of [...colsL, ...colsR]) for (const z of rows) { const lim = 12 - Math.abs(z) * 0.5774 - 1.4; if (Math.abs(x) > lim) continue; if (Math.hypot(x - ARCH[0], z - ARCH[1]) < 2.3) continue; pts.push({x, z}); }
  pts.sort((a, b) => Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5) || a.z - b.z || a.x - b.x);
  pts.forEach((p, i) => houseSlots.push({x: p.x, z: p.z, i}));
}
window.HOUSE_N = houseSlots.length;
const HCOL = ['blue', 'red', 'green'];
houseSlots.slice(0, nHouse).forEach(s => put('building_home_' + (s.i % 5 === 4 ? 'B' : 'A') + '_' + HCOL[Math.floor(s.i / 4) % 3], s.x, 0, s.z, 0, HOUSE_SC));



// ---------- bayangan kontak (blob lembut di bawah bangunan & karakter) ----------
const BLOBTEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const BLOBMAT = new THREE.MeshBasicMaterial({map: BLOBTEX, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
const BLOBGEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function blob(x, z, r, op = 1, parent = scene, y = 0.03) { const m = new THREE.Mesh(BLOBGEO, op === 1 ? BLOBMAT : BLOBMAT.clone()); if (op !== 1) m.material.opacity = op; m.scale.set(r * 2, 1, r * 2); m.position.set(x, y, z); m.renderOrder = 2; parent.add(m); return m; }

// ---------- fasilitas & publik ----------
{
  const [bx0, bz0] = XZ(...FEAT.balai); put('building_home_B_red', bx0, 0, bz0, Math.atan2(-bx0, -bz0), 1.55); put('flag_yellow', bx0 + 1.0, 0, bz0 + 0.6, 0, 1); put('flag_yellow', bx0 - 1.0, 0, bz0 + 0.6, 0, 1);
  const [bx, bz] = XZ(...FEAT.barracks); put('building_barracks_red', bx, 0, bz, Math.atan2(-bx, -bz), 1);
  const [ax, az] = ARCH; put('building_archeryrange_yellow', ax, 0, az, Math.atan2(-ax, -az), 1); put('target', ax + 0.9, 0, az + 0.5, -0.6, 1);
}

// ---------- pohon: pak Low Poly Forest (Devilswork) — sedikit di dalam, hutan kecil di ujung peta ----------
const LT = ['L:tree01', 'L:tree03', 'L:treeTall01', 'L:tree01', 'L:treeTall03', 'L:tree03'];
const LTq = Q.get('lt'); if (LTq) { const keep = LTq.split(',').map(Number); const all = LT.slice(); LT.length = 0; keep.forEach(i => LT.push(all[i])); }
const tsc = n => n.includes('Tall') ? 2.4 : n.includes('Round') ? 2.0 : 1.8;
const tree = (x, z, i, k = 1) => { const n = LT[((i % LT.length) + LT.length) % LT.length]; put(n, x, 0, z, i * 1.7, tsc(n) * k); };
const inMap = (x, z, m = 1.3) => { const r = z / 1.7320508, q = (x - r) / 2; return HD(q, r) <= R - m; };
[[-4.6, -0.3], [-0.6, -5.6], [12.6, 4.6], [1.6, 12.8]].forEach(([x, z], i) => { if (inMap(x, z)) tree(x, z, i + 3, 0.9); });

// ---------- isi lahan kosong: semak, batu, rumput (dekat tembok & di luar tembok) ----------
{
  let sd = 9; const rr = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const avoid = [[0, 0, 3.2], [ARCH[0], ARCH[1], 2.6], [KEB[0], KEB[1], 2.8], [-3.55, 1.5, 2.2], [LHPOS[0], LHPOS[1], 2.5], [...XZ(-3, 6), 2.6], [-0.2, 4.2, 1.6]];
  [FEAT.balai, FEAT.theater, FEAT.barracks, FEAT.archery, FEAT.mage, FEAT.tavern, FEAT.parade].forEach(p => avoid.push([...XZ(...p), 2.3]));
  houseSlots.forEach(h => avoid.push([h.x, h.z, 1.5]));
  const BUSH = ['N:Bush_1_A_Color1', 'N:Bush_1_C_Color1', 'N:Bush_2_A_Color1', 'N:Bush_3_A_Color1', 'N:Bush_4_A_Color1'];
  let n = 0;
  for (let t = 0; t < 4000 && n < 70; t++) {
    const x = (rr() - 0.5) * 30, z = (rr() - 0.5) * 30;
    if (!inMap(x, z, 0.9)) continue;
    if (x < -8 && z > -3 && z < 12) continue;                                  // hutan barat & air
    const d = 12 - Math.abs(z) * 0.5774 - Math.abs(x);                         // >0 = di dalam tembok
    if (!((d > 0.9 && d < 2.4) || (d < -1.0 && d > -4.5))) continue;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const kind = rr();
    if (kind < 0.6) put(BUSH[Math.floor(rr() * BUSH.length)], x, 0, z, rr() * 6.28, 0.9 + rr() * 0.5);
    else put('rock_single_' + 'ABCDE'[Math.floor(rr() * 5)], x, 0, z, rr() * 6.28, 0.9 + rr() * 0.6);
    n++;
  }
  window.SCATTER = n;
}

{ // hutan lebat di sisi barat peta
  const rr = (() => { let q = 77; return () => (q = (q * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const [sx0, sz0] = XZ(...SEA); let n = 0, i = 0;
  for (let z = -17; z <= 17; z += 1.35) for (let x = -32; x <= -14.5; x += 1.35) {
    const px = x + (rr() - 0.5) * 0.9, pz = z + (rr() - 0.5) * 0.9;
    if (!inMap(px, pz, 1.4)) continue;
    const r2 = pz / 1.7320508, q2 = (px - r2) / 2; if (HD(q2 - SEA[0], r2 - SEA[1]) < 5.6) continue;
    tree(px, pz, i++, 0.8 + rr() * 0.55); n++;
  }
  window.FOREST_N = n;
}
{ const [gx, gz] = XZ(-3, 6); put('flag_yellow', gx - 1.0, 0, gz + 0.5, 0, 1); put('flag_yellow', gx + 1.0, 0, gz + 0.5, 0, 1); }

// ---------- POHON BESAR (ikon) ----------


await flushBatches();
houseSlots.slice(0, nHouse).forEach(h => blob(h.x, h.z, 0.8, 0.9));
(window.TOWERS || []).forEach(([x, z]) => blob(x, z, 1.0, 0.9));
[FEAT.balai, FEAT.theater, FEAT.barracks, FEAT.archery, FEAT.mage, FEAT.tavern, FEAT.parade].forEach(p => { const [x, z] = XZ(...p); blob(x, z, 1.25, 0.8); });
blob(0, 0, 2.2, 0.8);


// lantai rumput: satu permukaan mulus (tanpa garis kotak hexagon), tile jalan/sungai/pantai tetap hexagon
{
  const gg = await load(hexUrl('hex_grass')); gg.scene.updateMatrixWorld(true);
  let top = -1e9, bot = 1e9, tm = null, ti = 0; const v = new THREE.Vector3();
  gg.scene.traverse(o => { if (!o.isMesh) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (v.y > top) { top = v.y; tm = o; ti = i; } if (v.y < bot) bot = v.y; } });
  let gcol = new THREE.Color(0x8fc152);
  try { const uv = tm.geometry.attributes.uv, im = tm.material.map.image; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0); const d = cx.getImageData(Math.min(im.width - 1, Math.floor(uv.getX(ti) * im.width)), Math.min(im.height - 1, Math.floor(uv.getY(ti) * im.height)), 1, 1).data; gcol = new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace); } catch (e) {}
  const Rh = 2 / Math.sqrt(3) * 1.004;
  const geo = new THREE.CylinderGeometry(Rh, Rh, top - bot, 6, 1); geo.translate(0, (top + bot) / 2, 0);
  const sideC = gcol.clone().multiplyScalar(0.55);
  const mt = new THREE.MeshStandardMaterial({color: gcol, roughness: 1}), ms = new THREE.MeshStandardMaterial({color: sideC, roughness: 1});
  const im2 = new THREE.InstancedMesh(geo, [ms, mt, ms], grassCells.length); im2.receiveShadow = true; im2.castShadow = false;
  const M = new THREE.Matrix4(), col = new THREE.Color();
  grassCells.forEach((c, i) => { M.makeTranslation(c.x, 0, c.z); im2.setMatrixAt(i, M); const n = Math.sin(c.x * 0.19 + 1.3) * Math.sin(c.z * 0.23 - 0.4) * 0.5 + Math.sin(c.x * 0.07 + c.z * 0.11) * 0.5; col.setScalar(0.95 + 0.07 * n); im2.setColorAt(i, col); });
  scene.add(im2); window.GRASS = {top, bot, n: grassCells.length};
}

// ---------- objek kode: telur, theater, mercusuar, portal ----------
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.7, metalness: 0}, o));
const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; scene.add(o); return o; };
const glowing = []; // objek yang berdenyut

const animFns = [];
const grp = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); return g; };
const add = (par, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; par.add(o); return o; };

// PORTAL: lubang gelap bergerigi, tepi merah menyala, asap hitam + bara oranye (referensi Day 4)
const PORTAL = grp(-3.55, 0, 1.5); window.PORTAL = PORTAL;
{
  const pu = {t: {value: 0}};
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.ShaderMaterial({uniforms: pu, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float t;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
    float edge(float a){float s=sin(5.*a+.7)*.6+sin(9.*a+2.)*.4+sin(13.*a+t*.6)*.12;return .56+.4*pow(clamp(.5+.5*s,0.,1.),3.);}
    void main(){ vec2 p=vUv*2.-1.; float r=length(p); if(r>1.) discard;
      float a=atan(p.y,p.x); float e=edge(a);
      if(r>e){ float g=1.-(r-e)/.2; if(g<=0.) discard; gl_FragColor=vec4(1.,.22,.16,g*g*.75); return; }
      float sw=a+t*.35*(1.4-r); vec2 u=vec2(cos(sw),sin(sw))*r*2.6;
      float sm=fbm(u+vec2(0.,t*.15)); sm=sm*sm;
      vec3 col=mix(vec3(.015,.004,.01),vec3(.2,.035,.05),sm*1.6);
      col+=smoothstep(e-.22,e,r)*vec3(1.,.28,.2)*1.15;
      gl_FragColor=vec4(col,.98); }`}));
  PORTAL.add(disc);
  { // bingkai gerbang batu medieval (portal tidak lagi tampak 2D)
    const sm = new THREE.MeshStandardMaterial({color: 0x6b6672, roughness: 0.95, flatShading: true}), sm2 = new THREE.MeshStandardMaterial({color: 0x514c58, roughness: 0.95, flatShading: true});
    const N = 16;
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.42), i % 2 ? sm : sm2); b.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0); b.rotation.z = a + Math.PI / 2; b.castShadow = true; b.receiveShadow = true; PORTAL.add(b); }
    [-1, 1].forEach(sx => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.55), sm2); p.position.set(sx * 1.05, -1.55, 0); p.castShadow = true; PORTAL.add(p); });
  }
  // sulur gelap melengkung dari tepi
  const tm = new THREE.MeshStandardMaterial({color: 0x160a0c, roughness: 0.9, flatShading: true, emissive: 0x3a0808, emissiveIntensity: 0.5});
  const tendrils = [];
  for (let i = 0; i < 0; i++) {
    const a = i / 7 * 6.283 + 0.35, d = i % 2 ? 1 : -1, L = 0.5 + (i * 37 % 10) / 14;
    const pts = [1.12, 1.25, 1.25 + L * 0.35, 1.25 + L * 0.6].map((rr, k) => { const aa = a + d * k * 0.2; return new THREE.Vector3(Math.cos(aa) * rr, Math.sin(aa) * rr, 0.02 * k); });
    const tb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.045 - (i % 3) * 0.008, 5), tm); tb.castShadow = false; PORTAL.add(tb); tendrils.push(tb);
  }
  PORTAL.position.y = 1.15; PORTAL.rotation.set(-0.45, 0.5, 0);
  const pl = new THREE.PointLight(0xff3a2a, 6, 7, 2); pl.position.set(0, 0, 0.7); PORTAL.add(pl); glowing.push(pl);
  // bara oranye melayang
  const ec = document.createElement('canvas'); ec.width = ec.height = 64; { const g = ec.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(.35, 'rgba(255,120,40,1)'); gr.addColorStop(.6, 'rgba(255,90,30,.5)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const EN = 46, ep = new Float32Array(EN * 3), ev = [], eph = [];
  for (let k = 0; k < EN; k++) { const a = Math.random() * 6.28, rr = 0.5 + Math.random() * 1.9; ep.set([Math.cos(a) * rr, Math.random() * 2.6, Math.sin(a) * rr], k * 3); ev.push(0.12 + Math.random() * 0.25); eph.push(Math.random() * 6.28); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({map: new THREE.CanvasTexture(ec), size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  const EG = grp(-3.55, 0.2, 1.5); EG.add(embers); window.EMBERS = EG;
  let lt = 0;
  animFns.push(t => {
    const dt = Math.min(0.1, Math.max(0, t - lt)); lt = t; pu.t.value = t;
    tendrils.forEach((tb, k) => { tb.rotation.z = Math.sin(t * 0.9 + k * 1.3) * 0.06; });
    const p = eg.attributes.position; for (let k = 0; k < EN; k++) { let y = p.getY(k) + ev[k] * dt; if (y > 2.8) y = 0; p.setY(k, y); p.setX(k, p.getX(k) + Math.sin(t * 1.3 + eph[k]) * 0.002); } p.needsUpdate = true;
    pl.intensity = 5 + Math.sin(t * 3) * 1.2;
  });
}


// POHON BESAR di tengah: low-poly batang cokelat melebar di pangkal, cabang, tajuk hijau terang berfaset (referensi user)
{
  let sd = 33; const R3 = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const fm = c => new THREE.MeshStandardMaterial({color: c, roughness: 0.9, flatShading: true});
  const T = grp(0, 0, 0); window.GIANT = T;
  const BR1 = 0xb98b62, BR2 = 0x946a47;
  const GR = [0x5db944, 0x6fd15a, 0x4fa83c, 0x7bdc63, 0x63c24b, 0x58b040];
  const add2 = (m) => { m.castShadow = true; m.receiveShadow = true; T.add(m); return m; };
  // batang: tabung 7 sisi, melebar di bawah, sedikit meliuk
  { const g = new THREE.CylinderGeometry(0.34, 0.62, 2.6, 7, 4); const P = g.attributes.position; for (let k = 0; k < P.count; k++) { const y = P.getY(k); P.setX(k, P.getX(k) + Math.sin(y * 1.6) * 0.05); P.setZ(k, P.getZ(k) * (1 + (R3() - 0.5) * 0.1)); } g.computeVertexNormals(); const m = add2(new THREE.Mesh(g, fm(BR1))); m.position.y = 1.3; }
  // akar melebar
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.3; const m = add2(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 4), fm(BR2))); m.position.set(Math.cos(a) * 0.62, 0.22, Math.sin(a) * 0.62); m.rotation.z = Math.cos(a) * 0.9; m.rotation.x = -Math.sin(a) * 0.9; }
  const flare = add2(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.95, 0.35, 7), fm(BR1))); flare.position.y = 0.17;
  // cabang
  const tips = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + R3() * 0.5, len = 1.7 + R3() * 0.6, up = 0.85 + R3() * 0.25;
    const dir = new THREE.Vector3(Math.cos(a) * 0.75, up, Math.sin(a) * 0.75).normalize(); const base = new THREE.Vector3(0, 2.3 + R3() * 0.4, 0);
    const m = add2(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, len, 6), fm(k % 2 ? BR2 : BR1))); m.position.copy(base).addScaledVector(dir, len / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tips.push(base.clone().addScaledVector(dir, len)); }
  // tajuk: gumpalan faset besar, kubah lebar
  const pod = (x, y, z, r, sx = 1, sy = 0.78) => { const g = R3() < 0.5 ? new THREE.IcosahedronGeometry(r, 0) : new THREE.DodecahedronGeometry(r, 0); const m = add2(new THREE.Mesh(g, fm(GR[Math.floor(R3() * GR.length)]))); m.position.set(x, y, z); m.scale.set(sx, sy, sx * (0.9 + R3() * 0.2)); m.rotation.set(R3() * 3, R3() * 6, R3() * 3); return m; };
  tips.forEach(t => { pod(t.x, t.y + 0.15, t.z, 0.85 + R3() * 0.2); });
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + R3() * 0.4, rd = 1.5 + R3() * 0.9; pod(Math.cos(a) * rd, 3.5 + R3() * 0.5 - rd * 0.12, Math.sin(a) * rd, 0.7 + R3() * 0.25); }
  for (let k = 0; k < 7; k++) { const a = R3() * 6.283, rd = R3() * 1.4; pod(Math.cos(a) * rd, 4.15 + R3() * 0.5, Math.sin(a) * rd, 0.8 + R3() * 0.3); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.2 + R3() * 0.3, rd = 2.3 + R3() * 0.5; pod(Math.cos(a) * rd, 2.75 + R3() * 0.35, Math.sin(a) * rd, 0.55 + R3() * 0.2); }
  T.scale.setScalar(1.0);
}

// GRAND THEATER: gedung bioskop merah 3 lantai (referensi user)
{
  const [tx, tz] = XZ(...FEAT.theater);
  const T = grp(tx, 0, tz); T.rotation.y = Math.atan2(-tx, -tz); const SC = 0.95; T.scale.setScalar(SC);
  const red = mat(0xd9444a, {roughness: 0.55}), cream = mat(0xf3e2cc, {roughness: 0.6}), gold = mat(0xf2b335, {roughness: 0.35, metalness: 0.3}), dark = mat(0x2b3a52), lav = mat(0xb8a9c9, {roughness: 0.7}), pane = mat(0x6b4a34), blind = mat(0xd8b684), redD = mat(0xb8343c);
  add(T, new THREE.BoxGeometry(1.8, 0.06, 1.5), lav, 0, 0.03, 0);
  add(T, new THREE.BoxGeometry(1.34, 2.25, 0.95), red, 0, 1.18, -0.05);                    // badan
  [-1, 1].forEach(sx => add(T, new THREE.BoxGeometry(0.12, 0.12, 1.0), gold, sx * 0.62, 0.12, -0.05));
  [0.78, 1.5, 2.2].forEach((y, i) => add(T, new THREE.BoxGeometry(1.44 + (i === 2 ? 0.08 : 0), 0.07, 1.05 + (i === 2 ? 0.08 : 0)), cream, 0, y, -0.05)); // list krem
  add(T, new THREE.BoxGeometry(1.5, 0.22, 1.12), red, 0, 2.34, -0.05);                      // parapet
  { // atap medieval: dua sisi miring genteng cokelat-merah + bubungan + balok kayu
    const tile = mat(0x8a3b2c, {roughness: 0.8}), wood = mat(0x5a3a22, {roughness: 0.9});
    [-1, 1].forEach(sd => { const r = add(T, new THREE.BoxGeometry(1.7, 0.06, 0.78), tile, 0, 2.74, -0.05 + sd * 0.33); r.rotation.x = sd * 0.62; });
    add(T, new THREE.BoxGeometry(1.74, 0.09, 0.1), wood, 0, 3.02, -0.05);
    [-1, 1].forEach(sx => add(T, new THREE.BoxGeometry(0.07, 2.2, 0.07), wood, sx * 0.64, 1.18, 0.5));    // tiang kayu depan
    [0.78, 1.5, 2.2].forEach(y => add(T, new THREE.BoxGeometry(1.34, 0.06, 0.05), wood, 0, y + 0.07, 0.5));
    [-1, 1].forEach(sx => { const d = add(T, new THREE.BoxGeometry(0.05, 0.62, 0.05), wood, sx * 0.32, 1.88, 0.5); d.rotation.z = sx * 0.6; });
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(T, new THREE.SphereGeometry(0.07, 12, 10), redD, a * 0.7, 2.5, -0.05 + b * 0.52));
  // jendela lantai 2-3
  [-0.4, 0, 0.4].forEach(x => { add(T, new THREE.BoxGeometry(0.28, 0.5, 0.04), cream, x, 1.15, 0.45); add(T, new THREE.BoxGeometry(0.2, 0.42, 0.05), pane, x, 1.15, 0.47); add(T, new THREE.BoxGeometry(0.2, 0.18, 0.055), blind, x, 1.26, 0.475); });
  [-0.4, 0, 0.4].forEach(x => { add(T, new THREE.BoxGeometry(0.2, 0.32, 0.04), cream, x, 1.85, 0.45); add(T, new THREE.BoxGeometry(0.14, 0.26, 0.05), pane, x, 1.85, 0.47); });
  // lengkung emas di atas
  const arch = add(T, new THREE.CircleGeometry(0.4, 32, 0, Math.PI), gold, 0, 2.2, 0.44); arch.castShadow = false;
  const arch2 = add(T, new THREE.CircleGeometry(0.28, 32, 0, Math.PI), cream, 0, 2.2, 0.445); arch2.castShadow = false;
  for (let i = 0; i < 7; i++) { const a = Math.PI * (i + 0.5) / 7; const b = add(T, new THREE.BoxGeometry(0.035, 0.2, 0.01), i % 2 ? redD : gold, Math.cos(a) * 0.2, 2.2 + Math.sin(a) * 0.2, 0.45); b.rotation.z = a - Math.PI / 2; b.castShadow = false; }
  // tulisan TEATER
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = '#d9444a'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#f7c548'; g.font = '900 78px Poppins, Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TEATER', 256, 52);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.19), new THREE.MeshBasicMaterial({map: t})); pl.position.set(0, 1.64, 0.431); T.add(pl); }
  // lantai dasar: kanopi merah, pintu, tiang krem
  const aw = add(T, new THREE.BoxGeometry(1.46, 0.07, 0.42), red, 0, 0.66, 0.6); aw.rotation.x = 0.28; add(T, new THREE.BoxGeometry(1.46, 0.025, 0.43), gold, 0, 0.6, 0.62).rotation.x = 0.28;
  [-0.45, 0, 0.45].forEach(x => add(T, new THREE.BoxGeometry(0.22, 0.44, 0.04), dark, x, 0.3, 0.44));
  [-0.66, -0.22, 0.22, 0.66].forEach(x => add(T, new THREE.BoxGeometry(0.07, 0.56, 0.07), cream, x, 0.34, 0.5));
  // papan marquee vertikal emas di sisi kiri
  add(T, new THREE.BoxGeometry(0.07, 0.95, 0.22), gold, -0.72, 1.2, 0.38);
  for (let i = 0; i < 5; i++) add(T, new THREE.SphereGeometry(0.022, 6, 6), cream, -0.76, 0.85 + i * 0.18, 0.38);
  // tiang lampu depan
  [-0.6, 0, 0.6].forEach(x => { add(T, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), dark, x, 0.28, 0.72); add(T, new THREE.SphereGeometry(0.03, 8, 6), mat(0xfff0b0, {emissive: 0xffe08a, emissiveIntensity: 1}), x, 0.52, 0.72); });
  const tl = new THREE.PointLight(0xffd7a0, 3, 4, 2); tl.position.set(0, 0.6, 1.0); T.add(tl); glowing.push(tl);
  window.THEATER = T;
}

// Kebun warga: gaya KayKit (petak tanah, tanaman, pagar kayu, karung & gerobak)
{
  const K = new THREE.Group(); K.position.set(KEB[0], 0, KEB[1]); K.rotation.y = Math.PI / 3; scene.add(K); window.KEBUN = K;
  const fm = (c, r = 0.9) => new THREE.MeshStandardMaterial({color: c, roughness: r, flatShading: true});
  const bx = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fm(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; K.add(m); return m; };
  bx(2.5, 0.04, 1.45, 0x7bbf5a, 0, 0.02, 0);                                   // alas rumput terang
  const crops = [0x5fcf4a, 0xf0c13a, 0xe2573e];
  for (let i = 0; i < 3; i++) {
    const z = -0.42 + i * 0.42; bx(2.1, 0.1, 0.3, 0x7a5237, 0, 0.07, z);        // bedengan tanah
    for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(i === 0 ? new THREE.ConeGeometry(0.08, 0.2, 5) : new THREE.IcosahedronGeometry(0.075, 0), fm(crops[i])); c.position.set(-0.9 + k * 0.3, 0.2, z); c.castShadow = true; K.add(c); }
  }
  const wood = 0x8a5a36;                                                       // pagar kayu
  for (let k = 0; k <= 6; k++) { bx(0.06, 0.3, 0.06, wood, -1.2 + k * 0.4, 0.17, 0.72); bx(0.06, 0.3, 0.06, wood, -1.2 + k * 0.4, 0.17, -0.72); }
  [0.12, 0.24].forEach(y => { bx(2.5, 0.04, 0.04, wood, 0, y, 0.72); bx(2.5, 0.04, 0.04, wood, 0, y, -0.72); });
  [-1, 1].forEach(sx => { for (let k = 0; k <= 3; k++) bx(0.06, 0.3, 0.06, wood, sx * 1.2, 0.17, -0.72 + k * 0.48); });
  // orang-orangan sawah
  bx(0.05, 0.55, 0.05, wood, 1.0, 0.3, 0.45); bx(0.4, 0.05, 0.05, wood, 1.0, 0.5, 0.45); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), fm(0xf2d27a)); hd.position.set(1.0, 0.62, 0.45); K.add(hd);
  const bp = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 8), fm(0xc99a3a)); bp.position.set(1.0, 0.7, 0.45); K.add(bp);
}
// Mercusuar: tower_base KayKit diperpanjang + ruang lampu + atap
const LH = {};
{
  const [lx, lz] = LHPOS;
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
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 24, 1, true), new THREE.MeshBasicMaterial({color: 0xfff1a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending}));
  beam.geometry.translate(0, -3, 0); beam.rotation.z = Math.PI / 2; const bg = new THREE.Group(); bg.position.set(lx, LH.topY + 0.25, lz); bg.add(beam); scene.add(bg); LH.beam = bg;
}


// ---------- karakter KayKit + animasi ----------
const CH = {};
for (const j of ['Knight', 'Mage', 'Ranger']) CH[j.toUpperCase()] = await load(A + 'chars/' + j + '.glb');
const clips = {};
{ const g = await load(A + 'anim_min.glb'); g.animations.forEach(c => { clips[c.name] = c; }); }   // hanya ~20 gerakan yang dipakai (1,3 MB, dulu 7,8 MB)
const WPN = {};
for (const n of ['sword_1handed', 'shield_badge_color', 'staff', 'bow_withString', 'spellbook_open', 'wand']) WPN[n] = await load(wpnUrl(n));
const mixers = [];
const CHAR_SCALE = 0.19;
function spawn(job, x, z, yaw, clip, off = 0, scale = CHAR_SCALE, opts = {}) {
  const root = SkeletonUtils.clone(CH[job].scene);
  root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
  const g = new THREE.Group(); g.add(root); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(scale); scene.add(g); blob(0, 0, 2.4, 0.7, g, 0.04);
  const hr = root.getObjectByName('handslotr'), hl = root.getObjectByName('handslotl');
  const give = (slot, name) => { if (slot && WPN[name]) slot.add(SkeletonUtils.clone(WPN[name].scene)); };
  if (job === 'KNIGHT') { give(hr, 'sword_1handed'); give(hl, 'shield_badge_color'); }
  if (job === 'MAGE' && !opts.noWeapon) { give(hr, 'staff'); }
  if (job === 'RANGER') { give(hl, 'bow_withString'); const bw = hl && hl.children[hl.children.length - 1]; if (bw) bw.rotation.y = Math.PI; }
  if (opts.hideHelmet) { ['Knight_HelmetVisor'].forEach(n => { const o = root.getObjectByName(n); if (o) o.visible = false; }); }
  if (opts.hideHat) { const o = root.getObjectByName('Mage_Hat'); if (o) o.visible = false; }
  const mx = new THREE.AnimationMixer(root); const act = mx.clipAction(clips[clip]); act.play(); mixers.push({mx, off});
  return {g, root, hr, hl};
}

// Mayor Budi: badan KayKit Ranger + topi mage, kumis & jenggot hitam panjang, monokel, baju/lengan merah, syal merah tua, tongkat kuning.
// Siklus: diam -> topi terbang ditiup angin -> Budi kejar & lompat tangkap -> jalan pelan keliling kota -> pulang.
let BUDI;
{
  const HOME = [1.05, 2.35], HYAW = 0.25;
  const sp = spawn('RANGER', HOME[0], HOME[1], HYAW, 'Idle_A', 0.3, 0.3, {});
  const bmx = mixers.pop().mx; // dikendalikan manual di BUDI.tick
  const {g, root, hr, hl} = sp; if (hl) while (hl.children.length) hl.remove(hl.children[0]); g.scale.set(0.36, 0.3, 0.34);
  const bone = (...ns) => { for (const n of ns) { const o = root.getObjectByName(n); if (o) return o; } return null; };
  const head = bone('head', 'Head');
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({color: c, roughness: 0.7, flatShading: true}, o));
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const shd = (mat, key, code) => { mat.onBeforeCompile = sd => { sd.fragmentShader = sd.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + code); }; mat.customProgramCacheKey = () => key; mat.needsUpdate = true; return mat; };
  window.BUDI_BONES = []; root.traverse(o => { if (o.isBone) window.BUDI_BONES.push(o.name); });
  let hatM = null;
  if (head) {
    const mg = SkeletonUtils.clone(CH.MAGE.scene); mg.updateMatrixWorld(true);
    const mh = mg.getObjectByName('Mage_Hat'), mhead = mg.getObjectByName('head');
    if (mh && mhead) {
      hatM = new THREE.Mesh(mh.geometry, mh.material); hatM.name = 'BudiHat'; hatM.castShadow = true; hatM.frustumCulled = false;
      const Mx = mhead.matrixWorld.clone().invert().multiply(mh.matrixWorld);
      hatM.matrixAutoUpdate = false; hatM.matrix.copy(new THREE.Matrix4().makeScale(1.3, 1.3, 1.3).multiply(Mx)); hatM.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0));
      head.add(hatM);
    }
    const blk = M(0x17131b, {roughness: 0.95});
    // kumis panjang (gaya stang), ujung agak turun
    { const c = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), blk); c.scale.set(1.5, 0.75, 0.9); head.add(at(c, 0, 0.12, 0.44)); }
    [-1, 1].forEach(sx => { const d = 0.38, c = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.4, 8), blk); c.rotation.z = -sx * (Math.PI / 2 + d); c.scale.z = 0.8; head.add(at(c, sx * (0.07 + 0.2 * Math.cos(d)), 0.12 - 0.2 * Math.sin(d), 0.42)); });
    // jenggot panjang lancip
    { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.015, 0.8, 9), blk); b.scale.z = 0.55; head.add(at(b, 0, -0.36, 0.36)); }
    // monokel: bingkai emas + kaca + tali kecil
    const gold = M(0xf2c230, {metalness: 0.6, roughness: 0.3});
    const mono = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 18), gold); head.add(at(mono, 0.17, 0.3, 0.45));
    head.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), new THREE.MeshStandardMaterial({color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2})), 0.17, 0.3, 0.452));
    { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), gold); ch.rotation.z = 0.35; head.add(at(ch, 0.27, 0.12, 0.42)); }
  }
  { // recolor: rambut -> hitam, baju & lengan -> merah, syal -> merah tua
    const lin = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    const HAIR = [[178,112,82],[200,133,95],[155,90,69],[125,61,44],[157,92,70],[176,110,81],[174,108,80],[160,95,72],[158,93,71],[173,107,79],[175,109,80]].map(c => lin(...c));
    const RED = 'vec3(0.70,0.025,0.04)';
    root.traverse(m => { if (!(m.isMesh && m.material && m.material.name === 'ranger')) return; m.material = m.material.clone();
      let code = '{ vec3 c=diffuseColor.rgb; float l=dot(c,vec3(0.3,0.5,0.2));\n';
      if (m.name === 'Ranger_Head') code += HAIR.map(h => `if(distance(c,vec3(${h.r.toFixed(4)},${h.g.toFixed(4)},${h.b.toFixed(4)}))<0.035) diffuseColor.rgb=vec3(0.025,0.02,0.03);`).join('\n');
      if (m.name === 'Ranger_Body') code += `if(c.b>c.r*1.3) diffuseColor.rgb=vec3(0.36,0.02,0.035)*(0.55+1.4*l); else if(c.b<c.r*1.2 && l>0.3) diffuseColor.rgb=${RED}*(0.35+0.65*l);`;
      if (/Ranger_Arm/.test(m.name)) code += `bool skin = c.r>0.6 && c.g<c.r*0.7; if(!skin) diffuseColor.rgb=${RED}*(0.45+0.9*l);`;
      if (m.name === 'Ranger_Cape') code += `if(c.b>c.r) diffuseColor.rgb=vec3(0.36,0.02,0.035)*(0.55+1.4*l);`;
      code += '\n}';
      shd(m.material, 'budi_' + m.name, code); });
  }
  if (hr && WPN.staff) {
    const st = SkeletonUtils.clone(WPN.staff.scene); hr.add(st);
    st.traverse(m => { if (m.isMesh && m.material) { m.material = shd(m.material.clone(), 'budi_staff', '{ vec3 c=diffuseColor.rgb; if(c.g>c.r*1.25 && c.g>c.b*1.1) diffuseColor.rgb=vec3(1.0,0.74,0.06)*(0.5+0.9*c.g); }'); } });
    const bb = new THREE.Box3().setFromObject(WPN.staff.scene);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({color: 0xffd23a})); cr.scale.y = 1.4; cr.position.set(0, bb.max.y + 0.1, 0); st.add(cr);
    const L = new THREE.PointLight(0xffc83a, 1.8, 2.5, 2); L.position.copy(cr.position); st.add(L); glowing.push(L);
  }
  // ---- animasi ----
  const ACT = {}; ['Idle_A', 'Walking_A', 'Jump_Full_Short'].forEach(k => { if (!clips[k]) return; const a = bmx.clipAction(clips[k]); a.enabled = true; a.play(); a.setEffectiveWeight(0); ACT[k] = a; });
  const RT = [[6.25,0],[6.16,1.09],[5.87,2.14],[5.41,3.12],[4.21,3.54],[2.73,3.26],[1.88,3.25],[1.62,4.46],[1.09,6.16],[0,6.25],[-0.74,4.19],[-1.2,3.29],[-2,3.46],[-2.89,3.45],[-4.21,3.54],[-5.41,3.12],[-5.87,2.14],[-6.16,1.09],[-6.25,0],[-6.16,-1.09],[-5.87,-2.14],[-5.41,-3.13],[-4.79,-4.02],[-4.02,-4.79],[-3.13,-5.41],[-2.14,-5.87],[-1.09,-6.16],[0,-6.25],[1.09,-6.16],[2.14,-5.87],[3.13,-5.41],[4.02,-4.79],[4.79,-4.02],[5.41,-3.13],[5.4,-1.97],[5.42,-0.96]];
  const PTS = [HOME, ...RT.slice(6), ...RT.slice(0, 7), HOME];
  const curve = new THREE.CatmullRomCurve3(PTS.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const LEN = curve.getLength(), CHD = 1.0, SLOW = 0.42;
  const JD = ACT.Jump_Full_Short ? ACT.Jump_Full_Short.getClip().duration : 1.0;
  const T_FLY = 3.0, T_CH0 = 3.8, T_CH1 = 5.0, T_J0 = T_CH1, T_J1 = T_J0 + JD, T_CATCH = T_J0 + JD * 0.45, T_W0 = T_J1 + 0.4, T_W1 = T_W0 + (LEN - CHD) / SLOW, CYCLE = T_W1 + 3;
  const cl = x => Math.min(1, Math.max(0, x)), sm = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const ramp = (t, a, b, f) => cl((t - a) / f) * cl((b - t) / f);
  const lerpA = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
  const fly = hatM ? new THREE.Mesh(hatM.geometry, hatM.material) : null;
  if (fly) { fly.matrixAutoUpdate = false; fly.castShadow = true; fly.frustumCulled = false; fly.visible = false; scene.add(fly); }
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), hp = new THREE.Vector3(), hq = new THREE.Quaternion(), hs = new THREE.Vector3();
  const H0 = new THREE.Vector3(), Q0 = new THREE.Quaternion(), CP = new THREE.Vector3(), WD = new THREE.Vector3();
  const HC = new THREE.Vector3(), C0w = new THREE.Vector3(), _off = new THREE.Vector3();
  if (hatM) { hatM.geometry.computeBoundingBox(); hatM.geometry.boundingBox.getCenter(HC); }
  const spinAx = new THREE.Vector3(0.35, 1, 0.25).normalize(), spinQ = new THREE.Quaternion(), qq = new THREE.Quaternion(), bz = new THREE.Vector3();
  const pose = tc => {
    let s; if (tc < T_CH0) s = 0; else if (tc < T_CH1) s = CHD * sm((tc - T_CH0) / (T_CH1 - T_CH0)); else if (tc < T_W0) s = CHD; else if (tc < T_W1) s = CHD + (tc - T_W0) * SLOW; else s = LEN;
    const u = cl(s / LEN); curve.getPointAt(u, _p); curve.getTangentAt(Math.min(u, 0.999), _t);
    const ty = Math.atan2(_t.x, _t.z);
    const k = tc < T_W1 ? sm((tc - 3.3) / 0.5) : 1 - sm((tc - T_W1) / 1.2);
    g.position.set(_p.x, 0.26 * Math.sin(Math.PI * cl((tc - T_J0 - JD * 0.15) / (JD * 0.6))), _p.z); g.rotation.y = lerpA(HYAW, ty, k);
    const wW = Math.max(ramp(tc, T_CH0, T_CH1 + 0.05, 0.2), ramp(tc, T_W0, T_W1, 0.3)), wJ = ramp(tc, T_J0 - 0.08, T_J1, 0.12), wI = Math.max(0, 1 - wW - wJ);
    if (ACT.Idle_A) { ACT.Idle_A.setEffectiveWeight(wI); ACT.Idle_A.time = (tc + 0.3) % ACT.Idle_A.getClip().duration; }
    if (ACT.Walking_A) { ACT.Walking_A.setEffectiveWeight(wW); ACT.Walking_A.time = (s * 2.3) % ACT.Walking_A.getClip().duration; }
    if (ACT.Jump_Full_Short) { ACT.Jump_Full_Short.setEffectiveWeight(wJ); ACT.Jump_Full_Short.time = cl((tc - T_J0) / JD) * JD * 0.999; }
    bmx.update(0); g.updateMatrixWorld(true);
  };
  // titik awal topi (di rumah) & titik tangkap
  if (hatM) {
    pose(T_CATCH); CP.copy(HC).applyMatrix4(hatM.matrixWorld);
    pose(0); hatM.matrixWorld.decompose(H0, Q0, hs); H0.copy(HC).applyMatrix4(hatM.matrixWorld); C0w.copy(H0);
    WD.set(CP.x - H0.x, 0, CP.z - H0.z).normalize();
  }
  const tick = t => {
    const tc = ((t % CYCLE) + CYCLE) % CYCLE; pose(tc);
    if (!hatM) return;
    const flying = tc >= T_FLY && tc < T_CATCH;
    hatM.visible = !flying; fly.visible = flying;
    if (flying) {
      hatM.matrixWorld.decompose(hp, hq, hs); hp.copy(HC).applyMatrix4(hatM.matrixWorld);
      const k = (tc - T_FLY) / (T_CATCH - T_FLY), a = 1 - k;
      const SD = {x: -WD.z, z: WD.x};
      const P1x = H0.x + SD.x * 0.9 + WD.x * 0.2, P1y = H0.y + 1.5, P1z = H0.z + SD.z * 0.9 + WD.z * 0.2;
      const P2x = CP.x + SD.x * 0.5, P2y = CP.y + 1.0, P2z = CP.z + SD.z * 0.5;
      bz.set(a*a*a*C0w.x + 3*a*a*k*P1x + 3*a*k*k*P2x + k*k*k*hp.x, a*a*a*C0w.y + 3*a*a*k*P1y + 3*a*k*k*P2y + k*k*k*hp.y, a*a*a*C0w.z + 3*a*a*k*P1z + 3*a*k*k*P2z + k*k*k*hp.z);
      spinQ.setFromAxisAngle(spinAx, Math.PI * 2 * sm(k)); qq.copy(Q0).slerp(hq, sm(k)); qq.premultiply(spinQ);
      // putar di sekitar titik tengah topi: M = T(pos) * R * S * T(-c)
      fly.matrix.compose(bz, qq, hs); _off.copy(HC).multiply(hs).applyQuaternion(qq); fly.matrix.setPosition(bz.x - _off.x, bz.y - _off.y, bz.z - _off.z); fly.matrixWorld.copy(fly.matrix);
    }
  };
  const phase = t => { const tc = ((t % CYCLE) + CYCLE) % CYCLE; return tc >= T_FLY - 0.3 && tc < T_CATCH ? 1 : (tc >= T_CATCH && tc < T_CATCH + 3.5 ? 2 : 0); };
  BUDI = {g, root, hgt: 0.75, tick, CYCLE, phase};
}

// warga di kota: tersebar di jalan & alun-alun, job dari hash username (deterministik)
const POSES = ['Idle_A', 'Idle_B', 'Walking_A', 'Walking_B', 'Cheering', 'Waving', 'Idle_A'];
const slotsXZ = [];
const jitter = (x, z, rr) => [x + (rnd() - 0.5) * rr, z + (rnd() - 0.5) * rr];
for (const k of roads) { const [q, r] = k.split(',').map(Number); if (HD(q, r) > 6) continue; const [x, z] = XZ(q, r); if (HD(q, r) <= 1 && !(q === 0 && r === 0)) { for (let i = 0; i < 2; i++) slotsXZ.push(jitter(x, z, 1.1)); } else if (rnd() < 0.7) slotsXZ.push(jitter(x, z, 0.7)); }
FEAT.kebun.forEach(([q, r]) => { const [x, z] = XZ(q, r); slotsXZ.push(jitter(x, z, 1.2)); });
{ const [tx, tz] = XZ(...FEAT.theater); for (let i = 0; i < 5; i++) slotsXZ.push([tx - 0.8 + i * 0.4, tz + 1.3 + (rnd() - 0.5) * 0.3]); }
const filtered = slotsXZ.filter(([x, z]) => Math.hypot(x - 1.05, z - 2.35) > 0.9 && Math.hypot(x + 1.35, z - 1.45) > 0.9 && Math.hypot(x + 3.55, z - 1.5) > 1.5 && Math.hypot(x, z) > 1.2);
const NPCS = [];
filtered.slice(0, 80).forEach(([x, z], i) => {
  const w = WARGA[i % WARGA.length]; const pose = POSES[i % POSES.length];
  const sp = spawn(w.job, x, z, rnd() * 6.28, pose, rnd() * 2, CHAR_SCALE * (0.92 + rnd() * 0.16), {hideHelmet: i % 3 === 0, hideHat: false});
  NPCS.push({sp, entry: mixers[mixers.length - 1], job: w.job, x, z, h: sp.g.rotation.y});
});
// trio job untuk shot close-up (di lapangan parade cell (1,1))
{
  const [px, pz] = XZ(...FEAT.parade);
  spawn('KNIGHT', px - 0.42, pz + 0.1, 0.2, 'Melee_1H_Attack_Slice_Diagonal', 0.35, 0.21, {hideHelmet: true});
  spawn('MAGE', px, pz - 0.05, 0, 'Ranged_Magic_Spellcasting', 0.5, 0.21);
  spawn('RANGER', px + 0.42, pz + 0.1, -0.2, 'Ranged_Bow_Draw', 0.9, 0.21);
}

// ---------- papan nama (desain dari kota lama) ----------
const LABEL_SPRITES = [];
function makeSign(title, sub) {
  const g = new THREE.Group();
  const wd = mat(0x9a6a3c, {roughness: 0.9}), dk = mat(0x5a3a1e, {roughness: 0.9}), gr = mat(0x6b6560, {roughness: 1});
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; const x = cv.getContext('2d');
  x.fillStyle = '#c98a4b'; x.fillRect(0, 0, 512, 200); x.fillStyle = '#e2a463'; for (let i = 0; i < 7; i++) x.fillRect(30 + (i * 71) % 300, 30 + i * 24, 120 + (i * 37) % 90, 10);
  x.fillStyle = '#3a2410'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fit = (txt, f, w, y) => { x.font = 'bold ' + f + 'px sans-serif'; while (x.measureText(txt).width > w && f > 16) { f -= 2; x.font = 'bold ' + f + 'px sans-serif'; } x.fillText(txt, 256, y); };
  if (sub) { fit(title, 50, 450, 62); fit(sub, 38, 450, 140); } else fit(title, 62, 450, 100);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const B = (w, h, d, m, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
  B(.14, 1.3, .14, dk, -1.05, .65, 0); B(.14, 1.3, .14, dk, 1.05, .65, 0); B(2.5, .1, .16, dk, 0, 1.62, 0); B(.3, .16, .18, wd, 0, 1.62, 0);
  for (let i = 0; i < 3; i++) { B(.16, .3, .12, gr, -1.28, 1.05 + (i - 1) * .3, 0); B(.16, .3, .12, gr, 1.28, 1.05 + (i - 1) * .3, 0); }
  B(2.2, .95, .12, dk, 0, 1.05, 0);
  const pn = new THREE.Mesh(new THREE.PlaneGeometry(2.04, .8), new THREE.MeshBasicMaterial({map: tex})); pn.position.set(0, 1.05, .07); g.add(pn);
  const bu = mat(0x3aa845, {roughness: 1});
  [-1.05, 1.05].forEach(px => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(.28, 0), bu); o.position.set(px + (px < 0 ? -.1 : .1), .2, .15); o.scale.set(1, .8, 1); g.add(o); });
  return g;
}
function sign(title, sub, x, z, ry = 0, sc = 0.3) { const g = makeSign(title, sub); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(sc); scene.add(g); LABEL_SPRITES.push(g); return g; }
if (LABELS) {
  const near = (bx, bz, d) => { const L = Math.hypot(bx, bz) || 1, ux = -bx / L, uz = -bz / L; return [bx + ux * d, bz + uz * d, Math.atan2(ux, uz)]; };
  const sg = (t, sub, bx, bz, d) => { const [x, z, ry] = near(bx, bz, d); sign(t, sub, x, z, ry); };
  { const [tx, tz] = XZ(...FEAT.theater); sg('GRAND THEATER', 'Usulan @its.vaw_', tx, tz, 1.3); }
  { const nw = WARGA.slice(-3).map(w => '@' + w.u).reverse().join('  '); sign('WARGA TERBARU', nw, 2.4, 9.0, Math.PI, 0.3); }
  sign('MERCUSUAR', 'Usulan @its.rvliaaa_', LH.x, LH.z + 0.95, 0.4);
  { const [bx, bz] = XZ(...FEAT.balai); sg('BALAI DESA', 'Mayor Budi', bx, bz, 1.7); }
  sign('KEBUN WARGA', null, KEB[0] + 1.12, KEB[1] + 0.65, 1.05);
  { const [kx, kz] = XZ(...FEAT.barracks); sg('MARKAS KNIGHT', null, kx, kz, 1.25); }
  sg('MARKAS RANGER', null, ARCH[0], ARCH[1], 1.2);
}

// ---------- cahaya & kamera ----------
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096);
const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
// pencahayaan disamakan dengan kota lama (index.html LOOK)
const PRESETS = {
  siang: {sky: ['#78b7ea', '#b5d9f2', '#e9ecd8', '#f3e6c8'], fog: 0xdde3dc, hs: 0xf2f4ff, hg: 0x86cf9c, hi: 1.15, sun: 0xfff1d8, si: 2.1, sp: [-45, 78, 32], exp: 0.88, gr: 0x78b542},
  sore: {sky: ['#3B2C9A', '#8E47C2', '#FF7F8F', '#FFB89A'], fog: 0xdba6c4, hs: 0xd6b8ff, hg: 0x3fd0a0, hi: 1.8, sun: 0xffa9b4, si: 2.5, sp: [70, 40, -30], exp: 1.0, gr: 0x78b542},
  malam: {sky: ['#0a0a3a', '#1c1a6a', '#3a2a88', '#5a3a90'], fog: 0x24206a, hs: 0x9a9aff, hg: 0x3f7a9a, hi: 1.45, sun: 0xb4c4ff, si: 1.3, sp: [-45, 78, 32], exp: 1.15, gr: 0x16402a},
};
const skyTex = c => { const k = document.createElement('canvas'); k.width = 4; k.height = 512; const g = k.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, c[0]); gr.addColorStop(.4, c[1]); gr.addColorStop(.7, c[2]); gr.addColorStop(1, c[3]); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t; };
scene.background = new THREE.Color(0x000000);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({color: 0x3e7a35, roughness: 1})); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.02; ground.receiveShadow = true; scene.add(ground);
const nightGroup = new THREE.Group(); scene.add(nightGroup);
{
  // lampu di pohon besar, gerbang, jendela rumah
  for (let i = 0; i < 28; i++) { const a = rnd() * 6.28, rr = 0.4 + rnd() * 1.6; const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({color: 0xffe38a})); s.position.set(Math.cos(a) * rr, 2.2 + rnd() * 2.3, Math.sin(a) * rr); nightGroup.add(s); }
  const tl = new THREE.PointLight(0xffd27a, 30, 16, 2); tl.position.set(0, 2.5, 0.5); nightGroup.add(tl);
  const [gx, gz] = XZ(-3, 6); [-1, 1].forEach(s => { const l = new THREE.PointLight(0xff9a3a, 5, 6, 2); l.position.set(gx + s * 1.0, 1.0, gz + 0.6); nightGroup.add(l); const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({color: 0xffb04a})); f.position.copy(l.position); nightGroup.add(f); });

  const CAMP = [0.5, 5.5]; window.CAMP = CAMP;
  { // api unggun di plaza selatan (hanya malam): kayu bakar, api, cahaya
    const wood = new THREE.MeshStandardMaterial({color: 0x6b3f1f, roughness: 0.9, flatShading: true});
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, lg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), wood); lg.position.set(CAMP[0] + Math.cos(a) * 0.12, 0.07, CAMP[1] + Math.sin(a) * 0.12); lg.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); lg.castShadow = true; nightGroup.add(lg); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), new THREE.MeshBasicMaterial({color: 0xffa21f})); fl.position.set(CAMP[0], 0.22, CAMP[1]); nightGroup.add(fl);
    const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), new THREE.MeshBasicMaterial({color: 0xfff2a0})); fl2.position.set(CAMP[0], 0.2, CAMP[1]); nightGroup.add(fl2);
    window.CAMPFIRE = [fl, fl2];
    const cl = new THREE.PointLight(0xff9a3a, 4, 5, 2); cl.position.set(CAMP[0], 0.5, CAMP[1]); nightGroup.add(cl);
  }
  { // obor menara: sprite cahaya (tanpa PointLight, jauh lebih ringan)
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,190,90,1)'); gr.addColorStop(0.35, 'rgba(255,140,50,0.45)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const gt = new THREE.CanvasTexture(c); gt.colorSpace = THREE.SRGBColorSpace;
    (window.TOWERS || []).forEach(([x, z]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: gt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); sp.scale.set(3.2, 3.2, 1); sp.position.set(x, 1.95, z); nightGroup.add(sp);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({color: 0xffb04a})); f.position.set(x, 1.9, z); nightGroup.add(f); }); }
  houseSlots.slice(0, nHouse).forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), new THREE.MeshBasicMaterial({color: 0xffd36a})); w.position.set(s.x, 0.28, s.z + 0.32); nightGroup.add(w); });
}
let curTime = 'sore';
function applyTime(name) {
  const P = PRESETS[name] || PRESETS.sore; curTime = PRESETS[name] ? name : 'sore';
  scene.background = skyTex(P.sky); scene.fog = new THREE.Fog(P.fog, 160, 460);
  sun.color.setHex(P.sun); sun.intensity = P.si; sun.position.set(P.sp[0] * 0.55, P.sp[1] * 0.55, P.sp[2] * 0.55); sun.target.position.set(0, 0, 0);
  hemi.color.setHex(P.hs); hemi.groundColor.setHex(P.hg); hemi.intensity = P.hi;
  renderer.toneMappingExposure = P.exp; ground.material.color.setHex(P.gr);
  nightGroup.visible = curTime === 'malam';
  if (LH.beam) LH.beam.children[0].material.opacity = curTime === 'malam' ? 0.2 : 0.0;
}
applyTime(TIME);
const CAMS = {
  wide75: {t: [0, 0, 1.5], el: 75, az: 0, d: 84, fov: 28},
  iso45: {t: [0, 0, 1.5], el: 38, az: -22, d: 58, fov: 30},
  edge: {t: [0, 0, -2], el: 44, az: -18, d: 112, fov: 30},
  budi: {t: [1.05, 0.5, 2.35], el: 10, az: 14, d: 3.4, fov: 32},
  jobs: {t: [3, 0.42, 2.0], el: 22, az: -4, d: 3.6, fov: 34},
  theater: {t: [-9, 1.1, -1.7], el: 20, az: 79, d: 9, fov: 32},
  portal: {t: [-3.5, 1.1, 1.5], el: 14, az: 29, d: 7, fov: 32},
  forest: {t: [-24, 0, -4], el: 38, az: 90, d: 20, fov: 32},
  lighthouse: {t: [7.2, 1.4, 13.3], el: 22, az: -38, d: 17, fov: 32},
  gate: {t: [0.6, 0.7, 9.6], el: 24, az: 160, d: 8, fov: 34},
  kebun: {t: [KEB[0], 0.3, KEB[1]], el: 36, az: 40, d: 6.5, fov: 32},
  balai: {t: [-1, 0.9, -8.3], el: 18, az: 85, d: 9, fov: 32},
};
if (Q.has('cx')) CAMS.dbg = {t: [+Q.get('cx'), 0.5, +Q.get('cz')], el: +(Q.get('el') || 38), az: +(Q.get('az') || -22), d: +(Q.get('d') || 14), fov: 30};
function camPose(name) {
  const C0 = CAMS[name] || CAMS.wide75; const C = (name === 'budi' && BUDI) ? Object.assign({}, C0, {t: [BUDI.g.position.x, 0.5, BUDI.g.position.z]}) : C0; const el = C.el * Math.PI / 180, az = C.az * Math.PI / 180;
  const k = (LIVE && camera.aspect > 1 && (name === 'wide75' || name === 'iso45')) ? 0.6 : (LIVE && camera.aspect > 1 ? 0.8 : 1);
  const d = C.d * k;
  return {pos: new THREE.Vector3(C.t[0] + d * Math.sin(az) * Math.cos(el), C.t[1] + d * Math.sin(el), C.t[2] + d * Math.cos(az) * Math.cos(el)), tgt: new THREE.Vector3(...C.t), fov: C.fov};
}
function setCamNow(name) { const p = camPose(name); camera.fov = p.fov; camera.updateProjectionMatrix(); camera.position.copy(p.pos); camera.lookAt(p.tgt); return p; }
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function followBudi(t = 0) {
  if (!BUDI) return;
  BUDI.tick(t);
  animFns.forEach(f => f(t));
}
window.CACHEKEYS = () => Object.keys(cache);

if (!LIVE) {
  setCamNow(CAMNAME);
  window.renderFrame = (t = T0) => {
    mixers.forEach(m => m.mx.setTime(t + m.off));
    followBudi(t);
    if (LH.beam) LH.beam.rotation.y = t * 1.2;
    renderer.render(scene, camera);
  };
  window.renderFrame(T0); window.renderFrame(T0);
  {const e = document.getElementById('ldp'), b = document.getElementById('ldb'); if (e) e.textContent = '100%'; if (b) b.style.width = '100%'; const l = document.getElementById('ld'); if (l) { l.style.opacity = 0; setTimeout(() => l.remove(), 700); }} window.READY = 1; window.DBG = {BUDI, THREE, scene, PORTAL};
} else {
  // ---------- mode interaktif (website) ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.2; controls.maxDistance = 170;
  let tween = null; const clock = new THREE.Clock();
  mixers.forEach(m => m.mx.setTime(m.off));
  const first = setCamNow(camera.aspect < 1 ? 'wide75' : 'iso45'); controls.target.copy(first.tgt); controls.update();
  let camKey = null; const lastB = new THREE.Vector3(); controls.addEventListener('start', () => { camKey = null; });
  const goCam = name => { camKey = name; const p = camPose(name); tween = {t0: clock.elapsedTime, dur: 1.4, p0: camera.position.clone(), g0: controls.target.clone(), f0: camera.fov, p1: p.pos, g1: p.tgt, f1: p.fov}; setActive('c', name === 'wide75' ? 'iso45' : name); };
  const ease = x => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
  // UI
  const css = document.createElement('style');
  css.textContent = `.ui{position:fixed;left:0;right:0;z-index:5;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px;font:700 13px/1 system-ui,Segoe UI,Arial}
  .ui button{border:2px solid #fff;background:#4a2a8a;color:#ffd84a;border-radius:999px;padding:8px 12px;cursor:pointer;font:inherit;box-shadow:0 2px 0 rgba(0,0,0,.35)}
  .ui button.on{background:#ffd84a;color:#3a1c6e}
  #top{top:0;pointer-events:none;flex-direction:column;align-items:flex-start;padding:10px 12px}
  #top div{background:rgba(40,20,80,.88);color:#fff;border:2px solid #fff;border-radius:12px;padding:5px 10px;margin-bottom:5px;font-weight:700;white-space:nowrap}
  #top .y{color:#ffd84a;font-size:14px}
  @keyframes pls{0%,100%{box-shadow:0 0 0 0 #ffd84a88}50%{box-shadow:0 0 0 7px #ffd84a00}}#q{animation:pls 2.2s infinite}
  #bar3{bottom:92px;display:none}#bar3.open{display:flex}
  .ui button{white-space:nowrap}
  #bar,#bar2{bottom:0}#bar{bottom:44px}
  @media (max-width:600px){.ui button{padding:7px 10px;font-size:14px}}
  #joy{position:fixed;left:24px;bottom:110px;width:124px;height:124px;border-radius:50%;background:#ffffff40;border:3px solid #ffffffcc;display:none;touch-action:none;z-index:8}
  #knob{position:absolute;left:36px;top:36px;width:52px;height:52px;border-radius:50%;background:#ffffffdd;box-shadow:0 3px 8px #0004}
  #exitp{position:fixed;top:12px;right:12px;z-index:8;display:none;border:2px solid #fff;background:#c0392b;color:#fff;border-radius:999px;padding:8px 14px;font:700 13px system-ui;cursor:pointer}
  #hint{position:fixed;left:0;right:0;bottom:96px;text-align:center;font:700 12px system-ui;color:#fff;text-shadow:0 1px 6px #000a;display:none;z-index:7;pointer-events:none}
  .pl{position:fixed;left:0;top:0;z-index:6;background:#ffd84a;color:#3a1c6e;border:2px solid #3a1c6e;border-radius:10px;padding:2px 8px;font:800 12px system-ui;pointer-events:none;white-space:nowrap}
  .abtn{position:fixed;right:22px;z-index:8;display:none;width:74px;height:74px;border-radius:50%;border:3px solid #fff;color:#fff;font:800 13px system-ui;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.35);line-height:1.15}
  #atk{bottom:190px;background:#e0462f}#foto{bottom:104px;background:#2f7fe0}
  #flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9;transition:opacity .35s}
  body.play #joy,body.play #exitp,body.play #hint,body.play .abtn{display:block}
  body.play #bar,body.play #bar2,body.play #bar3,body.play #q,body.play #res{display:none}`;
  document.head.appendChild(css);
  const top = document.createElement('div'); top.id = 'top'; top.className = 'ui';
  top.innerHTML = `<div class="y">🏰 Pohon Warga</div><div id="stat">👥 ${WARGA.length} &nbsp;🏠 ${Math.ceil(WARGA.length/10)} &nbsp;🛡️ ${jobCount.KNIGHT} &nbsp;🔮 ${jobCount.MAGE} &nbsp;🏹 ${jobCount.RANGER}</div>`;
  document.body.appendChild(top);
  const sb = document.createElement('div'); sb.style.cssText = 'position:fixed;top:78px;left:12px;z-index:6;font:700 13px system-ui'; sb.innerHTML = '<input id="q" placeholder="🔍 Cari namamu" autocomplete="off" style="width:170px;padding:8px 10px;border-radius:12px;border:2px solid #fff;background:rgba(40,20,80,.9);color:#fff;font:inherit"><div id="res" style="margin-top:4px"></div>'; document.body.appendChild(sb);
  let tempSign = null;
  const qi = sb.querySelector('#q'), res = sb.querySelector('#res');
  qi.addEventListener('input', () => { const v = qi.value.trim().replace(/^@/, '').toLowerCase(); res.innerHTML = ''; if (!v) return;
    WARGA.map((w, i) => ({w, i})).filter(o => o.w.u.toLowerCase().includes(v)).slice(0, 5).forEach(({w, i}) => { const d = document.createElement('div'); d.textContent = '@' + w.u + ' · ' + JEMO[w.job] + ' ' + titleOf(i) + ' '; { const pb = document.createElement('button'); pb.textContent = '▶ Main'; pb.style.cssText = 'margin-left:6px;border:2px solid #fff;background:#4a2a8a;color:#ffd84a;border-radius:999px;padding:3px 9px;font:inherit;cursor:pointer'; pb.onclick = ev => { ev.stopPropagation(); res.innerHTML = ''; qi.value = ''; startPlay(i); }; d.appendChild(pb); } d.style.cssText = 'background:rgba(40,20,80,.92);color:#fff;border:2px solid #fff;border-radius:10px;padding:6px 9px;margin-top:3px;cursor:pointer'; d.onclick = () => { res.innerHTML = ''; qi.value = ''; const hs = houseSlots[Math.min(Math.floor(i / 10), houseSlots.length - 1)]; CAMS.search = {t: [hs.x, 0.5, hs.z], el: 28, az: 0, d: 5.5, fov: 32}; if (tempSign) { scene.remove(tempSign); } tempSign = makeSign('@' + w.u, 'rumah warga #' + (Math.floor(i / 10) + 1)); tempSign.position.set(hs.x, 0, hs.z + 0.9); tempSign.scale.setScalar(0.26); scene.add(tempSign); goCam('search'); }; res.appendChild(d); }); });
  const bar = document.createElement('div'); bar.id = 'bar'; bar.className = 'ui';
  const bar2 = document.createElement('div'); bar2.id = 'bar2'; bar2.className = 'ui';
  document.body.append(bar, bar2);
  const btns = {};
  const mk = (par, kind, key, text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; par.appendChild(b); btns[kind + key] = b; };
  const setActive = (kind, key) => { Object.keys(btns).forEach(k => { if (k[0] === kind) btns[k].classList.toggle('on', k === kind + key); }); };
  const bar3 = document.createElement('div'); bar3.id = 'bar3'; bar3.className = 'ui'; document.body.appendChild(bar3);
  const closeSub = () => { bar3.classList.remove('open'); btns.cbangunan && btns.cbangunan.classList.remove('on'); };
  [['iso45', '🌍 Kota'], ['edge', '🗺️ Peta'], ['budi', '🧙 Budi'], ['jobs', '⚔️ Job']].forEach(([k, t]) => mk(bar, 'c', k, t, () => { closeSub(); goCam(k); }));
  mk(bar, 'c', 'bangunan', '🏛️ Bangunan', () => { const o = !bar3.classList.contains('open'); bar3.classList.toggle('open', o); btns.cbangunan.classList.toggle('on', o); });
  [['kebun', '🌱 Kebun Warga'], ['lighthouse', '🗼 Mercusuar'], ['theater', '🎭 Gedung Teater'], ['balai', '🏛️ Balai'], ['portal', '🌀 Portal'], ['gate', '🚪 Gerbang']].forEach(([k, t]) => mk(bar3, 'c', k, t, () => { goCam(k); bar3.classList.remove('open'); btns.cbangunan.classList.add('on'); }));
  [['sore', '🌇'], ['siang', '☀️'], ['malam', '🌙']].forEach(([k, t]) => mk(bar2, 't', k, t, () => { applyTime(k); setActive('t', k); }));
  mk(bar2, 'l', 'x', '🏷️', () => { const v = !LABEL_SPRITES[0].visible; LABEL_SPRITES.forEach(l => l.visible = v); btns.lx.classList.toggle('on', v); });
  setActive('t', TIME); btns.lx.classList.add('on'); setActive('c', 'iso45');
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  renderer.domElement.addEventListener('pointerdown', () => { tween = null; });
  // ---------- mode main: masukkan nama, jalankan karakter keliling kastil ----------
  const KEYS = {}, JOY = {x: 0, y: 0}; let PL = null;
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key === 'Escape' && PL) stopPlay(); if (PL && e.key === ' ') { e.preventDefault(); doAttack(); } if (PL && (e.key === 'f' || e.key === 'F')) doFoto(); });
  addEventListener('keyup', e => { KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  const joy = document.createElement('div'); joy.id = 'joy'; joy.innerHTML = '<div id="knob"></div>';
  const exitp = document.createElement('button'); exitp.id = 'exitp'; exitp.textContent = '✕ Keluar';
  const hint = document.createElement('div'); hint.id = 'hint'; hint.textContent = 'WASD / panah atau joystick untuk jalan · Spasi = pukul · F = foto · geser layar untuk putar kamera';
  const atk = document.createElement('button'); atk.id = 'atk'; atk.className = 'abtn'; atk.innerHTML = '👊<br>Pukul';
  const fotoB = document.createElement('button'); fotoB.id = 'foto'; fotoB.className = 'abtn'; fotoB.innerHTML = '📷<br>Foto';
  const flash = document.createElement('div'); flash.id = 'flash';
  document.body.append(joy, exitp, hint, atk, fotoB, flash);
  { const kn = joy.querySelector('#knob'); let act = false;
    const mv = e => { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), RR = 46; if (m > RR) { dx *= RR / m; dy *= RR / m; } kn.style.transform = `translate(${dx}px,${dy}px)`; JOY.x = dx / RR; JOY.y = -dy / RR; };
    joy.addEventListener('pointerdown', e => { act = true; joy.setPointerCapture(e.pointerId); mv(e); });
    joy.addEventListener('pointermove', e => { if (act) mv(e); });
    const up = () => { act = false; kn.style.transform = ''; JOY.x = JOY.y = 0; }; joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up); }
  // rintangan
  const OBS = []; const ob = (x, z, r) => OBS.push([x, z, r]);
  { const [bx, bz] = XZ(...FEAT.balai); ob(bx, bz, 1.1); const [tx, tz] = XZ(...FEAT.theater); ob(tx, tz, 1.15); const [rx, rz] = XZ(...FEAT.barracks); ob(rx, rz, 1.05); ob(ARCH[0], ARCH[1], 1.0);
    for (const t of [-0.75, 0, 0.75]) ob(KEB[0] + t * 0.5, KEB[1] - t * 0.866, 0.85);
    ob(0, 0, 1.1); ob(LHPOS[0], LHPOS[1], 0.5); ob(-3.55, 1.5, 0.6);
    houseSlots.slice(0, nHouse).forEach(h => ob(h.x, h.z, 0.55));
    for (let k = 0; k < 6; k++) { const [cx, cz] = XZ(DIRS[k][0] * 6, DIRS[k][1] * 6); ob(cx, cz, 0.9); } }
  const hexRound = (q, r) => { const x = q, z = r, y = -x - z; let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z); const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry; return [rx, rz]; };
  const blockedAt = (x, z) => {
    const r = z / 1.7320508, q = (x - r) / 2, hd = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (hd > R - 1.1) return true;
    if (hd > 5.75 && hd < 6.35 && !(Math.abs(x) < 1.3 && z > 9.4)) return true;
    const [cq, cr] = hexRound(q, r); if (seaIn.has(K(cq, cr))) return true;
    if (Math.abs(z - 15.59) < 0.8 && Math.abs(x - 3) > 1.1 && x > -19) return true;
    for (const o of OBS) if (Math.hypot(x - o[0], z - o[1]) < o[2] + 0.22) return true;
    return false;
  };
  window.BLK = blockedAt;
  const dEl = document.createElement('div'); dEl.className = 'pl'; dEl.style.display = 'none'; document.body.appendChild(dEl);
  const _p = new THREE.Vector3();
  function startPlay(i) {
    if (PL) stopPlay(true);
    const w = WARGA[i]; const sp = spawn(w.job, 1.4, 3.3, Math.PI, 'Idle_A', 0, CHAR_SCALE * 1.3);
    const mx = mixers[mixers.length - 1].mx; const idle = mx.clipAction(clips['Idle_A']), walk = mx.clipAction(clips['Walking_A']); walk.setEffectiveWeight(0); walk.play();
    PL = {g: sp.g, entry: mixers[mixers.length - 1], mx, job: w.job, atk: 0, idle, walk, moving: false, x: 1.4, z: 3.3, h: Math.PI, lx: 1.4, lz: 3.3, name: '@' + w.u};
    dEl.textContent = PL.name + ' ' + JEMO[w.job] + ' ' + titleOf(i).split(' ')[0]; dEl.style.display = 'block';
    document.body.classList.add('play'); tween = null;
    controls.enablePan = false; controls.minDistance = 4; controls.maxDistance = 18;
    camera.fov = 38; camera.updateProjectionMatrix(); controls.target.set(PL.x, 0.6, PL.z); camera.position.set(PL.x + 1.5, 4.6, PL.z + 7); controls.update();
  }
  function stopPlay(quiet) {
    if (!PL) return; scene.remove(PL.g); const ix = mixers.indexOf(PL.entry); if (ix >= 0) mixers.splice(ix, 1); PL = null; JOY.x = JOY.y = 0; dEl.style.display = 'none';
    document.body.classList.remove('play'); controls.enablePan = true; controls.minDistance = 1.2; controls.maxDistance = 170; if (!quiet) goCam(camera.aspect < 1 ? 'wide75' : 'iso45');
  }
  exitp.onclick = () => stopPlay();
  qi.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = qi.value.trim().replace(/^@/, '').toLowerCase(); if (!v) return; let i = WARGA.findIndex(o => o.u.toLowerCase() === v); if (i < 0) i = WARGA.findIndex(o => o.u.toLowerCase().includes(v)); if (i >= 0) { res.innerHTML = ''; qi.value = ''; startPlay(i); } } });
  function updPlayer(dt) {
    if (!PL) return;
    if (PL.atk > 0) { PL.atk -= dt; if (PL.atk <= 0) { PL.atkAct && PL.atkAct.fadeOut(0.15); PL.idle.reset().setEffectiveWeight(1).fadeIn(0.15).play(); PL.moving = false; } }
    const kx = (KEYS.d || KEYS.ArrowRight ? 1 : 0) - (KEYS.a || KEYS.ArrowLeft ? 1 : 0), ky = (KEYS.w || KEYS.ArrowUp ? 1 : 0) - (KEYS.s || KEYS.ArrowDown ? 1 : 0);
    let ix = JOY.x + kx, iy = JOY.y + ky; if (PL.atk > 0) { ix = 0; iy = 0; } const mg = Math.hypot(ix, iy); if (mg > 1) { ix /= mg; iy /= mg; }
    const fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, fl = Math.hypot(fx, fz) || 1, Fx = fx / fl, Fz = fz / fl;
    const wx = -Fz * ix + Fx * iy, wz = Fx * ix + Fz * iy, mov = mg > 0.08, spd = 2.3 * Math.min(1, mg);
    if (mov) { const l = Math.hypot(wx, wz) || 1; const nx = PL.x + wx / l * spd * dt, nz = PL.z + wz / l * spd * dt; if (!blockedAt(nx, nz)) { PL.x = nx; PL.z = nz; } else if (!blockedAt(nx, PL.z)) PL.x = nx; else if (!blockedAt(PL.x, nz)) PL.z = nz;
      const th = Math.atan2(wx, wz); let d = th - PL.h; d = Math.atan2(Math.sin(d), Math.cos(d)); PL.h += d * Math.min(1, dt * 10); }
    if (mov !== PL.moving) { PL.moving = mov; const a = mov ? PL.walk : PL.idle, b = mov ? PL.idle : PL.walk; a.enabled = true; a.setEffectiveWeight(1); a.reset().fadeIn(0.18).play(); b.fadeOut(0.18); }
    PL.g.position.set(PL.x, 0, PL.z); PL.g.rotation.y = PL.h;
    const ddx = PL.x - PL.lx, ddz = PL.z - PL.lz; PL.lx = PL.x; PL.lz = PL.z; controls.target.x += ddx; controls.target.z += ddz; camera.position.x += ddx; camera.position.z += ddz;
    _p.set(PL.x, 0.95, PL.z).project(camera); dEl.style.display = _p.z < 1 ? 'block' : 'none'; dEl.style.transform = `translate(${(_p.x * 0.5 + 0.5) * innerWidth}px,${(-_p.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
  }
  // ---------- warga berjalan keliling kota, ngobrol ----------
  const bubTex = txt => { const c = document.createElement('canvas'), g = c.getContext('2d'); const F = '800 30px system-ui, Arial'; g.font = F; const tw = Math.ceil(g.measureText(txt).width); c.width = Math.max(64, tw + 36); c.height = 76; g.font = F;
    g.fillStyle = '#fff'; g.strokeStyle = '#3a1c6e'; g.lineWidth = 5; g.beginPath(); g.roundRect(4, 4, c.width - 8, 50, 16); g.fill(); g.stroke(); g.beginPath(); g.moveTo(22, 52); g.lineTo(18, 72); g.lineTo(38, 52); g.closePath(); g.fill(); g.beginPath(); g.moveTo(22, 54); g.lineTo(18, 72); g.lineTo(38, 54); g.stroke();
    g.fillStyle = '#3a1c6e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, c.width / 2, 30); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.asp = c.width / c.height; return t; };
  const SAY = {
    open: ['Halo!', 'Pagi, warga!', 'Mau ke pasar?', 'Lapar nih', 'Kebun udah panen?', 'Teater main jam berapa?', 'Liat topi Budi tadi?', 'Cuaca cerah ya', 'Ayo latihan!', 'Kamu job apa?', 'Warga baru tuh!', 'Kapan perang?', 'Rumahku yang biru', 'Mau ke mercusuar?', 'Sepi ya hari ini'],
    reply: ['Hahaha', 'Iya bener', 'Gas!', 'Masa sih?', 'Nanti ya', 'Setuju!', 'Wkwk', 'Ayo!', 'Aku juga', 'Seriusan?', 'Mantap!', 'Belum tau'],
    KNIGHT: ['Pedangku tajam!', 'Aku jaga gerbang', 'Siap perang!'], MAGE: ['Abrakadabra!', 'Lagi belajar sihir', 'Tongkatku baru'], RANGER: ['Panahku meleset', 'Mau berburu?', 'Aku jago memanah']};
  const pick = a => a[(Math.random() * a.length) | 0];
  const lineFor = (o, first) => { if (!first && Math.random() < 0.55) return pick(SAY.reply); return Math.random() < 0.3 && SAY[o.n.job] ? pick(SAY[o.n.job]) : pick(SAY.open); };
  const BT = {hi: bubTex('Halo!'), hit: bubTex('Aduh!')}; const btx = k => BT[k] || (BT[k] = bubTex(k));
  const mkBub = k => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: btx(k), transparent: true, depthTest: false})); sp.scale.set(0.24 * btx(k).userData.asp, 0.24, 1); sp.center.set(0.12, 0); sp.visible = false; sp.renderOrder = 10; scene.add(sp); return sp; };
  const WP = []; { for (let z = -10; z <= 10; z += 0.8) for (let x = -11; x <= 11; x += 0.8) { const r = z / 1.7320508, q = (x - r) / 2; if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 5.2) continue; if (!blockedAt(x, z)) WP.push([x, z]); } }
  const rr = (a, b) => a + Math.random() * (b - a);
  const AN = ['Idle_A', 'Walking_A', 'Waving', 'Cheering', 'Hit_A', 'Sit_Floor_Idle'];
  const CROWD = NPCS.map(n => { const mx = n.entry.mx; const A = {}; AN.forEach(k => { A[k] = mx.clipAction(clips[k]); A[k].enabled = true; A[k].setEffectiveWeight(0); A[k].play(); });
    A.Hit_A.setLoop(THREE.LoopOnce, 1); A.Hit_A.clampWhenFinished = true;
    const o = {n, A, cur: 'Idle_A', x: n.x, z: n.z, h: n.h, st: 'idle', t: rr(0, 4), tgt: null, partner: null, lead: false, sp: rr(0.5, 0.8), bub: mkBub('hi'), bk: 'hi', say: '', lx: n.x, lz: n.z, stk: 0};
    A.Idle_A.setEffectiveWeight(1); A.Idle_A.time = rr(0, 2); return o; });
  { const GATE = [0.2, 9.7]; const nm = WARGA.slice(-3).map(w => w.u).reverse();
    CROWD.slice(0, 3).forEach((o, k) => { const tx = o.x, tz = o.z; o.x = GATE[0] + (k - 1) * 0.5; o.z = GATE[1] + k * 0.45; o.tgt = [tx, tz]; o.st = 'walk'; o.sp = 0.55; o.fresh = '@' + nm[k] + ' baru gabung!'; o.n.sp.g.position.set(o.x, 0, o.z); }); }
  const setAn = (o, k, f = 0.25) => { if (o.cur === k) return; const a = o.A[o.cur], b = o.A[k]; a.fadeOut(f); b.reset().setEffectiveWeight(1).fadeIn(f).play(); o.cur = k; };
  const setBub = (o, k) => { if (!k) { o.bub.visible = false; return; } if (o.bk !== k) { o.bk = k; const t = btx(k); o.bub.material.map = t; o.bub.scale.set(0.24 * t.userData.asp, 0.24, 1); o.bub.material.needsUpdate = true; } o.bub.visible = true; };
  const pickWp = o => { for (let k = 0; k < 8; k++) { const w = WP[(Math.random() * WP.length) | 0]; if (Math.hypot(w[0] - o.x, w[1] - o.z) > 2) return w; } return WP[0]; };
  const face = (o, tx, tz, dt, k = 8) => { const th = Math.atan2(tx - o.x, tz - o.z); let d = th - o.h; d = Math.atan2(Math.sin(d), Math.cos(d)); o.h += d * Math.min(1, dt * k); };
  function updCrowd(dt) {
    const T = clock.elapsedTime, ph = BUDI ? BUDI.phase(T) : 0, bx = BUDI ? BUDI.g.position.x : 0, bz = BUDI ? BUDI.g.position.z : 0, night = curTime === 'malam';
    for (const o of CROWD) {
      if (ph && (o.st === 'idle' || o.st === 'walk') && Math.hypot(o.x - bx, o.z - bz) < 3.6) { o.st = 'react'; o.rt = 0; }
      if (o.st === 'sit' && !night) { o.st = 'idle'; o.t = rr(0.5, 2); }
      if (o.st === 'idle') { o.t -= dt; setAn(o, 'Idle_A'); setBub(o, null);
        if (o.t <= 0) { let p = null; if (Math.random() < 0.45) { let bd = 6; for (const q of CROWD) if (q !== o && (q.st === 'idle' || q.st === 'walk') && Math.hypot(q.x - o.x, q.z - o.z) < bd) { bd = Math.hypot(q.x - o.x, q.z - o.z); p = q; } }
          if (!p && night && Math.random() < 0.55) { const a = Math.random() * 6.28; o.st = 'toCamp'; o.tgt = [window.CAMP[0] + Math.cos(a) * 0.95, window.CAMP[1] + Math.sin(a) * 0.95]; } else
          if (p) { o.st = 'toP'; o.partner = p; o.lead = true; p.st = 'wait'; p.partner = o; p.lead = false; p.t = 14; } else { o.st = 'walk'; o.tgt = pickWp(o); } } }
      else if (o.st === 'walk' || o.st === 'toP' || o.st === 'toCamp') {
        const tx = o.st === 'toP' ? o.partner.x : o.tgt[0], tz = o.st === 'toP' ? o.partner.z : o.tgt[1]; const d = Math.hypot(tx - o.x, tz - o.z);
        if (o.st === 'toP' && o.partner.st !== 'wait') { o.st = 'idle'; o.t = 1; }
        else if (o.st === 'toP' && d < 0.8) { o.st = 'chat'; o.partner.st = 'chat'; o.say = lineFor(o, true); o.partner.say = lineFor(o.partner, false); o.t = rr(5, 9); o.sw = 0; setAn(o, 'Waving'); setAn(o.partner, 'Idle_A'); }
        else if (o.st === 'toCamp' && d < 0.3) { o.st = 'sit'; o.t = rr(14, 34); }
        else if (o.st === 'walk' && d < 0.2) { o.st = 'idle'; o.t = rr(1.5, 5); }
        else { setAn(o, 'Walking_A'); const sp = o.sp; const nx = o.x + (tx - o.x) / d * sp * dt, nz = o.z + (tz - o.z) / d * sp * dt;
          const px = o.x, pz = o.z;
          if (!blockedAt(nx, nz)) { o.x = nx; o.z = nz; } else if (!blockedAt(nx, o.z)) o.x = nx; else if (!blockedAt(o.x, nz)) o.z = nz; else { o.tgt = pickWp(o); if (o.st === 'toP') { o.st = 'idle'; o.partner.st = 'idle'; o.t = 1; } }
          face(o, tx, tz, dt);
          if (Math.hypot(o.x - px, o.z - pz) < sp * dt * 0.3) { o.stk += dt; if (o.stk > 1.2) { o.stk = 0; o.tgt = pickWp(o); if (o.st === 'toP') { o.st = 'idle'; o.partner.st = 'idle'; o.partner.t = 1; o.t = 0.5; } else o.st = 'walk'; } } else o.stk = Math.max(0, o.stk - dt); } }
      else if (o.st === 'sit') { o.t -= dt; setAn(o, 'Sit_Floor_Idle'); face(o, window.CAMP[0], window.CAMP[1], dt, 4); setBub(o, null); if (o.t <= 0) { o.st = 'idle'; o.t = rr(1, 3); } }
      else if (o.st === 'react') { o.rt += dt; face(o, bx, bz, dt, 6);
        if (ph === 1) { setAn(o, 'Idle_A'); setBub(o, o.rt < 4 ? (o.n.job === 'KNIGHT' ? 'Awas topinya!' : 'Topi Budi!') : null); }
        else if (ph === 2) { setAn(o, o.rt % 2 < 1 ? 'Cheering' : 'Waving'); setBub(o, 'Hahaha!'); }
        else { o.st = 'idle'; o.t = rr(0.5, 2.5); setBub(o, null); } }
      else if (o.st === 'wait') { o.t -= dt; setAn(o, 'Idle_A'); if (o.t <= 0) { o.st = 'idle'; o.t = 1; } }
      else if (o.st === 'chat') {
        const p = o.partner; face(o, p.x, p.z, dt);
        if (o.lead) { o.t -= dt; o.sw += dt; if (o.sw > 2) { o.sw = 0; const a = o.cur === 'Waving' ? 'Idle_A' : (Math.random() < 0.3 ? 'Cheering' : 'Waving'); const b = a === 'Idle_A' ? 'Waving' : 'Idle_A'; setAn(o, a); setAn(p, b); if (a !== 'Idle_A') o.say = lineFor(o, false); else p.say = lineFor(p, false); }
          setBub(o, o.cur === 'Idle_A' ? null : o.say); setBub(p, p.cur === 'Idle_A' ? null : p.say);
          if (o.t <= 0) { [o, p].forEach(q => { q.st = 'idle'; q.t = rr(1, 3); q.partner = null; setBub(q, null); }); } } }
      else if (o.st === 'hit') { o.t -= dt; if (o.t <= 0) { o.st = 'idle'; o.t = rr(1, 3); setBub(o, null); } }
      o.n.sp.g.position.set(o.x, 0, o.z); o.n.sp.g.rotation.y = o.h;
      if (o.bub.visible) o.bub.position.set(o.x, 0.78, o.z);
      if (o.fresh && o.st === 'walk') setBub(o, o.fresh); else if (o.fresh && o.st !== 'walk') { o.fresh = null; setBub(o, null); }
    }
    for (let i = 0; i < CROWD.length; i++) for (let j = i + 1; j < CROWD.length; j++) { const a = CROWD[i], b = CROWD[j]; const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz); if (d < 0.32 && d > 1e-4 && !((a.st === 'chat' || a.st === 'toP') && a.partner === b)) { const p = (0.32 - d) / 2; a.x += dx / d * p; a.z += dz / d * p; b.x -= dx / d * p; b.z -= dz / d * p; } }
    for (const o of CROWD) { if (!blockedAt(o.x, o.z)) { o.lx = o.x; o.lz = o.z; continue; }
      if (!blockedAt(o.lx, o.lz)) { o.x = o.lx; o.z = o.lz; } else { let bw = WP[0], bd = 1e9; for (const w of WP) { const dd = (w[0] - o.x) ** 2 + (w[1] - o.z) ** 2; if (dd < bd) { bd = dd; bw = w; } } o.x = o.lx = bw[0]; o.z = o.lz = bw[1]; }
      o.n.sp.g.position.set(o.x, 0, o.z); }
  }
  // ---------- serang & foto ----------
  const ATK = {KNIGHT: 'Melee_1H_Attack_Slice_Diagonal', MAGE: 'Ranged_Magic_Shoot', RANGER: 'Ranged_Bow_Release'};
  function doAttack() {
    if (!PL || PL.atk > 0) return; const nm = ATK[PL.job] || 'Melee_Unarmed_Attack_Punch_A'; const a = PL.mx.clipAction(clips[nm]); a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(1); a.fadeIn(0.08).play();
    PL.idle.fadeOut(0.08); PL.walk.fadeOut(0.08); PL.atkAct = a; PL.atk = 0.75; PL.moving = false;
    setTimeout(() => { if (!PL) return; const fx = Math.sin(PL.h), fz = Math.cos(PL.h); for (const o of CROWD) { const dx = o.x - PL.x, dz = o.z - PL.z, d = Math.hypot(dx, dz); if (d < 1.5 && (dx * fx + dz * fz) / (d || 1) > 0.2 && o.st !== 'hit') { if (o.partner) { o.partner.st = 'idle'; o.partner.t = 1; setBub(o.partner, null); } o.st = 'hit'; o.partner = null; o.t = 1.1; setAn(o, 'Hit_A', 0.08); setBub(o, 'hit'); face(o, PL.x, PL.z, 1, 1); } } }, 280);
  }
  function doFoto() { renderer.render(scene, camera); const src = renderer.domElement, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; const c = cv.getContext('2d'); c.drawImage(src, 0, 0); const fs = Math.round(cv.width * 0.04); c.font = '900 ' + fs + 'px Inter, Arial, sans-serif'; c.textAlign = 'right'; c.lineWidth = fs * 0.25; c.strokeStyle = '#2a1148'; c.fillStyle = '#ffd23a'; const tx = cv.width - fs * 0.6, ty = cv.height - fs * 0.7; const t1 = '@pohonwarga' + (PL ? '  ·  ' + PL.name.replace(/^@/, '') : ''); c.strokeText(t1, tx, ty); c.fillText(t1, tx, ty); cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pohon-warga-' + (PL ? PL.name.replace(/^@/, '') : 'kastil') + '.png'; a.click(); }); flash.style.opacity = 0.85; setTimeout(() => { flash.style.opacity = 0; }, 90); }
  atk.onclick = doAttack; fotoB.onclick = doFoto;
  { const uq = (Q.get('u') || '').replace(/^@/, '').toLowerCase(); if (uq) { const ui = WARGA.findIndex(o => o.u.toLowerCase() === uq); if (ui >= 0) setTimeout(() => startPlay(ui), 600); } }
  window.PLAY = startPlay; window.ATTACK = () => doAttack(); window.PLSTATE = () => PL && {x: PL.x, z: PL.z, moving: PL.moving};
  // LOD warga: di luar layar tidak digambar & tidak dianimasikan; yang jauh dianimasikan tiap 3 frame
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere(new THREE.Vector3(), 0.7); let _fc = 0;
  const lodOf = new Map(NPCS.map(n => [n.entry, n]));
  function updMixers(dt) {
    _fc++; camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    for (const m of mixers) { const n = lodOf.get(m);
      if (!n || n === (PL && PL.npc)) { m.mx.update(dt); continue; }
      const g = n.sp.g; _sp.center.set(g.position.x, 0.35, g.position.z);
      const vis = _fr.intersectsSphere(_sp); g.visible = vis; n.vis = vis; if (!vis) { m.acc = (m.acc || 0) + dt; continue; }
      const far = camera.position.distanceToSquared(_sp.center) > 1600;
      if (far && (_fc + (n.k || (n.k = (Math.random() * 3) | 0))) % 3) { m.acc = (m.acc || 0) + dt; continue; }
      m.mx.update(dt + (m.acc || 0)); m.acc = 0; } }
  (function loop() {
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    updMixers(dt); followBudi(t); updCrowd(dt); updPlayer(dt);
    if (LH.beam) LH.beam.rotation.y = t * 1.2;
    if (window.CAMPFIRE && curTime === 'malam') { const k = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.3) * 0.1; window.CAMPFIRE[0].scale.set(1, k, 1); window.CAMPFIRE[1].scale.set(1, 1.05 / k, 1); }
    if (tween) { const x = Math.min((t - tween.t0) / tween.dur, 1), e = ease(x); camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.g0, tween.g1, e); camera.fov = tween.f0 + (tween.f1 - tween.f0) * e; camera.updateProjectionMatrix(); if (x >= 1) tween = null; }
    if (BUDI) { if (camKey === 'budi' && !tween) { _v.subVectors(BUDI.g.position, lastB); camera.position.add(_v); controls.target.add(_v); } lastB.copy(BUDI.g.position); }
    controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
  })();
  {const e = document.getElementById('ldp'), b = document.getElementById('ldb'); if (e) e.textContent = '100%'; if (b) b.style.width = '100%'; const l = document.getElementById('ld'); if (l) { l.style.opacity = 0; setTimeout(() => l.remove(), 700); }} window.READY = 1; window.DBG = {BUDI, THREE, scene, PORTAL};
}
