const express = require('express');
const router = express.Router();
const { CommunityPost } = require('../models');

// 1. Lấy danh sách bài viết cộng đồng
router.get(['/', '/posts'], async (req, res) => {
  try {
    const page = Math.max(0, Number.parseInt(req.query.page, 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
    const posts = await CommunityPost.find({ status: 'published' })
      .populate('author_id', 'username profile.fullname profile.avatarUrl')
      .populate('comments.author_id', 'username profile.fullname profile.avatarUrl')
      .sort({ created_at: -1, _id: -1 }).skip(page * limit).limit(limit);

    const mapped = posts.map(p => ({
      id: p._id,
      _id: p._id,
      avatar: p.author_id?.profile?.avatarUrl || '',
      authorId: p.author_id?._id,
      time: new Date(p.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      rating: 0,
      tripName: p.title,
      dest: p.destination,
      likes: p.likes_count,
      image: p.image_url,
      title: p.title,
      tour_name: p.title,
      destination: p.destination,
      days: p.days,
      text: p.text,
      image_url: p.image_url,
      itinerary_id: p.itinerary_id,
      likes_count: p.likes_count,
      comments_count: p.comments.length,
      author: p.author_id ? (p.author_id.profile?.fullname || p.author_id.username) : 'Du khách Xanh',
      author_avatar: p.author_id ? p.author_id.profile?.avatarUrl : '',
      comments: p.comments.length,
      comment_items: p.comments.map(c => ({
        id: c._id,
        _id: c._id,
        author: c.author_id ? (c.author_id.profile?.fullname || c.author_id.username) : 'Người dùng',
        author_avatar: c.author_id ? c.author_id.profile?.avatarUrl : '',
        text: c.text,
        rating: c.rating,
        created_at: c.created_at
      })),
      created_at: p.created_at
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Get posts error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải bài viết cộng đồng.' });
  }
});

// 2. Đăng bài viết chia sẻ mới
router.post('/', async (req, res) => {
  try {
    const { author_id, title, destination, days, text, image_url, itinerary_id } = req.body;
    if (!title || !text) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề và nội dung.' });
    }

    const post = new CommunityPost({
      author_id: author_id && author_id.length === 24 ? author_id : null,
      title,
      destination: destination || 'Việt Nam',
      days: Number(days) || 1,
      text,
      image_url: image_url || '',
      itinerary_id: itinerary_id && itinerary_id.length === 24 ? itinerary_id : null
    });

    await post.save();
    return res.status(201).json({ success: true, message: 'Đăng bài thành công!', post });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi đăng bài viết.' });
  }
});

// 3. Thả tim bài viết
router.post('/:id/like', async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });

    post.likes_count += 1;
    await post.save();
    return res.json({ success: true, likes_count: post.likes_count });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi like bài viết.' });
  }
});

// 4. Bình luận vào bài viết
router.post('/:id/comments', async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });

    const { author_id, text, rating } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Nội dung bình luận không được trống.' });

    post.comments.push({
      author_id: author_id && author_id.length === 24 ? author_id : null,
      text,
      rating: rating ? Number(rating) : undefined
    });
    post.comments_count = post.comments.length;

    await post.save();
    return res.json({ success: true, message: 'Bình luận thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi bình luận.' });
  }
});

module.exports = router;
