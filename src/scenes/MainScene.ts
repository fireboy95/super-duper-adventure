import Phaser from 'phaser';
import { defaultPromptScript } from '../game/prompt/defaultPromptScript';
import { PromptEngine } from '../game/prompt/PromptEngine';
import { type PromptChoice } from '../game/prompt/types';
import { AudioSystem } from '../game/systems/AudioSystem';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private promptEngine?: PromptEngine;

  private dialoguePanel?: Phaser.GameObjects.Rectangle;
  private dialogueText?: Phaser.GameObjects.Text;
  private speakerText?: Phaser.GameObjects.Text;
  private portraitText?: Phaser.GameObjects.Text;
  private expressionText?: Phaser.GameObjects.Text;
  private continueHint?: Phaser.GameObjects.Text;
  private dimOverlay?: Phaser.GameObjects.Rectangle;

  private keywordButtons: Phaser.GameObjects.Container[] = [];
  private choiceButtons: Phaser.GameObjects.Container[] = [];

  private logPanel?: Phaser.GameObjects.Rectangle;
  private logText?: Phaser.GameObjects.Text;
  private notebookPanel?: Phaser.GameObjects.Rectangle;
  private notebookText?: Phaser.GameObjects.Text;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111625');
    this.audioSystem = new AudioSystem(this);
    this.promptEngine = new PromptEngine(defaultPromptScript);
    this.promptEngine.begin(this.time.now);

    this.createScaffold();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.time.addEvent({ delay: 600, loop: true, callback: () => this.continueHint?.setVisible(!this.continueHint.visible) });

    this.refreshPromptView();
  }

  private createScaffold(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.24, 'Hamster Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#dbe7ff',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(this.scale.width / 2, this.scale.height * 0.31, 'Dialogue-focused prototype with data-driven prompts.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#9bb0d3',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setWordWrapWidth(Math.min(620, this.scale.width - 28));

    this.dimOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.34)
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(false);

    this.dialoguePanel = this.add
      .rectangle(12, this.scale.height * 0.62, this.scale.width - 24, this.scale.height * 0.35, 0x0c1322, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x62a5ff, 0.45)
      .setDepth(4);

    this.portraitText = this.add
      .text(30, this.scale.height * 0.64, '🐹', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
      })
      .setDepth(5);

    this.speakerText = this.add
      .text(82, this.scale.height * 0.65, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#d9e9ff',
      })
      .setDepth(5);

    this.expressionText = this.add
      .text(82, this.scale.height * 0.69, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#7dd3fc',
      })
      .setDepth(5);

    this.dialogueText = this.add
      .text(24, this.scale.height * 0.74, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#f5f9ff',
        wordWrap: { width: this.scale.width - 48 },
      })
      .setDepth(5);

    this.continueHint = this.add
      .text(this.scale.width - 28, this.scale.height - 28, 'Tap to continue ▸', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9dc4ff',
      })
      .setDepth(5)
      .setOrigin(1, 1);

    this.createUtilityButton(20, 20, 'Log', () => this.toggleLogPanel());
    this.createUtilityButton(88, 20, 'Notebook', () => this.toggleNotebookPanel());

    this.logPanel = this.add.rectangle(12, 56, this.scale.width - 24, 190, 0x0c1322, 0.94).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.logText = this.add
      .text(22, 66, '', { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbe7ff', wordWrap: { width: this.scale.width - 44 } })
      .setDepth(21)
      .setVisible(false);

    this.notebookPanel = this.add.rectangle(12, 252, this.scale.width - 24, 170, 0x101827, 0.94).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.notebookText = this.add
      .text(22, 262, '', { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbe7ff', wordWrap: { width: this.scale.width - 44 } })
      .setDepth(21)
      .setVisible(false);
  }

  private createUtilityButton(x: number, y: number, label: string, onTap: () => void): void {
    const background = this.add.rectangle(x, y, 60, 28, 0x1d2a43, 0.95).setOrigin(0, 0).setDepth(15).setInteractive({ useHandCursor: true });
    const text = this.add.text(x + 30, y + 14, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#dce9ff' }).setOrigin(0.5).setDepth(16);
    background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onTap();
    });
    text.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onTap();
    });
  }

  private toggleLogPanel(): void {
    const visible = !(this.logPanel?.visible ?? false);
    this.logPanel?.setVisible(visible);
    this.logText?.setVisible(visible);
  }

  private toggleNotebookPanel(): void {
    const visible = !(this.notebookPanel?.visible ?? false);
    this.notebookPanel?.setVisible(visible);
    this.notebookText?.setVisible(visible);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.audioSystem?.unlock();
    if (pointer.event.defaultPrevented) {
      return;
    }

    const snapshot = this.promptEngine?.getSnapshot(this.time.now);
    if (!snapshot || snapshot.visibleChoices.length > 0) {
      return;
    }

    this.promptEngine?.advance(this.time.now);
    this.refreshPromptView();
  }

  private refreshPromptView(): void {
    if (!this.promptEngine) {
      return;
    }

    const snapshot = this.promptEngine.getSnapshot(this.time.now);
    this.speakerText?.setText(snapshot.speaker);
    this.portraitText?.setText(snapshot.portrait);
    this.expressionText?.setText(`Tone: ${snapshot.expression}`);
    this.dialogueText?.setText(snapshot.pageText);
    this.continueHint?.setVisible(snapshot.visibleChoices.length === 0);
    this.logText?.setText(this.makePanelText('Recent dialogue', snapshot.dialogueLog));
    this.notebookText?.setText(this.makePanelText('Notebook', snapshot.notebookEntries));

    this.renderKeywordButtons();
    this.renderChoices(snapshot.visibleChoices);
  }

  private renderKeywordButtons(): void {
    this.keywordButtons.forEach((button) => button.destroy());
    this.keywordButtons = [];

    const keywords = this.promptEngine?.getCurrentPageKeywords() ?? [];
    const startX = 24;
    let y = this.scale.height * 0.87;

    keywords.forEach((keyword, index) => {
      const button = this.add.container(startX + index * 108, y).setDepth(12);
      const bg = this.add.rectangle(0, 0, 100, 24, 0x1f3b61, 0.9).setOrigin(0, 0);
      const label = this.add
        .text(50, 12, keyword.label, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cbe1ff' })
        .setOrigin(0.5);
      const zone = this.add.zone(0, 0, 100, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.promptEngine?.inspectKeyword(keyword.id);
        this.refreshPromptView();
      });

      button.add([bg, label, zone]);
      this.keywordButtons.push(button);
    });
  }

  private renderChoices(choices: PromptChoice[]): void {
    this.choiceButtons.forEach((button) => button.destroy());
    this.choiceButtons = [];

    this.dimOverlay?.setVisible(choices.length > 0);
    if (choices.length === 0) {
      return;
    }

    const width = this.scale.width - 48;
    const baseY = this.scale.height * 0.43;

    choices.slice(0, 4).forEach((choice, index) => {
      const y = baseY + index * 60;
      const card = this.add.container(24, y).setDepth(14);
      const bg = this.add
        .rectangle(0, 0, width, 52, this.choiceToColor(choice), 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffffff, 0.2);
      const label = this.add
        .text(14, 14, this.formatChoiceLabel(choice), {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
          color: '#f6fbff',
        })
        .setOrigin(0, 0.5);

      const zone = this.add.zone(0, 0, width, 52).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.handleChoiceSelection(choice);
      });

      card.add([bg, label, zone]);
      this.choiceButtons.push(card);
    });
  }

  private handleChoiceSelection(choice: PromptChoice): void {
    if (!this.promptEngine) {
      return;
    }

    if (choice.holdToConfirmMs && choice.holdToConfirmMs > 0) {
      this.showTransientStatus(`Hold-to-confirm simulated (${choice.holdToConfirmMs}ms): ${choice.text}`);
    }

    this.promptEngine.selectChoice(choice.id, this.time.now);
    this.refreshPromptView();
  }

  private showTransientStatus(message: string): void {
    const status = this.add
      .text(this.scale.width / 2, this.scale.height * 0.38, message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffe8a3',
        backgroundColor: '#232b3f',
        padding: { x: 8, y: 6 },
      })
      .setDepth(18)
      .setOrigin(0.5);

    this.time.delayedCall(1200, () => status.destroy());
  }

  private makePanelText(title: string, entries: string[]): string {
    if (entries.length === 0) {
      return `${title}\n• (empty)`;
    }

    return `${title}\n${entries
      .slice(0, 5)
      .map((entry) => `• ${entry}`)
      .join('\n')}`;
  }

  private formatChoiceLabel(choice: PromptChoice): string {
    const tone = choice.tone ? ` — ${choice.tone}` : '';
    return `${choice.text}${tone}`;
  }

  private choiceToColor(choice: PromptChoice): number {
    if (choice.tone === 'ominous') {
      return 0x5a1f2f;
    }

    if (choice.tone === 'kind') {
      return 0x214d3a;
    }

    if (choice.tone === 'cautious') {
      return 0x2d3f63;
    }

    return 0x2c3550;
  }

  private shutdown(): void {
    this.input.off('pointerdown', this.handlePointerDown, this);
  }
}
