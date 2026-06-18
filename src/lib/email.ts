/**
 * Transactional email via Resend (https://resend.com).
 *
 * Best-effort by design: when RESEND_API_KEY / RESEND_FROM are not configured
 * (e.g. local dev) sending is a no-op, and any failure is logged but swallowed —
 * an email problem must never break the request that triggered the notification.
 */

export type EmailEnv = {
	RESEND_API_KEY?: string;
	RESEND_FROM?: string;
	SITE_URL?: string;
};

export const DEFAULT_SITE_URL = 'https://rankmaker.net';

export function siteUrl(env: EmailEnv): string {
	return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

/** Returns true when the email was accepted by Resend, false otherwise. */
export async function sendEmail(
	env: EmailEnv,
	msg: { to: string; subject: string; html: string; text?: string }
): Promise<boolean> {
	if (!env.RESEND_API_KEY || !env.RESEND_FROM) return false;
	if (!msg.to) return false;
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: env.RESEND_FROM,
				to: [msg.to],
				subject: msg.subject,
				html: msg.html,
				...(msg.text ? { text: msg.text } : {}),
			}),
		});
		if (!res.ok) {
			console.error(
				'Resend send failed',
				res.status,
				await res.text().catch(() => '')
			);
			return false;
		}
		return true;
	} catch (error) {
		console.error('Resend send error', error);
		return false;
	}
}

function escapeHtml(s: string): string {
	return s.replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[c]!
	);
}

/**
 * Minimal, inline-styled HTML wrapper shared by all notification emails. Inline
 * styles only — most mail clients strip <style> blocks.
 */
export function renderEmail(opts: {
	heading: string;
	intro: string;
	body?: string;
	ctaLabel: string;
	ctaUrl: string;
	footer: string;
}): { html: string; text: string } {
	const { heading, intro, body, ctaLabel, ctaUrl, footer } = opts;
	const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0c0a12;font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a12;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#16131f;border:1px solid #2a2440;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#a78bfa;text-transform:uppercase;">RANKMAKER</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f5f3ff;font-weight:700;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 ${body ? '12px' : '20px'};font-size:15px;line-height:1.6;color:#c4b5fd;">${escapeHtml(intro)}</p>
                ${
					body
						? `<p style="margin:0 0 20px;padding:14px 16px;background:#0c0a12;border:1px solid #2a2440;border-radius:10px;font-size:14px;line-height:1.6;color:#d6d3e0;">${escapeHtml(
								body
							)}</p>`
						: ''
				}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#1a1205;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px;">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #2a2440;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#7c7896;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
	const text = `${heading}\n\n${intro}${body ? `\n\n${body}` : ''}\n\n${ctaLabel}: ${ctaUrl}\n\n${footer}`;
	return { html, text };
}
