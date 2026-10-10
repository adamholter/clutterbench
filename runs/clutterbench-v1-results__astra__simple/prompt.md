You are making a graphic for ClutterBench (clutterbench.adamholter.chatgpt.site) to accompany one of their blog posts. The post's text is in `article.md` in the current directory.

Make a tasteful graphic to go with the post. Keep it simple and uncluttered:
- One idea per graphic. Pick the single most important thing the post shows and show only that. If something is a second chart or a second story, leave it out.
- The main visual (the chart or diagram itself) should take up almost all of the canvas. Titles, labels and everything else should be small and few.
- Say each thing once. If a legend explains a colour, do not also label it on every bar. If a number is drawn as a bar, do not also restate it in a badge, a caption and a takeaway line.
- Leave out anything the reader does not need in order to get the point: eyebrow labels, section numbers, subtitles that restate the chart, explanatory paragraphs, callout boxes with extra stats, takeaway lines, footers, source lines, badges, "next" links.
- Keep any text that stays as short as it can be.

Deliverable
- One file, `graphic.html`, in the current directory. It is screenshotted at exactly 1200x1200 px (the graphic must fill that canvas exactly: no scrolling, nothing cut off).
- Build it with HTML, CSS and inline SVG. No `<canvas>`, no screenshots or raster images of charts, no animation, nothing that needs interaction.
- It must look like it belongs to ClutterBench. Browse clutterbench.adamholter.chatgpt.site yourself to collect their fonts, colours, logo and visual style. Save anything you use into `./assets/` and reference it with relative paths so the file renders offline.
- To check your work, run `node /private/tmp/cbw/_tools/preview.cjs graphic.html`. It writes `preview.png` next to the file; look at it.

Ground rules
- Work from `article.md`. This post is not published yet. The ClutterBench site already shows a leaderboard and other charts: do not copy or adapt them, or any other existing graphic, chart or social card about these results. Use the site only as a style reference.
- Every number in the graphic must come from `article.md`. Do not invent data.
- Stay inside the current directory (plus the preview command above). Do not read or search other folders on this machine.
- When `graphic.html` is finished, stop. Reply with one line saying it is done.
