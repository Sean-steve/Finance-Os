
from PIL import Image,ImageChops,ImageStat
from pathlib import Path
import json,csv
root=Path(__file__).resolve().parents[1]
out=root/"qa-artifacts"/"full-visual-parity"
refdir=root/"assets"
metrics=[]
for n in range(1,61):
    cap=out/f"screen-{n:02d}.png"
    if not cap.exists():raise SystemExit(f"missing coded screen {n}")
    if n==22:continue
    reference=refdir/f"screen-{n:02d}.webp"
    if not reference.exists():raise SystemExit(f"missing approved image {n}: {reference}")
    a=Image.open(reference).convert("RGB").resize((384,256),Image.Resampling.LANCZOS)
    b=Image.open(cap).convert("RGB").resize((384,256),Image.Resampling.LANCZOS)
    diff=ImageChops.difference(a,b)
    mae=sum(ImageStat.Stat(diff).mean)/3
    # Per-pixel flag: the previous audit used threshold 20 for changed pixels.
    changed=sum(1 for pixel in diff.convert("L").getdata() if pixel>=20)/(384*256)
    metrics.append({"screen":n,"rgb_mae":round(mae,3),"changed_fraction":round(changed,4)})
    if n in (1,8,11,21,24,29,33,35,40,42,43,56):
        c=Image.new("RGB",(768,256));c.paste(a,(0,0));c.paste(b,(384,0))
        c.save(out/f"screen-{n:02d}-side-by-side.jpg",quality=90)
with (out/"metrics.csv").open("w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=["screen","rgb_mae","changed_fraction"]);w.writeheader();w.writerows(metrics)
summary={"compared":len(metrics),"average_mae":round(sum(x["rgb_mae"] for x in metrics)/len(metrics),3),"top":sorted(metrics,key=lambda x:x["rgb_mae"],reverse=True)[:20],"screen_21":next(x for x in metrics if x["screen"]==21),"note":"22 has no separate approved source. Pixel metrics do not constitute visual approval."}
(out/"summary.json").write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
