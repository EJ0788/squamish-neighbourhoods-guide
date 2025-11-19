// Vercel Serverless Function for Lead Processing (EMAIL ONLY VERSION)
// Path: api/submit-lead.js

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for security
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

  // Validate required fields
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Generate unique access token
  const accessToken = generateAccessToken();
  const gammaUrl = process.env.GAMMA_URL || 'https://new-builds-squamish-the--akehhlj.gamma.site/';
  const accessUrl = `${gammaUrl}?ref=${accessToken}`;

  // Prepare lead data
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
    // Run these in parallel for better performance
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
    console.warn('Lofty API key not configured');
    return;
  }

  const payload = {
    firstName: leadData.firstName,
    lastName: leadData.lastName,
    email: leadData.email,
    emails: [leadData.email],
    source: leadData.source || 'Squamish New Development Guide',
    tags: ['New Development Guide', 'Website Lead', 'Email Only Lead'],
    notes: `Lead captured via email-only form. Access token: ${leadData.accessToken}`
  };

  try {
    const response = await fetch('https://api.lofty.com/v1.0/leads', {
      method: 'POST',
      headers: {
        'Authorization': `token ${loftyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Lofty response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Lofty API error: ${response.status} - ${responseText}`);
    }

    console.log('Lead sent to Lofty successfully');
  } catch (error) {
    console.error('Lofty integration error:', error.message);
  }
}

// ==========================================
// EMAIL DELIVERY
// ==========================================
async function sendAccessEmail(leadData) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Squamish Real Estate <noreply@mail.corridorhomes.ca>',
          to: leadData.email,
          subject: 'Your Squamish Neighbourhood Guide 🏔️',
          html: generateEmailHTML(leadData)
        })
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.status}`);
      }

      console.log('Email sent successfully');
      return;
    } catch (error) {
      console.error('Email sending error:', error);
    }
  }

  console.log('Email would be sent to:', leadData.email);
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
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Your Squamish Neighbourhood Guide is Ready</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Hi ${leadData.firstName},
                  </p>
                  
                  <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Thanks for requesting the Squamish Neighbourhood Guide. Your access link is below.
                  </p>

                  <h3 style="margin: 30px 0 15px 0; color: #1a202c; font-size: 18px; font-weight: 700;">What's Inside:</h3>
                  
                  <p style="margin: 15px 0 8px 0; color: #1a202c; font-size: 16px; font-weight: 600; line-height: 1.6;">
                    Market Intelligence
                  </p>
                  <ul style="color: #2d3748; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; padding-left: 20px;">
                    <li>Q3 2025 pricing trends across all property types</li>
                    <li>Single-family homes averaging $1.67M (up 15% this year)</li>
                    <li>Apartment market surge of 31% in sales activity</li>
                    <li>Price per square foot analysis by neighbourhood</li>
                  </ul>

                  <p style="margin: 15px 0 8px 0; color: #1a202c; font-size: 16px; font-weight: 600; line-height: 1.6;">
                    18+ Neighbourhood Deep Dives
                  </p>
                  <ul style="color: #2d3748; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; padding-left: 20px;">
                    <li>Britannia Beach, Valleycliffe, Downtown Squamish, Sea + Sky, University Heights, Brackendale, and 12 more</li>
                    <li>Real pros and cons for each area</li>
                    <li>Average pricing and inventory trends</li>
                    <li>Best fit for different buyer profiles</li>
                  </ul>

                  <p style="margin: 15px 0 8px 0; color: #1a202c; font-size: 16px; font-weight: 600; line-height: 1.6;">
                    Essential Local Intelligence
                  </p>
                  <ul style="color: #2d3748; font-size: 15px; line-height: 1.7; margin: 0 0 25px 0; padding-left: 20px;">
                    <li>School catchment areas and ratings</li>
                    <li>Best restaurants, cafes, and local hotspots</li>
                    <li>Outdoor recreation access points</li>
                    <li>Shopping, amenities, and transportation details</li>
                    <li>New development projects and growth projections</li>
                  </ul>
                  
                  <p style="margin: 0 0 25px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                    Whether you're comparing neighbourhoods, timing the market, or trying to understand value in different areas — this guide gives you the clarity to move forward.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${leadData.accessUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      Access Your Guide Now
                    </a>
                  </div>
                  
                  <p style="margin: 25px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                    Bookmark this page and reference it anytime. Questions about a specific neighbourhood? Hit reply.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #718096; font-size: 14px;">
                    Eric Johnson | Engel & Völkers Squamish
                  </p>
                  <p style="margin: 5px 0 0 0; color: #718096; font-size: 14px;">
                    www.corridorhomes.ca
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
