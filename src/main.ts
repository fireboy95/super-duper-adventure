import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { HudScene } from './scenes/HudScene';
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
  scene: [BootScene, MainMenuScene, GameScene, HudScene, GameOverScene],
};

debugConsole.install();
new Phaser.Game(config);
