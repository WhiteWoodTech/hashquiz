---
title: Cloud Platforms Overview
description: >
  Couvre les fondamentaux du cloud computing (IaaS / PaaS / SaaS, régions, zones de
  disponibilité) et identifie quels fournisseurs proposent quels services.
theme: default
author: Maxime Lenne
tags: [cloud, devops, infrastructure, XaaS]
max-questions: 15
target-difficulty: hard
---

---
type: single
timer: 22
difficulty: medium
tags: [xaas, nist]
---

## Reconnaître l'intrus parmi les caractéristiques NIST du cloud

Parmi les caractéristiques suivantes, laquelle ne fait **pas** partie des cinq critères
essentiels du cloud selon la définition **NIST SP 800-145** ?

- [ ] On-demand self-service
- [ ] Resource pooling
- [ ] Measured service
- [x] Self-healing infrastructure

> Les **cinq caractéristiques NIST** sont **on-demand self-service**, **broad network access**,
> **resource pooling**, **rapid elasticity** et **measured service**. Le terme
> **self-healing infrastructure** vient du vocabulaire SRE / fiabilité — il décrit un
> comportement souhaitable mais ne fait **pas partie** de la définition NIST. Si un fournisseur
> ne respecte pas les cinq critères NIST, ce n'est techniquement pas du cloud — c'est
> de l'**hébergement classique** déguisé.

---
type: single
timer: 22
difficulty: medium
tags: [xaas, shared-responsibility]
---

## Patcher l'OS d'une VM Compute Engine : qui s'en occupe ?

Sur une machine virtuelle **IaaS** type Compute Engine (Linux ou Windows),
qui est responsable d'appliquer les patchs de sécurité de l'OS invité ?

- [x] Toi, l'utilisateur du service
- [ ] Le fournisseur, dans tous les cas
- [ ] Le fournisseur, sauf sur Windows Server
- [ ] Personne, l'OS de l'instance est immuable

> En **IaaS**, le fournisseur gère uniquement le **hardware** et l'**hyperviseur**. Tout ce qui
> est au-dessus — OS, runtime, middleware, application, données — reste **à ta charge**.
> Le contraste est fort avec le CaaS (Cloud Run, Fargate) où le provider gère l'OS et le
> runtime conteneur. Le shared responsibility **déplace** la responsabilité du bas vers le
> haut au fur et à mesure que tu remontes la stack XaaS — il ne la fait jamais disparaître.

---
type: single
timer: 28
difficulty: hard
tags: [xaas]
---

## PaaS vs CaaS : quelle est la vraie différence ?

Au-delà des effets marketing, qu'est-ce qui distingue fondamentalement un service
**PaaS** (App Engine, Heroku) d'un service **CaaS** (Cloud Run, Fargate) ?

- [ ] Le PaaS scale plus vite que le CaaS sur les pics de trafic
- [ ] Le CaaS coûte systématiquement moins cher que le PaaS
- [x] Le PaaS impose un runtime, le CaaS exécute ton image de conteneur
- [ ] Le PaaS ne supporte que les langages interprétés standards

> En **PaaS**, le provider impose la pile runtime + middleware : tu dois rester dans la liste
> des langages et versions supportés (Python 3.x, Node 20, Go 1.x…). En **CaaS**, tu construis
> ton **image OCI** avec le runtime, les binaires natifs et les dépendances de ton choix —
> le provider ne gère que le node sous-jacent et le scheduling. C'est cette **liberté du
> runtime** qui distingue les deux, pas le prix (variable selon la charge) ni la vitesse de
> scale (souvent similaire).

---
type: single
timer: 28
difficulty: hard
tags: [xaas, finops]
---

## Pour lequel de ces usages le FaaS est-il le pire choix ?

Tu compares plusieurs candidats à un déploiement sur **FaaS** (Cloud Functions ou Lambda).
Pour lequel le FaaS est-il le pire choix ?

- [ ] Recevoir un webhook GitHub pour déclencher un build
- [ ] Lancer un job ETL court de deux minutes la nuit
- [ ] Envoyer une notification Slack depuis un topic Pub/Sub
- [x] Servir un LLM 13B self-hosté avec une faible latence

> Le **FaaS** est conçu pour des traitements **courts**, **stateless** et **événementiels** :
> webhooks, ETL batchables, notifications. Un **LLM 13B self-hosté** combine plusieurs
> anti-patterns FaaS : **cold-start** de plusieurs minutes pour charger les poids en VRAM,
> besoins mémoire / GPU au-delà des quotas FaaS, requêtes qui peuvent dépasser le timeout
> (~9 min sur Cloud Functions). Pour ce cas, on bascule sur du **CaaS GPU** avec
> `min-instances ≥ 1` ou de l'**IaaS GPU** dédié.

---
type: single
timer: 30
difficulty: hard
tags: [xaas, finops]
---

## Cold-start d'un modèle Whisper sur Cloud Run

Un service Cloud Run sert un modèle Whisper qui prend 25 secondes à charger en mémoire.
Quelle parade est la plus efficace pour éviter une latence ressentie par le premier
utilisateur d'une session inactive ?

- [ ] Augmenter la mémoire allouée au container Cloud Run
- [x] Garder une instance toujours active via un minimum à un
- [ ] Stocker les poids du modèle dans Cloud Storage Standard
- [ ] Activer le multi-cloud pour répartir la charge utilisateur

> Le **scale-to-zero** de Cloud Run libère les instances dès que le trafic disparaît — mais
> le premier utilisateur paye alors le **cold-start** complet (démarrage container + chargement
> modèle ≈ 25 s). Configurer un **minimum d'instances à un** maintient le modèle déjà chargé
> en mémoire, au prix d'une instance facturée 24/7 (~30–50 €/mois). Augmenter la mémoire ne
> raccourcit pas le chargement initial ; déplacer les poids en GCS ne fait que déplacer le
> téléchargement ; le multi-cloud n'apporte rien sur ce sujet et complique la facturation.

---
type: multiple
timer: 25
difficulty: medium
tags: [xaas, finops]
---

## Affirmations correctes sur le pay-as-you-go

Parmi ces affirmations sur le modèle **pay-as-you-go**, sélectionnez les 3 affirmations
correctes.

- [x] La facturation s'aligne sur la consommation à la seconde près
- [x] Aucun engagement de durée n'est requis pour démarrer le service
- [x] Une instance peut coûter même sans trafic si un minimum est imposé
- [ ] Le service reste entièrement gratuit en dessous d'un seuil universel

> Le **pay-as-you-go** facture à la **consommation réelle** (à la seconde, au Go transféré,
> à la requête) et n'impose **aucun engagement** de durée. Attention au piège pédagogique :
> dès que tu configures `min-instances > 0` ou que tu laisses une VM allumée, tu **paies
> même à zéro trafic**. Le « gratuit en dessous d'un seuil universel » est faux —
> chaque service a sa propre grille free tier, limitée dans le temps ou par produit, et la
> plupart des ressources n'ont pas de palier gratuit du tout.

---
type: single
timer: 22
difficulty: medium
tags: [xaas, shared-responsibility]
---

## Ce qui reste à ta charge sur Cloud SQL

Tu héberges ta base Postgres sur **Cloud SQL** (modèle DBaaS).
Lequel de ces éléments reste à TA charge ?

- [ ] Appliquer les patchs mineurs du moteur Postgres
- [ ] Configurer la réplication haute disponibilité multi-zone
- [ ] Planifier et exécuter les backups automatiques quotidiens
- [x] Concevoir le schéma et choisir les index des requêtes

> En **DBaaS**, le provider gère le **moteur**, le **patching**, les **backups automatiques**,
> la **réplication HA** multi-zone et le **hardware**. Ce qui reste à ta charge : le **schéma**,
> les **requêtes**, les **index**, les **données métier** et les **accès IAM**. C'est l'illustration
> directe du shared responsibility model : la charge opérationnelle remonte vers le provider,
> mais la **conception logique** ne se délègue jamais — Cloud SQL ne devine pas la sémantique
> métier ni le plan d'exécution optimal.

---
type: single
timer: 28
difficulty: hard
tags: [shared-responsibility, xaas]
---

## Réseau et firewall sur Cloud Run : qui configure quoi ?

Sur un service Cloud Run (CaaS), qui est responsable de la configuration du firewall
réseau et des règles d'accès au service ?

- [ ] Entièrement le provider, comme dans un modèle SaaS
- [ ] Entièrement toi, comme dans un modèle IaaS
- [x] Partagé : provider sur le VPC, toi sur les règles d'accès
- [ ] Personne, le modèle CaaS n'expose pas de couche réseau

> En **CaaS**, le réseau est explicitement **partagé**. Le provider opère le **VPC** sous-jacent,
> les load-balancers managés et la sécurité physique du réseau ; toi tu configures les
> **ingress controls** (qui peut appeler le service), l'**IAM Cloud Run**, le **mTLS** et les
> contrôles applicatifs. Ce n'est ni IaaS (tout toi) ni SaaS (tout provider). Le piège
> classique : laisser un service en `--allow-unauthenticated` par défaut et exposer un
> endpoint sensible sans le savoir.

---
type: single
timer: 28
difficulty: hard
tags: [finops]
---

## Quel scénario déclenche une facture d'egress notable ?

Parmi ces scénarios, lequel déclenche une facturation **egress** notable sur GCP ?

- [ ] Un utilisateur upload un PDF de 50 Mo vers Cloud Storage
- [ ] Un Cloud Run en région europe-west1 lit un secret local
- [x] Un Cloud Run en région europe-west1 lit un bucket dans us-central1
- [ ] Un snapshot de backup reste dans la même zone que sa VM

> L'**egress** = trafic réseau **sortant** vers une autre région, un autre cloud ou Internet.
> Le trafic **intra-zone** et **intra-région** est quasi gratuit. Le trafic **inter-régions**
> coûte ~0,02 $/Go en Europe et davantage vers les États-Unis — une appli en `europe-west1`
> qui lit un bucket en `us-central1` peut facturer plusieurs centaines d'euros par mois sur
> un corpus moyen. L'**ingress** (entrée de trafic) est **toujours gratuit**, d'où l'asymétrie
> de la facture.

---
type: multiple
timer: 25
difficulty: medium
tags: [finops]
---

## Leviers FinOps qui réduisent vraiment la facture

Parmi ces leviers, lesquels réduisent **effectivement** la facture cloud ?
Sélectionnez les 3 réponses correctes.

- [x] Souscrire un engagement Committed Use Discount sur 3 ans
- [x] Exécuter les jobs batchables sur des instances spot ou preemptible
- [x] Activer le scale-to-zero sur les services à trafic en pic
- [ ] Augmenter le minimum d'instances pour anticiper la charge

> Trois leviers FinOps efficaces : (1) **engagement 1–3 ans** = **−20 à −60 %** sur le compute
> et la BDD ; (2) **spot / preemptible** = **−60 à −90 %** sur les jobs batch tolérants à
> l'interruption ; (3) **scale-to-zero** = paiement nul quand aucun trafic n'arrive. À l'inverse,
> **monter `min-instances`** *augmente* la facture car tu paies une capacité réservée 24/7 —
> c'est une parade au cold-start, pas une optimisation de coût.

---
type: single
timer: 22
difficulty: medium
tags: [xaas, finops]
---

## Pour quel usage le spot ou preemptible est-il un bon choix ?

Pour lequel de ces usages le modèle **spot / preemptible** est-il un BON choix ?

- [ ] Une API REST publique en production sans tolérance à la coupure
- [ ] Une base Postgres primaire d'un système transactionnel critique
- [ ] Un frontend Streamlit utilisé en démo client en direct
- [x] Un entraînement de modèle batch nocturne avec checkpoints

> Le **spot / preemptible** offre une **réduction de 60 à 90 %** sur le prix instance, mais la
> capacité peut être **interrompue à tout moment** (préavis de 30 s à 2 min). Cas adaptés :
> **entraînements** avec checkpointing régulier, **batch ETL** redémarrable, rendering, fuzz
> testing. Cas inadaptés : tout service avec **état chaud non persistable** ou **SLA utilisateur**
> — API publique, BDD primaire, démo en live. La règle : si « être coupé toutes les 5 minutes »
> casse le service, ne pas utiliser le spot.

---
type: single
timer: 22
difficulty: medium
tags: [iac]
---

## Quel extrait illustre une approche IaC déclarative ?

Parmi ces descriptions, laquelle illustre une approche IaC **déclarative** ?

- [ ] Un script bash qui enchaîne des commandes gcloud compute create
- [x] Un fichier HCL Terraform décrivant l'état final souhaité
- [ ] Un playbook Ansible qui rejoue quatorze tâches dans un ordre fixe
- [ ] Un Dockerfile qui exécute des commandes RUN ligne après ligne

> L'IaC **déclarative** décrit **l'état final souhaité** (« je veux une VM e2-small et un
> bucket logs ») ; l'outil calcule la séquence d'actions via `plan`, puis l'applique de façon
> **idempotente** via `apply`. **Terraform / OpenTofu**, **Pulumi** et **Crossplane** sont
> déclaratifs. À l'inverse, un script bash ou un Dockerfile RUN sont **impératifs** : ils
> décrivent **le « comment »**, étape par étape, et un échec en cours laisse un état partiel.
> Ansible est techniquement déclaratif au niveau d'une tâche mais **impératif dans
> l'orchestration** des tâches.

---
type: multiple
timer: 25
difficulty: medium
tags: [iac]
---

## Vrais bénéfices du GitOps

Parmi ces affirmations sur le **GitOps**, sélectionnez les 3 vrais bénéfices.

- [x] Traçabilité complète des changements via l'historique Git
- [x] Revue par Pull Request avant tout déploiement en production
- [x] Rollback rapide en revertant un commit puis en réappliquant
- [ ] Suppression de la nécessité d'un fichier d'état Terraform

> Le **GitOps** fait de Git la **source de vérité unique** de l'infra et des applis. Les trois
> bénéfices vrais : **traçabilité** (`git log` + `git blame` indiquent qui a changé quoi),
> **revue par PR** (4-eyes avant prod), **rollback** rapide (`git revert` puis re-`apply`).
> Le **fichier d'état Terraform** reste **obligatoire** même en GitOps : il maintient le
> mapping entre la configuration et les ressources réelles. OpenTofu chiffre l'état mais ne
> le supprime pas ; Crossplane le déplace côté contrôleur K8s mais conserve un état serveur.

---
type: single
timer: 28
difficulty: hard
tags: [iac]
---

## Quel outil est principalement de la gestion de configuration impérative ?

Lequel de ces outils est principalement un outil de **gestion de configuration impérative**,
plutôt qu'un outil de **provisioning déclaratif** ?

- [ ] Terraform
- [ ] Pulumi
- [x] Ansible
- [ ] Crossplane

> **Ansible** est avant tout un outil de **gestion de configuration impérative** : il enchaîne
> des **tâches** (modules) sur des hôtes existants via SSH, dans un **ordre défini** par le
> playbook. **Terraform**, **Pulumi** et **Crossplane** sont des outils de **provisioning
> déclaratif** : tu décris l'**état final** désiré, l'outil calcule un plan idempotent puis
> l'applique. À noter : Pulumi écrit du code en TS / Python / Go mais synthétise un modèle
> déclaratif sous-jacent — la classification se fait sur le résultat appliqué, pas sur la
> syntaxe d'auteur.

---
type: single
timer: 28
difficulty: hard
tags: [iac]
---

## Bénéfice principal de l'infrastructure immuable

Quel est le bénéfice principal de l'**infrastructure immuable** par rapport à la
**mutable** ?

- [ ] Elle exécute le déploiement plus rapidement à chaque release
- [ ] Elle réduit toujours le coût d'exploitation des environnements
- [x] Elle élimine les snowflake servers et rend le rollback trivial
- [ ] Elle fonctionne sans conteneurs et sans outil d'IaC

> L'**infrastructure immuable** consiste à ne **jamais modifier** un serveur en place : on
> redéploie une **nouvelle image** versionnée (AMI, image OCI) pour chaque changement.
> Deux gains structurels : (1) plus de **snowflake servers** — chaque nœud est strictement
> identique à son image, ce qui supprime la dérive de configuration ; (2) **rollback trivial**
> = redéployer l'image N-1. La vitesse et le coût ne sont pas garantis (souvent plus lents
> qu'un `apt upgrade`), et l'approche dépend en pratique de Packer, Docker ou d'une
> plateforme orchestrant des images.

---
type: single
timer: 28
difficulty: hard
tags: [sovereign-fr]
---

## Quand peut-on parler de cloud souverain ?

Un cloud est dit **souverain** lorsqu'il :

- [ ] héberge ses serveurs physiquement en Union européenne
- [ ] respecte uniquement les exigences RGPD pour les données personnelles
- [x] est qualifié SecNumCloud ou isolé du droit extraterritorial américain
- [ ] applique exactement la même API que les hyperscalers américains

> Un cloud **souverain** garantit l'**isolation juridique** vis-à-vis du droit extraterritorial
> (Cloud Act US, lois chinoises). En France, cela passe par la **qualification SecNumCloud**
> de l'ANSSI, ou par un montage juridique dédié type « cloud de confiance ». Cela ne se
> réduit **pas** à « serveurs en UE » : **AWS Paris** (région `eu-west-3`) est en Europe mais
> reste soumis au Cloud Act, donc **européen mais non souverain**. Le RGPD ne couvre que la
> donnée personnelle, pas la juridiction sur l'opérateur.

---
type: multiple
timer: 30
difficulty: hard
tags: [sovereign-fr]
---

## Acteurs SecNumCloud 3.2 qualifiés début 2026

Parmi ces acteurs français, sélectionnez les 3 qualifiés **SecNumCloud 3.2**
début 2026.

- [x] OVHcloud
- [x] Outscale
- [x] NumSpot
- [ ] Bleu

> Les **trois acteurs SecNumCloud 3.2 qualifiés** début 2026 sont **OVHcloud** (80+ services
> managés), **Outscale** (groupe Dassault Systèmes) et **NumSpot** (consortium Docaposte +
> Dassault + Bouygues Telecom). **Bleu** (Orange + Capgemini sur Azure) et **S3NS / PREMI3NS**
> (Thales sur GCP) sont des **clouds de confiance** distincts — annoncés et en cours
> d'agrément ANSSI, mais pas encore qualifiés à cette date. Pour mémoire : le marché public
> « Nuage public » a atteint **84 M€ en 2025** (+62 % vs 2024), dont **70 %** vers des
> fournisseurs européens.

---
type: single
timer: 28
difficulty: hard
tags: [sovereign-fr]
---

## Périmètre d'application du Cloud Act

Le **Cloud Act** américain s'applique à :

- [ ] tout fournisseur dont les serveurs sont physiquement situés aux États-Unis
- [ ] tout fournisseur servant exclusivement des clients du secteur public américain
- [x] tout fournisseur soumis au droit américain, indépendamment du lieu des serveurs
- [ ] tout fournisseur traitant des données non chiffrées et non européennes

> Le **Cloud Act** (2018) autorise les autorités fédérales américaines à exiger d'un
> fournisseur **soumis au droit US** la remise des données qu'il détient, **indépendamment**
> de l'endroit où elles sont physiquement stockées. Concrètement, **AWS Frankfurt**,
> **GCP `europe-west1`** (Belgique) et **Azure France Central** restent dans le **périmètre**
> du Cloud Act. Le RGPD ne neutralise pas cette extra-territorialité (cf. arrêt Schrems II),
> d'où l'émergence des **clouds souverains** SecNumCloud et des montages « cloud de
> confiance ».

---
type: single
timer: 22
difficulty: medium
tags: [sovereign-fr]
---

## Bleu vs S3NS : sur quel hyperscaler chacun s'appuie-t-il ?

Lequel de ces énoncés sur les « clouds de confiance » français est **correct** ?

- [ ] Bleu repose sur Orange + Capgemini, construit sur GCP
- [x] Bleu repose sur Orange + Capgemini, construit sur Azure
- [ ] S3NS repose sur Thales, construit sur AWS Frankfurt
- [ ] S3NS repose sur Docaposte + Dassault, construit sur Azure

> **Bleu** est porté par **Orange + Capgemini** et s'appuie sur la pile technologique
> **Microsoft Azure**, opérée en France sous juridiction française. **S3NS / PREMI3NS** est
> porté par **Thales** (associé à Google Cloud France) et s'appuie sur **Google Cloud
> Platform**, avec une isolation juridique en cours d'agrément ANSSI. Les deux visent la
> qualification **SecNumCloud** mais ne l'avaient pas encore obtenue début 2026. À cette
> date, **aucun équivalent « cloud de confiance » FR n'existe sur AWS**.

---
type: single
timer: 22
difficulty: medium
tags: [vocab]
---

## SLA, SLO, SLI : quelle affirmation est correcte ?

Parmi ces affirmations sur **SLA**, **SLO** et **SLI**, laquelle est **correcte** ?

- [ ] Le SLA est l'objectif interne, plus laxiste que le SLO
- [x] Le SLO est l'objectif interne, plus strict que le SLA
- [ ] Le SLI est l'engagement contractuel envers le client
- [ ] Le SLA, le SLO et le SLI désignent exactement la même chose

> Le **SLA** (Service Level Agreement) est l'**engagement contractuel** chiffré du provider
> envers le client — par exemple, Cloud Run garantit **99,95 %** de disponibilité.
> Le **SLO** (Service Level Objective) est ton **objectif interne** et doit être **plus strict**
> que le SLA pour conserver une marge de manœuvre face aux imprévus. Le **SLI** (Service
> Level Indicator) est la **mesure réelle** qui alimente le suivi du SLO. Inverser SLA et
> SLO est un piège classique en entretien d'embauche SRE.
