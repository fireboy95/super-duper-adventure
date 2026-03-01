import Phaser from 'phaser';
import { AudioSystem } from '../game/systems/AudioSystem';
import { LayeredIconMenu, type LayeredMenuNode } from '../game/ui/LayeredIconMenu';

export class MainScene extends Phaser.Scene {
  private audioSystem?: AudioSystem;
  private layeredMenu?: LayeredIconMenu;

  constructor() {
    super('main-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b1f30');

    this.audioSystem = new AudioSystem(this);
    this.layeredMenu = new LayeredIconMenu(this, this.buildMenuDefinition());

    this.add
      .text(this.scale.width / 2, this.scale.height - 20, 'Tap icons to drill into nested actions. Use Back to return.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#9bb0d3',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  private shutdown(): void {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.layeredMenu?.destroy();
    this.layeredMenu = undefined;
  }

  private handlePointerDown(): void {
    this.audioSystem?.unlock();
  }

  private buildMenuDefinition(): LayeredMenuNode[] {
    return [
      {
        id: 'explore',
        icon: '🧭',
        label: 'Explore',
        color: 0x457b9d,
        children: [
          {
            id: 'map',
            icon: '🗺️',
            label: 'Map',
            color: 0x3a86ff,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'quests',
            icon: '📜',
            label: 'Quests',
            color: 0x4d908e,
            children: [
              {
                id: 'main-quest',
                icon: '⭐',
                label: 'Main Path',
                color: 0x577590,
                onSelect: () => this.playActionSound(),
              },
              {
                id: 'side-quest',
                icon: '🧩',
                label: 'Side Tasks',
                color: 0x43aa8b,
                onSelect: () => this.playActionSound(),
              },
            ],
          },
          {
            id: 'fast-travel',
            icon: '🚪',
            label: 'Fast Travel',
            color: 0x277da1,
            onSelect: () => this.playActionSound(),
          },
        ],
      },
      {
        id: 'build',
        icon: '🛠️',
        label: 'Build',
        color: 0x9d4edd,
        children: [
          {
            id: 'craft',
            icon: '⚒️',
            label: 'Craft',
            color: 0x7b2cbf,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'upgrade',
            icon: '⬆️',
            label: 'Upgrade',
            color: 0x5a189a,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'workshop',
            icon: '🏗️',
            label: 'Workshop',
            color: 0x3c096c,
            children: [
              {
                id: 'blueprints',
                icon: '📐',
                label: 'Blueprints',
                color: 0x5f0f40,
                onSelect: () => this.playActionSound(),
              },
              {
                id: 'automation',
                icon: '⚙️',
                label: 'Automation',
                color: 0x7b2cbf,
                onSelect: () => this.playActionSound(),
              },
            ],
          },
        ],
      },
      {
        id: 'social',
        icon: '👥',
        label: 'Social',
        color: 0xff8fab,
        children: [
          {
            id: 'friends',
            icon: '🤝',
            label: 'Friends',
            color: 0xff6b6b,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'guild',
            icon: '🛡️',
            label: 'Guild',
            color: 0xf06595,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'mail',
            icon: '✉️',
            label: 'Messages',
            color: 0xe64980,
            onSelect: () => this.playActionSound(),
          },
        ],
      },
      {
        id: 'settings',
        icon: '⚙️',
        label: 'Settings',
        color: 0xf4a261,
        children: [
          {
            id: 'audio',
            icon: '🔊',
            label: 'Audio',
            color: 0xe76f51,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'controls',
            icon: '🎮',
            label: 'Controls',
            color: 0xf77f00,
            onSelect: () => this.playActionSound(),
          },
          {
            id: 'accessibility',
            icon: '♿',
            label: 'Accessibility',
            color: 0xfc8c29,
            onSelect: () => this.playActionSound(),
          },
        ],
      },
    ];
  }

  private playActionSound(): void {
    this.audioSystem?.playMoveBlip(0.04);
  }
}
