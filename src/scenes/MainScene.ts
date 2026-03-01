import Phaser from 'phaser';
import { AudioSystem } from '../game/systems/AudioSystem';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1f30');

    this.audioSystem = new AudioSystem(this);
    this.addCenteredText('Home', 'Select an item from the top-right menu to route to another scene.');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  private addCenteredText(title: string, subtitle: string): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 18, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        color: '#dbe7ff',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, subtitle, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#9bb0d3',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setWordWrapWidth(Math.min(620, this.scale.width - 32));
  }

  private shutdown(): void {
    this.input.off('pointerdown', this.handlePointerDown, this);
  }

  private handlePointerDown(): void {
    this.audioSystem?.unlock();
  }
}
