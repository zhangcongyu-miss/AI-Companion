/**
 * 生成 PWA 所需的 PNG 图标
 * 使用: node scripts/generate-icons.cjs
 */
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '../public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

fs.mkdirSync(ICONS_DIR, { recursive: true });

async function createIcon(size, outPath) {
  // 渐变紫粉背景 + 心形文字 "心语"
  const img = new Jimp({ width: size, height: size, color: 0x7c3aedff }); // 紫色底

  // 画一个圆角矩形效果（填充内圆）
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  img.scan(0, 0, size, size, function (x, y, idx) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < r) {
      // 内圆区域：粉紫渐变
      const t = dist / r;
      const rC = Math.round(124 + t * 60);   // 124→184
      const gC = Math.round(58 + t * 20);    // 58→78
      const bC = Math.round(237 - t * 50);   // 237→187
      this.bitmap.data[idx + 0] = rC;
      this.bitmap.data[idx + 1] = gC;
      this.bitmap.data[idx + 2] = bC;
      this.bitmap.data[idx + 3] = 255;
    } else {
      // 外圈：深紫
      this.bitmap.data[idx + 0] = 60;
      this.bitmap.data[idx + 1] = 20;
      this.bitmap.data[idx + 2] = 100;
      this.bitmap.data[idx + 3] = 255;
    }
  });

  // 在中心画一个简单的心形（像素绘制）
  const heartSize = size * 0.35;
  const hx = cx;
  const hy = cy + size * 0.03;

  img.scan(0, 0, size, size, function (x, y, idx) {
    const nx = (x - hx) / (heartSize / 2);
    const ny = (y - hy) / (heartSize / 2);
    // 心形方程: (x²+y²-1)³ - x²y³ < 0
    const val =
      Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
    if (val < 0) {
      this.bitmap.data[idx + 0] = 255;
      this.bitmap.data[idx + 1] = 255;
      this.bitmap.data[idx + 2] = 255;
      this.bitmap.data[idx + 3] = 230;
    }
  });

  await img.write(outPath);
  console.log(`✅ 生成: ${outPath} (${size}x${size})`);
}

(async () => {
  await createIcon(192, path.join(ICONS_DIR, 'icon-192.png'));
  await createIcon(512, path.join(ICONS_DIR, 'icon-512.png'));
  await createIcon(180, path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  await createIcon(32,  path.join(PUBLIC_DIR, 'favicon.ico.png')); // 用作 favicon
  console.log('🎉 所有图标生成完毕！');
})();
