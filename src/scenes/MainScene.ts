import Phaser from 'phaser';
import { defaultPromptScript } from '../game/prompt/defaultPromptScript';
import { PromptEngine } from '../game/prompt/PromptEngine';
import { type PromptChoice, type PromptKeyword } from '../game/prompt/types';
import { DEFAULT_DIMENSION_ID, getDimensionById, type DimensionId } from '../game/dimensions';
import { AudioSystem } from '../game/systems/AudioSystem';
import { HamsterBehaviorDirector } from '../game/systems/HamsterBehaviorDirector';
import { CageView } from '../game/ui/CageView';
import { HamsterActor } from '../game/ui/HamsterActor';
import { PromptDialogueOverlay } from '../game/ui/PromptDialogueOverlay';
import { getChoiceMoodModifier, getKeywordMoodModifier } from '../game/ui/hamsterMoodMap';
import { DIMENSION_CHANGED_EVENT, UI_INPUT_BLOCKED_EVENT } from './UiScene';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private promptEngine?: PromptEngine;
  private promptOverlay?: PromptDialogueOverlay;
  private cageView?: CageView;
  private hamster?: HamsterActor;
  private hamsterBehaviorDirector?: HamsterBehaviorDirector;
  private hamsterBehaviorTimer?: Phaser.Time.TimerEvent;
  private dimensionLabel?: Phaser.GameObjects.Text;
  private isUiInputBlocked = false;

  private readonly propLayoutRatios = {
    wheel: { x: 0.72, y: 0.62 },
    foodBowl: { x: 0.28, y: 0.71 },
    waterBottle: { x: 0.9, y: 0.43 },
    tunnel: { x: 0.5, y: 0.71 },
    hideout: { x: 0.14, y: 0.62 },
  } as const;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.game.events.on(UI_INPUT_BLOCKED_EVENT, this.handleUiInputBlockedChange, this);

    this.dimensionLabel = this.add
      .text(16, 16, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#bfe3ff',
      })
      .setOrigin(0, 0)
      .setDepth(24)
      .setScrollFactor(0);

    this.audioSystem = new AudioSystem(this);
    this.promptEngine = new PromptEngine(defaultPromptScript);
    this.promptEngine.begin(this.time.now);

    this.promptOverlay = new PromptDialogueOverlay(this, {
      onAdvance: () => this.handleAdvance(),
      onChoice: (choice) => this.handleChoiceSelection(choice),
      onKeyword: (keyword) => this.handleKeywordSelection(keyword),
    });

    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this.promptOverlay?.pulseContinueHint(),
    });

    this.cageView = new CageView(this);
    this.cageView.addProp({
      id: 'wheel',
      kind: 'wheel',
      x: this.scale.width * this.propLayoutRatios.wheel.x,
      y: this.scale.height * this.propLayoutRatios.wheel.y,
      width: 150,
      color: 0x8ba2c8,
    });
    this.cageView.addProp({
      id: 'food-bowl',
      kind: 'food-bowl',
      x: this.scale.width * this.propLayoutRatios.foodBowl.x,
      y: this.scale.height * this.propLayoutRatios.foodBowl.y,
      width: 90,
      height: 56,
      color: 0xd5884f,
      depth: 'front',
    });
    this.cageView.addProp({
      id: 'water-bottle',
      kind: 'water-bottle',
      x: this.scale.width * this.propLayoutRatios.waterBottle.x,
      y: this.scale.height * this.propLayoutRatios.waterBottle.y,
      width: 42,
      height: 150,
      color: 0x7ab7d9,
      depth: 'front',
    });
    this.cageView.addProp({
      id: 'tunnel',
      kind: 'tunnel',
      x: this.scale.width * this.propLayoutRatios.tunnel.x,
      y: this.scale.height * this.propLayoutRatios.tunnel.y,
      width: 180,
      height: 72,
      color: 0xa8704b,
    });
    this.cageView.addProp({
      id: 'hideout',
      kind: 'hideout',
      x: this.scale.width * this.propLayoutRatios.hideout.x,
      y: this.scale.height * this.propLayoutRatios.hideout.y,
      width: 140,
      height: 118,
      color: 0x8f6f50,
    });

    this.cageView.on('prop:activated', this.handlePropActivated);
    this.cageView.on('prop:cooldown', this.handlePropCooldown);

    const responsiveLayout = this.getResponsiveLayout(this.scale.width, this.scale.height);
    this.hamster = new HamsterActor(this, responsiveLayout.hamsterX, responsiveLayout.hamsterY, 'hamster', responsiveLayout.hamsterScale);
    this.cageView.attachHamster(this.hamster);
    this.hamsterBehaviorDirector = new HamsterBehaviorDirector(this.hamster, this.cageView, {
      seed: 424242,
    });
    this.layoutCage(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.hamsterBehaviorTimer = this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => this.hamsterBehaviorDirector?.tick(this.time.now),
    });

    this.refreshPromptView();
    const dimensionId = this.registry.get('activeDimension') as DimensionId | undefined;
    this.applyDimensionTheme(dimensionId ?? DEFAULT_DIMENSION_ID);

    this.game.events.on(DIMENSION_CHANGED_EVENT, this.applyDimensionTheme, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private applyDimensionTheme(dimensionId: DimensionId): void {
    const dimension = getDimensionById(dimensionId);
    this.cameras.main.setBackgroundColor(dimension.bgColor);
    this.dimensionLabel?.setText(`${dimension.icon} ${dimension.label} Dimension`);
    this.dimensionLabel?.setColor(dimension.accentColor);
  }

  private handleAdvance(): void {
    if (this.isUiInputBlocked) {
      return;
    }

    this.audioSystem?.unlock();
    const snapshot = this.promptEngine?.getSnapshot(this.time.now);
    if (!snapshot || snapshot.visibleChoices.length > 0) {
      return;
    }

    this.promptEngine?.advance(this.time.now);
    this.refreshPromptView();
  }

  private handleChoiceSelection(choice: PromptChoice): void {
    if (this.isUiInputBlocked) {
      return;
    }

    this.audioSystem?.unlock();
    if (!this.promptEngine) {
      return;
    }

    if (choice.holdToConfirmMs && choice.holdToConfirmMs > 0) {
      this.promptOverlay?.showTransientStatus(`Hold-to-confirm simulated (${choice.holdToConfirmMs}ms): ${choice.text}`);
    }

    this.promptEngine.selectChoice(choice.id, this.time.now);
    const moodModifier = getChoiceMoodModifier(choice.id);
    if (moodModifier) {
      this.hamsterBehaviorDirector?.setMood(moodModifier.mood, moodModifier.durationMs, this.time.now);
    }
    this.refreshPromptView();
  }

  private handleKeywordSelection(keyword: PromptKeyword): void {
    if (this.isUiInputBlocked) {
      return;
    }

    this.audioSystem?.unlock();
    this.promptEngine?.inspectKeyword(keyword.id);
    const moodModifier = getKeywordMoodModifier(keyword.id);
    if (moodModifier) {
      this.hamsterBehaviorDirector?.setMood(moodModifier.mood, moodModifier.durationMs, this.time.now);
    }
    this.refreshPromptView();
  }


  private readonly handlePropActivated = (payload: { id: string }): void => {
    switch (payload.id) {
      case 'wheel':
        this.hamsterBehaviorDirector?.triggerBehavior('run-wheel', this.time.now);
        break;
      case 'food-bowl':
        this.hamsterBehaviorDirector?.triggerBehavior('eat', this.time.now);
        break;
      case 'water-bottle':
        this.hamsterBehaviorDirector?.triggerBehavior('drink', this.time.now);
        break;
      case 'tunnel':
        this.hamsterBehaviorDirector?.triggerBehavior('hide-in-tunnel', this.time.now);
        break;
      default:
        break;
    }
  };

  private readonly handlePropCooldown = (payload: { id: string }): void => {
    this.promptOverlay?.showTransientStatus(`${payload.id} is cooling down.`);
    this.hamsterBehaviorDirector?.setMood('angry', 2600, this.time.now);
  };

  private refreshPromptView(): void {
    if (!this.promptEngine || !this.promptOverlay) {
      return;
    }

    const snapshot = this.promptEngine.getSnapshot(this.time.now);
    const keywords = this.promptEngine.getCurrentPageKeywords();
    this.promptOverlay.render(snapshot, keywords);
  }

  private readonly handleUiInputBlockedChange = (isBlocked: boolean): void => {
    this.isUiInputBlocked = isBlocked;
  };

  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.layoutCage(gameSize.width, gameSize.height);
  };

  private layoutCage(width: number, height: number): void {
    this.cageView?.layout(width, height);

    const responsiveLayout = this.getResponsiveLayout(width, height);
    this.cageView?.setPropState('wheel', {
      x: width * this.propLayoutRatios.wheel.x,
      y: height * this.propLayoutRatios.wheel.y,
      scale: responsiveLayout.propScale,
    });
    this.cageView?.setPropState('food-bowl', {
      x: width * this.propLayoutRatios.foodBowl.x,
      y: height * this.propLayoutRatios.foodBowl.y,
      scale: responsiveLayout.propScale,
    });
    this.cageView?.setPropState('water-bottle', {
      x: width * this.propLayoutRatios.waterBottle.x,
      y: height * this.propLayoutRatios.waterBottle.y,
      scale: responsiveLayout.propScale,
    });
    this.cageView?.setPropState('tunnel', {
      x: width * this.propLayoutRatios.tunnel.x,
      y: height * this.propLayoutRatios.tunnel.y,
      scale: responsiveLayout.propScale,
    });
    this.cageView?.setPropState('hideout', {
      x: width * this.propLayoutRatios.hideout.x,
      y: height * this.propLayoutRatios.hideout.y,
      scale: responsiveLayout.propScale,
    });

    if (this.hamster) {
      this.hamster.setScale(responsiveLayout.hamsterScale);
      this.hamster.setPosition(responsiveLayout.hamsterX, responsiveLayout.hamsterY);
    }
  }

  private getResponsiveLayout(width: number, height: number): { hamsterX: number; hamsterY: number; hamsterScale: number; propScale: number } {
    if (width <= 640) {
      return { hamsterX: width * 0.5, hamsterY: height * 0.52, hamsterScale: 0.86, propScale: 0.78 };
    }

    if (width <= 900) {
      return { hamsterX: width * 0.5, hamsterY: height * 0.48, hamsterScale: 1, propScale: 0.9 };
    }

    return { hamsterX: width * 0.5, hamsterY: height * 0.45, hamsterScale: 1.2, propScale: 1 };
  }

  private shutdown(): void {
    this.game.events.off(UI_INPUT_BLOCKED_EVENT, this.handleUiInputBlockedChange, this);
    this.game.events.off(DIMENSION_CHANGED_EVENT, this.applyDimensionTheme, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.isUiInputBlocked = false;
    this.hamsterBehaviorTimer?.remove();
    this.hamsterBehaviorTimer = undefined;
    this.hamsterBehaviorDirector?.dispose();
    this.hamsterBehaviorDirector = undefined;
    this.hamster?.destroy();
    this.hamster = undefined;
    if (this.cageView) {
      this.cageView.off('prop:activated', this.handlePropActivated);
      this.cageView.off('prop:cooldown', this.handlePropCooldown);
      this.cageView.destroy();
    }
    this.cageView = undefined;
    this.promptOverlay?.destroy();
    this.promptOverlay = undefined;
  }
}
