---
name: clutterbench
description: Use when making a chart, diagram, graphic or other visualization.
---

# ClutterBench

A reader glances at a graphic for a few seconds. It makes one point, with everything needed to read that point and nothing else. Clutter is everything past that.

## 1. Make it simple

Hold the graphic to these rules while you design and build it:

- One idea per graphic. Pick the single most important thing the source shows and show only that. If something is a second chart or a second story, leave it out.
- The main visual (the chart or diagram itself) takes up almost all of the canvas. Titles, labels and everything else are small and few.
- Say each thing once. If a legend explains a colour, do not also label it on every bar. If a number is drawn as a bar, do not also restate it in a badge, a caption and a takeaway line.
- Leave out anything the reader does not need in order to get the point: eyebrow labels, section numbers, subtitles that restate the chart, explanatory paragraphs, callout boxes with extra stats, takeaway lines, footers, source lines, badges, "next" links.
- Keep any text that stays as short as it can be.

## 2. Have it graded

Grade the finished graphic with a sub-agent that starts from an isolated context, so it judges the picture and not your intentions.

1. Render the graphic to an image at its real size, for example `npx playwright screenshot --viewport-size "1200,1200" file:///abs/path/graphic.html shot.png`.
2. Start one sub-agent with exactly this prompt, with absolute paths filled in:

   ```
   Follow the grader instructions in <folder of this skill>/grader.md.
   Screenshot: <path to the image>
   Source material: <path to the post, data or brief the graphic is for>
   ```

   The sub-agent gets these three lines and nothing more: no account of how the graphic was made, what it is meant to show, or what you expect.
3. Apply its annotations: remove each item under Remove, shorten each item under Shrink, add each item under Missing, fix each item under Defects. Leave everything it did not mention as it is.
4. Render again and grade again with a new sub-agent.

Done when a grade comes back with Remove, Shrink, Missing and Defects all "none", or after three rounds. Say which, and tell the user the final clutter score (0 is clean, 10 is buried).
