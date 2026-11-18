/* CSTAudio — 《雲海商途：蒼穹誓約》第一期 Web Audio 動態合成
   G 大調／G 五聲（G A B D E），風車鎮主題動機貫穿各場景。
   lookahead scheduling；交叉淡入淡出；BGM 讓位給打擊與升級。 */
"use strict";
(() => {
  const XF = 1.5;
  const LOOKAHEAD = 0.18;
  const TICK_MS = 25;
  const BGM_BUS = 0.11;
  const SFX_BUS = 0.28;

  let ctx = null;
  let enabled = true;
  let master, duckGain, bgmBus, sfxBus;
  let noiseBuf = null;
  let schedulerTimer = null;
  let wanted = { mode: "title", mapId: "plaza", safe: true, inCombat: false };
  let liveKey = "";
  let combatOn = false;

  const voices = [];
  let waveBed = null;
  let combatVoice = null;

  function now() { return ctx ? ctx.currentTime : 0; }

  function freqOf(name) {
    if (typeof name === "number") return name;
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
    if (!m) return 392;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let n = base[m[1]];
    if (m[2] === "#") n++;
    if (m[2] === "b") n--;
    const midi = (parseInt(m[3], 10) + 1) * 12 + n;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function vary(freq, cents) {
    return freq * Math.pow(2, ((Math.random() * 2 - 1) * (cents || 0)) / 1200);
  }

  function makeNoise() {
    const len = (ctx.sampleRate * 2) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.97 + w * 0.03;
      d[i] = w * 0.55 + last * 0.45;
    }
    return buf;
  }

  function noiseSrc(t, dur, dest, opts) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.setValueAtTime(opts.freq || 1800, t);
    if (opts.freq2) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freq2), t + dur);
    f.Q.value = opts.Q || 2.2;
    const g = ctx.createGain();
    const peak = Math.max(0.0002, opts.gain || 0.04);
    const att = opts.att || 0.008;
    const rel = opts.rel || 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.01, dur));
    s.connect(f).connect(g).connect(dest);
    s.start(t);
    s.stop(t + dur + rel + 0.02);
    return { s, f, g };
  }

  function osc(type, freq, t, dest, env) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (env.freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, env.freq2), t + (env.glide || env.dur || 0.2));
    const g = ctx.createGain();
    const peak = Math.max(0.0002, env.gain || 0.05);
    const att = env.att || 0.01;
    const dur = env.dur || 0.3;
    const rel = env.rel || 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    if (env.sus && dur > att + rel) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * env.sus), t + Math.max(att + 0.02, dur - rel));
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (env.vib) {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = env.vibHz || 4.8;
      const lg = ctx.createGain();
      lg.gain.value = freq * (env.vib || 0.0035);
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t + (env.att || 0.04));
      lfo.stop(t + dur + 0.02);
    }
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    return { o, g };
  }

  function playInst(inst, note, t, beatDur, dest) {
    const freq = vary(freqOf(note.n), inst === "box" || inst === "pluck" || inst === "harp" ? 6 : 3);
    const durSec = Math.max(0.08, note.d * beatDur);
    const v = (note.v == null ? 0.7 : note.v);
    switch (inst) {
      case "box": {
        const d = Math.min(0.85, 0.28 + durSec * 0.35);
        osc("sine", freq * 2, t, dest, { gain: 0.045 * v, att: 0.004, dur: d, rel: 0.12 });
        osc("sine", freq * 2.004, t, dest, { gain: 0.028 * v, att: 0.004, dur: d * 1.05, rel: 0.14 });
        osc("triangle", freq * 4, t, dest, { gain: 0.008 * v, att: 0.002, dur: d * 0.55, rel: 0.08 });
        break;
      }
      case "flute": {
        const d = durSec + 0.12;
        osc("sine", freq, t, dest, { gain: 0.055 * v, att: 0.055, dur: d, rel: 0.14, sus: 0.75, vib: 0.004, vibHz: 4.6 });
        osc("sine", freq * 2, t, dest, { gain: 0.01 * v, att: 0.07, dur: d, rel: 0.14, sus: 0.5, vib: 0.003, vibHz: 4.6 });
        break;
      }
      case "wood": {
        const d = durSec + 0.16;
        osc("sine", freq, t, dest, { gain: 0.042 * v, att: 0.08, dur: d, rel: 0.18, sus: 0.7, vib: 0.002, vibHz: 3.8 });
        osc("triangle", freq * 0.5, t, dest, { gain: 0.016 * v, att: 0.1, dur: d, rel: 0.2, sus: 0.65 });
        break;
      }
      case "pluck": {
        const d = Math.min(0.9, 0.22 + durSec * 0.4);
        osc("triangle", freq, t, dest, { gain: 0.05 * v, att: 0.003, dur: d, rel: 0.1 });
        osc("sine", freq * 2, t, dest, { gain: 0.016 * v, att: 0.002, dur: d * 0.55, rel: 0.08 });
        break;
      }
      case "harp": {
        const d = Math.min(1.4, 0.4 + durSec * 0.7);
        osc("sine", freq, t, dest, { gain: 0.04 * v, att: 0.008, dur: d, rel: 0.2 });
        osc("sine", freq * 2.003, t, dest, { gain: 0.012 * v, att: 0.01, dur: d * 0.7, rel: 0.16 });
        osc("triangle", freq * 0.5, t, dest, { gain: 0.01 * v, att: 0.012, dur: d * 0.85, rel: 0.18 });
        break;
      }
      case "bell": {
        const d = Math.min(1.6, 0.5 + durSec);
        osc("sine", freq, t, dest, { gain: 0.036 * v, att: 0.004, dur: d, rel: 0.3 });
        osc("sine", freq * 2.01, t, dest, { gain: 0.01 * v, att: 0.004, dur: d * 0.6, rel: 0.2 });
        osc("sine", freq * 3.01, t, dest, { gain: 0.005 * v, att: 0.003, dur: d * 0.35, rel: 0.12 });
        break;
      }
      case "bass": {
        const d = durSec + 0.06;
        osc("sine", freq, t, dest, { gain: 0.07 * v, att: 0.02, dur: d, rel: 0.12, sus: 0.55 });
        osc("triangle", freq * 0.5, t, dest, { gain: 0.02 * v, att: 0.03, dur: d, rel: 0.14, sus: 0.4 });
        break;
      }
      case "pulse": {
        osc("sine", freq, t, dest, { gain: 0.03 * v, att: 0.04, dur: Math.max(0.18, durSec * 0.5), rel: 0.2 });
        noiseSrc(t, 0.18, dest, { type: "lowpass", freq: 420, Q: 0.7, gain: 0.012 * v, att: 0.03, rel: 0.12 });
        break;
      }
      case "drum": {
        const bright = note.bright ? 1.15 : 1;
        osc("sine", 96 * bright, t, dest, { gain: 0.07 * v, att: 0.003, dur: 0.16, rel: 0.08, freq2: 52 * bright, glide: 0.09 });
        noiseSrc(t, 0.07, dest, { type: "lowpass", freq: 900 * bright, Q: 0.8, gain: 0.03 * v, att: 0.002, rel: 0.05 });
        break;
      }
      case "tamb": {
        noiseSrc(t, 0.055, dest, { type: "highpass", freq: 4200, Q: 0.7, gain: 0.028 * v, att: 0.002, rel: 0.04 });
        osc("sine", 4200 + Math.random() * 400, t, dest, { gain: 0.008 * v, att: 0.001, dur: 0.04, rel: 0.03 });
        break;
      }
      case "anvil": {
        osc("sine", 420, t, dest, { gain: 0.028 * v, att: 0.002, dur: 0.12, rel: 0.1, freq2: 260, glide: 0.08 });
        osc("sine", 840, t, dest, { gain: 0.012 * v, att: 0.002, dur: 0.08, rel: 0.08 });
        noiseSrc(t, 0.07, dest, { type: "bandpass", freq: 1600, Q: 3, gain: 0.02 * v, att: 0.002, rel: 0.06 });
        break;
      }
      case "clink": {
        osc("sine", 2100 + Math.random() * 500, t, dest, { gain: 0.03 * v, att: 0.001, dur: 0.07, rel: 0.05 });
        osc("sine", 3100 + Math.random() * 400, t, dest, { gain: 0.012 * v, att: 0.001, dur: 0.05, rel: 0.04 });
        noiseSrc(t, 0.04, dest, { type: "highpass", freq: 5000, Q: 0.8, gain: 0.02 * v, att: 0.001, rel: 0.03 });
        break;
      }
      default:
        osc("sine", freq, t, dest, { gain: 0.04 * v, att: 0.01, dur: durSec, rel: 0.08 });
    }
  }

  function seq(start, str, v) {
    const notes = [];
    let t = start;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok.charAt(0) === "-" || tok.charAt(0) === ".") {
        t += parseFloat(tok.replace("-", "")) || 1;
        continue;
      }
      const parts = tok.split(":");
      const d = parseFloat(parts[1]);
      notes.push({ t, d, n: parts[0], v: v == null ? 0.7 : v });
      t += d;
    }
    return notes;
  }

  function ev(t, d, n, v, extra) {
    return Object.assign({ t, d, n, v: v == null ? 0.7 : v }, extra || {});
  }

  // 風車鎮主題：8 小節 3/4（24 拍）旋律
  const WALTZ_LEAD = seq(0, "E5:1.5 D5:.5 B4:1 D5:1 E5:.5 G5:.5 A5:1 E5:2 D5:1 B4:1.5 G4:1.5 D5:1 E5:1 G5:1 A5:1.5 G5:.5 E5:1 D5:1 B4:1 A4:1 G4:3", 0.72);
  const WALTZ_WOOD = seq(0, "G4:3 D4:3 E4:3 G3:3 G4:2 E4:1 D4:3 B3:3 G3:3", 0.55);
  const WALTZ_BASS = [
    ev(0, 2.5, "G3", 0.7), ev(3, 2.5, "D3", 0.6), ev(6, 2.5, "E3", 0.65), ev(9, 2.5, "D3", 0.6),
    ev(12, 2.5, "G3", 0.7), ev(15, 2.5, "E3", 0.6), ev(18, 2.5, "D3", 0.65), ev(21, 2.8, "G3", 0.75)
  ];
  const WALTZ_PULSE = [0, 3, 6, 9, 12, 15, 18, 21].map((t, i) => ev(t, 0.8, "G2", i % 4 === 0 ? 0.55 : 0.32));

  // 4/4 草原／海岸旋律（8 小節 32 拍）
  const FIELD_LEAD = seq(0, "E5:1.5 D5:.5 B4:1 D5:1 G5:2 E5:1 D5:1 B4:1 A4:1 B4:.5 D5:.5 E5:1 D5:2 B4:2 D5:1 E5:1 G5:1 A5:1 G5:1.5 E5:.5 D5:1 B4:1 A4:1 B4:1 D5:1 E5:1 D5:1 B4:1 G4:2", 0.7);
  const FIELD_BOX = seq(0, "G5:.5 D5:.5 -1 G5:.5 E5:.5 -1 D5:.5 B4:.5 -1 G5:.5 D5:.5 -1 E5:.5 D5:.5 -1 G5:.5 E5:.5 -1 D5:.5 B4:.5 -1 G4:.5 D5:.5 -1 G5:.5 D5:.5 -1 G5:.5 E5:.5 -1 D5:.5 B4:.5 -1 G5:.5 D5:.5 -1 E5:.5 D5:.5 -1 G5:.5 E5:.5 -1 D5:.5 B4:.5 -1 G4:.5 B4:.5 -1", 0.42);

  const DOCKS_LEAD = seq(0, "E5:3 D5:1 B4:2 D5:2 E5:1 G5:1 A5:2 E5:4 D5:2 B4:3 G4:3 D5:2 E5:2 G5:2 A5:3 G5:1 E5:2 D5:2 B4:2 A4:2 G4:6", 0.68);
  const DOCKS_HARP = [];
  (function buildHarp() {
    const arps = [
      ["G3", "D4", "G4", "B4", "D5", "G5"],
      ["E3", "B3", "E4", "G4", "B4", "E5"],
      ["D3", "A3", "D4", "G4", "A4", "D5"],
      ["G3", "B3", "D4", "G4", "B4", "D5"],
      ["E3", "G3", "B3", "E4", "G4", "B4"],
      ["D3", "G3", "A3", "D4", "G4", "A4"],
      ["G3", "D4", "G4", "B4", "D5", "B4"],
      ["G3", "B3", "D4", "G4", "D4", "B3"]
    ];
    arps.forEach((arp, bar) => {
      arp.forEach((n, i) => DOCKS_HARP.push(ev(bar * 6 + i, 1.15, n, i === 0 ? 0.55 : 0.4)));
    });
  })();

  const PRELUDE_LEAD = seq(0, "G5:2 D5:1 B5:1.5 A5:.5 G5:1 E5:2 D5:1 B4:1.5 G4:1.5 D5:1 E5:1 G5:1 A5:2 G5:1 E5:1.5 D5:.5 B4:1 G5:3", 0.78);
  const PRELUDE_SPARK = [ev(0, 1, "G6", 0.28), ev(6, 1, "D6", 0.22), ev(12, 1, "E6", 0.25), ev(18, 1.2, "G6", 0.3)];

  function pattern(id, bpm, meter, loopBeats, tracks, bed) {
    return { id, bpm, meter, loopBeats, tracks, bed: bed || null };
  }

  const PATTERNS = {
    prelude: pattern("prelude", 70, 3, 24, [
      { inst: "box", notes: PRELUDE_LEAD },
      { inst: "bell", notes: PRELUDE_SPARK },
      { inst: "wood", notes: seq(0, "G4:6 D4:6 E4:6 G3:6", 0.32) }
    ]),
    plaza: pattern("plaza", 76, 3, 24, [
      { inst: "box", notes: WALTZ_LEAD },
      { inst: "wood", notes: WALTZ_WOOD },
      { inst: "bass", notes: WALTZ_BASS },
      { inst: "pulse", notes: WALTZ_PULSE }
    ]),
    forge: pattern("forge", 76, 3, 24, [
      { inst: "box", notes: WALTZ_LEAD.map((n, i) => Object.assign({}, n, { v: (n.v || 0.7) * (i % 5 === 0 ? 0.85 : 1) })) },
      { inst: "wood", notes: WALTZ_WOOD },
      { inst: "bass", notes: WALTZ_BASS },
      { inst: "pulse", notes: WALTZ_PULSE },
      { inst: "anvil", notes: [ev(8.5, 0.3, "G4", 0.55), ev(20, 0.3, "D4", 0.45)] }
    ]),
    market: pattern("market", 92, 3, 24, [
      { inst: "box", notes: WALTZ_LEAD.map((n) => Object.assign({}, n, { v: (n.v || 0.7) * 0.85 })) },
      { inst: "pluck", notes: [
        ev(0, 0.7, "G4", 0.55), ev(1.5, 0.5, "D5", 0.4), ev(3, 0.7, "B4", 0.5), ev(4.5, 0.5, "G4", 0.35),
        ev(6, 0.7, "E4", 0.5), ev(7.5, 0.5, "B4", 0.4), ev(9, 0.7, "D4", 0.5), ev(10.5, 0.5, "A4", 0.35),
        ev(12, 0.7, "G4", 0.55), ev(13.5, 0.5, "E5", 0.4), ev(15, 0.7, "D5", 0.45), ev(16.5, 0.5, "B4", 0.35),
        ev(18, 0.7, "D4", 0.5), ev(19.5, 0.5, "A4", 0.35), ev(21, 0.8, "G4", 0.55)
      ] },
      { inst: "bass", notes: WALTZ_BASS },
      { inst: "clink", notes: [ev(2.5, 0.2, "E6", 0.5), ev(8, 0.2, "G6", 0.4), ev(14.5, 0.2, "D6", 0.45), ev(21.5, 0.2, "B5", 0.4)] }
    ]),
    docks: pattern("docks", 126, 6, 48, [
      { inst: "harp", notes: DOCKS_HARP },
      { inst: "flute", notes: DOCKS_LEAD },
      { inst: "bell", notes: [ev(5, 0.4, "D6", 0.22), ev(17, 0.4, "E6", 0.18), ev(29, 0.4, "G6", 0.2), ev(41, 0.5, "D6", 0.2)] },
      { inst: "tamb", notes: (function () {
        const a = [];
        for (let bar = 0; bar < 8; bar++) {
          a.push(ev(bar * 6 + 2, 0.25, "G5", 0.28));
          a.push(ev(bar * 6 + 5, 0.25, "G5", 0.4));
        }
        return a;
      })() },
      { inst: "bass", notes: [ev(0, 5, "G3", 0.5), ev(6, 5, "E3", 0.45), ev(12, 5, "D3", 0.5), ev(18, 5, "G3", 0.5), ev(24, 5, "E3", 0.45), ev(30, 5, "D3", 0.45), ev(36, 5, "G3", 0.5), ev(42, 5.5, "G3", 0.55)] }
    ]),
    field: pattern("field", 100, 4, 32, [
      { inst: "box", notes: FIELD_BOX },
      { inst: "flute", notes: FIELD_LEAD },
      { inst: "bass", notes: [ev(0, 3.5, "G3", 0.45), ev(8, 3.5, "E3", 0.4), ev(16, 3.5, "D3", 0.42), ev(24, 3.8, "G3", 0.48)] }
    ]),
    beach: pattern("beach", 100, 4, 32, [
      { inst: "flute", notes: FIELD_LEAD.map((n) => Object.assign({}, n, { v: (n.v || 0.7) * 0.95 })) },
      { inst: "harp", notes: [
        ev(0, 2, "G4", 0.3), ev(4, 2, "D4", 0.25), ev(8, 2, "E4", 0.28), ev(12, 2, "B3", 0.25),
        ev(16, 2, "G4", 0.3), ev(20, 2, "A4", 0.26), ev(24, 2, "D4", 0.28), ev(28, 2.5, "G4", 0.32)
      ] },
      { inst: "bass", notes: [ev(0, 3.5, "G3", 0.38), ev(8, 3.5, "E3", 0.34), ev(16, 3.5, "D3", 0.36), ev(24, 3.8, "G3", 0.4)] }
    ], "waves")
  };

  function combatPattern(bpm, meter, loopBeats, bright) {
    const notesBass = [];
    const notesDrum = [];
    if (meter === 4) {
      for (let b = 0; b < loopBeats; b += 4) {
        notesBass.push(ev(b, 1.6, b % 8 === 4 ? "D3" : "G2", 0.7));
        notesBass.push(ev(b + 2, 1.2, "D3", 0.45));
        notesDrum.push(Object.assign(ev(b + 1, 0.3, "G2", 0.55), { bright }));
        notesDrum.push(Object.assign(ev(b + 3, 0.3, "G2", 0.62), { bright }));
      }
    } else if (meter === 6) {
      for (let b = 0; b < loopBeats; b += 6) {
        notesBass.push(ev(b, 2.4, "G2", 0.65));
        notesBass.push(ev(b + 3, 2, "D3", 0.5));
        notesDrum.push(Object.assign(ev(b + 2, 0.25, "G2", 0.45), { bright }));
        notesDrum.push(Object.assign(ev(b + 5, 0.25, "G2", 0.58), { bright }));
      }
    } else {
      for (let b = 0; b < loopBeats; b += 3) {
        notesBass.push(ev(b, 1.4, b % 6 === 3 ? "D3" : "G2", 0.65));
        notesDrum.push(Object.assign(ev(b + 2, 0.25, "G2", 0.55), { bright }));
      }
    }
    return pattern("combat", bpm, meter, loopBeats, [
      { inst: "bass", notes: notesBass },
      { inst: "drum", notes: notesDrum }
    ]);
  }

  function sceneKey(s) {
    if (!s) return "";
    if (s.mode && s.mode !== "play") return "prelude";
    const id = s.mapId || "plaza";
    return PATTERNS[id] ? id : "plaza";
  }

  function ensureGraph() {
    if (ctx) return;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    ctx = new A();
    noiseBuf = makeNoise();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0.0001;
    master.connect(ctx.destination);
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    duckGain.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = BGM_BUS;
    bgmBus.connect(duckGain);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_BUS;
    sfxBus.connect(master);
  }

  function fadeGain(g, to, dur, at) {
    const t = at != null ? at : now();
    const v = Math.max(0.0001, g.gain.value);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(v, t);
    if (to <= 0.0001) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, to), t + dur);
    }
  }

  function makeVoice(pat, startAt, alignOrigin) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(bgmBus);
    const beatDur = 60 / pat.bpm;
    const origin = alignOrigin != null ? alignOrigin : startAt;
    const v = {
      gain: g,
      pat,
      origin,
      nextLoop: 0,
      active: true,
      bed: null
    };
    const elapsed = Math.max(0, startAt - origin);
    const loopLen = pat.loopBeats * beatDur;
    v.nextLoop = Math.floor(elapsed / loopLen + 1e-6);
    fadeGain(g, 1, XF, startAt);
    if (pat.bed === "waves") v.bed = startWaves(g);
    voices.push(v);
    scheduleVoice(v, now() + LOOKAHEAD + 0.05);
    return v;
  }

  function stopVoice(v, at) {
    if (!v || !v.active) return;
    v.active = false;
    fadeGain(v.gain, 0.0001, XF, at);
    if (v.bed) stopWaves(v.bed, at);
    setTimeout(() => {
      try { v.gain.disconnect(); } catch (_) {}
      const i = voices.indexOf(v);
      if (i >= 0) voices.splice(i, 1);
    }, (XF + 0.35) * 1000);
  }

  function startWaves(dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 680;
    lp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    const level = ctx.createGain();
    level.gain.value = 0.032;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.11;
    const lg = ctx.createGain();
    lg.gain.value = 0.018;
    lfo.connect(lg).connect(level.gain);
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(hp).connect(lp).connect(level).connect(g).connect(dest);
    const t = now();
    fadeGain(g, 1, 1.4, t);
    src.start(t);
    lfo.start(t);
    return { src, lfo, g };
  }

  function stopWaves(bed, at) {
    if (!bed) return;
    fadeGain(bed.g, 0.0001, XF, at);
    const t = at + XF + 0.05;
    try { bed.src.stop(t); } catch (_) {}
    try { bed.lfo.stop(t); } catch (_) {}
  }

  function scheduleVoice(v, until) {
    if (!v.active || !enabled) return;
    const pat = v.pat;
    const beatDur = 60 / pat.bpm;
    const loopLen = pat.loopBeats * beatDur;
    while (v.origin + v.nextLoop * loopLen < until) {
      const start = v.origin + v.nextLoop * loopLen;
      if (start + loopLen > now() - 0.05) {
        for (let i = 0; i < pat.tracks.length; i++) {
          const tr = pat.tracks[i];
          for (let j = 0; j < tr.notes.length; j++) {
            const n = tr.notes[j];
            const t = start + n.t * beatDur;
            if (t >= now() - 0.02) playInst(tr.inst, n, t, beatDur, v.gain);
          }
        }
      }
      v.nextLoop++;
    }
  }

  function schedulerTick() {
    schedulerTimer = setTimeout(schedulerTick, TICK_MS);
    if (!ctx || !enabled) return;
    const until = now() + LOOKAHEAD + 0.05;
    for (let i = 0; i < voices.length; i++) scheduleVoice(voices[i], until);
  }

  function startScheduler() {
    if (schedulerTimer != null) return;
    schedulerTimer = setTimeout(schedulerTick, TICK_MS);
  }

  function applyScene(force) {
    if (!ctx || !enabled) return;
    const key = sceneKey(wanted);
    const t = now();
    if (force || key !== liveKey) {
      const pat = PATTERNS[key] || PATTERNS.plaza;
      const keep = voices.slice();
      for (let i = 0; i < keep.length; i++) {
        if (keep[i] !== combatVoice) stopVoice(keep[i], t);
      }
      makeVoice(pat, t + 0.02);
      liveKey = key;
      if (combatVoice) {
        stopVoice(combatVoice, t);
        combatVoice = null;
        combatOn = false;
      }
    }
    const wantCombat = !!(wanted.inCombat && wanted.mode === "play" && !wanted.safe && (wanted.mapId === "field" || wanted.mapId === "beach"));
    if (wantCombat !== combatOn) {
      combatOn = wantCombat;
      if (wantCombat) {
        const base = PATTERNS[liveKey] || PATTERNS.field;
        const cpat = combatPattern(base.bpm, base.meter, base.loopBeats, liveKey === "beach");
        let origin = t + 0.02;
        const explore = voices.find((v) => v.active && v !== combatVoice);
        if (explore && explore.pat.bpm === cpat.bpm) origin = explore.origin;
        combatVoice = makeVoice(cpat, t + 0.02, origin);
      } else if (combatVoice) {
        stopVoice(combatVoice, t);
        combatVoice = null;
      }
    }
  }

  function duck(amount, hold, release) {
    if (!ctx || !enabled) return;
    const t = now();
    const g = duckGain.gain;
    const cur = Math.max(0.0001, g.value);
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t);
    g.linearRampToValueAtTime(amount, t + 0.05);
    g.setValueAtTime(amount, t + 0.05 + hold);
    g.linearRampToValueAtTime(1, t + 0.05 + hold + release);
  }

  const lastSfx = Object.create(null);
  function throttle(name, minMs) {
    const t = performance.now();
    if (lastSfx[name] != null && t - lastSfx[name] < minMs) return false;
    lastSfx[name] = t;
    return true;
  }

  function sfxOk() { return !!(ctx && enabled && sfxBus); }

  function sfxUi() {
    if (!sfxOk() || !throttle("ui", 50)) return;
    const t = now();
    const f = vary(freqOf("D6"), 18);
    osc("sine", f, t, sfxBus, { gain: 0.09, att: 0.002, dur: 0.07, rel: 0.04 });
    osc("sine", f * 2.01, t, sfxBus, { gain: 0.025, att: 0.002, dur: 0.05, rel: 0.03 });
  }

  function sfxAttack(classId) {
    if (!sfxOk() || !throttle("attack", 90)) return;
    const t = now();
    const id = classId || "sword";
    if (id === "sword") {
      noiseSrc(t, 0.09, sfxBus, { type: "bandpass", freq: 900, freq2: 2200, Q: 1.8, gain: 0.07, att: 0.008, rel: 0.05 });
      osc("sine", vary(1680, 20), t + 0.04, sfxBus, { gain: 0.07, att: 0.002, dur: 0.07, rel: 0.04, freq2: 900, glide: 0.05 });
      noiseSrc(t + 0.042, 0.04, sfxBus, { type: "bandpass", freq: 2400, Q: 3, gain: 0.05, att: 0.001, rel: 0.03 });
    } else if (id === "mage") {
      osc("sine", vary(440, 16), t, sfxBus, { gain: 0.07, att: 0.01, dur: 0.16, rel: 0.06, freq2: 1320, glide: 0.14 });
      osc("sine", vary(1760, 30), t + 0.08, sfxBus, { gain: 0.04, att: 0.004, dur: 0.1, rel: 0.06 });
      osc("sine", vary(2340, 40), t + 0.1, sfxBus, { gain: 0.025, att: 0.003, dur: 0.08, rel: 0.05 });
    } else if (id === "archer") {
      osc("triangle", vary(392, 12), t, sfxBus, { gain: 0.08, att: 0.002, dur: 0.08, rel: 0.04, freq2: 280, glide: 0.06 });
      noiseSrc(t + 0.03, 0.08, sfxBus, { type: "bandpass", freq: 1800, freq2: 3200, Q: 2, gain: 0.06, att: 0.01, rel: 0.04 });
    } else if (id === "priest") {
      osc("sine", vary(freqOf("G5"), 10), t, sfxBus, { gain: 0.08, att: 0.006, dur: 0.16, rel: 0.1 });
      osc("sine", vary(freqOf("D6"), 12), t + 0.02, sfxBus, { gain: 0.05, att: 0.008, dur: 0.18, rel: 0.12 });
      osc("sine", vary(freqOf("B5"), 8), t + 0.04, sfxBus, { gain: 0.035, att: 0.01, dur: 0.14, rel: 0.1 });
    } else {
      const fs = [vary(freqOf("E6"), 18), vary(freqOf("G6"), 22), vary(freqOf("D6"), 16)];
      fs.forEach((f, i) => osc("sine", f, t + i * 0.03, sfxBus, { gain: 0.07 - i * 0.012, att: 0.001, dur: 0.08, rel: 0.05 }));
    }
  }

  function sfxSkill(index, classId) {
    if (!sfxOk() || !throttle("skill", 80)) return;
    const t = now();
    const i = index || 0;
    const root = classId === "priest" ? ["G4", "B4", "D5", "G5"] :
      classId === "mage" ? ["D5", "G5", "A5", "D6"] :
      classId === "archer" ? ["B4", "D5", "G5", "A5"] :
      classId === "merchant" ? ["D5", "E5", "G5", "B5"] :
      ["G4", "D5", "E5", "G5"];
    root.forEach((n, k) => {
      osc("sine", vary(freqOf(n), 10), t + k * 0.055, sfxBus, { gain: 0.06, att: 0.008, dur: 0.22 + i * 0.04, rel: 0.1 });
    });
    if (classId === "mage") {
      osc("sine", 520, t, sfxBus, { gain: 0.04, att: 0.02, dur: 0.28, rel: 0.1, freq2: 1400, glide: 0.22 });
    }
  }

  function sfxUlt(classId) {
    if (!sfxOk() || !throttle("ult", 200)) return;
    const t = now();
    const chord = classId === "priest" ? ["G4", "B4", "D5", "G5", "D6"] :
      classId === "mage" ? ["G4", "D5", "A5", "E6"] :
      classId === "merchant" ? ["G4", "D5", "G5", "B5", "D6"] :
      ["G4", "D5", "G5", "B5"];
    chord.forEach((n, k) => {
      osc("sine", freqOf(n), t + k * 0.04, sfxBus, { gain: 0.07, att: 0.01, dur: 0.7, rel: 0.3 });
      osc("sine", freqOf(n) * 2.01, t + k * 0.04, sfxBus, { gain: 0.02, att: 0.012, dur: 0.45, rel: 0.2 });
    });
    osc("sine", freqOf("G5"), t, sfxBus, { gain: 0.08, att: 0.004, dur: 1.1, rel: 0.4 });
    osc("sine", freqOf("D6"), t + 0.06, sfxBus, { gain: 0.06, att: 0.006, dur: 0.9, rel: 0.35 });
    duck(0.55, 0.2, 0.35);
  }

  function sfxHit(opts) {
    if (!sfxOk() || !throttle("hit", 55)) return;
    const crit = !!(opts && opts.crit);
    const t = now();
    const f = vary(crit ? 1480 : 980, 28);
    osc("sine", f, t, sfxBus, { gain: crit ? 0.1 : 0.07, att: 0.001, dur: crit ? 0.14 : 0.07, rel: 0.05, freq2: f * 0.7, glide: 0.05 });
    noiseSrc(t, crit ? 0.07 : 0.035, sfxBus, { type: "bandpass", freq: crit ? 2600 : 1800, Q: 2.4, gain: crit ? 0.05 : 0.03, att: 0.001, rel: 0.03 });
    if (crit) osc("sine", vary(freqOf("D6"), 16), t + 0.02, sfxBus, { gain: 0.05, att: 0.003, dur: 0.16, rel: 0.08 });
    duck(crit ? 0.55 : 0.72, crit ? 0.12 : 0.07, crit ? 0.25 : 0.16);
  }

  function sfxHurt() {
    if (!sfxOk() || !throttle("hurt", 80)) return;
    const t = now();
    osc("sine", vary(180, 20), t, sfxBus, { gain: 0.1, att: 0.003, dur: 0.14, rel: 0.08, freq2: 90, glide: 0.1 });
    osc("triangle", vary(140, 12), t, sfxBus, { gain: 0.05, att: 0.004, dur: 0.12, rel: 0.07 });
    noiseSrc(t, 0.08, sfxBus, { type: "lowpass", freq: 500, Q: 0.7, gain: 0.04, att: 0.003, rel: 0.05 });
  }

  function sfxLevelUp() {
    if (!sfxOk()) return;
    const t = now();
    const run = ["G4", "B4", "D5", "G5", "B5", "D6", "G6"];
    run.forEach((n, i) => {
      osc("sine", freqOf(n), t + i * 0.07, sfxBus, { gain: 0.08, att: 0.006, dur: 0.45, rel: 0.2 });
      osc("sine", freqOf(n) * 2.01, t + i * 0.07, sfxBus, { gain: 0.02, att: 0.008, dur: 0.3, rel: 0.14 });
    });
    osc("sine", freqOf("G5"), t, sfxBus, { gain: 0.09, att: 0.008, dur: 1.3, rel: 0.45 });
    osc("sine", freqOf("D5"), t + 0.02, sfxBus, { gain: 0.07, att: 0.01, dur: 1.2, rel: 0.4 });
    osc("sine", freqOf("B5"), t + 0.04, sfxBus, { gain: 0.05, att: 0.01, dur: 1.0, rel: 0.4 });
    duck(0.32, 0.4, 0.55);
  }

  function sfxCoins() {
    if (!sfxOk() || !throttle("coins", 150)) return;
    const t = now();
    const fs = [vary(freqOf("E6"), 14), vary(freqOf("G6"), 18), vary(freqOf("D6"), 14), vary(freqOf("B5"), 16)];
    const dt = [0, 0.07, 0.14, 0.22];
    fs.forEach((f, i) => {
      osc("sine", f, t + dt[i], sfxBus, { gain: 0.08 - i * 0.01, att: 0.001, dur: 0.1, rel: 0.07 });
      osc("sine", f * 2.02, t + dt[i], sfxBus, { gain: 0.02, att: 0.001, dur: 0.06, rel: 0.04 });
    });
  }

  function sfxWarp() {
    if (!sfxOk() || !throttle("warp", 250)) return;
    const t = now();
    noiseSrc(t, 0.28, sfxBus, { type: "bandpass", freq: 400, freq2: 2400, Q: 1.4, gain: 0.07, att: 0.03, rel: 0.12 });
    osc("sine", 320, t, sfxBus, { gain: 0.06, att: 0.04, dur: 0.32, rel: 0.12, freq2: 1280, glide: 0.28 });
    ["G5", "D6", "G6", "B5"].forEach((n, i) => {
      osc("sine", freqOf(n), t + 0.08 + i * 0.05, sfxBus, { gain: 0.045, att: 0.006, dur: 0.22, rel: 0.12 });
    });
  }

  function sfxDeath() {
    if (!sfxOk()) return;
    const t = now();
    const run = ["E5", "D5", "B4", "A4", "G4", "D4"];
    run.forEach((n, i) => {
      osc("sine", freqOf(n), t + i * 0.11, sfxBus, { gain: 0.07, att: 0.02, dur: 0.32, rel: 0.14, vib: 0.002, vibHz: 3.2 });
    });
  }

  function sfxMount(on) {
    if (!sfxOk() || !throttle("mount", 180)) return;
    const t = now();
    const bells = on ? ["G5", "B5", "D6"] : ["D6", "B5", "G5"];
    bells.forEach((n, i) => {
      osc("sine", vary(freqOf(n), 8), t + i * 0.06, sfxBus, { gain: 0.07, att: 0.004, dur: 0.22, rel: 0.12 });
      osc("sine", freqOf(n) * 2.01, t + i * 0.06, sfxBus, { gain: 0.018, att: 0.004, dur: 0.14, rel: 0.08 });
    });
    noiseSrc(t, 0.1, sfxBus, { type: "bandpass", freq: on ? 700 : 1400, freq2: on ? 1600 : 500, Q: 1.6, gain: 0.04, att: 0.012, rel: 0.06 });
  }

  function sfxItem(kind) {
    if (!sfxOk() || !throttle("item", 120)) return;
    const t = now();
    if (kind === "potion") {
      osc("sine", vary(freqOf("E5"), 10), t, sfxBus, { gain: 0.07, att: 0.008, dur: 0.14, rel: 0.08 });
      osc("sine", vary(freqOf("G5"), 10), t + 0.06, sfxBus, { gain: 0.06, att: 0.01, dur: 0.16, rel: 0.1 });
      noiseSrc(t, 0.08, sfxBus, { type: "lowpass", freq: 1400, Q: 0.6, gain: 0.025, att: 0.01, rel: 0.05 });
    } else if (kind === "elixir") {
      osc("sine", vary(freqOf("B5"), 10), t, sfxBus, { gain: 0.07, att: 0.006, dur: 0.14, rel: 0.08 });
      osc("sine", vary(freqOf("E6"), 12), t + 0.07, sfxBus, { gain: 0.06, att: 0.008, dur: 0.18, rel: 0.1 });
    } else {
      noiseSrc(t, 0.07, sfxBus, { type: "bandpass", freq: 1800, Q: 1.2, gain: 0.04, att: 0.004, rel: 0.05 });
      osc("triangle", vary(freqOf("D5"), 14), t + 0.02, sfxBus, { gain: 0.06, att: 0.004, dur: 0.12, rel: 0.07 });
    }
  }

  function sfxTalk() {
    if (!sfxOk() || !throttle("talk", 200)) return;
    const t = now();
    osc("sine", vary(freqOf("G4"), 8), t, sfxBus, { gain: 0.05, att: 0.002, dur: 0.06, rel: 0.04 });
    osc("triangle", vary(freqOf("D4"), 10), t + 0.03, sfxBus, { gain: 0.035, att: 0.003, dur: 0.07, rel: 0.04 });
    noiseSrc(t, 0.05, sfxBus, { type: "bandpass", freq: 1200, Q: 1, gain: 0.02, att: 0.004, rel: 0.04 });
  }

  function resume() {
    ensureGraph();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    startScheduler();
    applyScene(voices.length === 0);
  }

  function setEnabled(on) {
    const was = enabled;
    enabled = !!on;
    if (!ctx) return;
    fadeGain(master, enabled ? 1 : 0.0001, enabled ? 0.5 : 0.35);
    if (enabled) {
      startScheduler();
      if (ctx.state === "suspended") ctx.resume();
      applyScene(!was || voices.length === 0);
    }
  }

  function setScene(s) {
    if (!s) return;
    const next = {
      mode: s.mode || wanted.mode,
      mapId: s.mapId || wanted.mapId,
      safe: !!s.safe,
      inCombat: !!s.inCombat
    };
    const same = next.mode === wanted.mode && next.mapId === wanted.mapId && next.safe === wanted.safe && next.inCombat === wanted.inCombat;
    wanted = next;
    if (!ctx) return;
    if (same && voices.length) return;
    applyScene(false);
  }

  window.CSTAudio = {
    resume,
    setEnabled,
    setScene,
    sfx: {
      ui: sfxUi,
      attack: sfxAttack,
      skill: sfxSkill,
      ult: sfxUlt,
      hit: sfxHit,
      hurt: sfxHurt,
      levelUp: sfxLevelUp,
      coins: sfxCoins,
      warp: sfxWarp,
      death: sfxDeath,
      mount: sfxMount,
      item: sfxItem,
      talk: sfxTalk
    }
  };
})();
