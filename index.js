"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config({ path: '../../.env' });
const app = (0, express_1.default)();
const PORT = process.env.MCP_SERVER_PORT || 4000;
// Initialize MCP Server
exports.server = new mcp_js_1.McpServer({
    name: 'devops-autopilot',
    version: '1.0.0'
});
// Register all tools
require("./registry");
// SSE endpoint — IBM Bob connects here
app.get('/mcp', async (req, res) => {
    console.log('[MCP Server] Client connected via SSE');
    const transport = new sse_js_1.SSEServerTransport('/mcp/message', res);
    await exports.server.connect(transport);
});
// Message endpoint — Bob sends tool calls here
app.post('/mcp/message', express_1.default.json(), async (req, res) => {
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
//# sourceMappingURL=index.js.map