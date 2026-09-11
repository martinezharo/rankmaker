/**
 * English dictionary — the SOURCE OF TRUTH for every user-visible string.
 *
 * Translated locale files mirror this shape; missing keys there fall back here
 * (see `../index.ts`). When adding a UI string anywhere in the app, add the key
 * HERE first, then translate it in the other locale files.
 *
 * Keys are grouped by namespace. Interpolation uses `{var}` placeholders, e.g.
 * "Showing {n} results" → t('search.results', { n: 12 }).
 */
import { legalContent } from '../legal-content';

export const en = {
	select: {
		searchPlaceholder: 'Search…',
		noResults: 'No matches',
	},
	/**
	 * Hover/focus hints rendered by src/scripts/tooltip.ts (`data-rm-tip`).
	 * A tooltip only ever explains — it is never the sole home of anything a
	 * touch user needs, since tooltips don't open on coarse pointers.
	 */
	tooltip: {
		// Battle view
		undo: 'Take back your last pick and replay that matchup',
		skip: "Park this matchup — you'll only be asked again if it decides a position",
		finishEarly: 'Stop now and let the remaining spots be settled by the results so far',
		removeOption: 'Drop this option out of the ranking entirely',
		restoreOption: 'Put this option back into the ranking',
		progress: 'An estimate — smart matchups often finish it sooner',
		// Results view
		battleHistory: 'Review every matchup you decided, in order',
		rankAgain: 'Clear this result and rank the template from scratch',
		downloadImage: 'Save your ranking as an image, ready to post',
		shareOnX: 'Post this template to X',
		reorder: 'Drag rows to fix any position the matchups got wrong',
		// Cards and template pages
		save: 'Save to your list so you can find it later',
		unsave: 'Remove this template from your saved list',
		shareTemplate: 'Copy a link so others can rank the same template',
		category: '{category} template',
		timesRanked: 'How many rankings people have completed from this template',
		votes: 'Upvotes minus downvotes from people who ranked it',
		viewProfile: "Go to @{username}'s profile",
		verified: 'Verified account',
		visibilityPrivate: 'Only you can open this template',
		visibilityUnlisted: 'Hidden from search — anyone with the link can open it',
		// Template form
		coverReplace: 'Swap this cover for a different image',
		coverRemove: 'Remove the cover — a collage of your option images stands in',
		optionImage: 'Add an image for this option',
		optionImageReplace: 'Swap this option image for a different one',
		optionImageRemove: 'Remove this image, keep the option',
		optionRemove: 'Delete this option from the template',
		// My templates
		editTemplate: 'Edit this template — the share link stays the same',
		deleteTemplate: 'Delete this template permanently',
		deleteLocalTemplate: 'Delete this template from this browser',
		// Comments
		commentUpvote: 'Upvote this comment',
		commentDownvote: 'Downvote this comment',
		// Chrome
		menu: 'Menu',
		notifications: 'Notifications',
		social: 'RANKMAKER on {network}',
	},
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
		createTemplate: 'Create Template',
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
		preferences: 'Preferences',
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
		brandCoverAlt: 'A 1v1 duel between two options and the top 3 ranking it produces',
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
		title: 'RANKMAKER — Rank Anything with Quick 1v1 Battles',
		metaDescription:
			'Build rankings you can trust through quick head-to-head battles. Rank movies, games, music and more — create your own template or play hundreds made by the community. Free, no sign-up needed.',
		heroEyebrow: 'The head-to-head ranking maker',
		heroHeadline1: 'Rank anything.',
		heroHeadline2: 'One battle at a time.',
		heroSubtitle:
			'Forget messy tier lists. RANKMAKER turns any list into quick 1v1 battles — you pick a winner, we build your definitive ranking. Movies, games, food, music: if you can list it, you can rank it.',
		createTemplate: 'Create a template',
		exploreTemplates: 'Explore templates',
		demoTitle: 'Movie Sagas',
		demoStarWars: 'Star Wars',
		demoMarvel: 'Marvel',
		demoHarryPotter: 'Harry Potter',
		demoLotr: 'The Lord of the Rings',
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
		loadMore: 'Show more',
		loading: 'Loading rankings…',
		loadError: "Couldn't load this ranking. Close the card and try again.",
		emptyBody: "You haven't ranked anything yet.",
		findSomething: 'Find something to rank',
	},
	local: {
		pageTitle: 'My template — RANKMAKER',
		metaDescription: 'A template saved in this browser.',
		backToMine: 'My templates on this device',
		// Guest view of /me: this browser's templates, with no profile chrome.
		mineTitle: 'My templates — RANKMAKER',
		bannerTitle: 'Saved on this device',
		bannerBody:
			'This template lives in this browser only. Sign in and it moves to your account — with the rankings you played on it.',
		bannerCta: 'Sign in',
		missingTitle: "This template isn't on this device",
		missingBody:
			'Guest templates are stored in the browser that created them, so it may have been created elsewhere, already moved to an account, or cleared with your browsing data.',
		missingCta: 'Create a template',
		// Subtitle of the guest view of /me, above the list (see LocalTemplates).
		sectionBody:
			'Saved in this browser only. Sign in and they move to your account, with the rankings you played on them.',
		emptyBody: "You haven't created any templates in this browser yet.",
		emptyCta: 'Create your first one',
		itemOptions: '{n} options',
		play: 'Rank it',
		delete: 'Delete',
		deleteConfirm: 'Delete this template from this browser? It cannot be recovered.',
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
		marketingLabel: 'Keep me posted about RANKMAKER',
		marketingDesc:
			'New features and the best rankings, now and then. Optional, no spam, and you can turn it off any time in your preferences.',
		marketingPolicy: 'How we handle your data',
		available: 'Username is available!',
		notAvailable: 'Username is not available.',
		checkFailed: 'Could not check username.',
		genericError: 'Something went wrong. Try again.',
		networkError: 'Network error. Try again.',
	},
	authModal: {
		title: 'Sign in to RANKMAKER',
		subtitle: 'Free, no password, takes five seconds.',
		benefitPublic: 'Publish public rankings anyone can play',
		benefitImages: 'Add cover and option images',
		benefitSocial: 'Save, comment and vote on rankings',
		continueWith: 'Continue with {provider}',
		maybeLater: 'Maybe later',
	},
	form: {
		details: 'Details',
		guestBannerTitle: 'Creating as a guest',
		guestBannerBody:
			'Your template is saved in this browser and you can play it right away — private and without images. Sign in to move it to your account, go public and add photos.',
		guestBannerCta: 'Sign in',
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
		visibilityUnlockCta: 'Sign in to unlock',
		coverImage: 'Cover image',
		coverPreviewAlt: 'Cover preview',
		coverCollageNote: 'No cover yet — this collage of your option images will be used.',
		uploadCta: 'Click or drop an image to upload',
		uploadHint: 'JPG, PNG, WebP, AVIF or GIF · up to 10 MB',
		lockedCoverCta: 'Sign in to add a cover image',
		lockedCoverHint: 'Free with an account',
		uploading: 'Uploading…',
		replaceImage: 'Replace image',
		removeImage: 'Remove image',
		optionAddImage: 'Add image',
		optionAddImageLocked: 'Sign in to add an image',
		options: 'Options',
		optionsMin: 'min {n}',
		optionsHelp:
			'The things people will rank in 1v1 battles. Images are optional — click the square next to a name to upload one.',
		optionsLockedNote: 'Sign in to add images to your options',
		addOption: 'Add option',
		removeOption: 'Remove option',
		optionNamePlaceholder: 'Option name',
		submitCreate: 'Create template',
		errLocalLimit:
			'You can keep {n} templates in this browser. Sign in to move them to your account and create more.',
		submitSave: 'Save changes',
		busyCreating: 'Creating…',
		busySaving: 'Saving…',
		// Validation
		errTitle: 'Title must be at least 3 characters.',
		errDescription: 'Description is required (at least 15 characters).',
		errCategory: 'Pick a category.',
		errCoverRequired: 'Add a cover image, or an image to at least 4 options.',
		errMinOptions: 'Add at least {n} options with a name.',
		errOptionNameNeeded: 'Every option with an image needs a name.',
		errUploadsPending: 'Wait for images to finish uploading.',
		errImageUpload: "Couldn't upload the image. Please try again.",
		errImageRejected:
			'That image may violate our content guidelines — please try a different one.',
		errImageTooLarge: 'That image is too large (max 10 MB).',
		errImageType: 'Unsupported file type — use JPG, PNG, WebP, AVIF or GIF.',
		errImageRateLimited:
			"You've hit today's image upload limit. Try again tomorrow.",
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
		// Names the pick the button would take back — see BattleView.tsx.
		undoNamed: 'Undo: {name}',
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
			body: legalContent.en.cookiePolicy,
		},
		privacyPolicy: {
			title: 'Privacy Policy — RANKMAKER',
			metaDescription: 'How we collect, use, and protect your data.',
			heading: 'Privacy Policy',
			body: legalContent.en.privacyPolicy,
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
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Cookies and Browser Storage</h2><p>We use only the necessary cookies and browser storage described in our Cookie Policy. We do not use advertising or third-party analytics cookies.</p></section>
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
	preferences: {
		title: 'Preferences — RANKMAKER',
		metaDescription:
			'Choose your language and decide whether RANKMAKER shows you templates flagged as mature content.',
		heading: 'Preferences',
		subtitle: 'How RANKMAKER behaves for you.',
		savedInBrowser: 'Saved in this browser.',
		savedOnAccount: 'Saved on your account, on every device.',
		signInHint: 'Log in to keep these preferences on all your devices.',
		languageHeading: 'Language',
		languageDesc: 'The language of the interface. Template content is not translated yet.',
		contentHeading: 'Content',
		matureLabel: 'Show mature content',
		matureDesc:
			'Templates flagged as adult content are hidden from the home page, search, categories and profiles. Turn this on to see them everywhere.',
		matureToggle: 'Toggle mature content',
		emailHeading: 'Email',
		emailPrefHeading: 'Activity notifications',
		emailPrefDesc: 'Email me about comments on my templates and replies to my comments.',
		emailPrefToggle: 'Toggle notification emails',
		emailPrefLoginHint: 'Log in to choose which emails we send you.',
		marketingHeading: 'News and updates',
		marketingDesc:
			'Email me now and then about new features and the best rankings on RANKMAKER. No spam, and you can turn this off whenever you like.',
		marketingToggle: 'Toggle news emails',
		marketingPolicy: 'How we handle your data',
		saveError: "Couldn't save your preference. Try again.",
	},
	mature: {
		gateTitle: 'This template may contain adult content',
		gateBody:
			'It has been flagged as mature content. You can turn mature content on to view it, or go back to the home page.',
		gateEnable: 'Show mature content',
		gateHome: 'Go to home',
		gateSettingsHint: 'You can change this any time in your preferences.',
		gateError: "Couldn't update your preference. Try again.",
		formLabel: 'Mature content',
		formHint:
			'Flag this template as adult content. Once public, it stays out of listings unless a visitor turns mature content on.',
		formLockedHint:
			'A moderator flagged this template as mature content, so the flag can no longer be removed.',
	},
	suspension: {
		badge: 'suspended',
		whyAria: 'Why this template was suspended',
		tipPrefix: 'A moderator suspended this template:',
		reasons: {
			low_quality: "its content doesn't add anything useful, or is too poor to rank.",
		},
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
		emailPrefLink: 'Manage notification emails in your preferences',
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
