# Cloud Platforms Overview — Plan

**Target questions:** 20 (pool ; 15 affichées par session via `max-questions: 15`)
**Estimated duration:** ~375 s (~6 min 15 s) par session de 15 questions
**Language:** Français
**Difficulty mix:** 0 % easy, 50 % medium, 50 % hard
**Question types:** ~80 % single (16) / ~20 % multiple (4)
**Style:** Questions scénarios + pièges (anti-patterns, idées reçues, near-misses)

---

## Sources Used

- `01-concepts-cloud.md` — Cours long format : NIST, XaaS, modèles de déploiement, shared responsibility, FinOps light, vocabulaire (région/zone/SLA/SLO), exercices RAG.
- `02-concepts-cloud.md` — Slides Slidev : table XaaS condensée, comparatif hyperscalers 2026, équivalents AWS / GCP / Azure, paysage souverain France 2026 (OVH, Outscale, NumSpot, Bleu, S3NS / PREMI3NS), IaC déclaratif/impératif, GitOps, patterns d'archi (3-tiers, event-driven, RAG).
- `quiz-01-concepts-cloud.md` — Quiz Simplon de référence (à NE PAS dupliquer ; sert d'inspiration de style et de barre de difficulté minimale).
- _Pas de recherche web nécessaire — couverture suffisante dans les sources locales._

---

## Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| easy       | 0     | 0 %        |
| medium     | 10    | 50 %       |
| hard       | 10    | 50 %       |

---

## Tag Coverage

| Tag                    | Questions                              |
|------------------------|----------------------------------------|
| XaaS                   | Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q11        |
| shared-responsibility  | Q8                                     |
| finops                 | Q9, Q10, Q11                           |
| iac                    | Q12, Q13, Q14, Q15                     |
| sovereign-fr           | Q16, Q17, Q18, Q19                     |
| vocab                  | Q20                                    |
| cloud (transversal)    | toutes                                 |

---

## Questions

### Q1 — Reconnaître une caractéristique NIST factice

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [XaaS, nist]
- **Source:** `01-concepts-cloud.md` §1 — 5 caractéristiques NIST SP 800-145
- **Key concept:** Identifier la fausse caractéristique parmi un mix on-demand / broad network / multi-tenant + un piège plausible (« High availability garantie » ou « Stockage perpétuel »).
- **Notes:** Distracteurs marketing crédibles. La bonne réponse est la caractéristique NIST manquante (ex. : « measured service »). Évite simple recopie du quiz de référence Q1.

### Q2 — Qui patche l'OS en IaaS vs CaaS

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [XaaS, shared-responsibility]
- **Source:** `01-concepts-cloud.md` §2 table XaaS + §4 shared responsibility
- **Key concept:** En **IaaS**, c'est toi qui patches l'OS ; en CaaS c'est le provider. Question formulée à l'inverse du quiz de référence (qui demande pour CaaS).
- **Notes:** Distracteurs : « Toujours le provider », « Partagé selon SLA », « Personne, OS supprimé ».

### Q3 — Vraie différence PaaS / CaaS

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [XaaS]
- **Source:** `01-concepts-cloud.md` §2 + `02-concepts-cloud.md` table XaaS
- **Key concept:** En PaaS, runtime imposé (App Engine = Python/Node/Go listés) ; en CaaS, tu apportes ton image avec **n'importe quel runtime / binaire**. Différence = **liberté du runtime**, pas le prix ni la vitesse de scale.
- **Notes:** Reformuler du quiz de référence sans recopier ; distracteurs : « CaaS supporte plus de langages » (faux, c'est ton image), « PaaS scale plus vite » (faux), « CaaS ne fait pas de HTTPS » (faux).

### Q4 — Quand FaaS est le mauvais choix

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [XaaS, finops]
- **Source:** `01-concepts-cloud.md` §2 « Comment choisir ? » + grille Dev IA
- **Key concept:** FaaS pénalisée par : cold-start sur gros modèle, jobs > timeout (~9 min Cloud Functions), workloads stateful continus. Question : « Pour LEQUEL de ces usages FaaS est le pire choix ? ».
- **Notes:** Distracteurs : webhook ponctuel (bon), traitement ETL court (bon), notification Pub/Sub (bon). La bonne réponse : inférence d'un LLM 13B self-hosté (cold-start + mémoire).

### Q5 — Piège du scale-to-zero pour un service IA

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [XaaS, finops]
- **Source:** `01-concepts-cloud.md` Exercice 3 + grille Dev IA
- **Key concept:** Le scale-to-zero a un revers : **cold-start long** quand le modèle se recharge en RAM/VRAM. Parades = `min-instances ≥ 1`, lazy-load par feature, modèle externalisé en SaaS (Mistral API), CPU/GPU pré-chauffée.
- **Notes:** Distracteurs incluant idées fausses : « Le scale-to-zero perd les données » (faux, c'est stateless), « Cela double la facture » (faux, c'est l'inverse).

### Q6 — Quelles affirmations décrivent vraiment le « pay-as-you-go »

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [XaaS, finops]
- **Source:** `01-concepts-cloud.md` §1 + §5
- **Key concept:** Sélectionner les 2-3 affirmations vraies parmi : facturation à la consommation (vrai), pas d'engagement (vrai), facturable même à 0 trafic si min-instances (vrai — piège pédagogique), gratuit jusqu'à un seuil (faux universellement), prévisibilité parfaite du coût (faux).
- **Notes:** Multi-select avec exactement 3 bonnes réponses sur 4. Phraser « sélectionnez 3 ».

### Q7 — DBaaS : ce qui RESTE à ta charge

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [XaaS, shared-responsibility]
- **Source:** `01-concepts-cloud.md` §2 table XaaS + §4 shared responsibility
- **Key concept:** En DBaaS (Cloud SQL, RDS) tu gardes : **schéma, requêtes, index, données, IAM**. Le provider fournit : engine, OS, backups automatiques, HA. Question : « Sur Cloud SQL, lequel est ENCORE de ta responsabilité ? ».
- **Notes:** Distracteurs : patch du moteur Postgres (faux, provider), réplication HA (faux, provider), backups automatiques (faux, provider). Bonne réponse : la conception du schéma / la performance des requêtes.

### Q8 — Réseau / firewall en CaaS : qui le gère ?

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [shared-responsibility, XaaS]
- **Source:** `02-concepts-cloud.md` slide « Shared responsibility model » (colonne CaaS/PaaS)
- **Key concept:** En CaaS, le réseau est **partagé** : provider gère le VPC sous-jacent et la sécurité physique réseau ; tu gères les règles ingress/egress, l'authentification, l'IAM Cloud Run, le mTLS. Piège : ce n'est ni « tout toi » (IaaS) ni « tout provider » (SaaS).
- **Notes:** Distracteurs : 100 % provider, 100 % toi, « pas de réseau en CaaS ». La bonne : partagé.

### Q9 — Scénario qui déclenche des coûts d'egress

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [finops]
- **Source:** `01-concepts-cloud.md` §5 « Que regarder pour optimiser ? » + `02-concepts-cloud.md` slide FinOps
- **Key concept:** Egress = sortie réseau payante. Le piège archi classique = **trafic inter-régions** (ex. Cloud Run `europe-west1` qui lit GCS `us-central1`). Intra-zone et intra-région = quasi gratuit.
- **Notes:** Distracteurs : « Upload de fichiers depuis l'utilisateur » (faux = ingress gratuit), « Backup intra-zone » (faux, gratuit), « Lecture d'un Secret Manager dans la même région » (faux, gratuit). Bonne réponse : lecture inter-régions.

### Q10 — Multi-select : combinaisons FinOps qui réduisent vraiment la facture

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [finops]
- **Source:** `01-concepts-cloud.md` §5 + `02-concepts-cloud.md` slide FinOps
- **Key concept:** Sélectionner 3 leviers réels parmi : engagement 3 ans (vrai, −20 à −60 %), spot/preemptible pour batch (vrai, −60 à −90 %), scale-to-zero sur services à trafic bursté (vrai), « tout passer en multi-cloud » (faux — surcoût opérationnel), « monter `min-instances`  pour anticiper » (faux — augmente la facture).
- **Notes:** Multi-select 3 bonnes / 4 (la 4ᵉ option fausse sert de piège). Phraser « sélectionnez 3 ».

### Q11 — Spot / preemptible : pour quel usage ?

- **Type:** medium
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [XaaS, finops]
- **Source:** `01-concepts-cloud.md` §5 + `02-concepts-cloud.md` slide FinOps
- **Key concept:** Spot = capacité résiliable, **uniquement pour jobs batchables** avec checkpoint. Mauvais usage : API utilisateur, base de données, frontend.
- **Notes:** Distracteurs : « API REST publique en prod » (faux), « Base Postgres primaire » (faux), « Frontend Streamlit pour démo » (faux). Bonne : entraînement batch nocturne avec checkpoints.

### Q12 — Reconnaître IaC déclaratif vs impératif

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [iac]
- **Source:** `02-concepts-cloud.md` slide « IaC en 1 slide »
- **Key concept:** Présenter 2 extraits courts (HCL Terraform vs `gcloud compute ... create`) et demander lequel est **déclaratif**. Piège : un YAML Ansible playbook (apparence déclarative mais comportement impératif via tâches séquentielles).
- **Notes:** Choisir l'extrait Terraform comme bonne réponse. Garder les 4 choix homogènes (tous des blocs de 3 lignes formatés `code`).

### Q13 — Multi-select : vrais bénéfices du GitOps

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [iac]
- **Source:** `01-concepts-cloud.md` §6 (vocabulaire) + `02-concepts-cloud.md` slide IaC / GitOps
- **Key concept:** 3 vrais bénéfices à sélectionner : traçabilité Git, revue par PR, rollback `git revert`. Distracteur : « Pas besoin de tests automatiques » (faux idéologique).
- **Notes:** Reformuler vs quiz de référence Q9 (ne pas dupliquer les mêmes 5 items). Ajouter 1 distracteur nouveau : « Supprime le besoin d'un fichier de state » (faux).

### Q14 — Ansible vs Terraform vs Crossplane vs Pulumi

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [iac]
- **Source:** `02-concepts-cloud.md` slide « IaC en 1 slide »
- **Key concept:** Identifier l'outil **principalement de config management impératif** (Ansible). Piège : Crossplane (déclaratif K8s YAML), Pulumi (déclaratif TS/Python), Terraform (déclaratif HCL).
- **Notes:** Reformulation du quiz de référence Q15 mais avec choix légèrement différents : remplacer 1 distracteur (Crossplane) par CDK pour varier.

### Q15 — Bénéfice principal de l'immutable infrastructure

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [iac]
- **Source:** Cours + culture DevOps (mentionné implicitement via IaC déclaratif et rollback)
- **Key concept:** Pas de « snowflake servers » + rollback trivial = retour à une image précédente. Pièges : « plus rapide » (faux universellement), « moins cher » (faux), « fonctionne sans conteneurs » (faux).
- **Notes:** Reformuler le quiz référence Q6 en l'adaptant au contexte 2026 (mentionner image OCI ou AMI).

### Q16 — Souverain vs européen : la vraie distinction

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [sovereign-fr]
- **Source:** `02-concepts-cloud.md` slide « Cloud souverain France 2026 » + commentaires « souverain ≠ européen »
- **Key concept:** **Souverain** = qualification ANSSI (SecNumCloud) ou isolation juridique vs Cloud Act. **Européen** = serveurs en UE + conformité RGPD seulement. AWS `eu-west-3` (Paris) est européen mais PAS souverain (Cloud Act).
- **Notes:** Distracteurs : « Souverain = serveurs en France » (incomplet), « Européen = RGPD-compliant uniquement » (réducteur), « Identique » (faux).

### Q17 — Multi-select : qui est SecNumCloud 3.2 qualifié début 2026 ?

- **Type:** multiple
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [sovereign-fr]
- **Source:** `02-concepts-cloud.md` slide « Cloud souverain France 2026 »
- **Key concept:** Qualifiés en mars 2026 : **OVHcloud, Outscale, NumSpot** (3 bonnes réponses). Distracteur principal : **Bleu** ou **S3NS** (en cours, pas encore qualifié à la date du cours).
- **Notes:** Phraser « sélectionnez 3 ». Bien expliquer dans le `>` que Bleu/S3NS sont des « cloud de confiance » distincts, en cours d'agrément.

### Q18 — Portée du Cloud Act

- **Type:** single
- **Difficulty:** hard
- **Timer:** 28s
- **Tags:** [sovereign-fr]
- **Source:** `01-concepts-cloud.md` §3 ⚖️ note RGPD/Cloud Act + `02-concepts-cloud.md` slide modèles de déploiement
- **Key concept:** Le Cloud Act s'applique à tout fournisseur **soumis au droit américain**, même pour des données stockées en région européenne. Piège : « seulement si les serveurs sont aux USA » (faux).
- **Notes:** Distracteurs : « Uniquement données chiffrées » (faux), « Seulement secteur public US » (faux), « Annulé par le RGPD » (faux). Bonne : tous fournisseurs US, indépendamment de la région physique des serveurs.

### Q19 — Bleu vs S3NS : qui s'appuie sur quel hyperscaler

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [sovereign-fr]
- **Source:** `02-concepts-cloud.md` slide « Cloud souverain France 2026 »
- **Key concept:** **Bleu** = Orange + Capgemini sur **Azure**. **S3NS / PREMI3NS** = Thales sur **GCP**. Sur AWS, pas d'équivalent « cloud de confiance » FR à fin 2025.
- **Notes:** Question « Quel énoncé est CORRECT ? » avec 4 paires (provider × hyperscaler). 3 inversions / erreurs + 1 bonne.

### Q20 — SLA vs SLO vs SLI

- **Type:** single
- **Difficulty:** medium
- **Timer:** 22s
- **Tags:** [vocab]
- **Source:** `01-concepts-cloud.md` §6 vocabulaire + `02-concepts-cloud.md` slide vocabulaire
- **Key concept:** **SLA** = contrat client (engagement chiffré du provider, ex. Cloud Run 99,95 %). **SLO** = objectif interne, **plus strict** que le SLA. **SLI** = indicateur mesuré.
- **Notes:** Piège classique : « Le SLO est moins strict que le SLA » (faux, c'est l'inverse). Distracteurs : « SLA = ton objectif interne », « SLI = engagement contractuel ».

---

## Review Checklist

- [ ] Questions cover all key topics from sources
- [x] Difficulty distribution matches target (10 medium + 10 hard)
- [ ] No duplicate or overly similar questions (vs `quiz-01-concepts-cloud.md`)
- [x] Tags are consistent and meaningful
- [x] Timer values are realistic for question complexity (22 s medium, 28–30 s hard)
- [x] Mix of single (16) and multiple (4) — 80 / 20

---

## Notes pour la génération

1. **Langue** : tout en français — questions, choix, explications.
2. **4 choix par question** — règle UI dure (grille 2×2).
3. **Multi-select** : Q6, Q10, Q13, Q17 → toujours `sélectionnez 3` (≤ 3 correctes / 4).
4. **Homogénéité visuelle** : pas de **gras** / `code` / parenthèses uniquement sur la bonne réponse — appliquer le même style aux 4 choix de chaque question.
5. **Ne PAS recopier** les questions du quiz de référence `quiz-01-concepts-cloud.md` (Q1, Q2, Q3, Q4, Q6, Q7, Q8, Q9, Q10, Q11, Q12, Q15) — reformuler avec un angle nouveau et incorporer 1 distracteur original.
6. **Trick distractors** : intégrer dans presque chaque question une idée reçue plausible (« multi-cloud = hybride », « scale-to-zero = perte de données », « SLO ≤ SLA »).
7. **Explications** : bloc `>` obligatoire à la fin de chaque question, qui justifie la bonne réponse ET démonte le piège principal.

---

_Plan created: 2026-06-08_
_Ready for quiz generation: [ ]_
