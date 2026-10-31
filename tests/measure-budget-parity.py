
from PIL import Image, ImageChops, ImageStat
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
out = root / "qa-artifacts" / "budget-visual-reconciliation"
ref = Image.open(root / "assets" / "screen-21.webp").convert("RGB")
results={}
for n in (21,22):
    shot=out / f"screen-{n}-desktop.png"
    if not shot.is_file():
        raise SystemExit(f"Missing browser capture: {shot}")
    screen=Image.open(shot).convert("RGB").crop((0,0,1536,1024))
    size=(384,256)
    a=ref.resize(size,Image.Resampling.LANCZOS)
    b=screen.resize(size,Image.Resampling.LANCZOS)
    diff=ImageChops.difference(a,b)
    mae=round(sum(ImageStat.Stat(diff).mean)/3,3)
    mask=diff.convert("L").point(lambda p:255 if p>=20 else 0)
    changed=round(ImageStat.Stat(mask).mean[0]/255*100,2)
    Image.new("RGB",(1536*2,1024)).save(out / f"screen-{n}-parity-placeholder.jpg")
    # Review-friendly side-by-side visual.
    canvas=Image.new("RGB",(1536*2,1024))
    canvas.paste(ref,(0,0))
    canvas.paste(screen,(1536,0))
    canvas.resize((1536,512)).save(out / f"screen-{n}-side-by-side.jpg",quality=86)
    results[str(n)]={"mean_absolute_rgb_error":mae,"changed_pixel_percent":changed,"reference":"screen-21.webp","note":"Screen 22 inherits Screen 21 visual specification; not separately approved"}
(out/"visual-parity-metrics.json").write_text(json.dumps(results,indent=2))
print("Budget editor source comparison:",json.dumps(results))
