# Agent Runner

The Agent Runner is the orchestration layer that bridges incoming incident webhooks with IBM Bob's autonomous reasoning capabilities. It receives incident notifications, invokes the IBM Bob agent with the 10-step workflow, and manages the entire incident resolution lifecycle.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  PagerDuty  │─────▶│ Agent Runner │─────▶│  IBM Bob    │
│  (Webhook)  │      │   (Express)  │      │    API      │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  MCP Server  │
                     │   (Tools)    │
                     └──────────────┘
```

## Features

- **Webhook Endpoint**: Receives incident notifications from PagerDuty or other alerting systems
- **IBM Bob Integration**: Invokes IBM Bob's agent with the 10-step autonomous workflow
- **Mock Mode**: Test the entire workflow without making real API calls
- **Retry Logic**: Automatically retries failed agent runs with exponential backoff
- **Health Checks**: Monitor the health of the agent runner and IBM Bob API
- **Duplicate Prevention**: Prevents processing the same incident multiple times
- **Graceful Shutdown**: Waits for active incidents to complete before shutting down

## Installation

```bash
cd packages/agent-runner
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# IBM Bob API Configuration
IBM_BOB_API_KEY=your_ibm_bob_api_key_here
IBM_BOB_REPO_URL=https://github.com/your-org/your-repo
IBM_BOB_BASE_URL=https://api.ibm-bob.com
IBM_BOB_MOCK_MODE=false

# Agent Runner Configuration
AGENT_RUNNER_PORT=5000
AGENT_MAX_RETRIES=3
AGENT_RETRY_DELAY_MS=5000
AGENT_MAX_STEPS=25
MCP_SERVER_URL=http://localhost:4000/mcp
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IBM_BOB_API_KEY` | Your IBM Bob API key | Required |
| `IBM_BOB_REPO_URL` | GitHub repository URL to work on | Required |
| `IBM_BOB_BASE_URL` | IBM Bob API base URL | `https://api.ibm-bob.com` |
| `IBM_BOB_MOCK_MODE` | Enable mock mode for testing | `false` |
| `AGENT_RUNNER_PORT` | Port for the webhook server | `5000` |
| `AGENT_MAX_RETRIES` | Max retries for failed agent runs | `3` |
| `AGENT_RETRY_DELAY_MS` | Delay between retries (ms) | `5000` |
| `AGENT_MAX_STEPS` | Max steps the agent can take | `25` |
| `MCP_SERVER_URL` | URL of the MCP server | `http://localhost:4000/mcp` |

## Usage

### Development Mode

```bash
npm run dev
```

This starts the server with hot-reload using `tsx watch`.

### Production Mode

```bash
npm run build
npm start
```

### Testing with Mock Mode

Enable mock mode to test without IBM Bob API:

```bash
IBM_BOB_MOCK_MODE=true npm run dev
```

In mock mode, the agent will simulate the 10-step workflow with realistic mock data.

## API Endpoints

### POST /webhook/incident

Receives incident notifications and triggers the autonomous agent.

**Request Body:**
```json
{
  "incident_id": "P123456",
  "sentry_issue_id": "1234567890",
  "jira_ticket": "ENG-1234"
}
```

**Response (202 Accepted):**
```json
{
  "status": "accepted",
  "incident_id": "P123456",
  "message": "Incident processing started",
  "timestamp": "2026-05-03T10:00:00.000Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Missing required fields",
  "required": ["incident_id", "sentry_issue_id", "jira_ticket"],
  "received": ["incident_id"]
}
```

### GET /health

Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "agent-runner",
  "version": "1.0.0",
  "timestamp": "2026-05-03T10:00:00.000Z",
  "config": {
    "mcp_server": "http://localhost:4000/mcp",
    "repository": "https://github.com/example/repo",
    "mock_mode": false,
    "max_retries": 3,
    "max_steps": 25
  },
  "active_incidents": 2
}
```

### GET /incidents/active

Get list of currently processing incidents.

**Response:**
```json
{
  "count": 2,
  "incidents": ["P123456", "P789012"]
}
```

### GET /

Root endpoint with service information.

**Response:**
```json
{
  "service": "DevOps Autopilot - Agent Runner",
  "version": "1.0.0",
  "description": "Autonomous incident resolution powered by IBM Bob",
  "endpoints": {
    "webhook": "POST /webhook/incident",
    "health": "GET /health",
    "active": "GET /incidents/active"
  },
  "documentation": "https://github.com/example/devops-autopilot"
}
```

## The 10-Step Autonomous Workflow

When an incident is received, the agent executes these steps:

1. **Understand the Incident** - Fetch alert details from PagerDuty
2. **Get the Stack Trace** - Retrieve error details from Sentry
3. **Read the Broken Code** - Get file contents from GitHub
4. **Design the Fix** - Analyze root cause and plan the solution
5. **Create a Branch** - Create a feature branch for the fix
6. **Commit the Fix** - Commit the code changes
7. **Write Tests** - Add tests to prevent regression
8. **Open a Pull Request** - Create PR with full RCA
9. **Update Jira** - Add comment to the Jira ticket
10. **Notify Stakeholders** - Post summary to Slack

See `src/prompts.ts` for the detailed system prompt that guides the agent.

## Testing

### Manual Testing with cURL

```bash
# Send a test incident
curl -X POST http://localhost:5000/webhook/incident \
  -H "Content-Type: application/json" \
  -d '{
    "incident_id": "P123456",
    "sentry_issue_id": "1234567890",
    "jira_ticket": "ENG-1234"
  }'

# Check health
curl http://localhost:5000/health

# Check active incidents
curl http://localhost:5000/incidents/active
```

### Integration Testing

```bash
npm test
```

## Logging

The agent runner provides detailed logging:

```
[HTTP] POST /webhook/incident 202 - 5ms
[Webhook] 🚨 Incident received: P123456
[Webhook] Sentry Issue: 1234567890
[Webhook] Jira Ticket: ENG-1234
[Agent] 🤖 Starting agent run (attempt 1/3)
[Agent] Incident: P123456
[Agent] Repository: https://github.com/example/repo
[Agent] MCP Server: http://localhost:4000/mcp
[BobClient] 🚀 Starting agent run...
[BobClient] Repository: https://github.com/example/repo
[BobClient] MCP Servers: devops-autopilot
[BobClient] Max Steps: 25
[BobClient] ✅ Agent run completed in 15234ms
[Agent] ✅ Completed in 15234ms
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
[Agent] Incident P123456 processing complete
```

## Error Handling

The agent runner implements robust error handling:

- **Validation Errors**: Returns 400 with clear error messages
- **Duplicate Incidents**: Returns 409 to prevent duplicate processing
- **Agent Failures**: Automatically retries up to `AGENT_MAX_RETRIES` times
- **Timeout Handling**: Gracefully handles long-running agent executions
- **Graceful Shutdown**: Waits for active incidents before shutting down

## Monitoring

Monitor the agent runner using:

1. **Health Endpoint**: `GET /health` - Check service health
2. **Active Incidents**: `GET /incidents/active` - See what's being processed
3. **Logs**: Structured logging for all operations
4. **Metrics**: Track success rate, duration, and error rates

## Deployment

### Docker

```bash
docker build -t devops-autopilot-agent-runner .
docker run -p 5000:5000 --env-file .env devops-autopilot-agent-runner
```

### Docker Compose

```bash
docker-compose up agent-runner
```

## Troubleshooting

### Agent runs fail immediately

- Check `IBM_BOB_API_KEY` is valid
- Verify `MCP_SERVER_URL` is accessible
- Check logs for specific error messages

### Incidents not being processed

- Verify webhook endpoint is accessible
- Check PagerDuty webhook configuration
- Review logs for validation errors

### Mock mode not working

- Ensure `IBM_BOB_MOCK_MODE=true` is set
- Restart the server after changing environment variables

## Development

### Project Structure

```
agent-runner/
├── src/
│   ├── index.ts          # Main Express server
│   ├── bob-client.ts     # IBM Bob API client
│   ├── prompts.ts        # System prompt & workflow
│   └── types.ts          # TypeScript interfaces
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Features

1. Update types in `src/types.ts`
2. Implement logic in `src/index.ts` or `src/bob-client.ts`
3. Update system prompt in `src/prompts.ts` if needed
4. Add tests
5. Update this README

## License

MIT

## Made with Bob

This agent runner was built with assistance from IBM Bob, demonstrating the power of AI-assisted development.