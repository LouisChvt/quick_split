# Protocole de tests terrain (avant le jour J)

Ces points ne peuvent pas être validés en simulation : ils dépendent du téléphone, de l'OS et de la montre. À faire sur un **development build** installé sur le téléphone de course.

## 1. Notifications écran verrouillé
- [ ] Préparer → « Notif dans 10 s », verrouiller : la notification arrive avec son et vibration.
- [ ] Elle s'affiche aussi sur la montre (vérifier les réglages de relais de notifications de la montre).
- [ ] Mode Concentration / Ne pas déranger : vérifier qu'il ne bloque pas l'app (l'autoriser si besoin).

## 2. Voix écran verrouillé (répétition générale, 20 min de footing)
- [ ] Autoriser la localisation **« Toujours »**.
- [ ] Lancer de la musique, appuyer sur DÉPART, verrouiller l'écran, partir courir.
- [ ] L'annonce de départ, le premier repère et le point de situation à 15 min sont entendus.
- [ ] La musique baisse pendant l'annonce puis revient (sinon : noter le comportement).
- [ ] Même test avec un casque Bluetooth / à conduction osseuse.
- [ ] Terminer par « Annuler le départ ».

## 3. Batterie
- [ ] Sortie longue (≥ 2 h) avec GPS précis, écran verrouillé : relever le % de batterie consommé.
- [ ] Refaire avec « GPS économe » si la consommation extrapolée à la durée de course dépasse 50 %.

## 4. Précision de la projection
- [ ] Sur un parcours en boucle ou avec aller-retour, vérifier dans « Course » (ligne GPS) que le km affiché ne saute pas sur l'autre brin.
- [ ] Comparer le km GPS et le km montre à 3 ou 4 endroits ; ajuster le **facteur montre** si l'écart est systématique.

## 5. Départ décalé et redémarrage
- [ ] Appuyer sur DÉPART 1 min après le vrai départ, corriger avec « Parti 30 s plus tôt » ×2 : le chrono et les heures de passage se décalent.
- [ ] Forcer la fermeture de l'app en course puis la rouvrir : la course reprend (chrono, recalage, GPS, alertes).

## 6. Calibration
- [ ] Après une course ou une sortie test chronométrée sur un GPX connu, calculer `temps réel ÷ temps prédit` et le saisir dans « Calibration » (Préparer → Modèle avancé).
