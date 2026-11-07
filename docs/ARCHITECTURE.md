# Architecture, modèle et format du plan

## 1. Traitement du GPX (`src/core/gpx.ts`)

- Lecture des `trkpt` (ou `rtept` à défaut) et des `wpt` par expressions régulières (React Native n'a pas de `DOMParser`).
- Distance cumulée haversine, doublons retirés.
- Rééchantillonnage tous les **10 m** (interpolation linéaire lat / lon / altitude).
- Altitude lissée par moyenne glissante centrée sur **50 m** ; D+ et D− calculés sur le profil lissé (le D+ brut est conservé pour information).
- Waypoints projetés sur la trace ; ceux dont le nom évoque un ravito (« ravito », « R1 », « aid », « CP »…) sont proposés comme ravitos.

## 2. Modèle d'allure (`src/core/model.ts`)

Un **effort** `e` (en m/s équivalent plat) est cherché par bissection pour que le temps total égale l'objectif. Sur chaque tronçon de 10 m :

```
vitesse plat du moment  vf = e × intensité(phase) / (F × fatigue(fraction de course))
montée   (g > 0)        v  = vf / (1 + a·g − b·g²)          a = 0,062 ; b = 0,0005 ; g en %
descente (g < 0)        v  = vf × facteurDescente(g) × aisance
pente > seuil marche    v  = min(v, VAM / pente / fatigue)  seuil 12 %, VAM 850 m/h
```

- `facteurDescente` : gain jusqu'à ×1,15 vers −10 %, puis freinage (×0,90 à −20 %, plancher ×0,45).
- `F` : facteur global de calibration (temps réel ÷ temps modèle mesuré sur une course passée).
- Fatigue par défaut : 0,97 jusqu'à 10 % de la distance, 1,00 jusqu'à 80 %, 1,02 jusqu'à 88 %, 1,05 jusqu'à 96 %, 1,08 ensuite.
- Intensité par phase : 0,96 (départ), 1,00, 1,00, 1,02, 1,06 (final). La puissance cible affichée vaut `watts par m/s × e × intensité`.
- Bouchon de départ réparti sur le premier kilomètre ; arrêts ravito ajoutés au passage de chaque ravito.
- Scénarios rapide / lent : objectif × (1 ∓ fenêtre), résolus indépendamment.

## 3. Phases

Cinq phases (départ maîtrisé, installation, cœur de course, tenir, final) bornées à 12 / 40 / 70 / 90 / 100 % de la distance, **recalées sur un ravito** s'il en existe un à moins de 4 % de la distance. Chaque phase porte :

- FC cible en % de FC de réserve (Karvonen), zone correspondante, alerte FC haute ;
- allure plat équivalente, allure moyenne réelle, puissance si calibrée ;
- 6 tuiles chiffrées, objectif, « À surveiller » (montée principale, ravito, gels, FC, points d'attention génériques), consignes.

## 4. Position et écart (`src/core/position.ts`)

- `tAtKm` / `kmAt` : interpolation sur la grille de temps tous les 100 m du scénario objectif.
- **Recalage** (`Anchor`) : « à t secondes de course, j'étais au km x ». La position estimée avance ensuite au rythme du plan depuis ce point. Écart = `t − tAtKm(x)` (positif = retard) ; arrivée projetée = objectif + écart.
- **Projection GPS** : sur une trace allégée (~25 m). Score = distance au segment + 40 m × |km candidat − km estimé|, ce qui lève l'ambiguïté des boucles et des allers-retours. Rejet au-delà de 250 m de la trace ou si la précision GPS dépasse 60 m.

## 5. Alertes (`src/core/events.ts`, `src/services/announcer.ts`)

| Type | Base | Moment |
|---|---|---|
| Départ | temps | t = 0 |
| Gel, rappel boisson | temps | t fixe depuis le départ réel |
| Changement de phase, ravito dans 500 m, repère, paliers 5/3/2/1 km | km | `tAtKm(km) + écart actuel` |

- Les **notifications** sont programmées dans l'OS dès le départ (60 max), reprogrammées à chaque recalage manuel, et par le GPS quand l'écart dérive de 30 s ou plus (au plus toutes les 2 min).
- La **voix** est jouée par l'annonceur, appelé chaque seconde app ouverte et à chaque position GPS en arrière-plan. Les repères annoncent l'écart et l'arrivée projetée si la position date de moins de 3 min, sinon l'heure de passage prévue.
- Un événement manqué de plus de 2 min (app fermée, pas de GPS) n'est pas annoncé en retard.

## 6. Format du plan (JSON, `version: 1`)

```jsonc
{
  "version": 1,
  "race":    { "name", "date": "2026-11-07", "startTime": "10:40", "targetSec", "windowPct",
               "gelIntervalMin", "gel0MinBefore", "drinkIntervalMin", "watchFactor" },
  "athlete": { "hrMax?", "hrRest?", "hrZones?": [5 bornes], "wattsPerMps?", "flatPaceSecPerKm?" },
  "model":   { "upA", "upB", "walkGradePct", "walkVamMh", "descentSkill", "calibrationF",
               "fatigue": [{ "toFrac", "f" }], "startDelaySec" },
  "course":  { "name", "totalM", "gainM", "lossM",
               "profile": [{ "d", "ele" }],          // tous les 100 m
               "snap":    [{ "d", "lat", "lon" }] },  // ~25 m, pour le GPS
  "stepM": 100,
  "scenarios": { "fast" | "target" | "slow": { "totalSec", "effort", "times": [s tous les stepM] } },
  "phases":    [{ "name", "fromKm", "toKm", "hr?", "watts?", "flatPaceSecPerKm", "tiles": [6], "watch", "tips", … }],
  "landmarks": [{ "id", "name", "km", "kind", "ele", "tFast", "tTarget", "tSlow" }],
  "aidStations": [{ "name", "km", "stopSec" }],
  "fuel":      [{ "id", "tSec", "label", "km" }],
  "morning":   [{ "minBefore", "text" }],
  "checklist": [], "recovery": [], "climbs": [], "feasibility": { … }
}
```

Un outil externe (script Python, autre modèle) peut produire ce fichier : il suffit de respecter les champs validés par `src/core/validate.ts` (grilles de temps croissantes, trace, phases, repères, date et heure de départ).
