"""
Convert edge-connected near-black studio plates to transparent PNG.
Does not punch interior black UI (chat bubbles) — only flood-fills from borders.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

THRESH = 28  # RGB channel ceiling for "studio black"


def is_plate(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    return r <= THRESH and g <= THRESH and b <= THRESH


def knockout(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            return
        r, g, b, a = px[x, y]
        if not is_plate(r, g, b, a):
            return
        seen[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    cleared = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if is_plate(r, g, b, a):
            px[x, y] = (r, g, b, 0)
            cleared += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            try_push(nx, ny)

    # Soften fringe: near-black pixels adjacent to transparent become semi-transparent
    soft = im.copy()
    sp = soft.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if not (r <= THRESH + 40 and g <= THRESH + 40 and b <= THRESH + 40):
                continue
            touch = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    touch = True
                    break
            if touch:
                # fade by darkness
                fade = max(r, g, b) / float(THRESH + 40)
                sp[x, y] = (r, g, b, max(0, min(255, int(255 * fade))))

    soft.save(dst, format="PNG", optimize=True)
    print(f"{src.name} -> {dst.name}: cleared={cleared} size={w}x{h}")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    dest = root / "public" / "assets" / "figma" / "whatsapp"
    assets = Path(
        r"C:\Users\dicky\.cursor\projects\c-Users-dicky-AppData-Local-hermes-Bluebook-Website\assets"
    )

    mapping = [
        ("*AddAI-f7e3fa6b*", dest / "step-1.png"),
        ("*AIinChat-3dee8c82*", dest / "step-2.png"),
        ("*Export-2af9ef00*", dest / "step-3.png"),
        ("*Overview-ec626a7c*", dest / "diagram.png"),
    ]

    for pat, out in mapping:
        matches = sorted(assets.glob(pat), key=lambda p: -p.stat().st_size)
        if not matches:
            print(f"missing source for {pat}")
            continue
        knockout(matches[0], out)

    # verify
    for name in ("step-1.png", "step-2.png", "step-3.png", "diagram.png"):
        p = dest / name
        im = Image.open(p)
        rgba = im.convert("RGBA")
        w, h = rgba.size
        t = b = n = 0
        for y in range(0, h, 30):
            for x in range(0, w, 30):
                r, g, bl, a = rgba.getpixel((x, y))
                n += 1
                if a < 10:
                    t += 1
                elif r < 20 and g < 20 and bl < 20:
                    b += 1
        print(f"check {name}: mode={im.mode} transparent~{t}/{n} blackOpaque~{b}/{n}")


if __name__ == "__main__":
    main()
