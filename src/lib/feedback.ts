type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export class FeedbackManager {
  private audioCtx: AudioContext | null = null;

  private initAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") void this.audioCtx.resume().catch(() => {});
    return this.audioCtx;
  }

  private tone(context: AudioContext, frequency: number, start: number, duration: number, volume: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  playKaching(): void {
    try {
      const context = this.initAudio();
      if (context) {
        const now = context.currentTime;
        this.tone(context, 987.77, now, 0.3, 0.24);
        this.tone(context, 1318.51, now + 0.08, 0.42, 0.24);
      }
    } catch {}
    this.triggerHaptic([40, 60, 80]);
  }

  playBeep(): void {
    try {
      const context = this.initAudio();
      if (context) this.tone(context, 1200, context.currentTime, 0.1, 0.16);
    } catch {}
    this.triggerHaptic(30);
  }

  triggerHaptic(pattern: number | number[]): void {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
    } catch {}
  }
}

export const feedback = new FeedbackManager();
