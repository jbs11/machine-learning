// measure-live.js — measure live audio clip durations
const { spawnSync } = require('child_process');
const path = require('path');
const fp = require('@ffmpeg-installer/ffmpeg').path.replace('ffmpeg.exe', 'ffprobe.exe');

for (let i = 1; i <= 12; i++) {
  const id = String(i).padStart(2, '0');
  const f = path.resolve(__dirname, 'public', 'audio', 'live-' + id + '.mp3');
  const r = spawnSync(fp, ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', f], { encoding: 'utf8' });
  const s = parseFloat((r.stdout || '').trim());
  const frames = Math.ceil(s * 30);
  console.log('live-' + id + ': ' + s.toFixed(3) + 's = ' + frames + ' frames');
}
