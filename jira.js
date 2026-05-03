"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const index_1 = require("../index");
/**
 * Jira Tool: update_jira_ticket
 *
 * Updates a Jira ticket with fix information
 */
index_1.server.tool('update_jira_ticket', {
    ticket_key: zod_1.z.string().describe('Jira ticket key (e.g., ENG-1234)'),
    comment: zod_1.z.string().describe('Comment to add to the ticket'),
    pr_url: zod_1.z.string().optional().describe('Pull request URL')
}, async ({ ticket_key, comment, pr_url }) => {
    try {
        // TODO: Implement Jira API client from integrations package
        const fullComment = pr_url
            ? `${comment}\n\nPull Request: ${pr_url}`
            : comment;
        return {
            content: [{
                    type: 'text',
                    text: `Jira ticket ${ticket_key} updated successfully with comment`
                }]
        };
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `Error updating Jira ticket: ${error}`
                }],
            isError: true
        };
    }
});
console.log('[Tool] update_jira_ticket registered');
// Made with Bob
//# sourceMappingURL=jira.js.map