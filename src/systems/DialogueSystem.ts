import dialogs from '../data/dialogs.json';

export interface DialogOption {
  id: string;
  label: string;
}

export interface DialogEntry {
  id: string;
  title: string;
  speaker: string;
  pages: string[];
  options: DialogOption[];
}

export class DialogueSystem {
  private readonly dialogMap = new Map<string, DialogEntry>((dialogs as DialogEntry[]).map((dialog) => [dialog.id, dialog]));

  getById(id: string): DialogEntry | null {
    return this.dialogMap.get(id) ?? null;
  }
}
