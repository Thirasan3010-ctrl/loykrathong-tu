// ===== controls.js: รวมการควบคุม 3 แบบ คีย์บอร์ด / จอยสติ๊ก (Gamepad API) / จอยบนจอมือถือ =====

const DEADZONE = 0.22; // ค่าสติ๊กที่น้อยกว่านี้ถือว่าไม่ได้โยก (กันตัวละครไหลเอง)

export class Input {
  constructor() {
    this.keys = new Set();
    this.touchVec = { x: 0, y: 0 };
    this.prevButtons = [];
    this.usingGamepad = false;
    this.navCooldown = 0;
    this.listeners = {}; // 'confirm' | 'back' | 'menu' | 'nav'

    window.addEventListener('keydown', (e) => {
      // ไม่ดักปุ่มตอนกำลังพิมพ์คำอธิษฐาน
      if (e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') this.emit('confirm', 'key');
        if (e.key === 'Escape') this.emit('back', 'key');
        return;
      }
      this.usingGamepad = false;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this.emit('confirm', 'key');
      if (e.code === 'Escape') this.emit('menu', 'key');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', () => { this.usingGamepad = true; });
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, src) { for (const fn of this.listeners[name] || []) fn(src); }

  // ----- จอยบนจอ (Virtual Joystick) -----
  attachJoystick(el) {
    const knob = el.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const max = 50;
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchVec = { x: dx / max, y: dy / max };
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      this.touchVec = { x: 0, y: 0 };
    };
    el.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      id = e.pointerId;
      el.setPointerCapture(id);
      move(e);
    });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ----- อ่านจอยสติ๊กทุกเฟรม และตรวจการกดปุ่ม (กดครั้งเดียวนับครั้งเดียว) -----
  pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    this.pad = gp || null;
    if (!gp) return;
    const pressed = (i) => !!gp.buttons[i]?.pressed;
    const edge = (i) => pressed(i) && !this.prevButtons[i];
    if (gp.buttons.some((b) => b.pressed) || Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.5) this.usingGamepad = true;

    if (edge(0)) this.emit('confirm', 'pad'); // A / กากบาท
    if (edge(1)) this.emit('back', 'pad');    // B / วงกลม
    if (edge(9)) this.emit('menu', 'pad');    // Start / Options

    // เลื่อนโฟกัสในเมนูด้วย D-pad หรือสติ๊ก
    this.navCooldown -= dt;
    let nav = 0;
    if (edge(12) || edge(14)) nav = -1; // ขึ้น / ซ้าย
    if (edge(13) || edge(15)) nav = 1;  // ลง / ขวา
    const ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
    if (!nav && this.navCooldown <= 0 && Math.max(Math.abs(ax), Math.abs(ay)) > 0.6) {
      nav = (Math.abs(ay) > Math.abs(ax) ? ay : ax) > 0 ? 1 : -1;
      this.navCooldown = 0.25;
    }
    if (Math.max(Math.abs(ax), Math.abs(ay)) < 0.3) this.navCooldown = 0;
    if (nav) this.emit('nav', nav);

    this.prevButtons = gp.buttons.map((b) => b.pressed);
  }

  // ทิศทางการเดินรวมจากทุกอุปกรณ์ (x = ซ้าย/ขวา, y = บน/ล่างของจอ)
  getMove() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    x += this.touchVec.x; y += this.touchVec.y;
    if (this.pad) {
      const ax = this.pad.axes[0] || 0, ay = this.pad.axes[1] || 0;
      if (Math.hypot(ax, ay) > DEADZONE) { x += ax; y += ay; }
      // D-pad ก็เดินได้
      if (this.pad.buttons[14]?.pressed) x -= 1;
      if (this.pad.buttons[15]?.pressed) x += 1;
      if (this.pad.buttons[12]?.pressed) y -= 1;
      if (this.pad.buttons[13]?.pressed) y += 1;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }
}

// อุปกรณ์จอสัมผัสหรือไม่ (ใช้ตัดสินใจโชว์จอยบนจอ)
export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
