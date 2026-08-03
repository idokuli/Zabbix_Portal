import { SEVERITIES } from "../severity";

const BEEPS: Record<number, { beeps: number; freq: number }> = {
  5: { beeps: 3, freq: 880 },
  4: { beeps: 2, freq: 740 },
  3: { beeps: 2, freq: 587 },
  2: { beeps: 1, freq: 440 },
  1: { beeps: 1, freq: 330 },
  0: { beeps: 1, freq: 330 },
};

export const SEV: Record<
  number,
  { label: string; color: string; bg: string; beeps: number; freq: number }
> = Object.fromEntries(
  SEVERITIES.map((s) => [s.value, { label: s.label, color: s.color, bg: s.bg, ...BEEPS[s.value] }]),
);

export const getSev = (n: number) => SEV[n] ?? SEV[0];

export const tone = (
  ctx: AudioContext,
  {
    freq,
    start,
    dur,
    type = "sine",
    peak = 0.35,
  }: {
    freq: number;
    start: number;
    dur: number;
    type?: OscillatorType;
    peak?: number;
  },
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur);
};

export type SoundPreset = { label: string; play: (ctx: AudioContext, severity: number) => void };

export const SOUND_PRESETS: Record<string, SoundPreset> = {
  beep: {
    label: "Beep",
    play: (ctx, severity) => {
      const { beeps, freq } = getSev(severity);
      for (let i = 0; i < beeps; i++) {
        tone(ctx, { freq, start: i * 0.28, dur: 0.22 });
      }
    },
  },
  chime: {
    label: "Chime",
    play: (ctx, severity) => {
      const notes = severity >= 4 ? [523, 659, 784, 1047] : [523, 659, 784];
      notes.forEach((freq, i) => {
        tone(ctx, { freq, start: i * 0.13, dur: 0.35, type: "triangle", peak: 0.3 });
      });
    },
  },
  ping: {
    label: "Ping",
    play: (_ctx, severity) =>
      tone(_ctx, {
        freq: severity >= 4 ? 1175 : 880,
        start: 0,
        dur: 0.5,
        type: "triangle",
        peak: 0.32,
      }),
  },
  alarm: {
    label: "Alarm",
    play: (ctx, severity) => {
      const pulses = Math.min(5, 2 + severity);
      for (let i = 0; i < pulses; i++) {
        tone(ctx, {
          freq: i % 2 ? 660 : 880,
          start: i * 0.16,
          dur: 0.13,
          type: "square",
          peak: 0.28,
        });
      }
    },
  },
};

export const DEFAULT_SOUND_PRESET = "beep";

export const playAlertSound = (severity: number, presetKey: string = DEFAULT_SOUND_PRESET) => {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    (SOUND_PRESETS[presetKey] ?? SOUND_PRESETS[DEFAULT_SOUND_PRESET]).play(ctx, severity);
  } catch {
    // audio not available
  }
};
