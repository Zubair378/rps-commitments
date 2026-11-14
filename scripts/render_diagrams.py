"""Render five presentation-ready PNG companions for the Mermaid source diagrams."""
from pathlib import Path
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

root = Path(__file__).resolve().parents[1] / "docs" / "diagrams"
BG, BOX, LINE, TEXT, ACCENT = "#08171b", "#153b35", "#6dbd9e", "#e8f2ed", "#7ee3b5"

def base(title):
    fig, ax = plt.subplots(figsize=(13, 7.3), dpi=160)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    ax.text(.05, .95, title, color=TEXT, fontsize=22, fontweight="bold", va="top")
    return fig, ax

def graph(filename, title, nodes, edges, note):
    fig, ax = base(title)
    width, height = .215, .115
    for key, (x, y, label) in nodes.items():
        ax.add_patch(FancyBboxPatch((x-width/2, y-height/2), width, height,
                     boxstyle="round,pad=0.016,rounding_size=.016", edgecolor=LINE,
                     facecolor=BOX, linewidth=1.6, zorder=2))
        ax.text(x, y, textwrap.fill(label, 22), ha="center", va="center", color=TEXT,
                fontsize=11, fontweight="semibold", zorder=3)
    for source, target, label in edges:
        x1, y1, _ = nodes[source]; x2, y2, _ = nodes[target]
        dx, dy = x2-x1, y2-y1
        if abs(dx) > abs(dy):
            start = (x1 + (width/2+.017)*(1 if dx>0 else -1), y1)
            end = (x2 - (width/2+.022)*(1 if dx>0 else -1), y2)
        else:
            start = (x1, y1 + (height/2+.018)*(1 if dy>0 else -1))
            end = (x2, y2 - (height/2+.022)*(1 if dy>0 else -1))
        ax.add_patch(FancyArrowPatch(start, end, arrowstyle="-|>", mutation_scale=14,
                     linewidth=1.5, color=ACCENT, zorder=1))
        if label:
            offset = .092 if abs(dx) > abs(dy) else .02
            ax.text((start[0]+end[0])/2, (start[1]+end[1])/2+offset, label,
                    color="#b4d9c8", ha="center", fontsize=8,
                    bbox={"facecolor":BG,"edgecolor":"none","pad":2}, zorder=4)
    ax.text(.05, .05, note, color="#a7c5b6", fontsize=9)
    fig.savefig(root / filename, facecolor=BG, bbox_inches="tight", pad_inches=.2)
    plt.close(fig)

graph("architecture.png", "System architecture and trust boundaries", {
    "browser":(.17,.67,"Player browser: React, crypto, local verification"),
    "api":(.5,.67,"Render HTTPS: Fastify referee and WebSocket"),
    "db":(.83,.67,"Persistent PostgreSQL: matches and keys"),
    "key":(.17,.32,"IndexedDB signing key + tab opening"),
    "audit":(.83,.32,"Hash-linked public audit log"),
    "spectator":(.5,.32,"Spectator reads public transcript")}, [
    ("browser","api","signed C, then opening"),("api","db","validated writes"),
    ("browser","key","local only"),("db","audit","event append"),
    ("api","spectator","public result")],
    "Trust boundary: browser secrets remain local until reveal; referee and database are operator-controlled.")

graph("data-flow.png", "Move to commitment to public proof", {
    "move":(.16,.75,"Plaintext move + 32-byte random r"),
    "commit":(.5,.75,"Browser computes C = m·g + r·h"),
    "network":(.84,.75,"HTTPS: C + signed context"),
    "store":(.84,.47,"Referee stores C; waits for both"),
    "reveal":(.5,.47,"After barrier: move + r crosses network"),
    "verify":(.16,.47,"Verify opening and signature"),
    "log":(.5,.18,"Public result + hash-linked event")}, [
    ("move","commit","secret inputs"),("commit","network","commit phase"),
    ("network","store","no plaintext"),("store","reveal","reveal phase"),
    ("reveal","verify","public opening"),("verify","log","result")],
    "Before the barrier, the network carries only the commitment and signature. The server can observe submitted openings.")

graph("key-lifecycle.png", "Signing key lifecycle", {
    "new":(.16,.70,"Generate non-extractable P-256 key"),
    "active":(.5,.70,"Register public JWK; sign commitments"),
    "rotate":(.84,.70,"Rotate: new key; old revoked"),
    "revoke":(.5,.35,"Revoke after loss or compromise"),
    "archive":(.84,.35,"Keep old public key for historic verification")}, [
    ("new","active","register"),("active","rotate","replace"),
    ("active","revoke","compromise"),("rotate","archive","retain"),
    ("revoke","archive","retain")],
    "Private key material stays in browser IndexedDB and cannot be exported by Web Crypto.")

graph("referee-state.png", "Referee and bracket state machine", {
    "waiting":(.15,.73,"WAITING: pair players"),
    "commit":(.5,.73,"COMMIT: accept two signed points"),
    "reveal":(.85,.73,"REVEAL: accept openings"),
    "resolved":(.85,.36,"RESOLVED: verify or forfeit"),
    "next":(.5,.36,"Next round or next bracket match"),
    "champion":(.15,.36,"CHAMPION: final winner")}, [
    ("waiting","commit","pair ready"),("commit","reveal","two commits"),
    ("reveal","resolved","two reveals/deadline"),
    ("resolved","next","more play"),("next","champion","final")],
    "Commit or reveal deadlines may resolve a round as a forfeit. Ties and best-of-three continue in a new round.")

fig, ax = base("Commit → reveal → verify sequence")
lanes = [("Browser A",.13),("Referee",.38),("Database",.63),("Browser B",.88)]
for label, x in lanes:
    ax.text(x,.82,label,color=ACCENT,ha="center",fontsize=12,fontweight="bold")
    ax.plot([x,x],[.13,.78],color="#447367",linestyle="--",linewidth=1)
messages = [(.74,.13,.38,"signed Cₐ"),(.68,.38,.63,"store A"),
            (.61,.88,.38,"signed Cᵦ"),(.55,.38,.63,"store B; barrier"),
            (.48,.13,.38,"moveₐ, rₐ"),(.42,.88,.38,"moveᵦ, rᵦ"),
            (.35,.38,.63,"verify; audit"),(.27,.38,.13,"public transcript"),
            (.20,.38,.88,"public transcript")]
for y, x1, x2, label in messages:
    ax.add_patch(FancyArrowPatch((x1,y),(x2,y),arrowstyle="-|>",mutation_scale=12,
                 linewidth=1.3,color=LINE))
    ax.text((x1+x2)/2,y+.012,label,ha="center",va="bottom",color=TEXT,fontsize=9,
            bbox={"facecolor":BG,"edgecolor":"none","pad":1})
ax.text(.05,.05,"Both browsers independently verify the public openings and original signatures.",
        color="#a7c5b6",fontsize=9)
fig.savefig(root / "sequence.png", facecolor=BG, bbox_inches="tight", pad_inches=.2)
plt.close(fig)
print("Rendered five diagrams to docs/diagrams/*.png")
