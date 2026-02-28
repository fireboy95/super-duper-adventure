import Phaser from 'phaser';
import { EventSystem } from '../systems/EventSystem';
import { SimulationManager } from '../systems/SimulationManager';

export class CageScene extends Phaser.Scene {
  private simulation = new SimulationManager();
  private eventSystem = new EventSystem();
  private accumulatedMs = 0;
  private statusText?: Phaser.GameObjects.Text;
  private hamster?: Phaser.GameObjects.Sprite;
  private timeOfDayOverlay?: Phaser.GameObjects.Rectangle;
  private ambientGlow?: Phaser.GameObjects.Ellipse;

  constructor() {
    super('CageScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2a2f2a');

    this.add.image(320, 240, 'cage-bg');
    this.createAmbientEffects();
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

    this.updateAmbientLighting();

    this.refreshStatus();
  }

  private createAmbientEffects(): void {
    this.ambientGlow = this.add.ellipse(320, 215, 520, 180, 0xd5cb8d, 0.1);
    this.timeOfDayOverlay = this.add.rectangle(320, 240, 640, 480, 0x050927, 0.08);
  }

  private updateAmbientLighting(): void {
    const cycleMs = 30000;
    const t = (this.time.now % cycleMs) / cycleMs;
    const daylight = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    const overlayAlpha = Phaser.Math.Linear(0.05, 0.26, 1 - daylight);
    const glowAlpha = Phaser.Math.Linear(0.05, 0.18, daylight);

    this.timeOfDayOverlay?.setAlpha(overlayAlpha);
    this.ambientGlow?.setAlpha(glowAlpha);
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

    this.tweens.add({
      targets: this.hamster,
      y: 289,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: this.hamster,
      angle: { from: -1.5, to: 1.5 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
    this.animateReaction(0x7df18f);
  }

  private handleCleanAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('clean_cage');
    this.animateReaction(0x7ad9ff);
  }

  private animateReaction(color: number): void {
    if (!this.hamster) return;

    this.tweens.add({
      targets: this.hamster,
      scaleX: 1.55,
      scaleY: 1.3,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    const pulse = this.add.circle(this.hamster.x, this.hamster.y - 28, 8, color, 0.85);
    this.tweens.add({
      targets: pulse,
      y: pulse.y - 36,
      alpha: 0,
      scale: 2,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => pulse.destroy(),
    });
  }
}
