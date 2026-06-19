/**
 * Spanish (España) dictionary.
 * Keys and structure must match en.ts exactly.
 * Any key removed here falls back to English (see ../index.ts).
 */
import type { LocaleDict } from "../types";

export const es: LocaleDict = {
	common: {
		save: 'Guardar',
		cancel: 'Cancelar',
		delete: 'Eliminar',
		edit: 'Editar',
		close: 'Cerrar',
		loading: 'Cargando…',
		back: 'Volver',
		next: 'Siguiente',
		retry: 'Intentar de nuevo',
		confirm: 'Confirmar',
		genericError: 'Algo ha ido mal. Inténtalo de nuevo.',
		networkError: 'Error de red. Inténtalo de nuevo.',
	},
	me: {
		title: 'Mis plantillas — RANKMAKER',
		viewPublicProfile: 'Ver perfil público',
		createTemplate: 'Crear plantilla',
		bioHeading: 'Biografía',
		bioPlaceholder: 'Cuenta algo sobre ti…',
		bioEmpty: 'Aún no has añadido una biografía.',
		bioEdit: 'Editar biografía',
		bioSaved: 'Biografía guardada.',
		heading: 'Mis plantillas',
		templateSingular: 'plantilla',
		templatePlural: 'plantillas',
		emptyBody: 'Todavía no has creado ninguna plantilla.',
		createFirst: 'Crea tu primera',
		editTemplateAria: 'Editar plantilla',
		deleteTemplateAria: 'Eliminar plantilla',
		visibilityPrivate: 'privada',
		visibilityUnlisted: 'no listada',
		dangerZone: 'Zona de peligro',
		dangerBody:
			'Eliminar tu cuenta borra permanentemente tu perfil y todas las plantillas que has creado. Esto no se puede deshacer.',
		deleteMyAccount: 'Eliminar mi cuenta',
		deleteTemplateTitle: '¿Eliminar plantilla?',
		deleteTemplateBody:
			'"{title}" se eliminará permanentemente. Esto no se puede deshacer.',
		deleteAccountTitle: 'Eliminar cuenta',
		deleteAccountBody:
			'Esto elimina permanentemente tu cuenta y todas tus plantillas. Escribe <strong class="font-bold text-text-primary">{username}</strong> para confirmar.',
		deleteForever: 'Eliminar para siempre',
	},
	nav: {
		home: 'Inicio',
		findTemplates: 'Buscar plantillas',
		createRanking: 'Crear ranking',
		create: 'Crear',
		login: 'Iniciar sesión',
		logout: 'Cerrar sesión',
		myProfile: 'Yo',
		mySaved: 'Guardados',
		myTemplates: 'Mis plantillas',
		myHistory: 'Mi historial',
		notifications: 'Notificaciones',
		toggleMenu: 'Abrir menú',
		language: 'Idioma',
	},
	footer: {
		tagline: 'La plataforma definitiva para crear rankings precisos mediante batallas 1 contra 1.',
		openSource: 'Código abierto',
		contributeHere: 'Contribuye aquí',
		pages: 'Páginas',
		information: 'Información',
		aboutUs: 'Sobre nosotros',
		contact: 'Contacto',
		categories: 'Categorías',
		legal: 'Legal',
		privacyPolicy: 'Política de privacidad',
		termsOfUse: 'Términos de uso',
		cookiePolicy: 'Política de cookies',
		legalNotice: 'Aviso legal',
	},
	cookie: {
		title: 'Usamos cookies',
		body: "Usamos cookies para mejorar tu experiencia y analizar nuestro tráfico. Al hacer clic en 'Aceptar', consientes el uso de cookies.",
		accept: 'Aceptar',
		reject: 'Rechazar',
		policy: 'Política',
	},
	seo: {
		defaultDescription:
			'RANKMAKER: clasifica tus favoritos. Sin niveles, sin ruido — solo rankings precisos 1 contra 1.',
	},
	recommended: {
		youMightAlsoLike: 'También te puede gustar',
	},
	seoContent: {
		howItWorks: 'Cómo funciona',
		step1Title: 'Elige una plantilla',
		step1Body:
			'Empieza seleccionando una plantilla de ranking — ya sea una que hayas creado tú o una compartida por otros.',
		step2Title: '¡Comienzan los enfrentamientos!',
		step2Body:
			'Participa en duelos 1 contra 1 para determinar tu orden final. Toma decisiones sencillas entre pares de opciones para construir tu ranking perfecto.',
		step3Title: 'Comparte tus resultados',
		step3Body:
			'Comparte tu ranking final con tus amigos y descubre sus opiniones. Compara vuestros rankings y encuentra nuevas perspectivas.',
		whatIsTitle: '¿Qué es RANKMAKER?',
		whatIsP1:
			'RANKMAKER es la herramienta de ranking definitiva que te ayuda a organizar y priorizar cualquier cosa que te importe. Ya sea que estés clasificando películas, música, videojuegos, libros o cualquier otra categoría, nuestro sistema único de comparación cara a cara garantiza resultados precisos que reflejan verdaderamente tus preferencias.',
		whatIsP2:
			'A diferencia de las tradicionales listas por niveles que te obligan a hacer asignaciones de categorías arbitrarias, el sistema de batallas de RANKMAKER te permite centrarte en una sola pregunta a la vez: ¿qué opción prefieres? Este enfoque metódico conduce a rankings más precisos y satisfactorios.',
		feature1: 'Crea rankings personalizados de lo que más te importa',
		feature2: 'Usa plantillas predefinidas de categorías populares',
		feature3: 'Comparte tus rankings con amigos en redes sociales',
		feature4: 'Crea un perfil que muestre tus plantillas',
	},
	home: {
		title: 'RANKMAKER — Clasifica tus favoritos',
		heroHeadline: 'clasifica tus favoritos.',
		heroSubtitle:
			'Sin niveles. Sin ruido. RANKMAKER te permite crear rankings precisos mediante batallas 1 contra 1 rápidas y decisivas. Elige una plantilla y descubre qué queda en lo más alto.',
		exploreTemplates: 'Explorar plantillas',
		followingHeading: 'Siguiendo',
		emptyTitle: 'Aún no hay plantillas',
		emptyBody:
			'Las plantillas aparecerán aquí cuando se añadan a la base de datos. ¡Vuelve pronto!',
	},
	create: {
		title: 'Crear plantilla — RANKMAKER',
		metaDescription: 'Crea tu propia plantilla de ranking en RANKMAKER.',
		heading: 'Crear plantilla',
		intro: 'Crea tu propio ranking. Hazlo público para que cualquiera pueda jugarlo y aparezca en tu perfil, o mantenlo no listado o privado — tú eliges la visibilidad a continuación.',
	},
	editTemplate: {
		title: 'Editar: {title} — RANKMAKER',
		backToMyTemplates: 'Volver a mis plantillas',
		heading: 'Editar plantilla',
		intro: 'La URL de la plantilla no cambia — tus enlaces para compartir siguen funcionando. (Excepción: cambiar a no listada le asigna una nueva URL aleatoria.)',
	},
	card: {
		ranked: '{n} clasificados',
		votes: '{n} votos',
		viewProfile: 'Ver el perfil de @{username}',
		shareAria: 'Compartir plantilla',
		saveAria: 'Guardar plantilla',
		unsaveAria: 'Quitar de guardados',
		shareTitle: 'RANKMAKER: {title}',
		viewAll: 'Ver todo',
	},
	search: {
		title: 'Buscar plantillas — RANKMAKER',
		metaDescription: 'Busca y explora todas las plantillas de ranking en RANKMAKER.',
		heading: 'Buscar plantillas',
		subtitle:
			'Busca entre todas las plantillas de ranking disponibles por título, descripción u opciones.',
		placeholder: 'Buscar plantillas...',
		clear: 'Limpiar búsqueda',
		allCategories: 'Todas las categorías',
		showing: 'Mostrando {n} plantillas',
		showingOne: 'Mostrando {n} plantilla',
		resetFilters: 'Restablecer filtros',
		emptyTitle: 'No se encontraron plantillas',
		emptyBody: 'Prueba a ajustar tu búsqueda o a cambiar el filtro de categoría.',
	},
	history: {
		title: 'Mi historial de rankings — RANKMAKER',
		heading: 'Mi historial de rankings',
		subtitleLoggedIn:
			'Los rankings que has completado. Toca una tarjeta para ver el ranking completo.',
		subtitleAnon:
			'Rankings que has completado en este dispositivo. Toca una tarjeta para ver el ranking completo. Inicia sesión para mantenerlos entre dispositivos.',
		items: '{n} elementos',
		fullRanking: 'Ranking completo',
		rankAgain: 'Clasificar de nuevo',
		viewDetails: 'Ver detalles',
		emptyBody: 'Todavía no has clasificado nada.',
		findSomething: 'Encuentra algo que clasificar',
	},
	saved: {
		title: 'Plantillas guardadas — RANKMAKER',
		heading: 'Plantillas guardadas',
		subtitle: 'Plantillas que has guardado para más tarde.',
		empty: 'Aún no has guardado ninguna plantilla.',
		emptyCta: 'Encuentra plantillas para guardar',
	},
	profile: {
		title: '@{username} — RANKMAKER',
		metaDescription: 'Plantillas de ranking creadas por @{username} en RANKMAKER.',
		verified: 'Verificado',
		officialAccount: 'Cuenta oficial de RANKMAKER',
		memberSince: 'Miembro desde {date}',
		templateSingular: 'plantilla',
		templatePlural: 'plantillas',
		totalRankings: '{n} rankings en total',
		templatesBy: 'Plantillas de @{username}',
		noTemplates: '@{username} aún no ha creado ninguna plantilla.',
		follow: 'Seguir',
		following: 'Siguiendo',
		unfollow: 'Dejar de seguir',
		followersLabel: 'seguidores',
		followingLabel: 'siguiendo',
		followersTitle: 'Seguidores',
		followingTitle: 'Siguiendo',
		noFollowers: 'Aún no tiene seguidores.',
		noFollowing: 'Todavía no sigue a nadie.',
	},
	signup: {
		title: 'Termina de registrarte — RANKMAKER',
		heading: '¡Ya casi está!',
		subtitle: 'Elige un nombre de usuario y un avatar para terminar de crear tu cuenta.',
		usernameLabel: 'Nombre de usuario',
		usernamePlaceholder: 'tu_nombre_de_usuario',
		usernamePermanent: 'Tu nombre de usuario es permanente — nunca podrá cambiarse.',
		avatarLabel: 'Avatar',
		avatarOptionLabel: 'Avatar {key}',
		shuffle: 'Mezclar',
		submit: 'Crear mi cuenta',
		available: '¡El nombre de usuario está disponible!',
		notAvailable: 'El nombre de usuario no está disponible.',
		checkFailed: 'No se pudo comprobar el nombre de usuario.',
		genericError: 'Algo ha ido mal. Inténtalo de nuevo.',
		networkError: 'Error de red. Inténtalo de nuevo.',
	},
	form: {
		details: 'Detalles',
		titleLabel: 'Título',
		titlePlaceholder: 'Ranking de los mejores ingredientes para pizza',
		descriptionLabel: 'Descripción',
		descriptionPlaceholder: '¿Qué deben clasificar las personas y por qué es divertido?',
		categoryLabel: 'Categoría',
		categoryPlaceholder: 'Elige una categoría…',
		visibilityLabel: 'Visibilidad',
		visibilityPublicLabel: 'Pública — listada para todos',
		visibilityPublicHint:
			'Aparece en la página de inicio, en búsquedas y en tu perfil. Cualquiera puede clasificarla.',
		visibilityUnlistedLabel: 'No listada — solo para quienes tengan el enlace',
		visibilityUnlistedHint:
			'No aparece en ninguna lista y está oculta a los motores de búsqueda. Recibe una URL aleatoria imposible de adivinar — comparte el enlace con quien quieras.',
		visibilityPrivateLabel: 'Privada — solo tú',
		visibilityPrivateHint: 'Solo tú puedes ver y usar esta plantilla.',
		visibilityUnlistedSlugWarning:
			' Guardar cambiará la URL de la plantilla por una nueva URL aleatoria.',
		coverImage: 'Imagen de portada',
		coverImageByUrl: '(por URL)',
		coverPlaceholder: 'https://ejemplo.com/portada.jpg',
		coverPreviewAlt: 'Vista previa de la portada',
		previewHere: 'La vista previa aparece aquí',
		previewLoadError: 'No se pudo cargar esa imagen',
		previewLoading: 'Cargando…',
		options: 'Opciones',
		optionsMin: 'mín. {n}',
		optionsHelp:
			'Las cosas que la gente clasificará en duelos 1 contra 1. Las imágenes son opcionales — pega una URL de imagen y verás una vista previa.',
		addOption: 'Añadir opción',
		removeOption: 'Eliminar opción',
		optionNamePlaceholder: 'Nombre de la opción',
		optionImagePlaceholder: 'URL de imagen (opcional)',
		submitCreate: 'Crear plantilla',
		submitSave: 'Guardar cambios',
		busyCreating: 'Creando…',
		busySaving: 'Guardando…',
		errTitle: 'El título debe tener al menos 3 caracteres.',
		errDescription: 'La descripción es obligatoria (al menos 15 caracteres).',
		errCategory: 'Elige una categoría.',
		errCoverRequired: 'La imagen de portada es obligatoria.',
		errCoverUrl: 'La imagen de portada debe ser una URL http(s) válida.',
		errMinOptions: 'Añade al menos {n} opciones con nombre.',
		errOptionNameNeeded: 'Cada opción con imagen necesita un nombre.',
		errOptionImageUrl: 'Opción "{name}": la imagen debe ser una URL http(s) válida.',
		aiShortTitle: 'Tu descripción es demasiado corta',
		aiShortCopy:
			'Una descripción necesita al menos 15 caracteres. Aquí tienes una que hemos escrito a partir de tu título y opciones — úsala o escribe la tuya.',
		aiWriteMyOwn: 'Escribir la mía',
		aiDiscoverTitle: '¿Quieres que tu ranking sea más popular?',
		aiPolishCopy:
			'Hemos pulido tu descripción para ayudar a que tu ranking sea más fácil de descubrir. Edítala si quieres, o quédate con la original.',
		aiRewriteCopy:
			'Con esta descripción tu ranking será más fácil de descubrir. Edítala si quieres, o quédate con la original.',
		aiKeepMine: 'Quedarse con la mía',
		aiUseDescription: 'Usar esta descripción',
		aiMinChars: 'La descripción debe tener al menos 15 caracteres.',
	},
	comments: {
		heading: 'Comentarios',
		loading: 'Cargando comentarios…',
		close: 'Cerrar',
		replyPlaceholder: 'Escribe una respuesta…',
		commentPlaceholder: 'Comparte lo que piensas…',
		reply: 'Responder',
		comment: 'Comentar',
		joinConversation: 'Únete a la conversación — inicia sesión para comentar y votar.',
		viewRanking: 'Ver ranking',
		upvote: 'Voto positivo',
		downvote: 'Voto negativo',
		deleted: '[comentario eliminado]',
		delete: 'Eliminar',
		empty: 'Aún no hay comentarios. Sé el primero en compartir tu opinión.',
		loadError: 'No se pudieron cargar los comentarios.',
		rankingTitle: 'Ranking de @{username}',
		postError: 'Algo ha ido mal.',
		networkError: 'Error de red. Inténtalo de nuevo.',
		justNow: 'ahora mismo',
		minutesAgo: 'hace {n} min',
		hoursAgo: 'hace {n} h',
		daysAgo: 'hace {n} d',
		monthsAgo: 'hace {n} mes',
		yearsAgo: 'hace {n} año',
	},
	ranking: {
		pageTitle: '{title} — RANKMAKER',
		backToTemplates: 'Volver a plantillas',
		createdBy: 'Creado por',
		optionsCount: '{n} opciones',
		availableOptions: 'Opciones disponibles',
		itemsCount: '{n} elementos',
		startRanking: 'EMPEZAR A CLASIFICAR',
		saveTemplate: 'Guardar',
		savedTemplate: 'Guardado',
		voteUpAria: 'Votar a favor de esta plantilla',
		voteDownAria: 'Votar en contra de esta plantilla',
		roundProgress: 'Ronda {current} de ~{total}',
		undo: 'Deshacer',
		skipForLater: 'Dejar para después',
		finishEarly: 'Terminar antes',
		rankingLabel: 'Ranking',
		tapPreferred: 'Toca el que prefieras',
		skippedCount: '{n} saltados',
		results: 'Resultados',
		by: 'por',
		fullRanking: 'Ranking completo',
		battleHistory: 'Historial de batallas',
		rankAgain: 'Clasificar de nuevo',
		shareTemplate: 'Compartir plantilla',
		downloadImage: 'Descargar imagen',
		shareOnX: 'Compartir en X',
		reorderManually: 'Reordenar manualmente',
		doneReordering: 'Listo',
		noSkipping: 'No se puede saltar ahora — fíate de tu instinto',
		suddenDeathOne: 'Muerte súbita — resuelve {count} duelo saltado',
		suddenDeath: 'Muerte súbita — resuelve {count} duelos saltados',
		podium1: '1.º',
		podium2: '2.º',
		podium3: '3.º',
		noBattlesRecorded: 'No hay batallas registradas.',
		vs: 'vs',
		generating: 'Generando…',
		myRanking: 'Mi ranking',
		shareXText: "Echa un vistazo a esta plantilla: '{title}'",
		shareImgMadeWith: 'Hecho con rankmaker.net',
		finishEarlyTitle: '¿Terminar el ranking antes?',
		finishEarlyBody:
			'¿Seguro que quieres terminar el ranking antes? Los elementos restantes se clasificarán según su rendimiento actual.',
		finishNow: 'Terminar ahora',
	},
	notFound: {
		title: 'Página no encontrada — RANKMAKER',
		heading: 'Esta página no existe',
		body: 'La plantilla o página que buscas fue movida, eliminada o nunca existió.',
		backHome: 'Volver al inicio',
		findTemplates: 'Buscar plantillas',
	},
	about: {
		title: 'Acerca de — RANKMAKER',
		metaDescription: 'La historia detrás de RANKMAKER y su creador.',
		heading: 'Acerca de',
		p1: 'Bueno, en realidad aquí no hay ningún "nosotros" — solo yo. Me llamo <a href="https://olivermartinezharo.com/es" target="_blank"><strong class="text-text-primary hover:underline">Oli</strong></a>, y soy el único responsable de RANKMAKER. Soy un chico de España con grandes ambiciones al que le encanta probar cosas nuevas. RANKMAKER es una de esas cosas en las que decidí aventurarme.',
		p2: 'Un día, después de salir a correr y mientras me preparaba para ducharme, me vino un recuerdo a la cabeza. Un par de años antes había hecho un ranking de pilotos de Fórmula 1 que alguien había compartido en Twitter. Había algo fascinante en ello: no tenía que pensar demasiado en el orden exacto de los pilotos, ni era una lista por niveles. Simplemente me daban distintos emparejamientos y, al final, obtenía un ranking basado en mis elecciones.',
		p3: 'En aquel momento no le di mucha importancia, pero por algún motivo, justo en ese instante, volvió a mí. Mientras me duchaba no paraba de pensar en ello. No tenía ni idea de programar, pero estoy obsesionado con la IA.',
		p4: 'En cuanto salí de la ducha, estuve jugando un rato con ChatGPT y en cuestión de minutos tenía un sistema básico donde podía introducir distintas opciones, compararlas en enfrentamientos y obtener un ranking ordenado. También me di cuenta de que ninguna web estaba haciendo exactamente esto. Esa era mi oportunidad.',
		p5: 'Pensé que podría terminar el proyecto con unas pocas interacciones más con la IA… y habría tenido razón si por "pocas" hubiera querido decir literalmente miles de iteraciones con distintos modelos. Por el camino tuve que aprender algo de programación básica porque, por lo visto, no basta con copiar y pegar un par de códigos generados por ChatGPT en el Bloc de notas.',
		p6: 'Sinceramente, probablemente podría haberlo terminado mucho antes contratando a alguien en Fiverr, y el resultado habría sido mejor. Pero así soy yo.',
		whyHeading: '¿Por qué RANKMAKER?',
		p7: 'La mayor inspiración para este proyecto fue <strong class="text-text-primary">TIERMAKER</strong>, junto con aquel sitio de ranking de F1 que mencioné antes — aunque no volví a verlo (probablemente era el proyecto personal de alguien).',
		p8: 'Siempre me ha encantado hacer rankings (quizá es algún tipo de trastorno), pero a veces TIERMAKER me resultaba abrumador con tantas opciones a la vez, y los resultados no siempre reflejaban lo que realmente pensaba.',
		finalLine: 'Así que lo arreglé con RANKMAKER.',
	},
	contact: {
		title: 'Contacto — RANKMAKER',
		metaDescription: 'Contacta con RANKMAKER.',
		heading: 'Contacto',
		emailLabel: 'Correo electrónico',
	},
	legal: {
		legalNotice: {
			title: 'Aviso legal — RANKMAKER',
			metaDescription: 'Aviso legal e información de la empresa.',
			heading: 'Aviso legal',
			body: `<p>En cumplimiento de lo dispuesto en la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilita la siguiente información general sobre este sitio web:</p>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Titular del sitio web</h2><ul class="list-none space-y-1 pl-4 border-l-2 border-primary/20"><li><strong class="text-text-primary">Titular:</strong> Oliver Martínez</li><li><strong class="text-text-primary">Correo electrónico:</strong> rankmaker.net@gmail.com</li><li><strong class="text-text-primary">Dominio:</strong> rankmaker.net</li></ul></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Objeto</h2><p>El objeto de este sitio web es ofrecer a los usuarios una plataforma para crear y gestionar listas de ranking mediante métodos de comparación.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Responsabilidad del usuario</h2><p>El titular no se responsabiliza del uso indebido de los contenidos publicados en el sitio web. El usuario asume la responsabilidad de cualquier uso del Servicio contrario a la ley o al orden público.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Propiedad intelectual</h2><p>Todos los contenidos de este sitio, incluyendo textos, imágenes y código, son propiedad de RANKMAKER salvo indicación en contrario, y están protegidos por la legislación sobre propiedad intelectual.</p><p class="mt-2">Queda prohibida la reproducción, distribución o modificación de cualquier parte del sitio sin el permiso expreso y por escrito del titular.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Legislación aplicable</h2><p>Este Aviso Legal se rige por la legislación española. Cualquier controversia derivada del uso del sitio web estará sujeta a la jurisdicción de los tribunales españoles.</p></section>
<section class="mb-6"><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Contacto</h2><p>Para cualquier consulta o aclaración sobre este Aviso Legal, contáctenos en: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		cookiePolicy: {
			title: 'Política de cookies — RANKMAKER',
			metaDescription: 'Nuestra política sobre el uso de cookies.',
			heading: 'Política de cookies',
			body: `<p>¡Bienvenido a RANKMAKER! Esta Política de Cookies explica cómo utilizamos cookies y tecnologías similares para reconocerte cuando visitas nuestro sitio web. Explica qué son estas tecnologías y por qué las usamos, así como tus derechos para controlar su uso.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">1. ¿Qué son las cookies?</h2><p class="mb-4">Las cookies son pequeños archivos de datos que se colocan en tu ordenador o dispositivo móvil cuando visitas un sitio web. Son ampliamente utilizadas por los propietarios de sitios web para hacer que sus sitios funcionen, o para que funcionen de manera más eficiente, así como para proporcionar información de informes.</p><p>Las cookies instaladas por el propietario del sitio web (en este caso, RANKMAKER) se denominan «cookies de origen». Las cookies instaladas por terceros se denominan «cookies de terceros». Las cookies de terceros permiten que funciones o contenidos de terceros se ofrezcan en el sitio web o a través de él (publicidad, contenido interactivo, análisis, etc.).</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">2. ¿Por qué utilizamos cookies?</h2><p>Utilizamos cookies propias y de terceros por varias razones. Algunas son necesarias por razones técnicas para que nuestro sitio web funcione, y las denominamos cookies «esenciales» o «estrictamente necesarias». Otras nos permiten rastrear y orientar los intereses de nuestros usuarios para mejorar su experiencia. Los terceros sirven cookies a través de nuestro sitio web para análisis y otros fines, como se describe con más detalle a continuación.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">3. Tipos de cookies que utilizamos</h2><div class="space-y-4"><div><h3 class="text-lg font-medium text-text-primary mb-2">3.1. Cookies estrictamente necesarias</h3><p>Estas cookies son esenciales para proporcionarte los servicios disponibles a través de nuestro sitio web y para que puedas usar algunas de sus funciones, como el acceso a áreas seguras. Sin estas cookies, los servicios que hayas solicitado no pueden prestarse.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.2. Cookies funcionales</h3><p>Estas cookies se utilizan para mejorar la funcionalidad de nuestro sitio web, aunque no son esenciales para su uso. Sin ellas, ciertas funciones (como recordar tus datos de inicio de sesión o las preferencias del sitio) podrían dejar de estar disponibles.</p></div><div><h3 class="text-lg font-medium text-text-primary mb-2">3.3. Cookies analíticas y de rendimiento</h3><p>Estas cookies recopilan información que se utiliza de forma agregada para ayudarnos a entender cómo se utiliza nuestro sitio web o qué eficacia tienen nuestras campañas de marketing, o para personalizar el sitio web para ti. Esto nos ayuda a mejorar tu experiencia.</p></div></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">4. Cookies específicas que instalamos</h2><p class="mb-4">A continuación se muestra una lista de las principales cookies que utilizamos en nuestro sitio web:</p><div class="overflow-x-auto rounded-xl border border-border"><table class="w-full text-sm text-left"><thead class="bg-surface-elevated text-text-primary font-semibold"><tr><th class="px-4 py-3 border-b border-border">Nombre de la cookie</th><th class="px-4 py-3 border-b border-border">Finalidad</th><th class="px-4 py-3 border-b border-border">Duración</th><th class="px-4 py-3 border-b border-border">Gestionada por</th><th class="px-4 py-3 border-b border-border">Tipo</th></tr></thead><tbody class="divide-y divide-border"><tr><td class="px-4 py-3 font-medium">PHPSESSID (o similar)</td><td class="px-4 py-3">Mantiene el estado de tu sesión entre solicitudes de página.</td><td class="px-4 py-3">Sesión</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Estrictamente necesaria</td></tr><tr><td class="px-4 py-3 font-medium">rankmaker_visited</td><td class="px-4 py-3">Registra si ya has visitado el sitio anteriormente.</td><td class="px-4 py-3">30 días</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Funcional</td></tr><tr><td class="px-4 py-3 font-medium">remember_token</td><td class="px-4 py-3">Recuerda tus datos de inicio de sesión para el acceso automático.</td><td class="px-4 py-3">30 días</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Funcional</td></tr><tr><td class="px-4 py-3 font-medium">cookie_consent_status</td><td class="px-4 py-3">Almacena tu estado de consentimiento.</td><td class="px-4 py-3">1 año</td><td class="px-4 py-3">RANKMAKER</td><td class="px-4 py-3">Funcional</td></tr><tr><td class="px-4 py-3 font-medium">_ga</td><td class="px-4 py-3">Distingue usuarios para estadísticas.</td><td class="px-4 py-3">2 años</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analítica</td></tr><tr><td class="px-4 py-3 font-medium">_gid</td><td class="px-4 py-3">Distingue usuarios para estadísticas.</td><td class="px-4 py-3">24 horas</td><td class="px-4 py-3">Google</td><td class="px-4 py-3">Analítica</td></tr></tbody></table></div></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">5. ¿Cómo puedes controlar las cookies?</h2><p class="mb-4">Tienes derecho a decidir si aceptas o rechazas las cookies. Puedes ejercer tus preferencias en materia de cookies:</p><ul class="list-disc pl-5 space-y-2 mb-4"><li><strong class="text-text-primary">Configuración del navegador:</strong> La mayoría de los navegadores web permiten cierto control sobre las cookies a través de su configuración.</li><li><strong class="text-text-primary">Exclusión voluntaria de terceros:</strong> Para Google Analytics, puedes optar por no participar visitando el <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">complemento de inhabilitación para navegadores de Google Analytics</a>.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">6. Cómo revocar el consentimiento</h2><p class="mb-4">Si has dado previamente tu consentimiento para el uso de cookies no esenciales, puedes revocarlo borrando las cookies de nuestro sitio en tu navegador. Esto eliminará la cookie <code>cookie_consent_status</code>.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">7. Cambios en esta Política de Cookies</h2><p>Podemos actualizar esta Política de Cookies periódicamente para reflejar, por ejemplo, cambios en las cookies que utilizamos u otras razones operativas, legales o reglamentarias. Por ello, te recomendamos que revises esta Política de Cookies con regularidad para estar informado sobre cómo utilizamos las cookies y tecnologías relacionadas.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-4">8. Contacto</h2><p>Si tienes alguna pregunta sobre el uso que hacemos de las cookies u otras tecnologías, envíanos un correo electrónico a <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		privacyPolicy: {
			title: 'Política de privacidad — RANKMAKER',
			metaDescription: 'Cómo recopilamos, usamos y protegemos tus datos.',
			heading: 'Política de privacidad',
			body: `<p>¡Bienvenido a RANKMAKER! Esta Política de Privacidad explica cómo recopilamos, usamos y divulgamos información sobre ti cuando utilizas nuestro sitio web y servicios (conjuntamente, el «Servicio»). Al usar el Servicio, aceptas los términos de esta Política de Privacidad.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Información que recopilamos</h2><p class="mb-3">Podemos recopilar la siguiente información:</p><ul class="list-disc pl-5 space-y-2"><li><strong class="text-text-primary">Información personal:</strong> Tu dirección de correo electrónico, nombre de usuario y cualquier otro dato que proporciones al crear una cuenta.</li><li><strong class="text-text-primary">Información de uso:</strong> Páginas que visitas, tiempo que pasas en las páginas e interacciones con el Servicio.</li><li><strong class="text-text-primary">Información del dispositivo:</strong> Dirección IP, tipo de navegador, identificadores del dispositivo y sistema operativo.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Cómo utilizamos tu información</h2><p class="mb-3">Utilizamos tu información para:</p><ul class="list-disc pl-5 space-y-2"><li>Prestar, mantener y mejorar el Servicio.</li><li>Comunicarnos contigo.</li><li>Garantizar la seguridad y prevenir el fraude.</li><li>Analizar el uso y mejorar la experiencia del usuario.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Cookies y tecnologías de seguimiento</h2><p>Podemos utilizar cookies y tecnologías similares para mejorar la funcionalidad y el rendimiento. Puedes gestionar tus preferencias de cookies a través de la configuración de tu navegador.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Divulgación de información</h2><p class="mb-3">No vendemos tus datos personales. Podemos compartir información con:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Proveedores de servicios (por ejemplo, alojamiento, análisis, publicidad).</li><li>Las autoridades cuando la ley lo exija.</li></ul><p>En concreto, podemos compartir tus datos con:</p><ul class="list-disc pl-5 space-y-2 mt-2"><li><strong>Hostinger:</strong> Nuestro proveedor de alojamiento web.</li><li><strong>Google (Analytics, Ads):</strong> Utilizamos Google Analytics para supervisar y analizar el tráfico web, y Google Ads para publicidad.</li></ul></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Retención de datos</h2><p>Conservamos tus datos durante el tiempo necesario para prestar el Servicio y cumplir con las obligaciones legales.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Tus derechos</h2><p class="mb-3">Puedes:</p><ul class="list-disc pl-5 space-y-2 mb-3"><li>Acceder a tu información personal o actualizarla.</li><li>Solicitar la eliminación de tus datos.</li><li>Oponerte al tratamiento de tus datos.</li></ul><p class="mb-3">Si resides en el Espacio Económico Europeo (EEE) o en España, tienes ciertos derechos de protección de datos en virtud del RGPD y la legislación española, que incluyen:</p><ul class="list-disc pl-5 space-y-2"><li>El derecho de acceso, actualización o supresión de tus datos.</li><li>El derecho de rectificación.</li><li>El derecho de oposición.</li><li>El derecho de limitación del tratamiento.</li><li>El derecho a la portabilidad de los datos.</li><li>El derecho a retirar el consentimiento.</li></ul><p class="mt-3 text-sm text-text-muted">Ten en cuenta que podemos pedirte que verifiques tu identidad antes de responder a dichas solicitudes.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Privacidad de los menores</h2><p>Nuestro Servicio no está dirigido a menores de 13 años. No recopilamos intencionadamente información personal de menores de 13 años.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Seguridad de los datos</h2><p>La seguridad de tus datos es importante para nosotros, pero recuerda que ningún método de transmisión por Internet ni de almacenamiento electrónico es 100 % seguro. Aunque nos esforzamos por utilizar medios comercialmente aceptables para proteger tus datos personales, no podemos garantizar su seguridad absoluta.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Cambios en esta política</h2><p>Podemos actualizar esta Política de Privacidad. Te notificaremos los cambios significativos por correo electrónico o a través del Servicio.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Contacto</h2><p>Si tienes preguntas sobre esta Política de Privacidad, contáctanos en <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
		termsOfUse: {
			title: 'Términos de uso — RANKMAKER',
			metaDescription: 'Términos y condiciones para usar RANKMAKER.',
			heading: 'Términos de uso',
			body: `<p>¡Bienvenido a RANKMAKER! Estos Términos de Uso («Términos») rigen el acceso y el uso del sitio web rankmaker.net y los servicios (conjuntamente, el «Servicio») proporcionados por RANKMAKER («nosotros»). Lee atentamente estos Términos antes de usar el Servicio.</p>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">1. Aceptación de los términos</h2><p>Al acceder o usar el Servicio, aceptas quedar vinculado por estos Términos y nuestra Política de Privacidad. Si no estás de acuerdo, no utilices el Servicio.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">2. Cuentas de usuario</h2><p>Para acceder a ciertas funciones, es posible que debas crear una cuenta. Debes proporcionar información veraz y eres responsable de mantener la confidencialidad de tu cuenta y de toda la actividad que se realice en ella.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">3. Uso del Servicio</h2><p>Aceptas utilizar el Servicio de forma legal y de acuerdo con estos Términos. El Servicio está diseñado para que los usuarios creen, compartan y gestionen listas de ranking mediante un sistema de comparación.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">4. Contenido y conducta del usuario</h2><p class="mb-3">Eres responsable de cualquier contenido que publiques. Aceptas no publicar contenido que sea ilegal, ofensivo, perjudicial o que infrinja los derechos de terceros.</p><p>Podemos supervisar, eliminar o deshabilitar el acceso a contenido que infrinja estos Términos. Podemos suspender o cancelar tu acceso al Servicio en caso de incumplimiento.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">5. Servicios de terceros</h2><p>El Servicio puede incluir enlaces a sitios de terceros. No somos responsables de su contenido, prácticas de privacidad ni servicios.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">6. Cookies</h2><p>Podemos utilizar cookies y tecnologías similares tal como se describe en nuestra Política de Privacidad.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">7. Restricción de edad</h2><p>Debes tener al menos 13 años para usar el Servicio.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">8. Exclusión de garantías</h2><p>El Servicio se proporciona «tal cual» y sin garantías. Excluimos todas las garantías en la medida máxima permitida por la ley.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">9. Limitación de responsabilidad</h2><p>No somos responsables de daños indirectos, incidentales ni consecuentes derivados del uso del Servicio.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">10. Legislación aplicable</h2><p>Estos Términos se rigen por la legislación española.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">11. Cambios en los términos</h2><p>Podemos modificar estos Términos. El uso continuado del Servicio tras los cambios implica la aceptación de los nuevos Términos.</p></section>
<section><h2 class="text-xl font-semibold text-text-primary mb-3 mt-6">12. Contacto</h2><p>Para preguntas, contacta con: <a href="mailto:rankmaker.net@gmail.com" class="text-primary hover:underline">rankmaker.net@gmail.com</a>.</p></section>`,
		},
	},
	categories: {
		Movies: 'Películas',
		Music: 'Música',
		Sports: 'Deportes',
		Games: 'Videojuegos',
		TV: 'Televisión',
		People: 'Personas',
		Internet: 'Internet',
		Anime: 'Anime',
		Lifestyle: 'Estilo de vida',
		Food: 'Comida',
		Politics: 'Política',
		'History & Culture': 'Historia y cultura',
		Geography: 'Geografía',
		Motor: 'Motor',
		Books: 'Libros',
		Technology: 'Tecnología',
		Nature: 'Naturaleza',
		Others: 'Otros',
	},
	notifications: {
		title: 'Notificaciones — RANKMAKER',
		heading: 'Notificaciones',
		subtitle: 'Comentarios en tus plantillas, respuestas a ti y nuevas plantillas de personas que sigues.',
		loginRequired: 'Inicia sesión para ver tus notificaciones.',
		login: 'Iniciar sesión',
		empty: 'Estás al día — nada aquí de momento.',
		filterAll: 'Todas',
		filterComments: 'En mis plantillas',
		filterReplies: 'Respuestas',
		filterTemplates: 'Nuevas plantillas',
		today: 'Hoy',
		yesterday: 'Ayer',
		newBadge: 'Nuevo',
		msgCommentOnTemplate: '{actor} ha comentado en tu plantilla “{title}”',
		msgCommentReply: '{actor} ha respondido a tu comentario en “{title}”',
		msgNewTemplate: '{actor} ha publicado una nueva plantilla: “{title}”',
		emailPrefHeading: 'Notificaciones por correo',
		emailPrefDesc: 'Envíame correos sobre comentarios en mis plantillas y respuestas a mis comentarios.',
		emailPrefToggle: 'Activar/desactivar notificaciones por correo',
		emailPrefError: 'No se pudo actualizar tu preferencia. Inténtalo de nuevo.',
	},
	email: {
		cta: 'Ver en RANKMAKER',
		footer: 'Has recibido este correo porque tienes activadas las notificaciones de correo en tu cuenta. Gestiónalas en {url}',
		commentOnTemplate: {
			subject: 'Nuevo comentario en tu plantilla',
			heading: 'Nuevo comentario en “{title}”',
			intro: '{actor} ha comentado en tu plantilla “{title}”.',
		},
		commentReply: {
			subject: '{actor} ha respondido a tu comentario',
			heading: 'Tienes una nueva respuesta',
			intro: '{actor} ha respondido a tu comentario en “{title}”.',
		},
	},
};
