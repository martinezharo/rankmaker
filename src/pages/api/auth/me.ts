export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionUser, json } from '../../../lib/auth';
import { countUnread } from '../../../lib/notifications';
import { readMaturePref, writeMaturePref } from '../../../lib/mature';

/**
 * Returns the logged-in user (or null) plus their unread notification count.
 * Drives the header auth UI (and its notification badge), which is
 * client-rendered so publicly cached pages never embed personal state.
 */
export const GET: APIRoute = async (context) => {
    try {
        const db = context.locals.runtime.env.DB;
        const user = await getSessionUser(context.cookies, db);
        const unreadNotifications = user ? await countUnread(db, user.id) : 0;

        // The header calls this on every navigation, which makes it the sync
        // point for the mature-content preference: the account value wins for
        // signed-in users, so a change made on another device lands here.
        // Signed-out visitors keep whatever cookie they set locally.
        if (user && readMaturePref(context.cookies) !== user.showMature) {
            writeMaturePref(context.cookies, user.showMature);
        }
        return json(
            {
                user: user
                    ? {
                          username: user.username,
                          avatar: user.avatar,
                          isVerified: user.isVerified,
                          unreadNotifications,
                      }
                    : null,
                // Reported so the client knows whether it has to re-derive the
                // listings for a mature-content viewer (src/lib/mature.ts).
                // The cookie is httpOnly, and publicly cached HTML can't carry
                // the answer, so this — already fetched on every navigation —
                // is where the browser learns it.
                showMature: user ? user.showMature : readMaturePref(context.cookies),
            },
            200,
            { 'Cache-Control': 'no-store' }
        );
    } catch (error) {
        console.error('Me API error:', error);
        return json(
            { user: null, showMature: false },
            200,
            { 'Cache-Control': 'no-store' }
        );
    }
};
