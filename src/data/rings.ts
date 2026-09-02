export type FingerId = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export type MetalId =
  | 'silver'
  | 'titanium'
  | 'black-silver'
  | 'northern-lights'
  | 'white-gold'
  | 'yellow-gold'
  | 'rose-gold'
  | 'white-black'
  | 'champagne'
  | 'platinum'
  | 'rainbow';

export type RingProduct = {
  id: MetalId;
  name: string;
  material: string;
  price: number;
  sku: string;
  url: string;
  image: string;
  widths: number[];
  defaultWidth: number;
  finish: 'standard' | 'black' | 'northern-lights' | 'rainbow';
  color: string;
  innerColor: string;
};

export const RINGS: RingProduct[] = [
  {
    id: 'silver',
    name: 'Hopea',
    material: 'Hopea',
    price: 290,
    sku: 'mk-volcano-h',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-silver.html',
    image: '/rings/silver.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#c5ccd3',
    innerColor: '#dfe5ea',
  },
  {
    id: 'titanium',
    name: 'Titaani',
    material: 'Titaani',
    price: 298,
    sku: 'mk-volcano-ti',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-titanium.html',
    image: '/rings/titanium.jpg',
    widths: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultWidth: 5,
    finish: 'standard',
    color: '#8e959c',
    innerColor: '#b7bec4',
  },
  {
    id: 'black-silver',
    name: 'Musta hopea',
    material: 'Hopea, musta rodinointi',
    price: 340,
    sku: 'mk-volcano-h-m',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-black-silver.html',
    image: '/rings/black-silver.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'black',
    color: '#1a1a1c',
    innerColor: '#2a2a2e',
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    material: 'Titaani, lämpökäsitelty',
    price: 348,
    sku: 'mk-volcano-ti-blue',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-titanium-northern-lights.html',
    image: '/rings/northern-lights.jpg',
    widths: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultWidth: 5,
    finish: 'northern-lights',
    color: '#1a4fa3',
    innerColor: '#2c63c4',
  },
  {
    id: 'white-gold',
    name: 'Valkokulta',
    material: 'Valkokulta 14K',
    price: 975,
    sku: 'mk-volcano-vk',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-white.html',
    image: '/rings/white-gold.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#e4e2dc',
    innerColor: '#f2f1ec',
  },
  {
    id: 'yellow-gold',
    name: 'Keltakulta',
    material: 'Keltakulta 14K',
    price: 975,
    sku: 'mk-volcano-kk',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-yellow.html',
    image: '/rings/yellow-gold.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#d7b15a',
    innerColor: '#ecc97a',
  },
  {
    id: 'rose-gold',
    name: 'Ruusukulta',
    material: 'Ruusukulta 14K',
    price: 975,
    sku: 'mk-volcano-rk',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-red.html',
    image: '/rings/rose-gold.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#c48772',
    innerColor: '#e0a894',
  },
  {
    id: 'white-black',
    name: 'Valkokulta, musta',
    material: 'Valkokulta, musta rodinointi',
    price: 1040,
    sku: 'mk-volcano-vk-m',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-black-rhodium.html',
    image: '/rings/white-black.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'black',
    color: '#161616',
    innerColor: '#2c2c2c',
  },
  {
    id: 'champagne',
    name: 'Samppanjakulta',
    material: 'Samppanjakulta 14K',
    price: 1105,
    sku: 'mk-volcano-sk',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-champagne.html',
    image: '/rings/champagne.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#c9a56a',
    innerColor: '#e0c08a',
  },
  {
    id: 'platinum',
    name: 'Platina',
    material: 'Platina',
    price: 1404,
    sku: 'mk-volcano-pt',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-sormus-platina.html',
    image: '/rings/platinum.jpg',
    widths: [3, 4, 5, 6, 7],
    defaultWidth: 5,
    finish: 'standard',
    color: '#d8d9dc',
    innerColor: '#f0f1f3',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    material: 'Kelta-, valko- ja ruusukulta',
    price: 1999,
    sku: 'volcano-rainbow',
    url: 'https://www.korupaja.fi/malmin-korupaja-volcano-rainbow-sormus-3-kultaa.html',
    image: '/rings/rainbow.jpg',
    widths: [3, 4, 5, 6, 7, 8],
    defaultWidth: 5,
    finish: 'rainbow',
    color: '#e8e4dc',
    innerColor: '#f4f1ea',
  },
];

export const FINGERS: { id: FingerId; label: string; short: string }[] = [
  { id: 'thumb', label: 'Peukalo', short: 'P' },
  { id: 'index', label: 'Etusormi', short: 'E' },
  { id: 'middle', label: 'Keskisormi', short: 'K' },
  { id: 'ring', label: 'Nimetön', short: 'N' },
  { id: 'pinky', label: 'Pikkusormi', short: 'Pi' },
];

export const FINGER_JOINTS: Record<
  FingerId,
  { mcp: number; pip: number; adjacent: number[] }
> = {
  thumb: { mcp: 2, pip: 3, adjacent: [5] },
  index: { mcp: 5, pip: 6, adjacent: [9] },
  middle: { mcp: 9, pip: 10, adjacent: [5, 13] },
  ring: { mcp: 13, pip: 14, adjacent: [9, 17] },
  pinky: { mcp: 17, pip: 18, adjacent: [13] },
};

export const formatPrice = (value: number): string =>
  new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
