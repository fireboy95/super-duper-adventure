import Phaser from 'phaser';
import { EventSystem } from '../systems/EventSystem';
import { SimulationManager } from '../systems/SimulationManager';

export class CageScene extends Phaser.Scene {
  private simulation = new SimulationManager();
  private eventSystem = new EventSystem();
  private accumulatedMs = 0;
  private statusText?: Phaser.GameObjects.Text;
  private hamster?: Phaser.GameObjects.Sprite;

  constructor() {
    super('CageScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2a2f2a');

    this.add.image(320, 240, 'cage-bg');
    this.add.text(80, 80, 'CAGE VIEW', { fontFamily: 'monospace', fontSize: '16px', color: '#111111' });

    this.createHamsterSprite();

    this.statusText = this.add.text(80, 360, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.simulation.applyPlayerAction('feed_standard');
      if (pointer.rightButtonDown()) this.simulation.applyPlayerAction('clean_cage');
    });

    this.events.on('action:feed', this.handleFeedAction, this);
    this.events.on('action:clean', this.handleCleanAction, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('action:feed', this.handleFeedAction, this);
      this.events.off('action:clean', this.handleCleanAction, this);
    });

    this.refreshStatus();
  }

  update(_time: number, delta: number): void {
    this.accumulatedMs += delta;

    while (this.accumulatedMs >= 250) {
      this.simulation.tick(0.25);
      this.accumulatedMs -= 250;

      const triggered = this.eventSystem.poll(this.simulation.getState());
      if (triggered) {
        this.events.emit('dialog:show', triggered.dialogId);
      }
    }

    this.refreshStatus();
  }

  private createHamsterSprite(): void {
    this.anims.create({
      key: 'hamster-idle',
      frames: [{ key: 'hamster-idle-1' }, { key: 'hamster-idle-2' }],
      frameRate: 2,
      repeat: -1,
    });

    this.hamster = this.add.sprite(320, 295, 'hamster-idle-1');
    this.hamster.setScale(1.4);
    this.hamster.play('hamster-idle');
  }

  private refreshStatus(): void {
    if (!this.statusText) return;
    const visible = this.simulation.getVisibleStats();
    this.statusText.setText([
      `Hunger: ${visible.hunger.toFixed(1)}`,
      `Mood: ${visible.mood.toFixed(1)}`,
      `Health: ${visible.health.toFixed(1)}`,
      `Cleanliness: ${visible.cleanliness.toFixed(1)}`,
      'Tap buttons (or left/right click): feed / clean',
    ]);
  }

  private handleFeedAction(): void {
    this.sound.play('hamster-squeak', { volume: 0.45 });
    this.simulation.applyPlayerAction('feed_standard');
  }

  private handleCleanAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('clean_cage');
  }
}
