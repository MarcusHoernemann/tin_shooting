# Tin Shooting

Installierbares Dosen-Dartspiel von Marcus Hörnemann für 1 bis 8 Personen. Sieben Runden auf einen gemeinsamen Dosenturm aus drei, zwei und einer Dose. Jede Dose hat drei sichtbare Trefferringe. Der Turm bleibt beim Spielerwechsel stehen. Kettenstürze zählen für den aktuellen Werfer. Das Regelwerk steht in der App unter **Regeln**.

- Single, Double, Triple, Bull, Bullseye und Fehlwurf lassen sich von Hand erfassen.
- Spielerprofile, Auswahl, laufende Partie und die letzten 30 abgeschlossenen Partien bleiben im lokalen Speicher des jeweiligen Browsers. Unter **Spieler** lassen sich Profile löschen. **Verlauf löschen** entfernt den Partieverlauf und den Zeitpunkt der letzten Nutzung.
- Nach dem ersten vollständigen Laden ist die App auch offline nutzbar.

## Starten und installieren

Für einen lokalen Test im Projektordner `python3 -m http.server 8000` ausführen und `http://localhost:8000` öffnen. Für die Installation auf anderen Geräten muss die App über HTTPS erreichbar sein.

Für GitHub Pages nach dem Merge in **Settings → Pages → Deploy from a branch** den Branch **main** und den Ordner **/ (root)** auswählen. Die App benötigt keinen Build-Schritt.

In der App führt **App installieren** durch die Installation. Auf iPhone und iPad geht die Installation über Safari und **Zum Home-Bildschirm**. Die App bringt dafür ein eigenes Startbildschirm-Symbol mit. Interaktive System-Widgets gehören nicht zum Installationsumfang.

## Neue Version veröffentlichen

Bei jeder Veröffentlichung die Versionsnummer in `CACHE_NAME` in `sw.js` erhöhen. Veröffentlichte Änderungen am Service Worker lösen die Update-Erkennung aus. Die App prüft beim Start, bei erneutem Öffnen der Ansicht, regelmäßig im Vordergrund und auf Wunsch über **Auf Updates prüfen**. **Update installieren** übernimmt die neue Version und lädt die App neu. Der Spielstand bleibt lokal erhalten.

## Lizenz

© 2026 Marcus Hörnemann. [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/). [Originalprojekt](https://github.com/MarcusHoernemann/tin_shooting).
