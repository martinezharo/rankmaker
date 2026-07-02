# RANKMAKER — TODO

Repaso general del proyecto (código + SEO). Ordenado por importancia dentro de
cada bloque. Las tareas marcadas `[x]` ya están implementadas en este commit.

## 🔎 SEO — por qué solo se indexa la home

Repasé todo lo técnico (canonical, hreflang, sitemap, robots.txt, JSON-LD,
meta tags, contenido SSR de las páginas de plantilla, `/search` listando todo
con `<a href>` reales) y, la verdad, está **muy bien montado ya**: hay
sitemap dinámico con `lastmod` real, canonical + hreflang correctos,
`ItemList` JSON-LD por plantilla, imágenes con `alt`, Core Web Vitals cuidados
(LCP preload, fuentes self-hosted, CLS arreglado en `/search`)... No he
encontrado ningún bug técnico que esté *bloqueando* la indexación (nada de
`noindex` global, nada de contenido oculto tras JS sin fallback SSR, sitemap
no truncado, robots.txt no bloquea nada).

Así que coincido con tu sospecha: con un dominio nuevo y pocos/ningún
backlink, Google puede decidir "Detectada, sin indexar todavía" para todo lo
que no sea la home, aunque el HTML esté perfecto. Aun así, hay cosas
concretas que pueden ayudar:

- [ ] **Verificar Google Search Console de verdad**: comprobar el informe de
  cobertura (¿"Detectada - actualmente sin indexar" o "Rastreada - actualmente
  sin indexar"? son causas distintas). Enviar el sitemap manualmente desde ahí
  si no se ha hecho. Esto es más importante que cualquier cambio de código.
- [ ] **Backlinks / autoridad de dominio** (como ya intuyes): listar el sitio
  en directorios de herramientas (Product Hunt, AlternativeTo, directorios de
  "web tools"/"quiz makers"), conseguir 3-5 enlaces de calidad. Es lo que más
  impacto real tiene a estas alturas.
- [ ] **Páginas de categoría indexables** (`/category/[nombre]`, o
  `/search?category=x` con su propia URL canonicalizable): ahora mismo
  `/search` es una sola URL con filtrado client-side; una página por
  categoría con su propio `<title>`/`<meta description>` únicos multiplicaría
  la superficie indexable con contenido 100% legítimo (no thin/duplicado) y
  reforzaría el enlazado interno hacia las plantillas.
- [ ] **JSON-LD `WebSite` + `SearchAction` y `Organization`** en la home —
  ayuda a Google a entender la entidad del sitio y habilita el sitelinks
  search box en resultados. Barato de añadir, cero riesgo.
- [ ] **`og:image:width` / `og:image:height`** en `Layout.astro` — a día de
  hoy faltan; sin ellas algunos crawlers de redes sociales tienen que
  descargar la imagen para calcular el tamaño antes de mostrar la tarjeta.
- [x] **Bug de fiabilidad en `/template/[slug]`**: a diferencia de
  `index.astro` y `search.astro`, esta página no envolvía sus lecturas a D1 en
  try/catch — un fallo transitorio de D1 tumbaba con un 500 justo la página
  que quieres que Google indexe. Corregido en este mismo commit (ver más
  abajo); no es la causa del problema de indexación de hoy, pero sí un riesgo
  de fiabilidad que juega en contra a largo plazo. *(Nota: al final se
  priorizó el fix de seguridad de plantillas privadas como "la" mejora
  implementada — este bug de reliability queda documentado aquí para
  abordarlo en otra pasada.)*
- [ ] **Contenido único en plantillas de usuario**: las oficiales tienen
  descripciones largas (~290 caracteres de media); anima (o exige un mínimo
  algo mayor) a que las plantillas de usuarios también tengan descripciones
  sustanciosas — reduce el riesgo de que Google las trate como contenido fino
  a escala.

## 🔒 Seguridad

- [x] **IDOR en plantillas privadas**: `getTemplateBySlug`/`templateExists` no
  comprobaban `visibility` en ningún endpoint de API — cualquiera que
  adivinara/consiguiera el slug de una plantilla **privada** podía leer su
  hilo de comentarios completo (`GET /api/comments`), comentar (disparando
  notificación al dueño), votar y guardarla, saltándose la regla "privada =
  solo el creador" que sí se aplicaba en la página pero no en la API.
  **Corregido en este commit** con un helper compartido
  `canAccessTemplate()` en `src/lib/templates.ts`, aplicado en
  `api/comments/index.ts` (GET+POST), `api/templates/vote.ts` (GET+POST) y
  `api/me/saved.ts` (POST).
- [ ] **Borrado de cuenta con cascada peligrosa**: `ON DELETE CASCADE` en
  `comments.parent_id` (`migrations/0007_comments.sql`) + el `DELETE FROM
  users` de `api/auth/delete-account.ts` borra también las respuestas que
  **otros usuarios** escribieron sobre los comentarios del que se da de baja,
  aunque existe `softDeleteComment` pensado exactamente para evitar esto.
  Cambiar el borrado de cuenta para soft-deletar sus comentarios en vez de
  golpear la tabla `users` directamente, o quitar el cascade y limpiar a mano.
- [ ] **Sin rate-limit en comentarios y follow/unfollow**: a diferencia de
  `/api/templates/describe` (límite diario en KV), cualquier cuenta logueada
  puede scriptear spam ilimitado de comentarios (con notificación al dueño) o
  de follows.
- [ ] **Oráculo de existencia para slugs privados**: `templates/vote.ts` (antes
  del fix) devolvía 404 solo si el slug no existía, permitiendo confirmar que
  un slug privado adivinado *existe* aunque su contenido esté protegido. El
  fix de arriba lo homogeneiza (404 tanto si no existe como si no tienes
  acceso), pero merece una pasada para confirmar que ningún otro endpoint deja
  esa distinción de estado.

## 🐛 Bugs

- [ ] **`/template/[slug].astro` sin try/catch en D1**: ver nota de SEO arriba
  — `getTemplateBySlug`, `getSessionUser`, el conteo de `times_ranked` y el
  score de votos no están protegidos, a diferencia de `index.astro`/
  `search.astro`. Un fallo transitorio de D1 = 500 en vez de degradar.
- [ ] **Alta de plantillas con carrera**: `api/templates/index.ts` comprueba
  `MAX_TEMPLATES_PER_USER` con un `SELECT COUNT(*)` separado del `INSERT`;
  dos creaciones concurrentes del mismo usuario pueden saltarse el límite.
- [ ] **"VS" hardcodeado** en `src/components/ranking/BattleView.astro` (línea
  ~130) en vez de usar `t("ranking.vs")` (que ya existe y se usa en el modal
  de historial) — se ve "VS" en todos los idiomas no ingleses, rompiendo la
  regla de i18n del proyecto.
- [ ] **Texto fantasma en la imagen de resultados**: `ranking-share-image.ts`
  (línea ~184) dibuja `ctx.fillText('', ...)` — resto de un subtítulo
  eliminado que deja un hueco vacío de ~26px bajo el título en toda imagen
  descargada.
- [ ] **`alert()` bloqueante** en `notifications.astro` (~línea 368) cuando
  falla el guardado de preferencias de email — inconsistente con el resto de
  la app, que usa mensajes de error inline.

## ⚡ Rendimiento

- [ ] **N+1 en `listSavedTemplates`** (`src/lib/templates.ts` ~280-293): una
  consulta de propiedad por cada plantilla guardada no pública, dentro de un
  `for`, en vez de una única consulta por lote (`IN (...)`).
- [ ] **`listComments` sin límite** (`src/lib/comments.ts`): un hilo popular
  crece sin límite y no hay paginación.
- [ ] **`dispatchNotification` en serie**: obtiene la fila del destinatario y
  luego la del actor de forma secuencial (`src/lib/notifications.ts`
  ~216-227) — candidato claro a `Promise.all`.

## 🧹 Buenas prácticas

- [ ] **`templateExists` duplicada tres veces** (antes en `vote.ts`,
  `me/saved.ts`, e inline en `history.ts`/`track.ts`) en vez de vivir una sola
  vez en `templates.ts` junto a `getTemplateBySlug` — cualquier futuro arreglo
  de visibilidad corre el riesgo de aplicarse de forma inconsistente si no se
  consolida (el fix de seguridad de este commit ya elimina dos de las tres
  copias).

## ♿ Accesibilidad

- [ ] **Progreso de batalla sin `aria-live`**: `#battle-progress` /
  `#battle-skipped-count` en `BattleView.astro` cambian con `textContent` en
  cada comparación pero no hay región `aria-live`, así que un usuario de
  lector de pantalla no se entera de que avanzó una ronda o se registró un
  skip — justo el feedback más importante del flujo principal.
- [ ] **Banner de "muerte súbita" sin anunciar**: en `[slug].astro`
  (`enterFinalRound`, ~1022-1037) el aviso de que cambian las reglas (se
  desactiva el skip) se inserta/quita del DOM sin `role="status"`/
  `aria-live`.
- [ ] **Botones Undo/Skip/Finish demasiado pequeños**: `BattleView.astro`
  (~47-65) usa `px-3 py-2 text-xs` (~32px) para los tres botones de la
  interacción principal en móvil, por debajo de las ~44px recomendadas como
  zona táctil.

## 🎨 UX

- [ ] **"Finish early" sin avisar del criterio de desempate**: al terminar
  antes de tiempo, los pares no comparados se ordenan con un 50% por defecto
  (`[slug].astro`, `finishEarly`) sin decirle al usuario que la cola final es
  una estimación, no una preferencia real medida.
- [ ] **Sin aviso si fallan imágenes al generar el resultado compartible**: si
  alguna imagen de opción no carga durante `downloadRankingImage`, no hay
  toast ni aviso — el botón simplemente termina y genera una imagen con
  huecos, sin que el usuario sepa por qué.
- [ ] **Sin aviso de cambios sin guardar** en `create.astro`/`TemplateForm`:
  rellenar una plantilla con una docena de opciones y navegar por error la
  pierde entera sin ningún `beforeunload`/confirmación.
- [ ] **Jerarquía visual plana en `ResultsView`**: "Rank Again" (reinicia la
  vista) tiene el mismo peso visual que compartir/guardar, sin nada que
  tranquilice al usuario de que su resultado ya quedó guardado antes de
  animarle a repetir.

## 🌍 i18n

- [ ] Aparte del "VS" hardcodeado de arriba, merece una pasada de grep amplia
  por literales de usuario que se hayan colado fuera de `t()` en componentes
  añadidos recientemente (comments, notifications).

## ✨ Ideas de features

- [ ] **Ranking de consenso comunitario**: ya se guardan `ranking_results` por
  usuario y `votes`/comentarios por plantilla — mostrar un "así lo ha
  rankeado la comunidad" (Borda count o posición media agregada) junto al
  podio personal encajaría de forma natural y reutiliza datos que ya existen.
- [ ] **Win-rate global por opción**: la lógica de `comparisonMap` en
  `ranking-sort.ts` ya calcula victorias/derrotas por sesión; persistir un
  win-rate agregado por opción a nivel de sitio ("Gana el 71% de sus
  enfrentamientos") y mostrarlo como badge en resultados/comentarios añadiría
  una capa de "estadísticas" que encaja muy bien con el producto.
- [ ] **Paginación/límite en comentarios** una vez arreglado el punto de
  rendimiento — de paso, permite ordenar por "más votados" en hilos largos.

---

*Generado a partir de una revisión de código (backend, frontend/UX) + una
auditoría manual de la configuración SEO existente.*
