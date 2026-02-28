import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Placeholder preload hook for future sprite/audio assets.
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
