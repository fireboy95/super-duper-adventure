import Phaser from 'phaser';
import { EventSystem } from '../systems/EventSystem';
import type { DialogOptionEffects } from '../systems/DialogueSystem';
import { SimulationManager } from '../systems/SimulationManager';
import { SaveSystem } from '../systems/SaveSystem';

const AUTOSAVE_INTERVAL_MS = 10_000;

export class CageScene extends Phaser.Scene {
  private simulation = new SimulationManager();
  private eventSystem = new EventSystem();
  private saveSystem = new SaveSystem();
  private accumulatedMs = 0;
  private autosaveElapsedMs = 0;
  private hasTransitionedToEnding = false;
  private statusText?: Phaser.GameObjects.Text;
  private hamster?: Phaser.GameObjects.Sprite;
  private cageBackground?: Phaser.GameObjects.Image;
  private cageLabel?: Phaser.GameObjects.Text;
  private timeOfDayOverlay?: Phaser.GameObjects.Rectangle;
  private ambientGlow?: Phaser.GameObjects.Ellipse;

  constructor() {
    super('CageScene');
  }

  create(data?: { forceNewGame?: boolean }): void {
    const shouldLoadSave = !data?.forceNewGame;
    const loadedState = shouldLoadSave ? this.saveSystem.load() : null;
    this.simulation = new SimulationManager(loadedState ?? undefined);
    this.autosaveElapsedMs = 0;
    this.hasTransitionedToEnding = false;

    this.cameras.main.setBackgroundColor('#2a2f2a');

    this.cageBackground = this.add.image(320, 240, 'cage-bg');
    this.createAmbientEffects();
    this.cageLabel = this.add.text(80, 80, 'CAGE VIEW', { fontFamily: 'monospace', fontSize: '16px', color: '#111111' });

    this.createHamsterSprite();

    this.statusText = this.add.text(80, 360, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.simulation.applyPlayerAction('feed_standard');
      if (pointer.rightButtonDown()) this.simulation.applyPlayerAction('clean_cage');
    });

    this.events.on('action:feed', this.handleFeedAction, this);
    this.events.on('action:feed-sweet', this.handleFeedSweetAction, this);
    this.events.on('action:refill-water', this.handleRefillWaterAction, this);
    this.events.on('action:handle', this.handleHandleAction, this);
    this.events.on('action:clean', this.handleCleanAction, this);
    this.events.on('dialog:apply-effects', this.handleDialogEffects, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.layoutScene(this.scale.width, this.scale.height);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveCurrentState();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.events.off('action:feed', this.handleFeedAction, this);
      this.events.off('action:feed-sweet', this.handleFeedSweetAction, this);
      this.events.off('action:refill-water', this.handleRefillWaterAction, this);
      this.events.off('action:handle', this.handleHandleAction, this);
      this.events.off('action:clean', this.handleCleanAction, this);
      this.events.off('dialog:apply-effects', this.handleDialogEffects, this);
    });

    this.refreshStatus();
  }

  update(_time: number, delta: number): void {
    this.accumulatedMs += delta;
    this.autosaveElapsedMs += delta;

    if (this.autosaveElapsedMs >= AUTOSAVE_INTERVAL_MS) {
      this.saveCurrentState();
      this.autosaveElapsedMs = 0;
    }

    while (this.accumulatedMs >= 250) {
      this.simulation.tick(0.25);
      this.accumulatedMs -= 250;

      const triggered = this.eventSystem.poll(this.simulation.getState());
      if (triggered) {
        this.simulation.registerTriggeredEvent(triggered.id, this.eventSystem.getCooldownDays(triggered.id));
        this.events.emit('dialog:show', { dialogId: triggered.dialogId, eventId: triggered.id });
      }
    }

    this.updateAmbientLighting();

    const endingId = this.simulation.getState().progression.endingId;
    if (!this.hasTransitionedToEnding && endingId) {
      this.hasTransitionedToEnding = true;
      this.saveCurrentState();
      this.scene.stop('UIScene');
      this.scene.start('EndingScene', { endingId });
      return;
    }

    this.refreshStatus();
  }

  private createAmbientEffects(): void {
    this.ambientGlow = this.add.ellipse(320, 215, 520, 180, 0xd5cb8d, 0.1);
    this.timeOfDayOverlay = this.add.rectangle(320, 240, 640, 480, 0x050927, 0.08);
  }

  private updateAmbientLighting(): void {
    const timeOfDayMinutes = this.simulation.getState().timeOfDayMinutes;

    const dawnStart = 6 * 60;
    const dayStart = 8 * 60;
    const duskStart = 18 * 60;
    const nightStart = 20 * 60;

    let overlayAlpha = 0.22;
    let glowAlpha = 0.06;

    if (timeOfDayMinutes >= dawnStart && timeOfDayMinutes < dayStart) {
      const dawnProgress = (timeOfDayMinutes - dawnStart) / (dayStart - dawnStart);
      overlayAlpha = Phaser.Math.Linear(0.22, 0.08, dawnProgress);
      glowAlpha = Phaser.Math.Linear(0.07, 0.17, dawnProgress);
    } else if (timeOfDayMinutes >= dayStart && timeOfDayMinutes < duskStart) {
      overlayAlpha = 0.08;
      glowAlpha = 0.17;
    } else if (timeOfDayMinutes >= duskStart && timeOfDayMinutes < nightStart) {
      const duskProgress = (timeOfDayMinutes - duskStart) / (nightStart - duskStart);
      overlayAlpha = Phaser.Math.Linear(0.08, 0.22, duskProgress);
      glowAlpha = Phaser.Math.Linear(0.17, 0.07, duskProgress);
    }

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
    const simulationState = this.simulation.getState();
    const clockHours = Math.floor(simulationState.timeOfDayMinutes / 60);
    const clockMinutes = Math.floor(simulationState.timeOfDayMinutes % 60);

    this.statusText.setText([
      `Day ${simulationState.day} - ${clockHours.toString().padStart(2, '0')}:${clockMinutes.toString().padStart(2, '0')}`,
      `Hunger: ${visible.hunger.toFixed(1)}`,
      `Thirst: ${visible.thirst.toFixed(1)}`,
      `Energy: ${visible.energy.toFixed(1)}`,
      `Mood: ${visible.mood.toFixed(1)}`,
      `Health: ${visible.health.toFixed(1)}`,
      `Cage Cleanliness: ${visible.cleanliness.toFixed(1)}${visible.cleanliness < 20 ? ' (critical)' : visible.cleanliness < 30 ? ' (filthy)' : visible.cleanliness < 50 ? ' (dirty)' : ''}`,
      `Body Cleanliness: ${visible.cleanlinessBody.toFixed(1)}${visible.cleanlinessBody < 20 ? ' (very dirty)' : visible.cleanlinessBody < 40 ? ' (grimy)' : ''}`,
      `Stress: ${visible.stress.toFixed(1)} | Trust: ${visible.trust.toFixed(1)} | Grudge: ${visible.grudge.toFixed(1)}`,
      'Tap buttons (or left/right click): feed / clean',
    ]);

    this.events.emit('hud:update', {
      hunger: visible.hunger,
      thirst: visible.thirst,
      energy: visible.energy,
      health: visible.health,
      cleanliness: visible.cleanliness,
      mood: visible.mood,
      foodStandard: simulationState.inventory.food_standard ?? 0,
      foodSweet: simulationState.inventory.food_sweet ?? 0,
    });
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

  private handleFeedSweetAction(): void {
    if ((this.simulation.getState().inventory.food_sweet ?? 0) <= 0) return;
    this.sound.play('hamster-squeak', { volume: 0.45 });
    this.simulation.applyPlayerAction('feed_sweet');
    this.animateReaction(0xc184ff);
  }

  private handleRefillWaterAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('refill_water');
    this.animateReaction(0x86d9ff);
  }

  private handleHandleAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('handle_hamster');
    this.animateReaction(0xffd087);
  }



  private handleDialogEffects(effects: DialogOptionEffects | undefined): void {
    this.simulation.applyDialogEffects(effects);
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

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutScene(gameSize.width, gameSize.height);
  }

  private layoutScene(width: number, height: number): void {
    const isNarrow = width < 720;

    this.cageBackground?.setPosition(width / 2, height / 2);
    if (this.cageBackground) {
      this.cageBackground.setDisplaySize(width, height);
    }

    this.timeOfDayOverlay?.setPosition(width / 2, height / 2).setSize(width, height);
    this.ambientGlow?.setPosition(width / 2, height / 2 - 25).setSize(Math.max(320, width * 0.82), Math.max(140, height * 0.36));
    this.hamster?.setPosition(width / 2, Math.min(height - (isNarrow ? 170 : 185), height * 0.62));

    this.cageLabel?.setPosition(20, 20).setFontSize(isNarrow ? '14px' : '16px');

    if (this.statusText) {
      this.statusText.setPosition(20, Math.max(70, height - (isNarrow ? 250 : 140)));
      this.statusText.setFontSize(isNarrow ? '12px' : '14px');
      this.statusText.setWordWrapWidth(Math.max(230, width - 40));
      this.statusText.setAlpha(isNarrow ? 0.92 : 1);
    }
  }

  private saveCurrentState(): void {
    this.saveSystem.save(this.simulation.getState());
  }
}
