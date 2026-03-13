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
    const fb_access_token = Deno.env.get("FB_ACCESS_TOKEN") || "EAAMZAdsviqNABQ0eShhbWQJQtZBZBqaws6eUF5exL5snZBxplsqOdhQXxkjc4SncWESA6P10fme2U6UATJtjMWZCg4sISbpY6raOWHZBzAdiTUKx05saoLkus7uMM43xOb4Q68DngffWL8xQRGqJZBF4tI6pbDpKYMDMtP4SHtxQ96Onj6JrRlULimp7UEPvqgJGgZDZD";

    if (!fb_access_token) {
      console.warn("[facebook-conversions] Missing FB_ACCESS_TOKEN secret.");
      return new Response(JSON.stringify({ error: "Missing config" }), { headers: corsHeaders, status: 500 });
    }

    // Extract correct single IP address if behind multiple proxies
    const rawIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const clientIp = rawIp ? rawIp.split(',')[0].trim() : null;

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
            ct: payload.facebook?.city ? [await hashStr(payload.facebook.city)] : undefined,
            st: payload.facebook?.state ? [await hashStr(payload.facebook.state)] : undefined,
            zp: payload.facebook?.zip ? [await hashStr(payload.facebook.zip)] : undefined,
            country: payload.facebook?.country ? [await hashStr(payload.facebook.country)] : undefined,
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