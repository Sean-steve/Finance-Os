#!/usr/bin/env python3
"""Quantitative source-to-coded comparison for repaired screens.
RGB MAE is a diagnostic, not visual sign-off. Identical 384x256 PIL bilinear
resampling is used for the baseline and new screenshots.
"""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageStat

BASE=Path(__file__).resolve().parent.parent
captures=BASE/'qa-artifacts'/'visual-pass-1'
reference=BASE/'assets'
baseline={8:36.45,11:33.55,21:22.82,40:31.63}
details=[]
for n,prior in baseline.items():
    a=reference/f'screen-{n:02}.webp'
    b=captures/f'screen-{n:02}-desktop.png'
    if not a.exists() or not b.exists():
        raise SystemExit(f"Missing source or coded screenshot for {n}: {a}, {b}")
    with Image.open(a) as source,Image.open(b) as current:
        expected=source.convert('RGB').resize((384,256),Image.Resampling.BILINEAR)
        actual=current.convert('RGB').resize((384,256),Image.Resampling.BILINEAR)
        rgb=ImageStat.Stat(ImageChops.difference(expected,actual)).mean
        after=round(sum(rgb)/3,2)
    details.append({'screen':n,'baseline_mae':prior,'after_mae':after,'change':round(after-prior,2),
                    'improved':after<prior})
    print(f"SCREEN {n:02} RGB MAE (0=perfect): BEFORE {prior:.2f}  AFTER {after:.2f}  CHANGE {after-prior:+.2f}")
summary={'note':'Diagnostic measurement only; Screen 22 has no supplied reference and is not pixel-certified.',
         'changed_screens':details,'improved_count':sum(x['improved'] for x in details),
         'measured_count':len(details)}
(captures/'visual-metrics.json').write_text(json.dumps(summary,indent=2))
print('VISUAL MEASUREMENT:',summary['improved_count'],'of',summary['measured_count'],'improved')
