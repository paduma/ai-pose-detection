/**
 * 下载 MediaPipe 模型文件到本地 public/models/ 目录
 * 
 * 使用方法：
 *   翻墙后运行: node scripts/download-models.js
 *   或手动下载以下文件到 public/models/:
 *   - https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

const files = [
  {
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    filename: 'pose_landmarker_lite.task',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    console.log(`  -> ${dest}`);

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      const total = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n  Done!');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  // Create models directory
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    console.log(`Created: ${MODELS_DIR}\n`);
  }

  for (const file of files) {
    const dest = path.join(MODELS_DIR, file.filename);

    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      console.log(`Skip (exists): ${file.filename} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      continue;
    }

    try {
      await download(file.url, dest);
    } catch (err) {
      console.error(`\nFailed to download ${file.filename}:`, err.message);
      console.log('Please download manually and place in public/models/');
    }
  }

  console.log('\nAll done! Models are in public/models/');
}

main();
