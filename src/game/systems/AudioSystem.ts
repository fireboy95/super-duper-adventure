import Phaser from 'phaser';

export interface PlaySfxOptions {
  config?: Phaser.Types.Sound.SoundConfig;
  warnOnMissing?: boolean;
}

export class AudioSystem {
  private readonly scene: Phaser.Scene;
  private readonly sfxCache = new Map<string, Phaser.Sound.BaseSound>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  unlock(): void {
    if (!this.scene.sound.locked) {
      return;
    }

    this.scene.sound.unlock();
  }

  playSfx(key: string, options?: PlaySfxOptions): boolean {
    if (!this.scene.cache.audio.exists(key)) {
      if (options?.warnOnMissing) {
        console.warn(`[AudioSystem] Missing audio key: ${key}`);
      }
      return false;
    }

    const sound = this.getOrCreateSfx(key, options?.config);
    if (!sound) {
      return false;
    }

    sound.play();
    return true;
  }

  playMoveBlip(volume = 0.035): boolean {
    if (this.scene.sound.locked) {
      return false;
    }

    const soundManager = this.scene.sound;
    if (!("context" in soundManager)) {
      return false;
    }

    const audioContext = soundManager.context;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.08);
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
}
