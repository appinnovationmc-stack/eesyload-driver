#!/usr/bin/env python3
"""Remove mock iPhone chrome and default the driver UI to dark."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / "www" / "index.html"
text = html_path.read_text(encoding="utf-8")

text = text.replace('<div class="di"></div>', "")

start = text.find('<div class="sb">')
if start >= 0:
    end = text.find("<!--", start)
    if end > start:
        text = text[:start] + text[end:]

text = text.replace("setTheme(saved || 'light')", "setTheme(saved || 'dark')")
text = text.replace('setTheme(saved || "light")', 'setTheme(saved || "dark")')

if "glass.css" not in text:
    text = text.replace("</head>", '<link rel="stylesheet" href="glass.css">\n</head>')

html_path.write_text(text, encoding="utf-8")

checks = {
    "status bar removed": '<div class="sb">' not in text,
    "island removed": '<div class="di"></div>' not in text,
    "9:41 removed": ">9:41<" not in text,
    "glass.css linked": "glass.css" in text,
}
for name, ok in checks.items():
    print(("OK  " if ok else "FAIL"), name)
