import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.svg('habitat-bg', 'archive/hamster-keeper-98/public/assets/sprites/cage_bg.svg');
    this.load.svg('companion-idle-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_idle_1.svg');
    this.load.svg('companion-idle-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_idle_2.svg');
    this.load.svg('companion-happy-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_happy_1.svg');
    this.load.svg('companion-happy-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_happy_2.svg');
    this.load.svg('companion-stress-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_stress_1.svg');
    this.load.svg('companion-stress-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_stress_2.svg');
    this.load.svg('companion-sleep-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_sleep_1.svg');
    this.load.svg('companion-sleep-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_sleep_2.svg');
    this.load.svg('companion-eat-1', 'archive/hamster-keeper-98/public/assets/sprites/hamster_eat_1.svg');
    this.load.svg('companion-eat-2', 'archive/hamster-keeper-98/public/assets/sprites/hamster_eat_2.svg');

    this.load.audio('ui-click', 'assets/audio/ui_click.wav');
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
