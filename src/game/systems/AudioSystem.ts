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
