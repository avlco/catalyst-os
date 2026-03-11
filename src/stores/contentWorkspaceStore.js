import { create } from 'zustand';

export const useContentWorkspaceStore = create((set, get) => ({
  // ===== PLANNER STATE =====
  // Which overlay is active (null = showing PlannerView)
  activeOverlay: null, // 'socialDesk' | 'zenEditor' | 'newsletterAssembler' | null
  overlayPayload: null, // { contentItem, rawInput, targetDate, ... }

  openOverlay: (type, payload = {}) => set({ activeOverlay: type, overlayPayload: payload }),
  closeOverlay: () => set({
    activeOverlay: null,
    overlayPayload: null,
    // Also reset social desk state
    activeRawInput: null,
    draftCards: [],
    campaign: '',
    isGenerating: false,
    editingCardId: null,
  }),

  // ===== SOCIAL DESK STATE (used inside SocialDeskDrawer) =====
  activeRawInput: null,
  draftCards: [],
  campaign: '',
  isGenerating: false,
  editingCardId: null,

  setRawInput: (rawInput) => set({
    activeRawInput: rawInput,
    draftCards: [],
    campaign: rawInput?.campaign || '',
  }),

  setCampaign: (campaign) => set({ campaign }),

  setDraftCards: (cards) => set({
    draftCards: cards.map(c => ({
      ...c,
      localTitle: c.title,
      localBody: c.body,
      isDirty: false,
      isGenerating: false,
    })),
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

  // ===== NEWSLETTER ASSEMBLER STATE =====
  newsletterBlocks: [],      // Current blocks in the newsletter
  newsletterLang: 'en',      // Which language tab is active

  setNewsletterBlocks: (blocks) => set({ newsletterBlocks: blocks }),
  setNewsletterLang: (lang) => set({ newsletterLang: lang }),

  addNewsletterBlock: (block, index) => set((state) => {
    const blocks = [...state.newsletterBlocks];
    if (index !== undefined) {
      blocks.splice(index, 0, block);
    } else {
      blocks.push(block);
    }
    return { newsletterBlocks: blocks };
  }),

  removeNewsletterBlock: (blockId) => set((state) => ({
    newsletterBlocks: state.newsletterBlocks.filter(b => b.id !== blockId),
  })),

  updateNewsletterBlock: (blockId, changes) => set((state) => ({
    newsletterBlocks: state.newsletterBlocks.map(b =>
      b.id === blockId ? { ...b, ...changes } : b
    ),
  })),

  reorderNewsletterBlocks: (fromIndex, toIndex) => set((state) => {
    const blocks = [...state.newsletterBlocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    return { newsletterBlocks: blocks };
  }),
}));
