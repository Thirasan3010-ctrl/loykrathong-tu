// ===== audio.js: เพลงประกอบ (เล่นวน) + ปุ่มเปิด/ปิด + สลับเพลง =====
export const TRACKS = [
  // เพลงแรกในรายการ = เพลงที่เล่นตอนเริ่มเกม
  { name: 'งานวัดคึกคัก', src: 'assets/audio/02_loy_krathong_festival_fun.mp3' },
  { name: 'สายน้ำยามค่ำ (ผ่อนคลาย)', src: 'assets/audio/01_loy_krathong_calm_river.mp3' },
];

export class Music {
  constructor() {
    this.index = 0;
    this.muted = false;
    this.el = new Audio();
    this.el.loop = true;
    this.el.volume = 0.5;
    this.el.preload = 'auto';
    this.playing = false;
    this.load(0);
  }

  // เบราว์เซอร์มือถืออนุญาตให้เล่นเสียงได้หลังผู้ใช้แตะหน้าจอเท่านั้น จึงเรียกตอนกดปุ่มเริ่ม
  start() {
    this.playing = true;
    if (this.muted) return;
    this.el.play().catch(() => { /* ถ้าถูกบล็อก จะเล่นเมื่อแตะครั้งถัดไป */ });
  }

  toggle() {
    this.muted = !this.muted;
    if (this.muted) this.el.pause(); else this.start();
    return this.muted;
  }

  next() {
    this.index = (this.index + 1) % TRACKS.length;
    this.load(this.index);
    this.start();
    return TRACKS[this.index].name;
  }

  // บางโฮสต์ (เช่นหน้า artifact) อนุญาตเสียงแบบ blob: เท่านั้น จึงโหลดไฟล์เป็น blob ก่อน
  async load(i) {
    const t = TRACKS[i];
    try {
      if (!t.blob) {
        const res = await fetch(t.src);
        t.blob = URL.createObjectURL(await res.blob());
      }
      this.el.src = t.blob;
    } catch {
      this.el.src = t.src;
    }
    if (!this.muted && this.playing) this.el.play().catch(() => {});
  }
}
