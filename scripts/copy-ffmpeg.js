const fs = require('fs');
const path = require('path');

// 创建目标目录
const targetDir = path.join(__dirname, '..', 'public', 'ffmpeg');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 源文件路径
const sourceDir = path.join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');

// 复制文件
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

files.forEach(file => {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);
  
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log(`✓ 已复制: ${file}`);
  } else {
    console.error(`✗ 文件不存在: ${file}`);
  }
});

console.log('\nFFmpeg 核心文件复制完成！');
