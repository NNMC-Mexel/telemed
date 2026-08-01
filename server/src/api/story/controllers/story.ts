/**
 * story controller.
 */

import { factories } from '@strapi/strapi';

const UID = 'api::story.story' as any;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

// Stories autoplay in a full-screen viewer, so an image slide needs an explicit
// dwell time. Videos use their own duration and ignore this.
const DEFAULT_DURATION = 8;

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
        }
      : null,
  };
}

function toPublicStory(entry: any) {
  const media = entry.media;
  const isVideo = Boolean(media?.mime?.startsWith('video/'));

  return {
    id: entry.documentId || entry.id,
    title: entry.title,
    // The circle falls back to the media itself when no dedicated poster was
    // uploaded — an image story does not need two assets.
    poster: toMedia(entry.poster) || (isVideo ? null : toMedia(media)),
    media: toMedia(media),
    isVideo,
    durationSeconds: entry.durationSeconds || DEFAULT_DURATION,
    linkUrl: entry.linkUrl || null,
    linkLabel: entry.linkLabel || null,
    publishAt: entry.publishAt || entry.publishedAt || null,
  };
}

const visibleNowFilter = () => {
  const now = new Date().toISOString();
  return {
    $and: [
      { isActive: true },
      { $or: [{ publishAt: { $null: true } }, { publishAt: { $lte: now } }] },
      { $or: [{ expiresAt: { $null: true } }, { expiresAt: { $gte: now } }] },
    ],
  };
};

export default factories.createCoreController(UID, () => ({
  /**
   * GET /api/stories/public/list
   *
   * The story reel for the landing page, newest-relevant first. Anonymous, so
   * it returns a curated projection rather than the raw entity.
   */
  async publicList(ctx) {
    const requested = Number.parseInt(ctx.query?.limit as string, 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const entries = await strapi.documents(UID).findMany({
      status: 'published',
      filters: visibleNowFilter(),
      sort: ['priority:desc', 'publishAt:desc', 'createdAt:desc'],
      populate: { poster: true, media: true },
      limit,
    } as any);

    // A story without media has nothing to play; drop it rather than render a
    // circle that opens into a black screen.
    return { data: (entries || []).map(toPublicStory).filter((s) => s.media) };
  },
}));
