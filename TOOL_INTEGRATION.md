# Tool Integration Guide

## Overview

This document explains how the MCP server tools integrate with external services using environment variables from `.env`.

## Phase 3: Tool Integration Status ✅

### Implemented Tools

#### 1. `fetch_alert` (PagerDuty)
**File:** `src/tools/pagerduty.ts`

**Purpose:** Fetches full incident details from PagerDuty including title, status, service, urgency, and description.

**Environment Variables:**
- `PAGERDUTY_TOKEN` - PagerDuty API token with read access to incidents

**API Endpoint:** `https://api.pagerduty.com/incidents/{incident_id}`

**Input Schema:**
```typescript
{
  incident_id: string  // e.g., "P123456" or "PXXXXXX"
}
```

**Output:** JSON object containing:
- `id` - Incident ID
- `title` - Incident title
- `status` - Current status (triggered, acknowledged, resolved)
- `urgency` - Urgency level (high, low)
- `service` - Service information
- `created_at` - Creation timestamp
- `description` - Incident description
- `body` - Detailed incident body
- `assignments` - Assigned users
- `escalation_policy` - Escalation policy
- `teams` - Associated teams

**Mock Mode:** If `PAGERDUTY_TOKEN` is not set or equals `your_pagerduty_api_token`, returns mock data for testing.

**Example Usage:**
```json
{
  "incident_id": "P123456"
}
```

---

#### 2. `get_stack_trace` (Sentry)
**File:** `src/tools/sentry.ts`

**Purpose:** Retrieves the latest event (stack trace + context) for a Sentry issue, including error type, message, and code context.

**Environment Variables:**
- `SENTRY_AUTH_TOKEN` - Sentry authentication token with project read access
- `SENTRY_ORG` - Sentry organization slug
- `SENTRY_PROJECT` - Sentry project slug

**API Endpoints:**
- `https://sentry.io/api/0/issues/{issue_id}/` - Get issue details
- `https://sentry.io/api/0/issues/{issue_id}/events/latest/` - Get latest event

**Input Schema:**
```typescript
{
  issue_id: string  // Numeric Sentry issue ID
}
```

**Output:** JSON object containing:
- `issue_id` - Issue ID
- `event_id` - Event ID
- `error_type` - Exception type (e.g., "ZeroDivisionError")
- `error_value` - Error message
- `timestamp` - Event timestamp
- `platform` - Platform (e.g., "node", "python")
- `environment` - Environment (e.g., "production")
- `release` - Release version
- `app_frames` - Array of application stack frames with:
  - `filename` - Source file path
  - `function` - Function name
  - `lineno` - Line number
  - `colno` - Column number
  - `context_line` - The actual line of code
  - `pre_context` - Lines before the error
  - `post_context` - Lines after the error
  - `in_app` - Whether it's application code
  - `vars` - Local variables at the time of error
- `tags` - Event tags
- `user` - User information
- `contexts` - Additional context

**Mock Mode:** If credentials are not set or equal placeholder values, returns mock data for testing.

**Example Usage:**
```json
{
  "issue_id": "1234567890"
}
```

---

## Tool Registration

All tools are registered in `src/registry.ts` through side-effect imports:

```typescript
import './tools/pagerduty';  // Registers fetch_alert
import './tools/sentry';     // Registers get_stack_trace
import './tools/github';     // Registers GitHub tools
import './tools/jira';       // Registers update_jira_ticket
import './tools/slack';      // Registers post_slack_message
```

The registry is imported by `src/index.ts` during server initialization, making all tools available to the MCP server.

## Environment Variable Configuration

### Setup Instructions

1. Copy `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```

2. Configure PagerDuty:
   ```env
   PAGERDUTY_TOKEN=your_actual_pagerduty_api_token
   ```
   - Get token from: PagerDuty → Configuration → API Access → Create API Key
   - Required permissions: Read access to incidents

3. Configure Sentry:
   ```env
   SENTRY_AUTH_TOKEN=your_actual_sentry_auth_token
   SENTRY_ORG=your-actual-org-slug
   SENTRY_PROJECT=your-actual-project-slug
   ```
   - Get token from: Sentry → Settings → Account → API → Auth Tokens
   - Required scopes: `project:read`, `event:read`
   - Find org/project slugs in your Sentry URL: `https://sentry.io/organizations/{org}/projects/{project}/`

### Environment Variable Loading

The MCP server loads environment variables in `src/index.ts`:

```typescript
import dotenv from 'dotenv';

// Load environment variables from ../../.env (project root)
dotenv.config({ path: '../../.env' });
```

This ensures all tools have access to the configured credentials.

## Error Handling

Both tools implement comprehensive error handling:

1. **Missing Credentials:** Returns clear error messages indicating which environment variable is missing
2. **API Errors:** Catches and reports HTTP errors with status codes and error messages
3. **Mock Mode:** Automatically falls back to mock data when credentials are not configured
4. **Type Safety:** Uses Zod schemas for input validation

## Testing

### Mock Mode Testing

Both tools support mock mode for testing without real API credentials:

```bash
# Run with mock data (no .env configuration needed)
npm run dev
```

The tools will detect missing/placeholder credentials and return realistic mock data.

### Real API Testing

```bash
# Configure .env with real credentials
# Then run the server
npm run dev
```

Test the tools using the agent-runner or directly via MCP protocol.

## Integration Flow

```
┌─────────────────┐
│  Agent Runner   │
│   (IBM Bob)     │
└────────┬────────┘
         │
         │ MCP Protocol (SSE)
         │
         ▼
┌─────────────────┐
│   MCP Server    │
│  (Port 4000)    │
└────────┬────────┘
         │
         │ Tool Calls
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│PagerDuty│ │ Sentry  │
│   API   │ │   API   │
└─────────┘ └─────────┘
```

1. Agent Runner (IBM Bob) connects to MCP Server via SSE
2. Agent discovers available tools through MCP protocol
3. Agent calls tools with required parameters
4. Tools use environment variables to authenticate with external APIs
5. Tools return formatted responses to the agent

## Next Steps

- **Phase 4:** Implement remaining tools (GitHub, Jira, Slack) with real API integration
- **Phase 5:** Create integration tests for all tools
- **Phase 6:** Add rate limiting and caching for API calls
- **Phase 7:** Implement webhook support for real-time updates

## Troubleshooting

### Common Issues

1. **"PAGERDUTY_TOKEN environment variable is not set"**
   - Ensure `.env` file exists in project root
   - Verify `PAGERDUTY_TOKEN` is set in `.env`
   - Restart the MCP server after updating `.env`

2. **"Sentry API error (401)"**
   - Check that `SENTRY_AUTH_TOKEN` is valid
   - Verify token has required scopes (`project:read`, `event:read`)
   - Ensure org and project slugs are correct

3. **"Error fetching incident: 404"**
   - Verify the incident ID format (should be like "P123456")
   - Ensure the incident exists in your PagerDuty account
   - Check that the API token has access to the incident's service

## API Documentation References

- **PagerDuty API:** https://developer.pagerduty.com/api-reference/
- **Sentry API:** https://docs.sentry.io/api/
- **MCP Protocol:** https://modelcontextprotocol.io/

---

**Made with Bob** 🤖