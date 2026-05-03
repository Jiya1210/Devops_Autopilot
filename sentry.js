"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const index_1 = require("../index");
/**
 * Sentry Tool: get_stack_trace
 *
 * Gets the latest event (stack trace + context) for a Sentry issue using the REST API
 *
 * Environment Variables Required:
 * - SENTRY_AUTH_TOKEN: Sentry authentication token with project read access
 * - SENTRY_ORG: Sentry organization slug
 * - SENTRY_PROJECT: Sentry project slug
 *
 * API Documentation: https://docs.sentry.io/api/
 */
/**
 * Fetches the latest event for a Sentry issue
 */
async function fetchSentryEvent(issueId) {
    const token = process.env.SENTRY_AUTH_TOKEN;
    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;
    if (!token) {
        throw new Error('SENTRY_AUTH_TOKEN environment variable is not set');
    }
    if (!org) {
        throw new Error('SENTRY_ORG environment variable is not set');
    }
    if (!project) {
        throw new Error('SENTRY_PROJECT environment variable is not set');
    }
    // First, get the issue to find the latest event
    const issueResponse = await fetch(`https://sentry.io/api/0/issues/${issueId}/`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!issueResponse.ok) {
        const errorText = await issueResponse.text();
        throw new Error(`Sentry API error fetching issue (${issueResponse.status}): ${errorText}`);
    }
    const issue = await issueResponse.json();
    const latestEventId = issue.lastSeen || issue.firstSeen;
    // Get events for the issue
    const eventsResponse = await fetch(`https://sentry.io/api/0/issues/${issueId}/events/latest/`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        throw new Error(`Sentry API error fetching event (${eventsResponse.status}): ${errorText}`);
    }
    const event = await eventsResponse.json();
    return event;
}
/**
 * Extracts application frames from stack trace
 */
function extractAppFrames(event) {
    const frames = [];
    // Check for exception stack trace
    if (event.entries) {
        for (const entry of event.entries) {
            if (entry.type === 'exception' && entry.data?.values) {
                for (const exception of entry.data.values) {
                    if (exception.stacktrace?.frames) {
                        // Filter for application frames (not library/system frames)
                        const appFrames = exception.stacktrace.frames.filter((frame) => frame.inApp || !frame.filename?.includes('node_modules'));
                        frames.push(...appFrames);
                    }
                }
            }
        }
    }
    return frames;
}
const getStackTraceHandler = async ({ issue_id }) => {
    try {
        // Check if running in mock mode (no token provided)
        const token = process.env.SENTRY_AUTH_TOKEN;
        const org = process.env.SENTRY_ORG;
        const project = process.env.SENTRY_PROJECT;
        if (!token || !org || !project ||
            token === 'your_sentry_auth_token' ||
            org === 'your-sentry-org-slug' ||
            project === 'your-sentry-project-slug') {
            // Return mock data for development/testing
            console.log('[Sentry] Running in mock mode - no valid credentials provided');
            const mockEvent = {
                issue_id: issue_id,
                event_id: 'abc123def456',
                error_type: 'ZeroDivisionError',
                error_value: 'division by zero',
                timestamp: new Date().toISOString(),
                platform: 'node',
                environment: 'production',
                release: 'api-service@1.2.3',
                app_frames: [
                    {
                        filename: 'src/api/order.ts',
                        function: 'calculateTotal',
                        lineno: 42,
                        colno: 25,
                        context_line: '  const unitPrice = price / quantity;',
                        pre_context: [
                            'function calculateTotal(price: number, quantity: number) {',
                            '  // Calculate unit price',
                            '  if (quantity === 0) {'
                        ],
                        post_context: [
                            '  }',
                            '  return unitPrice * quantity;',
                            '}'
                        ],
                        in_app: true,
                        vars: {
                            price: '100',
                            quantity: '0'
                        }
                    },
                    {
                        filename: 'src/api/routes/orders.ts',
                        function: 'handleOrderRequest',
                        lineno: 78,
                        colno: 15,
                        context_line: '  const total = calculateTotal(order.price, order.quantity);',
                        pre_context: [
                            'async function handleOrderRequest(req: Request, res: Response) {',
                            '  const order = req.body;',
                            '  // Calculate order total'
                        ],
                        post_context: [
                            '  await saveOrder({ ...order, total });',
                            '  res.json({ success: true, total });',
                            '}'
                        ],
                        in_app: true
                    }
                ],
                tags: {
                    environment: 'production',
                    server_name: 'api-server-01',
                    transaction: '/api/orders'
                },
                user: {
                    ip_address: '192.168.1.100'
                }
            };
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(mockEvent, null, 2)
                    }]
            };
        }
        // Fetch real event data from Sentry API
        console.log(`[Sentry] Fetching latest event for issue ${issue_id}`);
        const event = await fetchSentryEvent(issue_id);
        // Extract error information
        const errorType = event.entries?.find((e) => e.type === 'exception')
            ?.data?.values?.[0]?.type || 'Unknown';
        const errorValue = event.entries?.find((e) => e.type === 'exception')
            ?.data?.values?.[0]?.value || 'No error message';
        // Extract application frames
        const appFrames = extractAppFrames(event);
        // Format the response
        const eventData = {
            issue_id: issue_id,
            event_id: event.id,
            error_type: errorType,
            error_value: errorValue,
            timestamp: event.dateCreated || event.dateReceived,
            platform: event.platform,
            environment: event.environment,
            release: event.release?.version,
            app_frames: appFrames.map((frame) => ({
                filename: frame.filename || frame.absPath,
                function: frame.function,
                lineno: frame.lineNo,
                colno: frame.colNo,
                context_line: frame.context?.[0] || frame.contextLine,
                pre_context: frame.preContext || [],
                post_context: frame.postContext || [],
                in_app: frame.inApp,
                vars: frame.vars
            })),
            tags: event.tags?.reduce((acc, tag) => {
                acc[tag.key] = tag.value;
                return acc;
            }, {}),
            user: event.user,
            contexts: event.contexts
        };
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(eventData, null, 2)
                }]
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Sentry] Error:', errorMessage);
        return {
            content: [{
                    type: 'text',
                    text: `Error fetching Sentry stack trace: ${errorMessage}`
                }],
            isError: true
        };
    }
};
// @ts-ignore - Bypass deep type instantiation error
index_1.server.tool('get_stack_trace', {
    issue_id: zod_1.z.string().describe('Sentry issue ID (numeric ID from Sentry)')
}, getStackTraceHandler);
console.log('[Tool] get_stack_trace registered');
// Made with Bob
//# sourceMappingURL=sentry.js.map