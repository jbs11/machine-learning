const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const audioDir = path.join("c:/Users/Stephen/OneDrive/Desktop/Cursor Projects/Machine Learning", "public", "audio");
const wavFiles = fs.readdirSync(audioDir).filter(f => f.startsWith("tour-") && f.endsWith(".wav"));

console.log(`Converting ${wavFiles.length} tour WAV files to MP3...`);

let done = 0;
wavFiles.forEach(file => {
  const input = path.join(audioDir, file);
  const output = path.join(audioDir, file.replace(".wav", ".mp3"));
  ffmpeg(input)
    .audioCodec("libmp3lame")
    .audioBitrate(128)
    .on("end", () => {
      console.log(`  OK ${file} -> ${path.basename(output)}`);
      done++;
      if (done === wavFiles.length) console.log("Done! All tour files converted.");
    })
    .on("error", err => {
      console.error(`  FAIL ${file}: ${err.message}`);
      done++;
    })
    .save(output);
});
