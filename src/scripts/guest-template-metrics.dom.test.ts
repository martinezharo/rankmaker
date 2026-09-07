// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
	saveLocalTemplate,
	markLocalTemplatePlayed,
	listLocalTemplates,
} from '../lib/local-templates';
import {
	localTemplateMetric,
	reportLocalTemplates,
} from './guest-template-metrics';
beforeEach(() => {
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});
it('only sends metadata and retries failures without duplicating successful reports', async () => {
	const template = saveLocalTemplate({
		title: 'Private title',
		options: [{ name: 'Secret A' }, { name: 'Secret B' }],
	});
	const fetchMock = vi
		.fn()
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetchMock);
	await reportLocalTemplates();
	await reportLocalTemplates();
	await reportLocalTemplates();
	expect(fetchMock).toHaveBeenCalledTimes(2);
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
		id: template.id,
		origin: 'new',
		played: false,
	});
	markLocalTemplatePlayed(template.id);
	await reportLocalTemplates();
	expect(fetchMock).toHaveBeenCalledTimes(3);
	expect(JSON.parse(fetchMock.mock.calls[2][1].body).played).toBe(true);
	expect(listLocalTemplates()[0].played).toBe(true);
});
it('classifies pre-measurement templates as recovered', () => {
	expect(
		localTemplateMetric({
			id: 'old',
			title: 'Hidden',
			description: '',
			category: null,
			options: [],
			created_at: 0,
		})
	).toEqual({ id: 'old', origin: 'recovered', played: false });
});
it('coalesces concurrent observations', async () => {
	saveLocalTemplate({
		title: 'Another',
		options: [{ name: 'A' }, { name: 'B' }],
	});
	const fetchMock = vi.fn().mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetchMock);
	await Promise.all([reportLocalTemplates(), reportLocalTemplates()]);
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
