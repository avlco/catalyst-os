import { useState, useEffect, useCallback, useRef } from 'react';
import { Scissors, Lightbulb, Palette, Globe, Loader2 } from 'lucide-react';
import { backendFunctions } from '@/api/backendFunctions';
import { useTranslation } from '@/i18n';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { toast } from 'sonner';

const ACTIONS = [
  {
    key: 'shorten',
    icon: Scissors,
    instruction: 'Make this shorter and more concise',
  },
  {
    key: 'addExample',
    icon: Lightbulb,
    instruction: 'Add a professional example to illustrate this point',
  },
  {
    key: 'changeTone',
    icon: Palette,
    instruction: 'Make this more conversational and personal',
  },
  {
    key: 'translate',
    icon: Globe,
    getInstruction: (language) =>
      language === 'en' ? 'Translate to Hebrew' : 'Translate to English',
  },
];

export default function InlineEditMenu({ cardId, fullText, language, containerRef }) {
  const { t } = useTranslation();
  const { updateCard, setCardGenerating } = useContentWorkspaceStore();

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [loadingAction, setLoadingAction] = useState(null);
  const menuRef = useRef(null);

  const hideMenu = useCallback(() => {
    setVisible(false);
    setSelectedText('');
    setLoadingAction(null);
  }, []);

  // Listen for mouseup on the container to detect text selection
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleMouseUp = () => {
      // Small delay to let the selection finalize
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (!text) {
          // Don't hide if an action is in progress
          if (!loadingAction) {
            hideMenu();
          }
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          setSelectedText(text);
          setPosition({
            top: rect.top - 48,
            left: rect.left + rect.width / 2,
          });
          setVisible(true);
        } catch {
          // Selection may be invalid
        }
      });
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef, loadingAction, hideMenu]);

  // Hide on outside click
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e) => {
      if (loadingAction) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        hideMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, loadingAction, hideMenu]);

  const handleAction = async (action) => {
    if (loadingAction) return;

    const instruction = action.getInstruction
      ? action.getInstruction(language)
      : action.instruction;

    setLoadingAction(action.key);
    setCardGenerating(cardId, true);

    try {
      const result = await backendFunctions.inlineEditContent({
        selectedText,
        instruction,
        fullText,
        language,
      });

      const newBody = fullText.replace(selectedText, result.updatedText);
      updateCard(cardId, { localBody: newBody });
      hideMenu();
    } catch (error) {
      toast.error(error?.message || 'Inline edit failed');
    } finally {
      setCardGenerating(cardId, false);
      setLoadingAction(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isLoading = loadingAction === action.key;
        const isDisabled = loadingAction && !isLoading;

        return (
          <button
            key={action.key}
            onClick={() => handleAction(action)}
            disabled={isDisabled}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            <span>{t(`content.inlineEdit.${action.key}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
