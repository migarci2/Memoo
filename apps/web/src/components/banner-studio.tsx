'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowSquareOut, CopySimple, FileSvg, ImageSquare, Sparkle } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

import { getGeminiWordmarkSvg } from '@/components/gemini-logo';

const BANNER_WIDTH = 1600;
const BANNER_HEIGHT = 900;
const VAG_ROUNDED_FONT_SOURCES = [
  { path: '/fonts/vag-rounded/VAG Rounded Light (1)_0.ttf', weight: 400 },
  { path: '/fonts/vag-rounded/VAG Rounded Bold_0.ttf', weight: 700 },
  { path: '/fonts/vag-rounded/VAG Rounded Black_0.ttf', weight: 900 },
] as const;

let embeddedFontCssPromise: Promise<string> | null = null;

const PUBLIC_FONT_CSS = `
  @font-face {
    font-family: 'VAG Rounded';
    src: url('/fonts/vag-rounded/VAG Rounded Light (1)_0.ttf') format('truetype');
    font-style: normal;
    font-weight: 400;
  }

  @font-face {
    font-family: 'VAG Rounded';
    src: url('/fonts/vag-rounded/VAG Rounded Bold_0.ttf') format('truetype');
    font-style: normal;
    font-weight: 700;
  }

  @font-face {
    font-family: 'VAG Rounded';
    src: url('/fonts/vag-rounded/VAG Rounded Black_0.ttf') format('truetype');
    font-style: normal;
    font-weight: 900;
  }
`;

type BannerOptions = {
  bottomLineOffsetX: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function getEmbeddedFontCss() {
  if (!embeddedFontCssPromise) {
    embeddedFontCssPromise = Promise.all(
      VAG_ROUNDED_FONT_SOURCES.map(async font => {
        const response = await fetch(font.path);
        if (!response.ok) {
          throw new Error(`No se pudo cargar la fuente ${font.path}.`);
        }

        const fontDataUrl = `data:font/ttf;base64,${arrayBufferToBase64(await response.arrayBuffer())}`;
        return `
        @font-face {
          font-family: 'VAG Rounded';
          src: url('${fontDataUrl}') format('truetype');
          font-style: normal;
          font-weight: ${font.weight};
        }
      `;
      })
    ).then(fontFaces => fontFaces.join('\n'));
  }

  return embeddedFontCssPromise;
}

function createBannerSvg(fontCss: string, options: BannerOptions) {
  const font = "'VAG Rounded', sans-serif";
  // Brand colors (original, for mark only)
  const brandBlue = '#0f678f';
  const brandTeal = '#0f8f7e';
  const brandSand = '#d18434';
  const dark = '#1e3044';
  const muted = '#6b8295';
  const geminiLogo = getGeminiWordmarkSvg({ height: 46, color: 'white' });
  const { bottomLineOffsetX } = options;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" role="img" aria-labelledby="memoo-banner-title">
      <title id="memoo-banner-title">memoo — Record once, run anywhere.</title>
      <defs>
        <clipPath id="clip"><rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" /></clipPath>
      </defs>
      <style>
        ${fontCss}
      </style>

      <g clip-path="url(#clip)">

        <!-- ─── BACKGROUND — flat warm off-white ─── -->
        <rect width="1600" height="900" fill="#f0ece8" />

        <!-- ─── Scattered product elements ─── -->

        <!-- Top-left: mini browser window -->
        <g transform="translate(80, 100) rotate(-6)" opacity="0.32">
          <rect width="160" height="110" rx="12" fill="none" stroke="${dark}" stroke-width="2" />
          <line x1="0" y1="24" x2="160" y2="24" stroke="${dark}" stroke-width="1.2" />
          <circle cx="14" cy="12" r="3.5" fill="${dark}" />
          <circle cx="26" cy="12" r="3.5" fill="${dark}" />
          <circle cx="38" cy="12" r="3.5" fill="${dark}" />
          <rect x="18" y="42" width="90" height="6" rx="3" fill="${dark}" />
          <rect x="18" y="56" width="60" height="6" rx="3" fill="${dark}" />
          <rect x="18" y="70" width="110" height="6" rx="3" fill="${dark}" />
        </g>

        <!-- Top-left: cursor clicking -->
        <g transform="translate(310, 170) rotate(8)" opacity="0.38">
          <path d="M 0 0 L 0 26 L 8 19 L 13 32 L 18 30 L 13 17 L 21 17 Z" fill="${dark}" />
        </g>

        <!-- Top-right: REC indicator -->
        <g transform="translate(1360, 110)" opacity="0.45">
          <circle cx="10" cy="10" r="10" fill="#d4726b" />
          <circle cx="10" cy="10" r="16" fill="none" stroke="#d4726b" stroke-width="1.5" />
        </g>

        <!-- Top-right: mini playbook card -->
        <g transform="translate(1320, 180) rotate(4)" opacity="0.28">
          <rect width="140" height="100" rx="10" fill="none" stroke="${dark}" stroke-width="2" />
          <rect x="14" y="14" width="50" height="8" rx="4" fill="${dark}" />
          <circle cx="22" cy="40" r="5" fill="${dark}" />
          <rect x="34" y="37" width="70" height="6" rx="3" fill="${dark}" />
          <circle cx="22" cy="58" r="5" fill="${dark}" />
          <rect x="34" y="55" width="55" height="6" rx="3" fill="${dark}" />
          <circle cx="22" cy="76" r="5" fill="none" stroke="${dark}" stroke-width="1.5" />
          <rect x="34" y="73" width="40" height="6" rx="3" fill="${dark}" />
        </g>

        <!-- Bottom-left: play button -->
        <g transform="translate(120, 560) rotate(10)" opacity="0.30">
          <circle cx="24" cy="24" r="24" fill="none" stroke="${dark}" stroke-width="2" />
          <polygon points="18,12 18,36 38,24" fill="${dark}" />
        </g>

        <!-- Bottom-left: small checklist -->
        <g transform="translate(240, 620) rotate(-4)" opacity="0.25">
          <rect x="0" y="0" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <path d="M 2 5 L 4.5 7.5 L 8 3" stroke="${dark}" stroke-width="1.5" fill="none" />
          <rect x="16" y="2" width="50" height="6" rx="3" fill="${dark}" />
          <rect x="0" y="18" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <path d="M 2 23 L 4.5 25.5 L 8 21" stroke="${dark}" stroke-width="1.5" fill="none" />
          <rect x="16" y="20" width="40" height="6" rx="3" fill="${dark}" />
          <rect x="0" y="36" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <rect x="16" y="38" width="34" height="6" rx="3" fill="${dark}" />
        </g>

        <!-- Bottom-right: cursor with sparkle -->
        <g transform="translate(1350, 580) rotate(-8)" opacity="0.35">
          <path d="M 0 0 L 0 28 L 8 21 L 14 34 L 19 31 L 13 18 L 22 18 Z" fill="${dark}" />
          <g transform="translate(26, -8)">
            <line x1="6" y1="0" x2="6" y2="12" stroke="${dark}" stroke-width="1.5" />
            <line x1="0" y1="6" x2="12" y2="6" stroke="${dark}" stroke-width="1.5" />
          </g>
        </g>

        <!-- Bottom-right: mini window -->
        <g transform="translate(1380, 460) rotate(6)" opacity="0.25">
          <rect width="120" height="80" rx="10" fill="none" stroke="${dark}" stroke-width="2" />
          <line x1="0" y1="20" x2="120" y2="20" stroke="${dark}" stroke-width="1.2" />
          <circle cx="12" cy="10" r="3" fill="${dark}" />
          <circle cx="22" cy="10" r="3" fill="${dark}" />
          <rect x="14" y="34" width="48" height="16" rx="5" fill="${dark}" />
        </g>

        <!-- ─── BRAND MARK ─── -->
        <circle cx="770" cy="168" r="26" fill="${brandBlue}" />
        <circle cx="830" cy="168" r="26" fill="${brandTeal}" />
        <rect x="744" y="208" width="112" height="40" rx="20" fill="${brandSand}" />

        <!-- ─── LOGOTYPE ─── -->
        <text
          x="800" y="460"
          text-anchor="middle"
          font-family="${font}"
          font-weight="900"
          font-size="240"
          fill="${dark}"
          letter-spacing="-8"
        >memoo</text>

        <!-- ─── TAGLINE ─── -->
        <text
          x="800" y="532"
          text-anchor="middle"
          font-family="${font}"
          font-weight="500"
          font-size="66"
          fill="${muted}"
          letter-spacing="0.5"
        >Record once, run anywhere.</text>

        <!-- ─── SECONDARY LINE ─── -->
        <text
          x="800" y="600"
          text-anchor="middle"
          font-family="${font}"
          font-weight="600"
          font-size="60"
          fill="${dark}"
          letter-spacing="0"
          opacity="0.50"
        >Automate <tspan font-weight="800" font-style="italic" opacity="1" fill="${dark}">ANY</tspan> workflow.</text>
        <!-- Hand-drawn pencil underline under "ANY" -->
        <path d="M 738 622 C 755 630, 776 624, 797 621 C 818 618, 840 627, 862 621 C 871 619, 880 625, 890 621" fill="none" stroke="${brandSand}" stroke-width="3.2" stroke-linecap="round" opacity="0.65" />

        <!-- ─── BOTTOM BAR — solid sand ─── -->
        <rect x="0" y="770" width="1600" height="130" fill="${brandSand}" />

        <g transform="translate(${bottomLineOffsetX}, 803)">
          <text
            x="91" y="42"
            text-anchor="middle"
            font-family="${font}"
            font-weight="800"
            font-size="50"
            fill="white"
            letter-spacing="-0.5"
          >Built for</text>

          <g transform="translate(182, 4)">
            ${geminiLogo}
          </g>

          <text
            x="348" y="46"
            font-family="${font}"
            font-weight="800"
            font-size="50"
            fill="white"
            letter-spacing="-0.5"
          >Live Agent Challenge</text>
        </g>

      </g>
    </svg>
  `;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function svgToPng(svgMarkup: string) {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo preparar la imagen PNG.'));
      img.src = blobUrl;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = BANNER_WIDTH * scale;
    canvas.height = BANNER_HEIGHT * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo crear el contexto de canvas.');
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.drawImage(image, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('No se pudo exportar el PNG.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function BannerStudio() {
  const [bottomLineOffsetX, setBottomLineOffsetX] = useState(446);
  const [status, setStatus] = useState<string>('Preparando export...');
  const [exportSvgMarkup, setExportSvgMarkup] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(true);
  const previewSvgMarkup = useMemo(() => createBannerSvg(PUBLIC_FONT_CSS, { bottomLineOffsetX }), [bottomLineOffsetX]);

  useEffect(() => {
    let cancelled = false;

    async function prepareSvg() {
      if (!cancelled) {
        setIsPreparing(true);
        setStatus('Preparando export...');
      }

      try {
        const nextSvgMarkup = createBannerSvg(await getEmbeddedFontCss(), { bottomLineOffsetX });
        if (cancelled) {
          return;
        }

        setExportSvgMarkup(nextSvgMarkup);
        setStatus('Listo para exportar.');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus(error instanceof Error ? error.message : 'No se pudo preparar el banner.');
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    }

    void prepareSvg();

    return () => {
      cancelled = true;
    };
  }, [bottomLineOffsetX]);

  async function handleExportSvg() {
    if (!exportSvgMarkup) {
      setStatus('El banner todavia se esta preparando.');
      return;
    }

    downloadBlob('memoo-banner.svg', new Blob([exportSvgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
    setStatus('SVG exportado exitosamente.');
  }

  async function handleExportPng() {
    if (!exportSvgMarkup) {
      setStatus('El banner todavia se esta preparando.');
      return;
    }

    try {
      setStatus('Renderizando PNG (High-Res)...');
      const pngBlob = await svgToPng(exportSvgMarkup);
      downloadBlob('memoo-banner.png', pngBlob);
      setStatus('PNG exportado espectacularmente.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo exportar el PNG.');
    }
  }

  async function handleCopySvg() {
    if (!exportSvgMarkup) {
      setStatus('El banner todavia se esta preparando.');
      return;
    }

    try {
      await navigator.clipboard.writeText(exportSvgMarkup);
      setStatus('Código SVG copiado al portapapeles.');
    } catch {
      setStatus('No se pudo copiar el portapapeles.');
    }
  }

  return (
    <main className="min-h-screen text-[#102131] selection:bg-[#0f678f]/20 selection:text-[#102131] px-4 py-8 md:px-8 relative overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #e8eff6 0%, #e2ebf3 100%)' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(1100px 620px at -8% -14%, rgba(15, 143, 126, 0.2), transparent 72%), radial-gradient(980px 560px at 108% -8%, rgba(15, 103, 143, 0.26), transparent 74%), radial-gradient(920px 520px at 58% 112%, rgba(209, 132, 52, 0.19), transparent 74%)',
        }}
      />

      <div className="mx-auto w-full max-w-[1500px] grid gap-8 lg:grid-cols-[420px_1fr] relative z-10">
        <motion.section
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-8 p-6 md:p-10 rounded-[30px] shadow-[0_14px_32px_rgba(15,33,52,0.1)] relative overflow-hidden"
          style={{
            border: '1px solid rgba(149, 169, 186, 0.74)',
            background: 'linear-gradient(160deg, rgba(247, 251, 255, 0.9), rgba(233, 242, 249, 0.84))',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 14px 32px rgba(15, 33, 52, 0.1)',
          }}
        >
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-full" style={{ color: '#0f678f', background: 'rgba(30, 96, 128, 0.09)', borderColor: 'rgba(30, 96, 128, 0.22)', borderWidth: 1 }}>
              <Sparkle weight="fill" />
              <span>Studio</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#102131] leading-[1.1]">Brand Banner</h1>
            <p className="text-base text-[#4d6374] leading-relaxed font-medium">
              Diseño premium sincronizado con la landing page. Temática clara, glassmorphism sutil, azules profundos, tono salvia y arena.
            </p>
          </div>

          <div className="grid gap-4 mt-2 relative z-10">
            <div className="rounded-[20px] p-5 shadow-inner backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(149, 169, 186, 0.4)' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: '#4d6374' }}>Export Resolution</p>
              <p className="text-2xl font-bold tracking-tight text-[#102131]">3200 × 1800 <sup className="text-sm font-medium text-[#4d6374]">@2x</sup></p>
            </div>

            <label
              className="rounded-[20px] p-5 shadow-inner backdrop-blur-sm grid gap-3"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(149, 169, 186, 0.4)' }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: '#4d6374' }}>Bottom Line</p>
                  <p className="text-sm font-semibold text-[#102131]">Mover frase inferior</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: '#0f678f', background: 'rgba(15, 103, 143, 0.12)' }}>
                  {bottomLineOffsetX}px
                </span>
              </div>

              <input
                type="range"
                min="410"
                max="500"
                step="2"
                value={bottomLineOffsetX}
                onChange={event => setBottomLineOffsetX(Number(event.target.value))}
                className="w-full accent-[#0f678f]"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 mt-4 relative z-10">
            <button
              type="button"
              onClick={handleExportPng}
              disabled={isPreparing || !exportSvgMarkup}
              className="group relative flex items-center justify-center gap-3 rounded-full px-6 py-4 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
              style={{ background: '#0f678f', color: '#f0f8ff', boxShadow: '0 8px 16px rgba(15, 103, 143, 0.2)' }}
            >
              <ImageSquare size={22} weight="fill" color="white" />
              <span className="relative z-10">Generar PNG (High-Res)</span>
            </button>

            <button
              type="button"
              onClick={handleExportSvg}
              disabled={isPreparing || !exportSvgMarkup}
              className="flex items-center justify-center gap-3 rounded-full border px-6 py-4 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'rgba(30, 96, 128, 0.09)', borderColor: 'rgba(30, 96, 128, 0.22)', color: '#0f678f' }}
            >
              <FileSvg size={22} weight="duotone" color="#0f678f" />
              Descargar Archivo SVG
            </button>

            <button
              type="button"
              onClick={handleCopySvg}
              disabled={isPreparing || !exportSvgMarkup}
              className="flex items-center justify-center gap-3 rounded-full border px-6 py-4 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'transparent', borderColor: 'rgba(149, 169, 186, 0.6)', color: '#4d6374' }}
            >
              <CopySimple size={22} weight="bold" />
              Copiar Código XML
            </button>
          </div>

          <div className="mt-auto pt-8 flex items-center justify-between text-sm relative z-10">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full border" style={{ background: 'rgba(255,255,255,0.6)', borderColor: 'rgba(149, 169, 186, 0.4)' }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#0f8f7e' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#0f8f7e' }} />
              </span>
              <span className="font-medium truncate max-w-[180px]" style={{ color: '#4d6374' }}>{status}</span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 font-bold transition-colors group px-4 py-2 rounded-full"
              style={{ color: '#0f678f', background: 'rgba(255,255,255,0.5)' }}
            >
              Volver
              <ArrowSquareOut size={16} weight="bold" />
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center p-2 md:p-6 lg:p-12 w-full h-full min-h-[500px]"
        >
          <div className="absolute inset-10 rounded-[64px] blur-[80px] opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(15,39,60,0.15) 0%, transparent 70%)' }} />

          <div className="relative w-full max-w-[1000px] aspect-video z-10">
            <div
              style={{ borderColor: 'rgba(255,255,255,0.8)' }}
              className="w-full h-full rounded-[24px] md:rounded-[32px] overflow-hidden shadow-[0_24px_50px_-12px_rgba(15,39,60,0.3)] border relative group"
            >
              <div className="w-full h-full [&_svg]:w-full [&_svg]:h-full object-cover" dangerouslySetInnerHTML={{ __html: previewSvgMarkup }} />
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
