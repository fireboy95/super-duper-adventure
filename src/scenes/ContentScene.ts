import Phaser from 'phaser';

export class ContentScene extends Phaser.Scene {
  private readonly heading: string;
  private readonly subtitle: string;
  private readonly bgColor: string;

  constructor(key: string, heading: string, subtitle: string, bgColor: string) {
    super(key);
    this.heading = heading;
    this.subtitle = subtitle;
    this.bgColor = bgColor;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.bgColor);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 16, this.heading, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '38px',
        color: '#f6fbff',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 22, this.subtitle, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cde1ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setWordWrapWidth(Math.min(620, this.scale.width - 32));
  }
}

export class MapScene extends ContentScene {
  constructor() {
    super('map-scene', 'Map', 'Explore world navigation and waypoint tools.', '#1f3047');
  }
}

export class QuestsScene extends ContentScene {
  constructor() {
    super('quests-scene', 'Quests', 'Track the main path and side objectives from here.', '#2f2a44');
  }
}

export class BuildScene extends ContentScene {
  constructor() {
    super('build-scene', 'Build', 'Crafting and workshop actions live in this routed scene.', '#3b2749');
  }
}

export class SocialScene extends ContentScene {
  constructor() {
    super('social-scene', 'Social', 'Friends, guild, and messages route into this view.', '#3b2c3d');
  }
}

export class SettingsScene extends ContentScene {
  constructor() {
    super('settings-scene', 'Settings', 'Adjust audio, controls, and accessibility options.', '#2f3548');
  }
}
