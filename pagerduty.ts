import { z } from 'zod';
import { server } from '../index';

/**
 * PagerDuty Tool: fetch_alert
 *
 * Fetches full incident details from PagerDuty using the REST API
 *
 * Environment Variables Required:
 * - PAGERDUTY_TOKEN: PagerDuty API token with read access to incidents
 *
 * API Documentation: https://developer.pagerduty.com/api-reference/
 */

/**
 * Fetches incident details from PagerDuty API
 */
async function fetchPagerDutyIncident(incidentId: string): Promise<any> {
  const token = process.env.PAGERDUTY_TOKEN;
  
  if (!token) {
    throw new Error('PAGERDUTY_TOKEN environment variable is not set');
  }

  const response = await fetch(
    `https://api.pagerduty.com/incidents/${incidentId}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.pagerduty+json;version=2',
        'Authorization': `Token token=${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PagerDuty API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as any;
  return data.incident;
}

const fetchAlertHandler = async ({ incident_id }: { incident_id: string }): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> => {
  try {
      // Check if running in mock mode (no token provided)
      const token = process.env.PAGERDUTY_TOKEN;
      
      if (!token || token === 'your_pagerduty_api_token') {
        // Return mock data for development/testing
        console.log('[PagerDuty] Running in mock mode - no valid token provided');
        const mockIncident = {
          id: incident_id,
          type: 'incident',
          title: 'Production API Error - High Error Rate',
          status: 'triggered',
          urgency: 'high',
          service: {
            id: 'PSERVICE1',
            summary: 'api-service',
            type: 'service_reference'
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: 'Error rate exceeded threshold: 500 errors/min in production API service',
          body: {
            type: 'incident_body',
            details: 'Monitoring alert triggered: API error rate is 500 errors/min, exceeding threshold of 100 errors/min. Affected endpoints: /api/orders, /api/payments'
          },
          assignments: [
            {
              assignee: {
                summary: 'On-Call Engineer',
                type: 'user_reference'
              }
            }
          ]
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(mockIncident, null, 2)
          }]
        };
      }

      // Fetch real incident data from PagerDuty API
      console.log(`[PagerDuty] Fetching incident ${incident_id}`);
      const incident = await fetchPagerDutyIncident(incident_id);

      // Extract relevant information
      const incidentData = {
        id: incident.id,
        type: incident.type,
        title: incident.title || incident.summary,
        status: incident.status,
        urgency: incident.urgency,
        service: {
          id: incident.service?.id,
          summary: incident.service?.summary,
          type: incident.service?.type
        },
        created_at: incident.created_at,
        updated_at: incident.updated_at,
        description: incident.description || incident.title,
        body: incident.body,
        assignments: incident.assignments?.map((a: any) => ({
          assignee: {
            summary: a.assignee?.summary,
            type: a.assignee?.type
          }
        })),
        escalation_policy: incident.escalation_policy?.summary,
        teams: incident.teams?.map((t: any) => t.summary)
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(incidentData, null, 2)
        }]
      };
    } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PagerDuty] Error:', errorMessage);
    
    return {
      content: [{
        type: 'text' as const,
        text: `Error fetching PagerDuty incident: ${errorMessage}`
      }],
      isError: true
    };
  }
};

// @ts-ignore - Bypass deep type instantiation error
server.tool(
  'fetch_alert',
  {
    incident_id: z.string().describe('PagerDuty incident ID (e.g., P123456 or PXXXXXX)')
  },
  fetchAlertHandler as any
);

console.log('[Tool] fetch_alert registered');

// Made with Bob
