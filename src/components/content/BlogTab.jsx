import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { contentItemHooks, rawInputHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Sparkles, Edit, Save, FileText, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import { statusVariant } from './contentConstants';

export default function BlogTab() {
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
  const [publishingId, setPublishingId] = useState(null);

  const handlePublish = async (blog) => {
    if (!window.confirm(t('content.blog.publishConfirmBody'))) return;
    try {
      setPublishingId(blog.id);
      const result = await backendFunctions.publishBlogToWebsite({ contentItemId: blog.id });
      if (result?.success) {
        toast.success(t('content.blog.publishSuccess'));
      } else {
        toast.error(result?.error || t('content.blog.publishFailed'));
      }
    } catch (err) {
      toast.error(t('content.blog.publishFailed') + ': ' + (err.message || ''));
    } finally {
      setPublishingId(null);
    }
  };

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
                    {blog.website_article_id && (
                      <Badge variant="success">
                        <Globe className="w-3 h-3 me-1" />
                        {t('content.blog.publishedBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(blog.status === 'approved' || blog.status === 'published') && (
                      <Button
                        size="sm"
                        variant={blog.website_article_id ? 'outline' : 'default'}
                        onClick={() => handlePublish(blog)}
                        disabled={publishingId === blog.id}
                      >
                        <Globe className="w-3 h-3 me-1" />
                        {publishingId === blog.id
                          ? t('content.blog.publishing')
                          : blog.website_article_id
                            ? t('content.blog.updateOnWebsite')
                            : t('content.blog.publishToWebsite')
                        }
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditBlog(blog)}>
                      <Edit className="w-3 h-3 me-1" /> {t('content.blog.edit')}
                    </Button>
                  </div>
                </div>
                <h3 className="text-body-l font-semibold mb-1">{blog.title || t('content.blog.untitled')}</h3>
                {blog.seo_description && (
                  <p className="text-caption text-muted-foreground mb-2">{blog.seo_description}</p>
                )}
                <p className="text-body-m line-clamp-3">{blog.body}</p>
                {blog.external_url && (
                  <p className="text-caption text-primary mt-2 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {blog.external_url}
                  </p>
                )}
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
