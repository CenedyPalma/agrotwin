"""RGB-only vegetation analysis via classical computer vision.

This survey has no NIR/Red-Edge band (it's the "100 ft only RGB" capture),
so NDVI/NDRE (multispectral_service.py) can't be computed. Instead this
module computes the Excess Green Index — ExG = 2G - R - B on normalized
chromaticity coordinates (Woebbecke et al. 1995) — a standard, documented
RGB-only vegetation index used for exactly this situation: separating live
vegetation from soil/residue/shadow using only visible-light color.

This is classical pixel-level color-space thresholding on real image data,
not a trained deep-learning model. It measures real vegetation coverage per
photo; it cannot identify weed species, disease, or pest damage. Callers
must not claim more than that.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

MAX_DIM = 640  # downsample for speed — ExG is a color-ratio index, resolution-insensitive
VEGETATION_THRESHOLD = 0.02  # on normalized ExG; standard default from the Woebbecke formulation


@dataclass
class ImageVegetationStats:
    vegetation_fraction: float  # 0..1, share of frame classified as live vegetation
    mean_exg: float  # mean Excess Green Index over the whole frame
    mean_exg_vegetation: float  # mean ExG restricted to vegetation pixels (greenness intensity)


def analyze_image_vegetation(path: Path) -> ImageVegetationStats:
    from app.services.multispectral_service import open_image_safely

    try:
        with open_image_safely(path) as im:
            # draft() lets libjpeg decode at a reduced DCT scale directly —
            # much faster than full decode + resize for a resolution-insensitive index.
            im.draft("RGB", (MAX_DIM, MAX_DIM))
            img = np.asarray(im.convert("RGB"), dtype=np.float32)
    except OSError as exc:
        raise ValueError(f"Could not read image: {path}") from exc

    r, g, b = img[..., 0], img[..., 1], img[..., 2]

    total = np.where((r + g + b) == 0, 1.0, r + g + b)
    rn, gn, bn = r / total, g / total, b / total  # normalize out lighting/exposure differences

    exg = 2 * gn - rn - bn
    veg_mask = exg > VEGETATION_THRESHOLD

    return ImageVegetationStats(
        vegetation_fraction=float(veg_mask.mean()),
        mean_exg=float(exg.mean()),
        mean_exg_vegetation=float(exg[veg_mask].mean()) if veg_mask.any() else 0.0,
    )
