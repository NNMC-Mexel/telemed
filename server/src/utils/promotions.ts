type Promotion = Record<string, any>;
type Doctor = Record<string, any>;

const toArray = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  return [];
};

const relationMatches = (items: any[], entity: any) => {
  if (!entity) return false;
  const entityId = entity.id != null ? String(entity.id) : null;
  const entityDocumentId = entity.documentId != null ? String(entity.documentId) : null;

  return items.some((item) => {
    const id = item?.id != null ? String(item.id) : null;
    const documentId = item?.documentId != null ? String(item.documentId) : null;
    return (entityId && id === entityId) || (entityDocumentId && documentId === entityDocumentId);
  });
};

const calculateEffectivePrice = (basePrice: number, promotion: Promotion) => {
  const value = Number(promotion.discountValue);
  if (!Number.isFinite(basePrice) || basePrice < 0 || !Number.isFinite(value) || value <= 0) return null;

  let effectivePrice: number | null = null;

  if (promotion.discountType === 'percentage') {
    if (value > 100) return null;
    effectivePrice = Math.round(basePrice * (100 - value) / 100);
  } else if (promotion.discountType === 'fixed_amount') {
    effectivePrice = basePrice - value;
  } else if (promotion.discountType === 'fixed_price') {
    effectivePrice = value;
  }

  if (effectivePrice == null || !Number.isFinite(effectivePrice)) return null;
  const normalizedPrice = Math.max(0, Math.round(effectivePrice));
  if (normalizedPrice <= 0 || normalizedPrice >= basePrice) return null;

  return normalizedPrice;
};

const isPromotionActiveAt = (promotion: Promotion, at: Date) => {
  if (promotion.isActive === false) return false;
  const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > at) return false;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < at) return false;
  return true;
};

const promotionAppliesToDoctor = (promotion: Promotion, doctor: Doctor) => {
  const scope = promotion.scope || 'doctors';
  if (scope === 'all') return true;

  if (scope === 'specializations') {
    return relationMatches(toArray(promotion.specializations), doctor.specialization);
  }

  return relationMatches(toArray(promotion.doctors), doctor);
};

export const getPublishedPromotions = async (strapiInstance: any) => {
  return strapiInstance.documents('api::promotion.promotion').findMany({
    filters: { isActive: true },
    status: 'published',
    populate: {
      doctors: { fields: ['id', 'documentId'] },
      specializations: { fields: ['id', 'documentId'] },
    },
    limit: 1000,
  });
};

export const getPromotionPricingFromList = (doctor: Doctor, promotions: Promotion[], at = new Date()) => {
  const basePrice = Number(doctor?.price || 0);
  const emptyPricing = {
    originalPrice: basePrice,
    effectivePrice: basePrice,
    discountAmount: 0,
    discountPercent: 0,
    activePromotion: null,
  };

  if (!doctor || !Number.isFinite(basePrice) || basePrice <= 0) return emptyPricing;

  const candidates = (promotions || [])
    .filter((promotion: Promotion) => isPromotionActiveAt(promotion, at))
    .filter((promotion: Promotion) => promotionAppliesToDoctor(promotion, doctor))
    .map((promotion: Promotion) => ({
      promotion,
      effectivePrice: calculateEffectivePrice(basePrice, promotion),
    }))
    .filter((item: any) => item.effectivePrice !== null)
    .sort((a: any, b: any) => {
      const priorityDiff = Number(b.promotion.priority || 0) - Number(a.promotion.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.effectivePrice - b.effectivePrice;
    });

  const winner = candidates[0];
  if (!winner) return emptyPricing;

  const discountAmount = basePrice - winner.effectivePrice;
  const promotion = winner.promotion;

  return {
    originalPrice: basePrice,
    effectivePrice: winner.effectivePrice,
    discountAmount,
    discountPercent: basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0,
    activePromotion: {
      id: promotion.id,
      documentId: promotion.documentId,
      title: promotion.title,
      badgeLabel: promotion.badgeLabel || 'Акция',
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      priority: promotion.priority || 0,
    },
  };
};

export const getPromotionPricing = async (strapiInstance: any, doctor: Doctor, at = new Date()) => {
  const promotions = await getPublishedPromotions(strapiInstance);
  return getPromotionPricingFromList(doctor, promotions, at);
};

export const attachPromotionPricing = (doctor: Doctor, promotions: Promotion[], at = new Date()) => {
  const pricing = getPromotionPricingFromList(doctor, promotions, at);
  return {
    ...doctor,
    originalPrice: pricing.originalPrice,
    effectivePrice: pricing.effectivePrice,
    discountAmount: pricing.discountAmount,
    discountPercent: pricing.discountPercent,
    activePromotion: pricing.activePromotion,
  };
};
