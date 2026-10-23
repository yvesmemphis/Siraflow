# SiraFlow — Frontend

Ce dossier contient l’application frontend autonome de SiraFlow : Vue 3, TypeScript, Vite, Tailwind CSS, Vue Flow, le parseur OpenAPI et les assets locaux de marque et d’illustration. Il ne contient ni backend, ni base de données, ni identifiants secrets.

## Prérequis et lancement

Utilisez Node.js 20 ou plus récent ainsi que pnpm 11.25.0 (version déclarée dans `package.json`). Depuis ce dossier :

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite démarre par défaut sur `http://localhost:3000`. Pour produire les fichiers statiques :

```bash
pnpm build
```

Le résultat se trouve dans `dist/`. `pnpm preview` permet de servir ce build localement.

## Connexion à votre backend

SiraFlow lit une spécification OpenAPI 3.x ou Swagger 2.0 au format JSON ou YAML. Pour utiliser votre API, collez l’URL de sa spécification dans le champ d’import, ou importez un fichier local. Le champ est prérempli avec l’exemple PetStore ; pour changer cette valeur par défaut dans le code, modifiez `DEFAULT_SCHEMA_URL` dans `src/App.vue`.

Le « Mini Postman » envoie les requêtes depuis le navigateur vers l’URL de serveur déclarée dans la spécification (`servers` en OpenAPI 3, ou `host`/`basePath` en Swagger 2). Votre backend doit donc autoriser l’origine du frontend par CORS et les méthodes/en-têtes utilisés. Les en-têtes de requête peuvent être ajustés dans le panneau de test. Les textes provenant des spécifications importées sont conservés tels quels.

Aucune adresse de backend n’est présumée et aucun secret n’est embarqué dans le frontend. Les fichiers de marque, de favicon, de fond et d’illustration utilisés par l’application sont inclus dans `public/assets/`.
