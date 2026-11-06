# Sources techniques de Minutrel

Références officielles consultées le 5 novembre 2026. Les choix d’architecture et de périmètre sont ceux de ce projet ; les pages ci-dessous documentent les capacités des outils proposés.

| Référence | Utilisation dans le projet |
| --- | --- |
| [Distribution des applications Tauri](https://v2.tauri.app/distribute/) | Installateurs natifs, construction et exigences de signature selon les systèmes. |
| [Installateurs Windows Tauri](https://v2.tauri.app/distribute/windows-installer/) | Formats MSI et NSIS, composants WebView2 et distribution hors ligne. |
| [Plugin SQL Tauri](https://v2.tauri.app/plugin/sql/) | Option étudiée pour le stockage local ; la V0.1 utilise finalement des fichiers JSON versionnés et isolés par espace. |
| [Validation et sérialisation Fastify](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | Validation des entrées et schémas de réponses de l’API. |
| [TypeScript avec Fastify](https://fastify.dev/docs/latest/Reference/TypeScript/) | Typage des contrats côté serveur. |
| [Docker Compose](https://docs.docker.com/compose/) | Gestion des services, réseaux et volumes d’une instance autohébergée. |
| [Licences GNU](https://www.gnu.org/licenses/licenses.en.html) | Choix d’une licence libre adaptée à un logiciel utilisable en réseau. |
| [Texte AGPL fourni par SPDX](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-or-later.txt) | Source du texte complet livré dans LICENSE. Le fichier local fait foi pour ce dépôt. |
| [Créer des issues GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue) | Organisation du backlog et utilisation des modèles de tickets. |
| [Action officielle checkout](https://github.com/actions/checkout) | Récupération du dépôt dans le workflow de contrôle documentaire. |

Les versions du socle sont verrouillées dans le dépôt. Les dépendances des futures fonctions seront choisies dans leurs lots. Les pages « latest » peuvent évoluer ; chaque livraison doit documenter les versions effectivement utilisées et leurs prérequis.

## Identité et CI

| Référence | Utilisation |
| --- | --- |
| [Recherche officielle DATA INPI](https://data.inpi.fr/) | Recherche à l’identique de Minutrel dans les entreprises et les marques. |
| [Méthode de recherche INPI](https://www.inpi.fr/ressources/propriete-intellectuelle/rechercher-une-marque-base-marques) | Portée de la recherche à l’identique et recherche de similarités. |
| [Manrope dans Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope) | Police source et licence OFL livrées dans le kit de marque. |
| [Syntaxe des workflows GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) | Événements, matrices, permissions et dépendances entre jobs. |
| [Action setup-node](https://github.com/actions/setup-node) | Installation de la version Node définie dans le dépôt. |
| [Pipeline GitHub de Tauri](https://v2.tauri.app/distribute/pipelines/github/) | Construction native par système et prérequis de distribution. |
| [actionlint](https://github.com/rhysd/actionlint) | Contrôle statique des workflows. |
| [Calendrier officiel des versions Node](https://github.com/nodejs/Release) | Choix d’une branche LTS maintenue pour le socle. |

Les domaines ont été interrogés directement auprès de leurs registres RDAP ; leurs URL et résultats figurent dans le [rapport de nom](DISPONIBILITE_NOM.md). Les versions effectivement verrouillées sont dans les fichiers npm, Cargo et de toolchain du dépôt.

## Commande rapide et connexions IA

Références officielles consultées le 5 novembre 2026 pour le périmètre ajouté au cahier des charges.

| Référence | Usage |
| --- | --- |
| [Configuration des fenêtres Tauri](https://v2.tauri.app/reference/config/) | Fenêtre épinglée et limites de présence sur plusieurs bureaux. |
| [Barre système Tauri](https://v2.tauri.app/learn/system-tray/) | Accès rapide à la commande native. |
| [Document Picture-in-Picture sur MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API) | Fenêtre web facultative et disponibilité limitée. |
| [MCP dans la documentation officielle OpenAI](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) | Connexion Codex, transports et configuration de jeton par environnement. |
| [MCP dans Claude Code](https://code.claude.com/docs/en/mcp) | Connexion HTTP et variables dans les fichiers de configuration. |
| [Compatibilité API Ollama](https://docs.ollama.com/api/openai-compatibility) | Adaptateur de synthèse vers une API partiellement compatible. |
| [Serveur compatible vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/) | Adaptateur d’inférence vers un service configuré séparément. |
| [API Messages Claude](https://platform.claude.com/docs/en/api/messages) | Adaptateur natif de génération. |
| [Hooks Claude Code](https://code.claude.com/docs/en/hooks) | Évolution facultative vers des événements de session. |

Les noms d’outils MCP Minutrel, budgets de ressources et règles de validation sont des choix de conception du projet. Les capacités documentées des fournisseurs ne prouvent pas leur intégration dans le socle actuel.

## Implémentation V0.1

Sources officielles consultées pour les fonctions réalisées :

- [SQLite intégré à Node.js](https://nodejs.org/api/sqlite.html).
- [Serveurs MCP et SDK officiel](https://modelcontextprotocol.io/docs/develop/build-server).
- [MCP dans Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
- [MCP dans Claude Code](https://code.claude.com/docs/en/mcp).
- [Compatibilité OpenAI d’Ollama](https://docs.ollama.com/api/openai-compatibility).
- [Serveur compatible OpenAI de vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/).
- [API Messages de Claude](https://platform.claude.com/docs/en/api/messages) et [versions d’API](https://platform.claude.com/docs/en/api/versioning).
- [Barre de menus Tauri](https://v2.tauri.app/learn/system-tray/), [raccourcis](https://v2.tauri.app/plugin/global-shortcut/) et [paquets macOS](https://v2.tauri.app/distribute/macos-application-bundle/).
- [Trousseau multiplateforme keyring](https://docs.rs/keyring/4.2.0/keyring/v1/index.html).
- [Service de fichiers statiques Fastify](https://github.com/fastify/fastify-static).
- [pdf-lib](https://pdf-lib.js.org/) et [son dépôt officiel](https://github.com/Hopding/pdf-lib) pour les exports PDF autonomes.
- [fflate](https://github.com/101arrowz/fflate) pour les archives ZIP locales.
- [sha2 0.10.9](https://docs.rs/sha2/0.10.9/sha2/) pour les noms de fichiers propres à chaque espace.

Les protocoles sont validés par les tests du dépôt. Un fournisseur IA réel, une exécution GitHub ou une validation sur un autre OS ne sont pas déduits de la seule présence d’une documentation.
