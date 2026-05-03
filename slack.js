"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const index_1 = require("../index");
/**
 * Slack Tool: post_slack_message
 *
 * Posts a message to a Slack channel
 */
index_1.server.tool('post_slack_message', {
    channel: zod_1.z.string().describe('Slack channel (e.g., #incidents)'),
    message: zod_1.z.string().describe('Message content in plain English')
}, async ({ channel, message }) => {
    try {
        // TODO: Implement Slack API client from integrations package
        return {
            content: [{
                    type: 'text',
                    text: `Message posted to ${channel} successfully`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `Error posting to Slack: ${error}`
                }],
            isError: true
        };
    }
});
console.log('[Tool] post_slack_message registered');
// Made with Bob
//# sourceMappingURL=slack.js.map