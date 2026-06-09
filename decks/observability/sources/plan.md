# Observability — Plan

**Target questions:** 20
**Estimated duration:** 490 secondes (~8 min)
**Language:** Français
**Difficulty mix:** 30% easy (6), 50% medium (10), 20% hard (4)
**Question types:** mix — 15 single, 5 multiple

---

## Sources Used

- `01-intro.md` — Objectifs formation, programme 3 jours, scénario accroche
- `02-module-1-pourquoi.md` — Monitoring vs observabilité, 3 piliers, RED/USE/Golden Signals, niveaux de maturité, spécificité IA
- `03-module-2-logging.md` — Logging structuré, 5 niveaux, 6 champs essentiels, RGPD/PII, pipeline 4 étapes, anti-patterns
- `07-module-3-prometheus.md` — Modèle pull, 4 types de métriques, cardinalité, labels interdits, conventions nommage, PromQL
- `08-module-4-grafana.md` — Datasource/panel/dashboard, RED+USE, hiérarchie drill-down, recording rules, anti-patterns
- `10-module-5-alerting.md` — Symptom-first, anatomie règle Prometheus, Alertmanager 5 mécanismes, SLO/error budget, burn rate, Watchdog
- `11-module-6-apm.md` — APM vs monitoring infra, trace/span/trace_id, W3C Trace Context, sampling head vs tail
- `05-module-9-llm-langfuse.md` — LLM observability, coûts tokens, Langfuse, scoring, évaluation continue

---

## Difficulty Distribution

| Difficulty | Count | Percentage |
|------------|-------|------------|
| easy       | 6     | 30 %       |
| medium     | 10    | 50 %       |
| hard       | 4     | 20 %       |

---

## Tag Coverage

| Tag | Questions |
|-----|-----------|
| observabilité | Q1, Q2, Q3, Q4 |
| monitoring | Q1 |
| modèles-mentaux | Q3, Q4 |
| logs | Q5, Q6, Q7 |
| rgpd | Q7 |
| prometheus | Q8, Q9, Q10, Q11 |
| métriques | Q8, Q9, Q10, Q11 |
| grafana | Q12, Q13 |
| alerting | Q14, Q15, Q16 |
| slo | Q15, Q16 |
| apm | Q17, Q18 |
| traces | Q6, Q17, Q18 |
| langfuse | Q19, Q20 |
| llm | Q19, Q20 |

---

## Questions

### Q1 — Différence fondamentale monitoring vs observabilité

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [observabilité, monitoring]
- **Source:** `02-module-1-pourquoi.md` — slide "Trois mots à poser"
- **Key concept:** Le monitoring répond à des questions connues à l'avance ; l'observabilité permet de répondre à des questions imprévues
- **Notes:** 3 distracteurs plausibles (inversion des définitions, confusion avec APM)

### Q2 — Les 3 piliers de l'observabilité

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [observabilité, fondamentaux]
- **Source:** `02-module-1-pourquoi.md` — slide "Les 3 piliers"
- **Key concept:** Logs · Métriques · Traces (pas Dashboards, pas Alertes, pas APM)
- **Notes:** Distracteurs : remplacer un pilier par un outil/artefact (dashboard, alertes)

### Q3 — Quel modèle mental pour les ressources système ?

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [modèles-mentaux, observabilité]
- **Source:** `02-module-1-pourquoi.md` — slide "Modèles mentaux" + arbre de décision
- **Key concept:** USE (Utilization, Saturation, Errors) s'applique aux ressources infra (CPU, RAM, disque) ; RED aux services
- **Notes:** Distracteurs : RED, Golden Signals, APM — bonne confusion attendue car les 3 sont vus ensemble

### Q4 — Golden Signals Google SRE (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [modèles-mentaux, observabilité]
- **Source:** `02-module-1-pourquoi.md` — tableau modèles mentaux
- **Key concept:** Les 4 Golden Signals sont Latence, Trafic, Erreurs, Saturation — Duration (RED) est le distracteur
- **Notes:** Question "sélectionnez 3" sur 4 choices — 3 Golden Signals corrects + Duration (RED) comme leurre

### Q5 — Niveau de log pour une exception qui empêche une opération

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [logs]
- **Source:** `03-module-2-logging.md` — tableau "5 niveaux à respecter"
- **Key concept:** ERROR = exception qui empêche l'opération, nécessite investigation ; WARN = situation anormale gérée
- **Notes:** Confusion ERROR/WARN classique ; inclure CRITICAL et INFO comme distracteurs

### Q6 — Champ de log pour la corrélation avec les traces

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [logs, traces, corrélation]
- **Source:** `03-module-2-logging.md` — tableau "6 champs essentiels"
- **Key concept:** `trace_id` (128 bits hex) permet de retrouver la trace dans un backend comme Tempo ; `request_id` corrèle les logs d'une même requête
- **Notes:** Distracteurs : request_id (corrèle logs/logs mais pas logs/traces), service, timestamp

### Q7 — Données PII interdites en clair dans les logs (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [logs, rgpd]
- **Source:** `03-module-2-logging.md` — slide "RGPD dans les logs"
- **Key concept:** Email, IP brute, nom d'utilisateur sont des PII interdites ; latency_ms est une donnée technique autorisée
- **Notes:** Question "sélectionnez 3" — 3 PII correctes + latency_ms comme leurre ; toutes les choices doivent avoir même longueur

### Q8 — Quel type de métrique pour une queue size ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [prometheus, métriques]
- **Source:** `07-module-3-prometheus.md` — tableau "4 types de métriques"
- **Key concept:** Gauge = métrique qui monte et descend ; Counter = monotone croissant seulement
- **Notes:** Confusion Counter/Gauge classique ; inclure Histogram et Summary comme distracteurs

### Q9 — Bonnes pratiques d'utilisation d'un Counter Prometheus (sélectionnez 2)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [prometheus, métriques]
- **Source:** `07-module-3-prometheus.md` — slides Counter + statement "Ne jamais lire un counter brut"
- **Key concept:** Toujours utiliser rate()/increase(), suffixer avec _total ; ne jamais lire la valeur brute ni réinitialiser manuellement
- **Notes:** Question "sélectionnez 2" — 2 bonnes pratiques correctes + 2 anti-patterns comme leurres

### Q10 — Label interdit dans Prometheus (cardinalité explosive)

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [prometheus, cardinalité]
- **Source:** `07-module-3-prometheus.md` — slides "Cardinalité" + "Labels interdits vs autorisés"
- **Key concept:** user_id peut avoir des millions de valeurs → milliards de séries → OOM du TSDB
- **Notes:** Distracteurs : environment, service, method (tous autorisés, basse cardinalité)

### Q11 — Requête PromQL correcte pour le p95 (Histogram)

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [prometheus, promql]
- **Source:** `07-module-3-prometheus.md` — slide "Histogram · comment ça marche" + tableau PromQL essentiel
- **Key concept:** Toujours `rate()` à l'intérieur + `sum by(le)` avant `histogram_quantile()` — sans rate() le résultat est sans sens
- **Notes:** 4 choices toutes en format PromQL code — erreurs classiques : oublier rate(), oublier sum by(le), utiliser avg() à la place

### Q12 — Quel modèle de dashboard pour une API microservice ?

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [grafana, métriques]
- **Source:** `08-module-4-grafana.md` — slide "RED pour services · USE pour infra"
- **Key concept:** RED (Rate, Errors, Duration) pour les services orientés requête ; USE pour les ressources système
- **Notes:** Distracteurs : USE, Golden Signals, APM

### Q13 — Anti-patterns Grafana à éviter (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [grafana]
- **Source:** `08-module-4-grafana.md` — slide "Anti-patterns à éviter"
- **Key concept:** Dashboard 40+ panels, refresh 5s sur 12 panels, alerter depuis un dashboard sont des anti-patterns ; afficher p50 et p99 côte à côte est une bonne pratique
- **Notes:** Question "sélectionnez 3" — 3 anti-patterns corrects + 1 bonne pratique comme leurre

### Q14 — Exemple d'alerte symptôme-first

- **Type:** single
- **Difficulty:** easy
- **Timer:** 20s
- **Tags:** [alerting]
- **Source:** `10-module-5-alerting.md` — tableau "Symptom-first · exemples"
- **Key concept:** Alerter sur l'impact utilisateur (taux d'erreur, latence) plutôt que sur la cause technique (MySQL down, CPU > 90 %)
- **Notes:** 3 distracteurs sont des alertes sur des causes techniques (MySQL, CPU, pod crash)

### Q15 — Error budget pour un SLO de 99,9 % sur 30 jours

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [alerting, slo]
- **Source:** `10-module-5-alerting.md` — tableau "SLO & Error Budget"
- **Key concept:** 99,9 % → budget = 0,1 % × 30j = ~43 min ; ne pas confondre avec 99 % (7h12) ou 99,5 % (3h36)
- **Notes:** Les 4 choices sont des valeurs du tableau — les 3 distracteurs sont les budgets d'autres SLO (99 %, 99,5 %, 99,99 %)

### Q16 — Calcul du burn rate

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [alerting, slo, burn-rate]
- **Source:** `10-module-5-alerting.md` — slide "Burn rate · alerter sur la vitesse"
- **Key concept:** burn_rate = error_rate_actuel / error_rate_acceptable. SLO 99,5 % → acceptable = 0,5 %. Observé 7 % → 7/0,5 = 14×
- **Notes:** Toutes les choices au format N× ; distracteurs : 7× (oubli du dénominateur), 21× (multiplication au lieu de division), 2× (erreur grossière)

### Q17 — Définition d'un span dans le tracing distribué

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [apm, traces]
- **Source:** `11-module-6-apm.md` — tableau "Vocabulaire"
- **Key concept:** Un span = une unité de travail au sein d'une trace (appel HTTP, requête DB, étape d'agent) ; une trace = le parcours complet de bout en bout
- **Notes:** Distracteur principal : confondre span avec trace (le parcours complet) ; autres distracteurs : traceparent, post-mortem

### Q18 — Stratégie de sampling qui capture 100 % des erreurs

- **Type:** single
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [apm, traces]
- **Source:** `11-module-6-apm.md` — slide "Sampling — head vs tail"
- **Key concept:** Tail-based = décision après reconstitution complète → peut garder 100 % des erreurs ; head-based = ratio fixe à l'entrée → rate les erreurs rares
- **Notes:** Distracteurs : head-based 100 % (ne garantit pas les erreurs futures car stateless), head-based 10 %, aucun sampling (non nommé "tail")

### Q19 — Outil OSS recommandé pour l'observabilité LLM

- **Type:** single
- **Difficulty:** medium
- **Timer:** 25s
- **Tags:** [llm, langfuse]
- **Source:** `05-module-9-llm-langfuse.md` — tableau "Tour des outils"
- **Key concept:** Langfuse est OSS, self-hostable (Docker/K8s) et recommandé pour le général LLM ; LangSmith est SaaS et LangChain-centric
- **Notes:** Distracteurs : LangSmith (SaaS non self-hostable), Datadog APM (SaaS payant), W&B Weave (SaaS)

### Q20 — Éléments à tracker pour un monitoring LLM complet (sélectionnez 3)

- **Type:** multiple
- **Difficulty:** hard
- **Timer:** 30s
- **Tags:** [llm, observabilité]
- **Source:** `05-module-9-llm-langfuse.md` — slide "Recap · checklist LLM observability"
- **Key concept:** Tokens (prompt + completion), scores de qualité (feedback/LLM-as-judge), coût quotidien sont essentiels ; les adresses IP des utilisateurs sont des PII interdites
- **Notes:** Question "sélectionnez 3" — leurre : adresse IP utilisateur (PII interdite + inutile pour obs LLM) ; toutes les choices sous forme de groupes nominaux courts

---

## Review Checklist

- [ ] Questions couvrent les 7 modules des sources
- [ ] Répartition difficulté : 6 easy / 10 medium / 4 hard
- [ ] Aucune question en doublon ou trop similaire
- [ ] Tags cohérents avec les tags du deck
- [ ] Timers adaptés à la difficulté (20s easy / 25s medium / 30s hard)
- [ ] Mix single (15) et multiple (5)
- [ ] Questions "sélectionnez N" ont N < 4 et au moins 1 distractor

---

_Plan créé : 2026-06-09_
_Ready for quiz generation: [ ]_
