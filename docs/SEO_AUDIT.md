# Audit SEO et référencement LLM (GEO)

Audit réalisé le 25 novembre 2026 sur la branche `develop` (commit `30a6af8`) et sur le déploiement Vercel
(`quizv-phi.vercel.app`, servi sous `quizv-white-wood-tech.vercel.app`).

Objectif : rendre QuizV (Quizdown) trouvable sur Google/Bing **et** citable par les moteurs de réponse IA
(ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews), sans dégrader l'expérience de jeu.

## Sommaire

- [1. Synthèse](#1-synthèse)
- [2. Constat technique](#2-constat-technique)
- [3. Constat contenu et marque](#3-constat-contenu-et-marque)
- [4. Constat référencement LLM (GEO)](#4-constat-référencement-llm-geo)
- [5. Préconisations par priorité](#5-préconisations-par-priorité)
- [6. Exemples prêts à l'emploi](#6-exemples-prêts-à-lemploi)
- [7. Indicateurs de suivi](#7-indicateurs-de-suivi)

## 1. Synthèse

Le site déployé est aujourd'hui **une application, pas un site** : la racine `/` est l'écran « Join Game » du joueur
et `/host` le tableau de bord de l'animateur. Les deux pages renvoient un HTML de 372 octets avec un `<div id="app">`
vide : sans exécuter le JavaScript, un robot ne voit qu'un titre (« QuizV Player ») et rien d'autre.

| Domaine | Note | Commentaire |
| --- | --- | --- |
| Indexabilité technique | 🔴 | Pas de `robots.txt`, `sitemap.xml`, favicon, meta description ni canonical |
| Contenu indexable | 🔴 | Aucune page de contenu : tout est rendu côté client, derrière un écran de jeu |
| Marque et domaine | 🟠 | Nom hésitant (QuizV / Quizdown), sous-domaine `vercel.app`, pas de domaine propre |
| Performance | 🟢 | HTML servi depuis le CDN Vercel (Paris, HTTP/2, cache HIT), DOM complet en ~230 ms |
| Référencement LLM | 🔴 | Pas de `llms.txt`, pas de données structurées, aucune page citable |
| Potentiel | 🟢 | ~195 questions rédigées en français avec explications : un vrai gisement de contenu |

**Le point clé** : le meilleur levier n'est pas de « référencer l'application », mais d'ajouter du **contenu public
lisible sans JavaScript**. L'architecture retenue (voir [5.2](#priorité-2--important-sous-un-à-deux-mois)) :

- un **site statique séparé** porte l'acquisition : accueil, landing, documentation du format `.quizv.md`, FAQ ;
- l'**application** garde ses propres pages publiques : l'index des quiz publics, une page par quiz et une page de
  détails ; ces pages doivent être pré-rendues pour être indexables ;
- les écrans de jeu (host, lobby, partie) restent en `noindex`.

## 2. Constat technique

Mesures faites le 25/11/2026 depuis un navigateur, sur le déploiement de production.

| Élément | État | Détail |
| --- | --- | --- |
| `GET /` | 200 | `text/html`, 372 octets, `<title>QuizV Player</title>`, corps vide |
| `GET /host` | 200 | 380 octets, `<title>QuizV Host</title>`, corps vide |
| `GET /robots.txt` | 404 | Page d'erreur texte de Vercel |
| `GET /sitemap.xml` | 404 | — |
| `GET /llms.txt` | 404 | — |
| `GET /favicon.ico` | 404 | Aucun favicon déclaré dans `index.html` non plus |
| `GET /manifest.webmanifest` | 404 | Pas de PWA (pourtant pertinent pour les joueurs sur mobile) |
| URL inconnue | 404 | Page d'erreur Vercel brute, non personnalisée |
| `<html lang>` | `en` | Alors que les decks et la cible sont francophones |
| Meta description | absente | Dans `apps/host/index.html` et `apps/player/index.html` |
| Open Graph / Twitter Card | absents | Un lien partagé (Slack, LinkedIn, WhatsApp) n'a ni titre propre ni image |
| Canonical | absent | Deux noms d'hôte `vercel.app` servent le même contenu |
| Titres `h1` | 1 | « QuizV » sur l'écran joueur, rien de descriptif |
| JavaScript | 333 Ko (joueur), 659 Ko (host) | Non minifié/compressé mesuré ; le host embarque tous les decks (`import.meta.glob`) |
| Routage | hash `#/tag/<tag>` | Les pages de tags du host ne sont pas des URL indexables (le fragment est ignoré) |
| En-têtes | ok | Pas de `X-Robots-Tag`, `cache-control: must-revalidate` sur le HTML, assets hachés |

Fichiers concernés : `apps/player/index.html`, `apps/host/index.html`, `apps/*/vite.config.ts`, `vercel.json`.
Il n'existe pas de dossier `public/` dans les apps : c'est là que doivent aller `robots.txt`, `llms.txt`, favicon, etc.

## 3. Constat contenu et marque

- **Nom** : le dépôt, le code et les titres disent « QuizV », le projet s'appelle « Quizdown ». Moteurs et LLM
  associent une entité à un nom stable : il faut en choisir un et s'y tenir partout (title, README, OG, JSON-LD).
- **Langue** : interface en anglais (« Enter the game code to join »), contenu des decks en français. Choisir la langue
  principale du site public (le français semble naturel) et déclarer `lang="fr"`.
- **Pas de page d'accueil explicative** : rien ne dit à un visiteur (ou à un robot) ce qu'est QuizV, à qui il
  s'adresse, ni en quoi il diffère de Kahoot.
- **Gisement inexploité** : 8 decks (Agentic Coding, Cloud, GCP, Docker, IA générative, MCP ×2, Observability),
  ~195 questions avec explications (`> ...`), des métadonnées propres (titre, description, tags, difficulté).
  Ce contenu est aujourd'hui enfermé dans le bundle JS du host.
- **Différenciateur fort et peu concurrencé** : « écrire ses quiz en Markdown » et « jouer en LAN sans compte ».
  Ce sont précisément les requêtes de niche (« kahoot alternative markdown », « quiz open source self-hosted »,
  « quiz multijoueur sans inscription ») où un petit site peut se classer et être cité.

## 4. Constat référencement LLM (GEO)

Les moteurs IA lisent surtout du **HTML statique** (la plupart des crawlers IA n'exécutent pas le JavaScript),
préfèrent les **réponses courtes et factuelles**, et s'appuient sur des **entités clairement identifiées**.

| Signal GEO | État |
| --- | --- |
| `llms.txt` / `llms-full.txt` | Absents |
| Politique explicite pour les crawlers IA (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`…) | Absente (pas de `robots.txt`) |
| Contenu lisible sans JS | Aucun |
| Données structurées (`SoftwareApplication`, `Quiz`, `FAQPage`) | Absentes |
| Passages citables (définition, comparatif, FAQ) | Absents |
| Présence sur les sources que les LLM lisent (GitHub, npm, Product Hunt, articles) | GitHub seulement, README en anglais orienté « LAN » |

Opportunité spécifique à QuizV : le format `.quizv.md` est **un format que les LLM peuvent écrire**. Documenter ce
format dans `llms.txt` permet à un utilisateur de demander à ChatGPT ou Claude « génère-moi un quiz Quizdown sur
Kubernetes » et d'obtenir un fichier valide. C'est à la fois du GEO et une fonctionnalité produit.

## 5. Préconisations par priorité

Légende effort : S (moins d'une demi-journée), M (1 à 3 jours), L (plus de 3 jours).

### Priorité 1 : indispensable, à faire tout de suite

Bases techniques sans lesquelles rien d'autre ne sert. Faible effort, fort impact.

| # | Action | Effort | Où |
| --- | --- | --- | --- |
| P1.1 | **Choisir un nom unique** (QuizV ou Quizdown) et l'utiliser dans tous les `<title>`, le README et les métadonnées | S | `apps/*/index.html`, `README.md` |
| P1.2 | Ajouter `robots.txt` : autoriser le site public, **bloquer `/host`** et les écrans de jeu, déclarer le sitemap | S | `apps/player/public/robots.txt` |
| P1.3 | Ajouter `<meta name="robots" content="noindex">` sur le host (et sur le joueur tant qu'il n'y a pas de landing) | S | `apps/host/index.html` |
| P1.4 | `lang="fr"`, `<meta name="description">`, `<link rel="canonical">`, `theme-color` dans les deux `index.html` | S | `apps/*/index.html` |
| P1.5 | Favicon (SVG + PNG 180 px pour iOS) et `manifest.webmanifest` minimal | S | `apps/*/public/` |
| P1.6 | Balises Open Graph et Twitter Card avec une image 1200×630 : le lien de partage d'une partie doit être beau | S | `apps/player/index.html` |
| P1.7 | Publier un premier `llms.txt` (présentation, liens, résumé du format `.quizv.md`) | S | `apps/player/public/llms.txt` |
| P1.8 | Rattacher un **domaine propre** (ex. `quizdown.app` ou `quizv.fr`) et rediriger en 301 les `*.vercel.app` | S | Vercel, `vercel.json` |
| P1.9 | Inscrire le domaine dans Google Search Console et Bing Webmaster Tools (Bing alimente ChatGPT Search et Copilot) | S | Hors dépôt |

### Priorité 2 : important, sous un à deux mois

Créer du contenu indexable et citable. C'est là que se joue l'essentiel du trafic.

#### Architecture retenue

Le contenu public se répartit sur deux projets, chacun avec un rôle clair :

| Projet | Rôle | Pages | Indexation |
| --- | --- | --- | --- |
| **Site statique** (nouveau) | Acquisition : expliquer, convaincre, être cité | Accueil, landing, format `.quizv.md`, alternative à Kahoot, FAQ, `llms.txt` | Indexé, priorité SEO et GEO |
| **Application** (existante) | Catalogue et jeu | Index des quiz publics, une page par quiz, page de détails | Pages catalogue indexées (pré-rendues) |
| **Application** (existante) | Partie en cours | Host, lobby, question, podium, écran joueur | `noindex` |

Points d'attention liés à cette séparation :

- **Même domaine si possible** : servir le site statique à la racine (`example.com`) et l'application sous un chemin
  ou un sous-domaine (`app.example.com`). Un même domaine concentre l'autorité ; un sous-domaine fonctionne aussi,
  mais il faut alors le déclarer séparément dans Search Console et le lier abondamment depuis le site statique.
- **Liens croisés** : chaque page du site statique pointe vers le catalogue de l'application, chaque page de quiz
  renvoie vers l'accueil et la documentation. Sans liens, les deux projets se partagent mal leur popularité.
- **Pas de doublon** : la description d'un quiz vit dans l'application (page quiz) ; le site statique la résume et
  pointe vers elle, sans copier la page. Un `canonical` sur chaque page évite toute ambiguïté.
- **Pages catalogue de l'application lisibles sans JS** : l'application est une SPA Vue, donc l'index, les pages quiz
  et les pages de détails doivent être générées en HTML au build (voir [la mise en œuvre](#mise-en-œuvre-suggérée-du-pré-rendu)).

#### Site statique

| # | Action | Effort | Où |
| --- | --- | --- | --- |
| P2.1 | **Accueil / landing** : proposition de valeur en 1 phrase, 3 bénéfices, captures, CTA « Lancer une partie » vers l'app et « Voir les quiz » vers le catalogue | M | Site statique |
| P2.2 | Page **« Format .quizv.md »** : spécification complète, exemple minimal copiable, erreurs courantes du `check` | M | Site statique, `/docs/format` |
| P2.3 | Page **« Alternative à Kahoot »** : tableau comparatif honnête (prix, compte requis, hors-ligne, open source, format) | S | Site statique |
| P2.4 | **FAQ** de 8 à 12 questions réelles (« Faut-il un compte ? », « Combien de joueurs ? », « Ça marche sans Internet ? ») avec balisage `FAQPage` | S | Site statique |
| P2.5 | `llms.txt` et `llms-full.txt` (spécification du format + 1 deck complet en Markdown brut) servis par le site statique, avec des liens vers le catalogue de l'app | S | Site statique |
| P2.6 | JSON-LD `SoftwareApplication` et `Organization` (ou `Person`) sur l'accueil | S | Site statique |

#### Pages publiques de l'application

| # | Action | Effort | Où |
| --- | --- | --- | --- |
| P2.7 | **Index des quiz publics** (`/quiz`) : liste de tous les decks avec titre, description, tags, difficulté, nombre de questions ; filtres par tag en vraies URL (`/quiz/tag/docker`) au lieu de `#/tag/docker` | M | `apps/host` ou nouvelle app, pré-rendu |
| P2.8 | **Une page par quiz** (`/quiz/docker-fundamentals`) : titre, description, tags, difficulté, auteur, 3 à 5 questions d'exemple, bouton « Jouer ce quiz » | M | Pré-rendu au build depuis `decks/` |
| P2.9 | **Page de détails** du quiz (`/quiz/docker-fundamentals/details`) : liste complète des questions avec leurs explications (`> …`), c'est le contenu le plus citable par les LLM. À décider : afficher ou non les bonnes réponses (on peut les masquer derrière un `<details>` pour ne pas gâcher la partie) | M | Pré-rendu au build |
| P2.10 | JSON-LD `Quiz` + `Question`/`acceptedAnswer` sur la page de détails, `ItemList` sur l'index, `BreadcrumbList` partout | M | Pages pré-rendues |
| P2.11 | Déplacer l'écran joueur de `/` vers `/join` (garder `/?code=` en redirection pour les QR codes déjà imprimés), puisque la racine revient au site statique | S | `vercel.json`, `apps/player` |

#### Commun aux deux

| # | Action | Effort | Où |
| --- | --- | --- | --- |
| P2.12 | `sitemap.xml` par projet (site : pages éditoriales ; app : index, quiz, détails, tags) avec `lastmod` issu de git, déclarés tous deux dans `robots.txt` | S | Scripts de build |
| P2.13 | Page 404 personnalisée (lien vers l'accueil et le catalogue) au lieu de la page texte Vercel | S | Les deux projets |

### Priorité 3 : amélioration continue, à planifier

Consolider l'autorité et mesurer.

| # | Action | Effort | Où |
| --- | --- | --- | --- |
| P3.1 | Version anglaise du site public avec `hreflang` (fr / en / x-default) | L | Pages pré-rendues |
| P3.2 | Blog ou guides : « Animer un quiz en formation », « Créer un quiz avec ChatGPT au format Quizdown »… 1 article par mois | L | `/guides` |
| P3.3 | README GitHub enrichi (français + anglais, GIF de démo, lien vers le site, topics GitHub : `quiz`, `kahoot-alternative`, `markdown`, `self-hosted`) | S | `README.md`, réglages GitHub |
| P3.4 | Présence externe : Product Hunt, AlternativeTo (fiche « Alternative à Kahoot »), awesome-lists self-hosted, article dev.to / LinkedIn | M | Hors dépôt |
| P3.5 | Galerie communautaire de decks (contribution par PR) : chaque deck ajouté = une page indexée de plus | L | `decks/`, CONTRIBUTING |
| P3.6 | Allègement du bundle host (charger les decks à la demande plutôt que tous via `import.meta.glob` eager) | M | `apps/host/src/decks.ts` |
| P3.7 | Image OG dynamique par deck (titre + tags) | M | Vercel OG ou génération au build |
| P3.8 | Suivi GEO mensuel : poser 10 questions types à ChatGPT, Perplexity, Claude, Gemini et noter si QuizV est cité | S | Tableau de suivi |
| P3.9 | Analytics respectueux de la vie privée (Plausible, Umami ou Vercel Analytics) sur le site public uniquement | S | Pages publiques |

### Arbitrage sur les crawlers IA

Recommandation : **autoriser** les robots d'IA sur le contenu public. QuizV est un projet open source qui a intérêt à
être cité ; bloquer `GPTBot` ou `ClaudeBot` retirerait le site des réponses IA sans rien protéger (le code est déjà
public sur GitHub). On bloque seulement `/host` et les écrans de partie, qui n'ont aucune valeur pour personne.

## 6. Exemples prêts à l'emploi

### `robots.txt`

```txt
# QuizV : site public indexable, application de jeu exclue
User-agent: *
Allow: /
Disallow: /host
Disallow: /join

# Robots d'IA explicitement autorisés sur le contenu public
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /
Disallow: /host
Disallow: /join

Sitemap: https://example.com/sitemap.xml
```

Remplacer `example.com` par le domaine retenu en P1.8. Les pages catalogue de l'application (`/quiz/...`) restent
autorisées ; seuls les écrans de jeu sont exclus. Si l'app est sur un sous-domaine, elle a son propre `robots.txt`.

### `<head>` de l'écran joueur (en attendant la landing)

```html
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QuizV — quiz multijoueur en temps réel, écrit en Markdown</title>
  <meta name="description" content="Alternative open source à Kahoot : écrivez vos quiz en Markdown, vos joueurs
    rejoignent avec un code ou un QR code, sans compte.">
  <link rel="canonical" href="https://example.com/">
  <meta name="theme-color" content="#0f172a">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="QuizV">
  <meta property="og:title" content="QuizV — quiz multijoueur en temps réel">
  <meta property="og:description" content="Rejoignez la partie avec le code affiché à l'écran.">
  <meta property="og:image" content="https://example.com/og.png">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
</head>
```

Sur le host, ajouter en plus `<meta name="robots" content="noindex, nofollow">`.

### `llms.txt`

```md
# QuizV

> QuizV est une alternative open source à Kahoot : des quiz multijoueurs en temps réel, écrits en Markdown
> (fichiers `.quizv.md`), que les joueurs rejoignent depuis leur téléphone avec un code, sans créer de compte.

- Licence MIT, code source : https://github.com/WhiteWoodTech/hashquiz
- Fonctionne en réseau local (WebSocket) ou en ligne (Vercel + Supabase Realtime)
- Score selon la rapidité, questions à choix unique ou multiple, minuteur par question

## Documentation

- [Format .quizv.md](https://example.com/docs/format): écrire un quiz en Markdown + frontmatter YAML
- [Déployer](https://github.com/WhiteWoodTech/hashquiz/blob/develop/docs/DEPLOY.md): Vercel et Supabase

## Quiz disponibles

- [Docker](https://example.com/quiz/docker-fundamentals): bases de Docker, 30 questions
- [IA générative](https://example.com/quiz/genai-llm-introduction): fondamentaux des LLM, 29 questions

## Optional

- [Spécification complète et exemple](https://example.com/llms-full.txt)
```

### JSON-LD d'une page de deck

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Quiz",
  "name": "Docker",
  "description": "Les bases de Docker : image, conteneur, Dockerfile, registry, volume, réseau.",
  "inLanguage": "fr",
  "educationalLevel": "intermediate",
  "keywords": "docker, image, container",
  "author": { "@type": "Person", "name": "Maxime Lenne" },
  "isAccessibleForFree": true,
  "hasPart": [{
    "@type": "Question",
    "name": "Qu'est-ce qu'une image Docker ?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Un modèle en lecture seule pour créer des conteneurs."
    }
  }]
}
</script>
```

### Mise en œuvre suggérée du pré-rendu

**Pages publiques de l'application.** Pas besoin de migrer vers Nuxt. Un script Bun lancé avant `build:web` peut lire
`decks/**/*.quizv.md` avec `@quizv/parser` (déjà utilisé par le host) et écrire des fichiers HTML statiques :
`dist/quiz/index.html`, `dist/quiz/<id>/index.html`, `dist/quiz/<id>/details/index.html` et
`dist/quiz/tag/<tag>/index.html`, ainsi que le `sitemap.xml` de l'app. Ces pages peuvent ensuite être « hydratées » par
Vue pour l'interactivité (bouton « Jouer »), mais leur contenu doit être présent dans le HTML. Les réécritures de
`vercel.json` sont à ajuster pour ne pas les masquer derrière le SPA. Alternative équivalente : `vite-ssg` sur une
petite app Vue dédiée au catalogue.

**Site statique.** N'importe quel générateur statique convient (Astro est un bon choix : HTML pur par défaut,
Markdown natif, sitemap intégré). Il peut lire les mêmes `.quizv.md` du dépôt pour générer `llms-full.txt` et les
résumés de quiz, afin que les deux projets restent synchronisés sans copie manuelle.

## 7. Indicateurs de suivi

| Indicateur | Outil | Cible à 3 mois |
| --- | --- | --- |
| Pages indexées | Search Console, Bing Webmaster | Accueil + docs + tous les decks |
| Impressions sur « alternative kahoot », « quiz markdown », « quiz sans compte » | Search Console | En progression mensuelle |
| Résultats enrichis valides (`FAQPage`, `Quiz`) | Test des résultats enrichis Google | 0 erreur |
| Citations dans les réponses IA (10 requêtes types) | Test manuel mensuel | Au moins 2 moteurs sur 4 citent QuizV |
| Visites référentes depuis `chatgpt.com`, `perplexity.ai` | Analytics | Mesurées et en hausse |
| Étoiles et forks GitHub | GitHub | Suivi de tendance |
