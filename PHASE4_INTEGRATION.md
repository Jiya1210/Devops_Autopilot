# Phase 4: Agent Orchestration - Integration Guide

This document describes how Phase 4 (Agent Runner) integrates with the rest of the DevOps Autopilot system.

## Overview

Phase 4 implements the main execution logic that orchestrates the autonomous incident resolution workflow. It acts as the bridge between incoming webhooks and IBM Bob's reasoning capabilities.

## Architecture

```
┌─────────────────┐
│   PagerDuty     │
│   (Webhook)     │
└────────┬────────┘
         │ POST /webhook/incident
         │ { incident_id, sentry_issue_id, jira_ticket }
         ▼
┌─────────────────────────────────────────────────────┐
│              Agent Runner (Phase 4)                 │
│  ┌───────────────────────────────────────────────┐ │
│  │  index.ts - Express Server                    │ │
│  │  - Receives webhooks                          │ │
│  │  - Validates payloads                         │ │
│  │  - Manages active incidents                   │ │
│  │  - Implements retry logic                     │ │
│  └───────────────┬───────────────────────────────┘ │
│                  │                                   │
│  ┌───────────────▼───────────────────────────────┐ │
│  │  bob-client.ts - IBM Bob Integration          │ │
│  │  - Calls IBM Bob API                          │ │
│  │  - Handles mock mode                          │ │
│  │  - Manages timeouts                           │ │
│  └───────────────┬───────────────────────────────┘ │
│                  │                                   │
│  ┌───────────────▼───────────────────────────────┐ │
│  │  prompts.ts - 10-Step Workflow                │ │
│  │  - System prompt for IBM Bob                  │ │
│  │  - Detailed step-by-step instructions         │ │
│  │  - Tool usage guidelines                      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ IBM Bob API Call
                  │ { system, userMessage, mcpServers, ... }
                  ▼
         ┌────────────────┐
         │   IBM Bob API  │
         │   (External)   │
         └────────┬───────┘
                  │
                  │ MCP Tool Calls
                  │ fetch_alert, get_stack_trace, etc.
                  ▼
         ┌────────────────────────────────────┐
         │   MCP Server (Phase 3)             │
         │  ┌──────────────────────────────┐  │
         │  │  Tool Registry               │  │
         │  │  - fetch_alert               │  │
         │  │  - get_stack_trace           │  │
         │  │  - get_file_contents         │  │
         │  │  - create_branch             │  │
         │  │  - commit_fix                │  │
         │  │  - open_pull_request         │  │
         │  │  - update_jira_ticket        │  │
         │  │  - post_slack_message        │  │
         │  └──────────┬───────────────────┘  │
         └─────────────┼───────────────────────┘
                       │
                       │ API Calls
                       ▼
         ┌─────────────────────────────┐
         │  Integration Layer (Phase 2)│
         │  - PagerDuty Client         │
         │  - Sentry Client            │
         │  - GitHub Client            │
         │  - Jira Client              │
         │  - Slack Client             │
         └─────────────────────────────┘
```

## Component Details

### 1. index.ts - Main Orchestrator

**Purpose**: Express server that receives webhooks and manages the agent lifecycle.

**Key Features**:
- Webhook endpoint: `POST /webhook/incident`
- Health check: `GET /health`
- Active incidents tracking: `GET /incidents/active`
- Duplicate prevention
- Retry logic with exponential backoff
- Graceful shutdown handling

**Integration Points**:
- Receives webhooks from PagerDuty (or other alerting systems)
- Calls `BobClient.runAgent()` to invoke IBM Bob
- Passes MCP server URL to IBM Bob for tool access

**Environment Variables**:
```bash
AGENT_RUNNER_PORT=5000
AGENT_MAX_RETRIES=3
AGENT_RETRY_DELAY_MS=5000
AGENT_MAX_STEPS=25
MCP_SERVER_URL=http://localhost:4000/mcp
```

### 2. bob-client.ts - IBM Bob Integration

**Purpose**: Client wrapper for IBM Bob API with mock mode support.

**Key Features**:
- Real IBM Bob API integration
- Mock mode for testing without API calls
- Health check for IBM Bob API
- Timeout handling
- Error formatting and logging

**Integration Points**:
- Calls IBM Bob API at `${IBM_BOB_BASE_URL}/v1/agent/run`
- Passes MCP server configuration to IBM Bob
- Returns execution trace with all steps taken

**Environment Variables**:
```bash
IBM_BOB_API_KEY=your_api_key
IBM_BOB_BASE_URL=https://api.ibm-bob.com
IBM_BOB_MOCK_MODE=false
IBM_BOB_REPO_URL=https://github.com/your-org/your-repo
```

**Mock Mode**:
When `IBM_BOB_MOCK_MODE=true`, the client simulates the entire 10-step workflow with realistic mock data. This is useful for:
- Testing the agent runner without IBM Bob API access
- Developing and debugging the workflow
- Demo purposes

### 3. prompts.ts - Autonomous Workflow Definition

**Purpose**: Defines the system prompt that guides IBM Bob through the 10-step incident resolution workflow.

**The 10-Step Workflow**:

1. **Understand the Incident** - `fetch_alert`
   - Get incident details from PagerDuty
   - Understand severity and context

2. **Get the Stack Trace** - `get_stack_trace`
   - Retrieve error details from Sentry
   - Identify exact file, function, and line number

3. **Read the Broken Code** - `get_file_contents`
   - Read the file containing the error
   - Understand the context and logic

4. **Design the Fix** - (Thinking step)
   - Analyze root cause
   - Plan minimal, safe fix

5. **Create a Branch** - `create_branch`
   - Create feature branch: `fix/incident-{id}`

6. **Commit the Fix** - `commit_fix`
   - Commit code changes with descriptive message

7. **Write Tests** - `commit_fix`
   - Add regression tests
   - Ensure bug won't happen again

8. **Open a Pull Request** - `open_pull_request`
   - Create PR with full RCA
   - Include impact analysis

9. **Update Jira** - `update_jira_ticket`
   - Add comment with fix summary
   - Link to PR

10. **Notify Stakeholders** - `post_slack_message`
    - Post plain-English summary to Slack
    - Notify team of resolution

**Integration Points**:
- System prompt is passed to IBM Bob API
- References all MCP tools by name
- Provides detailed instructions for each step

## Data Flow

### 1. Incident Webhook Received

```json
POST /webhook/incident
{
  "incident_id": "P123456",
  "sentry_issue_id": "1234567890",
  "jira_ticket": "ENG-1234"
}
```

### 2. Agent Runner Processes

```typescript
// index.ts
app.post('/webhook/incident', async (req, res) => {
  const payload = req.body;
  
  // Validate
  if (!payload.incident_id || !payload.sentry_issue_id || !payload.jira_ticket) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Acknowledge immediately
  res.status(202).json({ status: 'accepted', incident_id: payload.incident_id });
  
  // Run agent async
  runAgentWithRetry(payload);
});
```

### 3. IBM Bob Invoked

```typescript
// bob-client.ts
const result = await bobClient.runAgent({
  system: SYSTEM_PROMPT,
  repositoryUrl: 'https://github.com/your-org/your-repo',
  userMessage: createIncidentMessage(payload),
  mcpServers: [
    { url: 'http://localhost:4000/mcp', name: 'devops-autopilot' }
  ],
  maxSteps: 25
});
```

### 4. IBM Bob Executes Workflow

IBM Bob reads the system prompt and executes the 10 steps:

```
Step 1: Call fetch_alert(incident_id="P123456")
  → Returns: { title: "High Error Rate", severity: "critical", ... }

Step 2: Call get_stack_trace(sentry_issue_id="1234567890")
  → Returns: { exception: "TypeError", app_frames: [...], ... }

Step 3: Call get_file_contents(path="src/services/payment.ts")
  → Returns: { content: "...", lines: 42 }

Step 4: (Thinking) Analyze root cause
  → Identified: Missing null check on line 42

Step 5: Call create_branch(branch_name="fix/incident-P123456")
  → Returns: { branch: "fix/incident-P123456", created: true }

Step 6: Call commit_fix(path="...", content="...", message="...")
  → Returns: { commit_sha: "abc123", committed: true }

Step 7: Call commit_fix(path="...test.ts", content="...", message="...")
  → Returns: { commit_sha: "def456", committed: true }

Step 8: Call open_pull_request(title="...", body="...")
  → Returns: { pr_number: 42, pr_url: "https://..." }

Step 9: Call update_jira_ticket(ticket_key="ENG-1234", comment="...")
  → Returns: { updated: true }

Step 10: Call post_slack_message(channel="#incidents", message="...")
  → Returns: { message_ts: "...", posted: true }
```

### 5. Result Returned

```typescript
// Result from IBM Bob
{
  steps: [
    { step: 1, tool: 'fetch_alert', input: {...}, output: {...}, duration_ms: 150 },
    { step: 2, tool: 'get_stack_trace', input: {...}, output: {...}, duration_ms: 200 },
    // ... 8 more steps
  ],
  status: 'completed',
  total_duration_ms: 2450
}
```

## Testing the Integration

### 1. Start All Services

```bash
# Terminal 1: Start MCP Server
cd packages/mcp-server
npm run dev

# Terminal 2: Start Agent Runner
cd packages/agent-runner
npm run dev
```

### 2. Test with Mock Mode

```bash
# Enable mock mode
export IBM_BOB_MOCK_MODE=true

# Send test webhook
curl -X POST http://localhost:5000/webhook/incident \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "P123456",
    "sentry_issue_id": "1234567890",
    "jira_ticket": "ENG-1234"
  }'
```

### 3. Check Logs

```
[Webhook] 🚨 Incident received: P123456
[Agent] 🤖 Starting agent run (attempt 1/3)
[BobClient] 🎭 Running in MOCK MODE
[BobClient] 🎭 Executing mock agent workflow...
[BobClient] 🎭 Mock execution complete: 9 steps
[Agent] ✅ Completed in 2000ms
[Agent] Steps executed: 9
[Agent] Status: completed
[Agent] Step summary:
  1. fetch_alert - 150ms
  2. get_stack_trace - 200ms
  3. get_file_contents - 100ms
  4. create_branch - 300ms
  5. commit_fix - 400ms
  6. commit_fix - 350ms
  7. open_pull_request - 500ms
  8. update_jira_ticket - 250ms
  9. post_slack_message - 200ms
```

### 4. Verify Health

```bash
curl http://localhost:5000/health
```

## Configuration for Production

### 1. Environment Variables

Create `.env` file:

```bash
# IBM Bob Configuration
IBM_BOB_API_KEY=your_real_api_key_here
IBM_BOB_REPO_URL=https://github.com/your-org/your-repo
IBM_BOB_BASE_URL=https://api.ibm-bob.com
IBM_BOB_MOCK_MODE=false

# Agent Runner
AGENT_RUNNER_PORT=5000
AGENT_MAX_RETRIES=3
AGENT_RETRY_DELAY_MS=5000
AGENT_MAX_STEPS=25
MCP_SERVER_URL=http://mcp-server:4000/mcp

# All other service credentials...
```

### 2. Docker Compose

```yaml
services:
  agent-runner:
    build: ./packages/agent-runner
    ports:
      - "5000:5000"
    environment:
      - IBM_BOB_API_KEY=${IBM_BOB_API_KEY}
      - IBM_BOB_REPO_URL=${IBM_BOB_REPO_URL}
      - MCP_SERVER_URL=http://mcp-server:4000/mcp
    depends_on:
      - mcp-server
```

### 3. PagerDuty Webhook Configuration

Configure PagerDuty to send webhooks to:
```
https://your-domain.com/webhook/incident
```

Webhook payload should include:
- `incident_id`: PagerDuty incident ID
- `sentry_issue_id`: Sentry issue ID
- `jira_ticket`: Jira ticket key

## Monitoring and Observability

### Key Metrics to Track

1. **Incident Processing Time**: Time from webhook to PR creation
2. **Success Rate**: Percentage of incidents successfully resolved
3. **Retry Rate**: How often retries are needed
4. **Step Completion**: Which steps succeed/fail most often
5. **Active Incidents**: Number of concurrent incidents being processed

### Health Checks

```bash
# Check agent runner health
curl http://localhost:5000/health

# Check active incidents
curl http://localhost:5000/incidents/active

# Check MCP server health
curl http://localhost:4000/health
```

### Logs to Monitor

- `[Webhook]` - Incoming incidents
- `[Agent]` - Agent execution status
- `[BobClient]` - IBM Bob API calls
- `[HTTP]` - Request/response logs
- `[Error]` - Any errors or failures

## Troubleshooting

### Issue: Webhooks not being received

**Check**:
1. Agent runner is running: `curl http://localhost:5000/health`
2. Port 5000 is accessible
3. PagerDuty webhook URL is correct
4. Firewall allows incoming connections

### Issue: Agent runs fail immediately

**Check**:
1. `IBM_BOB_API_KEY` is valid
2. `MCP_SERVER_URL` is accessible
3. IBM Bob API is healthy
4. Check logs for specific error messages

### Issue: MCP tools not working

**Check**:
1. MCP server is running: `curl http://localhost:4000/health`
2. All integration credentials are configured
3. Tool registry is properly initialized
4. Check MCP server logs for errors

### Issue: Mock mode not working

**Check**:
1. `IBM_BOB_MOCK_MODE=true` is set
2. Server was restarted after changing env vars
3. Check logs for "Running in MOCK MODE" message

## Next Steps

With Phase 4 complete, the system is now fully functional:

✅ Phase 1: Integration Layer - API clients for all services
✅ Phase 2: MCP Server - Tool registry and MCP protocol
✅ Phase 3: Mock Mode - Testing without real API calls
✅ Phase 4: Agent Orchestration - Main execution logic

**Remaining work**:
- Phase 5: Demo Application (optional)
- End-to-end testing with real services
- Production deployment
- Monitoring and alerting setup

## Summary

Phase 4 successfully implements:

1. **Webhook Endpoint** - Receives incident notifications
2. **IBM Bob Integration** - Invokes autonomous agent
3. **10-Step Workflow** - Detailed system prompt
4. **Mock Mode** - Testing without IBM Bob API
5. **Retry Logic** - Handles transient failures
6. **Health Checks** - Monitoring and observability
7. **Comprehensive Logging** - Detailed execution traces

The agent runner is now ready to autonomously resolve production incidents!

## Made with Bob

This integration was designed and implemented with assistance from IBM Bob.