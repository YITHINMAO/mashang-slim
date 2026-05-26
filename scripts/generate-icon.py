from pathlib import Path
import shutil
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "icon-source-from-user.png"
ICONSET = ASSETS / "icon.iconset"


def main():
    ASSETS.mkdir(exist_ok=True)
    icon = Image.open(SOURCE).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    icon.save(ASSETS / "icon.png")

    if ICONSET.exists():
        shutil.rmtree(ICONSET)
    ICONSET.mkdir()

    for points in [16, 32, 128, 256, 512]:
        icon.resize((points, points), Image.Resampling.LANCZOS).save(ICONSET / f"icon_{points}x{points}.png")
        icon.resize((points * 2, points * 2), Image.Resampling.LANCZOS).save(ICONSET / f"icon_{points}x{points}@2x.png")

    subprocess.run(["iconutil", "-c", "icns", str(ICONSET), "-o", str(ASSETS / "icon.icns")], check=True)
    icon.save(ASSETS / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()
