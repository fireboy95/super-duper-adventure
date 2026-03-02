import Phaser from 'phaser';
import { defaultPromptScript } from '../game/prompt/defaultPromptScript';
import { PromptEngine } from '../game/prompt/PromptEngine';
import { type PromptChoice, type PromptKeyword } from '../game/prompt/types';
import { AudioSystem } from '../game/systems/AudioSystem';
import { HamsterActor } from '../game/ui/HamsterActor';
import { PromptDialogueOverlay } from '../game/ui/PromptDialogueOverlay';
import { UI_INPUT_BLOCKED_EVENT } from './UiScene';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private promptEngine?: PromptEngine;
  private promptOverlay?: PromptDialogueOverlay;
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

    this.hamster = new HamsterActor(this, this.scale.width * 0.5, this.scale.height * 0.45, 'hamster', 1.2);
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

  private shutdown(): void {
    this.game.events.off(UI_INPUT_BLOCKED_EVENT, this.handleUiInputBlockedChange, this);
    this.isUiInputBlocked = false;
    this.hamsterBehaviorTimer?.remove();
    this.hamsterBehaviorTimer = undefined;
    this.hamster?.destroy();
    this.hamster = undefined;
    this.promptOverlay?.destroy();
    this.promptOverlay = undefined;
  }
}
