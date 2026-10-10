Blog·Oct 10, 2026

# ClutterBench: which models clutter their graphics?

## Overview

Ask a model for a graphic and you often get a small chart buried under a headline, a subtitle, three stat cards, a takeaway line and a footer. ClutterBench measures that. In the first run, **Claude Sonnet 5.5 produced the least clutter (29%)** and **GPT-6 Luna the most (61%)** when given a bare prompt. With a short instruction to keep it simple, all four models dropped to **between 0% and 6%**.

## The task

Each model runs as an agent. It gets the text of a blog post and is asked to build one 1200 by 1200 graphic in HTML. It browses the publisher's website on its own to collect fonts, colours and the logo. It may not open the post's own page or look at any existing figure for it. The first run used **6 posts** and **4 models**, with one attempt per cell at low reasoning effort: **48 graphics** in total.

Every model is tested with two prompts:

- **Raw**: "Make a tasteful graphic to go with the post." Nothing else.
- **Simple**: the same, plus five plain instructions: one idea per graphic, the main visual takes up almost all the canvas, say each thing once, leave out anything the reader does not need, keep text short.

## The grader

A grader looks at the screenshot and the list of every element on the canvas, and labels each element:

- **Keep** (blue): the chart itself, the labels needed to read it, one logo, a short title.
- **Shrink** (orange): it belongs, but it is longer or bigger than it should be.
- **Remove** (red): slogans, eyebrow labels, badges, restated numbers, stat cards, second charts, taglines.

The clutter score is the share of drawn area marked remove, plus half the area marked shrink. Blank canvas does not count either way.

Grading uses Claude Haiku 5.5 twice. If the two passes differ on anything, Claude Sonnet 5.5 breaks the tie. The two Haiku passes agreed completely on 21 of the 48 graphics; Sonnet was called on the other 27.

The grading rules were written from one person's hand labels on 24 graphics. On 12 held-out graphics the grader gave 83% of elements the same label as the human, and its 0 to 10 clutter score was off by 1.3 points on average.

## Results

| Model | Raw prompt | Simple prompt | Words on a raw graphic | Words on a simple graphic |
|---|---|---|---|---|
| Claude Sonnet 5.5 | 29% | 0% | 43 | 12 |
| Claude Haiku 5.5 | 42% | 0% | 104 | 10 |
| GPT-6.1 Sol | 46% | 0% | 86 | 13 |
| GPT-6 Luna | 61% | 6% | 110 | 20 |

Lower is better. Each cell is the mean of 6 graphics.

## What gets cut

On raw-prompt graphics, most of what the grader removes falls into three groups. The first is text that tells the reader nothing: slogan headlines such as "A warmup that moves the needle", eyebrow labels and footer taglines. The second is a second idea squeezed in beside the first, usually method cards or a row of dataset statistics under a results chart. The third is repetition: the same number shown as a bar, again as a stat card and again in a caption.

## The gap is the finding

Under the simple prompt, three of the four models produced graphics with nothing to remove. The clutter is a default, not a limit. A model that scores 46% raw and 0% simple can make a clean graphic; it does not choose to unless told.

GPT-6 Luna was the only model with clutter left under the simple prompt, and the only one where the grader flagged missing information: on 3 of its 6 simple graphics a reader could not tell what was being measured.

## Limits

One attempt per cell means gaps of a few points are noise; Haiku at 42% and Sol at 46% cannot be told apart. All six posts come from one publisher. The grader cannot see rendering defects such as a white logo on a light background, and it under-scores the worst graphics by about 2 points compared with the human reviewer.
