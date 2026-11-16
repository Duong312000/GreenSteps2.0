import { TourPhotoCredit } from "../models/models";

export interface DemoTourPhotoData {
  image: string;
  gallery: string[];
  photoMetadata: TourPhotoCredit[];
}

// Local V3 photo mapping for the twelve fixed demo IDs. This lets the UI show
// the checked-in Commons gallery even when persisted demo records predate V3.
export const DEMO_TOUR_PHOTO_DATA: Record<string, DemoTourPhotoData> = {
  "demo-vn-tour-dalat-1": {
    "image": "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
    "gallery": [
      "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
      "image/greensteps/tours/dalat/dalat-maple-forest.jpg",
      "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-1.jpg",
      "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-2.jpg",
      "image/greensteps/tours/dalat/file-da-lat-silkworms-eating-mulberry-leaves.jpg",
      "image/greensteps/tours/dalat/file-da-lat-panorama.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
        "caption": "Hồ Xuân Hương giữa trung tâm Đà Lạt.",
        "alt": "Mặt hồ Xuân Hương và cảnh quan thành phố Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Lat,_view_to_Xuan_Huong_lake.jpg",
        "author": "lionlyonne",
        "licenseId": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "attribution": "lionlyonne, via Wikimedia Commons, CC BY-SA 2.0",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Hồ Xuân Hương được nêu trong hoạt động ngày 1."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
            "width": 1024,
            "height": 768
          }
        ],
        "width": 1024,
        "height": 768
      },
      {
        "path": "image/greensteps/tours/dalat/dalat-maple-forest.jpg",
        "caption": "Rừng lá phong ở Đà Lạt.",
        "alt": "Tán lá phong trong khu rừng tại Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:R%E1%BB%ABng_l%C3%A1_phong_%C4%90%C3%A0_L%E1%BA%A1t,_Vi%E1%BB%87t_Nam.jpg",
        "author": "ThiênĐế98",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "ThiênĐế98, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Rừng lá phong, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Cảnh quan rừng tại Đà Lạt; không xác nhận địa điểm rừng cụ thể trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/dalat-maple-forest-480w.jpg",
            "width": 480,
            "height": 270
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-maple-forest-960w.jpg",
            "width": 960,
            "height": 540
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-maple-forest.jpg",
            "width": 1600,
            "height": 900
          }
        ],
        "width": 1600,
        "height": 900
      },
      {
        "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-1.jpg",
        "caption": "Hồ Xuân Hương nhìn từ khu vực bờ hồ ở Đà Lạt",
        "alt": "Hồ Xuân Hương nhìn từ khu vực bờ hồ ở Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ho_Xuan_Huong_-_Huy_Phuong_1.jpg",
        "author": "Trần Huy Phương",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Trần Huy Phương, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp hồ Xuân Hương, điểm dạo bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-1-480w.jpg",
            "width": 480,
            "height": 137
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-1-960w.jpg",
            "width": 960,
            "height": 274
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-1.jpg",
            "width": 1600,
            "height": 458
          }
        ],
        "width": 1600,
        "height": 458
      },
      {
        "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-2.jpg",
        "caption": "Một góc khác của hồ Xuân Hương ở Đà Lạt",
        "alt": "Một góc khác của hồ Xuân Hương ở Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ho_Xuan_Huong_-_Huy_Phuong_2.jpg",
        "author": "Trần Huy Phương",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Trần Huy Phương, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp hồ Xuân Hương, điểm dạo bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-2-480w.jpg",
            "width": 480,
            "height": 121
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-2-960w.jpg",
            "width": 960,
            "height": 242
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-huy-phuong-2.jpg",
            "width": 1600,
            "height": 403
          }
        ],
        "width": 1600,
        "height": 403
      },
      {
        "path": "image/greensteps/tours/dalat/file-da-lat-silkworms-eating-mulberry-leaves.jpg",
        "caption": "Tằm ăn lá dâu tại một cơ sở nuôi tằm ở Đà Lạt",
        "alt": "Tằm ăn lá dâu tại một cơ sở nuôi tằm ở Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Lat_-_Silkworms_eating_mulberry_leaves.jpg",
        "author": "P. Hughes",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "P. Hughes, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Cơ sở nuôi tằm tại Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Cơ sở nuôi tằm ở Đà Lạt minh họa chủ đề nông nghiệp cao nguyên; seed không nêu cơ sở này như điểm dừng đã xác nhận."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-silkworms-eating-mulberry-leaves-480w.jpg",
            "width": 480,
            "height": 394
          },
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-silkworms-eating-mulberry-leaves-960w.jpg",
            "width": 960,
            "height": 789
          },
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-silkworms-eating-mulberry-leaves.jpg",
            "width": 1600,
            "height": 1315
          }
        ],
        "width": 1600,
        "height": 1315
      },
      {
        "path": "image/greensteps/tours/dalat/file-da-lat-panorama.jpg",
        "caption": "Toàn cảnh thành phố Đà Lạt nhìn từ trên cao",
        "alt": "Toàn cảnh thành phố Đà Lạt nhìn từ trên cao",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Lat_Panorama.JPG",
        "author": "Cheong Kok Chun",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Cheong Kok Chun, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh toàn cảnh ghi rõ Đà Lạt, làm bối cảnh cho đoạn dạo khu trung tâm."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-panorama-480w.jpg",
            "width": 480,
            "height": 120
          },
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-panorama-960w.jpg",
            "width": 960,
            "height": 240
          },
          {
            "path": "image/greensteps/tours/dalat/file-da-lat-panorama.jpg",
            "width": 1600,
            "height": 400
          }
        ],
        "width": 1600,
        "height": 400
      }
    ]
  },
  "demo-vn-tour-dalat-2": {
    "image": "image/greensteps/tours/dalat/dalat-city-and-lake.jpg",
    "gallery": [
      "image/greensteps/tours/dalat/dalat-city-and-lake.jpg",
      "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
      "image/greensteps/tours/dalat/file-ho-xuan-huong-02.jpg",
      "image/greensteps/tours/dalat/file-ho-xuan-huong-03.jpg",
      "image/greensteps/tours/dalat/file-3-1-2012-city-square-1.jpg",
      "image/greensteps/tours/dalat/file-3-1-2012-city-square-2.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/dalat/dalat-city-and-lake.jpg",
        "caption": "Góc nhìn về trung tâm Đà Lạt và hồ Xuân Hương.",
        "alt": "Khu trung tâm Đà Lạt nhìn về phía hồ Xuân Hương",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Dalat.jpg",
        "author": "thalling55",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "thalling55, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Trung tâm Đà Lạt và hồ Xuân Hương",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Bối cảnh trung tâm và hồ; ảnh không xác định một điểm dừng bổ sung."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/dalat-city-and-lake-480w.jpg",
            "width": 480,
            "height": 351
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-city-and-lake-960w.jpg",
            "width": 960,
            "height": 702
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-city-and-lake.jpg",
            "width": 1600,
            "height": 1170
          }
        ],
        "width": 1600,
        "height": 1170
      },
      {
        "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
        "caption": "Hồ Xuân Hương giữa trung tâm Đà Lạt.",
        "alt": "Mặt hồ Xuân Hương và cảnh quan thành phố Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Lat,_view_to_Xuan_Huong_lake.jpg",
        "author": "lionlyonne",
        "licenseId": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "attribution": "lionlyonne, via Wikimedia Commons, CC BY-SA 2.0",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Hồ Xuân Hương được nêu trong hoạt động ngày 1."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/dalat/dalat-xuan-huong-lake.jpg",
            "width": 1024,
            "height": 768
          }
        ],
        "width": 1024,
        "height": 768
      },
      {
        "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-02.jpg",
        "caption": "Nhà hàng Thủy Tạ bên hồ Xuân Hương ở Đà Lạt",
        "alt": "Nhà hàng Thủy Tạ bên hồ Xuân Hương ở Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ho_Xuan_Huong_02.JPG",
        "author": "Diane Selwyn ( talk )",
        "licenseId": "Public domain",
        "licenseUrl": "https://commons.wikimedia.org/wiki/Template:PD-self",
        "attribution": "Diane Selwyn ( talk ), via Wikimedia Commons, Public domain",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp hồ Xuân Hương, điểm dạo bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-02-480w.jpg",
            "width": 480,
            "height": 260
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-02-960w.jpg",
            "width": 960,
            "height": 521
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-02.jpg",
            "width": 1600,
            "height": 868
          }
        ],
        "width": 1600,
        "height": 868
      },
      {
        "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-03.jpg",
        "caption": "Nhà hàng Thủy Tạ và mặt hồ Xuân Hương ở Đà Lạt",
        "alt": "Nhà hàng Thủy Tạ và mặt hồ Xuân Hương ở Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ho_Xuan_Huong_03.jpg",
        "author": "Diane Selwyn ( talk )",
        "licenseId": "Public domain",
        "licenseUrl": "https://commons.wikimedia.org/wiki/Template:PD-self",
        "attribution": "Diane Selwyn ( talk ), via Wikimedia Commons, Public domain",
        "subjectLocation": "Hồ Xuân Hương, Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp hồ Xuân Hương, điểm dạo bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-03-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-03-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/dalat/file-ho-xuan-huong-03.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-1.jpg",
        "caption": "Không gian quảng trường trung tâm tại Đà Lạt",
        "alt": "Không gian quảng trường trung tâm tại Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:3-1-2012_City_Square_1.JPG",
        "author": "Diane Selwyn",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Diane Selwyn, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Quảng trường trung tâm Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh khu quảng trường ở trung tâm Đà Lạt, phù hợp điểm dạo quanh quảng trường trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-1-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-1-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-1.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-2.jpg",
        "caption": "Một góc khác của quảng trường trung tâm Đà Lạt",
        "alt": "Một góc khác của quảng trường trung tâm Đà Lạt",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:3-1-2012_City_Square_2.JPG",
        "author": "Diane Selwyn",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Diane Selwyn, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Quảng trường trung tâm Đà Lạt",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh khu quảng trường ở trung tâm Đà Lạt, phù hợp điểm dạo quanh quảng trường trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-2-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-2-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/dalat/file-3-1-2012-city-square-2.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      }
    ]
  },
  "demo-vn-tour-phu-yen-1": {
    "image": "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg",
    "gallery": [
      "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg",
      "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
      "image/greensteps/tours/phu-yen/file-ghenh-da-dia-02.jpg",
      "image/greensteps/tours/phu-yen/file-ghenh-da-dia-03.jpg",
      "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-2.jpg",
      "image/greensteps/tours/phu-yen/file-vung-ro-bay-2.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg",
        "caption": "Gành Đá Đĩa với các khối đá bazan ven biển.",
        "alt": "Các khối đá bazan xếp thành tầng tại Gành Đá Đĩa, Phú Yên",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:G%C3%A0nh_%C4%90%C3%A1_%C4%90%C4%A9a_-_Ph%C3%BA_Y%C3%AAn.jpg",
        "author": "Đông Hồ",
        "licenseId": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "attribution": "Đông Hồ, via Wikimedia Commons, CC BY-SA 2.0",
        "subjectLocation": "Gành Đá Đĩa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Gành Đá Đĩa được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-ganh-da-dia.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
        "caption": "Vịnh Vũng Rô nhìn từ sườn núi Đèo Cả.",
        "alt": "Mặt nước và sườn núi quanh vịnh Vũng Rô, Phú Yên",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:V%E1%BB%8Bnh_V%C5%A9ng_R%C3%B4.jpg",
        "author": "Bùi Thụy Đào Nguyên",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Bùi Thụy Đào Nguyên, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Vịnh Vũng Rô, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "V?nh V?ng R? l? ?i?m ng?m c?nh trong c? hai l?ch tr?nh Ph? Y?n."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-02.jpg",
        "caption": "Các cột đá bazan ven biển tại Gành Đá Đĩa",
        "alt": "Các cột đá bazan ven biển tại Gành Đá Đĩa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ghenh_Da_Dia_02.jpg",
        "author": "Prince Roy",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "Prince Roy, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Gành Đá Đĩa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp Gành Đá Đĩa, điểm tham quan trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-02-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-02-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-02.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-03.jpg",
        "caption": "Một góc các khối đá bazan xếp lớp tại Gành Đá Đĩa",
        "alt": "Một góc các khối đá bazan xếp lớp tại Gành Đá Đĩa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ghenh_Da_Dia_03.jpg",
        "author": "Prince Roy",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "Prince Roy, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Gành Đá Đĩa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp Gành Đá Đĩa, điểm tham quan trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-03-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-03-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-03.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-2.jpg",
        "caption": "Bờ biển Tuy Hòa nhìn dọc theo đường chân trời",
        "alt": "Bờ biển Tuy Hòa nhìn dọc theo đường chân trời",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Beach_in_Tuy_Hoa_2.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi biển Tuy Hòa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bãi biển Tuy Hòa, điểm dạo bộ ven biển trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-2-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-2-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-2.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-2.jpg",
        "caption": "Cảnh quan vịnh Vũng Rô ở Phú Yên",
        "alt": "Cảnh quan vịnh Vũng Rô ở Phú Yên",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Vung_Ro_Bay_2.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Vịnh Vũng Rô, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp vịnh Vũng Rô, điểm ngắm cảnh trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-2-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-2-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-2.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      }
    ]
  },
  "demo-vn-tour-phu-yen-2": {
    "image": "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast.jpg",
    "gallery": [
      "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast.jpg",
      "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
      "image/greensteps/tours/phu-yen/file-ghenh-da-dia-04.jpg",
      "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-3.jpg",
      "image/greensteps/tours/phu-yen/file-vung-ro-bay-3.jpg",
      "image/greensteps/tours/phu-yen/file-vung-ro-bay-4.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast.jpg",
        "caption": "Bờ biển tại Tuy Hòa.",
        "alt": "Bờ biển Tuy Hòa nhìn dọc theo đường chân trời",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Beach_in_Tuy_Hoa_1.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bờ biển Tuy Hòa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "?nh ch?p tr?c ti?p Bờ biển Tuy Hòa, Phú Yên, thu?c ?i?m ??n c?a l?ch tr?nh."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-tuy-hoa-coast.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
        "caption": "Vịnh Vũng Rô nhìn từ sườn núi Đèo Cả.",
        "alt": "Mặt nước và sườn núi quanh vịnh Vũng Rô, Phú Yên",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:V%E1%BB%8Bnh_V%C5%A9ng_R%C3%B4.jpg",
        "author": "Bùi Thụy Đào Nguyên",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Bùi Thụy Đào Nguyên, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Vịnh Vũng Rô, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Vịnh Vũng Rô được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/phu-yen-vung-ro-bay.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-04.jpg",
        "caption": "Các khối đá bazan tại Gành Đá Đĩa nhìn từ một góc khác",
        "alt": "Các khối đá bazan tại Gành Đá Đĩa nhìn từ một góc khác",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ghenh_Da_Dia_04.jpg",
        "author": "Prince Roy",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "Prince Roy, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Gành Đá Đĩa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp Gành Đá Đĩa, điểm tham quan trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-04-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-04-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-ghenh-da-dia-04.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-3.jpg",
        "caption": "Một đoạn bờ biển công cộng tại Tuy Hòa",
        "alt": "Một đoạn bờ biển công cộng tại Tuy Hòa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Beach_in_Tuy_Hoa_3.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi biển Tuy Hòa, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bãi biển Tuy Hòa, điểm dạo bộ ven biển trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-3-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-3-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-beach-in-tuy-hoa-3.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-3.jpg",
        "caption": "Mặt nước và sườn núi quanh vịnh Vũng Rô",
        "alt": "Mặt nước và sườn núi quanh vịnh Vũng Rô",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Vung_Ro_Bay_3.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Vịnh Vũng Rô, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp vịnh Vũng Rô, điểm ngắm cảnh trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-3-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-3-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-3.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-4.jpg",
        "caption": "Một góc khác của vịnh Vũng Rô ở Phú Yên",
        "alt": "Một góc khác của vịnh Vũng Rô ở Phú Yên",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Vung_Ro_Bay_4.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Vịnh Vũng Rô, Phú Yên",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp vịnh Vũng Rô, điểm ngắm cảnh trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-4-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-4-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-yen/file-vung-ro-bay-4.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      }
    ]
  },
  "demo-vn-tour-da-nang-hoi-an-1": {
    "image": "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg",
    "gallery": [
      "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg",
      "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-1.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-2.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-3.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-son-tra-peninsula-da-nang-vietnam-linh-ung-pagoda-01.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg",
        "caption": "Mái ngói và chi tiết trang trí trên một công trình ở khu phố cổ Hội An.",
        "alt": "Mái ngói và trang trí nhiều màu trên công trình trong phố cổ Hội An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Hoi_An_Ancient_Town,_Quang_Nam_province,_South_Central_Coast,_Vietnam.jpg",
        "author": "Mstyslav Chernov",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "Mstyslav Chernov, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Phố cổ Hội An, Quảng Nam",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Khu phố cổ Hội An được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town-480w.jpg",
            "width": 480,
            "height": 321
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town-960w.jpg",
            "width": 960,
            "height": 643
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/hoi-an-old-town.jpg",
            "width": 1600,
            "height": 1071
          }
        ],
        "width": 1600,
        "height": 1071
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
        "caption": "Bán đảo Sơn Trà nhìn từ Đà Nẵng.",
        "alt": "Đường bờ biển Đà Nẵng hướng về bán đảo Sơn Trà",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Nang_and_the_Son_Tra_Peninsula.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bán đảo Sơn Trà, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "B?n ??o S?n Tr? l? ?i?m c?nh quan trong l?ch tr?nh H?i An??? N?ng."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-1.jpg",
        "caption": "Phố cổ Hội An lên đèn vào buổi tối",
        "alt": "Phố cổ Hội An lên đèn vào buổi tối",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:2024-12-20_Hoi_An_Old_Town_at_night_1.jpg",
        "author": "Alexkom000",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Alexkom000, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Phố cổ Hội An",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp khu phố cổ Hội An, điểm đi bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-1-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-1-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-1.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-2.jpg",
        "caption": "Một con phố trong khu phố cổ Hội An vào buổi tối",
        "alt": "Một con phố trong khu phố cổ Hội An vào buổi tối",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:2024-12-20_Hoi_An_Old_Town_at_night_2.jpg",
        "author": "Alexkom000",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Alexkom000, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Phố cổ Hội An",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp khu phố cổ Hội An, điểm đi bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-2-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-2-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-2.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-3.jpg",
        "caption": "Bãi biển Mỹ Khê ở Đà Nẵng",
        "alt": "Bãi biển Mỹ Khê ở Đà Nẵng",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:My_Khe_Beach_3.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi biển Mỹ Khê, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp bãi biển Mỹ Khê, điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-3-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-3-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-3.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-son-tra-peninsula-da-nang-vietnam-linh-ung-pagoda-01.jpg",
        "caption": "Tượng Quan Âm tại chùa Linh Ứng trên bán đảo Sơn Trà",
        "alt": "Tượng Quan Âm tại chùa Linh Ứng trên bán đảo Sơn Trà",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Son-Tra-Peninsula_Da-Nang_Vietnam_Linh-Ung-Pagoda-01.jpg",
        "author": "CEphoto, Uwe Aranas",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "CEphoto, Uwe Aranas, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Chùa Linh Ứng, bán đảo Sơn Trà, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp chùa Linh Ứng trên bán đảo Sơn Trà, điểm cảnh quan được nêu trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-son-tra-peninsula-da-nang-vietnam-linh-ung-pagoda-01-480w.jpg",
            "width": 480,
            "height": 358
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-son-tra-peninsula-da-nang-vietnam-linh-ung-pagoda-01-960w.jpg",
            "width": 960,
            "height": 716
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-son-tra-peninsula-da-nang-vietnam-linh-ung-pagoda-01.jpg",
            "width": 1600,
            "height": 1194
          }
        ],
        "width": 1600,
        "height": 1194
      }
    ]
  },
  "demo-vn-tour-da-nang-hoi-an-2": {
    "image": "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach.jpg",
    "gallery": [
      "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach.jpg",
      "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-3.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-9.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-boats-on-my-khe-beach-2.jpg",
      "image/greensteps/tours/da-nang-hoi-an/file-ban-ao-son-tra-th10n2023-cay-coi-2.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach.jpg",
        "caption": "Bờ biển Mỹ Khê ở Đà Nẵng.",
        "alt": "Bãi cát và mặt biển tại Mỹ Khê, Đà Nẵng",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:My_Khe_Beach,_Da_Nang,_Vietnam.jpg",
        "author": ". Ray in Manila",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": ". Ray in Manila, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Bãi biển Mỹ Khê, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "?nh ch?p tr?c ti?p Bãi biển Mỹ Khê, Đà Nẵng, thu?c ?i?m ??n c?a l?ch tr?nh."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach-480w.jpg",
            "width": 480,
            "height": 314
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach-960w.jpg",
            "width": 960,
            "height": 628
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-my-khe-beach.jpg",
            "width": 1600,
            "height": 1046
          }
        ],
        "width": 1600,
        "height": 1046
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
        "caption": "Bán đảo Sơn Trà nhìn từ Đà Nẵng.",
        "alt": "Đường bờ biển Đà Nẵng hướng về bán đảo Sơn Trà",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Da_Nang_and_the_Son_Tra_Peninsula.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bán đảo Sơn Trà, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Bán đảo Sơn Trà được nêu trực tiếp trong hoạt động lịch trình; quyền tiếp cận cần kiểm tra."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/da-nang-son-tra-peninsula.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-3.jpg",
        "caption": "Mái nhà và ánh đèn trong phố cổ Hội An",
        "alt": "Mái nhà và ánh đèn trong phố cổ Hội An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:2024-12-20_Hoi_An_Old_Town_at_night_3.jpg",
        "author": "Alexkom000",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Alexkom000, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Phố cổ Hội An",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp khu phố cổ Hội An, điểm đi bộ trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-3-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-3-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-2024-12-20-hoi-an-old-town-at-night-3.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-9.jpg",
        "caption": "Bãi biển Mỹ Khê với bán đảo Sơn Trà ở phía xa",
        "alt": "Bãi biển Mỹ Khê với bán đảo Sơn Trà ở phía xa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:My_Khe_Beach_9.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi biển Mỹ Khê, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp bãi biển Mỹ Khê, điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-9-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-9-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-my-khe-beach-9.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-boats-on-my-khe-beach-2.jpg",
        "caption": "Thuyền thúng trên bãi biển Mỹ Khê ở Đà Nẵng",
        "alt": "Thuyền thúng trên bãi biển Mỹ Khê ở Đà Nẵng",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Boats_on_My_Khe_Beach_2.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi biển Mỹ Khê, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp trực tiếp bãi biển Mỹ Khê, điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-boats-on-my-khe-beach-2-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-boats-on-my-khe-beach-2-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-boats-on-my-khe-beach-2.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/da-nang-hoi-an/file-ban-ao-son-tra-th10n2023-cay-coi-2.jpg",
        "caption": "Cây xanh trên bán đảo Sơn Trà ở Đà Nẵng",
        "alt": "Cây xanh trên bán đảo Sơn Trà ở Đà Nẵng",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:B%C3%A1n_%C4%91%E1%BA%A3o_S%C6%A1n_Tr%C3%A0_th10n2023_(c%C3%A2y_c%E1%BB%91i)_(2).jpg",
        "author": "Phương Huy",
        "licenseId": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "attribution": "Phương Huy, via Wikimedia Commons, CC0",
        "subjectLocation": "Bán đảo Sơn Trà, Đà Nẵng",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bán đảo Sơn Trà, điểm cảnh quan có điều kiện tiếp cận trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-ban-ao-son-tra-th10n2023-cay-coi-2-480w.jpg",
            "width": 480,
            "height": 602
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-ban-ao-son-tra-th10n2023-cay-coi-2-960w.jpg",
            "width": 960,
            "height": 1204
          },
          {
            "path": "image/greensteps/tours/da-nang-hoi-an/file-ban-ao-son-tra-th10n2023-cay-coi-2.jpg",
            "width": 1600,
            "height": 2007
          }
        ],
        "width": 1600,
        "height": 2007
      }
    ]
  },
  "demo-vn-tour-sa-pa-1": {
    "image": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
    "gallery": [
      "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
      "image/greensteps/tours/sa-pa/sa-pa-fansipan-view.jpg",
      "image/greensteps/tours/sa-pa/file-muong-hoa-valley-01.jpg",
      "image/greensteps/tours/sa-pa/file-muong-hoa-valley-02.jpg",
      "image/greensteps/tours/sa-pa/file-cat-cat-village-1.jpg",
      "image/greensteps/tours/sa-pa/file-cat-cat-village-3-water-reel.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
        "caption": "Ruộng bậc thang ở Sa Pa.",
        "alt": "Các thửa ruộng bậc thang uốn theo sườn núi Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Sapa,_Vietnam.jpg",
        "author": "Eerin25",
        "licenseId": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "attribution": "Eerin25, via Wikimedia Commons, CC0",
        "subjectLocation": "Ruộng bậc thang Sa Pa, Lào Cai",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ruộng bậc thang là chủ đề trực tiếp trong hoạt động ngày 1 của Sa Pa 1."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/sa-pa/sa-pa-fansipan-view.jpg",
        "caption": "Cáp treo Fansipan và thị trấn Sa Pa nhìn từ núi.",
        "alt": "Cáp treo Fansipan phía trên thung lũng Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Fansipan_Cable_Car_and_Sa_Pa.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Fansipan và Sa Pa, Lào Cai",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Fansipan thuộc Sa Pa nhưng không được nêu là điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-fansipan-view-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-fansipan-view-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-fansipan-view.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-01.jpg",
        "caption": "Ruộng bậc thang tại thung lũng Mường Hoa, Sa Pa",
        "alt": "Ruộng bậc thang tại thung lũng Mường Hoa, Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:M%C6%B0%E1%BB%9Dng_Hoa_Valley_01.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Thung lũng Mường Hoa, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp thung lũng và ruộng bậc thang Sa Pa, khớp chủ đề ngày đầu trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-01-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-01-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-01.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-02.jpg",
        "caption": "Sườn ruộng bậc thang nhìn qua thung lũng Mường Hoa",
        "alt": "Sườn ruộng bậc thang nhìn qua thung lũng Mường Hoa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:M%C6%B0%E1%BB%9Dng_Hoa_Valley_02.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Thung lũng Mường Hoa, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp thung lũng và ruộng bậc thang Sa Pa, khớp chủ đề ngày đầu trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-02-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-02-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-02.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-1.jpg",
        "caption": "Cảnh quan bản Cát Cát tại Sa Pa",
        "alt": "Cảnh quan bản Cát Cát tại Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:C%C3%A1t_C%C3%A1t_Village_1.jpg",
        "author": "Mickey Đại Phát",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Mickey Đại Phát, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bản Cát Cát, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh địa điểm cụ thể tại Sa Pa minh họa bối cảnh cộng đồng; seed không khẳng định Cát Cát là điểm dừng đã chốt."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-1-480w.jpg",
            "width": 480,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-1-960w.jpg",
            "width": 960,
            "height": 1280
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-1.jpg",
            "width": 1600,
            "height": 2133
          }
        ],
        "width": 1600,
        "height": 2133
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-3-water-reel.jpg",
        "caption": "Guồng nước trong bản Cát Cát ở Sa Pa",
        "alt": "Guồng nước trong bản Cát Cát ở Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:C%C3%A1t_C%C3%A1t_Village_3_-_Water_Reel.jpg",
        "author": "Mickey Đại Phát",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Mickey Đại Phát, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bản Cát Cát, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh địa điểm cụ thể tại Sa Pa minh họa bối cảnh cộng đồng; seed không khẳng định Cát Cát là điểm dừng đã chốt."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-3-water-reel-480w.jpg",
            "width": 480,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-3-water-reel-960w.jpg",
            "width": 960,
            "height": 1280
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-3-water-reel.jpg",
            "width": 1600,
            "height": 2133
          }
        ],
        "width": 1600,
        "height": 2133
      }
    ]
  },
  "demo-vn-tour-sa-pa-2": {
    "image": "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels.jpg",
    "gallery": [
      "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels.jpg",
      "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
      "image/greensteps/tours/sa-pa/file-muong-hoa-valley-03.jpg",
      "image/greensteps/tours/sa-pa/file-ham-rong-ta-phin-ql-4d-sa-pa-rice-fields-70725.jpg",
      "image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall.jpg",
      "image/greensteps/tours/sa-pa/file-pho-cau-may-sa-pa.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels.jpg",
        "caption": "Guồng nước tại bản Cát Cát, Sa Pa.",
        "alt": "Những guồng nước gỗ bên dòng suối ở bản Cát Cát, Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Water_wheels_in_Cat_Cat_village,_Sa_Pa,_Vietnam,_20240126_1140_3535.jpg",
        "author": "Jakub Hałun",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Jakub Hałun, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Cát Cát, Sa Pa, Lào Cai",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Bản Cát Cát thuộc Sa Pa nhưng không được nêu là điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-cat-cat-water-wheels.jpg",
            "width": 1600,
            "height": 1068
          }
        ],
        "width": 1600,
        "height": 1068
      },
      {
        "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
        "caption": "Ruộng bậc thang ở Sa Pa.",
        "alt": "Các thửa ruộng bậc thang uốn theo sườn núi Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Sapa,_Vietnam.jpg",
        "author": "Eerin25",
        "licenseId": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "attribution": "Eerin25, via Wikimedia Commons, CC0",
        "subjectLocation": "Ruộng bậc thang Sa Pa, Lào Cai",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ruộng bậc thang là bối cảnh vùng Sa Pa; lịch trình này không nêu điểm ruộng cụ thể."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-03.jpg",
        "caption": "Cảnh núi và ruộng bậc thang ở thung lũng Mường Hoa",
        "alt": "Cảnh núi và ruộng bậc thang ở thung lũng Mường Hoa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:M%C6%B0%E1%BB%9Dng_Hoa_Valley_03.jpg",
        "author": "Christophe95",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Christophe95, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Thung lũng Mường Hoa, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảnh quan núi và ruộng bậc thang thuộc Sa Pa, phù hợp chủ đề nông nghiệp vùng cao."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-03-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-03-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-muong-hoa-valley-03.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-ham-rong-ta-phin-ql-4d-sa-pa-rice-fields-70725.jpg",
        "caption": "Ruộng bậc thang gần Tả Phìn, Sa Pa",
        "alt": "Ruộng bậc thang gần Tả Phìn, Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ham_Rong,_Ta_Phin,_QL.4D.Sa_Pa,_rice_fields_(70725).jpg",
        "author": "JakobHosp",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "JakobHosp, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Tả Phìn, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp ruộng bậc thang gần Tả Phìn, thuộc địa bàn Sa Pa và phù hợp chủ đề nông nghiệp vùng cao."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-ham-rong-ta-phin-ql-4d-sa-pa-rice-fields-70725-480w.jpg",
            "width": 480,
            "height": 233
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-ham-rong-ta-phin-ql-4d-sa-pa-rice-fields-70725-960w.jpg",
            "width": 960,
            "height": 466
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-ham-rong-ta-phin-ql-4d-sa-pa-rice-fields-70725.jpg",
            "width": 1600,
            "height": 778
          }
        ],
        "width": 1600,
        "height": 778
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall.jpg",
        "caption": "Thác nước tại bản Cát Cát ở Sa Pa",
        "alt": "Thác nước tại bản Cát Cát ở Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:C%C3%A1t_C%C3%A1t_Village_4_-_Waterfall.jpg",
        "author": "Mickey Đại Phát",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Mickey Đại Phát, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bản Cát Cát, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh địa điểm cụ thể tại Sa Pa minh họa bối cảnh cộng đồng; seed không khẳng định Cát Cát là điểm dừng đã chốt."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall-480w.jpg",
            "width": 480,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall-960w.jpg",
            "width": 960,
            "height": 1280
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall.jpg",
            "width": 1600,
            "height": 2133
          }
        ],
        "width": 1600,
        "height": 2133
      },
      {
        "path": "image/greensteps/tours/sa-pa/file-pho-cau-may-sa-pa.jpg",
        "caption": "Phố Cầu Mây tại trung tâm Sa Pa",
        "alt": "Phố Cầu Mây tại trung tâm Sa Pa",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ph%E1%BB%91_C%E1%BA%A7u_M%C3%A2y,_Sa_Pa.jpg",
        "author": "Nguyen Hung Vu",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "Nguyen Hung Vu, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Phố Cầu Mây, Sa Pa",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh phố Cầu Mây trong trung tâm Sa Pa, bối cảnh điểm đến chứ không gán cho một hoạt động cụ thể."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/sa-pa/file-pho-cau-may-sa-pa-480w.jpg",
            "width": 480,
            "height": 270
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-pho-cau-may-sa-pa-960w.jpg",
            "width": 960,
            "height": 540
          },
          {
            "path": "image/greensteps/tours/sa-pa/file-pho-cau-may-sa-pa.jpg",
            "width": 1600,
            "height": 900
          }
        ],
        "width": 1600,
        "height": 900
      }
    ]
  },
  "demo-vn-tour-ninh-binh-1": {
    "image": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
    "gallery": [
      "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
      "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river.jpg",
      "image/greensteps/tours/ninh-binh/file-trang-an-01.jpg",
      "image/greensteps/tours/ninh-binh/file-trang-an-02.jpg",
      "image/greensteps/tours/ninh-binh/file-trang-an-03.jpg",
      "image/greensteps/tours/ninh-binh/file-trang-an-05.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
        "caption": "Một công trình mái cong bên mặt nước trong quần thể Tràng An.",
        "alt": "Ngôi nhà mái cong bên mặt nước và rừng xanh tại Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An,_Ninh_Binh.jpg",
        "author": "GieohatchoHaiLy",
        "licenseId": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "attribution": "GieohatchoHaiLy, via Wikimedia Commons, CC0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Quần thể Tràng An được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-480w.jpg",
            "width": 480,
            "height": 321
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
            "width": 1600,
            "height": 1069
          }
        ],
        "width": 1600,
        "height": 1069
      },
      {
        "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river.jpg",
        "caption": "Thuyền đi trên tuyến sông giữa các khối núi đá vôi.",
        "alt": "Thuyền trên dòng sông Tràng An giữa những vách núi đá vôi",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Vietnam,_Ninh_Binh,_Trang_An_River_2.jpg",
        "author": "Vyacheslav Argenberg",
        "licenseId": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "attribution": "Vyacheslav Argenberg, via Wikimedia Commons, CC BY 4.0",
        "subjectLocation": "Tràng An–Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Cảnh quan sông núi khu vực Tràng An–Tam Cốc; ảnh minh họa bối cảnh thay vì một điểm dừng xác định."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-trang-an-01.jpg",
        "caption": "Thuyền đi qua cửa hang trong quần thể Tràng An",
        "alt": "Thuyền đi qua cửa hang trong quần thể Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An_-_01.jpg",
        "author": "Benjamin Smith",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Benjamin Smith, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bên trong tuyến tham quan Tràng An, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-01-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-01-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-01.jpg",
            "width": 1600,
            "height": 1068
          }
        ],
        "width": 1600,
        "height": 1068
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-trang-an-02.jpg",
        "caption": "Núi đá vôi và mặt nước trong quần thể Tràng An",
        "alt": "Núi đá vôi và mặt nước trong quần thể Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An_-_02.jpg",
        "author": "Benjamin Smith",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Benjamin Smith, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảnh quan Tràng An, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-02-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-02-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-02.jpg",
            "width": 1600,
            "height": 1068
          }
        ],
        "width": 1600,
        "height": 1068
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-trang-an-03.jpg",
        "caption": "Thuyền tham quan giữa núi đá vôi ở Tràng An",
        "alt": "Thuyền tham quan giữa núi đá vôi ở Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An_-_03.jpg",
        "author": "Benjamin Smith",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Benjamin Smith, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảnh quan Tràng An, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-03-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-03-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-03.jpg",
            "width": 1600,
            "height": 1068
          }
        ],
        "width": 1600,
        "height": 1068
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-trang-an-05.jpg",
        "caption": "Núi đá vôi và đường thủy tại Tràng An",
        "alt": "Núi đá vôi và đường thủy tại Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An_-_05.jpg",
        "author": "Benjamin Smith",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Benjamin Smith, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảnh quan Tràng An, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-05-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-05-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-trang-an-05.jpg",
            "width": 1600,
            "height": 1068
          }
        ],
        "width": 1600,
        "height": 1068
      }
    ]
  },
  "demo-vn-tour-ninh-binh-2": {
    "image": "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc.jpg",
    "gallery": [
      "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc.jpg",
      "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
      "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1.jpg",
      "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-2.jpg",
      "image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1.jpg",
      "image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc.jpg",
        "caption": "Cảnh quan sông nước Tam Cốc.",
        "alt": "Dòng sông uốn giữa cảnh quan núi đá vôi ở Tam Cốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Tam_Coc.jpg",
        "author": "LigerCommon",
        "licenseId": "Public domain",
        "licenseUrl": "https://commons.wikimedia.org/wiki/Template:PD-self",
        "attribution": "LigerCommon, via Wikimedia Commons, Public domain",
        "subjectLocation": "Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Tam Cốc được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc-480w.jpg",
            "width": 480,
            "height": 600
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc-960w.jpg",
            "width": 960,
            "height": 1200
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-tam-coc.jpg",
            "width": 1024,
            "height": 1280
          }
        ],
        "width": 1024,
        "height": 1280
      },
      {
        "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
        "caption": "Một công trình mái cong bên mặt nước trong quần thể Tràng An.",
        "alt": "Ngôi nhà mái cong bên mặt nước và rừng xanh tại Tràng An",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Trang_An,_Ninh_Binh.jpg",
        "author": "GieohatchoHaiLy",
        "licenseId": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "attribution": "GieohatchoHaiLy, via Wikimedia Commons, CC0",
        "subjectLocation": "Quần thể danh thắng Tràng An, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Quần thể Tràng An được nêu trực tiếp trong hoạt động lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-480w.jpg",
            "width": 480,
            "height": 321
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an-960w.jpg",
            "width": 960,
            "height": 641
          },
          {
            "path": "image/greensteps/tours/ninh-binh/ninh-binh-trang-an.jpg",
            "width": 1600,
            "height": 1069
          }
        ],
        "width": 1600,
        "height": 1069
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1.jpg",
        "caption": "Thuyền trên dòng sông ở Tam Cốc",
        "alt": "Thuyền trên dòng sông ở Tam Cốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Barques_%C3%A0_Tam_Coc_(1).jpg",
        "author": "Ji-Elle",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Ji-Elle, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp thuyền và cảnh quan sông nước Tam Cốc, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-2.jpg",
        "caption": "Một góc khác của thuyền tham quan tại Tam Cốc",
        "alt": "Một góc khác của thuyền tham quan tại Tam Cốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Barques_%C3%A0_Tam_Coc_(2).jpg",
        "author": "Ji-Elle",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Ji-Elle, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp thuyền và cảnh quan sông nước Tam Cốc, điểm có trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-2-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-2-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-2.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1.jpg",
        "caption": "Trâu trên cánh đồng tại Tam Cốc",
        "alt": "Trâu trên cánh đồng tại Tam Cốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Buffles_%C3%A0_Tam_Coc_(1).jpg",
        "author": "Ji-Elle",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Ji-Elle, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp đồng quê Tam Cốc, khớp hoạt động quan sát cảnh quan nông thôn trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      },
      {
        "path": "image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc.jpg",
        "caption": "Vườn chuối giữa cảnh quan núi đá vôi tại Tam Cốc",
        "alt": "Vườn chuối giữa cảnh quan núi đá vôi tại Tam Cốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Bananiers_%C3%A0_Tam_Coc.jpg",
        "author": "Ji-Elle",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Ji-Elle, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Tam Cốc, Ninh Bình",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảnh quan nông thôn Tam Cốc, khớp chủ đề đi bộ hoặc đạp xe đường làng."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc-480w.jpg",
            "width": 480,
            "height": 320
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc-960w.jpg",
            "width": 960,
            "height": 640
          },
          {
            "path": "image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc.jpg",
            "width": 1600,
            "height": 1067
          }
        ],
        "width": 1600,
        "height": 1067
      }
    ]
  },
  "demo-vn-tour-phu-quoc-1": {
    "image": "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao.jpg",
    "gallery": [
      "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao.jpg",
      "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
      "image/greensteps/tours/phu-quoc/file-bai-truong-long-beach-phu-quoc-vietnam-3859473907.jpg",
      "image/greensteps/tours/phu-quoc/file-bai-kem-dong-khach-1.jpg",
      "image/greensteps/tours/phu-quoc/file-con-suoi-1.jpg",
      "image/greensteps/tours/phu-quoc/file-con-suoi-2.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao.jpg",
        "caption": "Bãi Sao trên đảo Phú Quốc.",
        "alt": "Bãi cát và nước biển tại Bãi Sao, Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:B%C3%A3i_Sao_Beach.jpg",
        "author": "Prince Roy",
        "licenseId": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "attribution": "Prince Roy, via Wikimedia Commons, CC BY 2.0",
        "subjectLocation": "Bãi Sao, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Bãi Sao thuộc Phú Quốc nhưng không được nêu là điểm dừng trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-bai-sao.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
        "caption": "Bờ biển trên đảo Phú Quốc.",
        "alt": "Bãi cát và biển xanh ở Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Phu_Quoc_Beach.jpg",
        "author": "FrogsLegs71",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "FrogsLegs71, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Bãi biển trên đảo Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh bối cảnh bờ biển Phú Quốc; không xác định bãi biển cụ thể trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-bai-truong-long-beach-phu-quoc-vietnam-3859473907.jpg",
        "caption": "Bờ cát và mặt biển tại Bãi Trường, Phú Quốc",
        "alt": "Bờ cát và mặt biển tại Bãi Trường, Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Bai_Truong_(Long_Beach)_Ph%C3%BA_Qu%E1%BB%91c,_Vietnam_(3859473907).jpg",
        "author": "Dan Searle from London, England",
        "licenseId": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "attribution": "Dan Searle from London, England, via Wikimedia Commons, CC BY-SA 2.0",
        "subjectLocation": "Bãi Trường, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bãi biển trên đảo Phú Quốc, phù hợp hoạt động quan sát biển đảo."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-truong-long-beach-phu-quoc-vietnam-3859473907-480w.jpg",
            "width": 480,
            "height": 730
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-truong-long-beach-phu-quoc-vietnam-3859473907-960w.jpg",
            "width": 960,
            "height": 1461
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-truong-long-beach-phu-quoc-vietnam-3859473907.jpg",
            "width": 1600,
            "height": 2435
          }
        ],
        "width": 1600,
        "height": 2435
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-bai-kem-dong-khach-1.jpg",
        "caption": "Bãi biển Bãi Khem tại Phú Quốc",
        "alt": "Bãi biển Bãi Khem tại Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Bai-kem-dong-khach-1.jpg",
        "author": "Vivu Vietnam",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Vivu Vietnam, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Bãi Khem, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp bãi Khem trên đảo Phú Quốc, phù hợp chủ đề cảnh quan biển đảo."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-kem-dong-khach-1-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-kem-dong-khach-1-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-bai-kem-dong-khach-1.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-con-suoi-1.jpg",
        "caption": "Dòng suối trong một khu rừng ở Phú Quốc",
        "alt": "Dòng suối trong một khu rừng ở Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Con_suoi_1.jpg",
        "author": "Nguyenhai314",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Nguyenhai314, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Suối trong rừng Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh chụp suối trong rừng Phú Quốc, minh họa chủ đề sinh thái đảo mà không gán cho khu bảo tồn cụ thể."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-1-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-1-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-1.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-con-suoi-2.jpg",
        "caption": "Một góc khác của dòng suối trong rừng Phú Quốc",
        "alt": "Một góc khác của dòng suối trong rừng Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Con_suoi_2.jpg",
        "author": "Nguyenhai314",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Nguyenhai314, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Suối trong rừng Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh chụp suối trong rừng Phú Quốc, minh họa chủ đề sinh thái đảo mà không gán cho khu bảo tồn cụ thể."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-2-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-2-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-con-suoi-2.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      }
    ]
  },
  "demo-vn-tour-phu-quoc-2": {
    "image": "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007.jpg",
    "gallery": [
      "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007.jpg",
      "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
      "image/greensteps/tours/phu-quoc/file-an-thoi-fishing-harbour-sunset-town-sun-world-phu-quoc-vietnam.jpg",
      "image/greensteps/tours/phu-quoc/file-cau-tau-duong-ong-phu-quoc-kien-giang-panoramio.jpg",
      "image/greensteps/tours/phu-quoc/file-cho-em-phu-quoc-duong-dong-vietnam-panoramio.jpg",
      "image/greensteps/tours/phu-quoc/file-rough-road-at-north-east-of-phu-quoc.jpg"
    ],
    "photoMetadata": [
      {
        "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007.jpg",
        "caption": "Bãi biển trên đảo Phú Quốc, ảnh chụp năm 2007.",
        "alt": "Bờ biển Phú Quốc với sóng nhẹ",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Strand_Phu_Quoc.jpg",
        "author": "Dirk Erdweg",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "attribution": "Dirk Erdweg, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Bãi biển Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh bối cảnh bờ biển Phú Quốc; không xác định bãi biển cụ thể trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-2007.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
        "caption": "Bờ biển trên đảo Phú Quốc.",
        "alt": "Bãi cát và biển xanh ở Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Phu_Quoc_Beach.jpg",
        "author": "FrogsLegs71",
        "licenseId": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
        "attribution": "FrogsLegs71, via Wikimedia Commons, CC BY-SA 3.0",
        "subjectLocation": "Bãi biển trên đảo Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh bối cảnh bờ biển Phú Quốc; không xác định bãi biển cụ thể trong lịch trình."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-480w.jpg",
            "width": 480,
            "height": 360
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach-960w.jpg",
            "width": 960,
            "height": 720
          },
          {
            "path": "image/greensteps/tours/phu-quoc/phu-quoc-beach.jpg",
            "width": 1600,
            "height": 1200
          }
        ],
        "width": 1600,
        "height": 1200
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-an-thoi-fishing-harbour-sunset-town-sun-world-phu-quoc-vietnam.jpg",
        "caption": "Thuyền tại cảng cá An Thới trên đảo Phú Quốc",
        "alt": "Thuyền tại cảng cá An Thới trên đảo Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:An_Thoi_fishing_harbour_Sunset_Town_Sun_World_Phu_Quoc_Vietnam.jpg",
        "author": "Vivu Vietnam",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Vivu Vietnam, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Cảng cá An Thới, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cảng cá An Thới, phù hợp chủ đề cộng đồng và sinh kế địa phương."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-an-thoi-fishing-harbour-sunset-town-sun-world-phu-quoc-vietnam-480w.jpg",
            "width": 480,
            "height": 270
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-an-thoi-fishing-harbour-sunset-town-sun-world-phu-quoc-vietnam-960w.jpg",
            "width": 960,
            "height": 540
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-an-thoi-fishing-harbour-sunset-town-sun-world-phu-quoc-vietnam.jpg",
            "width": 1600,
            "height": 899
          }
        ],
        "width": 1600,
        "height": 899
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-cau-tau-duong-ong-phu-quoc-kien-giang-panoramio.jpg",
        "caption": "Cầu tàu tại Dương Đông, Phú Quốc",
        "alt": "Cầu tàu tại Dương Đông, Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:C%E1%BA%A7u_T%C3%A0u,_d%C6%B0%C6%A1ng_%C4%90%C3%B4ng_,_Ph%C3%BA_Qu%E1%BB%91c,_Ki%C3%AAn_Giang_-_panoramio.jpg",
        "author": "trungydang",
        "licenseId": "CC BY 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
        "attribution": "trungydang, via Wikimedia Commons, CC BY 3.0",
        "subjectLocation": "Cầu tàu Dương Đông, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "exact_landmark",
          "explanation": "Ảnh chụp cầu tàu Dương Đông, phù hợp chủ đề bờ biển và cộng đồng địa phương."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-cau-tau-duong-ong-phu-quoc-kien-giang-panoramio-480w.jpg",
            "width": 480,
            "height": 222
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-cau-tau-duong-ong-phu-quoc-kien-giang-panoramio-960w.jpg",
            "width": 960,
            "height": 445
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-cau-tau-duong-ong-phu-quoc-kien-giang-panoramio.jpg",
            "width": 1600,
            "height": 742
          }
        ],
        "width": 1600,
        "height": 742
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-cho-em-phu-quoc-duong-dong-vietnam-panoramio.jpg",
        "caption": "Một góc chợ đêm Dương Đông trên đảo Phú Quốc",
        "alt": "Một góc chợ đêm Dương Đông trên đảo Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Ch%E1%BB%A3_%C4%90%C3%AAm_Ph%C3%BA_qu%E1%BB%91c,_Duong_Dong_Vietnam_-_panoramio.jpg",
        "author": "trungydang",
        "licenseId": "CC BY 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
        "attribution": "trungydang, via Wikimedia Commons, CC BY 3.0",
        "subjectLocation": "Chợ đêm Dương Đông, Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh chụp chợ đêm Dương Đông, bối cảnh văn hóa ẩm thực địa phương."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-cho-em-phu-quoc-duong-dong-vietnam-panoramio-480w.jpg",
            "width": 480,
            "height": 330
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-cho-em-phu-quoc-duong-dong-vietnam-panoramio-960w.jpg",
            "width": 960,
            "height": 660
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-cho-em-phu-quoc-duong-dong-vietnam-panoramio.jpg",
            "width": 1600,
            "height": 1101
          }
        ],
        "width": 1600,
        "height": 1101
      },
      {
        "path": "image/greensteps/tours/phu-quoc/file-rough-road-at-north-east-of-phu-quoc.jpg",
        "caption": "Đường rừng ở phía đông bắc đảo Phú Quốc",
        "alt": "Đường rừng ở phía đông bắc đảo Phú Quốc",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Rough_road_at_north-east_of_Phu_Quoc.JPG",
        "author": "Tonbi ko",
        "licenseId": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution": "Tonbi ko, via Wikimedia Commons, CC BY-SA 4.0",
        "subjectLocation": "Đường rừng phía đông bắc đảo Phú Quốc",
        "verificationStatus": "verified",
        "verifiedOn": "2026-11-12",
        "relevance": {
          "type": "destination_context",
          "explanation": "Ảnh chụp tuyến đường trong vùng rừng phía đông bắc Phú Quốc, minh họa chủ đề sinh thái; không xác nhận tuyến tham quan."
        },
        "modifications": "Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.",
        "responsiveVariants": [
          {
            "path": "image/greensteps/tours/phu-quoc/file-rough-road-at-north-east-of-phu-quoc-480w.jpg",
            "width": 480,
            "height": 324
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-rough-road-at-north-east-of-phu-quoc-960w.jpg",
            "width": 960,
            "height": 647
          },
          {
            "path": "image/greensteps/tours/phu-quoc/file-rough-road-at-north-east-of-phu-quoc.jpg",
            "width": 1600,
            "height": 1078
          }
        ],
        "width": 1600,
        "height": 1078
      }
    ]
  }
};
