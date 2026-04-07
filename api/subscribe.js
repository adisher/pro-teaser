// api/subscribe.js
// 1. Saves email to Resend Contacts audience (always attempted)
// 2. Sends confirmation email (attempted, never fails the response)
// 3. Returns { ok, emailSent } so frontend can show staged messages

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body ?? {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Invalid email address.',
      userMessage: 'That doesn\'t look like a valid email.',
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({
      error: 'Server misconfiguration.',
      userMessage: 'Something went wrong on our end. Try again in a bit.',
    });
  }

  // ── 1. Save to Resend Contacts ────────────────────────────────────────────
  if (audienceId) {
    try {
      const contactRes = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        }
      );

      if (!contactRes.ok) {
        const body = await contactRes.json().catch(() => ({}));
        if (contactRes.status !== 409) {
          // 409 = already exists, not an error
          console.error('Resend Contacts error:', body);
        }
      }
    } catch (err) {
      // Don't fail the whole request if contact save fails
      console.error('Resend Contacts exception:', err);
    }
  } else {
    console.warn('RESEND_AUDIENCE_ID not set — skipping contact save');
  }

  // ── 2. Send confirmation email ────────────────────────────────────────────
  // emailSent flag tells the frontend whether to show the confirmation line
  let emailSent = false;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Adil Sher <hello@adilsher.pro>',
        to: [email],
        reply_to: 'hello@adilsher.pro',
        subject: "You're first in line.",
        html: confirmationHtml(email),
        text: confirmationText(email),
      }),
    });

    if (emailRes.ok) {
      emailSent = true;
    } else {
      const body = await emailRes.json().catch(() => ({}));
      // Log the real error but don't surface it to the user
      console.error('Resend send error:', body);
    }
  } catch (err) {
    console.error('Resend send exception:', err);
  }

  // ── 3. Always return success if contact was at least attempted ────────────
  // The user is on the list regardless of whether the confirmation email sent
  return res.status(200).json({ ok: true, emailSent });
}

// ── HTML email ────────────────────────────────────────────────────────────────

function confirmationHtml(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>You're first in line.</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0e;font-family:'Inter',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:48px 24px;">
      <table width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;">

        <tr>
          <td style="padding-bottom:28px;border-bottom:1px solid rgba(240,237,232,0.08);">
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(240,237,232,0.3);font-weight:500;">adilsher.pro</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 0 12px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c0392b;font-weight:500;">Early access</p>
            <h1 style="margin:0;font-size:36px;font-weight:300;line-height:1.1;color:#f0ede8;font-family:Georgia,'Times New Roman',serif;">You're first<br><em>in line.</em></h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 0;">
            <div style="width:28px;height:1px;background:#c0392b;"></div>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:36px;">
            <p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:rgba(240,237,232,0.6);font-weight:300;">
              You're on the list. When adilsher.pro goes live, you'll be the first to know — and the first to get access.
            </p>
            <p style="margin:0;font-size:14px;line-height:1.75;color:rgba(240,237,232,0.6);font-weight:300;">
              Portfolio. Blog. Indie projects. A sports corner that has no business existing but will anyway.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding-top:24px;border-top:1px solid rgba(240,237,232,0.06);">
            <p style="margin:0 0 4px;font-size:11px;color:rgba(240,237,232,0.2);">
              Signed up as <span style="color:rgba(240,237,232,0.4);">${email}</span>
            </p>
            <p style="margin:0;font-size:11px;color:rgba(240,237,232,0.15);">
              &copy; 2026 Adil Sher
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Plain text fallback ───────────────────────────────────────────────────────

function confirmationText(email) {
  return `You're first in line.

You're on the list. When adilsher.pro goes live, you'll be the first to know and the first to get access.

Portfolio. Blog. Indie projects. A sports corner that has no business existing but will anyway.

Signed up as: ${email}
© 2026 Adil Sher
`;
}