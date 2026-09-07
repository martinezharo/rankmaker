export const prerender = false;
import type { APIRoute } from 'astro';
import { checkOrigin, json } from '../../lib/auth';
import {
	parseGuestTemplateMetric,
	recordGuestTemplateMetric,
} from '../../lib/guest-template-metrics';
import { withinRateLimit } from '../../lib/rate-limit';
import { getEnv } from '../../lib/runtime';
import { readBoundedBody } from '../../lib/request-body';

export const POST: APIRoute = async ({ request }) => {
	if (!checkOrigin(request)) return json({ error: 'Forbidden' }, 403);
	try {
		const body = await readBoundedBody(request, 512);
		if (body === null) return json({ error: 'Payload too large' }, 413);
		const text = new TextDecoder().decode(body);
		const metric = parseGuestTemplateMetric(JSON.parse(text));
		if (!metric) return json({ error: 'Invalid payload' }, 400);
		const env = getEnv();
		if (
			!(await withinRateLimit(
				env['rm-times-ranked'],
				`guest-metrics:${request.headers.get('cf-connecting-ip') ?? 'local'}`,
				60,
				60
			))
		) {
			return json({ error: 'Too many requests' }, 429);
		}
		await recordGuestTemplateMetric(env.DB, metric);
		return json({ ok: true }, 200, { 'Cache-Control': 'no-store' });
	} catch (error) {
		if (error instanceof SyntaxError)
			return json({ error: 'Invalid JSON' }, 400);
		console.error('Guest template measurement failed:', error);
		return json({ error: 'Measurement unavailable' }, 503);
	}
};
