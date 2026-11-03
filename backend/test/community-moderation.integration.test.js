const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { store, User, CommunityPost, CommentPost, CommunityReport, Notification } = require('../src/models');
const { JWT_SECRET } = require('../src/middlewares/auth.middleware');

test('community reports persist, enforce roles, hide and restore posts and comments', { timeout: 45000 }, async () => {
  const tag = `moderation-test-${randomUUID()}`;
  const owner = `${tag}-owner`, reporter = `${tag}-reporter`, admin = `${tag}-admin`;
  const postId = `${tag}-post`, commentId = `${tag}-comment`, replyId = `${tag}-reply`;
  let server;
  try {
    await store.authenticate();
    // Use the application's index synchronizer so repeated runs also accept a
    // pre-existing full unique ID index without trying to replace it.
    await store.sync();
    for (const [id, role] of [[owner, 'traveler'], [reporter, 'traveler'], [admin, 'admin']]) await User.create({ id, username: id, email: `${id}@example.invalid`, password_hash: 'not-used', role });
    await CommunityPost.create({ id: postId, user_id: owner, text: tag, rating: 5, hashtags: [tag] });
    await CommentPost.create({ id: commentId, post_id: postId, user_id: owner, text: 'Comment to review' });
    await CommentPost.create({ id: replyId, post_id: postId, user_id: reporter, parent_comment_id: commentId, text: 'Reply under the reviewed comment' });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}/api/community`;
    const token = (id, role = 'traveler') => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '5m' });
    const request = async (path, method = 'GET', body, auth) => {
      const res = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, body: await res.json() };
    };
    const adminToken = token(admin, 'admin'), reporterToken = token(reporter);
    assert.ok((await request('/standards')).body.some(rule => rule.id === 'spam'));
    const payload = { targetType: 'post', targetId: postId, reason: 'spam', details: 'Report fixture' };
    assert.equal((await request('/reports', 'POST', payload)).status, 401);
    assert.equal((await request('/reports', 'GET', null, reporterToken)).status, 403);
    assert.equal((await request('/reports', 'POST', payload, token(owner))).status, 400);
    assert.equal((await request('/reports', 'POST', { ...payload, reason: 'invented' }, reporterToken)).status, 400);
    assert.equal((await request('/reports', 'POST', payload, reporterToken)).status, 201);
    assert.equal((await request('/reports', 'POST', payload, reporterToken)).body.duplicate, true);
    assert.equal((await CommunityReport.findAll({ where: { reporter_id: reporter } })).length, 1);
    assert.ok((await request(`/posts?q=${tag}`)).body.some(post => post.id === postId), 'a report alone must not hide content');
    let report = (await request('/reports', 'GET', null, adminToken)).body.find(row => row.targetId === postId);
    assert.equal(report.snapshot, tag);
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'hide', note: 'Spam confirmed' }, reporterToken)).status, 403);
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'hide', note: '' }, adminToken)).status, 400);
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'hide', note: 'Spam confirmed' }, adminToken)).status, 200);
    assert.equal((await CommunityPost.findByPk(postId)).moderation_status, 'hidden');
    assert.ok(!(await request(`/posts?q=${tag}`)).body.some(post => post.id === postId));
    assert.equal((await request(`/posts/${postId}/comments`)).status, 404);
    assert.equal((await request(`/posts/${postId}/like`, 'POST', {}, reporterToken)).status, 404);
    assert.equal((await request(`/posts/${postId}`, 'PUT', { text: 'Bypass hidden post' }, token(owner))).status, 404);
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'restore', note: 'Restored after review' }, adminToken)).status, 200);
    assert.ok((await request(`/posts?q=${tag}`)).body.some(post => post.id === postId));
    assert.equal((await CommunityReport.findByPk(report.id)).history.length, 2);
    assert.equal((await Notification.findAll({ where: { user_id: owner } })).length, 2);
    assert.equal((await request('/reports', 'POST', { targetType: 'comment', targetId: commentId, reason: 'harassment' }, reporterToken)).status, 201);
    report = (await request('/reports', 'GET', null, adminToken)).body.find(row => row.targetId === commentId);
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'hide', note: 'Harassment confirmed' }, adminToken)).status, 200);
    assert.equal((await request(`/posts/${postId}/comments`)).body.length, 0, 'hidden comments and orphaned replies stay out of the feed');
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'restore', note: 'Context clarified' }, adminToken)).status, 200);
    assert.equal((await request(`/posts/${postId}/comments`)).body[0].replies.length, 1);
    // A new reporter can submit a separate report; dismissing it does not hide content.
    assert.equal((await request('/reports', 'POST', payload, adminToken)).status, 201);
    report = (await CommunityReport.findAll({ where: { reporter_id: admin } }))[0];
    assert.equal((await request(`/reports/${report.id}/review`, 'POST', { action: 'dismiss', note: 'No violation found' }, adminToken)).status, 200);
    assert.equal((await CommunityReport.findByPk(report.id)).status, 'dismissed');
    assert.equal((await CommunityPost.findByPk(postId)).moderation_status, 'visible');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await CommunityReport.collection.deleteMany({ reporter_id: { $in: [owner, reporter, admin] } });
    await Notification.collection.deleteMany({ user_id: { $in: [owner, reporter, admin] } });
    await CommentPost.collection.deleteMany({ id: { $in: [commentId, replyId] } });
    await CommunityPost.collection.deleteMany({ id: postId });
    await User.collection.deleteMany({ id: { $in: [owner, reporter, admin] } });
    await store.close();
  }
});
