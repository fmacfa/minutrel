"""Add the bilingual video library and contextual links to the static website."""
import html
import json
from pathlib import Path

from bilingual import configure, localise


def esc(value):
    return html.escape(str(value), quote=True)


def card(video, language):
    en = language == 'en'
    prefix = '../' if en else ''
    title = video['titleEn' if en else 'titleFr']
    summary = video['summaryEn' if en else 'summaryFr']
    poster = prefix + video['poster']
    subtitles = prefix + video['subtitles']
    number = f"{video['id']:02d}"
    duration = f'<span class="video-duration">{esc(video["durationLabel"])}</span>'
    if video.get('youtubeId'):
        label = ('Play: ' if en else 'Lire : ') + title
        media = (f'<button class="video-preview" type="button" data-video-id="{esc(video["youtubeId"])}" '
                 f'data-video-url="{esc(video["watchUrl"])}" data-video-title="{esc(title)}" aria-label="{esc(label)}">'
                 f'<img src="{esc(poster)}" alt="" width="1920" height="1080" loading="lazy">'
                 f'<span class="video-play" aria-hidden="true">▶</span>{duration}</button>')
        watch = 'Watch on YouTube ↗' if en else 'Voir sur YouTube ↗'
        link = f'<a href="{esc(video["watchUrl"])}" target="_blank" rel="noopener noreferrer">{watch}</a>'
    else:
        media = (f'<div class="video-native"><video controls preload="none" playsinline poster="{esc(poster)}" '
                 f'aria-label="{esc(title)}"><source src="{esc(prefix + video["mp4"])}" type="video/mp4">'
                 f'<a href="{esc(prefix + video["mp4"])}">MP4</a></video>{duration}</div>')
        watch = 'Download MP4 ↓' if en else 'Télécharger le MP4 ↓'
        link = f'<a href="{esc(prefix + video["mp4"])}" download>{watch}</a>'
    caption = 'English subtitles ↓' if en else 'Sous-titres anglais ↓'
    badge = 'ENGLISH · VOICE & MUSIC' if en else 'ANGLAIS · VOIX & MUSIQUE'
    return (f'<article class="video-card" id="video-{video["id"]}"><div class="video-media">{media}</div>'
            f'<div class="video-copy"><p class="video-kicker">{number} / {badge}</p>'
            f'<h3>{esc(title)}</h3><p>{esc(summary)}</p><div class="video-links">{link}'
            f'<a href="{esc(subtitles)}" download>{caption}</a></div></div></article>')


def section(videos, language, title, description, featured=False):
    label = 'Browse all 12 videos ↗' if language == 'en' else 'Voir les 12 vidéos ↗'
    classes = 'video-grid video-featured' if featured else 'video-grid'
    return (f'<section class="section video-section"><div class="wrap"><div class="section-head">'
            f'<div><p class="eyebrow">MINUTREL / VIDEO</p><h2>{title}</h2><p>{description}</p></div>'
            f'<a class="text-link" href="videos.html">{label}</a></div><div class="{classes}">'
            + ''.join(card(video, language) for video in videos) + '</div></div></section>')


def install(dist, shell):
    catalog = json.loads((Path(__file__).parent / 'videos.json').read_text())
    videos = catalog['videos']
    assert len(videos) == 12 and len({v['id'] for v in videos}) == 12
    by_id = {video['id']: video for video in videos}
    indices = {}
    related = {
        'fonctionnement.html': [2, 3, 9], 'guide.html': [2, 4, 5],
        'doc-commande-rapide.html': [3], 'synchronisation.html': [9, 10],
        'rapports.html': [7], 'integrations.html': [11], 'autohebergement.html': [12],
    }
    for language in ('fr', 'en'):
        en = language == 'en'
        folder = dist / 'en' if en else dist
        title = 'Minutrel in 12 videos' if en else 'Minutrel en 12 vidéos'
        headline = 'Understand.<br>Try.<br>Find your rhythm.' if en else 'Comprendre.<br>Essayer.<br>Prendre le rythme.'
        description = ('Start with the idea, then follow the practical guides. Every video includes English narration, music and downloadable subtitles.' if en else
                       'Le principe, puis les gestes utiles. Chaque vidéo comprend une narration en anglais, de la musique et des sous-titres téléchargeables.')
        playlist = 'The YouTube playlist ↗' if en else 'La playlist YouTube ↗'
        source = 'Source code on GitHub ↗' if en else 'Le code sur GitHub ↗'
        note = ('YouTube players load only when you choose to play a video. The last two guides play directly here; MP4 downloads are available too.' if en else
                'Les lecteurs YouTube se chargent au lancement de la vidéo. Les deux derniers guides se lisent directement ici et sont aussi disponibles en MP4.')
        body = (f'<section class="page-intro video-intro"><div class="wrap"><p class="eyebrow">MINUTREL / VIDEO</p>'
                f'<h1>{headline}</h1><p class="lead">{description}</p><div class="actions">'
                f'<a class="btn btn-primary" href="{esc(catalog.get("playlistUrl", catalog["channelUrl"]))}" target="_blank" rel="noopener noreferrer">{playlist}</a>'
                f'<a class="btn btn-outline" href="{esc(catalog["repositoryUrl"])}" target="_blank" rel="noopener noreferrer">{source}</a></div></div></section>'
                f'<section class="section video-library"><div class="wrap"><h2 class="sr-only">{title}</h2>'
                f'<p class="video-note">{note}</p><div class="video-grid">'
                + ''.join(card(video, language) for video in videos) + '</div></div></section>')
        # Translate only the common chrome; video editorial copy is already bilingual.
        page = shell(title, description, '<!--VIDEO_LIBRARY-->', 'videos.html', 'videos.html', language)
        if en:
            page = localise(page)
        page = configure(page, 'videos.html', language).replace('<!--VIDEO_LIBRARY-->', body)
        (folder / 'videos.html').write_text(page)
        for file in folder.glob('*.html'):
            value = file.read_text()
            if file.name == 'index.html':
                heading = 'The idea. Then the first steps.' if en else 'Le principe. Puis les premiers pas.'
                text = 'Two videos to understand Minutrel and start tracking your work.' if en else 'Deux vidéos pour comprendre Minutrel et commencer à suivre votre travail.'
                addition = section(videos[:2], language, heading, text, True)
                value = value.replace('<div class="trust-strip">', addition + '<div class="trust-strip">', 1)
            elif file.name == 'ressources.html':
                heading = 'Learn by watching.' if en else 'Voir les gestes en action.'
                text = '12 English videos, from the product introduction to self-hosting.' if en else '12 vidéos en anglais, de la présentation à l’autohébergement.'
                callout = (f'<section class="video-resource"><div class="wrap"><a class="video-callout" href="videos.html">'
                           f'<span><strong>{heading}</strong><span>{text}</span></span><span aria-hidden="true">↗</span></a></div></section>')
                value = value.replace('</section>', '</section>' + callout, 1)
            elif file.name in related:
                heading = 'Watch the guide.' if en else 'Le guide en vidéo.'
                text = 'Follow the real interface, with English narration and subtitles.' if en else 'Suivez l’interface réelle avec la narration et les sous-titres anglais.'
                value = value.replace('</main>', section([by_id[id] for id in related[file.name]], language, heading, text) + '</main>', 1)
            marker = '</div></div><div class="footer-bottom">'
            links = (f'<a href="{esc(catalog["repositoryUrl"])}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>'
                     f'<a href="{esc(catalog["channelUrl"])}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>')
            value = value.replace(marker, links + marker, 1)
            file.write_text(value)
        indices[language] = [{'title': v['titleEn' if en else 'titleFr'], 'group': 'Videos' if en else 'Vidéos',
                              'text': v['summaryEn' if en else 'summaryFr'], 'url': f'videos.html#video-{v["id"]}'} for v in videos]
    return indices
