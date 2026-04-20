#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageSequence


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dawg-animation.gif"

SOURCE_CANVAS = (2986, 1616)
TARGET_WIDTH = 1440
TARGET_HEIGHT = round(SOURCE_CANVAS[1] * TARGET_WIDTH / SOURCE_CANVAS[0])

HOLD_MS = 900
FADE_MS = 300
FADE_STEPS = 6
FADE_FRAME_MS = FADE_MS // FADE_STEPS

SCREENSHOT_RE = re.compile(
    r"Screenshot 2026-04-19 at (?P<hour>\d+)\.(?P<minute>\d+)\.(?P<second>\d+)\s*PM\.png$"
)


def screenshot_sort_key(path: Path) -> tuple[int, int, int]:
    match = SCREENSHOT_RE.match(path.name)
    if not match:
        return (99, 99, 99)

    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    second = int(match.group("second"))
    if hour != 12:
        hour += 12

    return (hour, minute, second)


def background_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    corners = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((rgb.width - 1, 0)),
        rgb.getpixel((0, rgb.height - 1)),
        rgb.getpixel((rgb.width - 1, rgb.height - 1)),
    ]
    return tuple(round(sum(channel) / len(corners)) for channel in zip(*corners))


def normalize_frame(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    canvas = Image.new("RGBA", SOURCE_CANVAS, background_color(source) + (255,))
    offset = (
        (SOURCE_CANVAS[0] - source.width) // 2,
        (SOURCE_CANVAS[1] - source.height) // 2,
    )
    canvas.alpha_composite(source, offset)
    return canvas.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)


def build_frames(base_frames: list[Image.Image]) -> tuple[list[Image.Image], list[int]]:
    rendered: list[Image.Image] = []
    durations: list[int] = []

    for index, frame in enumerate(base_frames):
        rendered.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))
        durations.append(HOLD_MS)

        if index == len(base_frames) - 1:
            continue

        next_frame = base_frames[index + 1]
        for step in range(1, FADE_STEPS + 1):
            alpha = step / (FADE_STEPS + 1)
            blend = Image.blend(frame, next_frame, alpha)
            rendered.append(blend.convert("P", palette=Image.Palette.ADAPTIVE))
            durations.append(FADE_FRAME_MS)

    return rendered, durations


def main() -> None:
    screenshots = sorted(ROOT.glob("Screenshot *.png"), key=screenshot_sort_key)
    if not screenshots:
        raise SystemExit("No screenshot PNG files found.")

    base_frames = [normalize_frame(path) for path in screenshots]
    frames, durations = build_frames(base_frames)

    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )

    with Image.open(OUTPUT) as gif:
        frame_count = sum(1 for _ in ImageSequence.Iterator(gif))
        print(f"Wrote {OUTPUT}")
        print(f"Source screenshots: {len(screenshots)}")
        print(f"GIF frames: {frame_count}")
        print(f"Dimensions: {gif.width}x{gif.height}")
        print(f"Loop: {gif.info.get('loop')}")


if __name__ == "__main__":
    main()
