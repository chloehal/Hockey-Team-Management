# Les Panthères — gestion d’équipe

Interface React pour les joueuses et les coachs : présences, feuille de match, arbitrage, annonces, notes et règles du collectif. Design shadcn/ui neutre, angles droits, navigation mobile.

## Architecture

- `src/pages/` : écrans équipe, présences, sélection, coach et fonctionnement.
- `src/components/` : composants partagés et primitives shadcn/ui.
- `src/hooks/useTeam.js` : chargement, cache de lecture et mutations.
- `src/lib/api.js` : contrat HTTP avec l’API PHP existante.
- `src/lib/selection.js` : règles de sélection pures, partagées entre les deux espaces.
- `src/lib/content.js` : calendrier des matchs et URL Google Calendar existants.
- `api.php`, `player-evaluations.php` : API PHP, étendue pour les évaluations coach. `setup.sql` : schéma historique inchangé.

Le frontend est écrit en JavaScript/JSX avec React et Vite. PHP reste responsable des données. Aucune migration de base n’est nécessaire pour cette refonte.

## Développement

```sh
npm ci
npm run dev
```

Vite attend une API PHP de développement sur `http://127.0.0.1:8000`. Configurer un `config.php` local avec une base de développement puis lancer `php -S 127.0.0.1:8000`. `API_PROXY_TARGET` permet de changer cette cible. Ne pas utiliser la base de production pour les essais.

## Démonstration sans base de données

Dans deux terminaux :

```sh
node scripts/demo.mjs
```

```sh
API_PROXY_TARGET=http://127.0.0.1:8020 VITE_DEMO=true npm run dev -- --port 5183
```

Mot de passe coach de démonstration : `demo`. Les données restent en mémoire et sont réinitialisées au redémarrage. Le changement de mot de passe n’est pas simulé.

## Vérifications

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Les tests navigateur interceptent l’API ; ils n’écrivent dans aucune base réelle. Le cache permet de lire les dernières données si le réseau échoue, mais bloque alors les mutations.

## Déploiement PHP / Hostinger

`npm run build` produit `dist/` avec `index.html`, `coach.html`, les assets, `api.php`, `player-evaluations.php` et la règle `.htaccess` conservant `/coach`. Les routes du frontend utilisent un hash et ne nécessitent pas de réécriture SPA.

`config.php` est volontairement exclu du build et de Git : conserver le fichier privé existant **à côté de `api.php` sur l’hébergement PHP**. Déployer sans effacer ce fichier. Un hébergement statique ou un serveur Node seul ne suffit pas à exécuter l’API PHP. Si Hostinger remplace intégralement le répertoire à chaque publication, configurer explicitement la conservation/injection privée de ce fichier avant de mettre la refonte en production.

Vérifier après publication que l’accueil et `api.php?action=get_players` répondent correctement. Ne pas exécuter `setup.sql` sur la base existante : ce fichier documente son installation historique, pas une étape de migration.

Le nouveau service worker retire seulement les anciens caches `pantheres-*`, afin de ne pas conserver l’ancienne interface après publication.

## Règles conservées

- Priorité aux présences sur les 3 puis 5 derniers entraînements.
- Gardienne choisie lorsqu’il y en a plusieurs, remplaçante choisie s’il n’y en a aucune.
- Maximum 16 sélectionnées ; départage aux seuils selon les postes, niveaux et besoins d’équipe ; les égalités restantes restent à délibérer.
- Ajustements manuels des postes, glisser-déposer sur ordinateur et contrôles accessibles sur mobile, banc, impression et export PNG.
- Deux arbitres maximum par date, copie des dates à couvrir.
- Les dates de matchs restent configurées dans le code, comme auparavant.

La protection de l’espace coach conserve le comportement de l’API existante ; cette refonte frontend ne constitue pas une refonte de l’authentification serveur.


### Évaluations coach

Sept critères de même poids, de 0 à 10 (décimales acceptées) : technique, physique, stratégie, placement, esprit d’équipe, puissance, précision. La moyenne est calculée lorsque les sept notes sont remplies. Les cases vides ne valent pas zéro.

Les scores sont enregistrés en JSON dans la table `settings` existante, sous `player_evaluation_{id}` : aucune migration SQL. Les deux nouvelles actions POST `get_player_evaluations` et `save_player_evaluation` vérifient le mot de passe coach côté PHP. Ces notes ne sont ni incluses dans les réponses publiques ni dans le cache local.

La sélection coach utilise la moyenne pour départager les joueuses à présences et priorité de composition égales, à la place de l’ancien niveau. Si une évaluation du groupe est incomplète, le départage reste manuel. Les moyennes égales restent à délibérer. Enregistrer une note invalide la feuille coach générée, à recalculer. La feuille publique conserve les règles historiques, sans accès aux notes privées. Le champ historique `level` reste conservé en base.

Validation serveur sans base réelle : `php tests/evaluations.php`.
