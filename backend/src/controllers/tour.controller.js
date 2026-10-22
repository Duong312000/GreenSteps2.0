const { Op } = require('sequelize');
const { sendItineraryInviteEmail } = require('../services/email.service');
const { 
  sequelize, 
  Schedule, 
  ScheduleSample, 
  ScheduleCustom, 
  ScheduleActivity, 
  BadgeSchedule, 
  BadgeUser, 
  Badge,
  User, 
  CommentPost, 
  CPSS,
  Wallet,
  Provider,
  Notification,
  UserSchedule
} = require('../models/index');

// Helper: Format activities from Schedule into days array
function formatActivitiesIntoDays(schedule, activities) {
  const days = schedule.days || 1;
  const data = Array.from({ length: days }, () => []);
  (activities || []).forEach(act => {
    const dIdx = act.day_number - 1;
    if (dIdx >= 0 && dIdx < days) {
      data[dIdx].push({
        id: act.id,
        time: act.time,
        name: act.activity_name || '[Địa điểm tự do]',
        cost: act.activity_cost,
        carbon: act.carbon,
        icon: act.icon,
        type: act.type,
        is_shared: act.is_shared,
        lat: act.coordinates ? parseFloat(act.coordinates.split(',')[0]) : null,
        lng: act.coordinates ? parseFloat(act.coordinates.split(',')[1]) : null
      });
    }
  });
  return data;
}

// Helper: Format a ScheduleSample+Schedule row into a tour response object
function formatTourResponse(sample, schedule, badges, activities) {
  return {
    id: sample.id,
    title: schedule.tour_name,
    destination: schedule.destination || 'Việt Nam',
    days: schedule.days,
    cost: sample.cost,
    oldCost: sample.old_cost,
    carbon: schedule.carbon,
    image: schedule.image_url,
    description: schedule.tour_description,
    rating: sample.rating,
    votes_count: sample.votes_count,
    tags: badges,
    data: activities ? formatActivitiesIntoDays(schedule, activities) : undefined
  };
}
const bcrypt = require('bcrypt');

// 1. Get All Preset Tours (Eager Loading — single query)
exports.getPresetTours = async (req, res, next) => {
  try {
    const { userId } = req.query;
    let whereClause = {};
    if (userId) {
      const user = await User.findByPk(userId);
      if (user && user.company_name) {
        const provider = await Provider.findOne({ where: { name_provider: user.company_name } });
        if (provider) {
          whereClause = { provider_id: provider.id };
        } else {
          return res.json([]);
        }
      } else {
        return res.json([]);
      }
    }

    const samples = await ScheduleSample.findAll({
      where: whereClause,
      include: [
        {
          model: Schedule,
          include: [{
            model: ScheduleActivity,
            order: [['day_number', 'ASC'], ['time', 'ASC']]
          }]
        }
      ]
    });

    // Fetch all badges for returned schedule IDs in a single query
    const sampleIds = samples.map(s => s.id);
    const allBadges = sampleIds.length > 0
      ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: sampleIds } } })
      : [];
    const badgeMap = {};
    allBadges.forEach(bs => {
      if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
      badgeMap[bs.schedule_id].push(bs.badge_name);
    });

    const tours = samples
      .filter(s => s.Schedule)
      .map(s => formatTourResponse(
        s,
        s.Schedule,
        badgeMap[s.id] || [],
        s.Schedule.ScheduleActivities
      ));

    res.json(tours);
  } catch (error) {
    next(error);
  }
};

// 2. Get Single Preset Tour (Eager Loading — single query)
exports.getPresetTourById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const s = await ScheduleSample.findByPk(id, {
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });
    if (!s || !s.Schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tour du lịch này!' });
    }

    const badgeSchedules = await BadgeSchedule.findAll({ where: { schedule_id: id } });
    const badges = badgeSchedules.map(bs => bs.badge_name);

    const result = formatTourResponse(
      s,
      s.Schedule,
      badges,
      s.Schedule.ScheduleActivities
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 3. Get Personalized Tour Recommendations (Eager Loading)
exports.getRecommendations = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const user = await User.findByPk(userId);
    let matchedTours = [];

    const eagerInclude = [{ model: Schedule }];

    // Priority 1: Check user last interest destination
    if (user && user.last_interest) {
      const matchedSchedules = await Schedule.findAll({
        where: { destination: { [Op.iLike]: `%${user.last_interest}%` } },
        attributes: ['id']
      });
      const scheduleIds = matchedSchedules.map(s => s.id);
      if (scheduleIds.length > 0) {
        matchedTours = await ScheduleSample.findAll({
          where: { id: { [Op.in]: scheduleIds } },
          include: eagerInclude
        });
      }
    }

    // Priority 2: Match user badges
    if (matchedTours.length === 0) {
      const userBadges = await BadgeUser.findAll({ where: { user_id: userId }, attributes: ['badge_name'] });
      const badgeNames = userBadges.map(ub => ub.badge_name);
      if (badgeNames.length > 0) {
        const badgeSchedules = await BadgeSchedule.findAll({
          where: { badge_name: { [Op.in]: badgeNames } },
          attributes: ['schedule_id']
        });
        const tourIds = [...new Set(badgeSchedules.map(bs => bs.schedule_id))];
        if (tourIds.length > 0) {
          matchedTours = await ScheduleSample.findAll({
            where: { id: { [Op.in]: tourIds } },
            include: eagerInclude
          });
        }
      }
    }

    // Fallback: highest rated tours
    if (matchedTours.length === 0) {
      matchedTours = await ScheduleSample.findAll({
        order: [['rating', 'DESC']],
        limit: 3,
        include: eagerInclude
      });
    }

    // Fetch all badges for matched tours in a single query
    const tourIds = matchedTours.map(s => s.id);
    const allBadges = tourIds.length > 0
      ? await BadgeSchedule.findAll({ where: { schedule_id: { [Op.in]: tourIds } } })
      : [];
    const badgeMap = {};
    allBadges.forEach(bs => {
      if (!badgeMap[bs.schedule_id]) badgeMap[bs.schedule_id] = [];
      badgeMap[bs.schedule_id].push(bs.badge_name);
    });

    const tours = matchedTours
      .filter(s => s.Schedule)
      .map(s => formatTourResponse(s, s.Schedule, badgeMap[s.id] || []));

    res.json(tours);
  } catch (error) {
    next(error);
  }
};

// 4. Custom Itineraries: Save or Update Itinerary (calculates carbon footprint)
exports.saveCustomItinerary = async (req, res, next) => {
  const { id, name, user_id, destination, days, totalCost, daysData, status, deposit_deadline, start_date, end_date, companion_email, imageUrl, image_url } = req.body;

  try {
    // Sum carbon emissions from activities
    let computedCarbon = 0;
    if (daysData && daysData.length > 0) {
      daysData.forEach(day => {
        day.forEach(act => {
          computedCarbon += parseFloat(act.carbon || 0);
        });
      });
    }

    // SQL Transaction
    await sequelize.transaction(async (t) => {
      // Self-healing check: if the user does not exist in DB, auto-create them and their wallet
      const userExists = await User.findByPk(user_id, { transaction: t });
      if (!userExists) {
        const hashedPwd = await bcrypt.hash('123456', 10);
        await User.create({
          id: user_id,
          username: `recovered_${user_id}`,
          password_hash: hashedPwd,
          fullname: 'Khách hàng phục hồi',
          email: `${user_id}@greensteps.vn`,
          role: 'traveler'
        }, { transaction: t });
      }

      await Schedule.upsert({
        id: id,
        tour_name: name,
        destination: destination,
        days: days,
        discount: 0,
        carbon: computedCarbon,
        image_url: imageUrl || image_url || 'image/Viet Nam.png',
        tour_description: `Hành trình tự thiết kế đi ${destination}`
      }, { transaction: t });

      // Check current status if exists to create notification
      const existingCustom = await ScheduleCustom.findByPk(id, { transaction: t });
      const statusChanged = existingCustom && existingCustom.status !== status;

      await ScheduleCustom.upsert({
        id: id,
        user_id: user_id,
        total_cost: totalCost,
        ...(status ? { status } : {}),
        ...(deposit_deadline !== undefined ? { deposit_deadline } : {}),
        ...(start_date !== undefined ? { start_date } : {}),
        ...(end_date !== undefined ? { end_date } : {}),
        ...(companion_email !== undefined ? { companion_email } : {})
      }, { transaction: t });

      // Create UserSchedule junction if not exist
      await UserSchedule.findOrCreate({
        where: { user_id: user_id, schedule_id: id },
        transaction: t
      });

      // Create notifications on status change
      if (statusChanged || (!existingCustom && status)) {
        if (status === 'deposited') {
          await Notification.create({
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            user_id: user_id,
            title: 'Đặt cọc thành công',
            message: `Bạn đã hoàn tất đặt cọc cho chuyến đi ${destination || 'của bạn'}. Lịch trình hiện tại đã được khóa.`,
            type: 'wallet',
            read: false
          }, { transaction: t });
        } else if (status === 'cancelled') {
          await Notification.create({
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            user_id: user_id,
            title: 'Đã hủy đặt cọc',
            message: `Lịch trình chuyến đi ${destination || 'của bạn'} đã được hủy thành công. Số tiền cọc đã được hoàn trả về ví của bạn.`,
            type: 'wallet',
            read: false
          }, { transaction: t });
        }
      } else if (!existingCustom) {
        // Initial creation notification
        await Notification.create({
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: user_id,
          title: 'Hành trình mới',
          message: `Lịch trình tự thiết kế đi ${destination || 'điểm đến mới'} đã được khởi tạo thành công!`,
          type: 'system',
          read: false
        }, { transaction: t });
      }

      // Destroy old activities
      await ScheduleActivity.destroy({ where: { schedule_id: id }, transaction: t });


      // Save new activities
      const activitiesToSave = [];
      if (daysData && daysData.length > 0) {
        // Query green services at this destination to auto-link service_id by name if not provided
        const { GreenService } = require('../models/index');
        const services = await GreenService.findAll({ where: { destination: base.destination } });
        const serviceMap = {};
        services.forEach(s => {
          serviceMap[s.name_service.toLowerCase().trim()] = s.id;
        });

        daysData.forEach((day, dIdx) => {
          day.forEach((act, aIdx) => {
            const actId = `act_${id}_${dIdx + 1}_${aIdx + 1}_${Math.random().toString(36).substring(2, 7)}`;
            const actName = act.name || act.title || '[Địa điểm tự do]';
            const nameKey = actName.toLowerCase().trim();
            const serviceId = act.service_id || act.serviceId || serviceMap[nameKey] || null;

            activitiesToSave.push({
              id: actId,
              schedule_id: id,
              day_number: dIdx + 1,
              time: act.time || '08:00',
              activity_name: actName,
              activity_cost: act.cost || 0,
              carbon: act.carbon || 0,
              coordinates: act.lat && act.lng ? `${act.lat}, ${act.lng}` : null,
              service_id: serviceId
            });
          });
        });
        await ScheduleActivity.bulkCreate(activitiesToSave, { transaction: t });
      }
    });

    res.json({ success: true, message: 'Đã lưu lịch trình thành công và đồng bộ carbon!' });
  } catch (error) {
    next(error);
  }
};

// 5. Get All Custom Itineraries for a User (Eager Loading — single query)
exports.getUserCustomItineraries = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const userSchedules = await UserSchedule.findAll({
      where: { user_id: userId }
    });
    const scheduleIds = userSchedules.map(us => us.schedule_id);

    const customs = await ScheduleCustom.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { id: { [Op.in]: scheduleIds } }
        ]
      },
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });

    const result = customs
      .filter(c => c.Schedule)
      .map(c => ({
        id: c.id,
        name: c.Schedule.tour_name,
        destination: c.Schedule.destination || 'Việt Nam',
        days: c.Schedule.days,
        totalCost: c.total_cost,
        totalCarbon: c.Schedule.carbon,
        daysData: formatActivitiesIntoDays(c.Schedule, c.Schedule.ScheduleActivities),
        status: c.status || 'draft',
        deposit_deadline: c.deposit_deadline || null,
        start_date: c.start_date || null,
        end_date: c.end_date || null,
        companion_email: c.companion_email || null,
        imageUrl: c.Schedule.image_url
      }));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 6. Get Single Custom Itinerary (Eager Loading — single query)
exports.getCustomItineraryById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const c = await ScheduleCustom.findByPk(id, {
      include: [{
        model: Schedule,
        include: [{ model: ScheduleActivity }]
      }]
    });
    if (!c || !c.Schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    // Fetch collaborators via UserSchedule
    const userSchedules = await UserSchedule.findAll({
      where: { schedule_id: id }
    });
    const collaboratorIds = userSchedules.map(us => us.user_id);
    const collaborators = await User.findAll({
      where: { id: { [Op.in]: collaboratorIds } },
      attributes: ['id', 'username', 'fullname', 'avatarUrl', 'email']
    });

    res.json({
      id: c.id,
      name: c.Schedule.tour_name,
      destination: c.Schedule.destination || 'Việt Nam',
      days: c.Schedule.days,
      totalCost: c.total_cost,
      totalCarbon: c.Schedule.carbon,
      daysData: formatActivitiesIntoDays(c.Schedule, c.Schedule.ScheduleActivities),
      status: c.status || 'draft',
      deposit_deadline: c.deposit_deadline || null,
      start_date: c.start_date || null,
      end_date: c.end_date || null,
      companion_email: c.companion_email || null,
      imageUrl: c.Schedule.image_url,
      collaborators: collaborators.map(u => ({
        id: u.id,
        username: u.username,
        fullname: u.fullname || u.username,
        avatarUrl: u.avatarUrl || u.avatar_url || '',
        email: u.email
      }))
    });
  } catch (error) {
    next(error);
  }
};

// 7. Delete Custom Itinerary
exports.deleteCustomItinerary = async (req, res, next) => {
  const { id } = req.params;
  try {
    await sequelize.transaction(async (t) => {
      await ScheduleActivity.destroy({ where: { schedule_id: id }, transaction: t });
      await UserSchedule.destroy({ where: { schedule_id: id }, transaction: t });
      await ScheduleCustom.destroy({ where: { id }, transaction: t });
      await Schedule.destroy({ where: { id }, transaction: t });
    });

    res.json({ success: true, message: 'Đã xóa lịch trình thành công!' });
  } catch (error) {
    next(error);
  }
};

// 8. Get Distinct Destinations List
exports.getDestinations = async (req, res, next) => {
  try {
    const schedules = await Schedule.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('destination')), 'destination']]
    });
    const destinations = schedules.map(s => s.destination).filter(Boolean);
    res.json(destinations);
  } catch (error) {
    next(error);
  }
};

// 9. Post Tour Review
exports.postTourReview = async (req, res, next) => {
  const { userId, tourId, rating, text, parentCommentId } = req.body;
  if (!userId || !tourId || !text) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đánh giá!' });
  }
  if (!parentCommentId && rating === undefined) {
    return res.status(400).json({ success: false, message: 'Thiếu số điểm đánh giá (rating)!' });
  }

  try {
    const commentId = 'CEPtra' + Date.now().toString().slice(-8);

    const comment = await CommentPost.create({
      id: commentId,
      user_id: userId,
      rating: parentCommentId ? null : rating,
      text: text,
      tour_id: tourId,
      parent_comment_id: parentCommentId || null
    });

    if (!parentCommentId) {
      await CPSS.create({
        comment_id: commentId,
        schedule_sample_id: tourId
      });
    }

    // Rating hooks inside CommentPost automatically update ScheduleSample rating in DB.
    // Fetch newly updated rating to return to client.
    const updatedSample = await ScheduleSample.findByPk(tourId);
    const userObj = await User.findByPk(userId);

    res.json({
      success: true,
      comment: {
        id: comment.id,
        user: userObj ? {
          id: userObj.id,
          fullname: userObj.fullname,
          role: userObj.role,
          avatar: userObj.avatarUrl || userObj.fullname.charAt(0).toUpperCase()
        } : { fullname: 'Người dùng ẩn danh', avatar: 'U' },
        rating: comment.rating,
        text: comment.text,
        parentCommentId: comment.parent_comment_id,
        likesCount: comment.likes_count || 0,
        createdAt: comment.createdAt,
        replies: []
      },
      rating: updatedSample ? updatedSample.rating : rating,
      votes_count: updatedSample ? updatedSample.votes_count : 1
    });
  } catch (error) {
    next(error);
  }
};

// 10. Get Tour Reviews
exports.getTourReviews = async (req, res, next) => {
  const { tourId } = req.params;
  try {
    const cpssList = await CPSS.findAll({ where: { schedule_sample_id: tourId } });
    const commentIds = cpssList.map(c => c.comment_id);

    const comments = await CommentPost.findAll({
      where: {
        [Op.or]: [
          { tour_id: tourId },
          { id: { [Op.in]: commentIds } }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    const commentMap = {};
    const commentTree = [];

    for (let c of comments) {
      const user = await User.findByPk(c.user_id);
      const cJson = {
        id: c.id,
        user: user ? {
          id: user.id,
          fullname: user.fullname,
          role: user.role,
          avatar: user.avatarUrl || user.fullname.charAt(0).toUpperCase()
        } : { fullname: 'Người dùng ẩn danh', avatar: 'U' },
        rating: c.rating,
        text: c.text,
        parentCommentId: c.parent_comment_id,
        likesCount: c.likes_count || 0,
        createdAt: c.createdAt,
        replies: []
      };
      commentMap[c.id] = cJson;
    }

    for (let c of Object.values(commentMap)) {
      if (c.parentCommentId && commentMap[c.parentCommentId]) {
        commentMap[c.parentCommentId].replies.push(c);
      } else {
        commentTree.push(c);
      }
    }

    // Sort root reviews newest first
    commentTree.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(commentTree);
  } catch (error) {
    next(error);
  }
};

// 10b. Like / React helpful to Tour Review
exports.likeComment = async (req, res, next) => {
  const { commentId } = req.params;
  try {
    const comment = await CommentPost.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Bình luận không tồn tại!' });
    }

    comment.likes_count = (comment.likes_count || 0) + 1;
    await comment.save();

    res.json({ success: true, likes: comment.likes_count });
  } catch (error) {
    next(error);
  }
};


exports.cloneItinerary = async (req, res, next) => {
  const { id } = req.params;
  const newUserId = req.user ? req.user.id : (req.body.userId || req.body.user_id || '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7d');

  try {
    const base = await Schedule.findByPk(id);
    if (!base) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình gốc để sao chép!' });
    }

    const custom = await ScheduleCustom.findByPk(id);
    const activities = await ScheduleActivity.findAll({ where: { schedule_id: id } });

    const newId = 'iti_' + Date.now();

    await sequelize.transaction(async (t) => {
      // Create Base Schedule
      await Schedule.create({
        id: newId,
        tour_name: `Bản sao - ${base.tour_name}`,
        destination: base.destination,
        days: base.days,
        discount: base.discount,
        carbon: base.carbon,
        image_url: base.image_url,
        tour_description: base.tour_description
      }, { transaction: t });

      // Create ScheduleCustom for new user
      await ScheduleCustom.create({
        id: newId,
        user_id: newUserId,
        total_cost: custom ? custom.total_cost : 0,
        status: 'draft',
        deposit_deadline: null,
        start_date: custom ? custom.start_date : null,
        end_date: custom ? custom.end_date : null,
        companion_email: null
      }, { transaction: t });

      // Create UserSchedule junction
      await UserSchedule.create({
        user_id: newUserId,
        schedule_id: newId
      }, { transaction: t });

      // Copy Activities
      const newActivities = activities.map((act, idx) => {
        return {
          id: `act_${newId}_${act.day_number}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
          schedule_id: newId,
          day_number: act.day_number,
          time: act.time,
          activity_name: act.activity_name,
          activity_cost: act.activity_cost,
          carbon: act.carbon,
          coordinates: act.coordinates,
          service_id: act.service_id
        };
      });

      if (newActivities.length > 0) {
        await ScheduleActivity.bulkCreate(newActivities, { transaction: t });
      }

      // Trigger Notifications
      await Notification.create({
        id: `notif_${Date.now()}_b_${Math.random().toString(36).substring(2, 7)}`,
        user_id: newUserId,
        title: 'Sao chép thành công',
        message: `Đã tham khảo & sao chép lịch trình "${base.tour_name}" thành công!`,
        type: 'system',
        read: false
      }, { transaction: t });

      if (custom && custom.user_id && custom.user_id !== newUserId) {
        const clonerUser = await User.findByPk(newUserId, { transaction: t });
        const clonerName = clonerUser ? clonerUser.fullname : 'Một người dùng';
        await Notification.create({
          id: `notif_${Date.now()}_a_${Math.random().toString(36).substring(2, 7)}`,
          user_id: custom.user_id,
          title: 'Lịch trình được tham khảo',
          message: `${clonerName} đã tham khảo & sao chép lịch trình "${base.tour_name}" của bạn!`,
          type: 'community',
          read: false
        }, { transaction: t });
      }
    });

    res.json({ success: true, message: 'Đã sao chép lịch trình thành công!', newItineraryId: newId });
  } catch (error) {
    next(error);
  }
};

// 8. Invite Friends/Collaborators to Custom Itinerary
exports.inviteCollaborator = async (req, res, next) => {
  const { id } = req.params;
  const { emails, inviteUrl } = req.body;

  try {
    const c = await ScheduleCustom.findByPk(id, {
      include: [{ model: Schedule }]
    });
    if (!c || !c.Schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    const emailList = typeof emails === 'string' 
      ? emails.split(',').map(e => e.trim()).filter(e => e.length > 0)
      : (Array.isArray(emails) ? emails : []);

    if (emailList.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách email hợp lệ!' });
    }

    c.companion_email = emailList.join(', ');
    await c.save();

    let successCount = 0;
    for (const email of emailList) {
      const emailSent = await sendItineraryInviteEmail({
        to: email,
        itineraryName: c.Schedule.tour_name,
        inviteUrl: inviteUrl
      });
      if (emailSent) successCount++;
    }

    if (successCount > 0) {
      res.json({ success: true, message: `Đã gửi thành công ${successCount}/${emailList.length} thư mời!` });
    } else {
      res.status(500).json({ success: false, message: 'Gửi email lời mời thất bại. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại!' });
    }
  } catch (error) {
    next(error);
  }
};

// 9. Join Custom Itinerary (for invited friends)
exports.joinItinerary = async (req, res, next) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const c = await ScheduleCustom.findByPk(id, {
      include: [{ model: Schedule }]
    });
    if (!c || !c.Schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình!' });
    }

    await UserSchedule.findOrCreate({
      where: { user_id: userId, schedule_id: id }
    });

    const joinedUser = await User.findByPk(userId);
    if (joinedUser && c.user_id !== userId) {
      await Notification.create({
        id: `notif_${Date.now()}_join_${Math.random().toString(36).substring(2, 7)}`,
        user_id: c.user_id,
        title: 'Đồng hành mới',
        message: `${joinedUser.fullname || joinedUser.username} đã chấp nhận lời mời và tham gia lập lịch trình "${c.Schedule.tour_name}" cùng bạn!`,
        type: 'community',
        read: false
      });
    }

    res.json({ success: true, message: 'Bạn đã tham gia lịch trình thành công!' });
  } catch (error) {
    next(error);
  }
};
