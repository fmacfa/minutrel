#!/usr/bin/env python3
"""Copy verified Minutrel video publication assets into the site and documentation."""

import argparse
import json
import math
import re
import shutil
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


FRENCH_SUMMARIES = {
    1: "Le principe de Minutrel : suivre le temps par projet, garder le contexte du travail et préparer des rapports, en solo ou en équipe.",
    2: "Du choix du projet au rapport : démarrer, mettre en pause et terminer un chrono, ajouter du temps et partager une note.",
    3: "Garder le chronomètre à portée de main sans laisser la fenêtre principale ouverte.",
    4: "Commencer à suivre ses projets sur son ordinateur, sans serveur ni compte en ligne.",
    5: "Réunir les personnes et les projets dans un espace commun, avec des rôles et des affectations clairs.",
    6: "Ajouter un temps oublié et corriger une saisie pour conserver un historique exact.",
    7: "Comprendre le travail du mois et emporter un rapport clair dans le format souhaité.",
    8: "Noter les résultats et les décisions, choisir ce qui est partagé et relire le compte rendu du mois.",
    9: "Continuer une session sur ordinateur malgré une perte de connexion, puis synchroniser les temps enregistrés localement.",
    10: "Transférer les temps personnels terminés vers un projet de l’équipe, en choisissant les correspondances.",
    11: "Connecter un assistant avec un jeton personnel dont les droits sont limités et révocables.",
    12: "Installer un espace d’équipe sur son infrastructure en suivant le parcours Node.js, puis préparer HTTPS et les sauvegardes.",
}
VIDEO_ID = re.compile(r"[A-Za-z0-9_-]{11}\Z")


def checked_source(root, relative):
    source = (root / relative).resolve()
    if not source.is_relative_to(root) or not source.is_file():
        raise ValueError(f"Missing or out-of-project video asset: {relative}")
    return source


def copy_if_changed(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and source.stat().st_size == target.stat().st_size:
        if source.read_bytes() == target.read_bytes():
            return
    shutil.copy2(source, target)


def write_if_changed(target, content):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.read_text(encoding="utf-8") == content:
        return
    target.write_text(content, encoding="utf-8")


def public_youtube(video):
    publication = video.get("youtube", {})
    if publication.get("status") != "public":
        if video["id"] <= 10:
            raise ValueError(f"Video {video['id']} must be public before synchronising")
        return None, None
    identifier, url = publication.get("id", ""), publication.get("url", "")
    parts = urlsplit(url)
    if (
        not VIDEO_ID.fullmatch(identifier)
        or parts.scheme != "https"
        or parts.netloc != "youtu.be"
        or parts.path != "/" + identifier
        or parts.query
        or parts.fragment
    ):
        raise ValueError(f"Video {video['id']} has an invalid publication URL")
    return identifier, url


def documentation(videos, language):
    if language == "fr":
        lines = [
            "# Minutrel en vidéo",
            "",
            "Douze vidéos avec voix off, musique originale et sous-titres en anglais, de la présentation du produit à son installation.",
            "",
            "Minutrel V0.1 est une préversion. Les exemples utilisent des données fictives.",
            "",
            "| Vidéo | Durée | Regarder | Sous-titres |",
            "| --- | --- | --- | --- |",
        ]
    else:
        lines = [
            "# Minutrel video guides",
            "",
            "Twelve English guides with narration, original music and English subtitles, from the product introduction to installation.",
            "",
            "Minutrel V0.1 is a preview. The examples use fictional data.",
            "",
            "| Video | Duration | Watch | Subtitles |",
            "| --- | --- | --- | --- |",
        ]
    for video in videos:
        title = video["titleFr" if language == "fr" else "titleEn"]
        title = title.replace("|", "\\|")
        url = video["watchUrl"] if "youtubeId" in video else "videos/" + Path(video["mp4"]).name
        platform = "YouTube" if "youtubeId" in video else "MP4"
        number = f"{video['id']:02d}"
        lines.append(
            f"| {number} · {title} | {video['durationLabel']} | [{platform}]({url}) | "
            f"[SRT](videos/minutrel-{number}.srt) |"
        )
    lines += ["", "[YouTube · @minutrel](https://www.youtube.com/@minutrel) · [GitHub · fmacfa/minutrel](https://github.com/fmacfa/minutrel)", ""]
    if language == "fr":
        lines += [
            "Les guides « Assistants » et « Installation » sont fournis en MP4 dans ce dépôt.",
            "Les vidéos consacrées au client ordinateur utilisent des captures réelles de l’application, organisées en étapes commentées.",
            "",
            "[English](VIDEOS.en.md)",
            "",
        ]
    else:
        lines += [
            "The assistant and installation guides are supplied as MP4 files in this repository.",
            "Desktop guides use real application screenshots arranged as narrated steps.",
            "",
            "[Français](VIDEOS.md)",
            "",
        ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", required=True, type=Path)
    args = parser.parse_args()
    root = args.project_root.resolve()
    site = Path(__file__).resolve().parent
    publication = json.loads((root / "video/publication/youtube.json").read_text(encoding="utf-8"))
    repository = publication.get("repositoryUrl", "").rstrip("/")
    channel = publication.get("channelUrl", "")
    if repository != "https://github.com/fmacfa/minutrel" or channel != "https://www.youtube.com/@minutrel":
        raise ValueError("The publication must identify the verified Minutrel repository and channel")
    source_videos = sorted(publication["videos"], key=lambda video: video["id"])
    if [video["id"] for video in source_videos] != list(range(1, 13)):
        raise ValueError("Expected precisely the twelve Minutrel video guides")
    videos = []
    for source in source_videos:
        identifier = source["id"]
        number = f"{identifier:02d}"
        youtube_id, watch_url = public_youtube(source)
        duration = source["duration"]
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
            raise ValueError(f"Video {identifier} has an invalid duration")
        rounded = math.floor(duration + 0.5)
        poster_path = (
            "video/out/minutrel-presentation-en-v2-poster.png" if identifier == 1
            else "video/out/minutrel-tutorial-en-v2-poster.png" if identifier == 2
            else f"video/out/series-en/qa/{number}-intro.png"
        )
        poster = checked_source(root, poster_path)
        subtitles = checked_source(root, source["subtitle"])
        if not subtitles.is_relative_to(root / "video/out") or subtitles.suffix.lower() != ".srt":
            raise ValueError(f"Video {identifier} must use an exported SRT file")
        copy_if_changed(poster, site / f"src/assets/video-posters/{number}.png")
        copy_if_changed(poster, root / f"docs/videos/posters/{number}.png")
        copy_if_changed(subtitles, site / f"src/downloads/videos/minutrel-{number}.srt")
        copy_if_changed(subtitles, root / f"docs/videos/minutrel-{number}.srt")
        video = {
            "id": identifier,
            "titleEn": source["title"],
            "titleFr": source["titleFr"],
            "summaryEn": source["summary"],
            "summaryFr": FRENCH_SUMMARIES[identifier],
            "duration": duration,
            "durationLabel": f"{rounded // 60}:{rounded % 60:02d}",
            "poster": f"assets/video-posters/{number}.png",
            "subtitles": f"downloads/videos/minutrel-{number}.srt",
        }
        if youtube_id:
            video["youtubeId"] = youtube_id
        if identifier in (11, 12):
            media = checked_source(root, source["file"])
            expected_name = "minutrel-11-assistants.mp4" if identifier == 11 else "minutrel-12-self-host.mp4"
            if media.parent != root / "video/out/series-en" or media.name != expected_name:
                raise ValueError(f"Video {identifier} must use its verified MP4 export")
            copy_if_changed(media, site / "src/assets/videos" / media.name)
            copy_if_changed(media, root / "docs/videos" / media.name)
            video["mp4"] = "assets/videos/" + media.name
            if not watch_url:
                watch_url = repository + "/blob/main/docs/videos/" + media.name
        if not watch_url:
            raise ValueError(f"Video {identifier} has no usable viewing destination")
        video["watchUrl"] = watch_url
        videos.append(video)
    catalog = {"channelUrl": channel, "repositoryUrl": repository, "videos": videos}
    if publication.get("playlistUrl"):
        playlist = urlsplit(publication["playlistUrl"])
        if playlist.scheme != "https" or playlist.netloc != "www.youtube.com" or playlist.path != "/playlist" or not parse_qs(playlist.query).get("list"):
            raise ValueError("Invalid playlist URL")
        catalog["playlistUrl"] = publication["playlistUrl"]
    write_if_changed(site / "src/videos.json", json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    docs_catalog = {
        **{key: value for key, value in catalog.items() if key != "videos"},
        "videos": [
            {
                **video,
                "poster": f"posters/{video['id']:02d}.png",
                "subtitles": f"minutrel-{video['id']:02d}.srt",
                **({"mp4": Path(video["mp4"]).name} if "mp4" in video else {}),
            }
            for video in videos
        ],
    }
    write_if_changed(root / "docs/videos/catalog.json", json.dumps(docs_catalog, ensure_ascii=False, indent=2) + "\n")
    write_if_changed(root / "docs/VIDEOS.md", documentation(videos, "fr"))
    write_if_changed(root / "docs/VIDEOS.en.md", documentation(videos, "en"))
    print("Synchronised 12 posters, 12 subtitle files and 2 MP4 fallbacks into both website and documentation assets.")


if __name__ == "__main__":
    main()
