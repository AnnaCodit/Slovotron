const { copyFileSync, cpSync, mkdirSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const PANEL = join(ROOT, 'extensions/panel');

// Отдельные JS файлы
const SHARED_JS = [
  'config.js',
  'api.js',
  'easter_eggs.js',
  'tips.js',
  'ws.js',
  'confetti.js',
  'leaderboard.js',
];

// Отдельные CSS файлы (для live_config.html)
const SHARED_CSS = [
  'reset.css',
  'style.css',
  'leaderboard.css',
  'tips.css',
];

function copyFiles(srcDir, destDir, files) {
  mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    copyFileSync(join(srcDir, file), join(destDir, file));
    console.log(`  Copied: ${file}`);
  }
}

function copyDir(src, dest) {
  cpSync(src, dest, { recursive: true, force: true });
}

console.log('JS:');
copyFiles(join(ROOT, 'js'), join(PANEL, 'js'), SHARED_JS);

console.log('\nCSS:');
copyFiles(join(ROOT, 'css'), join(PANEL, 'css'), SHARED_CSS);

console.log('\nimg/:');
copyDir(join(ROOT, 'img'), join(PANEL, 'img'));
console.log('  Copied: img/');

console.log('\naudio/:');
copyDir(join(ROOT, 'audio'), join(PANEL, 'audio'));
console.log('  Copied: audio/');

console.log('\nDone!');
