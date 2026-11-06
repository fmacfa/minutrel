# Assistants et moteurs IA — V0.1

Guide vidéo en anglais : [connecter un assistant avec des droits limités (MP4)](videos/minutrel-11-assistants.mp4). [Tous les guides et sous-titres](VIDEOS.md).

Minutrel fonctionne entièrement sans IA. Aucun modèle n’est embarqué dans le serveur de temps ou les clients. Les connexions sont facultatives et configurées par leur utilisateur ou l’administrateur.

## Codex d’OpenAI et Claude Code

Le serveur expose **`/mcp`** avec Streamable HTTP et le SDK officiel MCP. Dans **Les connexions**, chaque membre crée un accès personnel nommé, valable de 1 à 365 jours, puis copie son secret une seule fois. Seule une empreinte est conservée dans la base. Le jeton peut être révoqué à tout moment ; une désactivation ou un changement de rôle révoque aussi les accès concernés.

| Droit | Outils |
| --- | --- |
| `projects.read` | `minutrel_list_projects` : projets affectés personnellement, même pour un administrateur |
| `time.read_own` | `minutrel_get_my_timer`, `minutrel_list_my_times` : lecture personnelle, temps paginés par mois |
| `work.read_own` | `minutrel_get_my_work_summary` : notes et comptes rendus personnels du mois |
| `work.draft_own` | `minutrel_create_work_note_draft` : proposition privée à relire, jamais publiée automatiquement |
| `timer.write_own` | `minutrel_start_my_timer`, `minutrel_pause_my_timer`, `minutrel_resume_my_timer`, `minutrel_stop_my_timer` |

Le dernier droit n’est pas sélectionné par défaut. Un jeton ne donne pas d’administration, d’export collectif, de correction manuelle des durées ou de lecture des temps d’autrui. Les commandes de chronomètre demandent les mêmes versions et clés d’idempotence que l’interface.

Le même droit `work.draft_own` permet le [webhook entrant de brouillons privés](API_WEBHOOKS.md), pour un outil qui ne parle pas MCP. Ce point d’entrée ne modifie aucune heure. L’espace autonome fonctionne sans ces connexions ; les intégrations de cette version utilisent le serveur d’équipe.

Le panneau fournit une configuration Codex et Claude Code avec `MINUTREL_MCP_TOKEN`. Des exemples portables sont dans [examples/integrations](../examples/integrations/README.md). La configuration Codex utilise une URL HTTP et `bearer_token_env_var`, selon sa [documentation officielle](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Claude Code accepte un serveur HTTP et des variables d’environnement dans sa [configuration MCP](https://code.claude.com/docs/en/mcp).

## Ollama, vLLM et Claude

L’administrateur configure un profil : nom, type d’API, URL de base `/v1`, modèle disponible, clé facultative et activation. Aucun identifiant de modèle n’est imposé.

- Ollama et vLLM : `POST /v1/chat/completions`, format compatible OpenAI.
- Claude : `POST https://api.anthropic.com/v1/messages`, en-tête de version `2026-10-21` et clé côté serveur.

Le serveur accepte seulement les hôtes de `APP_AI_ALLOWED_HOSTS` et ne suit pas les redirections. Les clés sont chiffrées AES-256-GCM. Changer le destinataire d’une clé exige de la remplacer ou de l’effacer.

## Générer un compte rendu

Le membre choisit le mois et le fournisseur dans **Le fil du travail**. Le formulaire explique que ses descriptions et notes, y compris privées, seront envoyées au destinataire choisi, puis demande son accord explicite. Les entrées d’autres membres ne sont pas jointes.

Le texte reçu devient un brouillon privé. L’auteur peut le corriger et le valider pour le rapport. Les références des temps sources sont conservées ; les chiffres restent calculés séparément. Les descriptions sont traitées comme des données, et aucun outil n’est fourni au moteur de rédaction pour exécuter leurs éventuelles instructions.

Une génération est limitée à 500 temps et 80 000 caractères d’entrée, 1 200 jetons de sortie et 60 secondes de requête fournisseur. Le serveur sérialise les générations et borne l’attente. Une seule génération peut être en cours par membre. La fenêtre de rédaction peut être fermée pendant ce traitement ; le chronomètre reste utilisable.

Les adaptateurs sont testés avec des réponses contrôlées ; le protocole MCP est testé de bout en bout avec son client officiel. L’exploitation d’un modèle réel requiert sa configuration et une recette sur l’infrastructure choisie. Aucune lecture automatique des dossiers locaux, des captures d’écran ou des conversations Codex/Claude n’est effectuée. Les hooks automatiques de sessions sont hors V0.1.
