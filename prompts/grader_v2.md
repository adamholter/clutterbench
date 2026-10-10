You are grading a graphic that was made to accompany a blog post. A reader glances at it for a few seconds. A good graphic makes ONE point, with everything the reader needs to understand that point and nothing else.

You grade two things: clutter (what is there and should not be) and missing information (what is not there and should be).

First Read the screenshot at `{{SHOT}}` and look at it. Then use the element list below: every visible element of the same graphic with an id, kind, bounding box (x,y,width,height in px on a {{W}}x{{H}} canvas), font size, and text.

## Clutter: label every element

- `blue` = keep as is. This covers:
  - the chart or diagram marks (bars, lines, points, flow shapes, gridlines, axis);
  - the text needed to read them: category labels, one value label per mark, axis ticks, one legend;
  - short context that tells the reader what they are looking at: the name of the model or system, the benchmark, the metric or unit, a short chart title, an axis label. These are blue when they are short and said once, even if a careful reader could guess them. Identifying what is measured is information, not clutter;
  - ONE brand mark (logo or wordmark). A graphic for a company's post should carry its logo. Never mark the only logo red;
  - a headline that states the finding in a few words.
- `orange` = it belongs, but should be smaller, shorter, or shown differently. Examples: a headline that runs to two lines; a headline or sentence that spells out something the chart could show visually (say so in the reason); a row label carrying a parenthetical; a value written as a phrase where a number would do; a big standalone number that restates a difference already visible in the chart.
- `red` = remove it. Give each red region one `type`:
  - `unneeded`: it tells the reader nothing they need. Slogan headlines that do not state the finding ("A warmup that moves the needle"), eyebrow / kicker lines above a headline, category or series tags ("Research · Model training"), section numbers, badges and pills, subtitles and paragraphs that explain or restate the chart, takeaway sentences, footers, taglines, source and date lines, "next" links, decorative shapes, and card borders or frames drawn around the chart.
  - `extra_idea`: it serves a second point. A second chart, a callout box with a different statistic, method or pipeline cards beside a results chart, a stats row. Decide the ONE main idea (the post's most important claim, which the largest visual supports); everything serving another idea is `extra_idea`, however well made.
  - `repetition`: the same information is already shown elsewhere. A legend AND the same labels on every bar; a value as a number AND as a badge AND in a caption; the same phrase on every row; the brand shown a second time (footer wordmark when there is already a logo). Keep the best single instance `blue` and mark the others red.

How to decide between red and blue: the question is not "could the reader survive without it" but "does it help or orient the reader, or is it at least harmless". Small, quiet, useful context stays blue. Red is for things that compete with the main visual, duplicate it, or say nothing. Do not strip a graphic down to bare bars.

Group elements that form one visual unit into one region (a footer's three items; a callout box and everything in it). Every element id must appear in exactly one region. A container (`box`) takes the label of its contents, except a border or frame around the main chart, which is red `unneeded`.

Calibration, from the benchmark owner's own labels on past graphics:
- Headline "A warmup that moves the needle." -> red `unneeded`. A slogan, not a finding. Do not soften this to orange.
- Sentence under a headline, "AfterQuery office tasks helped Nemotron 3 Ultra climb toward the teacher on GDPval." -> red `unneeded`. The chart shows it.
- Big "+11.4 points" stat under the chart -> orange (a useful takeaway, far too large). Its label "Warmup gain on GDPval" and the sentence beside it -> red.
- Two-line headline "Warmup closes most of the gap to the expert teacher." over a clean bar chart -> orange: could be shown visually on the chart rather than spelled out.
- The AfterQuery logo, top left -> blue.
- Small tag "GDPval · Nemotron 3 Ultra" -> blue. It names the benchmark and model.
- Eyebrow "NVIDIA · NEMOTRON 3 ULTRA" above a headline, tag "Research · Model training", footer wordmark and tagline -> red.
- Border around the chart card -> red `unneeded`.

## Missing information

Imagine a reader who has not read the post. From the graphic alone they should be able to tell:
1. what was measured (benchmark, metric, unit),
2. on what (the model, system or subject),
3. what the compared conditions are (what "before" and "after" or each bar means),
4. the values.

List each of these the graphic fails to show in `missing`. Also list content that is present but cannot be read (text with no contrast, a logo that is invisible, labels cut off). Do not list nice-to-haves such as methods, dataset sizes, dates or caveats: leaving those out is correct.

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
  "clutter_score": 0,
  "completeness_score": 10,
  "summary": "one sentence: what clutters this graphic and what it lacks, or 'clean and complete'"
}

`type` is `core` for blue, `verbose` for orange, and one of the three red types for red. `clutter_score`: 0 (nothing to remove) to 10 (the content is buried). `completeness_score`: 10 (nothing missing) to 0 (the reader cannot tell what this is about).

The blog post:

<article>
{{ARTICLE}}
</article>

Elements:

{{ELEMENTS}}
