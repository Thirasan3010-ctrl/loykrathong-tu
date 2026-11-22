// ===== textures.js: สร้างลวดลาย (Texture) ด้วย Canvas ทั้งหมด ไม่ใช้รูปจากภายนอก =====
import * as THREE from 'three';

// gradientMap สำหรับ Toon Shading: แบ่งแสงเป็น 3 ระดับ ให้ดูเป็นการ์ตูน
let _gradient = null;
export function toonGradient() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([90, 170, 255]); // มืด / กลาง / สว่าง
  _gradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  _gradient.needsUpdate = true;
  return _gradient;
}

// สร้างวัสดุ Toon แบบสั้นๆ
export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

// ตัวช่วยสร้าง canvas แล้วแปลงเป็น texture
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// แคชเพื่อไม่สร้าง texture ซ้ำ (ประหยัดหน่วยความจำมือถือ)
const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

// ปรับความสว่างสี (ใช้ทำเงา/ไฮไลต์ของลาย)
export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

// ----- ลายประจำยาม: ดอกสี่กลีบในกรอบสี่เหลี่ยมทแยง (วาดใหม่จากโครงสร้างแม่ลายโบราณ) -----
function drawPrajamyam(g, x, y, s, fg, center) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.PI / 4);
  g.strokeStyle = fg; g.lineWidth = s * 0.08;
  g.strokeRect(-s / 2, -s / 2, s, s);
  g.fillStyle = fg;
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath();
    g.ellipse(0, -s * 0.22, s * 0.13, s * 0.22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath(); g.arc(0, 0, s * 0.11, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ----- ช้างการ์ตูนวาดเอง (มองด้านข้าง) -----
function drawElephant(g, x, y, s, fg, flip) {
  g.save();
  g.translate(x, y);
  if (flip) g.scale(-1, 1);
  g.fillStyle = fg;
  // ลำตัว
  g.beginPath(); g.ellipse(0, 0, s * 0.42, s * 0.28, 0, 0, Math.PI * 2); g.fill();
  // หัว
  g.beginPath(); g.arc(s * 0.38, -s * 0.12, s * 0.2, 0, Math.PI * 2); g.fill();
  // งวง (โค้งลง)
  g.lineWidth = s * 0.1; g.lineCap = 'round'; g.strokeStyle = fg;
  g.beginPath();
  g.moveTo(s * 0.52, -s * 0.05);
  g.quadraticCurveTo(s * 0.7, s * 0.15, s * 0.6, s * 0.32);
  g.stroke();
  // ขา 4 ข้าง
  for (const lx of [-0.28, -0.1, 0.1, 0.26]) {
    g.fillRect(s * lx - s * 0.06, s * 0.1, s * 0.12, s * 0.3);
  }
  // หูและตา (เจาะด้วยสีพื้นด้วยการลบ)
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(s * 0.43, -s * 0.18, s * 0.03, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = shade(fg, -0.12);
  g.beginPath(); g.ellipse(s * 0.27, -s * 0.1, s * 0.1, s * 0.15, 0.2, 0, Math.PI * 2); g.fill();
  // ผ้าคลุมหลังช้างเล็กๆ
  g.fillStyle = shade(fg, 0.15);
  g.beginPath(); g.ellipse(-s * 0.02, -s * 0.2, s * 0.17, s * 0.08, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ลายกางเกงช้าง: สีพื้น + ช้างสลับประจำยาม (ออกแบบใหม่ทั้งหมด)
export function elephantTexture(bg) {
  return cached('ele' + bg, () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const fg = shade(bg, 0.32);
    const gold = '#f2c14e';
    drawElephant(g, 64, 70, 90, fg, false);
    drawElephant(g, 192, 198, 90, fg, true);
    drawPrajamyam(g, 192, 64, 54, gold, bg);
    drawPrajamyam(g, 64, 192, 54, gold, bg);
    // เส้นขอบเล็กๆ ให้ลายต่อเนื่อง
    g.strokeStyle = shade(bg, 0.18); g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }, [2, 2]));
}

// ----- วัสดุกระทง -----
export function bananaLeafTexture() {
  return cached('leaf', () => canvasTex(256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#5fae4a'); grd.addColorStop(1, '#2f7a2c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(220,255,200,.35)'; g.lineWidth = 2;
    for (let x = 4; x < w; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, h); g.stroke(); }
  }, [2, 1]));
}
export function bananaTrunkTexture() {
  return cached('trunk', () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#efe6c4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,170,110,.45)'; g.lineWidth = 1.5;
    for (let x = 2; x < w; x += 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(160,190,120,.35)';
    for (let i = 0; i < 60; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }, [2, 1]));
}
export function breadTexture() {
  return cached('bread', () => canvasTex(256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#e0a95a'); grd.addColorStop(1, '#a8652a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,235,190,.5)';
    for (let i = 0; i < 90; i++) {
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, Math.PI * 2); g.fill();
    }
  }, [2, 1]));
}

// ----- ฉาก -----
// ผ้าใบกันสาดร้านค้า: ลายทาง
export function stripeTexture(c1, c2) {
  return cached('stripe' + c1 + c2, () => canvasTex(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); }
  }));
}

// ป้ายข้อความ (ใช้ทั้งป้ายร้านและคำอธิษฐาน)
export function labelTexture(text, { bg = 'rgba(255,246,228,0.92)', fg = '#a31f24', border = '#e8b23a', font = 'bold 44px sans-serif', w = 512, h = 128 } = {}) {
  return canvasTex(w, h, (g) => {
    g.font = font;
    const r = 28;
    g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = 8;
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, r);
    g.fill(); g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    // ย่อตัวอักษรถ้าข้อความยาวเกิน
    let size = parseInt(font.match(/(\d+)px/)[1], 10);
    while (g.measureText(text).width > w - 50 && size > 18) {
      size -= 2; g.font = font.replace(/\d+px/, size + 'px');
    }
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// จุดแสงฟุ้ง (ใช้กับเปลวเทียน โคมไฟ พระจันทร์)
export function glowTexture() {
  return cached('glow', () => canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }));
}

// พื้นหลังท้องฟ้ากลางคืนแบบไล่สี
export function skyTexture() {
  return cached('sky', () => canvasTex(16, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#050a24');
    grd.addColorStop(0.55, '#16245a');
    grd.addColorStop(1, '#3a3a78');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }));
}

// พื้นทางเดินลายอิฐ
export function pavingTexture() {
  return cached('pave', () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8a48a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8e7b64'; g.lineWidth = 3;
    for (let y = 0; y <= h; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      const off = (y / 32) % 2 ? 32 : 0;
      for (let x = off; x <= w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
    }
  }, [26, 19]));
}

// =====================================================================
// ลวดลายรอบ 2: ตัวละครน่ารักขึ้น (ผม หน้า เสื้อ TU กระโปรง กางเกง) + กระทงแบบใหม่
// =====================================================================

// จุดผ้าละเอียด (ทำให้ผิวเสื้อไม่เรียบเกินไป)
function fabricNoise(g, w, h, alpha = 0.06) {
  for (let i = 0; i < w * h * 0.02; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
}

// ----- ผม: เส้นผมแนวตั้ง + วงแสงสะท้อน (angel ring) แบบการ์ตูน -----
export function hairTexture(color) {
  return cached('hair' + color, () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const dark = shade(color, -0.1), light = shade(color, 0.12);
    for (let x = 0; x < w; x += 3) {
      g.strokeStyle = Math.random() < 0.5 ? dark : light;
      g.globalAlpha = 0.35 + Math.random() * 0.4;
      g.lineWidth = 1 + Math.random() * 1.6;
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + 4, h * 0.3, x - 4, h * 0.6, x + 2, h);
      g.stroke();
    }
    g.globalAlpha = 1;
    // วงแสงสะท้อนรอบหัว
    const ring = g.createLinearGradient(0, h * 0.22, 0, h * 0.4);
    ring.addColorStop(0, 'rgba(255,255,255,0)');
    ring.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    ring.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ring;
    for (let x = 0; x < w; x += 16) g.fillRect(x, h * 0.22 + Math.sin(x) * 4, 11, h * 0.18);
    // ปลายผมเข้มขึ้นเล็กน้อย
    const tip = g.createLinearGradient(0, h * 0.7, 0, h);
    tip.addColorStop(0, 'rgba(0,0,0,0)'); tip.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = tip; g.fillRect(0, h * 0.7, w, h * 0.3);
  }, [3, 1]));
}

// ----- หน้า: ตาโตมีประกาย แก้มชมพู (วาดลง canvas แล้วแปะบนหัว) -----
// style: 'smile' ตาโตยิ้ม | 'happy' ตาปิดยิ้มกว้าง ^^ | 'wink' ขยิบตา   blink = true คือตอนกะพริบตา
export function faceTexture(style, blink = false) {
  return cached('face' + style + blink, () => canvasTex(512, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const ink = '#3a2216';
    const eyeY = h * 0.56;
    const drawOpenEye = (cx) => {
      // ตาขาว/ขอบ
      g.fillStyle = ink;
      g.beginPath(); g.ellipse(cx, eyeY, 30, 41, 0, 0, Math.PI * 2); g.fill();
      // ม่านตาไล่สี
      const iris = g.createLinearGradient(0, eyeY - 30, 0, eyeY + 34);
      iris.addColorStop(0, '#3b1f12'); iris.addColorStop(0.6, '#7a4a2a'); iris.addColorStop(1, '#c58a4a');
      g.fillStyle = iris;
      g.beginPath(); g.ellipse(cx, eyeY + 3, 25, 35, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1f0f08';
      g.beginPath(); g.ellipse(cx, eyeY + 4, 10, 14, 0, 0, Math.PI * 2); g.fill();
      // ประกายในตา 2 จุด
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(cx - 8, eyeY - 12, 9, 11, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + 9, eyeY + 14, 4.5, 0, Math.PI * 2); g.fill();
      // ขนตาบน
      g.strokeStyle = ink; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.ellipse(cx, eyeY + 2, 34, 43, 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    };
    const drawClosedEye = (cx) => {
      g.strokeStyle = ink; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, eyeY + 12, 24, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    };
    const drawBlinkEye = (cx) => {
      g.strokeStyle = ink; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, eyeY - 16, 26, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    };
    const L = w * 0.36, R = w * 0.64;
    if (blink) { drawBlinkEye(L); drawBlinkEye(R); }
    else if (style === 'happy') { drawClosedEye(L); drawClosedEye(R); }
    else if (style === 'wink') { drawOpenEye(L); drawClosedEye(R); }
    else { drawOpenEye(L); drawOpenEye(R); }

    // คิ้ว
    g.strokeStyle = '#5a3825'; g.lineWidth = 5; g.lineCap = 'round';
    for (const cx of [L, R]) { g.beginPath(); g.arc(cx, eyeY - 30, 30, Math.PI * 1.3, Math.PI * 1.7); g.stroke(); }

    // แก้มชมพู + ขีดเขินเล็กๆ
    for (const cx of [w * 0.25, w * 0.75]) {
      const blush = g.createRadialGradient(cx, h * 0.73, 2, cx, h * 0.73, 34);
      blush.addColorStop(0, 'rgba(255,120,140,0.75)'); blush.addColorStop(1, 'rgba(255,120,140,0)');
      g.fillStyle = blush; g.beginPath(); g.ellipse(cx, h * 0.73, 36, 24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(230,80,100,0.6)'; g.lineWidth = 3;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * 10 - 3, h * 0.75); g.lineTo(cx + i * 10 + 3, h * 0.71); g.stroke(); }
    }

    // ปาก
    g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round';
    const my = h * 0.79;
    if (style === 'happy') {
      g.fillStyle = '#a8323e';
      g.beginPath(); g.arc(w / 2, my - 4, 15, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff8a9a'; g.beginPath(); g.arc(w / 2, my + 6, 7, 0, Math.PI); g.fill();
    } else if (style === 'wink') {
      g.beginPath(); g.arc(w / 2 - 8, my - 4, 8, 0, Math.PI); g.stroke();
      g.beginPath(); g.arc(w / 2 + 8, my - 4, 8, 0, Math.PI); g.stroke();
    } else {
      g.beginPath(); g.arc(w / 2, my - 8, 10, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }
  }));
}

// ----- สีชุด มธ. (ออกแบบใหม่ทั้งหมด ไม่มีตราสัญลักษณ์) -----
export const COLORWAYS = {
  red:   { base: '#a31f24', accent: '#e8b23a', text: '#f6d36b', trim: '#f3e6c8' },
  cream: { base: '#f3e6c8', accent: '#b3262b', text: '#a31f24', trim: '#a31f24' },
  gold:  { base: '#e8b23a', accent: '#a31f24', text: '#7a1416', trim: '#7a1416' },
  navy:  { base: '#1f2f5a', accent: '#e8b23a', text: '#f6d36b', trim: '#e8b23a' },
  white: { base: '#fbfbf7', accent: '#a31f24', text: '#a31f24', trim: '#a31f24' },
};

// เขียนตัวอักษร TU แบบมีขอบ
function drawTU(g, x, y, size, fill, stroke) {
  g.save();
  g.font = `italic 900 ${size}px "Arial Black", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * 0.14; g.strokeStyle = stroke;
  g.strokeText('TU', x, y);
  g.fillStyle = fill; g.fillText('TU', x, y);
  g.restore();
}

// ลายเสื้อรอบตัว (ตรงกลาง canvas = ด้านหน้า, ขอบซ้าย/ขวา = ด้านหลัง)
export function topTexture(top, wayName) {
  const c = COLORWAYS[wayName] || COLORWAYS.red;
  return cached('top' + top + wayName, () => canvasTex(512, 256, (g, w, h) => {
    const cx = w / 2;
    const outline = c.base === '#f3e6c8' || c.base === '#fbfbf7' ? '#ffffff' : '#2b1d14';
    if (top === 'jersey') {
      // เสื้อบอลลายขวาง
      for (let y = 0; y < h; y += 28) {
        g.fillStyle = (y / 28) % 2 ? c.accent : c.base;
        g.fillRect(0, y, w, 28);
      }
      g.fillStyle = '#ffffff'; g.fillRect(cx + 40, h * 0.3, 60, 48);
      drawTU(g, cx + 70, h * 0.3 + 24, 34, c.base, '#ffffff');
      // เบอร์ด้านหลัง (แบ่งครึ่งที่ขอบสองข้าง)
      g.font = '900 90px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.fillStyle = '#1a1a1a';
      for (const bx of [0, w]) { g.strokeText('12', bx, h * 0.48); g.fillText('12', bx, h * 0.48); }
    } else {
      g.fillStyle = top === 'student' ? '#fbfbf7' : c.base;
      g.fillRect(0, 0, w, h);
    }

    if (top === 'polo') {
      // สาบกระดุมด้านหน้า + กระดุม 3 เม็ด
      g.fillStyle = shade(c.base, -0.06); g.fillRect(cx - 14, 0, 28, h * 0.38);
      g.strokeStyle = c.trim; g.lineWidth = 3; g.strokeRect(cx - 14, -2, 28, h * 0.38);
      g.fillStyle = c.trim;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, 20 + i * 26, 5, 0, Math.PI * 2); g.fill(); }
      // คลื่นช่วงล่าง
      g.strokeStyle = c.accent; g.lineWidth = 8;
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y = h * 0.78 + k * 20 + Math.sin(x / 30) * 7;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      drawTU(g, cx + 70, h * 0.36, 40, c.text, outline);
    } else if (top === 'cheer') {
      // เสื้อเชียร์: แถบเฉียงจากไหล่ + แถบทองช่วงล่าง + TU ตัวใหญ่
      g.fillStyle = c.accent;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * 60, 0); g.lineTo(cx + s * 150, 0); g.lineTo(cx + s * 230, h * 0.62); g.lineTo(cx + s * 190, h * 0.62);
        g.closePath(); g.fill();
      }
      g.fillStyle = c.trim; g.fillRect(0, h * 0.84, w, 14);
      g.fillStyle = c.accent; g.fillRect(0, h * 0.84 + 14, w, 10);
      drawTU(g, cx, h * 0.46, 92, c.text, outline);
      // ดาวเล็กๆ
      g.fillStyle = c.accent;
      for (const [x, y] of [[cx - 70, h * 0.2], [cx + 74, h * 0.68], [cx - 60, h * 0.7]]) {
        g.save(); g.translate(x, y); g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 10; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); g.restore();
      }
    } else if (top === 'hoodie') {
      // ฮู้ด: กระเป๋าหน้าท้อง + TU ตัวใหญ่ + ขอบยางล่าง
      g.fillStyle = shade(c.base, -0.07);
      g.beginPath(); g.roundRect(cx - 70, h * 0.62, 140, h * 0.3, 18); g.fill();
      g.strokeStyle = shade(c.base, -0.15); g.lineWidth = 3; g.stroke();
      drawTU(g, cx, h * 0.38, 84, c.text, outline);
      g.fillStyle = shade(c.base, -0.1); g.fillRect(0, h * 0.92, w, h * 0.08);
      for (let x = 0; x < w; x += 6) { g.fillStyle = shade(c.base, -0.16); g.fillRect(x, h * 0.92, 2, h * 0.08); }
    } else if (top === 'student') {
      // เสื้อนักศึกษาสีขาว: สาบกระดุม + กระเป๋าอก (ไม่มีตราใดๆ)
      g.strokeStyle = '#d9d9d2'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 9, 0); g.lineTo(cx - 9, h); g.moveTo(cx + 9, 0); g.lineTo(cx + 9, h); g.stroke();
      g.fillStyle = '#e7e3d8';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx, 22 + i * 46, 5, 0, Math.PI * 2); g.fill(); }
      g.strokeRect(cx + 40, h * 0.26, 46, 44);
    }
    fabricNoise(g, w, h);
  }));
}

// แขนเสื้อ: สีพื้น + ขอบปลายแขน
export function sleeveTexture(top, wayName) {
  const c = COLORWAYS[wayName] || COLORWAYS.red;
  return cached('slv' + top + wayName, () => canvasTex(128, 128, (g, w, h) => {
    const base = top === 'student' ? '#fbfbf7' : top === 'cheer' ? c.accent : c.base;
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (top === 'jersey') { g.fillStyle = c.accent; g.fillRect(0, h * 0.35, w, h * 0.3); }
    g.fillStyle = top === 'student' ? '#e7e3d8' : c.trim; g.fillRect(0, h - 14, w, 14); // ปลายแขน (ด้านล่างของ texture)
    fabricNoise(g, w, h);
  }));
}

// ผ้าเรียบ (โทนกลาง ใช้คูณกับสีที่เลือก)
export function fabricTexture() {
  return cached('fabric', () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    fabricNoise(g, w, h, 0.08);
  }, [3, 2]));
}

// ยีนส์: ลายทแยง (twill) + ตะเข็บสีทอง
export function denimTexture() {
  return cached('denim', () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1.5;
    for (let i = -h; i < w; i += 4) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = -h + 2; i < w; i += 9) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
    // ตะเข็บด้านข้าง
    g.setLineDash([6, 4]); g.strokeStyle = '#e0a040'; g.lineWidth = 2;
    for (const x of [w * 0.25, w * 0.75]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [2, 2]));
}

// จ็อกเกอร์: แถบข้างสีขาว 2 เส้น
export function joggerTexture(color) {
  return cached('jog' + color, () => canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    fabricNoise(g, w, h, 0.07);
    g.fillStyle = '#ffffff';
    for (const x of [w * 0.25, w * 0.75]) { g.fillRect(x - 6, 0, 4, h); g.fillRect(x + 2, 0, 4, h); }
  }));
}

// กระโปรงลายสก๊อต (ใช้สีที่เลือกเป็นพื้น ตัดด้วยแดง/ทอง/ขาว)
export function plaidTexture(color) {
  return cached('plaid' + color, () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const lines = [[0, 28, shade(color, -0.12), 0.9], [44, 6, '#e8b23a', 0.9], [70, 3, '#ffffff', 0.8], [96, 14, '#a31f24', 0.7]];
    for (const [p, t, col, a] of lines) {
      g.globalAlpha = a * 0.6; g.fillStyle = col;
      g.fillRect(p, 0, t, h); g.fillRect(0, p, w, t);
    }
    g.globalAlpha = 1;
    fabricNoise(g, w, h, 0.05);
  }, [3, 1]));
}

// ----- กระทง -----
// หน้าตัดหยวกกล้วย: วงซ้อนสีครีม-เขียว
export function trunkTopTexture() {
  return cached('trunkTop', () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3ecd0'; g.fillRect(0, 0, w, h);
    for (let r = w / 2; r > 6; r -= 9) {
      g.strokeStyle = r % 2 ? 'rgba(140,170,90,0.55)' : 'rgba(200,215,160,0.7)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = 'rgba(150,180,100,0.35)';
    for (let i = 0; i < 160; i++) { const a = Math.random() * 6.28, r = Math.random() * w / 2; g.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2, 2); }
  }));
}

// ใบตองพับ (เข้ม/อ่อน)
export function leafFoldTexture(light) {
  return cached('leafFold' + light, () => canvasTex(128, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, light ? '#7cc25a' : '#3f8f3a');
    grd.addColorStop(1, light ? '#b4e08a' : '#5fae4a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,220,0.4)'; g.lineWidth = 1.5;
    for (let y = 6; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y - 10); g.stroke(); }
    g.strokeStyle = 'rgba(30,80,30,0.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  }));
}

// กระดองเต่าขนมปัง: สีอบเหลืองทอง + รอยกรีดตาราง + งาขาว
export function breadShellTexture() {
  return cached('breadShell', () => canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#8a4a1c'); grd.addColorStop(0.5, '#c07a35'); grd.addColorStop(1, '#e8b56a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // รอยกรีดเป็นช่องหกเหลี่ยม (แบบลายกระดองเต่า)
    g.strokeStyle = 'rgba(250,215,150,0.85)'; g.lineWidth = 5;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 9; col++) {
        const x = col * 58 + (row % 2) * 29, y = 18 + row * 52, r = 24;
        g.beginPath();
        for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); }
        g.stroke();
      }
    }
    // งา
    g.fillStyle = '#fff6dc';
    for (let i = 0; i < 140; i++) {
      g.save(); g.translate(Math.random() * w, Math.random() * h * 0.85); g.rotate(Math.random() * 3);
      g.beginPath(); g.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }));
}

// ใบบัว: เขียวมีเส้นใบรัศมี
export function lilyPadTexture() {
  return cached('lily', () => canvasTex(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#7fbf5a'); grd.addColorStop(1, '#2f7a3a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(210,240,170,0.6)'; g.lineWidth = 2.5;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2); g.stroke();
    }
  }));
}
