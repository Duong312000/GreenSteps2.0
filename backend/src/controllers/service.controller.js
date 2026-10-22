const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { 
  sequelize, 
  GreenService, 
  BadgeService, 
  Badge,
  Vender, 
  BadgeUser, 
  User, 
  CommentPost, 
  CPGS 
} = require('../models/index');

function saveBase64Image(base64Data, subfolder = 'services') {
  if (!base64Data || typeof base64Data !== 'string') return base64Data;
  if (!base64Data.startsWith('data:image')) return base64Data;

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return base64Data;

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  let ext = 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (mimeType.includes('webp')) ext = 'webp';

  const dirPath = path.join(__dirname, '../../uploads', subfolder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${subfolder}/${filename}`;
}

// 1. Get All Green Services (with optional destination filter — Eager Loading)
exports.getServices = async (req, res, next) => {
  try {
    const { destination } = req.query;

    const query = {};
    if (destination) {
      query.destination = { [Op.iLike]: `%${destination}%` };
    }

    const services = await GreenService.findAll({
      where: query,
      include: [
        { model: Badge, through: { attributes: [] } },
        { model: Vender }
      ]
    });

    const formatted = services.map(s => {
      const badges = (s.Badges || []).map(b => b.id);
      const providerId = s.Vender ? s.Vender.user_id : 'UG26pro0001';

      return {
        id: s.id,
        provider_id: providerId,
        name: s.name_service,
        type: s.type,
        destination: s.destination,
        cost: s.cost,
        carbon: s.carbon,
        icon: s.type === 'lodging' || s.type === 'stay' ? 'bi-house-door-fill' : (s.type === 'dining' || s.type === 'food' ? 'bi-cup-hot-fill' : 'bi-tree-fill'),
        status: s.status || 'active',
        views_count: s.views_count || 0,
        rating: s.rating,
        bookings_count: s.bookings_count,
        max_capacity: s.max_capacity || 10,
        badges: badges,
        image_url: s.image_url || (s.current_data ? s.current_data.img : null),
        current_data: s.current_data || {}
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};


// 2. Get My Services (for provider dashboard)
exports.getProviderServices = async (req, res, next) => {
  const { providerId } = req.params;
  try {
    const vender = await Vender.findOne({ where: { user_id: providerId } });
    const venderId = vender ? vender.id : '';

    const result = await GreenService.findAll({ where: { vender_id: venderId } });
    const mapped = result.map(s => ({
      id: s.id,
      name: s.name_service,
      type: s.type,
      dest: s.destination,
      cost: s.cost,
      status: s.status || 'active',
      views_count: s.views_count || 0,
      bookingsCount: s.bookings_count,
      max_capacity: s.max_capacity,
      carbon: s.carbon,
      image_url: s.image_url,
      current_data: s.current_data || {}
    }));

    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

// 3. Add Service (creates Vender if not exists)
exports.addService = async (req, res, next) => {
  const { providerId, name, type, destination, cost, carbon, icon, lat, lng, category, badges, maxCapacity, address, status, imageUrl, current_data } = req.body;

  try {
    let vender = await Vender.findOne({ where: { user_id: providerId } });
    if (!vender) {
      vender = await Vender.create({
        id: `provider_${providerId}`,
        user_id: providerId,
        registration_date: new Date()
      });
    }

    const serviceId = 'ser_' + Date.now();
    
    // Save main cover image if base64
    const savedImageUrl = saveBase64Image(imageUrl, 'services');
    
    const resolvedCurrentData = current_data ? { ...current_data } : {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      address: address || null,
      category: category || (type === 'food' ? 'Ăn uống' : type === 'stay' ? 'Lưu trú' : 'Khám phá'),
      img: savedImageUrl || 'image/Viet Nam.png'
    };

    // Keep current_data image aligned and save gallery images if base64
    resolvedCurrentData.img = savedImageUrl || resolvedCurrentData.img;
    if (resolvedCurrentData.img) {
      resolvedCurrentData.img = saveBase64Image(resolvedCurrentData.img, 'services');
    }
    if (resolvedCurrentData.images && Array.isArray(resolvedCurrentData.images)) {
      resolvedCurrentData.images = resolvedCurrentData.images.map(img => saveBase64Image(img, 'services'));
    }
    if (resolvedCurrentData.gallery && Array.isArray(resolvedCurrentData.gallery)) {
      resolvedCurrentData.gallery = resolvedCurrentData.gallery.map(img => saveBase64Image(img, 'services'));
    }

    const service = await GreenService.create({
      id: serviceId,
      vender_id: vender.id,
      name_service: name,
      type: type,
      cost: cost,
      destination: destination,
      carbon: carbon || 0.5,
      image_url: savedImageUrl || 'image/Viet Nam.png',
      rating: 5.0,
      bookings_count: 0,
      current_data: resolvedCurrentData,
      max_capacity: maxCapacity !== undefined && maxCapacity !== null ? Number(maxCapacity) : 10,
      status: status || 'pending'
    });

    const badgeList = badges && badges.length > 0 ? badges : ['green'];
    for (const b of badgeList) {
      await BadgeService.create({ badge_name: b, service_id: service.id });
    }

    res.json({
      id: service.id,
      provider_id: providerId,
      name: service.name_service,
      type: service.type,
      destination: service.destination,
      cost: service.cost,
      carbon: service.carbon,
      icon: icon || 'bi-tree-fill',
      status: service.status,
      badges: badgeList,
      current_data: service.current_data
    });
  } catch (error) {
    next(error);
  }
};

// 4. Personalized Green Service Recommendations
exports.getRecommendations = async (req, res, next) => {
  const { userId } = req.params;
  try {
    // Check traveler interest destination
    const user = await User.findByPk(userId);
    let recommendedServices = [];

    if (user && user.last_interest) {
      recommendedServices = await GreenService.findAll({
        where: { destination: { [Op.iLike]: `%${user.last_interest}%` } }
      });
    }

    // Match traveler badges
    if (recommendedServices.length === 0) {
      const userBadges = await BadgeUser.findAll({ where: { user_id: userId } });
      const badgeNames = userBadges.map(ub => ub.badge_name);
      
      if (badgeNames.length > 0) {
        const badgeServices = await BadgeService.findAll({
          where: { badge_name: { [Op.in]: badgeNames } }
        });
        const serviceIds = [...new Set(badgeServices.map(bs => bs.service_id))];
        if (serviceIds.length > 0) {
          recommendedServices = await GreenService.findAll({
            where: { id: { [Op.in]: serviceIds } }
          });
        }
      }
    }

    // Fallback: top selling services
    if (recommendedServices.length === 0) {
      recommendedServices = await GreenService.findAll({
        order: [['bookings_count', 'DESC']],
        limit: 4
      });
    }

    const formatted = [];
    for (const s of recommendedServices) {
      const badgeServices = await BadgeService.findAll({ where: { service_id: s.id } });
      const vender = await Vender.findByPk(s.vender_id);
      const providerId = vender ? vender.user_id : 'UG26pro0001';
      formatted.push({
        id: s.id,
        provider_id: providerId,
        name: s.name_service,
        type: s.type,
        destination: s.destination,
        cost: s.cost,
        carbon: s.carbon,
        icon: s.type === 'lodging' || s.type === 'stay' ? 'bi-house-door-fill' : (s.type === 'dining' || s.type === 'food' ? 'bi-cup-hot-fill' : 'bi-tree-fill'),
        status: 'active',
        rating: s.rating,
        bookings_count: s.bookings_count,
        max_capacity: s.max_capacity || 10,
        badges: badgeServices.map(bs => bs.badge_name),
        image_url: s.image_url || (s.current_data ? s.current_data.img : null),
        current_data: s.current_data || {}
      });
    }

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

// 5. Post Service Review
exports.postServiceReview = async (req, res, next) => {
  const { userId, serviceId, rating, text } = req.body;
  if (!userId || !serviceId || !rating || !text) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đánh giá!' });
  }

  try {
    const commentId = 'CEPser' + Date.now().toString().slice(-8);

    const comment = await CommentPost.create({
      id: commentId,
      user_id: userId,
      rating: rating,
      text: text,
      service_id: serviceId
    });

    await CPGS.create({
      comment_id: commentId,
      service_id: serviceId
    });

    // Recalculate
    const updatedService = await GreenService.findByPk(serviceId);

    res.json({
      success: true,
      comment,
      rating: updatedService ? updatedService.rating : rating
    });
  } catch (error) {
    next(error);
  }
};

// 6. Get Service Reviews
exports.getServiceReviews = async (req, res, next) => {
  const { serviceId } = req.params;
  try {
    const cpgsList = await CPGS.findAll({ where: { service_id: serviceId } });
    const commentIds = cpgsList.map(c => c.comment_id);
    const comments = await CommentPost.findAll({
      where: { id: { [Op.in]: commentIds } },
      order: [['createdAt', 'DESC']]
    });

    const reviews = [];
    for (let c of comments) {
      const user = await User.findByPk(c.user_id);
      reviews.push({
        id: c.id,
        user: user ? {
          id: user.id,
          fullname: user.fullname,
          role: user.role
        } : { fullname: 'Người dùng ẩn danh' },
        rating: c.rating,
        text: c.text,
        createdAt: c.createdAt
      });
    }

    res.json(reviews);
  } catch (error) {
    next(error);
  }
};

// 7. Update Service
exports.updateService = async (req, res, next) => {
  const { id } = req.params;
  const { name, type, destination, cost, carbon, lat, lng, address, category, status, maxCapacity, imageUrl, current_data } = req.body;
  try {
    const service = await GreenService.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại!' });
    }

    if (name !== undefined) service.name_service = name;
    if (type !== undefined) service.type = type;
    if (destination !== undefined) service.destination = destination;
    if (cost !== undefined) service.cost = Number(cost);
    if (carbon !== undefined) service.carbon = Number(carbon);
    if (status !== undefined) service.status = status;
    if (maxCapacity !== undefined) service.max_capacity = Number(maxCapacity);
    if (req.body.max_capacity !== undefined) service.max_capacity = Number(req.body.max_capacity);
    const savedImageUrl = imageUrl !== undefined ? saveBase64Image(imageUrl, 'services') : undefined;
    if (savedImageUrl !== undefined) service.image_url = savedImageUrl;

    const currentData = service.current_data || {};
    if (lat !== undefined) currentData.lat = lat ? parseFloat(lat) : null;
    if (lng !== undefined) currentData.lng = lng ? parseFloat(lng) : null;
    if (address !== undefined) currentData.address = address;
    if (category !== undefined) currentData.category = category;
    if (savedImageUrl !== undefined) currentData.img = savedImageUrl;

    if (current_data !== undefined) {
      const resolvedCurrentData = { ...current_data };
      if (resolvedCurrentData.img) {
        resolvedCurrentData.img = saveBase64Image(resolvedCurrentData.img, 'services');
      }
      if (resolvedCurrentData.images && Array.isArray(resolvedCurrentData.images)) {
        resolvedCurrentData.images = resolvedCurrentData.images.map(img => saveBase64Image(img, 'services'));
      }
      if (resolvedCurrentData.gallery && Array.isArray(resolvedCurrentData.gallery)) {
        resolvedCurrentData.gallery = resolvedCurrentData.gallery.map(img => saveBase64Image(img, 'services'));
      }
      service.current_data = { ...currentData, ...resolvedCurrentData };
    } else {
      service.current_data = { ...currentData };
    }
    
    // Ensure image in current_data is aligned
    if (savedImageUrl) {
      service.current_data.img = savedImageUrl;
    }
    
    service.changed('current_data', true);

    await service.save();

    res.json({ success: true, service });
  } catch (error) {
    next(error);
  }
};

// 8. Clone Service
exports.cloneService = async (req, res, next) => {
  const { id } = req.params;
  try {
    const service = await GreenService.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại!' });
    }

    const newId = 'ser_' + Date.now();
    const cloned = await GreenService.create({
      id: newId,
      vender_id: service.vender_id,
      name_service: `${service.name_service} (Bản sao)`,
      type: service.type,
      cost: service.cost,
      destination: service.destination,
      carbon: service.carbon,
      image_url: service.image_url,
      rating: 5.0,
      bookings_count: 0,
      current_data: service.current_data || {},
      max_capacity: service.max_capacity || 10,
      status: 'draft',
      views_count: 0
    });

    // Clone badges
    const badges = await BadgeService.findAll({ where: { service_id: id } });
    for (const b of badges) {
      await BadgeService.create({ badge_name: b.badge_name, service_id: newId });
    }

    res.json({ success: true, message: 'Nhân bản dịch vụ thành công!', service: cloned });
  } catch (error) {
    next(error);
  }
};

// 9. Suspend Service
exports.suspendService = async (req, res, next) => {
  const { id } = req.params;
  try {
    const service = await GreenService.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại!' });
    }
    service.status = 'suspended';
    await service.save();
    res.json({ success: true, message: 'Đã tạm ngừng hoạt động dịch vụ!', service });
  } catch (error) {
    next(error);
  }
};

// 10. Resend Service Approval
exports.resendServiceApproval = async (req, res, next) => {
  const { id } = req.params;
  try {
    const service = await GreenService.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại!' });
    }
    service.status = 'pending';
    service.rejection_reason = null;
    await service.save();
    res.json({ success: true, message: 'Đã gửi duyệt lại dịch vụ thành công!', service });
  } catch (error) {
    next(error);
  }
};

// 11. Get Service Details
exports.getServiceDetails = async (req, res, next) => {
  const { id } = req.params;
  try {
    const service = await GreenService.findByPk(id, {
      include: [
        { model: Badge, through: { attributes: [] } }
      ]
    });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại!' });
    }
    res.json(service);
  } catch (error) {
    next(error);
  }
};

