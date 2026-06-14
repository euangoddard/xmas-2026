// All audio is synthesised in-browser with the Web Audio API — no asset files,
// no licensing. A gentle music-box progression loops under a convolution
// reverb, and a sleigh-bell jingle fires on shake.

const midiToFreq = (m: number): number => 440 * 2 ** ((m - 69) / 12);

// A warm, cosy four-bar progression (Cadd9 · Am7 · Fmaj7 · G), one octave-ish
// of voicing each. Notes are arpeggiated as music-box bells across each bar.
const PROGRESSION: number[][] = [
  [60, 64, 67, 71, 74],
  [57, 60, 64, 67, 71],
  [53, 57, 60, 64, 67],
  [55, 59, 62, 67, 71],
];
const BAR_DUR = 3.4; // seconds per chord

export interface AudioManager {
  toggleMute: () => boolean; // returns the new muted state
  readonly muted: boolean;
  playBells: () => void;
  resume: () => void;
}

export function createAudio(): AudioManager {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let reverb: ConvolverNode;
  let musicBus: GainNode;
  let sfxBus: GainNode;
  let muted = true;
  let schedulerTimer: number | undefined;
  let nextBarTime = 0;
  let bar = 0;

  // ---- Lazy graph construction (must follow a user gesture) ---------------
  function ensureContext(): AudioContext {
    if (ctx) {
      return ctx;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();

    master = ctx.createGain();
    master.gain.value = 0; // start silent; ramped up on unmute
    master.connect(ctx.destination);

    // Simple generated impulse response for a soft hall reverb.
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.6, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    reverb.connect(wet).connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    musicBus.connect(reverb);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.7;
    sfxBus.connect(master);
    sfxBus.connect(reverb);

    return ctx;
  }

  function makeImpulse(
    context: AudioContext,
    seconds: number,
    decay: number,
  ): AudioBuffer {
    const rate = context.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = context.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      }
    }
    return buf;
  }

  // ---- Voices -------------------------------------------------------------
  // FM bell: a carrier whose pitch is briefly bent by a decaying modulator,
  // giving the inharmonic shimmer of a music-box / celesta note.
  function bell(freq: number, time: number, dur: number, gain: number): void {
    if (!ctx) {
      return;
    }
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = freq;

    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = freq * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 1.4, time);
    modGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.6);
    mod.connect(modGain).connect(carrier.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    carrier.connect(env).connect(musicBus);
    carrier.start(time);
    mod.start(time);
    carrier.stop(time + dur + 0.05);
    mod.stop(time + dur + 0.05);
  }

  // Soft sustained pad on the chord root for warmth beneath the bells.
  function pad(freq: number, time: number, dur: number): void {
    if (!ctx) {
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.06, time + 0.6);
    env.gain.setValueAtTime(0.06, time + dur - 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleBar(index: number, time: number): void {
    const chord = PROGRESSION[index % PROGRESSION.length] as number[];
    pad(midiToFreq((chord[0] as number) - 12), time, BAR_DUR);
    chord.forEach((note, i) => {
      bell(midiToFreq(note + 12), time + i * 0.42, 2.4, 0.16);
    });
    // A little answering twinkle in the back half of the bar.
    bell(
      midiToFreq((chord[2] as number) + 24),
      time + BAR_DUR * 0.62,
      1.6,
      0.08,
    );
  }

  function scheduler(): void {
    if (!ctx) {
      return;
    }
    while (nextBarTime < ctx.currentTime + 0.4) {
      scheduleBar(bar, nextBarTime);
      bar++;
      nextBarTime += BAR_DUR;
    }
  }

  function startMusic(): void {
    if (!ctx || schedulerTimer !== undefined) {
      return;
    }
    nextBarTime = ctx.currentTime + 0.15;
    bar = 0;
    scheduler();
    schedulerTimer = window.setInterval(scheduler, 200);
  }

  // ---- Public API ---------------------------------------------------------
  function resume(): void {
    void ctx?.resume();
  }

  function setMuted(next: boolean): void {
    muted = next;
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(next ? 0 : 0.9, now + 0.4);
  }

  function toggleMute(): boolean {
    const context = ensureContext();
    void context.resume();
    if (muted) {
      startMusic();
    }
    setMuted(!muted);
    return muted;
  }

  // Sleigh-bell jingle: a few quick filtered-noise shakes plus bright partials.
  function playBells(): void {
    if (muted || !ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const shakes = 5;
    for (let s = 0; s < shakes; s++) {
      const t = t0 + s * 0.085 + Math.random() * 0.01;
      // Noise shaker
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoise(ctx, 0.12);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 4200 + Math.random() * 1200;
      bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      noise.connect(bp).connect(ng).connect(sfxBus);
      noise.start(t);
      noise.stop(t + 0.14);
      // Bright bell partials on top of each shake
      for (const f of [2637, 3136, 4186]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f * (0.99 + Math.random() * 0.02);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(sfxBus);
        o.start(t);
        o.stop(t + 0.22);
      }
    }
  }

  function makeNoise(context: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(context.sampleRate * seconds);
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  return {
    toggleMute,
    get muted(): boolean {
      return muted;
    },
    playBells,
    resume,
  };
}
