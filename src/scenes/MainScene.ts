import Phaser from 'phaser';
import { defaultPromptScript } from '../game/prompt/defaultPromptScript';
import { PromptEngine } from '../game/prompt/PromptEngine';
import { type PromptChoice, type PromptKeyword } from '../game/prompt/types';
import { AudioSystem } from '../game/systems/AudioSystem';
import { CageView } from '../game/ui/CageView';
import { HamsterActor } from '../game/ui/HamsterActor';
import { PromptDialogueOverlay } from '../game/ui/PromptDialogueOverlay';
import { UI_INPUT_BLOCKED_EVENT } from './UiScene';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private promptEngine?: PromptEngine;
  private promptOverlay?: PromptDialogueOverlay;
  private cageView?: CageView;
  private hamster?: HamsterActor;
  private hamsterBehaviorTimer?: Phaser.Time.TimerEvent;
  private isUiInputBlocked = false;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.game.events.on(UI_INPUT_BLOCKED_EVENT, this.handleUiInputBlockedChange, this);
    this.cameras.main.setBackgroundColor('#111625');

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
      x: this.scale.width * 0.72,
      y: this.scale.height * 0.62,
      width: 150,
      color: 0x8ba2c8,
    });
    this.cageView.addProp({
      id: 'food-bowl',
      kind: 'food-bowl',
      x: this.scale.width * 0.28,
      y: this.scale.height * 0.71,
      width: 90,
      height: 56,
      color: 0xd5884f,
      depth: 'front',
    });
    this.cageView.addProp({
      id: 'water-bottle',
      kind: 'water-bottle',
      x: this.scale.width * 0.9,
      y: this.scale.height * 0.43,
      width: 42,
      height: 150,
      color: 0x7ab7d9,
      depth: 'front',
    });
    this.cageView.addProp({
      id: 'tunnel',
      kind: 'tunnel',
      x: this.scale.width * 0.5,
      y: this.scale.height * 0.71,
      width: 180,
      height: 72,
      color: 0xa8704b,
    });
    this.cageView.addProp({
      id: 'hideout',
      kind: 'hideout',
      x: this.scale.width * 0.14,
      y: this.scale.height * 0.62,
      width: 140,
      height: 118,
      color: 0x8f6f50,
    });


    this.cageView.on('prop:activated', this.handlePropActivated);
    this.cageView.on('prop:cooldown', this.handlePropCooldown);

    this.hamster = new HamsterActor(this, this.scale.width * 0.5, this.scale.height * 0.45, 'hamster', 1.2);
    this.cageView.attachHamster(this.hamster);
    this.layoutCage(this.scale.width, this.scale.height);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.hamsterBehaviorTimer = this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => this.updateHamsterBehavior(),
    });

    this.refreshPromptView();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private updateHamsterBehavior(): void {
    if (!this.hamster) {
      return;
    }

    const roll = Math.random();
    if (roll < 0.2) {
      this.hamster.setState('sleep');
      return;
    }

    if (roll < 0.45) {
      this.hamster.setState('eat');
      return;
    }

    if (roll < 0.6) {
      this.hamster.setState('wheel');
      return;
    }

    const targetX = Phaser.Math.Clamp(this.hamster.x + Phaser.Math.Between(-150, 150), 64, this.scale.width - 64);
    this.hamster.moveTo(targetX, Phaser.Math.Between(700, 1500));
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
    this.refreshPromptView();
  }

  private handleKeywordSelection(keyword: PromptKeyword): void {
    if (this.isUiInputBlocked) {
      return;
    }

    this.audioSystem?.unlock();
    this.promptEngine?.inspectKeyword(keyword.id);
    this.refreshPromptView();
  }


  private readonly handlePropActivated = (payload: { id: string }): void => {
    if (!this.hamster) {
      return;
    }

    switch (payload.id) {
      case 'wheel':
        this.hamster.setState('wheel');
        break;
      case 'food-bowl':
        this.hamster.setState('eat');
        break;
      case 'water-bottle': {
        this.hamster.setState('idle');
        const targetX = Phaser.Math.Clamp(this.scale.width * 0.84, 64, this.scale.width - 64);
        this.hamster.moveTo(targetX, 600);
        break;
      }
      case 'tunnel':
        this.hamster.setState('run');
        break;
      default:
        break;
    }
  };

  private readonly handlePropCooldown = (payload: { id: string }): void => {
    this.promptOverlay?.showTransientStatus(`${payload.id} is cooling down.`);
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
  }

  private shutdown(): void {
    this.game.events.off(UI_INPUT_BLOCKED_EVENT, this.handleUiInputBlockedChange, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.isUiInputBlocked = false;
    this.hamsterBehaviorTimer?.remove();
    this.hamsterBehaviorTimer = undefined;
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
