export const UI_SAFE_AREA_EVENT = 'ui:safe-area';
export const UI_ROTATE_HINT_EVENT = 'ui:rotate-hint';

export interface SafeAreaInsets {
  topInset: number;
  bottomInset: number;
}

export interface InitialViewportState {
  width: number;
  height: number;
  safeAreaInsets: SafeAreaInsets;
}

export const DEFAULT_SAFE_AREA_INSETS: SafeAreaInsets = {
  topInset: 62,
  bottomInset: 168,
};
