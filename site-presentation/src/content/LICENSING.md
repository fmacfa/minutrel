# Licence de Minutrel

Le contenu original du dépôt est placé sous **GNU Affero General Public License, version 3 ou toute version ultérieure**, identifiant SPDX `AGPL-3.0-or-later`. Le texte intégral figure dans [LICENSE](LICENSE).

Ce choix permet la modification et la redistribution du projet sous les conditions de cette licence et prévoit un partage du code source correspondant dans le cas des versions modifiées avec lesquelles des utilisateurs interagissent à distance, selon sa section 13. Le texte de la licence précise les obligations applicables. La Free Software Foundation présente ses [licences et leurs usages](https://www.gnu.org/licenses/licenses.en.html).

Le texte livré provient du [répertoire officiel SPDX des textes de licence](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-or-later.txt). Il est conservé intégralement, y compris ses instructions générales d’application.

## Application aux futurs fichiers

Ajouter l’identifiant `SPDX-License-Identifier: AGPL-3.0-or-later` dans les fichiers source lorsque leur format le permet. Les auteurs conservent leurs droits ; ne pas inventer un titulaire de droits ni modifier la licence d’un composant tiers.

## Dépendances futures

Les dépendances du socle sont verrouillées dans les fichiers npm et Cargo. Lors de chaque ajout, conserver les licences et notices, vérifier leur compatibilité et produire un inventaire dans les artefacts de livraison. Les ressources graphiques originales suivent la licence du dépôt ; Manrope garde sa [licence SIL Open Font License](brand/fonts/OFL.txt), incluse avec les fichiers.

La construction web et ordinateur copie le texte AGPL, la notice Manrope et un inventaire des paquets npm et de leurs notices dans `licenses/THIRD-PARTY-NOTICES.txt`. Les outils PDF locaux (`pdf-lib`, `@pdf-lib/fontkit`, `fflate`) restent sous leurs licences respectives. Le verrou Cargo conserve également les versions et sources des dépendances natives.

La licence du projet n’impose pas l’utilisation de GitHub pour héberger ou exécuter l’application. Les sources correspondantes doivent rester accessibles depuis l’interface des versions déployées, selon les conditions applicables.
