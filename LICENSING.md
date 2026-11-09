# Minutrel licensing

Original repository content uses the **GNU Affero General Public License, version 3 or later**, SPDX identifier `AGPL-3.0-or-later`. The complete text is included in [LICENSE](LICENSE).

This licence permits modification and redistribution under its terms and requires offering the corresponding source to users who interact remotely with modified versions, as specified in section 13. The licence text defines the applicable obligations. See the Free Software Foundation’s [licences and guidance](https://www.gnu.org/licenses/licenses.en.html).

The included licence text comes from the [official SPDX licence-text repository](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-or-later.txt) and is retained in full.

## Source files

Add `SPDX-License-Identifier: AGPL-3.0-or-later` where the source format supports it. Authors retain their rights. Do not invent a copyright holder or change a third-party component’s licence.

## Dependencies and assets

Application dependencies are pinned in the npm and Cargo lockfiles. Keep licences and notices, check compatibility and include an inventory with release artefacts. Original brand assets use the repository licence; Manrope retains its [SIL Open Font License](brand/fonts/OFL.txt), included alongside the font files.

Web and desktop builds copy the AGPL text, Manrope notice and npm package/license inventory into `licenses/THIRD-PARTY-NOTICES.txt`. Local PDF/export libraries (`pdf-lib`, `@pdf-lib/fontkit`, `fflate`) retain their respective licences. The Cargo lockfile records native dependency versions and sources.

The project licence does not require GitHub as a hosting provider. Corresponding source must remain accessible to deployed-version users under the applicable licence conditions.
