/* =========================================================
   Chloe's Word Wizard Academy
   Weekly English Spelling + Chinese Ting Xie (听写) adventure.
   Each Week = Learn (teach) -> Play (reinforce) -> Test (ting xie!)
   ========================================================= */

/* ---------------- Utilities ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
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

/* ---------------- Speech (the "ting xie" voice) ---------------- */
let voicesCache = [];
function loadVoices() { voicesCache = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
function pickVoice(lang) {
  const exact = voicesCache.find(v => v.lang === lang);
  if (exact) return exact;
  const partial = voicesCache.find(v => v.lang && v.lang.startsWith(lang.split('-')[0]));
  return partial || null;
}
function speak(text, lang, onEnd) {
  if (!window.speechSynthesis || state.muted) { if (onEnd) onEnd(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 0.82;
    u.pitch = 1.05;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  } catch (e) { if (onEnd) onEnd(); }
}
function stopSpeaking() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }
function sayEN(text) { stopSpeaking(); speak(text, 'en-US'); }
function sayZH(text) { stopSpeaking(); speak(text, 'zh-CN'); }
function speakWordWithSentence(word, sentence) {
  stopSpeaking();
  speak(word, 'en-US', () => speak(sentence, 'en-US', () => speak(word, 'en-US')));
}

/* ---------------- Confetti ---------------- */
const CONFETTI_EMOJI = ['✨', '🌟', '🔤', '📚', '🏮', '🎉', '⭐', '🀄'];
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

/* ---------------- Word/word-family data ---------------- */
const WORD_META = {
  old: { emoji: '👴', sentence: 'Grandpa is very old.' },
  seven: { emoji: '7️⃣', sentence: 'I have seven candies.' },
  eight: { emoji: '8️⃣', sentence: 'There are eight apples.' },
  all: { emoji: '🙌', sentence: 'We ate it all up.' },
  came: { emoji: '🚶‍♀️', sentence: 'She came to my party.' },
  turkey: { emoji: '🦃', sentence: 'The turkey says gobble gobble.' },
  monkey: { emoji: '🐒', sentence: 'The monkey climbs the tree.' },
  took: { emoji: '🤲', sentence: 'He took my red pencil.' },
  cool: { emoji: '😎', sentence: 'The ice cream is nice and cool.' },
  party: { emoji: '🎉', sentence: 'We had a fun party.' },

  boy: { emoji: '👦', sentence: 'The little boy is running.' },
  next: { emoji: '➡️', sentence: 'Who is next in line?' },
  our: { emoji: '🏠', sentence: 'This is our new house.' },
  friends: { emoji: '🧑‍🤝‍🧑', sentence: 'We are the best of friends.' },
  new: { emoji: '✨', sentence: 'I got a new toy.' },
  car: { emoji: '🚗', sentence: 'Daddy drives the blue car.' },
  far: { emoji: '🔭', sentence: 'The moon is very far away.' },
  hair: { emoji: '💇‍♀️', sentence: 'She has long curly hair.' },
  pair: { emoji: '👟', sentence: 'I have a pair of shoes.' },
  parents: { emoji: '👨‍👩‍👧', sentence: 'My parents love me very much.' },

  under: { emoji: '⬇️', sentence: 'The cat is hiding under the table.' },
  from: { emoji: '💌', sentence: 'This letter is from Grandma.' },
  even: { emoji: '⚖️', sentence: 'Even I can do it!' },
  into: { emoji: '📦', sentence: 'She jumped into the pool.' },
  through: { emoji: '🚇', sentence: 'We walked through the tunnel.' },
  another: { emoji: '➕', sentence: 'Can I have another cookie?' },
  reef: { emoji: '🐠', sentence: 'Colorful fish swim near the reef.' },
  seem: { emoji: '🤔', sentence: 'You seem very happy today.' },
  shark: { emoji: '🦈', sentence: 'The shark swims fast in the sea.' },
  move: { emoji: '🚶', sentence: 'Please move your chair a little.' },

  clothes: { emoji: '👕', sentence: 'Put on your warm clothes.' },
  asked: { emoji: '❓', sentence: 'She asked a good question.' },
  fell: { emoji: '🍂', sentence: 'He fell off his bike.' },
  bad: { emoji: '👎', sentence: 'That was a bad idea.' },
  why: { emoji: '❔', sentence: 'Why is the sky blue?' },
  bright: { emoji: '💡', sentence: 'The sun is very bright today.' },
  dim: { emoji: '🕯️', sentence: 'The room felt dim and quiet.' },
  road: { emoji: '🛣️', sentence: 'Cross the road carefully.' },
  dirty: { emoji: '🐽', sentence: 'My hands are dirty after playing.' },
  clean: { emoji: '🧼', sentence: 'Wash your hands until they are clean.' },

  four: { emoji: '4️⃣', sentence: 'I can see four little birds.' },
  things: { emoji: '🧸', sentence: 'Please pack your things.' },
  blue: { emoji: '🔵', sentence: 'The sky is bright blue.' },
  time: { emoji: '⏰', sentence: 'What time is it now?' },
  about: { emoji: '📖', sentence: 'This book is about dinosaurs.' },
  timetable: { emoji: '🗓️', sentence: 'Check the class timetable.' },
  first: { emoji: '🥇', sentence: 'She came in first place.' },
  after: { emoji: '⏭️', sentence: 'We play after lunch.' },
  half: { emoji: '🍕', sentence: 'I ate half of the pizza.' },
  break: { emoji: '☕', sentence: "Let's take a little break." },

  so: { emoji: '➡️', sentence: 'I am so very happy.' },
  would: { emoji: '🙏', sentence: 'Would you like some cake?' },
  better: { emoji: '👍', sentence: 'I feel much better now.' },
  way: { emoji: '🛤️', sentence: 'Which way do we go?' },
  fun: { emoji: '🎈', sentence: 'The party was so much fun.' },
  blow: { emoji: '💨', sentence: 'Blow out the candles.' },
  balloon: { emoji: '🎈', sentence: 'The balloon floated into the sky.' },
  slowly: { emoji: '🐢', sentence: 'Walk slowly on the ice.' },
  push: { emoji: '👐', sentence: 'Push the heavy door open.' },
  should: { emoji: '✅', sentence: 'You should brush your teeth.' }
};

const ENGLISH_WEEKS = [
  { week: 5, date: '30 Jul', words: ['old', 'seven', 'eight', 'all', 'came', 'turkey', 'monkey', 'took', 'cool', 'party'] },
  { week: 6, date: '6 Aug', words: ['boy', 'next', 'our', 'friends', 'new', 'car', 'far', 'hair', 'pair', 'parents'] },
  { week: 7, date: '13 Aug', words: ['under', 'from', 'even', 'into', 'through', 'another', 'reef', 'seem', 'shark', 'move'] },
  { week: 8, date: '20 Aug', words: ['clothes', 'asked', 'fell', 'bad', 'why', 'bright', 'dim', 'road', 'dirty', 'clean'] },
  { week: 9, date: '27 Aug', words: ['four', 'things', 'blue', 'time', 'about', 'timetable', 'first', 'after', 'half', 'break'] },
  { week: 10, date: '3 Sep', words: ['so', 'would', 'better', 'way', 'fun', 'blow', 'balloon', 'slowly', 'push', 'should'] }
];

const CHINESE_WEEKS = [
  { week: 5, date: '29 Jul', items: [
    { type: 'word', hanzi: '老师', pinyin: 'lǎoshī', meaning: 'teacher', emoji: '🧑‍🏫' },
    { type: 'word', hanzi: '一起', pinyin: 'yìqǐ', meaning: 'together', emoji: '🤝' },
    { type: 'word', hanzi: '五片叶子', pinyin: 'wǔ piàn yèzi', meaning: 'five leaves', emoji: '🍃' },
    { type: 'pinyin', pinyin: 'pō', char: '坡', meaning: 'slope', emoji: '⛰️', decoys: ['pó', 'pǒ', 'pò'] },
    { type: 'pinyin', pinyin: 'dú shū', char: '读书', meaning: 'read a book', emoji: '📖', decoys: ['dū shū', 'dù shū', 'dú shù'] }
  ] },
  { week: 6, date: '5 Aug', items: [
    { type: 'word', hanzi: '笑', pinyin: 'xiào', meaning: 'laugh / smile', emoji: '😄' },
    { type: 'word', hanzi: '哭了', pinyin: 'kūle', meaning: 'cried', emoji: '😢' },
    { type: 'word', hanzi: '六本书', pinyin: 'liù běn shū', meaning: 'six books', emoji: '📚' },
    { type: 'pinyin', pinyin: 'kū', char: '哭', meaning: 'cry', emoji: '😭', decoys: ['kú', 'kǔ', 'kù'] },
    { type: 'pinyin', pinyin: 'hé mǎ', char: '河马', meaning: 'hippo', emoji: '🦛', decoys: ['hè mǎ', 'hé mà', 'hē mǎ'] }
  ] },
  { week: 7, date: '12 Aug', items: [
    { type: 'word', hanzi: '跑步', pinyin: 'pǎobù', meaning: 'run / jog', emoji: '🏃' },
    { type: 'word', hanzi: '请坐', pinyin: 'qǐngzuò', meaning: 'please sit', emoji: '🪑' },
    { type: 'word', hanzi: '七个朋友', pinyin: 'qī gè péngyǒu', meaning: 'seven friends', emoji: '👬' },
    { type: 'pinyin', pinyin: 'jǔ', char: '举', meaning: 'lift up', emoji: '🙋', decoys: ['jū', 'jú', 'jù'] },
    { type: 'pinyin', pinyin: 'mǔ jī', char: '母鸡', meaning: 'hen', emoji: '🐔', decoys: ['mù jī', 'mǔ jí', 'mǔ jì'] }
  ] },
  { week: 8, date: '19 Aug', items: [
    { type: 'word', hanzi: '打扫', pinyin: 'dǎsǎo', meaning: 'sweep / clean', emoji: '🧹' },
    { type: 'word', hanzi: '快乐', pinyin: 'kuàilè', meaning: 'happy', emoji: '😊' },
    { type: 'word', hanzi: '八条鱼', pinyin: 'bā tiáo yú', meaning: 'eight fish', emoji: '🐟' },
    { type: 'pinyin', pinyin: 'qí', char: '骑', meaning: 'ride', emoji: '🚲', decoys: ['qī', 'qǐ', 'qì'] },
    { type: 'pinyin', pinyin: 'xǐ yī', char: '洗衣', meaning: 'wash clothes', emoji: '🧺', decoys: ['xī yī', 'xì yī', 'xǐ yí'] }
  ] },
  { week: 9, date: '26 Aug', items: [
    { type: 'word', hanzi: '送信', pinyin: 'sòngxìn', meaning: 'send a letter', emoji: '✉️' },
    { type: 'word', hanzi: '谁的', pinyin: 'shéide', meaning: 'whose', emoji: '❓' },
    { type: 'word', hanzi: '九支笔', pinyin: 'jiǔ zhī bǐ', meaning: 'nine pens', emoji: '✏️' },
    { type: 'pinyin', pinyin: 'chā', char: '叉', meaning: 'fork', emoji: '🍴', decoys: ['chá', 'chǎ', 'chà'] },
    { type: 'pinyin', pinyin: 'zhī zhū', char: '蜘蛛', meaning: 'spider', emoji: '🕷️', decoys: ['zhí zhū', 'zhī zhú', 'zhì zhū'] }
  ] },
  { week: 10, date: '2 Sep', items: [
    { type: 'word', hanzi: '都要', pinyin: 'dōuyào', meaning: 'all want / need', emoji: '🙌' },
    { type: 'word', hanzi: '想起', pinyin: 'xiǎngqǐ', meaning: 'remember / recall', emoji: '💭' },
    { type: 'word', hanzi: '十把尺', pinyin: 'shí bǎ chǐ', meaning: 'ten rulers', emoji: '📏' },
    { type: 'pinyin', pinyin: 'shé', char: '蛇', meaning: 'snake', emoji: '🐍', decoys: ['shē', 'shě', 'shè'] },
    { type: 'pinyin', pinyin: 'shā fā', char: '沙发', meaning: 'sofa', emoji: '🛋️', decoys: ['shá fā', 'shā fá', 'shà fā'] }
  ] }
];

const DECOY_HANZI_POOL = ['一', '二', '三', '大', '小', '天', '人', '山', '水', '火', '木', '日', '月', '上', '下', '你', '我', '他', '好', '不', '中', '心', '手', '口', '目', '女', '子', '门'];

function englishTileSet(word) {
  const target = word.toLowerCase().split('');
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const decoyPool = alphabet.filter(c => !target.includes(c));
  const decoys = shuffle(decoyPool).slice(0, Math.min(3, decoyPool.length));
  return { target, tiles: shuffle([...target, ...decoys]) };
}
function chineseTileSet(hanzi) {
  const target = [...hanzi];
  const pool = DECOY_HANZI_POOL.filter(c => !target.includes(c));
  const decoys = shuffle(pool).slice(0, Math.min(3, pool.length));
  return { target, tiles: shuffle([...target, ...decoys]) };
}

/* ---------------- Progress persistence ---------------- */
const STORAGE_KEY = 'wwa_progress_v1';
const MUTE_KEY = 'wwa_muted';

function defaultProgress() {
  const p = {};
  REALMS.forEach(r => {
    p[r.id] = { weeks: {}, champ: 0 };
    r.weeks.forEach(w => { p[r.id].weeks[w.week] = { stars: 0, learned: false, played: false }; });
  });
  return p;
}
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const base = defaultProgress();
    if (raw) {
      REALMS.forEach(r => {
        if (!raw[r.id]) return;
        if (typeof raw[r.id].champ === 'number') base[r.id].champ = raw[r.id].champ;
        if (raw[r.id].weeks) {
          Object.keys(base[r.id].weeks).forEach(wk => {
            if (raw[r.id].weeks[wk]) base[r.id].weeks[wk] = { ...base[r.id].weeks[wk], ...raw[r.id].weeks[wk] };
          });
        }
      });
    }
    return base;
  } catch (e) { return defaultProgress(); }
}
function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }

const state = { progress: null, muted: localStorage.getItem(MUTE_KEY) === '1', cleanupFns: [] };
function runCleanup() { state.cleanupFns.forEach(fn => { try { fn(); } catch (e) {} }); state.cleanupFns = []; }

function starsForRatio(ratio) {
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}
function getWeekProgress(realm, week) { return state.progress[realm.id].weeks[week.week]; }
function isWeekUnlocked(realm, idx) {
  if (idx === 0) return true;
  return getWeekProgress(realm, realm.weeks[idx - 1]).stars >= 1;
}
function hexAlpha(hex, a) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function starString(n) {
  let s = '';
  for (let i = 0; i < 3; i++) s += i < n ? '⭐' : '☆';
  return s;
}
function totalStars() {
  let sum = 0;
  REALMS.forEach(r => { r.weeks.forEach(w => sum += getWeekProgress(r, w).stars); sum += state.progress[r.id].champ || 0; });
  return sum;
}
function maxStars() { return REALMS.reduce((s, r) => s + r.weeks.length * 3 + 3, 0); }

/* ---------------- Reusable widgets ---------------- */
function tileOrderBuilder(target, tiles, onComplete) {
  const wrap = el('div');
  const slots = el('div', { class: 'answer-strip' });
  const bank = el('div', { class: 'tile-bank' });
  target.forEach(() => slots.appendChild(el('div', { class: 'answer-slot' }, '')));
  let filledCount = 0, mistakes = 0, done = false;
  shuffle(tiles.map((c, i) => ({ c, i }))).forEach(({ c }) => {
    const isCJK = /[一-鿿]/.test(c);
    const t = el('div', { class: isCJK ? 'letter-tile hanzi-tile' : 'letter-tile' }, c);
    t.addEventListener('click', () => {
      if (done || t.classList.contains('used')) return;
      const needed = target[filledCount];
      if (c === needed) {
        t.classList.add('used');
        const slot = slots.children[filledCount];
        slot.textContent = c;
        slot.classList.add('filled');
        if (isCJK) slot.classList.add('hanzi-tile');
        filledCount++;
        playClick();
        if (filledCount === target.length) {
          done = true;
          playCorrect(); burstConfetti(10);
          setTimeout(() => onComplete(mistakes), 700);
        }
      } else {
        mistakes++;
        t.classList.add('wrong-flash');
        playWrong();
        setTimeout(() => t.classList.remove('wrong-flash'), 300);
      }
    });
    bank.appendChild(t);
  });
  wrap.appendChild(slots);
  wrap.appendChild(bank);
  return wrap;
}

function toneCatcherWidget(item, showHint, onComplete) {
  const wrap = el('div');
  if (showHint) {
    wrap.appendChild(el('div', { class: 'spell-emoji' }, item.emoji));
    wrap.appendChild(el('div', { class: 'hanzi-display', style: 'font-size:34px;' }, item.char));
    wrap.appendChild(el('div', { class: 'spell-sentence' }, item.meaning));
  }
  const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
  listenBtn.addEventListener('click', () => sayZH(item.char));
  wrap.appendChild(el('div', { style: 'display:flex;justify-content:center;margin:8px 0 14px;' }, listenBtn));
  const choices = shuffle([item.pinyin, ...item.decoys]);
  const opts = el('div', { class: 'quiz-options' });
  let answered = false;
  choices.forEach(c => {
    const btn = el('button', { class: 'opt-btn' }, c);
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      [...opts.children].forEach(b => b.disabled = true);
      if (c === item.pinyin) {
        btn.classList.add('correct'); playCorrect(); burstConfetti(8);
        setTimeout(() => onComplete(0), 700);
      } else {
        btn.classList.add('incorrect'); playWrong();
        [...opts.children].forEach(b => { if (b.textContent === item.pinyin) b.classList.add('correct'); });
        setTimeout(() => onComplete(1), 900);
      }
    });
    opts.appendChild(btn);
  });
  wrap.appendChild(opts);
  return wrap;
}

/* ---------------- Realms ---------------- */
const REALMS = [
  {
    id: 'en', name: 'English Spelling Isles', tagline: 'Learn it, play it, ace the weekly test!', emoji: '📖',
    c1: '#ffe066', c2: '#ff9f1c', weeks: ENGLISH_WEEKS,
    weekLabel: w => `Week ${w.week}`,
    weekPreview: w => w.words.slice(0, 3).join(', ') + '…',
    learnSlides: learnSlidesEN,
    playFn: playEN,
    testFn: testEN,
    champFn: championshipEN
  },
  {
    id: 'zh', name: 'Ting Xie Kingdom 听写王国', tagline: '学习 · 游戏 · 听写小达人! Learn, play, dictate!', emoji: '🏮',
    c1: '#ffd166', c2: '#e63946', weeks: CHINESE_WEEKS,
    weekLabel: w => `Week ${w.week}`,
    weekPreview: w => w.items.filter(it => it.type === 'word').map(it => it.hanzi).join(' · '),
    learnSlides: learnSlidesZH,
    playFn: playZH,
    testFn: testZH,
    champFn: championshipZH
  }
];

/* ================= ROOT RENDER ================= */
function init() { state.progress = loadProgress(); renderRoot(); }

function renderRoot() {
  runCleanup();
  stopSpeaking();
  app.innerHTML = '';

  const decor = el('div', { class: 'bg-decor' });
  const decorEmojis = ['🔤', '📚', '🏮', '✨', '🀄', '🖌️', '⭐', '🎈'];
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
      el('span', { class: 'crown' }, '🧙'),
      el('div', {}, [
        el('div', { class: 'brand-title' }, "Chloe's Word Wizard Academy"),
        el('div', { class: 'brand-sub' }, 'Spelling & Ting Xie Adventure ✨')
      ])
    ]),
    el('div', { style: 'display:flex; gap:10px; align-items:center;' }, [
      el('a', { href: 'index.html', class: 'icon-btn', title: 'Number Bond Kingdom', style: 'text-decoration:none;' }, '🔢'),
      el('div', { class: 'stat-pill' }, `⭐ ${totalStars()} / ${maxStars()}`),
      el('button', {
        class: 'icon-btn', title: 'Sound', onclick: () => {
          state.muted = !state.muted;
          localStorage.setItem(MUTE_KEY, state.muted ? '1' : '0');
          if (state.muted) stopSpeaking();
          renderRoot();
        }
      }, state.muted ? '🔇' : '🔊')
    ])
  ]);
  app.appendChild(topbar);

  REALMS.forEach(realm => app.appendChild(renderRealmSection(realm)));

  app.appendChild(el('footer', { class: 'credit' }, 'Made with 💖 for Chloe — one word at a time!'));
}

function renderRealmSection(realm) {
  const map = el('div', { class: 'kingdom-map' });
  map.appendChild(el('div', { class: 'map-title' }, `${realm.emoji} ${realm.name}`));
  map.appendChild(el('div', { class: 'map-sub' }, realm.tagline));

  const path = el('div', { class: 'land-path' });
  realm.weeks.forEach((week, idx) => {
    const unlocked = isWeekUnlocked(realm, idx);
    const prog = getWeekProgress(realm, week);
    const card = el('div', {
      class: 'land-card' + (unlocked ? '' : ' locked'),
      style: `background: linear-gradient(135deg, ${hexAlpha(realm.c1, 0.18)}, ${hexAlpha(realm.c2, 0.12)});`,
      onclick: () => { if (unlocked) { playClick(); openWeek(realm, week); } }
    }, [
      el('div', { class: 'land-emoji' }, realm.emoji),
      el('div', { class: 'land-info' }, [
        el('div', { class: 'land-name' }, `${realm.weekLabel(week)} · ${week.date}`),
        el('div', { class: 'land-tagline' }, realm.weekPreview(week)),
        el('div', { class: 'land-stars' }, unlocked ? starString(prog.stars) : '')
      ]),
      unlocked ? null : el('div', { class: 'land-lock-badge' }, '🔒')
    ]);
    path.appendChild(card);
  });

  const champUnlocked = realm.weeks.every(w => getWeekProgress(realm, w).stars >= 1);
  const champStars = state.progress[realm.id].champ || 0;
  const champCard = el('div', {
    class: 'land-card champ-card' + (champUnlocked ? '' : ' locked'),
    onclick: () => { if (champUnlocked) { playClick(); openChampionship(realm); } }
  }, [
    el('div', { class: 'land-emoji' }, '🏆'),
    el('div', { class: 'land-info' }, [
      el('div', { class: 'land-name' }, 'Championship'),
      el('div', { class: 'land-tagline' }, champUnlocked ? 'A mixed review of every week!' : 'Finish all 6 weeks to unlock!'),
      el('div', { class: 'land-stars' }, champUnlocked ? starString(champStars) : '')
    ]),
    champUnlocked ? null : el('div', { class: 'land-lock-badge' }, '🔒')
  ]);
  path.appendChild(champCard);

  map.appendChild(path);
  return map;
}

/* ================= WEEK MODAL ================= */
function openWeek(realm, week) {
  const prog = getWeekProgress(realm, week);
  let activeTab = !prog.learned ? 'learn' : (!prog.played ? 'play' : 'test');

  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) closeModal(overlay); } });
  const modal = el('div', { class: 'land-modal' });

  const header = el('div', {
    class: 'land-modal-header',
    style: `background: linear-gradient(135deg, ${realm.c1}, ${realm.c2});`
  }, [
    el('span', { class: 'land-emoji-big' }, realm.emoji),
    el('div', {}, [
      el('h2', {}, `${realm.weekLabel(week)} · ${week.date}`),
      el('div', { class: 'tag' }, realm.weekPreview(week))
    ]),
    el('button', { class: 'close-x', onclick: () => closeModal(overlay) }, '✕')
  ]);
  modal.appendChild(header);

  const tabs = el('div', { class: 'tabs' });
  const panel = el('div', { class: 'tab-panel' });

  function buildTabs() {
    tabs.innerHTML = '';
    const defs = [
      { id: 'learn', label: '📖 Learn', enabled: true },
      { id: 'play', label: '🎮 Play', enabled: prog.learned },
      { id: 'test', label: '📝 Test', enabled: prog.played }
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
    stopSpeaking();
    panel.innerHTML = '';
    if (activeTab === 'learn') renderGenericLearnTab(panel, realm.learnSlides(week), () => {
      prog.learned = true; saveProgress(); activeTab = 'play'; buildTabs(); renderPanel();
    });
    else if (activeTab === 'play') realm.playFn(panel, realm, week, () => {
      prog.played = true; saveProgress(); buildTabs();
    });
    else if (activeTab === 'test') realm.testFn(panel, realm, week, (stars) => {
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
function closeModal(overlay) {
  runCleanup();
  stopSpeaking();
  overlay.remove();
  renderRoot();
}

/* ================= CHAMPIONSHIP MODAL ================= */
function openChampionship(realm) {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) closeModal(overlay); } });
  const modal = el('div', { class: 'land-modal' });
  const header = el('div', {
    class: 'land-modal-header',
    style: `background: linear-gradient(135deg, #ffd166, ${realm.c2});`
  }, [
    el('span', { class: 'land-emoji-big' }, '🏆'),
    el('div', {}, [
      el('h2', {}, `${realm.name} Championship`),
      el('div', { class: 'tag' }, 'A mixed review of everything you learned!')
    ]),
    el('button', { class: 'close-x', onclick: () => closeModal(overlay) }, '✕')
  ]);
  modal.appendChild(header);

  const panel = el('div', { class: 'tab-panel' });

  function intro() {
    stopSpeaking();
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'result-screen' }, [
      el('div', { class: 'result-emoji' }, '🏆'),
      el('h3', {}, 'Ready for the Championship?'),
      el('div', { class: 'result-msg' }, "We'll mix questions from every week you've learned. Good luck, word wizard!"),
      el('div', { class: 'result-actions' }, [ el('button', { class: 'big-btn', onclick: start }, '🚀 Start!') ])
    ]));
  }
  function start() {
    panel.innerHTML = '';
    realm.champFn(panel, realm, (stars) => {
      const cur = state.progress[realm.id].champ || 0;
      if (stars > cur) { state.progress[realm.id].champ = stars; saveProgress(); }
    });
  }

  intro();
  modal.appendChild(panel);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* ================= LEARN TAB (generic slide chrome) ================= */
function renderGenericLearnTab(panel, slides, onFinish) {
  let idx = 0;
  const slideBox = el('div', { class: 'slide' });
  const dots = el('div', { class: 'dots' });
  slides.forEach(() => dots.appendChild(el('span', {})));
  const prevBtn = el('button', { class: 'big-btn secondary' }, '⬅ Back');
  const nextBtn = el('button', { class: 'big-btn' }, 'Next ➡');

  function render() {
    stopSpeaking();
    slideBox.innerHTML = '';
    const s = slides[idx];
    slideBox.appendChild(el('h3', {}, s.title));
    slideBox.appendChild(s.visual());
    if (s.body) slideBox.appendChild(el('p', {}, s.body));
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

/* -------- English learn -------- */
function learnSlidesEN(week) {
  const slides = [{
    title: `Week ${week.week} Spelling Words! ✨`,
    visual: () => el('div', { style: 'font-size:60px;text-align:center;' }, '📖🔤✨'),
    body: `Let's learn ${week.words.length} new words! Tap Listen, then try covering the word and writing it from memory.`
  }];
  week.words.forEach(w => slides.push({ title: w, visual: () => wordLearnWidget(w, WORD_META[w]) }));
  return slides;
}

function wordLearnWidget(word, meta) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'spell-emoji' }, meta.emoji));
  const display = el('div', { class: 'spell-word-big' }, word);
  wrap.appendChild(display);
  wrap.appendChild(el('div', { class: 'spell-sentence' }, meta.sentence));

  const btnRow = el('div', { style: 'display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:10px;' });
  const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
  listenBtn.addEventListener('click', () => sayEN(word));
  const sentenceBtn = el('button', { class: 'big-btn secondary' }, '💬 Hear sentence');
  sentenceBtn.addEventListener('click', () => sayEN(meta.sentence));
  const tryBtn = el('button', { class: 'big-btn' }, '🙈 Cover & Try!');
  btnRow.appendChild(listenBtn); btnRow.appendChild(sentenceBtn); btnRow.appendChild(tryBtn);
  wrap.appendChild(btnRow);

  const practiceZone = el('div', { style: 'margin-top:14px;' });
  wrap.appendChild(practiceZone);

  tryBtn.addEventListener('click', () => {
    display.style.visibility = 'hidden';
    practiceZone.innerHTML = '';
    const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', class: 'spell-input' });
    const checkBtn = el('button', { class: 'big-btn' }, 'Check ✔');
    const fb = el('div', { class: 'feedback-banner' });
    practiceZone.appendChild(el('div', { class: 'quiz-input-row' }, [input, checkBtn]));
    practiceZone.appendChild(fb);
    function submit() {
      if (input.disabled) return;
      input.disabled = true; checkBtn.disabled = true;
      display.style.visibility = 'visible';
      if (input.value.trim().toLowerCase() === word) {
        fb.textContent = 'Perfect spelling! 🌟'; fb.className = 'feedback-banner good';
        playCorrect(); burstConfetti(8);
      } else {
        fb.textContent = `So close! It's spelled "${word}". Try once more!`; fb.className = 'feedback-banner bad';
        playWrong();
      }
    }
    checkBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.focus();
  });

  return wrap;
}

/* -------- Chinese learn -------- */
function learnSlidesZH(week) {
  const slides = [{
    title: `第${week.week}周 Week ${week.week}! 🏮`,
    visual: () => el('div', { style: 'font-size:60px;text-align:center;' }, '🏮🀄✨'),
    body: "我们来学习新的字词吧! Let's learn new words and sounds — tap Listen, then try building each one."
  }];
  week.items.forEach(item => slides.push({
    title: item.type === 'word' ? item.hanzi : item.pinyin,
    visual: () => item.type === 'word' ? chineseWordLearnWidget(item) : chinesePinyinLearnWidget(item)
  }));
  return slides;
}

function chineseWordLearnWidget(item) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'spell-emoji' }, item.emoji));
  wrap.appendChild(el('div', { class: 'hanzi-display' }, item.hanzi));
  wrap.appendChild(el('div', { class: 'pinyin-display' }, item.pinyin));
  wrap.appendChild(el('div', { class: 'spell-sentence' }, item.meaning));

  const btnRow = el('div', { style: 'display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:10px;' });
  const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
  listenBtn.addEventListener('click', () => sayZH(item.hanzi));
  const tryBtn = el('button', { class: 'big-btn' }, '🧩 Build it!');
  btnRow.appendChild(listenBtn); btnRow.appendChild(tryBtn);
  wrap.appendChild(btnRow);

  const practiceZone = el('div', { style: 'margin-top:14px;' });
  wrap.appendChild(practiceZone);
  tryBtn.addEventListener('click', () => {
    practiceZone.innerHTML = '';
    const { target, tiles } = chineseTileSet(item.hanzi);
    practiceZone.appendChild(tileOrderBuilder(target, tiles, () => {}));
  });

  return wrap;
}

function chinesePinyinLearnWidget(item) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'spell-emoji' }, item.emoji));
  wrap.appendChild(el('div', { class: 'hanzi-display', style: 'font-size:34px;' }, item.char));
  wrap.appendChild(el('div', { class: 'pinyin-display' }, item.pinyin));
  wrap.appendChild(el('div', { class: 'spell-sentence' }, item.meaning));

  const btnRow = el('div', { style: 'display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:10px;' });
  const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
  listenBtn.addEventListener('click', () => sayZH(item.char));
  const tryBtn = el('button', { class: 'big-btn' }, '🎯 Try the tone!');
  btnRow.appendChild(listenBtn); btnRow.appendChild(tryBtn);
  wrap.appendChild(btnRow);

  const practiceZone = el('div', { style: 'margin-top:14px;' });
  wrap.appendChild(practiceZone);
  tryBtn.addEventListener('click', () => {
    practiceZone.innerHTML = '';
    practiceZone.appendChild(toneCatcherWidget(item, true, () => {}));
  });

  return wrap;
}

/* ================= PLAY TAB ================= */
function playEN(panel, realm, week, onFinish) {
  const order = shuffle(week.words.slice());
  let i = 0;
  const status = el('div', { class: 'game-status' }, [
    el('div', {}, '🎈 Pop the letters in order to spell each word!'),
    el('div', { class: 'game-target' }, `${i}/${order.length}`)
  ]);
  const body = el('div', {});
  panel.appendChild(status);
  panel.appendChild(body);

  function round() {
    if (i >= order.length) return finish();
    status.querySelector('.game-target').textContent = `${i}/${order.length}`;
    body.innerHTML = '';
    const word = order[i];
    const meta = WORD_META[word];
    body.appendChild(el('div', { class: 'spell-emoji' }, meta.emoji));
    body.appendChild(el('div', { class: 'spell-sentence' }, meta.sentence));
    const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
    listenBtn.addEventListener('click', () => sayEN(word));
    body.appendChild(el('div', { style: 'display:flex;justify-content:center;margin:8px 0;' }, listenBtn));
    const { target, tiles } = englishTileSet(word);
    body.appendChild(tileOrderBuilder(target, tiles, () => { i++; setTimeout(round, 900); }));
    sayEN(word);
  }
  round();

  function finish() { showPlayWin(panel, realm, week, onFinish, () => playEN(panel, realm, week, onFinish)); }
}

function playZH(panel, realm, week, onFinish) {
  const order = shuffle(week.items.slice());
  let i = 0;
  const status = el('div', { class: 'game-status' }, [
    el('div', {}, '🏮 Build each word, or catch the right tone!'),
    el('div', { class: 'game-target' }, `${i}/${order.length}`)
  ]);
  const body = el('div', {});
  panel.appendChild(status);
  panel.appendChild(body);

  function round() {
    if (i >= order.length) return finish();
    status.querySelector('.game-target').textContent = `${i}/${order.length}`;
    body.innerHTML = '';
    const item = order[i];
    if (item.type === 'word') {
      body.appendChild(el('div', { class: 'spell-emoji' }, item.emoji));
      body.appendChild(el('div', { class: 'pinyin-display' }, item.pinyin));
      body.appendChild(el('div', { class: 'spell-sentence' }, item.meaning));
      const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Listen');
      listenBtn.addEventListener('click', () => sayZH(item.hanzi));
      body.appendChild(el('div', { style: 'display:flex;justify-content:center;margin:8px 0;' }, listenBtn));
      const { target, tiles } = chineseTileSet(item.hanzi);
      body.appendChild(tileOrderBuilder(target, tiles, () => { i++; setTimeout(round, 900); }));
      sayZH(item.hanzi);
    } else {
      body.appendChild(toneCatcherWidget(item, true, () => { i++; setTimeout(round, 900); }));
      sayZH(item.char);
    }
  }
  round();

  function finish() { showPlayWin(panel, realm, week, onFinish, () => playZH(panel, realm, week, onFinish)); }
}

function showPlayWin(panel, realm, week, onFinish, replayFn) {
  playWin(); burstConfetti(30);
  onFinish();
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'result-emoji' }, '🎉'),
    el('h3', {}, 'Great playing!'),
    el('div', { class: 'result-msg' }, `You practiced ${realm.weekLabel(week)} like a champ!`),
    el('div', { class: 'result-actions' }, [
      el('button', { class: 'big-btn secondary', onclick: replayFn }, '🔁 Play Again'),
      el('button', {
        class: 'big-btn', onclick: () => {
          const tabBtns = panel.parentElement.parentElement.querySelectorAll('.tab-btn');
          tabBtns[2] && tabBtns[2].click();
        }
      }, '📝 Take the Test')
    ])
  ]));
}

/* ================= TEST TAB (the real ting xie!) ================= */
function runSpellingRound(panel, words, onFinish) {
  const order = shuffle(words.slice());
  const TOTAL = order.length;
  let i = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' }, '📝 Listen carefully and spell the word!');
  const body = el('div', {});
  const feedback = el('div', { class: 'feedback-banner' });
  panel.appendChild(el('div', {}, [bar, qBox, body, feedback]));

  function next() {
    if (i >= TOTAL) return onFinish(correct, TOTAL);
    bar.querySelector('.quiz-progress-fill').style.width = `${(i / TOTAL) * 100}%`;
    feedback.textContent = ''; feedback.className = 'feedback-banner';
    body.innerHTML = '';
    const word = order[i];
    const meta = WORD_META[word];
    const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Hear it again');
    listenBtn.addEventListener('click', () => speakWordWithSentence(word, meta.sentence));
    body.appendChild(el('div', { style: 'display:flex;justify-content:center;margin-bottom:12px;' }, listenBtn));
    const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', class: 'spell-input' });
    const checkBtn = el('button', { class: 'big-btn' }, 'Check ✔');
    body.appendChild(el('div', { class: 'quiz-input-row' }, [input, checkBtn]));
    function submit() {
      if (input.disabled) return;
      input.disabled = true; checkBtn.disabled = true;
      const val = input.value.trim().toLowerCase();
      if (val === word) {
        playCorrect(); correct++; burstConfetti(6);
        feedback.textContent = 'Correct! Fantastic spelling! ⭐'; feedback.className = 'feedback-banner good';
      } else {
        playWrong();
        feedback.textContent = `The word was "${word}". Keep practicing!`; feedback.className = 'feedback-banner bad';
      }
      i++;
      setTimeout(next, 1300);
    }
    checkBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    speakWordWithSentence(word, meta.sentence);
    input.focus();
  }
  next();
}

function runTingXieRound(panel, items, onFinish) {
  const order = shuffle(items.slice());
  const TOTAL = order.length;
  let i = 0, correct = 0;
  const bar = el('div', { class: 'quiz-progress-bar' }, el('div', { class: 'quiz-progress-fill' }));
  const qBox = el('div', { class: 'quiz-question' }, '🏮 听 Listen carefully, then write it!');
  const body = el('div', {});
  panel.appendChild(el('div', {}, [bar, qBox, body]));

  function next() {
    if (i >= TOTAL) return onFinish(correct, TOTAL);
    bar.querySelector('.quiz-progress-fill').style.width = `${(i / TOTAL) * 100}%`;
    body.innerHTML = '';
    const item = order[i];
    const audioText = item.type === 'word' ? item.hanzi : item.char;
    const listenBtn = el('button', { class: 'big-btn secondary listen-btn' }, '🔊 Hear it again');
    listenBtn.addEventListener('click', () => sayZH(audioText));
    body.appendChild(el('div', { style: 'display:flex;justify-content:center;margin-bottom:12px;' }, listenBtn));
    if (item.type === 'word') {
      const { target, tiles } = chineseTileSet(item.hanzi);
      body.appendChild(tileOrderBuilder(target, tiles, (mistakes) => {
        if (mistakes === 0) correct++;
        i++; setTimeout(next, 900);
      }));
    } else {
      body.appendChild(toneCatcherWidget(item, false, (mistakes) => {
        if (mistakes === 0) correct++;
        i++; setTimeout(next, 900);
      }));
    }
    sayZH(audioText);
  }
  next();
}

function testEN(panel, realm, week, onFinishStars) {
  runSpellingRound(panel, week.words, (correct, total) => {
    const stars = starsForRatio(correct / total);
    showTestResult(panel, stars, correct, total, () => testEN(panel, realm, week, onFinishStars));
    onFinishStars(stars);
  });
}
function testZH(panel, realm, week, onFinishStars) {
  runTingXieRound(panel, week.items, (correct, total) => {
    const stars = starsForRatio(correct / total);
    showTestResult(panel, stars, correct, total, () => testZH(panel, realm, week, onFinishStars));
    onFinishStars(stars);
  });
}
function championshipEN(panel, realm, onDone) {
  const pool = shuffle(ENGLISH_WEEKS.flatMap(w => w.words)).slice(0, 15);
  runSpellingRound(panel, pool, (correct, total) => {
    const stars = starsForRatio(correct / total);
    showCertificate(panel, realm, stars, correct, total);
    onDone(stars);
  });
}
function championshipZH(panel, realm, onDone) {
  const pool = shuffle(CHINESE_WEEKS.flatMap(w => w.items)).slice(0, 15);
  runTingXieRound(panel, pool, (correct, total) => {
    const stars = starsForRatio(correct / total);
    showCertificate(panel, realm, stars, correct, total);
    onDone(stars);
  });
}

function showTestResult(panel, stars, correct, total, replayFn) {
  playWin(); burstConfetti(34);
  panel.innerHTML = '';
  const msgs = {
    3: 'Outstanding! You are a word wizard superstar! 🌟',
    2: 'Great job! You are really getting it! 💪',
    1: 'Nice try! Practice makes perfect — go again! 🌈'
  };
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'result-emoji' }, stars === 3 ? '🏆' : stars === 2 ? '🎉' : '🌟'),
    el('div', { class: 'result-stars' }, starString(stars)),
    el('div', { class: 'result-msg' }, msgs[stars]),
    el('div', { class: 'result-score' }, `Score: ${correct} / ${total}`),
    el('div', { class: 'result-actions' }, [
      el('button', { class: 'big-btn secondary', onclick: replayFn }, '🔁 Try Again'),
      el('button', {
        class: 'big-btn', onclick: () => { const overlay = panel.closest('.overlay'); closeModal(overlay); }
      }, '🏠 Back to Academy')
    ])
  ]));
}

function showCertificate(panel, realm, stars, correct, total) {
  playWin(); burstConfetti(50);
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'result-screen' }, [
    el('div', { class: 'certificate' }, [
      el('div', { style: 'font-size:40px;' }, '🏆🎓🏆'),
      el('h2', {}, `Certificate of ${realm.name} Mastery`),
      el('div', { class: 'name' }, 'Chloe'),
      el('div', {}, `has completed the Championship with ${correct}/${total} correct!`),
      el('div', { class: 'crowns' }, starString(stars))
    ]),
    el('div', { class: 'result-actions', style: 'margin-top:18px;' }, [
      el('button', {
        class: 'big-btn secondary', onclick: () => {
          panel.innerHTML = '';
          realm.champFn(panel, realm, (s) => {
            const cur = state.progress[realm.id].champ || 0;
            if (s > cur) { state.progress[realm.id].champ = s; saveProgress(); }
          });
        }
      }, '🔁 Try Again'),
      el('button', {
        class: 'big-btn', onclick: () => { const overlay = panel.closest('.overlay'); closeModal(overlay); }
      }, '🏠 Back to Academy')
    ])
  ]));
}

/* ---------------- Boot ---------------- */
init();
