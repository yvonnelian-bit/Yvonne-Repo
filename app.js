/* =========================================================
   Chloe's Number Bond Kingdom
   A progressive number-bonds learning game:
   each Land = Learn (teach) -> Play (reinforce) -> Quiz (test)
   ========================================================= */

/* ---------------- Utilities ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ---------------- Sound ---------------- */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur, delay = 0, type = 'sine', vol = 0.15) {
  if (state.muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) { /* audio not available, ignore */ }
}
function playCorrect() { beep(523.25, 0.12, 0); beep(783.99, 0.18, 0.1); }
function playWrong() { beep(180, 0.25, 0, 'sawtooth', 0.1); }
function playWin() { beep(523, 0.12, 0); beep(659, 0.12, 0.12); beep(784, 0.12, 0.24); beep(1046, 0.25, 0.36); }
function playClick() { beep(700, 0.05, 0, 'square', 0.06); }

/* ---------------- Confetti ---------------- */
const CONFETTI_EMOJI = ['✨', '🌟', '💖', '🎀', '🦄', '🌈', '⭐'];
function burstConfetti(n = 26) {
  for (let i = 0; i < n; i++) {
    const piece = el('div', { class: 'confetti-piece' }, CONFETTI_EMOJI[randInt(0, CONFETTI_EMOJI.length - 1)]);
    piece.style.left = randInt(0, 100) + 'vw';
    const dur = (2 + Math.random() * 1.5).toFixed(2);
    piece.style.animationDuration = dur + 's';
    piece.style.fontSize = (16 + randInt(0, 16)) + 'px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), dur * 1000 + 100);
  }
}

/* ---------------- Progress persistence ---------------- */
const STORAGE_KEY = 'nbk_progress_v1';
const MUTE_KEY = 'nbk_muted';

function defaultProgress() {
  const p = {};
  LANDS.forEach(l => { p[l.id] = { stars: 0, learned: false, played: false }; });
  return p;
}
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const base = defaultProgress();
    if (raw) Object.keys(base).forEach(id => { if (raw[id]) base[id] = { ...base[id], ...raw[id] }; });
    return base;
  } catch (e) { return defaultProgress(); }
}
function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }

const state = {
  progress: null,
  muted: localStorage.getItem(MUTE_KEY) === '1',
  cleanupFns: []
};

function runCleanup() {
  state.cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
  state.cleanupFns = [];
}
function registerCleanup(fn) { state.cleanupFns.push(fn); }

function starsForRatio(ratio) {
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.6) return 2;
  return 1; // always at least 1 star for finishing - keep it encouraging for a 6 year old
}

function isUnlocked(idx) {
  if (idx === 0) return true;
  const prev = LANDS[idx - 1];
  return state.progress[prev.id].stars >= 1;
}

/* ---------------- Shared visual builders ---------------- */
function tenFrame(filled, total = 10) {
  const wrap = el('div', { class: 'ten-frame' });
  for (let i = 0; i < total; i++) {
    const cell = el('div', { class: 'cell' + (i < filled ? ' filled' : '') }, i < filled ? '⭐' : '');
    wrap.appendChild(cell);
  }
  return wrap;
}
function bondDiagram(sum, a, b, blankSlot = null) {
  const wrap = el('div', { class: 'bond-diagram' });
  wrap.appendChild(el('div', { class: 'bond-top' }, blankSlot === 'sum' ? '❓' : String(sum)));
  const lines = el('div', { class: 'bond-lines' }, [el('div', { class: 'line' }), el('div', { class: 'line' })]);
  wrap.appendChild(lines);
  const bottom = el('div', { class: 'bond-bottom' }, [
    el('div', { class: 'bond-circle a' }, blankSlot === 'a' ? '❓' : String(a)),
    el('div', { class: 'bond-circle b' }, blankSlot === 'b' ? '❓' : String(b))
  ]);
  wrap.appendChild(bottom);
  return wrap;
}
function emojiRow(emoji, count) {
  const wrap = el('div', { class: 'slide-visual' });
  for (let i = 0; i < count; i++) wrap.appendChild(el('span', { style: 'font-size:28px' }, emoji));
  return wrap;
}

/* ---------------- LANDS data ---------------- */
const LANDS = [
  {
    id: 'unicorn', name: 'Unicorn Meadow', tagline: 'Number Bonds to 5', emoji: '🦄',
    c1: '#ff9ecb', c2: '#ff5fa2', target: 5
  },
  {
    id: 'mermaid', name: 'Mermaid Lagoon', tagline: 'Number Bonds to 10', emoji: '🧜‍♀️',
    c1: '#7fe0ff', c2: '#1a9be0', target: 10
  },
  {
    id: 'fairy', name: 'Fairy Forest', tagline: 'Number Bonds to 20', emoji: '🧚', c1: '#b79bff', c2: '#6b3ff2',
    target: 20
  },
  {
    id: 'castle', name: 'Rainbow Castle', tagline: 'Doubles Facts', emoji: '👑', c1: '#ffd166', c2: '#ff9a00',
    target: 'doubles'
  },
  {
    id: 'butterfly', name: 'Butterfly Garden', tagline: 'Fact Families + Royal Test', emoji: '🦋', c1: '#8bedb8', c2: '#22b573',
    target: 'family'
  }
];

/* ================= ROOT RENDER ================= */
function init() {
  state.progress = loadProgress();
  renderRoot();
}

function totalStars() {
  return LANDS.reduce((sum, l) => sum + state.progress[l.id].stars, 0);
}

function renderRoot() {
  runCleanup();
  app.innerHTML = '';

  const decor = el('div', { class: 'bg-decor' });
  const decorEmojis = ['🦄', '🌈', '✨', '🧚', '💖', '🧜‍♀️', '🦋', '⭐'];
  decorEmojis.forEach((e, i) => {
    const s = el('span', {}, e);
    s.style.left = (i * 12 + randInt(0, 8)) + 'vw';
    s.style.top = randInt(0, 90) + 'vh';
    s.style.animationDelay = (i * 0.7) + 's';
    decor.appendChild(s);
  });
  app.appendChild(decor);

  const topbar = el('div', { class: 'topbar' }, [
    el('div', { class: 'brand' }, [
      el('span', { class: 'crown' }, '👑'),
      el('div', {}, [
        el('div', { class: 'brand-title' }, "Chloe's Number Bond Kingdom"),
        el('div', { class: 'brand-sub' }, 'A magical math adventure ✨')
      ])
    ]),
    el('div', { style: 'display:flex; gap:10px; align-items:center;' }, [
      el('div', { class: 'stat-pill' }, `⭐ ${totalStars()} / ${LANDS.length * 3}`),
      el('button', {
        class: 'icon-btn', title: 'Sound', onclick: () => {
          state.muted = !state.muted;
          localStorage.setItem(MUTE_KEY, state.muted ? '1' : '0');
          renderRoot();
        }
      }, state.muted ? '🔇' : '🔊')
    ])
  ]);
  app.appendChild(topbar);

  const map = el('div', { class: 'kingdom-map' });
  map.appendChild(el('div', { class: 'map-title' }, '🗺️ The Kingdom Map'));
  map.appendChild(el('div', { class: 'map-sub' }, 'Learn it, play it, then show what you know! Walk the path from land to land.'));

  const path = el('div', { class: 'land-path' });
  LANDS.forEach((land, idx) => {
    const unlocked = isUnlocked(idx);
    const prog = state.progress[land.id];
    const card = el('div', {
      class: 'land-card' + (unlocked ? '' : ' locked'),
      style: `background: linear-gradient(135deg, ${hexAlpha(land.c1,0.18)}, ${hexAlpha(land.c2,0.12)});`,
      onclick: () => { if (unlocked) { playClick(); openLand(land.id); } }
    }, [
      el('div', { class: 'land-emoji' }, land.emoji),
      el('div', { class: 'land-info' }, [
        el('div', { class: 'land-name' }, `${idx + 1}. ${land.name}`),
        el('div', { class: 'land-tagline' }, land.tagline),
        el('div', { class: 'land-stars' }, unlocked ? starString(prog.stars) : '')
      ]),
      unlocked ? null : el('div', { class: 'land-lock-badge' }, '🔒')
    ]);
    path.appendChild(card);
  });
  map.appendChild(path);
  app.appendChild(map);

  app.appendChild(el('footer', { class: 'credit' }, 'Made with 💖 for Chloe — keep learning, little princess!'));
}

function hexAlpha(hex, a) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function starString(n) {
  let s = '';
  for (let i = 0; i < 3; i++) s += i < n ? '⭐' : '☆';
  return s;
}

/* ================= LAND MODAL ================= */
function openLand(landId) {
  const land = LANDS.find(l => l.id === landId);
  const prog = state.progress[land.id];
  let activeTab = !prog.learned ? 'learn' : (!prog.played ? 'play' : 'quiz');

  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) closeLand(overlay); } });
  const modal = el('div', { class: 'land-modal' });

  const header = el('div', {
    class: 'land-modal-header',
    style: `background: linear-gradient(135deg, ${land.c1}, ${land.c2});`
  }, [
    el('span', { class: 'land-emoji-big' }, land.emoji),
    el('div', {}, [
      el('h2', {}, land.name),
      el('div', { class: 'tag' }, land.tagline)
    ]),
    el('button', { class: 'close-x', onclick: () => closeLand(overlay) }, '✕')
  ]);
  modal.appendChild(header);

  const tabs = el('div', { class: 'tabs' });
  const panel = el('div', { class: 'tab-panel' });

  function buildTabs() {
    tabs.innerHTML = '';
    const defs = [
      { id: 'learn', label: '📖 Learn', enabled: true },
      { id: 'play', label: '🎮 Play', enabled: prog.learned },
      { id: 'quiz', label: '📝 Quiz', enabled: prog.played }
    ];
    defs.forEach(d => {
      const btn = el('button', {
        class: 'tab-btn' + (activeTab === d.id ? ' active' : ''),
        disabled: !d.enabled ? 'disabled' : null,
        onclick: () => { if (d.enabled) { activeTab = d.id; buildTabs(); renderPanel(); } }
      }, d.label);
      tabs.appendChild(btn);
    });
  }

  function renderPanel() {
    runCleanup();
    panel.innerHTML = '';
    if (activeTab === 'learn') renderLearnTab(panel, land, () => {
      prog.learned = true; saveProgress(); activeTab = 'play'; buildTabs(); renderPanel();
    });
    else if (activeTab === 'play') renderPlayTab(panel, land, () => {
      prog.played = true; saveProgress(); buildTabs();
      // stay on play result screen; user can navigate to quiz tab
    });
    else if (activeTab === 'quiz') renderQuizTab(panel, land, (stars) => {
      if (stars > prog.stars) { prog.stars = stars; saveProgress(); }
    });
  }

  buildTabs();
  renderPanel();

  modal.appendChild(tabs);
  modal.appendChild(panel);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
function closeLand(overlay) {
  runCleanup();
  overlay.remove();
  renderRoot();
}

/* ================= LEARN TAB ================= */
function learnSlidesFor(land) {
  switch (land.id) {
    case 'unicorn': return [
      {
        title: 'Welcome to Unicorn Meadow! 🦄',
        body: 'A "number bond" shows two parts that join to make a whole number. Let’s learn bonds to 5!',
        visual: () => emojiRow('🦄', 5)
      },
      { title: '4 and 1 make 5', body: '4 unicorns plus 1 more unicorn makes 5 unicorns altogether!', visual: () => bondDiagram(5, 4, 1) },
      { title: '3 and 2 make 5', body: 'Look, the parts can switch around and still make 5!', visual: () => bondDiagram(5, 3, 2) },
      { title: '5 and 0 make 5', body: 'Zero means "none". 5 plus nothing more is still 5.', visual: () => bondDiagram(5, 5, 0) },
      { title: 'Try it yourself!', body: 'Slide to split 5 flowers into two groups.', visual: () => splitterWidget(5, '🌸') }
    ];
    case 'mermaid': return [
      { title: 'Dive into Mermaid Lagoon! 🧜‍♀️', body: 'A ten-frame has 10 boxes for 10 pearls. Let’s learn bonds to 10!', visual: () => tenFrame(0) },
      { title: '6 and 4 make 10', body: 'Fill 6 boxes, then 4 more boxes finishes the ten-frame!', visual: () => tenFrame(6) },
      { title: '8 and 2 make 10', body: 'Just a little more needed to reach 10.', visual: () => tenFrame(8) },
      { title: '5 and 5 make 10', body: 'Twin pearls! 5 and 5 is a double.', visual: () => tenFrame(5) },
      { title: 'Try it yourself!', body: 'Slide to fill the ten-frame and see the bond.', visual: () => splitterTenFrame(10) }
    ];
    case 'fairy': return [
      { title: 'Flutter into Fairy Forest! 🧚', body: 'Teen numbers hide a 10 inside! Let’s stretch our bonds to 20.', visual: () => el('div', { class: 'slide-visual' }, [tenFrame(10), tenFrame(0)]) },
      { title: '10 and 10 make 20', body: 'Two full ten-frames make 20!', visual: () => el('div', { class: 'slide-visual' }, [tenFrame(10), tenFrame(10)]) },
      { title: '12 and 8 make 20', body: 'One frame full (10) plus 2 more, and a frame with 8.', visual: () => el('div', { class: 'slide-visual' }, [tenFrame(10), tenFrame(8)]) },
      { title: '15 and 5 make 20', body: 'A full frame plus 5, and a frame with 5.', visual: () => el('div', { class: 'slide-visual' }, [tenFrame(10), tenFrame(5)]) },
      { title: 'Try it yourself!', body: 'Slide to explore bonds to 20.', visual: () => splitterTenFrame(20) }
    ];
    case 'castle': return [
      { title: 'Welcome to Rainbow Castle! 👑', body: 'Doubles are bonds where both parts are the SAME, like twins!', visual: () => bondDiagram(6, 3, 3) },
      { title: '5 + 5 = 10', body: 'A double is easy to remember once you know it!', visual: () => bondDiagram(10, 5, 5) },
      { title: '7 + 7 = 14', body: 'Bigger doubles work the same way.', visual: () => bondDiagram(14, 7, 7) },
      { title: 'Near doubles', body: '6 + 7 is just 6 + 6, plus 1 more! That makes 13.', visual: () => bondDiagram(13, 6, 7) },
      { title: 'Try it yourself!', body: 'Tap each crown to reveal the doubles fact.', visual: () => doublesRevealWidget() }
    ];
    case 'butterfly': return [
      { title: 'Land in Butterfly Garden! 🦋', body: 'A fact family is 3 numbers that make 4 related facts, like butterfly friends!', visual: () => el('div', { class: 'slide-visual' }, el('span',{style:'font-size:40px'},'🦋')) },
      { title: 'Family of 3, 4, 7', body: '3+4=7  •  4+3=7  •  7-3=4  •  7-4=3', visual: () => bondDiagram(7, 3, 4) },
      { title: 'Family of 6, 8, 14', body: '6+8=14  •  8+6=14  •  14-6=8  •  14-8=6', visual: () => bondDiagram(14, 6, 8) },
      { title: 'Addition and subtraction are friends!', body: 'If 9 = 5 + 4, then 9 - 5 = 4 and 9 - 4 = 5 too.', visual: () => bondDiagram(9, 5, 4) },
      { title: 'Try it yourself!', body: 'Press the button to make a new butterfly family.', visual: () => familyRevealWidget() }
    ];
    default: return [];
  }
}

function splitterWidget(total, emoji) {
  const wrap = el('div', {});
  const row = el('div', { class: 'slide-visual' });
  const label = el('div', { style: 'font-weight:800; color:#7b3ff2; margin-top:8px; font-size:17px;' });
  const range = el('input', { type: 'range', min: '0', max: String(total), value: '0', style: 'width:220px;' });
  function update(v) {
    row.innerHTML = '';
    for (let i = 0; i < v; i++) row.appendChild(el('span', { style: 'font-size:26px; color:#ff5fa2' }, emoji));
    for (let i = v; i < total; i++) row.appendChild(el('span', { style: 'font-size:26px; opacity:.35' }, emoji));
    label.textContent = `${v} and ${total - v} make ${total}`;
  }
  range.addEventListener('input', () => update(+range.value));
  update(0);
  wrap.appendChild(row);
  wrap.appendChild(el('div', { style: 'display:flex; justify-content:center; margin-top:10px;' }, range));
  wrap.appendChild(label);
  return wrap;
}

function splitterTenFrame(total) {
  const wrap = el('div', {});
  const frames = el('div', { class: 'slide-visual' });
  const label = el('div', { style: 'font-weight:800; color:#7b3ff2; margin-top:8px; font-size:17px;' });
  const range = el('input', { type: 'range', min: '0', max: String(total), value: '0', style: 'width:220px;' });
  function update(v) {
    frames.innerHTML = '';
    if (total <= 10) {
      frames.appendChild(tenFrame(v, total));
    } else {
      frames.appendChild(tenFrame(Math.min(10, v)));
      frames.appendChild(tenFrame(Math.max(0, Math.min(10, v - 10))));
    }
    label.textContent = `${v} and ${total - v} make ${total}`;
  }
  range.addEventListener('input', () => update(+range.value));
  update(0);
  wrap.appendChild(frames);
  wrap.appendChild(el('div', { style: 'display:flex; justify-content:center; margin-top:10px;' }, range));
  wrap.appendChild(label);
  return wrap;
}

function doublesRevealWidget() {
  const wrap = el('div', { class: 'slide-visual' });
  for (let n = 1; n <= 10; n++) {
    const btn = el('button', { class: 'choice-btn', style: 'min-width:64px;' }, `${n}+${n}`);
    btn.addEventListener('click', () => {
      btn.textContent = `${n}+${n}=${n * 2}`;
      btn.classList.add('correct');
      playCorrect();
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

function familyRevealWidget() {
  const wrap = el('div', {});
  const out = el('div', { style: 'font-size:16px; font-weight:700; margin-top:12px; line-height:1.8;' });
  const btn = el('button', { class: 'big-btn' }, '🦋 New Family');
  function gen() {
    const sum = randInt(5, 14);
    const a = randInt(1, sum - 1);
    const b = sum - a;
    out.innerHTML = `<div style="font-size:20px;margin-bottom:8px;">${a} , ${b} , ${sum}</div>` +
      `${a} + ${b} = ${sum}<br>${b} + ${a} = ${sum}<br>${sum} - ${a} = ${b}<br>${sum} - ${b} = ${a}`;
    playClick();
  }
  btn.addEventListener('click', gen);
  gen();
  wrap.appendChild(out);
  wrap.appendChild(el('div', { style: 'display:flex; justify-content:center; margin-top:10px;' }, btn));
  return wrap;
}

function renderLearnTab(panel, land, onFinish) {
  const slides = learnSlidesFor(land);
  let idx = 0;

  const slideBox = el('div', { class: 'slide' });
  const dots = el('div', { class: 'dots' });
  slides.forEach(() => dots.appendChild(el('span', {})));

  const prevBtn = el('button', { class: 'big-btn secondary' }, '⬅ Back');
  const nextBtn = el('button', { class: 'big-btn' }, 'Next ➡');

  function render() {
    slideBox.innerHTML = '';
    const s = slides[idx];
    slideBox.appendChild(el('h3', {}, s.title));
    slideBox.appendChild(s.visual());
    slideBox.appendChild(el('p', {}, s.body));
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === idx));
    prevBtn.disabled = idx === 0;
    nextBtn.textContent = idx === slides.length - 1 ? "I've got it! 🎉" : 'Next ➡';
  }
  prevBtn.addEventListener('click', () => { if (idx > 0) { idx--; playClick(); render(); } });
  nextBtn.addEventListener('click', () => {
    if (idx < slides.length - 1) { idx++; playClick(); render(); }
    else { playWin(); burstConfetti(16); onFinish(); }
  });

  render();
  panel.appendChild(slideBox);
  panel.appendChild(el('div', { class: 'slide-nav' }, [prevBtn, dots, nextBtn]));
}

/* ================= PLAY TAB ================= */
function renderPlayTab(panel, land, onFinish) {
  switch (land.id) {
    case 'unicorn': return playMatchGame(panel, land, onFinish);
    case 'mermaid': return playTenFrameFill(panel, land, onFinish);
    case 'fairy': return playFireflyCatch(panel, land, onFinish);
    case 'castle': return playDoublesMatch(panel, land, onFinish);
    case 'butterfly': return playTriangleBuilder(panel, land, onFinish);
  }
}

function pairsForTarget(target) {
  const pairs = [];
  for (let a = 0; a <= Math.floor(target / 2); a++) {
    const b = target - a;
    if (a === b && pairs.some(p => p[0] === a)) continue;
    pairs.push([a, b]);
  }
  return pairs;
}

/* --- Land 1: Flower Pair Match (click-select matching pairs that sum to 5) --- */
function playMatchGame(panel, land, onFinish) {
  const pairs = pairsForTarget(land.target); // e.g. [[0,5],[1,4],[2,3]]
  let values = shuffle(pairs.flat());
  let matchedCount = 0;
  let selected = null;

  panel.appendChild(el('div', { class: 'game-status' }, [
    el('div', {}, '🌸 Tap two flowers that add to make'),
    el('div', { class: 'game-target' }, String(land.target))
  ]));
  const grid = el('div', { class: 'card-grid' });
  const feedback = el('div', { class: 'feedback-banner' });

  function buildCards() {
    grid.innerHTML = '';
    values.forEach((val, i) => {
      const card = el('div', { class: 'flip-card', 'data-i': i }, `${val} 🌸`);
      card.addEventListener('click', () => onCardClick(i, card));
      grid.appendChild(card);
    });
  }

  function onCardClick(i, card) {
    if (card.classList.contains('matched') || card.classList.contains('selectedlock')) return;
    if (selected === null) {
      selected = { i, card, val: values[i] };
      card.classList.add('selected');
      playClick();
      return;
    }
    if (selected.i === i) return;
    const a = selected.val, b = values[i];
    if (a + b === land.target) {
      selected.card.classList.remove('selected');
      selected.card.classList.add('matched');
      card.classList.add('matched');
      matchedCount++;
      playCorrect();
      burstConfetti(8);
      selected = null;
      if (matchedCount === pairs.length) {
        setTimeout(() => showPlayWin(panel, land, onFinish, () => playMatchGame(panel, land, onFinish)), 500);
      }
    } else {
      card.classList.add('wrong');
      selected.card.classList.add('wrong');
      playWrong();
      const s = selected;
      setTimeout(() => { card.classList.remove('wrong'); s.card.classList.remove('wrong', 'selected'); }, 400);
      selected = null;
    }
  }

  buildCards();
  panel.appendChild(grid);
  panel.appendChild(feedback);
}

/* --- Land 2: Fill the Ten-Frame (choose the bubble that completes 10) --- */
function playTenFrameFill(panel, land, onFinish) {
  let score = 0;
  const roundsNeeded = 6;
  const status = el('div', { class: 'game-status' }, [
    el('div', {}, '🐚 Pick the shell that completes the ten-frame!'),
    el('div', { class: 'game-target' }, `${score}/${roundsNeeded}`)
  ]);
  const frameBox = el('div', { style: 'display:flex; justify-content:center; margin:14px 0;' });
  const bubbleBox = el('div', { class: 'mermaid-bubbles' });
  const feedback = el('div', { class: 'feedback-banner' });

  panel.appendChild(status);
  panel.appendChild(frameBox);
  panel.appendChild(bubbleBox);
  panel.appendChild(feedback);

  function newRound() {
    feedback.textContent = '';
    feedback.className = 'feedback-banner';
    const filled = randInt(1, 9);
    const correct = 10 - filled;
    frameBox.innerHTML = '';
    frameBox.appendChild(tenFrame(filled));

    const choices = new Set([correct]);
    while (choices.size < 4) {
      const d = correct + randInt(-3, 3);
      if (d >= 0 && d <= 10) choices.add(d);
    }
    const list = shuffle([...choices]);
    bubbleBox.innerHTML = '';
    list.forEach(v => {
      const b = el('div', { class: 'bubble' }, String(v));
      b.addEventListener('click', () => {
        if (v === correct) {
          playCorrect(); burstConfetti(6);
          feedback.textContent = `Yes! ${filled} and ${correct} make 10! 🐚✨`;
          feedback.className = 'feedback-banner good';
          score++;
          status.querySelector('.game-target').textContent = `${score}/${roundsNeeded}`;
          const cells = frameBox.querySelectorAll('.cell');
          for (let i = filled; i < 10; i++) cells[i].classList.add('filled');
          if (score >= roundsNeeded) {
            setTimeout(() => showPlayWin(panel, land, onFinish, () => playTenFrameFill(panel, land, onFinish)), 700);
          } else {
            setTimeout(newRound, 900);
          }
        } else {
          playWrong();
          b.classList.add('wrong');
          feedback.textContent = 'Not quite, try again!';
          feedback.className = 'feedback-banner bad';
          setTimeout(() => b.classList.remove('wrong'), 400);
        }
      });
      bubbleBox.appendChild(b);
    });
  }
  newRound();
}

/* --- Land 3: Firefly Catch (bonds to 20, click the correct firefly among decoys, gentle timer) --- */
function playFireflyCatch(panel, land, onFinish) {
  let score = 0;
  const roundsNeeded = 6;
  const status = el('div', { class: 'game-status' }, [
    el('div', {}, '✨ Catch the firefly with the missing number!'),
    el('div', { class: 'game-target' }, `${score}/${roundsNeeded}`)
  ]);
  const field = el('div', { class: 'firefly-field' });
  const targetLabel = el('div', { class: 'firefly-target' }, '');
  const timerBar = el('div', { class: 'firefly-timer' }, el('div', { class: 'firefly-timer-fill' }));
  field.appendChild(targetLabel);
  field.appendChild(timerBar);
  const feedback = el('div', { class: 'feedback-banner' });

  panel.appendChild(status);
  panel.appendChild(field);
  panel.appendChild(feedback);

  let driftInterval = null;
  let roundTimeout = null;
  const ROUND_MS = 8000;

  function randomPos() { return { top: randInt(8, 70), left: randInt(4, 78) }; }

  function placeFireflies(nodes) {
    nodes.forEach(n => {
      const p = randomPos();
      n.style.top = p.top + '%';
      n.style.left = p.left + '%';
    });
  }

  function newRound() {
    feedback.textContent = '';
    feedback.className = 'feedback-banner';
    const shown = randInt(1, 19);
    const correct = 20 - shown;
    targetLabel.textContent = `${shown} + ⬜ = 20`;

    const values = new Set([correct]);
    while (values.size < 5) {
      const d = randInt(0, 20);
      if (d !== correct) values.add(d);
    }
    const list = shuffle([...values]);

    field.querySelectorAll('.firefly').forEach(f => f.remove());
    const nodes = list.map(v => {
      const f = el('div', { class: 'firefly' }, String(v));
      f.addEventListener('click', () => {
        if (v === correct) {
          playCorrect(); burstConfetti(6);
          score++;
          status.querySelector('.game-target').textContent = `${score}/${roundsNeeded}`;
          feedback.textContent = `Sparkly! ${shown} + ${correct} = 20 🌟`;
          feedback.className = 'feedback-banner good';
          clearTimeout(roundTimeout);
          if (score >= roundsNeeded) {
            clearInterval(driftInterval);
            setTimeout(() => showPlayWin(panel, land, onFinish, () => playFireflyCatch(panel, land, onFinish)), 700);
          } else {
            setTimeout(newRound, 800);
          }
        } else {
          playWrong();
          f.classList.add('wrong');
          setTimeout(() => f.classList.remove('wrong'), 300);
        }
      });
      field.appendChild(f);
      return f;
    });
    placeFireflies(nodes);

    clearInterval(driftInterval);
    driftInterval = setInterval(() => placeFireflies(nodes), 2600);

    const fill = timerBar.querySelector('.firefly-timer-fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    requestAnimationFrame(() => {
      fill.style.transition = `width ${ROUND_MS}ms linear`;
      fill.style.width = '0%';
    });
    clearTimeout(roundTimeout);
    roundTimeout = setTimeout(() => {
      feedback.textContent = "Time's up, let's try another one!";
      feedback.className = 'feedback-banner bad';
      newRound();
    }, ROUND_MS);
  }

  registerCleanup(() => { clearInterval(driftInterval); clearTimeout(roundTimeout); });
  newRound();
}

/* --- Land 4: Double Match (click-select cards: expression <-> sum) --- */
function playDoublesMatch(panel, land, onFinish) {
  const ns = shuffle([2, 3, 4, 5, 6, 7]).slice(0, 5);
  const cards = [];
  ns.forEach(n => {
    cards.push({ label: `${n}+${n}`, key: n });
    cards.push({ label: String(n * 2), key: n });
  });
  const values = shuffle(cards);
  let matchedCount = 0;
  let selected = null;

  panel.appendChild(el('div', { class: 'game-status' }, [
    el('div', {}, '👑 Match each double to its answer!'),
    el('div', { class: 'game-target' }, `${matchedCount}/${ns.length}`)
  ]));
  const grid = el('div', { class: 'card-grid' });
  panel.appendChild(grid);
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(feedback);

  values.forEach((c, i) => {
    const card = el('div', { class: 'flip-card', style: 'background:linear-gradient(180deg,#ffd166,#ff9a00);' }, c.label);
    card.addEventListener('click', () => onClick(i, card));
    grid.appendChild(card);
  });

  function onClick(i, card) {
    if (card.classList.contains('matched')) return;
    if (selected === null) {
      selected = { i, card };
      card.classList.add('selected');
      playClick();
      return;
    }
    if (selected.i === i) return;
    const a = values[selected.i], b = values[i];
    const isPair = a.key === b.key && a.label !== b.label;
    if (isPair) {
      selected.card.classList.remove('selected');
      selected.card.classList.add('matched');
      card.classList.add('matched');
      matchedCount++;
      playCorrect(); burstConfetti(8);
      panel.querySelector('.game-target').textContent = `${matchedCount}/${ns.length}`;
      selected = null;
      if (matchedCount === ns.length) {
        setTimeout(() => showPlayWin(panel, land, onFinish, () => playDoublesMatch(panel, land, onFinish)), 500);
      }
    } else {
      card.classList.add('wrong');
      selected.card.classList.add('wrong');
      playWrong();
      const s = selected;
      setTimeout(() => { card.classList.remove('wrong'); s.card.classList.remove('wrong', 'selected'); }, 400);
      selected = null;
    }
  }
}

/* --- Land 5: Butterfly Triangle Builder (fact family: fill missing corner) --- */
function triangleSVG(a, b, sum, blank) {
  const wrap = el('div', { class: 'triangle-wrap' });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 220 190');
  svg.setAttribute('class', 'tri-svg');
  svg.innerHTML = `
    <polygon points="110,15 20,175 200,175" fill="none" stroke="#7b3ff2" stroke-width="4" stroke-dasharray="8,6"/>
  `;
  function node(val, cx, cy, isBlank) {
    const g = document.createElementNS(svgNS, 'g');
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', 30);
    circle.setAttribute('fill', isBlank ? '#fff' : '#ffd6ec');
    circle.setAttribute('stroke', isBlank ? '#7b3ff2' : '#ff2e93');
    circle.setAttribute('stroke-width', '4');
    if (isBlank) circle.setAttribute('stroke-dasharray', '6,5');
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', cx); text.setAttribute('y', cy + 8);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '26'); text.setAttribute('font-weight', '800');
    text.setAttribute('fill', isBlank ? '#7b3ff2' : '#ff2e93');
    text.textContent = isBlank ? '❓' : val;
    g.appendChild(circle); g.appendChild(text);
    return g;
  }
  svg.appendChild(node(sum, 110, 15, blank === 'sum'));
  svg.appendChild(node(a, 20, 175, blank === 'a'));
  svg.appendChild(node(b, 200, 175, blank === 'b'));
  wrap.appendChild(svg);
  return wrap;
}

function playTriangleBuilder(panel, land, onFinish) {
  let score = 0;
  const roundsNeeded = 6;
  panel.appendChild(el('div', { class: 'game-status' }, [
    el('div', {}, '🦋 Complete the fact-family triangle!'),
    el('div', { class: 'game-target' }, `${score}/${roundsNeeded}`)
  ]));
  const triHolder = el('div', {});
  const choicesHolder = el('div', { class: 'tri-choices' });
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(triHolder);
  panel.appendChild(choicesHolder);
  panel.appendChild(feedback);

  function newRound() {
    feedback.textContent = '';
    feedback.className = 'feedback-banner';
    const sum = randInt(5, 14);
    const a = randInt(1, sum - 1);
    const b = sum - a;
    const blank = shuffle(['sum', 'a', 'b'])[0];
    const correct = blank === 'sum' ? sum : (blank === 'a' ? a : b);

    triHolder.innerHTML = '';
    triHolder.appendChild(triangleSVG(a, b, sum, blank));

    const choiceSet = new Set([correct]);
    while (choiceSet.size < 4) {
      const d = correct + randInt(-4, 4);
      if (d >= 0 && d <= 20 && d !== correct) choiceSet.add(d);
    }
    choicesHolder.innerHTML = '';
    shuffle([...choiceSet]).forEach(v => {
      const btn = el('button', { class: 'choice-btn' }, String(v));
      btn.addEventListener('click', () => {
        if (v === correct) {
          btn.classList.add('correct');
          playCorrect(); burstConfetti(6);
          feedback.textContent = 'Butterfly magic! That’s correct! 🦋';
          feedback.className = 'feedback-banner good';
          score++;
          panel.querySelector('.game-target').textContent = `${score}/${roundsNeeded}`;
          if (score >= roundsNeeded) {
            setTimeout(() => showPlayWin(panel, land, onFinish, () => playTriangleBuilder(panel, land, onFinish)), 700);
          } else {
            setTimeout(newRound, 900);
          }
        } else {
          btn.classList.add('incorrect');
          playWrong();
          feedback.textContent = 'Try another one!';
          feedback.className = 'feedback-banner bad';
          setTimeout(() => btn.classList.remove('incorrect'), 400);
        }
      });
      choicesHolder.appendChild(btn);
    });
  }
  newRound();
}

function showPlayWin(panel, land, onFinish, replayFn) {
  playWin(); burstConfetti(30);
  onFinish();
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'result-emoji' }, '🎉'),
    el('h3', {}, 'Great playing!'),
    el('div', { class: 'result-msg' }, `You practiced ${land.tagline.toLowerCase()} like a champ!`),
    el('div', { class: 'result-actions' }, [
      el('button', { class: 'big-btn secondary', onclick: replayFn }, '🔁 Play Again'),
      el('button', {
        class: 'big-btn', onclick: () => {
          const tabBtns = panel.parentElement.parentElement.querySelectorAll('.tab-btn');
          tabBtns[2] && tabBtns[2].click();
        }
      }, '📝 Take the Quiz')
    ])
  ]));
}

/* ================= QUIZ TAB ================= */
function renderQuizTab(panel, land, onFinishStars) {
  switch (land.id) {
    case 'unicorn': return quizMultipleChoice(panel, land, onFinishStars);
    case 'mermaid': return quizFillIn(panel, land, onFinishStars);
    case 'fairy': return quizTimed(panel, land, onFinishStars);
    case 'castle': return quizTrueFalse(panel, land, onFinishStars);
    case 'butterfly': return quizFinaleMixed(panel, land, onFinishStars);
  }
}

function genMCBondQuestion(target) {
  const a = randInt(0, target);
  const b = target - a;
  const choiceSet = new Set([b]);
  while (choiceSet.size < 4) {
    const d = b + randInt(-3, 3);
    if (d >= 0 && d <= target) choiceSet.add(d);
  }
  return { prompt: `${a} + ⬜ = ${target}`, choices: shuffle([...choiceSet]), answer: b };
}

function quizMultipleChoice(panel, land, onFinishStars) {
  const TOTAL = 6;
  let qi = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' });
  const opts = el('div', { class: 'quiz-options' });
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [bar, qBox, opts, feedback]));

  function next() {
    if (qi >= TOTAL) return finish();
    bar.querySelector('.quiz-progress-fill').style.width = `${(qi / TOTAL) * 100}%`;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    const q = genMCBondQuestion(land.target);
    qBox.textContent = `🦄 ${q.prompt}`;
    opts.innerHTML = '';
    q.choices.forEach(c => {
      const btn = el('button', { class: 'opt-btn' }, String(c));
      btn.addEventListener('click', () => {
        [...opts.children].forEach(b => b.disabled = true);
        if (c === q.answer) {
          btn.classList.add('correct'); playCorrect(); correct++;
          feedback.textContent = 'Yay! That’s right! ✨'; feedback.className = 'feedback-banner good';
        } else {
          btn.classList.add('incorrect'); playWrong();
          feedback.textContent = `So close! The answer was ${q.answer}.`; feedback.className = 'feedback-banner bad';
          [...opts.children].find(b => b.textContent == q.answer)?.classList.add('correct');
        }
        qi++;
        setTimeout(next, 1100);
      });
      opts.appendChild(btn);
    });
  }

  function finish() {
    bar.querySelector('.quiz-progress-fill').style.width = '100%';
    const stars = starsForRatio(correct / TOTAL);
    showQuizResult(panel, land, stars, correct, TOTAL, () => quizMultipleChoice(panel, land, onFinishStars));
    onFinishStars(stars);
  }
  next();
}

function genFillBondQuestion(target) {
  const a = randInt(1, target - 1);
  const b = target - a;
  if (Math.random() < 0.5) return { prompt: `${a} + ___ = ${target}`, answer: b };
  return { prompt: `___ + ${b} = ${target}`, answer: a };
}

function quizFillIn(panel, land, onFinishStars) {
  const TOTAL = 6;
  let qi = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' });
  const row = el('div', { class: 'quiz-input-row' });
  const input = el('input', { type: 'number', inputmode: 'numeric' });
  const checkBtn = el('button', { class: 'big-btn' }, 'Check ✔');
  row.appendChild(input); row.appendChild(checkBtn);
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [bar, qBox, row, feedback]));

  let current = null;
  function next() {
    if (qi >= TOTAL) return finish();
    bar.querySelector('.quiz-progress-fill').style.width = `${(qi / TOTAL) * 100}%`;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    input.value = ''; input.disabled = false; checkBtn.disabled = false;
    current = genFillBondQuestion(land.target);
    qBox.textContent = `🧜‍♀️ ${current.prompt}`;
    input.focus();
  }
  function submit() {
    if (input.disabled) return;
    const val = parseInt(input.value, 10);
    input.disabled = true; checkBtn.disabled = true;
    if (val === current.answer) {
      playCorrect(); correct++;
      feedback.textContent = 'Splashing success! Correct! 🐚'; feedback.className = 'feedback-banner good';
    } else {
      playWrong();
      feedback.textContent = `The answer was ${current.answer}. Keep swimming!`; feedback.className = 'feedback-banner bad';
    }
    qi++;
    setTimeout(next, 1100);
  }
  checkBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  function finish() {
    bar.querySelector('.quiz-progress-fill').style.width = '100%';
    const stars = starsForRatio(correct / TOTAL);
    showQuizResult(panel, land, stars, correct, TOTAL, () => quizFillIn(panel, land, onFinishStars));
    onFinishStars(stars);
  }
  next();
}

function quizTimed(panel, land, onFinishStars) {
  const DURATION = 45;
  let timeLeft = DURATION;
  let correct = 0, attempted = 0;
  const timerRow = el('div', { class: 'timer-strip' }, `⏳ ${timeLeft}s`);
  const qBox = el('div', { class: 'quiz-question' });
  const opts = el('div', { class: 'quiz-options' });
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [timerRow, qBox, opts, feedback]));

  let ticking = null;
  let locked = false;

  function next() {
    if (locked) return;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    const q = genMCBondQuestion(land.target);
    qBox.textContent = `🧚 ${q.prompt}`;
    opts.innerHTML = '';
    q.choices.forEach(c => {
      const btn = el('button', { class: 'opt-btn' }, String(c));
      btn.addEventListener('click', () => {
        if (locked) return;
        attempted++;
        if (c === q.answer) { playCorrect(); correct++; feedback.textContent = 'Fairy fast and correct! ✨'; feedback.className = 'feedback-banner good'; }
        else { playWrong(); feedback.textContent = `Answer: ${q.answer}`; feedback.className = 'feedback-banner bad'; }
        next();
      });
      opts.appendChild(btn);
    });
  }

  ticking = setInterval(() => {
    timeLeft--;
    timerRow.textContent = `⏳ ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(ticking);
      locked = true;
      finish();
    }
  }, 1000);
  registerCleanup(() => clearInterval(ticking));

  function finish() {
    opts.innerHTML = '';
    qBox.textContent = "Time's up! ⏰";
    const ratio = attempted > 0 ? correct / attempted : 0;
    // bonus consideration for volume answered, but ratio-based keeps it kind
    const stars = attempted === 0 ? 1 : starsForRatio(ratio >= 0.6 ? Math.max(ratio, Math.min(1, correct / 6)) : ratio);
    showQuizResult(panel, land, stars, correct, attempted || 1, () => quizTimed(panel, land, onFinishStars), true);
    onFinishStars(stars);
  }
  next();
}

function genTFQuestion() {
  const n = randInt(1, 10);
  const real = n + n;
  const isTrue = Math.random() < 0.5;
  let shown = real;
  if (!isTrue) {
    const off = shuffle([-4, -2, 2, 4]).find(o => real + o >= 0);
    shown = real + off;
  }
  return { prompt: `${n} + ${n} = ${shown}`, answer: isTrue };
}

function quizTrueFalse(panel, land, onFinishStars) {
  const TOTAL = 8;
  let qi = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' });
  const row = el('div', { class: 'tf-row' });
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [bar, qBox, row, feedback]));

  let current = null;
  function next() {
    if (qi >= TOTAL) return finish();
    bar.querySelector('.quiz-progress-fill').style.width = `${(qi / TOTAL) * 100}%`;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    current = genTFQuestion();
    qBox.textContent = `👑 ${current.prompt}`;
    row.innerHTML = '';
    const tBtn = el('button', { class: 'tf-btn true-btn' }, '✔ True');
    const fBtn = el('button', { class: 'tf-btn false-btn' }, '✘ False');
    function answer(choice) {
      tBtn.disabled = true; fBtn.disabled = true;
      if (choice === current.answer) {
        playCorrect(); correct++;
        feedback.textContent = 'Royally correct! 👑'; feedback.className = 'feedback-banner good';
      } else {
        playWrong();
        feedback.textContent = `Actually ${current.answer ? 'True' : 'False'}!`; feedback.className = 'feedback-banner bad';
      }
      qi++;
      setTimeout(next, 1000);
    }
    tBtn.addEventListener('click', () => answer(true));
    fBtn.addEventListener('click', () => answer(false));
    row.appendChild(tBtn); row.appendChild(fBtn);
  }

  function finish() {
    bar.querySelector('.quiz-progress-fill').style.width = '100%';
    const stars = starsForRatio(correct / TOTAL);
    showQuizResult(panel, land, stars, correct, TOTAL, () => quizTrueFalse(panel, land, onFinishStars));
    onFinishStars(stars);
  }
  next();
}

/* --- Land 5 finale: Royal Test, mixed question types drawn from all lands --- */
function genFamilyQuestionMC() {
  const sum = randInt(5, 20);
  const a = randInt(1, sum - 1);
  const b = sum - a;
  const mode = shuffle(['sum', 'a', 'b'])[0];
  let prompt, answer;
  if (mode === 'sum') { prompt = `${a} + ${b} = ⬜`; answer = sum; }
  else if (mode === 'a') { prompt = `${sum} - ${b} = ⬜`; answer = a; }
  else { prompt = `${sum} - ${a} = ⬜`; answer = b; }
  const choiceSet = new Set([answer]);
  while (choiceSet.size < 4) {
    const d = answer + randInt(-4, 4);
    if (d >= 0 && d <= 20 && d !== answer) choiceSet.add(d);
  }
  return { type: 'mc', prompt, answer, choices: shuffle([...choiceSet]) };
}

function genMixedQuestion() {
  const pool = ['bond5', 'bond10', 'bond20', 'double_tf', 'family'];
  const kind = shuffle(pool)[0];
  switch (kind) {
    case 'bond5': { const q = genMCBondQuestion(5); return { type: 'mc', prompt: `🦄 ${q.prompt}`, answer: q.answer, choices: q.choices }; }
    case 'bond10': { const q = genFillBondQuestion(10); return { type: 'fill', prompt: `🧜‍♀️ ${q.prompt}`, answer: q.answer }; }
    case 'bond20': { const q = genMCBondQuestion(20); return { type: 'mc', prompt: `🧚 ${q.prompt}`, answer: q.answer, choices: q.choices }; }
    case 'double_tf': { const q = genTFQuestion(); return { type: 'tf', prompt: `👑 ${q.prompt}`, answer: q.answer }; }
    case 'family': { const q = genFamilyQuestionMC(); return { type: 'mc', prompt: `🦋 ${q.prompt}`, answer: q.answer, choices: q.choices }; }
  }
}

function quizFinaleMixed(panel, land, onFinishStars) {
  const TOTAL = 10;
  let qi = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' });
  const body = el('div', {});
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [
    el('div', { style: 'text-align:center; font-weight:800; color:#22b573; margin-bottom:6px;' }, '👑 THE ROYAL TEST 👑'),
    bar, qBox, body, feedback
  ]));

  function renderQuestion(q) {
    body.innerHTML = '';
    if (q.type === 'mc') {
      const opts = el('div', { class: 'quiz-options' });
      q.choices.forEach(c => {
        const btn = el('button', { class: 'opt-btn' }, String(c));
        btn.addEventListener('click', () => {
          [...opts.children].forEach(b => b.disabled = true);
          grade(c === q.answer, btn, opts, q.answer);
        });
        opts.appendChild(btn);
      });
      body.appendChild(opts);
    } else if (q.type === 'fill') {
      const row = el('div', { class: 'quiz-input-row' });
      const input = el('input', { type: 'number' });
      const btn = el('button', { class: 'big-btn' }, 'Check ✔');
      row.appendChild(input); row.appendChild(btn);
      const submit = () => {
        input.disabled = true; btn.disabled = true;
        grade(parseInt(input.value, 10) === q.answer, null, null, q.answer);
      };
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      body.appendChild(row);
      input.focus();
    } else if (q.type === 'tf') {
      const row = el('div', { class: 'tf-row' });
      const tBtn = el('button', { class: 'tf-btn true-btn' }, '✔ True');
      const fBtn = el('button', { class: 'tf-btn false-btn' }, '✘ False');
      const answer = (choice) => { tBtn.disabled = true; fBtn.disabled = true; grade(choice === q.answer, null, null, q.answer ? 'True' : 'False'); };
      tBtn.addEventListener('click', () => answer(true));
      fBtn.addEventListener('click', () => answer(false));
      row.appendChild(tBtn); row.appendChild(fBtn);
      body.appendChild(row);
    }
  }

  function grade(isCorrect, btn, opts, answerDisplay) {
    if (isCorrect) {
      playCorrect(); correct++;
      if (btn) btn.classList.add('correct');
      feedback.textContent = 'Correct, Princess! 👑✨'; feedback.className = 'feedback-banner good';
    } else {
      playWrong();
      if (btn && opts) opts.querySelectorAll('.opt-btn').forEach(b => { if (b.textContent == answerDisplay) b.classList.add('correct'); });
      if (btn) btn.classList.add('incorrect');
      feedback.textContent = `The answer was ${answerDisplay}.`; feedback.className = 'feedback-banner bad';
    }
    qi++;
    setTimeout(next, 1200);
  }

  function next() {
    if (qi >= TOTAL) return finish();
    bar.querySelector('.quiz-progress-fill').style.width = `${(qi / TOTAL) * 100}%`;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    qBox.textContent = '';
    renderQuestion(genMixedQuestion());
  }

  function finish() {
    bar.querySelector('.quiz-progress-fill').style.width = '100%';
    const stars = starsForRatio(correct / TOTAL);
    showCertificate(panel, stars, correct, TOTAL);
    onFinishStars(stars);
  }
  next();
}

/* ---------------- Quiz result screens ---------------- */
function showQuizResult(panel, land, stars, correct, total, replayFn, timedNote) {
  playWin(); burstConfetti(34);
  panel.innerHTML = '';
  const msgs = {
    3: 'Outstanding! You are a number bond superstar! 🌟',
    2: 'Great job! You’re really getting it! 💪',
    1: 'Nice try! Practice makes perfect — go again! 🌈'
  };
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'result-emoji' }, stars === 3 ? '🏆' : stars === 2 ? '🎉' : '🌟'),
    el('div', { class: 'result-stars' }, starString(stars)),
    el('div', { class: 'result-msg' }, msgs[stars]),
    el('div', { class: 'result-score' }, timedNote ? `You answered ${correct} correctly!` : `Score: ${correct} / ${total}`),
    el('div', { class: 'result-actions' }, [
      el('button', { class: 'big-btn secondary', onclick: replayFn }, '🔁 Try Again'),
      el('button', {
        class: 'big-btn', onclick: () => {
          const overlay = panel.closest('.overlay');
          closeLand(overlay);
        }
      }, '🗺️ Back to Kingdom')
    ])
  ]));
}

function showCertificate(panel, stars, correct, total) {
  playWin(); burstConfetti(50);
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'certificate' }, [
      el('div', { style: 'font-size:40px;' }, '👑🎓👑'),
      el('h2', {}, 'Certificate of Number Bond Mastery'),
      el('div', { class: 'name' }, 'Chloe'),
      el('div', {}, `has completed the Royal Test with ${correct}/${total} correct!`),
      el('div', { class: 'crowns' }, starString(stars)),
      el('div', { style: 'margin-top:8px; opacity:.7; font-size:13px;' }, 'Ruler of Number Bonds Kingdom')
    ]),
    el('div', { class: 'result-actions', style: 'margin-top:18px;' }, [
      el('button', { class: 'big-btn secondary', onclick: () => quizFinaleMixed(panel, LANDS[4], () => {}) }, '🔁 Try Again'),
      el('button', {
        class: 'big-btn', onclick: () => {
          const overlay = panel.closest('.overlay');
          closeLand(overlay);
        }
      }, '🗺️ Back to Kingdom')
    ])
  ]));
}

/* ---------------- Boot ---------------- */
init();
