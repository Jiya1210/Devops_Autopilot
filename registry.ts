/**
 * Tool Registry
 * 
 * This file registers all MCP tools with the server.
 * Tools are imported as side-effects to register themselves.
 */

import './tools/pagerduty';
import './tools/sentry';
import './tools/github';
import './tools/jira';
import './tools/slack';

console.log('[Registry] All tools registered successfully');

// Made with Bob
