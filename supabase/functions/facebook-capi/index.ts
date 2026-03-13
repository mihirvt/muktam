import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PIXEL_ID = "747197838381810";
const ACCESS_TOKEN = "EAAMZAdsviqNABQ0eShhbWQJQtZBZBqaws6eUF5exL5snZBxplsqOdhQXxkjc4SncWESA6P10fme2U6UATJtjMWZCg4sISbpY6raOWHZBzAdiTUKx05saoLkus7uMM43xOb4Q68DngffWL8xQRGqJZBF4tI6pbDpKYMDMtP4SHtxQ96Onj6JrRlULimp7UEPvqgJGgZDZD";

async function sha256Hash(string: string): Promise<string> {
    const data = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    const fbData = payload.facebook;

    if (!fbData) {
      return new Response(JSON.stringify({ error: "No facebook data provided" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userData: any = {
      client_ip_address: fbData.client_ip_address || "0.0.0.0", // Fallback if IP is not provided
      client_user_agent: fbData.client_user_agent,
    };
    
    if(fbData.user?.email) {
        userData.em = [await sha256Hash(fbData.user.email.trim().toLowerCase())];
    }
    
    if(fbData.user?.phone) {
        // Phone numbers must be hashed and formatted correctly (digits only, with country code)
         userData.ph = [await sha256Hash(fbData.user.phone.replace(/[^\d]/g, ''))];
    }

    if(fbData.user?.first_name) {
         userData.fn = [await sha256Hash(fbData.user.first_name.trim().toLowerCase())];
    }

    if(fbData.user?.last_name) {
         userData.ln = [await sha256Hash(fbData.user.last_name.trim().toLowerCase())];
    }

    if (fbData.external_id) {
        userData.external_id = [await sha256Hash(fbData.external_id)];
    }

    if (fbData.fbp) userData.fbp = fbData.fbp;
    if (fbData.fbc) userData.fbc = fbData.fbc;

    const event = {
      event_name: "Lead",
      event_time: Math.floor((fbData.conversion_happened_at || Date.now()) / 1000), // Meta expects seconds
      action_source: "website",
      event_id: fbData.event_id,
      event_source_url: fbData.page_url,
      user_data: userData,
    };

    const capiPayload = {
      data: [event],
      // test_event_code: "TEST12345" // Uncomment and replace for testing if needed
    };

    console.log("[facebook-capi] Sending to Facebook:", capiPayload);

    const response = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(capiPayload)
    });

    const result = await response.json();
    console.log("[facebook-capi] Facebook Response:", response.status, result);

    if(!response.ok) {
        throw new Error(JSON.stringify(result));
    }

    return new Response(JSON.stringify({ success: true, result: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[facebook-capi] error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})