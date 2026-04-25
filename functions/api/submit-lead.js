export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    // Attempt to pull key from Cloudflare Env
    const BREVO_API_KEY = context.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
        return new Response(JSON.stringify({ error: 'Brevo API key not configured in environment' }), { status: 500 });
    }

    const payload = {
      sender: {
        name: "Muktam AI Leads",
        email: "mihirvt@gmail.com"
      },
      to: [
        {
          email: "mihirvt@gmail.com",
          name: "Mihir"
        }
      ],
      subject: `New Lead: ${data.name || 'Unknown'}`,
      htmlContent: `
        <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #333;">New Lead Received from Website</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; width: 150px;"><strong>Name:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.name || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.email || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.phone || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Company:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.company || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Website:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.website || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Category:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.category || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Volume:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.volume || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Source:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.source || 'N/A'}</td></tr>
            </table>

            <h3 style="color: #555;">Attribution Info</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd; width: 150px;"><strong>UTM Source:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.utm_source || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>UTM Medium:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.utm_medium || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>UTM Campaign:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.utm_campaign || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Page URL:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.page_url || 'N/A'}</td></tr>
            </table>
        </div>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Brevo API Error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
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
