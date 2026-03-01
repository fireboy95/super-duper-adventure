import { type PromptChoice, type PromptSceneNode, type PromptScript, type PromptSnapshot } from './types';

type PromptSceneLookup = Map<string, PromptSceneNode>;

export class PromptEngine {
  private readonly scenesById: PromptSceneLookup;
  private readonly dialogueLog: string[] = [];
  private readonly notebookEntries: string[] = [];
  private readonly unlockedKeywordIds = new Set<string>();

  private currentSceneId: string;
  private currentPageIndex = 0;
  private sceneEnteredAtMs = 0;

  constructor(private readonly script: PromptScript) {
    this.scenesById = new Map(script.scenes.map((scene) => [scene.id, scene]));
    if (!this.scenesById.has(script.startSceneId)) {
      throw new Error(`Prompt script references missing start scene: ${script.startSceneId}`);
    }

    this.currentSceneId = script.startSceneId;
  }

  begin(nowMs: number): void {
    this.enterScene(this.currentSceneId, nowMs);
  }

  advance(nowMs: number): void {
    const scene = this.getCurrentScene();
    if (this.currentPageIndex < scene.pages.length - 1) {
      this.currentPageIndex += 1;
      this.capturePageToLog();
      return;
    }

    if ((scene.choices?.length ?? 0) > 0) {
      return;
    }

    if (scene.autoAdvanceToSceneId) {
      this.enterScene(scene.autoAdvanceToSceneId, nowMs);
    }
  }

  inspectKeyword(keywordId: string): void {
    if (this.unlockedKeywordIds.has(keywordId)) {
      return;
    }

    const page = this.getCurrentScene().pages[this.currentPageIndex];
    const keyword = page?.keywords?.find((candidate) => candidate.id === keywordId);
    if (!keyword) {
      return;
    }

    this.unlockedKeywordIds.add(keyword.id);
    this.notebookEntries.unshift(`Keyword: ${keyword.label} — ${keyword.note}`);

    keyword.unlocksSceneIds?.forEach((sceneId) => {
      this.notebookEntries.unshift(`Unlocked lead: ${sceneId}`);
    });
  }

  selectChoice(choiceId: string, nowMs: number): void {
    const choice = this.getVisibleChoices(nowMs).find((candidate) => candidate.id === choiceId);
    if (!choice) {
      return;
    }

    this.notebookEntries.unshift(`Choice selected: ${choice.text}`);
    this.enterScene(choice.nextSceneId, nowMs);
  }

  getSnapshot(nowMs: number): PromptSnapshot {
    const scene = this.getCurrentScene();
    const page = scene.pages[this.currentPageIndex];
    return {
      sceneId: scene.id,
      speaker: scene.speaker,
      portrait: scene.portrait,
      expression: scene.expression,
      pageText: page?.text ?? '',
      pageIndex: this.currentPageIndex,
      totalPages: scene.pages.length,
      canAdvance: this.currentPageIndex < scene.pages.length - 1,
      visibleChoices: this.getVisibleChoices(nowMs),
      dialogueLog: [...this.dialogueLog],
      notebookEntries: [...this.notebookEntries],
    };
  }

  getCurrentPageKeywords() {
    return this.getCurrentScene().pages[this.currentPageIndex]?.keywords ?? [];
  }

  private enterScene(sceneId: string, nowMs: number): void {
    if (!this.scenesById.has(sceneId)) {
      throw new Error(`Prompt scene missing: ${sceneId}`);
    }

    this.currentSceneId = sceneId;
    this.currentPageIndex = 0;
    this.sceneEnteredAtMs = nowMs;
    this.capturePageToLog();
  }

  private capturePageToLog(): void {
    const scene = this.getCurrentScene();
    const page = scene.pages[this.currentPageIndex];
    if (!page) {
      return;
    }

    const line = `${scene.speaker}: ${page.text}`;
    if (this.dialogueLog[0] === line) {
      return;
    }

    this.dialogueLog.unshift(line);
    if (this.dialogueLog.length > 30) {
      this.dialogueLog.length = 30;
    }
  }

  private getVisibleChoices(nowMs: number): PromptChoice[] {
    const scene = this.getCurrentScene();
    if (this.currentPageIndex < scene.pages.length - 1) {
      return [];
    }

    return (scene.choices ?? []).filter((choice) => {
      const revealAfterSatisfied = choice.revealAfterMs === undefined || nowMs - this.sceneEnteredAtMs >= choice.revealAfterMs;
      const requirementsSatisfied = (choice.requiresKeywordIds ?? []).every((id) => this.unlockedKeywordIds.has(id));
      return revealAfterSatisfied && requirementsSatisfied;
    });
  }

  private getCurrentScene(): PromptSceneNode {
    const scene = this.scenesById.get(this.currentSceneId);
    if (!scene) {
      throw new Error(`Active prompt scene not found: ${this.currentSceneId}`);
    }

    return scene;
  }
}
