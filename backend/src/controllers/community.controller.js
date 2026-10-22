const { User, CommunityPost, CommentPost, Notification } = require('../models/index');

exports.getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 15;
    const posts = await CommunityPost.findAll({
      include: [{ model: User, required: false }],
      order: [['createdAt', 'DESC']],
      limit: limit,
      offset: page * limit
    });

    const formatted = posts.map(row => {
      const diffMs = Date.now() - new Date(row.createdAt);
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      let timeText = 'Mới đây';
      if (diffHours >= 24) {
        timeText = `${Math.floor(diffHours/24)} ngày trước`;
      } else if (diffHours > 0) {
        timeText = `${diffHours} giờ trước`;
      }
      
      const authorName = row.User ? row.User.fullname : 'Người dùng GreenSteps';
      const avatarVal = row.User && row.User.avatarUrl ? row.User.avatarUrl : (authorName ? authorName.charAt(0).toUpperCase() : 'U');
      return {
        id: row.id,
        authorId: row.user_id,
        itinerary_id: row.itinerary_id,
        author: authorName,
        avatar: avatarVal,
        time: timeText,
        rating: row.rating,
        text: row.text,
        tripName: row.tour_name,
        dest: row.destination,
        days: row.days,
        likes: row.likes_count,
        comments: row.comments_count,
        image: row.image_url,
        current_data: row.current_data || {}
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

exports.addPost = async (req, res, next) => {
  const { rating, text, tripName, dest, days, image, author, itineraryId } = req.body;
  const authorId = req.user ? req.user.id : (req.body.authorId || req.body.userId || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d');

  try {
    const { Wallet } = require('../models/index');
    const bcrypt = require('bcrypt');
    const userExists = await User.findByPk(authorId);
    if (!userExists) {
      const hashedPwd = await bcrypt.hash('123456', 10);
      await User.create({
        id: authorId,
        username: `recovered_${authorId}`,
        password_hash: hashedPwd,
        fullname: author || 'Khách hàng phục hồi',
        email: `${authorId}@greensteps.vn`,
        role: 'traveler'
      });
    }

    const postId = 'post_' + Date.now();
    const post = await CommunityPost.create({
      id: postId,
      user_id: authorId,
      rating: rating,
      text: text,
      tour_name: tripName,
      destination: dest,
      days: days,
      image_url: image || null,
      itinerary_id: itineraryId || null
    });
    res.json(post);
  } catch (error) {
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user ? req.user.id : (req.body.userId || req.body.authorId || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d');

  try {
    const post = await CommunityPost.findByPk(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại!' });
    }

    // Check ownership
    if (post.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này!' });
    }

    await post.destroy();
    res.json({ success: true, message: 'Đã xóa bài viết thành công!' });
  } catch (error) {
    next(error);
  }
};

exports.likePost = async (req, res, next) => {
  const { id } = req.params;
  const likerId = req.user ? req.user.id : (req.body.userId || req.body.authorId || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d');

  try {
    const post = await CommunityPost.findByPk(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại!' });
    }

    // Toggle like increment in DB
    post.likes_count += 1;
    await post.save();

    // Trigger Notification for author
    if (post.user_id && post.user_id !== likerId) {
      const likerUser = await User.findByPk(likerId);
      const likerName = likerUser ? likerUser.fullname : 'Một người dùng';
      await Notification.create({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: post.user_id,
        title: 'Lượt thích mới',
        message: `${likerName} đã thích bài viết của bạn!`,
        type: 'community',
        read: false
      });
    }

    res.json({ success: true, likes: post.likes_count });
  } catch (error) {
    next(error);
  }
};

exports.addPostComment = async (req, res, next) => {
  const { id } = req.params; // post_id
  const { text, parentCommentId, rating, fullname, imageUrl } = req.body;
  const userId = req.user ? req.user.id : (req.body.userId || req.body.authorId || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d');

  try {
    const { Wallet } = require('../models/index');
    const bcrypt = require('bcrypt');
    const userExists = await User.findByPk(userId);
    if (!userExists) {
      const hashedPwd = await bcrypt.hash('123456', 10);
      await User.create({
        id: userId,
        username: `recovered_${userId}`,
        password_hash: hashedPwd,
        fullname: fullname || 'Khách hàng phục hồi',
        email: `${userId}@greensteps.vn`,
        role: 'traveler'
      });
    }

    const post = await CommunityPost.findByPk(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại!' });
    }

    const commentId = 'CEPtra' + Date.now().toString().slice(-8);
    const comment = await CommentPost.create({
      id: commentId,
      user_id: userId,
      post_id: id,
      text,
      rating: rating || null,
      parent_comment_id: parentCommentId || null,
      image_url: imageUrl || null
    });

    // Update comments count on post
    post.comments_count += 1;
    await post.save();

    // Trigger Notification for author
    if (post.user_id && post.user_id !== userId) {
      const commentUser = await User.findByPk(userId);
      const commenterName = commentUser ? commentUser.fullname : 'Một người dùng';
      await Notification.create({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: post.user_id,
        title: 'Bình luận mới',
        message: `${commenterName} đã bình luận về bài viết của bạn: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
        type: 'community',
        read: false
      });
    }

    const userObj = await User.findByPk(userId);

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        text: comment.text,
        parentCommentId: comment.parent_comment_id,
        createdAt: comment.createdAt,
        imageUrl: comment.image_url,
        user: {
          fullname: userObj ? userObj.fullname : 'Người dùng ẩn danh',
          avatar: userObj && userObj.avatarUrl ? userObj.avatarUrl : (userObj ? userObj.fullname.charAt(0).toUpperCase() : 'U')
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPostComments = async (req, res, next) => {
  const { id } = req.params; // post_id

  try {
    const commentsList = await CommentPost.findAll({
      where: { post_id: id },
      order: [['createdAt', 'ASC']]
    });

    // Populate comments with author details
    const populated = [];
    for (const c of commentsList) {
      const author = await User.findByPk(c.user_id);
      populated.push({
        id: c.id,
        text: c.text,
        parentCommentId: c.parent_comment_id,
        createdAt: c.createdAt,
        imageUrl: c.image_url,
        user: {
          fullname: author ? author.fullname : 'Người dùng ẩn danh',
          avatar: author && author.avatarUrl ? author.avatarUrl : (author ? author.fullname.charAt(0).toUpperCase() : 'U')
        }
      });
    }

    // Build hierarchical tree
    const commentMap = {};
    const commentTree = [];

    populated.forEach(c => {
      c.replies = [];
      commentMap[c.id] = c;
    });

    populated.forEach(c => {
      if (c.parentCommentId && commentMap[c.parentCommentId]) {
        commentMap[c.parentCommentId].replies.push(c);
      } else {
        commentTree.push(c);
      }
    });

    res.json(commentTree);
  } catch (error) {
    next(error);
  }
};

exports.unlikePost = async (req, res, next) => {
  const { id } = req.params;

  try {
    const post = await CommunityPost.findByPk(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại!' });
    }

    // Decrement like in DB (min 0)
    post.likes_count = Math.max(0, post.likes_count - 1);
    await post.save();

    res.json({ success: true, likes: post.likes_count });
  } catch (error) {
    next(error);
  }
};
