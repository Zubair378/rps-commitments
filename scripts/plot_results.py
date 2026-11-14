"""Generate reproducible figures and timing statistics from measured CSV/JSON."""
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import ttest_ind

root = Path(__file__).resolve().parents[1]
results = root / "docs" / "results"
figures = results / "figures"
figures.mkdir(parents=True, exist_ok=True)
node = json.loads((results / "bench-node.json").read_text())
browser = json.loads((results / "bench-browser.json").read_text())

plt.rcParams.update({"font.size": 10, "figure.facecolor": "white"})
fig, axes = plt.subplots(1, 2, figsize=(10, 4), sharey=True)
for ax, (name, data) in zip(axes, [("Node 20", node), ("Chromium", browser)]):
    labels = ["Pedersen commit", "SHA-256 commit", "Pedersen verify", "SHA-256 verify"]
    pairs = [("pedersen", "commit"), ("hash", "commit"),
             ("pedersen", "verify"), ("hash", "verify")]
    p50 = [data["summary"][mode][op]["p50"] for mode, op in pairs]
    p95 = [data["summary"][mode][op]["p95"] for mode, op in pairs]
    x = np.arange(len(labels))
    ax.bar(x - .18, p50, .35, label="p50", color="#168a6c")
    ax.bar(x + .18, p95, .35, label="p95", color="#e7ad57")
    ax.set_xticks(x, labels, rotation=30, ha="right")
    ax.set_yscale("log")
    ax.set_title(name)
    ax.set_ylabel("milliseconds per operation (log scale)")
    ax.grid(axis="y", alpha=.25)
axes[0].legend()
fig.suptitle("Commitment and verification latency, 1,000 samples per operation")
fig.tight_layout()
fig.savefig(figures / "latency.png", dpi=180)
plt.close(fig)

with (results / "timing.csv").open(newline="") as handle:
    timing = list(csv.DictReader(handle))
stats = {}
fig, axes = plt.subplots(1, 2, figsize=(9, 3.6))
for ax, method in zip(axes, ["early-exit", "timingSafeEqual"]):
    first = np.array([float(r["nanoseconds"]) for r in timing
                      if r["method"] == method and r["mismatch"] == "first"])
    last = np.array([float(r["nanoseconds"]) for r in timing
                     if r["method"] == method and r["mismatch"] == "last"])
    test = ttest_ind(first, last, equal_var=False)
    stats[method] = {"samples_per_condition": len(first),
                     "first_mean_ns": float(first.mean()), "first_sd_ns": float(first.std(ddof=1)),
                     "last_mean_ns": float(last.mean()), "last_sd_ns": float(last.std(ddof=1)),
                     "welch_t": float(test.statistic), "welch_p": float(test.pvalue)}
    ax.boxplot([first, last], tick_labels=["First byte", "Last byte"], showfliers=False)
    ax.set_title(f"{method}\nWelch p={test.pvalue:.3g}")
    ax.set_ylabel("nanoseconds")
    ax.grid(axis="y", alpha=.25)
fig.suptitle("Local comparison timing; microbenchmark noise limits inference")
fig.tight_layout()
fig.savefig(figures / "timing.png", dpi=180)
plt.close(fig)
(results / "timing-summary.json").write_text(json.dumps(stats, indent=2) + "\n")
print(json.dumps(stats, indent=2))
