#!/usr/bin/env python3
"""Build a standalone, dependency-free static Minutrel presentation website."""
import html
import json
import os
import posixpath
import re
import shutil
import sys
import unicodedata
import zipfile
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
DIST = ROOT / 'dist'
CONTENT = SRC / 'content'
sys.path.insert(0, str(SRC))
from pages import icon, button, intro, home, features, functioning, resources, hosting_extra, FEATURES, resource
from bilingual import build_english, configure, MISSING

snapshot = json.loads((CONTENT / 'snapshot.json').read_text())
ORIGIN = os.environ.get('MINUTREL_SITE_ORIGIN', '').rstrip('/')
DOCS = {
    'docs/guide/fr/README.md': ('guide.html','Guide utilisateur','Les 13 chapitres illustrés pour utiliser Minutrel au quotidien, de votre premier projet aux sauvegardes.','Le guide · Français'),
    'docs/guide/en/README.md': ('guide-en.html','User guide','The illustrated guide to Minutrel 0.1.0: personal workspaces, teams, time tracking and reports.','User guide · English'),
    'docs/guide/de/README.md': ('guide-de.html','Benutzerhandbuch','Die bebilderte Anleitung für Minutrel 0.1.0: persönliche Arbeitsbereiche, Teamarbeit, Zeiterfassung und Berichte.','Benutzerhandbuch · Deutsch'),
    'docs/AUTOHEBERGEMENT.md': ('autohebergement.html','Votre temps.<br>Votre hébergement.','Installez un espace d’équipe sur votre infrastructure, avec Docker Compose ou Node.js 24. Le client ordinateur peut aussi fonctionner seul, sans serveur.','Installer Minutrel'),
    'docs/SYNCHRONISATION.md': ('synchronisation.html','Autonomie et synchronisation','Où vivent les données, ce qui fonctionne hors connexion et comment résoudre une file en conflit.','Comprendre les données'),
    'docs/COMMANDE_RAPIDE.md': ('doc-commande-rapide.html','Le mini chrono','Un projet choisi, des commandes accessibles, et les états du chronomètre toujours visibles.','Chronométrer'),
    'docs/INTEGRATIONS_IA.md': ('integrations.html','Des connexions<br>à votre mesure.','Assistants via MCP, moteurs de rédaction facultatifs et droits personnels : connectez les outils que vous choisissez.','Intégrations'),
    'docs/API_WEBHOOKS.md': ('api-webhooks.html','API, MCP et webhook','Les trois accès de l’instance d’équipe, leur authentification et un exemple de webhook entrant.','Connecter vos outils'),
    'docs/API.md': ('api.html','La référence API','Routes REST, authentification, concurrence, rapports et synchronisation du client ordinateur.','Documentation technique'),
    'docs/RAPPORTS_MENSUELS.md': ('rapports.html','Du travail au rapport.','Comprendre les calculs du mois, le contenu partagé et les exports CSV, PDF et ZIP.','Les rapports mensuels'),
    'infra/backup/README.md': ('sauvegardes.html','Sauvegarder.<br>Et savoir restaurer.','Une sauvegarde cohérente de SQLite et de la clé, une copie hors du volume d’origine, puis une restauration vérifiée.','Exploiter Minutrel'),
    'docs/ETAT_V0_1.md': ('version.html','Le périmètre de la V0.1','Les fonctions présentes, la portée de la première version et les évolutions prévues.','Version 0.1.0 · Préversion'),
    'docs/VALIDATION_CI.md': ('validation.html','Les contrôles documentés','Résultats locaux des 5 et 6 novembre 2026 et vérifications restant à effectuer sur les autres environnements.','État des validations'),
    'docs/ARCHITECTURE.md': ('architecture.html','Une architecture lisible.','Clients React et Tauri, serveur Fastify unique, SQLite et stockage personnel local.','Sous le capot'),
    'docs/MODELE_DE_DONNEES.md': ('modele-donnees.html','Le modèle de données','Entités, versions et règles de conservation du socle Minutrel.','Documentation technique'),
    'LICENSING.md': ('licence.html','Libre et documenté.','Les notices de licence de Minutrel et les ressources tierces du projet.','AGPL-3.0-or-later'),
    'SECURITY.md': ('securite.html','Signaler un problème','Les conditions actuelles de signalement d’un problème de sécurité pour cette préversion.','Le projet'),
    'CHANGELOG.md': ('nouveautes.html','Les nouveautés','L’historique de Minutrel, depuis la première version.','Le projet'),
    'site/HEBERGER_LE_SITE.md': ('heberger-le-site.html','Autohéberger<br>ce site de présentation.','Une archive statique, un hébergement de fichiers et votre propre domaine.','Le site Minutrel'),
}

def slug(text):
    plain = re.sub(r'<[^>]*>|[*`_]', '', text)
    plain = unicodedata.normalize('NFKD', html.unescape(plain)).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',plain).strip('-') or 'section'

# Every referenced project document is available, without depending on a future GitHub URL.
for file in sorted(CONTENT.rglob('*.md')):
    key = file.relative_to(CONTENT).as_posix()
    if key.startswith('en/'): continue
    if key in DOCS: continue
    first = file.read_text().splitlines()[0].lstrip('# ').strip()
    route = 'doc-' + slug(key.removesuffix('.md').replace('/README','')) + '.html'
    DOCS[key] = (route, html.escape(first),'Documentation de référence issue du projet Minutrel 0.1.0.','Documentation du projet')

def resolve_link(url, current):
    url = html.unescape(url)
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or url.startswith('mailto:'):
        return url
    if not parts.path:
        return '#'+slug(unquote(parts.fragment)) if parts.fragment else '#haut'
    path = posixpath.normpath(posixpath.join(posixpath.dirname(current), unquote(parts.path)))
    fragment = '#'+slug(unquote(parts.fragment)) if parts.fragment else ''
    if path in DOCS: return DOCS[path][0]+fragment
    if path.startswith('docs/screenshots/'): return 'assets/screenshots/'+path.split('/')[-1]
    if path.startswith('brand/assets/'): return 'assets/'+path.removeprefix('brand/assets/')
    if path == 'brand/fonts/OFL.txt': return 'assets/fonts/OFL.txt'
    if path.startswith('output/pdf/'): return 'downloads/'+path.split('/')[-1]
    if path == 'LICENSE': return 'downloads/LICENSE.txt'
    if path == '.env.example': return 'downloads/env.example.txt'
    if path == 'compose.yml': return 'downloads/compose.yml'
    if (SRC/'assets'/'reference'/path).is_file():
        return 'downloads/minutrel-0.1.0-sources.zip' if path.endswith('.html') else 'assets/reference/'+path
    # Repository-wide paths refer to the portable, reviewed source snapshot.
    return 'downloads/minutrel-0.1.0-sources.zip'

def inline(text, current):
    tokens={}
    def hold(value):
        key=f'\x00{len(tokens)}\x00'; tokens[key]=value; return key
    text=re.sub(r'`([^`]+)`',lambda m:hold('<code>'+html.escape(m.group(1))+'</code>'),text)
    text=re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',lambda m:hold(image_tag(m.group(2),m.group(1),current)),text)
    text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:hold(f'<a href="{html.escape(resolve_link(m.group(2),current),quote=True)}">{inline(m.group(1),current)}</a>'),text)
    text=html.escape(text)
    text=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',text)
    text=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<em>\1</em>',text)
    for key,value in reversed(list(tokens.items())): text=text.replace(key,value)
    return text

@lru_cache(maxsize=None)
def image_size(url):
    file=SRC/url
    if not file.is_file():return None
    data=file.read_bytes()
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return int.from_bytes(data[16:20],'big'),int.from_bytes(data[20:24],'big')
    if data.startswith(b'\xff\xd8'):
        cursor=2
        while cursor+9<len(data):
            if data[cursor]!=255:cursor+=1;continue
            while cursor<len(data) and data[cursor]==255:cursor+=1
            marker=data[cursor];cursor+=1
            if marker in {0xd8,0xd9}:continue
            size=int.from_bytes(data[cursor:cursor+2],'big')
            if marker in {0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf}:
                return int.from_bytes(data[cursor+5:cursor+7],'big'),int.from_bytes(data[cursor+3:cursor+5],'big')
            if size<2:break
            cursor+=size
    return None

def image_tag(url,alt,current):
    resolved=resolve_link(url,current)
    dimensions=image_size(resolved)
    size=f' width="{dimensions[0]}" height="{dimensions[1]}"' if dimensions else ''
    return f'<img src="{html.escape(resolved,quote=True)}" alt="{html.escape(alt,quote=True)}"{size} loading="lazy">'

def code_block(code, language):
    return f'<div class="code-wrap"><span class="code-language">{html.escape(language)}</span><pre><code>{html.escape(code)}</code></pre><button type="button" class="copy-btn" aria-label="Copier ce bloc de code">Copier</button></div>'

def markdown(text, current):
    lines=text.splitlines(); out=[]; headings=[]; i=0; chapter=False; seen={}
    def blocks(start):
        return bool(re.match(r'^(?:#{1,6} |```|\s*[-*] |\s*\d+\. |> |\|)', start))
    while i<len(lines):
        line=lines[i]
        if not line.strip(): i+=1;continue
        if line.startswith('```'):
            lang=line[3:].strip(); content=[]; i+=1
            while i<len(lines) and not lines[i].startswith('```'): content.append(lines[i]);i+=1
            out.append(code_block('\n'.join(content),lang));i+=1;continue
        match=re.match(r'^(#{1,6}) (.+)',line)
        if match:
            level=len(match[1]); title=match[2].strip()
            if level==1: i+=1;continue
            anchor=slug(title); seen[anchor]=seen.get(anchor,0)+1
            if seen[anchor]>1: anchor+=f'-{seen[anchor]}'
            if level==2:
                if chapter: out.append('</section>')
                out.append(f'<section class="doc-chapter" id="{anchor}">');chapter=True
                headings.append((anchor,re.sub(r'[*`]', '',title)))
                out.append(f'<h2>{inline(title,current)}</h2>')
            else: out.append(f'<h{level} id="{anchor}">{inline(title,current)}</h{level}>')
            i+=1;continue
        if line.startswith('|') and i+1<len(lines) and re.match(r'^\|[\s:|\-]+\|\s*$',lines[i+1]):
            headers=[x.strip() for x in line.strip().strip('|').split('|')]
            table='<div class="table-wrap"><table><thead><tr>'+''.join(f'<th scope="col">{inline(cell,current)}</th>' for cell in headers)+'</tr></thead><tbody>'
            i+=2
            while i<len(lines) and lines[i].startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                table+='<tr>'+''.join(f'<td>{inline(cell,current)}</td>' for cell in cells)+'</tr>';i+=1
            out.append(table+'</tbody></table></div>');continue
        match=re.match(r'^(\s*)([-*]|\d+\.)\s+(.+)',line)
        if match:
            ordered=match[2][0].isdigit(); tag='ol' if ordered else 'ul'; items=[]
            while i<len(lines):
                item=re.match(r'^(\s*)([-*]|\d+\.)\s+(.+)',lines[i])
                if not item or item[2][0].isdigit()!=ordered: break
                val=item[3];i+=1
                while i<len(lines) and lines[i].startswith('  ') and lines[i].strip() and not re.match(r'^\s*[-*\d]',lines[i]):
                    val+=' '+lines[i].strip();i+=1
                items.append('<li>'+inline(val,current)+'</li>')
            out.append('<'+tag+'>'+''.join(items)+'</'+tag+'>');continue
        if line.startswith('> '):
            quote=[]
            while i<len(lines) and lines[i].startswith('> '):quote.append(lines[i][2:]);i+=1
            out.append('<blockquote class="notice">'+inline(' '.join(quote),current)+'</blockquote>');continue
        if re.match(r'^---+$',line.strip()):out.append('<hr>');i+=1;continue
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not blocks(lines[i]):paragraph.append(lines[i]);i+=1
        value=inline(' '.join(paragraph),current)
        if value.startswith('<img ') and value.endswith('>'):
            alt=re.search(r'alt="([^"]*)"',value)
            out.append(f'<figure>{value}<figcaption>{alt[1] if alt else ""}</figcaption></figure>')
        else:out.append('<p>'+value+'</p>')
    if chapter:out.append('</section>')
    return '\n'.join(out),headings

def shell(title, description, body, active='', filename='index.html', language='fr'):
    nav=''
    for route,label in [('fonctionnalites.html','Fonctionnalités'),('fonctionnement.html','Fonctionnement'),('guide.html','Guide'),('autohebergement.html','Autohébergement')]:
        nav+=f'<a href="{route}"'+(' aria-current="page"' if active==route else '')+f'>{label}</a>'
    return f'''<!doctype html>
<html lang="{language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#142c38"><meta name="description" content="{html.escape(description,quote=True)}"><title>{html.escape(title)} — Minutrel</title><link rel="icon" type="image/svg+xml" href="assets/icons/favicon.svg"><link rel="preload" href="assets/fonts/Manrope-Variable.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="assets/styles.css"><link rel="canonical" href="{ORIGIN}/{filename}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="{html.escape(title,quote=True)} — Minutrel"><meta property="og:description" content="{html.escape(description,quote=True)}"><meta property="og:image" content="{ORIGIN}/assets/social-preview.png"><meta property="og:url" content="{ORIGIN}/{filename}"><script src="assets/site.js" defer></script></head>
<body id="haut"><a class="skip" href="#contenu">Aller au contenu</a><header class="site-header"><div class="wrap header-inner"><a class="brand" href="index.html" aria-label="Minutrel, accueil"><img src="assets/logos/minutrel-primary.svg" alt="Minutrel" width="161" height="44"></a><nav class="desktop-nav" id="navigation" aria-label="Navigation principale">{nav}</nav><div class="header-actions"><button class="icon-btn" type="button" data-open-search aria-label="Rechercher dans le site (Ctrl ou Cmd + K)">{icon('search')}</button>{button('Commencer','autohebergement.html#choisir')}<button class="icon-btn menu-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navigation">{icon('menu')}</button></div></div></header>
<main id="contenu">{body}</main>
<footer class="site-footer"><div class="wrap"><div class="footer-top"><div class="footer-brand"><a href="index.html" aria-label="Minutrel, accueil"><img src="assets/logos/minutrel-primary.svg" alt="Minutrel" width="148" height="40" loading="lazy"></a><p>Le temps de vos projets, ensemble.<br>Libre. Personnel. Partagé.</p><span class="pill">V0.1 · Préversion d’essai</span></div><div class="footer-col"><strong>LE PRODUIT</strong><a href="fonctionnalites.html">Fonctionnalités</a><a href="fonctionnement.html">Fonctionnement</a><a href="index.html#demo">Essayer le chrono</a><a href="version.html">État de la V0.1</a></div><div class="footer-col"><strong>LES REPÈRES</strong><a href="guide.html">Guide utilisateur</a><a href="autohebergement.html">Autohébergement</a><a href="sauvegardes.html">Sauvegarde &amp; restauration</a><a href="ressources.html">Toutes les ressources</a></div><div class="footer-col"><strong>LES CONNEXIONS</strong><a href="integrations.html">Assistants &amp; IA</a><a href="api-webhooks.html">API &amp; webhook</a><a href="api.html">Référence REST</a><a href="ressources.html#telechargements">Sources &amp; téléchargements</a></div></div><div class="footer-bottom"><span>Minutrel · Logiciel libre <a href="licence.html">AGPL-3.0-or-later</a> · Documentation de la version 0.1.0</span><span><a href="guide.html">FR</a> · <a href="guide-en.html" lang="en">EN</a> · <a href="guide-de.html" lang="de">DE</a> &nbsp; / &nbsp; Police Manrope · <a href="assets/fonts/OFL.txt">SIL OFL</a></span></div></div></footer>
<dialog class="search-dialog" aria-labelledby="search-label"><div class="search-header">{icon('search')}<label for="site-search" id="search-label" class="sr-only">Rechercher</label><input id="site-search" type="search" placeholder="Rechercher une fonction, un guide, une commande…" autocomplete="off"><button class="icon-btn" type="button" data-close-search aria-label="Fermer la recherche">{icon('close')}</button></div><div class="search-results" aria-live="polite"></div><p class="search-help">Ctrl/Cmd + K pour ouvrir · Échap pour fermer · La recherche reste sur ce site.</p></dialog>
<dialog class="lightbox" aria-label="Capture agrandie"><button class="icon-btn" type="button" data-close-lightbox aria-label="Fermer la capture">{icon('close')}</button><img alt=""><p></p></dialog><div class="toast" hidden role="status"></div><a href="#haut" class="top-link" aria-label="Revenir en haut" hidden>{icon('arrow-up')}</a></body></html>'''

def doc_page(key, data):
    filename,title,description,eyebrow=data
    text=(CONTENT/key).read_text()
    if key.startswith('docs/guide/'):
        text=re.sub(r'^\[Français\].*\n','',text,flags=re.M)
    rendered,toc=markdown(text,key)
    plain_title=re.sub('<[^>]+>',' ',title)
    active='guide.html' if key.startswith('docs/guide/') else ('autohebergement.html' if key in {'docs/AUTOHEBERGEMENT.md','infra/backup/README.md'} else '')
    languages='<div class="langs" aria-label="Langue du guide">'+''.join(f'<a href="{route}" lang="{lang}"'+(' aria-current="page"' if route==filename else '')+f'>{label}</a>' for route,lang,label in [('guide.html','fr','Français'),('guide-en.html','en','English'),('guide-de.html','de','Deutsch')])+'</div>' if key.startswith('docs/guide/') else '<span>Documentation de la version 0.1.0</span>'
    tools=f'<div class="doc-tools">{languages}<a href="downloads/minutrel-documentation.zip" download>Documentation Markdown ↓</a></div>'
    sidebar='<aside class="doc-sidebar" aria-label="Dans cette page"><p>Dans cette page</p>'
    if len(toc)>8: sidebar+='<label for="chapter-search" class="sr-only">Filtrer les chapitres du guide</label><input type="search" class="field-search sidebar-search" id="chapter-search" placeholder="Filtrer les chapitres…">'
    sidebar+='<nav class="toc" aria-label="Sommaire">'+''.join(f'<a href="#{anchor}">{html.escape(label)}</a>' for anchor,label in toc)+'</nav><div class="related"><p style="font-size:10px;font-weight:800;letter-spacing:.1em;margin:28px 0 12px">POUR ALLER PLUS LOIN</p><a href="guide.html">Guide utilisateur</a><a href="autohebergement.html">Autohébergement</a><a href="sauvegardes.html">Sauvegardes</a><a href="ressources.html">Toutes les ressources ↗</a></div></aside>'
    extra='<div class="intro-meta"><span class="pill green">Version 0.1.0</span><span>Guides illustrés · Données d’exemple fictives</span></div>' if key.startswith('docs/guide/') else ''
    body=intro(title,description,eyebrow,plain_title,extra)
    if key=='docs/AUTOHEBERGEMENT.md':body+=hosting_extra(snapshot)
    body+=f'<div class="wrap doc-layout">{sidebar}<article class="doc-content">{tools}<p id="chapter-count" class="chapter-result" role="status" hidden></p><div class="prose">{rendered}</div><nav class="doc-next" aria-label="Continuer la lecture"><a href="ressources.html">← Toutes les ressources</a><a href="guide.html">Ouvrir le guide utilisateur ↗</a></nav></article></div>'
    lang='en' if filename=='guide-en.html' else 'de' if filename=='guide-de.html' else 'fr'
    # The site navigation stays French; mark only the translated article as its own language.
    if lang!='fr':body=body.replace('<article class="doc-content">',f'<article class="doc-content" lang="{lang}">')
    return shell(plain_title,description,body,active,filename),rendered,toc

DIST.mkdir(exist_ok=True)
for child in DIST.iterdir():
    if child.is_dir():shutil.rmtree(child)
    else:child.unlink()
shutil.copytree(SRC/'assets',DIST/'assets')
# Unbuilt application/template HTML belongs in the source archive, not the website.
for file in (DIST/'assets'/'reference').rglob('*.html'):file.unlink()
shutil.copytree(SRC/'downloads',DIST/'downloads')
for file in ['styles.css','site.js']:shutil.copy2(SRC/file,DIST/'assets'/file)
with (DIST/'assets'/'styles.css').open('a') as file:file.write('\n.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n')

pages = [
    ('index.html','Le temps de vos projets, ensemble.','Minutrel : suivi du temps par projet, libre et autohébergé. Ordinateur autonome ou équipe, chronomètre, notes et rapports.',home(),''),
    ('fonctionnalites.html','Toutes les fonctionnalités','Découvrez les fonctions de Minutrel 0.1.0 : temps, projets, équipe, rapports, hors connexion, MCP et autohébergement.',features(),'fonctionnalites.html'),
    ('fonctionnement.html','Comment fonctionne Minutrel','Comprenez les modes personnel, équipe et navigateur, le stockage des données et la synchronisation de Minutrel.',functioning(),'fonctionnement.html'),
    ('ressources.html','Guides et ressources','Documentation complète, sources, guides, API et téléchargements pour Minutrel 0.1.0.',resources(),''),
]
index=[]
def text_only(value):
    value=re.sub(r'<script[\s\S]*?</script>','',value)
    value=re.sub(r'<button[\s\S]*?</button>|<span class="code-language">[\s\S]*?</span>|<h[1-6][^>]*>[\s\S]*?</h[1-6]>','',value)
    return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',value))).strip()
for filename,title,description,body,active in pages:
    (DIST/filename).write_text(shell(title,description,body,active,filename))
    index.append({'title':title,'group':'Présentation','text':description,'url':filename})
for symbol,category,title,description,tags,href in FEATURES:
    index.append({'title':title,'group':'Fonctionnalités','text':description+' · '+' · '.join(tags),'url':href})
for key,data in DOCS.items():
    output,rendered,toc=doc_page(key,data)
    (DIST/data[0]).write_text(output)
    group='Guide utilisateur' if key.startswith('docs/guide') else re.sub('<[^>]+>',' ',data[1])
    if key.startswith('docs/guide/') and '/fr/' not in key:continue
    index.append({'title':re.sub('<[^>]+>',' ',data[1]),'group':'Documentation','text':data[2],'url':data[0]})
    if toc:
        for anchor,title in toc:
            match=re.search(r'<section class="doc-chapter" id="'+re.escape(anchor)+r'">([\s\S]*?)(?=</section>)',rendered)
            index.append({'title':title,'group':group,'text':text_only(match[1] if match else rendered),'url':data[0]+'#'+anchor})
    else:index.append({'title':group,'group':'Documentation','text':text_only(rendered),'url':data[0]})
(DIST/'search-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
(DIST/'search-data.js').write_text('window.MINUTREL_SEARCH_INDEX = '+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\n')
english_index=build_english(DIST,CONTENT,DOCS,shell,markdown,slug,pages,snapshot,hosting_extra,intro,resource,FEATURES)
for file in DIST.glob('*.html'):
    file.write_text(configure(file.read_text(),file.name))
# Preserve the former English-guide entry point without a mixed-language shell.
(DIST/'guide-en.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=en/guide.html"><title>User guide — Minutrel</title></head><body><h1>User guide</h1><a href="en/guide.html">Open the English user guide</a></body></html>')
with zipfile.ZipFile(DIST/'downloads'/'minutrel-documentation.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(CONTENT.rglob('*.md')):archive.write(file,file.relative_to(CONTENT))
    for file in sorted((SRC/'assets'/'screenshots').iterdir()):archive.write(file,Path('docs/screenshots')/file.name)
routes=[x.relative_to(DIST).as_posix() for x in DIST.rglob('*.html')]
if ORIGIN:
    (DIST/'sitemap.xml').write_text('<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{ORIGIN}/{name}</loc></url>' for name in routes)+'</urlset>')
    (DIST/'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {ORIGIN}/sitemap.xml\n')
(DIST/'404.html').write_text(configure(shell('Cette page a pris un autre chemin','Retrouvez les guides et fonctionnalités de Minutrel.',intro('Cette page a pris<br>un autre chemin.','Retrouvez les fonctionnalités, le guide et les procédures d’installation depuis l’accueil.','Erreur 404','Page introuvable','<div class="actions">'+button('Retour à l’accueil','index.html')+button('Ouvrir les ressources','ressources.html','outline')+'</div>'),filename='404.html'),'404.html'))
from bilingual import localise
(DIST/'en'/'404.html').write_text(configure(localise(shell('Page not found','Find Minutrel features, guides and installation instructions.',intro('This page took<br>another path.','Find features, guides and installation instructions from the home page.','Error 404','Page not found','<div class="actions">'+button('Back to home','index.html')+'</div>'),filename='404.html',language='en')),'404.html','en'))
# The exported website needs only a static host. No Site identity, account or secret is included.
with zipfile.ZipFile(DIST/'downloads'/'minutrel-site-autonome.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(DIST.rglob('*')):
        if file.is_file() and file.name!='minutrel-site-autonome.zip':
            if file.suffix=='.html':
                value=file.read_text()
                value=value.replace('href="downloads/minutrel-site-autonome.zip"','href="heberger-le-site.html"').replace('href="../downloads/minutrel-site-autonome.zip"','href="heberger-le-site.html"')
                archive.writestr(str(Path('minutrel-site')/file.relative_to(DIST)),value)
            else:archive.write(file,Path('minutrel-site')/file.relative_to(DIST))
    archive.write(ROOT/'README.md',Path('minutrel-site')/'README-site.md')
print(f'Site local construit : français + anglais ; {len(index)} / {len(english_index)} entrées de recherche. Tous les actifs sont locaux.')
if MISSING:
    (ROOT/'translation-review.json').write_text(json.dumps(sorted(MISSING),ensure_ascii=False,indent=2)+'\n')
    print(f'À relire : {len(MISSING)} textes dans translation-review.json')
elif (ROOT/'translation-review.json').exists():
    (ROOT/'translation-review.json').unlink()
