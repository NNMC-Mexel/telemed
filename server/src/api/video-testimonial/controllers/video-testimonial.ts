/**
 * video-testimonial controller.
 *
 * Public responses are deliberately projected: consent audit fields and CMS
 * scheduling metadata never leave the server.
 */

import { factories } from '@strapi/strapi';

const UID = 'api::video-testimonial.video-testimonial' as any;
const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 24;

function toMedia(file: any) {
  if (!file) return null;
  return {
    url: file.url,
    mime: file.mime || null,
    width: file.width ?? null,
    height: file.height ?? null,
    alternativeText: file.alternativeText || null,
    formats: file.formats
      ? {
          thumbnail: file.formats.thumbnail?.url || null,
          small: file.formats.small?.url || null,
          medium: file.formats.medium?.url || null,
          large: file.formats.large?.url || null,
        }
      : null,
  };
}

function toPublicTestimonial(entry: any) {
  return {
    id: entry.documentId || entry.id,
    patientName: entry.patientName,
    patientInitials: entry.patientInitials || null,
    title: entry.title,
    quote: entry.quote || null,
    specialty: entry.specialty || null,
    durationSeconds: entry.durationSeconds || null,
    video: toMedia(entry.video),
    poster: toMedia(entry.poster),
  };
}

const visibleNowFilter = () => {
  const now = new Date().toISOString();
  return {
    $and: [
      { isActive: true },
      { consentConfirmed: true },
      { consentRecordedAt: { $notNull: true } },
      { $or: [{ publishAt: { $null: true } }, { publishAt: { $lte: now } }] },
      { $or: [{ expiresAt: { $null: true } }, { expiresAt: { $gte: now } }] },
    ],
  };
};

export default factories.createCoreController(UID, () => ({
  /** GET /api/video-testimonials/public/list */
  async publicList(ctx) {
    const requested = Number.parseInt(ctx.query?.limit as string, 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const entries = await strapi.documents(UID).findMany({
      status: 'published',
      filters: visibleNowFilter(),
      sort: ['priority:desc', 'publishAt:desc', 'createdAt:desc'],
      populate: { video: true, poster: true },
      limit,
    } as any);

    const testimonials = (entries || [])
      .map(toPublicTestimonial)
      .filter((testimonial) => testimonial.video?.url);

    return { data: testimonials };
  },
}));
