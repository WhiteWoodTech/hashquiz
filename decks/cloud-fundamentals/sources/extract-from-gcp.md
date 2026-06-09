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

## Pourquoi un user dédié plutôt que le user `postgres` ?

- [ ] Parce que `postgres` est plus lent — Cloud SQL applique un throttling sur ce user
- [ ] Parce que `postgres` ne peut pas utiliser l'extension pgvector
- [x] Principle of least privilege — borner l'app à `SELECT/INSERT/UPDATE/DELETE` réduit le blast radius
- [ ] Par convention historique des tutoriels Postgres, sans impact réel

> `postgres` est **superuser** : il peut tout — `DROP DATABASE`, `CREATE EXTENSION`, `CREATE USER`,
> lire `pg_shadow`. Si l'API est compromise (SQL injection, fuite du mot de passe via un secret
> mal configuré), l'attaquant hérite de ces super-pouvoirs. Un user dédié restreint à
> `SELECT/INSERT/UPDATE/DELETE` sur le schéma `public` **borne le blast radius**. Les migrations
> (Alembic) doivent tourner avec un **autre** user privilégié, séparé de l'app.
