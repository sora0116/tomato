export class BrownNoiseEngine {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private volume = 0.18;
  private fadeInMs = 500;
  private fadeTimer: number | null = null;

  async prepare(): Promise<void> {
    this.ensureAudio();
  }

  prime(): void {
    this.ensureAudio();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.audio && this.fadeTimer === null) {
      this.audio.volume = this.volume;
    }
  }

  setFadeInMs(fadeInMs: number): void {
    this.fadeInMs = Math.max(0, fadeInMs);
  }

  async start(): Promise<void> {
    const audio = this.ensureAudio();
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      return;
    }

    audio.currentTime = 0;
    audio.volume = 0;
    await audio.play();
    this.fadeIn();
  }

  stop(): void {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (!this.audio) {
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.volume = 0;
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.audio) {
      return this.audio;
    }

    this.objectUrl = URL.createObjectURL(this.createNoiseWavBlob());
    const audio = new Audio(this.objectUrl);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    this.audio = audio;
    return audio;
  }

  private fadeIn(): void {
    if (!this.audio) {
      return;
    }

    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.fadeInMs <= 0) {
      this.audio.volume = this.volume;
      return;
    }

    const startedAt = performance.now();
    this.fadeTimer = window.setInterval(() => {
      if (!this.audio) {
        return;
      }

      const progress = Math.min(1, (performance.now() - startedAt) / this.fadeInMs);
      this.audio.volume = this.volume * progress;
      if (progress >= 1 && this.fadeTimer !== null) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 16);
  }

  private createNoiseWavBlob(): Blob {
    const sampleRate = 44_100;
    const durationSeconds = 24;
    const frameCount = sampleRate * durationSeconds;
    const dataSize = frameCount * 2;
    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);
    const samples = this.createGentleNoiseSamples(frameCount);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    for (let index = 0; index < frameCount; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
      view.setInt16(44 + index * 2, sample * 0x7fff, true);
    }

    return new Blob([wav], { type: "audio/wav" });
  }

  private createGentleNoiseSamples(frameCount: number): Float32Array {
    const samples = new Float32Array(frameCount);
    let brown = 0;
    let low = 0;
    let sub = 0;
    let dcInput = 0;
    let dcOutput = 0;
    let maxAbs = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.018) / 1.018;
      low = low * 0.975 + brown * 0.025;
      sub = sub * 0.992 + low * 0.008;

      const mixed = brown * 0.62 + low * 0.3 + sub * 0.07 + white * 0.01;
      const highPassed = mixed - dcInput + 0.9985 * dcOutput;
      dcInput = mixed;
      dcOutput = highPassed;

      const sample = Math.tanh(highPassed * 2.4);
      samples[index] = sample;
      maxAbs = Math.max(maxAbs, Math.abs(sample));
    }

    if (maxAbs > 0) {
      const scale = 0.36 / maxAbs;
      for (let index = 0; index < frameCount; index += 1) {
        samples[index] *= scale;
      }
    }

    // Avoid a click at the loop boundary.
    const fadeFrames = 2_000;
    for (let index = 0; index < fadeFrames; index += 1) {
      const gain = index / fadeFrames;
      samples[index] *= gain;
      samples[frameCount - 1 - index] *= gain;
    }

    return samples;
  }
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
