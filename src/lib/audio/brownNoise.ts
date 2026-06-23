export class BrownNoiseEngine {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private volume = 0.18;
  private fadeInMs = 500;

  async prepare(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.context) {
      this.context = new AudioContext();
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setFadeInMs(fadeInMs: number): void {
    this.fadeInMs = Math.max(0, fadeInMs);
  }

  async start(): Promise<void> {
    await this.prepare();
    if (!this.context || !this.gainNode) {
      return;
    }

    if (this.source) {
      return;
    }

    const buffer = this.createBuffer(this.context);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode);

    const now = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(0, now);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, now + this.fadeInMs / 1000);

    source.start();
    source.onended = () => {
      if (this.source === source) {
        this.source = null;
      }
    };
    this.source = source;
  }

  stop(): void {
    if (!this.source) {
      return;
    }

    this.source.stop();
    this.source.disconnect();
    this.source = null;
    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(this.context?.currentTime ?? 0);
      this.gainNode.gain.value = 0;
    }
  }

  private createBuffer(context: AudioContext): AudioBuffer {
    const durationSeconds = 2;
    const frameCount = context.sampleRate * durationSeconds;
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[index] = lastOut * 3.5;
    }

    return buffer;
  }
}
