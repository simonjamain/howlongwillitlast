# Reprise du projet — How Long Will It Last?

Dernière synthèse : 24 octobre 2026. Source : conversation de cadrage avec le propriétaire et documents initiaux du dépôt.

## État et autorisation

Le propriétaire a relu et validé les ports, puis autorisé une première version complète. Il a aussi demandé la publication automatique de l'image sur GitHub Container Registry en CI et autorisé l'envoi de la branche.

La branche de travail est feat/domain-ports. Elle contient désormais le domaine de calcul, les cas d'usage, les adaptateurs HTTP/SQLite, l'interface Vue FR/EN, le Dockerfile, Compose et la CI GHCR. Voir README.md pour les commandes et API.md pour les routes.

Validations locales : compilation TypeScript/Vue et build Vite réussis ; 10 tests de calcul/API avec SQLite réel réussis ; parcours Playwright desktop et mobile réussis (création, saisie, projection, édition, sélection persistante des modèles, langues et reset). Les captures ont été inspectées séparément. TypeScript 6.0.2 est épinglé pour vue-tsc ; PrimeVue 4 est conservé.

Limite : aucun moteur Docker local. La CI construit le conteneur, vérifie le redémarrage avec persistance et publie seulement après ces vérifications. Consulter le résultat effectif de GitHub Actions avant d'affirmer que l'image est publiée.

Les changements de revue ont conservé les signatures des ports ; le formatage a seulement été normalisé.

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

La stack a depuis été explicitement validée par le propriétaire. Ces choix sont compatibles avec le cadrage actuel. Les conserver sauf instruction ultérieure ou obstacle concret à expliquer.

## Architecture retenue et implémentée

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
1. Décision désormais prise, par délégation du propriétaire : le modèle récent utilise jusqu'aux cinq derniers relevés dès deux dates distinctes dans cette fenêtre.
2. Décision de V1 : accepter les dates identiques, les valeurs négatives et croissantes ; deux dates distinctes restent nécessaires dans la fenêtre de calcul. Valeurs bornées à ±1e12 et dates au domaine représentable par JavaScript.
3. Décision de V1 : UTC en millisecondes en stockage/API, saisie et affichage en heure locale ; durée depuis asOf, envoyé à maintenant par l'interface. Rafraîchissement après édition, au retour du focus et par bouton ; pas de décompte animé.
4. En-tête configurable IDENTITY_HEADER, défaut x-forwarded-user. Le déploiement réel doit confirmer le champ stable transmis par le proxy ; aucune configuration IdP spécifique n'est devinée.
5. Deux écrans implémentés ; les deux modèles sont sélectionnés par défaut. CI : tag de branche, sha complet et latest sur la branche par défaut. Le déploiement sur l'infrastructure du propriétaire reste à faire.

Seuls les points qui changent réellement le comportement utilisateur nécessitent une question. Les choix techniques courants peuvent être faits et documentés.

## Hors périmètre actuel

Aucun besoin exprimé pour : partage de tableaux, rôles administrateur globaux, suivi des remplissages, conversions d'unités, saisonnalité, prévisions météo, notifications, import/export, authentification intégrée ou orchestration multi-conteneurs obligatoire. Les ajouter seulement sur demande.

## Marche à suivre à la reprise

1. Vérifier la branche et les instructions courantes, puis consulter les résultats CI du dernier commit.
2. Exécuter les scripts documentés dans README.md après toute modification pertinente.
3. Vérifier le déploiement réel avec le proxy choisi et un volume persistant. Confirmer l'identifiant stable de l'utilisateur et l'absence d'accès direct.
4. Mettre à jour ce document avec les résultats effectifs de construction/publication et les limitations restantes.
5. Toute évolution du schéma ajoute une migration versionnée ; le SQL de bootstrap version 1 est une migration immuable, distincte du schéma Drizzle utilisé par les requêtes.

## Sources

- [README initial et présentation du projet](https://github.com/simonjamain/howlongwillitlast/blob/main/README.md)
- [Contribution](https://github.com/simonjamain/howlongwillitlast/blob/main/CONTRIBUTING.md)
- [Sécurité](https://github.com/simonjamain/howlongwillitlast/blob/main/SECURITY.md)
- Conversation de cadrage du 24 octobre 2026 avec le propriétaire : décisions retranscrites ci-dessus, sans lien public disponible.
