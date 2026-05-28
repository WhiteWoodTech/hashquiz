# Cloud & GCP — Plan

**Target questions:** 20
**Estimated duration:** 464 secondes (~7,7 min)
**Language:** Français
**Difficulty mix:** 20 % easy, 60 % medium, 20 % hard
**Question types:** Mix — 16 single-choice + 4 multiple-choice
**Audience:** Apprenant·e dev IA Simplon (sait Docker + Python, découvre GCP)

---

## Sources Used

- `BRIEF.md` — brief Simplonline complet (architecture RAG sur GCP, services imposés, critères d'évaluation)
- `01-concepts-cloud.md` — cours concepts cloud (NIST, XaaS, déploiement, shared responsibility, FinOps, vocabulaire)
- `02-concepts-cloud.md` — slides concepts cloud (XaaS, modèles déploiement, FinOps, IaC, patterns)
- `02-gcp-overview.md` — cours GCP (hiérarchie, projet vs billing, régions, console, gcloud, sécurité J1)
- `03-gcp-overview.md` — slides GCP (hiérarchie, régions, console, gcloud, Cloud Shell, VPC/LB/DNS/NAT)
- `04-cloud-run.md` — cours Cloud Run + Artifact Registry (modèle d'exécution, contraintes, déploiement, secrets, autoscaling, révisions)
- `04-gcp-cloud-run.md` — slides Cloud Run (scale-to-zero, Service vs Job, contraintes, AR, cold start, traffic splitting, pièges)
- `05-cloud-sql.md` — slides Cloud SQL (DBaaS, instance, pgvector, IAM, Cloud SQL Connector, Auth Proxy)
- `05-gcp-cloud-sql.md` — cours Cloud SQL Postgres + pgvector
- `06-cloud-storage.md` — slides GCS (object storage, classes, lifecycle, uniform access, signed URLs, pièges)
- `06-gcp-storage.md` — cours Cloud Storage
- `07-iam-secrets.md` — slides IAM (triangle, principals, rôles, SA, clés JSON, WIF, Secret Manager)
- `07-gcp-iam-secrets.md` — cours IAM + Secret Manager
- `quiz-01-concepts-cloud.md`, `quiz-02-gcp-services.md` — quizzes de référence du cours (style et niveau, à ne PAS dupliquer)

> Couverture suffisante sur tous les modules — pas de recherche web nécessaire.

---

## Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| easy       | 4     | 20 %       |
| medium     | 12    | 60 %       |
| hard       | 4     | 20 %       |

---

## Tag Coverage

| Tag         | Questions                              |
|-------------|----------------------------------------|
| concepts    | Q1, Q2, Q3, Q4                         |
| gcp-base    | Q5, Q6, Q7                             |
| cloud-run   | Q8, Q9, Q10, Q11                       |
| cloud-sql   | Q12, Q13, Q14                          |
| pgvector    | Q12                                    |
| gcs         | Q15, Q16, Q17                          |
| iam         | Q18, Q19, Q20                          |
| secrets     | Q19                                    |
| wif         | Q20                                    |
| security    | Q17, Q18, Q19, Q20                     |
| finops      | Q4, Q16                                |
| network     | Q7                                     |

---

## Questions

### Q1 — IaC : déclaratif vs impératif

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [concepts, iac]
- **Source:** `02-concepts-cloud.md` § IaC en 1 slide ; `01-concepts-cloud.md`
- **Key concept:** Distinguer le style déclaratif (Terraform — décrit le QUOI, idempotent) de l'impératif (script gcloud — décrit le COMMENT, état partiel possible).
- **Notes:** La bonne réponse cible le déclaratif. Distracteurs : « plus rapide à écrire », « ne nécessite pas Git », « réservé à Kubernetes ».

### Q2 — Avantages concrets d'un DBaaS (Cloud SQL) vs Postgres self-hosted

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [concepts, cloud-sql, dbaas]
- **Source:** `05-cloud-sql.md` § Pourquoi un DBaaS ; `05-gcp-cloud-sql.md` § 1
- **Key concept:** Identifier ce que Cloud SQL prend en charge (backups quotidiens auto, patchs sécurité, failover HA, métriques inclues) vs ce qui reste à ta charge (modèle de données, requêtes).
- **Notes:** 4 choix corrects parmi 6 (backups auto, patchs OS, HA en 1 clic, métriques) ; 2 distracteurs faux (« GCP écrit tes requêtes SQL », « GCP optimise tes index »).

### Q3 — Les 5 caractéristiques NIST du cloud (multi)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [concepts, nist]
- **Source:** `01-concepts-cloud.md` § 1 ; `02-concepts-cloud.md` slide « Le cloud, c'est quoi ? »
- **Key concept:** Reconnaître les 5 caractéristiques NIST (on-demand self-service, broad network access, resource pooling, rapid elasticity, measured service) parmi des distracteurs.
- **Notes:** Distracteurs : « contrat 36 mois », « hébergement sur-mesure dédié », « stockage illimité gratuit ».

### Q4 — Piège FinOps : pourquoi un Cloud Run oublié peut coûter 200 € en un week-end ?

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [concepts, finops, cloud-run]
- **Source:** `01-concepts-cloud.md` § 5 ; `02-concepts-cloud.md` slide FinOps light ; `04-cloud-run.md`
- **Key concept:** Comprendre que `--min-instances` > 0 maintient des instances chaudes facturées **en continu**, indépendamment du trafic — ce qui annule l'effet scale-to-zero.
- **Notes:** Bonne réponse : « `--min-instances=10` maintient 10 instances facturées 24/7 ». Distracteurs : « Cloud Run facture les bots », « le LB Google est facturé en plus », « scale-to-zero ne marche que la nuit ».

### Q5 — Hiérarchie des ressources GCP

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [gcp-base, hierarchie]
- **Source:** `02-gcp-overview.md` § 2 ; `03-gcp-overview.md` slide Hiérarchie
- **Key concept:** L'ordre correct est Organisation → Folder → Project → Resource. Le Project est l'unité obligatoire (IAM + billing).
- **Notes:** Distracteurs : autre ordre, ou inversion Project ↔ Folder.

### Q6 — Project ID GCP : peut-on le changer après création ?

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [gcp-base, project]
- **Source:** `02-gcp-overview.md` § 2 ; `03-gcp-overview.md` slide Hiérarchie
- **Key concept:** L'ID de projet est **unique mondialement** et **immutable**. On peut renommer le « nom d'affichage », mais pas l'ID.
- **Notes:** Bonne réponse : « Non, l'ID est immutable — seul le display name peut changer ». Distracteurs : « Oui via `gcloud projects rename` », « Oui en supprimant et recréant le projet (les ressources sont migrées) », « Seulement dans les 30 premiers jours ».

### Q7 — Cloud NAT + IP statique : à quoi ça sert ?

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [gcp-base, network]
- **Source:** `03-gcp-overview.md` slide Cloud Load Balancing + DNS + NAT
- **Key concept:** Cloud NAT permet à une ressource sans IP publique (ex : Cloud Run via VPC Connector) de **sortir vers Internet** avec une **IP statique réservée**, indispensable pour être allowlisté par une API tierce.
- **Notes:** Distracteurs : « répartir la charge entrante », « accélérer les requêtes DNS », « chiffrer le trafic interne ».

### Q8 — Que crée chaque `gcloud run deploy` ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [cloud-run, revisions]
- **Source:** `04-cloud-run.md` § 6 ; `04-gcp-cloud-run.md` slide Révisions + traffic splitting
- **Key concept:** Chaque déploiement crée une **nouvelle révision immuable** ; les anciennes ne sont pas supprimées et restent activables pour un rollback.
- **Notes:** Bonne réponse : « une nouvelle révision immuable ». Distracteurs : « écrase la révision précédente », « crée un nouveau service », « duplique le projet ».

### Q9 — Build Docker sur Mac M-series pour Cloud Run

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [cloud-run, docker, pieges]
- **Source:** `04-gcp-cloud-run.md` slide Pièges classiques
- **Key concept:** Cloud Run attend du `linux/amd64`. Sur Mac M-series (arm64), il faut builder explicitement avec `docker buildx build --platform linux/amd64`, sinon le container fait `exec format error` au démarrage.
- **Notes:** Distracteurs : « ajouter `--rosetta` à `docker run` », « rebuild côté Cloud Run via `gcloud builds submit` (acceptable mais pas la 1ère solution) », « activer la VM x86 sur le M-series ».

### Q10 — Quelles contraintes le container doit-il respecter pour Cloud Run ? (multi)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [cloud-run, container]
- **Source:** `04-cloud-run.md` § 2 ; `04-gcp-cloud-run.md` slide Contraintes
- **Key concept:** Plusieurs contraintes obligatoires : écouter sur `$PORT` (défaut 8080), être **stateless** (pas de FS persistant entre instances), démarrer en < 5 min. Le timeout requête (60 min max) n'est pas une contrainte du container mais une limite Cloud Run.
- **Notes:** 3 réponses correctes (écouter sur `$PORT`, stateless / FS éphémère, démarrer en < 5 min) + 2 distracteurs faux (« utiliser un base alpine », « tourner en root »).

### Q11 — Rollback Cloud Run en 30 secondes

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [cloud-run, rollback, revisions]
- **Source:** `04-cloud-run.md` § 6 ; `04-gcp-cloud-run.md` slide Révisions
- **Key concept:** Le rollback se fait par **repointage du trafic** sur une révision antérieure (`gcloud run services update-traffic ... --to-revisions=<old>=100`), sans redéployer ni rebuilder.
- **Notes:** La commande exacte ou son équivalent fonctionnel est la bonne réponse. Distracteurs : « `gcloud run deploy --rollback` », « supprimer la révision défaillante (force le retour à la précédente) », « relancer la pipeline GitHub Actions ».

### Q12 — Index recommandé pour pgvector en 2026

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [cloud-sql, pgvector]
- **Source:** `05-cloud-sql.md` slide Extension pgvector ; `05-gcp-cloud-sql.md` § 5
- **Key concept:** **HNSW** (Hierarchical Navigable Small World) est l'index ANN de référence depuis 2024-2026 pour pgvector. IVFFlat est l'alternative historique, plus lente à construire mais OK pour très gros volumes.
- **Notes:** Bonne réponse : HNSW. Distracteurs : BTREE (inutilisable pour vecteurs), GIN (texte plein), GiST (legacy pour pgvector).

### Q13 — Pourquoi créer un user dédié `rag_app` plutôt que d'utiliser `postgres` ?

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [cloud-sql, security]
- **Source:** `05-cloud-sql.md` slide Bases + utilisateurs ; `05-gcp-cloud-sql.md` § 4
- **Key concept:** Principle of least privilege : `postgres` est root et peut tout (DROP DATABASE, CREATE USER…). Un user applicatif limité à SELECT/INSERT/UPDATE/DELETE réduit le blast radius en cas de SQL injection ou de fuite de credentials.
- **Notes:** Distracteurs : « `postgres` est plus lent », « `postgres` ne supporte pas pgvector », « par habitude des tutoriels ».

### Q14 — Format du DSN SQLAlchemy via socket Unix Cloud SQL

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [cloud-sql, cloud-run, connexion]
- **Source:** `05-cloud-sql.md` slide DSN côté code ; `05-gcp-cloud-sql.md` § 6
- **Key concept:** Avec le Cloud SQL Connector intégré à Cloud Run, l'host est un **socket Unix** `/cloudsql/<instance-connection-name>`, à passer via `?host=...` (le `@` reste vide après l'identifiant).
- **Notes:** Bonne réponse : `postgresql+asyncpg://user:pwd@/dbname?host=/cloudsql/<icn>`. Distracteurs : DSN avec IP publique `127.0.0.1:5432`, DSN avec `host=cloudsql.googleapis.com`, DSN sans `?host=` (impossible avec socket).

### Q15 — Stockage objet vs bloc vs fichier

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [gcs, storage]
- **Source:** `06-cloud-storage.md` slide Stockage objet ; `06-gcp-storage.md` § 1
- **Key concept:** Le stockage **objet** (GCS, S3, Blob) sert à des fichiers immuables (PDF, images, modèles, backups). Le stockage **bloc** sert de disque pour une VM/BDD. Le stockage **fichier** sert au partage NFS multi-host.
- **Notes:** Bonne réponse : « GCS est du stockage objet, équivalent S3 — pour des fichiers immuables ». Distracteurs cherchent à confondre les 3 familles.

### Q16 — Coldline : piège du minimum retention 90 jours

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [gcs, finops]
- **Source:** `06-cloud-storage.md` slide Buckets + classes ; `06-gcp-storage.md` § 2
- **Key concept:** Les classes Nearline / Coldline / Archive imposent une **rétention minimale** facturée (30 j / 90 j / 365 j) **même si tu supprimes plus tôt**. Plus chaque lecture est facturée en sus du stockage.
- **Notes:** Bonne réponse : « Coldline impose 90 jours de rétention facturée minimum — si tu supprimes au bout de 10 jours tu paies quand même 90 jours ». Distracteurs : « Coldline interdit la suppression avant 90 j », « Coldline réplique automatiquement vers Standard », « Coldline est gratuit en lecture ».

### Q17 — Empêcher un bucket d'être ouvert au monde

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [gcs, security]
- **Source:** `06-cloud-storage.md` slide Uniform vs Fine-grained + Pièges ; `06-gcp-storage.md` § 3, § 8
- **Key concept:** Combiner `--uniform-bucket-level-access` (1 source de vérité IAM) avec `publicAccessPrevention: enforced` (interdit `allUsers` même par mégarde). Top 1 des fuites de données depuis 2018.
- **Notes:** Bonne réponse cite les **deux** mesures conjointes. Distracteurs : uniquement uniform (insuffisant), uniquement région européenne (sans rapport), désactiver l'API Storage (irréaliste).

### Q18 — Rôles minimaux d'une SA Cloud Run pour le brief RAG (multi)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [iam, security, brief]
- **Source:** `07-iam-secrets.md` slide Créer une SA dédiée + Récap rôles brief ; `07-gcp-iam-secrets.md` § 3, § 7
- **Key concept:** Pour le brief, la SA `rag-api` doit avoir : `roles/cloudsql.client`, `roles/secretmanager.secretAccessor`, `roles/storage.objectViewer` (sur le bucket), `roles/logging.logWriter`. Surtout PAS `roles/owner` ni `roles/editor`.
- **Notes:** 4 réponses correctes (les 4 rôles ci-dessus) + 2 distracteurs piégeux (`roles/owner` « pour aller vite », `roles/editor`).

### Q19 — Pourquoi Workload Identity Federation plutôt qu'une clé JSON ?

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [iam, wif, security, cicd]
- **Source:** `07-iam-secrets.md` slides Clés JSON + WIF ; `07-gcp-iam-secrets.md` § 4
- **Key concept:** WIF évite tout secret au repos côté CI : échange d'un JWT OIDC (signé par GitHub) contre un token GCP court (1 h). Granularité par repo/branche, auditable, pas de rotation manuelle, pas de fuite possible via un commit.
- **Notes:** Bonne réponse réunit plusieurs bénéfices (pas de secret long-lived, granularité repo/branche, audit OIDC). Distracteurs : « WIF est obligatoire depuis 2026 », « WIF est plus rapide à configurer » (faux, c'est plus complexe), « WIF permet d'éviter d'activer les APIs GCP ».

### Q20 — `attribute-condition` sur le provider WIF GitHub

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [iam, wif, security]
- **Source:** `07-iam-secrets.md` slides WIF concepts + Créer un provider WIF
- **Key concept:** L'`attribute-condition` est **obligatoire** depuis 2023 : sans elle, **n'importe quel repo GitHub public** peut s'authentifier sur ton provider. Il faut filtrer au minimum par `assertion.repository_owner` (ou `assertion.repository`, ou la branche).
- **Notes:** Bonne réponse : « filtrer les tokens autorisés au minimum par repository_owner / repository — sinon n'importe quel repo GitHub peut s'authentifier ». Distracteurs : « optionnelle, pour les logs », « obligatoire mais seulement pour les repos privés », « sert à mapper les rôles IAM ».

---

## Review Checklist

- [x] Questions cover all key topics from sources (6 modules + brief)
- [x] Difficulty distribution matches target (4 easy / 12 medium / 4 hard)
- [x] No duplicate or overly similar questions to `quiz-01-concepts-cloud.md` / `quiz-02-gcp-services.md` (angles différents : IaC déclaratif vs `gcloud run deploy` qui crée révision, FinOps piège `min-instances`, Mac M-series, rollback `update-traffic`, DSN socket Unix, Coldline 90j retention, `publicAccessPrevention` + uniform, WIF attribute-condition...)
- [x] Tags are consistent and meaningful (concepts, gcp-base, cloud-run, cloud-sql, gcs, iam, wif, secrets, security, finops, network)
- [x] Timer values realistic : 20s easy, 22-25s medium, 30s hard
- [x] Mix of single (16) and multiple (4) choice

---

_Plan créé : 2026-05-22_
_Prêt pour la génération du quiz : [ ]_
