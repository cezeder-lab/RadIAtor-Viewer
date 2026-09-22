# RadIAtor Viewer — Starlab MVG

Visualiseur de champ rayonné (pattern 3D + coupe 2D) pour des mesures Starlab
MVG au format `Etheta`/`Ephi`, en remplacement de la GUI MATLAB
`pattern_gui`. Application web tournant en local (aucun hébergement
requis) : backend FastAPI (Python) + frontend React/Vite (TypeScript).

## Fonctionnalités (V1 — parité avec la GUI MATLAB)

- Chargement multi-fichiers `.mat` (`Element0.mat` = full array boresight de
  référence, `Element1..N.mat` = éléments individuels)
- Extraction des patterns embedded par différence de phase ("Toggling
  Phase") ou passthrough ("Standard")
- Polarisation Total / RHCP / LHCP
- Beamforming (pointage θ/φ) par pondération de phase RHCP
- Pattern 3D sphérique interactif (rotation, zoom) + coupe 2D polaire
  (Phi Cut / Theta Cut)
- Gain crête et directivité crête (intégration numérique sur l'angle
  solide)
- Plage colorbar (dB) réglable + bouton "Auto Range"

## Structure

```
backend/    API FastAPI : parsing .mat (scipy.io) + endpoints upload/slice
frontend/   App React : UI + tout le calcul (toggling phase, polarisation,
            beamforming, coupes, directivité) porté depuis pattern_gui.m
```

Le backend ne fait que parser les `.mat` et découper par fréquence (pour
éviter de charger tout le cube [Az×El×Freq] en mémoire navigateur) ; tout
le traitement du signal (`frontend/src/compute.ts`) reproduit fidèlement la
logique de `pattern_gui22.m`.

## Installation

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Lancement

Dans deux terminaux séparés :

```bash
# Terminal 1 — backend (http://localhost:8000)
cd backend
source .venv/bin/activate
uvicorn app.main:app --port 8000

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

Ouvrir http://localhost:5173 dans le navigateur, charger les fichiers
`.mat` (sélectionner `Element0.mat` + `Element1..N.mat` ensemble), cliquer
sur "Charger".

## Application Windows (.exe)

Pas besoin d'ouvrir un navigateur ni un terminal : `desktop.py` lance le
serveur FastAPI en arrière-plan et l'affiche dans une fenêtre native
(via `pywebview`), et `PyInstaller` empaquette le tout en un seul `.exe`.

**Important** : PyInstaller ne fait pas de cross-compilation — le `.exe`
doit être construit *sur une machine Windows* (celle-ci a servi à écrire et
valider tout le code, y compris le démarrage du serveur, mais pas à
produire le binaire final). Sur ta machine Windows, avec Python 3.11+ et
Node.js installés :

```bat
build_windows.bat
```

Ce script installe les dépendances frontend/backend, build le frontend,
puis génère `backend\dist\RadIAtorViewer\RadIAtorViewer.exe`. Tu peux
ensuite déplacer ce dossier où tu veux et lancer l'exe directement.

Étapes manuelles équivalentes si tu préfères :

```bash
cd frontend && npm install && npm run build && cd ..
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-desktop.txt
pyinstaller --noconfirm desktop.spec
```

## Format de fichier attendu

Chaque `.mat` doit contenir une struct `data` avec :

- `data.axes(1).data` = azimuth (rad), `axes(2).data` = elevation (rad),
  `axes(3).data` = fréquence (Hz)
- `data.layers(1..4).data` = Etheta_re, Etheta_im, Ephi_re, Ephi_im, chacun
  de taille `[NAz x NEl x NF]`

Tous les fichiers d'une même session doivent partager la même grille
Az/El/F.
