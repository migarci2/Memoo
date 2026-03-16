import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BANNER_GIF_OUTPUT_PATH, DEFAULT_BOTTOM_LINE_OFFSET_X } from '../src/lib/banner-art.js';
import { generateBannerGifBuffer } from '../src/lib/banner-gif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outputPath = path.join(appRoot, 'public', BANNER_GIF_OUTPUT_PATH.replace(/^\//, ''));

async function main() {
  const gifBuffer = await generateBannerGifBuffer({ bottomLineOffsetX: DEFAULT_BOTTOM_LINE_OFFSET_X });
  await writeFile(outputPath, gifBuffer);
  console.log(`GIF generado en ${outputPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
