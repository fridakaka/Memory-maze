// Ljud och musik. Allt skapas med Web Audio i stället för ljudfiler, så spelet är litet och
// startar fort. createSynth kan köras mot en OfflineAudioContext, vilket verktygen använder
// för att kontrollera att ljuden inte är tysta eller för starka.

const SEMITONE = 2 ** (1 / 12);
const C4 = 261.63;
const note = (n) => C4 * SEMITONE ** n;

export function createSynth(ctx, out) {
  // Ett sekundsvitt brus att slå på
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  /** En ton med snabb start och mjuk utklingning. */
  const tone = (t, { f = 440, to = null, dur = 0.2, type = 'sine', vol = 0.25, attack = 0.006, lp = null }) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lp;
      o.connect(filter);
      node = filter;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  /** Ett brusstöt genom ett filter. */
  const noise = (t, { dur = 0.1, vol = 0.2, type = 'lowpass', f = 800, to = null, q = 0.7 }) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(filter);
    filter.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(t + dur + 0.05);
  };

  const arp = (t, notes, gap, opts) => notes.forEach((n, i) => tone(t + i * gap, { ...opts, f: note(n) }));

  const sounds = {
    tap: (t) => tone(t, { f: 620, to: 840, dur: 0.07, type: 'triangle', vol: 0.16 }),
    dialog: (t) => tone(t, { f: 700, to: 940, dur: 0.1, type: 'sine', vol: 0.12 }),
    go: (t) => {
      tone(t, { f: 330, to: 560, dur: 0.14, type: 'triangle', vol: 0.18 });
      noise(t, { dur: 0.12, vol: 0.05, type: 'bandpass', f: 600, to: 1800 });
    },
    step: (t) => {
      const j = 0.85 + Math.random() * 0.3;
      tone(t, { f: 150 * j, to: 80, dur: 0.06, type: 'sine', vol: 0.12 });
      noise(t, { dur: 0.05, vol: 0.05, f: 700 * j });
    },
    start: (t) => arp(t, [0, 7, 12], 0.09, { dur: 0.22, type: 'triangle', vol: 0.2 }),
    oops: (t) => {
      tone(t, { f: 330, to: 250, dur: 0.22, type: 'triangle', vol: 0.2 });
      tone(t + 0.16, { f: 247, to: 160, dur: 0.3, type: 'triangle', vol: 0.2 });
    },
    clock: (t) => {
      tone(t, { f: 1318, dur: 0.7, vol: 0.22 });
      tone(t, { f: 1976, dur: 0.5, vol: 0.1 });
      tone(t + 0.07, { f: 1760, dur: 0.6, vol: 0.14 });
    },
    checkpoint: (t) => arp(t, [0, 4, 7, 12, 16], 0.1, { dur: 0.35, type: 'triangle', vol: 0.2 }),
    win: (t) => {
      arp(t, [0, 4, 7, 12], 0.13, { dur: 0.4, type: 'triangle', vol: 0.22 });
      [0, 4, 7, 12].forEach((n) => tone(t + 0.6, { f: note(n + 12), dur: 1.2, type: 'sine', vol: 0.12 }));
    },
    lose: (t) => {
      arp(t, [4, 2, 0, -5], 0.22, { dur: 0.5, type: 'triangle', vol: 0.2, lp: 1500 });
    },
    roar: (t) => {
      tone(t, { f: 90, to: 38, dur: 1.0, type: 'sawtooth', vol: 0.22, lp: 380 });
      tone(t, { f: 60, to: 30, dur: 1.1, type: 'square', vol: 0.12, lp: 200 });
      noise(t, { dur: 0.9, vol: 0.16, f: 500, to: 120 });
    },
    hide: (t) => tone(t, { f: 520, to: 220, dur: 0.16, type: 'sine', vol: 0.2 }),
    unhide: (t) => tone(t, { f: 220, to: 560, dur: 0.16, type: 'sine', vol: 0.2 }),
    peek: (t) => {
      noise(t, { dur: 0.28, vol: 0.1, type: 'bandpass', f: 400, to: 2400 });
      tone(t, { f: 500, to: 1000, dur: 0.25, type: 'triangle', vol: 0.12 });
    },
    tick: (t) => tone(t, { f: 1100, dur: 0.03, type: 'square', vol: 0.06 }),
    beat: (t) => {
      tone(t, { f: 62, to: 42, dur: 0.14, vol: 0.5 });
      tone(t + 0.18, { f: 58, to: 40, dur: 0.16, vol: 0.38 });
    },
  };
  return sounds;
}

// Musik: små komponerade stycken i en äventyrsstil (harpa, flöjt, pizzicato, stråkar och pukor).
// Varje stycke är åtta takter som loopar. Toner anges i halvtoner från C4.
const CH = {
  C: { t: [0, 4, 7, 12], root: -12 }, G: { t: [-5, -1, 2, 7], root: -17 },
  Am: { t: [-3, 0, 4, 9], root: -15 }, F: { t: [-7, -3, 0, 5], root: -19 },
  E: { t: [-8, -4, -1, 4], root: -20 }, Dm: { t: [-10, -7, -3, 2], root: -22 },
};
const bars = (list) => list.split(' ').map((n) => CH[n]);
// Melodin är [ton, åttondelar]. null är paus. Varje takt är 8 åttondelar.
const SONGS = {
  menu: {
    bpm: 76,
    bars: bars('C G Am F C G F G'),
    harp: [0, 1, 2, 3, 2, 1, 2, 1], harpVol: 0.1,
    bass: [], pad: 0.035, timp: [],
    melody: [
      [16, 3], [19, 1], [21, 4], [19, 2], [16, 2], [14, 4],
      [12, 3], [16, 1], [19, 4], [17, 4], [16, 2], [14, 2],
      [16, 3], [19, 1], [24, 4], [23, 2], [21, 2], [19, 4],
      [17, 3], [16, 1], [14, 4], [11, 2], [14, 2], [14, 4],
    ],
    lead: 'flute', leadVol: 0.12,
  },
  study: {
    bpm: 84,
    bars: bars('C G Am F C G F G'),
    harp: [0, 2, 1, 3, 1, 2, 1, 3], harpVol: 0.08,
    bass: [], pad: 0.03, timp: [],
    melody: [
      [16, 6], [19, 6], [14, 4],
      [12, 6], [17, 6], [16, 4],
      [19, 6], [24, 6], [23, 4],
      [17, 6], [14, 6], [14, 4],
    ],
    lead: 'flute', leadVol: 0.1,
  },
  play: {
    bpm: 118,
    bars: bars('Am F C G Am F G E'),
    harp: [0, 2, 1, 2, 3, 2, 1, 2], harpVol: 0.08,
    bass: ['r', null, 'f', null, 'r', null, 'f', 'f'], pad: 0.03, timp: [0, 4],
    melody: [
      [16, 2], [21, 2], [19, 1], [17, 1], [16, 2], [12, 2], [14, 2], [17, 2], [16, 2],
      [19, 2], [24, 2], [23, 1], [21, 1], [19, 2], [14, 2], [16, 2], [19, 2], [14, 2],
      [21, 2], [24, 2], [23, 1], [21, 1], [19, 2], [16, 2], [17, 2], [21, 2], [19, 2],
      [19, 2], [17, 2], [16, 2], [14, 2], [11, 2], [8, 2], [11, 2], [16, 2],
    ],
    lead: 'flute', leadVol: 0.11,
  },
  tense: {
    bpm: 132,
    bars: bars('Am Am F E Am Am F E'),
    harp: [], harpVol: 0,
    bass: ['r', 'o', 'r', 'o', 'r', 'o', 'r', 'o'], pad: 0.05, timp: [0, 4],
    melody: [
      [16, 2], [15, 2], [16, 2], [11, 2], [12, 4], [null, 4],
      [17, 2], [16, 2], [17, 2], [12, 2], [11, 4], [null, 4],
      [16, 2], [15, 2], [16, 2], [11, 2], [12, 4], [null, 4],
      [17, 2], [16, 2], [14, 2], [11, 2], [8, 8],
    ],
    lead: 'strings', leadVol: 0.07,
  },
};

/** Gör om ett stycke till händelser per åttondel (64 steg). */
function compile(song) {
  const events = Array.from({ length: 64 }, () => []);
  song.bars.forEach((ch, b) => {
    for (let pos = 0; pos < 8; pos++) {
      const step = b * 8 + pos;
      if (song.harp.length) events[step].push({ v: 'harp', n: ch.t[song.harp[pos]], vol: song.harpVol });
      const bp = song.bass[pos];
      if (bp) events[step].push({ v: 'bass', n: ch.root + (bp === 'f' ? 7 : bp === 'o' ? 12 : 0), vol: 0.16 });
      if (song.timp.includes(pos)) events[step].push({ v: 'timp', vol: 0.22 });
    }
    if (song.pad) for (const n of [ch.root + 12, ch.t[1] - 12, ch.t[2] - 12]) events[b * 8].push({ v: 'pad', n, len: 8, vol: song.pad });
  });
  let step = 0;
  for (const [n, len] of song.melody) {
    if (n !== null) events[step].push({ v: song.lead, n, len, vol: song.leadVol });
    step += len;
  }
  return events;
}
const COMPILED = Object.fromEntries(Object.entries(SONGS).map(([k, v]) => [k, compile(v)]));

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let sounds = null;
  let analyser = null;
  const enabled = { sfx: true, music: true };
  let wantMood = null;
  let mood = null;
  let timer = null;
  let nextNote = 0;
  let step = 0;
  let beatLevel = 0;
  let nextBeat = 0;
  let lastPlay = {};

  const ready = () => ctx && ctx.state === 'running';

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = enabled.sfx ? 1.5 : 0;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = enabled.music ? 0.6 : 0;
      musicBus.connect(master);
      // Ett litet eko gör musiken mjukare och fylligare
      const echo = ctx.createDelay(1);
      echo.delayTime.value = 0.3;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      musicBus.connect(echo);
      echo.connect(fb);
      fb.connect(echo);
      echo.connect(wet);
      wet.connect(master);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(analyser);
      sounds = createSynth(ctx, sfxBus);
      timer = setInterval(tick, 40);
    }
    if (ctx.state !== 'running') ctx.resume?.();
    if (wantMood && !mood) setMusic(wantMood);
  }

  function play(name) {
    if (!enabled.sfx || !ready() || !sounds?.[name]) return;
    // Samma ljud högst en gång per 40 ms, annars blir det brus när flera händelser sammanfaller
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.04) return;
    lastPlay[name] = now;
    sounds[name](now + 0.005);
  }

  function setMusic(next) {
    wantMood = next;
    if (!ctx) return;
    if (next !== mood) {
      mood = next;
      step = 0;
      nextNote = ctx.currentTime + 0.1;
    }
  }

  function heartbeat(level) {
    beatLevel = level;
  }

  function setEnabled(next) {
    Object.assign(enabled, next);
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(enabled.sfx ? 1.5 : 0, t, 0.05);
    musicBus.gain.setTargetAtTime(enabled.music ? 0.6 : 0, t, 0.2);
  }

  // Schemaläggare: lägger ut noter en liten stund i förväg
  function tick() {
    if (!ready()) return;
    const now = ctx.currentTime;
    // Hjärtslag när monstret är nära
    if (enabled.sfx && beatLevel > 0.12 && now >= nextBeat) {
      sounds.beat(now + 0.01);
      nextBeat = now + 1.0 - beatLevel * 0.55;
    }
    if (!enabled.music || !mood) return;
    const song = SONGS[mood];
    const eighth = 60 / song.bpm / 2;
    while (nextNote < now + 0.25) {
      for (const e of COMPILED[mood][step % 64]) playVoice(e, nextNote, eighth);
      nextNote += eighth;
      step++;
    }
  }

  // Instrument: varje röst har sin egen klang
  function env(o, t, { vol, attack, dur, sustain = false, cutoff = null, type = 'sine', f = null, detune = 0 }) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (sustain) {
      g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.12));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    let node = o;
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      o.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.1);
    return g;
  }

  function osc(type, f, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    return o;
  }

  function playVoice(e, t, eighth) {
    const f = e.n !== undefined ? note(e.n) : 0;
    const len = (e.len ?? 1) * eighth;
    switch (e.v) {
      case 'harp': // plockad sträng: kort start och lång utklingning
        env(osc('triangle', f), t, { vol: e.vol, attack: 0.004, dur: 1.4, cutoff: 3200 });
        env(osc('sine', f * 2), t, { vol: e.vol * 0.25, attack: 0.004, dur: 0.6 });
        break;
      case 'flute': { // mjuk ton med lätt vibrato
        const o = osc('sine', f);
        const lfo = osc('sine', 5.4);
        const depth = ctx.createGain();
        depth.gain.value = 9;
        lfo.connect(depth);
        depth.connect(o.detune);
        lfo.start(t);
        lfo.stop(t + len + 0.2);
        env(o, t, { vol: e.vol, attack: 0.07, dur: len * 0.96, sustain: true });
        env(osc('triangle', f * 2), t, { vol: e.vol * 0.12, attack: 0.09, dur: len * 0.9, sustain: true });
        break;
      }
      case 'strings': // stråkar: sågtand med mjukt filter
        env(osc('sawtooth', f, -6), t, { vol: e.vol, attack: 0.12, dur: len * 0.98, sustain: true, cutoff: 1500 });
        env(osc('sawtooth', f, 6), t, { vol: e.vol, attack: 0.12, dur: len * 0.98, sustain: true, cutoff: 1500 });
        break;
      case 'pad':
        env(osc('sine', f), t, { vol: e.vol, attack: 0.5, dur: len * 0.98, sustain: true });
        break;
      case 'bass': // pizzicato
        env(osc('triangle', f), t, { vol: e.vol, attack: 0.006, dur: 0.38, cutoff: 900 });
        break;
      case 'timp': { // puka: en sjunkande ton och ett dovt slag
        const o = osc('sine', 110);
        o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
        env(o, t, { vol: e.vol, attack: 0.004, dur: 0.5 });
        break;
      }
      default:
    }
  }

  // Tysta när appen inte syns
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.();
    else ctx.resume?.();
  });

  /** Aktuell ljudnivå (för felsökning och test). */
  function level() {
    if (!analyser) return 0;
    const d = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(d);
    let sum = 0;
    for (const v of d) sum += v * v;
    return Math.sqrt(sum / d.length);
  }

  return { unlock, play, setMusic, heartbeat, setEnabled, level, get running() { return ready(); } };
}
