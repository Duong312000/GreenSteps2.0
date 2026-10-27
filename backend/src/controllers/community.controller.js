const { randomUUID } = require('node:crypto');
const { Op } = require('../db/mongo-store');
const {
  User, CommunityPost, CommentPost, Notification, SavedCommunityItem,
  CommunityChallenge, CommunityChallengeEntry, Wallet, Badge, BadgeUser
} = require('../models');

const challengeIdeas = [
  { title: 'Mang bình nước cá nhân', description: 'Mang bình nước dùng lại được trong chuyến đi và chia sẻ một lần bạn tránh được chai nhựa dùng một lần.', hashtag: 'GreenStepsChallenge', image: 'image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg' },
  { title: 'Ưu tiên di chuyển xanh', description: 'Thử đi bộ, xe đạp hoặc phương tiện công cộng cho một chặng phù hợp trong hành trình.', hashtag: 'DiChuyenXanh', image: 'image/greensteps/da-nang-hoi-an/hoi-an-pho-co-xe-dap-01.jpg' },
  { title: 'Ủng hộ điểm đến địa phương', description: 'Ghé một cơ sở địa phương và chia sẻ trải nghiệm tích cực, có trách nhiệm với cộng đồng bản địa.', hashtag: 'UngHoDiaPhuong', image: 'image/greensteps/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg' },
  { title: 'Để thiên nhiên sạch hơn', description: 'Gom và phân loại rác đúng nơi trong chuyến đi; không làm ảnh hưởng sinh cảnh tự nhiên.', hashtag: 'DuLichKhongRac', image: 'image/greensteps/phu-yen/phu-yen-bien-trong-01.jpg' }
];

const cleanHashtags = value => {
  const items = Array.isArray(value) ? value : String(value || '').match(/#[\p{L}\p{N}_]+/gu) || [];
  return [...new Set(items.map(item => String(item).replace(/^#/, '').trim().replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40)).filter(Boolean))].slice(0, 12);
};

const safeMediaUrl = value => typeof value === 'string' && (value.startsWith('/uploads/') || value.startsWith('image/') || /^https:\/\//i.test(value));
const validUser = req => req.user?.id;
const userAvatar = user => user?.avatarUrl || user?.fullname?.slice(0, 1)?.toUpperCase() || 'G';

function isoWeek(value = new Date()) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil((((date - yearStart) / 86400000) + 1) / 7) };
}

async function getCurrentChallenge() {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const endsAt = new Date(startsAt.getTime() + 7 * 86400000);
  const { year, week } = isoWeek(now);
  const id = `greensteps-${year}-W${String(week).padStart(2, '0')}`;
  const idea = challengeIdeas[week % challengeIdeas.length];
  const [challenge] = await CommunityChallenge.findOrCreate({
    where: { id },
    defaults: { id, ...idea, points: 100, badge_name: 'Thành viên thử thách xanh', image_url: idea.image, starts_at: startsAt, ends_at: endsAt }
  });
  return challenge;
}

function formatPost(row, user, isSaved = false) {
  return {
    id: row.id,
    authorId: row.user_id,
    author: user?.fullname || user?.username || 'Thành viên GreenSteps',
    avatar: userAvatar(user),
    time: row.createdAt,
    postType: row.post_type || 'post',
    text: row.text || '',
    tripName: row.tour_name || '',
    dest: row.destination || '',
    location: row.location || row.destination || '',
    days: row.days || 0,
    rating: row.rating || 0,
    likes: row.likes_count || 0,
    comments: row.comments_count || 0,
    shares: row.shares_count || 0,
    saves: row.saved_count || 0,
    image: row.image_url || (row.image_urls || [])[0] || '',
    images: row.image_urls || (row.image_url ? [row.image_url] : []),
    videoUrl: row.video_url || '',
    hashtags: row.hashtags || [],
    itinerary_id: row.itinerary_id || null,
    challengeId: row.challenge_id || null,
    isSaved,
    current_data: row.current_data || {}
  };
}

// Existing community documents predate post_type. Normalize them before writes
// so model validation accepts legacy posts without requiring a data reset.
function normalizeLegacyPost(post) {
  if (!post.post_type) post.post_type = 'post';
  if (!Array.isArray(post.hashtags)) post.hashtags = [];
  if (!Array.isArray(post.image_urls)) post.image_urls = post.image_url ? [post.image_url] : [];
  if (typeof post.likes_count !== 'number') post.likes_count = 0;
  if (typeof post.comments_count !== 'number') post.comments_count = 0;
  if (typeof post.shares_count !== 'number') post.shares_count = 0;
  if (typeof post.saved_count !== 'number') post.saved_count = 0;
  return post;
}

exports.getPosts = async (req, res, next) => {
  try {
    const page = Math.max(0, Number.parseInt(req.query.page, 10) || 0);
    const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const type = ['post', 'reel', 'question'].includes(req.query.type) ? req.query.type : null;
    const search = String(req.query.q || '').trim().slice(0, 100);
    const where = {};
    if (type) where.post_type = type;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      where[Op.or] = [
        { text: { [Op.iLike]: `%${escaped}%` } },
        { destination: { [Op.iLike]: `%${escaped}%` } },
        { location: { [Op.iLike]: `%${escaped}%` } },
        { hashtags: { [Op.iLike]: `%${escaped.replace(/^#/, '')}%` } }
      ];
    }
    const rows = await CommunityPost.findAll({ where, include: [{ model: User, required: false }], order: [['createdAt', 'DESC']], limit, offset: page * limit });
    const userId = validUser(req);
    const savedIds = userId ? new Set((await SavedCommunityItem.findAll({ where: { user_id: userId, item_type: 'post' } })).map(item => item.item_id)) : new Set();
    res.json(rows.map(row => formatPost(row, row.User, savedIds.has(row.id))));
  } catch (error) { next(error); }
};

exports.addPost = async (req, res, next) => {
  try {
    const userId = validUser(req);
    const type = ['post', 'reel', 'question'].includes(req.body.postType) ? req.body.postType : 'post';
    const text = String(req.body.text || '').trim();
    const location = String(req.body.location || req.body.dest || '').trim().slice(0, 160);
    const images = [...new Set((Array.isArray(req.body.images) ? req.body.images : req.body.image ? [req.body.image] : []).filter(safeMediaUrl))].slice(0, 8);
    const videoUrl = safeMediaUrl(req.body.videoUrl) ? req.body.videoUrl : '';
    if (!text || text.length > 5000) return res.status(400).json({ success: false, message: 'Nội dung cần từ 1 đến 5.000 ký tự.' });
    if (type === 'reel' && !videoUrl) return res.status(400).json({ success: false, message: 'Thước phim cần có video đã tải lên.' });
    if (type !== 'reel' && videoUrl) return res.status(400).json({ success: false, message: 'Video chỉ được đăng trong Thước phim.' });
    const submittedTags = Array.isArray(req.body.hashtags) ? req.body.hashtags : cleanHashtags(req.body.hashtags);
    const hashtags = cleanHashtags([...submittedTags, ...cleanHashtags(text)]);
    const itineraryId = typeof req.body.itineraryId === 'string' ? req.body.itineraryId.slice(0, 120) : '';
    let itinerary = null;
    if (itineraryId) {
      const { ScheduleCustom, Schedule, UserSchedule } = require('../models');
      const custom = await ScheduleCustom.findByPk(itineraryId);
      const link = await UserSchedule.findOne({ where: { schedule_id: itineraryId, user_id: userId } });
      if (!custom || (custom.user_id !== userId && !link)) return res.status(403).json({ success: false, message: 'Chỉ có thể chia sẻ lịch trình trong tài khoản của bạn.' });
      itinerary = await Schedule.findByPk(itineraryId);
    }
    let challenge = null;
    if (req.body.challengeId) {
      challenge = await getCurrentChallenge();
      if (challenge.id !== req.body.challengeId || !hashtags.some(tag => tag.toLowerCase() === challenge.hashtag.toLowerCase()) || (!images.length && !videoUrl)) {
        return res.status(400).json({ success: false, message: `Bài tham gia cần ảnh/video và hashtag #${challenge.hashtag} của thử thách tuần này.` });
      }
      const entryId = `${challenge.id}:${userId}`;
      if (await CommunityChallengeEntry.findByPk(entryId)) return res.status(409).json({ success: false, message: 'Bạn đã hoàn thành thử thách tuần này rồi.' });
    }
    const id = `post_${randomUUID()}`;
    const post = await CommunityPost.create({
      id, user_id: userId, post_type: type, rating: Math.max(1, Math.min(5, Number(req.body.rating) || 5)), text,
      tour_name: itinerary?.tour_name || String(req.body.tripName || '').slice(0, 160),
      destination: itinerary?.destination || location, location, days: itinerary?.days || Math.max(0, Number(req.body.days) || 0),
      hashtags, image_urls: images, image_url: images[0] || null, video_url: videoUrl || null,
      itinerary_id: itineraryId || null, challenge_id: challenge?.id || null,
      likes_count: 0, comments_count: 0, shares_count: 0
    });
    if (challenge) await awardChallenge(challenge, userId, id);
    const user = await User.findByPk(userId);
    res.status(201).json({ success: true, post: formatPost(post, user), challenge: challenge ? { points: challenge.points, badge: challenge.badge_name } : null });
  } catch (error) { next(error); }
};

async function awardChallenge(challenge, userId, postId) {
  const entryId = `${challenge.id}:${userId}`;
  if (await CommunityChallengeEntry.findByPk(entryId)) return false;
  await CommunityChallengeEntry.create({ id: entryId, challenge_id: challenge.id, user_id: userId, post_id: postId, points: challenge.points });
  let wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (wallet) {
    wallet.green_points = (wallet.green_points || 0) + challenge.points;
    await wallet.save();
  } else {
    await Wallet.create({ id: `EW${randomUUID()}`, user_id: userId, balance: 0, registered: false, green_points: challenge.points });
  }
  const badge = await Badge.findByPk(challenge.badge_name);
  if (!badge) await Badge.create({ id: challenge.badge_name, badges_description: 'Đã hoàn thành thử thách xanh hằng tuần.', foruserortour: 0 });
  const badgeLink = await BadgeUser.findOne({ where: { user_id: userId, badge_name: challenge.badge_name } });
  if (!badgeLink) await BadgeUser.create({ user_id: userId, badge_name: challenge.badge_name });
  return true;
}

exports.updatePost = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    if (post.user_id !== validUser(req)) return res.status(403).json({ success: false, message: 'Bạn chỉ có thể sửa bài viết của mình.' });
    normalizeLegacyPost(post);
    if (typeof req.body.text === 'string') {
      const text = req.body.text.trim();
      if (!text || text.length > 5000) return res.status(400).json({ success: false, message: 'Nội dung cần từ 1 đến 5.000 ký tự.' });
      post.text = text;
      const submittedTags = Array.isArray(req.body.hashtags) ? req.body.hashtags : cleanHashtags(req.body.hashtags);
      post.hashtags = cleanHashtags([...submittedTags, ...cleanHashtags(text)]);
    }
    if (typeof req.body.location === 'string') post.location = req.body.location.trim().slice(0, 160);
    if (Array.isArray(req.body.images)) {
      post.image_urls = [...new Set(req.body.images.filter(safeMediaUrl))].slice(0, 8);
      post.image_url = post.image_urls[0] || null;
    }
    await post.save();
    res.json({ success: true, post: formatPost(post, await User.findByPk(post.user_id)) });
  } catch (error) { next(error); }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    if (post.user_id !== validUser(req)) return res.status(403).json({ success: false, message: 'Bạn chỉ có thể xóa bài viết của mình.' });
    await post.destroy();
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.likePost = (req, res, next) => changeLikes(req, res, next, 1);
exports.unlikePost = (req, res, next) => changeLikes(req, res, next, -1);
async function changeLikes(req, res, next, delta) {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    normalizeLegacyPost(post);
    post.likes_count = Math.max(0, (post.likes_count || 0) + delta);
    await post.save();
    res.json({ success: true, likes: post.likes_count });
  } catch (error) { next(error); }
}

exports.sharePost = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    normalizeLegacyPost(post);
    post.shares_count = (post.shares_count || 0) + 1;
    await post.save();
    res.json({ success: true, shares: post.shares_count });
  } catch (error) { next(error); }
};

exports.savePost = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    normalizeLegacyPost(post);
    const id = `post:${req.user.id}:${post.id}`;
    const existing = await SavedCommunityItem.findByPk(id);
    if (existing) {
      await existing.destroy();
      post.saved_count = Math.max(0, (post.saved_count || 0) - 1);
      await post.save();
      return res.json({ success: true, saved: false });
    }
    await SavedCommunityItem.create({ id, user_id: req.user.id, item_type: 'post', item_id: post.id });
    post.saved_count = (post.saved_count || 0) + 1;
    await post.save();
    res.json({ success: true, saved: true });
  } catch (error) { next(error); }
};

exports.getSavedItems = async (req, res, next) => {
  try {
    const items = await SavedCommunityItem.findAll({ where: { user_id: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json(items.map(item => ({ id: item.id, type: item.item_type, itemId: item.item_id, sourcePostId: item.source_post_id || null })));
  } catch (error) { next(error); }
};

exports.addPostComment = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    const text = String(req.body.text || '').trim();
    if (!text || text.length > 2000) return res.status(400).json({ success: false, message: 'Bình luận cần từ 1 đến 2.000 ký tự.' });
    const parentId = req.body.parentCommentId || null;
    if (parentId) {
      const parent = await CommentPost.findByPk(parentId);
      if (!parent || parent.post_id !== post.id) return res.status(400).json({ success: false, message: 'Bình luận trả lời không hợp lệ.' });
    }
    const userId = req.user.id;
    const comment = await CommentPost.create({ id: `comment_${randomUUID()}`, user_id: userId, post_id: post.id, text, parent_comment_id: parentId, rating: null, helpful_count: 0, helpful_by: [], is_helpful: false });
    post.comments_count = (post.comments_count || 0) + 1;
    await post.save();
    const user = await User.findByPk(userId);
    if (post.user_id && post.user_id !== userId) {
      await Notification.create({ id: `notif_${randomUUID()}`, user_id: post.user_id, title: post.post_type === 'question' ? 'Câu hỏi có câu trả lời' : 'Bình luận mới', message: `${user?.fullname || 'Một thành viên'} đã phản hồi bài viết của bạn.`, type: 'community', read: false });
    }
    res.status(201).json({ success: true, comment: formatComment(comment, user) });
  } catch (error) { next(error); }
};

function formatComment(comment, user) {
  return { id: comment.id, postId: comment.post_id, text: comment.text, parentCommentId: comment.parent_comment_id || null, createdAt: comment.createdAt, helpfulCount: comment.helpful_count || 0, isHelpful: comment.is_helpful || false, user: { id: user?.id, fullname: user?.fullname || user?.username || 'Thành viên', avatar: userAvatar(user) }, replies: [] };
}

exports.getPostComments = async (req, res, next) => {
  try {
    const comments = await CommentPost.findAll({ where: { post_id: req.params.id }, order: [['createdAt', 'ASC']] });
    const populated = await Promise.all(comments.map(async comment => formatComment(comment, await User.findByPk(comment.user_id))));
    const byId = new Map(populated.map(comment => [comment.id, comment]));
    const tree = [];
    for (const comment of populated) {
      const parentId = comment.parentCommentId;
      if (parentId && byId.has(parentId)) byId.get(parentId).replies.push(comment);
      else tree.push(comment);
    }
    tree.sort((a, b) => Number(b.isHelpful) - Number(a.isHelpful) || b.helpfulCount - a.helpfulCount);
    res.json(tree);
  } catch (error) { next(error); }
};

exports.markHelpful = async (req, res, next) => {
  try {
    const comment = await CommentPost.findByPk(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Không tìm thấy câu trả lời.' });
    const post = await CommunityPost.findByPk(comment.post_id);
    if (!post || post.post_type !== 'question') return res.status(400).json({ success: false, message: 'Chỉ câu trả lời trong mục Hỏi đáp mới được đánh dấu hữu ích.' });
    const userId = req.user.id;
    const helpfulBy = Array.isArray(comment.helpful_by) ? comment.helpful_by : [];
    const index = helpfulBy.indexOf(userId);
    if (index >= 0) helpfulBy.splice(index, 1); else helpfulBy.push(userId);
    comment.helpful_by = helpfulBy;
    comment.helpful_count = helpfulBy.length;
    comment.is_helpful = helpfulBy.length > 0;
    await comment.save();
    res.json({ success: true, helpful: index < 0, helpfulCount: comment.helpful_count });
  } catch (error) { next(error); }
};

exports.getCurrentChallenge = async (req, res, next) => {
  try {
    const challenge = await getCurrentChallenge();
    const entries = await CommunityChallengeEntry.findAll({ where: { challenge_id: challenge.id }, order: [['createdAt', 'DESC']] });
    const joined = validUser(req) ? entries.some(entry => entry.user_id === req.user.id) : false;
    const leaderboard = await getLeaderboardRows(3);
    res.json({
      id: challenge.id, title: challenge.title, description: challenge.description, hashtag: challenge.hashtag,
      points: challenge.points, badge: challenge.badge_name, image: challenge.image_url,
      startsAt: challenge.starts_at, endsAt: challenge.ends_at, participantCount: entries.length, joined, leaderboard
    });
  } catch (error) { next(error); }
};

exports.getLeaderboard = async (req, res, next) => {
  try { res.json(await getLeaderboardRows(Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10)))); }
  catch (error) { next(error); }
};

async function getLeaderboardRows(limit) {
  const wallets = await Wallet.findAll({ order: [['green_points', 'DESC']], limit: 100 });
  const rows = await Promise.all(wallets.map(async wallet => {
    const user = await User.findByPk(wallet.user_id);
    return user ? { userId: user.id, name: user.fullname || user.username, avatar: user.avatarUrl || '', points: wallet.green_points || 0 } : null;
  }));
  return rows.filter(row => row && row.points > 0).sort((a, b) => b.points - a.points).slice(0, limit);
}

exports.getTrendingHashtags = async (req, res, next) => {
  try {
    const posts = await CommunityPost.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    const counts = new Map();
    for (const post of posts) for (const tag of cleanHashtags([...(post.hashtags || []), ...cleanHashtags(post.text)])) counts.set(tag, (counts.get(tag) || 0) + 1);
    res.json([...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 12));
  } catch (error) { next(error); }
};

exports.getMemberChallenges = async (req, res, next) => {
  try {
    const entries = await CommunityChallengeEntry.findAll({ where: { user_id: req.user.id }, order: [['createdAt', 'DESC']] });
    res.json(entries);
  } catch (error) { next(error); }
};
