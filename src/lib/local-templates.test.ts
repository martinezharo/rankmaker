import { describe, expect, it } from 'vitest';
import {
    MAX_LOCAL_TEMPLATES,
    isLocalTemplateSlug,
    localTemplateIdFromSlug,
    localTemplateSlug,
    parseLocalTemplates,
    removeLocalTemplate,
    toLocalTemplate,
    upsertLocalTemplate,
    type LocalTemplate,
} from './local-templates';

const template = (
    id: string,
    created_at = 0,
    options = 4
): LocalTemplate => ({
    id,
    title: `Template ${id}`,
    description: '',
    category: null,
    options: Array.from({ length: options }, (_, i) => ({
        id: i + 1,
        name: `Option ${i + 1}`,
    })),
    created_at,
});

describe('parseLocalTemplates', () => {
    it('returns nothing for non-arrays', () => {
        expect(parseLocalTemplates(null)).toEqual([]);
        expect(parseLocalTemplates({ id: 'a' })).toEqual([]);
    });

    it('drops entries without an id, a title or enough options', () => {
        const parsed = parseLocalTemplates([
            { ...template('a'), id: '' },
            { ...template('b'), title: '   ' },
            { ...template('c'), options: [{ name: 'only one' }] },
            template('d'),
        ]);
        expect(parsed.map((t) => t.id)).toEqual(['d']);
    });

    it('renumbers option ids and skips blank names', () => {
        const parsed = parseLocalTemplates([
            {
                ...template('a'),
                options: [
                    { name: ' Pepperoni ' },
                    { name: '  ' },
                    { name: 'Olives' },
                ],
            },
        ]);
        expect(parsed[0].options).toEqual([
            { id: 1, name: 'Pepperoni' },
            { id: 2, name: 'Olives' },
        ]);
    });

    it('orders newest first', () => {
        const parsed = parseLocalTemplates([
            template('old', 1),
            template('new', 2),
        ]);
        expect(parsed.map((t) => t.id)).toEqual(['new', 'old']);
    });
});

describe('upsertLocalTemplate', () => {
    it('replaces an existing template rather than duplicating it', () => {
        const list = [template('a', 1)];
        const updated = { ...template('a', 2), title: 'Renamed' };
        const next = upsertLocalTemplate(list, updated);
        expect(next).toHaveLength(1);
        expect(next[0].title).toBe('Renamed');
    });

    it('caps the list, dropping the oldest', () => {
        let list: LocalTemplate[] = [];
        for (let i = 0; i < MAX_LOCAL_TEMPLATES + 2; i++) {
            list = upsertLocalTemplate(list, template(`t${i}`, i));
        }
        expect(list).toHaveLength(MAX_LOCAL_TEMPLATES);
        expect(list[0].id).toBe(`t${MAX_LOCAL_TEMPLATES + 1}`);
        expect(list.some((t) => t.id === 't0')).toBe(false);
    });
});

describe('removeLocalTemplate', () => {
    it('removes only the matching id', () => {
        const list = [template('a'), template('b')];
        expect(removeLocalTemplate(list, 'a').map((t) => t.id)).toEqual(['b']);
        expect(removeLocalTemplate(list, 'missing')).toHaveLength(2);
    });
});

describe('toLocalTemplate', () => {
    it('trims input and numbers options from 1', () => {
        const created = toLocalTemplate({
            title: '  Best pizzas  ',
            description: '  Tasty  ',
            category: 'Food',
            options: [{ name: ' Margherita ' }, { name: '' }, { name: 'Diavola' }],
        });
        expect(created.title).toBe('Best pizzas');
        expect(created.description).toBe('Tasty');
        expect(created.category).toBe('Food');
        expect(created.options).toEqual([
            { id: 1, name: 'Margherita' },
            { id: 2, name: 'Diavola' },
        ]);
        expect(created.id).toBeTruthy();
    });

    it('stores a missing category as null', () => {
        expect(
            toLocalTemplate({ title: 'x', options: [{ name: 'a' }] }).category
        ).toBeNull();
    });
});

describe('local slugs', () => {
    it('round-trips an id', () => {
        const slug = localTemplateSlug('abc-123');
        expect(isLocalTemplateSlug(slug)).toBe(true);
        expect(localTemplateIdFromSlug(slug)).toBe('abc-123');
    });

    it('leaves real template slugs alone', () => {
        expect(isLocalTemplateSlug('best-pizzas')).toBe(false);
        expect(localTemplateIdFromSlug('best-pizzas')).toBeNull();
    });
});
