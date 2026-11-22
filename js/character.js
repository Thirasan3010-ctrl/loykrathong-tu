// ===== character.js: ตัวละคร Chibi แบบ Modular รอบ 2 (น่ารักขึ้น + มี texture) =====
// ชุดเหลือเฉพาะแนว มธ. (ออกแบบใหม่ ไม่มีตราสัญลักษณ์) | โครงสร้างพร้อมเปลี่ยนเป็นโมเดล .glb ภายหลัง
import * as THREE from 'three';
import { bakeStatic } from './perf.js';
import {
  toon, shade, elephantTexture, hairTexture, faceTexture, topTexture, sleeveTexture, COLORWAYS,
  fabricTexture, denimTexture, joggerTexture, plaidTexture, labelTexture, glowTexture,
} from './textures.js';

// ----- ตัวเลือกทั้งหมด -----
export const TOPS = ['polo', 'cheer', 'jersey', 'hoodie', 'student'];
export const WAYS = ['red', 'cream', 'gold', 'navy', 'white'];
export const SKIRTS = ['pleated', 'plaid', 'tiered'];
export const PANTS = ['jeans', 'cargo', 'jogger', 'elephant', 'slacks'];
export const HAIRS = ['long', 'twintail', 'bob', 'short', 'bun'];
export const FACES = ['smile', 'happy', 'wink'];
export const ACCS = ['none', 'bow', 'flower', 'cap'];
export const BOTTOM_COLORS = ['#1f1f24', '#1f2f5a', '#3a5f9a', '#7a1f3d', '#4a5236', '#a31f24', '#d9c9a8', '#8e6fb8'];
export const HAIR_COLORS = ['#2b1d14', '#5a3825', '#1a1a1a', '#8b5a2b', '#c9a36b', '#7a4a7a'];
const SKIN = '#ffe0c8';

// ค่าเริ่มต้นตามเพศ (เปลี่ยนเองได้อิสระทุกชิ้น)
export function defaultOutfit(gender) {
  if (gender === 'male') {
    return { gender, hair: 'short', hairColor: HAIR_COLORS[0], face: 'smile', acc: 'none',
      top: 'hoodie', way: 'red', bottom: 'cargo', length: 3, bottomColor: '#4a5236' };
  }
  if (gender === 'lgbt') {
    return { gender, hair: 'bob', hairColor: HAIR_COLORS[5], face: 'wink', acc: 'flower',
      top: 'cheer', way: 'cream', bottom: 'jeans', length: 3, bottomColor: '#3a5f9a' };
  }
  return { gender: 'female', hair: 'long', hairColor: HAIR_COLORS[0], face: 'smile', acc: 'bow',
    top: 'polo', way: 'red', bottom: 'pleated', length: 2, bottomColor: '#1f1f24' };
}

// ตรวจข้อมูลชุดเก่าที่บันทึกไว้ (เช่นชุดไทยรอบก่อน) ให้กลับมาเป็นค่าที่ใช้ได้
export function sanitizeOutfit(o) {
  const d = defaultOutfit(o?.gender);
  const ok = (v, list) => list.includes(v);
  const r = { ...d, ...o };
  if (!ok(r.top, TOPS)) r.top = d.top;
  if (!ok(r.way, WAYS)) r.way = d.way;
  if (!ok(r.bottom, [...SKIRTS, ...PANTS])) { r.bottom = d.bottom; r.bottomColor = d.bottomColor; }
  if (!ok(r.hair, HAIRS)) r.hair = d.hair;
  if (!ok(r.face, FACES)) r.face = d.face;
  if (!ok(r.acc, ACCS)) r.acc = d.acc;
  if (![1, 2, 3].includes(r.length)) r.length = 3;
  if (!/^#[0-9a-f]{6}$/i.test(r.bottomColor)) r.bottomColor = d.bottomColor;
  if (!/^#[0-9a-f]{6}$/i.test(r.hairColor)) r.hairColor = d.hairColor;
  return r;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// สุ่มชุด (ใช้กับปุ่มสุ่ม บอทเดินเล่น และคนเดินคู่)
export function randomOutfit(gender) {
  const g = gender || pick(['female', 'male']);
  const o = defaultOutfit(g);
  o.hairColor = pick(HAIR_COLORS.slice(0, 5));
  o.face = pick(FACES);
  o.top = pick(TOPS);
  o.way = pick(WAYS);
  if (g === 'male') {
    o.hair = pick(['short', 'short', 'bun']);
    o.bottom = pick(PANTS);
    o.acc = pick(['none', 'none', 'cap']);
  } else if (g === 'female') {
    o.hair = pick(['long', 'twintail', 'bob', 'bun']);
    o.bottom = pick([...SKIRTS, ...SKIRTS, 'jeans', 'elephant']);
    o.acc = pick(['bow', 'flower', 'none', 'cap']);
  } else {
    o.hair = pick(HAIRS);
    o.bottom = pick([...SKIRTS, ...PANTS]);
    o.acc = pick(ACCS);
  }
  o.bottomColor = o.bottom === 'jeans' ? pick(['#3a5f9a', '#1f2f5a', '#1f1f24']) : pick(BOTTOM_COLORS);
  o.length = pick([3, 2, 2, 1]);
  return o;
}

// ----- ตัวช่วย -----
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#3a2216', side: THREE.BackSide });
OUTLINE.userData.shared = true;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// เส้นขอบการ์ตูน: ขยายผิวออกตามแนว normal แล้วแสดงเฉพาะด้านหลัง
function outline(m, t = 0.012) {
  const geo = m.geometry.clone();
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  m.add(new THREE.Mesh(geo, OUTLINE));
  return m;
}

// กระโปรงพลีท: ทรงกระบอกบาน แล้วดันขอบเข้า-ออกเป็นจีบ
function pleatGeometry(rTop, rBot, h, pleats = 18) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, pleats * 4, 3, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(x, z);
    const f = (((a / (Math.PI * 2)) * pleats * 2) % 2 + 2) % 2;
    const tri = Math.abs(f - 1);
    const t = (h / 2 - y) / h; // 0 = เอว, 1 = ชายกระโปรง
    const k = 1 + (tri - 0.5) * 0.14 * (0.25 + t);
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// ชั้นกระโปรงระบาย: ชายเป็นคลื่น
function ruffleGeometry(rTop, rBot, h) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 64, 2, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (h / 2 - y) / h;
    const a = Math.atan2(x, z);
    const k = 1 + Math.sin(a * 14) * 0.05 * t;
    p.setXYZ(i, x * k, y - Math.sin(a * 14) * 0.008 * t, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// ขนาดหลัก (หน่วย = เมตร) สัดส่วน Chibi หัวโต ตัวเล็ก
const HIP_Y = 0.36, SHOULDER_Y = 0.65, HEAD_Y = 0.98, HEAD_R = 0.3;

export function createCharacter(outfit) {
  const o = sanitizeOutfit(outfit);
  const way = COLORWAYS[o.way] || COLORWAYS.red;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinMat = toon(SKIN);
  const hairMat = toon('#ffffff', { map: hairTexture(o.hairColor) });
  const topMat = toon('#ffffff', { map: topTexture(o.top, o.way) });
  const sleeveMat = toon('#ffffff', { map: sleeveTexture(o.top, o.way) });
  const trimMat = toon(o.top === 'student' ? '#fbfbf7' : way.trim);
  const isSkirt = SKIRTS.includes(o.bottom);

  // ===== วัสดุท่อนล่าง =====
  let pantsMat;
  if (o.bottom === 'jeans') pantsMat = toon(o.bottomColor, { map: denimTexture() });
  else if (o.bottom === 'jogger') pantsMat = toon('#ffffff', { map: joggerTexture(o.bottomColor) });
  else if (o.bottom === 'elephant') pantsMat = toon('#ffffff', { map: elephantTexture(o.bottomColor) });
  else pantsMat = toon(o.bottomColor, { map: fabricTexture() });

  // ===== ขา + รองเท้าผ้าใบ =====
  const legs = [];
  const legLen = 0.33;
  const cover = { 3: 1, 2: 0.68, 1: 0.36 }[o.length];
  const showSocks = isSkirt || o.length === 1;
  const shoeMat = toon('#fbfbf7');
  const soleMat = toon(o.top === 'student' ? '#2b2b2b' : way.accent);
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.085, HIP_Y, 0);
    pivot.add(mesh(new THREE.CylinderGeometry(0.045, 0.042, legLen, 10), skinMat, 0, -legLen / 2, 0));
    if (showSocks) pivot.add(mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.09, 10), toon('#ffffff'), 0, -legLen + 0.05, 0));
    if (!isSkirt) {
      const len = legLen * cover;
      const shape = {
        jeans: [0.075, 0.098], cargo: [0.082, 0.072], jogger: [0.076, 0.06], elephant: [0.08, 0.112], slacks: [0.073, 0.068],
      }[o.bottom];
      pivot.add(mesh(new THREE.CylinderGeometry(shape[0], shape[1], len, 14), pantsMat, 0, -len / 2, 0));
      const hemY = -len;
      if (o.bottom === 'jeans' && o.length === 3) {
        // พับปลายขา
        pivot.add(mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.035, 14), toon(shade(o.bottomColor, 0.12), { map: denimTexture() }), 0, hemY + 0.018, 0));
      }
      if ((o.bottom === 'cargo' || o.bottom === 'jogger') && o.length === 3) {
        // ปลายขาจั๊ม
        pivot.add(mesh(new THREE.CylinderGeometry(0.056, 0.052, 0.04, 12), toon(shade(o.bottomColor, -0.12)), 0, hemY + 0.02, 0));
      }
      if (o.bottom === 'cargo') {
        // กระเป๋าข้างต้นขา + ฝากระเป๋า
        const py = -Math.min(len * 0.5, 0.12);
        pivot.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.075), toon(shade(o.bottomColor, -0.08)), side * 0.08, py, 0));
        pivot.add(mesh(new THREE.BoxGeometry(0.034, 0.018, 0.08), toon(shade(o.bottomColor, -0.15)), side * 0.08, py + 0.04, 0));
      }
      if (o.bottom === 'slacks') {
        // รอยจีบหน้าขากางเกง
        pivot.add(mesh(new THREE.BoxGeometry(0.006, len * 0.95, 0.004), toon(shade(o.bottomColor, 0.15)), 0, -len / 2, 0.072));
      }
    }
    // รองเท้าผ้าใบ
    const shoe = mesh(new THREE.SphereGeometry(0.066, 14, 10), shoeMat, 0, -legLen - 0.012, 0.025);
    shoe.scale.set(0.95, 0.62, 1.45);
    outline(shoe, 0.01);
    pivot.add(shoe);
    const sole = mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.022, 14), soleMat, 0, -legLen - 0.042, 0.025);
    sole.scale.set(0.95, 1, 1.45);
    pivot.add(sole);
    body.add(pivot);
    legs.push(pivot);
  }

  // ===== ท่อนล่างส่วนเอว / กระโปรง =====
  const waistY = HIP_Y + 0.05;
  if (isSkirt) {
    const bottomY = { 3: 0.07, 2: 0.15, 1: 0.22 }[o.length];
    const h = waistY - bottomY;
    if (o.bottom === 'tiered') {
      // กระโปรงระบาย 3 ชั้น + ลูกไม้สีขาว
      const mat = toon(o.bottomColor, { map: fabricTexture(), side: THREE.DoubleSide });
      const lace = toon('#ffffff');
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const th = h / tiers + 0.02;
        const yTop = waistY - (h / tiers) * i;
        const rTop = 0.175 + i * 0.045, rBot = 0.22 + i * 0.05;
        body.add(mesh(ruffleGeometry(rTop, rBot, th), mat, 0, yTop - th / 2, 0));
        const trim = mesh(new THREE.TorusGeometry(rBot * 1.02, 0.009, 6, 48), lace, 0, yTop - th + 0.006, 0);
        trim.rotation.x = Math.PI / 2;
        body.add(trim);
      }
    } else {
      // กระโปรงพลีท (เรียบ หรือ ลายสก๊อต)
      const mat = o.bottom === 'plaid'
        ? toon('#ffffff', { map: plaidTexture(o.bottomColor), side: THREE.DoubleSide })
        : toon(o.bottomColor, { map: fabricTexture(), side: THREE.DoubleSide });
      const rBot = { 3: 0.29, 2: 0.31, 1: 0.32 }[o.length];
      body.add(mesh(pleatGeometry(0.178, rBot, h), mat, 0, bottomY + h / 2, 0));
      if (o.bottom === 'pleated') {
        // เส้นขาวที่ชายกระโปรง
        const line = mesh(new THREE.TorusGeometry(rBot * 1.005, 0.006, 6, 48), toon('#ffffff'), 0, bottomY + 0.03, 0);
        line.rotation.x = Math.PI / 2;
        body.add(line);
      }
    }
    // ขอบเอวกระโปรง
    body.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 20), toon(shade(o.bottomColor, -0.1)), 0, waistY - 0.005, 0));
  } else {
    body.add(mesh(new THREE.CylinderGeometry(0.175, 0.18, 0.1, 18), pantsMat, 0, HIP_Y + 0.02, 0));
    if (['jeans', 'cargo', 'slacks'].includes(o.bottom)) {
      // เข็มขัด
      body.add(mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.025, 18), toon('#4a2e1e'), 0, HIP_Y + 0.06, 0));
      body.add(mesh(new THREE.BoxGeometry(0.04, 0.03, 0.01), toon('#e8b23a'), 0, HIP_Y + 0.06, 0.183));
    }
  }

  // ===== ลำตัว (LatheGeometry ให้ทรงกลมมน, ด้านหน้าอยู่กลาง texture) =====
  const prof = [[0.17, 0], [0.176, 0.07], [0.172, 0.15], [0.16, 0.21], [0.138, 0.26], [0.1, 0.29], [0.055, 0.3]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 32, Math.PI, Math.PI * 2), topMat, 0, HIP_Y - 0.01, 0);
  if (o.top === 'hoodie') torso.scale.set(1.08, 1, 1.08);
  outline(torso, 0.01);
  body.add(torso);

  // ===== คอเสื้อแต่ละแบบ =====
  const neckY = SHOULDER_Y - 0.01;
  if (o.top === 'polo' || o.top === 'student') {
    const collarMat = o.top === 'polo' ? toon(way.base) : toon('#ffffff');
    for (const s of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.09, 0.012, 0.075), collarMat, s * 0.05, neckY - 0.005, 0.07);
      flap.rotation.set(0.55, s * -0.35, s * -0.25);
      outline(flap, 0.006);
      body.add(flap);
    }
  } else if (o.top === 'hoodie') {
    const hood = mesh(new THREE.SphereGeometry(0.13, 16, 12), toon(way.base), 0, neckY - 0.01, -0.12);
    hood.scale.set(1.35, 0.75, 0.85);
    outline(hood, 0.01);
    body.add(hood);
    for (const s of [-1, 1]) body.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), toon('#ffffff'), s * 0.035, neckY - 0.08, 0.145));
  } else {
    const ring = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 20), trimMat, 0, neckY + 0.005, 0);
    ring.rotation.x = Math.PI / 2;
    body.add(ring);
  }

  // ===== แขน =====
  const arms = [];
  const sleeveLen = o.top === 'hoodie' ? 0.25 : 0.11;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.165, SHOULDER_Y - 0.04, 0);
    pivot.rotation.z = side * 0.22;
    pivot.add(mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.24, 8), skinMat, 0, -0.12, 0));
    const sleeve = mesh(new THREE.CylinderGeometry(0.058, o.top === 'hoodie' ? 0.05 : 0.06, sleeveLen, 12), sleeveMat, 0, -sleeveLen / 2 + 0.015, 0);
    outline(sleeve, 0.008);
    pivot.add(sleeve);
    const hand = mesh(new THREE.SphereGeometry(0.048, 12, 10), skinMat, 0, -0.26, 0);
    outline(hand, 0.008);
    pivot.add(hand);
    body.add(pivot);
    arms.push(pivot);
  }

  // ===== หัว =====
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  body.add(head);
  head.add(outline(mesh(new THREE.SphereGeometry(HEAD_R, 32, 24), skinMat), 0.012));
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat, s * 0.285, -0.03, 0));

  // หน้า: แปะ texture บนแผ่นโค้งด้านหน้าหัว
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(o.face), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  head.add(new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R + 0.002, 28, 20, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.62, 1.2),
    faceMat,
  ));

  // ----- ผม -----
  const cap = mesh(new THREE.SphereGeometry(HEAD_R + 0.028, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  cap.rotation.x = -0.72; // เอียงไปด้านหลัง ให้เห็นหน้าผากและตาชัด
  outline(cap, 0.01);
  head.add(cap);

  // ปอยผม (ปลายแหลมแบบการ์ตูน)
  const lock = (angle, y, len, width, tilt, radius = HEAD_R + 0.012) => {
    const g = new THREE.Group();
    g.rotation.y = angle;
    const m = mesh(new THREE.ConeGeometry(width, len, 6), hairMat, 0, y, radius);
    m.scale.set(1, 1, 0.42);
    m.rotation.x = Math.PI - tilt;
    g.add(m);
    head.add(g);
    return m;
  };
  const bangs = o.hair === 'short' ? 5 : 7;
  for (let i = 0; i < bangs; i++) {
    const a = -0.9 + (i / (bangs - 1)) * 1.8;
    if (o.acc === 'cap') lock(a, 0.13 - Math.abs(a) * 0.03, i % 2 ? 0.09 : 0.11, 0.06, 0.3); // ใส่หมวก: หน้าม้าสั้นใต้ปีกหมวก
    else lock(a, 0.19 - Math.abs(a) * 0.04, i % 2 ? 0.12 : 0.155, 0.07, 0.3);
  }
  // ปอยผมข้างแก้ม
  if (['long', 'bob', 'twintail'].includes(o.hair)) {
    for (const s of [-1, 1]) lock(s * 1.32, -0.02, o.hair === 'bob' ? 0.3 : 0.4, 0.065, 0.05);
  }

  if (o.hair === 'long' || o.hair === 'bob') {
    const isLong = o.hair === 'long';
    const h = isLong ? 0.52 : 0.27;
    const rBot = HEAD_R + (isLong ? 0.07 : 0.085);
    const back = mesh(new THREE.CylinderGeometry(HEAD_R + 0.032, rBot, h, 32, 1, true, Math.PI / 2 + 0.05, Math.PI - 0.1),
      toon('#ffffff', { map: hairTexture(o.hairColor), side: THREE.DoubleSide }), 0, 0.08 - h / 2, -0.01);
    head.add(back);
    // ปลายผมเป็นปอยแหลม
    const n = isLong ? 10 : 12;
    for (let i = 0; i < n; i++) {
      const th = Math.PI / 2 + 0.1 + (i / (n - 1)) * (Math.PI - 0.2);
      const tip = mesh(new THREE.ConeGeometry(0.058, 0.12, 5), hairMat, Math.sin(th) * (rBot - 0.01), 0.08 - h - 0.05, Math.cos(th) * (rBot - 0.01) - 0.01);
      tip.rotation.x = Math.PI;
      head.add(tip);
    }
  } else if (o.hair === 'twintail') {
    const tie = toon('#ff6b8a');
    for (const s of [-1, 1]) {
      const base = new THREE.Vector3(s * 0.27, 0.12, -0.08);
      const t = mesh(new THREE.TorusGeometry(0.04, 0.017, 8, 16), tie, base.x, base.y, base.z);
      t.rotation.y = Math.PI / 2;
      head.add(t);
      [0.095, 0.09, 0.08, 0.066, 0.05].forEach((r, k) => {
        const ball = mesh(new THREE.SphereGeometry(r, 14, 10), hairMat, base.x + s * (0.06 + k * 0.035), base.y - 0.06 - k * 0.085, base.z - 0.02);
        ball.scale.set(0.85, 1.1, 0.85);
        if (k === 0) outline(ball, 0.008);
        head.add(ball);
      });
      const end = mesh(new THREE.ConeGeometry(0.045, 0.1, 6), hairMat, base.x + s * 0.24, base.y - 0.5, base.z - 0.02);
      end.rotation.x = Math.PI;
      head.add(end);
    }
  } else if (o.hair === 'short' && o.acc !== 'cap') {
    // ผมชี้ฟูด้านบนและด้านหลัง
    for (const [a, el] of [[0.3, 0.3], [-0.4, 0.35], [2.6, 0.5], [3.3, 0.45], [1.6, 0.6], [-1.6, 0.6], [3.0, 0.9]]) {
      const g = new THREE.Group();
      g.rotation.set(0, a, 0);
      const tuft = mesh(new THREE.ConeGeometry(0.075, 0.16, 6), hairMat, 0, Math.cos(el) * (HEAD_R + 0.02), Math.sin(el) * (HEAD_R + 0.02));
      tuft.rotation.x = el;
      tuft.scale.set(1, 1, 0.6);
      g.add(tuft);
      head.add(g);
    }
  } else if (o.hair === 'bun' && o.acc !== 'cap') {
    const bun = mesh(new THREE.SphereGeometry(0.13, 18, 14), hairMat, 0, 0.27, -0.16);
    outline(bun, 0.01);
    head.add(bun);
    const sc = mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), toon(way.accent), 0, 0.2, -0.13);
    sc.rotation.x = 1.0;
    head.add(sc);
  }

  // ----- เครื่องประดับ -----
  if (o.acc === 'bow') {
    const bowMat = toon('#ff5c7a');
    const bow = new THREE.Group();
    bow.position.set(0.17, 0.25, 0.1);
    bow.rotation.set(0.2, 0.5, -0.4);
    for (const s of [-1, 1]) {
      const loop = mesh(new THREE.SphereGeometry(0.06, 12, 10), bowMat, s * 0.065, 0, 0);
      loop.scale.set(1.3, 0.85, 0.5);
      outline(loop, 0.006);
      bow.add(loop);
    }
    bow.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), toon('#ff8fa3')));
    head.add(bow);
  } else if (o.acc === 'flower') {
    const fl = new THREE.Group();
    fl.position.set(0.24, 0.16, 0.1);
    fl.rotation.y = 0.9;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = mesh(new THREE.SphereGeometry(0.035, 10, 8), toon('#ffffff'), Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0);
      petal.scale.set(1.2, 1.2, 0.5);
      fl.add(petal);
    }
    fl.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), toon('#f2c14e')));
    head.add(fl);
  } else if (o.acc === 'cap') {
    const crown = mesh(new THREE.SphereGeometry(HEAD_R + 0.06, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(way.base), 0, 0.03, 0);
    crown.rotation.x = -0.2;
    outline(crown, 0.01);
    head.add(crown);
    const brim = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 24, 1, false, -Math.PI / 2, Math.PI), toon(way.accent), 0, 0.11, 0.22);
    brim.rotation.x = 0.15;
    head.add(brim);
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({
      map: labelTexture('TU', { bg: way.base, fg: way.text, border: way.accent, font: 'italic 900 80px "Arial Black", sans-serif', w: 256, h: 128 }),
      transparent: true,
    }));
    badge.position.set(0, 0.2, 0.31);
    badge.rotation.x = -0.45;
    head.add(badge);
  }

  // เงากลมใต้เท้า
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  // รวมชิ้นส่วนที่ขยับไปด้วยกันเป็น mesh เดียวต่อส่วน (ลด draw call ราว 5 เท่า)
  for (const n of [body, head, ...legs, ...arms]) n.userData.dynamic = true;
  for (const n of [head, ...legs, ...arms, body]) bakeStatic(n);
  bakeStatic(root);
  root.userData.dynamic = true;

  // ----- แอนิเมชัน: เดิน + หายใจ + กะพริบตา -----
  let phase = Math.random() * 10;
  let walkAmt = 0;
  let blinkIn = 2 + Math.random() * 3, blinkLeft = 0;
  const canBlink = o.face !== 'happy';
  const openMap = faceTexture(o.face), blinkMap = faceTexture(o.face, true);
  function update(dt, moving, speed = 1) {
    walkAmt += ((moving ? 1 : 0) - walkAmt) * Math.min(1, dt * 10);
    phase += dt * (moving ? 9 * speed : 2);
    const s = Math.sin(phase);
    legs[0].rotation.x = s * 0.6 * walkAmt;
    legs[1].rotation.x = -s * 0.6 * walkAmt;
    arms[0].rotation.x = -s * 0.55 * walkAmt;
    arms[1].rotation.x = s * 0.55 * walkAmt;
    body.position.y = Math.abs(s) * 0.045 * walkAmt + Math.sin(phase * 0.5) * 0.006 * (1 - walkAmt);
    head.rotation.z = Math.sin(phase * 0.5) * 0.05;
    head.rotation.x = Math.sin(phase) * 0.03 * walkAmt;
    if (canBlink) {
      blinkIn -= dt;
      if (blinkIn <= 0) { blinkLeft = 0.13; blinkIn = 2.5 + Math.random() * 3.5; }
      if (blinkLeft > 0) blinkLeft -= dt;
      const want = blinkLeft > 0 ? blinkMap : openMap;
      if (faceMat.map !== want) faceMat.map = want;
    }
  }

  function dispose() {
    root.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material && !n.material.userData.shared) n.material.dispose(); // texture ถูกแคชไว้ จึงไม่ dispose
    });
  }

  return { group: root, update, dispose, outfit: o };
}

// แสงฟุ้งเล็กๆ (เผื่อใช้ตกแต่ง)
export function sparkle(color = '#ffe9a8', size = 0.5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}
