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
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly crumbText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly backButton: Phaser.GameObjects.Container;

  private readonly dockSidePadding = 16;
  private readonly dockTop = 112;
  private readonly buttonWidth = 206;
  private readonly buttonHeight = 56;
  private readonly buttonGap = 6;
  private readonly layerOffsetX = 218;

  private activeButtons: MenuButton[] = [];
  private currentNodes: LayeredMenuNode[];
  private path: LayeredMenuNode[] = [];

  constructor(scene: Phaser.Scene, rootNodes: LayeredMenuNode[]) {
    this.scene = scene;
    this.rootNodes = rootNodes;
    this.currentNodes = rootNodes;

    this.titleText = scene.add
      .text(this.dockSidePadding, 18, 'Layered Icon Menu', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    this.crumbText = scene.add
      .text(this.dockSidePadding, 58, 'Top Level', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#7ee8fa',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    this.statusText = scene.add
      .text(this.dockSidePadding, scene.scale.height - 20, 'Select a category icon to reveal actions.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffd166',
      })
      .setOrigin(0, 1)
      .setDepth(10);

    this.backButton = this.createBackButton();
    this.renderLayer(false);
  }

  destroy(): void {
    this.clearActiveButtons();
    this.titleText.destroy();
    this.crumbText.destroy();
    this.statusText.destroy();
    this.backButton.destroy();
  }

  private renderLayer(withAnimation: boolean): void {
    this.clearActiveButtons();

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

    this.backButton.setVisible(this.path.length > 0);
    this.crumbText.setText(this.path.length === 0 ? 'Top Level' : this.path.map((node) => node.label).join(' / '));
  }

  private createMenuButton(node: LayeredMenuNode, position: Phaser.Math.Vector2): MenuButton {
    const container = this.scene.add.container(position.x, position.y).setDepth(8);

    const bg = this.scene.add
      .rectangle(0, 0, this.buttonWidth, this.buttonHeight, node.color, 0.95)
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
      .setOrigin(0, 0.5);

    const hitArea = this.scene.add
      .zone(0, 0, this.buttonWidth, this.buttonHeight)
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

  private createBackButton(): Phaser.GameObjects.Container {
    const x = this.dockSidePadding;
    const y = this.dockTop - 46;
    const container = this.scene.add.container(x, y).setDepth(9);

    const bg = this.scene.add
      .rectangle(0, 0, this.buttonWidth, 36, 0x2d3553, 0.95)
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
      .zone(0, 0, this.buttonWidth, 36)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => this.goBack());
    container.add([bg, label, hitArea]);
    container.setVisible(false);
    return container;
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

  private clearActiveButtons(): void {
    this.activeButtons.forEach((button) => button.container.destroy());
    this.activeButtons = [];
  }

  private getDockedPosition(depth: number, index: number): Phaser.Math.Vector2 {
    const x = this.dockSidePadding + depth * this.layerOffsetX;
    const y = this.dockTop + index * (this.buttonHeight + this.buttonGap);
    return new Phaser.Math.Vector2(x, y);
  }
}
