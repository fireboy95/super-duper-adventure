import Phaser from 'phaser';
import { LayeredIconMenu, type LayeredMenuNode } from '../game/ui/LayeredIconMenu';

const ROUTE_EVENT = 'ui:navigate';

export class UiScene extends Phaser.Scene {
  private layeredMenu?: LayeredIconMenu;

  constructor() {
    super('ui-scene');
  }

  create(): void {
    this.layeredMenu = new LayeredIconMenu(this, this.buildMenuDefinition());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private shutdown(): void {
    this.layeredMenu?.destroy();
    this.layeredMenu = undefined;
  }

  private buildMenuDefinition(): LayeredMenuNode[] {
    return [
      {
        id: 'explore',
        icon: '🧭',
        label: 'Explore',
        color: 0x457b9d,
        children: [
          { id: 'map', icon: '🗺️', label: 'Map', color: 0x3a86ff, onSelect: () => this.navigate('map-scene') },
          { id: 'quests', icon: '📜', label: 'Quests', color: 0x4d908e, onSelect: () => this.navigate('quests-scene') },
          { id: 'home', icon: '🏠', label: 'Home', color: 0x457b9d, onSelect: () => this.navigate('main-scene') },
        ],
      },
      {
        id: 'build',
        icon: '🛠️',
        label: 'Build',
        color: 0x9d4edd,
        children: [
          { id: 'craft', icon: '⚒️', label: 'Craft', color: 0x7b2cbf, onSelect: () => this.navigate('build-scene') },
          { id: 'upgrade', icon: '⬆️', label: 'Upgrade', color: 0x5a189a, onSelect: () => this.navigate('build-scene') },
          { id: 'workshop', icon: '🏗️', label: 'Workshop', color: 0x3c096c, onSelect: () => this.navigate('build-scene') },
        ],
      },
      {
        id: 'social',
        icon: '👥',
        label: 'Social',
        color: 0xff8fab,
        children: [
          { id: 'friends', icon: '🤝', label: 'Friends', color: 0xff6b6b, onSelect: () => this.navigate('social-scene') },
          { id: 'guild', icon: '🛡️', label: 'Guild', color: 0xf06595, onSelect: () => this.navigate('social-scene') },
          { id: 'mail', icon: '✉️', label: 'Messages', color: 0xe64980, onSelect: () => this.navigate('social-scene') },
        ],
      },
      {
        id: 'settings',
        icon: '⚙️',
        label: 'Settings',
        color: 0xf4a261,
        children: [
          { id: 'audio', icon: '🔊', label: 'Audio', color: 0xe76f51, onSelect: () => this.navigate('settings-scene') },
          { id: 'controls', icon: '🎮', label: 'Controls', color: 0xf77f00, onSelect: () => this.navigate('settings-scene') },
          { id: 'accessibility', icon: '♿', label: 'Accessibility', color: 0xfc8c29, onSelect: () => this.navigate('settings-scene') },
        ],
      },
    ];
  }

  private navigate(sceneKey: string): void {
    this.game.events.emit(ROUTE_EVENT, sceneKey);
  }
}

export { ROUTE_EVENT };
