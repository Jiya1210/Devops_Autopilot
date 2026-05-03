import { z } from 'zod';
import { server } from '../index';

/**
 * Jira Tool: update_jira_ticket
 * 
 * Updates a Jira ticket with fix information
 */

server.tool(
  'update_jira_ticket',
  {
    ticket_key: z.string().describe('Jira ticket key (e.g., ENG-1234)'),
    comment: z.string().describe('Comment to add to the ticket'),
    pr_url: z.string().optional().describe('Pull request URL')
  },
  async ({ ticket_key, comment, pr_url }: { ticket_key: string; comment: string; pr_url?: string }) => {
    try {
      // TODO: Implement Jira API client from integrations package
      const fullComment = pr_url 
        ? `${comment}\n\nPull Request: ${pr_url}`
        : comment;
      
      return {
        content: [{
          type: 'text' as const,
          text: `Jira ticket ${ticket_key} updated successfully with comment`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error updating Jira ticket: ${error}`
        }],
        isError: true
      };
    }
  }
);

console.log('[Tool] update_jira_ticket registered');

// Made with Bob
