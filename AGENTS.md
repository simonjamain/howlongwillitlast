# Instructions de reprise

Avant de cadrer, implémenter ou revoir une fonctionnalité, lire [docs/HANDOFF.md](docs/HANDOFF.md) : décisions produit, architecture, provenance des choix, points ouverts et état de reprise.

- Respecter la demande courante du propriétaire. Le propriétaire a validé les contrats puis autorisé la V1 complète et sa publication GHCR automatique en CI. Lire [docs/PORTS.md](docs/PORTS.md) pour cette proposition.
- Garder une architecture hexagonale légère et un déploiement dans une seule image Docker avec SQLite persistant.
- Pour l'identité, les contrôles d'accès ou le déploiement, lire aussi [SECURITY.md](SECURITY.md).
- Pour contribuer, suivre [CONTRIBUTING.md](CONTRIBUTING.md).
- Mettre à jour le document de reprise après un changement de décision ou une étape de développement, en distinguant propositions, implémentation et validations réellement exécutées.
- Chercher les commandes de développement et de test dans les fichiers du projet lorsqu'ils existent ; les scripts npm actuels décrivent les vérifications exécutables.
