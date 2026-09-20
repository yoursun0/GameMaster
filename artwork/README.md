# GUI design choices

Three static GUI prototypes for the MVP in `../spec.md`. They show the same Traditional Chinese, four-player scene in **權鬥王座**, allowing comparison of the interface rather than different stories. These are visual studies, not a working game. The sample story and character names are illustrative.

| Choice | Direction | Layout and signature |
| --- | --- | --- |
| 01 — Fantasy chronicle | Midnight blue, antique gold, parchment; Ming-style story typography | Party on the left, framed story page in the centre, objective on the right. A chapter seal anchors the scene. |

## Deliverables

- `01-chronicle.png`

Each individual PNG is rendered at 2400 pixels wide from a 1600 CSS-pixel desktop layout. The matching self-contained HTML files are editable design sources. System fonts ensure Traditional Chinese labels render accurately without external services.

## Method and design brief

Method: deterministic HTML/CSS rendered to PNG in headless Chrome, not AI image generation. No external API was used. No game code or DeepSeek connection is implemented.

Shared brief: show an actual play screen in Traditional Chinese, including a Game Master story, a previous player action, a visible d20 result, four players with HP/MP, a clearly identified active player, free-text composer, three suggested actions, signature ability, pass control, objective, inventory, language control, and save status. Emphasise readability and shared-screen play. Use the edited world names. Avoid illustrations that would imply generated imagery is part of the MVP.

Design tokens:

- Chronicle: `#171c27` midnight, `#202632` slate, `#dab675` gold, `#f0e9d8` parchment, `#88b9a7` sage, `#a2a6d1` periwinkle. PMingLiU display/story; Microsoft JhengHei controls; Consolas numeric values.

Re-render locally with `uv run artwork/render_prototypes.py`. Requires local Chrome at the path configured in the script. The prototypes are desktop artwork; responsive layouts and functional controls belong to implementation after selection.
