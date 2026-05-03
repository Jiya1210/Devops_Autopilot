"use strict";
/**
 * Tool Registry
 *
 * This file registers all MCP tools with the server.
 * Tools are imported as side-effects to register themselves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("./tools/pagerduty");
require("./tools/sentry");
require("./tools/github");
require("./tools/jira");
require("./tools/slack");
console.log('[Registry] All tools registered successfully');
// Made with Bob
//# sourceMappingURL=registry.js.map