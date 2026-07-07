/**
 * English dictionary — the SOURCE OF TRUTH for every user-visible string.
 *
 * `es.ts` and `fr.ts` mirror this shape; missing keys there fall back here
 * (see `../index.ts`). When adding a UI string anywhere in the app, add the key
 * HERE first, then translate it in the other locale files.
 *
 * Keys are grouped by namespace. Interpolation uses `{var}` placeholders, e.g.
 * "Showing {n} results" → t('search.results', { n: 12 }).
 */
export const en = {
	common: {
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
		edit: 'Edit',
		close: 'Close',
		loading: 'Loading…',
		back: 'Back',
		next: 'Next',
		retry: 'Try again',
		confirm: 'Confirm',
		genericError: 'Something went wrong. Try again.',
		networkError: 'Network error. Try again.',
	},
	me: {
		title: 'My templates — RANKMAKER',
		viewPublicProfile: 'View public profile',
		createTemplate: 'Create template',
		bioHeading: 'Bio',
		bioPlaceholder: 'Tell people a bit about yourself…',
		bioEmpty: "You haven't added a bio yet.",
		bioEdit: 'Edit bio',
		bioSaved: 'Bio saved.',
		heading: 'My templates',
		templateSingular: 'template',
		templatePlural: 'templates',
		emptyBody: "You haven't created any templates yet.",
		createFirst: 'Create your first one',
		editTemplateAria: 'Edit template',
		deleteTemplateAria: 'Delete template',
		visibilityPrivate: 'private',
		visibilityUnlisted: 'unlisted',
		dangerZone: 'Danger zone',
		dangerBody:
			"Deleting your account permanently removes your profile and all the templates you've created. This cannot be undone.",
		deleteMyAccount: 'Delete my account',
		deleteTemplateTitle: 'Delete template?',
		deleteTemplateBody:
			'"{title}" will be permanently deleted. This cannot be undone.',
		deleteAccountTitle: 'Delete account',
		deleteAccountBody:
			'This permanently deletes your account and all your templates. Type <strong class="font-bold text-text-primary">{username}</strong> to confirm.',
		deleteForever: 'Delete forever',
	},
	nav: {
		home: 'Home',
		findTemplates: 'Find Templates',
		createRanking: 'Create Ranking',
		create: 'Create',
		login: 'Log in',
		logout: 'Log out',
		myProfile: 'Me',
		mySaved: 'Saved',
		myTemplates: 'My templates',
		myHistory: 'My history',
		notifications: 'Notifications',
		toggleMenu: 'Toggle menu',
		language: 'Language',
	},
	footer: {
		tagline: 'The definitive platform for building accurate rankings through 1v1 battles.',
		openSource: 'Open Source',
		contributeHere: 'Contribute here',
		pages: 'Pages',
		information: 'Information',
		aboutUs: 'About Us',
		contact: 'Contact',
		categories: 'Categories',
		legal: 'Legal',
		privacyPolicy: 'Privacy Policy',
		termsOfUse: 'Terms of Use',
		cookiePolicy: 'Cookie Policy',
		legalNotice: 'Legal Notice',
	},
	cookie: {
		title: 'We use cookies',
		body: "We use cookies to improve your experience and analyze our traffic. By clicking 'Accept', you agree to our use of cookies.",
		accept: 'Accept',
		reject: 'Reject',
		policy: 'Policy',
	},
	seo: {
		defaultDescription:
			'RANKMAKER: rank your stuff. No tiers, no noise — just accurate 1v1 rankings.',
	},
	recommended: {
		youMightAlsoLike: 'You might also like',
	},
	seoContent: {
		howItWorks: 'How It Works',
		step1Title: 'Select a Template',
		step1Body:
			'Start by choosing a ranking template—either one you created or one shared by others—to get started.',
		step2Title: 'The Match-ups Begin!',
		step2Body:
			'Participate in head-to-head match-ups to determine your final order. Make simple choices between pairs of items to build your perfect ranking.',
		step3Title: 'Share Your Results',
		step3Body:
			'Share your final ranking results with your friends and see their feedback. Compare your rankings and discover new perspectives.',
		whatIsTitle: 'What is RANKMAKER?',
		whatIsP1:
			"RANKMAKER is the ultimate ranking tool that helps you organize and prioritize anything that matters to you. Whether you're ranking movies, music, games, books, or any other category, our unique head-to-head comparison system ensures accurate results that truly reflect your preferences.",
		whatIsP2:
			"Unlike traditional tier lists that force you to make arbitrary category assignments, RANKMAKER's battle system lets you focus on one simple question at a time: which option do you prefer? This methodical approach leads to more accurate and satisfying rankings.",
		feature1: 'Create custom rankings of anything you care about',
		feature2: 'Use pre-made templates from popular categories',
		feature3: 'Share your rankings with friends on social media',
		feature4: 'Build a profile showcasing your templates',
	},
	home: {
		title: 'RANKMAKER — Rank Your Stuff',
		heroHeadline: 'rank your stuff.',
		heroSubtitle:
			'No tiers. No noise. RANKMAKER lets you build accurate rankings through fast, decisive 1v1 battles. Pick a template and find out what really comes out on top.',
		exploreTemplates: 'Explore Templates',
		followingHeading: 'Following',
		emptyTitle: 'No templates yet',
		emptyBody:
			'Templates will appear here once they are added to the database. Check back soon!',
	},
	create: {
		title: 'Create a template — RANKMAKER',
		metaDescription: 'Create your own ranking template on RANKMAKER.',
		heading: 'Create a template',
		intro: 'Build your own ranking. Make it public so anyone can play it and it shows on your profile, or keep it unlisted or private — you choose the visibility below.',
	},
	editTemplate: {
		title: 'Edit: {title} — RANKMAKER',
		backToMyTemplates: 'Back to my templates',
		heading: 'Edit template',
		intro: 'The template URL stays the same — your share links keep working. (Exception: switching to unlisted gives it a new random URL.)',
	},
	card: {
		ranked: '{n} ranked',
		votes: '{n} votes',
		viewProfile: "View @{username}'s profile",
		shareAria: 'Share template',
		saveAria: 'Save template',
		unsaveAria: 'Remove from saved',
		shareTitle: 'RANKMAKER: {title}',
		viewAll: 'View all',
	},
	search: {
		title: 'Find Templates — RANKMAKER',
		metaDescription: 'Search and browse all ranking templates on RANKMAKER.',
		heading: 'Find Templates',
		subtitle:
			'Search through all available ranking templates by title, description, or options.',
		placeholder: 'Search templates...',
		clear: 'Clear search',
		allCategories: 'All Categories',
		showing: 'Showing {n} templates',
		showingOne: 'Showing {n} template',
		resetFilters: 'Reset filters',
		emptyTitle: 'No templates found',
		emptyBody: 'Try adjusting your search query or changing the category filter.',
	},
	category: {
		title: '{category} Templates — RANKMAKER',
		metaDescription:
			'Browse all {category} ranking templates on RANKMAKER. Rank your favorites head-to-head and share your results.',
		heading: '{category} Templates',
		subtitle:
			'All {category} templates on RANKMAKER — rank your favorites head-to-head.',
		browseAll: 'Browse all templates',
		otherCategories: 'Other categories',
		notFoundTitle: 'Category not found',
		notFoundBody: "That category doesn't exist. Browse all templates instead.",
	},
	history: {
		title: 'My ranking history — RANKMAKER',
		heading: 'My ranking history',
		subtitleLoggedIn:
			"The rankings you've completed. Tap a card to reveal the full ranking.",
		subtitleAnon:
			"Rankings you've completed on this device. Tap a card to reveal the full ranking. Log in to keep them across devices.",
		items: '{n} items',
		fullRanking: 'Full ranking',
		rankAgain: 'Rank again',
		viewDetails: 'View details',
		emptyBody: "You haven't ranked anything yet.",
		findSomething: 'Find something to rank',
	},
	saved: {
		title: 'Saved templates — RANKMAKER',
		heading: 'Saved templates',
		subtitle: 'Templates you saved to revisit later.',
		empty: "You haven't saved any templates yet.",
		emptyCta: 'Find templates to save',
	},
	profile: {
		title: '@{username} — RANKMAKER',
		metaDescription: 'Ranking templates created by @{username} on RANKMAKER.',
		verified: 'Verified',
		officialAccount: 'Official RANKMAKER account',
		memberSince: 'Member since {date}',
		templateSingular: 'template',
		templatePlural: 'templates',
		totalRankings: '{n} total rankings',
		templatesBy: 'Templates by @{username}',
		noTemplates: "@{username} hasn't created any templates yet.",
		follow: 'Follow',
		following: 'Following',
		unfollow: 'Unfollow',
		followersLabel: 'followers',
		followingLabel: 'following',
		followersTitle: 'Followers',
		followingTitle: 'Following',
		noFollowers: 'No followers yet.',
		noFollowing: 'Not following anyone yet.',
	},
	signup: {
		title: 'Finish signing up — RANKMAKER',
		heading: 'Almost there!',
		subtitle: 'Pick a username and an avatar to finish creating your account.',
		usernameLabel: 'Username',
		usernamePlaceholder: 'your_username',
		usernamePermanent: 'Your username is permanent — it can never be changed.',
		avatarLabel: 'Avatar',
		avatarOptionLabel: 'Avatar {key}',
		shuffle: 'Shuffle',
		submit: 'Create my account',
		available: 'Username is available!',
		notAvailable: 'Username is not available.',
		checkFailed: 'Could not check username.',
		genericError: 'Something went wrong. Try again.',
		networkError: 'Network error. Try again.',
	},
	form: {
		details: 'Details',
		titleLabel: 'Title',
		titlePlaceholder: 'Best Pizza Toppings Ranking',
		descriptionLabel: 'Description',
		descriptionPlaceholder: 'What should people rank, and why is it fun?',
		categoryLabel: 'Category',
		categoryPlaceholder: 'Pick a category…',
		visibilityLabel: 'Visibility',
		visibilityPublicLabel: 'Public — listed for everyone',
		visibilityPublicHint:
			'Shown on the homepage, search and your profile. Anyone can rank it.',
		visibilityUnlistedLabel: 'Unlisted — only people with the link',
		visibilityUnlistedHint:
			'Not listed anywhere and hidden from search engines. It gets a random, unguessable URL — share the link with whoever you want.',
		visibilityPrivateLabel: 'Private — only you',
		visibilityPrivateHint: 'Only you can see and rank this template.',
		visibilityUnlistedSlugWarning:
			' Saving will change the template URL to a new random one.',
		coverImage: 'Cover image',
		coverImageByUrl: '(by URL)',
		coverPlaceholder: 'https://example.com/cover.jpg',
		coverPreviewAlt: 'Cover preview',
		previewHere: 'Preview appears here',
		previewLoadError: "Couldn't load that image",
		previewLoading: 'Loading…',
		options: 'Options',
		optionsMin: 'min {n}',
		optionsHelp:
			"The things people will rank in 1v1 battles. Images are optional — paste an image URL and you'll see a preview.",
		addOption: 'Add option',
		removeOption: 'Remove option',
		optionNamePlaceholder: 'Option name',
		optionImagePlaceholder: 'Image URL (optional)',
		submitCreate: 'Create template',
		submitSave: 'Save changes',
		busyCreating: 'Creating…',
		busySaving: 'Saving…',
		// Validation
		errTitle: 'Title must be at least 3 characters.',
		errDescription: 'Description is required (at least 15 characters).',
		errCategory: 'Pick a category.',
		errCoverRequired: 'Cover image is required.',
		errCoverUrl: 'Cover image must be a valid http(s) URL.',
		errMinOptions: 'Add at least {n} options with a name.',
		errOptionNameNeeded: 'Every option with an image needs a name.',
		errOptionImageUrl: 'Option "{name}": image must be a valid http(s) URL.',
		// AI suggestion modal
		aiShortTitle: 'Your description is too short',
		aiShortCopy:
			"A description needs at least 15 characters. Here's one we wrote from your title and options — use it, or write your own.",
		aiWriteMyOwn: 'Write my own',
		aiDiscoverTitle: 'Make your ranking more popular?',
		aiPolishCopy:
			'We polished your description to help your ranking get discovered. Edit it if you like, or keep your original.',
		aiRewriteCopy:
			'With this description your ranking will be easier to discover. Edit it if you like, or keep your original.',
		aiKeepMine: 'Keep mine',
		aiUseDescription: 'Use this description',
		aiMinChars: 'Description must be at least 15 characters.',
	},
	comments: {
		heading: 'Comments',
		loading: 'Loading comments…',
		close: 'Close',
		replyPlaceholder: 'Write a reply…',
		commentPlaceholder: 'Share what you think…',
		reply: 'Reply',
		comment: 'Comment',
		joinConversation: 'Join the conversation — log in to comment and vote.',
		viewRanking: 'View ranking',
		upvote: 'Upvote',
		downvote: 'Downvote',
		deleted: '[comment deleted]',
		delete: 'Delete',
		empty: 'No comments yet. Be the first to share your take.',
		loadError: "Couldn't load comments.",
		rankingTitle: "@{username}'s ranking",
		postError: 'Something went wrong.',
		networkError: 'Network error. Try again.',
		justNow: 'just now',
		minutesAgo: '{n}m ago',
		hoursAgo: '{n}h ago',
		daysAgo: '{n}d ago',
		monthsAgo: '{n}mo ago',
		yearsAgo: '{n}y ago',
	},
	ranking: {
		// Detail view
		pageTitle: '{title} — RANKMAKER',
		backToTemplates: 'Back to templates',
		createdBy: 'Created by',
		optionsCount: '{n} options',
		availableOptions: 'Available Options',
		itemsCount: '{n} items',
		startRanking: 'START RANKING',
		saveTemplate: 'Save',
		savedTemplate: 'Saved',
		voteUpAria: 'Upvote this template',
		voteDownAria: 'Downvote this template',
		// Battle view
		roundProgress: 'Round {current} of ~{total}',
		undo: 'Undo',
		skipForLater: 'Skip for later',
		finishEarly: 'Finish Early',
		rankingLabel: 'Ranking',
		tapPreferred: 'Tap the one you prefer',
		skippedCount: '{n} skipped',
		// Results view
		results: 'Results',
		by: 'by',
		fullRanking: 'Full Ranking',
		battleHistory: 'Battle History',
		rankAgain: 'Rank Again',
		shareTemplate: 'Share Template',
		downloadImage: 'Download Image',
		shareOnX: 'Share on X',
		reorderManually: 'Reorder Manually',
		doneReordering: 'Done Reordering',
		// Battle dynamic states
		noSkipping: 'No skipping now — trust your gut',
		suddenDeathOne: 'Sudden death — settle {count} skipped duel',
		suddenDeath: 'Sudden death — settle {count} skipped duels',
		// Results
		podium1: '1st',
		podium2: '2nd',
		podium3: '3rd',
		noBattlesRecorded: 'No battles recorded.',
		vs: 'vs',
		generating: 'Generating…',
		myRanking: 'My Ranking',
		shareXText: "Take a look at this template: '{title}'",
		shareImgMadeWith: 'Made with rankmaker.net',
		// Finish-early modal
		finishEarlyTitle: 'Finish Ranking Early?',
		finishEarlyBody:
			'Are you sure you want to finish ranking early? The remaining items will be ranked based on their current performance.',
		finishNow: 'Finish Now',
		// Remove-option (exclude from this ranking)
		removeOptionAria: 'Remove {name} from this ranking',
		restoreOptionAria: 'Restore {name} to this ranking',
		removedBadge: 'Removed',
		removeModalTitle: 'Remove this option?',
		removeModalBody:
			'"{name}" will be left out of this ranking. You can restore it later from the options list.',
		removeConfirm: 'Remove',
		removeMinNotice: 'A ranking needs at least 2 options',
	},
	notFound: {
		title: 'Page not found — RANKMAKER',
		heading: "This page doesn't exist",
		body: "The template or page you're looking for was moved, deleted, or never existed.",
		backHome: 'Back to home',
		findTemplates: 'Find templates',
	},
	about: {
		title: 'About — RANKMAKER',
		metaDescription: 'The story behind RANKMAKER and its creator.',
		heading: 'About',
		// Paragraphs may contain inline HTML (links/<strong>) — rendered with set:html.
		p1: 'Well, there is no "us" here, really—just me. My name is <a href="https://olivermartinezharo.com/en" target="_blank"><strong class="text-text-primary hover:underline">Oli</strong></a>, and I\'m the only person behind RANKMAKER. I\'m just a guy from Spain with big ambitions who loves trying new things. RANKMAKER is one of those things I decided to dive into.',
		p2: "One day, after a run, while getting ready to shower, a random memory popped into my head. A couple of years ago, I made a ranking of Formula 1 drivers that someone had shared on Twitter. There was something fascinating about it: I didn't have to think too hard about the exact order of the drivers, nor was it a tier list. I was just given different matchups, and in the end, I got a ranking based on my choices.",
		p3: "At the time, I didn't think much of it, but for some reason, at that very moment, it came back to me. While in the shower, I kept thinking about it. I had no idea how to code, but I'm obsessed with AI.",
		p4: 'As soon as I got out of the shower, I played around with ChatGPT for a bit, and within minutes, I had a basic system where I could enter different options, compare them in matchups, and get a sorted ranking. I also realized that no website was doing exactly this. That was my chance.',
		p5: 'I thought I could finish the project with just a few more AI interactions… and I would\'ve been right if by "a few" I meant literally thousands of iterations across different models. I had to learn some basic programming along the way because, apparently, you can\'t just copy-paste a couple of ChatGPT-generated codes into Notepad and call it a day.',
		p6: "Honestly, I probably could've finished much faster by hiring someone on Fiverr, and the result would've been better. But that's just how I am.",
		whyHeading: 'Why RANKMAKER?',
		p7: 'The biggest inspiration for this project was <strong class="text-text-primary">TIERMAKER</strong>, along with that F1 ranking site I mentioned earlier—though I never saw it again (probably just someone\'s side project).',
		p8: "I've always loved ranking things (maybe that's some kind of disorder), but sometimes TIERMAKER felt overwhelming with so many choices at once, and the results didn't always reflect what I truly thought.",
		finalLine: 'So I fixed that with RANKMAKER.',
	},
	contact: {
		title: 'Contact — RANKMAKER',
		metaDescription: 'Get in touch with RANKMAKER.',
		heading: 'Contact',
		emailLabel: 'Email',
	},
	// Legal documents — each `body` is the inner HTML of the content block,
	// rendered with set:html. Translate the prose; keep the markup/classes.
	legal: {
		legalNotice: {
			title: 'Legal Notice — RANKMAKER',
			metaDescription: 'Legal Notice and company information.',
			heading: 'Legal Notice',
			body: `<p>In compliance with the provisions of Law 34/2002, of July 11, on Information Society Services and Electronic Commerce (LSSI-CE), the following general information about this website is provided:</p>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Website Owner</h2><ul class="list-none space-y-1 pl-4 border-l-2 border-primary/20"><li><strong class="text-text-primary">Owner:</strong> Oliver Martínez</li><li><strong class="text-text-primary">Email:</strong> rankmaker.net@gmail.com</li><li><strong class="text-text-primary">Domain:</strong> rankmaker.net</li></ul></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Purpose</h2><p>The purpose of this website is to provide users with a platform to create and manage ranking lists using comparison methods.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. User Responsibility</h2><p>The owner is not responsible for the misuse of the content published on the website. The user assumes responsibility for any use of the Service that is contrary to law or public order.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Intellectual Property</h2><p>All content on this site, including text, images, and code, is the property of RANKMAKER unless otherwise stated, and is protected by intellectual property laws.</p><p class="mt-2">The reproduction, distribution, or modification of any part of the site without the express written permission of the owner is prohibited.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Applicable Law</h2><p>This Legal Notice is governed by Spanish law. Any dispute arising from the use of the website will be subject to the jurisdiction of the courts of Spain.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Contact</h2><p>For any questions or clarifications regarding this Legal Notice, please contact us at: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		cookiePolicy: {
			title: 'Cookie Policy — RANKMAKER',
			metaDescription: 'Our policy regarding the use of cookies.',
			heading: 'Cookie Policy',
			body: `<p>Welcome to RANKMAKER! This Cookie Policy explains how we use cookies and similar technologies to recognize you when you visit our website. It explains what these technologies are and why we use them, as well as your rights to control our use of them.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">1. What Are Cookies?</h2><p class="mb-4">Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.</p><p>Cookies set by the website owner (in this case, RANKMAKER) are called "first-party cookies". Cookies set by parties other than the website owner are called "third-party cookies". Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics).</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">2. Why Do We Use Cookies?</h2><p>We use first-party and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies enable us to track and target the interests of our users to enhance the experience on our Online Properties. Third parties serve cookies through our Website for analytics and other purposes. This is described in more detail below.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">3. Types of Cookies We Use</h2><div class="space-y-4"><div><h3 class="text-lg font-medium text-text-primary mb-2">3.1. Strictly Necessary Cookies</h3><p>These cookies are essential to provide you with services available through our Website and to enable you to use some of its features, such as access to secure areas. Without these cookies, services you have asked for, like shopping baskets and secure user accounts, cannot be provided.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.2. Functional Cookies</h3><p>These cookies are used to enhance the functionality of our Website but are non-essential to their use. However, without these cookies, certain functionality (like remembering your login details or site preferences) may become unavailable.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.3. Analytics and Performance Cookies</h3><p>These cookies collect information that is used either in aggregate form to help us understand how our Website is being used or how effective our marketing campaigns are, or to help us customize our Website for you. This helps us to improve your experience.</p></div></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">4. Specific Cookies We Install</h2><p class="mb-4">Below is a list of the main cookies we use on our website:</p><div class="overflow-x-auto rounded-xl border border-border"><table class="w-full text-sm text-left"><thead class="bg-surface-elevated text-text-primary font-semibold"><tr><th class="px-4 py-3 border-b border-border">Cookie Name</th><th class="px-4 py-3 border-b border-border">Purpose</th><th class="px-4 py-3 border-b border-border">Duration</th><th class="px-4 py-3 border-b border-border">Managed By</th><th class="px-4 py-3 border-b border-border">Type</th></tr></thead><tbody class="divide-y divide-border"><tr><td class="px-4 py-3 font-medium">PHPSESSID (or similar)</td><td class="px-4 py-3">Maintains your session state across page requests.</td><td class="px-4 py-3">Session</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Strictly Necessary</td></tr><tr><td class="px-4 py-3 font-medium">rankmaker_visited</td><td class="px-4 py-3">Tracks if you have visited the site before.</td><td class="px-4 py-3">30 days</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Functional</td></tr><tr><td class="px-4 py-3 font-medium">remember_token</td><td class="px-4 py-3">Remembers your login details for automatic login.</td><td class="px-4 py-3">30 days</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Functional</td></tr><tr><td class="px-4 py-3 font-medium">cookie_consent_status</td><td class="px-4 py-3">Stores your consent status.</td><td class="px-4 py-3">1 year</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Functional</td></tr><tr><td class="px-4 py-3 font-medium">_ga</td><td class="px-4 py-3">Distinguish users for statistics.</td><td class="px-4 py-3">2 years</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analytics</td></tr><tr><td class="px-4 py-3 font-medium">_gid</td><td class="px-4 py-3">Distinguish users for statistics.</td><td class="px-4 py-3">24 hours</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analytics</td></tr></tbody></table></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">5. How Can You Control Cookies?</h2><p class="mb-4">You have the right to decide whether to accept or reject cookies. You can exercise your cookie preferences by:</p><ul class="list-disc pl-5 space-y-2 mb-4"><li><strong class="text-text-primary">Browser Settings:</strong> Most web browsers allow some control of most cookies through the browser settings.</li><li><strong class="text-text-primary">Third-Party Opt-Outs:</strong> For Google Analytics, you can opt-out by visiting the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Google Analytics Opt-out Browser Add-on</a>.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">6. How to Revoke Consent</h2><p class="mb-4">If you have previously given your consent to our use of non-essential cookies, you can revoke this consent by clearing the cookies from your browser for our site. This will remove the <code>cookie_consent_status</code> cookie.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">7. Changes to This Cookie Policy</h2><p>We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal or regulatory reasons. Please therefore re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">8. Contact Us</h2><p>If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		privacyPolicy: {
			title: 'Privacy Policy — RANKMAKER',
			metaDescription: 'How we collect, use, and protect your data.',
			heading: 'Privacy Policy',
			body: `<p>Welcome to RANKMAKER! This Privacy Policy explains how we collect, use, and disclose information about you when you use our website and services (collectively, the "Service"). By using the Service, you agree to the terms of this Privacy Policy.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Information We Collect</h2><p class="mb-3">We may collect the following information:</p><ul class="list-disc pl-5 space-y-2"><li><strong class="text-text-primary">Personal Information:</strong> Your email address, username, and any other details you provide when creating an account.</li><li><strong class="text-text-primary">Usage Information:</strong> Pages you visit, time spent on pages, interactions with the Service.</li><li><strong class="text-text-primary">Device Information:</strong> IP address, browser type, device identifiers, and operating system.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. How We Use Your Information</h2><p class="mb-3">We use your information to:</p><ul class="list-disc pl-5 space-y-2"><li>Provide, maintain, and improve the Service.</li><li>Communicate with you.</li><li>Ensure security and prevent fraud.</li><li>Analyze usage and improve user experience.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Cookies and Tracking Technologies</h2><p>We may use cookies and similar technologies to improve functionality and performance. You can manage your cookie preferences through your browser settings.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Sharing of Information</h2><p class="mb-3">We do not sell your personal data. We may share information with:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Service providers (e.g., hosting, analytics, advertising).</li><li>Authorities if required by law.</li></ul><p>Specifically, we may share your data with:</p><ul class="list-disc pl-5 space-y-2 mt-2"><li><strong>Hostinger:</strong> Our website hosting provider.</li><li><strong>Google (Analytics, Ads):</strong> We use Google Analytics to monitor and analyze web traffic and Google Ads for advertising purposes.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Data Retention</h2><p>We retain your data as long as necessary to provide the Service and comply with legal obligations.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Your Rights</h2><p class="mb-3">You may:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Access or update your personal information.</li><li>Request deletion of your data.</li><li>Object to processing of your data.</li></ul><p class="mb-3">If you are a resident of the European Economic Area (EEA) or Spain, you have certain data protection rights under GDPR and Spanish law, including:</p><ul class="list-disc pl-5 space-y-2"><li>The right to access, update or delete the information we have on you.</li><li>The right of rectification.</li><li>The right to object.</li><li>The right of restriction.</li><li>The right to data portability.</li><li>The right to withdraw consent.</li></ul><p class="mt-3 text-sm text-text-muted">Please note that we may ask you to verify your identity before responding to such requests.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Children's Privacy</h2><p>Our Service is not directed to children under 13. We do not knowingly collect personal information from children under 13.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Data Security</h2><p>The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Changes to This Policy</h2><p>We may update this Privacy Policy. We will notify you of significant changes by email or on the Service.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Contact Us</h2><p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		termsOfUse: {
			title: 'Terms of Use — RANKMAKER',
			metaDescription: 'Terms and conditions for using RANKMAKER.',
			heading: 'Terms of Use',
			body: `<p>Welcome to RANKMAKER! These Terms of Use ("Terms") govern your access to and use of the rankmaker.net website and services (collectively, the "Service") provided by RANKMAKER ("we", "us", or "our"). Please read these Terms carefully before using the Service.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Acceptance of Terms</h2><p>By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not use the Service.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. User Accounts</h2><p>To access certain features, you may need to create an account. You must provide accurate information and are responsible for maintaining confidentiality and for all activity on your account.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Use of the Service</h2><p>You agree to use the Service lawfully and in accordance with these Terms. The Service is designed for users to create, share, and manage ranking lists through a comparison system.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. User Content and Conduct</h2><p class="mb-3">You are responsible for any content you upload. You agree not to post content that is illegal, offensive, harmful, or infringes on the rights of others.</p><p>We may monitor, remove, or disable access to content that violates these Terms. We may suspend or terminate your access to the Service for violations.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Third-Party Services</h2><p>The Service may include links to third-party sites. We are not responsible for their content, privacy practices, or services.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Cookies</h2><p>We may use cookies and similar technologies as described in our Privacy Policy.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Age Restriction</h2><p>You must be at least 13 years old to use the Service.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Disclaimer of Warranties</h2><p>The Service is provided "as is" and without warranty. We disclaim all warranties to the fullest extent permitted by law.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Limitation of Liability</h2><p>We are not liable for any indirect, incidental, or consequential damages resulting from your use of the Service.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Governing Law</h2><p>These Terms are governed by Spanish law.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">11. Changes to Terms</h2><p>We may modify these Terms. Continued use of the Service after changes means you accept the new Terms.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">12. Contact</h2><p>For questions, contact: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
	},
	categories: {
		Movies: 'Movies',
		Music: 'Music',
		Sports: 'Sports',
		Games: 'Games',
		TV: 'TV',
		People: 'People',
		Internet: 'Internet',
		Anime: 'Anime',
		Lifestyle: 'Lifestyle',
		Food: 'Food',
		Politics: 'Politics',
		'History & Culture': 'History & Culture',
		Geography: 'Geography',
		Motor: 'Motor',
		Books: 'Books',
		Technology: 'Technology',
		Nature: 'Nature',
		Others: 'Others',
	},
	notifications: {
		title: 'Notifications — RANKMAKER',
		heading: 'Notifications',
		subtitle: 'Comments on your templates, replies to you, and new templates from people you follow.',
		loginRequired: 'Log in to see your notifications.',
		login: 'Log in',
		empty: "You're all caught up — nothing here yet.",
		filterAll: 'All',
		filterComments: 'On my templates',
		filterReplies: 'Replies',
		filterTemplates: 'New templates',
		today: 'Today',
		yesterday: 'Yesterday',
		newBadge: 'New',
		msgCommentOnTemplate: '{actor} commented on your template “{title}”',
		msgCommentReply: '{actor} replied to your comment on “{title}”',
		msgNewTemplate: '{actor} published a new template: “{title}”',
		emailPrefHeading: 'Email notifications',
		emailPrefDesc: 'Email me about comments on my templates and replies to my comments.',
		emailPrefToggle: 'Toggle notification emails',
		emailPrefError: "Couldn't update your preference. Try again.",
	},
	email: {
		cta: 'View on RANKMAKER',
		footer: 'You received this because notification emails are on for your account. Manage them at {url}',
		commentOnTemplate: {
			subject: 'New comment on your template',
			heading: 'New comment on “{title}”',
			intro: '{actor} commented on your template “{title}”.',
		},
		commentReply: {
			subject: '{actor} replied to your comment',
			heading: 'You have a new reply',
			intro: '{actor} replied to your comment on “{title}”.',
		},
	},
} as const;

export type Dict = typeof en;
