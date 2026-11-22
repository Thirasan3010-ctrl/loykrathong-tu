// ===== shops.js: ร้านอาหารตรงทางเข้างาน (ซื้อได้จริงด้วยเหรียญในเกม) =====
// เหรียญเป็นของในเกมเท่านั้น ไม่มีการใช้เงินจริง
import * as THREE from 'three';
import { toon, stripeTexture, labelTexture, glowTexture } from './textures.js';
import { createCharacter, randomOutfit } from './character.js';

// ----- ข้อมูลร้าน + เมนู (ราคาเป็นเหรียญในเกม) -----
export const SHOPS = [
  {
    id: 'meatball', name: 'ลูกชิ้นปิ้ง', color: '#16a085', text: '#ffffff', food: 'meatball',
    menu: [
      { id: 'mb_pork', name: 'ลูกชิ้นหมูปิ้ง', emoji: '🍢', price: 10, food: 'meatball' },
      { id: 'mb_beef', name: 'ลูกชิ้นเอ็นเนื้อ', emoji: '🍢', price: 15, food: 'meatball' },
      { id: 'mb_mix', name: 'ลูกชิ้นรวมจัมโบ้', emoji: '🍢', price: 20, food: 'meatball' },
    ],
  },
  {
    id: 'chicken', name: 'ไก่ทอด', color: '#e67e22', text: '#fff3c4', food: 'chicken',
    menu: [
      { id: 'ck_leg', name: 'น่องไก่ทอด', emoji: '🍗', price: 25, food: 'chicken' },
      { id: 'ck_wing', name: 'ปีกไก่ทอด', emoji: '🍗', price: 20, food: 'chicken' },
      { id: 'ck_pop', name: 'ไก่ป๊อปถ้วย', emoji: '🍗', price: 30, food: 'chicken' },
    ],
  },
  {
    id: 'padthai', name: 'ผัดไทย', color: '#c0392b', text: '#ffffff', food: 'padthai',
    menu: [
      { id: 'pt_shrimp', name: 'ผัดไทยกุ้งสด', emoji: '🍜', price: 60, food: 'padthai' },
      { id: 'pt_egg', name: 'ผัดไทยห่อไข่', emoji: '🍜', price: 50, food: 'padthai' },
      { id: 'pt_glass', name: 'ผัดไทยวุ้นเส้น', emoji: '🍜', price: 45, food: 'padthai' },
    ],
  },
  {
    id: 'sausage', name: 'ไส้กรอกอีสาน', color: '#a0522d', text: '#fff3c4', food: 'sausage',
    menu: [
      { id: 'ss_pork', name: 'ไส้กรอกหมู', emoji: '🌭', price: 10, food: 'sausage' },
      { id: 'ss_rice', name: 'ไส้กรอกข้าว', emoji: '🌭', price: 10, food: 'sausage' },
      { id: 'ss_set', name: 'ชุดไส้กรอก + ผักเคียง', emoji: '🌭', price: 35, food: 'sausage' },
    ],
  },
  {
    id: 'khanomkrok', name: 'ขนมครก', color: '#8e44ad', text: '#fff3c4', food: 'khanomkrok',
    menu: [
      { id: 'kk_plain', name: 'ขนมครกกะทิ', emoji: '🥥', price: 30, food: 'khanomkrok' },
      { id: 'kk_onion', name: 'ขนมครกต้นหอม', emoji: '🥥', price: 35, food: 'khanomkrok' },
      { id: 'kk_corn', name: 'ขนมครกข้าวโพด', emoji: '🥥', price: 35, food: 'khanomkrok' },
    ],
  },
  {
    id: 'tea', name: 'ชาไทย', color: '#d35400', text: '#ffffff', food: 'tea',
    menu: [
      { id: 'tea_thai', name: 'ชาไทยเย็น', emoji: '🧋', price: 25, food: 'tea' },
      { id: 'tea_green', name: 'ชาเขียวนม', emoji: '🧋', price: 30, food: 'tea' },
      { id: 'tea_cocoa', name: 'โกโก้เย็น', emoji: '🧋', price: 30, food: 'tea', tint: '#6b3e26' },
    ],
  },
];
export const START_COINS = 200;
export const COIN_PER_RELEASE = 30; // ลอยกระทง 1 ครั้งได้เหรียญเพิ่ม

export function findItem(id) {
  for (const s of SHOPS) for (const m of s.menu) if (m.id === id) return { shop: s, item: m };
  return null;
}

// ----- โมเดลอาหาร (สเกลประมาณของจริง ใช้ทั้งบนเคาน์เตอร์และถือในมือ) -----
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const stickMat = () => toon('#d9b98c');

export function buildFood(type, opts = {}) {
  const g = new THREE.Group();
  if (type === 'meatball') {
    // ไม้ลูกชิ้น 4 ลูก
    g.add(M(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), stickMat(), 0, 0.18, 0));
    const ball = toon('#8a5a3c');
    for (let i = 0; i < 4; i++) g.add(M(new THREE.SphereGeometry(0.032, 12, 10), ball, 0, 0.2 + i * 0.058, 0));
    // น้ำจิ้มราด
    g.add(M(new THREE.SphereGeometry(0.02, 8, 6), toon('#c0392b'), 0.02, 0.34, 0.02));
  } else if (type === 'chicken') {
    // ถุงกระดาษ + น่องไก่ 2 ชิ้น
    g.add(M(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 12, 1, true), toon('#fff6e4', { side: THREE.DoubleSide }), 0, 0.06, 0));
    const crust = toon('#c47a22'), bone = toon('#f2e6cf');
    for (const [x, rz] of [[-0.025, 0.35], [0.03, -0.3]]) {
      const leg = new THREE.Group();
      const meat = M(new THREE.SphereGeometry(0.05, 12, 10), crust, 0, 0.0, 0);
      meat.scale.set(0.85, 1.3, 0.85);
      leg.add(meat);
      leg.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6), bone, 0, 0.09, 0));
      leg.add(M(new THREE.SphereGeometry(0.018, 8, 6), bone, 0, 0.125, 0));
      leg.position.set(x, 0.14, 0);
      leg.rotation.z = rz;
      g.add(leg);
    }
  } else if (type === 'padthai') {
    // กล่อง/จาน + เส้นผัดไทย + กุ้ง + มะนาว + ถั่วงอก
    g.add(M(new THREE.CylinderGeometry(0.13, 0.11, 0.035, 24), toon('#ffffff'), 0, 0.018, 0));
    const noodle = toon('#e0a050');
    for (let i = 0; i < 14; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.035 + Math.random() * 0.03, 0.007, 5, 12, Math.PI * (1 + Math.random())), noodle);
      t.position.set((Math.random() - 0.5) * 0.12, 0.045 + Math.random() * 0.03, (Math.random() - 0.5) * 0.12);
      t.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.6, Math.random() * 6, Math.random() * 6);
      g.add(t);
    }
    const shrimp = toon('#ff7f50');
    for (const [x, z, r] of [[0.04, 0.02, 0.5], [-0.04, -0.03, 2.3]]) {
      const s = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.011, 6, 10, Math.PI * 1.3), shrimp);
      s.position.set(x, 0.085, z);
      s.rotation.set(Math.PI / 2, 0, r);
      g.add(s);
    }
    const lime = M(new THREE.SphereGeometry(0.025, 10, 8, 0, Math.PI), toon('#7cc242'), -0.09, 0.05, 0.05);
    lime.rotation.y = 0.8;
    g.add(lime);
    for (let i = 0; i < 5; i++) {
      const sprout = M(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), toon('#fffbe6'), 0.07 + i * 0.008, 0.06, -0.05);
      sprout.rotation.z = 1.2;
      g.add(sprout);
    }
    g.add(M(new THREE.BoxGeometry(0.03, 0.005, 0.05), toon('#3fa34d'), 0.0, 0.09, -0.02)); // ต้นหอม
  } else if (type === 'sausage') {
    // ไม้ไส้กรอกอีสานลูกกลม 3 ลูก + พริก + กะหล่ำ
    g.add(M(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6), stickMat(), 0, 0.17, 0));
    const skin = toon('#b5523b');
    for (let i = 0; i < 3; i++) {
      const s = M(new THREE.SphereGeometry(0.038, 12, 10), skin, 0, 0.2 + i * 0.065, 0);
      s.scale.set(1, 0.85, 1);
      g.add(s);
    }
    g.add(M(new THREE.ConeGeometry(0.01, 0.04, 6), toon('#2ecc40'), 0.03, 0.2, 0.03)); // พริก
  } else if (type === 'khanomkrok') {
    // กระทงใบตอง/ถาดเล็ก + ขนมครก 6 ฝา
    g.add(M(new THREE.BoxGeometry(0.2, 0.02, 0.13), toon('#5fa35f'), 0, 0.01, 0));
    const cream = toon('#fff6e4'), crisp = toon('#e8b23a');
    for (let i = 0; i < 6; i++) {
      const x = -0.06 + (i % 3) * 0.06, z = i < 3 ? -0.03 : 0.03;
      g.add(M(new THREE.SphereGeometry(0.026, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), crisp, x, 0.045, z));
      const top = M(new THREE.CircleGeometry(0.024, 14), cream, x, 0.046, z);
      top.rotation.x = -Math.PI / 2;
      g.add(top);
      if (opts.onion !== false && i % 2 === 0) g.add(M(new THREE.BoxGeometry(0.01, 0.006, 0.01), toon('#3fa34d'), x, 0.05, z));
    }
    g.position.y = 0;
  } else if (type === 'tea') {
    // แก้วพลาสติก + ชาไทยสีส้ม + ฝาโดม + หลอด
    const tint = opts.tint || '#e8833a';
    g.add(M(new THREE.CylinderGeometry(0.045, 0.035, 0.15, 16), toon(tint), 0, 0.075, 0));
    g.add(M(new THREE.CylinderGeometry(0.046, 0.046, 0.025, 16), toon('#fff6e4'), 0, 0.14, 0)); // นมด้านบน
    g.add(M(new THREE.SphereGeometry(0.047, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }), 0, 0.152, 0));
    const straw = M(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), toon('#e74c3c'), 0.012, 0.22, 0);
    straw.rotation.z = -0.15;
    g.add(straw);
  }
  return g;
}

// ----- ร้าน + แม่ค้า -----
// ร้านหันหน้า (ด้าน -z ของร้าน) ไปตามมุม rotY
export function buildShop(scene, shop, x, z, rotY, colliders, updaters) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const wood = toon('#8b5a2b');

  // พื้นร้าน + เคาน์เตอร์เตี้ย (ให้เห็นแม่ค้าชัด)
  g.add(M(new THREE.BoxGeometry(3.6, 0.08, 2.6), toon('#6d4c2f'), 0, 0.04, 0.5));
  g.add(M(new THREE.BoxGeometry(3.2, 0.78, 0.7), toon('#d9b98c'), 0, 0.39, -0.35));
  const front = M(new THREE.PlaneGeometry(3.2, 0.62), toon(shop.color), 0, 0.42, -0.71);
  front.rotation.y = Math.PI;
  g.add(front);
  // ป้ายเมนูเล็กหน้าเคาน์เตอร์
  const menuText = shop.menu.map((m) => `${m.name} ${m.price}`).join('  •  ');
  const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), new THREE.MeshBasicMaterial({
    map: labelTexture(menuText, { bg: '#fff6e4', fg: '#5a3825', border: shop.color, font: 'bold 30px sans-serif', w: 1024, h: 100 }),
  }));
  menuBoard.position.set(0, 0.42, -0.72);
  menuBoard.rotation.y = Math.PI;
  g.add(menuBoard);

  // เสา + หลังคาผ้าใบลายทาง
  for (const px of [-1.65, 1.65]) for (const pz of [-0.7, 1.7]) g.add(M(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 6), wood, px, 1.35, pz));
  const awning = M(new THREE.BoxGeometry(3.7, 0.08, 2.9), toon('#ffffff', { map: stripeTexture(shop.color, '#fff6e4') }), 0, 2.75, 0.5);
  awning.rotation.x = -0.14;
  g.add(awning);

  // ป้ายชื่อร้าน
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({
    map: labelTexture(shop.name, { bg: shop.color, fg: shop.text, border: '#fff6e4' }), transparent: true,
  }));
  sign.position.set(0, 3.3, -0.85);
  sign.rotation.y = Math.PI;
  g.add(sign);

  // อาหารโชว์บนเคาน์เตอร์ + อุปกรณ์ประจำร้าน
  const display = new THREE.Group();
  if (shop.food === 'meatball' || shop.food === 'sausage') {
    // เตาปิ้ง + ไม้เรียง
    display.add(M(new THREE.BoxGeometry(1.2, 0.1, 0.4), toon('#2b2b2b'), 0, 0.83, -0.35));
    display.add(M(new THREE.BoxGeometry(1.1, 0.02, 0.32), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }), 0, 0.885, -0.35));
    for (let i = 0; i < 7; i++) {
      const f = buildFood(shop.food);
      f.rotation.x = Math.PI / 2;
      f.position.set(-0.48 + i * 0.16, 0.92, -0.53);
      display.add(f);
    }
    for (const sx of [-1.15, 1.15]) { const f = buildFood(shop.food); f.position.set(sx, 0.78, -0.4); f.scale.setScalar(1.3); display.add(f); }
  } else if (shop.food === 'chicken') {
    // ตู้กระจก + กองไก่ทอด
    display.add(M(new THREE.BoxGeometry(1.4, 0.5, 0.5), new THREE.MeshToonMaterial({ color: '#dff6ff', transparent: true, opacity: 0.3 }), 0, 1.03, -0.35));
    for (let i = 0; i < 6; i++) { const f = buildFood('chicken'); f.position.set(-0.5 + i * 0.2, 0.78, -0.35); display.add(f); }
    display.add(M(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 20), toon('#555555'), 1.15, 0.9, -0.35)); // กระทะทอด
    display.add(M(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 20), toon('#d9a441'), 1.15, 1.02, -0.35));
  } else if (shop.food === 'padthai') {
    // กระทะใหญ่ + จานผัดไทย
    const wok = M(new THREE.SphereGeometry(0.4, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#333333', { side: THREE.DoubleSide }), 0.75, 1.17, -0.35);
    display.add(wok);
    display.add(M(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 20), toon('#e0a050'), 0.75, 1.06, -0.35));
    for (let i = 0; i < 3; i++) { const f = buildFood('padthai'); f.position.set(-1.1 + i * 0.32, 0.78, -0.4); display.add(f); }
  } else if (shop.food === 'khanomkrok') {
    // เตาหลุมขนมครก
    display.add(M(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 24), toon('#3a3a3a'), 0.7, 0.84, -0.35));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      display.add(M(new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e8b23a'), 0.7 + Math.cos(a) * 0.19, 0.9, -0.35 + Math.sin(a) * 0.19));
    }
    for (let i = 0; i < 3; i++) { const f = buildFood('khanomkrok'); f.position.set(-1.1 + i * 0.3, 0.78, -0.4); display.add(f); }
  } else if (shop.food === 'tea') {
    // แก้วเรียง + ถังชา
    display.add(M(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 16), toon('#c0c0c0'), 1.0, 1.0, -0.3));
    display.add(M(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), toon('#2b2b2b'), 1.0, 0.85, -0.5));
    const tints = ['#e8833a', '#9bc46a', '#6b3e26'];
    for (let i = 0; i < 6; i++) { const f = buildFood('tea', { tint: tints[i % 3] }); f.position.set(-1.1 + i * 0.22, 0.78, -0.45); display.add(f); }
  }
  g.add(display);

  // แม่ค้า/พ่อค้า ยืนหลังเคาน์เตอร์ (ผ้ากันเปื้อน + หมวก)
  const vendor = createCharacter(randomOutfit(Math.random() < 0.65 ? 'female' : 'male'));
  vendor.group.position.set(-0.3, 0.08, 0.35);
  vendor.group.rotation.y = Math.PI; // หันหน้าออกหน้าร้าน
  vendor.group.scale.setScalar(1.25);
  const apron = M(new THREE.PlaneGeometry(0.34, 0.42), toon('#fff6e4', { side: THREE.DoubleSide }), 0, 0.52, 0.2);
  vendor.group.add(apron);
  const apronBand = M(new THREE.PlaneGeometry(0.34, 0.06), toon(shop.color, { side: THREE.DoubleSide }), 0, 0.7, 0.201);
  vendor.group.add(apronBand);
  g.add(vendor.group);

  // ไฟหลอดใต้หลังคา
  for (const bx of [-1, 1]) {
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf80', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bulb.scale.setScalar(1.4);
    bulb.position.set(bx * 0.9, 2.45, -0.2);
    g.add(bulb);
  }

  scene.add(g);
  // ชนเฉพาะตัวร้าน (หน้าร้านเดินเข้าไปยืนได้)
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const toWorld = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  for (const lx of [-1.1, 0, 1.1]) { const p = toWorld(lx, 0.3); colliders.push({ x: p.x, z: p.z, r: 1.0 }); }

  // แม่ค้ายืนนิ่ง เพื่อให้รวมเป็นโมเดลเดียวกับร้านได้ (ประหยัดเครื่อง)
  vendor.group.traverse((n) => { n.userData.dynamic = false; });
  const front2 = toWorld(0, -2.0);
  return {
    shop, front: front2,
    greet() {},
  };
}
