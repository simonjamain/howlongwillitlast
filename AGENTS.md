# Instructions de reprise

Avant de cadrer, implémenter ou revoir une fonctionnalité, lire [docs/HANDOFF.md](docs/HANDOFF.md) : décisions produit, architecture, provenance des choix, points ouverts et état de reprise.

- Respecter la demande courante du propriétaire. L'étape actuellement autorisée porte uniquement sur les ports et les types associés, à relire avant toute implémentation. Lire [docs/PORTS.md](docs/PORTS.md) pour cette proposition.
- Garder une architecture hexagonale légère et un déploiement dans une seule image Docker avec SQLite persistant.
- Pour l'identité, les contrôles d'accès ou le déploiement, lire aussi [SECURITY.md](SECURITY.md).
- Pour contribuer, suivre [CONTRIBUTING.md](CONTRIBUTING.md).
- Mettre à jour le document de reprise après un changement de décision ou une étape de développement, en distinguant propositions, implémentation et validations réellement exécutées.
- Chercher les commandes de développement et de test dans les fichiers du projet lorsqu'ils existent ; aucun code ni script applicatif n'existait lors du cadrage initial.
