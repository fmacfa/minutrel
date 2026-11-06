# Exploitation

Le [Compose principal](../compose.yml) lance l’application complète avec un volume SQLite. L’[image nginx](docker/README.md) reste disponible comme proxy séparé. Les [sauvegardes](backup/README.md) sont réalisées par l’API SQLite, clé comprise.

[Guide d’autohébergement](../docs/AUTOHEBERGEMENT.md).
