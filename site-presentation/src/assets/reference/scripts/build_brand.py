#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Reconstruit les ressources vectorielles, les icônes et la charte de Minutrel."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as PdfFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
TOKENS = json.loads((BRAND / "tokens.json").read_text(encoding="utf-8"))
C = TOKENS["colors"]
FONTS = BRAND / "fonts"


def static_fonts():
    for weight, label in [(400, "Regular"), (600, "SemiBold"), (800, "ExtraBold")]:
        font = TTFont(FONTS / "Manrope-Variable.ttf")
        instance = instantiateVariableFont(font, {"wght": weight}, inplace=False)
        names = {1: "Manrope", 2: label, 4: f"Manrope {label}", 6: f"Manrope-{label}", 16: "Manrope", 17: label}
        for name_id, value in names.items():
            instance["name"].setName(value, name_id, 3, 1, 0x409)
            instance["name"].setName(value, name_id, 1, 0, 0)
        instance.recalcTimestamp = False
        instance.save(FONTS / f"Manrope-{label}.ttf")


def mark_svg(foreground, accent):
    return (f'<path d="M22 67V29L48 53L74 29V67" fill="none" stroke="{foreground}" '
            'stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="74" cy="13" r="6" fill="{accent}"/>')


def outlined_wordmark(color):
    font = TTFont(FONTS / "Manrope-ExtraBold.ttf")
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = 72 / font["head"].unitsPerEm
    x = 112
    paths = []
    for char in "minutrel":
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 78)))
        paths.append(f'<path fill="{color}" d="{pen.getCommands()}"/>')
        x += font["hmtx"].metrics[name][0] * scale - 1.5
    return "".join(paths)


def svg_assets():
    logos = BRAND / "assets/logos"
    icons = BRAND / "assets/icons"
    logos.mkdir(parents=True, exist_ok=True)
    icons.mkdir(parents=True, exist_ok=True)
    variants = {
        "primary": (C["primary"], C["accent"], C["ink"]),
        "reverse": (C["white"], C["accent"], C["white"]),
        "mono-dark": (C["ink"], C["ink"], C["ink"]),
        "mono-white": (C["white"], C["white"], C["white"]),
    }
    for name, (foreground, accent, word) in variants.items():
        body = f'<g transform="translate(0 4)">{mark_svg(foreground, accent)}</g>' + outlined_wordmark(word)
        (logos / f"minutrel-{name}.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 104" role="img" aria-labelledby="title">'
            f'<title id="title">Minutrel - logo {name}</title>{body}</svg>\n', encoding="utf-8")
    symbol = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-labelledby="title">'
    (logos / "minutrel-symbol.svg").write_text(symbol + '<title id="title">Minutrel</title>' + mark_svg(C["primary"], C["accent"]) + '</svg>\n', encoding="utf-8")
    favicon = symbol + '<title id="title">Minutrel</title>' + f'<rect width="96" height="96" rx="22" fill="{C["ink"]}"/>' + mark_svg(C["white"], C["accent"]) + '</svg>\n'
    (icons / "favicon.svg").write_text(favicon, encoding="utf-8")
    (ROOT / "apps/web/public").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(icons / "favicon.svg", ROOT / "apps/web/public/favicon.svg")


def image_font(size, weight="Regular"):
    return ImageFont.truetype(str(FONTS / f"Manrope-{weight}.ttf"), size)


def image_mark(draw, x, y, size, foreground, accent):
    s = size / 96
    points = [(x + a * s, y + b * s) for a, b in [(22, 67), (22, 29), (48, 53), (74, 29), (74, 67)]]
    width = max(1, round(12 * s))
    draw.line(points, fill=foreground, width=width, joint="curve")
    for px, py in points:
        draw.ellipse((px - width/2, py - width/2, px + width/2, py + width/2), fill=foreground)
    cx, cy, r = x + 74*s, y + 13*s, 6*s
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=accent)


def raster_assets():
    icons = BRAND / "assets/icons"
    icon = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((0, 0, 1023, 1023), radius=224, fill=C["ink"])
    image_mark(draw, 64, 64, 896, C["white"], C["accent"])
    for size in [16, 32, 128, 256, 512, 1024]:
        icon.resize((size, size), Image.Resampling.LANCZOS).save(icons / f"app-{size}.png")
    icon.save(icons / "app.ico", sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]])
    icon.save(icons / "app.icns")
    native = ROOT / "apps/desktop/src-tauri/icons"
    native.mkdir(parents=True, exist_ok=True)
    for src, dest in [("app-32.png", "32x32.png"), ("app-128.png", "128x128.png"), ("app-256.png", "128x128@2x.png"), ("app.ico", "icon.ico"), ("app.icns", "icon.icns")]:
        shutil.copyfile(icons / src, native / dest)
    for name, fg, accent in [("primary", C["ink"], C["primary"]), ("reverse", C["white"], C["white"])]:
        image = Image.new("RGBA", (1380, 312), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        image_mark(draw, 0, 12, 288, accent, C["accent"])
        draw.text((336, 25), "minutrel", font=image_font(216, "ExtraBold"), fill=fg, stroke_width=0)
        image.save(BRAND / f"assets/logos/minutrel-{name}.png")
    preview = BRAND / "preview"
    preview.mkdir(parents=True, exist_ok=True)
    board = Image.new("RGB", (1600, 1120), C["canvas"])
    draw = ImageDraw.Draw(board)
    draw.rounded_rectangle((48, 48, 1552, 696), radius=32, fill=C["ink"])
    image_mark(draw, 112, 128, 104, C["white"], C["accent"])
    draw.text((240, 130), "minutrel", font=image_font(80, "ExtraBold"), fill=C["white"])
    draw.text((120, 304), "Le temps de vos projets,", font=image_font(58, "ExtraBold"), fill=C["white"])
    draw.text((120, 388), "ensemble.", font=image_font(58, "ExtraBold"), fill=C["accent"])
    draw.text((120, 576), "Libre. Autohébergé. Pour toute l’équipe.", font=image_font(25), fill="#CCD8D8")
    image_mark(draw, 1130, 220, 300, C["white"], C["accent"])
    palette = [("Encre", "ink"), ("Vert", "primary"), ("Citron", "accent"), ("Papier", "canvas"), ("Ardoise", "muted")]
    for i, (label, key) in enumerate(palette):
        x = 48 + i * 304
        draw.rounded_rectangle((x, 744, x+288, 916), radius=16, fill=C[key], outline=C["border"])
        draw.text((x, 940), label, font=image_font(22, "SemiBold"), fill=C["ink"])
        draw.text((x, 977), C[key], font=image_font(20), fill=C["muted"])
    draw.text((48, 1060), "Identité proposée - 05 novembre 2026", font=image_font(18), fill=C["muted"])
    board.save(preview / "minutrel-identite.png")
    social = Image.new("RGB", (1200, 630), C["ink"])
    draw = ImageDraw.Draw(social)
    image_mark(draw, 70, 64, 88, C["white"], C["accent"])
    draw.text((178, 67), "minutrel", font=image_font(68, "ExtraBold"), fill=C["white"])
    draw.text((80, 250), "Le temps de vos projets,", font=image_font(58, "ExtraBold"), fill=C["white"])
    draw.text((80, 330), "ensemble.", font=image_font(58, "ExtraBold"), fill=C["accent"])
    draw.text((80, 535), "Suivi du temps en équipe · Libre et autohébergé", font=image_font(25), fill="#CCD8D8")
    social.save(BRAND / "assets/social-preview.png")


def contrast(a, b):
    def luminance(color):
        rgb = [int(color[i:i+2], 16) / 255 for i in [1, 3, 5]]
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        return sum(x*y for x,y in zip(linear, [.2126, .7152, .0722]))
    values = sorted([luminance(a), luminance(b)])
    return (values[1]+.05)/(values[0]+.05)


def pdf_book():
    out = ROOT / "output/pdf/minutrel-charte-graphique.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    for label in ["Regular", "SemiBold", "ExtraBold"]:
        pdfmetrics.registerFont(PdfFont(f"Manrope-{label}", str(FONTS / f"Manrope-{label}.ttf")))
    w,h = A4
    pdf = canvas.Canvas(str(out), pagesize=A4, invariant=1, pageCompression=1)
    pdf.setTitle("Minutrel - Identité de marque et charte graphique")
    pdf.setAuthor("Projet Minutrel")
    def rect(x,y,width,height,color,r=0):
        pdf.setFillColor(HexColor(color))
        if r: pdf.roundRect(x,h-y-height,width,height,r,fill=1,stroke=0)
        else: pdf.rect(x,h-y-height,width,height,fill=1,stroke=0)
    def text(x,y,value,size=12,weight="Regular",color=None):
        pdf.setFillColor(HexColor(color or C["ink"]))
        pdf.setFont(f"Manrope-{weight}",size)
        pdf.drawString(x,h-y,value)
    def para(x,y,value,width=510,size=11,color=None):
        for line in simpleSplit(value,"Manrope-Regular",size,width):
            text(x,y,line,size,color=color); y+=size*1.65
        return y
    def mark(x,y,size,fg=None,accent=None):
        pdf.saveState(); pdf.translate(x,h-y-size); pdf.scale(size/96,size/96)
        pdf.setStrokeColor(HexColor(fg or C["primary"])); pdf.setLineWidth(12); pdf.setLineCap(1); pdf.setLineJoin(1)
        p=pdf.beginPath(); p.moveTo(22,29); p.lineTo(22,67); p.lineTo(48,43); p.lineTo(74,67); p.lineTo(74,29); pdf.drawPath(p)
        pdf.setFillColor(HexColor(accent or C["accent"])); pdf.circle(74,83,6,fill=1,stroke=0); pdf.restoreState()
    def heading(n,label,title):
        rect(0,0,w,h,C["canvas"])
        text(42,42,"MINUTREL / IDENTITÉ",9,"SemiBold",C["muted"])
        text(42,105,label.upper(),10,"SemiBold",C["primary"])
        title_size = min(30, 511 * 30 / pdfmetrics.stringWidth(title,"Manrope-ExtraBold",30))
        text(42,150,title,title_size,"ExtraBold")
        text(42,h-28,"05 novembre 2026 / Proposition",8,color=C["muted"])
        text(w-65,h-28,f"{n:02d} / 06",8,color=C["muted"])
    def logo(x,y,reverse=False):
        mark(x,y,64,C["white"] if reverse else C["primary"])
        text(x+78,y+49,"minutrel",40,"ExtraBold",C["white"] if reverse else C["ink"])

    rect(0,0,w,h,C["ink"]); mark(42,60,80,C["white"])
    text(42,245,"minutrel",76,"ExtraBold",C["white"])
    text(46,310,"Le temps de vos projets,",24,"SemiBold",C["white"])
    text(46,346,"ensemble.",24,"SemiBold",C["accent"])
    para(46,435,"Une identité pour un outil de suivi du temps en équipe, libre et autohébergé.",445,14,C["white"])
    rect(46,575,503,1,"#38515A")
    text(46,622,"IDENTITÉ DE MARQUE",10,"SemiBold",C["accent"])
    text(46,650,"Nom / Logo / Couleurs / Typographies / Interface",11,color=C["white"])
    text(46,766,"Proposition - 05 novembre 2026",9,color="#CCD8D8")
    pdf.showPage()

    heading(2,"Fondations","Une minute, un collectif.")
    para(42,206,"Minutrel évoque les minutes et le travail relié entre les membres d’une équipe. Le nom se prononce mi-nu-trel, sans accent ni tiret.")
    for y,title,body in [(306,"Clarté","Savoir où va le temps, avec des durées lisibles et des totaux fiables."),(422,"Collectif","Partager les projets et les repères, avec des droits adaptés à chaque rôle."),(538,"Maîtrise","Choisir son serveur et garder la propriété de ses données et de ses outils.")]:
        rect(42,y-26,4,66,C["primary"])
        text(62,y,title,19,"ExtraBold"); para(62,y+30,body,465,11)
    text(42,690,"Signature",10,"SemiBold",C["primary"])
    text(42,727,TOKENS["tagline"],20,"ExtraBold")
    pdf.showPage()

    heading(3,"Signature visuelle","Un signe simple à retrouver.")
    rect(42,190,511,132,C["white"],16); logo(70,220)
    rect(42,342,511,132,C["ink"],16); logo(70,372,True)
    para(42,520,"Le M ouvert relie deux appuis par un même mouvement. Le point citron marque un repère de temps. Les lettres du logo sont vectorisées : aucune police installée n’est requise.")
    para(42,614,"Garder une zone libre d’au moins 12 unités autour du symbole, sur une grille de 96. Taille minimale : 24 px pour le symbole et 140 px pour le logo complet. En dessous, utiliser le favicon dédié.")
    para(42,708,"Ne pas déformer, incliner, ajouter d’ombre ou remplacer les couleurs. Employer la version blanche sur un fond sombre et la version monochrome si nécessaire.")
    pdf.showPage()

    heading(4,"Couleurs","Du calme, avec un repère vif.")
    palette=[("Encre","ink"),("Vert","primary"),("Citron","accent"),("Papier","canvas"),("Ardoise","muted")]
    for i,(label,key) in enumerate(palette):
        y=198+i*78
        rect(42,y,110,56,C[key],8)
        text(172,y+22,label,15,"ExtraBold"); text(172,y+46,C[key],11,color=C["muted"])
    text(42,646,"Combinaisons de texte vérifiées",14,"ExtraBold")
    for i,(fg,bg) in enumerate([("ink","canvas"),("white","primary"),("ink","accent"),("muted","white")]):
        text(42,680+i*22,f"{fg} sur {bg} : {contrast(C[fg],C[bg]):.2f}:1",10,color=C["muted"])
    pdf.showPage()

    heading(5,"Typographie","De l’espace pour lire le temps.")
    text(42,225,"Manrope",48,"ExtraBold")
    text(42,270,"Aa Bb Cc 0123456789",22)
    para(42,320,"Une seule famille libre, livrée localement sous licence SIL Open Font License. Les graisses 400, 600 et 800 couvrent les textes, les commandes et les titres.")
    rect(42,409,511,186,C["white"],16)
    text(66,450,"TEMPS DU PROJET",10,"SemiBold",C["muted"])
    text(66,516,"12 h 45 min",40,"ExtraBold")
    text(66,559,"Semaine du 2 au 8 novembre",12,color=C["muted"])
    para(42,650,"Interface : texte courant 16 px, aide 14 px, titres 24 à 48 px. Utiliser des chiffres tabulaires lorsque disponibles et conserver les unités visibles. La couleur ne remplace jamais un libellé.")
    pdf.showPage()

    heading(6,"Applications","Un système prêt à transmettre.")
    rect(42,194,511,232,C["ink"],16)
    logo(68,216,True)
    text(68,336,"Chaque minute trouve sa place.",21,"ExtraBold",C["white"])
    text(68,384,"Web / macOS / Windows / Linux",11,color=C["accent"])
    text(42,480,"Les mots de Minutrel",19,"ExtraBold")
    para(42,518,"Une voix directe, calme et précise. Écrire « Ajouter un temps », « Mettre en pause » et « Voir les temps du projet ». Expliquer une erreur près du champ, sans faire porter la faute à l’utilisateur.")
    text(42,620,"Fichiers livrés",15,"ExtraBold")
    para(42,654,"Logos SVG et PNG, icônes PNG / ICO / ICNS, image de partage, tokens CSS et JSON, polices et licences, aperçu HTML et charte PDF. Le dossier brand contient les ressources et leurs sources.")
    para(42,744,"Minutrel reste un nom proposé : les contrôles de nom et leur portée sont consignés dans le rapport de disponibilité.",size=9,color=C["muted"])
    pdf.showPage(); pdf.save()


def manifest():
    paths = [BRAND / "tokens.json", BRAND / "tokens.css", ROOT / "scripts/build_brand.py"]
    for folder in [BRAND / "fonts", BRAND / "assets", BRAND / "preview", ROOT / "apps/desktop/src-tauri/icons", ROOT / "output/pdf"]:
        paths.extend(p for p in folder.rglob("*") if p.is_file() and p.suffix != ".html")
    paths.append(ROOT / "apps/web/public/favicon.svg")
    values={str(p.relative_to(ROOT)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(paths))}
    (BRAND / "manifest.json").write_text(json.dumps(values,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--assets-only",action="store_true")
    args=parser.parse_args()
    static_fonts(); svg_assets(); raster_assets()
    if not args.assets_only:
        pdf_book(); manifest()
    print("Ressources Minutrel générées" + (" avec charte PDF et manifeste." if not args.assets_only else "."))
