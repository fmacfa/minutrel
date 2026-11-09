#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Contrôle du dépôt documentaire, sans dépendance ni accès réseau."""

import csv
import json
import os
import re
import sys
import tomllib
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlsplit
from uuid import UUID
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", ".cache", "node_modules", ".venv", "__pycache__", "target", "dist", "build", "coverage", "tmp"}
REQUIRED = [
    "README.md", "README.fr.md", "LICENSE", "LICENSING.md", "CONTRIBUTING.md", "SECURITY.md",
    "CHANGELOG.md", ".gitignore", ".gitattributes", ".editorconfig", ".env.example",
    ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md",
    ".github/ISSUE_TEMPLATE/config.yml", ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/workflows/repository-check.yml", "apps/README.md", "packages/README.md",
    "docs/CAHIER_DES_CHARGES.md", "docs/ARCHITECTURE.md", "docs/INTERFACE.md",
    "docs/MODELE_DE_DONNEES.md", "docs/API.md", "docs/RECETTE.md", "docs/BACKLOG.md",
    "docs/AUTOHEBERGEMENT.md", "docs/GITHUB.md", "docs/SOURCES.md",
    "apps/web/README.md", "apps/api/README.md", "apps/desktop/README.md",
    "packages/domain/README.md", "packages/ui/README.md", "packages/contracts/README.md",
    "infra/README.md", "infra/docker/README.md", "infra/backup/README.md",
    "tests/README.md", "examples/exports/README.md", "scripts/README.md",
    "examples/exports/donnees-exemple.json", "examples/exports/temps-exemple.csv",
    "package.json", "package-lock.json", "tsconfig.json", "rust-toolchain.toml",
    "apps/web/src/main.tsx", "apps/web/public/favicon.svg", "apps/api/src/server.ts",
    "apps/api/migrations/.gitkeep", "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/Cargo.lock", "apps/desktop/src-tauri/src/main.rs",
    "packages/domain/src/index.ts", "packages/ui/src/index.tsx", "packages/contracts/src/index.ts",
    "docs/CI.md", "docs/IDENTITE_DE_MARQUE.md", "docs/DISPONIBILITE_NOM.md",
    "docs/guide/README.md", "docs/guide/fr/README.md", "docs/guide/en/README.md", "docs/guide/de/README.md",
    "docs/API_WEBHOOKS.md", "docs/SYNCHRONISATION.md", "docs/PRE_PUBLICATION.md", "docs/SUBCATEGORIES.md",
    "docs/COMMANDE_RAPIDE.md", "docs/RAPPORTS_MENSUELS.md", "docs/INTEGRATIONS_IA.md", "docs/RESSOURCES.md",
    "examples/integrations/README.md", "examples/integrations/codex-mcp.toml.example",
    "examples/integrations/claude-mcp.json.example", "examples/integrations/providers.json.example",
    "brand/README.md", "brand/tokens.json", "brand/tokens.css", "brand/manifest.json",
    ".github/dependabot.yml", "infra/docker/Dockerfile", "infra/docker/compose.ci.yml",
    "tests/unit/.gitkeep", "tests/integration/.gitkeep", "tests/e2e/.gitkeep",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_files_and_links():
    missing = [name for name in REQUIRED if not (ROOT / name).is_file()]
    require(not missing, "Fichiers manquants : " + ", ".join(missing))
    license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
    require(
        len(license_text) > 30000
        and "GNU AFFERO GENERAL PUBLIC LICENSE" in license_text
        and "13. Remote Network Interaction" in license_text,
        "Le texte complet de la licence AGPL est attendu.",
    )
    count = 0
    link_pattern = re.compile(r"\[[^\]\n]*\]\(([^)\n]+)\)")
    for folder, dirs, files in os.walk(ROOT):
        # Les copies du site utilisent les routes réécrites par son constructeur,
        # et non des chemins relatifs vers les fichiers du dépôt.
        site_content = ROOT / "site-presentation" / "src" / "content"
        dirs[:] = sorted(
            name for name in dirs
            if name not in SKIP_DIRS and Path(folder) / name != site_content
        )
        for name in sorted(files):
            if not name.endswith(".md"):
                continue
            path = Path(folder) / name
            count += 1
            for raw_target in link_pattern.findall(path.read_text(encoding="utf-8")):
                target = urlsplit(raw_target.strip().strip("<>"))
                if target.scheme or target.netloc or not target.path:
                    continue
                resolved = (path.parent / unquote(target.path)).resolve()
                require(
                    resolved.is_relative_to(ROOT) and resolved.exists(),
                    f"Lien local absent ou hors dépôt dans {path.relative_to(ROOT)} : {raw_target}",
                )
    return count


def utc_instant(value):
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(
        instant.utcoffset() == timedelta(0) and instant.microsecond == 0,
        "Un instant fictif doit être en UTC à la seconde.",
    )
    return instant


def index_by_id(items):
    result = {}
    for item in items:
        UUID(item["id"])
        require(item["id"] not in result, "Identifiant fictif dupliqué.")
        result[item["id"]] = item
    return result


def check_examples():
    data = json.loads((ROOT / "examples/exports/donnees-exemple.json").read_text(encoding="utf-8"))
    require(data["schema_version"] == 1, "Version d’export fictif inattendue.")
    utc_instant(data["exported_at"])
    workspace = data["workspace"]
    UUID(workspace["id"])
    ZoneInfo(workspace["time_zone"])
    members = index_by_id(data["members"])
    projects = index_by_id(data["projects"])
    tasks = index_by_id(data["tasks"])
    entries = index_by_id(data["time_entries"])
    segments = index_by_id(data["time_segments"])
    segment_totals = defaultdict(int)
    segments_by_entry = defaultdict(list)
    for project in projects.values():
        require(project["workspace_id"] == workspace["id"], "Projet dans un autre espace.")
    for assignment in data["project_members"]:
        require(assignment["member_id"] in members, "Membre d’affectation absent.")
        require(assignment["project_id"] in projects, "Projet d’affectation absent.")
    for segment in segments.values():
        require(segment["entry_id"] in entries, "Segment sans entrée.")
        start = utc_instant(segment["started_at"])
        end = utc_instant(segment["ended_at"])
        require(end > start, "Segment de durée négative ou nulle.")
        segment_totals[segment["entry_id"]] += int((end - start).total_seconds())
        segments_by_entry[segment["entry_id"]].append((start, end))
    for entry in entries.values():
        require(entry["workspace_id"] == workspace["id"], "Entrée dans un autre espace.")
        require(entry["member_id"] in members and entry["project_id"] in projects, "Référence d’entrée absente.")
        require(entry["task_id"] is None or entry["task_id"] in tasks, "Tâche absente.")
        require(entry["state"] == "stopped" and entry["deleted_at"] is None, "Temps fictif non finalisé.")
        require(entry["kind"] == "interval", "L’exemple attendu contient des intervalles.")
        require(type(entry["duration_seconds"]) is int and entry["duration_seconds"] > 0, "Durée non entière ou non positive.")
        require(segment_totals[entry["id"]] == entry["duration_seconds"], "Somme des segments incohérente.")
        intervals = sorted(segments_by_entry[entry["id"]])
        require(all(a[1] <= b[0] for a, b in zip(intervals, intervals[1:])), "Segments en chevauchement.")
    require(sum(entry["duration_seconds"] for entry in entries.values()) == 8100, "Le total JSON doit être 8 100 secondes.")

    csv_totals = defaultdict(int)
    with (ROOT / "examples/exports/temps-exemple.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter=";"))
    require(len(rows) == 2, "Le CSV fictif doit contenir deux lignes.")
    for row in rows:
        require(row["entry_id"] in entries, "Entrée CSV absente du JSON.")
        entry = entries[row["entry_id"]]
        seconds = int(row["duration_seconds"])
        require(seconds > 0, "Durée CSV non positive.")
        csv_totals[entry["id"]] += seconds
        expected_decimal = (Decimal(seconds) / Decimal(3600)).quantize(Decimal("0.01"))
        require(Decimal(row["hours_decimal"].replace(",", ".")) == expected_decimal, "Heures décimales CSV incorrectes.")
        require(row["member"] == members[entry["member_id"]]["display_name"], "Membre CSV incohérent.")
        require(row["project"] == projects[entry["project_id"]]["name"], "Projet CSV incohérent.")
        require(row["description"] == entry["description"], "Description CSV incohérente.")
        require(row["billable"] == str(entry["billable"]).lower(), "Indicateur facturable incohérent.")
        require(row["time_zone"] == "Europe/Paris" and row["report_date"] == "2026-11-05", "Période CSV inattendue.")
        expected_duration = f"{seconds // 3600} h {(seconds % 3600) // 60:02d} min"
        require(row["duration"] == expected_duration, "Durée lisible CSV incohérente.")
    require(set(csv_totals) == set(entries), "Entrée absente du CSV.")
    require(all(csv_totals[key] == entry["duration_seconds"] for key, entry in entries.items()), "Totaux CSV et JSON différents.")


def check_integration_examples():
    folder = ROOT / "examples/integrations"
    codex = tomllib.loads((folder / "codex-mcp.toml.example").read_text(encoding="utf-8"))
    server = codex["mcp_servers"]["minutrel"]
    require(server["enabled"] is False, "L’exemple Codex doit rester désactivé.")
    require(server["bearer_token_env_var"] == "MINUTREL_MCP_TOKEN", "Le jeton doit être référencé par environnement.")
    require(not any("timer" in name and any(action in name for action in ("start", "stop", "pause", "resume")) for name in server["enabled_tools"]), "L’exemple ne doit pas activer des commandes de chronomètre.")
    claude = json.loads((folder / "claude-mcp.json.example").read_text(encoding="utf-8"))
    client = claude["mcpServers"]["minutrel"]
    require(client["type"] == "http", "Transport HTTP attendu dans l’exemple Claude Code.")
    require(client["headers"]["Authorization"] == "Bearer ${MINUTREL_MCP_TOKEN}", "Aucune valeur de jeton dans l’exemple.")
    providers = json.loads((folder / "providers.json.example").read_text(encoding="utf-8"))
    require(providers["schema_version"] == 1, "Version de configuration inattendue.")
    require(len(providers["profiles"]) == 3, "Trois profils de démonstration sont attendus.")
    require(all(item["enabled"] is False for item in providers["profiles"]), "Les exemples de moteurs doivent rester désactivés.")
    require(all("api_key" not in item and "token" not in item for item in providers["profiles"]), "Les exemples ne stockent que des références de secrets.")


def main():
    count = check_files_and_links()
    check_examples()
    check_integration_examples()
    print(f"OK — structure et liens locaux de {count} fichiers Markdown vérifiés.")
    print("OK — exemples JSON et CSV cohérents : 8 100 secondes, soit 2 h 15 min.")
    print("OK — exemples IA JSON et TOML lus, sans activation ni connexion externe.")
    print("Ce contrôle documentaire ne valide pas une application exécutable.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"ÉCHEC — {error}", file=sys.stderr)
        sys.exit(1)
