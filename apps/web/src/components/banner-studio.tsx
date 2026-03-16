'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowSquareOut, CopySimple, FileSvg, FilmStrip, ImageSquare, Sparkle } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

import {
  BANNER_GIF_EXPORT_HEIGHT,
  BANNER_GIF_EXPORT_WIDTH,
  BANNER_GIF_OUTPUT_PATH,
  BANNER_HEIGHT,
  BANNER_LOOP_FRAME_COUNT,
  BANNER_LOOP_INTERVAL_MS,
  BANNER_WIDTH,
  DEFAULT_BOTTOM_LINE_OFFSET_X,
  PUBLIC_FONT_CSS,
  VAG_ROUNDED_FONT_SOURCES,
  createBannerSvg,
} from '@/lib/banner-art';

let embeddedFontCssPromise: Promise<string> | null = null;

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
  const [bottomLineOffsetX, setBottomLineOffsetX] = useState(DEFAULT_BOTTOM_LINE_OFFSET_X);
  const [status, setStatus] = useState<string>('Preparando export...');
  const [exportSvgMarkup, setExportSvgMarkup] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState(true);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);

  const previewSvgMarkup = useMemo(
    () => createBannerSvg(PUBLIC_FONT_CSS, { bottomLineOffsetX, phase: previewFrame / BANNER_LOOP_FRAME_COUNT }),
    [bottomLineOffsetX, previewFrame]
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPreviewFrame(currentFrame => (currentFrame + 1) % BANNER_LOOP_FRAME_COUNT);
    }, BANNER_LOOP_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function prepareSvg() {
      if (!cancelled) {
        setIsPreparing(true);
        setStatus('Preparando export...');
      }

      try {
        const nextSvgMarkup = createBannerSvg(await getEmbeddedFontCss(), { bottomLineOffsetX, phase: 0 });
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

  async function handleExportGif() {
    try {
      setIsExportingGif(true);
      setStatus('Renderizando GIF con fuentes embebidas...');

      const response = await fetch(`/api/banner/gif?bottomLineOffsetX=${bottomLineOffsetX}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        let detail = 'No se pudo exportar el GIF.';

        try {
          const payload = await response.json();
          if (payload?.detail) {
            detail = String(payload.detail);
          }
        } catch {
          // Keep fallback message if the response body is not JSON.
        }

        throw new Error(detail);
      }

      const gifBlob = await response.blob();
      downloadBlob('memoo-banner.gif', gifBlob);
      setStatus('GIF exportado con fuentes preservadas.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo exportar el GIF.');
    } finally {
      setIsExportingGif(false);
    }
  }

  return (
    <main className="min-h-screen text-[#102131] selection:bg-[#0f678f]/20 selection:text-[#102131] px-4 py-8 md:px-8 relative overflow-hidden flex items-center justify-center bg-white">
      <div className="mx-auto w-full max-w-[1820px] grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] relative z-10">
        <motion.section
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-8 p-6 md:p-10 rounded-[30px] relative overflow-hidden"
          style={{
            border: '1px solid rgba(149, 169, 186, 0.74)',
            background: 'linear-gradient(160deg, rgba(247, 251, 255, 0.9), rgba(233, 242, 249, 0.84))',
          }}
        >
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-full" style={{ color: '#0f678f', background: 'rgba(30, 96, 128, 0.09)', borderColor: 'rgba(30, 96, 128, 0.22)', borderWidth: 1 }}>
              <Sparkle weight="fill" />
              <span>Studio</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#102131] leading-[1.1]">Brand Banner</h1>
            <p className="text-base text-[#4d6374] leading-relaxed font-medium">
              Diseño premium sincronizado con la landing page. Ahora con preview juguetona y un loop GIF ya preparado para usar.
            </p>
          </div>

          <div className="grid gap-4 mt-2 relative z-10">
            <div className="rounded-[20px] p-5 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(149, 169, 186, 0.4)' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: '#4d6374' }}>Export Resolution</p>
              <p className="text-2xl font-bold tracking-tight text-[#102131]">3200 × 1800 <sup className="text-sm font-medium text-[#4d6374]">@2x</sup></p>
              <p className="mt-2 text-sm font-semibold text-[#4d6374]">GIF listo: {BANNER_GIF_EXPORT_WIDTH} × {BANNER_GIF_EXPORT_HEIGHT} loop</p>
            </div>

            <label
              className="rounded-[20px] p-5 backdrop-blur-sm grid gap-3"
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
              style={{ background: '#0f678f', color: '#f0f8ff' }}
            >
              <ImageSquare size={22} weight="fill" color="white" />
              <span className="relative z-10">Generar PNG (High-Res)</span>
            </button>

            <button
              type="button"
              onClick={handleExportGif}
              disabled={isExportingGif}
              className="flex items-center justify-center gap-3 rounded-full border px-6 py-4 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: '#d18434', borderColor: '#d18434', color: '#fffaf4' }}
            >
              <FilmStrip size={22} weight="fill" color="white" />
              {isExportingGif ? 'Generando GIF...' : 'Exportar GIF'}
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
          className="relative flex items-center justify-center p-0 md:p-2 lg:p-4 w-full h-full min-h-[560px]"
        >
          <div className="relative w-full max-w-[1440px] aspect-video z-10">
            <div
              style={{ borderColor: '#ffffff', background: '#ffffff' }}
              className="w-full h-full rounded-[24px] md:rounded-[32px] overflow-hidden border relative group"
            >
              <motion.div
                animate={{ rotate: [0, -0.2, 0.28, -0.12, 0], y: [0, -2, 0.5, -3, 0], scale: [1, 1.003, 0.999, 1.002, 1] }}
                transition={{ duration: 3.6, ease: 'easeInOut', repeat: Infinity }}
                className="w-full h-full origin-center"
              >
                <div className="w-full h-full [&_svg]:w-full [&_svg]:h-full object-cover" dangerouslySetInnerHTML={{ __html: previewSvgMarkup }} />
              </motion.div>
            </div>

            <div className="mt-4 flex justify-end">
              <code className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.58)', color: '#4d6374', border: '1px solid rgba(149, 169, 186, 0.38)' }}>
                GIF: {BANNER_GIF_OUTPUT_PATH}
              </code>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
