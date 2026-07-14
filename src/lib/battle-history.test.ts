import { describe, expect, it } from 'vitest';
import {
	canonicalizeBattleHistory,
	parseBattleHistory,
} from './battle-history';

const options = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe('parseBattleHistory', () => {
	it('preserves left/right placement and the winning side', () => {
		expect(
			parseBattleHistory({
				version: 1,
				decisions: [
					[1, 2, 0],
					[3, 1, 1],
				],
			})
		).toEqual({
			version: 1,
			decisions: [
				[1, 2, 0],
				[3, 1, 1],
			],
		});
	});

	it.each([
		[{ version: 2, decisions: [] }],
		[{ version: 1, decisions: [[1, 2]] }],
		[{ version: 1, decisions: [[1, 2, 2]] }],
		[{ version: 1, decisions: 'not-an-array' }],
	])('rejects an invalid storage shape %#', (input) => {
		expect(parseBattleHistory(input)).toBeNull();
	});

	it('enforces the caller-provided decision limit', () => {
		expect(
			parseBattleHistory(
				{ version: 1, decisions: [[1, 2, 0]] },
				0
			)
		).toBeNull();
	});
});

describe('canonicalizeBattleHistory', () => {
	it('normalizes ids against the template without changing their sides', () => {
		expect(
			canonicalizeBattleHistory(options, {
				version: 1,
				decisions: [['1', '2', 1]],
			})
		).toEqual({
			ok: true,
			battles: { version: 1, decisions: [[1, 2, 1]] },
		});
	});

	it('allows old clients to omit battle history', () => {
		expect(canonicalizeBattleHistory(options, undefined)).toEqual({ ok: true });
	});

	it.each([
		[
			{ version: 1, decisions: [[1, 99, 0]] },
			'invalid option',
		],
		[
			{ version: 1, decisions: [[2, 2, 0]] },
			'invalid option',
		],
		[
			{
				version: 1,
				decisions: [
					[1, 2, 0],
					[1, 3, 0],
					[2, 3, 0],
					[3, 2, 1],
				],
			},
			'invalid',
		],
	])('rejects invalid template decisions %#', (input, message) => {
		const result = canonicalizeBattleHistory(options, input);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain(message);
	});
});
