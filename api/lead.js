export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, businessType, bottleneck, teamSize } = req.body;

  if (!name || !email || !bottleneck) {
    return res.status(400).json({ error: 'Name, email, and bottleneck description are required.' });
  }

  const results = { hubspot: null, loops: null, notification: null };

  // 1. Create contact in HubSpot
  // Set HUBSPOT_API_KEY in Vercel dashboard
  if (process.env.HUBSPOT_API_KEY) {
    try {
      const hubspotRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            firstname: name,
            email: email,
            company: businessType,
            hs_lead_status: 'NEW',
            bottleneck_description: bottleneck,
            team_size: teamSize,
            lead_source: 'website_bottleneck_form'
          }
        })
      });
      results.hubspot = hubspotRes.ok ? 'created' : 'failed';
    } catch (err) {
      console.error('HubSpot error:', err);
      results.hubspot = 'error';
    }
  } else {
    results.hubspot = 'skipped — HUBSPOT_API_KEY not set';
  }

  // 2. Create contact + trigger sequence in Loops.so
  // Set LOOPS_API_KEY in Vercel dashboard
  if (process.env.LOOPS_API_KEY) {
    try {
      // Create contact
      await fetch('https://app.loops.so/api/v1/contacts/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          firstName: name,
          source: 'bottleneck_form',
          userGroup: 'consulting_leads'
        })
      });

      // Trigger nurture sequence
      await fetch('https://app.loops.so/api/v1/events/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          eventName: 'bottleneck_form_submitted',
          eventProperties: { bottleneck, businessType }
        })
      });

      results.loops = 'created';
    } catch (err) {
      console.error('Loops error:', err);
      results.loops = 'error';
    }
  } else {
    results.loops = 'skipped — LOOPS_API_KEY not set';
  }

  // 3. Send notification email to Jess
  // For now, log the lead. Replace with a transactional email service (Loops, SendGrid, etc.)
  const notificationEmail = process.env.NOTIFICATION_EMAIL || 'jess@jessmartinez.ai';
  console.log(`New lead submission — notify ${notificationEmail}:`, { name, email, businessType, bottleneck, teamSize });
  results.notification = 'logged';

  return res.status(200).json({
    success: true,
    message: "Thanks! I'll review your submission and follow up within 24 hours.",
    results
  });
}
