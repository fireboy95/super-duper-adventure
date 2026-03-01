import Phaser from 'phaser';
import { type PromptChoice, type PromptKeyword, type PromptSnapshot } from '../prompt/types';

type PromptOverlayCallbacks = {
  onAdvance: () => void;
  onChoice: (choice: PromptChoice) => void;
  onKeyword: (keyword: PromptKeyword) => void;
};

export class PromptDialogueOverlay {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: PromptOverlayCallbacks;

  private readonly dialoguePanel: Phaser.GameObjects.Rectangle;
  private readonly dialogueText: Phaser.GameObjects.Text;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly portraitText: Phaser.GameObjects.Text;
  private readonly expressionText: Phaser.GameObjects.Text;
  private readonly continueHint: Phaser.GameObjects.Text;
  private readonly dimOverlay: Phaser.GameObjects.Rectangle;

  private readonly logPanel: Phaser.GameObjects.Rectangle;
  private readonly logText: Phaser.GameObjects.Text;
  private readonly notebookPanel: Phaser.GameObjects.Rectangle;
  private readonly notebookText: Phaser.GameObjects.Text;

  private readonly utilityObjects: Phaser.GameObjects.GameObject[] = [];
  private keywordButtons: Phaser.GameObjects.Container[] = [];
  private choiceButtons: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, callbacks: PromptOverlayCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    this.scene.add
      .text(this.scene.scale.width / 2, this.scene.scale.height * 0.24, 'Hamster Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#dbe7ff',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.scene.add
      .text(this.scene.scale.width / 2, this.scene.scale.height * 0.31, 'Dialogue-focused prototype with data-driven prompts.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#9bb0d3',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setWordWrapWidth(Math.min(620, this.scene.scale.width - 28));

    this.dimOverlay = this.scene.add
      .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.34)
      .setOrigin(0, 0)
      .setDepth(3)
      .setVisible(false);

    this.dialoguePanel = this.scene.add
      .rectangle(12, this.scene.scale.height * 0.62, this.scene.scale.width - 24, this.scene.scale.height * 0.35, 0x0c1322, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x62a5ff, 0.45)
      .setDepth(4);

    this.portraitText = this.scene.add
      .text(30, this.scene.scale.height * 0.64, '🐹', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
      })
      .setDepth(5);

    this.speakerText = this.scene.add
      .text(82, this.scene.scale.height * 0.65, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#d9e9ff',
      })
      .setDepth(5);

    this.expressionText = this.scene.add
      .text(82, this.scene.scale.height * 0.69, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#7dd3fc',
      })
      .setDepth(5);

    this.dialogueText = this.scene.add
      .text(24, this.scene.scale.height * 0.74, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#f5f9ff',
        wordWrap: { width: this.scene.scale.width - 48 },
      })
      .setDepth(5);

    this.continueHint = this.scene.add
      .text(this.scene.scale.width - 28, this.scene.scale.height - 28, 'Tap to continue ▸', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9dc4ff',
      })
      .setDepth(5)
      .setOrigin(1, 1);

    this.createUtilityButton(20, 20, 'Log', () => this.toggleLogPanel());
    this.createUtilityButton(88, 20, 'Notebook', () => this.toggleNotebookPanel());

    this.logPanel = this.scene.add
      .rectangle(12, 56, this.scene.scale.width - 24, 190, 0x0c1322, 0.94)
      .setOrigin(0, 0)
      .setDepth(20)
      .setVisible(false);

    this.logText = this.scene.add
      .text(22, 66, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#dbe7ff',
        wordWrap: { width: this.scene.scale.width - 44 },
      })
      .setDepth(21)
      .setVisible(false);

    this.notebookPanel = this.scene.add
      .rectangle(12, 252, this.scene.scale.width - 24, 170, 0x101827, 0.94)
      .setOrigin(0, 0)
      .setDepth(20)
      .setVisible(false);

    this.notebookText = this.scene.add
      .text(22, 262, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#dbe7ff',
        wordWrap: { width: this.scene.scale.width - 44 },
      })
      .setDepth(21)
      .setVisible(false);

    this.scene.input.on('pointerdown', this.handlePointerDown, this);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.keywordButtons.forEach((button) => button.destroy());
    this.choiceButtons.forEach((button) => button.destroy());
    this.utilityObjects.forEach((obj) => obj.destroy());
    this.dialoguePanel.destroy();
    this.dialogueText.destroy();
    this.speakerText.destroy();
    this.portraitText.destroy();
    this.expressionText.destroy();
    this.continueHint.destroy();
    this.dimOverlay.destroy();
    this.logPanel.destroy();
    this.logText.destroy();
    this.notebookPanel.destroy();
    this.notebookText.destroy();
  }

  render(snapshot: PromptSnapshot, keywords: PromptKeyword[]): void {
    this.speakerText.setText(snapshot.speaker);
    this.portraitText.setText(snapshot.portrait);
    this.expressionText.setText(`Tone: ${snapshot.expression}`);
    this.dialogueText.setText(snapshot.pageText);
    this.continueHint.setVisible(snapshot.visibleChoices.length === 0);
    this.logText.setText(this.makePanelText('Recent dialogue', snapshot.dialogueLog));
    this.notebookText.setText(this.makePanelText('Notebook', snapshot.notebookEntries));

    this.renderKeywordButtons(keywords);
    this.renderChoices(snapshot.visibleChoices);
  }

  pulseContinueHint(): void {
    this.continueHint.setVisible(!this.continueHint.visible);
  }

  showTransientStatus(message: string): void {
    const status = this.scene.add
      .text(this.scene.scale.width / 2, this.scene.scale.height * 0.38, message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffe8a3',
        backgroundColor: '#232b3f',
        padding: { x: 8, y: 6 },
      })
      .setDepth(18)
      .setOrigin(0.5);

    this.scene.time.delayedCall(1200, () => status.destroy());
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.event.defaultPrevented) {
      return;
    }

    this.callbacks.onAdvance();
  }

  private renderKeywordButtons(keywords: PromptKeyword[]): void {
    this.keywordButtons.forEach((button) => button.destroy());
    this.keywordButtons = [];

    const startX = 24;
    const y = this.scene.scale.height * 0.87;

    keywords.forEach((keyword, index) => {
      const button = this.scene.add.container(startX + index * 108, y).setDepth(12);
      const bg = this.scene.add.rectangle(0, 0, 100, 24, 0x1f3b61, 0.9).setOrigin(0, 0);
      const label = this.scene.add
        .text(50, 12, keyword.label, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cbe1ff' })
        .setOrigin(0.5);
      const zone = this.scene.add.zone(0, 0, 100, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.callbacks.onKeyword(keyword);
      });

      button.add([bg, label, zone]);
      this.keywordButtons.push(button);
    });
  }

  private renderChoices(choices: PromptChoice[]): void {
    this.choiceButtons.forEach((button) => button.destroy());
    this.choiceButtons = [];

    this.dimOverlay.setVisible(choices.length > 0);
    if (choices.length === 0) {
      return;
    }

    const width = this.scene.scale.width - 48;
    const baseY = this.scene.scale.height * 0.43;

    choices.slice(0, 4).forEach((choice, index) => {
      const y = baseY + index * 60;
      const card = this.scene.add.container(24, y).setDepth(14);
      const bg = this.scene.add
        .rectangle(0, 0, width, 52, this.choiceToColor(choice), 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffffff, 0.2);
      const label = this.scene.add
        .text(14, 14, this.formatChoiceLabel(choice), {
          fontFamily: 'Arial, sans-serif',
          fontSize: '17px',
          color: '#f6fbff',
        })
        .setOrigin(0, 0.5);

      const zone = this.scene.add.zone(0, 0, width, 52).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.callbacks.onChoice(choice);
      });

      card.add([bg, label, zone]);
      this.choiceButtons.push(card);
    });
  }

  private createUtilityButton(x: number, y: number, label: string, onTap: () => void): void {
    const background = this.scene.add
      .rectangle(x, y, 60, 28, 0x1d2a43, 0.95)
      .setOrigin(0, 0)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add
      .text(x + 30, y + 14, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#dce9ff' })
      .setOrigin(0.5)
      .setDepth(16)
      .setInteractive({ useHandCursor: true });

    background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onTap();
    });

    text.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      onTap();
    });

    this.utilityObjects.push(background, text);
  }

  private toggleLogPanel(): void {
    const visible = !this.logPanel.visible;
    this.logPanel.setVisible(visible);
    this.logText.setVisible(visible);
  }

  private toggleNotebookPanel(): void {
    const visible = !this.notebookPanel.visible;
    this.notebookPanel.setVisible(visible);
    this.notebookText.setVisible(visible);
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
}
