import Phaser from 'phaser';
import { BuildScene, MapScene, QuestsScene, SettingsScene, SocialScene } from './scenes/ContentScene';
import { MainScene } from './scenes/MainScene';
import { RouterScene } from './scenes/RouterScene';
import { UiScene } from './scenes/UiScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1e1e2f',
  scene: [RouterScene, MainScene, MapScene, QuestsScene, BuildScene, SocialScene, SettingsScene, UiScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

new Phaser.Game(config);
