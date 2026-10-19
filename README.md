# ClutterBench

Results: https://clutterbench.adamholter.chatgpt.site

Measures how much clutter a model puts into a graphic. An agent gets a blog post and makes one 1200x1200 HTML graphic for it; a grader sorts every element into blue (real content), orange (belongs but too big or wordy) or red (should not be there).

## Pipeline

```
npm run fetch                      # data/articles/*.md + data/tasks.json (AfterQuery posts, figures stripped)
npm run gen                        # tasks x models x variants -> runs/<task>__<model>__<variant>/
node scripts/shot.cjs              # shot.png + elements.json (every visible element with its box)
npm run grade -- --grader luna-v1  # runs/<id>/grades/<grader>.json
npm run build && npm start         # review UI on http://localhost:7377
npm run compare -- --grader luna-v1  # reports/feedback-<grader>.md from the annotations
```

All model calls go through the `claude` and `codex` CLIs on subscription auth. No API keys.

## Generation

- Variants: `raw` (only "make a tasteful graphic") and `simple` (explicit anti-clutter instructions). Prompts are in `prompts/`.
- Agents run in a neutral scratch dir (`/private/tmp/cbw/job-*`) with no user or project instruction files, so they cannot see this repo or the grader.
- They browse afterquery.com themselves for fonts, colours and logo. They are told not to open the post's own page or figures; `scripts/flags.cjs` checks the commands and URLs each agent issued and records violations in `meta.json`.
- Add models in `MODELS` in `scripts/run_gen.cjs`.

## Grading

- The grader sees the screenshot, the article and the element list, and returns regions of element ids with a label, a type (`unneeded`, `extra_idea`, `repetition`, `verbose`, `core`) and a reason.
- Headline metric: `clutterShare` = red% + half of orange%, as a share of the drawn area (blank canvas is not counted).
- Add graders (model + prompt file) in `GRADERS` in `scripts/grade.cjs`.

## Review UI

Click mode (default): every element is a box; pick a colour (`1` red, `2` orange, `3` blue, `0` erase) and click or drag across elements. `Rest → blue` fills what is left. Press `g` to show the grader: its labels appear as dashed outlines, then accept or reject each region and missing-info item. Draw mode is Excalidraw over the screenshot, for free marks and written notes. Everything autosaves to `annotations/<run>.json`. `[` and `]` step through runs.

`npm run compare` takes click labels as exact and falls back to strokes (a stroke labels the smallest element under it), then reports agreement, a confusion table, every disagreement and your notes.

## Grader versions and eval

- `grader_v4.md` is current: strict cut rules, strict missing-information check, rendering defects listed separately, clutter score calibrated to Adam's scores.
- Graders are named `<model>-<effort>-<version>` (e.g. `luna-low-v4`); see `GRADERS` in `scripts/grade.cjs`. Default: `luna-low-v4`.
- `node scripts/eval.cjs` scores every grader against Adam's reviews, split by article into dev and held-out test (`data/split.json`), and writes `reports/eval.md`.
- Official protocol: `consensus-v4`. Run `haiku-low-v4` and `haiku-low-v4-b`, then `node scripts/consensus.cjs`; Sonnet (`sonnet-low-v4`) breaks the tie on any run where the two Haiku passes differ.
- Public site: `node scripts/build_site.cjs` writes `site/data.json` and `site/shots/`; `site/` is static and is published to ChatGPT Sites from `site-host/`.
- Caveat: some of Adam's element labels were started from `haiku-v2` via Copy grader, so that grader's label agreement is inflated.

## Skill

`skill/clutterbench/` is an agent skill with the two parts worth reusing: the simple prompt that removes most clutter, and the grader as a prompt for a sub-agent of whatever harness you are in (no API key, no scripts). Copy or link the folder into your skills directory, for example `~/.claude/skills/clutterbench`. The sub-agent grader reads a screenshot and replies in words; it gives a 0 to 10 clutter score, not the area-based percentage the benchmark reports.

## Not in this repository

- The text of the AfterQuery posts (`data/articles/`): run `npm run fetch` to download them.
- The fonts and logos each agent collected (`runs/*/assets/`), so the saved `graphic.html` files will not render exactly; `shot.png` is the rendered result.
- Agent session logs.
