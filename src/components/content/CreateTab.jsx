import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { rawInputHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import { platformKeys } from './contentConstants';

export default function CreateTab() {
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
