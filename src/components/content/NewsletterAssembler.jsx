import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { newsletterHooks, contentItemHooks, subscriberHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import {
  ArrowLeft,
  GripVertical,
  X,
  Send,
  Eye,
  Loader2,
  Mail,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const BLOCK_TYPE_COLORS = {
  opening: 'bg-amber-500/20 text-amber-400',
  blog_teaser: 'bg-emerald-500/20 text-emerald-400',
  insight: 'bg-blue-500/20 text-blue-400',
  question: 'bg-purple-500/20 text-purple-400',
  cta: 'bg-rose-500/20 text-rose-400',
  custom: 'bg-slate-500/20 text-slate-400',
};

// --- Draggable cart item ---
function CartItem({ item }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cart-${item.id}`,
    data: { cartItem: item },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
    >
      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-body-m font-medium line-clamp-1">{item.title || item.body?.slice(0, 60)}</p>
        <p className="text-caption text-muted-foreground line-clamp-1">{item.body?.slice(0, 80)}</p>
        <Badge variant="neutral" className="mt-1 text-[10px]">
          {t('content.platformLabels.' + item.platform) || item.platform}
        </Badge>
      </div>
    </div>
  );
}

// --- Sortable newsletter block ---
function SortableBlock({ block, onUpdate, onRemove }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { block },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeColor = BLOCK_TYPE_COLORS[block.type] || BLOCK_TYPE_COLORS.custom;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Block header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <Badge className={cn('text-[10px]', typeColor)}>
          {t(`content.assembler.blockTypes.${block.type}`) || block.type}
        </Badge>
        <div className="flex-1" />
        <button
          onClick={() => onRemove(block.id)}
          className="text-muted-foreground hover:text-danger transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Block content */}
      <div className="px-3 py-2 space-y-1.5">
        <input
          type="text"
          value={block.title || ''}
          onChange={(e) => onUpdate(block.id, { title: e.target.value })}
          className="w-full text-body-m font-semibold bg-transparent border-none focus:outline-none"
          placeholder="Block title..."
        />
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate(block.id, { body: e.currentTarget.innerHTML })}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.body || '') }}
          className="min-h-[60px] text-body-m text-foreground focus:outline-none prose prose-sm max-w-none"
        />
      </div>
    </div>
  );
}

// --- Drop zone for cart items ---
function BlocksDropZone({ children }) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({ id: 'blocks-drop-zone' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[200px] rounded-lg border-2 border-dashed border-border p-3 space-y-3 transition-colors',
        isOver && 'border-primary bg-primary/5',
      )}
    >
      {children}
      {isOver && (
        <div className="flex items-center justify-center py-4 text-caption text-primary font-medium">
          {t('content.assembler.dropHere')}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export default function NewsletterAssembler({ payload, onClose }) {
  const { t, language: uiLang } = useTranslation();

  const {
    newsletterBlocks,
    newsletterLang,
    setNewsletterBlocks,
    setNewsletterLang,
    addNewsletterBlock,
    removeNewsletterBlock,
    updateNewsletterBlock,
    reorderNewsletterBlocks,
  } = useContentWorkspaceStore();

  // Data hooks
  const { data: newsletters = [] } = newsletterHooks.useList();
  const updateNewsletter = newsletterHooks.useUpdate();
  const { data: contentItems = [] } = contentItemHooks.useList();
  const { data: subscribers = [] } = subscriberHooks.useList();
  const activeSubscriberCount = subscribers.filter(s => s.status === 'active').length;

  // Local state
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null); // content item id being generated
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [subject, setSubject] = useState('');
  const saveRef = useRef(null);

  // Find the newsletter to work with (most recent draft, or from payload)
  const newsletter = useMemo(() => {
    if (payload?.newsletter) return payload.newsletter;
    // Find most recent non-sent newsletter
    return [...newsletters]
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .find(n => n.status !== 'sent') || newsletters[0];
  }, [newsletters, payload]);

  // Cart items: approved/published content items not already in newsletter blocks
  const cartItems = useMemo(() => {
    const blockSourceIds = new Set(newsletterBlocks.map(b => b.source_content_id).filter(Boolean));
    return contentItems.filter(item =>
      ['approved', 'published'].includes(item.status) && !blockSourceIds.has(item.id)
    );
  }, [contentItems, newsletterBlocks]);

  // Load newsletter blocks on mount
  useEffect(() => {
    if (!newsletter) {
      setLoading(false);
      return;
    }

    const blocks = newsletterLang === 'he'
      ? (newsletter.blocks_he || [])
      : (newsletter.blocks_en || []);

    setNewsletterBlocks(blocks);
    setSubject(
      newsletterLang === 'he'
        ? (newsletter.subject_he || '')
        : (newsletter.subject_en || '')
    );
    setLoading(false);
  }, [newsletter?.id, newsletterLang]);

  // Switch language: save current blocks, load other language blocks
  const handleLangSwitch = (newLang) => {
    if (newLang === newsletterLang) return;
    // Save current blocks to newsletter before switching
    saveBlocks();
    setNewsletterLang(newLang);
  };

  // Debounced auto-save
  const saveBlocks = useCallback(() => {
    if (!newsletter) return;

    const blocksField = newsletterLang === 'he' ? 'blocks_he' : 'blocks_en';
    const subjectField = newsletterLang === 'he' ? 'subject_he' : 'subject_en';
    const bodyField = newsletterLang === 'he' ? 'body_he' : 'body_en';

    // Render blocks to flat HTML for backward compatibility
    const bodyHtml = newsletterBlocks
      .map(b => `<h3>${b.title || ''}</h3>${b.body || ''}`)
      .join('\n<hr/>\n');

    updateNewsletter.mutateAsync({
      id: newsletter.id,
      data: {
        [blocksField]: newsletterBlocks,
        [subjectField]: subject,
        [bodyField]: bodyHtml,
      },
    }).catch(() => {}); // Silent save
  }, [newsletter, newsletterBlocks, newsletterLang, subject, updateNewsletter]);

  // Debounced save on block changes
  useEffect(() => {
    if (loading || !newsletter) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(saveBlocks, 1500);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [newsletterBlocks, subject, loading]);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Handle DnD end
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!active || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Cart item dropped on blocks zone
    if (activeId.startsWith('cart-') && (overId === 'blocks-drop-zone' || !overId.startsWith('cart-'))) {
      const { cartItem } = active.data.current || {};
      if (!cartItem) return;

      setGenerating(cartItem.id);

      try {
        const result = await backendFunctions.generateNewsletterTeaser({
          content_item_id: cartItem.id,
          existing_blocks_summary: newsletterBlocks.map(b => b.title).filter(Boolean).join(', '),
          language: newsletterLang,
        });

        // Add blocks for both languages
        const enBlock = result.block_en || { id: `block-custom-${Date.now()}`, type: 'custom', title: cartItem.title, body: '', source_content_id: cartItem.id };
        const heBlock = result.block_he || { ...enBlock };

        // Add to current language view
        if (newsletterLang === 'en') {
          addNewsletterBlock(enBlock);
        } else {
          addNewsletterBlock(heBlock);
        }

        // Also save the other language block to the newsletter directly
        const otherField = newsletterLang === 'en' ? 'blocks_he' : 'blocks_en';
        const otherBlocks = newsletterLang === 'en'
          ? [...(newsletter.blocks_he || []), heBlock]
          : [...(newsletter.blocks_en || []), enBlock];

        await updateNewsletter.mutateAsync({
          id: newsletter.id,
          data: { [otherField]: otherBlocks },
        });

        toast.success(t('content.assembler.blockAdded') || 'Block added');
      } catch (err) {
        toast.error(err.message);
      } finally {
        setGenerating(null);
      }
      return;
    }

    // Reorder within blocks
    if (!activeId.startsWith('cart-') && !overId.startsWith('cart-')) {
      const blockIds = newsletterBlocks.map(b => b.id);
      const fromIndex = blockIds.indexOf(activeId);
      const toIndex = blockIds.indexOf(overId);
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        reorderNewsletterBlocks(fromIndex, toIndex);
      }
    }
  }, [newsletterBlocks, newsletterLang, newsletter, addNewsletterBlock, reorderNewsletterBlocks, updateNewsletter]);

  // Render blocks to HTML for preview/send
  const renderBlocksToHtml = (blocks) => {
    return blocks.map(b => `<h3>${b.title || ''}</h3>${b.body || ''}`).join('\n<hr/>\n');
  };

  // Send handlers
  const handleSendTest = async () => {
    const email = window.prompt(t('content.newsletter.sendTestTo'));
    if (!email?.trim()) return;
    setSendingTest(true);
    try {
      saveBlocks();
      const result = await backendFunctions.sendNewsletter({
        newsletterId: newsletter.id,
        testEmail: email.trim(),
      });
      if (result?.success && result?.sent > 0) {
        toast.success(t('content.newsletter.testSent'));
      } else {
        toast.error(result?.error || t('content.newsletter.testFailed'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      // Save final blocks + rendered HTML
      await updateNewsletter.mutateAsync({
        id: newsletter.id,
        data: {
          blocks_en: newsletterLang === 'en' ? newsletterBlocks : (newsletter.blocks_en || []),
          blocks_he: newsletterLang === 'he' ? newsletterBlocks : (newsletter.blocks_he || []),
          body_en: renderBlocksToHtml(newsletterLang === 'en' ? newsletterBlocks : (newsletter.blocks_en || [])),
          body_he: renderBlocksToHtml(newsletterLang === 'he' ? newsletterBlocks : (newsletter.blocks_he || [])),
          subject_en: newsletterLang === 'en' ? subject : (newsletter.subject_en || ''),
          subject_he: newsletterLang === 'he' ? subject : (newsletter.subject_he || ''),
        },
      });

      const result = await backendFunctions.sendNewsletter({ newsletterId: newsletter.id });
      if (result?.success) {
        toast.success(`${t('content.newsletter.sentSuccess')} (${result.sent})`);
        setSendConfirmOpen(false);
        onClose();
      } else {
        toast.error(result?.error || t('content.newsletter.sendFailed'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  // Escape to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !generating && !sending) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, generating, sending]);

  if (!newsletter && !loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-body-l text-muted-foreground">{t('content.newsletter.noNewsletters')}</p>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 me-1" />
            {t('content.zenEditor.backToPlanner')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { saveBlocks(); onClose(); }}>
            <ArrowLeft className="w-4 h-4 me-1" />
            {t('content.zenEditor.backToPlanner')}
          </Button>
          <h2 className="text-body-l font-semibold">{t('content.assembler.title')}</h2>
          {newsletter && (
            <Badge variant="neutral">#{newsletter.issue_number}</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => handleLangSwitch('en')}
              className={cn('px-3 py-1 text-caption', newsletterLang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
            >
              EN
            </button>
            <button
              onClick={() => handleLangSwitch('he')}
              className={cn('px-3 py-1 text-caption', newsletterLang === 'he' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
            >
              HE
            </button>
          </div>

          {/* Preview */}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="w-4 h-4 me-1" />
            {t('content.assembler.preview')}
          </Button>

          {/* Send Test */}
          <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest}>
            {sendingTest ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Send className="w-4 h-4 me-1" />}
            {t('content.newsletter.sendTest')}
          </Button>

          {/* Send Newsletter */}
          <Button size="sm" onClick={() => setSendConfirmOpen(true)}>
            <Send className="w-4 h-4 me-1" />
            {t('content.newsletter.sendNewsletter')}
          </Button>
        </div>
      </div>

      {/* Subject line */}
      <div className="border-b border-border px-6 py-2">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={`Subject (${newsletterLang.toUpperCase()})...`}
          className="text-body-l font-medium border-none shadow-none focus-visible:ring-0 px-0"
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {/* Content Cart (35%) */}
          <div className="w-[35%] border-e border-border p-4 overflow-y-auto">
            <h3 className="text-body-m font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('content.assembler.contentCart')}
              {cartItems.length > 0 && <Badge variant="neutral">{cartItems.length}</Badge>}
            </h3>

            {cartItems.length === 0 ? (
              <p className="text-caption text-muted-foreground">{t('content.assembler.cartEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map(item => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
            )}

            {generating && (
              <div className="mt-3 flex items-center gap-2 text-caption text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('content.assembler.generatingTeaser')}
              </div>
            )}

            <p className="mt-4 text-caption text-muted-foreground">
              {activeSubscriberCount} {t('content.newsletter.activeSubscribers')}
            </p>
          </div>

          {/* Newsletter Blocks (65%) */}
          <div className="w-[65%] p-4 overflow-y-auto">
            <h3 className="text-body-m font-semibold mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {t('content.assembler.blocks')}
              {newsletterBlocks.length > 0 && <Badge variant="neutral">{newsletterBlocks.length}</Badge>}
            </h3>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <BlocksDropZone>
                <SortableContext items={newsletterBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {newsletterBlocks.map(block => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      onUpdate={updateNewsletterBlock}
                      onRemove={removeNewsletterBlock}
                    />
                  ))}
                </SortableContext>

                {newsletterBlocks.length === 0 && !generating && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Mail className="w-8 h-8 mb-2" />
                    <p className="text-body-m">{t('content.assembler.dropHere')}</p>
                  </div>
                )}

                {generating && (
                  <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary me-2" />
                    <span className="text-caption text-primary">{t('content.assembler.generatingTeaser')}</span>
                  </div>
                )}
              </BlocksDropZone>
            )}
          </div>
        </DndContext>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('content.assembler.preview')} ({newsletterLang.toUpperCase()})</DialogTitle>
          </DialogHeader>
          <div className="border border-border rounded-lg p-6 bg-white text-black">
            <h2 className="text-xl font-bold mb-4">{subject}</h2>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(renderBlocksToHtml(newsletterBlocks)),
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('content.newsletter.confirmSend')}</DialogTitle>
          </DialogHeader>
          <p className="text-body-m py-4">
            {t('content.newsletter.confirmSendBody')} #{newsletter?.issue_number}?
          </p>
          <p className="text-caption text-muted-foreground">
            {activeSubscriberCount} {t('content.newsletter.activeSubscribers')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSend} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Send className="w-4 h-4 me-1" />}
              {sending ? t('content.newsletter.sending') : t('content.newsletter.confirmSendBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
