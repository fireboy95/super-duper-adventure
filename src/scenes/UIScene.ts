import Phaser from 'phaser';
import { DialogEntry, DialogOption, DialogueSystem } from '../systems/DialogueSystem';
import { DebugConsoleEntry, debugConsole } from '../systems/DebugConsole';
import { DEFAULT_SAFE_AREA_INSETS, InitialViewportState, SafeAreaInsets, UI_SAFE_AREA_EVENT } from './layoutContract';

type TopMenuKey = 'feed' | 'care' | 'social';


type DialogSource = 'event' | 'system';

interface DialogRequest {
  dialogId: string;
  eventId?: string;
  priority?: number;
  queueTimeoutMs?: number;
  supersedeBelowPriority?: number;
  source?: DialogSource;
}

export class UIScene extends Phaser.Scene {
  private dialogueSystem = new DialogueSystem();
  private hudText?: Phaser.GameObjects.Text;
  private debugPanel?: Phaser.GameObjects.Container;
  private debugBackground?: Phaser.GameObjects.Rectangle;
  private debugText?: Phaser.GameObjects.Text;
  private debugTitle?: Phaser.GameObjects.Text;
  private debugHintText?: Phaser.GameObjects.Text;
  private debugStatusText?: Phaser.GameObjects.Text;
  private debugVisibleLines = 8;

  private menuBar?: Phaser.GameObjects.Container;
  private subMenuBar?: Phaser.GameObjects.Container;
  private topMenuButtons = new Map<TopMenuKey, Phaser.GameObjects.Container>();
  private actionGroupButtons = new Map<string, Phaser.GameObjects.Container>();
  private subActionButtons = new Map<string, Phaser.GameObjects.Container>();
  private backButton?: Phaser.GameObjects.Container;
  private activeMenu: TopMenuKey | null = null;
  private activeActionGroup: string | null = null;

  private feedButtonDisabled = false;
  private sweetButtonDisabled = false;
  private isDebugOpen = false;
  private unsubscribeDebug?: () => void;

  private dialogModal?: Phaser.GameObjects.Container;
  private dialogBackdrop?: Phaser.GameObjects.Rectangle;
  private dialogPanel?: Phaser.GameObjects.Rectangle;
  private dialogTitleText?: Phaser.GameObjects.Text;
  private dialogSpeakerText?: Phaser.GameObjects.Text;
  private dialogPageText?: Phaser.GameObjects.Text;
  private dialogPageIndicatorText?: Phaser.GameObjects.Text;
  private dialogAdvanceButton?: Phaser.GameObjects.Container;
  private dialogOptionButtons: Phaser.GameObjects.Container[] = [];
  private currentDialog: DialogEntry | null = null;
  private currentDialogPage = 0;
  private currentDialogEventId: string | null = null;
  private currentDialogPriority = 0;
  private pendingDialogs: DialogRequest[] = [];
  private hudBackground?: Phaser.GameObjects.Rectangle;
  private controlsAreaHeight = 0;
  private safeAreaInsets: SafeAreaInsets = { ...DEFAULT_SAFE_AREA_INSETS };

  constructor() {
    super('UIScene');
  }

  create(data?: { initialViewport?: InitialViewportState }): void {
    this.hudBackground = this.add.rectangle(320, 22, 640, 44, 0x1f1f1f, 0.9);
    this.hudText = this.add.text(16, 10, 'Hunger -- | Thirst -- | Energy -- | Health -- | Cleanliness -- | Mood --', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f7f7f7',
      wordWrap: { width: Math.max(200, this.scale.width - 120) },
      lineSpacing: 2,
    });

    const debugHintCopy = this.sys.game.device.input.touch ? '[DEBUG TAP]' : '[` DEBUG]';
    this.debugHintText = this.add.text(625, 10, debugHintCopy, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff99',
    });
    this.debugHintText.setOrigin(1, 0);
    this.debugHintText.setInteractive({ useHandCursor: true });
    this.debugHintText.on('pointerdown', () => {
      this.toggleDebugPanel();
    });

    this.debugStatusText = this.add.text(16, 30, 'DEBUG: OFF', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff99',
    });

    this.createTouchControls();
    this.createDialogModal();
    const initialWidth = data?.initialViewport?.width ?? this.scale.width;
    const initialHeight = data?.initialViewport?.height ?? this.scale.height;
    this.safeAreaInsets = data?.initialViewport?.safeAreaInsets ?? { ...DEFAULT_SAFE_AREA_INSETS };
    this.layoutResponsiveUi(initialWidth, initialHeight);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.createDebugOverlay();
    this.bindDebugToggle();
    this.bindDialogueEvents();
    this.bindHudEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeDebug?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }


  update(_time: number, delta: number): void {
    if (this.pendingDialogs.length === 0) return;

    this.pendingDialogs = this.pendingDialogs.filter((request) => {
      if (typeof request.queueTimeoutMs !== 'number') return true;
      request.queueTimeoutMs -= delta;
      return request.queueTimeoutMs > 0;
    });
  }

  private bindHudEvents(): void {
    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('hud:update', (payload: { hunger: number; thirst: number; energy: number; health: number; cleanliness: number; mood: number; foodStandard?: number; foodSweet?: number }) => {
      this.hudText?.setText(
        `H ${payload.hunger.toFixed(0)}  T ${payload.thirst.toFixed(0)}  E ${payload.energy.toFixed(0)}  HP ${payload.health.toFixed(0)}\nClean ${payload.cleanliness.toFixed(0)}  Mood ${payload.mood.toFixed(0)}`,
      );

      this.setActionButtonDisabled(this.subActionButtons.get('feed-standard'), (payload.foodStandard ?? 0) <= 0, 0x306a43);
      this.setActionButtonDisabled(this.subActionButtons.get('feed-sweet'), (payload.foodSweet ?? 0) <= 0, 0x6e3e8c);
    });
  }

  private bindDialogueEvents(): void {
    const cageScene = this.scene.get('CageScene');
    cageScene.events.on('dialog:show', (payload: string | DialogRequest) => {
      if (typeof payload === 'string') {
        this.enqueueOrShowDialog({ dialogId: payload, source: 'system', priority: 100 });
        return;
      }

      this.enqueueOrShowDialog(payload);
    });
  }

  private enqueueOrShowDialog(request: DialogRequest): void {
    const normalized = this.normalizeDialogRequest(request);

    if (!this.currentDialog) {
      this.openDialog(normalized);
      return;
    }

    const canSupersedeCurrent = (normalized.priority ?? 0) > this.currentDialogPriority;
    const currentCanBeSuperseded =
      typeof normalized.supersedeBelowPriority !== 'number' || this.currentDialogPriority < normalized.supersedeBelowPriority;

    if (canSupersedeCurrent && currentCanBeSuperseded) {
      this.pendingDialogs.unshift(normalized);
      this.openNextPendingDialog();
      return;
    }

    if (typeof normalized.queueTimeoutMs === 'number' && normalized.queueTimeoutMs <= 0) {
      console.debug(`[dialog] Dropping dialog "${normalized.dialogId}" due to non-positive queue timeout.`);
      return;
    }

    this.pendingDialogs.push(normalized);
  }

  private normalizeDialogRequest(request: DialogRequest): DialogRequest {
    return {
      dialogId: request.dialogId,
      eventId: request.eventId,
      priority: request.priority ?? (request.source === 'event' ? 50 : 100),
      queueTimeoutMs: request.queueTimeoutMs,
      supersedeBelowPriority: request.supersedeBelowPriority,
      source: request.source ?? (request.eventId ? 'event' : 'system'),
    };
  }

  private openDialog(request: DialogRequest): void {
    const dialog = this.dialogueSystem.getById(request.dialogId);
    if (!dialog) {
      console.warn(`[dialog] Unknown dialog ID "${request.dialogId}" requested.`);
      return;
    }

    this.currentDialog = dialog;
    this.currentDialogPage = 0;
    this.currentDialogEventId = request.eventId ?? null;
    this.currentDialogPriority = request.priority ?? 0;
    this.dialogBackdrop?.setInteractive();
    this.dialogModal?.setVisible(true);
    this.renderDialog();
  }

  private renderDialog(): void {
    if (!this.currentDialog || !this.dialogTitleText || !this.dialogSpeakerText || !this.dialogPageText || !this.dialogPageIndicatorText) {
      return;
    }

    const totalPages = this.currentDialog.pages.length;
    const isFinalPage = this.currentDialogPage >= totalPages - 1;

    this.dialogTitleText.setText(this.currentDialog.title);
    this.dialogSpeakerText.setText(`Speaker: ${this.currentDialog.speaker}`);
    this.dialogPageText.setText(this.currentDialog.pages[this.currentDialogPage] ?? '...');
    this.dialogPageIndicatorText.setText(`Page ${this.currentDialogPage + 1}/${totalPages}`);

    this.renderDialogOptions(isFinalPage ? this.currentDialog.options : []);
    this.updateAdvanceButton(isFinalPage);
  }

  private renderDialogOptions(options: DialogOption[]): void {
    for (const button of this.dialogOptionButtons) button.destroy();
    this.dialogOptionButtons = [];

    options.forEach((option) => {
      const button = this.createModalButton(option.label, 0x284968, () => {
        this.handleOptionSelection(option);
      });
      this.dialogModal?.add(button);
      this.dialogOptionButtons.push(button);
    });

    this.layoutResponsiveUi(this.scale.width, this.scale.height);
  }

  private handleOptionSelection(option: DialogOption): void {
    const cageScene = this.scene.get('CageScene');

    if (!option.effects) {
      this.closeDialog();
      return;
    }

    const optionEffects = structuredClone(option.effects);
    const labelLower = option.label.toLowerCase();
    const shouldMarkIgnore = this.currentDialogEventId && (labelLower.includes('later') || labelLower.includes('ignore'));

    if (shouldMarkIgnore) {
      const progression = optionEffects.progression ?? {};
      const ignoredEventIdsAdd = progression.ignoredEventIdsAdd ?? [];
      if (this.currentDialogEventId && !ignoredEventIdsAdd.includes(this.currentDialogEventId)) {
        ignoredEventIdsAdd.push(this.currentDialogEventId);
      }
      progression.ignoredEventIdsAdd = ignoredEventIdsAdd;
      optionEffects.progression = progression;
    }

    cageScene.events.emit('dialog:apply-effects', optionEffects);

    const followUpDialogId = optionEffects.nextDialogId ?? optionEffects.followUpDialogIds?.[0];
    if (followUpDialogId) {
      this.enqueueOrShowDialog({ dialogId: followUpDialogId, source: 'system', priority: this.currentDialogPriority });
      return;
    }

    this.closeDialog();
  }

  private closeDialog(): void {
    this.currentDialog = null;
    this.currentDialogPage = 0;
    this.currentDialogEventId = null;
    this.currentDialogPriority = 0;
    this.renderDialogOptions([]);
    this.dialogBackdrop?.disableInteractive();
    this.dialogModal?.setVisible(false);
    this.openNextPendingDialog();
  }

  private openNextPendingDialog(): void {
    while (this.pendingDialogs.length > 0) {
      const next = this.pendingDialogs.shift();
      if (!next) return;

      this.openDialog(next);
      return;
    }
  }

  private updateAdvanceButton(isFinalPage: boolean): void {
    if (!this.dialogAdvanceButton) return;

    const labelText = this.dialogAdvanceButton.list[1] as Phaser.GameObjects.Text;
    labelText.setText(isFinalPage ? 'CLOSE' : 'NEXT');

    const background = this.dialogAdvanceButton.list[0] as Phaser.GameObjects.Rectangle;
    background.removeAllListeners('pointerdown');
    background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.currentDialog) {
        this.closeDialog();
        return;
      }

      if (isFinalPage) {
        this.closeDialog();
      } else {
        this.currentDialogPage += 1;
        this.renderDialog();
      }
    });
  }

  private createDialogModal(): void {
    this.dialogBackdrop = this.add.rectangle(320, 240, 640, 480, 0x000000, 0.5).setInteractive();
    this.dialogBackdrop.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    this.dialogPanel = this.add.rectangle(320, 240, 520, 320, 0x13161d, 0.94);
    this.dialogPanel.setStrokeStyle(2, 0xc9dbff, 0.9);

    this.dialogTitleText = this.add.text(90, 106, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f7f7f7',
    });

    this.dialogSpeakerText = this.add.text(90, 133, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#bbcae8',
    });

    this.dialogPageText = this.add.text(90, 168, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      wordWrap: { width: 455 },
      lineSpacing: 3,
    });

    this.dialogPageIndicatorText = this.add.text(90, 280, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#9faeca',
    });

    this.dialogAdvanceButton = this.createModalButton('NEXT', 0x474c57, () => undefined);
    this.dialogAdvanceButton.setPosition(0, 146);

    this.dialogModal = this.add.container(0, 0, [
      this.dialogBackdrop,
      this.dialogPanel,
      this.dialogTitleText,
      this.dialogSpeakerText,
      this.dialogPageText,
      this.dialogPageIndicatorText,
      this.dialogAdvanceButton,
    ]);

    this.dialogModal.setDepth(30);
    this.dialogModal.setVisible(false);
    this.dialogBackdrop.disableInteractive();
  }

  private createDebugOverlay(): void {
    this.debugBackground = this.add.rectangle(0, 0, 620, 220, 0x000000, 0.82).setOrigin(0);
    this.debugBackground.setStrokeStyle(2, 0x00ff99, 0.75);

    this.debugTitle = this.add.text(12, 10, 'DEBUG CONSOLE // QUAKE MODE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ff99',
    });

    this.debugText = this.add.text(12, 34, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#d3ffd8',
      wordWrap: { width: 592 },
      lineSpacing: 3,
    });

    this.debugPanel = this.add.container(0, 0, [this.debugBackground, this.debugTitle, this.debugText]);
    this.debugPanel.setDepth(20);
    this.debugPanel.setVisible(false);

    this.unsubscribeDebug = debugConsole.subscribe((entries) => {
      this.renderDebugEntries(entries);
    });
  }

  private bindDebugToggle(): void {
    const backtickKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    backtickKey?.on('down', () => {
      this.toggleDebugPanel();
    });
  }

  private toggleDebugPanel(): void {
    this.isDebugOpen = !this.isDebugOpen;
    this.debugPanel?.setVisible(this.isDebugOpen);
    this.debugHintText?.setColor(this.isDebugOpen ? '#ffffff' : '#00ff99');
    this.debugStatusText?.setText(`DEBUG: ${this.isDebugOpen ? 'ON' : 'OFF'}`);
    this.debugStatusText?.setColor(this.isDebugOpen ? '#ffffff' : '#00ff99');
  }

  private renderDebugEntries(entries: DebugConsoleEntry[]): void {
    if (!this.debugText) return;
    const lines = entries
      .slice(-this.debugVisibleLines)
      .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`);

    this.debugText.setText(lines.join('\n'));
  }

  private createTouchControls(): void {
    this.menuBar = this.add.container(0, 0);
    this.subMenuBar = this.add.container(0, 0);

    const topMenus: Array<{ key: TopMenuKey; icon: string; label: string; color: number }> = [
      { key: 'feed', icon: '🍽️', label: 'FEED', color: 0x2f6f57 },
      { key: 'care', icon: '🛁', label: 'CARE', color: 0x356383 },
      { key: 'social', icon: '💬', label: 'SOCIAL', color: 0x6d4a2f },
    ];

    topMenus.forEach((menu) => {
      const button = this.createActionButton(menu.icon, menu.label, menu.color, () => {
        this.sound.play('ui-click', { volume: 0.25 });
        this.toggleActionSubmenu(menu.key);
      });
      button.setData('menu', menu.key);
      this.topMenuButtons.set(menu.key, button);
      this.menuBar?.add(button);
    });

    const actionGroups: Array<{ key: string; menu: TopMenuKey; icon: string; label: string; color: number }> = [
      { key: 'feed-food', menu: 'feed', icon: '🥣', label: 'FOOD', color: 0x306a43 },
      { key: 'feed-water', menu: 'feed', icon: '💧', label: 'WATER', color: 0x2e6f95 },
      { key: 'care-hygiene', menu: 'care', icon: '🧽', label: 'HYGIENE', color: 0x365f82 },
      { key: 'social-handle', menu: 'social', icon: '🤝', label: 'HANDLE', color: 0x7a5738 },
    ];

    actionGroups.forEach((group) => {
      const button = this.createActionButton(group.icon, group.label, group.color, () => {
        this.sound.play('ui-click', { volume: 0.25 });
        this.toggleActionGroup(group.key);
      });
      button.setData('menu', group.menu);
      this.actionGroupButtons.set(group.key, button);
      this.subMenuBar?.add(button);
    });

    this.backButton = this.createActionButton('↩️', 'BACK', 0x424242, () => {
      this.sound.play('ui-click', { volume: 0.25 });
      this.activeActionGroup = null;
      this.refreshActionHierarchy();
    });
    this.subMenuBar?.add(this.backButton);

    const actions: Array<{ key: string; menu: TopMenuKey; group: string; icon: string; label: string; color: number; onPress: () => void }> = [
      {
        key: 'feed-standard',
        menu: 'feed',
        group: 'feed-food',
        icon: '🥣',
        label: 'FEED',
        color: 0x306a43,
        onPress: () => this.scene.get('CageScene').events.emit('action:feed'),
      },
      {
        key: 'feed-sweet',
        menu: 'feed',
        group: 'feed-food',
        icon: '🍬',
        label: 'TREAT',
        color: 0x6e3e8c,
        onPress: () => this.scene.get('CageScene').events.emit('action:feed-sweet'),
      },
      {
        key: 'refill-water',
        menu: 'feed',
        group: 'feed-water',
        icon: '💧',
        label: 'WATER',
        color: 0x2e6f95,
        onPress: () => {
          const cageEvents = this.scene.get('CageScene').events;
          cageEvents.emit('action:refill-water');
          cageEvents.emit('action:refill_water');
        },
      },
      {
        key: 'clean',
        menu: 'care',
        group: 'care-hygiene',
        icon: '🧽',
        label: 'CLEAN',
        color: 0x365f82,
        onPress: () => this.scene.get('CageScene').events.emit('action:clean'),
      },
      {
        key: 'handle',
        menu: 'social',
        group: 'social-handle',
        icon: '🤝',
        label: 'HANDLE',
        color: 0x7a5738,
        onPress: () => this.scene.get('CageScene').events.emit('action:handle'),
      },
    ];

    for (const action of actions) {
      const button = this.createActionButton(action.icon, action.label, action.color, () => {
        if (action.key === 'feed-standard' && this.feedButtonDisabled) return;
        if (action.key === 'feed-sweet' && this.sweetButtonDisabled) return;
        this.sound.play('ui-click', { volume: 0.25 });
        action.onPress();
      });
      button.setData('menu', action.menu);
      button.setData('group', action.group);
      this.subActionButtons.set(action.key, button);
      this.subMenuBar?.add(button);
    }

    this.setActionButtonDisabled(this.subActionButtons.get('feed-standard'), false, 0x306a43);
    this.setActionButtonDisabled(this.subActionButtons.get('feed-sweet'), false, 0x6e3e8c);
    this.activeMenu = null;
    this.activeActionGroup = null;
    for (const button of this.subActionButtons.values()) {
      this.setButtonVisibility(button, false, false);
    }
    this.refreshActionHierarchy();
    this.layoutResponsiveUi(this.scale.width, this.scale.height);
  }


  private toggleActionSubmenu(menu: TopMenuKey): void {
    this.activeMenu = this.activeMenu === menu ? null : menu;
    this.activeActionGroup = null;

    for (const [key, button] of this.topMenuButtons.entries()) {
      const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
      background?.setStrokeStyle(2, key === this.activeMenu ? 0xfff7ba : 0xeeeeee, key === this.activeMenu ? 1 : 0.9);
    }

    this.refreshActionHierarchy();
  }

  private toggleActionGroup(groupKey: string): void {
    this.activeActionGroup = this.activeActionGroup === groupKey ? null : groupKey;
    this.refreshActionHierarchy();
  }

  private refreshActionHierarchy(): void {
    for (const [groupKey, button] of this.actionGroupButtons.entries()) {
      const isVisible = button.getData('menu') === this.activeMenu && !this.activeActionGroup;
      this.setButtonVisibility(button, isVisible, true);
      const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
      background?.setStrokeStyle(2, groupKey === this.activeActionGroup ? 0xfff7ba : 0xeeeeee, groupKey === this.activeActionGroup ? 1 : 0.9);
    }

    if (this.backButton) {
      const isBackVisible = this.activeMenu !== null && this.activeActionGroup !== null;
      this.setButtonVisibility(this.backButton, isBackVisible, true);
    }

    for (const button of this.subActionButtons.values()) {
      const isVisible = button.getData('menu') === this.activeMenu && button.getData('group') === this.activeActionGroup;
      this.setButtonVisibility(button, isVisible, false);
      if (isVisible) {
        this.applyActionDisabledState(button);
      }
    }

    this.layoutResponsiveUi(this.scale.width, this.scale.height);
  }

  private setButtonVisibility(button: Phaser.GameObjects.Container, isVisible: boolean, isGroupButton: boolean): void {
    button.setVisible(isVisible);
    button.setActive(isVisible);
    const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
    if (!background) return;

    background.disableInteractive();
    if (isVisible && isGroupButton) {
      background.setInteractive({ useHandCursor: true });
      button.setAlpha(0.94);
      return;
    }

    if (!isVisible) {
      button.setAlpha(0.94);
      return;
    }

    this.applyActionDisabledState(button);
  }

  private applyActionDisabledState(button: Phaser.GameObjects.Container): void {
    const key = this.getActionKey(button);
    const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
    if (!background) return;

    const isDisabled = (key === 'feed-standard' && this.feedButtonDisabled) || (key === 'feed-sweet' && this.sweetButtonDisabled);
    if (isDisabled) {
      background.disableInteractive();
      button.setAlpha(0.75);
      return;
    }

    background.setInteractive({ useHandCursor: true });
    button.setAlpha(0.94);
  }

  private getActionKey(button: Phaser.GameObjects.Container): string | undefined {
    for (const [key, candidate] of this.subActionButtons.entries()) {
      if (candidate === button) return key;
    }

    return undefined;
  }

  private setActionButtonDisabled(button: Phaser.GameObjects.Container | undefined, isDisabled: boolean, enabledColor: number): void {
    if (!button) return;
    const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
    const labels = button.list.filter((entry): entry is Phaser.GameObjects.Text => entry instanceof Phaser.GameObjects.Text);
    if (!background) return;

    background.setFillStyle(isDisabled ? 0x3a3a3a : enabledColor, isDisabled ? 0.65 : 0.92);
    labels.forEach((label) => label.setAlpha(isDisabled ? 0.45 : 1));

    if (button === this.subActionButtons.get('feed-standard')) this.feedButtonDisabled = isDisabled;
    if (button === this.subActionButtons.get('feed-sweet')) this.sweetButtonDisabled = isDisabled;

    if (button.visible) {
      this.applyActionDisabledState(button);
    }
  }

  private createActionButton(icon: string, label: string, color: number, onPress: () => void): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, 136, 44, color, 0.92);
    background.setStrokeStyle(2, 0xeeeeee, 0.9);
    background.setInteractive({ useHandCursor: true });

    const iconText = this.add.text(-44, 0, icon, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    });
    iconText.setOrigin(0.5);

    const text = this.add.text(12, 0, label, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const button = this.add.container(0, 0, [background, iconText, text]);
    button.setSize(136, 44);

    background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onPress();
      background.setFillStyle(0x1f1f1f, 0.96);
    });

    background.on('pointerup', () => {
      background.setFillStyle(color, 0.92);
    });

    background.on('pointerout', () => {
      background.setFillStyle(color, 0.92);
    });

    return button;
  }

  private createModalButton(label: string, color: number, onPress: () => void): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, 420, 34, color, 0.95);
    background.setStrokeStyle(1, 0xe6f0ff, 0.75);
    background.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const button = this.add.container(0, 0, [background, text]);
    button.setSize(420, 34);

    background.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onPress();
      background.setFillStyle(0x1f1f1f, 0.96);
    });

    background.on('pointerup', () => {
      background.setFillStyle(color, 0.95);
    });

    background.on('pointerout', () => {
      background.setFillStyle(color, 0.95);
    });

    return button;
  }

  private resizeModalButton(button: Phaser.GameObjects.Container, width: number, fontSize: string): void {
    const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
    const label = button.list[1] as Phaser.GameObjects.Text | undefined;
    this.resizeInteractiveBackground(background, width, 34);
    label?.setFontSize(fontSize);
    button.setSize(width, 34);
  }

  private resizeInteractiveBackground(background: Phaser.GameObjects.Rectangle | undefined, width: number, height: number): void {
    if (!background) return;

    background.setSize(width, height);
    const hitArea = background.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    hitArea?.setTo(-width / 2, -height / 2, width, height);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutResponsiveUi(gameSize.width, gameSize.height);
  }

  private layoutResponsiveUi(width: number, height: number): void {
    const isNarrow = width < 900;
    const sidePadding = isNarrow ? 12 : 14;
    const topPadding = 10;
    const gap = isNarrow ? 10 : 12;
    const bottomPadding = isNarrow ? 10 : 12;
    const interRowGap = isNarrow ? 10 : 12;

    const topButtons = Array.from(this.topMenuButtons.values());
    const visibleTopButtons = topButtons.filter((button) => button.visible);
    const hasTopButtons = visibleTopButtons.length > 0;
    const columns = Math.max(1, topButtons.length);
    const availableWidth = width - sidePadding * 2 - gap * (columns - 1);
    const topButtonWidth = Math.max(isNarrow ? 110 : 120, Math.floor(availableWidth / columns));
    const topRowHeight = hasTopButtons ? (isNarrow ? 50 : 44) : 0;

    const visibleSubButtons = Array.from(this.subMenuBar?.list ?? []).filter(
      (entry): entry is Phaser.GameObjects.Container => entry instanceof Phaser.GameObjects.Container && entry.visible,
    );
    const subColumns = Math.max(1, Math.min(isNarrow ? 2 : 3, visibleSubButtons.length || 1));
    const subAvailableWidth = width - sidePadding * 2 - gap * (subColumns - 1);
    const subButtonWidth = Math.max(130, Math.floor(subAvailableWidth / subColumns));
    const subRows = visibleSubButtons.length > 0 ? Math.ceil(visibleSubButtons.length / subColumns) : 0;
    const subRowGap = 8;
    const subButtonHeight = 38;
    const subRowsHeight = subRows > 0 ? subRows * subButtonHeight + (subRows - 1) * subRowGap : 0;
    const stackGap = hasTopButtons && subRows > 0 ? interRowGap : 0;
    const controlsAreaHeight = bottomPadding + topRowHeight + stackGap + subRowsHeight;
    const stackBottom = height - bottomPadding;

    if (hasTopButtons) {
      const topRowCenterY = stackBottom - topRowHeight / 2;
      visibleTopButtons.forEach((button, index) => {
        const x = sidePadding + index * (topButtonWidth + gap) + topButtonWidth / 2;
        const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
        this.resizeInteractiveBackground(background, topButtonWidth, topRowHeight);
        button.setSize(topButtonWidth, topRowHeight);
        button.setPosition(x, topRowCenterY);
      });
    }

    const subBottom = stackBottom - topRowHeight - stackGap;
    const subTop = subBottom - subRowsHeight;

    visibleSubButtons.forEach((button, index) => {
      const column = index % subColumns;
      const row = Math.floor(index / subColumns);
      const x = sidePadding + column * (subButtonWidth + gap) + subButtonWidth / 2;
      const y = subTop + row * (subButtonHeight + subRowGap) + subButtonHeight / 2;
      const background = button.list[0] as Phaser.GameObjects.Rectangle | undefined;
      const label = button.list[2] as Phaser.GameObjects.Text | undefined;
      this.resizeInteractiveBackground(background, subButtonWidth, subButtonHeight);
      label?.setFontSize(isNarrow ? '12px' : '13px');
      button.setSize(subButtonWidth, subButtonHeight);
      button.setPosition(x, y);
    });

    this.controlsAreaHeight = controlsAreaHeight;
    const hudHeight = isNarrow ? 68 : 52;
    this.safeAreaInsets = {
      topInset: topPadding + hudHeight,
      bottomInset: controlsAreaHeight,
    };
    this.game.events.emit(UI_SAFE_AREA_EVENT, this.safeAreaInsets);

    if (this.hudBackground) {
      this.hudBackground.setPosition(width / 2, topPadding + hudHeight / 2);
      this.hudBackground.setSize(width, hudHeight);
    }

    if (this.hudText) {
      this.hudText.setPosition(12, topPadding);
      this.hudText.setStyle({ wordWrap: { width: Math.max(200, width - 130) }, fontSize: isNarrow ? '13px' : '14px' });
    }

    if (this.debugHintText) {
      this.debugHintText.setPosition(width - 12, topPadding);
      this.debugHintText.setFontSize(isNarrow ? '11px' : '12px');
    }

    if (this.debugStatusText) {
      this.debugStatusText.setPosition(12, isNarrow ? 48 : 30);
      this.debugStatusText.setFontSize(isNarrow ? '11px' : '12px');
    }

    if (this.debugPanel && this.debugBackground && this.debugTitle && this.debugText) {
      const hudBottom = topPadding + (isNarrow ? 68 : 52) + 8;
      const debugWidth = Math.max(250, width - 24);
      const debugMaxHeight = Math.max(120, height - this.controlsAreaHeight - hudBottom - 8);
      const debugHeight = Math.min(isNarrow ? 200 : 240, debugMaxHeight);
      this.debugPanel.setPosition(12, hudBottom);
      this.debugBackground.setSize(debugWidth, debugHeight);
      this.debugTitle.setPosition(12, 10);
      this.debugText.setPosition(12, 34);
      this.debugText.setWordWrapWidth(debugWidth - 24);
      this.debugVisibleLines = Math.max(3, Math.floor((debugHeight - 48) / 20));
    }

    const dialogWidth = Math.min(560, width - (isNarrow ? 20 : 28));
    const dialogHeight = Math.max(220, Math.min(330, height - this.controlsAreaHeight - (isNarrow ? 24 : 40)));
    const panelCenterY = height / 2 - (isNarrow ? 12 : 0);
    const panelTop = panelCenterY - dialogHeight / 2;
    const panelLeft = width / 2 - dialogWidth / 2;

    this.dialogBackdrop?.setPosition(width / 2, height / 2).setSize(width, height);
    this.dialogPanel?.setPosition(width / 2, panelCenterY).setSize(dialogWidth, dialogHeight);

    const titleX = panelLeft + 20;
    this.dialogTitleText?.setPosition(titleX, panelTop + 18);
    this.dialogSpeakerText?.setPosition(titleX, panelTop + 44);
    this.dialogPageText?.setPosition(titleX, panelTop + 78).setWordWrapWidth(dialogWidth - 40);
    this.dialogPageIndicatorText?.setPosition(titleX, panelTop + dialogHeight - 68);

    const modalButtonWidth = Math.max(180, dialogWidth - 40);
    const modalButtonFont = isNarrow ? '12px' : '13px';

    if (this.dialogAdvanceButton) {
      this.resizeModalButton(this.dialogAdvanceButton, modalButtonWidth, modalButtonFont);
      this.dialogAdvanceButton.setPosition(width / 2, panelTop + dialogHeight - 22);
    }

    this.dialogOptionButtons.forEach((button, index) => {
      this.resizeModalButton(button, modalButtonWidth, modalButtonFont);
      const optionsStartY = panelTop + dialogHeight - 62 - this.dialogOptionButtons.length * 40;
      button.setPosition(width / 2, optionsStartY + index * 40);
    });
  }
}
