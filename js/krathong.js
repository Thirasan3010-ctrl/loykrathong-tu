// ===== krathong.js: กระทง 4 แบบที่หน้าตาต่างกันชัดเจน (Procedural ทั้งหมด) =====
// รูปแบบข้อมูล: { base: 'banana_leaf' | 'banana_trunk' | 'bread' | 'lotus', decor: ['flower','candle','incense','flag'], wish: '...' }
import * as THREE from 'three';
import { bakeStatic } from './perf.js';
import {
  toon, bananaLeafTexture, bananaTrunkTexture, breadTexture, glowTexture,
  trunkTopTexture, leafFoldTexture, breadShellTexture, lilyPadTexture,
} from './textures.js';

export const BASES = ['banana_leaf', 'banana_trunk', 'bread', 'lotus'];
export const DECORS = ['flower', 'candle', 'incense', 'flag'];

// ข้อความอธิษฐานของกระทงบอท (สุ่ม)
export const BOT_WISHES = [
  'ขอให้เกรด A ทุกวิชา', 'ขอให้เจอคนรู้ใจ', 'ขอให้สุขภาพแข็งแรง', 'ขอให้ที่บ้านมีความสุข',
  'ขอให้สอบผ่านฉลุย', 'ขอให้หาเงินได้เยอะๆ', 'ขอให้จบทันเพื่อน', 'ขอให้หายเหนื่อย',
  'ขอให้แมวที่บ้านอ้วนท้วน', 'ขอให้โปรเจกต์ไม่บั๊ก', 'ขอให้เขาทักมาก่อน', 'ขอให้ได้งานที่ชอบ',
  'ขอให้ปีหน้าดีกว่าปีนี้', 'ขอให้คนที่รักปลอดภัย', 'ขอขมาพระแม่คงคา', 'ขอให้ฝันเป็นจริง',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function randomKrathong() {
  const decor = DECORS.filter(() => Math.random() < 0.6);
  if (!decor.includes('candle')) decor.push('candle'); // บอทมีเทียนเสมอให้ฉากสว่างสวย
  return { base: pick(BASES), decor, wish: pick(BOT_WISHES) };
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// วางชิ้นส่วนเป็นวงรอบแกนกลาง (ใช้ทำกลีบ)
function ring(group, count, radius, y, make, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    const part = make(i);
    part.position.add(new THREE.Vector3(0, y, radius));
    pivot.add(part);
    group.add(pivot);
  }
}

// ดาวเรือง (ดอกกลมฟู)
function marigold(r = 0.045) {
  const m = mesh(new THREE.IcosahedronGeometry(r, 1), toon('#ffa31a'));
  m.scale.y = 0.75;
  return m;
}

// ดอกกุหลาบเล็ก: กลีบซ้อน 3 ชั้น
function rose(color) {
  const g = new THREE.Group();
  const mat = toon(color);
  [[0.05, 0.02], [0.037, 0.035], [0.024, 0.048]].forEach(([r, y]) => {
    const s = mesh(new THREE.SphereGeometry(r, 10, 8), mat, 0, y, 0);
    s.scale.y = 0.65;
    g.add(s);
  });
  return g;
}

// กลีบบัวปลายแหลม ไล่สีขาว -> ชมพู ด้วย vertex color
function lotusPetalGeometry(w, h, cup) {
  const geo = new THREE.SphereGeometry(1, 14, 12);
  const p = geo.attributes.position;
  const colors = [];
  const c0 = new THREE.Color('#fff4f6'), c1 = new THREE.Color('#ff5f8f'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const taper = y > 0 ? Math.pow(1 - y, 0.7) : 1 - y * y * 0.3;
    x *= taper; z *= taper;
    z += (y + 1) * (y + 1) * cup; // งอปลายกลีบออก
    p.setXYZ(i, x * w, y * h, z * w * 0.45);
    c.copy(c0).lerp(c1, Math.max(0, (y + 0.2) / 1.2));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// ----- 1) กระทงใบตอง: ฐานหยวก + กลีบพับซ้อน 3 ชั้น + พุ่มดอกไม้ -----
function buildLeaf(g) {
  const side = toon('#ffffff', { map: bananaLeafTexture() });
  const top = toon('#ffffff', { map: trunkTopTexture() });
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.12, 36), [side, top, top], 0, 0.06, 0));
  const dark = toon('#ffffff', { map: leafFoldTexture(false), side: THREE.DoubleSide });
  const light = toon('#ffffff', { map: leafFoldTexture(true), side: THREE.DoubleSide });
  const petal = (mat, w, h, tilt) => () => {
    const m = mesh(new THREE.ConeGeometry(w, h, 3), mat);
    m.scale.z = 0.45;
    m.rotation.x = tilt; // เอียงออกด้านนอก
    return m;
  };
  ring(g, 18, 0.31, 0.2, petal(dark, 0.07, 0.24, 0.55));
  ring(g, 14, 0.24, 0.24, petal(light, 0.062, 0.26, 0.32), 0.12);
  ring(g, 10, 0.16, 0.27, petal(dark, 0.055, 0.26, 0.12), 0.3);
  return 0.24;
}

// ----- 2) กระทงหยวกกล้วย: แว่นหยวกหนา โชว์วงหน้าตัด + มาลัยกุหลาบรอบขอบ -----
function buildTrunk(g) {
  const side = toon('#ffffff', { map: bananaTrunkTexture() });
  const top = toon('#ffffff', { map: trunkTopTexture() });
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.35, 0.17, 40), [side, top, top], 0, 0.085, 0));
  // แถบใบตองพันรอบข้าง
  const band = mesh(new THREE.TorusGeometry(0.36, 0.022, 8, 48), toon('#ffffff', { map: leafFoldTexture(false) }), 0, 0.09, 0);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  // ใบตองพับจีบเป็นฟันเลื่อยรอบขอบบน
  const leaf = toon('#ffffff', { map: leafFoldTexture(true), side: THREE.DoubleSide });
  ring(g, 24, 0.335, 0.2, () => {
    const m = mesh(new THREE.ConeGeometry(0.04, 0.1, 3), leaf);
    m.scale.z = 0.4;
    m.rotation.x = 0.25;
    return m;
  });
  // มาลัยกุหลาบสลับสี + มะลิ
  const colors = ['#e63950', '#ffffff', '#ff9ab3'];
  ring(g, 12, 0.25, 0.17, (i) => rose(colors[i % 3]));
  ring(g, 18, 0.165, 0.18, () => mesh(new THREE.SphereGeometry(0.018, 8, 6), toon('#fffdf2')), 0.1);
  return 0.18;
}

// ----- 3) กระทงขนมปังรูปเต่า: กระดองอบ + หัว ขา หาง ตาลูกเกด -----
function buildBread(g) {
  const shellMat = toon('#ffffff', { map: breadShellTexture() });
  const crumb = toon('#ffffff', { map: breadTexture() });
  g.add(mesh(new THREE.CylinderGeometry(0.31, 0.29, 0.06, 36), crumb, 0, 0.03, 0));
  const shell = mesh(new THREE.SphereGeometry(0.31, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), shellMat, 0, 0.05, 0);
  shell.scale.y = 0.6;
  g.add(shell);
  const skin = toon('#e2a85e');
  // หัว
  const head = mesh(new THREE.SphereGeometry(0.1, 16, 12), skin, 0, 0.1, 0.33);
  head.scale.set(1, 0.85, 1.1);
  g.add(head);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), toon('#3a1e12'), s * 0.045, 0.13, 0.42));
    g.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), toon('#ff9aa8'), s * 0.065, 0.095, 0.415));
  }
  // ขา 4 ข้าง
  for (const [x, z] of [[0.24, 0.17], [-0.24, 0.17], [0.22, -0.2], [-0.22, -0.2]]) {
    const leg = mesh(new THREE.SphereGeometry(0.075, 12, 8), skin, x, 0.04, z);
    leg.scale.set(1.2, 0.45, 0.8);
    leg.rotation.y = Math.atan2(x, z);
    g.add(leg);
  }
  // หาง
  const tail = mesh(new THREE.ConeGeometry(0.04, 0.1, 8), skin, 0, 0.05, -0.33);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  g.add(tail);
  return 0.24;
}

// ----- 4) กระทงดอกบัว: บัวบานกลีบซ้อน 3 ชั้นบนใบบัว -----
function buildLotus(g) {
  const pad = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.025, 48, 1, false, 0.25, Math.PI * 2 - 0.5),
    toon('#ffffff', { map: lilyPadTexture() }), 0, 0.012, 0);
  g.add(pad);
  const mat = toon('#ffffff', { vertexColors: true });
  const layers = [[12, 0.2, 0.08, 1.15, 0.11, 0.2, 0.12], [10, 0.13, 0.13, 0.75, 0.1, 0.22, 0.08], [8, 0.06, 0.17, 0.35, 0.085, 0.2, 0.04]];
  for (const [n, r, y, tilt, w, h, cup] of layers) {
    const geo = lotusPetalGeometry(w, h, cup);
    ring(g, n, r, y, () => {
      const m = mesh(geo, mat);
      m.rotation.x = tilt;
      return m;
    }, n * 0.05);
  }
  // ฝักบัวตรงกลาง
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.06, 16), toon('#d8e07a'), 0, 0.2, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.01, 6, 5), toon('#8a9a3a'), Math.cos(a) * 0.033, 0.232, Math.sin(a) * 0.033));
  }
  return 0.23;
}

const BUILDERS = { banana_leaf: buildLeaf, banana_trunk: buildTrunk, bread: buildBread, lotus: buildLotus };

// สร้างโมเดลกระทง
// opts.light = true จะใส่ PointLight จริง (ใช้กับกระทงของผู้เล่นเท่านั้น เพื่อประหยัด GPU มือถือ)
export function createKrathong(data, opts = {}) {
  const d = { base: 'banana_leaf', decor: [], ...data };
  if (!BUILDERS[d.base]) d.base = 'banana_leaf';
  const group = new THREE.Group();
  const flames = [];
  const topY = BUILDERS[d.base](group);

  // ----- ของตกแต่ง (วางบนยอดของกระทงแต่ละแบบ) -----
  if (d.decor.includes('flower')) {
    if (d.base === 'lotus') {
      // ดอกไม้ลอยรอบใบบัว
      ring(group, 5, 0.36, 0.04, () => rose('#ffffff'), 0.4);
    } else {
      // ดอกบัวตูมตรงกลาง + ดาวเรือง + กล้วยไม้
      const bud = mesh(lotusPetalGeometry(0.06, 0.12, 0), toon('#ffffff', { vertexColors: true }), 0, topY + 0.09, 0);
      group.add(bud);
      ring(group, 6, 0.1, topY + 0.02, () => marigold(), 0);
      ring(group, 6, 0.1, topY + 0.04, () => {
        const o = mesh(new THREE.SphereGeometry(0.028, 8, 6), toon('#a64ac9'));
        o.scale.set(1.3, 0.5, 1);
        return o;
      }, Math.PI / 6);
    }
  }

  if (d.decor.includes('candle')) {
    const cx = d.base === 'lotus' ? 0 : 0.06, cz = d.base === 'lotus' ? 0 : -0.06;
    const cy = d.base === 'lotus' ? topY : topY - 0.02;
    group.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.15, 10), toon('#fff6dc'), cx, cy + 0.075, cz));
    const flame = mesh(new THREE.ConeGeometry(0.018, 0.05, 8), new THREE.MeshBasicMaterial({ color: '#ffcf5a' }), cx, cy + 0.175, cz);
    flame.userData.dynamic = true;
    group.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(0.45);
    glow.position.copy(flame.position);
    group.add(glow);
    const f = { flame, glow };
    if (opts.light) {
      f.light = new THREE.PointLight('#ffae55', 2.2, 5, 1.6);
      f.light.position.set(cx, cy + 0.27, cz);
      group.add(f.light);
    }
    flames.push(f);
  }

  if (d.decor.includes('incense')) {
    const stick = toon('#8a4b2a');
    const tip = new THREE.MeshBasicMaterial({ color: '#ff5533' });
    for (let i = 0; i < 3; i++) {
      const x = -0.08 + i * 0.022, y = topY - 0.02;
      const s = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 5), stick, x, y + 0.11, 0.06);
      s.rotation.z = (i - 1) * 0.12;
      group.add(s);
      group.add(mesh(new THREE.SphereGeometry(0.009, 5, 5), tip, x - (i - 1) * 0.013, y + 0.22, 0.06));
    }
  }

  if (d.decor.includes('flag')) {
    const y = topY - 0.02;
    group.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 5), toon('#d9c08a'), -0.05, y + 0.16, -0.1));
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(0.12, -0.035); shape.lineTo(0, -0.07);
    group.add(mesh(new THREE.ShapeGeometry(shape), toon(pick(['#ff4d6d', '#ffd166', '#4dabf7', '#b197fc']), { side: THREE.DoubleSide }), -0.05, y + 0.31, -0.1));
  }

  // รวมชิ้นส่วนกระทงที่ไม่ขยับเป็น mesh เดียวต่อวัสดุ
  bakeStatic(group);
  group.userData.dynamic = true;

  // ทำให้เปลวไฟกะพริบเบาๆ
  function update(t) {
    for (const f of flames) {
      const k = 1 + Math.sin(t * 13 + group.id) * 0.08 + Math.sin(t * 7.3) * 0.05;
      f.flame.scale.set(1, k, 1);
      f.glow.scale.setScalar(0.45 * k);
      if (f.light) f.light.intensity = 2.2 * k;
    }
  }

  function dispose() {
    group.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) [].concat(n.material).forEach((m) => m.dispose());
    });
  }

  return { group, update, dispose, data: d };
}
