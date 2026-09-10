# Refonte React — 10 septembre 2026

## Périmètre

Remplacer les deux pages HTML avec scripts intégrés par une application React modulaire, compatible avec les endpoints et la base existants. Conserver shadcn/ui, angles droits et priorité mobile comme sur la bibliothèque, avec des repères discrets de terrain de hockey.

## Décisions

Le schéma reste inchangé. L’API PHP historique est conservée et étendue par deux actions protégées pour les évaluations coach dans la table settings existante. Les écrans coach et équipe partagent le même moteur de sélection, extrait de la version coach qui détaille déjà les motifs. Le calcul devient pur : les annotations de match n’altèrent pas les fiches reçues de l’API. Les choix et disponibilités d’un match restent locaux, comme auparavant.

Les composants React rendent toutes les données utilisateur comme texte. Les règles statiques sont des composants JSX. Les erreurs HTTP et JSON restent visibles dans les formulaires, sans effacer leur saisie. Les changements sont sérialisés et suivis d’un rechargement des ressources.

Le dépôt cesse de versionner `node_modules` et le CSS généré. Le lockfile est la référence d’installation. Le build comprend le backend PHP public, mais jamais la configuration privée de connexion.

## Validation

Tests des actions PHP, erreurs HTTP, présences, gardienne de remplacement, égalités, limite de sélection et absence de mutations des objets source. Tests navigateur avec API simulée : navigation à 320 px, sauvegarde des présences, sélection, accès coach et saisie conservée lors d’un échec. Vérification visuelle à 390 px et 1440 px.

Aucun appel de mutation vers la production. L’aperçu utilise des joueuses fictives. Les intégrations Google Calendar et l’hébergement PHP restent à vérifier dans leur environnement réel avant publication.
