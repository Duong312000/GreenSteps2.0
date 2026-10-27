const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const { authMiddleware, softAuth } = require('../middlewares/auth.middleware');

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
