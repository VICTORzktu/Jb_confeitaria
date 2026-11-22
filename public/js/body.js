/* ============================================================
   Ilustrações anatômicas (SVG inline, sem dependências externas)
   Manequim neutro com o grupo muscular destacado em verde-limão.
   Usado nos cards da biblioteca e no detalhe do exercício.
   ============================================================ */
const BODY_BASE = `<g stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="var(--fig-line)" stroke-opacity=".26">
  <circle cx="50" cy="18" r="9.5" stroke-width="2.4"/>
  <path d="M44 27.5 44 33M56 27.5 56 33" stroke-width="2.6"/>
  <path d="M50 33v8" stroke-width="3.4"/>
  <path d="M28 45 50 40 72 45" stroke-width="9"/>
  <path d="M50 40c-7 1-13 4-14 9-1.2 6-1 13 .5 19" stroke-width="9"/>
  <path d="M50 40c7 1 13 4 14 9 1.2 6 1 13-.5 19" stroke-width="9"/>
  <path d="M36 88h28" stroke-width="10"/>
  <path d="M30 44 24 62 21 84M70 44l6 18 3 22" stroke-width="8"/>
  <path d="M21 84l-3 20M79 84l3 20" stroke-width="7"/>
  <path d="M43 94 41 124 39 152M57 94l2 30 2 28" stroke-width="12"/>
  <path d="M39 152l-4 7M61 152l4 7" stroke-width="8"/>
</g>`;

/* tipo: 'fill' (região preenchida) | 'stroke' (traço sobre o membro) */
const BODY_MUSCLES = {
  Peito: ['fill', '<ellipse cx="41.5" cy="53" rx="8.5" ry="7"/><ellipse cx="58.5" cy="53" rx="8.5" ry="7"/>'],
  Costas: ['fill', '<path d="M35 47h30l1 27h-32z"/>'],
  Pernas: ['stroke', '<path d="M43 95 41 124 39 151M57 95l2 28 2 27" stroke-width="12"/>'],
  Quadríceps: ['stroke', '<path d="M43 96 41 122M57 96l2 26" stroke-width="12"/>'],
  'Posterior de coxa': ['stroke', '<path d="M42 98 40.5 122M58 98l1.5 24" stroke-width="11" opacity=".5"/><path d="M40.5 122 38.6 150M59.5 122l1.9 28" stroke-width="11"/>'],
  Glúteos: ['fill', '<circle cx="43" cy="90" r="7.5"/><circle cx="57" cy="90" r="7.5"/>'],
  Ombros: ['fill', '<circle cx="29" cy="46" r="6.5"/><circle cx="71" cy="46" r="6.5"/>'],
  Bíceps: ['stroke', '<path d="M25.6 55 22.6 72M74.4 55l3 17" stroke-width="9"/>'],
  Tríceps: ['stroke', '<path d="M22 74 20 90M78 74l2 16" stroke-width="8"/>'],
  Abdômen: ['fill', '<rect x="42" y="64" width="16" height="24" rx="3.5"/>'],
  Core: ['fill', '<rect x="39" y="62" width="22" height="26" rx="5" opacity=".5"/><rect x="44" y="64" width="12" height="22" rx="3"/>'],
  Lombar: ['fill', '<rect x="40" y="66" width="20" height="16" rx="3"/>'],
  Panturrilha: ['stroke', '<path d="M41.2 128 40 146M58.8 128l1.2 18" stroke-width="10"/>'],
  'Corpo inteiro': ['stroke', '<circle cx="50" cy="18" r="9.5" stroke-width="2.4"/><path d="M28 45 50 40 72 45" stroke-width="9"/><path d="M50 40c-7 1-13 4-14 9-1.2 6-1 13 .5 19M50 40c7 1 13 4 14 9 1.2 6 1 13-.5 19" stroke-width="9"/><path d="M36 88h28" stroke-width="10"/><path d="M30 44 24 62 21 84M70 44l6 18 3 22" stroke-width="8"/><path d="M21 84l-3 20M79 84l3 20" stroke-width="7"/><path d="M43 94 41 124 39 152M57 94l2 30 2 28" stroke-width="12"/><path d="M39 152l-4 7M61 152l4 7" stroke-width="8"/>'],
  Cardio: ['stroke', '<path d="M50 56c-4-5.5-12.5-4.5-14.5 2-1.2 4.5 1.5 8.4 5.2 11.6L50 78l9.3-8.4c3.7-3.2 6.4-7.1 5.2-11.6-2-6.5-10.5-7.5-14.5-2z" stroke-width="2.6"/>'],
  Quadril: ['fill', '<path d="M36 86h28v9H36z"/>'],
  Trapézio: ['fill', '<path d="M50 32 38 48h24z"/>'],
  Antebraço: ['stroke', '<path d="M20.4 92 18.6 108M79.6 92l1.8 16" stroke-width="7"/>'],
  Oblíquos: ['fill', '<path d="M36.6 64h5.4l-1.2 24h-4.4zM58 64h5.4l.8 24h-4.4z"/>'],
  Adutores: ['stroke', '<path d="M46.8 97 45 121M53.2 97l1.8 24" stroke-width="7"/>'],
  Abdutores: ['stroke', '<path d="M43 95 38.6 117M57 95l4.4 22" stroke-width="8"/>'],
  'Flexores do quadril': ['fill', '<path d="M40 86h20v7H40z"/>'],
};

function muscleFigure(muscle) {
  const [kind, shape] = BODY_MUSCLES[muscle] || BODY_MUSCLES['Corpo inteiro'];
  const hl = kind === 'fill'
    ? `<g class="muscle-hl" fill="currentColor" fill-opacity=".85" stroke="none">${shape}</g>`
    : `<g class="muscle-hl" fill="none" stroke="currentColor" stroke-opacity=".85" stroke-linecap="round">${shape}</g>`;
  return `<svg viewBox="0 0 100 170" class="muscle-figure" aria-hidden="true">${BODY_BASE}${hl}</svg>`;
}

window.muscleFigure = muscleFigure;
