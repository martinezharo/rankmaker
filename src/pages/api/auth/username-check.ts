export const prerender = false;

import type { APIRoute } from 'astro';
import { isUsernameTaken, json, usernameProblem } from '../../../lib/auth';

/** Live username availability check for the signup form. */
export const GET: APIRoute = async (context) => {
    const username = new URL(context.request.url).searchParams.get('u') || '';

    const problem = usernameProblem(username);
    if (problem) {
        return json({ available: false, reason: problem }, 200, {
            'Cache-Control': 'no-store',
        });
    }

    try {
        const taken = await isUsernameTaken(
            context.locals.runtime.env.DB,
            username
        );
        return json(
            taken
                ? { available: false, reason: 'Username is already taken.' }
                : { available: true },
            200,
            { 'Cache-Control': 'no-store' }
        );
    } catch (error) {
        console.error('Username check error:', error);
        return json({ error: 'Internal server error' }, 500);
    }
};
