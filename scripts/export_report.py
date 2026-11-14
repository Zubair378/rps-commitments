"""Convert the editable Markdown report to print-ready HTML."""
from pathlib import Path
import mistune

docs = Path(__file__).resolve().parents[1] / "docs"
source = (docs / "report.md").read_text(encoding="utf-8")
body = mistune.create_markdown(plugins=["table", "strikethrough"])(source)
css = """
@page { size: A4; margin: 17mm 16mm; }
* { box-sizing: border-box; }
body { font: 10.2pt/1.48 Arial, sans-serif; color: #18302c; margin: 0; }
h1, h2, h3 { color: #103d32; line-height: 1.2; break-after: avoid; }
h1 { font-size: 23pt; border-bottom: 3px solid #4bc493; padding-bottom: 12px; margin: 0 0 19px; }
h2 { font-size: 14pt; margin: 24px 0 8px; border-bottom: 1px solid #b7d8ca; padding-bottom: 4px; }
h3 { font-size: 11pt; }
p, li { orphans: 3; widows: 3; }
p { margin: 0 0 10px; }
a { color: #137b5e; text-decoration: none; overflow-wrap: anywhere; }
img { max-width: 100%; max-height: 105mm; display: block; margin: 12px auto 18px; object-fit: contain; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 11px 0 17px; font-size: 8.4pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 1px solid #a8c8b8; padding: 5px 6px; vertical-align: top; }
th { background: #e4f4ec; color: #153c2f; }
code { font-family: Consolas, monospace; font-size: .91em; overflow-wrap: anywhere; }
blockquote { border-left: 3px solid #4bc493; padding-left: 13px; color: #4a6860; }
"""
html = f"<!doctype html><html><head><meta charset='utf-8'><title>Cryptographic Commitments Report</title><style>{css}</style></head><body>{body}</body></html>"
(docs / ".report-render.html").write_text(html, encoding="utf-8")
print("Rendered docs/.report-render.html")
