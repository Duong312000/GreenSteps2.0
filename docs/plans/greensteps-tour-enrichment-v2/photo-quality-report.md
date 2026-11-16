# Photo quality and coverage report

## Coverage summary

- **Distinct local source photographs:** 18.
- **Gallery photos per tour:** 3.
- **Distinct photo files within each tour:** 3.
- **Total assigned gallery slots:** 36.
- **Shared images within each same-destination pair:** 3 of 3, or 100% of each gallery.
- **Target:** at least 6 distinct photographs per tour and no more than 25% shared within a same-destination pair. The current library falls short by at least three photographs per tour and every pair exceeds the reuse target.
- **Source / author / license / license URL / caption / alt / verification date / local derivative metadata:** present in the checked-in manifest for all 18 images; tests verify source/license fields and all local responsive files.
- **Tour relationship:** each photo now carries a tour-specific `exact_landmark`, `destination_context`, or `regional_context` label and explanation. Exact labels require the named location to appear in that tour's itinerary.

## Per-tour coverage

| Tour | Photos | Unique | Exact itinerary landmarks | Destination context only | Missing photo needs |
|---|---:|---:|---|---:|---|
| `dalat-1` | 3 | 3 | Hồ Xuân Hương | 2 | More distinct images of the proposed forest/agriculture themes |
| `dalat-2` | 3 | 3 | Hồ Xuân Hương | 2 | More distinct central-city and confirmed agricultural-site photos |
| `phu-yen-1` | 3 | 3 | Gành Đá Đĩa, Vũng Rô, Tuy Hòa coast | 0 | Three more distinct, itinerary-matched photos |
| `phu-yen-2` | 3 | 3 | Gành Đá Đĩa, Vũng Rô, Tuy Hòa coast | 0 | Three more distinct, itinerary-matched photos |
| `da-nang-hoi-an-1` | 3 | 3 | Phố cổ Hội An, Mỹ Khê, Sơn Trà | 0 | Three more distinct, itinerary-matched photos |
| `da-nang-hoi-an-2` | 3 | 3 | Phố cổ Hội An, Mỹ Khê, Sơn Trà | 0 | Three more distinct, itinerary-matched photos |
| `sa-pa-1` | 3 | 3 | Ruộng bậc thang Sa Pa | 2 | More images tied to the proposed route; Cát Cát/Fansipan remain context only |
| `sa-pa-2` | 3 | 3 | None named as an exact stop | 3 | Images of an actually selected village/market/landscape stop |
| `ninh-binh-1` | 3 | 3 | Tràng An, Tam Cốc | 1 | Three more distinct photographs and exact day/stop mappings |
| `ninh-binh-2` | 3 | 3 | Tràng An, Tam Cốc | 1 | Three more distinct photographs and exact day/stop mappings |
| `phu-quoc-1` | 3 | 3 | None named as an exact stop | 3 | A confirmed coastal, traditional-work, and ecological stop |
| `phu-quoc-2` | 3 | 3 | None named as an exact stop | 3 | A confirmed beach, local-product, and ecological stop |

The two tours at each destination now have different cover selections. Their galleries still contain the same three destination assets, so this changes the lead image and relevance labeling without claiming that gallery duplication is solved.

## Source and licensing checks

All currently assigned photos are Wikimedia Commons assets already present in the repository. Their source pages and licenses are listed in `../greensteps-tour-photo-enrichment/attributions.md` and `photo-manifest.json`. No new image was downloaded or added in this task.

External research found candidate pages for Gành Đá Đĩa (author Đông Hồ, CC BY-SA 2.0) and Hội An Japanese Covered Bridge (author rapidacid, CC BY 2.0). Their Commons pages can be reviewed at [Gành Đá Đĩa – Phú Yên](https://commons.wikimedia.org/wiki/File:G%C3%A0nh_%C4%90%C3%A1_%C4%90%C4%A9a_-_Ph%C3%BA_Y%C3%AAn.jpg) and [Hoi An, Vietnam, Japanese Covered Bridge](https://commons.wikimedia.org/wiki/File:Hoi_An,_Vietnam,_Japanese_Covered_Bridge.jpg). The development shell could not fetch the Commons API (`fetch failed`), so neither candidate was downloaded or added to the manifest. This remains a photo-coverage blocker, not a license claim for an asset in the app.

## UX and fallback

The selected image's caption, source/author/license links, and relevance explanation are available below the detail hero and in the lightbox. The existing responsive derivatives, explicit dimensions, local asset paths, and missing-image fallback remain in use. The list and detail images continue using attribute-bound `srcset`, so absent responsive variants do not suppress their primary `src`.
