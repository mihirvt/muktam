// LinkedIn Conversions API endpoint (ported off the dead Supabase project).
// Accepts the existing form payload shape: { linkedin: { ... } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONVERSION_RULE_ID = '24698092';

// Fallback so it keeps working before LINKEDIN_ACCESS_TOKEN is set in Cloudflare.
const FALLBACK_LINKEDIN_TOKEN = 'AQWvFP2EUg0vBOSfL9fvBQlIr0Vp0mnT9gCXq1D5EoaViltFw13szyxC-MQDg_rS6GuC_4Iuh6wlLJAlXUVni3ld0cVuMdhJ-6GCVryhdbHG4O2yNElmkSsyLStcBCDXOPtrWXTlnsWN5hi-JmF56ccXMIx4ng9mQhqxLZSkJN-lqSXLLCkbetI44-Yl7T9374kvfgDXBpaTLGsgZM-HwAcDYmeHVNcEiSObPWbiC9L5_rXiJY-ttD64CsT7rdY0S-rSloUoT25MUXhkdYs95Ga4sC5NLJ31mCjAG3sj13kvHAC_P3EMIiFjCCGuLrkbwhpAJsgEG_zFNP67pza-meMA2YNg7Q';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const data = payload.linkedin || payload;
    const token = context.env.LINKEDIN_ACCESS_TOKEN || FALLBACK_LINKEDIN_TOKEN;

    const event = {
      conversion: `urn:lla:llaPartnerConversion:${CONVERSION_RULE_ID}`,
      conversionHappenedAt: data.conversion_happened_at || Date.now(),
      eventId: data.event_id,
      user: { userIds: [], userInfo: {} },
    };

    if (data.user?.email_sha256) {
      event.user.userIds.push({ idType: 'SHA256_EMAIL', idValue: data.user.email_sha256 });
    }
    if (data.li_fat_id) {
      event.user.userIds.push({ idType: 'LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID', idValue: data.li_fat_id });
    }
    if (data.user?.first_name) event.user.userInfo.firstName = data.user.first_name;
    if (data.user?.last_name) event.user.userInfo.lastName = data.user.last_name;
    if (data.user?.company_name) event.user.userInfo.companyName = data.user.company_name;

    const response = await fetch('https://api.linkedin.com/rest/conversionEvents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '2024-02',
        'X-Restli-Protocol-Version': '2.0.0',
        'X-Restli-Method': 'create',
      },
      body: JSON.stringify(event),
    });

    const result = await response.text();
    console.log('[linkedin-conversions]', response.status, result);

    return new Response(JSON.stringify({ success: response.ok, result }), {
      status: response.ok ? 200 : response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[linkedin-conversions] error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
