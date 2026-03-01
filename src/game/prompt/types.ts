export type PromptTone = 'kind' | 'cautious' | 'practical' | 'avoidant' | 'ominous' | 'neutral';

export type PromptChoiceStyle = 'literal' | 'tonal' | 'administrative';

export type PromptKeyword = {
  id: string;
  label: string;
  note: string;
  unlocksSceneIds?: string[];
};

export type PromptChoice = {
  id: string;
  text: string;
  tone?: PromptTone;
  style?: PromptChoiceStyle;
  nextSceneId: string;
  revealAfterMs?: number;
  requiresKeywordIds?: string[];
  holdToConfirmMs?: number;
};

export type PromptPage = {
  id: string;
  text: string;
  keywords?: PromptKeyword[];
};

export type PromptSceneNode = {
  id: string;
  speaker: string;
  portrait: string;
  expression: string;
  pages: PromptPage[];
  choices?: PromptChoice[];
  autoAdvanceToSceneId?: string;
};

export type PromptScript = {
  startSceneId: string;
  scenes: PromptSceneNode[];
};

export type PromptSnapshot = {
  sceneId: string;
  speaker: string;
  portrait: string;
  expression: string;
  pageText: string;
  pageIndex: number;
  totalPages: number;
  canAdvance: boolean;
  visibleChoices: PromptChoice[];
  dialogueLog: string[];
  notebookEntries: string[];
};
