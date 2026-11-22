// ===== main.js: ตัวควบคุมหลักของเกม (หน้าจอ, ฉาก, ลูปเกม) =====
import * as THREE from 'three';
import { buildWorld, POND, BRIDGES, ENTRY } from './world.js';
import { buildWishTree } from './wishtree.js';
import { bakeStatic, bakeSprites, AutoQuality } from './perf.js';
import { buildRingToss, RingTossGame, TOSS_COST, TOSS_REWARD, buildBalloonDart, BalloonDartGame, DART_COST, DART_REWARD } from './minigame.js';
import { SHOPS, START_COINS, COIN_PER_RELEASE, findItem, buildFood } from './shops.js';
import { createCharacter, defaultOutfit, randomOutfit, sanitizeOutfit, BOTTOM_COLORS, HAIR_COLORS } from './character.js';
import { createKrathong, randomKrathong, BASES } from './krathong.js';
import { Input, isTouch } from './controls.js';
import { loadSave, writeSave, addReleased, clearSave } from './storage.js';
import { Music } from './audio.js';
import { toon, labelTexture, glowTexture, skyTexture } from './textures.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ===== ข้อมูลผู้เล่น (โหลดจากเครื่อง ถ้ามี) =====
const existing = loadSave();
const save = {
  status: 'single', mode: 'solo', companion: 'auto',
  outfit: defaultOutfit('female'),
  krathong: { base: 'banana_leaf', decor: ['flower', 'candle'] },
  released: [],
  ...(existing || {}),
};
// ข้อมูลจากเวอร์ชันก่อน (เช่นชุดไทย) ถูกแปลงให้เป็นค่าที่ใช้ได้
save.outfit = sanitizeOutfit(save.outfit);
if (!BASES.includes(save.krathong?.base)) save.krathong = { base: 'banana_leaf', decor: ['flower', 'candle'] };
// เหรียญในเกม (ไม่ใช่เงินจริง) + ของที่ซื้อแล้ว
if (!Number.isFinite(save.coins) || save.coins < 0) save.coins = START_COINS;
save.coins = Math.min(9999, Math.floor(save.coins));
save.treeWishes = Array.isArray(save.treeWishes) ? save.treeWishes.filter((w) => typeof w === 'string').map((w) => w.slice(0, 40)).slice(-10) : [];
save.bag = Array.isArray(save.bag) ? save.bag.filter((id) => findItem(id)).slice(-30) : [];
const persist = () => writeSave(save);

// ===== Renderer =====
const canvas = $('#game-canvas');
// มือถือ/แท็บเล็ต: ปรับความละเอียดตาม FPS อัตโนมัติ (ดู perf.js)
const MOBILE = isTouch() || Math.min(window.innerWidth, window.innerHeight) < 700;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE || (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
const quality = new AutoQuality(renderer, { mobile: MOBILE });
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ===== ฉากโลก (สระ) =====
const worldScene = new THREE.Scene();
const world = buildWorld(worldScene);
// ต้นไม้ขอพรกลางถนนทางเข้า (ระหว่างร้านแถวกลาง)
const wishTree = buildWishTree(worldScene, 0, 32, world.colliders, world.updaters, save.treeWishes);
// บูธเกม 2 บูธ ตั้งที่ขอบสระฝั่งทางเข้า ซ้าย = โยนห่วง ขวา = ปาลูกโป่ง (หันหน้าเข้าหาปากถนน เห็นตั้งแต่เดินออกมา)
const tossBooth = buildRingToss(worldScene, -16.5, 21.2, -Math.PI / 2, world.colliders);
const dartBooth = buildBalloonDart(worldScene, 16.5, 21.2, Math.PI / 2, world.colliders);
// รวมโมเดลฉากที่ไม่ขยับเป็นก้อนเดียวต่อวัสดุ (ส่วนที่สำคัญที่สุดสำหรับความลื่น)
const staticRoot = new THREE.Group();
staticRoot.name = 'static';
for (const c of [...worldScene.children]) if (!c.userData.dynamic && !c.isLight) staticRoot.attach(c);
worldScene.add(staticRoot);
bakeStatic(staticRoot);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 260);
bakeSprites(staticRoot, camera);
const GAMES = [
  { game: new RingTossGame(worldScene, tossBooth), booth: tossBooth, cost: TOSS_COST, reward: TOSS_REWARD, icon: '🎯' },
  { game: new BalloonDartGame(worldScene, dartBooth), booth: dartBooth, cost: DART_COST, reward: DART_REWARD, icon: '🎈' },
];
let minigame = false;
let cur = null;   // เกมที่กำลังเล่น
let nearG = null; // เกมที่ยืนอยู่หน้าบูธ

// ===== ฉากสตูดิโอ (ใช้พรีวิวตอนแต่งตัว/แต่งกระทง) =====
const studio = new THREE.Scene();
studio.background = skyTexture();
studio.add(new THREE.HemisphereLight('#fff1d6', '#3a2a50', 1.6));
const key = new THREE.DirectionalLight('#ffffff', 1.6);
key.position.set(2, 4, 5);
studio.add(key);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 40), toon('#e8b23a'));
pedestal.position.y = -0.06;
studio.add(pedestal);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf80', transparent: true, opacity: 0.35, depthWrite: false }));
halo.scale.setScalar(3.2);
halo.position.set(0, 0.7, -1.2);
studio.add(halo);
const studioCam = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
const studioPivot = new THREE.Group();
studio.add(studioPivot);
let previewChar = null, previewKrathong = null, studioRot = 0;

// ===== สถานะเกม =====
let state = 'title';
let editingFromWorld = false;
let worldEntered = false;
const input = new Input();
const music = new Music();

// ===== ตัวละครในโลก =====
let player = null, companion = null;
const playerPos = new THREE.Vector3(0, 0, ENTRY.spawnZ); // เริ่มที่ซุ้มประตูทางเข้า
let playerYaw = Math.PI; // หันหน้าเข้าหาสระ
const trail = [];
const npcs = [];
const floaters = []; // กระทงที่ลอยอยู่ในสระ
const particles = [];
let releaseCooldown = 0;
let currentZone = null;
let currentShop = null;
let nearTree = false;
let held = null; // ของกินที่ถืออยู่ในมือ {obj, left}

// ---------------------------------------------------------------
// ส่วน UI
// ---------------------------------------------------------------
const screens = ['title', 'status', 'dress', 'krathong'];
function showScreen(name) {
  state = name;
  for (const s of screens) $('#screen-' + s).classList.toggle('hidden', s !== name);
  $('#hud').classList.toggle('hidden', name !== 'world');
  if (name === 'dress' || name === 'krathong') { studioRot = 0; studioPivot.rotation.y = 0; } // เริ่มที่หันหน้าเข้ากล้อง
  if (name === 'dress') rebuildPreviewChar();
  if (name === 'krathong') rebuildPreviewKrathong();
  studioPivot.visible = true;
  if (previewChar) previewChar.group.visible = name === 'dress';
  if (previewKrathong) previewKrathong.group.visible = name === 'krathong';
  updateViewOffsets();
  refreshUI();
  resetFocus();
}

function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.classList.add('hidden'), ms);
}

// สร้างปุ่มสี
function buildSwatches(key, colors) {
  const box = $(`[data-swatch="${key}"]`);
  box.innerHTML = '';
  for (const c of colors) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.dataset.color = c;
    b.setAttribute('aria-label', 'สี ' + c);
    b.addEventListener('click', () => {
      save.outfit[key] = c;
      persist(); refreshUI(); rebuildPreviewChar();
    });
    box.appendChild(b);
  }
}
buildSwatches('bottomColor', BOTTOM_COLORS);
buildSwatches('hairColor', HAIR_COLORS);

// ค่าแต่ละกลุ่มตัวเลือกเก็บไว้ที่ไหน
function groupGet(group) {
  if (['status', 'mode', 'companion'].includes(group)) return save[group];
  if (group === 'base') return save.krathong.base;
  return String(save.outfit[group]);
}
function groupSet(group, value) {
  if (['status', 'mode', 'companion'].includes(group)) save[group] = value;
  else if (group === 'base') { save.krathong.base = value; rebuildPreviewKrathong(); }
  else if (group === 'gender') { save.outfit = defaultOutfit(value); rebuildPreviewChar(); }
  else {
    save.outfit[group] = group === 'length' ? Number(value) : value;
    // เปลี่ยนเป็นยีนส์ให้สีเริ่มต้นเป็นสียีนส์
    if (group === 'bottom' && value === 'jeans') save.outfit.bottomColor = '#3a5f9a';
    rebuildPreviewChar();
  }
  persist();
  refreshUI();
}

for (const row of $$('[data-group]')) {
  const group = row.dataset.group;
  for (const btn of row.querySelectorAll('.choice')) {
    btn.addEventListener('click', () => groupSet(group, btn.dataset.value));
  }
}
for (const btn of $$('[data-multi="decor"] .choice')) {
  btn.addEventListener('click', () => {
    const d = new Set(save.krathong.decor);
    d.has(btn.dataset.value) ? d.delete(btn.dataset.value) : d.add(btn.dataset.value);
    save.krathong.decor = [...d];
    persist(); refreshUI(); rebuildPreviewKrathong();
  });
}

function refreshUI() {
  for (const row of $$('[data-group]')) {
    const v = groupGet(row.dataset.group);
    for (const btn of row.querySelectorAll('.choice')) btn.classList.toggle('selected', btn.dataset.value === v);
  }
  for (const btn of $$('[data-multi="decor"] .choice')) btn.classList.toggle('selected', save.krathong.decor.includes(btn.dataset.value));
  for (const key of ['bottomColor', 'hairColor']) {
    for (const s of $$(`[data-swatch="${key}"] .swatch`)) s.classList.toggle('selected', s.dataset.color === save.outfit[key]);
  }
  const top = save.outfit.top;
  $('#way-box').classList.toggle('hidden', top === 'student');
  $('#companion-box').classList.toggle('hidden', save.mode !== 'pair');
  $('#companion-hint').textContent = save.companion === 'auto'
    ? (save.status === 'single'
      ? 'โสดใช่ไหม เดี๋ยวจัดคนเพศตรงข้ามมาเดินด้วยให้ 😉 (เลือกเองก็ได้นะ)'
      : 'ตั้งค่าเป็นเพศตรงข้ามไว้ให้ ถ้าคู่ของเราเป็นเพศเดียวกันเลือกเองได้เลย 💞')
    : '';
  $('#bread-warning').classList.toggle('hidden', save.krathong.base !== 'bread');
  $('#btn-continue').classList.toggle('hidden', !existing);
  $('#btn-sound').textContent = music.muted ? '🔇' : '🔊';
}

// ----- ปุ่มนำทาง -----
$('#btn-start').addEventListener('click', () => { music.start(); showScreen('status'); });
$('#btn-continue').addEventListener('click', () => { music.start(); enterWorld(); });
$('#btn-status-next').addEventListener('click', () => showScreen('dress'));
$('#btn-dress-next').addEventListener('click', () => (editingFromWorld ? enterWorld() : showScreen('krathong')));
$('#btn-krathong-next').addEventListener('click', () => enterWorld());
$('#btn-random-outfit').addEventListener('click', () => {
  save.outfit = randomOutfit(save.outfit.gender);
  persist(); refreshUI(); rebuildPreviewChar();
});
const backOf = { status: 'title', dress: 'status', krathong: 'dress' };
for (const b of $$('[data-back]')) {
  b.addEventListener('click', () => (editingFromWorld ? enterWorld() : showScreen(backOf[state])));
}

// ----- เมนู / เครดิต / คำอธิษฐาน -----
const overlays = ['dialog-wish', 'dialog-menu', 'dialog-credits', 'dialog-shop', 'dialog-tree'];
const isOpen = (id) => !$('#' + id).classList.contains('hidden');
const anyOverlay = () => overlays.some(isOpen);
function openOverlay(id) { $('#' + id).classList.remove('hidden'); resetFocus(); }
function closeOverlay(id) { $('#' + id).classList.add('hidden'); resetFocus(); }

$('#btn-menu').addEventListener('click', () => openOverlay('dialog-menu'));
$('#menu-resume').addEventListener('click', () => closeOverlay('dialog-menu'));
$('#menu-dress').addEventListener('click', () => { closeOverlay('dialog-menu'); editingFromWorld = true; showScreen('dress'); });
$('#menu-krathong').addEventListener('click', () => { closeOverlay('dialog-menu'); editingFromWorld = true; showScreen('krathong'); });
$('#menu-track').addEventListener('click', () => { if (music.muted) { music.toggle(); refreshUI(); } toast('🎵 ' + music.next()); });
$('#menu-credits').addEventListener('click', () => openOverlay('dialog-credits'));
$('#btn-credits-title').addEventListener('click', () => openOverlay('dialog-credits'));
$('#btn-credits-close').addEventListener('click', () => closeOverlay('dialog-credits'));
$('#menu-reset').addEventListener('click', () => {
  if (confirmReset()) { clearSave(); location.reload(); }
});
// ยืนยันการล้างข้อมูลด้วยการกดซ้ำภายใน 3 วินาที (ไม่ใช้ confirm() ที่บล็อกจอยสติ๊ก)
let resetArmed = 0;
function confirmReset() {
  if (Date.now() < resetArmed) return true;
  resetArmed = Date.now() + 3000;
  toast('กดอีกครั้งเพื่อยืนยันการล้างข้อมูล');
  return false;
}
$('#btn-sound').addEventListener('click', () => { music.toggle(); refreshUI(); });

$('#btn-release').addEventListener('click', () => openWish());
$('#btn-wish-cancel').addEventListener('click', () => closeOverlay('dialog-wish'));
$('#btn-wish-ok').addEventListener('click', () => submitWish());

function openWish() {
  if (!currentZone || releaseCooldown > 0 || anyOverlay()) return;
  $('#wish-input').value = '';
  openOverlay('dialog-wish');
  // คอมพิวเตอร์: โฟกัสช่องพิมพ์ทันที (มือถือรอให้แตะเอง จะได้ไม่เด้งคีย์บอร์ดบังจอ)
  if (!isTouch() && !input.usingGamepad) setTimeout(() => $('#wish-input').focus(), 50);
}
function submitWish() {
  const wish = $('#wish-input').value.trim().slice(0, 40) || 'ขอให้มีความสุขมากๆ';
  $('#wish-input').blur();
  closeOverlay('dialog-wish');
  releaseKrathong(wish);
}

// ---------------------------------------------------------------
// ต้นไม้ขอพร: เขียนคำขอแขวนบนต้น + อ่านคำขอใบอื่น
// ---------------------------------------------------------------
$('#btn-tree').addEventListener('click', () => openTree());
$('#btn-tree-close').addEventListener('click', () => closeOverlay('dialog-tree'));
$('#btn-tree-hang').addEventListener('click', () => hangWish());
$('#btn-tree-more').addEventListener('click', () => fillOthers());
function fillOthers() {
  const box = $('#tree-others');
  box.innerHTML = '';
  for (const w of wishTree.randomOthers(4)) {
    const d = document.createElement('div');
    d.className = 'tree-note';
    d.textContent = '📜 ' + w;
    box.appendChild(d);
  }
}
function openTree() {
  if (!wishTree || anyOverlay()) return;
  $('#tree-input').value = '';
  fillOthers();
  const mine = save.treeWishes;
  $('#tree-mine').textContent = mine.length ? `คำขอของเราที่แขวนไว้: ${mine.length} ใบ (ใบสีเหลืองทอง)` : '';
  openOverlay('dialog-tree');
  if (!isTouch() && !input.usingGamepad) setTimeout(() => $('#tree-input').focus(), 50);
}
function hangWish() {
  const text = $('#tree-input').value.trim().slice(0, 40);
  if (!text) { toast('เขียนคำขอก่อนนะ ✍️'); return; }
  $('#tree-input').blur();
  closeOverlay('dialog-tree');
  save.treeWishes = [...save.treeWishes, text].slice(-10);
  persist();
  wishTree.addTag(text, true, true);
  toast('แขวนคำขอบนต้นไม้แล้ว ขอให้เป็นจริงนะ 🎋');
}
// แตะ/คลิกกระดาษบนต้นไม้เพื่ออ่านคำขอ
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
// ----- ลากหน้าจอเพื่อหมุนกล้องรอบตัวละคร (ใช้ได้ทั้งนิ้วและเมาส์ ใช้พร้อมจอยได้) -----
let camYaw = 0, camYawTarget = 0;
const drag = { id: null, x: 0 };
canvas.addEventListener('pointerdown', (e) => {
  downAt = [e.clientX, e.clientY];
  if (state === 'world' && !minigame && !anyOverlay() && drag.id === null) {
    drag.id = e.pointerId; drag.x = e.clientX;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x; drag.x = e.clientX;
  camYawTarget -= dx * (isTouch() ? 0.009 : 0.006);
});
const endDrag = (e) => { if (e.pointerId === drag.id) drag.id = null; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerup', (e) => {
  if (minigame && downAt && state === 'world' && !anyOverlay()) { tossTap(); return; }
  if (!downAt || state !== 'world' || anyOverlay() || !wishTree) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) return; // ลากไม่นับเป็นแตะ
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(wishTree.papers(), false)[0];
  if (hit) {
    const tag = hit.object.userData.tag;
    toast((tag.mine ? '⭐ คำขอของเรา: ' : '📜 ') + tag.text, 3200);
    tag.group.scale.setScalar(0.6); // เด้งเล็กน้อยให้รู้ว่าแตะโดน
  }
});

// ---------------------------------------------------------------
// เกมโยนห่วง
// ---------------------------------------------------------------
$('#btn-toss').addEventListener('click', () => startToss());
$('#btn-toss-throw').addEventListener('click', (e) => { e.stopPropagation(); tossTap(); });
$('#btn-toss-exit').addEventListener('click', () => endToss());
$('#btn-toss-again').addEventListener('click', () => { const g = cur; endToss(); startToss(g); });
function startToss(entry = nearG) {
  if (anyOverlay() || minigame || !entry) return;
  if (save.coins < entry.cost) { toast(`ต้องใช้ ${entry.cost} เหรียญ ลองไปลอยกระทงรับเหรียญเพิ่มนะ`); return; }
  save.coins -= entry.cost;
  persist();
  refreshCoins();
  minigame = true;
  cur = entry;
  cur.game.start();
  if (player) player.group.visible = false;
  if (companion) companion.group.visible = false;
  $('#joystick').classList.add('hidden');
  $('#toss-hud').classList.remove('hidden');
  $('#hud-hint').classList.add('hidden');
  $('#toss-result').classList.add('hidden');
  $('#btn-toss-throw').classList.remove('hidden');
  refreshTossHud();
}
function tossTap() {
  if (!cur) return;
  const r = cur.game.tap();
  if (r) refreshTossHud();
}
function refreshTossHud() {
  const g = cur.game, tx = g.text;
  $('#toss-info').textContent = `${tx.unit}เหลือ ${g.left} • ${tx.hitWord}แล้ว ${g.hits}`;
  $('#toss-step').textContent = g.phase === 'x' ? tx.step1 : g.phase === 'z' ? tx.step2 : '';
  $('#btn-toss-throw').textContent = g.phase === 'z' ? tx.btn2 : '👆 เล็ง';
}
function updateToss(dt) {
  const g = cur.game, tx = g.text;
  const ev = g.update(dt);
  if (ev === 'hit') { burst(g.lastHitPos()); toast(tx.hitToast, 1200); }
  else if (ev === 'miss') toast('เกือบแล้ว! 😅', 1000);
  if (ev === 'hit' || ev === 'miss') refreshTossHud();
  if (ev === 'end') {
    const reward = g.hits * cur.reward;
    save.coins = Math.min(9999, save.coins + reward);
    const prize = g.prize();
    persist();
    refreshCoins();
    $('#btn-toss-throw').classList.add('hidden');
    $('#toss-step').textContent = '';
    $('#toss-result-text').textContent = `${tx.hitWord} ${g.hits}/5 ${tx.unit}  ได้ +${reward} เหรียญ` + (prize ? `\n🎁 ได้รางวัล: ${prize}` : g.hits ? '' : '\nไม่เป็นไรนะ ลองใหม่ได้');
    $('#btn-toss-again').textContent = `เล่นอีกรอบ (${cur.cost} เหรียญ)`;
    $('#toss-result').classList.remove('hidden');
  }
}
function endToss() {
  if (!minigame) return;
  minigame = false;
  cur.game.stop();
  cur = null;
  if (player) player.group.visible = true;
  if (companion) companion.group.visible = true;
  $('#toss-hud').classList.add('hidden');
  $('#hud-hint').classList.remove('hidden');
  $('#joystick').classList.toggle('hidden', !isTouch());
}

// ---------------------------------------------------------------
// ร้านอาหาร: ซื้อด้วยเหรียญในเกม
// ---------------------------------------------------------------
$('#btn-shop').addEventListener('click', () => openShop());
$('#btn-shop-close').addEventListener('click', () => closeOverlay('dialog-shop'));
let openShopData = null;
function refreshCoins() {
  $('#hud-coins').textContent = `🪙 ${save.coins}`;
  if (openShopData) $('#shop-coins').textContent = `เหรียญของเรา: 🪙 ${save.coins}`;
}
function openShop() {
  if (!currentShop || anyOverlay()) return;
  const shop = currentShop.shop;
  openShopData = shop;
  currentShop.greet();
  $('#shop-title').textContent = `ร้าน${shop.name}`;
  $('#shop-greet').textContent = pick(['แวะก่อนจ้า วันนี้อร่อยทุกอย่างเลย', 'เลือกได้เลยจ้า ของร้อนๆ', 'มาลอยกระทงต้องกินให้อิ่มนะจ๊ะ', 'อ่านหนังสือเหนื่อยไหม กินก่อนจ้า']);
  const list = $('#shop-items');
  list.innerHTML = '';
  for (const m of shop.menu) {
    const b = document.createElement('button');
    b.className = 'btn shop-item';
    b.innerHTML = `<span>${m.emoji} ${m.name}</span><b>${m.price} เหรียญ</b>`;
    b.disabled = save.coins < m.price;
    b.addEventListener('click', () => buy(m));
    list.appendChild(b);
  }
  refreshCoins();
  openOverlay('dialog-shop');
}
function buy(item) {
  if (save.coins < item.price) { toast('เหรียญไม่พอจ้า ลองไปลอยกระทงรับเหรียญเพิ่มนะ'); return; }
  save.coins -= item.price;
  save.bag = [...save.bag, item.id].slice(-30);
  persist();
  closeOverlay('dialog-shop');
  openShopData = null;
  holdFood(item);
  refreshCoins();
  toast(`ได้${item.name}แล้ว ${item.emoji} ขอบคุณจ้า!`);
}
function holdFood(item) {
  dropHeld();
  const obj = buildFood(item.food, { tint: item.tint, onion: item.id !== 'kk_plain' });
  obj.scale.setScalar(1.6);
  obj.position.set(0.24, 0.42, 0.2); // ถือไว้ข้างหน้ามือขวา
  if (player) player.group.add(obj);
  held = { obj, left: 40 };
}
function dropHeld() {
  if (!held) return;
  held.obj.parent?.remove(held.obj);
  held.obj.traverse((n) => { n.geometry?.dispose(); n.material?.dispose(); });
  held = null;
}

// ---------------------------------------------------------------
// โฟกัสสำหรับจอยสติ๊ก (เลื่อนเลือกปุ่มด้วย D-pad/สติ๊ก กด A เพื่อเลือก)
// ---------------------------------------------------------------
let focusIndex = 0;
function activeLayer() {
  for (const id of ['dialog-wish', 'dialog-shop', 'dialog-tree', 'dialog-credits', 'dialog-menu']) if (isOpen(id)) return $('#' + id);
  if (state === 'world') return null;
  return $('#screen-' + state);
}
function focusables() {
  const layer = activeLayer();
  if (!layer) return [];
  return [...layer.querySelectorAll('button, input')].filter((el) => el.offsetParent !== null);
}
function resetFocus() { focusIndex = 0; paintFocus(); }
function paintFocus() {
  for (const el of $$('.gp-focus')) el.classList.remove('gp-focus');
  if (!input.usingGamepad) return;
  const list = focusables();
  if (!list.length) return;
  focusIndex = (focusIndex + list.length) % list.length;
  list[focusIndex].classList.add('gp-focus');
  list[focusIndex].scrollIntoView({ block: 'nearest' });
}
input.on('nav', (dir) => {
  if (state === 'world' && !anyOverlay()) return;
  focusIndex += dir;
  paintFocus();
});
input.on('confirm', (src) => {
  if (src === 'input') { if (isOpen('dialog-wish')) submitWish(); else if (isOpen('dialog-tree')) hangWish(); return; }
  if (state === 'world' && minigame) { if (cur.game.phase === 'over') $('#btn-toss-again').click(); else tossTap(); return; }
  if (state === 'world' && !anyOverlay()) { if (currentShop) openShop(); else if (nearG) startToss(); else if (nearTree) openTree(); else openWish(); return; }
  if (src === 'pad') {
    const list = focusables();
    const el = list[focusIndex];
    if (!el) return;
    if (!el.classList.contains('gp-focus')) { paintFocus(); return; } // กดครั้งแรกแค่โชว์โฟกัส
    el.tagName === 'INPUT' ? el.focus() : el.click();
  }
});
input.on('back', () => {
  if (isOpen('dialog-wish')) return closeOverlay('dialog-wish');
  if (isOpen('dialog-shop')) return closeOverlay('dialog-shop');
  if (isOpen('dialog-tree')) return closeOverlay('dialog-tree');
  if (minigame) return endToss();
  if (isOpen('dialog-credits')) return closeOverlay('dialog-credits');
  if (isOpen('dialog-menu')) return closeOverlay('dialog-menu');
  const back = activeLayer()?.querySelector('[data-back]');
  if (back) back.click();
});
input.on('menu', () => {
  if (isOpen('dialog-credits')) return closeOverlay('dialog-credits');
  if (state !== 'world') return;
  if (isOpen('dialog-wish')) return closeOverlay('dialog-wish');
  isOpen('dialog-menu') ? closeOverlay('dialog-menu') : openOverlay('dialog-menu');
});

// ---------------------------------------------------------------
// พรีวิวในสตูดิโอ
// ---------------------------------------------------------------
function rebuildPreviewChar() {
  if (previewChar) { studioPivot.remove(previewChar.group); previewChar.dispose(); }
  previewChar = createCharacter(save.outfit);
  previewChar.group.visible = state === 'dress';
  studioPivot.add(previewChar.group);
}
function rebuildPreviewKrathong() {
  if (previewKrathong) { studioPivot.remove(previewKrathong.group); previewKrathong.dispose(); }
  previewKrathong = createKrathong(save.krathong, { light: true });
  previewKrathong.group.scale.setScalar(1.6);
  previewKrathong.group.visible = state === 'krathong';
  studioPivot.add(previewKrathong.group);
}
// ลากเมาส์/นิ้วเพื่อหมุนโมเดลบนพรีวิวเอง (ไม่หมุนอัตโนมัติ)
// หมายเหตุ: หน้าจอแต่งตัวคลุม canvas อยู่ จึงต้องรับเหตุการณ์ที่ตัวหน้าจอ (ยกเว้นแผงตัวเลือก)
let dragX = null, dragId = null;
for (const id of ['#screen-dress', '#screen-krathong']) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.panel')) return;
    dragX = e.clientX; dragId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (dragX === null || e.pointerId !== dragId) return;
    studioRot += (e.clientX - dragX) * 0.012;
    dragX = e.clientX;
  });
  const end = () => { dragX = null; dragId = null; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------
// เข้าสู่ฉากสระ
// ---------------------------------------------------------------
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function companionOutfit() {
  let g = save.companion;
  if (g === 'auto') {
    const me = save.outfit.gender;
    g = me === 'female' ? 'male' : me === 'male' ? 'female' : pick(['female', 'male']);
  } else if (g === 'random') g = pick(['female', 'male']);
  return randomOutfit(g);
}

function enterWorld() {
  editingFromWorld = false;
  // สร้างตัวผู้เล่นใหม่ตามชุดล่าสุด
  if (player) { worldScene.remove(player.group); player.dispose(); }
  player = createCharacter(save.outfit);
  worldScene.add(player.group);
  if (held) player.group.add(held.obj);
  refreshCoins();
  // คนเดินคู่
  if (companion) { worldScene.remove(companion.group); companion.dispose(); companion = null; }
  if (save.mode === 'pair') {
    companion = createCharacter(companionOutfit());
    companion.group.position.copy(playerPos).add(new THREE.Vector3(0.9, 0, 0.6));
    worldScene.add(companion.group);
  }
  trail.length = 0;
  if (!worldEntered) {
    worldEntered = true;
    // กระทงที่เราเคยลอยไว้ (เก็บในเครื่อง)
    for (const k of save.released || []) spawnFloater(k, { isPlayer: true });
  }
  showScreen('world');
  const how = input.usingGamepad
    ? 'โยกสติ๊กซ้ายเพื่อเดิน • สติ๊กขวาหมุนกล้อง • แวะร้านอาหาร ต้นไม้ขอพร เกมโยนห่วง ปาลูกโป่ง • ไปที่วงแสงบนสะพาน แล้วกด A เพื่อลอยกระทง'
    : isTouch()
      ? 'ใช้จอยซ้ายล่างเดิน • ลากจอเพื่อหมุนกล้อง • แวะร้านอาหาร ต้นไม้ขอพร เกมโยนห่วง ปาลูกโป่ง • ไปที่วงแสงบนสะพาน แล้วแตะปุ่มลอยกระทง'
      : 'WASD / ลูกศร เพื่อเดิน • คลิกค้างลากเพื่อหมุนกล้อง • แวะร้านอาหาร ต้นไม้ขอพร เกมโยนห่วง ปาลูกโป่ง (E) • ไปที่วงแสงบนสะพาน แล้วกด E หรือ Space';
  $('#hud-hint').textContent = how;
  $('#joystick').classList.toggle('hidden', !isTouch());
  persist();
}

// ---------------------------------------------------------------
// กระทงที่ลอยในสระ
// ---------------------------------------------------------------
const HALF_X = POND.w / 2 - 0.8, HALF_Z = POND.d / 2 - 0.8;
let lightOwner = null; // กระทงที่ถือ PointLight อยู่ (มีได้ทีละ 1 อัน)

function makeLabel(text, isPlayer) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(text, isPlayer ? {} : { fg: '#3b2a20', border: '#ffd98a', font: 'bold 38px sans-serif' }),
    transparent: true, depthWrite: false,
  }));
  s.scale.set(2.4, 0.6, 1);
  s.position.y = 1.15;
  return s;
}

function spawnFloater(data, { isPlayer = false, x, z, vx, vz, light = false } = {}) {
  const k = createKrathong(data, { light });
  k.group.scale.setScalar(1.25);
  const f = {
    k, isPlayer,
    x: x ?? (Math.random() * 2 - 1) * HALF_X,
    z: z ?? (Math.random() * 2 - 1) * HALF_Z,
    vx: vx ?? (Math.random() * 2 - 1) * 0.25,
    vz: vz ?? (Math.random() * 2 - 1) * 0.25,
    phase: Math.random() * 10,
    label: makeLabel(isPlayer ? '💛 ' + data.wish : data.wish, isPlayer),
  };
  f.label.visible = false;
  k.group.add(f.label);
  worldScene.add(k.group);
  floaters.push(f);
  return f;
}

// กระทงบอท 11 อัน ลอยอยู่แล้วตั้งแต่เริ่มฉาก
for (let i = 0; i < 11; i++) spawnFloater(randomKrathong());

// โหมดประหยัด: เครื่องที่ช้ามากๆ (ลดความละเอียดสุดแล้วยังกระตุก) -> ลดคนเดินและกระทงบอท
quality.onLow = () => {
  npcs.forEach((n, i) => { if (i >= 2) n.c.group.visible = false; });
  floaters.filter((f) => !f.isPlayer).forEach((f, i) => { if (i >= 6) f.k.group.visible = false; });
  worldScene.fog.far = 70;
  camera.far = 120; camera.updateProjectionMatrix();
};

function releaseKrathong(wish) {
  const b = currentZone || BRIDGES[0];
  const data = { base: save.krathong.base, decor: [...save.krathong.decor], wish };
  // ย้ายแสงจริงมาที่กระทงใหม่
  if (lightOwner) {
    const l = lightOwner.k.group.getObjectByProperty('isPointLight', true);
    if (l) l.parent.remove(l);
  }
  const f = spawnFloater(data, {
    isPlayer: true, light: true,
    x: b.x, z: b.zStart - b.length - 0.3,
    vx: (Math.random() * 2 - 1) * 0.12, vz: -0.55,
  });
  lightOwner = f;
  f.newest = true;
  for (const o of floaters) if (o !== f) o.newest = false;
  // จำกัดกระทงของผู้เล่นในสระไม่เกิน 6 อัน
  const mine = floaters.filter((o) => o.isPlayer);
  if (mine.length > 6) removeFloater(mine[0]);

  addReleased(save, data);
  burst(new THREE.Vector3(f.x, POND.waterY + 0.4, f.z));
  releaseCooldown = 2.5;
  save.coins = Math.min(9999, save.coins + COIN_PER_RELEASE);
  persist();
  refreshCoins();
  toast(`ลอยกระทงแล้ว ขอให้สมหวังนะ 🌕  (+${COIN_PER_RELEASE} เหรียญ)`);
}

function removeFloater(f) {
  worldScene.remove(f.k.group);
  f.k.dispose();
  f.label.material.map.dispose();
  floaters.splice(floaters.indexOf(f), 1);
}

// ประกายแสงลอยขึ้นตอนปล่อยกระทง
function burst(at) {
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: pick(['#ffd36b', '#ff9fb0', '#fff4c9']), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.copy(at);
    s.scale.setScalar(0.35);
    worldScene.add(s);
    particles.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2), life: 1.6 });
  }
}

// ---------------------------------------------------------------
// บอทเดินเล่นรอบสระ (สุ่มชุดจากระบบเดียวกับผู้เล่น)
// ---------------------------------------------------------------
const PATH = { x: 23.5, z: 16 };
const PERIM = 2 * (PATH.x * 2 + PATH.z * 2);
function pathPoint(s) {
  s = ((s % PERIM) + PERIM) % PERIM;
  const W = PATH.x * 2, D = PATH.z * 2;
  if (s < W) return [-PATH.x + s, PATH.z];
  s -= W; if (s < D) return [PATH.x, PATH.z - s];
  s -= D; if (s < W) return [PATH.x - s, -PATH.z];
  s -= W; return [-PATH.x, -PATH.z + s];
}
for (let i = 0; i < 4; i++) {
  const c = createCharacter(randomOutfit());
  worldScene.add(c.group);
  npcs.push({ c, s: (PERIM / 4) * i + Math.random() * 10, speed: (1 + Math.random() * 0.4) * (i % 2 ? 1 : -1) });
}

// ---------------------------------------------------------------
// อัปเดตแต่ละเฟรม
// ---------------------------------------------------------------
const tmp = new THREE.Vector3();
function updateWorld(dt, t) {
  world.update(dt, t, camera.position);

  // ----- ผู้เล่นเดิน -----
  let moving = false;
  if (state === 'world' && !anyOverlay() && !minigame) {
    const mv = input.getMove();
    const amt = Math.hypot(mv.x, mv.y);
    if (amt > 0.05) {
      const speed = 4.2 * amt;
      // ทิศเดินอิงมุมกล้อง: ดันจอยขึ้น = เดินไปข้างหน้าตามที่กล้องมอง
      const cs = Math.cos(camYaw), sn = Math.sin(camYaw);
      const wx = mv.x * cs + mv.y * sn, wz = -mv.x * sn + mv.y * cs;
      const nx = playerPos.x + wx * speed * dt, nz = playerPos.z + wz * speed * dt;
      // เดินชิดขอบได้แบบไถล (ลองทีละแกน)
      if (world.canWalk(nx, nz)) { playerPos.x = nx; playerPos.z = nz; }
      else if (world.canWalk(nx, playerPos.z)) playerPos.x = nx;
      else if (world.canWalk(playerPos.x, nz)) playerPos.z = nz;
      world.resolveColliders(playerPos);
      const target = Math.atan2(wx, wz);
      let diff = target - playerYaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      playerYaw += diff * Math.min(1, dt * 12);
      moving = true;
    }
  }
  if (player) {
    player.group.position.copy(playerPos);
    player.group.rotation.y = playerYaw;
    player.update(dt, moving, 1.1);
  }

  // ----- คนเดินคู่ตามหลัง -----
  if (companion) {
    const last = trail[trail.length - 1];
    if (!last || last.distanceTo(playerPos) > 0.15) trail.push(playerPos.clone());
    if (trail.length > 40) trail.shift();
    const target = trail.length > 8 ? trail[trail.length - 8] : null;
    const cp = companion.group.position;
    let cMoving = false;
    if (target && cp.distanceTo(playerPos) > 1.1) {
      tmp.copy(target).sub(cp);
      const d = tmp.length();
      if (d > 0.05) {
        tmp.normalize().multiplyScalar(Math.min(d, 4.6 * dt * Math.min(1.5, d)));
        cp.add(tmp);
        companion.group.rotation.y = Math.atan2(tmp.x, tmp.z);
        cMoving = true;
      }
    }
    companion.update(dt, cMoving, 1.1);
  }

  // ----- บอทเดินเล่น -----
  for (const n of npcs) {
    const [x0, z0] = pathPoint(n.s);
    n.s += n.speed * dt;
    const [x1, z1] = pathPoint(n.s);
    n.c.group.position.set(x1, 0, z1);
    n.c.group.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    n.c.update(dt, true, Math.abs(n.speed) * 0.8);
  }

  // ----- กระทงลอยตามน้ำ -----
  for (const f of floaters) {
    f.x += f.vx * dt; f.z += f.vz * dt;
    // ชะลอความเร็วจนเหลือลอยช้าๆ
    const sp = Math.hypot(f.vx, f.vz);
    if (sp > 0.3) { f.vx *= 1 - dt * 0.25; f.vz *= 1 - dt * 0.25; }
    if (Math.abs(f.x) > HALF_X) { f.vx = -f.vx; f.x = Math.sign(f.x) * HALF_X; }
    if (Math.abs(f.z) > HALF_Z) { f.vz = -f.vz; f.z = Math.sign(f.z) * HALF_Z; }
    const g = f.k.group;
    g.position.set(f.x, POND.waterY + 0.02 + Math.sin(t * 1.6 + f.phase) * 0.035, f.z);
    g.rotation.y += dt * 0.08;
    g.rotation.z = Math.sin(t * 1.3 + f.phase) * 0.04;
    f.k.update(t);
    // ป้ายคำอธิษฐานโชว์เมื่อเดินเข้าใกล้ หรือเป็นกระทงล่าสุดของเรา
    const near = Math.hypot(f.x - playerPos.x, f.z - playerPos.z) < 6.5;
    f.label.visible = state === 'world' && (f.newest || near);
  }

  // ----- ประกายแสง -----
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.s.position.addScaledVector(p.v, dt);
    p.s.material.opacity = Math.max(0, p.life / 1.6);
    if (p.life <= 0) { worldScene.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); }
  }

  // ----- จุดปล่อยกระทง -----
  releaseCooldown -= dt;
  currentZone = state === 'world' ? world.releaseZone(playerPos.x, playerPos.z) : null;
  currentShop = state === 'world' && !currentZone ? world.shopZone(playerPos.x, playerPos.z) : null;
  nearTree = state === 'world' && !currentZone && !currentShop && wishTree && Math.hypot(playerPos.x - wishTree.x, playerPos.z - wishTree.z) < 4.6;
  $('#btn-tree').classList.toggle('hidden', !nearTree || anyOverlay() || minigame);
  nearG = null;
  if (state === 'world' && !minigame && !currentZone && !currentShop && !nearTree) {
    for (const e of GAMES) if (Math.hypot(playerPos.x - e.booth.front.x, playerPos.z - e.booth.front.z) < 2.4) nearG = e;
  }
  $('#btn-toss').classList.toggle('hidden', !nearG || anyOverlay());
  if (nearG) {
    const tl = `${nearG.icon} เล่น${nearG.game.text.name} (${nearG.cost} เหรียญ)` + (input.usingGamepad ? ' (A)' : isTouch() ? '' : ' (E)');
    if ($('#btn-toss').textContent !== tl) $('#btn-toss').textContent = tl;
  }
  if (minigame) updateToss(dt);
  if (nearTree) {
    const tl = '🎋 ต้นไม้ขอพร' + (input.usingGamepad ? ' (A)' : isTouch() ? '' : ' (E)');
    if ($('#btn-tree').textContent !== tl) $('#btn-tree').textContent = tl;
  }
  if (minigame) currentShop = null;
  const showShop = !!currentShop && !anyOverlay();
  $('#btn-shop').classList.toggle('hidden', !showShop);
  if (showShop) {
    const key = input.usingGamepad ? ' (A)' : isTouch() ? '' : ' (E)';
    const sl = `🛒 ซื้อ${currentShop.shop.name}${key}`;
    if ($('#btn-shop').textContent !== sl) $('#btn-shop').textContent = sl;
  }
  // ของที่ถืออยู่: ถือไว้สักพักแล้ว "กินหมด"
  if (held && (held.left -= dt) <= 0) { dropHeld(); toast('อร่อยจัง 😋'); }
  const showBtn = !!currentZone && releaseCooldown <= 0 && !anyOverlay() && !minigame;
  $('#btn-release').classList.toggle('hidden', !showBtn);
  const label = input.usingGamepad ? '🏮 ลอยกระทง (A)' : isTouch() ? '🏮 ลอยกระทง' : '🏮 ลอยกระทง (E)';
  if ($('#btn-release').textContent !== label) $('#btn-release').textContent = label;
}

// ----- กล้อง -----
const camPos = new THREE.Vector3(0, 12, ENTRY.spawnZ + 23);
const lookAt = new THREE.Vector3();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function updateCamera(dt, t) {
  if (state === 'world' && minigame) {
    const portrait = camera.aspect < 1;
    cur.game.cameraPose(tmpA, tmpB);
    if (portrait) cur.game.portraitPose(tmpA);
    camPos.lerp(tmpA, 1 - Math.exp(-dt * 6));
    lookAt.lerp(tmpB, 1 - Math.exp(-dt * 6));
  } else if (state === 'world') {
    // สติ๊กขวาของจอยเกมก็หมุนกล้องได้
    const rx = input.pad?.axes[2] || 0;
    if (Math.abs(rx) > 0.25 && !anyOverlay()) camYawTarget -= rx * dt * 2.4;
    camYaw += (camYawTarget - camYaw) * Math.min(1, dt * 10);
    const portrait = camera.aspect < 1;
    const dist = portrait ? 11.5 : 8.5, h = portrait ? 8 : 5.5;
    const cs = Math.cos(camYaw), sn = Math.sin(camYaw);
    const want = tmpA.set(playerPos.x + sn * dist, h, playerPos.z + cs * dist);
    // ตอนหมุนให้กล้องตามทันที (ไม่หน่วงจนเหวี่ยงตัด)
    camPos.lerp(want, 1 - Math.exp(-dt * (drag.id !== null ? 14 : 5)));
    lookAt.lerp(tmpB.set(playerPos.x - sn * 1.5, 0.8, playerPos.z - cs * 1.5), 1 - Math.exp(-dt * 6));
  } else {
    // หน้าเมนู: กล้องหมุนช้าๆ รอบสระ
    const a = t * 0.06;
    camPos.set(Math.sin(a) * 30, 11, Math.cos(a) * 30 + 4);
    lookAt.set(0, 0, -6);
  }
  // มุมกล้องพิเศษ (ใช้ถ่ายภาพโปรโมต ผ่าน window.__game.camOverride)
  const ov = window.__game?.camOverride;
  if (ov) { camPos.set(...ov.pos); lookAt.set(...ov.look); }
  camera.position.copy(camPos);
  camera.lookAt(lookAt);
}

function updateStudio(dt) {
  // หมุนด้วยปุ่มลูกศร/A-D หรือสติ๊กขวาของจอยได้ด้วย
  let turn = 0;
  if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) turn -= 1;
  if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) turn += 1;
  const rx = input.pad?.axes[2] || 0;
  if (Math.abs(rx) > 0.25) turn += rx;
  studioRot += turn * dt * 2.5;
  // ค่อยๆ ไล่มุมให้หมุนลื่นๆ
  studioPivot.rotation.y += (studioRot - studioPivot.rotation.y) * Math.min(1, dt * 14);
  const portrait = studioCam.aspect < 1;
  if (state === 'dress') {
    const dist = portrait ? 5.8 : 3.1;
    studioCam.position.set(0, 0.8, dist);
    studioCam.lookAt(0, 0.65, 0);
  } else {
    const dist = portrait ? 4.4 : 3.0;
    studioCam.position.set(0, 1.0, dist);
    studioCam.lookAt(0, 0.3, 0);
  }
  if (previewKrathong) previewKrathong.update(performance.now() / 1000);
}

// เลื่อนภาพให้โมเดลอยู่ในพื้นที่ที่แผงตัวเลือกไม่บัง
function updateViewOffsets() {
  const w = window.innerWidth, h = window.innerHeight;
  const studioMode = state === 'dress' || state === 'krathong';
  if (studioMode) {
    if (w / h < 1) studioCam.setViewOffset(w, h, 0, h * 0.26, w, h);
    else studioCam.setViewOffset(w, h, Math.min(w * 0.21, 220), 0, w, h);
  } else studioCam.clearViewOffset();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  studioCam.aspect = w / h; studioCam.updateProjectionMatrix();
  updateViewOffsets();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------
// ลูปหลัก
// ---------------------------------------------------------------
const clock = new THREE.Clock();
let gpWas = false;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  input.pollGamepad(dt);
  if (input.usingGamepad !== gpWas) { gpWas = input.usingGamepad; paintFocus(); }

  if (state === 'dress' || state === 'krathong') {
    updateStudio(dt);
    if (previewChar && state === 'dress') previewChar.update(dt, false);
    renderer.render(studio, studioCam);
  } else {
    updateWorld(dt, t);
    updateCamera(dt, t);
    renderer.render(worldScene, camera);
    quality.update(dt);
  }
  requestAnimationFrame(loop);
}

// เริ่มเกม
input.attachJoystick($('#joystick'));
showScreen('title');
loop();
$('#loading').classList.add('hidden');

// เปิดให้ทดสอบผ่าน console ได้
window.__game = { save, get state() { return state; }, playerPos, floaters, renderer, worldScene, quality, GAMES };
