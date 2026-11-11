# Validation de Minutrel V0.1

## 2026-11-11 — Planning and team access

- `npm run check` passed formatting, lint, strict types, 91 tests and the web/API builds. Coverage for the measured server and domain modules was 99.12% of lines and 87.56% of branches.
- Three native tests and Clippy passed on macOS ARM64. An unsigned macOS app was built from the updated sources.
- A disposable local server passed the clock, reports, CSV/PDF/ZIP exports, MCP, live updates and restart checks. Browser sign-in and the dashboard were checked in English, French and German at 390 and 1,440 pixels.
- The tests cover the monthly export of approved time, role restrictions on hourly rates, and account changes while a desktop request is pending. AI generation uses controlled responses in the test suite.

See [GitHub Actions](https://github.com/fmacfa/minutrel/actions) for the build and container results of each published commit. Installation and offline synchronisation on real devices, production HTTPS and live AI providers require deployment-specific checks.

## 2026-11-09 — English-first GitHub and custom subcategories

The main README, contribution/security/licensing guidance, changelog, issue/PR templates, guide index and workflow labels now use English first. The French README and all EN/FR/DE user guides are retained. Existing task IDs and API routes remain compatible; the interface calls this level subcategories.

- `npm run check`: formatting, ESLint, strict types, **80 tests in 10 files**, coverage gates and web/API builds passed. Business coverage: 98.81% lines, 97.84% statements, 94.69% functions, 86.51% branches.
- New tests cover arbitrary category names, empty-name rejection, permissions, rejecting another project's category, standalone recording, active-timer archive protection and category/description retention in exports.
- Browser trial: a new demo project started with zero subcategories; the creation input had an empty value and no placeholder. A custom “Suivi clients” category was then created, and a 25-minute manual entry retained both its category and its work description. See the [empty input](screenshots/18-subcategory-empty-en.jpg) and [recorded work](screenshots/19-subcategory-work-en.jpg).
- Repository links/fixtures and all 33 brand hashes passed. The workflow passed actionlint. Initial web JavaScript: approximately **112.24 kB gzip**; the local engine and PDF libraries remain lazy-loaded.
- The macOS ARM64 app/DMG rebuilt successfully. `hdiutil verify` passed. The current unsigned `Minutrel_0.1.0_aarch64.dmg` is **5,948,333 bytes**, SHA-256 `3869cf1ee8aea544afe154a7aff215992254cb94e287e7f5ae053887478bce64`.

These are local checks. The [GitHub Actions page](https://github.com/fmacfa/minutrel/actions) is the source for remote runs on each published commit. This change does not claim new Windows/Linux manual testing, load measurements or an independent security audit. The older records below describe their original dates and artefacts.

## Relevé historique des 5 et 6 novembre

Contrôles locaux des 5 et **6 novembre 2026**, sur macOS ARM64, avec Node.js 24.22.1 et Rust 1.99.1. Les résultats du 6 novembre incluent l’autonomie, la file hors connexion, les langues, les exports locaux et les guides. Les essais de conteneurs du 5 novembre sont distingués ci-dessous ; ils ne constituent pas une reconstruction des extensions du 6 novembre.

## Résultats

| Contrôle | Résultat observé |
| --- | --- |
| Format, ESLint et TypeScript strict | Réussis |
| Vitest | **78 tests réussis**, dans 10 fichiers |
| Couverture métier configurée | **98,81 % des lignes**, 97,84 % des instructions, 94,69 % des fonctions, 86,51 % des branches |
| Audit npm | 0 vulnérabilité signalée au moment du contrôle |
| Builds web et API | Réussis ; **112,05 Ko de JavaScript gzip initial**, moteur local et bibliothèques PDF chargés à la demande |
| Rust | fmt, **2 tests** et clippy avec refus des avertissements réussis |
| macOS | Application et DMG ARM64 construits ; intégrité du DMG vérifiée par hdiutil |
| Connexion ordinateur/web | Même compte et même espace ; parcours web/widget vérifié le 5 novembre ; transfert d’un temps personnel retrouvé sur le web le 6 novembre |
| Widget | Ouverture, projet, pause, reprise et arrêt essayés ; widget autonome et hauteur adaptée vérifiés sans serveur |
| Autonomie | Projet personnel créé, serveur arrêté, temps mis en pause, logiciel quitté/réouvert, pause retrouvée, reprise et arrêt ; **15 secondes finalisées** puis transférées à l’équipe |
| Démarrage autonome | Un blocage du trousseau au démarrage a été corrigé : aucune lecture du trousseau en mode personnel, chargement en arrière-plan en mode équipe ; réouverture autonome vérifiée après correction |
| File hors connexion | Tests de conservation après réouverture, accusés répétés, modification pendant envoi, changement d’espace, conflits et versions ; recette visuelle du paquet final : serveur arrêté, démarrage/pause/arrêt, **8 secondes** en attente, envoi automatique au retour du serveur et une seule entrée retrouvée sur le web |
| Export autonome | PDF produit sans serveur jusqu’au dialogue d’enregistrement ; tests CSV/PDF/ZIP, texte long, accents, pagination, secondes et protection contre les formules CSV |
| Langues | Catalogues et paramètres testés ; vues françaises, anglaises et allemandes contrôlées et capturées ; contenus utilisateur conservés dans leur langue |
| Responsive | Largeurs 320, 390, 768 et 1280 px contrôlées ; page sans débordement global sur les vues essayées, tableaux à défilement interne |
| Serveur | Persistance après redémarrage, sauvegarde ouverte et restauration avec clé vérifiées |
| Protocole MCP | Client officiel connecté réellement en HTTP, outils et droits testés, révocation effective |
| IA de rédaction | Adaptateurs testés avec réponses contrôlées ; aucun fournisseur payant sollicité |
| Webhook entrant | Droits personnels, affectation de projet, note privée, répétition et révocation testés ; aucun webhook sortant annoncé |
| Rapports | CSV/PDF/ZIP testés sur un instantané commun ; brouillons privés exclus |
| PDF d’exemple | Deux pages rendues et inspectées, pagination et glyphes vérifiés |
| Docker, état du 5 novembre | Images API/web construites ; recette comptes, temps, exports, SSE et MCP passée derrière nginx ; reconstruction des extensions du 6 novembre à exécuter |
| Production Compose, état du 5 novembre | Processus non privilégié, racine en lecture seule, volumes et sauvegarde/restauration essayés |
| Documents et marque | Liens et fixtures de **54 fichiers Markdown** vérifiés ; 33 ressources et empreintes de marque vérifiées ; guides utilisateur FR/EN/DE et captures réelles sur données fictives |
| GitHub Actions | Workflow accepté par actionlint 1.7.12 |

La couverture chiffrée concerne le domaine et les modules métier du serveur. Les tests du client font aussi partie des 78 tests, sans être inclus dans ces seuils. Aucun résultat ne mesure l’accessibilité exhaustive ou tous les gestes sur tous les systèmes.

La recette visuelle initialement interrompue par le verrouillage du Mac a été terminée après déverrouillage, le 6 novembre. Le paquet final a retrouvé sa session après relance. Pendant la coupure, l’historique personnel est resté affiché ; le temps fictif « Recette équipe : temps saisi hors connexion » a été finalisé à 8 secondes. Au retour du serveur, la file s’est vidée sans clic sur Actualiser et l’état est redevenu « Espace synchronisé ». L’historique web comptait 9 entrées, dont une seule pour ce temps, avec exactement `00:00:08`. Voir [l’attente locale](screenshots/16-equipe-hors-connexion.png) et [la réception web](screenshots/17-temps-synchronise-web.jpg).

## Paquet macOS contrôlé

Fichier : `Minutrel_0.1.0_aarch64.dmg`. Taille : **5 947 932 octets**. SHA-256 :

```text
d3c6a61d6646674bf1af15a9cc4b4bf8fb4430a2d28ebfbdf0a97eec4577c585
```

Le paquet final est un paquet de test local, non signé/notarisé pour diffusion publique. L’application décompressée représente environ 16 Mio et le DMG environ 5,67 Mio. Ce paquet cible ARM64 ; les autres architectures se construisent sur leur cible ou via une matrice adaptée.

## Mesure ponctuelle de conteneur

Le 5 novembre, dans une VM Linux ARM64 isolée de 2 vCPU et 3 Gio, après la recette fonctionnelle sur un petit jeu de données, `docker stats` a relevé **59,25 Mio** et **0,05 % CPU** pour le conteneur de production (limite 768 Mio), sans moteur IA. Le proxy nginx de la variante à deux services occupait environ 3,5 Mio. Il s’agit d’un relevé ponctuel de l’état du 5 novembre, pas d’un pic mesuré ni d’une campagne de charge des extensions du 6 novembre.

Les objectifs de 50 comptes, 20 utilisateurs simultanés, 500 projets et 100 000 temps restent à éprouver. La mémoire de l’ensemble des processus natifs/WebView et la consommation sur les trois systèmes restent à mesurer selon [RESSOURCES.md](RESSOURCES.md).

## Ce qui reste à confirmer hors de ce poste

À la date de ce relevé du 6 novembre, aucun dépôt distant ni run GitHub n’avait été créé par ce travail local. Le dépôt a depuis été publié à [fmacfa/minutrel](https://github.com/fmacfa/minutrel) ; consulter ses exécutions pour le commit concerné. Les matrices Windows et Linux doivent être complétées par une recette terrain. Reconstruire les conteneurs du même commit avant publication. La signature des paquets, leur mise à jour automatique, les modèles IA réels, un audit de sécurité indépendant, la charge et la restauration locale sur un autre poste restent à valider, comme décrit dans [le backlog](BACKLOG.md) et [la liste avant publication](PRE_PUBLICATION.md).
