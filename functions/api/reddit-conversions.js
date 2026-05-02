export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    try {
        const payload = await context.request.json();
        
        // Use environment variable if set, otherwise fallback to the hardcoded token provided by user
        const redditToken = context.env.REDDIT_ACCESS_TOKEN || "eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjo0OTMzNDg5MDc1LjA4NTI1NSwiaWF0IjoxNzc3NzI5MDc1LjA4NTI1NSwianRpIjoiYlpOX2V4MlJFTmhQcElSY0xmdjJWclgtT3RrTzFnIiwiY2lkIjoiMVExRU96VFBXbll2ZXJocHR2Z1dzUSIsImxpZCI6InQyXzJkamVsaTVrd2siLCJhaWQiOiJ0Ml8yZGplbGk1a3drIiwiYXQiOjUsImxjYSI6MTc3NzcyOTA3NDQyOCwic2NwIjoiZUp5S1ZrcE1LVTdPenl0TExTck96TThyVm9vRkJBQUFfXzlCRmdidSIsImZsbyI6MTAsImxsIjp0cnVlfQ.He9exptuwhr2pDI4BZ_-Ga0PtvGqWW0cFUbxniYmuADtbuZDcJXSvklnrQ_c5l7ghz7m4KemxrVS87LDWGb5WEroVRW_pnG-w8IPPvCN7CjXv3VMEAXeL5_BQ3s67l1fJoCXu_zj4kbpsfZNQd6vkMot2AR9JmRnvBZ9CAhVX19mNuZT_z4QsFqjL-qARjNLOLR6GRy-VKIcpCfsYbuItRxd7aVpCuQJsbmAPUOD57oG5KMfZC27Xe3EAl5vvJtTbaxz-SIKB4lebp4RvwyXi4IFBZJX8T2EWvc0DEIF7OiGq6UF2qBrByIFiuYpKNtcPi3P7caRBOBqM9Sx4MyWug";
        
        const redditData = payload.reddit || payload;
        const eventId = redditData.event_id || redditData.deduplication_key;
        const submittedAtMs = redditData.conversion_happened_at || Date.now();
        
        const ip = context.request.headers.get('CF-Connecting-IP') || context.request.headers.get('X-Forwarded-For');
        const userAgent = context.request.headers.get('User-Agent');

        // Build the conversion events payload according to Reddit Docs
        const conversionPayload = {
            // "test_mode": true, // Uncomment if you want to test without polluting live ad data
            "events": [
                {
                    "event_at": submittedAtMs,
                    "action_source": "website",
                    "type": {
                        "tracking_type": "Lead"
                    },
                    "user": {
                        "ip_address": ip,
                        "user_agent": userAgent,
                        "email": redditData.user?.email || null,
                        "phone_number": redditData.user?.phone || null,
                        "external_id": redditData.external_id || null
                    },
                    "metadata": {
                        "conversion_id": eventId
                    }
                }
            ]
        };

        // Filter out null values in user object
        if (!conversionPayload.events[0].user.email) delete conversionPayload.events[0].user.email;
        if (!conversionPayload.events[0].user.phone_number) delete conversionPayload.events[0].user.phone_number;
        if (!conversionPayload.events[0].user.external_id) delete conversionPayload.events[0].user.external_id;
        if (!conversionPayload.events[0].user.ip_address) delete conversionPayload.events[0].user.ip_address;
        if (!conversionPayload.events[0].user.user_agent) delete conversionPayload.events[0].user.user_agent;

        const response = await fetch('https://ads-api.reddit.com/api/v3/pixels/a2_ixvl5g5kxanc/conversion_events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${redditToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(conversionPayload)
        });

        const result = await response.text();

        return new Response(JSON.stringify({ success: response.ok, result: result }), {
            status: response.ok ? 200 : response.status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            }
        });
    }
}
