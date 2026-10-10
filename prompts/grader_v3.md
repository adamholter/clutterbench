You are grading a graphic that was made to accompany a blog post. A reader glances at it for a few seconds. A good graphic makes ONE point, with everything the reader needs to understand that point and nothing else.

You grade clutter (what is there and should not be), missing information (what is not there and must be), and rendering defects.

First Read the screenshot at `{{SHOT}}` and look at it. Then use the element list below: every visible element of the same graphic with an id, kind, bounding box (x,y,width,height in px on a {{W}}x{{H}} canvas), font size, and text.

## Clutter: label every element

- `blue` = keep as is. This covers:
  - the chart or diagram marks (bars, lines, points, flow shapes, gridlines, axis);
  - the text needed to read them: category labels, one value label per mark, axis ticks, one legend;
  - short context that tells the reader what they are looking at: the model or system, the benchmark, the metric or unit, a short chart title, an axis label. Blue when short and said once. Identifying what is measured is information, not clutter;
  - a short headline that names the finding like a title, about seven words or fewer, even if it wraps to two lines ("Over 5x on Terminal-Bench 2.0");
  - a small annotation on the chart itself that marks the change between two bars ("+6.2 percentage points" next to the bars);
  - a small, quiet footnote giving evaluation details (benchmark, number of tasks, how runs were averaged) or a contact line;
  - ONE brand mark (logo or wordmark). Never mark the only logo red.
- `orange` = the information is worth having, but it takes far more room or words than it should. The fix is to shrink it, shorten it, fold it into the chart, or replace it with a logo or footnote. Examples:
  - a headline written as a full sentence ("Training lifts terminal task pass rate more than 5x." could be "5x uplift on Terminal-Bench 2.0");
  - a headline or sentence that spells out something the chart could show visually;
  - a subtitle that carries real facts (model, numbers, method) in a long sentence;
  - a row or bar label that is wordier than needed ("Qwen3.5-9B, selected checkpoint");
  - method or pipeline cards beside a results chart when the method matters to the result: the steps are worth a footnote or the bar labels, not whole boxes. Mark the cards and everything in them orange;
  - partner or tool names written out where a logo would do.
- `red` = remove it. Give each red region one `type`:
  - `unneeded`: it tells the reader nothing they need. Slogan headlines that do not state the finding ("A warmup that moves the needle"), eyebrow / kicker lines above a headline, category or series tags ("Research · Model training"), section numbers, badges and pills, sentences that only restate what the chart shows, takeaway sentences, taglines, decorative shapes.
  - `extra_idea`: it serves a second point unrelated to reading the main visual. A second chart, a stats row about dataset sizes or other benchmarks, a side panel, a table next to the chart. Decide the ONE main idea (the post's most important claim, which the largest visual supports).
  - `repetition`: the same information is already shown elsewhere. A big stat card or callout box restating a difference the bars already show ("5.5x", "+10.4 points" in their own boxes); a result repeated in a card under the chart; a legend AND the same labels on every bar; the same phrase on every row; the model named in a label and again in the chart; the brand shown a second time (footer wordmark when there is already a logo). Keep the best single instance `blue` and mark the others red.

How to decide:
- Red versus blue: the question is not "could the reader survive without it" but "does it help or orient the reader, or is it at least harmless". Small, quiet, useful context stays blue. Do not strip a graphic down to bare bars.
- Red versus orange: orange if a reader would want that fact kept in a smaller form; red if nothing is lost by deleting it.
- A clean simple graphic (one chart, a short title, a logo, a few labels) is usually all blue. Do not hunt for something to mark.

Group elements that form one visual unit into one region (a footer's items; a callout box and everything in it). Every element id must appear in exactly one region. A container (`box`) always takes the label of what it contains; do not make a separate region for a card's frame or border.

Calibration, from the benchmark owner's own labels on past graphics:
- Headline "A warmup that moves the needle." -> red `unneeded`. A slogan, not a finding.
- Headline "Over 5x on Terminal-Bench 2.0" (two short lines) -> blue.
- Headline "How AfterQuery helped hill-climb GDPval" -> blue.
- Subtitle "PivotRL improved task success using just 50 solved teacher trajectories and a verifier that ..." -> orange: real facts, too long.
- Eyebrow "NVIDIA · NEMOTRON 3 ULTRA" above a headline, tag "Research · Model training", footer wordmark and tagline -> red.
- Stat cards "5.5x higher pass rate ..." and "+10.4 percentage points ..." beside a bar chart that already shows 3.1% and 17.0% -> red `repetition`.
- Two cards "01 Supervised fine-tuning" and "02 Reinforcement learning" under a chart whose bars are already labelled SFT and RLVR -> orange: a footnote would do.
- Footer "Terminal-Bench 2.0 · 89 tasks · terminus-2 · Pass@1 averaged over 5 runs" -> blue.
- Bottom rows of dataset counts and other benchmark results under a before/after chart -> red `extra_idea`.
- The AfterQuery logo -> blue. Small tag "GDPval · Nemotron 3 Ultra" -> blue.

Clutter score, 0 to 10, calibrated to the owner's scores:
- 0: nothing to remove. 1-2: one thing could be shorter.
- 4-5: a solid main visual, plus a block of extras that should go.
- 7-8: the main visual is a small part of the canvas; most elements are extras.
- 9-10: no clear main visual at all, or it is buried.

## Missing information

Be strict here: most graphics are missing nothing. List something in `missing` only when a reader who has not read the post:
- cannot tell what was measured (no benchmark or metric named anywhere), or
- cannot tell what the bars or marks stand for, or
- cannot work out what the main visual is showing without having it explained.

Leaving out the model name, methods, dataset sizes, dates, sources and caveats is fine. A simple chart with a benchmark name, labelled bars and values is complete.

## Defects

Separately, list rendering defects in `defects`. These are not clutter and not missing information: an element in the list that you cannot actually see in the screenshot (for example a white logo on a light background), text that overlaps or is cut off, a broken image. Check the logo in particular: if the list has a logo element but the screenshot shows nothing there, report it.

## Reply

Reply with ONLY a JSON object, no prose, no code fence:

{
  "main_idea": "the one point this graphic should make, <= 15 words",
  "ideas": ["each distinct point the graphic actually tries to make, <= 10 words each"],
  "regions": [
    {"label": "blue|orange|red", "type": "core|verbose|unneeded|extra_idea|repetition", "ids": ["e0", "e1"], "name": "2-4 word name", "reason": "<= 15 words"}
  ],
  "missing": [
    {"what": "2-6 words, e.g. 'model name'", "why": "<= 15 words"}
  ],
  "defects": ["<= 12 words each"],
  "clutter_score": 0,
  "completeness_score": 10,
  "summary": "one sentence: what clutters this graphic and what it lacks, or 'clean and complete'"
}

`type` is `core` for blue, `verbose` for orange, and one of the three red types for red. `clutter_score` uses the scale above. `completeness_score`: 10 (nothing missing) to 0 (the reader cannot tell what this is about).

The blog post:

<article>
{{ARTICLE}}
</article>

Elements:

{{ELEMENTS}}
