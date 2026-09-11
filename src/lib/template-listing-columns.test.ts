import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COLLAGE_TILES } from './covers';
import { listUserTemplates } from './templates';
import { createTestDb, type TestD1 } from '../test/d1';
import { insertTemplate, insertUser } from '../test/factories';

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

/** The denormalized columns as the database actually holds them. */
function stored(templateId: string) {
	return db.raw
		.prepare(
			'SELECT option_names, option_images FROM templates WHERE id = ?'
		)
		.get(templateId) as {
		option_names: string | null;
		option_images: string | null;
	};
}

describe('the denormalized listing columns', () => {
	it('collects the option names as they are inserted', async () => {
		const tpl = await insertTemplate(db, alice.id, {
			options: [{ name: 'Alien' }, { name: 'Blade Runner' }],
		});

		expect(stored(tpl.id).option_names).toBe('Alien Blade Runner');
	});

	it('follows a renamed option, so search cannot go on matching the old name', async () => {
		const tpl = await insertTemplate(db, alice.id, {
			options: [{ name: 'Alien' }, { name: 'Blade Runner' }],
		});

		await db
			.prepare(
				'UPDATE template_options SET name = ? WHERE template_id = ? AND name = ?'
			)
			.bind('Aliens', tpl.id, 'Alien')
			.run();

		expect(stored(tpl.id).option_names).toBe('Aliens Blade Runner');
	});

	it('drops a deleted option from both columns', async () => {
		const tpl = await insertTemplate(db, alice.id, {
			options: [
				{ name: 'Alien', image: 'a.webp' },
				{ name: 'Blade Runner', image: 'b.webp' },
			],
		});

		await db
			.prepare('DELETE FROM template_options WHERE template_id = ? AND name = ?')
			.bind(tpl.id, 'Alien')
			.run();

		expect(stored(tpl.id)).toEqual({
			option_names: 'Blade Runner',
			option_images: 'b.webp',
		});
	});

	it('keeps only the first COLLAGE_TILES images, in option order', async () => {
		const tpl = await insertTemplate(db, alice.id, {
			options: Array.from({ length: COLLAGE_TILES + 2 }, (_, i) => ({
				name: `Option ${i}`,
				image: `${i}.webp`,
			})),
		});

		const images = stored(tpl.id).option_images?.split('\n');
		expect(images).toEqual(
			Array.from({ length: COLLAGE_TILES }, (_, i) => `${i}.webp`)
		);
	});

	it('skips options with no image when filling the collage', async () => {
		const tpl = await insertTemplate(db, alice.id, {
			options: [
				{ name: 'No picture', image: null },
				{ name: 'Empty string', image: '' },
				{ name: 'Real', image: 'real.webp' },
			],
		});

		expect(stored(tpl.id).option_images).toBe('real.webp');
	});

	it('leaves both columns null for a template with no options', async () => {
		const tpl = await insertTemplate(db, alice.id, { options: [] });

		expect(stored(tpl.id)).toEqual({
			option_names: null,
			option_images: null,
		});
	});

	it('is what the listing query hands back — the columns are not just written, they are read', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'sci-fi',
			options: [
				{ name: 'Alien', image: 'a.webp' },
				{ name: 'Blade Runner', image: 'b.webp' },
				{ name: 'Solaris', image: 'c.webp' },
				{ name: 'Stalker', image: 'd.webp' },
			],
		});

		const [listed] = await listUserTemplates(db);
		expect(listed.optionNames).toBe('Alien Blade Runner Solaris Stalker');
		expect(listed.collage).toHaveLength(COLLAGE_TILES);
	});
});
