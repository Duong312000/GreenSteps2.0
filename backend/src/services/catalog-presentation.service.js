// Both catalog consumers use the same verification and pricing metadata.
function catalogMetadata(service) {
  const data = service.current_data || {};
  return {
    priceStatus: data.priceStatus,
    bookingEnabled: data.bookingEnabled,
    sourceUrls: data.sourceUrls || [],
    sourceCheckedAt: data.sourceCheckedAt,
    carbonKnown: data.carbonStatus !== 'unconfirmed',
    capacityKnown: data.capacityStatus !== 'unconfirmed'
  };
}

function assertCatalogBookable(service) {
  if (service.current_data?.bookingEnabled === false || service.current_data?.catalogHidden) {
    throw Object.assign(new Error('Dịch vụ chưa có xác nhận giá và tình trạng chỗ. Vui lòng liên hệ cơ sở trước khi đặt.'), { statusCode: 400 });
  }
}

function assertTourBookable(tour, { allowPersonal = false } = {}) {
  const status = String(tour?.catalog_status || '').toLowerCase();
  const isPersonalOrCustom = allowPersonal || status === 'personal' || status === 'draft' || status === 'custom' || Boolean(tour?.user_id) || Boolean(tour?.is_custom);
  const allowedStatus = isPersonalOrCustom || ['bookable', 'verified', 'active', 'editorial', 'published', ''].includes(status);
  if (tour?.booking_enabled === false || !allowedStatus) {
    throw Object.assign(new Error('Tour đang ở trạng thái tham khảo và chưa được xác minh để đặt.'), {
      statusCode: 409,
      code: 'TOUR_NOT_BOOKABLE'
    });
  }
}

module.exports = { catalogMetadata, assertCatalogBookable, assertTourBookable };
