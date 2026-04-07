// api/subscribe.js
// Vercel Serverless Function — Node.js runtime
//
// Does two things on every submission:
//   1. Adds the email to your Resend Contacts audience (stored, exportable)
//   2. Sends a confirmation email to the subscriber

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body ?? {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const apiKey    = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID; // from Resend dashboard → Contacts → Audiences

  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Server misconfiguration.' });
  }

  try {
    // ── 1. Add to Resend Contacts audience ─────────────────────────────────
    if (audienceId) {
      const contactRes = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            unsubscribed: false,
          }),
        }
      );

      if (!contactRes.ok) {
        const body = await contactRes.json().catch(() => ({}));
        // 409 = contact already exists — not an error worth surfacing
        if (contactRes.status !== 409) {
          console.error('Resend Contacts error:', body);
          // Don't hard-fail — still try to send the email
        }
      }
    } else {
      console.warn('RESEND_AUDIENCE_ID not set — skipping contact save');
    }

    // ── 2. Send confirmation email ──────────────────────────────────────────
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'Adil Sher <hello@adilsher.pro>',
        to:       [email],
        reply_to: 'hello@adilsher.pro',
        subject:  'Noted.',
        html:     confirmationHtml(email),
        text:     confirmationText(email),
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.json().catch(() => ({}));
      console.error('Resend send error:', body);
      return res.status(502).json({ error: 'Failed to send confirmation.' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ── HTML confirmation email ─────────────────────────────────────────────────────

function confirmationHtml(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Noted.</title>
</head>
<body style="margin:0;padding:0;background:#0b0b0a;font-family:'Courier New',Courier,monospace;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:48px 24px;">
      <table width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;">

        <tr>
          <td style="padding-bottom:28px;border-bottom:1px solid rgba(232,228,219,0.08);">
            <p style="margin:0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(232,228,219,0.3);">adilsher.pro</p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 0 8px;">
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#bf4b2e;">Confirmed</p>
            <h1 style="margin:0 0 6px;font-size:42px;font-weight:400;line-height:1.05;color:#e8e4db;font-family:Georgia,'Times New Roman',serif;">Noted.</h1>
            <p style="margin:0;font-size:32px;font-weight:300;font-style:italic;line-height:1.05;color:rgba(232,228,219,0.35);font-family:Georgia,'Times New Roman',serif;">You'll hear from me.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 0 32px;">
            <div style="width:36px;height:1px;background:#bf4b2e;"></div>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:36px;">
            <p style="margin:0 0 14px;font-size:12px;line-height:1.8;color:rgba(232,228,219,0.5);">
              Something's being built at adilsher.pro. When it's ready,<br />
              you'll be the first to know — one email, no noise.
            </p>
            <p style="margin:0;font-size:12px;line-height:1.8;color:rgba(232,228,219,0.5);">
              Portfolio. Blog. Indie projects. A sports corner<br />
              that has no business existing but will anyway.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding-top:24px;border-top:1px solid rgba(232,228,219,0.06);">
            <p style="margin:0 0 4px;font-size:10px;color:rgba(232,228,219,0.2);letter-spacing:0.05em;">
              You signed up as <span style="color:rgba(232,228,219,0.38);">${email}</span>
            </p>
            <p style="margin:0;font-size:10px;color:rgba(232,228,219,0.15);letter-spacing:0.04em;">
              &copy; 2025 Adil Sher &mdash; Islamabad, PK.
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

// ── Plain-text fallback ─────────────────────────────────────────────────────────

function confirmationText(email) {
  return `Noted. You'll hear from me.

Something's being built at adilsher.pro.
When it's ready, you'll be the first to know — one email, no noise.

Portfolio. Blog. Indie projects. A sports corner
that has no business existing but will anyway.

—

Signed up as: ${email}
© 2025 Adil Sher — Islamabad, PK.
`;
}
