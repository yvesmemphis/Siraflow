# Liaison entre le frontend et le backend

Ce document explique le fonctionnement actuel de la liaison entre Vue et Django,
comment la lancer en local et comment la configurer pour un déploiement.

## Ce qui a été modifié

- Le frontend continue de lire les fichiers `.json`, `.yaml` et `.yml` dans le navigateur.
- Lorsqu'un schéma est importé depuis un fichier ou une URL, le frontend envoie son
  contenu JSON à Django par `POST /api/parse/`.
- Django vérifie que le contenu est un objet avec `info` et des routes dans `paths`.
  Il renvoie le schéma validé ainsi que des listes `nodes` et `edges`.
- Le frontend utilise le schéma renvoyé pour construire son objet d'interface et son
  graphe détaillé. Il ne consomme pas directement les `nodes` et `edges` du backend
  pour l'affichage : ils sont disponibles pour d'autres clients ou évolutions.
- Django ne télécharge plus les URL de schémas. Le navigateur charge l'URL puis envoie
  son contenu à Django. Cela évite que le serveur Django puisse être utilisé pour
  contacter arbitrairement des services internes.
- Quatre tests Django couvrent la réponse valide et plusieurs entrées invalides.

## Flux de données

```text
Fichier local ou URL du schéma
          |
          v
Frontend Vue lit JSON/YAML et obtient un objet
          |
          | POST /api/parse/
          | {"schema_json": { ... }}
          v
Backend Django valide et construit le graphe simplifié
          |
          | 200
          | {"schema": { ... }, "nodes": [...], "edges": [...]}
          v
Frontend normalise "schema" et affiche le graphe et les détails
```

Le frontend parse YAML en objet avant l'envoi. Le corps envoyé au backend est donc
toujours JSON, même quand le fichier original était au format YAML.

## Démarrage en développement

Ouvrez deux terminaux à la racine du projet.

Terminal 1, backend :

```powershell
cd backend
python -m venv env
.\env\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = & python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
python manage.py runserver
```

Terminal 2, frontend :

```powershell
cd frontend
pnpm install
pnpm dev
```

Vite affiche l'adresse du frontend (normalement `http://localhost:3000`). Son proxy
transmet les requêtes `/api/...` vers `http://127.0.0.1:8000`. Le navigateur voit
ainsi une requête de même origine et le CORS n'est généralement pas impliqué dans
ce flux de développement.

Vérifiez le backend indépendamment :

```powershell
cd backend
.\env\Scripts\python.exe manage.py check
.\env\Scripts\python.exe manage.py test
```

## Appel HTTP manuel

Le frontend utilise l'URL relative `/api/parse/`. Pour tester directement le backend :

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/parse/ `
  -Method Post `
  -ContentType application/json `
  -Body '{"schema_json":{"openapi":"3.0.0","info":{"title":"Demo","version":"1.0"},"paths":{"/ping":{"get":{}}}}}'
```

Une réponse réussie contient `schema`, `nodes` et `edges`. Les données incorrectes
produisent une réponse HTTP 400 avec un message de validation.

## Configuration en production

Par défaut, le frontend utilise une URL relative, prévue pour être publiée derrière
un reverse proxy qui sert le frontend et transmet `/api/` au serveur Django. Si le
backend est hébergé sur une origine distincte, définissez `VITE_API_BASE_URL` au
moment de construire le frontend, par exemple :

```text
VITE_API_BASE_URL=https://api.exemple.com
```

Dans ce cas, configurez dans Django `CORS_ALLOWED_ORIGINS` avec l'origine exacte du
frontend (schéma, nom d'hôte et port), et configurez `ALLOWED_HOSTS` avec le nom
d'hôte du backend. Le port Vite de développement est également listé dans les
origines CORS du mode développement. En production, les origines CORS de
développement ne sont pas autorisées par défaut : définissez
`DJANGO_CORS_ALLOWED_ORIGINS` explicitement.

Le backend est servi par Gunicorn en production Linux et WhiteNoise sert les
fichiers statiques Django. Derrière Render, `DJANGO_TRUST_PROXY_SSL=true` permet à
Django de reconnaître le HTTPS terminé par le proxy. Configurez aussi
`DJANGO_CSRF_TRUSTED_ORIGINS` pour le domaine frontend si l'admin Django est utilisé.
Les étapes Render/Vercel détaillées sont dans le README à la racine.

## Limites actuelles

- Il s'agit d'une validation structurelle minimale, pas d'une validation complète
  de conformité à toutes les versions OpenAPI/Swagger.
- Le frontend doit pouvoir récupérer lui-même une URL distante ; si le serveur de
  schéma refuse les requêtes CORS, l'import par URL peut échouer. Le téléchargement
  d'un fichier local reste une solution.
- Les requêtes de test des endpoints documentés sont envoyées directement du
  navigateur vers ces API et ne passent pas par Django. Leurs politiques CORS
  s'appliquent séparément.
- L'endpoint de parsing est public et sans authentification. Avant d'en faire un
  service public à grande échelle, ajoutez des limites de débit et de taille,
  surveillez l'utilisation et décidez si une authentification est nécessaire.
