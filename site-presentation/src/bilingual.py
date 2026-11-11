"""Build-time English localisation and portable FR/EN navigation."""
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

TRANSLATIONS = json.loads((Path(__file__).parent/'en.json').read_text())
EN_DOCS = {
 'guide.html':('docs/guide/en/README.md','docs/guide/en/README.md','User guide','The complete illustrated guide to personal workspaces, teams, timers, notes and reports.','The guide · English'),
 'autohebergement.html':('en/self-hosting.md','docs/AUTOHEBERGEMENT.md','Your time.<br>Your hosting.','Install a team workspace on your own infrastructure with Docker Compose or Node.js 24. The desktop client can also work on its own, without a server.','Install Minutrel'),
 'synchronisation.html':('en/synchronisation.md','docs/SYNCHRONISATION.md','Standalone work and synchronisation','Understand local storage, the team outbox, personal transfers and conflict resolution.','Understand your data'),
 'doc-commande-rapide.html':('en/mini-timer.md','docs/COMMANDE_RAPIDE.md','The mini timer','A project you choose, accessible controls and clearly visible timer states.','Track time'),
 'integrations.html':('en/integrations.md','docs/INTEGRATIONS_IA.md','Connections<br>on your terms.','MCP assistants, optional writing providers and personal permissions: connect the tools you choose.','Integrations'),
 'api-webhooks.html':('en/api-webhooks.md','docs/API_WEBHOOKS.md','API, MCP and webhook','The team instance’s three access paths, authentication and an incoming webhook example.','Connect your tools'),
 'api.html':('en/api.md','docs/API.md','The API reference','REST routes, authentication, concurrency, reports and desktop synchronisation.','Technical documentation'),
 'rapports.html':('en/reports.md','docs/RAPPORTS_MENSUELS.md','From work to reports.','Understand monthly calculations, shared content and CSV, PDF and ZIP exports.','Monthly reports'),
 'sauvegardes.html':('en/backups.md','infra/backup/README.md','Back up.<br>Know how to restore.','A consistent copy of SQLite and its key, an off-volume backup and a verified restore.','Operate Minutrel'),
 'version.html':('en/version.md','docs/ETAT_V0_1.md','The scope of V0.1','Delivered features, first-version limitations and planned improvements.','Version 0.1.0 · Preview'),
 'validation.html':('en/validation.md','docs/VALIDATION_CI.md','The documented checks','Recorded local checks from 5–6 November 2026 and validation still needed in other environments.','Validation status'),
 'architecture.html':('en/architecture.md','docs/ARCHITECTURE.md','A readable architecture.','React and Tauri clients, one Fastify server, SQLite and separate personal storage.','Under the hood'),
 'modele-donnees.html':('en/data-model.md','docs/MODELE_DE_DONNEES.md','The data model','Entities, versions, secrets and portability in Minutrel V0.1.','Technical documentation'),
 'licence.html':('en/licence.md','LICENSING.md','Open and documented.','Licence notices for Minutrel and the project’s third-party resources.','AGPL-3.0-or-later'),
 'securite.html':('en/security.md','SECURITY.md','Report a problem','The current process for reporting a security problem in this preview.','The project'),
 'nouveautes.html':('en/changelog.md','CHANGELOG.md','What’s new','The Minutrel changelog, starting with the first version.','The project'),
 'heberger-le-site.html':('en/host-the-site.md','site/HEBERGER_LE_SITE.md','Run this website<br>locally.','A complete French and English presentation website you can open directly or serve on your own computer.','The Minutrel website'),
}
MAIN_PAGES = {
 'index.html':('Time for your projects, together.','Minutrel: free, self-hosted project time tracking. Standalone desktop or team work, with timers, notes and reports.'),
 'fonctionnalites.html':('All features','Time tracking, subcategories, project planning, Gantt charts and weekly timesheets in Minutrel V0.1.'),
 'fonctionnement.html':('How Minutrel works','Understand personal, team and browser modes, data storage and synchronisation.'),
 'ressources.html':('Guides and resources','User guides, technical documentation and downloads for Minutrel V0.1.'),
 'videos.html':('Minutrel video guides','English product introduction and practical guides, with narration, music and subtitles.'),
}
ROUTES = set(MAIN_PAGES)|set(EN_DOCS)|{'404.html'}
ANCHORS = {}
MISSING = set()

def translate(value):
    stripped=value.strip()
    if stripped in TRANSLATIONS:
        start=len(value)-len(value.lstrip())
        end=len(value.rstrip())
        return value[:start]+TRANSLATIONS[stripped]+value[end:]
    return value

def english_url(value):
    parts=urlsplit(value)
    if parts.scheme or parts.netloc or value.startswith('#'): return value
    route=unquote(parts.path)
    anchor=ANCHORS.get(route,{}).get(parts.fragment,parts.fragment)
    suffix=('#'+anchor) if anchor else ''
    if route=='guide-en.html':return 'guide.html'+suffix
    if route in ROUTES:return route+suffix
    if route.startswith(('assets/','downloads/')):return '../'+value
    if route.endswith('.html'):return '../'+value
    return value

class Localise(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.out=[];self.stack=[]
    def handle_decl(self,data):self.out.append('<!'+data+'>')
    def handle_starttag(self,tag,attrs):
        result=[]
        for key,value in attrs:
            if value is None:result.append(key);continue
            if key in {'href','src'}:value=english_url(value)
            elif key in {'alt','aria-label','placeholder','title'}:value=translate(value)
            elif tag=='html' and key=='lang':value='en'
            elif tag=='meta' and key=='content' and value=='fr_FR':value='en_GB'
            result.append(key+'="'+html.escape(value,quote=True)+'"')
        self.out.append('<'+tag+(' '+' '.join(result) if result else '')+'>')
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(tag)
    def handle_startendtag(self,tag,attrs):
        depth=len(self.stack)
        self.handle_starttag(tag,attrs)
        self.out[-1]=self.out[-1][:-1]+'/>'
        self.stack=self.stack[:depth]
    def handle_endtag(self,tag):
        self.out.append('</'+tag+'>')
        if tag in self.stack:self.stack=self.stack[:len(self.stack)-1-self.stack[::-1].index(tag)]
    def handle_data(self,data):
        if any(tag in self.stack for tag in ['script','style']):self.out.append(data);return
        if any(tag in self.stack for tag in ['code','pre']):self.out.append(html.escape(data));return
        value=translate(data)
        if value==data and data.strip() not in {'Français / English / Deutsch'} and data.strip() and re.search(r'[éèêàçùœ]|\b(?:Les|Votre|vos|des|pour|sur|avec|sans|une|du)\b',data):MISSING.add(data.strip())
        self.out.append(html.escape(value))
    def handle_comment(self,data):self.out.append('<!--'+data+'-->')

def localise(source):
    parser=Localise();parser.feed(source);return ''.join(parser.out)

def language_nav(filename,lang):
    paired=filename if filename in ROUTES else 'ressources.html'
    fr=('../' if lang=='en' else '')+paired
    en=('' if lang=='en' else 'en/')+paired
    mapping=ANCHORS.get(paired,{})
    reverse={}
    for source,target in mapping.items():reverse.setdefault(target,source)
    def link(code,url,anchors):
        current=lang==code
        data=html.escape(json.dumps(anchors,ensure_ascii=False),quote=True)
        return f'<a href="{url}" lang="{code}" hreflang="{code}" data-language-switch data-anchor-map="{data}"'+(' aria-current="true"' if current else '')+f'>{code.upper()}</a>'
    label='Site language' if lang=='en' else 'Langue du site'
    return f'<nav class="language-switch" aria-label="{label}">'+link('fr',fr,reverse if lang=='en' else {})+link('en',en,mapping if lang=='fr' else {})+'</nav>'

def configure(source,filename,lang='fr',local=True):
    if local:
        source=re.sub(r'<link rel="canonical"[^>]*>|<meta property="og:url"[^>]*>','',source)
        source=re.sub(r'(<meta property="og:image" content=")[^"]*(/assets/social-preview.png")',r'\1assets/social-preview.png"',source)
    # These are full-site language links, rather than user-guide-only links.
    source=re.sub(r'<span><a href="guide.html">FR</a>[\s\S]*?SIL OFL</a></span>', '<span class="footer-language">'+language_nav(filename,lang)+'<span>Manrope · <a href="'+('../' if lang=='en' else '')+'assets/fonts/OFL.txt">SIL OFL</a></span></span>',source)
    source=source.replace('<div class="header-actions">','<div class="header-actions">'+language_nav(filename,lang),1)
    prefix='../' if lang=='en' else ''
    extra=f'<script src="search-data.js" defer></script>'
    if lang=='en':extra+=f'<script src="{prefix}assets/translations-en.js" defer></script>'
    source=source.replace('<script src="'+prefix+'assets/site.js" defer>',extra+'<script src="'+prefix+'assets/site.js" defer>',1)
    paired=filename if filename in ROUTES else 'ressources.html'
    alternates=f'<link rel="alternate" hreflang="fr" href="{prefix}{paired}"><link rel="alternate" hreflang="en" href="{("" if lang=="en" else "en/")}{paired}">'
    return source.replace('</head>',alternates+'</head>',1)

def english_resources(intro,resource):
    body=intro('Good references.<br>In one place.','User guides, technical documentation and downloads for the Minutrel 0.1.0 preview.','The Minutrel library','Resources')
    groups=[('Learn and use',[('book','User guide','The complete illustrated guide, from your first project to troubleshooting.','guide.html','13 CHAPTERS'),('sync','Synchronisation','Personal workspaces, offline team entries, transfers and conflicts.','synchronisation.html','DATA BETWEEN DEVICES'),('chart','Monthly reports','Calculations, privacy and export formats.','rapports.html','CSV · PDF · ZIP'),('clock','Mini timer','Desktop widget, browser bar and clear timer states.','doc-commande-rapide.html','QUICK CONTROLS')]),('Install and connect',[('server','Self-host Minutrel','Docker or Node.js 24, persistent data and HTTPS.','autohebergement.html','INSTALLATION'),('shield','Backup and restoration','Consistent SQLite copies, keys and restoring to an empty folder.','sauvegardes.html','OPERATIONS'),('spark','Assistants and AI','MCP scopes and optional AI writing providers.','integrations.html','CONNECTIONS'),('code','API and webhook','Authentication, incoming private notes and errors.','api-webhooks.html','INTEGRATIONS'),('code','REST reference','Routes, inputs, concurrency and synchronisation.','api.html','HTTP CONTRACT'),('projects','Architecture and data','Clients, one server, storage and report processing.','architecture.html','UNDER THE HOOD'),('globe','Run this website locally','Open the files directly or start a local static server.','heberger-le-site.html','LOCAL WEBSITE')]),('Understand the preview',[('file','V0.1 scope','Delivered capabilities, boundaries and future work.','version.html','VERSION 0.1.0'),('check','Documented validation','Recorded checks and validation still required elsewhere.','validation.html','5–6 NOVEMBER 2026'),('file','Changelog','Changes from the first functional version.','nouveautes.html','PROJECT HISTORY'),('code','Licensing','Project and third-party licence notices.','licence.html','AGPL-3.0-OR-LATER')]),('Downloads',[('download','Minutrel source code','Source archive to build the server or native clients.','downloads/minutrel-0.1.0-sources.zip','ZIP · PREVIEW'),('book','Markdown documentation','English user guide and translated core documentation; original French technical references are included too.','downloads/minutrel-documentation.zip','ZIP · EN / FR'),('chart','Sample report PDF','Generated by Minutrel with fictional data and French labels.','downloads/minutrel-rapport-demo-2026-11.pdf','PDF · FRENCH SAMPLE'),('projects','Brand guidelines','The project identity, colours and visual assets; original French document.','downloads/minutrel-charte-graphique.pdf','PDF · FRENCH REFERENCE'),('globe','Standalone presentation website','The complete French and English static website, ready to use locally.','downloads/minutrel-site-autonome.zip','ZIP · HTML / CSS / JAVASCRIPT'),('code','Full licence text','The complete AGPL-3.0-or-later licence.','downloads/LICENSE.txt','FULL TEXT')])]
    for title,items in groups:
        anchor=' id="telechargements"' if title=='Downloads' else ''
        body+=f'<section class="section"{anchor} style="padding-bottom:0"><div class="wrap"><div class="section-head"><h2>{title}</h2></div><div class="resource-grid">'+''.join(resource(*item) for item in items)+'</div></div></section>'
    return body+'<section class="section"><div class="wrap notice">V0.1 is a test preview. Desktop installers are unsigned. Read the <a href="version.html">version scope</a> and <a href="validation.html">documented checks</a>.</div></section>'

def build_english(dist,content,docs,shell,markdown,slug,source_pages,snapshot,hosting_extra,intro,resource,features):
    english=dist/'en';english.mkdir(exist_ok=True)
    fr_by_route={data[0]:key for key,data in docs.items()}
    for route,(path,context,*_) in EN_DOCS.items():
        en_markdown=(content/path).read_text()
        en_markdown=re.sub(r'^\[Français\].*\n','',en_markdown,flags=re.M)
        _,en_toc=markdown(en_markdown,context)
        _,fr_toc=markdown((content/fr_by_route[route]).read_text(),fr_by_route[route])
        if route=='guide.html':
            matches=[0,1,2,4,5,6,3,7,8,9,2,10,11,12]
            ANCHORS[route]={fr[0]:en_toc[matches[i]][0] for i,fr in enumerate(fr_toc)}
        else:ANCHORS[route]={fr[0]:en[0] for fr,en in zip(fr_toc,en_toc)}
    index=[]
    for filename,title,desc,body,active in source_pages:
        title,desc=MAIN_PAGES[filename]
        if filename=='ressources.html':body=english_resources(intro,resource)
        output=localise(shell(title,desc,body,active,filename,language='en'))
        if filename=='index.html':output=output.replace('../assets/screenshots/01-vue-ensemble.jpg','../assets/screenshots/11-english.jpg')
        (english/filename).write_text(configure(output,filename,'en'))
        index.append({'title':title,'group':'Presentation','text':desc,'url':filename})
    for symbol,category,title,desc,tags,href in features:
        index.append({'title':translate(title),'group':'Features','text':translate(desc)+' · '+' · '.join(translate(tag) for tag in tags),'url':english_url(href)})
    for filename,(path,context,title,desc,eyebrow) in EN_DOCS.items():
        text=(content/path).read_text()
        text=re.sub(r'^\[Français\].*\n','',text,flags=re.M)
        rendered,toc=markdown(text,context)
        toc_html=''.join(f'<a href="#{anchor}">{html.escape(label)}</a>' for anchor,label in toc)
        search='<label for="chapter-search" class="sr-only">Filter guide chapters</label><input type="search" class="field-search sidebar-search" id="chapter-search" placeholder="Filter chapters…">' if len(toc)>8 else ''
        sidebar=f'<aside class="doc-sidebar" aria-label="On this page"><p>On this page</p>{search}<nav class="toc" aria-label="Contents">{toc_html}</nav><div class="related"><p style="font-size:10px;font-weight:800;margin:24px 0 10px">KEEP READING</p><a href="guide.html">User guide</a><a href="autohebergement.html">Self-hosting</a><a href="sauvegardes.html">Backups</a><a href="ressources.html">All resources ↗</a></div></aside>'
        tools='<div class="doc-tools"><span>Version 0.1.0 · English documentation</span><a href="downloads/minutrel-documentation.zip" download>Markdown documentation ↓</a></div>'
        body=intro(title,desc,eyebrow,re.sub('<[^>]+>',' ',title))
        if filename=='autohebergement.html':body+=hosting_extra(snapshot)
        body+=f'<div class="wrap doc-layout">{sidebar}<article class="doc-content" lang="en">{tools}<p id="chapter-count" class="chapter-result" role="status" hidden></p><div class="prose">{rendered}</div><nav class="doc-next" aria-label="Continue reading"><a href="ressources.html">← All resources</a><a href="guide.html">Open the user guide ↗</a></nav></article></div>'
        output=localise(shell(re.sub('<[^>]+>',' ',title),desc,body,filename if filename in {'guide.html','autohebergement.html'} else '',filename,language='en'))
        (english/filename).write_text(configure(output,filename,'en'))
        index.append({'title':re.sub('<[^>]+>',' ',title),'group':'Documentation','text':desc,'url':filename})
        for anchor,label in toc:
            match=re.search(r'<section class="doc-chapter" id="'+re.escape(anchor)+r'">([\s\S]*?)(?=</section>)',rendered)
            value=match[1] if match else rendered
            value=re.sub(r'<button[\s\S]*?</button>|<h[1-6][^>]*>[\s\S]*?</h[1-6]>','',value)
            plain=re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',value))).strip()
            index.append({'title':label,'group':re.sub('<[^>]+>',' ',title),'text':plain,'url':filename+'#'+anchor})
    (dist/'assets'/'translations-en.js').write_text('window.MINUTREL_TRANSLATIONS = '+json.dumps(TRANSLATIONS,ensure_ascii=False)+';\n')
    (english/'search-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
    (english/'search-data.js').write_text('window.MINUTREL_SEARCH_INDEX = '+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\n')
    return index
