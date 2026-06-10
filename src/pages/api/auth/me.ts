export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionUser, json } from '../../../lib/auth';

/**
 * Returns the logged-in user (or null). Drives the header auth UI, which is
 * client-rendered so publicly cached pages never embed personal state.
 */
export const GET: APIRoute = async (context) => {
    try {
        const user = await getSessionUser(
            context.cookies,
            context.locals.runtime.env.DB
        );
        return json(
            {
                user: user
                    ? {
                          username: user.username,
                          avatar: user.avatar,
                          isVerified: user.isVerified,
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
