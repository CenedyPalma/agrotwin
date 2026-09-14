import { create } from "zustand";

/**
 * Client-only UI state. Server data lives in TanStack Query — never here.
 * `activeSurveyId` is the survey the global "Ask AI" button should be
 * grounded in: the one the user most recently looked at.
 */
interface UiState {
  activeFieldId: string | null;
  activeSurveyId: string | null;
  setActiveField: (id: string | null) => void;
  setActiveSurvey: (id: string | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeFieldId: null,
  activeSurveyId: null,
  setActiveField: (activeFieldId) => set({ activeFieldId }),
  setActiveSurvey: (activeSurveyId) => set({ activeSurveyId }),
}));
