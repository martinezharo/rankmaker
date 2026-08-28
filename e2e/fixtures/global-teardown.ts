/**
 * Remove every row the suite seeded.
 *
 * Cleanup runs here rather than after each test because the local database is
 * shared with the dev server: deleting rows while a page is still finishing a
 * request would make the app log errors for data that vanished under it.
 */
import { cleanupSeededData } from './d1';

export default function globalTeardown(): void {
	cleanupSeededData();
}
