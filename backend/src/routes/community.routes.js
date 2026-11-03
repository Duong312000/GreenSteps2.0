const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const { authMiddleware, softAuth, checkRole } = require('../middlewares/auth.middleware');
const moderation = require('../controllers/community-moderation.controller');

router.get('/standards', moderation.getStandards);
router.post('/reports', authMiddleware, moderation.report);
router.get('/reports', authMiddleware, checkRole(['admin']), moderation.listReports);
router.post('/reports/:id/review', authMiddleware, checkRole(['admin']), moderation.review);

router.get('/posts', softAuth, communityController.getPosts);
router.get('/posts/saved', authMiddleware, communityController.getSavedItems);
router.post('/posts', authMiddleware, communityController.addPost);
router.put('/posts/:id', authMiddleware, communityController.updatePost);
router.delete('/posts/:id', authMiddleware, communityController.deletePost);
router.post('/posts/:id/like', authMiddleware, communityController.likePost);
router.post('/posts/:id/unlike', authMiddleware, communityController.unlikePost);
router.post('/posts/:id/save', authMiddleware, communityController.savePost);
router.post('/posts/:id/share', softAuth, communityController.sharePost);
router.get('/posts/:id/comments', communityController.getPostComments);
router.post('/posts/:id/comments', authMiddleware, communityController.addPostComment);
router.post('/comments/:commentId/helpful', authMiddleware, communityController.markHelpful);
router.get('/challenge/current', softAuth, communityController.getCurrentChallenge);
router.get('/leaderboard', communityController.getLeaderboard);
router.get('/hashtags/trending', communityController.getTrendingHashtags);
router.get('/challenges/mine', authMiddleware, communityController.getMemberChallenges);

module.exports = router;
