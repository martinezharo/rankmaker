/**
 * Malay dictionary.
 * Keys and structure must match en.ts exactly.
 * Any key removed here falls back to English (see ../index.ts).
 */
import type { LocaleDict } from "../types";

export const ms: LocaleDict = {
	common: {
		save: 'Simpan',
		cancel: 'Batal',
		delete: 'Padam',
		edit: 'Edit',
		close: 'Tutup',
		loading: 'Memuatkan…',
		back: 'Kembali',
		next: 'Seterusnya',
		retry: 'Cuba lagi',
		confirm: 'Sahkan',
		genericError: 'Sesuatu telah berlaku. Cuba lagi.',
		networkError: 'Ralat rangkaian. Cuba lagi.',
	},
	me: {
		title: 'Templat saya — RANKMAKER',
		viewPublicProfile: 'Lihat profil awam',
		createTemplate: 'Buat templat',
		bioHeading: 'Bio',
		bioPlaceholder: 'Ceritakan sedikit tentang diri anda…',
		bioEmpty: 'Anda belum menambah bio.',
		bioEdit: 'Edit bio',
		bioSaved: 'Bio disimpan.',
		heading: 'Templat saya',
		templateSingular: 'templat',
		templatePlural: 'templat',
		emptyBody: 'Anda belum mencipta sebarang templat.',
		createFirst: 'Buat yang pertama',
		editTemplateAria: 'Edit templat',
		deleteTemplateAria: 'Padam templat',
		visibilityPrivate: 'peribadi',
		visibilityUnlisted: 'tidak tersenarai',
		dangerZone: 'Zon bahaya',
		dangerBody:
			'Memadam akaun anda akan membuang profil dan semua templat yang anda cipta secara kekal. Ini tidak boleh dibatalkan.',
		deleteMyAccount: 'Padam akaun saya',
		deleteTemplateTitle: 'Padam templat?',
		deleteTemplateBody: '"{title}" akan dipadam secara kekal. Ini tidak boleh dibatalkan.',
		deleteAccountTitle: 'Padam akaun',
		deleteAccountBody:
			'Ini akan memadam akaun dan semua templat anda secara kekal. Taip <strong class="font-bold text-text-primary">{username}</strong> untuk mengesahkan.',
		deleteForever: 'Padam selama-lamanya',
	},
	nav: {
		home: 'Laman Utama',
		findTemplates: 'Cari Templat',
		createRanking: 'Buat Ranking',
		create: 'Buat',
		login: 'Log masuk',
		logout: 'Log keluar',
		myProfile: 'Saya',
		mySaved: 'Disimpan',
		myTemplates: 'Templat saya',
		myHistory: 'Sejarah saya',
		toggleMenu: 'Togol menu',
		language: 'Bahasa',
	},
	footer: {
		tagline: 'Platform muktamad untuk membina ranking tepat melalui pertarungan 1v1.',
		openSource: 'Sumber Terbuka',
		contributeHere: 'Sumbang di sini',
		pages: 'Halaman',
		information: 'Maklumat',
		aboutUs: 'Tentang Kami',
		contact: 'Hubungi',
		categories: 'Kategori',
		legal: 'Undang-undang',
		privacyPolicy: 'Dasar Privasi',
		termsOfUse: 'Syarat Penggunaan',
		cookiePolicy: 'Dasar Kuki',
		legalNotice: 'Notis Undang-undang',
	},
	cookie: {
		title: 'Kami menggunakan kuki',
		body: "Kami menggunakan kuki untuk meningkatkan pengalaman anda dan menganalisis trafik kami. Dengan mengklik 'Terima', anda bersetuju dengan penggunaan kuki kami.",
		accept: 'Terima',
		reject: 'Tolak',
		policy: 'Dasar',
	},
	seo: {
		defaultDescription:
			'RANKMAKER: ranking benda-benda anda. Tiada peringkat, tiada gangguan — hanya ranking 1v1 yang tepat.',
	},
	recommended: {
		youMightAlsoLike: 'Anda mungkin juga suka',
	},
	seoContent: {
		howItWorks: 'Cara Ia Berfungsi',
		step1Title: 'Pilih Templat',
		step1Body:
			'Mulakan dengan memilih templat ranking — sama ada yang anda cipta atau yang dikongsi oleh orang lain.',
		step2Title: 'Pertarungan Bermula!',
		step2Body:
			'Sertai pertarungan head-to-head untuk menentukan susunan akhir anda. Buat pilihan mudah antara pasangan item untuk membina ranking sempurna anda.',
		step3Title: 'Kongsi Keputusan Anda',
		step3Body:
			'Kongsi keputusan ranking akhir anda dengan rakan-rakan dan lihat maklum balas mereka. Bandingkan ranking anda dan temui perspektif baru.',
		whatIsTitle: 'Apa itu RANKMAKER?',
		whatIsP1:
			'RANKMAKER ialah alat ranking muktamad yang membantu anda mengatur dan mengutamakan apa sahaja yang penting bagi anda. Sama ada anda meranking filem, muzik, permainan, buku, atau kategori lain, sistem perbandingan head-to-head unik kami memastikan keputusan tepat yang benar-benar mencerminkan pilihan anda.',
		whatIsP2:
			'Tidak seperti senarai peringkat tradisional yang memaksa anda membuat tugasan kategori sewenang-wenangnya, sistem pertarungan RANKMAKER membolehkan anda fokus pada satu soalan mudah pada satu masa: pilihan mana yang anda suka? Pendekatan sistematik ini membawa kepada ranking yang lebih tepat dan memuaskan.',
		feature1: 'Buat ranking tersuai tentang apa yang anda ambil berat',
		feature2: 'Guna templat pra-buat dari kategori popular',
		feature3: 'Kongsi ranking anda dengan rakan di media sosial',
		feature4: 'Bina profil yang mempamerkan templat anda',
	},
	home: {
		title: 'RANKMAKER — Ranking Benda-benda Anda',
		heroHeadline: 'ranking benda-benda anda.',
		heroSubtitle:
			'Tiada peringkat. Tiada gangguan. RANKMAKER membolehkan anda membina ranking tepat melalui pertarungan 1v1 yang pantas dan tegas. Pilih templat dan cari tahu apa yang sebenarnya menang.',
		exploreTemplates: 'Jelajahi Templat',
		followingHeading: 'Diikuti',
		emptyTitle: 'Tiada templat lagi',
		emptyBody:
			'Templat akan muncul di sini setelah ditambah ke pangkalan data. Semak semula tidak lama lagi!',
	},
	create: {
		title: 'Buat templat — RANKMAKER',
		metaDescription: 'Buat templat ranking anda sendiri di RANKMAKER.',
		heading: 'Buat templat',
		intro: 'Bina ranking anda sendiri. Jadikan awam supaya sesiapa sahaja boleh bermain dan ia muncul di profil anda, atau simpan sebagai tidak tersenarai atau peribadi — anda pilih keterlihatan di bawah.',
	},
	editTemplate: {
		title: 'Edit: {title} — RANKMAKER',
		backToMyTemplates: 'Kembali ke templat saya',
		heading: 'Edit templat',
		intro: 'URL templat kekal sama — pautan kongsi anda terus berfungsi. (Pengecualian: beralih ke tidak tersenarai memberikannya URL rawak baharu.)',
	},
	card: {
		ranked: '{n} diranking',
		votes: '{n} undi',
		viewProfile: "Lihat profil @{username}",
		shareAria: 'Kongsi templat',
		saveAria: 'Simpan templat',
		unsaveAria: 'Alih keluar daripada disimpan',
		shareTitle: 'RANKMAKER: {title}',
		viewAll: 'Lihat semua',
	},
	search: {
		title: 'Cari Templat — RANKMAKER',
		metaDescription: 'Cari dan semak imbas semua templat ranking di RANKMAKER.',
		heading: 'Cari Templat',
		subtitle:
			'Cari semua templat ranking yang tersedia mengikut tajuk, penerangan, atau pilihan.',
		placeholder: 'Cari templat...',
		clear: 'Kosongkan carian',
		allCategories: 'Semua Kategori',
		showing: 'Menunjukkan {n} templat',
		showingOne: 'Menunjukkan {n} templat',
		resetFilters: 'Set semula penapis',
		emptyTitle: 'Tiada templat dijumpai',
		emptyBody: 'Cuba laraskan pertanyaan carian anda atau tukar penapis kategori.',
	},
	history: {
		title: 'Sejarah ranking saya — RANKMAKER',
		heading: 'Sejarah ranking saya',
		subtitleLoggedIn:
			'Ranking yang telah anda selesaikan. Ketik kad untuk mendedahkan ranking penuh.',
		subtitleAnon:
			'Ranking yang telah anda selesaikan pada peranti ini. Ketik kad untuk mendedahkan ranking penuh. Log masuk untuk menyimpannya merentas peranti.',
		items: '{n} item',
		fullRanking: 'Ranking penuh',
		rankAgain: 'Rank semula',
		viewDetails: 'Lihat butiran',
		emptyBody: 'Anda belum meranking apa-apa lagi.',
		findSomething: 'Cari sesuatu untuk diranking',
	},
	saved: {
		title: 'Templat disimpan — RANKMAKER',
		heading: 'Templat disimpan',
		subtitle: 'Templat yang anda simpan untuk dilihat kemudian.',
		empty: 'Anda belum menyimpan sebarang templat.',
		emptyCta: 'Cari templat untuk disimpan',
	},
	profile: {
		title: '@{username} — RANKMAKER',
		metaDescription: 'Templat ranking yang dicipta oleh @{username} di RANKMAKER.',
		verified: 'Disahkan',
		officialAccount: 'Akaun rasmi RANKMAKER',
		memberSince: 'Ahli sejak {date}',
		templateSingular: 'templat',
		templatePlural: 'templat',
		totalRankings: '{n} ranking jumlah',
		templatesBy: 'Templat oleh @{username}',
		noTemplates: '@{username} belum mencipta sebarang templat.',
		follow: 'Ikut',
		following: 'Mengikuti',
		unfollow: 'Nyahikut',
		followersLabel: 'pengikut',
		followingLabel: 'mengikuti',
		followersTitle: 'Pengikut',
		followingTitle: 'Mengikuti',
		noFollowers: 'Belum ada pengikut.',
		noFollowing: 'Belum mengikuti sesiapa.',
	},
	signup: {
		title: 'Selesaikan pendaftaran — RANKMAKER',
		heading: 'Hampir selesai!',
		subtitle: 'Pilih nama pengguna dan avatar untuk menyelesaikan penciptaan akaun anda.',
		usernameLabel: 'Nama pengguna',
		usernamePlaceholder: 'nama_pengguna_anda',
		usernamePermanent: 'Nama pengguna anda adalah kekal — ia tidak boleh diubah.',
		avatarLabel: 'Avatar',
		avatarOptionLabel: 'Avatar {key}',
		shuffle: 'Kocok',
		submit: 'Buat akaun saya',
		available: 'Nama pengguna tersedia!',
		notAvailable: 'Nama pengguna tidak tersedia.',
		checkFailed: 'Tidak dapat menyemak nama pengguna.',
		genericError: 'Sesuatu telah berlaku. Cuba lagi.',
		networkError: 'Ralat rangkaian. Cuba lagi.',
	},
	form: {
		details: 'Butiran',
		titleLabel: 'Tajuk',
		titlePlaceholder: 'Ranking Topping Pizza Terbaik',
		descriptionLabel: 'Penerangan',
		descriptionPlaceholder: 'Apa yang orang akan ranking, dan mengapa ia menyeronokkan?',
		categoryLabel: 'Kategori',
		categoryPlaceholder: 'Pilih kategori…',
		visibilityLabel: 'Keterlihatan',
		visibilityPublicLabel: 'Awam — tersenarai untuk semua orang',
		visibilityPublicHint:
			'Ditunjukkan di laman utama, carian dan profil anda. Sesiapa sahaja boleh merangkingnya.',
		visibilityUnlistedLabel: 'Tidak tersenarai — hanya orang yang mempunyai pautan',
		visibilityUnlistedHint:
			'Tidak tersenarai di mana-mana dan tersembunyi daripada enjin carian. Ia mendapat URL rawak yang tidak dapat diteka — kongsi pautan dengan sesiapa yang anda mahu.',
		visibilityPrivateLabel: 'Peribadi — hanya anda',
		visibilityPrivateHint: 'Hanya anda boleh melihat dan meranking templat ini.',
		visibilityUnlistedSlugWarning:
			' Menyimpan akan mengubah URL templat kepada URL rawak baharu.',
		coverImage: 'Imej penutup',
		coverImageByUrl: '(melalui URL)',
		coverPlaceholder: 'https://example.com/cover.jpg',
		coverPreviewAlt: 'Pratonton penutup',
		previewHere: 'Pratonton muncul di sini',
		previewLoadError: 'Tidak dapat memuatkan imej itu',
		previewLoading: 'Memuatkan…',
		options: 'Pilihan',
		optionsMin: 'min {n}',
		optionsHelp:
			'Benda-benda yang orang akan ranking dalam pertarungan 1v1. Imej adalah pilihan — tampal URL imej dan anda akan melihat pratonton.',
		addOption: 'Tambah pilihan',
		removeOption: 'Buang pilihan',
		optionNamePlaceholder: 'Nama pilihan',
		optionImagePlaceholder: 'URL imej (pilihan)',
		submitCreate: 'Buat templat',
		submitSave: 'Simpan perubahan',
		busyCreating: 'Mencipta…',
		busySaving: 'Menyimpan…',
		errTitle: 'Tajuk mestilah sekurang-kurangnya 3 aksara.',
		errDescription: 'Penerangan diperlukan (sekurang-kurangnya 15 aksara).',
		errCategory: 'Pilih kategori.',
		errCoverRequired: 'Imej penutup diperlukan.',
		errCoverUrl: 'Imej penutup mestilah URL http(s) yang sah.',
		errMinOptions: 'Tambah sekurang-kurangnya {n} pilihan dengan nama.',
		errOptionNameNeeded: 'Setiap pilihan dengan imej memerlukan nama.',
		errOptionImageUrl: 'Pilihan "{name}": imej mestilah URL http(s) yang sah.',
		aiShortTitle: 'Penerangan anda terlalu pendek',
		aiShortCopy:
			'Penerangan memerlukan sekurang-kurangnya 15 aksara. Ini adalah yang kami tulis daripada tajuk dan pilihan anda — gunakan, atau tulis sendiri.',
		aiWriteMyOwn: 'Tulis sendiri',
		aiDiscoverTitle: 'Mahu ranking anda lebih popular?',
		aiPolishCopy:
			'Kami memperhalusi penerangan anda untuk membantu ranking anda ditemui. Edit jika anda suka, atau simpan asal anda.',
		aiRewriteCopy:
			'Dengan penerangan ini ranking anda akan lebih mudah ditemui. Edit jika anda suka, atau simpan asal anda.',
		aiKeepMine: 'Simpan milik saya',
		aiUseDescription: 'Guna penerangan ini',
		aiMinChars: 'Penerangan mestilah sekurang-kurangnya 15 aksara.',
	},
	comments: {
		heading: 'Komen',
		loading: 'Memuatkan komen…',
		close: 'Tutup',
		replyPlaceholder: 'Tulis balasan…',
		commentPlaceholder: 'Kongsi pendapat anda…',
		reply: 'Balas',
		comment: 'Komen',
		joinConversation: 'Sertai perbualan — log masuk untuk memberi komen dan mengundi.',
		viewRanking: 'Lihat ranking',
		upvote: 'Undi positif',
		downvote: 'Undi negatif',
		deleted: '[komen dipadam]',
		delete: 'Padam',
		empty: 'Tiada komen lagi. Jadilah yang pertama berkongsi pandangan anda.',
		loadError: 'Tidak dapat memuatkan komen.',
		rankingTitle: "Ranking @{username}",
		postError: 'Sesuatu telah berlaku.',
		networkError: 'Ralat rangkaian. Cuba lagi.',
		justNow: 'baru sahaja',
		minutesAgo: '{n} min lalu',
		hoursAgo: '{n} jam lalu',
		daysAgo: '{n} hari lalu',
		monthsAgo: '{n} bln lalu',
		yearsAgo: '{n} thn lalu',
	},
	ranking: {
		pageTitle: '{title} — RANKMAKER',
		backToTemplates: 'Kembali ke templat',
		createdBy: 'Dicipta oleh',
		optionsCount: '{n} pilihan',
		availableOptions: 'Pilihan Tersedia',
		itemsCount: '{n} item',
		startRanking: 'MULA RANKING',
		saveTemplate: 'Simpan',
		savedTemplate: 'Disimpan',
		voteUpAria: 'Undi naik templat ini',
		voteDownAria: 'Undi turun templat ini',
		roundProgress: 'Pusingan {current} daripada ~{total}',
		undo: 'Buat asal',
		skipForLater: 'Langkau untuk kemudian',
		finishEarly: 'Selesai Awal',
		rankingLabel: 'Ranking',
		tapPreferred: 'Ketik yang anda lebih suka',
		skippedCount: '{n} dilangkau',
		results: 'Keputusan',
		by: 'oleh',
		fullRanking: 'Ranking Penuh',
		battleHistory: 'Sejarah Pertarungan',
		rankAgain: 'Rank Semula',
		shareTemplate: 'Kongsi Templat',
		downloadImage: 'Muat Turun Imej',
		shareOnX: 'Kongsi di X',
		reorderManually: 'Susun Semula Secara Manual',
		doneReordering: 'Selesai Menyusun',
		noSkipping: 'Tidak boleh langkau sekarang — percaya naluri anda',
		suddenDeathOne: 'Sudden death — selesaikan {count} duel yang dilangkau',
		suddenDeath: 'Sudden death — selesaikan {count} duel yang dilangkau',
		podium1: 'ke-1',
		podium2: 'ke-2',
		podium3: 'ke-3',
		noBattlesRecorded: 'Tiada pertarungan direkodkan.',
		vs: 'lwn',
		generating: 'Menjana…',
		myRanking: 'Ranking Saya',
		shareXText: "Lihat templat ini: '{title}'",
		shareImgMadeWith: 'Dibuat dengan rankmaker.net',
		finishEarlyTitle: 'Selesaikan Ranking Lebih Awal?',
		finishEarlyBody:
			'Adakah anda pasti mahu menyelesaikan ranking lebih awal? Item yang tinggal akan diranking berdasarkan prestasi semasa mereka.',
		finishNow: 'Selesai Sekarang',
	},
	notFound: {
		title: 'Halaman tidak dijumpai — RANKMAKER',
		heading: 'Halaman ini tidak wujud',
		body: 'Templat atau halaman yang anda cari telah dipindahkan, dipadam, atau tidak pernah wujud.',
		backHome: 'Kembali ke laman utama',
		findTemplates: 'Cari templat',
	},
	about: {
		title: 'Tentang — RANKMAKER',
		metaDescription: 'Kisah di sebalik RANKMAKER dan penciptanya.',
		heading: 'Tentang',
		p1: 'Sebenarnya, tiada "kami" di sini — hanya saya. Nama saya <a href="https://olivermartinezharo.com/en" target="_blank"><strong class="text-text-primary hover:underline">Oli</strong></a>, dan saya adalah satu-satunya orang di sebalik RANKMAKER. Saya hanya seorang lelaki dari Sepanyol dengan cita-cita besar yang suka mencuba perkara baru. RANKMAKER adalah salah satu perkara yang saya putuskan untuk terjun ke dalamnya.',
		p2: "Suatu hari, selepas berlari, ketika bersiap untuk mandi, satu kenangan tiba-tiba terlintas di fikiran saya. Beberapa tahun lalu, saya membuat ranking pemandu Formula 1 yang seseorang telah kongsi di Twitter. Ada sesuatu yang menakjubkan tentangnya: saya tidak perlu berfikir terlalu keras tentang susunan tepat pemandu, dan ia bukan senarai peringkat. Saya hanya diberikan pertandingan yang berbeza, dan akhirnya mendapat ranking berdasarkan pilihan saya.",
		p3: 'Pada masa itu, saya tidak memikirkannya terlalu dalam, tetapi atas sebab tertentu, pada saat itu juga, ia kembali kepada saya. Semasa mandi, saya terus memikirkannya. Saya tidak tahu cara mengekod, tetapi saya obsesi dengan AI.',
		p4: 'Sebaik sahaja keluar dari bilik mandi, saya bermain dengan ChatGPT sebentar, dan dalam beberapa minit, saya mempunyai sistem asas di mana saya boleh memasukkan pilihan yang berbeza, membandingkannya dalam pertandingan, dan mendapatkan ranking yang tersusun. Saya juga menyedari bahawa tiada laman web yang melakukan perkara ini dengan tepat. Itu peluang saya.',
		p5: 'Saya fikir saya boleh menyelesaikan projek dengan hanya beberapa interaksi AI lagi… dan saya akan betul jika dengan "beberapa" saya maksudkan ribuan iterasi secara literal merentas model yang berbeza. Saya terpaksa mempelajari beberapa pengaturcaraan asas sepanjang perjalanan kerana, rupanya, anda tidak boleh hanya menyalin-tampal beberapa kod yang dijana ChatGPT ke dalam Notepad dan menyebutnya selesai.',
		p6: "Sejujurnya, saya mungkin boleh menyelesaikannya lebih cepat dengan mengupah seseorang di Fiverr, dan hasilnya akan lebih baik. Tapi itulah saya.",
		whyHeading: 'Mengapa RANKMAKER?',
		p7: 'Inspirasi terbesar untuk projek ini ialah <strong class="text-text-primary">TIERMAKER</strong>, bersama laman ranking F1 yang saya sebut tadi — walaupun saya tidak pernah melihatnya lagi (mungkin hanya projek sampingan seseorang).',
		p8: "Saya selalu suka meranking perkara (mungkin itu sejenis gangguan), tetapi kadangkala TIERMAKER terasa sangat membebankan dengan begitu banyak pilihan sekaligus, dan hasilnya tidak selalu mencerminkan apa yang saya benar-benar fikirkan.",
		finalLine: 'Jadi saya membetulkannya dengan RANKMAKER.',
	},
	contact: {
		title: 'Hubungi — RANKMAKER',
		metaDescription: 'Hubungi RANKMAKER.',
		heading: 'Hubungi',
		emailLabel: 'E-mel',
	},
	legal: {
		legalNotice: {
			title: 'Notis Undang-undang — RANKMAKER',
			metaDescription: 'Notis Undang-undang dan maklumat syarikat.',
			heading: 'Notis Undang-undang',
			body: `<p>Selaras dengan peruntukan Undang-undang 34/2002, bertarikh 11 Julai, mengenai Perkhidmatan Masyarakat Maklumat dan Perdagangan Elektronik (LSSI-CE), maklumat am berikut mengenai laman web ini disediakan:</p>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Pemilik Laman Web</h2><ul class="list-none space-y-1 pl-4 border-l-2 border-primary/20"><li><strong class="text-text-primary">Pemilik:</strong> Oliver Martínez</li><li><strong class="text-text-primary">E-mel:</strong> rankmaker.net@gmail.com</li><li><strong class="text-text-primary">Domain:</strong> rankmaker.net</li></ul></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Tujuan</h2><p>Tujuan laman web ini adalah untuk menyediakan pengguna dengan platform untuk mencipta dan mengurus senarai ranking menggunakan kaedah perbandingan.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Tanggungjawab Pengguna</h2><p>Pemilik tidak bertanggungjawab atas salah guna kandungan yang diterbitkan di laman web. Pengguna menanggung tanggungjawab atas sebarang penggunaan Perkhidmatan yang bertentangan dengan undang-undang atau ketenteraman awam.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Harta Intelek</h2><p>Semua kandungan di laman ini, termasuk teks, imej, dan kod, adalah milik RANKMAKER melainkan dinyatakan sebaliknya, dan dilindungi oleh undang-undang harta intelek.</p><p class="mt-2">Pembiakan, pengedaran, atau pengubahsuaian mana-mana bahagian laman tanpa kebenaran bertulis nyata daripada pemilik adalah dilarang.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Undang-undang yang Terpakai</h2><p>Notis Undang-undang ini ditadbir oleh undang-undang Sepanyol. Sebarang pertikaian yang timbul daripada penggunaan laman web ini akan tertakluk kepada bidang kuasa mahkamah Sepanyol.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Hubungi</h2><p>Untuk sebarang soalan atau penjelasan mengenai Notis Undang-undang ini, sila hubungi kami di: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		cookiePolicy: {
			title: 'Dasar Kuki — RANKMAKER',
			metaDescription: 'Dasar kami mengenai penggunaan kuki.',
			heading: 'Dasar Kuki',
			body: `<p>Selamat datang ke RANKMAKER! Dasar Kuki ini menerangkan cara kami menggunakan kuki dan teknologi serupa untuk mengenali anda apabila anda melawat laman web kami. Ia menerangkan apakah teknologi ini dan mengapa kami menggunakannya, serta hak anda untuk mengawal penggunaan kami terhadapnya.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">1. Apakah Kuki?</h2><p class="mb-4">Kuki adalah fail data kecil yang diletakkan di komputer atau peranti mudah alih anda apabila anda melawat laman web. Kuki digunakan secara meluas oleh pemilik laman web untuk membuat laman web mereka berfungsi, atau berfungsi dengan lebih cekap, serta untuk menyediakan maklumat pelaporan.</p><p>Kuki yang ditetapkan oleh pemilik laman web (dalam kes ini, RANKMAKER) dipanggil "kuki pihak pertama". Kuki yang ditetapkan oleh pihak selain pemilik laman web dipanggil "kuki pihak ketiga". Kuki pihak ketiga membolehkan ciri atau fungsi pihak ketiga disediakan pada atau melalui laman web (cth., pengiklanan, kandungan interaktif, dan analitik).</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">2. Mengapa Kami Menggunakan Kuki?</h2><p>Kami menggunakan kuki pihak pertama dan pihak ketiga atas beberapa sebab. Sesetengah kuki diperlukan atas sebab teknikal untuk laman web kami beroperasi, dan kami merujuknya sebagai kuki "penting" atau "perlu ketat". Kuki lain membolehkan kami menjejak dan menyasarkan minat pengguna kami untuk meningkatkan pengalaman. Pihak ketiga menyediakan kuki melalui laman web kami untuk analitik dan tujuan lain seperti yang dihuraikan di bawah.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">3. Jenis Kuki yang Kami Gunakan</h2><div class="space-y-4"><div><h3 class="text-lg font-medium text-text-primary mb-2">3.1. Kuki Perlu Ketat</h3><p>Kuki ini penting untuk menyediakan anda perkhidmatan yang tersedia melalui Laman Web kami dan untuk membolehkan anda menggunakan sesetengah cirinya, seperti akses ke kawasan selamat. Tanpa kuki ini, perkhidmatan yang anda minta, seperti troli membeli-belah dan akaun pengguna selamat, tidak dapat disediakan.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.2. Kuki Fungsional</h3><p>Kuki ini digunakan untuk meningkatkan fungsi Laman Web kami tetapi tidak penting untuk penggunaannya. Walau bagaimanapun, tanpa kuki ini, fungsi tertentu (seperti mengingat butiran log masuk atau keutamaan tapak) mungkin tidak tersedia.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.3. Kuki Analitik dan Prestasi</h3><p>Kuki ini mengumpul maklumat yang digunakan sama ada dalam bentuk agregat untuk membantu kami memahami cara Laman Web kami digunakan atau seberapa berkesan kempen pemasaran kami, atau untuk membantu kami menyesuaikan Laman Web untuk anda. Ini membantu kami meningkatkan pengalaman anda.</p></div></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">4. Kuki Khusus yang Kami Pasang</h2><p class="mb-4">Di bawah adalah senarai kuki utama yang kami gunakan di laman web kami:</p><div class="overflow-x-auto rounded-xl border border-border"><table class="w-full text-sm text-left"><thead class="bg-surface-elevated text-text-primary font-semibold"><tr><th class="px-4 py-3 border-b border-border">Nama Kuki</th><th class="px-4 py-3 border-b border-border">Tujuan</th><th class="px-4 py-3 border-b border-border">Tempoh</th><th class="px-4 py-3 border-b border-border">Diurus Oleh</th><th class="px-4 py-3 border-b border-border">Jenis</th></tr></thead><tbody class="divide-y divide-border"><tr><td class="px-4 py-3 font-medium">PHPSESSID (atau serupa)</td><td class="px-4 py-3">Mengekalkan keadaan sesi anda merentas permintaan halaman.</td><td class="px-4 py-3">Sesi</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Perlu Ketat</td></tr><tr><td class="px-4 py-3 font-medium">rankmaker_visited</td><td class="px-4 py-3">Menjejak sama ada anda pernah melawat tapak sebelum ini.</td><td class="px-4 py-3">30 hari</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Fungsional</td></tr><tr><td class="px-4 py-3 font-medium">remember_token</td><td class="px-4 py-3">Mengingat butiran log masuk anda untuk log masuk automatik.</td><td class="px-4 py-3">30 hari</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Fungsional</td></tr><tr><td class="px-4 py-3 font-medium">cookie_consent_status</td><td class="px-4 py-3">Menyimpan status persetujuan anda.</td><td class="px-4 py-3">1 tahun</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Fungsional</td></tr><tr><td class="px-4 py-3 font-medium">_ga</td><td class="px-4 py-3">Membezakan pengguna untuk statistik.</td><td class="px-4 py-3">2 tahun</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analitik</td></tr><tr><td class="px-4 py-3 font-medium">_gid</td><td class="px-4 py-3">Membezakan pengguna untuk statistik.</td><td class="px-4 py-3">24 jam</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analitik</td></tr></tbody></table></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">5. Bagaimana Anda Boleh Mengawal Kuki?</h2><p class="mb-4">Anda berhak untuk memutuskan sama ada untuk menerima atau menolak kuki. Anda boleh menggunakan pilihan kuki anda dengan:</p><ul class="list-disc pl-5 space-y-2 mb-4"><li><strong class="text-text-primary">Tetapan Pelayar:</strong> Kebanyakan pelayar web membenarkan kawalan sebilangan besar kuki melalui tetapan pelayar.</li><li><strong class="text-text-primary">Pilihan Keluar Pihak Ketiga:</strong> Untuk Google Analytics, anda boleh memilih keluar dengan melawat <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Tambahan Pelayar Pilihan Keluar Google Analytics</a>.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">6. Cara Membatalkan Persetujuan</h2><p class="mb-4">Jika anda telah memberikan persetujuan sebelum ini kepada penggunaan kuki bukan penting kami, anda boleh membatalkan persetujuan ini dengan mengosongkan kuki dari pelayar anda untuk tapak kami. Ini akan membuang kuki <code>cookie_consent_status</code>.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">7. Perubahan pada Dasar Kuki Ini</h2><p>Kami mungkin mengemas kini Dasar Kuki ini dari masa ke masa untuk mencerminkan, misalnya, perubahan pada kuki yang kami gunakan atau atas sebab operasi, undang-undang atau peraturan lain. Oleh itu, sila lawati semula Dasar Kuki ini secara berkala untuk mendapatkan maklumat terkini tentang penggunaan kuki dan teknologi berkaitan kami.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">8. Hubungi Kami</h2><p>Jika anda mempunyai sebarang soalan tentang penggunaan kuki atau teknologi lain kami, sila e-mel kami di <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		privacyPolicy: {
			title: 'Dasar Privasi — RANKMAKER',
			metaDescription: 'Cara kami mengumpul, menggunakan, dan melindungi data anda.',
			heading: 'Dasar Privasi',
			body: `<p>Selamat datang ke RANKMAKER! Dasar Privasi ini menerangkan cara kami mengumpul, menggunakan, dan mendedahkan maklumat tentang anda apabila anda menggunakan laman web dan perkhidmatan kami (secara kolektif, "Perkhidmatan"). Dengan menggunakan Perkhidmatan, anda bersetuju dengan syarat Dasar Privasi ini.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Maklumat yang Kami Kumpul</h2><p class="mb-3">Kami mungkin mengumpul maklumat berikut:</p><ul class="list-disc pl-5 space-y-2"><li><strong class="text-text-primary">Maklumat Peribadi:</strong> Alamat e-mel, nama pengguna, dan butiran lain yang anda berikan semasa mencipta akaun.</li><li><strong class="text-text-primary">Maklumat Penggunaan:</strong> Halaman yang anda lawati, masa yang dihabiskan di halaman, interaksi dengan Perkhidmatan.</li><li><strong class="text-text-primary">Maklumat Peranti:</strong> Alamat IP, jenis pelayar, pengecam peranti, dan sistem operasi.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Cara Kami Menggunakan Maklumat Anda</h2><p class="mb-3">Kami menggunakan maklumat anda untuk:</p><ul class="list-disc pl-5 space-y-2"><li>Menyediakan, mengekalkan, dan meningkatkan Perkhidmatan.</li><li>Berkomunikasi dengan anda.</li><li>Memastikan keselamatan dan mencegah penipuan.</li><li>Menganalisis penggunaan dan meningkatkan pengalaman pengguna.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Kuki dan Teknologi Penjejakan</h2><p>Kami mungkin menggunakan kuki dan teknologi serupa untuk meningkatkan fungsi dan prestasi. Anda boleh mengurus pilihan kuki anda melalui tetapan pelayar anda.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Perkongsian Maklumat</h2><p class="mb-3">Kami tidak menjual data peribadi anda. Kami mungkin berkongsi maklumat dengan:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Pembekal perkhidmatan (cth., pengehosan, analitik, pengiklanan).</li><li>Pihak berkuasa jika dikehendaki oleh undang-undang.</li></ul><p>Secara khusus, kami mungkin berkongsi data anda dengan:</p><ul class="list-disc pl-5 space-y-2 mt-2"><li><strong>Hostinger:</strong> Pembekal pengehosan laman web kami.</li><li><strong>Google (Analytics, Ads):</strong> Kami menggunakan Google Analytics untuk memantau dan menganalisis trafik web dan Google Ads untuk tujuan pengiklanan.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Pengekalan Data</h2><p>Kami menyimpan data anda selama yang perlu untuk menyediakan Perkhidmatan dan mematuhi kewajipan undang-undang.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Hak Anda</h2><p class="mb-3">Anda boleh:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Mengakses atau mengemas kini maklumat peribadi anda.</li><li>Meminta pemadaman data anda.</li><li>Membantah pemprosesan data anda.</li></ul><p class="mb-3">Jika anda adalah penduduk Kawasan Ekonomi Eropah (EEA) atau Sepanyol, anda mempunyai hak perlindungan data tertentu di bawah GDPR dan undang-undang Sepanyol, termasuk:</p><ul class="list-disc pl-5 space-y-2"><li>Hak untuk mengakses, mengemas kini atau memadam maklumat yang kami ada tentang anda.</li><li>Hak pembetulan.</li><li>Hak untuk membantah.</li><li>Hak sekatan.</li><li>Hak kepada mudah alih data.</li><li>Hak untuk menarik balik persetujuan.</li></ul><p class="mt-3 text-sm text-text-muted">Sila ambil perhatian bahawa kami mungkin meminta anda mengesahkan identiti sebelum menjawab permintaan tersebut.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Privasi Kanak-kanak</h2><p>Perkhidmatan kami tidak ditujukan kepada kanak-kanak di bawah 13 tahun. Kami tidak secara sengaja mengumpul maklumat peribadi daripada kanak-kanak di bawah 13 tahun.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Keselamatan Data</h2><p>Keselamatan data anda penting bagi kami, tetapi ingat bahawa tiada kaedah penghantaran melalui Internet atau kaedah penyimpanan elektronik yang 100% selamat. Walaupun kami berusaha untuk menggunakan cara yang boleh diterima secara komersial untuk melindungi Data Peribadi anda, kami tidak dapat menjamin keselamatannya yang mutlak.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Perubahan pada Dasar Ini</h2><p>Kami mungkin mengemas kini Dasar Privasi ini. Kami akan memberitahu anda tentang perubahan ketara melalui e-mel atau di Perkhidmatan.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Hubungi Kami</h2><p>Jika anda mempunyai soalan tentang Dasar Privasi ini, sila hubungi kami di <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		termsOfUse: {
			title: 'Syarat Penggunaan — RANKMAKER',
			metaDescription: 'Terma dan syarat untuk menggunakan RANKMAKER.',
			heading: 'Syarat Penggunaan',
			body: `<p>Selamat datang ke RANKMAKER! Syarat Penggunaan ini ("Syarat") mengawal akses dan penggunaan anda terhadap laman web rankmaker.net dan perkhidmatan (secara kolektif, "Perkhidmatan") yang disediakan oleh RANKMAKER ("kami"). Sila baca Syarat ini dengan teliti sebelum menggunakan Perkhidmatan.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Penerimaan Syarat</h2><p>Dengan mengakses atau menggunakan Perkhidmatan, anda bersetuju untuk terikat dengan Syarat ini dan Dasar Privasi kami. Jika anda tidak bersetuju, jangan gunakan Perkhidmatan.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Akaun Pengguna</h2><p>Untuk mengakses ciri tertentu, anda mungkin perlu mencipta akaun. Anda mesti memberikan maklumat yang tepat dan bertanggungjawab untuk mengekalkan kerahsiaan dan semua aktiviti pada akaun anda.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Penggunaan Perkhidmatan</h2><p>Anda bersetuju untuk menggunakan Perkhidmatan secara sah dan selaras dengan Syarat ini. Perkhidmatan direka untuk pengguna mencipta, berkongsi, dan mengurus senarai ranking melalui sistem perbandingan.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Kandungan dan Tingkah Laku Pengguna</h2><p class="mb-3">Anda bertanggungjawab atas sebarang kandungan yang anda muat naik. Anda bersetuju untuk tidak menyiarkan kandungan yang menyalahi undang-undang, menyinggung perasaan, berbahaya, atau melanggar hak orang lain.</p><p>Kami mungkin memantau, membuang, atau melumpuhkan akses kepada kandungan yang melanggar Syarat ini. Kami mungkin menggantung atau menamatkan akses anda kepada Perkhidmatan atas pelanggaran.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Perkhidmatan Pihak Ketiga</h2><p>Perkhidmatan mungkin termasuk pautan ke tapak pihak ketiga. Kami tidak bertanggungjawab atas kandungan, amalan privasi, atau perkhidmatan mereka.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Kuki</h2><p>Kami mungkin menggunakan kuki dan teknologi serupa seperti yang dihuraikan dalam Dasar Privasi kami.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Had Umur</h2><p>Anda mesti berumur sekurang-kurangnya 13 tahun untuk menggunakan Perkhidmatan.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Penafian Waranti</h2><p>Perkhidmatan disediakan "seadanya" dan tanpa waranti. Kami menafikan semua waranti setakat yang dibenarkan oleh undang-undang.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Had Liabiliti</h2><p>Kami tidak bertanggungjawab atas sebarang kerosakan tidak langsung, sampingan, atau berbangkit akibat penggunaan Perkhidmatan anda.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Undang-undang yang Mengawal</h2><p>Syarat ini ditadbir oleh undang-undang Sepanyol.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">11. Perubahan pada Syarat</h2><p>Kami mungkin mengubah suai Syarat ini. Penggunaan berterusan Perkhidmatan selepas perubahan bermakna anda menerima Syarat baharu.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">12. Hubungi</h2><p>Untuk soalan, hubungi: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
	},
	categories: {
		Movies: 'Filem',
		Music: 'Muzik',
		Sports: 'Sukan',
		Games: 'Permainan',
		TV: 'TV',
		People: 'Orang',
		Internet: 'Internet',
		Anime: 'Anime',
		Lifestyle: 'Gaya Hidup',
		Food: 'Makanan',
		Politics: 'Politik',
		'History & Culture': 'Sejarah & Budaya',
		Geography: 'Geografi',
		Motor: 'Motor',
		Books: 'Buku',
		Technology: 'Teknologi',
		Nature: 'Alam Semula Jadi',
		Others: 'Lain-lain',
	},
};
