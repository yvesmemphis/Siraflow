export interface DemoEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  raw: Record<string, unknown>;
}

export const demoCatalog: DemoEntry[] = [
  {
    id: 'petstore',
    title: 'API PetStore',
    description: 'Exemple Swagger simplifié ; les charges utiles intégrées sont illustratives et peuvent différer du service PetStore.',
    category: 'SWAGGER 2.0',
    raw: {
      swagger: '2.0',
      info: { title: 'API PetStore', description: 'Exemple Swagger 2.0 simplifié pour l’inventaire des animaux, les commandes et la connexion aux comptes. Les charges utiles intégrées sont illustratives et peuvent différer du service PetStore.', version: '2.0.0' },
      host: 'petstore.swagger.io',
      basePath: '/v2',
      schemes: ['https'],
      paths: {
        '/pet/findByStatus': {
          get: {
            tags: ['Animaux'], summary: 'Rechercher des animaux par statut', operationId: 'findPetsByStatus',
            description: 'Renvoie tous les animaux de l’inventaire qui correspondent à un ou plusieurs statuts.',
            parameters: [{ name: 'status', in: 'query', required: false, type: 'array', collectionFormat: 'multi', items: { type: 'string', enum: ['available', 'pending', 'sold'] }, description: 'Statuts des animaux à utiliser pour le filtrage.' }],
            responses: { '200': { description: 'Animaux correspondants', examples: { 'application/json': [{ id: 101, name: 'Luna', status: 'available', category: { id: 2, name: 'Chats' }, photoUrls: ['https://images.example.com/luna.jpg'] }, { id: 102, name: 'Milo', status: 'available', category: { id: 2, name: 'Chats' }, photoUrls: ['https://images.example.com/milo.jpg'] }] } } }
          }
        },
        '/pet': {
          post: {
            tags: ['Animaux'], summary: 'Ajouter un nouvel animal à la boutique', operationId: 'addPet',
            description: 'Crée une fiche d’animal et l’ajoute à l’inventaire de la boutique.',
            consumes: ['application/json'], parameters: [{ name: 'body', in: 'body', required: true, schema: { type: 'object', example: { id: 201, name: 'Poppy', category: { id: 2, name: 'Chats' }, photoUrls: ['https://example.com/poppy.jpg'], tags: [{ id: 1, name: 'amical' }], status: 'available' } } }],
            responses: { '200': { description: 'Animal créé avec succès', examples: { 'application/json': { id: 201, name: 'Poppy', status: 'available' } } }, '400': { description: 'Données d’animal invalides' } }
          }
        },
        '/pet/{petId}': {
          get: {
            tags: ['Animaux'], summary: 'Rechercher un animal par ID', operationId: 'getPetById', description: 'Renvoie un animal à partir de son identifiant unique.',
            parameters: [{ name: 'petId', in: 'path', required: true, type: 'integer', format: 'int64', description: 'ID de l’animal à récupérer.' }],
            responses: { '200': { description: 'Détails de l’animal', examples: { 'application/json': { id: 201, name: 'Poppy', status: 'available', category: { id: 2, name: 'Chats' }, tags: [{ id: 1, name: 'amical' }] } } }, '404': { description: 'Animal introuvable' } }
          },
          delete: {
            tags: ['Animaux'], summary: 'Supprimer un animal', operationId: 'deletePet', description: 'Retire un animal de l’inventaire de la boutique.',
            parameters: [{ name: 'petId', in: 'path', required: true, type: 'integer', description: 'Identifiant de l’animal à supprimer.' }, { name: 'api_key', in: 'header', required: false, type: 'string', description: 'Clé API facultative.' }],
            responses: { '200': { description: 'Animal supprimé' }, '404': { description: 'Animal introuvable' } }
          }
        },
        '/store/inventory': {
          get: {
            tags: ['Boutique'], summary: 'Obtenir les quantités en inventaire', operationId: 'getInventory', description: 'Renvoie les quantités en boutique, regroupées par statut des animaux.',
            responses: { '200': { description: 'Quantités en inventaire par statut', examples: { 'application/json': { available: 38, pending: 7, sold: 15 } } } }
          }
        },
        '/store/order': {
          post: {
            tags: ['Boutique'], summary: 'Passer une commande', operationId: 'placeOrder', description: 'Crée une commande d’achat pour un animal.',
            consumes: ['application/json'], parameters: [{ name: 'body', in: 'body', required: true, schema: { type: 'object', example: { id: 42, petId: 201, quantity: 1, shipDate: '2026-10-23T12:00:00.000Z', status: 'placed', complete: true } } }],
            responses: { '200': { description: 'Commande passée', examples: { 'application/json': { id: 42, petId: 201, quantity: 1, status: 'placed', complete: true } } }, '400': { description: 'Commande invalide' } }
          }
        },
        '/user/login': {
          get: {
            tags: ['Utilisateurs'], summary: 'Connecter un utilisateur', operationId: 'loginUser', description: 'Authentifie un utilisateur et renvoie un jeton de session.',
            parameters: [{ name: 'username', in: 'query', required: true, type: 'string', description: 'Nom d’utilisateur du compte.' }, { name: 'password', in: 'query', required: true, type: 'string', format: 'password', description: 'Mot de passe du compte.' }],
            responses: { '200': { description: 'Jeton de session', examples: { 'application/json': { code: 200, type: 'unknown', message: 'session utilisateur connectée : 9df2f0' } } }, '400': { description: 'Nom d’utilisateur ou mot de passe invalide' } }
          }
        }
      }
    }
  },
  {
    id: 'ecommerce',
    title: 'API e-commerce',
    description: 'Consultation des produits et des paniers ; les opérations d’écriture renvoient des exemples simulés et ne sont pas enregistrées.',
    category: 'OPENAPI 3.0',
    raw: {
      openapi: '3.0.3',
      info: { title: 'API e-commerce', description: 'Exemple OpenAPI intégré inspiré des routes de produits, de paniers et d’authentification de DummyJSON. Les écritures sont simulées et ne sont pas enregistrées.', version: '1.4.0' },
      servers: [{ url: 'https://dummyjson.com', description: 'Serveur API de démonstration' }],
      paths: {
        '/products': {
          get: { tags: ['Produits'], summary: 'Parcourir le catalogue de produits', operationId: 'listProducts', description: 'Recherche dans le catalogue de produits et parcourt ses pages.', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 12 }, description: 'Nombre de produits par page.' }, { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Nombre de produits à ignorer.' }], responses: { '200': { description: 'Résultats des produits paginés', content: { 'application/json': { example: { products: [{ id: 1, title: 'Essence Mascara Lash Princess', price: 9.99, rating: 4.94, stock: 5, category: 'beauty' }], total: 194, skip: 0, limit: 12 } } } } } }
        },
        '/products/add': {
          post: { tags: ['Produits'], summary: 'Ajouter un produit', operationId: 'addProduct', description: 'Le serveur de démonstration renvoie un exemple de produit ; les écritures ne sont pas enregistrées.', requestBody: { required: true, content: { 'application/json': { example: { title: 'Minimal Ceramic Mug', price: 18.5, description: 'Mug en grès avec finition artisanale.', category: 'home' } } } }, responses: { '201': { description: 'Réponse d’exemple du produit', content: { 'application/json': { example: { id: 195, title: 'Minimal Ceramic Mug', price: 18.5 } } } } } }
        },
        '/products/{id}': {
          get: { tags: ['Produits'], summary: 'Obtenir les détails d’un produit', operationId: 'getProduct', description: 'Récupère un produit, y compris sa galerie et ses avis.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID unique du produit.' }], responses: { '200': { description: 'Détails du produit', content: { 'application/json': { example: { id: 1, title: 'Essence Mascara Lash Princess', price: 9.99, rating: 4.94, stock: 5, brand: 'Essence', category: 'beauty' } } } }, '404': { description: 'Produit introuvable' } } },
          patch: { tags: ['Produits'], summary: 'Mettre à jour un produit', operationId: 'updateProduct', description: 'Le serveur de démonstration renvoie un exemple de mise à jour ; les modifications ne sont pas enregistrées.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { example: { price: 8.99, stock: 20 } } } }, responses: { '200': { description: 'Exemple de produit mis à jour', content: { 'application/json': { example: { id: 1, title: 'Essence Mascara Lash Princess', price: 8.99, stock: 20 } } } } } },
          delete: { tags: ['Produits'], summary: 'Supprimer un produit', operationId: 'deleteProduct', description: 'Le serveur de démonstration renvoie un exemple de résultat de suppression ; le catalogue n’est pas modifié.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Exemple de résultat de suppression', content: { 'application/json': { example: { id: 1, isDeleted: true, deletedOn: '2026-10-23T18:00:00.000Z' } } } } } }
        },
        '/carts/add': {
          post: { tags: ['Paniers'], summary: 'Ajouter des articles au panier', operationId: 'addToCart', description: 'Le serveur de démonstration renvoie un exemple de panier ; les écritures ne sont pas enregistrées.', requestBody: { required: true, content: { 'application/json': { example: { userId: 12, products: [{ id: 1, quantity: 2 }, { id: 4, quantity: 1 }] } } } }, responses: { '201': { description: 'Réponse d’exemple du panier', content: { 'application/json': { example: { id: 1, products: [{ id: 1, title: 'Essence Mascara Lash Princess', price: 9.99, quantity: 2, total: 19.98 }], total: 19.98, totalProducts: 2, userId: 12 } } } } } }
        },
        '/auth/login': {
          post: { tags: ['Authentification'], summary: 'Connexion du client', operationId: 'loginCustomer', description: 'Authentifie un client et renvoie un jeton d’accès.', requestBody: { required: true, content: { 'application/json': { example: { username: 'emilys', password: 'emilyspass', expiresInMins: 30 } } } }, responses: { '200': { description: 'Jeton d’accès', content: { 'application/json': { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', refreshToken: 'eyJhbGciOiJIUzI1NiJ9...', username: 'emilys' } } } }, '401': { description: 'Identifiants invalides' } } }
        }
      }
    }
  },
  {
    id: 'github',
    title: 'API REST GitHub',
    description: 'Sélection d’opérations publiques sur les profils, dépôts, tickets et demandes de fusion.',
    category: 'OPENAPI 3.1',
    raw: {
      openapi: '3.1.0',
        info: { title: 'API REST GitHub', description: 'Sélection d’opérations REST publiques ; la création d’un ticket nécessite une autorisation d’écriture sur le dépôt.', version: '2022-11-28' },
      servers: [{ url: 'https://api.github.com' }],
      paths: {
        '/users/{username}': { get: { tags: ['Utilisateurs'], summary: 'Obtenir un utilisateur', operationId: 'users/get-by-username', description: 'Récupère les informations publiques du profil d’un utilisateur GitHub.', parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string', example: 'octocat' }, description: 'Identifiant du compte utilisateur.' }], responses: { '200': { description: 'Profil utilisateur', content: { 'application/json': { example: { login: 'octocat', id: 583231, name: 'The Octocat', company: '@github', public_repos: 8, followers: 20000, type: 'User' } } } }, '404': { description: 'Utilisateur introuvable' } } } },
        '/repos/{owner}/{repo}': { get: { tags: ['Dépôts'], summary: 'Obtenir un dépôt', operationId: 'repos/get', description: 'Récupère des informations détaillées sur un dépôt public.', parameters: [{ name: 'owner', in: 'path', required: true, schema: { type: 'string', example: 'vercel' } }, { name: 'repo', in: 'path', required: true, schema: { type: 'string', example: 'next.js' } }], responses: { '200': { description: 'Détails du dépôt', content: { 'application/json': { example: { id: 70107786, name: 'next.js', full_name: 'vercel/next.js', stargazers_count: 128000, language: 'JavaScript', visibility: 'public' } } } } } } },
        '/repos/{owner}/{repo}/issues': {
          get: { tags: ['Tickets'], summary: 'Lister les tickets du dépôt', operationId: 'issues/list', description: 'Liste les tickets du dépôt, avec des filtres par état et par étiquette.', parameters: [{ name: 'owner', in: 'path', required: true, schema: { type: 'string', example: 'vercel' } }, { name: 'repo', in: 'path', required: true, schema: { type: 'string', example: 'next.js' } }, { name: 'state', in: 'query', schema: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' } }, { name: 'per_page', in: 'query', schema: { type: 'integer', default: 30 } }, { name: 'Accept', in: 'header', required: false, schema: { type: 'string', default: 'application/vnd.github+json' }, description: 'Type de média de l’API GitHub.' }], responses: { '200': { description: 'Liste des tickets', content: { 'application/json': { example: [{ number: 55802, title: 'Prise en charge d’un nouveau modèle de routage', state: 'open', user: { login: 'contributor' }, labels: [{ name: 'enhancement' }] }] } } } } },
          post: { tags: ['Tickets'], summary: 'Créer un ticket', operationId: 'issues/create', description: 'Crée un ticket dans un dépôt. Nécessite une autorisation d’écriture sur le dépôt.', parameters: [{ name: 'owner', in: 'path', required: true, schema: { type: 'string' } }, { name: 'repo', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { example: { title: 'Améliorer la mise en cache des réponses de l’API', body: 'Pourrions-nous ajouter la prise en charge d’ETag à ce point de terminaison ?', labels: ['enhancement'] } } } }, responses: { '201': { description: 'Ticket créé', content: { 'application/json': { example: { id: 3897501021, number: 72, title: 'Améliorer la mise en cache des réponses de l’API', state: 'open', html_url: 'https://github.com/vercel/next.js/issues/72' } } } }, '422': { description: 'Échec de la validation' } } }
        },
        '/repos/{owner}/{repo}/pulls': { get: { tags: ['Demandes de fusion'], summary: 'Lister les demandes de fusion', operationId: 'pulls/list', description: 'Liste les demandes de fusion d’un dépôt.', parameters: [{ name: 'owner', in: 'path', required: true, schema: { type: 'string' } }, { name: 'repo', in: 'path', required: true, schema: { type: 'string' } }, { name: 'state', in: 'query', schema: { type: 'string', default: 'open' } }], responses: { '200': { description: 'Demandes de fusion', content: { 'application/json': { example: [{ number: 84532, title: 'Ajouter la prise en charge de la mise en cache en périphérie', state: 'open', user: { login: 'octocat' }, draft: false }] } } } } } }
      }
    }
  }
];
