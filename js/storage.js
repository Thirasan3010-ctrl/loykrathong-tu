// ===== storage.js: บันทึกข้อมูลผู้เล่นใน localStorage (เก็บในเครื่องของผู้เล่นเท่านั้น) =====
const KEY = 'loykrathong_save_v1';
const MAX_RELEASED = 5; // เก็บกระทงที่ลอยแล้วล่าสุดไม่เกิน 5 อัน

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // บางเบราว์เซอร์ (โหมดไม่ระบุตัวตน) อาจใช้ localStorage ไม่ได้
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* ใช้ไม่ได้ก็เล่นต่อได้ตามปกติ แค่ไม่ถูกบันทึก */ }
}

export function addReleased(save, krathong) {
  save.released = [...(save.released || []), { ...krathong, time: Date.now() }].slice(-MAX_RELEASED);
  writeSave(save);
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ไม่เป็นไร */ }
}
