import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env' });

const app = express();
const PORT = process.env.MCP_SERVER_PORT || 4000;

// Initialize MCP Server
export const server = new McpServer({
  name: 'devops-autopilot',
  version: '1.0.0'
});

// Register all tools
import './registry';

// SSE endpoint — IBM Bob connects here
app.get('/mcp', async (req, res) => {
  console.log('[MCP Server] Client connected via SSE');
  const transport = new SSEServerTransport('/mcp/message', res);
  await server.connect(transport);
});

// Message endpoint — Bob sends tool calls here
app.post('/mcp/message', express.json(), async (req, res) => {
  console.log('[MCP Server] Received message:', req.body);
  // SSEServerTransport handles this internally
  res.status(200).json({ status: 'received' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mcp-server' });
});

app.listen(PORT, () => {
  console.log(`[MCP Server] Running on port ${PORT}`);
  console.log(`[MCP Server] SSE endpoint: http://localhost:${PORT}/mcp`);
});

// Made with Bob
