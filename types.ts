/**
 * Shared TypeScript interfaces for the agent runner
 */

export interface IncidentPayload {
  incident_id: string;        // PagerDuty ID: "P123456"
  sentry_issue_id: string;    // Sentry issue ID: "1234567890"
  jira_ticket: string;        // Jira key: "ENG-1234"
}

export interface BobAgentRequest {
  system: string;
  repositoryUrl: string;
  userMessage: string;
  mcpServers: Array<{
    url: string;
    name: string;
  }>;
  maxSteps: number;
}

export interface BobAgentStep {
  step?: number;
  tool?: string;
  input?: any;
  output?: any;
  duration_ms?: number;
  error?: string;
}

export interface BobAgentResponse {
  steps: BobAgentStep[];
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
  total_duration_ms?: number;
}

// Made with Bob
