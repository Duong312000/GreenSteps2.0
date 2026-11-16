export interface Founder {
  name: string;
  initials: string;
  position: string;
  role: string;
  portrait: string | null;
}

export interface StoryMilestone {
  id: string;
  date: string; // ISO day or month; preserve the precision supplied by the owner.
  dateLabel: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  source: string;
}

// Names and roles supplied by the project owner. Do not infer identities from photos.
// Optimized from backend/images/greensteps/founders into public/image/founders.
// Expected filenames for the owner-supplied portraits. Missing files fall back
// to initials without substituting stock people or generated identities.
export const ABOUT_FOUNDERS: readonly Founder[] = [
  {
    name: 'Kiên Lê',
    initials: 'KL',
    position: 'CEO',
    role: 'Giám đốc điều hành',
    portrait: 'image/founders/kien-le.jpg',
  },
  {
    name: 'Linh Ngô',
    initials: 'LN',
    position: 'CTO',
    role: 'Giám đốc Công nghệ',
    portrait: 'image/founders/linh-ngo.jpg',
  },
  {
    name: 'Dương Hoàng',
    initials: 'DH',
    position: 'COO',
    role: 'Giám đốc Vận hành',
    portrait: 'image/founders/duong-hoang.jpg',
  },
  {
    name: 'Cao Phú',
    initials: 'CP',
    position: 'CSO',
    role: 'Giám đốc Phát triển Bền vững',
    portrait: 'image/founders/cao-phu.jpg',
  },
  {
    name: 'Thùy Anh',
    initials: 'TA',
    position: 'CMO',
    role: 'Giám đốc Marketing',
    portrait: 'image/founders/thuy-anh.jpg',
  },
  {
    name: 'Thanh Tran Duy',
    initials: 'TD',
    position: '',
    role: 'Cố vấn chuyên môn',
    portrait: 'image/founders/thanh-tran-duy.jpg',
  },
];

// Official history supplied by the project owner on 2026-11-13.
// Photos illustrate each topic; they are not documentary evidence of the events.
export const ABOUT_MILESTONES: readonly StoryMilestone[] = [
  {
    id: 'green-idea',
    date: '2026-06-05',
    dateLabel: '05/06/2026',
    title: 'Khởi nguồn từ một ý tưởng xanh',
    description:
      'Từ mong muốn mang đến những trải nghiệm du lịch ý nghĩa và thân thiện hơn với môi trường, ý tưởng về GreenSteps Travel lần đầu được nhen nhóm. Một nền tảng du lịch kết nối khám phá, công nghệ và trách nhiệm với thiên nhiên bắt đầu hình thành.',
    image: 'media/about/hero-poster.jpg',
    imageAlt: 'Ruộng bậc thang Việt Nam, minh họa cảm hứng từ thiên nhiên',
    source: 'Lịch sử chính thức do chủ dự án cung cấp ngày 13/11/2026',
  },
  {
    id: 'building-together',
    date: '2026-06-07',
    dateLabel: '07/06/2026',
    title: 'Khi tầm nhìn trở thành hành động',
    description:
      'Những người sáng lập cùng thống nhất tầm nhìn và chính thức bắt tay xây dựng GreenSteps Travel. Từ những bản phác thảo đầu tiên, nền móng của một nền tảng du lịch xanh, thông minh và lấy trải nghiệm người dùng làm trung tâm dần được định hình.',
    image: 'media/about/travel-planning.jpg',
    imageAlt: 'Bản đồ và điện thoại, ảnh minh họa quá trình lên ý tưởng hành trình',
    source: 'Lịch sử chính thức do chủ dự án cung cấp ngày 13/11/2026',
  },
  {
    id: 'first-release',
    date: '2026-09-09',
    dateLabel: '09/09/2026',
    title: 'GreenSteps chính thức bước ra thế giới',
    description:
      'Phiên bản thử nghiệm đầu tiên của GreenSteps Travel được giới thiệu ra thị trường, đánh dấu bước chuyển mình từ ý tưởng thành sản phẩm thực tế. Đây cũng là khởi đầu cho hành trình lắng nghe, kết nối và hoàn thiện trải nghiệm dành cho du khách.',
    image: 'media/about/story-home.jpg',
    imageAlt: 'Giao diện trang chủ GreenSteps Travel hiện tại',
    source: 'Lịch sử chính thức do chủ dự án cung cấp ngày 13/11/2026; ảnh chụp sản phẩm hiện tại',
  },
  {
    id: 'listening-and-improving',
    date: '2026-10-09',
    dateLabel: '09/10/2026',
    title: 'Lắng nghe để không ngừng hoàn thiện',
    description:
      'Từ những phản hồi và dữ liệu thu thập được trong quá trình thử nghiệm, GreenSteps bước vào giai đoạn nâng cấp toàn diện. Mỗi cải tiến đều hướng đến việc tạo ra hành trình thuận tiện, đáng tin cậy và phù hợp hơn với nhu cầu của người dùng.',
    image: 'media/about/story-planner.jpg',
    imageAlt: 'Giao diện AI Planner trên website GreenSteps Travel hiện tại',
    source: 'Lịch sử chính thức do chủ dự án cung cấp ngày 13/11/2026; ảnh chụp sản phẩm hiện tại',
  },
  {
    id: 'a-new-journey',
    date: '2026-11',
    dateLabel: '11/2026',
    title: 'Một hành trình mới chính thức bắt đầu',
    description:
      'GreenSteps Travel hoàn thiện nền tảng website, đánh dấu cột mốc quan trọng trong hành trình phát triển. Với những trải nghiệm ngày càng được nâng cao, GreenSteps sẵn sàng đồng hành cùng du khách khám phá Việt Nam theo cách thông minh, ý nghĩa và bền vững hơn.',
    image: 'media/about/journey.jpg',
    imageAlt: 'Du khách khám phá thiên nhiên Việt Nam bằng thuyền, ảnh minh họa hành trình xanh',
    source: 'Lịch sử chính thức do chủ dự án cung cấp ngày 13/11/2026',
  },
];

export const ABOUT_VALUES = [
  {
    title: 'Xanh bền vững',
    description: 'Ưu tiên trải nghiệm giảm tác động đến thiên nhiên.',
    image: 'media/about/hero-poster.jpg',
    alt: 'Ruộng bậc thang giữa núi rừng Việt Nam',
  },
  {
    title: 'Kết nối cộng đồng',
    description: 'Đồng hành cùng người dân và văn hóa địa phương.',
    image: 'media/about/community.jpg',
    alt: 'Nụ cười của người bán hàng tại một khu chợ Việt Nam',
  },
  {
    title: 'Công nghệ vì môi trường',
    description: 'Ứng dụng công nghệ để lên kế hoạch thông minh hơn.',
    image: 'media/about/travel-planning.jpg',
    alt: 'Điện thoại và bản đồ dùng để lên kế hoạch hành trình',
  },
  {
    title: 'Minh bạch và trách nhiệm',
    description: 'Cung cấp thông tin rõ ràng cho mỗi hành trình.',
    image: 'media/about/journey.jpg',
    alt: 'Du khách khám phá cảnh quan đá vôi Việt Nam bằng thuyền',
  },
];
