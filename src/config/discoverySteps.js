// src/config/discoverySteps.js
// Discovery step configuration — document-centric model
// Each step defines its AI role, prompt, and expected document sections.

export const PERSONAL_STEPS = [
  {
    id: 1,
    key: "ideation",
    required: "mandatory",
    role: "Product Strategist + Devil's Advocate",
    roleHe: "אסטרטג מוצר + מאתגר",
    icon: "Lightbulb",
    canGoNoGo: true,
    sections: [
      { key: "concept_statement", type: "text", cardType: "TextCard", cardProps: { prominent: true } },
      { key: "key_angles", type: "list", cardType: "ListCard" },
      { key: "risks", type: "list", cardType: "ListCard", cardProps: { colorCode: true } },
      { key: "open_questions", type: "list", cardType: "ChecklistCard" },
      { key: "go_no_go", type: "text", cardType: "DecisionCard" },
    ],
    prompt: `You are a Product Strategist and Devil's Advocate.
Your goal: Help the founder explore, challenge, and sharpen their idea.
Based on the context provided, produce a structured document with these sections:
- concept_statement: A clear, concise statement of the idea (2-3 sentences)
- key_angles: Promising angles and unique differentiators (bullet list)
- risks: Key risks and challenges (bullet list)
- open_questions: Questions that still need answers (bullet list)
- go_no_go: Assessment — is this ready to proceed, needs refinement, or should stop? Include reasoning.`,
  },
  {
    id: 2,
    key: "market_intelligence",
    required: "recommended",
    role: "Market Research Analyst",
    roleHe: "אנליסט מחקר שוק",
    icon: "Search",
    sections: [
      { key: "problem_validation", type: "text", cardType: "TextCard" },
      { key: "competitors", type: "list", cardType: "ListCard" },
      { key: "market_size", type: "text", cardType: "TextCard" },
      { key: "timing", type: "text", cardType: "TextCard" },
      { key: "gaps", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Market Research Analyst.
Your goal: Assess whether the market need is real, sized, and timely.
Based on the concept from previous steps, produce:
- problem_validation: Does this problem really exist? Evidence and reasoning.
- competitors: Known competitors or alternatives (bullet list with brief description each)
- market_size: Estimated market size and segment
- timing: Is this the right time? What trends support or threaten this?
- gaps: Gaps in existing solutions that this project could fill`,
  },
  {
    id: 3,
    key: "business_viability",
    required: "optional",
    role: "Business Analyst + CFO",
    roleHe: "אנליסט עסקי",
    icon: "DollarSign",
    sections: [
      { key: "revenue_model", type: "text", cardType: "TextCard" },
      { key: "pricing_hypothesis", type: "text", cardType: "MetricCard" },
      { key: "unit_economics", type: "text", cardType: "MetricCard" },
      { key: "break_even", type: "text", cardType: "TextCard" },
    ],
    prompt: `You are a Business Analyst and CFO advisor.
Your goal: Assess economic viability — revenue model, unit economics, break-even.
Be realistic, not optimistic. Based on the concept and market data, produce:
- revenue_model: How will this make money?
- pricing_hypothesis: Proposed pricing and reasoning
- unit_economics: Cost per user/customer vs revenue per user/customer
- break_even: Estimated timeline and conditions to break even`,
  },
  {
    id: 4,
    key: "goals_vision",
    required: "mandatory",
    role: "Product Manager",
    roleHe: "מנהל מוצר",
    icon: "Target",
    sections: [
      { key: "vision_statement", type: "text", cardType: "TextCard", cardProps: { prominent: true } },
      { key: "target_audience", type: "text", cardType: "ListCard" },
      { key: "kpis", type: "table", columns: ["metric", "target", "timeframe"], cardType: "TableCard" },
      { key: "success_definition", type: "text", cardType: "TextCard" },
    ],
    prompt: `You are a Product Manager.
Your goal: Define a clear Vision, measurable KPIs, and target audience.
Push for specificity — no vague statements. Based on all previous steps, produce:
- vision_statement: Clear, inspiring vision (2-3 sentences)
- target_audience: Who exactly is this for? Be specific about demographics, behaviors, needs.
- kpis: Table of measurable KPIs with metric name, target value, and timeframe
- success_definition: What does success look like in 6 months? 12 months?`,
  },
  {
    id: 5,
    key: "functionality_scope",
    required: "mandatory",
    role: "Product Owner",
    roleHe: "בעל מוצר",
    icon: "Settings",
    sections: [
      { key: "must_have", type: "list", cardType: "ChecklistCard", cardProps: { accent: "green" } },
      { key: "should_have", type: "list", cardType: "ChecklistCard" },
      { key: "could_have", type: "list", cardType: "ChecklistCard" },
      { key: "out_of_scope", type: "list", cardType: "ChecklistCard", cardProps: { accent: "red" } },
      { key: "core_loop", type: "text", cardType: "TextCard" },
      { key: "mvp_definition", type: "text", cardType: "TextCard" },
    ],
    prompt: `You are a Product Owner.
Your goal: Define scope clearly. Protect against scope creep.
Actively challenge features — push back on anything that's not core. Produce:
- must_have: Features absolutely required for launch (bullet list)
- should_have: Important but can launch without (bullet list)
- could_have: Nice-to-have, defer to later (bullet list)
- out_of_scope: Explicitly excluded (bullet list)
- core_loop: The primary user workflow in 3-5 steps
- mvp_definition: What is the minimum viable product?`,
  },
  {
    id: 6,
    key: "infrastructure_security",
    required: "mandatory",
    role: "Solutions Architect",
    roleHe: "ארכיטקט פתרונות",
    icon: "Server",
    sections: [
      { key: "tech_stack", type: "text", cardType: "TechStackCard" },
      { key: "auth_strategy", type: "text", cardType: "TextCard" },
      { key: "hosting", type: "text", cardType: "TextCard" },
      { key: "nfrs", type: "table", columns: ["requirement", "target", "notes"], cardType: "TableCard" },
      { key: "security", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Solutions Architect.
Default stack context: React + Vite + TailwindCSS + Base44 BaaS (Deno functions).
Your goal: Make the right technical infrastructure decisions. Explain trade-offs. Produce:
- tech_stack: Recommended technology stack with justification
- auth_strategy: Authentication and authorization approach
- hosting: Hosting and deployment strategy
- nfrs: Non-functional requirements table (performance, scalability, availability targets)
- security: Security requirements and considerations (bullet list)

Include a Mermaid architecture diagram showing system components and their connections. Use this format:
\`\`\`mermaid
graph TD
  A[Component] --> B[Component]
\`\`\``,
  },
  {
    id: 7,
    key: "entities_screens_flows",
    required: "mandatory",
    role: "System Architect + UX Designer",
    roleHe: "ארכיטקט מערכת + מעצב UX",
    icon: "Database",
    sections: [
      { key: "entities", type: "table", columns: ["name", "key_fields", "relations"], cardType: "TableCard" },
      { key: "screens", type: "list", cardType: "ListCard" },
      { key: "user_flows", type: "list", cardType: "DiagramCard" },
      { key: "erd_summary", type: "text", cardType: "DiagramCard" },
    ],
    prompt: `You are a System Architect and UX Designer.
Your goal: Define the data model, screens, and key user flows.
Derive entities from the features defined in previous steps. Produce:
- entities: Table of entities with name, key fields, and relationships
- screens: List of screens/pages the app needs (bullet list with brief description)
- user_flows: Key user journeys as step-by-step flows (bullet list)
- erd_summary: Brief text summary of how entities relate

Include a Mermaid ER diagram showing entity relationships:
\`\`\`mermaid
erDiagram
  ENTITY1 ||--o{ ENTITY2 : has
\`\`\`

Include a Mermaid flowchart showing the main user flow:
\`\`\`mermaid
flowchart TD
  A[Start] --> B[Step]
\`\`\``,
  },
  {
    id: 8,
    key: "integrations",
    required: "recommended",
    role: "Integration Architect",
    roleHe: "ארכיטקט אינטגרציות",
    icon: "Plug",
    sections: [
      { key: "integrations_table", type: "table", columns: ["name", "purpose", "cost", "alternative", "critical"], cardType: "IntegrationCard" },
      { key: "required_accounts", type: "list", cardType: "ListCard" },
      { key: "risks", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are an Integration Architect.
Your goal: Identify all required external APIs, their costs, and fallback strategies.
Flag any dependency that could be a single point of failure. Produce:
- integrations_table: Table of integrations with name, purpose, estimated cost, alternative, and whether it's critical
- required_accounts: Accounts/API keys that need to be set up (bullet list)
- risks: Integration-related risks (bullet list)`,
  },
  {
    id: 9,
    key: "prd",
    required: "mandatory",
    role: "Technical Writer + QA",
    roleHe: "כותב טכני + QA",
    icon: "FileText",
    isSynthesis: true,
    sections: [],
    prompt: `You are a Technical Writer and QA reviewer.
Your goal: Synthesize ALL previous steps into a cohesive PRD (Product Requirements Document).
Review all step outputs and produce a complete, professional PRD with sections:
- Executive Summary
- Problem & Opportunity
- Vision & Goals
- Target Audience
- Scope (Must-Have / Should-Have / Out of Scope)
- Technical Architecture
- Data Model
- Key User Flows
- Integrations
- Non-Functional Requirements
- Risks & Mitigations
- Success Metrics
- Open Questions

CRITICAL: Check for contradictions between steps. If you find one, mark the section with:
"\u26a0\ufe0f CONTRADICTION: Step X says [A] but Step Y says [B]" and include which step needs fixing.

Output the PRD in clean, professional format ready for CLAUDE.md use.`,
  },
  {
    id: 10,
    key: "work_plan",
    required: "mandatory",
    role: "Engineering Manager",
    roleHe: "מנהל הנדסה",
    icon: "ClipboardList",
    isWorkPlan: true,
    sections: [
      { key: "epics", type: "epics" },
    ],
    prompt: `You are an Engineering Manager.
Your goal: Break the PRD into a realistic, prioritized development backlog.
Be realistic about unknowns — flag them explicitly. Produce:
- epics: Array of epics, each with name, description, and tasks
- Each task: title, description, priority (high/medium/low), story_points (1/2/3/5/8), acceptance_criteria
- Include an MVP scope indicator (which epics/tasks are MVP vs post-MVP)
- First milestone: name + which tasks + estimated weeks

Return as JSON: { epics: [{ name, description, tasks: [{ title, description, priority, story_points, acceptance_criteria, mvp: boolean }] }] }`,
  },
];

export const BUSINESS_STEPS = [
  {
    id: 1,
    key: "problem_definition",
    required: "mandatory",
    role: "Business Analyst + Problem Investigator",
    roleHe: "אנליסט עסקי + חוקר בעיות",
    icon: "SearchCheck",
    canGoNoGo: true,
    sections: [
      { key: "problem_statement", type: "text", cardType: "TextCard", cardProps: { prominent: true } },
      { key: "stakeholders", type: "table", columns: ["role", "pain_points", "needs"], cardType: "TableCard" },
      { key: "current_state", type: "text", cardType: "TextCard" },
      { key: "desired_state", type: "text", cardType: "TextCard" },
      { key: "discovery_questions", type: "list", cardType: "ChecklistCard" },
    ],
    prompt: `You are a Business Analyst and Problem Investigator.
Your goal: Understand the client's actual problem — not the solution they think they want.
Separate the stated problem from the underlying need. Produce:
- problem_statement: Clear articulation of the core problem (2-3 sentences)
- stakeholders: Table of stakeholders with their role, pain points, and needs
- current_state: How things work today (current process, tools, pain)
- desired_state: What the client wants to achieve
- discovery_questions: Questions to ask the client in the next meeting`,
  },
  {
    id: 2,
    key: "market_intelligence",
    required: "recommended",
    role: "Market Research Analyst",
    roleHe: "אנליסט מחקר שוק",
    icon: "Search",
    sections: [
      { key: "problem_validated", type: "text", cardType: "TextCard" },
      { key: "existing_solutions", type: "list", cardType: "ListCard" },
      { key: "gaps", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Market Research Analyst.
Your goal: Validate the problem exists broadly, identify existing solutions and their gaps.
Focus on B2B context and the client's industry. Produce:
- problem_validated: Is this a real, widespread problem? Evidence.
- existing_solutions: What solutions exist today? (bullet list with strengths/weaknesses)
- gaps: What's missing from existing solutions that we can address?`,
  },
  {
    id: 3,
    key: "business_context",
    required: "mandatory",
    role: "Business Consultant",
    roleHe: "יועץ עסקי",
    icon: "Building",
    sections: [
      { key: "business_objectives", type: "list", cardType: "ListCard" },
      { key: "success_metrics", type: "table", columns: ["metric", "owner", "target"], cardType: "TableCard" },
      { key: "constraints", type: "text", cardType: "TextCard" },
      { key: "decision_makers", type: "list", cardType: "ListCard" },
      { key: "end_users", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Business Consultant.
Your goal: Understand the client's business objectives, constraints, and who makes decisions.
Distinguish between decision makers, influencers, and end users. Produce:
- business_objectives: What the client's business wants to achieve (bullet list)
- success_metrics: Table of metrics with who owns them and target values
- constraints: Known limitations and resource constraints
- decision_makers: Who approves decisions? (bullet list with name/role)
- end_users: Who will use the system daily? (bullet list with role and context)`,
  },
  {
    id: 4,
    key: "solution_alignment",
    required: "mandatory",
    role: "Solution Architect + Consultant",
    roleHe: "ארכיטקט + יועץ",
    icon: "Handshake",
    sections: [
      { key: "solution_options", type: "table", columns: ["approach", "pros", "cons", "complexity"], cardType: "TableCard" },
      { key: "recommended_approach", type: "text", cardType: "TextCard" },
      { key: "tradeoffs", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Solution Architect and Consultant.
Your goal: Propose 2-3 solution approaches with clear trade-offs, get alignment before detailing.
Present options in business language, not technical jargon. Produce:
- solution_options: Table of 2-3 approaches with pros, cons, and complexity level
- recommended_approach: Which approach you recommend and why (2-3 sentences)
- tradeoffs: Key trade-offs the client should understand`,
  },
  {
    id: 5,
    key: "scope_risks",
    required: "mandatory",
    role: "Project Manager + Risk Analyst",
    roleHe: "מנהל פרויקט + אנליסט סיכונים",
    icon: "Scale",
    sections: [
      { key: "in_scope", type: "list", cardType: "ChecklistCard", cardProps: { accent: "green" } },
      { key: "out_of_scope", type: "list", cardType: "ChecklistCard", cardProps: { accent: "red" } },
      { key: "risks", type: "table", columns: ["risk", "probability", "impact", "mitigation"], cardType: "TableCard" },
      { key: "assumptions", type: "list", cardType: "ListCard" },
      { key: "dependencies", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are a Project Manager and Risk Analyst.
Your goal: Define what's in scope, what's out, what could go wrong, and what we're assuming.
Be explicit about change request implications. Produce:
- in_scope: What we are building (bullet list)
- out_of_scope: What we are NOT building (bullet list)
- risks: Table of risks with probability (high/medium/low), impact, and mitigation strategy
- assumptions: Things we are assuming to be true (bullet list)
- dependencies: External dependencies that could block us (bullet list)`,
  },
  {
    id: 6,
    key: "infrastructure_security",
    required: "mandatory",
    role: "Solutions Architect",
    roleHe: "ארכיטקט פתרונות",
    icon: "Server",
    sections: [
      { key: "client_environment", type: "text", cardType: "TextCard" },
      { key: "tech_stack", type: "text", cardType: "TechStackCard" },
      { key: "auth_strategy", type: "text", cardType: "TextCard" },
      { key: "hosting", type: "text", cardType: "TextCard" },
      { key: "nfrs", type: "table", columns: ["requirement", "target", "notes"], cardType: "TableCard" },
    ],
    prompt: `You are a Solutions Architect.
Default stack: React + Vite + TailwindCSS + Base44 BaaS (Deno functions).
Ask about the client's existing technical environment. Prefer integrating with what exists. Produce:
- client_environment: Client's existing systems, tech stack if known
- tech_stack: Recommended technology stack with justification
- auth_strategy: Authentication and authorization approach
- hosting: Hosting and deployment strategy
- nfrs: Non-functional requirements table

Include a Mermaid architecture diagram showing system components and their connections. Use this format:
\`\`\`mermaid
graph TD
  A[Component] --> B[Component]
\`\`\``,
  },
  {
    id: 7,
    key: "entities_screens_flows",
    required: "mandatory",
    role: "System Architect + UX Designer",
    roleHe: "ארכיטקט מערכת + מעצב UX",
    icon: "Database",
    sections: [
      { key: "entities", type: "table", columns: ["name", "key_fields", "relations"], cardType: "TableCard" },
      { key: "screens", type: "list", cardType: "ListCard" },
      { key: "user_flows", type: "list", cardType: "DiagramCard" },
    ],
    prompt: `You are a System Architect and UX Designer.
Your goal: Define the data model, screens, and key user flows. Produce:
- entities: Table of entities with name, key fields, and relationships
- screens: List of screens/pages (bullet list with brief description)
- user_flows: Key user journeys as step-by-step flows

Include a Mermaid ER diagram showing entity relationships:
\`\`\`mermaid
erDiagram
  ENTITY1 ||--o{ ENTITY2 : has
\`\`\`

Include a Mermaid flowchart showing the main user flow:
\`\`\`mermaid
flowchart TD
  A[Start] --> B[Step]
\`\`\``,
  },
  {
    id: 8,
    key: "integrations",
    required: "recommended",
    role: "Integration Architect",
    roleHe: "ארכיטקט אינטגרציות",
    icon: "Plug",
    sections: [
      { key: "client_systems", type: "list", cardType: "ListCard" },
      { key: "integrations_table", type: "table", columns: ["name", "purpose", "cost", "alternative", "critical"], cardType: "IntegrationCard" },
      { key: "risks", type: "list", cardType: "ListCard" },
    ],
    prompt: `You are an Integration Architect.
Focus on the client's existing systems (CRM, ERP, communication tools etc.). Produce:
- client_systems: Client's existing systems we need to integrate with
- integrations_table: Table of required integrations with cost and alternatives
- risks: Integration-related risks`,
  },
  {
    id: 9,
    key: "sow",
    required: "mandatory",
    role: "Business Development + Technical Writer",
    roleHe: "פיתוח עסקי + כותב טכני",
    icon: "FileText",
    isSynthesis: true,
    sections: [],
    prompt: `You are a Business Development specialist and Technical Writer.
Your goal: Create a professional Statement of Work (SOW) summarizing the discovery process.
This is an INTERNAL reference document — technical, thorough, and actionable.
Do NOT include pricing, payment terms, or specific timeline dates.
Synthesize ALL previous steps into a complete SOW with sections:
- Executive Summary
- Problem Statement
- Scope of Work (deliverables organized by milestone/phase)
- Technical Architecture Summary
- Assumptions & Dependencies
- Risks & Mitigations
- Why CatalystAI

CRITICAL: Check for contradictions between steps. If you find one, mark the section with:
"\u26a0\ufe0f CONTRADICTION: Step X says [A] but Step Y says [B]" and include which step needs fixing.`,
  },
  {
    id: 10,
    key: "work_plan",
    required: "mandatory",
    role: "Engineering Manager",
    roleHe: "מנהל הנדסה",
    icon: "ClipboardList",
    isWorkPlan: true,
    sections: [
      { key: "epics", type: "epics" },
    ],
    prompt: `You are an Engineering Manager.
Your goal: Break the SOW into a realistic, prioritized backlog organized under the agreed milestones.
Each task should include acceptance_criteria that can be shared with the client. Produce:
- epics: Array of epics (aligned to milestones), each with tasks
- Each task: title, description, priority, story_points, acceptance_criteria, mvp boolean

Return as JSON: { epics: [{ name, description, tasks: [{ title, description, priority, story_points, acceptance_criteria, mvp: boolean }] }] }`,
  },
];

// Maps PRD/SOW sections to source steps (for contradiction navigation)
export const SYNTHESIS_SECTION_SOURCES = {
  personal: {
    executive_summary: [1, 4],
    problem_opportunity: [1, 2],
    vision_goals: [4],
    target_audience: [4],
    scope: [5],
    technical_architecture: [6],
    data_model: [7],
    user_flows: [7],
    integrations: [8],
    nfrs: [6],
    risks: [5],
    success_metrics: [4],
  },
  business: {
    executive_summary: [1, 3],
    problem_statement: [1],
    scope_of_work: [5],
    technical_architecture: [6],
    assumptions_dependencies: [5],
    risks_mitigations: [5],
    why_catalystai: [],
  },
};
