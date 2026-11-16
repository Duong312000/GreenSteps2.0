import { TourPhotoCredit } from '../../models/models';
import { DEMO_TOUR_PHOTO_DATA } from '../../data/demo-tour-photo-data';

export interface HomeDestinationCard {
  key: string;
  dest: string;
  label: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  photo: TourPhotoCredit;
}

function tourPhoto(tourId: string, index = 0): TourPhotoCredit {
  const photo = DEMO_TOUR_PHOTO_DATA[tourId]?.photoMetadata[index];
  if (!photo) throw new Error(`Missing destination cover photo for ${tourId} (${index}).`);
  return photo;
}

const haGiangPhoto: TourPhotoCredit = {
  path: 'image/greensteps/ha-giang/tu-san-canyon.jpg',
  caption: 'Hẻm Tu Sản và sông Nho Quế nhìn từ đỉnh đèo Mã Pí Lèng.',
  alt: 'Sông Nho Quế uốn qua hẻm Tu Sản dưới đèo Mã Pí Lèng, Hà Giang',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:TuSan_Canyon.jpg',
  author: 'NKSTTSSHNVN',
  licenseId: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  attribution: 'NKSTTSSHNVN, via Wikimedia Commons, CC BY-SA 4.0',
  subjectLocation: 'Hẻm Tu Sản, Hà Giang',
  verificationStatus: 'verified',
  relevance: { type: 'exact_landmark', explanation: 'Ảnh mô tả hẻm Tu Sản và sông Nho Quế tại Hà Giang.' },
  verifiedOn: '2026-11-12',
  modifications: 'Ảnh JPEG đã tối ưu kích thước và có các biến thể responsive.'
};

function card(key: string, dest: string, subtitle: string, photo: TourPhotoCredit): HomeDestinationCard {
  return { key, dest, label: dest, title: dest, subtitle, image: photo.path, imageAlt: photo.alt, photo };
}

export const HOME_DESTINATION_CARDS: HomeDestinationCard[] = [
  card('dalat', 'Đà Lạt', 'Hồ Xuân Hương và thành phố ngàn hoa', tourPhoto('demo-vn-tour-dalat-1')),
  card('da-nang-hoi-an', 'Đà Nẵng – Hội An', 'Di sản ven sông, biển xanh và phố cổ', tourPhoto('demo-vn-tour-da-nang-hoi-an-1', 0)),
  card('ninh-binh', 'Ninh Bình', 'Non nước Tràng An giữa núi đá vôi', tourPhoto('demo-vn-tour-ninh-binh-1')),
  card('phu-quoc', 'Phú Quốc', 'Bãi Sao và sắc xanh đảo ngọc', tourPhoto('demo-vn-tour-phu-quoc-1')),
  card('phu-yen', 'Phú Yên', 'Gành Đá Đĩa bên bờ biển miền Trung', tourPhoto('demo-vn-tour-phu-yen-1')),
  card('sa-pa', 'Sa Pa', 'Ruộng bậc thang bên dãy Hoàng Liên Sơn', tourPhoto('demo-vn-tour-sa-pa-1')),
  card('ha-giang', 'Hà Giang', 'Hẻm Tu Sản và dòng Nho Quế', haGiangPhoto),
  card('da-nang', 'Đà Nẵng', 'Bán đảo Sơn Trà nhìn ra biển', tourPhoto('demo-vn-tour-da-nang-hoi-an-1', 1)),
  card('hoi-an', 'Hội An', 'Phố cổ lên đèn bên sông Hoài', tourPhoto('demo-vn-tour-da-nang-hoi-an-1', 2))
];
