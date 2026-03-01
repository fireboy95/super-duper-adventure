import Phaser from 'phaser';
import { ROUTE_EVENT } from './UiScene';

export class RouterScene extends Phaser.Scene {
  private activeContentSceneKey = 'main-scene';

  constructor() {
    super('router-scene');
  }

  create(): void {
    this.scene.launch(this.activeContentSceneKey);
    this.scene.launch('ui-scene');
    this.scene.bringToTop('ui-scene');

    this.game.events.on(ROUTE_EVENT, this.handleRoute, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private shutdown(): void {
    this.game.events.off(ROUTE_EVENT, this.handleRoute, this);
  }

  private handleRoute(nextSceneKey: string): void {
    if (this.activeContentSceneKey === nextSceneKey) {
      return;
    }

    this.scene.stop(this.activeContentSceneKey);
    this.scene.launch(nextSceneKey);
    this.scene.bringToTop('ui-scene');
    this.activeContentSceneKey = nextSceneKey;
  }
}
