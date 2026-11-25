---
title: Observability
description: >
  Fondamentaux de l'observabilité : métriques, logs et traces
theme: default
author: Maxime Lenne
tags: [observabilité, métriques, logs, traces, monitoring, alerting, apm, prometheus, grafana]
target-difficulty: medium
---

---
type: single
timer: 20
difficulty: easy
tags: [observabilité, monitoring]
---

## Quelle est la principale différence entre monitoring et observabilité ?

- [x] Le monitoring répond aux questions connues à l'avance ; l'observabilité explore des questions imprévues
- [ ] Le monitoring analyse des logs ; l'observabilité analyse des métriques
- [ ] L'observabilité est un sous-ensemble du monitoring, centré sur les performances
- [ ] Le monitoring nécessite plus d'outils que l'observabilité

> Le **monitoring** répond à des questions connues à l'avance ("known unknowns") avec des seuils prédéfinis et des
> dashboards figés. L'**observabilité** permet d'explorer des questions imprévues ("unknown unknowns") grâce à des
> données riches et à une exploration ad hoc. Les deux ne s'opposent pas : l'observabilité enrichit et étend le
> monitoring.

---
type: single
timer: 20
difficulty: easy
tags: [observabilité, fondamentaux]
---

## Quels sont les 3 piliers de l'observabilité ?

- [ ] Logs, métriques et dashboards
- [ ] Alertes, métriques et traces
- [x] Logs, métriques et traces
- [ ] Logs, alertes et APM

> Les **3 piliers** de l'observabilité sont les **logs** (événements discrets horodatés), les **métriques** (valeurs
> numériques agrégées dans le temps) et les **traces** (parcours d'une requête à travers les services). Les dashboards
> et les alertes sont des *outils* qui s'appuient sur ces 3 signaux — ils ne sont pas des piliers en eux-mêmes.

---
type: single
timer: 25
difficulty: medium
tags: [observabilité, modèles-mentaux]
---

## Quel modèle mental utiliser pour surveiller des ressources système telles que le CPU ou la RAM ?

- [ ] RED (Rate, Errors, Duration)
- [x] USE (Utilization, Saturation, Errors)
- [ ] Golden Signals (Latence, Trafic, Erreurs, Saturation)
- [ ] APM (Application Performance Monitoring)

> Le modèle **USE** (Utilization, Saturation, Errors) est conçu pour les **ressources système** : CPU, RAM, disque,
> réseau. Le modèle **RED** (Rate, Errors, Duration) s'applique aux **services orientés requêtes** (API, microservices).
> La règle de combinaison est : RED pour les services + USE pour l'infrastructure. Les Golden Signals englobent les deux
> mais sont moins précis pour un usage ciblé.

---
type: multiple
timer: 25
difficulty: medium
tags: [observabilité, modèles-mentaux]
---

## Parmi ces métriques, lesquelles font partie des 4 Golden Signals de Google SRE ? (sélectionnez 3)

- [x] Latence
- [x] Trafic
- [ ] Duration
- [x] Erreurs

> Les **4 Golden Signals** de Google SRE sont : **Latence**, **Trafic**, **Erreurs** et **Saturation**. La **Duration**
> est un terme du modèle **RED** (Rate, Errors, **D**uration), qui est une version simplifiée des Golden Signals
> focalisée sur les microservices. La Saturation — signal souvent oublié — est pourtant le plus prédictif : elle prédit
> les problèmes avant que la latence n'explose.

---
type: single
timer: 20
difficulty: easy
tags: [logs]
---

## Quel niveau de log signale qu'une exception a empêché une opération et nécessite une investigation ?

- [ ] WARN
- [ ] INFO
- [ ] CRITICAL
- [x] ERROR

> Le niveau **ERROR** indique qu'une exception a empêché l'exécution d'une opération — quelqu'un doit investiguer.
> **WARN** signale une situation anormale mais gérée, sans interruption de service. **CRITICAL/FATAL** est réservé aux
> pannes système complètes nécessitant une intervention immédiate (page on-call). **INFO** sert aux événements métier
> normaux, sans action attendue.

---
type: single
timer: 25
difficulty: medium
tags: [logs, traces, corrélation]
---

## Quel champ d'un log JSON permet de retrouver la trace d'une requête dans un backend comme Grafana Tempo ?

- [ ] request_id
- [ ] service
- [x] trace_id
- [ ] timestamp

> Le champ **`trace_id`** (128 bits hexadécimal) est le lien entre les logs et le backend de traces (Tempo, Jaeger). En
> filtrant les logs sur un `trace_id`, on retrouve instantanément tous les spans associés à cette requête. Le
> **`request_id`** corrèle les logs d'une même requête entre eux, mais n'est pas un identifiant de trace. `service` et
> `timestamp` sont des champs de contexte, pas de corrélation inter-signaux.

---
type: multiple
timer: 25
difficulty: medium
tags: [logs, rgpd]
---

## Parmi ces données, lesquelles sont des données personnelles (PII) interdites en clair dans les logs selon le RGPD ? (sélectionnez 3)

- [x] Adresse email
- [x] Adresse IP brute
- [ ] Durée de traitement en ms
- [x] Nom d'utilisateur

> Selon le **RGPD**, l'**adresse email**, l'**adresse IP brute** (qualifiée de donnée personnelle par la CNIL) et le
> **nom d'utilisateur** sont des PII interdites en clair dans les logs. La solution recommandée est la
> **pseudonymisation** : par exemple, `user_id_hash = sha256(user_id + sel)`. La **durée de traitement** est une donnée
> technique sans lien avec une personne identifiable — elle est autorisée.

---
type: single
timer: 20
difficulty: easy
tags: [prometheus, métriques]
---

## Quel type de métrique Prometheus est adapté à la mesure d'une taille de file d'attente (queue size) ?

- [ ] Counter
- [x] Gauge
- [ ] Histogram
- [ ] Summary

> Une **Gauge** est une métrique qui peut monter et descendre librement — idéale pour des états comme la taille de
> queue, l'utilisation mémoire ou le nombre de connexions ouvertes. Un **Counter** ne peut qu'augmenter (ou se
> réinitialiser à 0 au restart) : il est adapté aux cumuls (requêtes totales, erreurs). Un **Histogram** mesure des
> distributions (latences). Un **Summary** calcule des quantiles côté application.

---
type: multiple
timer: 25
difficulty: medium
tags: [prometheus, métriques]
---

## Pour utiliser correctement un Counter Prometheus, quelles pratiques doit-on adopter ? (sélectionnez 2)

- [x] Toujours appliquer rate() ou increase() plutôt que lire la valeur brute
- [ ] Réinitialiser le Counter manuellement après chaque déploiement
- [x] Suffixer le nom avec _total selon les conventions Prometheus
- [ ] Lire la valeur brute pour des agrégations sur de courtes fenêtres

> Deux règles fondamentales des **Counters** Prometheus : (1) **suffixer avec `_total`** (ex. `http_requests_total`)
> conformément aux conventions de nommage ; (2) **ne jamais lire la valeur brute** — utiliser `rate()` pour un taux par
> seconde ou `increase()` pour un volume sur une fenêtre. Un Counter peut se réinitialiser à 0 lors d'un restart :
> `rate()` détecte et gère automatiquement ces resets.

---
type: single
timer: 25
difficulty: medium
tags: [prometheus, cardinalité]
---

## Quel label est interdit dans une métrique Prometheus car il provoque une cardinalité explosive ?

- [ ] environment
- [ ] method
- [ ] service
- [x] user_id

> La **cardinalité** d'une métrique = produit du nombre de valeurs de chaque label. Le label **`user_id`** peut avoir
> des millions de valeurs uniques : combiné à d'autres labels, il peut générer des milliards de séries temporelles,
> provoquant un **OOM (Out Of Memory)** brutal du TSDB Prometheus. Les labels autorisés ont une cardinalité basse :
> `environment` (~3 valeurs), `method` (~5), `service` (~50). Sont aussi interdits : `request_id`, `trace_id`, `email`,
> URL complète.

---
type: single
timer: 30
difficulty: hard
tags: [prometheus, promql]
---

## Quelle requête PromQL calcule correctement le p95 de latence depuis un Histogram ?

- [ ] histogram_quantile(0.95, request_duration_seconds_bucket)
- [x] histogram_quantile(0.95, sum by(le)(rate(request_duration_seconds_bucket[5m])))
- [ ] rate(histogram_quantile(0.95, request_duration_seconds_bucket[5m]))
- [ ] avg(request_duration_seconds_sum / request_duration_seconds_count)

> La formule correcte nécessite **deux étapes** : (1) `rate()` à l'intérieur pour convertir le Counter cumulatif en taux
> par seconde ; (2) `sum by(le)` pour agréger les buckets cross-instances avant `histogram_quantile()`. Sans `rate()`,
> on calcule un quantile sur des valeurs cumulées depuis le démarrage — résultat sans sens. `avg(sum/count)` donne la
> **moyenne**, pas un percentile — et la moyenne masque systématiquement les problèmes de tail latency.

---
type: single
timer: 20
difficulty: easy
tags: [grafana, métriques]
---

## Pour un microservice API, quel modèle de dashboard Grafana est recommandé en priorité ?

- [x] RED (Rate, Errors, Duration)
- [ ] USE (Utilization, Saturation, Errors)
- [ ] Golden Signals (Latence, Trafic, Erreurs, Saturation)
- [ ] APM (Application Performance Monitoring)

> Le modèle **RED** (Rate, Errors, Duration) est conçu pour les **services orientés requêtes** : il affiche le débit
> (req/s), le taux d'erreur et les percentiles de latence (p50/p95/p99). Le modèle **USE** s'applique aux ressources
> système (CPU, RAM, disque). La règle : un dashboard RED pour chaque service + un dashboard USE pour l'infrastructure =
> couverture complète.

---
type: multiple
timer: 25
difficulty: medium
tags: [grafana]
---

## Parmi ces comportements, lesquels sont des anti-patterns à éviter dans Grafana ? (sélectionnez 3)

- [x] Créer un dashboard avec plus de 40 panels
- [ ] Afficher p50 et p99 côte à côte sur un même graphe
- [x] Configurer un refresh à 5 s sur 12 panels simultanés
- [x] Déclencher des alertes directement depuis un dashboard

> Trois **anti-patterns Grafana** à éviter : (1) un dashboard **40+ panels** que personne ne lit entièrement — 6 panels
> est idéal, 12 max ; (2) un **refresh à 5 s** sur de nombreux panels équivaut à un DDoS de la datasource Prometheus ;
> (3) **alerter depuis un dashboard** — les alertes doivent être définies dans les règles Prometheus/Alertmanager.
> **Afficher p50 et p99 côte à côte** est au contraire une **bonne pratique** : la moyenne seule masque les problèmes de
> tail latency.

---
type: single
timer: 20
difficulty: easy
tags: [alerting]
---

## Parmi ces alertes, laquelle est un exemple d'alerte orientée symptôme (symptom-first) ?

- [ ] MySQL est indisponible
- [ ] CPU > 90 % sur le nœud worker-01
- [x] Taux d'erreur > 5 % sur le service commandes
- [ ] Pod api-checkout en CrashLoopBackOff

> Une alerte **symptôme-first** décrit l'**impact ressenti par l'utilisateur** : un taux d'erreur élevé signifie que des
> requêtes échouent, peu importe la cause sous-jacente. Les alertes sur les causes techniques ("MySQL down", "CPU > 90
> %", "CrashLoopBackOff") sont moins utiles car elles peuvent être des faux positifs — le service peut très bien
> fonctionner malgré ces états. Alertez sur ce que ressent l'utilisateur, pas sur ce que fait l'infrastructure.

---
type: single
timer: 25
difficulty: medium
tags: [alerting, slo]
---

## Quel est l'error budget mensuel pour un SLO de 99,9 % calculé sur 30 jours ?

- [ ] ~7 heures 12 minutes
- [ ] ~3 heures 36 minutes
- [x] ~43 minutes
- [ ] ~4 minutes 19 secondes

> **Calcul** : `(1 − 0,999) × 30 × 24 × 60 = 0,001 × 43 200 min ≈ 43 min`. L'error budget de **99,9 %** représente
> environ **43 minutes d'indisponibilité** tolérée sur 30 jours. Les autres valeurs : **7h12** pour un SLO de 99 %,
> **3h36** pour 99,5 %, **4 min** pour 99,99 %. Chaque "9" supplémentaire représente ~10× moins de budget — et souvent
> 10× plus d'investissement pour l'atteindre.

---
type: single
timer: 30
difficulty: hard
tags: [alerting, slo, burn-rate]
---

## Avec un SLO de 99,5 % et un taux d'erreur observé de 7 %, quel est le burn rate ?

- [ ] 7×
- [ ] 21×
- [ ] 2×
- [x] 14×

> **Calcul** : `burn_rate = error_rate_actuel / error_rate_acceptable`. Pour un SLO de 99,5 %, le taux d'erreur
> acceptable est `1 − 0,995 = 0,5 %`. Burn rate = `7 % / 0,5 % = 14×`. À ce rythme, 100 % du budget mensuel serait
> consommé en ~50 heures. Un burn rate de **14,4×** déclenche une alerte critique (page on-call) selon la méthode
> **MWMBR** (Multi-Window Multi-Burn-Rate) du Google SRE Workbook.

---
type: single
timer: 25
difficulty: medium
tags: [apm, traces]
---

## Dans le tracing distribué, qu'est-ce qu'un span ?

- [ ] Le parcours complet d'une requête de bout en bout entre tous les services
- [x] Une unité de travail au sein d'une trace (appel HTTP, requête DB, étape d'agent)
- [ ] L'identifiant hexadécimal transmis entre services via le header traceparent
- [ ] Un rapport de synthèse généré après la résolution d'un incident

> Un **span** est une **unité de travail élémentaire** dans une trace : un appel HTTP externe, une requête base de
> données, un appel LLM, ou toute étape instrumentée. L'ensemble des spans liés par un même **`trace_id`** forme une
> **trace** — le parcours complet de bout en bout. Le `traceparent` est l'en-tête W3C qui propage le `trace_id` et le
> `parent_span_id` entre services pour assurer la corrélation.

---
type: single
timer: 30
difficulty: hard
tags: [apm, traces]
---

## Quelle stratégie de sampling est conçue pour capturer 100 % des traces en erreur, même lorsqu'on sous-échantillonne le trafic normal ?

- [ ] Head-based sampling avec ratio 100 %
- [ ] Head-based sampling avec ratio 10 %
- [x] Tail-based sampling
- [ ] Sampling aléatoire uniforme

> Le **tail-based sampling** prend sa décision **après la reconstitution complète** de la trace au niveau du Collector
> (OTel Collector). Il peut donc analyser tous les spans et garder 100 % des traces en erreur ou anormalement lentes,
> tout en sous-échantillonnant les traces normales. Le **head-based** décide à l'entrée du système, avant de savoir si
> la requête réussira — il rate les erreurs rares quand le ratio est < 100 %. Inconvénient du tail-based : bufférisation
> 30 s–2 min et consommation mémoire accrue.

---
type: single
timer: 25
difficulty: medium
tags: [apm, langfuse]
---

## Quel outil est open source, self-hostable et recommandé pour l'observabilité d'applications LLM en formation ?

- [ ] LangSmith
- [x] Langfuse
- [ ] Datadog APM
- [ ] W&B Weave

> **Langfuse** est la solution recommandée : **open source** (MIT), **self-hostable** via Docker ou Kubernetes, et conçu
> pour le monitoring général des applications LLM (traces, scores, coûts, versioning de prompts). **LangSmith** est SaaS
> uniquement et centré sur l'écosystème LangChain. **Datadog APM** et **W&B Weave** sont des solutions SaaS payantes ou
> non self-hostables dans leur version complète.

---
type: multiple
timer: 30
difficulty: hard
tags: [llm, observabilité]
---

## Parmi ces éléments, lesquels doivent figurer dans une checklist d'observabilité LLM complète ? (sélectionnez 3)

- [x] Tokens consommés par requête
- [ ] Adresses IP des utilisateurs finaux
- [x] Scores de qualité par trace
- [x] Coût quotidien en euros

> Une **checklist d'observabilité LLM** complète inclut : (1) les **tokens** (prompt + completion) pour mesurer les
> coûts et détecter les prompts anormalement longs ou les boucles d'agent ; (2) les **scores de qualité** (feedback
> utilisateur 👍/👎 ou LLM-as-judge) pour détecter les régressions silencieuses ; (3) le **coût quotidien** exporté vers
> Prometheus pour déclencher une alerte si le budget est dépassé. Les **adresses IP** sont des **PII** interdites par le
> RGPD — on utilise un `user_id_hash` pseudonymisé à la place.
