# DevOps Autopilot

**Zero Touch Test Generation and Maintenance Engine**  
*IBM Bob Hackathon 2026*

## 🎯 Overview

DevOps Autopilot is an autonomous incident resolution system powered by IBM Bob. It automatically detects production incidents, analyzes stack traces, generates fixes, creates tests, and opens pull requests—all without human intervention.

## 🏗️ Architecture

This is a monorepo containing four packages:

### 📦 Packages

1. **`packages/mcp-server`** (Port 4000)
   - MCP (Model Context Protocol) server exposing tools to IBM Bob
   - Tools: PagerDuty alerts, Sentry stack traces, GitHub operations, Jira updates, Slack notifications
   - Transport: SSE (Server-Sent Events) over HTTP

2. **`packages/agent-runner`** (Port 5000)
   - Orchestrates IBM Bob API calls
   - Webhook endpoint: `/webhook/incident`
   - Manages the 10-step incident resolution workflow

3. **`packages/integrations`**
   - Shared API clients for external services
   - Used by MCP server tools
   - Services: GitHub, Sentry, PagerDuty, Jira, Slack

4. **`packages/demo-app`** (Port 3000)
   - Demo application with intentional bugs
   - Integrated with Sentry for error tracking
   - Used for testing the autopilot system

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (for local development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd devops-autopilot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys and configuration
```

### Configuration

Edit `.env` file with your credentials:

- **IBM Bob**: API key and repository URL
- **GitHub**: Personal access token with repo permissions
- **PagerDuty**: API token
- **Sentry**: Auth token, organization, project, and DSN
- **Slack**: Bot token and channel
- **Jira**: Host, email, and API token

### Running Locally

#### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up

# Watch agent logs
docker-compose logs -f agent-runner
```

#### Option 2: Individual Packages

```bash
# Terminal 1: MCP Server
npm run dev:mcp

# Terminal 2: Agent Runner
npm run dev:agent

# Terminal 3: Demo App
npm run dev:demo
```

## 🔄 Incident Resolution Workflow

When a production incident occurs, DevOps Autopilot executes these 10 steps:

1. **Fetch Alert** - Get incident details from PagerDuty
2. **Get Stack Trace** - Retrieve error details from Sentry
3. **Read Code** - Analyze the broken file
4. **Generate Fix** - Create minimal, targeted fix
5. **Create Branch** - `fix/incident-{id}`
6. **Commit Fix** - Push the corrected code
7. **Write Tests** - Generate tests to prevent regression
8. **Open PR** - Create pull request with detailed RCA
9. **Update Jira** - Comment on the ticket with fix details
10. **Notify Slack** - Post summary to #incidents channel

## 🧪 Testing the System

```bash
# Trigger a bug in the demo app
curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{"price": 100, "quantity": 0}'

# Watch the agent logs to see Bob in action
# Check GitHub for the automated PR
# Check Slack for the incident notification
# Check Jira for the ticket update
```


## 🛠️ Development

### Build All Packages

```bash
npm run build
```

## 🤝 Contributing

This project was developed for the IBM Bob Hackathon 2026. Contributions are welcome!

## 📄 License

MIT License - see LICENSE file for details

## 🏆 IBM Bob Hackathon 2026

**Team**: AARYAWART AI
**Challenge**: Zero Touch Test Generation and Maintenance  
**Technology**: IBM Bob + MCP + Multi-Agent Orchestration

---

*Built with ❤️ for autonomous DevOps*
