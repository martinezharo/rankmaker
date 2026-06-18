export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionUser, json } from '../../../lib/auth';
import { countUnread } from '../../../lib/notifications';

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
            },
            200,
            { 'Cache-Control': 'no-store' }
        );
    } catch (error) {
        console.error('Me API error:', error);
        return json({ user: null }, 200, { 'Cache-Control': 'no-store' });
    }
};
