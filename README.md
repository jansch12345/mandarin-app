# Mandarin für die Reise – PWA

- `dist/` – (wird gebaut) deploybare App (index.html, sw.js für Offline, manifest, Icons, course.json als Kopie der Kursdaten)
- `mandarin-app.html` – dieselbe App als EINE Datei (ohne Offline-Service-Worker)

## Inhalte erweitern
1. In `content/course-part1.txt` (alle bisherigen Units) unten anhängen oder eine neue Datei `content/course-part2.txt` anlegen:
   ```
   # u20 | 🚄 | Mit dem Zug | 4
   > Erklärzeile zur neuen Grammatik (**fett** erlaubt)
   火车票 | huǒchēpiào | Zugticket | optionaler Aussprache-Tipp
   ```
2. `node content/build-course.js` (erzeugt `src/course.json`, prüft Pinyin gegen pinyin-pro, meldet Dubletten)
3. `node build.js` (baut dist/ und mandarin-app.html)

Fortschritt liegt in localStorage unter `mandarin-reise-v1`, Schlüssel = Hanzi – neue Units zerstören keinen alten Fortschritt.

## Deployment (GitHub Pages)
Jeder Push auf `main` startet `.github/workflows/pages.yml`: `npm ci`, `node content/build-course.js`, `node build.js` und veröffentlicht `dist/` über GitHub Pages.
Neue Units = nur `content/*.txt` bearbeiten und pushen – die App baut sich selbst neu.
Alle Pfade sind relativ, die App läuft unter `https://<user>.github.io/<repo>/`. Icons liegen als Base64 in `assets/`.
