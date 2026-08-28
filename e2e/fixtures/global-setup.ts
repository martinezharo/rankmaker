/**
 * Bring the local D1 up to date and clear anything a previous run left behind,
 * before the dev server starts serving.
 */
import { cleanupSeededData, prepareDatabase } from './d1';

export default function globalSetup(): void {
	prepareDatabase();
	cleanupSeededData();
}
