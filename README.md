# TrailPacer

**L'app des traileurs : ton plan de course dans la poche, et dans l'oreille.**

TrailPacer transforme le GPX officiel d'une course et ton objectif de temps en un plan de course complet : allure par phase, repères de passage avec fenêtres horaires, gels, ravitos. Pendant la course, l'app t'annonce à la voix et par notification ce qui compte, **écran verrouillé et sans réseau**, calé sur ton **départ réel** et ta **position réelle**.

L'app s'adresse à n'importe quel traileur et à n'importe quel tracé GPX : trail court, marathon nature, ultra de montagne sur plusieurs jours, boucle, aller-retour ou point à point. Rien n'est codé en dur : tout vient du GPX et de tes saisies.

### Formats de course

| Format | Durée visée | Ce qui change |
|---|---|---|
| Court | < 2 h 30 | Cibles FC plus hautes, phases plus engagées |
| Standard | 2 h 30 à 6 h | Départ maîtrisé, montée en intensité progressive, final engagé |
| Ultra | > 6 h | FC basse, patience et alimentation, fatigue de fin de course plus forte, conseils de nuit, checklist ultra (frontale, couche chaude, batterie externe…) |

## Pourquoi une app native et pas une page web

Une page web ne peut ni parler ni notifier de façon fiable quand l'écran est verrouillé, et ses rappels à heure fixe deviennent faux dès que le départ est décalé. TrailPacer est une app Expo (React Native) qui s'appuie sur :

| Besoin | Brique |
|---|---|
| Alertes écran verrouillé, hors réseau | `expo-notifications` (notifications locales programmées) |
| Annonces vocales | `expo-speech` + `expo-audio` (session audio en arrière-plan) |
| Position en course | `expo-location` + `expo-task-manager` (GPS en arrière-plan) |
| Stockage du plan | `@react-native-async-storage/async-storage` |
| Import / export | `expo-document-picker`, `expo-file-system`, `expo-sharing` |

## Ce que fait le MVP

1. **Préparer** : import d'un GPX (ou démo 21 km / démo ultra), objectif (« 3h20 », « 26h ») et fenêtre (±1 %), ravitos et bases de vie détectés depuis les waypoints du GPX, **barrières horaires**, profil coureur optionnel (FC max / repos / zones, allure plat, watts par m/s), nutrition (gels, barres, « prises »), paramètres avancés du modèle.
2. **Générer le plan** : 3 scénarios (rapide / objectif / lent), 5 phases avec 6 repères chiffrés chacune et un encadré « À surveiller », repères de passage, gels, montées notables, avis de faisabilité.
3. **Bouton DÉPART** (double appui) : toutes les alertes se programment par rapport à ce départ réel. Correction possible de ±30 s.
4. **Annonces** : départ, changements de phase avec cibles FC / allure / puissance, prises, ravito à 500 m, repères avec avance ou retard, **marge sur la prochaine barrière horaire** (alerte si elle passe sous 20 min), **tombée de la nuit** (frontale) et lever du jour calculés hors réseau, paliers du final (5, 3, 2, 1 km), point de situation périodique.
5. **Position** : GPS en arrière-plan projeté sur la trace (gestion des boucles), recalage automatique, reprogrammation des notifications si l'écart dérive de plus de 30 s.
6. **Recalage manuel** : km lu sur la montre (avec facteur montre), repère touché dans « Passages », ou GPS ponctuel.
7. **Écran « Course »** : une seule carte qui s'adapte au moment (veille, matin, course, arrivée), gros chiffres, mode sombre. Mode **Aperçu** pour simuler n'importe quel moment de la course.
8. **Export / import du plan** en JSON (préparer sur un téléphone, courir avec un autre, envoyer à un coach).

## Démarrer

```bash
npm install
npm test            # tests du cœur métier (modèle, GPX, plan, projection GPS, alertes)
npm run typecheck
npx expo start      # interface dans Expo Go ou le navigateur (sans GPS d'arrière-plan)
```

Le GPS en arrière-plan et la voix écran verrouillé nécessitent un **development build** (pas Expo Go) :

```bash
npx eas-cli@latest build --profile development --platform ios   # build dans le cloud, sans Mac
# ou, sur un Mac avec Xcode :
npx expo run:ios --device
```

### GPX acceptés

- Traces (`trk`) ou routes (`rte`), avec ou sans préfixe d'espace de noms.
- Plusieurs tracés : enchaînés s'ils se suivent, sinon le plus long est retenu (variantes, parcours de repli) avec un avertissement.
- Sans altitude : accepté avec un avertissement (profil plat).
- Grandes traces : 215 km et 40 000 points lus en ≈ 0,1 s et planifiés en ≈ 50 ms (mesuré sous Node) ; trace stockée en format compact.
- Waypoints reconnus comme ravitos : « ravito », « ravitaillement », « base de vie », « refuge », « aid station », « CP3 », « R2 »…

## Organisation du code

```
index.ts                 enregistre la tâche GPS avant l'app (obligatoire pour iOS)
App.tsx                  navigation par onglets, horloge, reprise après redémarrage
src/core/                logique pure, testée en Node (aucune dépendance native)
  gpx.ts                 lecture GPX sans DOM, rééchantillonnage 10 m, lissage 50 m, D+
  model.ts               modèle d'allure (pente, marche, descente, fatigue) et solveur
  plan.ts                génération du plan (scénarios, phases, repères, gels, faisabilité)
  position.ts            km ↔ temps, position estimée, écart, projection GPS sur la trace
  events.ts              alertes de course, barrières horaires, nuit / jour
  sun.ts                 lever et coucher du soleil (hors réseau)
  format.ts              « 11h03 », « 3h20 », « 1 minute 20 de retard »…
src/services/            notifications, voix, GPS, annonceur, actions de course, fichiers
src/state/               magasin persistant partagé UI / tâche d'arrière-plan
src/screens/             Course, Passages, Plan, Préparer
docs/                    modèle, format du plan, protocole de tests terrain
```

Détails du modèle et du format JSON : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Avant le jour J : [docs/TESTS-TERRAIN.md](docs/TESTS-TERRAIN.md).

## Limites connues

- **Voix écran verrouillé** : elle n'existe que si le suivi GPS tourne (c'est lui qui réveille l'app). Sans GPS, seules les notifications (son + vibration) arrivent.
- **Montres** : Coros, Suunto, etc. n'acceptent pas d'apps tierces ; la vibration au poignet passe par le relais des notifications du téléphone, si la montre est réglée pour les afficher.
- **Modèle** : calibré par défaut sur un coureur « moyen ». Renseigne le facteur de calibration (temps réel ÷ temps prédit sur une course passée) pour l'ajuster.
- iOS limite à 64 notifications en attente : l'app programme les 60 prochaines et complète au fil de la course (à chaque position GPS ou à l'ouverture de l'app). Sur un ultra sans GPS, ouvre l'app de temps en temps, par exemple aux ravitos.
- Les barrières horaires sont des heures d'horloge absolues ; chaque heure est rattachée au jour le plus proche du passage prévu, ce qui couvre les courses sur plusieurs jours.

## Feuille de route (V2)

- Calibration automatique depuis Strava / fichiers FIT (temps réels vs prédits).
- Plusieurs courses et plans enregistrés.
- Bracelet de passage imprimable (PDF).
- App montre Garmin (Connect IQ).
- Écran de verrouillage enrichi (Live Activity iOS).
