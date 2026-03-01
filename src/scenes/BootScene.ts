import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.svg('cage-bg', 'archive/hamster-keeper-98/public/assets/sprites/cage_bg.svg');
    this.load.svg('hamster-idle-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_idle_1.svg');
    this.load.svg('hamster-idle-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_idle_2.svg');
    this.load.svg('hamster-happy-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_happy_1.svg');
    this.load.svg('hamster-happy-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_happy_2.svg');
    this.load.svg('hamster-stress-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_stress_1.svg');
    this.load.svg('hamster-stress-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_stress_2.svg');
    this.load.svg('hamster-sleep-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_sleep_1.svg');
    this.load.svg('hamster-sleep-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_sleep_2.svg');
    this.load.svg('hamster-eat-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_eat_1.svg');
    this.load.svg('hamster-eat-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_eat_2.svg');

    this.load.audio('ui-click', 'assets/audio/ui_click.wav');
    this.load.audio('hamster-squeak', 'archive/hamster-keeper-98/public/assets/audio/hamster_squeak.wav');
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
