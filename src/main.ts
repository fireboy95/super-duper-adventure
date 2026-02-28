import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CageScene } from './scenes/CageScene';
import { EndingScene } from './scenes/EndingScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { debugConsole } from './systems/DebugConsole';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 480,
  },
  pixelArt: true,
  scene: [BootScene, TitleScene, CageScene, UIScene, EndingScene],
};

debugConsole.install();
new Phaser.Game(config);
