# Contrats à relire

Statut : proposition de ports TypeScript uniquement, autorisée le 24 octobre 2026.
Aucun cas d'usage, adaptateur, endpoint, calcul de régression ou écran n'est implémenté.

## Lire les contrats

- [Types du domaine](../src/domain/types.ts) : tableau, relevé, modèles, projections et résultats.
- [Port entrant ResourceTracking](../src/application/ports/incoming.ts) : actions accessibles aux adaptateurs d'entrée.
- [Ports sortants](../src/application/ports/outgoing.ts) : BoardStore pour la persistance et ForecastEngine pour les calculs purs.

Le contrat de calcul est une frontière interne du domaine, pas un service externe à déployer.
Les signatures ne dépendent d'aucune bibliothèque. Les imports .js sont intentionnels pour TypeScript avec résolution NodeNext.

## Choix proposés pour la revue

- L'identité est fournie explicitement par Actor, produit par l'adaptateur d'authentification. Aucun port ne lit les headers du proxy.
- BoardStore groupe les opérations des tableaux et relevés pour que chaque mutation puisse vérifier son propriétaire de manière atomique. Il n'expose aucune transaction SQL.
- Les identifiants sont créés par l'adaptateur de persistance. Ils sont opaques pour l'application.
- Les erreurs attendues sont des Result au port entrant ; une ressource absente et celle d'un autre utilisateur produisent toutes deux not-found.
- Les échecs inattendus d'infrastructure rejettent les promesses ; l'adaptateur HTTP devra les convertir en erreur serveur sans fuite d'informations.
- Les réglages d'un tableau incluent ses modèles sélectionnés ; les couleurs et traductions appartiennent à l'interface.
- Les dates sont des nombres en millisecondes UTC. L'affichage et la saisie locale relèvent de l'adaptateur ; aucun fuseau n'est perdu dans un instant.
- Le calcul reçoit asOf explicitement pour être déterministe. La durée restante est mesurée depuis cet instant, normalement maintenant.
- sampleAt permet au consommateur de choisir les instants de tracé sans dépendre d'ECharts ni imposer un pas de temps au domaine.
- Les points prédits ne sont pas tronqués à zéro ; l'interface décidera du cadrage visuel.
- Les valeurs et instants doivent être finis. La politique métier sur les valeurs négatives, croissantes et les doublons de dates reste à décider avant l'implémentation. L'ordre par id départage les dates égales de façon déterministe sans définir leur acceptation.
- Le modèle récent utilise jusqu'à cinq points et fonctionne dès deux dates distinctes dans sa fenêtre : décision déléguée à l'assistant par le propriétaire.
- Une tendance plate ou croissante n'annonce aucun épuisement. Une date de passage à zéro déjà passée dispose d'un état distinct.
- L'effacement global préserve nom, unité et modèles ; la confirmation relève de l'interface.

## Périmètre de cette étape

La stack Vue/TypeScript, Fastify, Drizzle et SQLite est désormais explicitement validée.
Les deux écrans présentés sont des propositions : liste des tableaux et détail avec relevés et graphique.
Le propriétaire a autorisé uniquement les ports pour examiner les contrats avant la suite.

La compilation stricte des contrats est la validation pertinente ici ; les tests de calcul et d'isolation nécessiteront les implémentations. Aucun test d'exécution n'est revendiqué.

## Points de revue

1. L'ensemble des actions du port entrant convient-il ?
2. La persistance regroupée dans BoardStore offre-t-elle le bon niveau de contrat ?
3. La représentation des erreurs, dates et projections convient-elle ?
4. Après validation des contrats, choisir les politiques métier encore ouvertes avant d'implémenter les cas d'usage.
