import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { marked } from 'marked'
import { parseQuizFile, type Quiz } from '@hashquiz/parser'
import type { SeoSettings } from './seo'

/**
 * Public quiz catalogue written by `hashquiz build` when `HASHQUIZ_CATALOG=true`: plain HTML pages that
 * search engines and AI crawlers read without JavaScript (SEO audit, phase 2):
 *
 * - `quiz/index.html`: every deck;
 * - `quiz/<slug>/index.html`: one deck, a few sample questions and the links to play it;
 * - `quiz/<slug>/details/index.html`: every question with its answer and explanation;
 * - `quiz/tag/<tag>/index.html`: the decks carrying a tag;
 * - `404.html`, and `sitemap.xml` when `HASHQUIZ_SITE_URL` is set.
 */

export interface CatalogDeck {
  /** Manifest id, e.g. `docker/index.hashquiz.md`. */
  id: string
  /** URL path segment(s), e.g. `docker`. */
  slug: string
  quiz: Quiz
}

export interface CatalogFile {
  /** Path relative to the site root. */
  path: string
  content: string
}

type Lang = 'fr' | 'en'

const TEXT = {
  fr: {
    catalogTitle: 'Tous les quiz',
    catalogIntro: 'Quiz multijoueurs en temps réel, écrits en Markdown. Lancez-en un sur grand écran, les joueurs répondent depuis leur téléphone.',
    home: 'Accueil',
    quizzes: 'Quiz',
    questions: (n: number) => `${n} question${n > 1 ? 's' : ''}`,
    perGame: (n: number) => `${n} par partie`,
    difficulty: { easy: 'facile', medium: 'moyen', hard: 'difficile' },
    by: 'par',
    solo: 'Jouable en solo',
    host: 'Animer ce quiz',
    playSolo: 'Jouer en solo',
    details: 'Voir toutes les questions',
    samples: 'Exemples de questions',
    allQuestions: 'Toutes les questions',
    answer: 'Réponse et explication',
    correct: 'Bonne réponse',
    multiple: 'Plusieurs réponses possibles',
    tag: (t: string) => `Quiz sur ${t}`,
    back: 'Retour au quiz',
    notFound: 'Page introuvable',
    notFoundText: 'Cette page n\'existe pas. Les quiz sont tous sur le catalogue.',
    seeCatalog: 'Voir les quiz',
  },
  en: {
    catalogTitle: 'All quizzes',
    catalogIntro: 'Real-time multiplayer quizzes written in Markdown. Run one on a big screen, players answer from their phones.',
    home: 'Home',
    quizzes: 'Quizzes',
    questions: (n: number) => `${n} question${n > 1 ? 's' : ''}`,
    perGame: (n: number) => `${n} per game`,
    difficulty: { easy: 'easy', medium: 'medium', hard: 'hard' },
    by: 'by',
    solo: 'Playable solo',
    host: 'Host this quiz',
    playSolo: 'Play solo',
    details: 'See every question',
    samples: 'Sample questions',
    allQuestions: 'All questions',
    answer: 'Answer and explanation',
    correct: 'Correct answer',
    multiple: 'Several answers possible',
    tag: (t: string) => `${t} quizzes`,
    back: 'Back to the quiz',
    notFound: 'Page not found',
    notFoundText: 'This page does not exist. Every quiz is in the catalogue.',
    seeCatalog: 'Browse quizzes',
  },
} as const

const SAMPLE_COUNT = 3

/** `HASHQUIZ_CATALOG=true` turns the catalogue on (off by default: the details pages publish the answers). */
export function catalogEnabled(env: Record<string, string | undefined>): boolean {
  return ['1', 'true', 'yes'].includes((env.HASHQUIZ_CATALOG ?? '').trim().toLowerCase())
}

const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** URL-safe slug of a manifest id: `Docker Basics/index.hashquiz.md` → `docker-basics`. */
export function deckSlug(id: string): string {
  const path = id.replace(/(^|\/)index\.hashquiz\.md$/, '').replace(/\.hashquiz\.md$/, '')
  return path.split('/').map(slugify).filter(Boolean).join('/') || 'quiz'
}

/** URL-safe slug of a tag: `Gen AI` → `gen-ai`; a tag with no ASCII letter or digit is percent-encoded. */
export const tagSlug = (tag: string): string => slugify(tag) || encodeURIComponent(tag.toLowerCase())

/** Parses the manifest into catalogue decks with unique slugs, sorted by title. */
export function catalogDecks(entries: { id: string; content: string }[]): CatalogDeck[] {
  const used = new Set<string>()
  return entries
    .map(({ id, content }) => ({ id, quiz: parseQuizFile(content) }))
    .sort((a, b) => (a.quiz.meta.title || a.id).localeCompare(b.quiz.meta.title || b.id))
    .map(({ id, quiz }) => {
      const base = deckSlug(id)
      let slug = base
      for (let i = 2; used.has(slug) || slug === 'tag'; i++) slug = `${base}-${i}`
      used.add(slug)
      return { id, slug, quiz }
    })
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (md: string): string => marked.parseInline(md, { async: false }) as string
const block = (md: string): string => marked.parse(md, { async: false }) as string
const plain = (md: string): string => inline(md).replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')


/** JSON for a `<script type="application/ld+json">`: no `</script>` break-out. */
const ldJson = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c')

function difficultyOf(quiz: Quiz): 'easy' | 'medium' | 'hard' {
  if (quiz.meta.targetDifficulty) return quiz.meta.targetDifficulty
  const score = { easy: 1, medium: 2, hard: 3 }
  const avg = quiz.questions.reduce((s, q) => s + score[q.difficulty], 0) / (quiz.questions.length || 1)
  return avg < 1.67 ? 'easy' : avg < 2.34 ? 'medium' : 'hard'
}

interface Ctx {
  lang: Lang
  langTag: string
  siteUrl?: string
}

const abs = (ctx: Ctx, path: string): string => (ctx.siteUrl ? `${ctx.siteUrl}${path}` : path)

const CSS = `
:root{--bg:#130A42;--card:#1d1258;--text:#F9F8F8;--muted:#c9c3e6;--violet:#6523EE;--purple:#A833F5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#d3b4ff}
header,main,footer{max-width:960px;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;gap:12px;padding-top:20px;padding-bottom:8px}
header img{width:40px;height:40px;border-radius:10px}
header a{color:var(--text);text-decoration:none;font-weight:700}
nav.crumbs{font-size:14px;color:var(--muted)}
nav.crumbs a{color:var(--muted)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.2;margin:16px 0 8px}
h2{margin-top:40px}
.intro{color:var(--muted);font-size:18px}
.grid{list-style:none;padding:0;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:var(--card);border-radius:14px;padding:18px}
.card h2,.card h3{margin:0 0 6px;font-size:20px}
.card p{margin:6px 0;color:var(--muted)}
.meta{display:flex;flex-wrap:wrap;gap:8px;font-size:14px;color:var(--muted);padding:0;list-style:none}
.tags{display:flex;flex-wrap:wrap;gap:6px;padding:0;list-style:none}
.tags a{display:inline-block;font-size:13px;padding:2px 10px;border-radius:999px;background:#2a1b73;text-decoration:none;color:var(--text)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}
.btn{display:inline-block;padding:10px 18px;border-radius:10px;background:var(--violet);color:#fff;text-decoration:none;font-weight:600}
.btn.alt{background:transparent;border:2px solid var(--purple)}
ol.questions{padding-left:20px}
ol.questions>li{margin:0 0 24px}
.q{font-weight:600}
.choices{margin:6px 0;padding-left:20px}
details{background:var(--card);border-radius:10px;padding:10px 14px;margin-top:8px}
summary{cursor:pointer;color:var(--muted)}
.ok{color:#7ee2a8;font-weight:600}
footer{color:var(--muted);font-size:14px;padding-top:40px;padding-bottom:40px}
`

function page(ctx: Ctx, o: { path: string; title: string; description: string; body: string; ld: unknown[] }): string {
  const url = abs(ctx, o.path)
  const lds = o.ld.map((d) => `<script type="application/ld+json">${ldJson(d)}</script>`).join('\n  ')
  return `<!DOCTYPE html>
<html lang="${esc(ctx.langTag)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}">
  <meta name="theme-color" content="#130A42">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  ${ctx.siteUrl ? `<link rel="canonical" href="${esc(url)}">\n  <meta property="og:url" content="${esc(url)}">\n  ` : ''}<meta property="og:type" content="website">
  <meta property="og:site_name" content="HashQuiz">
  <meta property="og:title" content="${esc(o.title)}">
  <meta property="og:description" content="${esc(o.description)}">
  <meta property="og:image" content="${esc(abs(ctx, '/og.png'))}">
  <meta name="twitter:card" content="summary_large_image">
  <style>${CSS}</style>
  ${lds}
</head>
<body>
  <header><a href="/quiz/"><img src="/favicon.svg" alt=""></a><a href="/quiz/">HashQuiz</a></header>
  <main>
${o.body}
  </main>
  <footer>HashQuiz · <a href="https://github.com/WhiteWoodTech/hashquiz">GitHub</a></footer>
</body>
</html>
`
}

function crumbs(ctx: Ctx, items: { name: string; path: string }[]): { html: string; ld: unknown } {
  const html = `<nav class="crumbs" aria-label="breadcrumb">${items
    .map((c, i) => (i === items.length - 1 ? esc(c.name) : `<a href="${esc(c.path)}">${esc(c.name)}</a>`))
    .join(' › ')}</nav>`
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(ctx, c.path) })),
  }
  return { html, ld }
}

function tagList(tags: string[]): string {
  if (!tags.length) return ''
  return `<ul class="tags">${tags.map((t) => `<li><a href="/quiz/tag/${tagSlug(t)}/">#${esc(t)}</a></li>`).join('')}</ul>`
}

function metaLine(ctx: Ctx, quiz: Quiz): string {
  const t = TEXT[ctx.lang]
  const items = [t.questions(quiz.questions.length)]
  if (quiz.meta.maxQuestions && quiz.meta.maxQuestions < quiz.questions.length) items.push(t.perGame(quiz.meta.maxQuestions))
  items.push(t.difficulty[difficultyOf(quiz)])
  if (quiz.meta.solo) items.push(t.solo)
  return `<ul class="meta">${items.map((i) => `<li>${esc(i)}</li>`).join('<li aria-hidden="true">·</li>')}</ul>`
}

function deckCard(ctx: Ctx, d: CatalogDeck): string {
  const { meta } = d.quiz
  return `<li class="card"><h2><a href="/quiz/${d.slug}/">${esc(meta.title || d.id)}</a></h2>
${meta.description ? `<p>${esc(meta.description.trim())}</p>` : ''}
${metaLine(ctx, d.quiz)}
${tagList(meta.tags)}</li>`
}

function questionItem(ctx: Ctx, q: Quiz['questions'][number]): string {
  const t = TEXT[ctx.lang]
  const right = q.choices.filter((c) => c.isCorrect).map((c) => inline(c.text))
  return `<li><p class="q">${inline(q.text)}${q.type === 'multiple' ? ` <small>(${esc(t.multiple)})</small>` : ''}</p>
<ul class="choices">${q.choices.map((c) => `<li>${inline(c.text)}</li>`).join('')}</ul>
<details><summary>${esc(t.answer)}</summary><p><span class="ok">${esc(t.correct)} :</span> ${right.join(' · ')}</p>${q.explanation ? block(q.explanation) : ''}</details></li>`
}

function quizLd(ctx: Ctx, d: CatalogDeck, path: string, withQuestions: boolean): unknown {
  const { meta } = d.quiz
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: meta.title || d.id,
    ...(meta.description && { description: meta.description.trim() }),
    url: abs(ctx, path),
    inLanguage: ctx.langTag,
    isAccessibleForFree: true,
    educationalLevel: difficultyOf(d.quiz),
    ...(meta.tags.length && { keywords: meta.tags.join(', ') }),
    ...(meta.author && { author: { '@type': 'Person', name: meta.author } }),
    ...(withQuestions && {
      hasPart: d.quiz.questions.map((q) => ({
        '@type': 'Question',
        name: plain(q.text),
        eduQuestionType: q.type === 'multiple' ? 'Checkbox' : 'Multiple choice',
        acceptedAnswer: q.choices.filter((c) => c.isCorrect).map((c) => ({ '@type': 'Answer', text: plain(c.text) })),
        suggestedAnswer: q.choices.filter((c) => !c.isCorrect).map((c) => ({ '@type': 'Answer', text: plain(c.text) })),
      })),
    }),
  }
}

/** Every catalogue file for the given decks. */
export function renderCatalog(decks: CatalogDeck[], seo: SeoSettings): CatalogFile[] {
  const lang: Lang = seo.lang?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const ctx: Ctx = { lang, langTag: seo.lang ?? 'en', ...(seo.siteUrl && { siteUrl: seo.siteUrl }) }
  const t = TEXT[lang]
  const files: CatalogFile[] = []
  const home = { name: t.quizzes, path: '/quiz/' }

  // Catalogue
  {
    const c = crumbs(ctx, [home])
    files.push({
      path: 'quiz/index.html',
      content: page(ctx, {
        path: '/quiz/',
        title: `${t.catalogTitle} · HashQuiz`,
        description: t.catalogIntro,
        body: `<h1>${esc(t.catalogTitle)}</h1>\n<p class="intro">${esc(t.catalogIntro)}</p>\n<ul class="grid">${decks.map((d) => deckCard(ctx, d)).join('\n')}</ul>`,
        ld: [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t.catalogTitle,
            itemListElement: decks.map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(ctx, `/quiz/${d.slug}/`), name: d.quiz.meta.title || d.id })),
          },
          c.ld,
        ],
      }),
    })
  }

  for (const d of decks) {
    const { meta, questions } = d.quiz
    const title = meta.title || d.id
    const description = (meta.description ?? '').trim() || `${title} · ${t.questions(questions.length)}`
    const path = `/quiz/${d.slug}/`
    const detailsPath = `${path}details/`
    const actions = (extra: { href: string; label: string }): string =>
      `<div class="actions"><a class="btn" href="/host/">${esc(t.host)}</a>${
        meta.solo ? `<a class="btn alt" href="/#/solo/${encodeURIComponent(d.id)}">${esc(t.playSolo)}</a>` : ''
      }<a class="btn alt" href="${extra.href}">${esc(extra.label)}</a></div>`
    const header = `<h1>${esc(title)}</h1>\n${meta.description ? `<p class="intro">${esc(meta.description.trim())}</p>\n` : ''}${metaLine(ctx, d.quiz)}\n${
      meta.author ? `<p>${esc(t.by)} ${esc(meta.author)}</p>\n` : ''
    }${tagList(meta.tags)}`
    const samples = questions.filter((q) => q.explanation).slice(0, SAMPLE_COUNT)
    const shown = samples.length ? samples : questions.slice(0, SAMPLE_COUNT)

    const c = crumbs(ctx, [home, { name: title, path }])
    files.push({
      path: `quiz/${d.slug}/index.html`,
      content: page(ctx, {
        path,
        title: `${title} · HashQuiz`,
        description,
        body: `${c.html}\n${header}\n${actions({ href: detailsPath, label: t.details })}\n<h2>${esc(t.samples)}</h2>\n<ol class="questions">${shown.map((q) => questionItem(ctx, q)).join('\n')}</ol>\n<p><a href="${detailsPath}">${esc(t.details)} (${esc(t.questions(questions.length))})</a></p>`,
        ld: [quizLd(ctx, d, path, false), c.ld],
      }),
    })

    const cd = crumbs(ctx, [home, { name: title, path }, { name: t.allQuestions, path: detailsPath }])
    files.push({
      path: `quiz/${d.slug}/details/index.html`,
      content: page(ctx, {
        path: detailsPath,
        title: `${title} : ${t.allQuestions.toLowerCase()} · HashQuiz`,
        description,
        body: `${cd.html}\n<h1>${esc(title)} : ${esc(t.allQuestions.toLowerCase())}</h1>\n${metaLine(ctx, d.quiz)}\n${actions({ href: path, label: t.back })}\n<ol class="questions">${questions.map((q) => questionItem(ctx, q)).join('\n')}</ol>`,
        ld: [quizLd(ctx, d, detailsPath, true), cd.ld],
      }),
    })
  }

  // Tags
  const byTag = new Map<string, { label: string; decks: CatalogDeck[] }>()
  for (const d of decks) {
    for (const tag of new Set(d.quiz.meta.tags)) {
      const key = tagSlug(tag)
      const entry = byTag.get(key) ?? { label: tag, decks: [] }
      entry.decks.push(d)
      byTag.set(key, entry)
    }
  }
  for (const [key, { label, decks: tagged }] of byTag) {
    const path = `/quiz/tag/${key}/`
    const c = crumbs(ctx, [home, { name: `#${label}`, path }])
    files.push({
      path: `quiz/tag/${key}/index.html`,
      content: page(ctx, {
        path,
        title: `${t.tag(label)} · HashQuiz`,
        description: `${t.tag(label)} : ${tagged.map((d) => d.quiz.meta.title || d.id).join(', ')}`,
        body: `${c.html}\n<h1>${esc(t.tag(label))}</h1>\n<ul class="grid">${tagged.map((d) => deckCard(ctx, d)).join('\n')}</ul>`,
        ld: [c.ld],
      }),
    })
  }

  files.push({
    path: '404.html',
    content: page(ctx, {
      path: '/404.html',
      title: `${t.notFound} · HashQuiz`,
      description: t.notFoundText,
      body: `<h1>${esc(t.notFound)}</h1>\n<p class="intro">${esc(t.notFoundText)}</p>\n<div class="actions"><a class="btn" href="/quiz/">${esc(t.seeCatalog)}</a></div>`,
      ld: [],
    }).replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n  <meta name="theme-color"'),
  })

  if (seo.siteUrl) {
    const urls = files
      .filter((f) => f.path.endsWith('index.html'))
      .map((f) => `${seo.siteUrl}/${f.path.replace(/index\.html$/, '').split('/').map(encodeURIComponent).join('/')}`)
    files.push({
      path: 'sitemap.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${esc(u)}</loc></url>`)
        .join('\n')}\n</urlset>\n`,
    })
  }
  return files
}

/** Writes the catalogue under `outDir`; returns the written paths. */
export function writeCatalog(outDir: string, entries: { id: string; content: string }[], seo: SeoSettings): string[] {
  const files = renderCatalog(catalogDecks(entries), seo)
  for (const f of files) {
    const target = resolve(outDir, f.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, f.content)
  }
  return files.map((f) => f.path)
}
