import { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentItemHooks, rawInputHooks, newsletterHooks, subscriberHooks } from '@/api/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { PenSquare, Plus, Copy, Check, Sparkles, Send, RefreshCw, Edit, Save, FileText, AlertTriangle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

const platformKeys = ['linkedin_personal', 'linkedin_business', 'facebook_personal', 'facebook_business', 'blog', 'newsletter'];

const platformColors = {
  linkedin_personal: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  linkedin_business: { bg: 'bg-blue-600/20', text: 'text-blue-300', dot: 'bg-blue-600' },
  facebook_personal: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-500' },
  facebook_business: { bg: 'bg-indigo-600/20', text: 'text-indigo-300', dot: 'bg-indigo-600' },
  blog: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  newsletter: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
};

const statusVariant = {
  idea: 'neutral', draft: 'neutral', approved: 'success',
  scheduled: 'info', published: 'success', archived: 'neutral',
  sent: 'success', ready: 'info',
};

// --- Create Tab ---
function CreateTab() {
  const { t } = useTranslation();
  const createRawInput = rawInputHooks.useCreate();
  const { data: rawInputs = [] } = rawInputHooks.useList();
  const pending = rawInputs.filter(r => !r.processed);

  const [body, setBody] = useState('');
  const [platforms, setPlatforms] = useState(['linkedin_personal', 'facebook_business']);
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('en');

  const togglePlatform = (p) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const [generating, setGenerating] = useState(false);
  const [generatingRawId, setGeneratingRawId] = useState(null);

  const handleGenerate = async () => {
    if (!body.trim()) return;
    try {
      setGenerating(true);
      // 1. Save raw input
      const rawInput = await createRawInput.mutateAsync({
        input_type: 'text',
        body: body.trim().slice(0, 2000),
        processed: false,
        suggested_platforms: platforms,
      });

      // 2. Call backend function to generate content
      const result = await backendFunctions.generateContent({
        rawInputId: rawInput.id,
        platforms,
        tone,
        language,
      });

      if (result.created > 0) {
        toast.success(`${result.created} ${t('content.create.postsGenerated')}`);
      } else {
        toast.info(t('content.create.savedNoResults'));
      }
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} ${t('content.create.platformsFailed')}`);
      }
      setBody('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('content.create.whatHappened')}</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('content.create.describeContent')}
              className="min-h-[120px]"
              maxLength={2000}
            />
            <p className="text-caption text-muted-foreground mt-1">{body.length}/2000</p>
          </div>

          <div>
            <label className="text-body-m font-medium block mb-2">{t('content.create.platforms')}</label>
            <div className="flex flex-wrap gap-2">
              {platformKeys.filter(k => k !== 'newsletter').map(key => (
                <button
                  key={key}
                  onClick={() => togglePlatform(key)}
                  className={`px-3 py-1.5 rounded-md text-caption font-medium border transition-colors ${
                    platforms.includes(key)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t('content.platformLabels.' + key)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.create.tone')}</label>
              <Select value={tone} onChange={e => setTone(e.target.value)}>
                <option value="professional">{t('content.create.tones.professional')}</option>
                <option value="personal">{t('content.create.tones.personal')}</option>
                <option value="educational">{t('content.create.tones.educational')}</option>
                <option value="community">{t('content.create.tones.community')}</option>
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.create.language')}</label>
              <Select value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="en">{t('common.languages.english')}</option>
                <option value="he">{t('common.languages.hebrew')}</option>
                <option value="both">{t('common.languages.both')}</option>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!body.trim() || generating}>
            <Sparkles className="w-4 h-4 me-1" />
            {t('content.generatePosts')}
          </Button>
        </CardContent>
      </Card>

      {/* Pending raw inputs */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-body-l font-semibold mb-3">{t('content.create.pendingInputs')} ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map(input => (
              <Card key={input.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Badge variant="neutral">{input.input_type}</Badge>
                      <p className="text-body-m mt-1 line-clamp-2">{input.body}</p>
                    </div>
                    {input.ai_summary && (
                      <p className="text-caption text-muted-foreground">{input.ai_summary}</p>
                    )}
                  </div>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generatingRawId === input.id}
                      onClick={async () => {
                        try {
                          setGeneratingRawId(input.id);
                          await backendFunctions.generateContent({
                            rawInputId: input.id,
                            platforms: ['linkedin_personal', 'facebook_business'],
                            tone: 'professional',
                            language: 'both',
                          });
                          toast.success(t('content.create.contentGenerated'));
                        } catch (err) {
                          toast.error(t('content.create.generationFailed') + ': ' + err.message);
                        } finally {
                          setGeneratingRawId(null);
                        }
                      }}
                    >
                      <Sparkles className={`w-3 h-3 me-1 ${generatingRawId === input.id ? 'animate-spin' : ''}`} />
                      {generatingRawId === input.id ? t('content.create.generating') : t('content.create.generateContent')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Pipeline Tab ---
function PipelineTab() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = contentItemHooks.useList();
  const updateItem = contentItemHooks.useUpdate();
  const [regeneratingId, setRegeneratingId] = useState(null);

  if (isLoading) return <Skeleton className="h-64" />;

  const [mobileCol, setMobileCol] = useState('draft');

  const columnLabels = {
    draft: t('content.blog.statuses.draft'),
    approved: t('content.blog.statuses.approved'),
    published: t('content.blog.statuses.published'),
  };

  const columns = {
    draft: items.filter(i => i.status === 'draft' || i.status === 'idea'),
    approved: items.filter(i => i.status === 'approved' || i.status === 'scheduled'),
    published: items.filter(i => i.status === 'published'),
  };

  const handleApprove = (item) => {
    updateItem.mutate({ id: item.id, data: { status: 'approved', approved_by_human: true } });
    toast.success(t('content.pipeline.approved'));
  };

  const handleCopy = (item) => {
    navigator.clipboard.writeText(item.body);
    toast.success(t('content.pipeline.copied'));
  };

  const handleSchedule = (item, dateValue) => {
    if (dateValue) {
      updateItem.mutate({ id: item.id, data: { scheduled_date: dateValue, status: 'scheduled' } });
      toast.success(t('content.pipeline.scheduled') + ' ' + dateValue);
    } else {
      // Clearing the date reverts to approved (or draft if not yet approved)
      updateItem.mutate({
        id: item.id,
        data: { scheduled_date: null, status: item.approved_by_human ? 'approved' : 'draft' },
      });
    }
  };

  const handleRegenerate = async (item) => {
    try {
      setRegeneratingId(item.id);
      await backendFunctions.generateContent({
        rawInputId: item.raw_input_id,
        platforms: [item.platform],
        tone: item.tone || 'professional',
        language: item.language || 'en',
      });
      toast.success(t('content.pipeline.regenerated'));
    } catch (err) {
      toast.error(t('content.pipeline.regenerationFailed') + ': ' + err.message);
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div>
      {/* Mobile column switcher */}
      <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-4">
        {Object.keys(columns).map(col => (
          <button
            key={col}
            onClick={() => setMobileCol(col)}
            className={cn(
              'flex-1 py-2 text-caption font-medium transition-colors',
              mobileCol === col ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {columnLabels[col]} ({columns[col].length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(columns).map(([col, colItems]) => (
          <div key={col} className={cn('hidden md:block', mobileCol === col && 'block')}>
            <h3 className="text-body-m font-semibold text-muted-foreground mb-3">
              {columnLabels[col]} ({colItems.length})
            </h3>
            <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30">
              {colItems.map(item => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  regeneratingId={regeneratingId}
                  onSchedule={handleSchedule}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentCard({ item, onApprove, onCopy, onRegenerate, regeneratingId, onSchedule }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
          {item.platform && <Badge variant="neutral">{t('content.platformLabels.' + item.platform) || item.platform}</Badge>}
        </div>
        {item.title && <p className="text-body-m font-medium mb-1">{item.title}</p>}
        <p className="text-caption text-muted-foreground line-clamp-3">{item.body}</p>
        <div className="mt-2">
          <label className="text-caption text-muted-foreground block mb-1">{t('content.pipeline.scheduleDate')}</label>
          <Input
            type="date"
            className="w-auto text-caption"
            value={item.scheduled_date ? item.scheduled_date.slice(0, 10) : ''}
            onChange={(e) => onSchedule(item, e.target.value)}
          />
        </div>
        <div className="flex gap-2 mt-2">
          {item.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={() => onApprove(item)}>
                <Check className="w-3 h-3 me-1" /> {t('content.pipeline.approve')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRegenerate(item)}
                disabled={regeneratingId === item.id}
              >
                <RefreshCw className={`w-3 h-3 me-1 ${regeneratingId === item.id ? 'animate-spin' : ''}`} />
                {t('content.pipeline.regenerate')}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onCopy(item)}>
            <Copy className="w-3 h-3 me-1" /> {t('content.pipeline.copy')}
          </Button>
          {item.status === 'published' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  toast.info(t('content.pipeline.generatingVariants'));
                  const repurposeResult = await backendFunctions.repurposeContent({
                    contentItemId: item.id,
                    targetPlatforms: ['linkedin_personal', 'twitter'],
                  });
                  toast.success(`${t('content.pipeline.createdVariants')} ${repurposeResult.created}`);
                } catch (err) {
                  toast.error(err.message || t('content.pipeline.repurposeFailed'));
                }
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 me-1" />
              {t('content.pipeline.repurpose')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Blog Tab ---
function BlogTab() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = contentItemHooks.useList();
  const createItem = contentItemHooks.useCreate();
  const updateItem = contentItemHooks.useUpdate();
  const createRawInput = rawInputHooks.useCreate();
  const blogs = items.filter(i => i.type === 'blog');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [expandingFromRaw, setExpandingFromRaw] = useState(false);
  const [rawInputText, setRawInputText] = useState('');
  const [rawExpandDialogOpen, setRawExpandDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Blog form state
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formSeoTitle, setFormSeoTitle] = useState('');
  const [formSeoDescription, setFormSeoDescription] = useState('');
  const [formSeoKeywords, setFormSeoKeywords] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formLanguage, setFormLanguage] = useState('en');
  const [formStatus, setFormStatus] = useState('draft');

  const resetForm = () => {
    setFormTitle('');
    setFormBody('');
    setFormSeoTitle('');
    setFormSeoDescription('');
    setFormSeoKeywords('');
    setFormCategory('');
    setFormLanguage('en');
    setFormStatus('draft');
    setEditingBlog(null);
  };

  const openNewBlog = () => {
    resetForm();
    setEditorOpen(true);
  };

  const openEditBlog = (blog) => {
    setEditingBlog(blog);
    setFormTitle(blog.title || '');
    setFormBody(blog.body || '');
    setFormSeoTitle(blog.seo_title || '');
    setFormSeoDescription(blog.seo_description || '');
    setFormSeoKeywords(Array.isArray(blog.seo_keywords) ? blog.seo_keywords.join(', ') : (blog.seo_keywords || ''));
    setFormCategory(blog.category || '');
    setFormLanguage(blog.language || 'en');
    setFormStatus(blog.status || 'draft');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      toast.error(t('content.blog.titleBodyRequired'));
      return;
    }
    try {
      setSaving(true);
      const blogData = {
        type: 'blog',
        platform: 'blog',
        title: formTitle.trim(),
        body: formBody.trim(),
        seo_title: formSeoTitle.trim(),
        seo_description: formSeoDescription.trim(),
        seo_keywords: formSeoKeywords.split(',').map(k => k.trim()).filter(Boolean),
        category: formCategory.trim(),
        language: formLanguage,
        status: formStatus,
      };

      if (editingBlog) {
        await updateItem.mutateAsync({ id: editingBlog.id, data: blogData });
        toast.success(t('content.blog.blogUpdated'));
      } else {
        await createItem.mutateAsync(blogData);
        toast.success(t('content.blog.blogCreated'));
      }
      setEditorOpen(false);
      resetForm();
    } catch (err) {
      toast.error(t('content.blog.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExpandFromRaw = async () => {
    if (!rawInputText.trim()) return;
    try {
      setExpandingFromRaw(true);
      // First create a RawInput record, then pass its ID to the backend
      const newRawInput = await createRawInput.mutateAsync({
        body: rawInputText.trim(),
        input_type: 'manual',
        processed: false,
      });
      const expandResult = await backendFunctions.expandToBlogPost({
        rawInputId: newRawInput.id,
        language: formLanguage,
      });
      // Populate form with the result
      if (expandResult) {
        setFormTitle(expandResult.title || '');
        setFormBody(expandResult.body || '');
        setFormSeoTitle(expandResult.seo_title || '');
        setFormSeoDescription(expandResult.seo_description || '');
        setFormSeoKeywords(
          Array.isArray(expandResult.seo_keywords) ? expandResult.seo_keywords.join(', ') : (expandResult.seo_keywords || '')
        );
        setFormCategory(expandResult.category || '');
      }
      setRawExpandDialogOpen(false);
      setRawInputText('');
      setEditorOpen(true);
      toast.success(t('content.blog.blogGenerated'));
    } catch (err) {
      toast.error(t('content.blog.expandFailed') + ': ' + err.message);
    } finally {
      setExpandingFromRaw(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-3">
        <Button onClick={openNewBlog}>
          <Plus className="w-4 h-4 me-1" /> {t('content.blog.newBlogPost')}
        </Button>
        <Button variant="outline" onClick={() => setRawExpandDialogOpen(true)}>
          <Sparkles className="w-4 h-4 me-1" /> {t('content.blog.createFromRawInput')}
        </Button>
      </div>

      {/* Blog posts list */}
      {!blogs.length ? (
        <EmptyState title={t('content.blog.noBlogPosts')} description={t('content.blog.noBlogPostsSub')} />
      ) : (
        <div className="space-y-3">
          {blogs.map(blog => (
            <Card key={blog.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[blog.status]}>{blog.status}</Badge>
                    <Badge variant="neutral">{blog.language || 'en'}</Badge>
                    {blog.category && <Badge variant="neutral">{blog.category}</Badge>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEditBlog(blog)}>
                    <Edit className="w-3 h-3 me-1" /> {t('content.blog.edit')}
                  </Button>
                </div>
                <h3 className="text-body-l font-semibold mb-1">{blog.title || t('content.blog.untitled')}</h3>
                {blog.seo_description && (
                  <p className="text-caption text-muted-foreground mb-2">{blog.seo_description}</p>
                )}
                <p className="text-body-m line-clamp-3">{blog.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Blog Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {editingBlog ? t('content.blog.editBlogPost') : t('content.blog.newBlogPost')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.title')}</label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={t('content.blog.titlePlaceholder')} />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.body')}</label>
              <Textarea
                value={formBody}
                onChange={e => setFormBody(e.target.value)}
                placeholder={t('content.blog.bodyPlaceholder')}
                className="min-h-[200px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('content.blog.seoTitle')}</label>
                <Input value={formSeoTitle} onChange={e => setFormSeoTitle(e.target.value)} placeholder={t('content.blog.seoTitlePlaceholder')} />
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('content.blog.category')}</label>
                <Input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder={t('content.blog.categoryPlaceholder')} />
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.seoDescription')}</label>
              <Textarea
                value={formSeoDescription}
                onChange={e => setFormSeoDescription(e.target.value)}
                placeholder={t('content.blog.seoDescPlaceholder')}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.seoKeywords')}</label>
              <Input
                value={formSeoKeywords}
                onChange={e => setFormSeoKeywords(e.target.value)}
                placeholder={t('content.blog.seoKeywordsPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('content.blog.language')}</label>
                <Select value={formLanguage} onChange={e => setFormLanguage(e.target.value)}>
                  <option value="en">{t('common.languages.english')}</option>
                  <option value="he">{t('common.languages.hebrew')}</option>
                </Select>
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('content.blog.status')}</label>
                <Select value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                  <option value="draft">{t('content.blog.statuses.draft')}</option>
                  <option value="approved">{t('content.blog.statuses.approved')}</option>
                  <option value="published">{t('content.blog.statuses.published')}</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditorOpen(false); resetForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 me-1" />
              {saving ? t('content.blog.saving') : editingBlog ? t('content.blog.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expand from Raw Input Dialog */}
      <Dialog open={rawExpandDialogOpen} onOpenChange={setRawExpandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('content.blog.createFromRawInput')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.rawInput')}</label>
              <Textarea
                value={rawInputText}
                onChange={e => setRawInputText(e.target.value)}
                placeholder={t('content.blog.rawInputPlaceholder')}
                className="min-h-[150px]"
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('content.blog.language')}</label>
              <Select value={formLanguage} onChange={e => setFormLanguage(e.target.value)}>
                <option value="en">{t('common.languages.english')}</option>
                <option value="he">{t('common.languages.hebrew')}</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRawExpandDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleExpandFromRaw} disabled={!rawInputText.trim() || expandingFromRaw}>
              <Sparkles className="w-4 h-4 me-1" />
              {expandingFromRaw ? t('content.create.generating') : t('content.blog.generateBlogPost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Newsletter Tab ---
function NewsletterTab() {
  const { t } = useTranslation();
  const { data: newsletters = [], isLoading } = newsletterHooks.useList();
  const updateNewsletter = newsletterHooks.useUpdate();
  const { data: subscribers = [] } = subscriberHooks.useList();
  const activeSubscriberCount = subscribers.filter(s => s.status === 'active').length;
  const [langPreview, setLangPreview] = useState('en');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(null);
  const [sending, setSending] = useState(false);
  const [editingSubjects, setEditingSubjects] = useState({});

  const handleSendClick = (nl) => {
    setSendingNewsletter(nl);
    setSendConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!sendingNewsletter) return;
    try {
      setSending(true);
      await updateNewsletter.mutateAsync({
        id: sendingNewsletter.id,
        data: {
          status: 'sent',
          sent_date: new Date().toISOString(),
        },
      });
      toast.success(`Newsletter #${sendingNewsletter.issue_number} ${t('content.newsletter.markedAsSent')}`);
      setSendConfirmOpen(false);
      setSendingNewsletter(null);
    } catch (err) {
      toast.error(t('content.newsletter.sendFailed') + ': ' + err.message);
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;
  if (!newsletters.length) {
    return <EmptyState title={t('content.newsletter.noNewsletters')} description={t('content.newsletter.noNewslettersSub')} />;
  }

  return (
    <div className="space-y-4">
      {newsletters.map(nl => (
        <Card key={nl.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-body-l font-semibold">Issue #{nl.issue_number}</h3>
                <Badge variant={nl.status === 'sent' ? 'success' : nl.status === 'ready' ? 'info' : 'neutral'}>
                  {nl.status}
                </Badge>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setLangPreview('en')}
                  className={`px-2 py-1 text-caption rounded ${langPreview === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLangPreview('he')}
                  className={`px-2 py-1 text-caption rounded ${langPreview === 'he' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  HE
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Input
                className="text-body-m font-medium flex-1"
                value={
                  editingSubjects[`${nl.id}_${langPreview}`] !== undefined
                    ? editingSubjects[`${nl.id}_${langPreview}`]
                    : (langPreview === 'en' ? nl.subject_en : nl.subject_he) || ''
                }
                onChange={(e) =>
                  setEditingSubjects(prev => ({
                    ...prev,
                    [`${nl.id}_${langPreview}`]: e.target.value,
                  }))
                }
                onBlur={async () => {
                  const key = `${nl.id}_${langPreview}`;
                  const newValue = editingSubjects[key];
                  if (newValue === undefined) return;
                  const field = langPreview === 'en' ? 'subject_en' : 'subject_he';
                  try {
                    await updateNewsletter.mutateAsync({ id: nl.id, data: { [field]: newValue } });
                    toast.success(t('content.newsletter.subjectUpdated'));
                  } catch (err) {
                    toast.error(t('content.newsletter.subjectUpdateFailed') + ': ' + err.message);
                  }
                  setEditingSubjects(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
                placeholder={`Subject (${langPreview.toUpperCase()})`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const key = `${nl.id}_${langPreview}`;
                  const newValue = editingSubjects[key];
                  if (newValue === undefined) return;
                  const field = langPreview === 'en' ? 'subject_en' : 'subject_he';
                  try {
                    await updateNewsletter.mutateAsync({ id: nl.id, data: { [field]: newValue } });
                    toast.success(t('content.newsletter.subjectUpdated'));
                  } catch (err) {
                    toast.error(t('content.newsletter.subjectUpdateFailed') + ': ' + err.message);
                  }
                  setEditingSubjects(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
              >
                <Save className="w-3 h-3" />
              </Button>
            </div>
            <div
              className="text-body-m prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(langPreview === 'en' ? nl.body_en : nl.body_he)
              }}
            />
            {nl.status !== 'sent' && (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-caption text-muted-foreground">
                  {t('content.newsletter.willBeSentTo')} {activeSubscriberCount} {activeSubscriberCount !== 1 ? t('content.newsletter.activeSubscribers') : t('content.newsletter.activeSubscriber')}
                </p>
                <Button size="sm" onClick={() => handleSendClick(nl)}>
                  <Send className="w-4 h-4 me-1" /> {t('content.newsletter.sendNewsletter')}
                </Button>
              </div>
            )}
            {nl.recipients_count > 0 && (
              <p className="text-caption text-muted-foreground mt-2">
                {t('content.newsletter.sentTo')} {nl.recipients_count} {t('content.newsletter.subscribers')} &bull; {nl.open_rate}% {t('content.newsletter.openRate')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Send Confirmation Dialog */}
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('content.newsletter.confirmSend')}</DialogTitle>
          </DialogHeader>
          <p className="text-body-m py-4">
            {t('content.newsletter.confirmSendBody')} #{sendingNewsletter?.issue_number}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSend} disabled={sending}>
              <Send className="w-4 h-4 me-1" />
              {sending ? t('content.newsletter.sending') : t('content.newsletter.confirmSendBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Calendar Tab ---
function CalendarTab({ contentItems, onSelectItem }) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');

  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      const days = [];
      let day = calStart;
      while (day <= calEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return days;
    }
  }, [currentDate, view]);

  const contentByDate = useMemo(() => {
    const map = {};
    (contentItems || []).forEach((item) => {
      const dateStr = item.scheduled_date || item.published_date;
      if (!dateStr) return;
      const key = dateStr.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [contentItems]);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () =>
    setCurrentDate((d) => (view === 'month' ? subMonths(d, 1) : subWeeks(d, 1)));
  const goNext = () =>
    setCurrentDate((d) => (view === 'month' ? addMonths(d, 1) : addWeeks(d, 1)));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-body-l font-semibold min-w-[160px] text-center">
            {format(currentDate, view === 'month' ? 'MMMM yyyy' : "'Week of' MMM d, yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            {t('content.calendarView.today')}
          </Button>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                view === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('content.calendarView.month')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                view === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('content.calendarView.week')}
            </button>
          </div>
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex flex-wrap gap-3">
        {platformKeys.map(key => {
          const colors = platformColors[key] || platformColors.blog;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className="text-caption text-muted-foreground">{t('content.platformLabels.' + key)}</span>
            </div>
          );
        })}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-caption font-medium text-muted-foreground text-center py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayItems = contentByDate[key] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const maxItems = view === 'month' ? 3 : 10;
          const visibleItems = dayItems.slice(0, maxItems);
          const overflowCount = dayItems.length - maxItems;

          return (
            <div
              key={key}
              className={`bg-card p-1.5 ${view === 'week' ? 'min-h-[200px]' : 'min-h-[90px]'} ${
                !isCurrentMonth ? 'opacity-40' : ''
              }`}
            >
              <div className="flex justify-end mb-1">
                <span
                  className={`text-caption w-6 h-6 flex items-center justify-center rounded-full ${
                    today ? 'bg-primary text-primary-foreground font-bold' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const colors = platformColors[item.platform] || platformColors.blog;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem?.(item)}
                      className={`w-full text-start rounded px-1 py-0.5 text-[10px] leading-tight truncate ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}
                      title={item.title || item.body?.slice(0, 60)}
                    >
                      {item.title || (item.body?.slice(0, 20) + '...')}
                    </button>
                  );
                })}
                {overflowCount > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    +{overflowCount} {t('content.calendar.more')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state if no items at all */}
      {Object.keys(contentByDate).length === 0 && (
        <p className="text-body-m text-muted-foreground text-center py-8">
          {t('content.calendarView.noContent')}
        </p>
      )}
    </div>
  );
}

export default function Content() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('create');
  const { data: contentItems = [], isError, refetch } = contentItemHooks.useList();

  useEffect(() => {
    const handler = () => setActiveTab('create');
    document.addEventListener('shortcut-new', handler);
    return () => document.removeEventListener('shortcut-new', handler);
  }, []);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-h2 mb-2">{t('common.error')}</h2>
        <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
        <Button onClick={() => refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">{t('content.title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="create">{t('content.tabs.create')}</TabsTrigger>
          <TabsTrigger value="pipeline">{t('content.tabs.pipeline')}</TabsTrigger>
          <TabsTrigger value="blog">{t('content.tabs.blog')}</TabsTrigger>
          <TabsTrigger value="newsletter">{t('content.tabs.newsletter')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('content.tabs.calendar')}</TabsTrigger>
        </TabsList>

        <TabsContent value="create"><CreateTab /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab /></TabsContent>
        <TabsContent value="blog"><BlogTab /></TabsContent>
        <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
        <TabsContent value="calendar"><CalendarTab contentItems={contentItems} /></TabsContent>
      </Tabs>
    </div>
  );
}
