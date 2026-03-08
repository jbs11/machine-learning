// calc-tour-durations.js
// Reads public/audio/tour-01.mp3 ... tour-24.mp3 and prints the frame
// count for each clip at 30fps.  Copy the printed values into the
// TOUR_CLIPS[] array in remotion/DashboardTour.jsx.
//
// Run:  node calc-tour-durations.js
//
// Method: Edge TTS FORMAT = AUDIO_24KHZ_96KBITRATE_MONO_MP3 (CBR 96 kbps)
// duration = fileBytes * 8 / 96000   (seconds)
// frames   = Math.ceil(duration * 30)
//
// For WAV files (public/audio/*.wav) the PowerShell script calc-durations.ps1
// gives exact sample-accurate results. This JS script gives a close estimate
// from file size that is accurate to ±1 frame for CBR MP3.

const fs   = require("fs");
const path = require("path");

const DIR     = path.join(__dirname, "public", "audio");
const BITRATE = 96000;  // bits per second — matches gen-tour-guy.js FORMAT
const FPS     = 30;
const TAIL    = 15;     // frames added between segments in DashboardTour.jsx

const files = fs.readdirSync(DIR)
  .filter(f => f.match(/^tour-\d+\.mp3$/))
  .sort();

if (files.length === 0) {
  console.error(`No tour-XX.mp3 files found in ${DIR}`);
  console.error("Run: node gen-tour-guy.js  first.");
  process.exit(1);
}

console.log(`Found ${files.length} tour MP3 files in ${DIR}\n`);
console.log("Paste this block into remotion/DashboardTour.jsx as TOUR_CLIPS[]:\n");
console.log("const TOUR_CLIPS = [");

let totalDuration = 0;
let start = 0;

files.forEach((file, idx) => {
  const fullPath = path.join(DIR, file);
  const bytes    = fs.statSync(fullPath).size;
  const sec      = bytes * 8 / BITRATE;
  const frames   = Math.ceil(sec * FPS);
  const id       = file.replace(".mp3", "").replace("tour-", "");

  const startPad = String(start).padStart(5, " ");
  console.log(`  { id:"${id}", start:${startPad}, dur:${frames} },  // ${sec.toFixed(1)}s`);

  totalDuration += frames + TAIL;
  start         += frames + TAIL;
});

console.log("];\n");

// The last segment's TAIL extends past the last audio clip — subtract it for
// the true composition length (the clip renders dur+TAIL frames but the
// composition stops after the last clip's dur+TAIL, so total = sum(dur+TAIL))
console.log(`export const TOUR_DURATION = ${totalDuration};`);
console.log(`\nTotal: ${files.length} clips, ~${(totalDuration / FPS / 60).toFixed(1)} minutes at 30fps`);
