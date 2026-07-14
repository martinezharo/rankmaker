export type BattleOptionId = number | string;
export type BattleWinnerSide = 0 | 1;
export type StoredBattleDecision = [
	leftId: BattleOptionId,
	rightId: BattleOptionId,
	winnerSide: BattleWinnerSide,
];

export type BattleHistory = {
	version: 1;
	decisions: StoredBattleDecision[];
};

type CanonicalBattleHistory =
	| { ok: true; battles?: BattleHistory }
	| { ok: false; error: string };

// Far above the current 50-option template maximum (1,225 unique pairs), but
// still bounds untrusted local/session JSON before it can inflate the DOM.
const STORAGE_SAFETY_LIMIT = 5_000;

function isOptionId(value: unknown): value is BattleOptionId {
	return typeof value === 'number' || typeof value === 'string';
}

/**
 * Parse the versioned storage format without trusting tuple contents. Callers
 * can provide the maximum number of decisions appropriate for the template so
 * corrupted local data cannot inflate the battle-history DOM.
 */
export function parseBattleHistory(
	input: unknown,
	maxDecisions = STORAGE_SAFETY_LIMIT
): BattleHistory | null {
	if (
		typeof input !== 'object' ||
		input === null ||
		!('version' in input) ||
		!('decisions' in input) ||
		input.version !== 1 ||
		!Array.isArray(input.decisions) ||
		input.decisions.length > Math.min(maxDecisions, STORAGE_SAFETY_LIMIT)
	) {
		return null;
	}

	const decisions: StoredBattleDecision[] = [];
	for (const decision of input.decisions) {
		if (
			!Array.isArray(decision) ||
			decision.length !== 3 ||
			!isOptionId(decision[0]) ||
			!isOptionId(decision[1]) ||
			(decision[2] !== 0 && decision[2] !== 1)
		) {
			return null;
		}
		decisions.push([decision[0], decision[1], decision[2]]);
	}

	return { version: 1, decisions };
}

/**
 * Validate client-provided battles against the current template and normalize
 * numeric/string-equivalent ids back to their canonical template values.
 */
export function canonicalizeBattleHistory(
	options: ReadonlyArray<{ id: BattleOptionId }>,
	input: unknown
): CanonicalBattleHistory {
	if (input === undefined || input === null) return { ok: true };

	const maxDecisions = (options.length * (options.length - 1)) / 2;
	const parsed = parseBattleHistory(input, maxDecisions);
	if (!parsed) {
		return { ok: false, error: 'The battle history is invalid.' };
	}

	const canonicalIds = new Map(
		options.map((option) => [String(option.id), option.id])
	);
	const decisions: StoredBattleDecision[] = [];
	for (const [leftId, rightId, winnerSide] of parsed.decisions) {
		const left = canonicalIds.get(String(leftId));
		const right = canonicalIds.get(String(rightId));
		if (left === undefined || right === undefined || String(left) === String(right)) {
			return { ok: false, error: 'The battle history contains an invalid option.' };
		}
		decisions.push([left, right, winnerSide]);
	}

	return {
		ok: true,
		battles: { version: 1, decisions },
	};
}
