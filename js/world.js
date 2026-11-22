// ===== world.js: ฉากงานลอยกระทงรอบสระหน้าอาคารทรงโดม (ออกแบบใหม่สไตล์การ์ตูน) =====
// สเกล 1 unit = 1 เมตร | สระ 40 x 25 เมตร | ทางเดินรอบสระกว้างราว 5.5 เมตร
import * as THREE from 'three';
import {
  toon, stripeTexture, labelTexture, glowTexture, skyTexture, pavingTexture,
} from './textures.js';
import { SHOPS, buildShop } from './shops.js';

export const POND = { w: 40, d: 25, waterY: -0.35 };
export const CURB = 0.4;                    // ขอบหินรอบสระ
export const WALK = { w: 52, d: 37 };       // ขอบนอกทางเดิน
export const BOUNDS = { x: 33, zMin: -22, zMax: 27 }; // ขอบเขตที่ผู้เล่นเดินได้
// ทางเข้างาน: ถนนตรงจากซุ้มประตูเข้าสู่สระ มีร้านอาหารสองข้างทาง
export const ENTRY = { halfW: 10.6, zStart: WALK.d / 2, zEnd: 46, spawnZ: 43 };

// สะพานปล่อยกระทง 2 จุด (ยื่นลงสระจากฝั่งใต้ ยาว 4 ม. กว้าง 3 ม.)
export const BRIDGES = [
  { x: -9, zStart: POND.d / 2 + CURB, length: 4, width: 3 },
  { x: 9, zStart: POND.d / 2 + CURB, length: 4, width: 3 },
];

// สี่เหลี่ยมมุมมน (ใช้ทำขอบสระ)
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rectPath(w, h, r) {
  const shape = roundedRect(w, h, r);
  return new THREE.Path(shape.getPoints(8).reverse());
}

export function buildWorld(scene) {
  const updaters = [];   // ฟังก์ชันที่ต้องอัปเดตทุกเฟรม
  const colliders = [];  // วงกลมกันชน {x, z, r}

  // ===== ท้องฟ้า แสง หมอก =====
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#16245a', 35, 95);
  scene.add(new THREE.HemisphereLight('#8fa6ff', '#2a2a3a', 1.1));
  const moonLight = new THREE.DirectionalLight('#dfe8ff', 1.4);
  moonLight.position.set(-20, 40, -30);
  scene.add(moonLight);
  scene.add(new THREE.AmbientLight('#ffd9a0', 0.35)); // แสงอุ่นจากไฟงาน

  // ดวงดาว
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 700; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.42;
    const r = 180;
    starPos.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r * 0.9 + 10, Math.sin(th) * Math.sin(ph) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, sizeAttenuation: true, fog: false })));

  // พระจันทร์เต็มดวง (วันเพ็ญเดือน 12)
  const moonPos = new THREE.Vector3(-35, 55, -120);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.MeshBasicMaterial({ color: '#fff4c9', fog: false }));
  moon.position.copy(moonPos);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe9a8', transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
  moonGlow.scale.setScalar(60);
  moonGlow.position.copy(moonPos);
  scene.add(moonGlow);

  // ===== พื้นดิน / ทางเดิน / ขอบสระ =====
  // พื้นหญ้าเจาะรูตรงสระ (ไม่ให้บังผิวน้ำ)
  const groundShape = new THREE.Shape();
  groundShape.moveTo(-130, -130); groundShape.lineTo(130, -130); groundShape.lineTo(130, 130); groundShape.lineTo(-130, 130);
  groundShape.holes.push(rectPath(POND.w + CURB * 2, POND.d + CURB * 2, 3));
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(groundShape, 8), toon('#2e5a35'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const walkShape = new THREE.Shape();
  walkShape.moveTo(-WALK.w / 2, -WALK.d / 2); walkShape.lineTo(WALK.w / 2, -WALK.d / 2);
  walkShape.lineTo(WALK.w / 2, WALK.d / 2); walkShape.lineTo(-WALK.w / 2, WALK.d / 2);
  walkShape.holes.push(rectPath(POND.w + CURB * 2, POND.d + CURB * 2, 3));
  const walk = new THREE.Mesh(new THREE.ShapeGeometry(walkShape, 8), toon('#ffffff', { map: pavingTexture() }));
  walk.rotation.x = -Math.PI / 2;
  // ปรับ UV ให้ลายอิฐตรงกับขนาดจริง
  const uv = walk.geometry.attributes.uv, pos = walk.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + WALK.w / 2) / WALK.w, (pos.getY(i) + WALK.d / 2) / WALK.d);
  scene.add(walk);

  // ขอบหินรอบสระ (ยกขึ้นเล็กน้อย)
  const curbShape = roundedRect(POND.w + CURB * 2, POND.d + CURB * 2, 3);
  curbShape.holes.push(rectPath(POND.w, POND.d, 2.7));
  const curb = new THREE.Mesh(new THREE.ExtrudeGeometry(curbShape, { depth: 0.9, bevelEnabled: false, curveSegments: 8 }), toon('#d8ccb4'));
  curb.rotation.x = -Math.PI / 2;
  curb.position.y = -0.8;
  scene.add(curb);

  // ก้นสระ (มืด) ให้น้ำดูลึก
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(POND.w, POND.d), new THREE.MeshBasicMaterial({ color: '#06121f' }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -0.79;
  scene.add(bed);

  // ===== ผิวน้ำ: คลื่นเบาๆ ด้วยการขยับ vertex =====
  const waterGeo = new THREE.PlaneGeometry(POND.w, POND.d, 48, 30);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({
    color: '#14485a', emissive: '#06202e', specular: '#ffe9b0', shininess: 90,
    transparent: true, opacity: 0.93, flatShading: true,
  }));
  water.position.y = POND.waterY;
  water.userData.dynamic = true;
  scene.add(water);
  const wpos = waterGeo.attributes.position;
  const base = Float32Array.from(wpos.array);
  updaters.push((dt, t) => {
    for (let i = 0; i < wpos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      wpos.array[i * 3 + 1] = Math.sin(x * 0.45 + t * 1.2) * 0.04 + Math.cos(z * 0.6 + t * 0.9) * 0.035;
    }
    wpos.needsUpdate = true;
    waterGeo.computeVertexNormals();
  });

  // แสงพระจันทร์สะท้อนบนน้ำ
  const reflect = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 16), new THREE.MeshBasicMaterial({
    map: glowTexture(), color: '#ffe9a8', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  reflect.rotation.x = -Math.PI / 2;
  reflect.position.set(-5, POND.waterY + 0.06, -3);
  reflect.userData.dynamic = true;
  scene.add(reflect);
  updaters.push((dt, t) => { reflect.material.opacity = 0.3 + Math.sin(t * 1.7) * 0.06; });

  // ===== อาคารโดมบริหาร + หอคอยโครงขาว (สไตล์การ์ตูน ไม่มีชื่อหรือตราใดๆ) =====
  updaters.push(buildDome(scene));

  // ===== สะพานปล่อยกระทง + ตัวบอกตำแหน่ง =====
  const markers = [];
  for (const b of BRIDGES) markers.push(buildBridge(scene, b));
  updaters.push((dt, t) => {
    for (const m of markers) {
      m.ring.material.opacity = 0.55 + Math.sin(t * 3) * 0.25;
      m.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      m.arrow.position.y = 1.9 + Math.sin(t * 2.5) * 0.15;
      m.arrow.rotation.y = t * 1.5;
    }
  });

  // ===== เสาไฟ + ไฟประดับสายรอบสระ =====
  const lampPositions = [];
  const lx = WALK.w / 2 - 0.6, lz = WALK.d / 2 - 0.6;
  for (let x = -lx; x <= lx + 0.1; x += lx / 3) { lampPositions.push([x, -lz], [x, lz]); }
  for (let z = -lz + lz / 2.5; z < lz - 0.1; z += lz / 2.5) { lampPositions.push([-lx, z], [lx, z]); }
  // เอาเสาไฟกลางฝั่งใต้ออก เพราะจะบังกล้องตอนเริ่มเกม
  const lamps = buildLamps(scene, lampPositions.filter(([x, z]) => !(Math.abs(x) < 1 && z > 0) && !(Math.abs(x) > 13 && Math.abs(x) < 20 && z > 0)), colliders); // เว้นเสาไฟหน้าบูธเกม
  buildStringLights(scene, lamps, updaters);

  // ===== ร้านค้าข้างสระ (พร็อพประกอบฉาก) =====
  const stalls = [
    ['น้ำแข็งไส', '#2980b9', '#ffffff', 29.5, 8, Math.PI / 2],
    ['ข้าวเหนียวมะม่วง', '#d4a017', '#ffffff', 29.5, -6, Math.PI / 2],
    ['กระทงสวย', '#2c6e49', '#ffffff', -29.5, 8, -Math.PI / 2],
    ['ข้าวโพดปิ้ง', '#b7950b', '#fff3c4', -29.5, -6, -Math.PI / 2],
  ];
  for (const s of stalls) buildStall(scene, ...s, colliders);

  // ===== ทางเข้างาน + ร้านอาหารที่ซื้อได้จริง (ซ้าย 3 ร้าน ขวา 3 ร้าน) =====
  const shops = buildEntrance(scene, colliders, updaters);

  // ===== จักรยานสีเขียว + สกูตเตอร์สีฟ้า (พร็อพเอกลักษณ์ของมหาวิทยาลัย) =====
  const rides = [
    ['bike', -25.2, 20.4, 0], ['bike', -24.2, 20.4, 0], ['bike', -23.2, 20.4, 0],
    ['scooter', 23.2, 20.4, 0.1], ['scooter', 24.2, 20.4, -0.1], ['scooter', 25.2, 20.4, 0.05],
    ['bike', -6.5, -20.3, Math.PI], ['bike', -5.5, -20.3, Math.PI],
    ['scooter', 5.5, -20.3, Math.PI], ['scooter', 6.5, -20.3, Math.PI + 0.15],
    ['bike', 27.6, 1, Math.PI / 2], ['scooter', -27.6, 1, -Math.PI / 2],
  ];
  for (const [type, x, z, rot] of rides) {
    (type === 'bike' ? buildBicycle : buildScooter)(scene, x, z, rot);
    colliders.push({ x, z, r: 0.55 });
  }

  // ===== ต้นไม้ =====
  const treeSpots = [
    [-36, 18], [-38, 0], [-36, -16], [36, 18], [38, 0], [36, -16],
    [-26, -24], [26, -24], [-21, 30], [21, 30], [-32, 27], [32, 27],
    [-14, 34], [14, 34], [-14, 42], [14, 42], [-20, 38], [20, 38],
  ];
  for (const [x, z] of treeSpots) buildTree(scene, x, z, colliders);

  // ===== ตรวจว่าตำแหน่งเดินได้หรือไม่ =====
  const halfW = POND.w / 2 + CURB, halfD = POND.d / 2 + CURB;
  function onBridge(x, z) {
    for (const b of BRIDGES) {
      if (Math.abs(x - b.x) < b.width / 2 - 0.35 && z > b.zStart - b.length + 0.35 && z < b.zStart + 0.5) return b;
    }
    return null;
  }
  function canWalk(x, z) {
    // ถนนทางเข้า
    if (z > BOUNDS.zMax) return z < ENTRY.zEnd - 0.6 && Math.abs(x) < ENTRY.halfW;
    if (Math.abs(x) > BOUNDS.x || z < BOUNDS.zMin || z > BOUNDS.zMax) return false;
    const inPond = Math.abs(x) < halfW - 0.2 && Math.abs(z) < halfD - 0.2;
    if (inPond && !onBridge(x, z)) return false;
    return true;
  }
  // ดันตัวละครออกจากสิ่งกีดขวางทรงกลม
  function resolveColliders(p, radius = 0.35) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const dist = Math.hypot(dx, dz), min = c.r + radius;
      if (dist < min && dist > 0.0001) {
        p.x = c.x + (dx / dist) * min;
        p.z = c.z + (dz / dist) * min;
      }
    }
  }
  // จุดปล่อยกระทง: ปลายสะพาน
  function releaseZone(x, z) {
    for (const b of BRIDGES) {
      if (Math.abs(x - b.x) < b.width / 2 && z > b.zStart - b.length && z < b.zStart - b.length + 2) return b;
    }
    return null;
  }

  // หน้าร้านอาหาร: ยืนใกล้หน้าร้านแล้วกดซื้อได้
  function shopZone(x, z) {
    let best = null, bd = 2.2;
    for (const sh of shops) {
      const d = Math.hypot(x - sh.front.x, z - sh.front.z);
      if (d < bd) { bd = d; best = sh; }
    }
    return best;
  }

  return {
    update(dt, t, cam) { for (const u of updaters) u(dt, t, cam); },
    canWalk, resolveColliders, releaseZone, onBridge, shopZone, colliders, updaters,
  };
}

// ----- อาคารโดมบริหาร (ปั้นใหม่จากรูปอ้างอิง: ตึกขาวหลังคากระเบื้องส้ม + หอคอยโครงขาวตรงกลาง) -----
// ไม่มีชื่อหรือตราสัญลักษณ์ใดๆ บนอาคาร

// หลังคาทรงปั้นหยา: ขอบชายคาเป็นสี่เหลี่ยม สันหลังคาอยู่ตรงกลาง
function hipRoof(L, W, H) {
  const l = L / 2, w = W / 2, r = Math.max(0.1, l - w);
  const v = [
    -l, 0, w,  l, 0, w,  r, H, 0,  -r, H, 0,   // หน้า
    l, 0, -w,  -l, 0, -w,  -r, H, 0,  r, H, 0, // หลัง
  ];
  const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 1, 4, 7, 1, 7, 2, 5, 0, 3, 5, 3, 6];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ตึก 3 ชั้น: ผนังขาว แถบหน้าต่าง ระเบียง เสาชั้นล่าง หลังคาส้ม
function buildBlock(L, W, floors, mats) {
  const g = new THREE.Group();
  const fh = 2.4, H = floors * fh;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), mats.wall);
  body.position.y = H / 2;
  g.add(body);
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    if (f === 0) {
      // ชั้นล่าง: ทางเดินมีเสาเรียง ผนังด้านในเข้มกว่า
      const recess = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.6, fh - 0.4), mats.shadow);
      recess.position.set(0, y + fh / 2 - 0.1, W / 2 + 0.01);
      g.add(recess);
      for (let x = -L / 2 + 0.4; x <= L / 2 - 0.3; x += 2.2) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, fh, 0.35), mats.wall);
        col.position.set(x, y + fh / 2, W / 2 + 0.2);
        g.add(col);
      }
    } else {
      // แถบหน้าต่างเรืองแสง + ขอบระเบียงสีขาว
      const win = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.8, 1.0), mats.window);
      win.position.set(0, y + 1.25, W / 2 + 0.01);
      g.add(win);
      for (let x = -L / 2 + 1.2; x < L / 2 - 0.6; x += 1.6) {
        const mull = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.0), mats.wall);
        mull.position.set(x, y + 1.25, W / 2 + 0.02);
        g.add(mull);
      }
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.25, 0.5), mats.trim);
    sill.position.set(0, y + fh - 0.05, W / 2 + 0.1);
    g.add(sill);
  }
  // ชายคา + หลังคาปั้นหยาสีส้มอิฐ
  const eave = new THREE.Mesh(new THREE.BoxGeometry(L + 1.4, 0.25, W + 1.4), mats.trim);
  eave.position.y = H + 0.1;
  g.add(eave);
  const roof = new THREE.Mesh(hipRoof(L + 1.6, W + 1.6, 2.6), mats.roof);
  roof.position.y = H + 0.22;
  g.add(roof);
  return { g, H };
}

function buildDome(scene) {
  const root = new THREE.Group();
  root.position.set(0, 0, -33);
  const mats = {
    wall: toon('#f4f1ea'),
    trim: toon('#ffffff'),
    shadow: toon('#9a9488'),
    roof: toon('#c8592e'),
    window: new THREE.MeshBasicMaterial({ color: '#ffd98a' }),
  };

  // ตึกหลักฝั่งซ้าย (หลังหอคอย) และตึกยาวฝั่งขวา
  const left = buildBlock(26, 9, 3, mats);
  left.g.position.set(-9, 0, 0);
  root.add(left.g);
  const right = buildBlock(24, 9, 3, mats);
  right.g.position.set(17, 0, 2.5);
  right.g.rotation.y = -0.22;
  root.add(right.g);
  // แผงโซลาร์เซลล์บนหลังคาตึกขวา
  const solar = new THREE.MeshToonMaterial({ color: '#2b3f6b', gradientMap: null });
  for (let i = -4; i <= 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.8), solar);
    p.position.set(i * 2.4, right.H + 1.6, 1.2);
    p.rotation.x = 0.5;
    right.g.add(p);
  }

  // มุขทางเข้ากลาง + ป้ายเปล่า (ไม่มีตัวอักษร)
  const porch = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 4), mats.trim);
  porch.position.set(0, 3.0, 5.6);
  root.add(porch);
  for (const x of [-3.6, 3.6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), mats.wall);
    p.position.set(x, 1.5, 7.2);
    root.add(p);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.1), toon('#e9dcc0'));
  plate.position.set(-6, 1.2, 4.9);
  root.add(plate);

  // ===== หอคอยโครงสีขาว (สัญลักษณ์เด่นตรงกลาง) =====
  const tower = new THREE.Group();
  tower.position.set(0, 0, 7.5);
  const white = toon('#ffffff');
  const legBase = 1.7, legMid = 1.0, midY = 9;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of corners) {
    // ขาหอคอยเรียวขึ้น
    tower.add(tube(new THREE.Vector3(sx * legBase, 0, sz * legBase), new THREE.Vector3(sx * legMid, midY, sz * legMid), 0.16, white));
    // โครงยอดแหลม
    tower.add(tube(new THREE.Vector3(sx * legMid, midY, sz * legMid), new THREE.Vector3(0, 16.5, 0), 0.12, white));
  }
  // ระเบียง/พื้นชั้นต่างๆ ของหอคอย
  for (const [y, r] of [[2.6, 2.6], [5.2, 2.0]]) {
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 8), white);
    deck.position.y = y;
    deck.rotation.y = Math.PI / 8;
    tower.add(deck);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r - 0.05, 0.06, 6, 8), white);
    rail.position.y = y + 0.6;
    rail.rotation.set(Math.PI / 2, 0, Math.PI / 8);
    tower.add(rail);
  }
  // คานแนวนอนเป็นกรอบสี่เหลี่ยมไล่ขึ้นไปถึงยอด
  for (const y of [7, 9, 11, 13, 14.8]) {
    const t = y <= midY ? (y / midY) : (y - midY) / (16.5 - midY);
    const half = y <= midY ? legBase + (legMid - legBase) * t : legMid * (1 - t);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      tower.add(tube(new THREE.Vector3(ax * half, y, az * half), new THREE.Vector3(bx * half, y, bz * half), 0.07, white));
    }
  }
  // กล่องกลางหอ (ห้องระฆัง)
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 1.3), toon('#f4f1ea'));
  box.position.y = 10;
  tower.add(box);
  // เสาธง + ธงพลิ้ว
  tower.add(tube(new THREE.Vector3(0, 16.4, 0), new THREE.Vector3(0, 19.5, 0), 0.05, toon('#d9d9d9')));
  const flagC = document.createElement('canvas');
  flagC.width = 96; flagC.height = 64;
  const fg = flagC.getContext('2d');
  [['#a51931', 0, 11], ['#f4f5f8', 11, 10], ['#2d2a4a', 21, 22], ['#f4f5f8', 43, 10], ['#a51931', 53, 11]]
    .forEach(([c, y, h]) => { fg.fillStyle = c; fg.fillRect(0, y, 96, h); });
  const flagTex = new THREE.CanvasTexture(flagC);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1, 8, 1), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.geometry.translate(0.75, 0, 0);
  flag.position.set(0.05, 18.9, 0);
  flag.userData.dynamic = true;
  tower.add(flag);
  root.add(tower);
  // ไฟส่องหอคอยและตึกสีอุ่น
  const spot = new THREE.PointLight('#ffcc88', 18, 30, 1.7);
  spot.position.set(0, 5, 13);
  root.add(spot);
  scene.add(root);

  // ธงพลิ้วตามลม
  const fp = flag.geometry.attributes.position;
  const base = Float32Array.from(fp.array);
  return (dt, t) => {
    for (let i = 0; i < fp.count; i++) {
      const x = base[i * 3];
      fp.array[i * 3 + 2] = Math.sin(x * 4 - t * 5) * 0.12 * x;
    }
    fp.needsUpdate = true;
  };
}

// ----- สะพานไม้ -----
function buildBridge(scene, b) {
  const g = new THREE.Group();
  const wood = toon('#8b5a2b'), woodLight = toon('#a86f3a');
  const zMid = b.zStart - b.length / 2 + 0.3;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.15, b.length + 0.6), woodLight);
  deck.position.set(b.x, 0.0, zMid);
  g.add(deck);
  // ไม้พื้นเป็นแผ่นๆ
  for (let z = b.zStart - b.length; z < b.zStart + 0.5; z += 0.45) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.03, 0.06), wood);
    plank.position.set(b.x, 0.085, z);
    g.add(plank);
  }
  // เสาและราว (ด้านข้างทั้งสอง)
  for (const s of [-1, 1]) {
    const rx = b.x + s * (b.width / 2 - 0.08);
    for (let z = b.zStart; z >= b.zStart - b.length - 0.01; z -= b.length / 2) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), wood);
      post.position.set(rx, 0.1, z);
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, b.length), wood);
    rail.position.set(rx, 0.85, b.zStart - b.length / 2);
    g.add(rail);
  }
  // วงแสงที่ปลายสะพาน = จุดปล่อยกระทง
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({
    color: '#ffd36b', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(b.x, 0.11, b.zStart - b.length + 0.8);
  g.add(ring);
  // ลูกศรลอยชี้ลง
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), new THREE.MeshBasicMaterial({ color: '#ffd36b' }));
  arrow.rotation.x = Math.PI;
  arrow.position.set(b.x, 1.9, b.zStart - b.length + 0.8);
  g.add(arrow);
  // ป้าย
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('จุดลอยกระทง 🏮'), depthWrite: false }));
  sign.scale.set(2.4, 0.6, 1);
  sign.position.set(b.x, 3.0, b.zStart - b.length + 0.8);
  g.add(sign);
  scene.add(g);
  ring.userData.dynamic = true; arrow.userData.dynamic = true;
  return { ring, arrow };
}

// ----- เสาไฟทางเดิน -----
function buildLamps(scene, positions, colliders) {
  const postMat = toon('#3a2a20');
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb85c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const tops = [];
  for (const [x, z] of positions) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3, 8), postMat);
    post.position.set(x, 1.5, z);
    scene.add(post);
    // โคมทรงไทยแบบง่าย
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), bulbMat);
    lantern.scale.set(1, 1.3, 1);
    lantern.position.set(x, 3.15, z);
    scene.add(lantern);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(2.2);
    glow.position.set(x, 3.15, z);
    scene.add(glow);
    colliders.push({ x, z, r: 0.15 });
    tops.push(new THREE.Vector3(x, 3.0, z));
  }
  return tops;
}

// ----- ไฟประดับสาย (ใช้ InstancedMesh เพื่อประหยัด) -----
function buildStringLights(scene, tops, updaters) {
  // เรียงเสาตามมุมรอบทางเดิน แล้วโยงสายไฟวนรอบ
  const sorted = [...tops].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const points = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i], b = sorted[(i + 1) % sorted.length];
    const n = 9;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 0.55; // สายหย่อน
      points.push(p);
    }
  }
  const colors = ['#ff6b6b', '#ffd36b', '#6bd5ff', '#b48bff', '#7dff9a'];
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial(), points.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  points.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.set(colors[i % colors.length]));
  });
  scene.add(inst);
  // กะพริบสลับสีเบาๆ
  updaters.push((dt, t) => {
    const step = Math.floor(t * 2);
    if (inst.userData.step === step) return;
    inst.userData.step = step;
    points.forEach((p, i) => inst.setColorAt(i, c.set(colors[(i + step) % colors.length])));
    inst.instanceColor.needsUpdate = true;
  });
}

// ----- ทางเข้างาน: พื้นทางเดิน + ซุ้มประตู + เสาไฟ + ร้านอาหาร 6 ร้าน -----
function buildEntrance(scene, colliders, updaters) {
  const len = ENTRY.zEnd - ENTRY.zStart + 0.2, w = ENTRY.halfW * 2 + 1;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, len), toon('#ffffff', { map: pavingTexture() }));
  // ปรับ UV ให้ลายอิฐขนาดเท่ากับทางเดินรอบสระ
  const uv = road.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / WALK.w, uv.getY(i) * len / WALK.d);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.004, ENTRY.zStart + len / 2 - 0.2);
  scene.add(road);

  // ซุ้มประตูทางเข้า
  // ซุ้มจะจางลงเมื่อกล้องอยู่ด้านหลัง (ไม่บังตัวละคร)
  const gate = new THREE.Group();
  const red = toon('#a31f24', { transparent: true }), gold = toon('#e8b23a', { transparent: true });
  const gz = ENTRY.zEnd - 1;
  for (const x of [-6, 6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5, 10), red);
    post.position.set(x, 2.5, gz);
    gate.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 8), gold);
    cap.position.set(x, 5.4, gz);
    gate.add(cap);
    colliders.push({ x, z: gz, r: 0.4 });
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.35, 0.4), red);
  beam.position.set(0, 4.6, gz);
  gate.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 1.3), new THREE.MeshBasicMaterial({
    map: labelTexture('งานลอยกระทง ยินดีต้อนรับ', { bg: '#fff6e4', fg: '#a31f24', border: '#e8b23a', w: 1024, h: 160, font: 'bold 70px sans-serif' }),
    side: THREE.DoubleSide, transparent: true,
  }));
  const bannerMat = banner.material;
  banner.position.set(0, 3.8, gz + 0.25);
  gate.add(banner);
  // โคมแขวนใต้ซุ้ม
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb85c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lanMat = new THREE.MeshBasicMaterial({ color: '#ff5a3c', transparent: true });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), lanMat);
    lan.scale.set(1, 1.25, 1);
    lan.position.set(x, 4.0, gz - 0.3);
    gate.add(lan);
    const gl = new THREE.Sprite(glowMat);
    gl.scale.setScalar(1.8);
    gl.position.copy(lan.position);
    gate.add(gl);
  }

  scene.add(gate);
  const gateMats = [red, gold, lanMat, bannerMat, glowMat];
  let gateAlpha = 1;
  updaters.push((dt, t, cam) => {
    const want = cam && cam.z > gz - 0.5 ? 0.18 : 1;
    gateAlpha += (want - gateAlpha) * Math.min(1, dt * 6);
    for (const m of gateMats) { m.opacity = gateAlpha; m.depthWrite = gateAlpha > 0.9; }
  });

  // เสาไฟสองข้างทาง (อยู่ระหว่างร้าน) + ไฟประดับพาดข้ามถนน
  const lampZ = [21.6, 28.5, 35.5, 42.4];
  const left = buildLamps(scene, lampZ.map((z) => [-ENTRY.halfW - 0.2, z]), colliders);
  const right = buildLamps(scene, lampZ.map((z) => [ENTRY.halfW + 0.2, z]), colliders);
  const colors = ['#ff6b6b', '#ffd36b', '#6bd5ff', '#b48bff', '#7dff9a'];
  const pts = [];
  for (let i = 0; i < lampZ.length; i++) {
    const a = left[i], b = right[i];
    for (let k = 1; k < 18; k++) {
      const t = k / 18, p = a.clone().lerp(b, t);
      p.y += 0.6 - Math.sin(t * Math.PI) * 0.9;
      pts.push(p);
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial(), pts.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  pts.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m); inst.setColorAt(i, c.set(colors[i % 5])); });
  scene.add(inst);
  updaters.push((dt, t) => {
    const step = Math.floor(t * 2);
    if (inst.userData.step === step) return;
    inst.userData.step = step;
    pts.forEach((p, i) => inst.setColorAt(i, c.set(colors[(i + step) % 5])));
    inst.instanceColor.needsUpdate = true;
  });

  // ร้านอาหาร: ซ้าย 3 ร้าน (หันหน้าไปทาง +x) ขวา 3 ร้าน (หันหน้าไปทาง -x)
  const shopZ = [25, 32, 39];
  const shops = [];
  SHOPS.forEach((shop, i) => {
    const leftSide = i < 3;
    shops.push(buildShop(scene, shop, leftSide ? -8.6 : 8.6, shopZ[i % 3], leftSide ? -Math.PI / 2 : Math.PI / 2, colliders, updaters));
  });
  return shops;
}

// ----- ร้านค้า (พร็อพ) -----
function buildStall(scene, name, color, textColor, x, z, rotY, colliders) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY; // หันหน้าร้าน (ด้าน -z ของร้าน) เข้าหาสระ
  const wood = toon('#8b5a2b');
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1.2), toon('#d9b98c'));
  counter.position.set(0, 0.5, 0.2);
  g.add(counter);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), toon(color));
  front.position.set(0, 0.5, -0.41);
  front.rotation.y = Math.PI;
  g.add(front);
  for (const px of [-1.5, 1.5]) for (const pz of [-0.5, 0.9]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), wood);
    p.position.set(px, 1.3, pz);
    g.add(p);
  }
  // หลังคาผ้าใบลายทาง
  const awning = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 2), toon('#ffffff', { map: stripeTexture(color, '#fff6e4') }));
  awning.position.set(0, 2.65, 0.2);
  awning.rotation.x = -0.18;
  g.add(awning);
  // ของบนเคาน์เตอร์ (ถาด/หม้อ)
  for (let i = -1; i <= 1; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 12), toon(['#c0c0c0', '#e8b23a', '#ffffff'][i + 1]));
    pot.position.set(i * 0.9, 1.1, 0.2);
    g.add(pot);
  }
  // ป้ายชื่อร้าน
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({
    map: labelTexture(name, { bg: color, fg: textColor, border: '#fff6e4' }), transparent: true,
  }));
  sign.position.set(0, 3.15, -0.6);
  sign.rotation.y = Math.PI;
  g.add(sign);
  // ไฟหลอดใต้หลังคา
  const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf80', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  bulb.scale.setScalar(1.6);
  bulb.position.set(0, 2.3, -0.2);
  g.add(bulb);
  scene.add(g);
  colliders.push({ x, z, r: 1.7 });
}

// ----- ต้นไม้การ์ตูน -----
function buildTree(scene, x, z, colliders) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), toon('#5b3a24'));
  trunk.position.y = 1;
  g.add(trunk);
  const leaf = toon(Math.random() < 0.5 ? '#2f7a3f' : '#3d8b4a');
  const s = 0.8 + Math.random() * 0.5;
  for (const [ox, oy, oz, r] of [[0, 2.8, 0, 1.4], [0.7, 2.4, 0.3, 1], [-0.6, 2.5, -0.2, 1.05], [0, 3.6, 0, 0.9]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
    b.position.set(ox, oy, oz);
    g.add(b);
  }
  g.scale.setScalar(s);
  scene.add(g);
  colliders.push({ x, z, r: 0.5 * s });
}

// ----- ท่อเชื่อมระหว่างจุด 2 จุด (ใช้ทำโครงจักรยาน) -----
const UP = new THREE.Vector3(0, 1, 0);
function tube(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function wheel(r, tubeR, tireMat, rimMat, spokes) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r, tubeR, 8, 28), tireMat));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r - tubeR, tubeR * 0.35, 6, 28), rimMat));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, (r - tubeR) * 2, 4), rimMat);
    sp.rotation.z = a;
    g.add(sp);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10).rotateX(Math.PI / 2), rimMat));
  return g;
}

// ----- จักรยานสีเขียว (จอดตั้งขาตั้ง มีตะกร้าหน้า) -----
function buildBicycle(scene, x, z, rotY) {
  const g = new THREE.Group();
  const green = toon('#2e9e4f'), dark = toon('#222222'), metal = toon('#c9ccd1');
  const R = 0.33;
  const rear = new THREE.Vector3(-0.52, R, 0), front = new THREE.Vector3(0.52, R, 0);
  const crank = new THREE.Vector3(-0.02, 0.3, 0), seatTop = new THREE.Vector3(-0.18, 0.86, 0);
  const headTop = new THREE.Vector3(0.36, 0.9, 0), headBot = new THREE.Vector3(0.42, 0.62, 0);
  for (const [p, c] of [[rear, 0], [front, 0]]) {
    const w = wheel(R, 0.028, dark, metal, 8);
    w.position.copy(p);
    g.add(w);
  }
  // โครงสีเขียว (ทรงจักรยานแม่บ้าน ท่อบนต่ำ)
  g.add(tube(crank, seatTop, 0.025, green));
  g.add(tube(crank, headBot, 0.028, green));
  g.add(tube(new THREE.Vector3(-0.1, 0.62, 0), new THREE.Vector3(0.39, 0.74, 0), 0.022, green));
  g.add(tube(headBot, headTop, 0.025, green));
  for (const s of [-1, 1]) {
    g.add(tube(new THREE.Vector3(rear.x, R, s * 0.05), new THREE.Vector3(crank.x, crank.y, s * 0.03), 0.014, green));
    g.add(tube(new THREE.Vector3(rear.x, R, s * 0.05), new THREE.Vector3(seatTop.x + 0.04, 0.78, s * 0.02), 0.014, green));
    g.add(tube(new THREE.Vector3(front.x, R, s * 0.05), new THREE.Vector3(headBot.x, headBot.y, s * 0.02), 0.016, green));
  }
  // บังโคลนหลัง
  const fender = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.02, 6, 20, Math.PI * 0.75), green);
  fender.position.copy(rear);
  fender.rotation.z = Math.PI * 0.18;
  g.add(fender);
  // เบาะ + แฮนด์
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.13), dark);
  seat.position.set(seatTop.x - 0.02, seatTop.y + 0.03, 0);
  g.add(seat);
  g.add(tube(new THREE.Vector3(headTop.x - 0.06, headTop.y + 0.04, -0.26), new THREE.Vector3(headTop.x - 0.06, headTop.y + 0.04, 0.26), 0.016, metal));
  for (const s of [-1, 1]) g.add(tube(new THREE.Vector3(headTop.x - 0.06, headTop.y + 0.04, s * 0.2), new THREE.Vector3(headTop.x - 0.06, headTop.y + 0.04, s * 0.3), 0.024, dark));
  // ตะกร้าหน้า
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.34, 3, 2, 3), new THREE.MeshToonMaterial({ color: '#2e9e4f', wireframe: true }));
  basket.position.set(headTop.x + 0.2, headTop.y - 0.08, 0);
  g.add(basket);
  const basketBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.34), green);
  basketBase.position.set(headTop.x + 0.2, headTop.y - 0.18, 0);
  g.add(basketBase);
  // บันได
  g.add(tube(new THREE.Vector3(crank.x, crank.y, -0.12), new THREE.Vector3(crank.x, crank.y, 0.12), 0.015, metal));
  g.position.set(x, 0, z);
  g.rotation.set(0.07, rotY, 0); // เอียงพิงขาตั้งเล็กน้อย
  scene.add(g);
}

// ----- สกูตเตอร์สีฟ้า (แบบยืนขี่) -----
function buildScooter(scene, x, z, rotY) {
  const g = new THREE.Group();
  const blue = toon('#2f8fe0'), dark = toon('#222222'), metal = toon('#c9ccd1');
  const R = 0.11;
  for (const wx of [-0.38, 0.4]) {
    const w = wheel(R, 0.03, dark, metal, 4);
    w.position.set(wx, R, 0);
    g.add(w);
  }
  // พื้นเหยียบ
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.17), blue);
  deck.position.set(0, R + 0.05, 0);
  g.add(deck);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.13), dark);
  grip.position.set(-0.04, R + 0.085, 0);
  g.add(grip);
  // บังโคลนหลัง
  const fender = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.02, 6, 16, Math.PI * 0.6), blue);
  fender.position.set(-0.38, R, 0);
  fender.rotation.z = Math.PI * 0.2;
  g.add(fender);
  // คอแฮนด์ + แฮนด์ + ไฟหน้า
  const stemBot = new THREE.Vector3(0.4, R + 0.06, 0), stemTop = new THREE.Vector3(0.33, 1.02, 0);
  g.add(tube(new THREE.Vector3(0.4, R, 0), stemBot, 0.03, blue));
  g.add(tube(stemBot, stemTop, 0.03, blue));
  g.add(tube(new THREE.Vector3(stemTop.x, stemTop.y, -0.24), new THREE.Vector3(stemTop.x, stemTop.y, 0.24), 0.018, metal));
  for (const s of [-1, 1]) g.add(tube(new THREE.Vector3(stemTop.x, stemTop.y, s * 0.17), new THREE.Vector3(stemTop.x, stemTop.y, s * 0.27), 0.026, dark));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4c2' }));
  lamp.position.set(stemTop.x + 0.05, 0.82, 0);
  g.add(lamp);
  // จอกลางแฮนด์
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.08), dark);
  screen.position.set(stemTop.x, stemTop.y + 0.025, 0);
  g.add(screen);
  g.position.set(x, 0, z);
  g.rotation.set(0.08, rotY, 0);
  scene.add(g);
}
