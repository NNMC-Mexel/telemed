import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(path.join(rootDir, 'frontend', 'package.json'));
const sharp = require('sharp');

const W = 1280;
const H = 720;
const outDir = path.join(rootDir, 'outputs');
const logoPath = '/Users/aidarmukhamedin/Documents/6B2DF129_CA53_4F5C_A85E_E79C69C4B8FE_L0_001_14_09_2023,_20_45_27.jpg';

const emblemBuffer = await sharp(logoPath)
  .extract({ left: 365, top: 430, width: 870, height: 690 })
  .resize(220, 180, { fit: 'contain', background: '#ffffff' })
  .png()
  .toBuffer();
const emblemHref = `data:image/png;base64,${emblemBuffer.toString('base64')}`;

const colors = {
  navy: '#071B61',
  blue: '#0874D6',
  blue2: '#0697E8',
  deep: '#003E9F',
  cyan: '#4EC7ED',
  green: '#4B8F3A',
  line: '#6EB7E5',
  text: '#122B5C',
  muted: '#5F6F86',
};

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function featureIcon(type, x, y, size = 72) {
  const s = size;
  const c = { x: x + s / 2, y: y + s / 2 };
  const common = `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="18" fill="url(#iconGrad)"/>`;
  const line = 'stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  if (type === 'video') {
    return `${common}
      <rect x="${x + 17}" y="${y + 24}" width="31" height="24" rx="6" ${line}/>
      <path d="M ${x + 49} ${y + 31} L ${x + 60} ${y + 24} V ${y + 48} L ${x + 49} ${y + 41} Z" fill="white"/>`;
  }

  if (type === 'calendar') {
    return `${common}
      <rect x="${x + 17}" y="${y + 20}" width="38" height="36" rx="5" ${line}/>
      <path d="M ${x + 17} ${y + 32} H ${x + 55} M ${x + 27} ${y + 15} V ${y + 25} M ${x + 45} ${y + 15} V ${y + 25}" ${line}/>
      <circle cx="${x + 28}" cy="${y + 43}" r="2.8" fill="white"/><circle cx="${x + 44}" cy="${y + 43}" r="2.8" fill="white"/>`;
  }

  if (type === 'history') {
    return `${common}
      <path d="M ${x + 21} ${y + 15} H ${x + 45} L ${x + 55} ${y + 25} V ${y + 57} H ${x + 21} Z" ${line}/>
      <path d="M ${x + 44} ${y + 15} V ${y + 27} H ${x + 55}" ${line}/>
      <path d="M ${c.x} ${y + 34} V ${y + 50} M ${c.x - 8} ${y + 42} H ${c.x + 8}" ${line}/>`;
  }

  if (type === 'rx') {
    return `${common}
      <path d="M ${x + 22} ${y + 14} H ${x + 45} L ${x + 55} ${y + 24} V ${y + 58} H ${x + 22} Z" ${line}/>
      <path d="M ${x + 44} ${y + 14} V ${y + 26} H ${x + 55}" ${line}/>
      <text x="${x + 25}" y="${y + 50}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="white">Rx</text>`;
  }

  if (type === 'chat') {
    return `${common}
      <path d="M ${x + 18} ${y + 25} Q ${x + 18} ${y + 18} ${x + 27} ${y + 18} H ${x + 52} Q ${x + 59} ${y + 18} ${x + 59} ${y + 29} V ${y + 40} Q ${x + 59} ${y + 49} ${x + 48} ${y + 49} H ${x + 34} L ${x + 23} ${y + 57} V ${y + 48} Q ${x + 18} ${y + 46} ${x + 18} ${y + 39} Z" fill="white"/>
      <circle cx="${x + 33}" cy="${y + 34}" r="3.2" fill="${colors.blue}"/><circle cx="${x + 43}" cy="${y + 34}" r="3.2" fill="${colors.blue}"/><circle cx="${x + 53}" cy="${y + 34}" r="3.2" fill="${colors.blue}"/>`;
  }

  return `${common}
    <circle cx="${x + 26}" cy="${y + 27}" r="8" ${line}/>
    <circle cx="${x + 49}" cy="${y + 24}" r="8" ${line}/>
    <circle cx="${x + 37}" cy="${y + 51}" r="8" ${line}/>
    <path d="M ${x + 34} ${y + 27} H ${x + 41} M ${x + 29} ${y + 35} L ${x + 34} ${y + 43} M ${x + 46} ${y + 32} L ${x + 40} ${y + 43}" ${line}/>`;
}

function valueIcon(type, x, y, size = 58) {
  const s = size;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const line = `stroke="${colors.blue}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const shell = `<circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="white"/>`;

  if (type === 'eye') {
    return `${shell}<path d="M ${x + 13} ${cy} Q ${cx} ${y + 18} ${x + s - 13} ${cy} Q ${cx} ${y + s - 18} ${x + 13} ${cy} Z" ${line}/><circle cx="${cx}" cy="${cy}" r="6.5" fill="${colors.blue}"/>`;
  }

  if (type === 'route') {
    return `${shell}<path d="M ${x + 15} ${y + 42} C ${x + 30} ${y + 38}, ${x + 34} ${y + 23}, ${x + 49} ${y + 18}" ${line}/><circle cx="${x + 15}" cy="${y + 42}" r="6" fill="${colors.green}"/><circle cx="${x + 49}" cy="${y + 18}" r="6" fill="${colors.blue}"/>`;
  }

  if (type === 'person') {
    return `${shell}<circle cx="${cx}" cy="${y + 23}" r="9.5" fill="${colors.blue}"/><path d="M ${x + 16} ${y + 52} Q ${cx} ${y + 34} ${x + 42} ${y + 52} Z" fill="${colors.blue}"/>`;
  }

  return `${shell}<path d="M ${cx} ${y + 12} L ${x + 46} ${y + 20} V ${y + 35} Q ${x + 46} ${y + 47} ${cx} ${y + 53} Q ${x + 12} ${y + 47} ${x + 12} ${y + 35} V ${y + 20} Z" ${line}/><path d="M ${x + 20} ${y + 33} L ${x + 28} ${y + 41} L ${x + 42} ${y + 25}" stroke="${colors.green}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

function featureCard({ title, iconType, x, y, side, connectorEnd }) {
  const w = 350;
  const h = 106;
  const iconX = side === 'left' ? x + 20 : x + 24;
  const textX = side === 'left' ? x + 112 : x + 116;
  const connectorY = y + h / 2;
  const connectorStart = side === 'left' ? x + w : x;
  const dotX = side === 'left' ? x + w + 5 : x - 5;
  const control = side === 'left' ? connectorStart + 55 : connectorStart - 55;

  return `
    <path d="M ${connectorStart} ${connectorY} C ${control} ${connectorY}, ${connectorEnd} ${connectorY}, ${connectorEnd} ${connectorY}" fill="none" stroke="${colors.line}" stroke-width="2.2" stroke-dasharray="5 8"/>
    <circle cx="${dotX}" cy="${connectorY}" r="5" fill="${colors.blue}"/>
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="white" stroke="#D6E8F4" stroke-width="1.4"/>
    </g>
    ${featureIcon(iconType, iconX, y + 17, 72)}
    <text x="${textX}" y="${y + 61}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="${colors.navy}">${esc(title)}</text>
    <rect x="${textX}" y="${y + 74}" width="${w - 138}" height="3" rx="1.5" fill="${colors.cyan}" opacity="0.65"/>
  `;
}

function valueRow({ lines, iconType, y }) {
  const lineNodes = lines
    .map(
      (line, index) =>
        `<text x="1078" y="${y - 12 + index * 18}" font-family="Arial, Helvetica, sans-serif" font-size="14.6" font-weight="800" fill="white">${esc(line)}</text>`,
    )
    .join('\n');
  const dividerY = y + (lines.length === 3 ? 43 : 34);

  return `
    <g>
      ${valueIcon(iconType, 1008, y - 31, 62)}
      ${lineNodes}
      <path d="M 1078 ${dividerY} H 1222" stroke="#58BDE8" stroke-opacity="0.36" stroke-width="1.5"/>
    </g>
  `;
}

const featuresLeft = [
  { title: 'ВИДЕОКОНСУЛЬТАЦИИ', iconType: 'video', x: 34, y: 128, side: 'left', connectorEnd: 395 },
  { title: 'ЭЛЕКТРОННАЯ ЗАПИСЬ', iconType: 'calendar', x: 34, y: 284, side: 'left', connectorEnd: 395 },
  { title: 'ИСТОРИЯ БОЛЕЗНИ', iconType: 'history', x: 34, y: 440, side: 'left', connectorEnd: 395 },
];

const featuresRight = [
  { title: 'ЭЛЕКТРОННЫЕ РЕЦЕПТЫ', iconType: 'rx', x: 604, y: 128, side: 'right', connectorEnd: 585 },
  { title: 'ЧАТ С ВРАЧОМ', iconType: 'chat', x: 604, y: 284, side: 'right', connectorEnd: 585 },
  { title: 'ИНТЕГРАЦИИ IT СИСТЕМ', iconType: 'it', x: 604, y: 440, side: 'right', connectorEnd: 585 },
];

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.6" stop-color="#F7FCFF"/>
      <stop offset="1" stop-color="#DCEFF8"/>
    </linearGradient>
    <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#15A8E9"/>
      <stop offset="0.48" stop-color="#0476D8"/>
      <stop offset="1" stop-color="#06206B"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10258A"/>
      <stop offset="1" stop-color="#004DAE"/>
    </linearGradient>
    <linearGradient id="iconGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.blue2}"/>
      <stop offset="1" stop-color="${colors.navy}"/>
    </linearGradient>
    <filter id="cardShadow" x="-18%" y="-24%" width="136%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#0B2A69" flood-opacity="0.13"/>
    </filter>
    <filter id="panelShadow" x="-15%" y="-16%" width="130%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#061D5A" flood-opacity="0.25"/>
    </filter>
    <filter id="coreGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#28B6FF" flood-opacity="0.45"/>
    </filter>
    <clipPath id="emblemClip">
      <circle cx="976" cy="63" r="42"/>
    </clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <g opacity="0.22">
    <path d="M 0 596 C 132 568, 236 620, 355 590 S 552 565, 700 602 S 902 633, 1060 584 S 1214 571, 1280 594 V 720 H 0 Z" fill="#BFE4F7"/>
    <path d="M 20 682 L 92 624 L 188 676 L 294 616 L 414 682 L 546 626 L 684 680 L 825 619 L 950 680 L 1090 612 L 1220 675 L 1268 636" fill="none" stroke="#82C5E8" stroke-width="1.5"/>
    <circle cx="92" cy="624" r="3.5" fill="#82C5E8"/><circle cx="294" cy="616" r="3.5" fill="#82C5E8"/>
    <circle cx="684" cy="680" r="3.5" fill="#82C5E8"/><circle cx="1090" cy="612" r="3.5" fill="#82C5E8"/>
  </g>

  <text x="34" y="58" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" letter-spacing="0" fill="${colors.navy}">ТЕЛЕМЕДИЦИНА ННМЦ</text>
  <text x="36" y="89" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#1C6FB1">Единая цифровая платформа дистанционной медицинской помощи</text>

  <g>
    <circle cx="976" cy="63" r="46" fill="white" stroke="${colors.blue}" stroke-width="3"/>
    <image href="${emblemHref}" x="932" y="20" width="88" height="88" preserveAspectRatio="xMidYMid meet" clip-path="url(#emblemClip)"/>
    <text x="1035" y="56" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="800" fill="${colors.navy}">ННМЦ</text>
    <text x="1037" y="78" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="${colors.blue}">новое качество медицины</text>
    <text x="1037" y="94" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="${colors.green}">для каждого</text>
  </g>

  ${featuresLeft.map(featureCard).join('\n')}
  ${featuresRight.map(featureCard).join('\n')}

  <g transform="translate(494 336)">
    <circle cx="0" cy="0" r="186" fill="none" stroke="#AED9EE" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="160" fill="none" stroke="#CAEBF7" stroke-width="1.3"/>
    <circle cx="0" cy="0" r="135" fill="#F8FCFF" stroke="#D8EEF8" stroke-width="2"/>
    <circle cx="0" cy="0" r="120" fill="url(#coreGrad)" filter="url(#coreGlow)"/>
    <circle cx="0" cy="0" r="114" fill="none" stroke="#79D3F4" stroke-width="2.5" opacity="0.75"/>
    <g opacity="0.95">
      <rect x="-61" y="-76" width="122" height="82" rx="11" fill="none" stroke="white" stroke-width="6"/>
      <path d="M -42 -38 C -37 -61, -7 -61, -2 -38 C 4 -21, -12 -10, -22 -8 C -34 -10, -47 -21, -42 -38 Z" fill="white" opacity="0.96"/>
      <path d="M -53 0 C -41 -19, -3 -19, 9 0" fill="none" stroke="white" stroke-width="6" stroke-linecap="round"/>
      <rect x="25" y="-56" width="28" height="38" rx="5" fill="white" opacity="0.84"/>
      <circle cx="39" cy="-45" r="7.5" fill="${colors.blue}" opacity="0.95"/>
      <path d="M 28 -22 C 33 -34, 46 -34, 51 -22" fill="none" stroke="${colors.blue}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M -24 8 H 24 M -10 8 L -19 31 H 19 L 10 8" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="-21" y="-95" width="42" height="18" rx="7" fill="none" stroke="white" stroke-width="6"/>
    </g>
    <text x="0" y="78" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="white">TELEMED</text>
  </g>

  <g filter="url(#panelShadow)">
    <rect x="984" y="138" width="264" height="465" rx="18" fill="url(#panelGrad)"/>
  </g>
  <text x="1116" y="178" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="white">ЦЕННОСТЬ ДЛЯ ННМЦ</text>
  ${valueRow({ lines: ['Доступность помощи', 'для регионов'], iconType: 'eye', y: 239 })}
  ${valueRow({ lines: ['Быстрая', 'маршрутизация', 'пациентов'], iconType: 'route', y: 333 })}
  ${valueRow({ lines: ['Единый цифровой', 'профиль пациента'], iconType: 'person', y: 427 })}
  ${valueRow({ lines: ['Контроль качества', 'консультаций'], iconType: 'shield', y: 521 })}

  <g filter="url(#panelShadow)">
    <rect x="164" y="643" width="938" height="52" rx="13" fill="url(#panelGrad)"/>
  </g>
  <path d="M 205 657 L 205 678 Q 205 687 224 692 Q 243 687 243 678 V 657 L 224 650 Z" fill="none" stroke="white" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 224 663 V 681 M 215 672 H 233" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <text x="666" y="678" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20.5" font-weight="800" fill="white">ДИСТАНЦИОННАЯ МЕДИЦИНСКАЯ ПОМОЩЬ В ЕДИНОЙ ЦИФРОВОЙ СИСТЕМЕ</text>
</svg>`;

const svgPath = path.join(outDir, 'telemed-nnmc-infographic-v3.svg');
const pngPath = path.join(outDir, 'telemed-nnmc-infographic-v3.png');

fs.writeFileSync(svgPath, svg);
await sharp(Buffer.from(svg)).resize(W, H).png().toFile(pngPath);

console.log(svgPath);
console.log(pngPath);
