import Phaser from 'phaser';
import { EventSystem } from '../systems/EventSystem';
import { SimulationManager } from '../systems/SimulationManager';

export class CageScene extends Phaser.Scene {
  private simulation = new SimulationManager();
  private eventSystem = new EventSystem();
  private accumulatedMs = 0;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super('CageScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2a2f2a');

    this.add.rectangle(320, 240, 560, 320, 0x665544).setStrokeStyle(2, 0x222222);
    this.add.text(80, 80, 'CAGE VIEW', { fontFamily: 'monospace', fontSize: '16px', color: '#111111' });

    this.statusText = this.add.text(80, 360, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.simulation.applyPlayerAction('feed_standard');
      if (pointer.rightButtonDown()) this.simulation.applyPlayerAction('clean_cage');
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

  private refreshStatus(): void {
    if (!this.statusText) return;
    const visible = this.simulation.getVisibleStats();
    this.statusText.setText([
      `Hunger: ${visible.hunger.toFixed(1)}`,
      `Mood: ${visible.mood.toFixed(1)}`,
      `Health: ${visible.health.toFixed(1)}`,
      `Cleanliness: ${visible.cleanliness.toFixed(1)}`,
      'Left click: feed, Right click: clean',
    ]);
  }
}
