import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    const linkedinData = payload.linkedin;

    if (!linkedinData) {
      return new Response(JSON.stringify({ error: "No linkedin data provided" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use token from environment variable if available, otherwise fallback to hardcoded (for now)
    const token = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "AQWvFP2EUg0vBOSfL9fvBQlIr0Vp0mnT9gCXq1D5EoaViltFw13szyxC-MQDg_rS6GuC_4Iuh6wlLJAlXUVni3ld0cVuMdhJ-6GCVryhdbHG4O2yNElmkSsyLStcBCDXOPtrWXTlnsWN5hi-JmF56ccXMIx4ng9mQhqxLZSkJN-lqSXLLCkbetI44-Yl7T9374kvfgDXBpaTLGsgZM-HwAcDYmeHVNcEiSObPWbiC9L5_rXiJY-ttD64CsT7rdY0S-rSloUoT25MUXhkdYs95Ga4sC5NLJ31mCjAG3sj13kvHAC_P3EMIiFjCCGuLrkbwhpAJsgEG_zFNP67pza-meMA2YNg7Q";

    // Ad Account URN (not strictly required in payload for current CAPI version, but good for reference)
    const accountUrn = "urn:li:sponsorAccount:509096400";

    // Format the conversion event payload for LinkedIn
    // IMPORTANT: The conversion URN prefix for Conversions API MUST be "urn:lla:llaPartnerConversion:"
    const conversionRuleId = "24698092";
    const conversionEvent: any = {
      conversion: `urn:lla:llaPartnerConversion:${conversionRuleId}`,
      conversionHappenedAt: linkedinData.conversion_happened_at || Date.now(),
      eventId: linkedinData.event_id,
      user: {
        userIds: [],
        userInfo: {}
      }
    };

    // Populate user identifiers
    if (linkedinData.user?.email_sha256) {
      conversionEvent.user.userIds.push({
        idType: "SHA256_EMAIL",
        idValue: linkedinData.user.email_sha256
      });
    }

    if (linkedinData.li_fat_id) {
      conversionEvent.user.userIds.push({
        idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID",
        idValue: linkedinData.li_fat_id
      });
    }

    // LinkedIn CAPI requires at least one user identifier
    if (conversionEvent.user.userIds.length === 0) {
      console.warn("[linkedin-conversions] No user identifiers found. Request might be rejected.");
    }

    // Populate user info if available (LEAD events)
    if (linkedinData.user?.first_name) {
      conversionEvent.user.userInfo.firstName = linkedinData.user.first_name;
    }
    if (linkedinData.user?.last_name) {
      conversionEvent.user.userInfo.lastName = linkedinData.user.last_name;
    }
    if (linkedinData.user?.company_name) {
      conversionEvent.user.userInfo.companyName = linkedinData.user.company_name;
    }

    console.log("[linkedin-conversions] Sending to LinkedIn:", JSON.stringify(conversionEvent, null, 2));

    // Call LinkedIn Conversions API
    const response = await fetch('https://api.linkedin.com/rest/conversionEvents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '2024-02',
        'X-Restli-Protocol-Version': '2.0.0',
        'X-Restli-Method': 'create' // Required for some Rest.li collections
      },
      body: JSON.stringify(conversionEvent)
    });

    const result = await response.text();
    console.log("[linkedin-conversions] LinkedIn Response:", response.status, result);

    return new Response(JSON.stringify({ success: response.ok, result: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.ok ? 200 : (response.status === 201 ? 200 : response.status)
    });

  } catch (error: any) {
    console.error("[linkedin-conversions] error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})