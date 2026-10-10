You are making a graphic for {{PUBLISHER}} ({{SITE}}) to accompany one of their blog posts. The post's text is in `article.md` in the current directory.

{{VARIANT}}

Deliverable
- One file, `graphic.html`, in the current directory. It is screenshotted at exactly {{W}}x{{H}} px (the graphic must fill that canvas exactly: no scrolling, nothing cut off).
- Build it with HTML, CSS and inline SVG. No `<canvas>`, no screenshots or raster images of charts, no animation, nothing that needs interaction.
- It must look like it belongs to {{PUBLISHER}}. Browse {{SITE}} yourself to collect their fonts, colours, logo and visual style. Save anything you use into `./assets/` and reference it with relative paths so the file renders offline.
- To check your work, run `node {{TOOLS}}/preview.cjs graphic.html`. It writes `preview.png` next to the file; look at it.

Ground rules
- Work from `article.md`. {{POST_RULE}}
- Every number in the graphic must come from `article.md`. Do not invent data.
- Stay inside the current directory (plus the preview command above). Do not read or search other folders on this machine.
- When `graphic.html` is finished, stop. Reply with one line saying it is done.
