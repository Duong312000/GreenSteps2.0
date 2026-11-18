'use strict';

const express = require('express');
const { authMiddleware, softAuth, checkRole } = require('../middlewares/auth.middleware');
const ecoScore = require('../services/eco-score.service');

const router = express.Router();

router.get('/criteria', (_req, res) => {
  res.json({ success: true, criteria: ecoScore.CRITERIA_CATALOG });
});

router.get('/admin/pending', authMiddleware, checkRole(['admin']), async (_req, res, next) => {
  try {
    const items = await ecoScore.listPendingAssessments();
    res.json({ success: true, items });
  } catch (error) { next(error); }
});

router.patch('/admin/:targetType/:targetId/verify', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const result = await ecoScore.verifyAssessmentByAdmin({
      adminUser: req.user,
      targetType: req.params.targetType,
      targetId: req.params.targetId,
      approved: Boolean(req.body?.approved),
      reason: req.body?.reason || ''
    });
    res.json({ success: true, assessment: result });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
});

router.get('/:targetType/:targetId', softAuth, async (req, res, next) => {
  try {
    const wantDetail = req.query.detail === '1' && (req.user?.role === 'provider' || req.user?.role === 'admin');
    const assessment = await ecoScore.getEcoAssessment(req.params.targetType, req.params.targetId, {
      includeProviderDetail: wantDetail
    });
    res.json({ success: true, assessment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
});

router.post('/:targetType/:targetId/assessment', authMiddleware, checkRole(['provider', 'admin']), async (req, res, next) => {
  try {
    const assessment = await ecoScore.submitProviderAssessment({
      user: req.user,
      targetType: req.params.targetType,
      targetId: req.params.targetId,
      criteria: req.body?.criteria || {},
      evidenceUrls: req.body?.evidenceUrls || [],
      evidenceNote: req.body?.evidenceNote || ''
    });
    res.json({ success: true, assessment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
});

module.exports = router;
