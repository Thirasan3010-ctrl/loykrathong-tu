// ===== loader.js: เตรียมไว้สำหรับเฟสถัดไป — โหลดโมเดล .glb มาแทนโมเดล Procedural =====
// วิธีใช้ในอนาคต:
//   const model = await loadModel('assets/models/krathong.glb');
//   if (model) scene.add(model); // ถ้าโหลดไม่สำเร็จ ให้ใช้โมเดล Procedural เดิมต่อ
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export async function loadModel(url) {
  try {
    if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
    const gltf = await cache.get(url);
    return gltf.scene.clone(true);
  } catch (err) {
    console.warn('โหลดโมเดลไม่สำเร็จ ใช้โมเดล Procedural แทน:', url, err);
    return null;
  }
}
