/**
 * Client-side up/down voting on the current template, used by the battle and
 * results views (and keeping the detail view's read-only score in sync). The
 * ranking page is publicly cached, so per-user vote state is fetched on load
 * from /api/templates/vote rather than rendered server-side.
 *
 * Every `.template-vote` control on the page shares one state; clicking the
 * active arrow again clears the vote (sends 0). Logged-out users are sent to
 * GitHub login.
 */
import { clientT } from '../i18n/client';

type VoteState = { score: number; myVote: number; loggedIn: boolean };

function redirectToLogin() {
	const next = encodeURIComponent(
		window.location.pathname + window.location.search
	);
	window.location.href = `/api/auth/login?next=${next}`;
}

function readSlug(): string | null {
	const el = document.getElementById('ranking-data');
	if (!el?.textContent) return null;
	try {
		return (JSON.parse(el.textContent) as { slug?: string }).slug ?? null;
	} catch {
		return null;
	}
}

export function initTemplateVote() {
	const controls = Array.from(
		document.querySelectorAll<HTMLElement>('.template-vote')
	);
	if (controls.length === 0) return;

	const slug = readSlug();
	if (!slug) return;

	const t = clientT();
	const state: VoteState = { score: 0, myVote: 0, loggedIn: false };
	let pending = false;

	const render = () => {
		for (const control of controls) {
			const scoreEl = control.querySelector<HTMLElement>('.vote-score');
			if (scoreEl) scoreEl.textContent = state.score.toLocaleString();

			const up = control.querySelector<HTMLElement>('.vote-up');
			const down = control.querySelector<HTMLElement>('.vote-down');
			up?.classList.toggle('text-primary', state.myVote === 1);
			up?.classList.toggle('bg-primary/10', state.myVote === 1);
			down?.classList.toggle('text-red-400', state.myVote === -1);
			down?.classList.toggle('bg-red-400/10', state.myVote === -1);
		}
		// Keep the detail view's read-only "{n} votes" label consistent.
		document
			.querySelectorAll<HTMLElement>('[data-vote-score]')
			.forEach((el) => {
				el.textContent = t('card.votes', {
					n: state.score.toLocaleString(),
				});
			});
	};

	const cast = async (value: number) => {
		if (pending) return;
		if (!state.loggedIn) {
			redirectToLogin();
			return;
		}
		// Toggle off when the active arrow is clicked again.
		const next = state.myVote === value ? 0 : value;
		pending = true;
		try {
			const res = await fetch('/api/templates/vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug, value: next }),
			});
			if (res.status === 401) {
				redirectToLogin();
				return;
			}
			if (res.ok) {
				const data = (await res.json()) as {
					score: number;
					myVote: number;
				};
				state.score = data.score;
				state.myVote = data.myVote;
				render();
			}
		} catch {
			/* leave state unchanged */
		}
		pending = false;
	};

	for (const control of controls) {
		if (control.dataset.voteBound) continue;
		control.dataset.voteBound = '1';
		control
			.querySelector('.vote-up')
			?.addEventListener('click', () => cast(1));
		control
			.querySelector('.vote-down')
			?.addEventListener('click', () => cast(-1));
	}

	// Load current state for this user/template.
	fetch(`/api/templates/vote?slug=${encodeURIComponent(slug)}`)
		.then((r) => (r.ok ? r.json() : null))
		.then((data: VoteState | null) => {
			if (!data) return;
			state.score = data.score ?? 0;
			state.myVote = data.myVote ?? 0;
			state.loggedIn = data.loggedIn ?? false;
			render();
		})
		.catch(() => {});
}
