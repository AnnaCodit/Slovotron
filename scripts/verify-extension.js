const { existsSync, readFileSync } = require('fs');
const { join, dirname } = require('path');

const PANEL_DIR = join(__dirname, '../extensions/panel');
const HTML_FILES = ['live_config.html', 'panel.html', 'config.html'];

let allOk = true;

for (const htmlFile of HTML_FILES) {
  const htmlPath = join(PANEL_DIR, htmlFile);
  if (!existsSync(htmlPath)) {
    console.error(`MISSING HTML: ${htmlFile}`);
    allOk = false;
    continue;
  }

  const content = readFileSync(htmlPath, 'utf8');
  const srcMatches = [...content.matchAll(/src="([^"]+)"/g)];
  const localScripts = srcMatches
    .map(m => m[1])
    .filter(src => !src.startsWith('http'));

  console.log(`\n${htmlFile}:`);
  for (const src of localScripts) {
    const fullPath = join(PANEL_DIR, src);
    const exists = existsSync(fullPath);
    console.log(`  ${exists ? 'OK' : 'MISSING'} ${src}`);
    if (!exists) allOk = false;
  }
}

console.log(allOk ? '\nAll files present.' : '\nSome files are missing!');
process.exit(allOk ? 0 : 1);
