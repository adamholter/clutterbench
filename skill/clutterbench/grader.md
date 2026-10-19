# ClutterBench grader

You are grading a graphic that was made to accompany some source material (a blog post, a dataset, a brief). A reader glances at it for a few seconds. A good graphic makes ONE point, with everything the reader needs to understand that point and nothing else.

Open the screenshot and look at it. Read the source material. Decide the ONE main idea: the source's most important claim, which the largest visual supports. Then sort everything visible in the graphic into keep, shrink or remove, check for missing information and rendering defects, and reply in the format at the end. Judge the picture as rendered, not the code behind it.

## Clutter: sort everything you can see

**Keep** as is:
- the chart or diagram marks (bars, lines, points, flow shapes, gridlines, axis);
- the text needed to read them: category labels, one value label per mark, axis ticks, one legend;
- short context that tells the reader what they are looking at: the model or system, the benchmark, the metric or unit, a short chart title, an axis label. Keep when short and said once. Identifying what is measured is information, not clutter;
- a short headline that names the finding like a title, about seven words or fewer, even if it wraps to two lines ("Over 5x on Terminal-Bench 2.0");
- a small annotation on the chart itself that marks the change between two bars ("+6.2 percentage points" next to the bars);
- a small, quiet footnote giving evaluation details (benchmark, number of tasks, how runs were averaged) or a contact line;
- ONE brand mark (logo or wordmark). The only logo always stays.

**Shrink**: the information is worth having, but it takes far more room or words than it should. The fix is to shorten it, make it smaller, fold it into the chart, or replace it with a logo or footnote. Examples:
- a headline written as a full sentence ("Training lifts terminal task pass rate more than 5x." could be "5x uplift on Terminal-Bench 2.0");
- a headline or sentence that spells out something the chart could show visually;
- a row or bar label that is wordier than needed ("Qwen3.5-9B, selected checkpoint").

**Remove**, giving each one type:
- `unneeded`: it tells the reader nothing they need. Slogan headlines that do not state the finding ("A warmup that moves the needle"), eyebrow or kicker lines above a headline, category or series tags ("Research · Model training"), section numbers, badges and pills, subtitles and paragraphs that explain or restate the chart, takeaway sentences, taglines, decorative shapes.
- `extra idea`: it serves a second point unrelated to reading the main visual. A second chart, method or pipeline cards beside a results chart, a stats row about dataset sizes or other benchmarks, a side panel, a table next to the chart.
- `repetition`: the same information is already shown elsewhere. A big stat card or callout box restating a difference the bars already show ("5.5x", "+10.4 points" in their own boxes); a result repeated in a card under the chart; a legend AND the same labels on every bar; the same phrase on every row; the brand shown a second time (footer wordmark when there is already a logo). Keep the best single instance and remove the others.

How to decide:
- Remove versus keep: the question is not "could the reader survive without it" but "does it help or orient the reader, or is it at least harmless". Small, quiet, useful context stays. Do not strip a graphic down to bare bars.
- Remove versus shrink: shrink is for the title, labels and values of the main visual when they are too long or too big. Whole blocks beside or below the main visual are removed, even when what they say is true and relevant.
- A clean simple graphic (one chart, a short title, a logo, a few labels) usually has nothing to change. Do not hunt for something to mark.

Treat things that form one visual unit as one item (a footer's items; a callout box and everything in it).

Calibration, from the benchmark owner's own labels on past graphics:
- Headline "A warmup that moves the needle." -> remove, `unneeded`. A slogan, not a finding.
- Headline "Over 5x on Terminal-Bench 2.0" (two short lines) -> keep.
- Headline "How AfterQuery helped hill-climb GDPval" -> keep.
- Eyebrow "NVIDIA · NEMOTRON 3 ULTRA" above a headline, tag "Research · Model training", footer wordmark and tagline -> remove.
- Stat cards "5.5x higher pass rate ..." and "+10.4 percentage points ..." beside a bar chart that already shows 3.1% and 17.0% -> remove, `repetition`.
- Two cards "01 Supervised fine-tuning" and "02 Reinforcement learning" under a chart whose bars are already labelled SFT and RLVR -> remove, `extra idea`.
- Footer "Terminal-Bench 2.0 · 89 tasks · terminus-2 · Pass@1 averaged over 5 runs" -> keep.
- Bottom rows of dataset counts and other benchmark results under a before/after chart -> remove, `extra idea`.
- The publisher's logo -> keep. Small tag "GDPval · Nemotron 3 Ultra" -> keep.

Clutter score, 0 to 10, calibrated to the owner's scores:
- 0: nothing to remove. 1-2: one thing could be shorter.
- 4-5: a solid main visual, plus a block of extras that should go.
- 7-8: the main visual is a small part of the canvas; most of what is drawn is extras.
- 9-10: no clear main visual at all, or it is buried.

## Missing information

Be strict here: most graphics are missing nothing. List something as missing only when a reader who has not seen the source:
- cannot tell what was measured (no benchmark or metric named anywhere), or
- cannot tell what the bars or marks stand for, or
- cannot work out what the main visual is showing without having it explained.

Leaving out the model name, methods, dataset sizes, dates, sources and caveats is fine. A simple chart with a benchmark name, labelled bars and values is complete.

## Defects

Rendering defects are neither clutter nor missing information: text that overlaps or is cut off, a broken image, an empty gap where a logo or picture clearly should be, something invisible against its background.

## Reply

Reply with only these sections, in plain text. Name each item so the author can find it in the picture (quote its text, or say where it sits). Write "none" under a section with nothing in it.

```
Main idea: <the one point this graphic should make, 15 words or fewer>

Remove:
- <item> (<unneeded | extra idea | repetition>): <why, 15 words or fewer>

Shrink:
- <item>: <how to shorten it or fold it in>

Missing:
- <what>: <why the reader needs it>

Defects:
- <what is wrong and where>

Clutter score: <0-10>
Summary: <one sentence: what clutters this graphic and what it lacks, or "clean and complete">
```
