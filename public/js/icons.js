/* ============================================================
   FitAI — Icons (SVG inline, stroke-based, 24x24)
   ============================================================ */
const ICONS = {
  logo: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" stroke-width="2.2"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
  zap: '<path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z"/>',
  flame: '<path d="M12 22c4.4 0 7-2.8 7-6.6 0-4.6-4.2-6.2-4.2-10.4-1.8.6-3 1.8-3.6 3.5-.8-.8-1.3-1.9-1.5-3-2.4 2-4.7 5.4-4.7 9.3C5 19.1 7.8 22 12 22z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z"/>',
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"/>',
  body: '<circle cx="12" cy="4.5" r="2.2"/><path d="M12 7v7l-3.5 7M12 14l3.5 7M6 9.5l6-1 6 1"/>',
  bolt: '<path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z"/>',
  weight: '<path d="M4 8h16l-1.5 12h-13L4 8zM9 8V5.5A3 3 0 0112 3a3 3 0 013 2.5V8"/>',
  machine: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9v6M12 9v6M16 9v6"/>',
  bar: '<rect x="2" y="9" width="20" height="6" rx="1.5"/><path d="M6 6v12M18 6v12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z"/>',
  library: '<path d="M4 4h5v16H4zM10 4h5v16h-5zM16.5 5l4 15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5"/><path d="M16 5.2a3.5 3.5 0 010 6.6M18 14.6c2.3.7 4 2.4 4 5.4"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
  edit: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  refresh: '<path d="M3 12a9 9 0 0115.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.3L3 16M3 21v-5h5"/>',
  play: '<path d="M6 4l14 8-14 8V4z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.9M6.6 6.6A16.6 16.6 0 002 12s3.5 7 10 7a10 10 0 004.9-1.3"/><path d="M9.9 9.9a3 3 0 104.2 4.2"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8a5 5 0 018 0"/><path d="M12 7v5"/>',
  ruler: '<path d="M21.3 8.7L15.3 2.7a1 1 0 00-1.4 0L2.7 13.9a1 1 0 000 1.4l6 6a1 1 0 001.4 0L21.3 10a1 1 0 000-1.4z"/><path d="M7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>',
  pin: '<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/>',
  tool: '<path d="M14.7 6.3a4.5 4.5 0 006 6l-9.6 9.6a2.1 2.1 0 01-3-3l9.6-9.6a4.5 4.5 0 00-3-3z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M17 20h4v1"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  pix: '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12 12 2.5z"/><path d="M8.5 8.5L12 12l3.5-3.5M8.5 15.5L12 12l3.5 3.5"/>',
  brain: '<path d="M9 3a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 001 5 3 3 0 003 4h1V3H9zM15 3a3 3 0 013 3 3 3 0 012 5 3 3 0 01-1 5 3 3 0 01-3 4h-1V3h0z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  external: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  fire: '<path d="M12 22c4.4 0 7-2.8 7-6.6 0-4.6-4.2-6.2-4.2-10.4-1.8.6-3 1.8-3.6 3.5-.8-.8-1.3-1.9-1.5-3-2.4 2-4.7 5.4-4.7 9.3C5 19.1 7.8 22 12 22z"/>',
  run: '<circle cx="13" cy="4" r="2"/><path d="M11 8.5L8 12l3 2 1.5 6M11 10.5l4 1.5 3-2M8 19l1.5-3"/>',
  strap: '<path d="M4 8h16M4 16h16"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>',
  tree: '<path d="M12 3l6 8h-4l4 6H6l4-6H6l6-8z"/><path d="M12 17v4"/>',
};

function icon(name, cls = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* Converte horários/valores em ícones de equipamento */
const EQUIP_ICON = {
  'Barra': 'bar', 'Halteres': 'dumbbell', 'Cabo/Polia': 'strap', 'Máquina': 'machine', 'Banco': 'bar',
  'Kettlebell': 'weight', 'Peso do corpo': 'body', 'Barra fixa': 'tree', 'Corda': 'activity',
  'Esteira': 'run', 'Bicicleta': 'activity', 'Remo': 'activity', 'Elástico': 'strap', 'Caneleira': 'weight',
  'Mochila': 'weight', 'Garrafa d\'água': 'weight', 'Bola': 'target', 'Caixa/Plyo box': 'grid', 'TRX': 'strap',
};
function equipIcon(equip) { return EQUIP_ICON[equip] || 'dumbbell'; }

const MUSCLE_ICON = {
  'Peito': 'dumbbell', 'Costas': 'tree', 'Pernas': 'run', 'Glúteos': 'body', 'Ombros': 'body',
  'Bíceps': 'dumbbell', 'Tríceps': 'dumbbell', 'Abdômen': 'target', 'Core': 'target', 'Lombar': 'body',
  'Panturrilha': 'run', 'Corpo inteiro': 'zap', 'Cardio': 'heart', 'Quadríceps': 'run',
  'Posterior de coxa': 'run', 'Quadril': 'body', 'Trapézio': 'body', 'Antebraço': 'dumbbell',
  'Oblíquos': 'target', 'Adutores': 'run', 'Abdutores': 'run', 'Flexores do quadril': 'run',
};
function muscleIcon(m) { return MUSCLE_ICON[m] || 'dumbbell'; }

window.ICONS = ICONS;
window.icon = icon;
window.equipIcon = equipIcon;
window.muscleIcon = muscleIcon;
