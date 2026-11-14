# Presentation cues (12 slides)

1. Name the project, course, and core security question. Confirm three presenter names before class.
2. Ask who wins if one player reveals first. Introduce simultaneity as the fairness problem.
3. Walk through commit, reveal, verify. Point out the move is absent from the commit request.
4. Explain `m`, `r`, `g`, and `h`; distinguish perfect hiding from computational binding. Mention hash-to-curve and pinned `h`.
5. Identify browser, network, referee, and database trust boundaries. Explain local key/opening storage.
6. Run the two-browser live demo. Open Crypto Inspector; show the point and signature before revealing.
7. Click A1 in Attack Lab. If time allows, show A3 and A9. State deliberately weak code is isolated.
8. Read the p50/p95 chart within one environment. Mention 1,000 samples and timer limits.
9. Compare the 33-byte point with 32-byte hash, both plus signature and opening. Discuss key loss and deadlines.
10. Be explicit: the server may disclose an early opening or rewrite the whole audit chain. Avoid claiming trustlessness.
11. Show CI, tests, raw results, and screenshots. Quote only verified deployment evidence.
12. Invite questions; keep an explanation of the discrete-log trapdoor and randomness ready.

Rehearse three times with a timer. The [demo plan](demo.md) includes the fallback sequence and pre-warming step.
