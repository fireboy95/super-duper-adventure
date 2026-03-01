import Phaser from 'phaser';

export interface PlaySfxOptions {
  config?: Phaser.Types.Sound.SoundConfig;
  warnOnMissing?: boolean;
}

export class AudioSystem {
  private readonly scene: Phaser.Scene;
  private readonly sfxCache = new Map<string, Phaser.Sound.BaseSound>();
  private fallbackAudioContext?: AudioContext;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  unlock(): void {
    if (this.scene.sound.locked) {
      this.scene.sound.unlock();
    }

    this.resumeFallbackContext();
  }

  playSfx(key: string, options?: PlaySfxOptions): boolean {
    if (!this.scene.cache.audio.exists(key)) {
      if (options?.warnOnMissing) {
        console.warn(
          `[AudioSystem] Missing audio key: ${key}. Falling back to generated blip.`
        );
      }
      return this.playFallbackBlip();
    }

    const sound = this.getOrCreateSfx(key, options?.config);
    if (!sound) {
      return this.playFallbackBlip();
    }

    sound.play();
    return true;
  }

  private getOrCreateSfx(
    key: string,
    config?: Phaser.Types.Sound.SoundConfig
  ): Phaser.Sound.BaseSound | undefined {
    const cached = this.sfxCache.get(key);
    if (cached) {
      return cached;
    }

    const created = this.scene.sound.add(key, config);
    if (!created) {
      return undefined;
    }

    this.sfxCache.set(key, created);
    return created;
  }

  private getFallbackContext(): AudioContext | undefined {
    if (this.fallbackAudioContext) {
      return this.fallbackAudioContext;
    }

    const webkitCtor = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctor = window.AudioContext ?? webkitCtor;
    if (!Ctor) {
      return undefined;
    }

    this.fallbackAudioContext = new Ctor();
    return this.fallbackAudioContext;
  }

  private resumeFallbackContext(): void {
    const context = this.getFallbackContext();
    if (!context || context.state !== 'suspended') {
      return;
    }

    void context.resume();
  }

  private playFallbackBlip(): boolean {
    const context = this.getFallbackContext();
    if (!context || context.state === 'closed') {
      return false;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.09);

    return true;
  }
}
