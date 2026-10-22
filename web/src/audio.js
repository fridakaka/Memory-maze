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

// Musik: korta mönster som slumpas fram i en skala, så att den aldrig upprepar sig exakt.
const MOODS = {
  menu: { bpm: 72, scale: [0, 2, 4, 7, 9], pad: [0, 7], density: 0.55, bass: false, type: 'sine', vol: 0.07, base: 0 },
  study: { bpm: 84, scale: [0, 2, 4, 7, 9], pad: [0, 4, 7], density: 0.6, bass: false, type: 'triangle', vol: 0.06, base: 0 },
  play: { bpm: 112, scale: [0, 2, 4, 7, 9], pad: [0, 7], density: 0.75, bass: true, type: 'triangle', vol: 0.06, base: 0 },
  tense: { bpm: 138, scale: [0, 3, 5, 7, 10], pad: [-12, -5], density: 0.5, bass: true, type: 'triangle', vol: 0.05, base: -3 },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let sounds = null;
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
      musicBus.gain.value = enabled.music ? 0.8 : 0;
      musicBus.connect(master);
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
    musicBus.gain.setTargetAtTime(enabled.music ? 0.8 : 0, t, 0.2);
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
    const m = MOODS[mood];
    const eighth = 60 / m.bpm / 2;
    while (nextNote < now + 0.25) {
      scheduleStep(m, nextNote, eighth);
      nextNote += eighth;
      step++;
    }
  }

  function scheduleStep(m, t, eighth) {
    const bar = Math.floor(step / 8);
    const pos = step % 8;
    const synth = (opts) => musicTone(t, opts);
    // Ackord i början av varannan takt
    if (pos === 0 && bar % 2 === 0) {
      for (const n of m.pad) synth({ f: note(n + m.base - 12), dur: eighth * 14, vol: m.vol * 0.7, type: 'sine', attack: 0.4 });
    }
    // Bas på takten
    if (m.bass && pos % 4 === 0) synth({ f: note(m.base - 24 + (bar % 4 === 3 ? 5 : 0)), dur: eighth * 3, vol: m.vol * 1.1, type: 'sine', attack: 0.01 });
    // Melodi: slumpad vandring i skalan
    if (Math.random() < m.density) {
      const deg = m.scale[Math.floor(Math.random() * m.scale.length)] + (Math.random() < 0.3 ? 12 : 0);
      synth({ f: note(deg + m.base), dur: eighth * 2.5, vol: m.vol, type: m.type, attack: 0.01 });
    }
  }

  function musicTone(t, { f, dur, vol, type, attack }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Tysta när appen inte syns
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.();
    else ctx.resume?.();
  });

  return { unlock, play, setMusic, heartbeat, setEnabled, get running() { return ready(); } };
}
