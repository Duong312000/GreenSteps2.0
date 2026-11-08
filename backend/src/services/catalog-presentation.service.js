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

module.exports = { catalogMetadata, assertCatalogBookable };
