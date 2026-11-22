// ===== wishtree.js: ต้นไม้ขอพรกลางถนนทางเข้า =====
// เขียนคำขอลงกระดาษแล้วแขวนบนต้นไม้ + แตะกระดาษใบอื่นเพื่ออ่านคำขอ
// หมายเหตุ: เกมนี้ไม่มีเซิร์ฟเวอร์ "คำขอของคนอื่น" จึงสุ่มจากรายการตัวอย่าง ส่วนของเราเก็บในเครื่อง
import * as THREE from 'three';
import { toon, glowTexture, labelTexture } from './textures.js';
import { bakeStatic } from './perf.js';

export const SAMPLE_WISHES = [
  'ขอให้สอบไฟนอลผ่านทุกวิชา', 'ขอให้มีแฟนสักที', 'ขอให้ร่ำรวย เงินทองไหลมาเทมา', 'ขอให้ได้เกรด A',
  'ขอให้เรียนจบทันเพื่อน', 'ขอให้ครอบครัวสุขภาพแข็งแรง', 'ขอให้ได้นอนเต็มอิ่มบ้าง', 'ขอให้โปรเจกต์ผ่าน',
  'ขอให้ถูกหวย', 'ขอให้คนที่แอบชอบหันมามอง', 'ขอให้ได้ฝึกงานที่อยากไป', 'ขอให้หายขี้เกียจ',
  'ขอให้เพื่อนๆ ผ่านไปด้วยกัน', 'ขอให้อาจารย์ใจดีตอนตรวจข้อสอบ', 'ขอให้ผอมลงอีก 5 โล', 'ขอให้มีความสุขทุกวัน',
  'ขอให้หาของกินอร่อยเจอทุกมื้อ', 'ขอให้ได้งานดีๆ เงินเดือนเยอะๆ', 'ขอให้ปีหน้าดีกว่าปีนี้', 'ขอให้แม่ไม่บ่น',
  'ขอให้ทีมโปรดชนะ', 'ขอให้ได้ไปเที่ยวญี่ปุ่น', 'ขอให้เลิกเท', 'ขอให้คนที่รักรักเราตอบ',
];
const PAPER_COLORS = ['#ff8a8a', '#ffd36b', '#8fd3ff', '#b9a2ff', '#9be89b', '#ffb4e0'];
const MINE_COLOR = '#ffe27a';

export function buildWishTree(scene, x, z, colliders, updaters, myWishes = []) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  scene.add(root);

  // แท่นหินรอบโคนต้น + ป้าย
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.45, 24), toon('#d9cdb8'));
  base.position.y = 0.22;
  root.add(base);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 24), toon('#5b3a24'));
  soil.position.y = 0.46;
  root.add(soil);

  // ลำต้นบิดๆ + กิ่งใหญ่
  const bark = toon('#6b4528');
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 3.2, 10), bark);
  trunk.position.y = 2.0;
  root.add(trunk);
  const branchEnds = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const len = 1.8 + (i % 2) * 0.4;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.18, len, 7), bark);
    const dir = new THREE.Vector3(Math.cos(a), 0.75, Math.sin(a)).normalize();
    br.position.set(0, 3.2, 0).addScaledVector(dir, len / 2);
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    root.add(br);
    branchEnds.push(new THREE.Vector3(0, 3.2, 0).addScaledVector(dir, len));
  }
  // พุ่มใบ (โปร่งพอให้เห็นกระดาษ)
  const leafMats = [toon('#2f7a3f'), toon('#3d8b4a'), toon('#4e9e57')];
  const puffs = [[0, 5.1, 0, 1.6], ...branchEnds.map((p, i) => [p.x * 1.05, p.y + 0.5, p.z * 1.05, 1.0 + (i % 3) * 0.15])];
  for (const [px, py, pz, r] of puffs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[Math.floor(Math.random() * 3)]);
    m.position.set(px, py, pz);
    root.add(m);
  }
  // ไฟกระพริบในพุ่ม
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffdf9a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const fireflies = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(glowMat.clone());
    const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.6;
    s.position.set(Math.cos(a) * r, 3.3 + Math.random() * 2.2, Math.sin(a) * r);
    s.scale.setScalar(0.5);
    s.userData.ph = Math.random() * 6;
    root.add(s);
    fireflies.push(s);
  }
  colliders.push({ x, z, r: 1.95 });
  // ป้ายชื่อลอยเหนือต้น (หันหาผู้เล่นเสมอ)
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture('🎋 ต้นไม้ขอพร', { bg: '#2c6e49', fg: '#ffffff', border: '#e8b23a' }), transparent: true,
  }));
  sign.scale.set(2.6, 0.65, 1);
  sign.position.y = 7.1;
  root.add(sign);

  // ----- จุดแขวนกระดาษ: ใต้กิ่งและรอบพุ่มด้านล่าง -----
  const slots = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 * 3.7 + (i % 5) * 0.2;
    const r = 1.3 + ((i * 37) % 11) / 11 * 1.4;
    const y = 2.6 + ((i * 53) % 13) / 13 * 1.2;
    slots.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  let slotIdx = 0;
  const tags = []; // {mesh, text, mine}
  const stringMat = new THREE.LineBasicMaterial({ color: '#c0392b' });

  function addTag(text, mine = false, animate = false) {
    const p = slots[slotIdx % slots.length];
    // ถ้ากระดาษเต็มแล้ว เอาใบเก่าสุดที่ไม่ใช่ของเราออก
    if (tags.length >= slots.length) {
      const i = tags.findIndex((t) => !t.mine);
      const old = tags.splice(i >= 0 ? i : 0, 1)[0];
      root.remove(old.group);
    }
    slotIdx++;
    const g = new THREE.Group();
    g.userData.dynamic = true;
    g.position.copy(p);
    // เชือก
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.35, 0)]);
    g.add(new THREE.Line(geo, stringMat));
    // กระดาษ (สองหน้า) ทรงป้ายยาว
    const color = mine ? MINE_COLOR : PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)];
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.48), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    paper.position.y = -0.56;
    g.add(paper);
    if (mine) {
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2a8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      star.scale.setScalar(0.7);
      star.position.y = -0.56;
      g.add(star);
    }
    g.rotation.y = Math.atan2(p.x, p.z);
    g.userData.ph = Math.random() * 6;
    if (animate) g.scale.setScalar(0.01);
    root.add(g);
    const tag = { group: g, paper, text, mine };
    paper.userData.tag = tag;
    tags.push(tag);
    return tag;
  }

  // ใส่กระดาษตัวอย่าง (สุ่มจากรายการ) + ของเราที่เคยแขวนไว้
  const shuffled = [...SAMPLE_WISHES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 22; i++) addTag(shuffled[i % shuffled.length]);
  for (const w of myWishes) addTag(w, true);

  // ประหยัดเครื่อง: กระดาษชุดแรกรวมเป็นโมเดลเดียว (กระดาษจริงซ่อนไว้ใช้ตรวจการแตะ)
  const visual = new THREE.Group();
  const ropeMat = new THREE.MeshBasicMaterial({ color: '#c0392b' });
  root.updateMatrixWorld(true);
  for (const tg of tags) {
    const holder = new THREE.Group();
    holder.position.copy(tg.group.position);
    holder.rotation.copy(tg.group.rotation);
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.35, 0.012), ropeMat);
    rope.position.y = -0.175;
    holder.add(rope);
    holder.add(new THREE.Mesh(tg.paper.geometry.clone(), tg.paper.material).translateY(-0.56));
    visual.add(holder);
    tg.paper.visible = false;
    tg.static = true;
    for (const c of [...tg.group.children]) if (c.isLine) tg.group.remove(c);
  }
  root.add(visual);
  bakeStatic(visual);

  updaters.push((dt, t) => {
    for (const tg of tags) {
      if (tg.static) continue;
      const g = tg.group;
      g.rotation.z = Math.sin(t * 1.6 + g.userData.ph) * 0.12; // กระดาษแกว่งตามลม
      if (g.scale.x < 1) g.scale.setScalar(Math.min(1, g.scale.x + dt * 2.5));
    }
    for (const s of fireflies) s.material.opacity = 0.6 + Math.sin(t * 3 + s.userData.ph) * 0.4;
  });

  return {
    x, z, tags,
    addTag,
    papers: () => tags.map((t) => t.paper),
    randomOthers(n) {
      const others = tags.filter((t) => !t.mine).map((t) => t.text);
      return [...new Set(others)].sort(() => Math.random() - 0.5).slice(0, n);
    },
  };
}
