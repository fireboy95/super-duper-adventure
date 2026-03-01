import Phaser from 'phaser';
import { EventSystem } from '../systems/EventSystem';
import type { DialogOptionEffects } from '../systems/DialogueSystem';
import { SimulationManager } from '../systems/SimulationManager';
import { SaveSystem } from '../systems/SaveSystem';
import { SafeAreaInsets, UI_SAFE_AREA_EVENT } from './layoutContract';

const AUTOSAVE_INTERVAL_MS = 10_000;
const EVENT_HEARTBEAT_INTERVAL_MS = 3_000;
const EVENT_HEARTBEAT_JITTER = 0.2;
const EVENT_FAST_LANE_PRIORITY = 90;

type HamsterAnimationKey = 'hamster-idle' | 'hamster-happy' | 'hamster-stress' | 'hamster-sleep' | 'hamster-eat';

export class CageScene extends Phaser.Scene {
  private simulation = new SimulationManager();
  private eventSystem = new EventSystem();
  private saveSystem = new SaveSystem();
  private accumulatedMs = 0;
  private autosaveElapsedMs = 0;
  private lastEventAttemptMs = 0;
  private nextEventAttemptDelayMs = 0;
  private hasTransitionedToEnding = false;
  private statusText?: Phaser.GameObjects.Text;
  private hamster?: Phaser.GameObjects.Sprite;
  private cageBackground?: Phaser.GameObjects.Image;
  private cageLabel?: Phaser.GameObjects.Text;
  private timeOfDayOverlay?: Phaser.GameObjects.Rectangle;
  private ambientGlow?: Phaser.GameObjects.Ellipse;
  private moodAura?: Phaser.GameObjects.Ellipse;
  private stressOverlay?: Phaser.GameObjects.Rectangle;
  private grimeOverlay?: Phaser.GameObjects.Rectangle;
  private activeHamsterAnimation: HamsterAnimationKey = 'hamster-idle';
  private temporaryAnimationUntilMs = 0;
  private safeAreaInsets: SafeAreaInsets = { topInset: 0, bottomInset: 0 };
  private detachSafeAreaListener?: () => void;

  constructor() {
    super('CageScene');
  }

  create(data?: { forceNewGame?: boolean }): void {
    const shouldLoadSave = !data?.forceNewGame;
    const loadedState = shouldLoadSave ? this.saveSystem.load() : null;
    this.simulation = new SimulationManager(loadedState ?? undefined);
    this.autosaveElapsedMs = 0;
    this.hasTransitionedToEnding = false;
    this.lastEventAttemptMs = 0;
    this.nextEventAttemptDelayMs = this.rollEventAttemptDelayMs();

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
    this.events.on('action:refill_water', this.handleRefillWaterAction, this);
    this.events.on('action:handle', this.handleHandleAction, this);
    this.events.on('action:clean', this.handleCleanAction, this);
    this.events.on('dialog:apply-effects', this.handleDialogEffects, this);

    this.bindSafeAreaLayoutContract();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.layoutScene(this.scale.width, this.scale.height);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveCurrentState();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.events.off('action:feed', this.handleFeedAction, this);
      this.events.off('action:feed-sweet', this.handleFeedSweetAction, this);
      this.events.off('action:refill-water', this.handleRefillWaterAction, this);
      this.events.off('action:refill_water', this.handleRefillWaterAction, this);
      this.events.off('action:handle', this.handleHandleAction, this);
      this.events.off('action:clean', this.handleCleanAction, this);
      this.events.off('dialog:apply-effects', this.handleDialogEffects, this);
      this.detachSafeAreaListener?.();
    });

    this.refreshStatus();
  }

  update(_time: number, delta: number): void {
    this.accumulatedMs += delta;
    this.autosaveElapsedMs += delta;
    this.lastEventAttemptMs += delta;

    if (this.autosaveElapsedMs >= AUTOSAVE_INTERVAL_MS) {
      this.saveCurrentState();
      this.autosaveElapsedMs = 0;
    }

    while (this.accumulatedMs >= 250) {
      this.simulation.tick(0.25);
      this.accumulatedMs -= 250;

      const state = this.simulation.getState();
      const heartbeatElapsed = this.lastEventAttemptMs >= this.nextEventAttemptDelayMs;
      const triggered = heartbeatElapsed
        ? this.eventSystem.poll(state)
        : this.eventSystem.poll(state, { minPriority: EVENT_FAST_LANE_PRIORITY });

      if (heartbeatElapsed) {
        this.lastEventAttemptMs = 0;
        this.nextEventAttemptDelayMs = this.rollEventAttemptDelayMs();
      }

      if (triggered) {
        this.simulation.registerTriggeredEvent(triggered.id, this.eventSystem.getCooldownDays(triggered.id));
        this.events.emit('dialog:show', {
          dialogId: triggered.dialogId,
          eventId: triggered.id,
          priority: triggered.priority,
          queueTimeoutMs: triggered.queueTimeoutMs,
          supersedeBelowPriority: triggered.supersedeBelowPriority,
          source: 'event',
        });
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


  private rollEventAttemptDelayMs(): number {
    return EVENT_HEARTBEAT_INTERVAL_MS * Phaser.Math.FloatBetween(1 - EVENT_HEARTBEAT_JITTER, 1 + EVENT_HEARTBEAT_JITTER);
  }

  private createAmbientEffects(): void {
    this.ambientGlow = this.add.ellipse(320, 215, 520, 180, 0xd5cb8d, 0.1);
    this.moodAura = this.add.ellipse(320, 305, 210, 92, 0x9df8b4, 0.08);
    this.grimeOverlay = this.add.rectangle(320, 240, 640, 480, 0x5e4932, 0);
    this.timeOfDayOverlay = this.add.rectangle(320, 240, 640, 480, 0x050927, 0.08);
    this.stressOverlay = this.add.rectangle(320, 240, 640, 480, 0x4f1020, 0);
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

    const state = this.simulation.getState();
    const mood = state.hamster.stats.mood;
    const stress = state.hamster.stats.stress;
    const cleanliness = state.cage.cleanliness;
    const health = state.hamster.stats.health;

    const moodAlpha = Phaser.Math.Clamp((mood - 40) / 60, 0, 1) * 0.22;
    const stressAlpha = Phaser.Math.Clamp((stress - 35) / 65, 0, 1) * 0.3;
    const grimeAlpha = Phaser.Math.Clamp((60 - cleanliness) / 60, 0, 1) * 0.32;

    const auraColor = mood >= 70 ? 0xa8ffbb : mood >= 55 ? 0x9de5ff : 0xffd59b;
    this.moodAura?.setFillStyle(auraColor, moodAlpha);
    this.stressOverlay?.setAlpha(stressAlpha);
    this.grimeOverlay?.setAlpha(grimeAlpha);

    if (this.hamster) {
      this.updateHamsterAnimation(state);

      if (health < 40) {
        this.hamster.setTint(0xd6b2b2);
      } else if (stress > 70) {
        this.hamster.setTint(0xffd7d7);
      } else {
        this.hamster.clearTint();
      }
    }
  }

  private createHamsterSprite(): void {
    this.createHamsterAnimation('hamster-idle', ['hamster-idle-1', 'hamster-idle-2'], 2);
    this.createHamsterAnimation('hamster-happy', ['hamster-happy-1', 'hamster-happy-2'], 4);
    this.createHamsterAnimation('hamster-stress', ['hamster-stress-1', 'hamster-stress-2'], 8);
    this.createHamsterAnimation('hamster-sleep', ['hamster-sleep-1', 'hamster-sleep-2'], 1.5);
    this.createHamsterAnimation('hamster-eat', ['hamster-eat-1', 'hamster-eat-2'], 7);

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


  private createHamsterAnimation(key: HamsterAnimationKey, frameKeys: [string, string], frameRate: number): void {
    this.anims.create({
      key,
      frames: frameKeys.map((frameKey) => ({ key: frameKey })),
      frameRate,
      repeat: -1,
    });
  }

  private updateHamsterAnimation(state: ReturnType<SimulationManager['getState']>): void {
    if (!this.hamster) return;

    const now = this.time.now;
    const desiredAnimation = now < this.temporaryAnimationUntilMs ? this.activeHamsterAnimation : this.getAmbientHamsterAnimation(state);

    if (this.activeHamsterAnimation !== desiredAnimation || this.hamster.anims.currentAnim?.key !== desiredAnimation) {
      this.activeHamsterAnimation = desiredAnimation;
      this.hamster.play(desiredAnimation, true);
    }

    this.hamster.anims.timeScale = this.getAnimationTimeScale(desiredAnimation, state);
  }

  private getAmbientHamsterAnimation(state: ReturnType<SimulationManager['getState']>): HamsterAnimationKey {
    const { mood, stress, energy, health } = state.hamster.stats;

    if (health <= 20) return 'hamster-sleep';
    if (stress >= 68) return 'hamster-stress';
    if (energy <= 25 && stress <= 55) return 'hamster-sleep';
    if (mood >= 72 && energy >= 35) return 'hamster-happy';
    return 'hamster-idle';
  }

  private getAnimationTimeScale(animationKey: HamsterAnimationKey, state: ReturnType<SimulationManager['getState']>): number {
    if (animationKey === 'hamster-stress') return state.hamster.stats.stress > 85 ? 1.35 : 1;
    if (animationKey === 'hamster-sleep') return state.hamster.stats.energy < 15 ? 0.75 : 1;
    if (animationKey === 'hamster-happy') return state.hamster.stats.mood > 85 ? 1.15 : 1;
    if (animationKey === 'hamster-eat') return 1;
    return state.hamster.stats.stress > 65 ? 1.8 : state.hamster.stats.energy < 35 ? 0.65 : 1;
  }

  private playTemporaryAnimation(animationKey: HamsterAnimationKey, durationMs: number): void {
    this.activeHamsterAnimation = animationKey;
    this.temporaryAnimationUntilMs = this.time.now + durationMs;
    this.hamster?.play(animationKey, true);
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
    this.playTemporaryAnimation('hamster-eat', 900);
    this.animateReaction(0x7df18f);
  }

  private handleCleanAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('clean_cage');
    this.playTemporaryAnimation('hamster-happy', 450);
    this.animateReaction(0x7ad9ff);
  }

  private handleFeedSweetAction(): void {
    if ((this.simulation.getState().inventory.food_sweet ?? 0) <= 0) return;
    this.sound.play('hamster-squeak', { volume: 0.45 });
    this.simulation.applyPlayerAction('feed_sweet');
    this.playTemporaryAnimation('hamster-eat', 1050);
    this.animateReaction(0xc184ff);
  }

  private handleRefillWaterAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('refill_water');
    this.playTemporaryAnimation('hamster-happy', 500);
    this.animateReaction(0x86d9ff);
  }

  private handleHandleAction(): void {
    this.sound.play('ui-click', { volume: 0.35 });
    this.simulation.applyPlayerAction('handle_hamster');
    const trust = this.simulation.getState().hamster.stats.trust;
    this.playTemporaryAnimation(trust >= 50 ? 'hamster-happy' : 'hamster-stress', 700);
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

  private bindSafeAreaLayoutContract(): void {
    const handleSafeArea = (safeAreaInsets: SafeAreaInsets): void => {
      this.safeAreaInsets = safeAreaInsets;
      this.layoutScene(this.scale.width, this.scale.height);
    };

    this.game.events.on(UI_SAFE_AREA_EVENT, handleSafeArea);
    this.detachSafeAreaListener = () => {
      this.game.events.off(UI_SAFE_AREA_EVENT, handleSafeArea);
    };
  }

  private layoutScene(width: number, height: number): void {
    const isNarrow = width < 720;
    const { topInset, bottomInset } = this.safeAreaInsets;
    const usableBottom = Math.max(topInset + 80, height - bottomInset);
    const usableHeight = Math.max(120, usableBottom - topInset);
    const centerY = topInset + usableHeight / 2;

    this.cageBackground?.setPosition(width / 2, height / 2);
    if (this.cageBackground) {
      this.cageBackground.setDisplaySize(width, height);
    }

    this.timeOfDayOverlay?.setPosition(width / 2, height / 2).setSize(width, height);
    this.grimeOverlay?.setPosition(width / 2, height / 2).setSize(width, height);
    this.stressOverlay?.setPosition(width / 2, height / 2).setSize(width, height);
    this.ambientGlow?.setPosition(width / 2, centerY - 25).setSize(Math.max(320, width * 0.82), Math.max(140, usableHeight * 0.36));
    this.moodAura?.setPosition(width / 2, Math.min(usableBottom - (isNarrow ? 176 : 186), topInset + usableHeight * 0.62) + 10).setSize(Math.max(170, width * 0.32), 96);
    this.hamster?.setPosition(width / 2, Math.min(usableBottom - (isNarrow ? 170 : 185), topInset + usableHeight * 0.62));

    this.cageLabel?.setPosition(20, 20).setFontSize(isNarrow ? '14px' : '16px');

    if (this.statusText) {
      this.statusText.setPosition(20, Math.max(topInset + 8, usableBottom - (isNarrow ? 250 : 140)));
      this.statusText.setFontSize(isNarrow ? '12px' : '14px');
      this.statusText.setWordWrapWidth(Math.max(230, width - 40));
      this.statusText.setAlpha(isNarrow ? 0.92 : 1);
    }
  }

  private saveCurrentState(): void {
    this.saveSystem.save(this.simulation.getState());
  }
}
