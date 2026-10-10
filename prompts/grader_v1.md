You are grading a graphic for clutter. The graphic was made to accompany a blog post. A reader glances at it for a few seconds; it should make ONE point with as little on the canvas as possible.

First Read the screenshot at `{{SHOT}}` and look at it. Then use the element list below, which gives every visible element of the same graphic with an id, kind, bounding box (x,y,width,height in px on a {{W}}x{{H}} canvas), font size, and text.

Sort every element into one of three labels:

- `blue` = the actual content. The chart or diagram marks themselves (bars, lines, points, flow shapes), plus the minimum text needed to read them: one short title, the axis or category labels, one value label per mark, one legend. This should be taking up almost all of the canvas.
- `orange` = it belongs, but it is bigger, longer or wordier than it needs to be. Examples: a two-line headline that could be four words, a row label carrying a parenthetical explanation, a value written as a phrase ("10 cents on the $1") where a number would do, a legend three times the size it needs.
- `red` = it should not be there at all. Give each red region one `type`:
  - `unneeded`: the reader gets the point without it. Eyebrow / kicker labels, section numbers, edition or series tags, badges and pills, subtitles or paragraphs that explain or restate the chart, takeaway lines, footers, source and date lines, "next" links, logos repeated, decorative shapes and dividers.
  - `extra_idea`: it belongs to a second point the graphic is also trying to make. A second chart, a callout box with a different statistic, a side panel, a table next to the chart. Decide what the ONE main idea is (the most important claim of the post that the largest visual supports); everything serving another idea is `extra_idea`, however well made.
  - `repetition`: the same information is already shown somewhere else. A legend AND the same labels written on every bar; a bar's value written as a number AND as a "3.0x cheaper" badge AND in a caption; the same phrase ("No cache") repeated on every row; the headline number repeated in the subtitle. Keep the single best instance `blue` and mark the others `red` / `repetition`.

Be strict. The usual failure is being too kind: text that is true and relevant is still clutter if the graphic works without it. When unsure between blue and orange choose orange; between orange and red choose red only if deleting it loses nothing.

Group elements that form one visual unit (e.g. a footer with three text items, a callout box and everything inside it) into one region. Every element id must appear in exactly one region. Containers (`box`) take the label of what they contain; a card that only frames the main chart is `blue`.

Reply with ONLY a JSON object, no prose, no code fence:

{
  "main_idea": "the one point this graphic should make, <= 15 words",
  "ideas": ["each distinct point the graphic actually tries to make, <= 10 words each"],
  "regions": [
    {"label": "blue|orange|red", "type": "core|verbose|unneeded|extra_idea|repetition", "ids": ["e0", "e1"], "name": "2-4 word name, e.g. 'footer' or 'per-row badges'", "reason": "<= 15 words"}
  ],
  "clutter_score": 0,
  "summary": "one sentence on what is cluttering this graphic, or 'clean' if nothing is"
}

`type` is `core` for blue, `verbose` for orange, and one of the three red types for red. `clutter_score` is 0 (nothing to remove) to 10 (the content is buried).

The blog post (for judging what the main idea is and what repeats it):

<article>
{{ARTICLE}}
</article>

Elements:

{{ELEMENTS}}
