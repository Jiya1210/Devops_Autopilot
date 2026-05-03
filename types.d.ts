/**
 * Shared TypeScript interfaces for the agent runner
 */
export interface IncidentPayload {
    incident_id: string;
    sentry_issue_id: string;
    jira_ticket: string;
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
//# sourceMappingURL=types.d.ts.map