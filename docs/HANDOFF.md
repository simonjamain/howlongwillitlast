# Reprise du projet — How Long Will It Last?

Dernière synthèse : 24 octobre 2026. Source : conversation de cadrage avec le propriétaire et documents initiaux du dépôt.

## État et autorisation

Au moment de cette synthèse, la branche main ne contient aucun code applicatif : uniquement README.md, CONTRIBUTING.md, SECURITY.md, LICENSE et .gitignore, auxquels s'ajoutent ces documents de reprise.

Le propriétaire a explicitement demandé de préciser le projet avant tout code. La présente tâche autorise la documentation, pas le démarrage de l'implémentation. À la reprise, lire la demande courante : si elle autorise le développement, poursuivre sans demander à nouveau une autorisation déjà donnée. Sinon, rester au cadrage.

Aucune application, image Docker, migration, API ou suite de tests n'a encore été produite ou validée.

## Besoin et vocabulaire

L'application estime combien de temps une réserve va durer à partir de relevés irréguliers. Premier usage : niveau d'une cuve de fioul. Autres usages cités : bûches, litres, centimètres dans une cuve, euros.

- Tableau de relevés : série indépendante appartenant à un utilisateur, avec une unité libre.
- Relevé : valeur numérique et date-heure de la mesure.
- Proposition de calcul : modèle de régression incluant sa règle de sélection des relevés.
- Projection : représentation du modèle dans le temps et estimation éventuelle de son passage à zéro.

L'application traite les valeurs saisies dans leur unité. Aucune conversion de hauteur en volume ou connaissance de la géométrie d'une cuve n'a été demandée.

## Décisions explicites de la conversation

- Chaque utilisateur dispose de ses propres tableaux, qu'il administre.
- Plusieurs tableaux indépendants ; unité choisie librement.
- Relevés à intervalles quelconques. La date ET l'heure sont préremplies à l'instant présent et modifiables pour une saisie rétroactive.
- Plusieurs propositions de régression sélectionnables simultanément par tableau, avec des couleurs distinctes.
- La fenêtre de points fait partie de la proposition : pas besoin d'un sélecteur de période indépendant en V1.
- Deux propositions initiales acceptées : régression linéaire sur tous les relevés et régression linéaire sur les cinq derniers relevés.
- Afficher pour chaque modèle une durée restante et une date d'épuisement lorsque le calcul permet de prévoir un passage à zéro.
- Après un remplissage, la solution V1 consiste à effacer tous les relevés du tableau et recommencer. Aucun historique de cycles ni compensation des apports n'est demandé.
- Une confirmation de cet effacement a été proposée par l'assistant ; elle constitue la recommandation de conception, pas une demande explicite distincte du propriétaire.
- Livraison attendue : application autonome dans une seule image Docker, SQLite sur volume persistant.
- Authentification déléguée à OAuth2 Proxy ; l'application reçoit l'identité dans des en-têtes. Aucun écran de connexion ou mot de passe local demandé.
- Simplicité du code et peu de complexité opérationnelle.
- Architecture hexagonale légère : domaine, ports, adaptateurs.
- Vue + TypeScript côté interface et Node.js + TypeScript côté serveur retenus dans le cadrage.

## Choix issus du README initial, conservés dans la proposition

Le propriétaire a demandé de lire et rapprocher ces documents de la conversation. L'assistant a proposé de conserver les éléments ci-dessous ; ils ne sont pas chacun une validation orale indépendante :

- Interface adaptée en priorité au mobile.
- Français et anglais, choisis selon les préférences du navigateur.
- Modification et suppression individuelles des relevés.
- Vue 3, Vite, PrimeVue, Apache ECharts ; Fastify, Drizzle ORM et SQLite.
- Mode de développement explicitement activé, avec un unique utilisateur de test fixe.
- Licence MIT.

Ces choix sont compatibles avec le cadrage actuel. Les conserver sauf instruction ultérieure ou obstacle concret à expliquer.

## Architecture proposée — à implémenter

Le domaine contient les règles des tableaux, des relevés et des calculs, sans dépendance à Vue, Fastify, Drizzle ou aux en-têtes HTTP.

Les cas d'usage coordonnent ces règles avec des ports minimaux. Les adaptateurs assurent la persistance SQLite et l'accès HTTP ; l'adaptateur HTTP traduit les en-têtes du proxy en identité pour les cas d'usage. Le contrôle de propriété s'applique à chaque lecture et mutation, y compris aux relevés et à l'effacement global.

Le serveur peut servir le frontend compilé et l'API dans un seul conteneur. Ce mode de distribution est proposé ; aucune arborescence ni bibliothèque supplémentaire n'est imposée. Garder les abstractions proportionnées au besoin.

## Sécurité à préserver

Voir aussi [SECURITY.md](../SECURITY.md).

- En production, accès à l'application uniquement par le proxy authentifiant.
- Le proxy supprime les en-têtes d'identité fournis par le client avant de poser les siens.
- Refuser les requêtes sans identité valide ; ne jamais basculer implicitement sur l'utilisateur de développement.
- Le mode de développement est explicite et désactivé en production.
- Vérifier la propriété des ressources côté serveur ; masquer une action dans l'interface ne suffit pas.
- Exclure secrets, bases et artefacts générés du dépôt.

Les noms exacts des en-têtes et le champ utilisé comme identifiant durable restent à déterminer à partir du déploiement réel. Ne pas présenter une adresse e-mail ou un nom d'en-tête comme déjà convenu.

## Calculs : contraintes et points ouverts

Les deux régressions et leurs fenêtres sont décidées. Les règles ci-dessous restent des recommandations techniques à préciser lors de l'implémentation :

- Utiliser le temps réellement écoulé entre les mesures, pas leur indice, pour respecter les intervalles irréguliers.
- Définir les « cinq derniers » par la date de mesure, pas l'ordre de saisie.
- Prévoir un état explicite si les données ne permettent pas une régression : trop peu de dates distinctes, par exemple.
- Pour une pente nulle ou croissante, indiquer qu'aucun épuisement futur n'est prédit par ce modèle.
- Distinguer une date de passage à zéro déjà passée d'une durée future.
- Ne pas présenter une projection comme une garantie ; aucun intervalle de confiance n'est demandé.

À trancher sans rouvrir les décisions déjà prises :
1. Le modèle « cinq derniers » est-il indisponible avant cinq relevés, ou utilise-t-il les points disponibles dès que le calcul est possible ?
2. Politique pour des relevés ayant exactement la même date-heure, les valeurs négatives et les valeurs ponctuellement croissantes.
3. Stockage et affichage des fuseaux horaires, et référence de la durée restante (instant présent recommandé).
4. Noms des en-têtes d'identité, identifiant stable et configuration du proxy.
5. Détails d'interface, valeurs par défaut des modèles sélectionnés et distribution de l'image Docker.

Seuls les points qui changent réellement le comportement utilisateur nécessitent une question. Les choix techniques courants peuvent être faits et documentés.

## Hors périmètre actuel

Aucun besoin exprimé pour : partage de tableaux, rôles administrateur globaux, suivi des remplissages, conversions d'unités, saisonnalité, prévisions météo, notifications, import/export, authentification intégrée ou orchestration multi-conteneurs obligatoire. Les ajouter seulement sur demande.

## Marche à suivre à la reprise

1. Lire ce document, puis vérifier l'état réel du dépôt et la demande courante. Ce document est une photographie du cadrage, pas une preuve que le dépôt est toujours vide.
2. Conserver les décisions ci-dessus ; présenter les éventuels écarts avec les nouvelles instructions.
3. Si le développement est demandé, résoudre les seuls points ouverts nécessaires, puis construire une première tranche : identité, tableau personnel, relevés persistants, graphique et régressions.
4. Vérifier les calculs sur des séries à intervalles irréguliers, la sélection des derniers relevés, les cas sans épuisement, l'isolation entre utilisateurs et la persistance après redémarrage.
5. Vérifier ensuite l'édition, la suppression, la remise à zéro, les deux langues et l'usage mobile ; construire et tester l'image Docker.
6. Mettre à jour les instructions d'installation et ce document avec les résultats réels, les commandes disponibles, les validations effectuées et les limites restantes. Une étape est terminée quand son comportement est vérifié, pas quand son code est simplement écrit.

## Sources

- [README initial et présentation du projet](https://github.com/simonjamain/howlongwillitlast/blob/main/README.md)
- [Contribution](https://github.com/simonjamain/howlongwillitlast/blob/main/CONTRIBUTING.md)
- [Sécurité](https://github.com/simonjamain/howlongwillitlast/blob/main/SECURITY.md)
- Conversation de cadrage du 24 octobre 2026 avec le propriétaire : décisions retranscrites ci-dessus, sans lien public disponible.
