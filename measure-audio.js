// measure-audio.js — prints frame counts for all MP3 files in public/audio
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const audioDir   = path.join(__dirname, 'public', 'audio');
const FPS        = 30;

const files = fs.readdirSync(audioDir)
  .filter(f => f.endsWith('.mp3'))
  .sort();

console.log('File          | Frames | Seconds');
console.log('--------------|--------|--------');

for (const file of files) {
  const filePath = path.join(audioDir, file);
  try {
    let output = '';
    try {
      execSync(`"${ffmpegPath}" -i "${filePath}"`, { stdio: ['pipe','pipe','pipe'] });
    } catch (e) {
      output = (e.stderr || '').toString();
    }
    const m = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) {
      const secs   = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
      const frames = Math.round(secs * FPS);
      const name   = file.replace('.mp3', '').padEnd(14);
      console.log(`${name}| ${String(frames).padEnd(7)}| ${secs.toFixed(3)}`);
    } else {
      console.log(`${file}: could not parse duration`);
    }
  } catch (e) {
    console.log(`ERROR: ${file} — ${e.message}`);
  }
}
