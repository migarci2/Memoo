export const BANNER_WIDTH = 1600;
export const BANNER_HEIGHT = 900;
export const DEFAULT_BOTTOM_LINE_OFFSET_X = 446;
export const BANNER_LOOP_FRAME_COUNT = 18;
export const BANNER_LOOP_FPS = 12;
export const BANNER_LOOP_INTERVAL_MS = Math.round(1000 / BANNER_LOOP_FPS);
export const BANNER_GIF_EXPORT_WIDTH = 1280;
export const BANNER_GIF_EXPORT_HEIGHT = Math.round((BANNER_HEIGHT / BANNER_WIDTH) * BANNER_GIF_EXPORT_WIDTH);
export const BANNER_GIF_OUTPUT_PATH = '/assets/memoo-banner-loop.gif';
export const VAG_ROUNDED_FONT_SOURCES = [
  { path: '/fonts/vag-rounded/VAG Rounded Light (1)_0.ttf', weight: 400 },
  { path: '/fonts/vag-rounded/VAG Rounded Bold_0.ttf', weight: 700 },
  { path: '/fonts/vag-rounded/VAG Rounded Black_0.ttf', weight: 900 },
];

export const PUBLIC_FONT_CSS = `
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

const GEMINI_WORDMARK_WIDTH = 98;
const GEMINI_WORDMARK_HEIGHT = 24;
const GEMINI_WORDMARK_PATH_D =
  'M21.186 12.67c0 2.649-.786 4.759-2.359 6.33-1.766 1.87-4.09 2.806-6.969 2.806-2.756 0-5.088-.953-6.996-2.86C2.954 17.04 2 14.693 2 11.904c0-2.789.954-5.137 2.862-7.043C6.77 2.953 9.102 2 11.858 2c1.396 0 2.712.247 3.949.741 1.236.495 2.252 1.192 3.047 2.092l-1.749 1.748c-.583-.706-1.338-1.258-2.266-1.655a7.49 7.49 0 00-2.981-.596c-2.067 0-3.816.715-5.247 2.145-1.413 1.448-2.12 3.257-2.12 5.428s.707 3.98 2.12 5.428c1.431 1.43 3.18 2.145 5.247 2.145 1.89 0 3.463-.53 4.717-1.588 1.254-1.06 1.979-2.516 2.173-4.37h-6.89v-2.277h9.196c.088.495.132.971.132 1.43m7.652-4.633c1.946 0 3.494.629 4.645 1.886 1.15 1.257 1.726 3.018 1.726 5.282l-.027.268H24.877c.036 1.284.464 2.318 1.285 3.102.82.785 1.802 1.177 2.944 1.177 1.57 0 2.802-.784 3.694-2.354l2.195 1.07a6.54 6.54 0 01-2.45 2.595C31.503 21.688 30.32 22 29 22c-1.927 0-3.516-.66-4.765-1.98-1.249-1.319-1.873-2.986-1.873-5.001 0-1.997.606-3.66 1.82-4.988 1.213-1.329 2.766-1.993 4.657-1.993m-.053 2.247c-.928 0-1.727.285-2.396.856-.67.57-1.11 1.337-1.325 2.3h7.522c-.071-.91-.442-1.663-1.111-2.26-.67-.598-1.566-.896-2.69-.896M39.247 21.53h-2.455V8.465h2.348v1.813h.107c.374-.64.947-1.173 1.721-1.6.774-.427 1.544-.64 2.309-.64.96 0 1.806.222 2.535.667a3.931 3.931 0 011.601 1.84c1.085-1.671 2.589-2.507 4.51-2.507 1.513 0 2.678.462 3.496 1.387.819.924 1.228 2.24 1.228 3.946v8.16h-2.455v-7.786c0-1.227-.223-2.112-.668-2.654-.444-.542-1.192-.813-2.241-.813-.943 0-1.735.4-2.375 1.2-.64.8-.961 1.742-.961 2.826v7.227h-2.455v-7.786c0-1.227-.223-2.112-.668-2.654-.444-.542-1.191-.813-2.241-.813-.943 0-1.735.4-2.375 1.2-.64.8-.961 1.742-.961 2.826v7.227zM61.911 3.93c0 .48-.17.89-.508 1.228a1.675 1.675 0 01-1.23.508c-.48 0-.89-.17-1.229-.508a1.673 1.673 0 01-.508-1.228c0-.481.17-.89.508-1.229a1.675 1.675 0 011.23-.508c.48 0 .89.17 1.23.508.338.338.507.748.507 1.228m-.11 4.514v13.088h-2.857V8.443h2.857zM80 3.93c0 .48-.17.89-.508 1.228a1.675 1.675 0 01-1.23.508c-.48 0-.89-.17-1.229-.508a1.673 1.673 0 01-.508-1.228c0-.481.17-.89.508-1.229a1.675 1.675 0 011.23-.508c.48 0 .89.17 1.23.508.338.338.507.748.507 1.228m-.11 4.514v13.088h-2.857V8.443h2.857zm-16.343.022h2.349v1.813h.107c.373-.64.947-1.173 1.721-1.6a4.935 4.935 0 012.415-.64c1.601 0 2.833.458 3.696 1.373.863.916 1.294 2.218 1.294 3.907v8.213h-2.455v-8.053c-.053-2.133-1.13-3.2-3.229-3.2-.978 0-1.797.395-2.455 1.187-.658.79-.987 1.737-.987 2.84v7.226h-2.456V8.465z';

function getGeminiWordmarkSvg({ height = 46, color = 'currentColor' } = {}) {
  const width = Math.round((height * GEMINI_WORDMARK_WIDTH) / GEMINI_WORDMARK_HEIGHT);

  return `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${GEMINI_WORDMARK_WIDTH} ${GEMINI_WORDMARK_HEIGHT}"
      fill="${color}"
      fill-rule="evenodd"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="${GEMINI_WORDMARK_PATH_D}" />
    </svg>
  `.trim();
}

function precision(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function getBannerMotion(phase = 0) {
  const radians = phase * Math.PI * 2;
  const wobble = Math.sin(radians);
  const bounce = Math.sin(radians * 2);
  const pulse = (Math.sin(radians - Math.PI / 5) + 1) / 2;
  const drift = Math.sin(radians + Math.PI / 3);

  return {
    browserRotate: precision(-6 + wobble * 1.8),
    browserY: precision(100 + pulse * 5),
    topCursorY: precision(170 - pulse * 12),
    topCursorRotate: precision(8 + wobble * 8),
    topCursorOpacity: precision(0.28 + pulse * 0.2),
    recRingScale: precision(1 + pulse * 0.26, 3),
    recRingOpacity: precision(0.28 + pulse * 0.52),
    playY: precision(560 + bounce * 8),
    playRotate: precision(10 + wobble * 4),
    checklistY: precision(620 - pulse * 5),
    checklistOpacity: precision(0.22 + pulse * 0.16),
    sparkleScale: precision(0.8 + pulse * 0.5),
    sparkleOpacity: precision(0.18 + pulse * 0.45),
    bottomCursorY: precision(580 + drift * 10),
    bottomCursorRotate: precision(-8 + drift * 9),
    windowRotate: precision(6 - wobble * 2.5),
    underlineShift: precision(bounce * 1.35),
    bottomBarY: precision(803 + wobble * 1.5),
    bottomBarRotate: precision(wobble * 0.22),
  };
}

export function createBannerSvg(fontCss, options = {}) {
  const font = "'VAG Rounded', sans-serif";
  const brandBlue = '#0f678f';
  const brandTeal = '#0f8f7e';
  const brandSand = '#d18434';
  const dark = '#1e3044';
  const muted = '#6b8295';
  const geminiLogo = getGeminiWordmarkSvg({ height: 46, color: 'white' });
  const { bottomLineOffsetX = DEFAULT_BOTTOM_LINE_OFFSET_X, phase = 0 } = options;
  const motion = getBannerMotion(phase);

  const underlineY1 = precision(622 - motion.underlineShift);
  const underlineCY1 = precision(630 + motion.underlineShift * 0.7);
  const underlineCY2 = precision(624 - motion.underlineShift * 0.9);
  const underlineY2 = precision(621 + motion.underlineShift);
  const underlineCY3 = precision(618 - motion.underlineShift * 0.7);
  const underlineCY4 = precision(627 + motion.underlineShift * 0.7);
  const underlineY3 = precision(621 - motion.underlineShift);
  const underlineCY5 = precision(619 - motion.underlineShift * 0.5);
  const underlineCY6 = precision(625 + motion.underlineShift * 0.5);
  const underlineY4 = precision(621 + motion.underlineShift * 0.4);

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
        <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="#f0ece8" />

        <g transform="translate(80, ${motion.browserY}) rotate(${motion.browserRotate})" opacity="0.32">
          <rect width="160" height="110" rx="12" fill="none" stroke="${dark}" stroke-width="2" />
          <line x1="0" y1="24" x2="160" y2="24" stroke="${dark}" stroke-width="1.2" />
          <circle cx="14" cy="12" r="3.5" fill="${dark}" />
          <circle cx="26" cy="12" r="3.5" fill="${dark}" />
          <circle cx="38" cy="12" r="3.5" fill="${dark}" />
          <rect x="18" y="42" width="90" height="6" rx="3" fill="${dark}" />
          <rect x="18" y="56" width="60" height="6" rx="3" fill="${dark}" />
          <rect x="18" y="70" width="110" height="6" rx="3" fill="${dark}" />
        </g>

        <g transform="translate(310, ${motion.topCursorY}) rotate(${motion.topCursorRotate})" opacity="${motion.topCursorOpacity}">
          <path d="M 0 0 L 0 26 L 8 19 L 13 32 L 18 30 L 13 17 L 21 17 Z" fill="${dark}" />
        </g>

        <g transform="translate(1360, 110)" opacity="0.45">
          <circle cx="10" cy="10" r="10" fill="#d4726b" />
          <g transform="translate(10, 10) scale(${motion.recRingScale}) translate(-10, -10)" opacity="${motion.recRingOpacity}">
            <circle cx="10" cy="10" r="16" fill="none" stroke="#d4726b" stroke-width="1.5" />
          </g>
        </g>

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

        <g transform="translate(120, ${motion.playY}) rotate(${motion.playRotate})" opacity="0.30">
          <circle cx="24" cy="24" r="24" fill="none" stroke="${dark}" stroke-width="2" />
          <polygon points="18,12 18,36 38,24" fill="${dark}" />
        </g>

        <g transform="translate(240, ${motion.checklistY}) rotate(-4)" opacity="${motion.checklistOpacity}">
          <rect x="0" y="0" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <path d="M 2 5 L 4.5 7.5 L 8 3" stroke="${dark}" stroke-width="1.5" fill="none" />
          <rect x="16" y="2" width="50" height="6" rx="3" fill="${dark}" />
          <rect x="0" y="18" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <path d="M 2 23 L 4.5 25.5 L 8 21" stroke="${dark}" stroke-width="1.5" fill="none" />
          <rect x="16" y="20" width="40" height="6" rx="3" fill="${dark}" />
          <rect x="0" y="36" width="10" height="10" rx="2.5" fill="none" stroke="${dark}" stroke-width="1.8" />
          <rect x="16" y="38" width="34" height="6" rx="3" fill="${dark}" />
        </g>

        <g transform="translate(1350, ${motion.bottomCursorY}) rotate(${motion.bottomCursorRotate})" opacity="0.35">
          <path d="M 0 0 L 0 28 L 8 21 L 14 34 L 19 31 L 13 18 L 22 18 Z" fill="${dark}" />
          <g transform="translate(26, -8) scale(${motion.sparkleScale})" opacity="${motion.sparkleOpacity}">
            <line x1="6" y1="0" x2="6" y2="12" stroke="${dark}" stroke-width="1.5" />
            <line x1="0" y1="6" x2="12" y2="6" stroke="${dark}" stroke-width="1.5" />
          </g>
        </g>

        <g transform="translate(1380, 460) rotate(${motion.windowRotate})" opacity="0.25">
          <rect width="120" height="80" rx="10" fill="none" stroke="${dark}" stroke-width="2" />
          <line x1="0" y1="20" x2="120" y2="20" stroke="${dark}" stroke-width="1.2" />
          <circle cx="12" cy="10" r="3" fill="${dark}" />
          <circle cx="22" cy="10" r="3" fill="${dark}" />
          <rect x="14" y="34" width="48" height="16" rx="5" fill="${dark}" />
        </g>

        <circle cx="770" cy="168" r="26" fill="${brandBlue}" />
        <circle cx="830" cy="168" r="26" fill="${brandTeal}" />
        <rect x="744" y="208" width="112" height="40" rx="20" fill="${brandSand}" />

        <text
          x="800" y="460"
          text-anchor="middle"
          font-family="${font}"
          font-weight="900"
          font-size="240"
          fill="${dark}"
          letter-spacing="-8"
        >memoo</text>

        <text
          x="800" y="532"
          text-anchor="middle"
          font-family="${font}"
          font-weight="500"
          font-size="66"
          fill="${muted}"
          letter-spacing="0.5"
        >Record once, run anywhere.</text>

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

        <path d="M 738 ${underlineY1} C 755 ${underlineCY1}, 776 ${underlineCY2}, 797 ${underlineY2} C 818 ${underlineCY3}, 840 ${underlineCY4}, 862 ${underlineY3} C 871 ${underlineCY5}, 880 ${underlineCY6}, 890 ${underlineY4}" fill="none" stroke="${brandSand}" stroke-width="3.2" stroke-linecap="round" opacity="0.65" />

        <rect x="0" y="770" width="${BANNER_WIDTH}" height="130" fill="${brandSand}" />

        <g transform="translate(${bottomLineOffsetX}, ${motion.bottomBarY}) rotate(${motion.bottomBarRotate}, 220, 28)">
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
