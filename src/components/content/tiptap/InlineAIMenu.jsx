import { useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Scissors, Lightbulb, Palette, Globe, Loader2 } from 'lucide-react';
import { backendFunctions } from '@/api/backendFunctions';
import { useTranslation } from '@/i18n';
import { toast } from 'sonner';

const ACTIONS = [
  { key: 'shorten', icon: Scissors, instruction: 'Make this shorter and more concise' },
  { key: 'addExample', icon: Lightbulb, instruction: 'Add a professional example to illustrate this point' },
  { key: 'changeTone', icon: Palette, instruction: 'Make this more conversational and personal' },
  {
    key: 'translate',
    icon: Globe,
    getInstruction: (lang) => lang === 'en' ? 'Translate to Hebrew' : 'Translate to English',
  },
];

export default function InlineAIMenu({ editor, language }) {
  const { t } = useTranslation();
  const [loadingAction, setLoadingAction] = useState(null);

  if (!editor) return null;

  const handleAction = async (action) => {
    if (loadingAction) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText?.trim()) return;

    const fullText = editor.getText();
    const instruction = action.getInstruction
      ? action.getInstruction(language)
      : action.instruction;

    setLoadingAction(action.key);

    try {
      const result = await backendFunctions.inlineEditContent({
        selectedText,
        instruction,
        fullText: fullText.slice(0, 4000),
        language,
      });

      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, result.updatedText || result.data?.updatedText || '')
        .run();
    } catch (err) {
      toast.error(err?.message || 'Inline edit failed');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150, placement: 'top' }}
      shouldShow={({ editor: e }) => {
        const { from, to } = e.state.selection;
        return to - from > 3;
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg">
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
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              <span>{t(`content.inlineEdit.${action.key}`)}</span>
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}
