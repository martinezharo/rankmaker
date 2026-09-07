import {
	listLocalTemplates,
	LOCAL_TEMPLATES_CHANGED,
	type LocalTemplate,
} from '../lib/local-templates';
import type { GuestTemplateMetric } from '../lib/guest-template-metrics';

export function localTemplateMetric(
	template: LocalTemplate
): GuestTemplateMetric {
	return {
		id: template.id,
		origin: template.measurement_version === 1 ? 'new' : 'recovered',
		played: template.played === true,
	};
}

// Per-page acknowledgements avoid repeated requests during client navigation.
// The local template itself is the durable retry queue; no content is uploaded.
const sent = new Set<string>();
const pending = new Map<string, Promise<void>>();
export async function reportLocalTemplates(): Promise<void> {
	await Promise.all(
		listLocalTemplates().map(async (template) => {
			const metric = localTemplateMetric(template);
			const key = JSON.stringify(metric);
			if (sent.has(key)) return;
			if (pending.has(key)) return pending.get(key);
			const task = (async () => {
				try {
					const response = await fetch('/api/guest-templates', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: key,
						keepalive: true,
					});
					if (response.ok) sent.add(key);
				} catch {
					/* Optional measurement must never block creation or play. */
				}
			})();
			pending.set(key, task);
			try {
				await task;
			} finally {
				pending.delete(key);
			}
		})
	);
}

export function initGuestTemplateMetrics(): void {
	const report = () => {
		void reportLocalTemplates();
	};
	document.addEventListener(LOCAL_TEMPLATES_CHANGED, report);
	document.addEventListener('astro:page-load', report);
	window.addEventListener('online', report);
	report();
}
