import Phaser from 'phaser';

export type LayeredMenuNode = {
  id: string;
  icon: string;
  label: string;
  color: number;
  onSelect?: () => void;
  children?: LayeredMenuNode[];
};

type MenuButton = {
  node: LayeredMenuNode;
  container: Phaser.GameObjects.Container;
};

export class LayeredIconMenu {
  private readonly scene: Phaser.Scene;
  private readonly rootNodes: LayeredMenuNode[];
  private readonly topBar: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly crumbText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly toggleButton: Phaser.GameObjects.Container;
  private readonly toggleLabel: Phaser.GameObjects.Text;
  private readonly backButton: Phaser.GameObjects.Container;

  private readonly dockTop = 116;
  private readonly buttonHeight = 56;
  private readonly buttonGap = 6;

  private activeButtons: MenuButton[] = [];
  private currentNodes: LayeredMenuNode[];
  private path: LayeredMenuNode[] = [];
  private isMenuExpanded = false;

  constructor(scene: Phaser.Scene, rootNodes: LayeredMenuNode[]) {
    this.scene = scene;
    this.rootNodes = rootNodes;
    this.currentNodes = rootNodes;

    this.topBar = scene.add.rectangle(0, 0, scene.scale.width, 84, 0x131a2d, 0.96).setOrigin(0, 0).setDepth(9);

    this.titleText = scene.add
      .text(this.getDockSidePadding(), 10, 'Layered Icon Menu', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    this.crumbText = scene.add
      .text(this.getDockSidePadding(), 40, 'Menu collapsed', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#7ee8fa',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    this.statusText = scene.add
      .text(this.getDockSidePadding(), 64, 'Open the menu to reveal categories.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffd166',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    const toggle = this.createToggleButton();
    this.toggleButton = toggle.container;
    this.toggleLabel = toggle.label;

    this.backButton = this.createBackButton();
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.scene.game.events.on(Phaser.Core.Events.BLUR, this.handleFocusLost, this);
    this.handleResize();
    this.renderLayer(false);
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.handleFocusLost, this);
    this.clearActiveButtons();
    this.topBar.destroy();
    this.titleText.destroy();
    this.crumbText.destroy();
    this.statusText.destroy();
    this.toggleButton.destroy();
    this.backButton.destroy();
  }

  private handleResize(): void {
    const padding = this.getDockSidePadding();
    this.topBar.setSize(this.scene.scale.width, 84);
    this.titleText.setPosition(padding, 10);
    this.crumbText.setPosition(padding, 40);
    this.statusText.setPosition(padding, 64).setWordWrapWidth(this.scene.scale.width - padding * 2);

    const toggleX = this.scene.scale.width - padding - 44;
    this.toggleButton.setPosition(toggleX, 18);
    this.backButton.setPosition(padding, this.dockTop - 42);

    this.renderLayer(false);
  }

  private renderLayer(withAnimation: boolean): void {
    this.clearActiveButtons();

    if (!this.isMenuExpanded) {
      this.backButton.setVisible(false);
      this.toggleLabel.setText('☰');
      this.crumbText.setText('Menu collapsed');
      return;
    }

    const depth = this.path.length;
    this.currentNodes.forEach((node, index) => {
      const position = this.getDockedPosition(depth, index);
      const button = this.createMenuButton(node, position);
      this.activeButtons.push(button);

      if (!withAnimation) {
        return;
      }

      button.container.setPosition(position.x - 20, position.y);
      button.container.setAlpha(0);
      this.scene.tweens.add({
        targets: button.container,
        x: position.x,
        alpha: 1,
        duration: 180,
        ease: 'Cubic.Out',
        delay: index * 20,
      });
    });

    this.toggleLabel.setText('✕');
    this.backButton.setVisible(this.path.length > 0);
    this.crumbText.setText(this.path.length === 0 ? 'Top Level' : this.path.map((node) => node.label).join(' / '));
  }

  private createMenuButton(node: LayeredMenuNode, position: Phaser.Math.Vector2): MenuButton {
    const buttonWidth = this.getButtonWidth();
    const container = this.scene.add.container(position.x, position.y).setDepth(8);

    const bg = this.scene.add
      .rectangle(0, 0, buttonWidth, this.buttonHeight, node.color, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setOrigin(0, 0);

    const icon = this.scene.add
      .text(14, this.buttonHeight / 2, node.icon, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0, 0.5);

    const label = this.scene.add
      .text(52, this.buttonHeight / 2, node.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#f8fbff',
      })
      .setOrigin(0, 0.5)
      .setWordWrapWidth(buttonWidth - 64)
      .setMaxLines(1);

    const hitArea = this.scene.add
      .zone(0, 0, buttonWidth, this.buttonHeight)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      this.scene.tweens.add({
        targets: container,
        x: position.x + 4,
        duration: 100,
      });
    });

    hitArea.on('pointerout', () => {
      this.scene.tweens.add({
        targets: container,
        x: position.x,
        duration: 100,
      });
    });

    hitArea.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: container,
        alpha: 0.8,
        yoyo: true,
        duration: 80,
      });
      this.selectNode(node);
    });

    container.add([bg, icon, label, hitArea]);
    return { node, container };
  }

  private createToggleButton(): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.scene.add.container(0, 0).setDepth(11);

    const bg = this.scene.add
      .rectangle(0, 0, 44, 44, 0x2d3553, 0.95)
      .setStrokeStyle(1, 0x86a8ff, 0.7)
      .setOrigin(0, 0);

    const label = this.scene.add
      .text(22, 22, '☰', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#f8fbff',
      })
      .setOrigin(0.5);

    const hitArea = this.scene.add.zone(0, 0, 44, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.toggleMenu());

    container.add([bg, label, hitArea]);
    return { container, label };
  }

  private createBackButton(): Phaser.GameObjects.Container {
    const x = this.getDockSidePadding();
    const y = this.dockTop - 42;
    const buttonWidth = this.getButtonWidth();
    const container = this.scene.add.container(x, y).setDepth(9);

    const bg = this.scene.add
      .rectangle(0, 0, buttonWidth, 36, 0x2d3553, 0.95)
      .setStrokeStyle(1, 0x86a8ff, 0.6)
      .setOrigin(0, 0);
    const label = this.scene.add
      .text(12, 18, '← Back', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#f8fbff',
      })
      .setOrigin(0, 0.5);

    const hitArea = this.scene.add
      .zone(0, 0, buttonWidth, 36)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.goBack());
    container.add([bg, label, hitArea]);
    container.setVisible(false);
    return container;
  }

  private toggleMenu(): void {
    if (this.isMenuExpanded) {
      this.resetToDefaultState('Menu collapsed.');
      return;
    }

    this.isMenuExpanded = true;
    this.currentNodes = this.rootNodes;
    this.path = [];
    this.statusText.setText('Select a category icon to reveal actions.');
    this.renderLayer(true);
  }

  private selectNode(node: LayeredMenuNode): void {
    if (node.children && node.children.length > 0) {
      this.path.push(node);
      this.currentNodes = node.children;
      this.statusText.setText(`Opened ${node.label}. Choose a specific action.`);
      this.renderLayer(true);
      return;
    }

    node.onSelect?.();
    this.statusText.setText(`Action triggered: ${node.label}`);
  }

  private goBack(): void {
    if (this.path.length === 0) {
      return;
    }

    this.path.pop();
    const parent = this.path.at(-1);
    this.currentNodes = parent?.children ?? this.rootNodes;
    this.statusText.setText(this.path.length === 0 ? 'Returned to top-level categories.' : `Back to ${parent?.label}.`);
    this.renderLayer(true);
  }

  private handleFocusLost(): void {
    this.resetToDefaultState('Menu focus lost. Collapsed to default state.');
  }

  private resetToDefaultState(statusMessage: string): void {
    this.path = [];
    this.currentNodes = this.rootNodes;
    this.isMenuExpanded = false;
    this.statusText.setText(statusMessage);
    this.renderLayer(true);
  }

  private clearActiveButtons(): void {
    this.activeButtons.forEach((button) => button.container.destroy());
    this.activeButtons = [];
  }

  private getDockedPosition(depth: number, index: number): Phaser.Math.Vector2 {
    const sidePadding = this.getDockSidePadding();
    const buttonWidth = this.getButtonWidth();
    const layerOffsetX = this.getLayerOffsetX();
    const maxX = this.scene.scale.width - sidePadding - buttonWidth;
    const x = Math.min(sidePadding + depth * layerOffsetX, maxX);
    const y = this.dockTop + index * (this.buttonHeight + this.buttonGap);
    return new Phaser.Math.Vector2(x, y);
  }

  private getDockSidePadding(): number {
    return this.scene.scale.width < 420 ? 10 : 16;
  }

  private getButtonWidth(): number {
    const sidePadding = this.getDockSidePadding();
    return Math.min(206, Math.max(164, this.scene.scale.width - sidePadding * 2));
  }

  private getLayerOffsetX(): number {
    return this.scene.scale.width < 420 ? 18 : 32;
  }
}
