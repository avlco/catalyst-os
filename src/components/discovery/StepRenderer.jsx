import React from 'react';
import {
  TextCard, ListCard, ChecklistCard, MetricCard,
  TableCard, DiagramCard, DecisionCard,
  TechStackCard, IntegrationCard,
} from './cards';
import * as LucideIcons from 'lucide-react';

const CARD_MAP = {
  TextCard,
  ListCard,
  ChecklistCard,
  MetricCard,
  TableCard,
  DiagramCard,
  DecisionCard,
  TechStackCard,
  IntegrationCard,
};

export default function StepRenderer({
  step,
  document: doc,
  onChange,
  isReadOnly,
  onRefineSection,
  onResetSection,
  t,
}) {
  if (!doc || doc.length === 0) return null;

  // Build a map of section key → document section
  const sectionMap = {};
  for (const section of doc) {
    sectionMap[section.key] = section;
  }

  // Determine grid layout from step sections config
  const sections = step.sections || [];

  // If step has no section config (synthesis), render all doc sections as TextCards
  const renderSections = sections.length > 0 ? sections : doc.map(s => ({
    key: s.key,
    type: s.type || 'text',
    cardType: 'TextCard',
    cardProps: {},
  }));

  const handleChange = (sectionKey, newContent) => {
    const updated = doc.map(s => s.key === sectionKey ? { ...s, content: newContent } : s);
    onChange(updated);
  };

  const getIcon = (sectionKey) => {
    const iconMap = {
      concept_statement: 'Lightbulb', vision_statement: 'Eye', market_overview: 'Globe',
      risks: 'AlertTriangle', tech_stack: 'Code2', architecture: 'Network',
      er_diagram: 'Database', user_flows: 'GitBranch', integrations: 'Plug',
      hosting: 'Cloud', auth_strategy: 'Shield', nfrs: 'Gauge',
      in_scope: 'CheckCircle', out_of_scope: 'XCircle', goals: 'Target',
      competitors: 'Users', revenue_model: 'DollarSign', problem_statement: 'Search',
      stakeholders: 'Users', current_state: 'Clock', desired_state: 'Sparkles',
      discovery_questions: 'HelpCircle', business_objectives: 'Target',
      success_metrics: 'BarChart3', constraints: 'Lock', decision_makers: 'Crown',
      end_users: 'User', solution_options: 'GitBranch', recommended_approach: 'Star',
      tradeoffs: 'Scale', assumptions: 'MessageCircle', dependencies: 'Link',
      client_environment: 'Building', client_systems: 'Server',
      integrations_table: 'Plug', integrations_list: 'Plug',
      key_screens: 'Monitor', entities: 'Database',
      key_angles: 'Compass', open_questions: 'HelpCircle', go_no_go: 'CheckCircle',
      target_segments: 'Users', opportunities: 'TrendingUp',
      pricing_hypothesis: 'Tag', unit_economics: 'Calculator', break_even: 'TrendingUp',
      target_audience: 'Users', differentiators: 'Zap',
    };
    const iconName = iconMap[sectionKey];
    return iconName ? LucideIcons[iconName] : undefined;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderSections.map((sectionConfig) => {
        const docSection = sectionMap[sectionConfig.key];
        if (!docSection) return null;

        const cardTypeName = sectionConfig.cardType || 'TextCard';
        const CardComponent = CARD_MAP[cardTypeName] || TextCard;
        const cardProps = sectionConfig.cardProps || {};
        const sectionTitle = t?.(`discovery.sections.${sectionConfig.key}`) || docSection.title || sectionConfig.key;
        const sectionIcon = getIcon(sectionConfig.key);

        // Determine span: diagrams, tables, and integration/tech cards span 2 columns
        const wideCards = ['DiagramCard', 'TableCard', 'IntegrationCard', 'TechStackCard'];
        const span = cardProps.span || (wideCards.includes(cardTypeName) ? 2 : 1);

        return (
          <CardComponent
            key={sectionConfig.key}
            title={sectionTitle}
            icon={sectionIcon}
            content={docSection.content}
            columns={sectionConfig.columns}
            onChange={(newContent) => handleChange(sectionConfig.key, newContent)}
            onRefine={() => onRefineSection?.(sectionConfig.key, sectionTitle)}
            onReset={() => onResetSection?.(sectionConfig.key)}
            isReadOnly={isReadOnly}
            span={span}
            t={t}
            {...cardProps}
          />
        );
      })}
    </div>
  );
}
