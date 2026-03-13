import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidBlockComponent from './tiptap/MermaidBlock';
import InlineAIMenu from './tiptap/InlineAIMenu';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { backendFunctions } from '@/api/backendFunctions';
import { contentItemHooks } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Search,
  CheckCircle2,
  Trash2,
  Loader2,
  Upload,
  X,
} from 'lucide-react';

// --- Mermaid Node Extension ---
const MermaidExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { code: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockComponent);
  },
});

export default function ZenEditor({ payload, onClose }) {
  const { t, language } = useTranslation();

  // Determine mode
  const isEditMode = !!payload?.contentItem;
  const contentItem = payload?.contentItem;

  // Local state
  const [title, setTitle] = useState(contentItem?.title || '');
  const [showSeo, setShowSeo] = useState(false);
  const [seoTitle, setSeoTitle] = useState(contentItem?.seo_title || '');
  const [keywords, setKeywords] = useState(contentItem?.seo_keywords || '');
  const [description, setDescription] = useState(contentItem?.seo_description || '');
  const [category, setCategory] = useState(contentItem?.category || '');
  const [lang, setLang] = useState(contentItem?.language || language || 'en');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const hasRawInput = !!(payload?.rawInput?.id || payload?.rawInputId);
  const [generating, setGenerating] = useState(!isEditMode && hasRawInput);
  const [contentItemId, setContentItemId] = useState(contentItem?.id || null);

  const updateMutation = contentItemHooks.useUpdate();
  const createMutation = contentItemHooks.useCreate();
  const deleteMutation = contentItemHooks.useDelete();

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      CharacterCount,
      MermaidExtension,
      Markdown,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] px-1 py-2',
      },
    },
  });

  // Load content into editor, converting mermaid code blocks to MermaidBlock nodes
  const loadContent = useCallback(
    (markdown) => {
      if (!editor) return;
      editor.commands.setContent(markdown);

      // Post-process: convert mermaid code blocks to MermaidBlock nodes
      const { doc } = editor.state;
      const tr = editor.state.tr;
      let offset = 0;
      doc.descendants((node, pos) => {
        if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
          const mermaidNode = editor.schema.nodes.mermaidBlock.create({
            code: node.textContent,
          });
          tr.replaceWith(pos + offset, pos + offset + node.nodeSize, mermaidNode);
          offset += mermaidNode.nodeSize - node.nodeSize;
        }
      });
      if (tr.docChanged) editor.view.dispatch(tr);
    },
    [editor],
  );

  // Edit mode: load existing content
  useEffect(() => {
    if (isEditMode && editor && contentItem?.body) {
      loadContent(contentItem.body);
    }
  }, [isEditMode, editor, contentItem?.body, loadContent]);

  // Create mode: expand raw input to blog post
  useEffect(() => {
    if (isEditMode || !editor || !hasRawInput) return;

    let cancelled = false;
    const expand = async () => {
      setGenerating(true);
      try {
        const result = await backendFunctions.expandToBlogPost({
          rawInputId: payload?.rawInput?.id || payload?.rawInputId,
          language: lang,
        });
        if (cancelled) return;

        const newTitle = result?.title || '';
        const newBody = result?.body || '';
        setTitle(newTitle);
        loadContent(newBody);
      } catch (err) {
        if (!cancelled) {
          toast.error(t('content.blog.expandFailed'));
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    expand();
    return () => { cancelled = true; };
  }, [isEditMode, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track dirty state
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setIsDirty(true);
    editor.on('update', handler);
    return () => editor.off('update', handler);
  }, [editor]);

  // Safe close with unsaved changes guard
  const safeClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm(t('common.unsavedChanges') || 'You have unsaved changes. Close anyway?')) return;
    }
    onClose();
  }, [isDirty, onClose, t]);

  // Escape key to close (with guard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !generating) {
        safeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeClose, generating]);

  // Get markdown from editor, preserving mermaid blocks
  const getMarkdown = useCallback(() => {
    if (!editor) return '';
    let md = editor.storage.markdown.getMarkdown();

    // tiptap-markdown doesn't know about our custom mermaidBlock node.
    // Walk the doc and inject ```mermaid blocks at the right positions.
    const mermaidBlocks = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mermaidBlock' && node.attrs.code) {
        mermaidBlocks.push(node.attrs.code);
      }
    });

    // If the markdown lost mermaid blocks, append them at the end
    if (mermaidBlocks.length > 0 && !md.includes('```mermaid')) {
      for (const code of mermaidBlocks) {
        md += `\n\n\`\`\`mermaid\n${code}\n\`\`\``;
      }
    }

    return md;
  }, [editor]);

  // Save draft
  const handleSaveDraft = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const body = getMarkdown();
      const data = {
        title: title || t('content.blog.untitled'),
        body,
        seo_title: seoTitle,
        seo_keywords: keywords,
        seo_description: description,
        category,
        language: lang,
        status: 'draft',
        ...(payload?.targetDate ? { scheduled_date: payload.targetDate } : {}),
      };

      if (contentItemId) {
        await updateMutation.mutateAsync({ id: contentItemId, data });
      } else {
        const created = await createMutation.mutateAsync({
          ...data,
          content_type: 'blog',
          platform: 'blog',
        });
        if (created?.id) setContentItemId(created.id);
      }
      setIsDirty(false);
      toast.success(t('content.zenEditor.saved'));
    } catch (err) {
      toast.error(t('content.blog.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Approve & Close
  const handleApproveClose = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const body = getMarkdown();
      const data = {
        title: title || t('content.blog.untitled'),
        body,
        seo_title: seoTitle,
        seo_keywords: keywords,
        seo_description: description,
        category,
        language: lang,
        status: 'approved',
        ...(payload?.targetDate ? { scheduled_date: payload.targetDate } : {}),
      };

      if (contentItemId) {
        await updateMutation.mutateAsync({ id: contentItemId, data });
      } else {
        await createMutation.mutateAsync({
          ...data,
          content_type: 'blog',
          platform: 'blog',
        });
      }
      toast.success(t('content.zenEditor.saved'));
      onClose();
    } catch (err) {
      toast.error(t('content.blog.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Delete draft
  const handleDeleteDraft = async () => {
    if (!contentItemId) {
      onClose();
      return;
    }
    try {
      await deleteMutation.mutateAsync(contentItemId);
      onClose();
    } catch (err) {
      toast.error(t('content.blog.saveFailed'));
    }
  };

  // Publish to website
  const handlePublish = async () => {
    if (!contentItemId) {
      toast.error(t('content.zenEditor.saveFirst'));
      return;
    }
    setPublishing(true);
    try {
      await backendFunctions.publishBlogToWebsite({ content_item_id: contentItemId });
      toast.success(t('content.zenEditor.published'));
    } catch (err) {
      toast.error(err?.message || t('content.zenEditor.publishFailed'));
    } finally {
      setPublishing(false);
    }
  };

  // Word count
  const wordCount = editor?.storage.characterCount.words() ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={safeClose}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t('content.zenEditor.backToPlanner')}</span>
        </Button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('content.blog.untitled')}
          className="flex-1 border-none bg-transparent text-lg font-semibold focus-visible:ring-0 px-2"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSeo(!showSeo)}
          className={cn('gap-1.5', showSeo && 'bg-accent')}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{t('content.zenEditor.seoPanel')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveDraft}
          disabled={saving || generating}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{t('content.zenEditor.saveDraft')}</span>
        </Button>
      </header>

      {/* Body area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Editor area */}
        <main
          className={cn(
            'flex-1 overflow-y-auto transition-all duration-200',
            showSeo ? 'me-80' : '',
          )}
        >
          {generating ? (
            <div className="max-w-3xl mx-auto px-6 py-12">
              <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-8">
              <EditorContent editor={editor} />
              {editor && <InlineAIMenu editor={editor} language={lang} />}
            </div>
          )}
        </main>

        {/* SEO Side Panel */}
        <aside
          className={cn(
            'absolute top-0 end-0 bottom-0 w-80 bg-card border-s border-border overflow-y-auto transition-transform duration-200 p-5 space-y-5',
            showSeo ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{t('content.zenEditor.seoPanel')}</h3>
            <button onClick={() => setShowSeo(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('content.blog.seoTitle')}
              </label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={t('content.blog.seoTitlePlaceholder')}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('content.blog.seoKeywords')}
              </label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={t('content.blog.seoKeywordsPlaceholder')}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('content.blog.seoDescription')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('content.blog.seoDescPlaceholder')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('content.blog.category')}
              </label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t('content.blog.categoryPlaceholder')}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('content.blog.language')}
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="he">Hebrew</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !contentItemId}
              className="w-full gap-1.5 mt-2"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('content.zenEditor.publishToWebsite')}
            </Button>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            {t('content.zenEditor.wordCount')}: {wordCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteDraft}
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('content.zenEditor.deleteDraft')}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleApproveClose}
            disabled={saving || generating}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t('content.zenEditor.approveClose')}
          </Button>
        </div>
      </footer>
    </div>
  );
}
