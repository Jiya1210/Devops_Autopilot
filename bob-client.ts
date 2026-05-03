import axios, { AxiosError } from 'axios';
import { BobAgentRequest, BobAgentResponse, BobAgentStep } from './types';

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

export class BobClient {
  private apiKey: string;
  private baseUrl: string;
  private mockMode: boolean;
  private timeout: number;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.ibm-bob.com',
    mockMode: boolean = false,
    timeout: number = 300000 // 5 minutes default
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.mockMode = mockMode || process.env.IBM_BOB_MOCK_MODE === 'true';
    this.timeout = timeout;

    if (this.mockMode) {
      console.log('[BobClient] ⚠️  Running in MOCK MODE - no real API calls will be made');
    }
  }

  /**
   * Run an agent with the given configuration
   *
   * This method orchestrates the entire agent execution:
   * 1. Sends the request to IBM Bob API
   * 2. Polls for completion (or uses webhooks if configured)
   * 3. Returns the full execution trace
   */
  async runAgent(request: BobAgentRequest): Promise<BobAgentResponse> {
    const startTime = Date.now();
    
    try {
      console.log('[BobClient] 🚀 Starting agent run...');
      console.log('[BobClient] Repository:', request.repositoryUrl);
      console.log('[BobClient] MCP Servers:', request.mcpServers.map(s => s.name).join(', '));
      console.log('[BobClient] Max Steps:', request.maxSteps);
      
      if (this.mockMode) {
        return await this.runMockAgent(request);
      }

      // Real IBM Bob API call
      const response = await axios.post(
        `${this.baseUrl}/v1/agent/run`,
        {
          system_prompt: request.system,
          repository_url: request.repositoryUrl,
          user_message: request.userMessage,
          mcp_servers: request.mcpServers,
          max_steps: request.maxSteps,
          stream: false // We want the full response at once
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-Client-Version': '1.0.0',
            'X-Client-Name': 'devops-autopilot'
          },
          timeout: this.timeout
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[BobClient] ✅ Agent run completed in ${duration}ms`);
      console.log(`[BobClient] Steps executed: ${response.data.steps?.length || 0}`);
      console.log(`[BobClient] Status: ${response.data.status}`);

      return this.transformResponse(response.data);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[BobClient] ❌ Error after ${duration}ms:`, this.formatError(error));
      
      // Return a failed response instead of throwing
      return {
        steps: [],
        status: 'failed',
        error: this.formatError(error)
      };
    }
  }

  /**
   * Mock agent execution for testing without IBM Bob API
   */
  private async runMockAgent(request: BobAgentRequest): Promise<BobAgentResponse> {
    console.log('[BobClient] 🎭 Executing mock agent workflow...');
    
    // Simulate processing time
    await this.delay(2000);

    const mockSteps: BobAgentStep[] = [
      {
        step: 1,
        tool: 'fetch_alert',
        input: { incident_id: 'P123456' },
        output: {
          title: 'High Error Rate in Payment Service',
          severity: 'critical',
          service: 'payment-api',
          timestamp: new Date().toISOString()
        },
        duration_ms: 150
      },
      {
        step: 2,
        tool: 'get_stack_trace',
        input: { sentry_issue_id: '1234567890' },
        output: {
          exception: 'TypeError: Cannot read property "amount" of undefined',
          app_frames: [
            {
              filename: 'src/services/payment.ts',
              function: 'processPayment',
              lineno: 42,
              context_line: 'const total = order.amount * 1.1;'
            }
          ]
        },
        duration_ms: 200
      },
      {
        step: 3,
        tool: 'get_file_contents',
        input: { path: 'src/services/payment.ts' },
        output: {
          content: '// Payment processing logic\nexport function processPayment(order) {\n  const total = order.amount * 1.1;\n  return total;\n}',
          lines: 42
        },
        duration_ms: 100
      },
      {
        step: 4,
        tool: 'create_branch',
        input: { branch_name: 'fix/incident-P123456' },
        output: { branch: 'fix/incident-P123456', created: true },
        duration_ms: 300
      },
      {
        step: 5,
        tool: 'commit_fix',
        input: {
          path: 'src/services/payment.ts',
          content: '// Payment processing logic\nexport function processPayment(order) {\n  if (!order || !order.amount) {\n    throw new Error("Invalid order");\n  }\n  const total = order.amount * 1.1;\n  return total;\n}',
          message: 'fix: add null check for order in processPayment - auto-fix for incident P123456'
        },
        output: { commit_sha: 'abc123def456', committed: true },
        duration_ms: 400
      },
      {
        step: 6,
        tool: 'commit_fix',
        input: {
          path: 'src/__tests__/payment.test.ts',
          content: 'describe("processPayment", () => {\n  it("should handle null order", () => {\n    expect(() => processPayment(null)).toThrow("Invalid order");\n  });\n});',
          message: 'test: add test for null order handling'
        },
        output: { commit_sha: 'def789ghi012', committed: true },
        duration_ms: 350
      },
      {
        step: 7,
        tool: 'open_pull_request',
        input: {
          title: 'fix: Handle null order in payment processing',
          body: '## Root Cause Analysis\n\n**What broke:** Line 42 in `src/services/payment.ts`\n\n**Why:** Missing null check for order object\n\n**Impact:** ~500 users affected, 15min downtime\n\n**Fix:** Added validation before accessing order.amount'
        },
        output: { pr_number: 42, pr_url: 'https://github.com/example/repo/pull/42' },
        duration_ms: 500
      },
      {
        step: 8,
        tool: 'update_jira_ticket',
        input: {
          ticket_key: 'ENG-1234',
          comment: 'Fix implemented and PR opened: https://github.com/example/repo/pull/42'
        },
        output: { updated: true },
        duration_ms: 250
      },
      {
        step: 9,
        tool: 'post_slack_message',
        input: {
          channel: '#incidents',
          message: '🔧 Incident P123456 resolved: Added null check to prevent payment processing errors. PR #42 is ready for review.'
        },
        output: { message_ts: '1234567890.123456', posted: true },
        duration_ms: 200
      }
    ];

    console.log(`[BobClient] 🎭 Mock execution complete: ${mockSteps.length} steps`);
    
    return {
      steps: mockSteps,
      status: 'completed',
      total_duration_ms: mockSteps.reduce((sum, step) => sum + (step.duration_ms || 0), 0)
    };
  }

  /**
   * Transform IBM Bob API response to our internal format
   */
  private transformResponse(data: any): BobAgentResponse {
    return {
      steps: data.steps || [],
      status: data.status || 'completed',
      error: data.error,
      total_duration_ms: data.total_duration_ms
    };
  }

  /**
   * Format error for logging
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`;
      } else if (axiosError.request) {
        return 'No response received from IBM Bob API';
      }
    }
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Utility to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for IBM Bob API
   */
  async healthCheck(): Promise<boolean> {
    if (this.mockMode) {
      console.log('[BobClient] Mock mode - health check skipped');
      return true;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('[BobClient] Health check failed:', this.formatError(error));
      return false;
    }
  }
}

// Made with Bob
