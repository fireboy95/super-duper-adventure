import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.svg('cage-bg', 'assets/sprites/cage_bg.svg');
    this.load.svg('hamster-idle-1', 'assets/sprites/hamster_idle_1.svg');
    this.load.svg('hamster-idle-2', 'assets/sprites/hamster_idle_2.svg');

    this.load.audio('ui-click', 'assets/audio/ui_click.wav');
    this.load.audio('hamster-squeak', 'assets/audio/hamster_squeak.wav');
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
