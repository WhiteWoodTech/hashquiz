---
title: Cloud & GCP
description: >
  Quiz sur les concepts fondamentaux du cloud (IaaS/PaaS/SaaS, régions,
  scalabilité) avec un focus sur Google Cloud Platform.
theme: default
author: Maxime Lenne
tags: [cloud, gcp, devops]
---

---
type: single
timer: 20
difficulty: easy
tags: [concepts, iac]
---

## Tu écris ce bloc Terraform pour provisionner ton Cloud Run

```hcl
resource "google_cloud_run_service" "rag_api" {
  name     = "rag-api"
  location = "europe-west1"
}
```

Comment qualifies-tu ce style d'Infrastructure as Code ?

- [ ] **Impératif** — tu décris chaque étape de provisioning dans l'ordre
- [x] **Déclaratif** — tu décris l'état final voulu, l'outil calcule le diff puis l'applique
- [ ] **Procédural** — c'est un script bash déguisé sous une syntaxe HCL
- [ ] **Réservé à Kubernetes** — Terraform ne peut cibler que GKE en GCP

> Terraform est l'archétype de l'IaC **déclaratif** : tu écris le **quoi** (l'état final voulu),
> pas le **comment**. La commande `terraform plan` calcule le diff entre l'état réel et l'état déclaré,
> puis `terraform apply` matérialise ce diff de manière **idempotente**. L'impératif (script `gcloud`
> étape par étape) peut, à l'inverse, laisser un état partiel si une commande échoue au milieu —
> c'est tout l'intérêt du déclaratif pour de l'infra qui doit durer.

---
type: multiple
timer: 25
difficulty: medium
tags: [concepts, cloud-sql, dbaas]
---

## Cloud SQL Postgres vs Postgres self-hosted sur VM

Quels avantages **Cloud SQL Postgres** apporte-t-il par rapport à un Postgres que tu
installerais et opérerais toi-même sur une VM Compute Engine ?

- [x] Les **backups quotidiens** sont automatiques, avec rétention configurable
- [x] Les **patchs OS et CVE Postgres** sont appliqués automatiquement (fenêtre configurable)
- [x] L'**HA multi-zone** s'active en changeant un paramètre, sans réécrire l'archi
- [ ] Cloud SQL **optimise et crée les index** à partir des plans d'exécution observés

> Cloud SQL prend en charge tout le **plan opérationnel** de Postgres : backups, patchs, HA, métriques,
> failover, upgrades mineures. **Ce qui reste à toi**, c'est le modèle de données, les requêtes et le
> choix des index — Cloud SQL ne devine pas la sémantique métier. Le ratio « temps économisé / surcoût »
> bascule en faveur du **DBaaS** dès qu'on sort du prototype.

---
type: multiple
timer: 25
difficulty: medium
tags: [concepts, nist]
---

## Les 5 caractéristiques essentielles du cloud (NIST SP 800-145)

Parmi ces propriétés, lesquelles font partie des **5 caractéristiques essentielles du cloud**
selon le NIST ?

- [x] **On-demand self-service** — tu provisionnes sans intervention humaine du fournisseur
- [x] **Rapid elasticity** — tu scales up/down rapidement, parfois automatiquement
- [x] **Measured service** — facturation à la consommation (pay-as-you-go)
- [ ] **Contrat d'engagement** de 36 mois minimum signé avec le fournisseur

> Le NIST définit 5 caractéristiques : *on-demand self-service*, *broad network access*,
> *resource pooling*, *rapid elasticity*, *measured service*. **Si l'une manque, ce n'est pas du
> cloud — c'est de l'hébergement classique.** L'engagement long-terme et le mono-tenant exclusif
> sont précisément l'inverse du cloud (qui doit être à la demande et mutualisé pour mutualiser
> les coûts).

---
type: single
timer: 30
difficulty: hard
tags: [concepts, finops, cloud-run]
---

## Facture de 200 € sur un Cloud Run de TP oublié le week-end

Une équipe oublie un service Cloud Run sur leur projet GCP de TP avec `--min-instances=10`.
Au bout du week-end, ils découvrent une facture de ~200 €. Quelle est la **cause technique précise** ?

- [x] `--min-instances=10` maintient **10 instances chaudes facturées 24/7** — scale-to-zero annulé
- [ ] Cloud Run a facturé les requêtes des bots et crawlers qui ont scrapé l'URL publique
- [ ] Le Load Balancer Google intégré à Cloud Run a une facturation horaire qui s'ajoute au compute
- [ ] Le scale-to-zero de Cloud Run ne s'applique pas le week-end (politique de Google par défaut)

> **`--min-instances=N` impose un plancher de N instances toujours allumées**, même quand zéro trafic
> arrive. Utile en prod pour supprimer les cold starts, mais ça désactive complètement le scale-to-zero.
> Le **LB Cloud Run est gratuit et inclus**, et le scale-to-zero ne dépend ni du jour ni de l'heure.
> Le réflexe pour éviter ce piège : **alerte budget** dès la création du projet (50 / 90 / 100 %).

---
type: single
timer: 20
difficulty: easy
tags: [gcp-base, hierarchie]
---

## Hiérarchie des ressources Google Cloud, du plus haut au plus bas

- [x] Organisation → Folder → Project → Resource
- [ ] Organisation → Project → Folder → Resource
- [ ] Billing Account → Project → Folder → Resource
- [ ] Folder → Organisation → Project → Resource

> GCP organise ses ressources en arbre : **Organisation** (optionnel, lié au Google Workspace de
> l'entreprise) → **Folder** (optionnel, regroupement par BU/env) → **Project** (obligatoire, unité
> d'IAM et de facturation) → **Resource** (Cloud Run, bucket, instance SQL…). Les politiques IAM
> s'héritent vers le bas. Le **Billing Account** n'appartient pas à la hiérarchie : il est **rattaché**
> au projet, pas inclus dedans.

---
type: single
timer: 22
difficulty: medium
tags: [gcp-base, project]
---

## Project ID GCP : peut-on corriger une typo après création ?

Tu as créé un projet avec l'ID `simlpon-rag-prod` (typo : « simlpon »). Tu réalises l'erreur
30 minutes plus tard, le projet est encore vide. Peux-tu corriger l'ID ?

- [ ] Oui, via `gcloud projects rename simlpon-rag-prod simplon-rag-prod`
- [ ] Oui, en supprimant et recréant — les ressources sont migrées automatiquement
- [x] **Non**, le Project ID est **unique mondialement et immutable** — seul le « display name » change
- [ ] Oui, mais uniquement dans les 30 premiers jours après la création

> Le **Project ID** est **immutable** une fois créé et **globalement unique** sur GCP. Tu peux changer
> le **display name** (l'étiquette lisible) à volonté, mais l'ID reste figé. La seule « correction »
> consiste à créer un nouveau projet avec le bon ID puis à supprimer l'ancien (aucun coût puisqu'il
> est vide). Conséquence pratique : **réfléchis bien à l'ID dès la création** — convention
> `<orga>-<projet>-<env>` (ex. `simplon-rag-prod`).

---
type: single
timer: 25
difficulty: medium
tags: [gcp-base, network]
---

## Donner à Cloud Run une IP de sortie stable

Ton API Cloud Run doit appeler une **API tierce SaaS** qui exige une **allowlist d'IP source**.
Quelle architecture GCP permet de donner à ton Cloud Run une IP de sortie **stable** vers Internet ?

- [ ] Activer `--min-instances=1` pour figer l'instance et son IP
- [ ] Déclarer une IP statique via `gcloud compute addresses create` et l'attacher au Cloud Run
- [x] **VPC Connector** branché au Cloud Run + **Cloud NAT** en sortie du VPC avec une **IP statique réservée**
- [ ] Utiliser un Cloud Load Balancer externe en sortie d'API

> Par défaut, Cloud Run sort sur une **IP dynamique** appartenant au pool Google : impossible à
> allowlister chez un tiers. La solution standard : **VPC Connector** (le Cloud Run se branche au VPC
> du projet) + **Cloud NAT** avec une **IP statique réservée**. Tout le trafic sortant du Cloud Run
> passe par cette IP fixe, qu'on peut communiquer au partenaire. `--min-instances=1` ne fige pas
> l'IP — c'est le Load Balancer Cloud Run qui route. Un LB externe traite le trafic **entrant**,
> pas la sortie.

---
type: single
timer: 20
difficulty: easy
tags: [cloud-run, revisions]
---

## 3ᵉ `gcloud run deploy` : que deviennent les deux révisions précédentes ?

- [ ] Elles sont supprimées automatiquement pour libérer du quota
- [x] Elles restent **activables pour un rollback** — seule la nouvelle reçoit 100 % du trafic par défaut
- [ ] Elles sont archivées dans un bucket GCS dédié au service
- [ ] Elles continuent à recevoir 33 % du trafic chacune pour une bascule progressive

> Chaque `gcloud run deploy` crée une **nouvelle révision immuable** (`rag-api-00003-xyz`).
> **Les anciennes révisions ne sont pas supprimées** : elles restent listables et activables via
> `gcloud run services update-traffic`. Par défaut, le trafic bascule à 100 % sur la dernière
> révision déployée, mais c'est une **règle de routage**, pas un effacement. C'est ce qui rend
> le **rollback trivial** : repointer le trafic sur l'avant-dernière, sans rebuilder.

---
type: single
timer: 25
difficulty: medium
tags: [cloud-run, docker, pieges]
---

## `exec format error` au démarrage Cloud Run depuis un MacBook M3

Tu builds ton image Docker sur ton MacBook M3, tu la pushes vers Artifact Registry, et au
déploiement Cloud Run plante avec `exec format error`. Cause et fix ?

- [ ] Le runtime Docker du Mac est cassé — il faut redémarrer Docker Desktop
- [x] Build **arm64** (natif M-series) au lieu de **linux/amd64** — `docker buildx build --platform linux/amd64`
- [ ] Cloud Run ne supporte pas les images poussées depuis un Mac — `gcloud builds submit` obligatoire
- [ ] L'`ENTRYPOINT` du Dockerfile doit être préfixé par `/bin/sh -c` sur Mac

> Les Mac M-series buildent en **arm64** par défaut, mais Cloud Run exécute du **linux/amd64**.
> Symptôme typique : `exec format error` au démarrage du container, lisible dans
> `gcloud run services logs read`. Le fix standard : `docker buildx build --platform linux/amd64 -t ... .`
> (ou ajouter `--platform=linux/amd64` au `FROM` du Dockerfile). Cloud Build (`gcloud builds submit`)
> est une **alternative valide** — il build côté Google en amd64 — mais **pas obligatoire**, `buildx`
> local fait très bien le job.

---
type: multiple
timer: 25
difficulty: medium
tags: [cloud-run, container]
---

## Contraintes que le container doit respecter sur Cloud Run

Quelles contraintes ton container **doit-il respecter** pour fonctionner correctement sur Cloud Run ?

- [x] Écouter sur le port défini par la variable d'environnement `$PORT` (par défaut `8080`)
- [x] Être **stateless** — pas de fichier persistant local entre instances ni entre requêtes
- [x] Démarrer en **moins de 5 minutes** (cold start max)
- [ ] S'exécuter en **root** pour pouvoir binder le port 80

> Cloud Run impose un cadre clair : **écouter sur `$PORT`**, **stateless** (le file system est éphémère
> et perdu au scale-up/down), **démarrage rapide** (timeout cold start 5 min). En revanche **n'importe
> quelle image** convient (Alpine, slim, distroless…), et il **faut au contraire un user non-root**
> en bonne pratique sécurité (Cloud Run écoute sur 8080, pas 80). Stocker dans `/tmp/` sur 1 instance
> « marche » par hasard ; sur 2 instances, 50 % des requêtes échouent — utiliser GCS ou Memorystore
> à la place.

---
type: single
timer: 30
difficulty: hard
tags: [cloud-run, rollback, revisions]
---

## Rollback Cloud Run en moins de 30 secondes

Tu viens de déployer la révision `rag-api-00007` qui plante au démarrage. La précédente
`rag-api-00006` fonctionnait. Quelle commande te ramène à `00006` **en moins de 30 secondes**,
sans rebuilder ni redéployer ?

- [x] `gcloud run services update-traffic rag-api --to-revisions=rag-api-00006-xyz=100`
- [ ] `gcloud run deploy rag-api --rollback --region=europe-west1`
- [ ] `gcloud run revisions delete rag-api-00007-abc` — restaure automatiquement la précédente
- [ ] Relancer la pipeline GitHub Actions sur le commit précédent pour reconstruire et redéployer

> Le rollback Cloud Run = **repointage du trafic** sur une révision antérieure via
> `update-traffic --to-revisions=<revision>=100`. C'est **instantané** (≤ 30 s) car les anciennes
> révisions sont **toujours présentes** sur la plateforme, prêtes à recevoir du trafic. Il n'existe
> **pas** de flag `--rollback` sur `gcloud run deploy`. Supprimer la révision défaillante est
> destructif et lent. Relancer la pipeline est l'anti-pattern (5-10 min au lieu de 30 s).

---
type: single
timer: 22
difficulty: medium
tags: [cloud-sql, pgvector]
---

## Quel index pgvector en 2026 pour la similarité cosine ?

Tu déclares une table `chunks(embedding vector(1024))` sur Cloud SQL Postgres avec pgvector.
Quel **index** crées-tu par défaut pour des recherches par similarité cosine ?

- [ ] `CREATE INDEX ON chunks USING btree (embedding)`
- [ ] `CREATE INDEX ON chunks USING gin (embedding)`
- [x] `CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)`
- [ ] `CREATE INDEX ON chunks USING gist (embedding vector_cosine_ops)`

> **HNSW** (Hierarchical Navigable Small World) est l'index ANN de référence pour pgvector depuis
> 2024 : excellente latence p99 et rappel par défaut. **IVFFlat** est l'alternative historique (plus
> rapide à builder mais moins précise, et nécessite d'apprendre des centroïdes). **B-tree** et **GIN**
> sont inadaptés (B-tree compare des scalaires ordonnables ; GIN sert au texte plein). **GiST** est
> legacy pour pgvector et supplanté par HNSW.

---
type: single
timer: 22
difficulty: medium
tags: [cloud-sql, security]
---

## Pourquoi un user dédié `rag_app` plutôt que le user `postgres` ?

- [ ] Parce que `postgres` est plus lent — Cloud SQL applique un throttling sur ce user
- [ ] Parce que `postgres` ne peut pas utiliser l'extension pgvector
- [x] **Principle of least privilege** — borner l'app à `SELECT/INSERT/UPDATE/DELETE` réduit le blast radius
- [ ] Par convention historique des tutoriels Postgres, sans impact réel

> `postgres` est **superuser** : il peut tout — `DROP DATABASE`, `CREATE EXTENSION`, `CREATE USER`,
> lire `pg_shadow`. Si l'API est compromise (SQL injection, fuite du mot de passe via un secret
> mal configuré), l'attaquant hérite de ces super-pouvoirs. Un user `rag_app` restreint à
> `SELECT/INSERT/UPDATE/DELETE` sur le schéma `public` **borne le blast radius**. Les migrations
> (Alembic) doivent tourner avec un **autre** user privilégié, séparé de l'app.

---
type: single
timer: 25
difficulty: medium
tags: [cloud-sql, cloud-run, connexion]
---

## DSN SQLAlchemy correct via Cloud SQL Connector

Tu connectes ton Cloud Run à Cloud SQL via le Connector intégré (`--add-cloudsql-instances=...`).
Quel **DSN SQLAlchemy** est correct pour `asyncpg` ?

- [ ] `postgresql+asyncpg://rag_app:pwd@127.0.0.1:5432/rag`
- [ ] `postgresql+asyncpg://rag_app:pwd@cloudsql.googleapis.com/rag`
- [x] `postgresql+asyncpg://rag_app:pwd@/rag?host=/cloudsql/simplon-rag-prod:europe-west1:rag-db`
- [ ] `postgresql+asyncpg://rag_app:pwd@/cloudsql/simplon-rag-prod:europe-west1:rag-db/rag`

> Le Cloud SQL Connector intégré expose un **socket Unix** dans `/cloudsql/<instance-connection-name>`.
> La syntaxe SQLAlchemy correcte est `postgresql+asyncpg://user:pwd@/dbname?host=/cloudsql/<icn>` —
> note le `@/` (host vide), le nom de la base après le `/`, puis `?host=...` pour pointer vers le
> socket. Le DSN avec `127.0.0.1:5432` est celui du Cloud SQL **Auth Proxy en local** (dev), pas du
> Connector. `cloudsql.googleapis.com` n'est pas un endpoint valide.

---
type: single
timer: 20
difficulty: easy
tags: [gcs, storage]
---

## Quel stockage GCP pour un corpus de 200 PDFs ?

- [ ] Persistent Disk (block storage) attaché à une VM Compute Engine
- [ ] Filestore (file storage / NFS) monté sur le Cloud Run
- [x] Cloud Storage / GCS (object storage), équivalent S3 chez AWS
- [ ] Cloud SQL avec une colonne `BYTEA` par fichier PDF

> Un corpus de fichiers immuables (PDF, images, modèles, backups) est l'archétype du cas d'usage
> **stockage objet** : **GCS**, équivalent S3 (AWS) ou Blob Storage (Azure). C'est **plat** (pas de
> vrais dossiers — juste des clés), **immuable** par défaut, scalable jusqu'aux pétaoctets. Le
> **bloc** sert de disque pour une VM/BDD ; le **fichier** (NFS) sert au partage multi-host stateful ;
> stocker des PDFs dans une colonne `BYTEA` est un anti-pattern (gonfle la base, complique les backups,
> dégrade les requêtes).

---
type: single
timer: 22
difficulty: medium
tags: [gcs, finops]
---

## Coldline + suppression à J+10 : que paies-tu ?

Tu charges un PDF en classe **Coldline** dans un bucket GCS, puis tu le supprimes au bout de
**10 jours**. Que paies-tu ?

- [ ] Rien — le stockage est facturé uniquement après les 90 jours de rétention minimum
- [x] **90 jours de stockage Coldline** quand même — c'est la **rétention minimum facturée** de la classe
- [ ] 10 jours Coldline + 80 jours Archive par rétrogradation automatique
- [ ] 10 jours de stockage Coldline + des frais de suppression anticipée fixes (1 $)

> Les classes **Nearline / Coldline / Archive** imposent une **rétention minimum facturée**
> (respectivement 30 j / 90 j / 365 j) : si tu supprimes un objet avant la fin de cette période,
> **tu paies quand même la durée minimum**. Plus, chaque **lecture** est facturée en sus
> (≈ 0,01 $/Go pour Coldline). Conséquence : Coldline n'est pertinent **que** pour des données
> réellement froides (< 1 accès/trimestre). Pour un corpus actif relu fréquemment → **Standard**.

---
type: single
timer: 30
difficulty: hard
tags: [gcs, security]
---

## Empêcher la fuite n°1 : bucket ouvert au public par mégarde

Top 1 des fuites de données depuis 2018 = bucket S3/GCS ouvert au public par mégarde (Capital One,
Accenture, FedEx…). Quelle **combinaison** de paramètres GCS empêche ce scénario **par construction**
sur un bucket privé d'entreprise ?

- [ ] Uniquement `--uniform-bucket-level-access` à la création
- [ ] Uniquement choisir une région européenne (`europe-west1` ou `europe-west9`)
- [x] **`--uniform-bucket-level-access`** + **`publicAccessPrevention: enforced`** combinés
- [ ] Désactiver l'API `storage.googleapis.com` au niveau du projet

> Les deux paramètres sont **complémentaires**. **`--uniform-bucket-level-access`** force une seule
> source de vérité IAM (au niveau du bucket) au lieu d'ACL par objet (legacy, source de drift).
> **`publicAccessPrevention: enforced`** rejette **explicitement** toute tentative d'attribuer un
> rôle à `allUsers` ou `allAuthenticatedUsers` — même si un opérateur clique au mauvais endroit.
> La région n'a aucun rapport avec la publicité d'accès. Désactiver l'API casserait toutes les
> applications du projet.

---
type: multiple
timer: 25
difficulty: medium
tags: [iam, security, brief]
---

## Rôles IAM minimaux de la SA `rag-api` pour le brief

Pour le brief Simplon (Cloud Run `rag-api` → Cloud SQL + GCS corpus + Secret Manager + logs),
quels rôles IAM la **SA dédiée `rag-api`** doit-elle avoir en suivant le principle of least privilege ?

- [x] `roles/cloudsql.client` (au niveau du projet)
- [x] `roles/secretmanager.secretAccessor` (au niveau du projet, ou par secret)
- [x] `roles/storage.objectViewer` (sur le bucket corpus uniquement)
- [ ] `roles/owner` (au niveau du projet) « pour simplifier le débogage »

> Les **3 rôles predefined** ci-dessus couvrent les besoins du service (auxquels on ajoute en pratique
> `roles/logging.logWriter`). **`roles/owner` est un rôle « basic » à proscrire** sur une SA applicative :
> il donne la capacité de **supprimer le projet**, **s'auto-attribuer d'autres rôles**
> (escalade de privilèges), **modifier l'IAM**, etc. — bombe à retardement en cas de compromission.
> La SA Compute par défaut a `roles/editor` héritée d'avant 2017 : c'est précisément pour ça qu'on
> crée **une SA dédiée par service**.

---
type: single
timer: 25
difficulty: medium
tags: [iam, wif, security, cicd]
---

## WIF vs clé JSON pour GitHub Actions → GCP

Pourquoi le brief impose-t-il **Workload Identity Federation** (WIF) plutôt qu'une **clé JSON**
de service account pour l'authentification GitHub Actions → GCP ?

- [ ] WIF est plus rapide à configurer que la clé JSON (1 commande au lieu de plusieurs)
- [x] **Aucun secret au repos** : échange OIDC → token GCP **court (1 h)**, filtrable repo/branche, auditable
- [ ] WIF est obligatoire depuis la version `gcloud` 500.0 publiée fin 2025
- [ ] WIF permet d'éviter d'activer les APIs GCP côté projet cible

> Une **clé JSON** committée 1 h sur un repo public est compromise — les bots GitHub scannent les
> nouveaux commits en **secondes**. Et même bien stockée en `secrets` GitHub, elle reste un secret
> long-lived, jamais rotaté, non révocable finement. **WIF** : aucun secret au repos côté CI,
> échange OIDC à chaque run, **token court (1 h)**, granularité par `repository_owner` /
> `repository` / branche, **auditable** dans Cloud Audit Logs. WIF est plus **complexe** à mettre
> en place (pool + provider + attribute-condition + binding), pas plus rapide, et n'a aucun
> rapport avec l'activation des APIs.

---
type: single
timer: 30
difficulty: hard
tags: [iam, wif, security]
---

## WIF GitHub sans `--attribute-condition` : quel risque ?

Tu crées un provider WIF GitHub sur ton projet GCP **sans `--attribute-condition`**. Quel risque
concret ouvres-tu ?

- [ ] Aucun risque — l'`attribute-condition` est purement informatif, utilisé uniquement pour les logs
- [ ] Le provider est bloqué à la création depuis 2023 : la commande échoue tant qu'aucune condition n'est précisée
- [x] **N'importe quel repo GitHub** peut s'authentifier sur ton provider et **impersonner ta SA cible**
- [ ] L'`attribute-condition` mappe les claims OIDC vers des rôles IAM ; sans elle, GCP refuse l'échange

> GitHub Actions émet des **JWT OIDC signés** pour **tous** les workflows GitHub du monde — pas
> seulement les tiens. Si ton provider WIF accepte n'importe quel JWT issu de
> `token.actions.githubusercontent.com`, **n'importe quel attaquant qui crée un repo GitHub** peut
> générer un token, l'échanger contre un token GCP via ton provider et impersonner la SA cible.
> **`--attribute-condition`** filtre côté GCP (`assertion.repository_owner == 'maxime-lenne'`),
> en plus du binding `iam.workloadIdentityUser` sur la SA. Sans cette condition, ton WIF est
> aussi dangereux qu'une clé JSON publique.
