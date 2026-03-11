import { base44 } from './base44Client';

// Unwrap response — functions.invoke may return { data: ... } or raw JSON
const invoke = (name, data) =>
  base44.functions.invoke(name, data).then(res => res?.data ?? res);

// Backend function invocation helpers
export const backendFunctions = {
  generateContent: (data) => invoke('generate-content-from-raw-input', data),
  expandToBlogPost: (data) => invoke('expand-to-blog-post', data),
  generateClientStatusUpdate: (data) => invoke('generate-client-status-update', data),
  syncGitHubActivity: (data) => invoke('sync-github-activity', data),
  calculateLeadScore: (data) => invoke('calculate-lead-score', data),
  repurposeContent: (data) => invoke('repurpose-content', data),
  generateProposal: (data) => invoke('generate-proposal', data),
  analyzeRepoCode: (data) => invoke('analyze-repo-code', data),
  verifyGitHubConnection: (data) => invoke('verify-github-connection', data || {}),
  listGitHubRepos: (data) => invoke('list-github-repos', data || {}),
  translateText: (data) => invoke('translate-text', data),
  assistBrandVoice: (data) => invoke('assist-brand-voice', data),
  publishBlogToWebsite: (data) => invoke('publish-blog-to-website', data),
  sendNewsletter: (data) => invoke('send-newsletter', data),
  detectContentSignals: (data) => invoke('detect-content-signals', data || {}),
  discoveryEngine: (data) => invoke('discovery-engine', data),
  scanExternalTrends: (data) => invoke('scan-external-trends', data || {}),
  strategicBrain: (data) => invoke('strategic-brain', data || {}),
  generateFollowUpDraft: (data) => invoke('generate-follow-up-draft', data),
  inlineEditContent: (data) => invoke('inline-edit-content', data),
  generateNewsletterTeaser: (data) => invoke('generate-newsletter-teaser', data),
  verifyLinkedInConnection: (data) => invoke('verify-linkedin-connection', data || {}),
  publishToLinkedIn: (data) => invoke('publish-to-linkedin', data),
  autoPublishScheduled: (data) => invoke('auto-publish-scheduled', data || {}),
};
