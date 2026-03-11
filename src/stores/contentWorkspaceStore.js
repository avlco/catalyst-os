import { create } from 'zustand';

export const useContentWorkspaceStore = create((set, get) => ({
  // Active raw input being worked on
  activeRawInput: null,

  // Draft cards — local state, not persisted until approve
  // Each card: { id, platform, language, tone, localTitle, localBody, isDirty, isGenerating }
  draftCards: [],

  // Campaign name for this workspace session
  campaign: '',

  // Loading states
  isGenerating: false,
  editingCardId: null,

  // Actions
  setRawInput: (rawInput) => set({
    activeRawInput: rawInput,
    draftCards: [],
    campaign: rawInput?.campaign || '',
  }),

  setCampaign: (campaign) => set({ campaign }),

  setDraftCards: (cards) => set({
    draftCards: cards.map(c => ({ ...c, localTitle: c.title, localBody: c.body, isDirty: false, isGenerating: false })),
    isGenerating: false,
  }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  updateCard: (id, changes) => set((state) => ({
    draftCards: state.draftCards.map(card =>
      card.id === id ? { ...card, ...changes, isDirty: true } : card
    ),
  })),

  setCardGenerating: (id, isGenerating) => set((state) => ({
    draftCards: state.draftCards.map(card =>
      card.id === id ? { ...card, isGenerating } : card
    ),
  })),

  setEditingCard: (id) => set({ editingCardId: id }),

  discardAll: () => set({
    activeRawInput: null,
    draftCards: [],
    campaign: '',
    isGenerating: false,
    editingCardId: null,
  }),

  getDirtyCards: () => get().draftCards.filter(c => c.isDirty),
}));
