import { BobAgentRequest, BobAgentResponse } from './types';
/**
 * IBM Bob API Client
 *
 * Wrapper for interacting with IBM Bob's API with Mock Mode support
 *
 * Environment Variables:
 * - IBM_BOB_API_KEY: Your IBM Bob API key
 * - IBM_BOB_BASE_URL: Base URL for IBM Bob API (default: https://api.ibm-bob.com)
 * - IBM_BOB_MOCK_MODE: Set to 'true' to use mock responses (for testing)
 */
export declare class BobClient {
    private apiKey;
    private baseUrl;
    private mockMode;
    private timeout;
    constructor(apiKey: string, baseUrl?: string, mockMode?: boolean, timeout?: number);
    /**
     * Run an agent with the given configuration
     *
     * This method orchestrates the entire agent execution:
     * 1. Sends the request to IBM Bob API
     * 2. Polls for completion (or uses webhooks if configured)
     * 3. Returns the full execution trace
     */
    runAgent(request: BobAgentRequest): Promise<BobAgentResponse>;
    /**
     * Mock agent execution for testing without IBM Bob API
     */
    private runMockAgent;
    /**
     * Transform IBM Bob API response to our internal format
     */
    private transformResponse;
    /**
     * Format error for logging
     */
    private formatError;
    /**
     * Utility to add delay
     */
    private delay;
    /**
     * Health check for IBM Bob API
     */
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=bob-client.d.ts.map