import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BANNER_GIF_EXPORT_WIDTH,
  BANNER_LOOP_FPS,
  BANNER_LOOP_FRAME_COUNT,
  DEFAULT_BOTTOM_LINE_OFFSET_X,
  VAG_ROUNDED_FONT_SOURCES,
  createBannerSvg,
} from './banner-art.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '../..');
const publicRoot = path.join(appRoot, 'public');
const FFMPEG_CANDIDATE_PATHS = [
  process.env.FFMPEG_PATH,
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean);

function getEmbeddedFontFormat(fontPath) {
  return fontPath.endsWith('.otf') ? 'opentype' : 'truetype';
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} terminó con código ${code ?? 'desconocido'}.`));
    });
  });
}

function resolveFfmpegCommand() {
  for (const candidate of FFMPEG_CANDIDATE_PATHS) {
    if (candidate === 'ffmpeg' || existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'FFmpeg no está disponible. Instálalo en la imagen del web service o define FFMPEG_PATH con la ruta completa al binario.'
  );
}

async function getEmbeddedFontCss() {
  const fontFaces = await Promise.all(
    VAG_ROUNDED_FONT_SOURCES.map(async font => {
      const absolutePath = path.join(publicRoot, font.path.replace(/^\//, ''));
      const fontBase64 = (await readFile(absolutePath)).toString('base64');

      return `
        @font-face {
          font-family: 'VAG Rounded';
          src: url('data:font/ttf;base64,${fontBase64}') format('${getEmbeddedFontFormat(font.path)}');
          font-style: normal;
          font-weight: ${font.weight};
        }
      `;
    })
  );

  return fontFaces.join('\n');
}

export function normalizeBottomLineOffsetX(value) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_BOTTOM_LINE_OFFSET_X;
  }

  return Math.min(500, Math.max(410, Math.round(numericValue)));
}

export async function generateBannerGifBuffer(options = {}) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'memoo-banner-gif-'));
  const outputPath = path.join(tempDir, 'memoo-banner.gif');

  try {
    const ffmpegCommand = resolveFfmpegCommand();
    const embeddedFontCss = await getEmbeddedFontCss();
    const bottomLineOffsetX = normalizeBottomLineOffsetX(options.bottomLineOffsetX);

    for (let frame = 0; frame < BANNER_LOOP_FRAME_COUNT; frame += 1) {
      const phase = frame / BANNER_LOOP_FRAME_COUNT;
      const svgMarkup = createBannerSvg(embeddedFontCss, { bottomLineOffsetX, phase });
      await writeFile(path.join(tempDir, `frame-${String(frame).padStart(3, '0')}.svg`), svgMarkup, 'utf8');
    }

    await run(ffmpegCommand, [
      '-y',
      '-framerate',
      String(BANNER_LOOP_FPS),
      '-i',
      path.join(tempDir, 'frame-%03d.svg'),
      '-filter_complex',
      [
        `[0:v]fps=${BANNER_LOOP_FPS},scale=${BANNER_GIF_EXPORT_WIDTH}:-1:flags=lanczos,split[s0][s1]`,
        '[s0]palettegen=stats_mode=full[p]',
        '[s1][p]paletteuse=dither=bayer:bayer_scale=3',
      ].join(';'),
      '-loop',
      '0',
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
