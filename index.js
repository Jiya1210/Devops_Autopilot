"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const bob_client_1 = require("./bob-client");
const prompts_1 = require("./prompts");
// Load environment variables
dotenv_1.default.config({ path: '../../.env' });
const app = (0, express_1.default)();
const PORT = process.env.AGENT_RUNNER_PORT || 5000;
const MAX_RETRIES = parseInt(process.env.AGENT_MAX_RETRIES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.AGENT_RETRY_DELAY_MS || '5000', 10);
// Middleware
app.use(express_1.default.json());
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
});
// Initialize Bob client with mock mode support
const bobClient = new bob_client_1.BobClient(process.env.IBM_BOB_API_KEY || 'placeholder-api-key', process.env.IBM_BOB_BASE_URL, process.env.IBM_BOB_MOCK_MODE === 'true');
// Track active incidents to prevent duplicate processing
const activeIncidents = new Set();
/**
 * Webhook endpoint for incident notifications
 *
 * This endpoint receives webhooks from PagerDuty (or other alerting systems)
 * and triggers the autonomous agent workflow.
 */
app.post('/webhook/incident', async (req, res) => {
    const payload = req.body;
    // Validate required fields
    if (!payload.incident_id || !payload.sentry_issue_id || !payload.jira_ticket) {
        console.error('[Webhook] Invalid payload received:', payload);
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['incident_id', 'sentry_issue_id', 'jira_ticket'],
            received: Object.keys(payload)
        });
    }
    // Check for duplicate processing
    if (activeIncidents.has(payload.incident_id)) {
        console.warn(`[Webhook] Duplicate incident ignored: ${payload.incident_id}`);
        return res.status(409).json({
            error: 'Incident already being processed',
            incident_id: payload.incident_id
        });
    }
    console.log(`[Webhook] 🚨 Incident received: ${payload.incident_id}`);
    console.log(`[Webhook] Sentry Issue: ${payload.sentry_issue_id}`);
    console.log(`[Webhook] Jira Ticket: ${payload.jira_ticket}`);
    // Mark incident as active
    activeIncidents.add(payload.incident_id);
    // Acknowledge immediately — don't block the webhook sender
    res.status(202).json({
        status: 'accepted',
        incident_id: payload.incident_id,
        message: 'Incident processing started',
        timestamp: new Date().toISOString()
    });
    // Run agent async with error handling
    runAgentWithRetry(payload)
        .catch(err => {
        console.error(`[Agent] Fatal error for ${payload.incident_id}:`, err);
    })
        .finally(() => {
        // Remove from active set when done
        activeIncidents.delete(payload.incident_id);
        console.log(`[Agent] Incident ${payload.incident_id} processing complete`);
    });
});
/**
 * Run the IBM Bob agent with retry logic
 */
async function runAgentWithRetry(payload, attempt = 1) {
    const startTime = Date.now();
    try {
        console.log(`[Agent] 🤖 Starting agent run (attempt ${attempt}/${MAX_RETRIES})`);
        console.log(`[Agent] Incident: ${payload.incident_id}`);
        const result = await runAgent(payload);
        const duration = Date.now() - startTime;
        console.log(`[Agent] ✅ Completed in ${duration}ms`);
        console.log(`[Agent] Steps executed: ${result.steps.length}`);
        console.log(`[Agent] Status: ${result.status}`);
        // Log step summary
        if (result.steps.length > 0) {
            console.log('[Agent] Step summary:');
            result.steps.forEach((step, idx) => {
                console.log(`  ${idx + 1}. ${step.tool || 'unknown'} - ${step.duration_ms || 0}ms`);
            });
        }
        // Check if agent completed successfully
        if (result.status === 'failed' && attempt < MAX_RETRIES) {
            console.warn(`[Agent] ⚠️  Agent failed, retrying in ${RETRY_DELAY_MS}ms...`);
            await delay(RETRY_DELAY_MS);
            return runAgentWithRetry(payload, attempt + 1);
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Agent] ❌ Error after ${duration}ms:`, error);
        // Retry on failure
        if (attempt < MAX_RETRIES) {
            console.warn(`[Agent] Retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            await delay(RETRY_DELAY_MS);
            return runAgentWithRetry(payload, attempt + 1);
        }
        // Max retries exhausted
        console.error(`[Agent] Max retries (${MAX_RETRIES}) exhausted for ${payload.incident_id}`);
        throw error;
    }
}
/**
 * Run the IBM Bob agent for incident resolution
 */
async function runAgent(payload) {
    const userMessage = (0, prompts_1.createIncidentMessage)(payload);
    const repoUrl = process.env.IBM_BOB_REPO_URL || 'https://github.com/example/repo';
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp';
    console.log(`[Agent] Repository: ${repoUrl}`);
    console.log(`[Agent] MCP Server: ${mcpServerUrl}`);
    const result = await bobClient.runAgent({
        system: prompts_1.SYSTEM_PROMPT,
        repositoryUrl: repoUrl,
        userMessage,
        mcpServers: [
            {
                url: mcpServerUrl,
                name: 'devops-autopilot'
            }
        ],
        maxSteps: parseInt(process.env.AGENT_MAX_STEPS || '25', 10)
    });
    return result;
}
/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        service: 'agent-runner',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {
            mcp_server: process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp',
            repository: process.env.IBM_BOB_REPO_URL || 'not configured',
            mock_mode: process.env.IBM_BOB_MOCK_MODE === 'true',
            max_retries: MAX_RETRIES,
            max_steps: parseInt(process.env.AGENT_MAX_STEPS || '25', 10)
        },
        active_incidents: activeIncidents.size
    };
    // Check Bob API health if not in mock mode
    if (process.env.IBM_BOB_MOCK_MODE !== 'true') {
        try {
            const bobHealthy = await bobClient.healthCheck();
            health.status = bobHealthy ? 'healthy' : 'degraded';
        }
        catch (error) {
            health.status = 'degraded';
            console.error('[Health] Bob API health check failed:', error);
        }
    }
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});
/**
 * Get active incidents
 */
app.get('/incidents/active', (req, res) => {
    res.json({
        count: activeIncidents.size,
        incidents: Array.from(activeIncidents)
    });
});
/**
 * Root endpoint
 */
app.get('/', (req, res) => {
    res.json({
        service: 'DevOps Autopilot - Agent Runner',
        version: '1.0.0',
        description: 'Autonomous incident resolution powered by IBM Bob',
        endpoints: {
            webhook: 'POST /webhook/incident',
            health: 'GET /health',
            active: 'GET /incidents/active'
        },
        documentation: 'https://github.com/example/devops-autopilot'
    });
});
/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});
/**
 * Utility function to add delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Graceful shutdown handler
 */
process.on('SIGTERM', () => {
    console.log('[Agent Runner] SIGTERM received, shutting down gracefully...');
    if (activeIncidents.size > 0) {
        console.log(`[Agent Runner] Waiting for ${activeIncidents.size} active incidents to complete...`);
    }
    // Give active incidents time to complete (max 30 seconds)
    setTimeout(() => {
        console.log('[Agent Runner] Shutdown complete');
        process.exit(0);
    }, 30000);
});
// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🤖 DevOps Autopilot - Agent Runner');
    console.log('='.repeat(60));
    console.log(`[Agent Runner] Server running on port ${PORT}`);
    console.log(`[Agent Runner] Webhook: http://localhost:${PORT}/webhook/incident`);
    console.log(`[Agent Runner] Health: http://localhost:${PORT}/health`);
    console.log(`[Agent Runner] MCP Server: ${process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp'}`);
    console.log(`[Agent Runner] Mock Mode: ${process.env.IBM_BOB_MOCK_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`[Agent Runner] Max Retries: ${MAX_RETRIES}`);
    console.log('='.repeat(60));
});
// Made with Bob
//# sourceMappingURL=index.js.map