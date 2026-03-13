import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Facebook requires user data to be SHA256 hashed
async function hashValue(value?: string, isPhone = false) {
  if (!value) return undefined;
  
  let normalized = value.trim().toLowerCase();
  
  if (isPhone) {
    // Facebook requires phone numbers to include country code and contain digits only
    normalized = normalized.replace(/\D/g, ''); 
  }
  
  if (!normalized) return undefined;

  const msgUint8 = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json();

    // Use environment variable if set, otherwise fallback to the provided token
    const accessToken = Deno.env.get("FB_ACCESS_TOKEN") || "EAAMZAdsviqNABQ0eShhbWQJQtZBZBqaws6eUF5exL5snZBxplsqOdhQXxkjc4SncWESA6P10fme2U6UATJtjMWZCg4sISbpY6raOWHZBzAdiTUKx05saoLkus7uMM43xOb4Q68DngffWL8xQRGqJZBF4tI6pbDpKYMDMtP4SHtxQ96Onj6JrRlULimp7UEPvqgJGgZDZD";
    const pixelId = "747197838381810";

    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined;
    const userData = payload.user_data || {};

    // Hash the required PII fields for Facebook
    const em = await hashValue(userData.em);
    const ph = await hashValue(userData.ph, true);
    const fn = await hashValue(userData.fn);
    const ln = await hashValue(userData.ln);
    const external_id = await hashValue(userData.external_id);

    // Construct the Facebook CAPI Event Payload
    const fbEvent = {
      data: [
        {
          event_name: payload.event_name || "Lead",
          event_time: payload.event_time || Math.floor(Date.now() / 1000),
          action_source: "website",
          event_id: payload.event_id,
          user_data: {
            client_ip_address: clientIpAddress,
            client_user_agent: userData.client_user_agent,
            fbp: userData.fbp,
            fbc: userData.fbc,
            em: em ? [em] : undefined,
            ph: ph ? [ph] : undefined,
            fn: fn ? [fn] : undefined,
            ln: ln ? [ln] : undefined,
            external_id: external_id ? [external_id] : undefined
          },
          custom_data: payload.custom_data || {}
        }
      ]
    };

    console.log("[facebook-capi] Sending event to Meta API:", JSON.stringify(fbEvent));

    const fbResponse = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fbEvent)
    });

    const fbResult = await fbResponse.json();
    console.log("[facebook-capi] Meta API Response:", fbResponse.status, JSON.stringify(fbResult));

    return new Response(JSON.stringify({ success: fbResponse.ok, result: fbResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: fbResponse.ok ? 200 : fbResponse.status
    });

  } catch (error: any) {
    console.error("[facebook-capi] Error processing event:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})