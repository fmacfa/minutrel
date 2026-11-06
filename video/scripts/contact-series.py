import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root = Path('out/series-en/qa-final')
for film in json.loads(Path('src/series/catalog.json').read_text()):
    name = f"minutrel-{film['id']:02d}-{film['slug']}"
    frames = sorted((root / name).glob('frame-*.png'))
    if not frames:
        continue
    sheet = Image.new('RGB', (1920, 298 * ((len(frames)+3)//4)), '#eef3eb')
    draw = ImageDraw.Draw(sheet)
    for i, frame in enumerate(frames):
        im = ImageOps.contain(Image.open(frame).convert('RGB'), (480, 270))
        x, y = i % 4 * 480, i // 4 * 298
        sheet.paste(im, (x, y))
        second = int(frame.stem.split('-')[-1]) / 30
        scene = next((s for s in film['scenes'] if s['at'] <= second < s['at'] + s['length']), film['scenes'][-1])
        draw.text((x+7,y+275), f"{film['id']:02d} / {scene['key']} / {second:.2f}s", fill='#142c38')
    sheet.save(root / f"contact-{film['id']:02d}.jpg", quality=90)
