import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashStr(text: string | undefined | null) {
  if (!text) return undefined;
  const msgUint8 = new TextEncoder().encode(text.toLowerCase().trim());
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
    const fb_pixel_id = "747197838381810";
    const fb_access_token = Deno.env.get("FB_ACCESS_TOKEN");

    if (!fb_access_token) {
      console.warn("[facebook-conversions] Missing FB_ACCESS_TOKEN secret.");
      return new Response(JSON.stringify({ error: "Missing config" }), { headers: corsHeaders, status: 500 });
    }

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;

    const eventData = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor((payload.conversion_happened_at || Date.now()) / 1000),
          action_source: "website",
          event_id: payload.event_id,
          event_source_url: payload.page_url,
          user_data: {
            client_user_agent: payload.user_agent,
            client_ip_address: clientIp,
            fbc: payload.facebook?.fbc,
            fbp: payload.facebook?.fbp,
            em: payload.email ? [await hashStr(payload.email)] : undefined,
            ph: payload.phone ? [await hashStr(payload.phone)] : undefined,
            fn: payload.facebook?.first_name ? [await hashStr(payload.facebook.first_name)] : undefined,
            ln: payload.facebook?.last_name ? [await hashStr(payload.facebook.last_name)] : undefined,
            external_id: payload.external_id ? [await hashStr(payload.external_id)] : undefined
          }
        }
      ]
    };

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${fb_pixel_id}/events?access_token=${fb_access_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData)
    });

    const fbResData = await fbRes.json();
    console.log("[facebook-conversions] FB API Response:", fbResData);

    return new Response(JSON.stringify({ success: true, fbResData }), { headers: corsHeaders, status: 200 });
  } catch (error) {
    console.error("[facebook-conversions] Error processing webhook:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { headers: corsHeaders, status: 500 });
  }
});