// ===== perf.js: ทำให้เกมลื่นบนมือถือ =====
// 1) bakeStatic: รวม mesh ที่ไม่ขยับและใช้วัสดุแบบเดียวกันเป็น mesh เดียว (ลด draw call จาก ~900 เหลือไม่ถึง 200)
// 2) AutoQuality: วัด FPS ระหว่างเล่น ถ้ากระตุกจะลดความละเอียดจอลงเอง ถ้าลื่นจะค่อยๆ เพิ่มกลับ
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ลายเซ็นของวัสดุ: วัสดุที่ค่าเหมือนกันรวมกันได้ (เก็บวัสดุตัวแรกไว้ใช้จริง)
function matKey(m) {
  return [
    m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.map?.uuid, m.gradientMap?.uuid,
    m.side, m.transparent, m.opacity, m.depthWrite, m.depthTest, m.blending, m.vertexColors, m.fog,
    m.polygonOffset, m.polygonOffsetFactor, m.alphaTest, m.flatShading, m.wireframe,
  ].join('|');
}

// วัสดุสีล้วน (ไม่มีลาย ไม่โปร่งใส) แปลงสีเป็น "สีประจำจุด" แล้วใช้วัสดุร่วมกันได้หมด -> เหลือ draw call เดียว
const sharedColorMats = new Map();
function colorizable(m) {
  if (m.map || m.transparent || m.alphaTest || m.polygonOffset || m.wireframe) return false;
  if (m.emissive && m.emissive.getHex() !== 0) return false;
  return m.type === 'MeshToonMaterial' || m.type === 'MeshBasicMaterial';
}
function sharedMatFor(m) {
  const key = [m.type, m.side, m.fog, m.flatShading, m.gradientMap?.uuid, m.depthWrite].join('|');
  if (!sharedColorMats.has(key)) {
    const sm = m.clone();
    sm.color.set('#ffffff');
    sm.vertexColors = true;
    sm.userData.shared = true;
    sharedColorMats.set(key, sm);
  }
  return { key: 'vc|' + key, mat: sharedColorMats.get(key) };
}

const tmpInv = new THREE.Matrix4();
const tmpRel = new THREE.Matrix4();

// รวม mesh ใต้ root (หยุดที่โหนดที่ติด userData.dynamic) ให้อยู่ในพิกัดของ root
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  tmpInv.copy(root.matrixWorld).invert();
  const groups = new Map(); // key -> {mat, geos: []}
  const victims = [];
  const visit = (node) => {
    for (const c of node.children) {
      if (c.userData.dynamic) continue;
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.visible && c.geometry && !Array.isArray(c.material)) {
        victims.push(c);
      }
      visit(c);
    }
  };
  visit(root);
  if (victims.length < 2) return 0;

  for (const m of victims) {
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    // ใช้เฉพาะแอตทริบิวต์ที่จำเป็น ให้ทุกชิ้นรวมกันได้
    const colorize = colorizable(m.material);
    const keepColor = !!m.material.vertexColors || colorize;
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', ...(keepColor ? ['color'] : [])].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (keepColor && !g.attributes.color) {
      const col = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    if (g.attributes.color && g.attributes.color.itemSize !== 3) {
      // สีแบบ RGBA -> RGB
      const a = g.attributes.color, col = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { col[i * 3] = a.getX(i); col[i * 3 + 1] = a.getY(i); col[i * 3 + 2] = a.getZ(i); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    if (colorize) {
      // คูณสีของวัสดุเข้าไปในสีประจำจุด
      const c = m.material.color, a = g.attributes.color;
      for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b);
    }
    g.morphAttributes = {};
    g.clearGroups();
    tmpRel.multiplyMatrices(tmpInv, m.matrixWorld);
    g.applyMatrix4(tmpRel);
    // สเกลติดลบ (กลับด้าน) ต้องสลับลำดับจุดของสามเหลี่ยม
    if (tmpRel.determinant() < 0) {
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name], s = a.itemSize, arr = a.array;
        for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) {
          const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t;
        }
      }
    }
    let key = matKey(m.material) + (keepColor ? '|c' : ''), useMat = m.material;
    if (colorize) ({ key, mat: useMat } = sharedMatFor(m.material));
    if (!groups.has(key)) groups.set(key, { mat: useMat, geos: [] });
    groups.get(key).geos.push(g);
  }

  for (const m of victims) {
    // ย้ายลูกที่เป็นของ dynamic (ถ้ามี) ขึ้นไปไว้ที่พ่อก่อนลบ mesh นี้ทิ้ง
    for (const c of [...m.children]) if (!(c.isMesh && victims.includes(c))) m.parent.attach(c);
    m.parent.remove(m);
    if (m.geometry) m.geometry.dispose();
  }
  let count = 0;
  for (const { mat, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.userData.baked = true;
    root.add(mesh);
    count++;
  }
  return count;
}

// ----- ปรับคุณภาพอัตโนมัติตาม FPS -----
export class AutoQuality {
  constructor(renderer, { mobile }) {
    this.r = renderer;
    this.mobile = mobile;
    const dpr = window.devicePixelRatio || 1;
    // มือถือ: เริ่มที่ 1.5 เท่า (จอมือถือส่วนใหญ่ 3 เท่า แต่ตาแทบแยกไม่ออก และหนักกว่าเกือบ 4 เท่า)
    this.max = Math.min(dpr, mobile ? 1.5 : 2);
    this.min = Math.min(0.75, this.max);
    this.ratio = this.max;
    this.frames = 0; this.time = 0; this.cool = 2.5; // รอให้ฉากโหลดนิ่งก่อนเริ่มวัด
    this.low = false; // โหมดประหยัด (เครื่องสเปคต่ำมาก)
    this.onLow = null;
    renderer.setPixelRatio(this.ratio);
  }
  update(dt) {
    if (document.hidden) return;
    this.cool -= dt;
    this.frames++; this.time += dt;
    if (this.time < 2) return;
    const fps = this.frames / this.time;
    this.frames = 0; this.time = 0;
    this.fps = fps;
    if (this.cool > 0) return;
    if (fps < 45 && this.ratio > this.min) {
      this.set(Math.max(this.min, this.ratio - 0.25));
    } else if (fps < 28 && this.ratio <= this.min && !this.low) {
      this.low = true;
      this.onLow?.();
      this.cool = 3;
    } else if (fps > 58 && this.ratio < this.max) {
      this.set(Math.min(this.max, this.ratio + 0.25));
      this.cool = 6; // เพิ่มทีละน้อย กันไม่ให้แกว่งไปมา
    }
  }
  set(v) {
    this.ratio = v;
    this.r.setPixelRatio(v);
    const c = this.r.domElement;
    this.r.setSize(c.clientWidth || window.innerWidth, c.clientHeight || window.innerHeight, false);
    this.cool = Math.max(this.cool, 1.5);
  }
}

// รวมแสงฟุ้ง (Sprite) ที่ไม่ขยับเป็น Points ก้อนเดียวต่อสี/ขนาด (Sprite แต่ละอันกิน draw call 1 ครั้ง)
export function bakeSprites(root, camera) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const k = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); // แปลงขนาด Sprite -> ขนาด Point
  const groups = new Map();
  const victims = [];
  const visit = (node) => {
    for (const c of node.children) {
      if (c.userData.dynamic) continue;
      // เฉพาะแสงฟุ้งทรงกลม (สเกลกว้าง=สูง และแบบเรืองแสง) ป้ายข้อความต้องคงเป็น Sprite ไม่งั้นจะถูกบีบเป็นสี่เหลี่ยมจัตุรัส
      if (c.isSprite && c.material.map && c.visible && c.material.blending === THREE.AdditiveBlending &&
          Math.abs(c.scale.x - c.scale.y) < 1e-3) victims.push(c);
      visit(c);
    }
  };
  visit(root);
  const v = new THREE.Vector3();
  for (const s of victims) {
    const m = s.material;
    const ws = new THREE.Vector3(); s.getWorldScale(ws);
    const size = Math.round(ws.x * 10) / 10;
    const key = [m.map.uuid, m.color.getHexString(), m.opacity, m.blending, size].join('|');
    if (!groups.has(key)) groups.set(key, { m, size, pts: [] });
    v.setFromMatrixPosition(s.matrixWorld).applyMatrix4(inv);
    groups.get(key).pts.push(v.x, v.y, v.z);
    s.parent.remove(s);
  }
  for (const { m, size, pts } of groups.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const pm = new THREE.PointsMaterial({
      map: m.map, color: m.color, size: size * k, sizeAttenuation: true, transparent: true, opacity: m.opacity,
      depthWrite: false, blending: m.blending, fog: m.fog,
    });
    const p = new THREE.Points(g, pm);
    p.frustumCulled = false;
    root.add(p);
  }
  return victims.length;
}
