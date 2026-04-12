const { copyFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const SHARED_FILES = [
  'config.js',
  'api.js',
  'easter_eggs.js',
  'tips.js',
  'ws.js',
  'confetti.js',
  'leaderboard.js',
];

const SRC = join(__dirname, '../js');
const DEST = join(__dirname, '../extensions/panel/js');

mkdirSync(DEST, { recursive: true });

for (const file of SHARED_FILES) {
  copyFileSync(join(SRC, file), join(DEST, file));
  console.log(`Copied: ${file}`);
}

console.log(`\nDone! ${SHARED_FILES.length} files copied to extensions/panel/js/`);
