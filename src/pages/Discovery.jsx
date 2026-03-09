import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { personalProjectHooks, businessProjectHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { PERSONAL_STEPS, BUSINESS_STEPS } from '@/config/discoverySteps';
import * as LucideIcons from 'lucide-react';
import {
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

import SegmentedTimeline from '@/components/discovery/SegmentedTimeline';
import FloatingChat from '@/components/discovery/FloatingChat';
import BriefingView from '@/components/discovery/BriefingView';
import StepRenderer from '@/components/discovery/StepRenderer';
import SynthesisView from '@/components/discovery/SynthesisView';
import WorkPlanView from '@/components/discovery/WorkPlanView';

// ---------------------------------------------------------------------------
// Discovery — main page shell with single-column layout
// ---------------------------------------------------------------------------
export default function Discovery() {
  const { projectType, projectId } = useParams();
  const navigate = useNavigate();
  const { t, language, isRTL } = useTranslation();

  const isPersonal = projectType === 'personal';
  const steps = isPersonal ? PERSONAL_STEPS : BUSINESS_STEPS;
  const hooks = isPersonal ? personalProjectHooks : businessProjectHooks;

  const { data: project, isLoading: projectLoading } = hooks.useGet(projectId);
  const updateProject = hooks.useUpdate();

  const [currentStepId, setCurrentStepId] = useState(1);
  const [discoveryData, setDiscoveryData] = useState({ steps: {} });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefingData, setBriefingData] = useState(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [approvedSections, setApprovedSections] = useState([]);
  const [workPlanEpics, setWorkPlanEpics] = useState([]);
  const [chatPrefill, setChatPrefill] = useState('');

  // -------------------------------------------------------------------------
  // Step status logic
  // -------------------------------------------------------------------------
  function getStepStatus(stepId) {
    const stepData = discoveryData.steps?.[stepId];
    const completedSteps = project?.discovery_completed_steps || [];
    const skippedSteps = project?.discovery_skipped_steps || [];

    if (completedSteps.includes(stepId) || stepData?.status === 'approved') return 'approved';
    if (skippedSteps.includes(stepId)) return 'skipped';
    if (stepId === currentStepId) {
      if (stepData?.document) return 'drafting';
      return 'briefing';
    }
    if (stepId < currentStepId) return 'approved'; // Past steps without explicit status
    return 'locked';
  }

  // -------------------------------------------------------------------------
  // Initialize from project data
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (project) {
      setCurrentStepId(project.discovery_step || 1);
      setDiscoveryData(project.discovery_data || { projectName: project.name, steps: {} });
    }
  }, [project]);

  // -------------------------------------------------------------------------
  // Save discovery data (debounced)
  // -------------------------------------------------------------------------
  const saveTimeoutRef = useRef(null);
  const saveDiscoveryData = useCallback((newData) => {
    setDiscoveryData(newData);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateProject.mutate({ id: projectId, data: { discovery_data: newData } });
    }, 500);
  }, [projectId, updateProject]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Derived: currentStep (needed by fetchBriefing below)
  // -------------------------------------------------------------------------
  const currentStep = steps.find((s) => s.id === currentStepId);

  // -------------------------------------------------------------------------
  // Briefing fetch
  // -------------------------------------------------------------------------
  const fetchBriefing = useCallback(async () => {
    if (!currentStep) return;
    const stepData = discoveryData.steps?.[currentStepId];

    // If briefing already exists, use it
    if (stepData?.briefing) {
      setBriefingData(stepData.briefing);
      return;
    }

    setIsBriefingLoading(true);
    try {
      const result = await backendFunctions.discoveryEngine({
        mode: 'briefing',
        projectType,
        stepId: currentStepId,
        discoveryData,
        projectId,
        language,
        prompt: currentStep.prompt,
        sectionKeys: currentStep.sections.map(s => s.key),
      });

      setBriefingData(result);

      // Save briefing to discovery data
      const newData = {
        ...discoveryData,
        steps: {
          ...discoveryData.steps,
          [currentStepId]: {
            ...discoveryData.steps?.[currentStepId],
            status: 'briefing',
            briefing: result,
          },
        },
      };
      saveDiscoveryData(newData);
    } catch (err) {
      toast.error(err.message || 'Failed to load briefing');
    } finally {
      setIsBriefingLoading(false);
    }
  }, [currentStepId, currentStep, discoveryData, projectType, projectId, language, saveDiscoveryData]);

  useEffect(() => {
    const status = getStepStatus(currentStepId);
    if (status === 'briefing') {
      fetchBriefing();
    } else {
      setBriefingData(discoveryData.steps?.[currentStepId]?.briefing || null);
    }
  }, [currentStepId]);

  // -------------------------------------------------------------------------
  // Document change handler
  // -------------------------------------------------------------------------
  const handleDocumentChange = useCallback((updatedSections) => {
    const newData = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...discoveryData.steps?.[currentStepId],
          document: updatedSections,
        },
      },
    };
    saveDiscoveryData(newData);
  }, [currentStepId, discoveryData, saveDiscoveryData]);

  // -------------------------------------------------------------------------
  // Chat message handler (document refinement)
  // -------------------------------------------------------------------------
  const handleChatMessage = useCallback(async (message) => {
    const stepData = discoveryData.steps?.[currentStepId];
    const chatHistory = stepData?.chat_history || [];

    // Add user message
    const updatedHistory = [...chatHistory, { role: 'user', content: message }];
    const newDataWithMsg = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...stepData,
          chat_history: updatedHistory,
        },
      },
    };
    saveDiscoveryData(newDataWithMsg);

    setIsRefining(true);
    try {
      const result = await backendFunctions.discoveryEngine({
        mode: 'refine',
        projectType,
        stepId: currentStepId,
        discoveryData,
        projectId,
        language,
        prompt: currentStep.prompt,
        sectionKeys: currentStep.sections.map(s => s.key),
        currentDocument: stepData?.document || [],
        userInstruction: message,
      });

      // Update document and add AI response to chat
      const finalHistory = [...updatedHistory, { role: 'assistant', content: result.changes_summary || t('discovery.chatUpdated') }];
      const finalData = {
        ...discoveryData,
        steps: {
          ...discoveryData.steps,
          [currentStepId]: {
            ...discoveryData.steps?.[currentStepId],
            document: result.sections,
            chat_history: finalHistory,
          },
        },
      };
      saveDiscoveryData(finalData);
      toast.success(t('discovery.chatUpdated'));
    } catch (err) {
      toast.error(err.message || 'Refinement failed');
    } finally {
      setIsRefining(false);
    }
  }, [currentStepId, currentStep, discoveryData, projectType, projectId, language, saveDiscoveryData, t]);

  // -------------------------------------------------------------------------
  // Synthesis: approved sections state sync
  // -------------------------------------------------------------------------
  useEffect(() => {
    setApprovedSections(discoveryData.steps?.[currentStepId]?.approved_sections || []);
  }, [currentStepId, discoveryData.steps]);

  const handleApproveSection = useCallback((sectionIdx) => {
    const updated = [...approvedSections, sectionIdx];
    setApprovedSections(updated);
    const newData = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...discoveryData.steps?.[currentStepId],
          approved_sections: updated,
        },
      },
    };
    saveDiscoveryData(newData);
  }, [approvedSections, currentStepId, discoveryData, saveDiscoveryData]);

  const handleGoFix = useCallback((stepId) => {
    setCurrentStepId(stepId);
  }, []);

  // -------------------------------------------------------------------------
  // Work plan: parse epics from step data
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep?.isWorkPlan) {
      const stepData = discoveryData.steps?.[currentStepId];
      const doc = stepData?.document?.[0];
      if (doc) {
        try {
          const parsed = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
          setWorkPlanEpics(parsed.epics || parsed || []);
        } catch {
          setWorkPlanEpics([]);
        }
      }
    }
  }, [currentStepId, currentStep?.isWorkPlan, discoveryData.steps]);

  const handleWorkPlanChange = useCallback((updatedEpics) => {
    setWorkPlanEpics(updatedEpics);
    const newData = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...discoveryData.steps?.[currentStepId],
          document: [{ key: 'epics', title: 'Epics & Tasks', content: JSON.stringify({ epics: updatedEpics }), type: 'epics' }],
        },
      },
    };
    saveDiscoveryData(newData);
  }, [currentStepId, discoveryData, saveDiscoveryData]);

  // -------------------------------------------------------------------------
  // Generate draft
  // -------------------------------------------------------------------------
  const generateDraft = useCallback(async () => {
    if (!currentStep) return;
    setIsGenerating(true);
    try {
      const stepData = discoveryData.steps?.[currentStepId];
      const chatNotes = (stepData?.chat_history || [])
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');

      const result = await backendFunctions.discoveryEngine({
        mode: 'draft',
        projectType,
        stepId: currentStepId,
        discoveryData,
        projectId,
        language,
        prompt: currentStep.prompt,
        sectionKeys: currentStep.sections.map(s => s.key),
        chatNotes,
      });

      const newData = {
        ...discoveryData,
        steps: {
          ...discoveryData.steps,
          [currentStepId]: {
            ...discoveryData.steps?.[currentStepId],
            status: 'drafting',
            document: result.sections,
          },
        },
      };
      saveDiscoveryData(newData);
      toast.success(t('discovery.draftGenerated'));
    } catch (err) {
      toast.error(err.message || 'Failed to generate draft');
    } finally {
      setIsGenerating(false);
    }
  }, [currentStepId, currentStep, discoveryData, projectType, projectId, language, saveDiscoveryData, t]);

  // -------------------------------------------------------------------------
  // Approve step
  // -------------------------------------------------------------------------
  const handleApproveStep = useCallback(async () => {
    const completedSteps = project?.discovery_completed_steps || [];
    const updatedCompleted = [...completedSteps, currentStepId];

    const newData = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...discoveryData.steps?.[currentStepId],
          status: 'approved',
          approved_at: new Date().toISOString(),
        },
      },
    };

    const nextStepId = currentStepId < 10 ? currentStepId + 1 : currentStepId;

    await updateProject.mutateAsync({
      id: projectId,
      data: {
        discovery_data: newData,
        discovery_completed_steps: updatedCompleted,
        discovery_step: nextStepId,
      },
    });

    setDiscoveryData(newData);
    setCurrentStepId(nextStepId);
    setApprovedSections([]);
    toast.success(t('discovery.stepApproved'));
  }, [currentStepId, discoveryData, project, projectId, updateProject, t]);

  // -------------------------------------------------------------------------
  // Reopen step
  // -------------------------------------------------------------------------
  const handleReopenStep = useCallback(async () => {
    const completedSteps = (project?.discovery_completed_steps || []).filter(s => s !== currentStepId);

    const newData = {
      ...discoveryData,
      steps: {
        ...discoveryData.steps,
        [currentStepId]: {
          ...discoveryData.steps?.[currentStepId],
          status: 'drafting',
          approved_at: undefined,
        },
      },
    };

    await updateProject.mutateAsync({
      id: projectId,
      data: {
        discovery_data: newData,
        discovery_completed_steps: completedSteps,
        discovery_step: currentStepId,
      },
    });

    setDiscoveryData(newData);
    toast.success(t('discovery.reopenStep'));
  }, [currentStepId, discoveryData, project, projectId, updateProject, t]);

  // -------------------------------------------------------------------------
  // Skip step
  // -------------------------------------------------------------------------
  const handleSkipStep = useCallback(async () => {
    const skippedSteps = [...(project?.discovery_skipped_steps || []), currentStepId];
    const nextStepId = currentStepId < 10 ? currentStepId + 1 : currentStepId;

    await updateProject.mutateAsync({
      id: projectId,
      data: {
        discovery_skipped_steps: skippedSteps,
        discovery_step: nextStepId,
      },
    });

    setCurrentStepId(nextStepId);
    toast.success(t('discovery.stepSkipped'));
  }, [currentStepId, project, projectId, updateProject, t]);

  // -------------------------------------------------------------------------
  // Finalize (step 10 — work plan)
  // -------------------------------------------------------------------------
  const handleFinalize = useCallback(async () => {
    setIsGenerating(true);
    try {
      await backendFunctions.discoveryEngine({
        mode: 'finalize',
        projectType,
        stepId: 10,
        discoveryData,
        projectId,
        clientId: project?.client_id || null,
        language,
        prompt: '',
        sectionKeys: [],
        workPlanData: { epics: workPlanEpics },
      });

      toast.success(t('discovery.completed'));
      navigate(isPersonal ? `/projects/${projectId}` : `/business/${projectId}`);
    } catch (err) {
      toast.error(err.message || t('discovery.finalizeFailed'));
    } finally {
      setIsGenerating(false);
    }
  }, [discoveryData, projectType, projectId, language, workPlanEpics, navigate, isPersonal, t]);

  // -------------------------------------------------------------------------
  // Refine section shortcut (per-card)
  // -------------------------------------------------------------------------
  const onRefineSection = useCallback((sectionKey, sectionTitle) => {
    const prefill = t('discovery.chatRefineSection', { section: sectionTitle }) || `Revise the ${sectionTitle} section: `;
    setChatPrefill(prefill);
    setIsChatOpen(true);
  }, [t]);

  // -------------------------------------------------------------------------
  // Reset section to AI draft
  // -------------------------------------------------------------------------
  const onResetSection = useCallback((sectionKey) => {
    toast.info(t('discovery.sectionReset'));
  }, []);

  // -------------------------------------------------------------------------
  // Discuss first (open chat from briefing)
  // -------------------------------------------------------------------------
  const onDiscussFirst = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const stepStatus = getStepStatus(currentStepId);

  const currentDocument = discoveryData.steps?.[currentStepId]?.document || [];
  const allSectionsApproved = currentStep?.isSynthesis
    ? currentDocument.length > 0 && currentDocument.every((_, i) => approvedSections.includes(i))
    : true;

  const currentChatHistory = discoveryData.steps?.[currentStepId]?.chat_history || [];

  // -------------------------------------------------------------------------
  // renderStepContent — determines what to show in the content area
  // -------------------------------------------------------------------------
  const renderStepContent = () => {
    const stepData = discoveryData.steps?.[currentStepId];

    if (projectLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!project) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">{t('common.notFound')}</p>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">
            {t('common.back')}
          </button>
        </div>
      );
    }

    // Briefing state (no document yet)
    if (stepStatus === 'briefing' || (!stepData?.document && stepStatus !== 'approved')) {
      return (
        <BriefingView
          briefing={briefingData}
          isLoading={isBriefingLoading}
          onGenerateDraft={generateDraft}
          onDiscussFirst={onDiscussFirst}
          isGenerating={isGenerating}
          stepIcon={currentStep?.icon}
          stepName={t(`discovery.steps.${projectType}.${currentStepId}`)?.name || currentStep?.key}
          stepRole={language === 'he' ? currentStep?.roleHe : currentStep?.role}
          t={t}
        />
      );
    }

    const isReadOnly = stepStatus === 'approved';
    const doc = stepData?.document || [];

    // Synthesis (step 9)
    if (currentStep?.isSynthesis) {
      return (
        <SynthesisView
          document={doc}
          onChange={(updated) => {
            const newData = {
              ...discoveryData,
              steps: {
                ...discoveryData.steps,
                [currentStepId]: { ...stepData, document: updated },
              },
            };
            saveDiscoveryData(newData);
          }}
          approvedSections={approvedSections}
          onApproveSection={(idx) => setApprovedSections([...approvedSections, idx])}
          onGoFix={(stepId) => setCurrentStepId(stepId)}
          isReadOnly={isReadOnly}
          t={t}
          projectType={projectType}
        />
      );
    }

    // Work plan (step 10)
    if (currentStep?.isWorkPlan) {
      return (
        <WorkPlanView
          epics={workPlanEpics}
          onChange={(newEpics) => {
            setWorkPlanEpics(newEpics);
            const newData = {
              ...discoveryData,
              steps: {
                ...discoveryData.steps,
                [currentStepId]: {
                  ...stepData,
                  document: [{
                    key: 'epics',
                    title: 'Epics',
                    content: JSON.stringify({ epics: newEpics }),
                    type: 'epics',
                  }],
                },
              },
            };
            saveDiscoveryData(newData);
          }}
          isReadOnly={isReadOnly}
          t={t}
        />
      );
    }

    // Regular step — card grid via StepRenderer
    return (
      <StepRenderer
        step={currentStep}
        document={doc}
        onChange={(updated) => {
          const newData = {
            ...discoveryData,
            steps: {
              ...discoveryData.steps,
              [currentStepId]: { ...stepData, document: updated },
            },
          };
          saveDiscoveryData(newData);
        }}
        isReadOnly={isReadOnly}
        onRefineSection={onRefineSection}
        onResetSection={onResetSection}
        t={t}
      />
    );
  };

  // -------------------------------------------------------------------------
  // Loading state (top-level — before layout renders)
  // -------------------------------------------------------------------------
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Not found state
  // -------------------------------------------------------------------------
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">{t('common.notFound')}</p>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-theme(spacing.topbar))] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <button
          onClick={() => navigate(isPersonal ? '/projects' : '/business')}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-medium text-foreground truncate flex-1">
          {discoveryData.projectName || t('discovery.title')}
        </h1>
        <span className="text-xs text-muted-foreground">
          {t('discovery.stepOf', { current: currentStepId, total: steps.length })}
        </span>
      </div>

      {/* Segmented Timeline */}
      <SegmentedTimeline
        steps={steps}
        currentStepId={currentStepId}
        getStepStatus={getStepStatus}
        onStepClick={setCurrentStepId}
        t={t}
        projectType={projectType}
      />

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          {renderStepContent()}
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Skip button */}
          <div>
            {currentStep && currentStep.required !== 'mandatory' && stepStatus === 'drafting' && (
              <button
                onClick={handleSkipStep}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t('discovery.skipStep')}
              </button>
            )}
          </div>
          {/* Right: Action buttons based on state */}
          <div className="flex items-center gap-2">
            {stepStatus === 'drafting' && !currentStep?.isSynthesis && !currentStep?.isWorkPlan && (
              <button
                onClick={generateDraft}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('discovery.regenerate')}
              </button>
            )}
            {stepStatus === 'drafting' && !currentStep?.isWorkPlan && (
              <button
                onClick={handleApproveStep}
                disabled={currentStep?.isSynthesis && !allSectionsApproved}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {t('discovery.approveStep')}
              </button>
            )}
            {stepStatus === 'drafting' && currentStep?.isWorkPlan && (
              <button
                onClick={handleFinalize}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('discovery.finalize')}
              </button>
            )}
            {stepStatus === 'approved' && (
              <button
                onClick={handleReopenStep}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-sm font-medium transition-colors"
              >
                {t('discovery.reopenStep')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Chat */}
      <FloatingChat
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        chatHistory={currentChatHistory}
        onSendMessage={handleChatMessage}
        isLoading={isRefining}
        t={t}
        isRTL={isRTL}
        prefillMessage={chatPrefill}
        onClearPrefill={() => setChatPrefill('')}
      />
    </div>
  );
}
