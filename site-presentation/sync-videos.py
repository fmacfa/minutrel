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
    13: "Créer une sous-catégorie de projet et la retrouver sur une saisie de temps avec sa description.",
    14: "Fixer un budget et une échéance, attribuer une action et la rattacher à une saisie de temps.",
    15: "Changer la période du Gantt, repérer les surcharges et estimer les montants à partir des taux horaires.",
    16: "Soumettre une semaine, la faire approuver par un responsable, puis exporter les temps approuvés.",
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


def documentation(catalog, language):
    videos = catalog["videos"]
    count = len(videos)
    planning_guide = catalog.get("planningGuideUrl")
    if language == "fr":
        lines = [
            "# Minutrel en vidéo",
            "",
            f"{count} vidéos avec voix off, musique originale et sous-titres en anglais.",
            "",
            "Minutrel V0.1 est une préversion. Les exemples utilisent des données fictives.",
            "",
        ]
        if planning_guide:
            lines += [f"Les vidéos sur la planification, le Gantt et les feuilles de temps ont été tournées sur une version de développement de Minutrel V0.1. Retrouvez les étapes dans le [guide actuel en anglais]({planning_guide}).", ""]
        lines += ["| Vidéo | Durée | Regarder | Sous-titres |", "| --- | --- | --- | --- |"]
    else:
        lines = [
            "# Minutrel video guides",
            "",
            f"{count} English guides with narration, original music and English subtitles.",
            "",
            "Minutrel V0.1 is a preview. The examples use fictional data.",
            "",
        ]
        if planning_guide:
            lines += [f"The planning, Gantt and timesheet videos were recorded on a Minutrel V0.1 development build. See the [current planning and timesheet guide]({planning_guide}).", ""]
        lines += ["| Video | Duration | Watch | Subtitles |", "| --- | --- | --- | --- |"]
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
    links = []
    if catalog.get("playlistUrl"):
        playlist_label = "Playlist YouTube" if language == "fr" else "YouTube playlist"
        links.append(f"[{playlist_label}]({catalog['playlistUrl']})")
    links += [f"[YouTube · @minutrel]({catalog['channelUrl']})", f"[GitHub · fmacfa/minutrel]({catalog['repositoryUrl']})"]
    lines += ["", " · ".join(links), ""]
    all_public = all("youtubeId" in video for video in videos)
    if language == "fr":
        if all_public:
            lines += [f"Les {count} vidéos sont publiques sur YouTube.", ""]
        lines += [
            "Téléchargements MP4 : [assistants](videos/minutrel-11-assistants.mp4) · [installation et autohébergement](videos/minutrel-12-self-host.mp4).",
            "Les vidéos consacrées au client ordinateur utilisent des captures réelles de l’application, organisées en étapes commentées.",
            "",
            "[English](VIDEOS.en.md)",
            "",
        ]
    else:
        if all_public:
            lines += [f"All {count} videos are public on YouTube.", ""]
        lines += [
            "MP4 downloads: [assistants](videos/minutrel-11-assistants.mp4) · [installation and self-hosting](videos/minutrel-12-self-host.mp4).",
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
    if len(source_videos) < 12 or [video["id"] for video in source_videos] != list(range(1, len(source_videos) + 1)):
        raise ValueError("Expected the original twelve guides followed by consecutively numbered additions")
    planning_guide = publication.get("planningGuideUrl")
    if planning_guide and planning_guide != f"{repository}/blob/main/docs/guide/en/README.md#14-project-planning-and-timesheets":
        raise ValueError("Invalid Minutrel planning guide URL")
    videos = []
    for source in source_videos:
        identifier = source["id"]
        number = f"{identifier:02d}"
        youtube_id, watch_url = public_youtube(source)
        duration = source["duration"]
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
            raise ValueError(f"Video {identifier} has an invalid duration")
        rounded = math.floor(duration + 0.5)
        poster_path = source.get("poster") or (
            "video/out/minutrel-presentation-en-v2-poster.png" if identifier == 1
            else "video/out/minutrel-tutorial-en-v2-poster.png" if identifier == 2
            else f"video/out/series-en/qa/{number}-intro.png"
        )
        poster = checked_source(root, poster_path)
        if not poster.is_relative_to(root / "video/out") or poster.suffix.lower() != ".png":
            raise ValueError(f"Video {identifier} must use an exported PNG poster")
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
    if planning_guide:
        catalog["planningGuideUrl"] = planning_guide
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
    catalog_json = json.dumps(docs_catalog, ensure_ascii=False, indent=2) + "\n"
    write_if_changed(root / "docs/videos/catalog.json", catalog_json)
    write_if_changed(site / "src/assets/reference/docs/videos/catalog.json", catalog_json)
    for language, name in (("fr", "VIDEOS.md"), ("en", "VIDEOS.en.md")):
        guide = documentation(catalog, language)
        write_if_changed(root / "docs" / name, guide)
        write_if_changed(site / "src/content/docs" / name, guide)
    print(f"Synchronised {len(videos)} posters, {len(videos)} subtitle files and 2 MP4 downloads.")


if __name__ == "__main__":
    main()
