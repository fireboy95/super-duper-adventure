import Phaser from 'phaser';
import { defaultPromptScript } from '../game/prompt/defaultPromptScript';
import { PromptEngine } from '../game/prompt/PromptEngine';
import { type PromptChoice, type PromptKeyword } from '../game/prompt/types';
import { AudioSystem } from '../game/systems/AudioSystem';
import { PromptDialogueOverlay } from '../game/ui/PromptDialogueOverlay';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private promptEngine?: PromptEngine;
  private promptOverlay?: PromptDialogueOverlay;

  constructor() {
    super('main-scene');
  }

  create(): void {
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

    this.refreshPromptView();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private handleAdvance(): void {
    this.audioSystem?.unlock();
    const snapshot = this.promptEngine?.getSnapshot(this.time.now);
    if (!snapshot || snapshot.visibleChoices.length > 0) {
      return;
    }

    this.promptEngine?.advance(this.time.now);
    this.refreshPromptView();
  }

  private handleChoiceSelection(choice: PromptChoice): void {
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

  private shutdown(): void {
    this.promptOverlay?.destroy();
    this.promptOverlay = undefined;
  }
}
