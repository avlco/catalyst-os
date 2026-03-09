import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Compass, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { personalProjectHooks, businessProjectHooks, clientHooks } from '@/api/hooks';

export default function DiscoveryNew() {
  const { projectType } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isPersonal = projectType === 'personal';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPersonal = personalProjectHooks.useCreate();
  const createBusiness = businessProjectHooks.useCreate();
  const { data: clients } = clientHooks.useList();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      const baseData = {
        name: name.trim(),
        description: description.trim(),
        status: 'discovery',
        discovery_step: 1,
        discovery_data: { projectName: name.trim(), steps: {} },
      };

      let project;
      if (isPersonal) {
        project = await createPersonal.mutateAsync(baseData);
      } else {
        project = await createBusiness.mutateAsync({
          ...baseData,
          client_id: clientId || undefined,
        });
      }

      navigate(`/discovery/${projectType}/${project.id}`);
    } catch (err) {
      toast.error(err.message || t('common.error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-theme(spacing.topbar))] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate(isPersonal ? '/projects' : '/business')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>

        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              {isPersonal ? t('discovery.newPersonal') : t('discovery.newBusiness')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6 ms-13">
            {t('discovery.newDescription')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('discovery.projectName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('discovery.projectName')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                autoFocus
                required
              />
            </div>

            {!isPersonal && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t('clients.title')}
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  <option value="">{t('business.detail.selectClient')}</option>
                  {(clients || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('common.description')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t('common.description')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Compass className="w-4 h-4" />
              )}
              {t('discovery.startDiscovery')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
