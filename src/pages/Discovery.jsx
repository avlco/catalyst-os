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
  Lock,
  Circle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Loader2,
  ArrowLeft,
  Brain,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// StepSidebar — desktop sidebar showing all steps with status indicators
// ---------------------------------------------------------------------------
function StepSidebar({ steps, currentStepId, getStepStatus, onStepClick, t, language, projectType }) {
  return (
    <div className="w-60 border-e border-border bg-card/50 overflow-y-auto hidden md:block">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {t('discovery.title')}
        </h2>
        <div className="space-y-1">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const isActive = step.id === currentStepId;
            const isClickable = status !== 'locked';
            const Icon = LucideIcons[step.icon] || LucideIcons.Circle;
            const stepInfo = t(`discovery.steps.${projectType}.${step.id}`) || {};

            return (
              <button
                key={step.id}
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : isClickable
                    ? 'hover:bg-muted/50 text-foreground'
                    : 'text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                <div className="flex-shrink-0">
                  {status === 'approved' ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  ) : status === 'skipped' ? (
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <SkipForward className="w-3.5 h-3.5 text-yellow-600" />
                    </div>
                  ) : status === 'locked' ? (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{stepInfo.name || step.key}</div>
                  <div className="text-xs text-muted-foreground truncate">{stepInfo.description || ''}</div>
                </div>
                {step.required === 'mandatory' && status !== 'approved' && status !== 'skipped' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-medium flex-shrink-0">
                    {t('discovery.mandatory')}
                  </span>
                )}
                {step.required === 'recommended' && status !== 'approved' && status !== 'skipped' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium flex-shrink-0">
                    {t('discovery.recommended')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepMobileSelector — mobile dropdown for step navigation
// ---------------------------------------------------------------------------
function StepMobileSelector({ steps, currentStepId, getStepStatus, onStepClick, t, projectType }) {
  const [isOpen, setIsOpen] = useState(false);
  const stepInfo = t(`discovery.steps.${projectType}.${currentStepId}`) || {};

  const stepOfLabel = t('discovery.stepOf')
    .replace('{{current}}', currentStepId)
    .replace('{{total}}', steps.length);

  return (
    <div className="md:hidden px-4 py-3 border-b border-border bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg"
      >
        <span className="text-sm font-medium">
          {stepOfLabel} — {stepInfo.name || ''}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-2 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const info = t(`discovery.steps.${projectType}.${step.id}`) || {};
            return (
              <button
                key={step.id}
                onClick={() => {
                  if (status !== 'locked') {
                    onStepClick(step.id);
                    setIsOpen(false);
                  }
                }}
                disabled={status === 'locked'}
                className={`w-full flex items-center gap-3 px-4 py-3 text-start border-b border-border last:border-0 ${
                  step.id === currentStepId ? 'bg-primary/5' : ''
                } ${status === 'locked' ? 'opacity-50' : 'hover:bg-muted/50'}`}
              >
                <span className="text-xs text-muted-foreground w-5">{step.id}</span>
                <span className="text-sm flex-1">{info.name || step.key}</span>
                {status === 'approved' && <Check className="w-4 h-4 text-green-600" />}
                {status === 'locked' && <Lock className="w-4 h-4 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BriefingView — displays AI briefing for a step
// ---------------------------------------------------------------------------
function BriefingView({ briefing, isLoading, onGenerateDraft, isGenerating, t }) {
  if (isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{t('discovery.statusBriefing')}...</p>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          {t('discovery.briefingTitle')}
        </h2>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('discovery.briefingContext')}</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{briefing.context_summary}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('discovery.briefingObjective')}</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{briefing.step_objective}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('discovery.briefingRecommendation')}</h3>
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{briefing.recommendation}</p>
          </div>
        </div>

        {briefing.questions?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('discovery.briefingQuestions')}</h3>
            <ul className="space-y-2">
              {briefing.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onGenerateDraft}
          disabled={isGenerating}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('discovery.generateDraft')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionEditor — renders a single document section based on its type
// ---------------------------------------------------------------------------
function SectionEditor({ section, onChange, isReadOnly, t }) {
  const sectionTitle = t(`discovery.sections.${section.key}`) || section.title || section.key;

  if (section.type === 'table') {
    // Parse markdown table from content
    const rows = (section.content || '').split('\n').filter(r => r.trim() && !r.match(/^\|[-:]+/));
    const headers = rows[0]?.split('|').map(h => h.trim()).filter(Boolean) || [];
    const dataRows = rows.slice(1).map(r => r.split('|').map(c => c.trim()).filter(Boolean));

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">{sectionTitle}</h3>
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground">
                      {isReadOnly ? (
                        <span>{cell}</span>
                      ) : (
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => {
                            const newRows = [...dataRows];
                            newRows[ri] = [...newRows[ri]];
                            newRows[ri][ci] = e.target.value;
                            const newContent = '| ' + headers.join(' | ') + ' |\n' +
                              '| ' + headers.map(() => '---').join(' | ') + ' |\n' +
                              newRows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
                            onChange(newContent);
                          }}
                          className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // For both "text" and "list" types — textarea
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-foreground mb-3">{sectionTitle}</h3>
      {isReadOnly ? (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{section.content}</div>
      ) : (
        <textarea
          value={section.content || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(3, (section.content || '').split('\n').length + 1)}
          className="w-full text-sm text-foreground bg-transparent border border-transparent hover:border-border focus:border-primary/30 focus:ring-1 focus:ring-primary/20 rounded-lg px-3 py-2 resize-none transition-colors leading-relaxed outline-none"
          placeholder={section.type === 'list' ? '- Item 1\n- Item 2\n- Item 3' : ''}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentEditor — renders all document sections for a step
// ---------------------------------------------------------------------------
function DocumentEditor({ document, onChange, isReadOnly, t }) {
  if (!document || document.length === 0) return null;

  return (
    <div className={`space-y-2 ${isReadOnly ? 'opacity-90' : ''}`}>
      {isReadOnly && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-2 mb-4">
          <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            {t('discovery.statusApproved')}
          </p>
        </div>
      )}
      {document.map((section, idx) => (
        <SectionEditor
          key={section.key || idx}
          section={section}
          isReadOnly={isReadOnly}
          t={t}
          onChange={(newContent) => {
            const updated = document.map((s, i) =>
              i === idx ? { ...s, content: newContent } : s
            );
            onChange(updated);
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel — collapsible side panel for document refinement chat
// ---------------------------------------------------------------------------
function ChatPanel({ isOpen, onToggle, chatHistory, onSendMessage, isLoading, t }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = () => {
    if (!message.trim() || isLoading) return;
    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 flex flex-col border-s border-border bg-card/30 hidden md:flex">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          {t('discovery.chatTitle')}
        </h3>
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
          <LucideIcons.X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(!chatHistory || chatHistory.length === 0) && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {t('discovery.chatPlaceholder')}
          </p>
        )}
        {(chatHistory || []).map((msg, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-primary/10 text-foreground ms-6'
                : 'bg-muted/50 text-foreground me-6'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm me-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('discovery.chatPlaceholder')}
            rows={2}
            className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors self-end"
          >
            <LucideIcons.Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SynthesisView — PRD/SOW step with per-section approval + contradiction detection
// ---------------------------------------------------------------------------
function SynthesisView({ document, onChange, approvedSections, onApproveSection, onGoFix, isReadOnly, t, projectType }) {
  if (!document || document.length === 0) return null;

  const allApproved = document.every((_, i) => approvedSections.includes(i));

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 mb-2">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          {projectType === 'personal' ? t('discovery.synthesis.title') : t('discovery.synthesis.titleBusiness')}
          {' — '}
          {allApproved ? t('discovery.statusApproved') : t('discovery.synthesis.allSectionsRequired')}
        </p>
      </div>

      {document.map((section, idx) => {
        const isApproved = approvedSections.includes(idx);
        const contradictionMatch = (section.content || '').match(/⚠️\s*CONTRADICTION.*?Step\s*(\d+)/i);
        const hasContradiction = !!contradictionMatch;
        const contradictionStep = contradictionMatch ? parseInt(contradictionMatch[1]) : null;

        return (
          <div
            key={section.key || idx}
            className={`border rounded-xl p-5 transition-colors ${
              hasContradiction
                ? 'border-red-500/50 bg-red-500/5'
                : isApproved
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-border'
            }`}
          >
            <SectionEditor
              section={section}
              isReadOnly={isReadOnly || isApproved}
              t={t}
              onChange={(newContent) => {
                const updated = document.map((s, i) =>
                  i === idx ? { ...s, content: newContent } : s
                );
                onChange(updated);
              }}
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              {hasContradiction && (
                <button
                  onClick={() => onGoFix(contradictionStep)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <LucideIcons.AlertTriangle className="w-4 h-4" />
                  {t('discovery.synthesis.goFix').replace('{{step}}', contradictionStep)}
                </button>
              )}
              {!hasContradiction && !isApproved && !isReadOnly && (
                <div />
              )}
              {!isReadOnly && (
                <button
                  onClick={() => onApproveSection(idx)}
                  disabled={hasContradiction || isApproved}
                  className={`text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    isApproved
                      ? 'bg-green-500/10 text-green-600 cursor-default'
                      : hasContradiction
                      ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {isApproved ? t('discovery.statusApproved') : t('discovery.synthesis.approveSection')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkPlanView — editable epic/task tables for Step 10
// ---------------------------------------------------------------------------
function WorkPlanView({ epicsData, onChange, isReadOnly, t }) {
  const [expandedEpics, setExpandedEpics] = useState([]);

  // Parse epics from various input formats
  const epics = (() => {
    if (Array.isArray(epicsData)) return epicsData;
    if (typeof epicsData === 'string') {
      try {
        const parsed = JSON.parse(epicsData);
        return parsed.epics || parsed;
      } catch { return []; }
    }
    if (epicsData?.epics) return epicsData.epics;
    return [];
  })();

  const toggleEpic = (idx) => {
    setExpandedEpics(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const updateEpic = (epicIdx, field, value) => {
    const updated = epics.map((e, i) => i === epicIdx ? { ...e, [field]: value } : e);
    onChange(updated);
  };

  const updateTask = (epicIdx, taskIdx, field, value) => {
    const updated = epics.map((epic, ei) => {
      if (ei !== epicIdx) return epic;
      const tasks = (epic.tasks || []).map((task, ti) =>
        ti === taskIdx ? { ...task, [field]: value } : task
      );
      return { ...epic, tasks };
    });
    onChange(updated);
  };

  const addTask = (epicIdx) => {
    const updated = epics.map((epic, ei) => {
      if (ei !== epicIdx) return epic;
      return {
        ...epic,
        tasks: [...(epic.tasks || []), { title: '', description: '', priority: 'medium', story_points: 3, acceptance_criteria: '', mvp: false }],
      };
    });
    onChange(updated);
  };

  const deleteTask = (epicIdx, taskIdx) => {
    const updated = epics.map((epic, ei) => {
      if (ei !== epicIdx) return epic;
      return { ...epic, tasks: (epic.tasks || []).filter((_, ti) => ti !== taskIdx) };
    });
    onChange(updated);
  };

  const addEpic = () => {
    onChange([...epics, { name: '', description: '', tasks: [] }]);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <LucideIcons.ClipboardList className="w-5 h-5 text-primary" />
        {t('discovery.workPlan.title')}
      </h2>

      {epics.map((epic, epicIdx) => {
        const isExpanded = expandedEpics.includes(epicIdx);
        const mvpCount = (epic.tasks || []).filter(tk => tk.mvp).length;
        const totalPoints = (epic.tasks || []).reduce((sum, tk) => sum + (tk.story_points || 0), 0);

        return (
          <div key={epicIdx} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleEpic(epicIdx)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-start"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              <div className="flex-1 min-w-0">
                {isReadOnly ? (
                  <span className="font-medium text-sm text-foreground">{epic.name || 'Unnamed Epic'}</span>
                ) : (
                  <input
                    type="text"
                    value={epic.name || ''}
                    onChange={(e) => { e.stopPropagation(); updateEpic(epicIdx, 'name', e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={t('discovery.workPlan.epicName')}
                    className="font-medium text-sm text-foreground bg-transparent border-0 focus:outline-none w-full"
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {(epic.tasks || []).length} tasks · {totalPoints} pts
                {mvpCount > 0 && ` · ${mvpCount} MVP`}
              </span>
            </button>

            {isExpanded && (
              <div className="p-4">
                {epic.description && (
                  <p className="text-xs text-muted-foreground mb-3">{epic.description}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-start py-2 px-2 text-xs font-medium text-muted-foreground">{t('discovery.workPlan.taskTitle')}</th>
                        <th className="text-start py-2 px-2 text-xs font-medium text-muted-foreground w-24">{t('discovery.workPlan.priority')}</th>
                        <th className="text-start py-2 px-2 text-xs font-medium text-muted-foreground w-16">{t('discovery.workPlan.storyPoints')}</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground w-14">{t('discovery.workPlan.mvp')}</th>
                        {!isReadOnly && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {(epic.tasks || []).map((task, taskIdx) => (
                        <tr key={taskIdx} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-2">
                            {isReadOnly ? (
                              <span className="text-foreground">{task.title}</span>
                            ) : (
                              <input
                                type="text"
                                value={task.title || ''}
                                onChange={(e) => updateTask(epicIdx, taskIdx, 'title', e.target.value)}
                                placeholder={t('discovery.workPlan.taskTitle')}
                                className="w-full bg-transparent border-0 focus:outline-none text-foreground"
                              />
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {isReadOnly ? (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                task.priority === 'high' ? 'bg-red-500/10 text-red-600' :
                                task.priority === 'low' ? 'bg-gray-500/10 text-gray-600' :
                                'bg-yellow-500/10 text-yellow-600'
                              }`}>{task.priority}</span>
                            ) : (
                              <select
                                value={task.priority || 'medium'}
                                onChange={(e) => updateTask(epicIdx, taskIdx, 'priority', e.target.value)}
                                className="text-xs bg-transparent border border-border rounded px-1 py-0.5 focus:outline-none"
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            {isReadOnly ? (
                              <span className="text-foreground">{task.story_points}</span>
                            ) : (
                              <select
                                value={task.story_points || 3}
                                onChange={(e) => updateTask(epicIdx, taskIdx, 'story_points', parseInt(e.target.value))}
                                className="text-xs bg-transparent border border-border rounded px-1 py-0.5 focus:outline-none"
                              >
                                {[1, 2, 3, 5, 8].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!task.mvp}
                              onChange={(e) => !isReadOnly && updateTask(epicIdx, taskIdx, 'mvp', e.target.checked)}
                              disabled={isReadOnly}
                              className="rounded border-border"
                            />
                          </td>
                          {!isReadOnly && (
                            <td className="py-2 px-2">
                              <button
                                onClick={() => deleteTask(epicIdx, taskIdx)}
                                className="text-muted-foreground hover:text-red-600 transition-colors"
                              >
                                <LucideIcons.Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => addTask(epicIdx)}
                    className="mt-3 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <LucideIcons.Plus className="w-3.5 h-3.5" />
                    {t('discovery.workPlan.addTask')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!isReadOnly && (
        <button
          onClick={addEpic}
          className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center justify-center gap-2"
        >
          <LucideIcons.Plus className="w-4 h-4" />
          {t('discovery.workPlan.addEpic')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discovery — main page shell with 3-panel layout
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
        language,
        prompt: '',
        sectionKeys: [],
        workPlanData: { epics: workPlanEpics },
      });

      toast.success(t('discovery.completed'));
      navigate(isPersonal ? `/projects/${projectId}` : `/business/${projectId}`);
    } catch (err) {
      toast.error(err.message || 'Finalization failed');
    } finally {
      setIsGenerating(false);
    }
  }, [discoveryData, projectType, projectId, language, workPlanEpics, navigate, isPersonal, t]);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const stepStatus = getStepStatus(currentStepId);
  const stepInfo = t(`discovery.steps.${projectType}.${currentStepId}`) || {};
  const StepIcon = LucideIcons[currentStep?.icon] || LucideIcons.Circle;

  const statusLabelKey = 'discovery.status' + stepStatus.charAt(0).toUpperCase() + stepStatus.slice(1);

  const currentDocument = discoveryData.steps?.[currentStepId]?.document || [];
  const allSectionsApproved = currentStep?.isSynthesis
    ? currentDocument.length > 0 && currentDocument.every((_, i) => approvedSections.includes(i))
    : true;

  // -------------------------------------------------------------------------
  // Loading state
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
    <div className="flex flex-col h-[calc(100vh-theme(spacing.topbar))]">
      {/* Mobile step selector */}
      <StepMobileSelector
        steps={steps}
        currentStepId={currentStepId}
        getStepStatus={getStepStatus}
        onStepClick={setCurrentStepId}
        t={t}
        projectType={projectType}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Step Sidebar — desktop */}
        <StepSidebar
          steps={steps}
          currentStepId={currentStepId}
          getStepStatus={getStepStatus}
          onStepClick={setCurrentStepId}
          t={t}
          language={language}
          projectType={projectType}
        />

        {/* Document Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Step Header */}
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <StepIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {stepInfo.name || currentStep?.key}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {language === 'he' ? currentStep?.roleHe : currentStep?.role}
                  {' · '}
                  {t(statusLabelKey)}
                </p>
              </div>
            </div>
          </div>

          {/* Content Area — placeholder for now */}
          <div className="p-6">
            <div className="max-w-3xl mx-auto">
              {stepStatus === 'briefing' && (
                <BriefingView
                  briefing={briefingData}
                  isLoading={isBriefingLoading}
                  onGenerateDraft={generateDraft}
                  isGenerating={isGenerating}
                  t={t}
                />
              )}
              {stepStatus === 'drafting' && currentStep?.isSynthesis && (
                <SynthesisView
                  document={discoveryData.steps?.[currentStepId]?.document || []}
                  onChange={handleDocumentChange}
                  approvedSections={approvedSections}
                  onApproveSection={handleApproveSection}
                  onGoFix={handleGoFix}
                  isReadOnly={false}
                  t={t}
                  projectType={projectType}
                />
              )}
              {stepStatus === 'drafting' && !currentStep?.isSynthesis && !currentStep?.isWorkPlan && (
                <DocumentEditor
                  document={discoveryData.steps?.[currentStepId]?.document || []}
                  onChange={handleDocumentChange}
                  isReadOnly={false}
                  t={t}
                />
              )}
              {stepStatus === 'approved' && currentStep?.isSynthesis && (
                <SynthesisView
                  document={discoveryData.steps?.[currentStepId]?.document || []}
                  onChange={() => {}}
                  approvedSections={discoveryData.steps?.[currentStepId]?.document?.map((_, i) => i) || []}
                  onApproveSection={() => {}}
                  onGoFix={() => {}}
                  isReadOnly={true}
                  t={t}
                  projectType={projectType}
                />
              )}
              {stepStatus === 'approved' && !currentStep?.isSynthesis && !currentStep?.isWorkPlan && (
                <DocumentEditor
                  document={discoveryData.steps?.[currentStepId]?.document || []}
                  onChange={() => {}}
                  isReadOnly={true}
                  t={t}
                />
              )}
              {stepStatus === 'drafting' && currentStep?.isWorkPlan && (
                <WorkPlanView
                  epicsData={workPlanEpics}
                  onChange={handleWorkPlanChange}
                  isReadOnly={false}
                  t={t}
                />
              )}
              {stepStatus === 'approved' && currentStep?.isWorkPlan && (
                <WorkPlanView
                  epicsData={workPlanEpics}
                  onChange={() => {}}
                  isReadOnly={true}
                  t={t}
                />
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-6 py-4 border-t border-border bg-card/50 sticky bottom-0">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentStep?.required !== 'mandatory' && stepStatus !== 'approved' && stepStatus !== 'locked' && (
                  <button
                    onClick={handleSkipStep}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                  >
                    {t('discovery.skipStep')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stepStatus === 'briefing' && (
                  <button
                    onClick={generateDraft}
                    disabled={isGenerating}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('discovery.generateDraft')}
                  </button>
                )}
                {stepStatus === 'drafting' && (
                  <>
                    <button
                      onClick={generateDraft}
                      disabled={isGenerating}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-2"
                    >
                      {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('discovery.regenerate')}
                    </button>
                    {currentStep?.isWorkPlan ? (
                      <button
                        onClick={handleFinalize}
                        disabled={isGenerating}
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
                      >
                        {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('discovery.finalize')}
                      </button>
                    ) : (
                      <button
                        onClick={handleApproveStep}
                        disabled={currentStep?.isSynthesis && !allSectionsApproved}
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        {t('discovery.approveStep')}
                      </button>
                    )}
                  </>
                )}
                {stepStatus === 'approved' && (
                  <button
                    onClick={handleReopenStep}
                    className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {t('discovery.reopenStep')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        {isChatOpen ? (
          <ChatPanel
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(false)}
            chatHistory={discoveryData.steps?.[currentStepId]?.chat_history || []}
            onSendMessage={handleChatMessage}
            isLoading={isRefining}
            t={t}
          />
        ) : (
          <div className="hidden md:flex flex-col border-s border-border">
            <button
              onClick={() => setIsChatOpen(true)}
              className="p-3 border-b border-border hover:bg-muted/50 transition-colors"
              title={t('discovery.chatToggle')}
            >
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
