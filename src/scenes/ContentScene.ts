import Phaser from 'phaser';
import { DEFAULT_DIMENSION_ID, getDimensionById, type DimensionId } from '../game/dimensions';
import { DIMENSION_CHANGED_EVENT } from './UiScene';

export class ContentScene extends Phaser.Scene {
  private readonly heading: string;
  private readonly subtitle: string;
  private readonly baseBgColor: string;
  private subtitleText?: Phaser.GameObjects.Text;
  private dimensionTagText?: Phaser.GameObjects.Text;

  constructor(key: string, heading: string, subtitle: string, bgColor: string) {
    super(key);
    this.heading = heading;
    this.subtitle = subtitle;
    this.baseBgColor = bgColor;
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 16, this.heading, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '38px',
        color: '#f6fbff',
      })
      .setOrigin(0.5);

    this.subtitleText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 22, this.subtitle, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cde1ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setWordWrapWidth(Math.min(620, this.scale.width - 32));

    this.dimensionTagText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 64, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#d6ebff',
      })
      .setOrigin(0.5);

    const dimensionId = this.registry.get('activeDimension') as DimensionId | undefined;
    this.applyDimensionTheme(dimensionId ?? DEFAULT_DIMENSION_ID);

    this.game.events.on(DIMENSION_CHANGED_EVENT, this.applyDimensionTheme, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  private shutdown(): void {
    this.game.events.off(DIMENSION_CHANGED_EVENT, this.applyDimensionTheme, this);
  }

  private applyDimensionTheme(dimensionId: DimensionId): void {
    const dimension = getDimensionById(dimensionId);
    this.cameras.main.setBackgroundColor(dimension.bgColor || this.baseBgColor);
    this.dimensionTagText?.setText(`${dimension.icon} ${dimension.label} Dimension`);
    this.dimensionTagText?.setColor(dimension.accentColor);
    this.subtitleText?.setText(`${this.subtitle}\nCurrent dimension: ${dimension.description}`);
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
