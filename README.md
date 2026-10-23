# SiraFlow

SiraFlow est une interface Vue permettant d'importer une spécification OpenAPI ou
Swagger, d'explorer ses endpoints sous forme de graphe et de préparer des requêtes
de test. Le frontend lit les fichiers JSON/YAML dans le navigateur et utilise le
backend Django pour valider le document importé et générer un graphe simplifié.

## Prérequis

- Python 3.11 ou supérieur
- Node.js compatible avec Vite 6
- pnpm

## Lancer le projet en local

Le frontend et le backend se lancent dans deux terminaux séparés.

### 1. Installer et lancer le backend

Dans PowerShell, depuis la racine du dépôt :

```powershell
cd backend
python -m venv env
.\env\Scripts\Activate.ps1
python -m pip install -r requirements.txt

$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = & python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
python manage.py migrate
python manage.py runserver
```

Le backend local est alors disponible à l'adresse :

**http://127.0.0.1:8000/**

### 2. Installer et lancer le frontend

Dans un deuxième terminal, à la racine du dépôt :

```powershell
cd frontend
pnpm install
pnpm dev
```

Ouvrez l'adresse affichée par Vite, normalement **http://localhost:3000/**.
Le proxy de développement Vite transmet les requêtes `/api/` à Django sur le
port 8000. Laissez les deux processus en marche pendant l'utilisation.

## Adresse et test de l'API

L'endpoint de parsing est :

**POST http://127.0.0.1:8000/api/parse/**

Cette URL est locale : elle fonctionne uniquement lorsque le backend tourne sur
votre ordinateur. Une URL publique ne sera disponible qu'après déploiement du
backend sur un hébergeur.

Dans PowerShell, depuis n'importe quel dossier, avec Django lancé :

```powershell
$body = @{
  schema_json = @{
    openapi = "3.0.0"
    info = @{ title = "Demo API"; version = "1.0.0" }
    paths = @{
      "/ping" = @{
        get = @{ summary = "Vérifier le service" }
      }
    }
  }
} | ConvertTo-Json -Depth 20

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/parse/" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Une réponse réussie (`200`) contient :

- `schema` : la spécification validée ;
- `nodes` : les nœuds de graphe calculés par Django ;
- `edges` : les liens entre ces nœuds.

Une requête incorrecte renvoie `400`. L'endpoint accepte une requête `POST`, pas
une ouverture directe dans la barre d'adresse du navigateur, qui envoie un `GET`.

### Tester le backend

Depuis `backend`, dans le terminal où les variables d'environnement de
développement ont été configurées :

```powershell
python manage.py check
python manage.py test
```

## Tester depuis Internet avec ngrok

ngrok permet de rendre temporairement accessible le frontend local. Le frontend
Vite relaie déjà `/api/` vers Django sur le port 8000 : il suffit donc d'ouvrir
un seul tunnel, vers le port **3000**.

1. Installez ngrok et configurez le jeton depuis votre compte ngrok une seule fois :

   ```powershell
   ngrok config add-authtoken VOTRE_JETON_NGROK
   ```

   Gardez ce jeton privé ; ne le mettez ni dans le dépôt ni dans une capture.

2. Démarrez Django dans un terminal, comme décrit dans « Lancer le projet en local ».
3. Démarrez Vite dans un second terminal avec `pnpm dev`.
4. Dans un troisième terminal, ouvrez le tunnel :

   ```powershell
   ngrok http 3000
   ```

5. Copiez le nom d'hôte HTTPS indiqué par ngrok (sans `https://`), par exemple
   `exemple.ngrok-free.app`. Arrêtez Vite avec `Ctrl+C` en laissant ngrok et Django
   tourner, puis redémarrez Vite avec l'hôte autorisé :

   ```powershell
   cd frontend
   $env:NGROK_HOST = "exemple.ngrok-free.app"
   pnpm dev
   ```

6. Ouvrez l'URL HTTPS indiquée par ngrok. Le frontend est accessible à cette URL,
   et ses appels `/api/parse/` passent par le proxy Vite jusqu'à Django.

Pour tester l'API depuis un autre appareil, envoyez une requête `POST` à
`https://exemple.ngrok-free.app/api/parse/` avec le même corps JSON que dans la
section « Adresse et test de l'API ». Le domaine gratuit peut changer à chaque
lancement du tunnel ; dans ce cas, mettez à jour `NGROK_HOST` et redémarrez Vite.

Le tunnel est public : toute personne qui possède son URL peut atteindre votre
frontend et l'endpoint de parsing. Utilisez-le seulement pour des tests, ne
transmettez pas de données sensibles et arrêtez-le après usage. N'exposez pas
directement le port Django `8000` avec `ngrok http 8000`.

### Tester le frontend

Depuis `frontend` :

```powershell
pnpm run build
```

## Préparer un dépôt GitHub public

Le dossier fourni n'est pas encore un dépôt Git. Avant de publier :

1. Choisissez une licence et ajoutez le fichier `LICENSE`. Le README ne choisit pas
   de licence à votre place.
2. Vérifiez que `.gitignore` est bien à la racine et qu'aucun fichier de configuration
   local ou secret n'est ajouté.
3. Initialisez Git et inspectez les fichiers avant de les pousser :

```powershell
git init
git status --short
git add .
git diff --cached --name-only
```

Si un fichier sensible ou généré apparaît dans la liste, retirez-le de l'index avant
le commit. N'ajoutez jamais `backend\env`, `backend\db.sqlite3` ou un fichier `.env`.
Ajoutez ensuite le remote GitHub et poussez la branche principale selon les
instructions de GitHub.

## Variables de configuration

| Variable | Usage |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clé secrète aléatoire, obligatoire lorsque `DJANGO_DEBUG` n'est pas activé. Ne jamais la publier. |
| `DJANGO_DEBUG` | Active le mode développement uniquement avec la valeur `true`, `1` ou `yes`. Par défaut : désactivé. |
| `DJANGO_ALLOWED_HOSTS` | Hôtes Django autorisés, séparés par des virgules. En local : `localhost,127.0.0.1`. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Origines web autorisées, séparées par des virgules, avec schéma et port. |
| `DJANGO_ANON_RATE` | Limite des requêtes anonymes, format DRF, par défaut `30/min`. |
| `DJANGO_SECURE_HSTS_SECONDS` | Durée HSTS ; par défaut un an hors développement. Ne l'utiliser qu'avec HTTPS configuré. |
| `VITE_API_BASE_URL` | Origine du backend en production si le frontend et l'API ne partagent pas le même domaine. En développement, le proxy Vite suffit. |

Les variables `$env:...` définies dans PowerShell ne vivent que dans ce terminal.
Définissez les variables de production dans les paramètres secrets de l'hébergeur,
pas dans le code ni dans un fichier versionné.

## Architecture de la liaison frontend/backend

1. Le navigateur lit le fichier OpenAPI local ou récupère le document depuis l'URL
   saisie par l'utilisateur.
2. Le frontend analyse JSON/YAML et envoie le document sous la forme
   `{"schema_json": {...}}` à `POST /api/parse/`.
3. Django valide la structure, calcule `nodes`/`edges` et renvoie aussi `schema`.
4. Le frontend normalise `schema` et construit les vues détaillées.

En développement, le proxy Vite évite un appel cross-origin. En production, vous
pouvez servir frontend et `/api/` derrière le même domaine via un reverse proxy.
Sinon, définissez `VITE_API_BASE_URL` lors du build et configurez
`DJANGO_CORS_ALLOWED_ORIGINS` avec l'origine exacte du frontend.

Les requêtes de test vers les endpoints décrits par OpenAPI partent directement
du navigateur vers ces API tierces : elles ne passent pas par Django et dépendent
de leurs politiques CORS.

## Publication publique et sécurité

- Le dépôt ignore les environnements Python, `.env`, bases SQLite, dépendances et
  fichiers de build locaux. Vérifiez tout de même les fichiers suivis avant chaque
  publication.
- `DEBUG` est désactivé par défaut. Hors développement, Django exige
  `DJANGO_SECRET_KEY`.
- Configurez les noms de domaine exacts dans `DJANGO_ALLOWED_HOSTS` et
  `DJANGO_CORS_ALLOWED_ORIGINS`.
- Le backend limite les corps de requête à 8 Mio et applique une limite de
  30 requêtes anonymes par minute par défaut. Ajustez-la selon l'hébergement et
  surveillez les usages.
- Les réglages de production redirigent vers HTTPS et activent les cookies
  sécurisés ainsi que HSTS. Configurez correctement TLS sur l'hébergeur/reverse
  proxy avant d'exposer le service.
- L'API est actuellement anonyme : toute personne pouvant la joindre peut
  soumettre un document dans les limites configurées.
- Aucun fichier de licence n'est fourni. Choisissez et ajoutez une licence avant
  de présenter le dépôt comme open source ; sans licence, les droits d'auteur
  restent réservés par défaut.

Avant un déploiement, définissez les variables de production et lancez
`python manage.py check --deploy`. L'avertissement concernant HSTS preload est
laissé volontairement non activé : l'inscription à la liste preload est une
décision distincte qui peut avoir des conséquences durables sur le domaine.

Si l'ancienne clé de développement a déjà été poussée dans un dépôt public,
considérez-la comme divulguée : ne la réutilisez pas, et retirez-la de l'historique
Git si nécessaire. Le dossier de travail actuel n'est pas un dépôt Git initialisé ;
vérifiez le contenu et l'historique que vous créerez avant le premier push.
