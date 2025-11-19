// Vercel Serverless Function for Lead Processing (EMAIL ONLY - NEIGHBOURHOOD GUIDE)
// Path: api/submit-lead.js

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    return await handleLeadSubmission(req, res);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ==========================================
// LEAD SUBMISSION HANDLER
// ==========================================
async function handleLeadSubmission(req, res) {
  const { firstName, lastName, email, source, timestamp } = req.body;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const accessToken = generateAccessToken();
  const gammaUrl = process.env.GAMMA_URL || 'https://squamish-neighbourhood-g-b51q0ml.gamma.site/';
  const accessUrl = `${gammaUrl}?ref=${accessToken}`;

  const leadData = {
    firstName,
    lastName,
    email,
    source,
    timestamp,
    accessToken,
    accessUrl
  };

  try {
    await Promise.all([
      sendToLofty(leadData),
      sendAccessEmail(leadData)
    ]);

    return res.status(200).json({
      success: true,
      accessUrl,
      message: 'Lead processed successfully'
    });
  } catch (error) {
    console.error('Lead processing error:', error);
    return res.status(500).json({ error: 'Failed to process lead' });
  }
}

// ==========================================
// LOFTY CRM INTEGRATION
// ==========================================
async function sendToLofty(leadData) {
  const loftyApiKey = process.env.LOFTY_API_KEY;
  
  if (!loftyApiKey) {
    console.warn('Lofty API key not configured - skipping CRM integration');
    return;
  }

  try {
    const response = await fetch('https://api.lofty.com/v1.0/leads', {
      method: 'POST',
      headers: {
        'Authorization': `token ${loftyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.email,
        emails: [leadData.email],
        source: leadData.source || 'Squamish Neighbourhoods Guide 2025',
        tags: ['Website Lead', 'Neighbourhood Guide', 'Squamish', 'Email Only Lead'],
        notes: `Downloaded neighbourhood guide on ${new Date(leadData.timestamp).toLocaleDateString()}. Access token: ${leadData.accessToken}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lofty API error:', response.status, errorText);
      throw new Error(`Lofty API error: ${response.status}`);
    }

    console.log('Lead sent to Lofty successfully');
  } catch (error) {
    console.error('Lofty integration error:', error);
    // Don't throw - still send email even if Lofty fails
  }
}

// ==========================================
// EMAIL DELIVERY (RESEND)
// ==========================================
async function sendAccessEmail(leadData) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn('Resend API key not configured - skipping email');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Eric Johnson | Squamish Real Estate <noreply@mail.corridorhomes.ca>',
        to: leadData.email,
        subject: '🏔️ Your Squamish Neighbourhood Guide is Ready',
        html: generateEmailHTML(leadData)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      throw new Error(`Resend API error: ${response.status}`);
    }

    console.log('Email sent successfully to:', leadData.email);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
}

// ==========================================
// EMAIL TEMPLATE
// ==========================================
function generateEmailHTML(leadData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7fafc;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">🏔️ Your Guide is Ready!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Squamish Neighbourhoods Simplified</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Hi ${leadData.firstName},
                  </p>
                  
                  <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Thanks for downloading the Squamish Neighbourhood Guide! Your comprehensive 20+ page guide is ready with:
                  </p>
                  
                  <ul style="color: #2d3748; font-size: 16px; line-height: 1.8; margin: 0 0 30px 0;">
                    <li>Deep dives into all 18+ neighbourhoods</li>
                    <li>Q3 2025 market data and pricing trends</li>
                    <li>School ratings and family insights</li>
                    <li>Local favorites and hidden gems</li>
                    <li>Investment analysis and future projections</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${leadData.accessUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      Access Your Guide Now
                    </a>
                  </div>
                  
                  <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                    <strong>Questions about specific neighbourhoods?</strong> I'm here to help you find the perfect fit. Feel free to reach out anytime at 604.828.5704 or just reply to this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #2d3748; font-size: 14px; font-weight: 600;">
                    Eric Johnson | REALTOR®
                  </p>
                  <p style="margin: 5px 0; color: #718096; font-size: 14px;">
                    Engel & Völkers Squamish/Whistler
                  </p>
                  <p style="margin: 10px 0 0 0; color: #718096; font-size: 14px;">
                    604.828.5704 | info@corridorhomes.ca
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function generateAccessToken() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
}
