# About page media

Source pages and Pexels license checked on 2026-11-13.

All stock media below is covered by the [Pexels License](https://www.pexels.com/license/), which permits free website use and modifications without mandatory attribution. This is **not** a claim that the content is public domain or CC0. Do not imply the pictured people endorse GreenSteps or are actual GreenSteps customers/partners.

| Local file | Creator / source | Use / processing |
| --- | --- | --- |
| `rice-terraces.mp4` | Simon Sto FPV, [Rice Terraces in Vietnam, #14619269](https://www.pexels.com/video/rice-terraces-in-vietnam-14619269/) | 18-second excerpt starting at 00:08; H.264, 1600 × 700, 24 fps, yuv420p; audio removed; CRF 26; faststart. 4,744,863 bytes. |
| `hero-poster.jpg` | Simon Sto FPV, poster supplied on the same video page | 1920px-wide compressed JPEG; hero fallback and nature value card. |
| `community.jpg` | Yulia Rozanova, [Woman Sitting Beside Her Goods, #3116165](https://www.pexels.com/photo/woman-sitting-beside-her-goods-3116165/) | 900px-wide JPEG, community illustration. Not a claim of a GreenSteps partnership. |
| `travel-planning.jpg` | Kateryna Naidenko, [Smartphone and Pen on Map, #7321954](https://www.pexels.com/photo/smartphone-and-pen-on-map-7321954/) | 900px-wide JPEG, generic travel-planning illustration. The map is Berlin; it is not represented as the GreenSteps app or a Vietnamese destination. |
| `journey.jpg` | Quang Nguyen Vinh, [People Sailing in Ha Long Bay in Vietnam, #6871160](https://www.pexels.com/photo/people-sailing-in-ha-long-bay-in-vietnam-6871160/) | 1600px-wide JPEG; journey/value illustration and the final official timeline milestone. Does not depict a documented GreenSteps event. |
| `story-home.jpg` | Screenshot of the existing GreenSteps `/home` page, captured from the local application on 2026-11-13 | Current product UI, anonymous browser context; 1200 × 900 JPEG, 195,399 bytes. Illustrates the product; not presented as an archived September release screenshot. |
| `story-planner.jpg` | Screenshot of the existing GreenSteps `/ai-planner` page, captured from the local application on 2026-11-13 | Current product UI, anonymous browser context; 1200 × 900 JPEG, 155,873 bytes. No chat message was submitted or private account data included. Not an archived October screenshot. |

Original video download URL linked by Pexels:
`https://videos.pexels.com/video-files/14619269/14619269-uhd_3840_1678_30fps.mp4`

Reproduction command (FFmpeg; build-time tool only, not an application dependency):

```sh
ffmpeg -ss 8 -i rice-terraces-original.mp4 -t 18 -an -vf "scale=1600:-2,fps=24" -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p -movflags +faststart rice-terraces.mp4
```

Only the optimized clip is shipped. The 232MB source stays in the ignored `tmp/about-assets` directory. All page media is served locally; no YouTube iframe or remote hotlinks are used.

Team portraits are **not stock media**. The owner supplied the six originals at `backend/images/greensteps/founders` on 2026-11-13. Optimized JPEG copies are included in `public/image/founders` and mapped using their source filenames; see that folder's README. All source PNGs remain unchanged. These are owner-provided assets used for the requested team section; no third-party stock license is asserted for them.

The five official timeline dates, titles and full descriptions were supplied by the project owner on 2026-11-13. Nature and travel-planning photographs are thematic illustrations; they do not depict actual GreenSteps internal meetings or launch events. The two product screenshots reuse the project's existing UI and assets; this file does not assert a new third-party stock license for those screenshots. November remains month-only (`2026-11`), without inventing a day.
