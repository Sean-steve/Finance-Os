#!/usr/bin/env python3
"""Compare Finance OS approved screen images with coded browser screenshots."""
import json, statistics
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageStat, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"qa-artifacts"/"full-reconciliation"
SHOTS=OUT/"screens"
ASSETS=ROOT/"assets"
OUT.mkdir(parents=True,exist_ok=True)

def metrics(ref,actual):
    a=ref.convert("RGB").resize((384,256),Image.Resampling.LANCZOS)
    b=actual.convert("RGB").resize((384,256),Image.Resampling.LANCZOS)
    delta=ImageChops.difference(a,b)
    mae=round(sum(ImageStat.Stat(delta).mean)/3,2)
    luminosity=delta.convert("L").point(lambda v:255 if v>35 else 0)
    changed=round(ImageStat.Stat(luminosity).mean[0]/255*100,1)
    ea=a.convert("L").filter(ImageFilter.FIND_EDGES)
    eb=b.convert("L").filter(ImageFilter.FIND_EDGES)
    edge=round(ImageStat.Stat(ImageChops.difference(ea,eb)).mean[0],2)
    category=("Candidate for manual overlay review" if mae<=8 else
              "Minor visual differences" if mae<=16 else
              "Material design differences" if mae<=28 else "Major design divergence")
    return dict(maeRgbDownsampled=mae,changedLumaPixelsPct=changed,
                edgeDifferenceMaE=edge,classification=category,pixelCertified=False)

def comparison(n,ref,actual):
    w,h=480,320
    a=ref.convert("RGB").resize((w,h),Image.Resampling.LANCZOS)
    b=actual.convert("RGB").resize((w,h),Image.Resampling.LANCZOS)
    c=ImageEnhance.Contrast(ImageChops.difference(a,b)).enhance(2.8)
    canvas=Image.new("RGB",(w*3,h+28),"#ecf1ee")
    pen=ImageDraw.Draw(canvas)
    for i,(label,img) in enumerate([("APPROVED SOURCE",a),("CODED SCREEN",b),("AMPLIFIED DIFFERENCE",c)]):
        canvas.paste(img,(i*w,28))
        pen.text((i*w+7,7),"Screen %02d — %s"%(n,label),fill="#254437")
    canvas.save(SHOTS/("screen-%02d-comparison.jpg"%n),quality=78)

def main():
    result=[]
    for n in range(1,61):
        reference=ASSETS/("screen-%02d.webp"%n)
        coded=SHOTS/("screen-%02d-desktop.png"%n)
        row=dict(screen=n,referencePresent=reference.exists(),actualCaptured=coded.exists())
        if not reference.exists():
            row["classification"]="BLOCKED — no approved source image"
        elif not coded.exists():
            row["classification"]="BLOCKED — browser capture missing"
        else:
            ref=Image.open(reference)
            actual=Image.open(coded)
            row["referenceSize"]=list(ref.size)
            row["actualSize"]=list(actual.size)
            row.update(metrics(ref,actual))
            comparison(n,ref,actual)
        result.append(row)
        if n%10==0:print("VISUAL_PROGRESS",n,"/60")

    matched=[x for x in result if "maeRgbDownsampled" in x]
    worst=sorted(matched,key=lambda x:x["maeRgbDownsampled"],reverse=True)
    counts={}
    for row in result:counts[row["classification"]]=counts.get(row["classification"],0)+1
    summary=dict(screenCount=60,assessed=len(matched),
        sourceReferencesPresent=sum(x["referencePresent"] for x in result),
        missingReferenceScreens=[x["screen"] for x in result if not x["referencePresent"]],
        missingBrowserCaptures=[x["screen"] for x in result if not x["actualCaptured"]],
        averageRGBDifference=round(statistics.mean(x["maeRgbDownsampled"] for x in matched),2) if matched else None,
        medianRGBDifference=round(statistics.median(x["maeRgbDownsampled"] for x in matched),2) if matched else None,
        largestDifferences=worst[:15],classifications=counts,
        certifiedExactVisualMatch=False,
        note="Visual metrics indicate divergence, not human-certified pixel fidelity.")
    (OUT/"visual-diff.json").write_text(json.dumps({"summary":summary,"screens":result},indent=2),encoding="utf-8")
    lines=[
        "# Finance OS — All-Screen Visual Reconciliation Evidence",
        "",
        "**Audit only: not a declaration of visual or production certification.**",
        "",
        "Screens with source mockups: **%s/60**. Captured coded screenshots: **%s/60**. Compared: **%s**. Missing source screen(s): **%s**."%
            (summary["sourceReferencesPresent"],60-len(summary["missingBrowserCaptures"]),len(matched),summary["missingReferenceScreens"]),
        "",
        "Reference and browser capture: 1536 x 1024. The comparison files contain approved image, coded image and magnified difference.",
        "",
        "Average RGB absolute difference (384 x 256 downsample): **%s / 255**. A small score is not proof of an exact match."%summary["averageRGBDifference"],
        "",
        "| Screen | Reference | Browser Capture | RGB difference | Changed-pixel fraction | Classification |",
        "| --- | :---: | :---: | ---: | ---: | --- |",
    ]
    for x in result:
        value=x.get("maeRgbDownsampled","—")
        frac=str(x["changedLumaPixelsPct"])+"%" if "changedLumaPixelsPct" in x else "—"
        lines.append("| %02d | %s | %s | %s | %s | %s |"%
            (x["screen"],"Yes" if x["referencePresent"] else "MISSING",
             "Yes" if x["actualCaptured"] else "MISSING",value,frac,x["classification"]))
    lines.extend([
        "",
        "## Certification contract",
        "- Route completeness: screen renders, displays useful content and navigates successfully.",
        "- Cross-screen: financial data changes appear consistently in linked modules.",
        "- Responsive: desktop and 390px mobile cannot cause page-level horizontal overflow.",
        "- Accessibility: serious/critical WCAG automated findings prohibit sign-off.",
        "- Visual: every available original image requires visual overlay review and sign-off.",
        "- Screen 22 has no approved supplied image and cannot be certified visually.",
        "- Production: banking, authentication, secure financial storage, permissions and server audit are not implemented.",
        "",
        "## Top visual repair candidates",
        ", ".join("%02d (RGB delta %s)"%(x["screen"],x["maeRgbDownsampled"]) for x in worst[:15]),
        "",
    ])
    (OUT/"VISUAL_RECONCILIATION_REPORT.md").write_text("\n".join(lines),encoding="utf-8")
    print("VISUAL_SUMMARY",json.dumps(dict(assessed=len(matched),missing=summary["missingReferenceScreens"],
         averageDifference=summary["averageRGBDifference"],worst=worst[:5])))
    if not matched:raise SystemExit("No reference/screenshots could be compared")

if __name__=="__main__":main()
