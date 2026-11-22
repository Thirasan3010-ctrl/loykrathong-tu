// ===== minigame.js: เกมโยนห่วงลงขวด =====
// วิธีเล่น: แตะครั้งที่ 1 = ล็อกซ้าย-ขวา, แตะครั้งที่ 2 = ล็อกใกล้-ไกล แล้วห่วงจะลอยไปลงตรงนั้น
// ใช้เหรียญในเกม 10 เหรียญต่อรอบ (5 ห่วง) ลงขวดได้เหรียญคืน
import * as THREE from 'three';
import { toon, stripeTexture, labelTexture, glowTexture } from './textures.js';

export const TOSS_COST = 10;
export const TOSS_RINGS = 5;
export const TOSS_REWARD = 8; // เหรียญต่อห่วงที่ลงขวด
const PRIZES = ['ตุ๊กตาช้างน้อย 🐘', 'ตุ๊กตาหมีขาว 🧸', 'พวงกุญแจกระทง 🪷', 'ลูกโป่งรูปดาว ⭐'];

const BOTTLE_COLORS = ['#2e9e4f', '#3d7fd6', '#c0392b', '#e8b23a', '#8e44ad'];
const TABLE_Y = 0.9;
const NECK_Y = TABLE_Y + 0.42; // ความสูงปากขวด

export function buildRingToss(scene, x, z, rotY, colliders) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = toon('#8b5a2b');
  const M = (geo, mat, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); g.add(m); return m; };

  // พื้น + เคาน์เตอร์หน้าร้าน (ด้าน -z คือหน้าร้าน)
  M(new THREE.BoxGeometry(4.2, 0.08, 4.2), toon('#6d4c2f'), 0, 0.04, 1.0);
  M(new THREE.BoxGeometry(3.8, 0.7, 0.4), toon('#d35400'), 0, 0.35, -0.95);
  const ad = M(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({
    map: labelTexture(`โยนห่วง ${TOSS_COST} เหรียญ / ${TOSS_RINGS} ห่วง`, { bg: '#fff6e4', fg: '#d35400', border: '#e8b23a', w: 1024, h: 140, font: 'bold 64px sans-serif' }),
  }), 0, 0.37, -1.16);
  ad.rotation.y = Math.PI;
  // โต๊ะวางขวด
  M(new THREE.BoxGeometry(2.4, TABLE_Y, 1.6), toon('#f2e6cf'), 0, TABLE_Y / 2, 1.6);
  M(new THREE.BoxGeometry(2.42, 0.04, 1.62), toon('#c0392b'), 0, TABLE_Y + 0.02, 1.6);
  // ขวด 3x4
  const bottles = [];
  const glass = BOTTLE_COLORS.map((c) => toon(c));
  const cap = toon('#e8e8e8');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const bx = -0.75 + c * 0.5, bz = 1.05 + r * 0.55;
    const mat = glass[(r * 4 + c) % glass.length];
    M(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12), mat, bx, TABLE_Y + 0.17, bz);
    M(new THREE.CylinderGeometry(0.03, 0.07, 0.1, 12), mat, bx, TABLE_Y + 0.35, bz);
    M(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), cap, bx, TABLE_Y + 0.42, bz);
    bottles.push(new THREE.Vector2(bx, bz));
  }
  // ชั้นของรางวัลด้านหลัง (ตุ๊กตาแบบง่าย)
  M(new THREE.BoxGeometry(3.6, 0.1, 0.5), wood, 0, 1.9, 2.75);
  M(new THREE.BoxGeometry(3.6, 0.1, 0.5), wood, 0, 1.3, 2.75);
  const plushCols = ['#f5f5f5', '#c9a36b', '#ffb4e0', '#9bd1ff', '#ffd36b', '#b9a2ff'];
  for (let i = 0; i < 6; i++) {
    const px = -1.4 + i * 0.56, py = i % 2 ? 1.35 : 1.95;
    const pm = toon(plushCols[i]);
    M(new THREE.SphereGeometry(0.17, 12, 10), pm, px, py + 0.17, 2.75);
    M(new THREE.SphereGeometry(0.13, 12, 10), pm, px, py + 0.42, 2.72);
    M(new THREE.SphereGeometry(0.05, 8, 6), pm, px - 0.09, py + 0.53, 2.72);
    M(new THREE.SphereGeometry(0.05, 8, 6), pm, px + 0.09, py + 0.53, 2.72);
  }
  // เสา + หลังคาลายทาง + ป้าย
  for (const px of [-2, 2]) for (const pz of [-1.0, 3.0]) M(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), wood, px, 1.5, pz);
  const roof = M(new THREE.BoxGeometry(4.4, 0.1, 4.4), toon('#ffffff', { map: stripeTexture('#d35400', '#fff6e4') }), 0, 3.05, 1.0);
  roof.rotation.x = -0.1;
  const sign = M(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({
    map: labelTexture('🎯 เกมโยนห่วง', { bg: '#d35400', fg: '#ffffff', border: '#fff6e4' }), transparent: true,
  }), 0, 3.6, -1.1);
  sign.rotation.y = Math.PI;
  for (const bx of [-1.2, 0, 1.2]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf80', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(1.5);
    s.position.set(bx, 2.7, 0.5);
    g.add(s);
  }
  scene.add(g);
  g.updateMatrixWorld(true);

  const c = Math.cos(rotY), s = Math.sin(rotY);
  const toWorld = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  for (const lx of [-1.3, 0, 1.3]) for (const lz of [0.2, 1.6, 2.6]) { const p = toWorld(lx, lz); colliders.push({ x: p.x, z: p.z, r: 0.9 }); }
  const front = toWorld(0, -2.1);
  const local = (v) => v.applyMatrix4(g.matrixWorld);
  return { group: g, bottles, front, local, rotY };
}

// ----- ตัวเกม (เปิดเมื่อผู้เล่นจ่ายเหรียญ) -----
export class RingTossGame {
  constructor(scene, booth) {
    this.scene = scene;
    this.b = booth;
    this.active = false;
    this.text = {
      name: 'โยนห่วง', unit: 'ห่วง', hitWord: 'ลงขวด', hitToast: 'ลงขวด! 🎉',
      step1: 'แตะเพื่อเล็ง ซ้าย-ขวา', step2: 'แตะอีกทีเพื่อโยน! (ใกล้-ไกล)', btn2: '🎯 โยน!',
    };
    this.layer = new THREE.Group();
    this.layer.userData.dynamic = true;
    booth.group.add(this.layer);
    // ตัวชี้เป้า: วงแหวนเรืองแสงบนโต๊ะ + เส้นนำสายตา
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 24), new THREE.MeshBasicMaterial({ color: '#fff36b', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.renderOrder = 5;
    this.guide = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 1.6), new THREE.MeshBasicMaterial({ color: '#fff36b', transparent: true, opacity: 0.5, depthTest: false }));
    this.guide.renderOrder = 4;
    this.layer.add(this.marker, this.guide);
    this.layer.visible = false;
    this.ringMat = [new THREE.MeshToonMaterial({ color: '#ff4d6d' }), new THREE.MeshToonMaterial({ color: '#4dabf7' }), new THREE.MeshToonMaterial({ color: '#ffd166' })];
    this.ringGeo = new THREE.TorusGeometry(0.09, 0.018, 8, 20);
    this.rings = [];
  }
  start() {
    this.active = true;
    this.left = TOSS_RINGS;
    this.hits = 0;
    this.phase = 'x'; // x -> z -> fly
    this.t = 0;
    this.aimX = 0; this.aimZ = 1.6;
    this.layer.visible = true;
    for (const r of this.rings) this.layer.remove(r.mesh);
    this.rings = [];
  }
  stop() {
    this.active = false;
    this.layer.visible = false;
  }
  // กล้องมองจากหน้าร้านไปที่โต๊ะขวด
  cameraPose(pos, look) {
    pos.set(0, 2.4, -2.3); look.set(0, 0.85, 1.6);
    this.b.local(pos); this.b.local(look);
  }
  tap() {
    if (!this.active || this.left <= 0) return null;
    if (this.phase === 'x') { this.phase = 'z'; this.t = 0; return 'lockX'; }
    if (this.phase === 'z') { this.throw(); return 'throw'; }
    return null;
  }
  throw() {
    this.phase = 'fly';
    this.left--;
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat[this.left % 3]);
    this.layer.add(mesh);
    const target = new THREE.Vector2(this.aimX, this.aimZ);
    // หาขวดที่ใกล้ที่สุด
    let best = null, bd = 1e9;
    for (const b of this.b.bottles) { const d = b.distanceTo(target); if (d < bd) { bd = d; best = b; } }
    const hit = bd < 0.13;
    const end = hit ? new THREE.Vector3(best.x, NECK_Y - 0.06, best.y) : new THREE.Vector3(target.x, TABLE_Y + 0.06, target.y);
    const ring = { mesh, from: new THREE.Vector3(0, 1.5, -1.3), to: end, t: 0, hit, done: false };
    this.rings.push(ring);
    this.flying = ring;
  }
  // คืนค่าเหตุการณ์: 'hit' | 'miss' | 'end'
  update(dt) {
    if (!this.active) return null;
    this.t += dt;
    let ev = null;
    if (this.phase === 'x') {
      this.aimX = Math.sin(this.t * 1.7) * 0.95;
    } else if (this.phase === 'z') {
      this.aimZ = 1.6 + Math.sin(this.t * 1.6 - Math.PI / 2) * 0.75;
    }
    this.marker.position.set(this.aimX, TABLE_Y + 0.05, this.aimZ);
    this.marker.visible = this.phase !== 'fly';
    if (this.phase === 'x') { this.guide.visible = true; this.guide.rotation.y = 0; this.guide.position.set(this.aimX, TABLE_Y + 0.05, 1.6); this.guide.scale.set(1, 1, 1); }
    else if (this.phase === 'z') { this.guide.visible = true; this.guide.rotation.y = Math.PI / 2; this.guide.position.set(0, TABLE_Y + 0.05, this.aimZ); this.guide.scale.set(1, 1, 1.5); }
    else this.guide.visible = false;

    const r = this.flying;
    if (r) {
      r.t = Math.min(1, r.t + dt / 0.65);
      const p = r.mesh.position.lerpVectors(r.from, r.to, r.t);
      p.y += Math.sin(r.t * Math.PI) * 0.7; // โค้งพาราโบลา
      r.mesh.rotation.set(Math.PI / 2 + (1 - r.t) * 0.6, 0, r.t * 10);
      if (r.t >= 1) {
        r.mesh.rotation.set(Math.PI / 2 + (r.hit ? 0 : 0.25), 0, 0);
        this.flying = null;
        if (r.hit) this.hits++;
        ev = r.hit ? 'hit' : 'miss';
        if (this.left > 0) { this.phase = 'x'; this.t = 0; }
        else { this.phase = 'done'; this.doneIn = 1.0; }
      }
    }
    if (this.phase === 'done' && (this.doneIn -= dt) <= 0) { this.phase = 'over'; ev = 'end'; }
    return ev;
  }
  portraitPose(pos) { pos.set(0, 3.0, -4.3); this.b.local(pos); }
  lastHitPos() { return this.rings[this.rings.length - 1].mesh.getWorldPosition(new THREE.Vector3()); }
  worldPoint(lx, ly, lz) { return this.b.local(new THREE.Vector3(lx, ly, lz)); }
  prize() { return this.hits >= 3 ? PRIZES[Math.floor(Math.random() * PRIZES.length)] : null; }
}

// =====================================================================
// เกมปาลูกโป่ง: ลูกโป่งติดบนกระดาน แตะครั้งที่ 1 = ล็อกซ้าย-ขวา, ครั้งที่ 2 = ล็อกสูง-ต่ำ แล้วปาลูกดอก
// =====================================================================
export const DART_COST = 10;
export const DART_COUNT = 5;
export const DART_REWARD = 8;
const BOARD_Z = 2.45;
const BALLOON_COLORS = ['#ff4d6d', '#ffd166', '#4dabf7', '#69db7c', '#b197fc', '#ff922b'];

export function buildBalloonDart(scene, x, z, rotY, colliders) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = toon('#8b5a2b');
  const M = (geo, mat, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); g.add(m); return m; };
  M(new THREE.BoxGeometry(4.2, 0.08, 4.2), toon('#6d4c2f'), 0, 0.04, 1.0);
  M(new THREE.BoxGeometry(3.8, 0.7, 0.4), toon('#1971c2'), 0, 0.35, -0.95);
  const ad = M(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({
    map: labelTexture(`ปาลูกโป่ง ${DART_COST} เหรียญ / ${DART_COUNT} ดอก`, { bg: '#fff6e4', fg: '#1971c2', border: '#e8b23a', w: 1024, h: 140, font: 'bold 64px sans-serif' }),
  }), 0, 0.37, -1.16);
  ad.rotation.y = Math.PI;
  // กระดานไม้ก๊อกด้านหลัง
  M(new THREE.BoxGeometry(3.4, 2.0, 0.12), toon('#c9a36b'), 0, 1.8, BOARD_Z + 0.12);
  M(new THREE.BoxGeometry(3.6, 0.12, 0.16), toon('#1971c2'), 0, 2.85, BOARD_Z + 0.1);
  M(new THREE.BoxGeometry(3.6, 0.12, 0.16), toon('#1971c2'), 0, 0.75, BOARD_Z + 0.1);
  // ของรางวัลแขวนด้านข้าง
  const plushCols = ['#ffb4e0', '#9bd1ff', '#ffd36b', '#f5f5f5'];
  for (let i = 0; i < 4; i++) {
    const px = i < 2 ? -1.85 : 1.85, py = 1.3 + (i % 2) * 0.9, pm = toon(plushCols[i]);
    M(new THREE.SphereGeometry(0.17, 12, 10), pm, px, py + 0.17, 1.9);
    M(new THREE.SphereGeometry(0.13, 12, 10), pm, px, py + 0.42, 1.87);
  }
  for (const px of [-2, 2]) for (const pz of [-1.0, 3.0]) M(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), wood, px, 1.6, pz);
  const roof = M(new THREE.BoxGeometry(4.4, 0.1, 4.4), toon('#ffffff', { map: stripeTexture('#1971c2', '#fff6e4') }), 0, 3.25, 1.0);
  roof.rotation.x = -0.1;
  const sign = M(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({
    map: labelTexture('🎈 เกมปาลูกโป่ง', { bg: '#1971c2', fg: '#ffffff', border: '#fff6e4' }), transparent: true,
  }), 0, 3.8, -1.1);
  sign.rotation.y = Math.PI;
  for (const bx of [-1.2, 0, 1.2]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf80', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(1.5);
    sp.position.set(bx, 2.9, 0.5);
    g.add(sp);
  }
  scene.add(g);
  g.updateMatrixWorld(true);
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const toWorld = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  for (const lx of [-1.3, 0, 1.3]) for (const lz of [0.2, 1.6, 2.6]) { const p = toWorld(lx, lz); colliders.push({ x: p.x, z: p.z, r: 0.9 }); }
  // ลูกโป่ง 5x3 (InstancedMesh = วาดครั้งเดียวทั้งหมด) แยกไว้นอกส่วนที่รวมโมเดล เพราะต้องแตกได้
  const balloons = [];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 5; col++) balloons.push(new THREE.Vector2(-1.2 + col * 0.6, 1.3 + r * 0.5));
  const geo = new THREE.SphereGeometry(0.17, 14, 12);
  geo.scale(1, 1.18, 0.9);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff' }), balloons.length);
  inst.userData.dynamic = true;
  inst.frustumCulled = false;
  const col = new THREE.Color();
  balloons.forEach((b, i) => inst.setColorAt(i, col.set(BALLOON_COLORS[i % BALLOON_COLORS.length])));
  g.add(inst);
  const front = toWorld(0, -2.1);
  const local = (v) => v.applyMatrix4(g.matrixWorld);
  return { group: g, balloons, inst, front, local, rotY };
}

export class BalloonDartGame {
  constructor(scene, booth) {
    this.b = booth;
    this.active = false;
    this.text = {
      name: 'ปาลูกโป่ง', unit: 'ดอก', hitWord: 'แตก', hitToast: 'ปัง! ลูกโป่งแตก 🎈💥',
      step1: 'แตะเพื่อเล็ง ซ้าย-ขวา', step2: 'แตะอีกทีเพื่อปา! (สูง-ต่ำ)', btn2: '🎯 ปา!',
    };
    this.layer = new THREE.Group();
    this.layer.userData.dynamic = true;
    booth.group.add(this.layer);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.12, 24), new THREE.MeshBasicMaterial({ color: '#fff36b', side: THREE.DoubleSide, depthTest: false, transparent: true }));
    this.marker.renderOrder = 5;
    this.guide = new THREE.Mesh(new THREE.BoxGeometry(0.025, 2.0, 0.005), new THREE.MeshBasicMaterial({ color: '#fff36b', transparent: true, opacity: 0.5, depthTest: false }));
    this.guide.renderOrder = 4;
    this.layer.add(this.marker, this.guide);
    this.layer.visible = false;
    this.dartMat = new THREE.MeshToonMaterial({ color: '#e03131' });
    this.tipMat = new THREE.MeshToonMaterial({ color: '#c0c0c0' });
    this.darts = [];
    this.m4 = new THREE.Matrix4();
    this.resetBalloons();
  }
  resetBalloons() {
    this.popped = new Set();
    const { balloons, inst } = this.b;
    balloons.forEach((b, i) => { this.m4.makeTranslation(b.x, b.y, BOARD_Z); inst.setMatrixAt(i, this.m4); });
    inst.instanceMatrix.needsUpdate = true;
  }
  pop(i) {
    this.popped.add(i);
    this.m4.makeScale(0, 0, 0);
    this.b.inst.setMatrixAt(i, this.m4);
    this.b.inst.instanceMatrix.needsUpdate = true;
  }
  makeDart() {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), this.dartMat);
    body.rotation.x = Math.PI / 2;
    d.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 6), this.tipMat);
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.14;
    d.add(tip);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.005, 0.06), this.dartMat);
    fin.position.z = -0.1;
    d.add(fin);
    return d;
  }
  start() {
    this.active = true;
    this.left = DART_COUNT;
    this.hits = 0;
    this.phase = 'x'; this.t = 0;
    this.aimX = 0; this.aimY = 1.8;
    this.layer.visible = true;
    for (const d of this.darts) this.layer.remove(d.mesh);
    this.darts = [];
    this.resetBalloons();
  }
  stop() { this.active = false; this.layer.visible = false; }
  cameraPose(pos, look) { pos.set(0, 1.85, -2.4); look.set(0, 1.8, BOARD_Z); this.b.local(pos); this.b.local(look); }
  portraitPose(pos) { pos.set(0, 1.9, -4.6); this.b.local(pos); }
  tap() {
    if (!this.active || this.left <= 0) return null;
    if (this.phase === 'x') { this.phase = 'z'; this.t = 0; return 'lockX'; }
    if (this.phase === 'z') { this.throw(); return 'throw'; }
    return null;
  }
  throw() {
    this.phase = 'fly';
    this.left--;
    const target = new THREE.Vector2(this.aimX, this.aimY);
    let best = -1, bd = 1e9;
    this.b.balloons.forEach((b, i) => { if (this.popped.has(i)) return; const d = b.distanceTo(target); if (d < bd) { bd = d; best = i; } });
    const hit = best >= 0 && bd < 0.2;
    const mesh = this.makeDart();
    this.layer.add(mesh);
    const dart = { mesh, from: new THREE.Vector3(0, 1.5, -1.6), to: new THREE.Vector3(target.x, target.y, BOARD_Z - 0.05), t: 0, hit, idx: best };
    this.darts.push(dart);
    this.flying = dart;
  }
  update(dt) {
    if (!this.active) return null;
    this.t += dt;
    let ev = null;
    if (this.phase === 'x') this.aimX = Math.sin(this.t * 1.7) * 1.35;
    else if (this.phase === 'z') this.aimY = 1.8 + Math.sin(this.t * 1.6 - Math.PI / 2) * 0.65;
    this.marker.position.set(this.aimX, this.aimY, BOARD_Z - 0.2);
    this.marker.visible = this.phase === 'x' || this.phase === 'z';
    if (this.phase === 'x') { this.guide.visible = true; this.guide.rotation.z = 0; this.guide.position.set(this.aimX, 1.8, BOARD_Z - 0.18); }
    else if (this.phase === 'z') { this.guide.visible = true; this.guide.rotation.z = Math.PI / 2; this.guide.position.set(0, this.aimY, BOARD_Z - 0.18); }
    else this.guide.visible = false;
    const d = this.flying;
    if (d) {
      d.t = Math.min(1, d.t + dt / 0.4);
      const p = d.mesh.position.lerpVectors(d.from, d.to, d.t);
      p.y += Math.sin(d.t * Math.PI) * 0.25;
      d.mesh.lookAt(this.b.local(new THREE.Vector3(d.to.x, d.to.y, d.to.z + 1)));
      if (d.t >= 1) {
        this.flying = null;
        if (d.hit) { this.hits++; this.pop(d.idx); this.lastPos = d.mesh.getWorldPosition(new THREE.Vector3()); }
        ev = d.hit ? 'hit' : 'miss';
        if (this.left > 0) { this.phase = 'x'; this.t = 0; } else { this.phase = 'done'; this.doneIn = 1.0; }
      }
    }
    if (this.phase === 'done' && (this.doneIn -= dt) <= 0) { this.phase = 'over'; ev = 'end'; }
    return ev;
  }
  lastHitPos() { return this.lastPos || this.b.local(new THREE.Vector3(0, 1.8, BOARD_Z)); }
  prize() { return this.hits >= 3 ? PRIZES[Math.floor(Math.random() * PRIZES.length)] : null; }
}
