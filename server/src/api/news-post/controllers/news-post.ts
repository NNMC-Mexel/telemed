/**
 * news-post controller.
 */

import { factories } from '@strapi/strapi';

const UID = 'api::news-post.news-post' as any;

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 24;

/**
 * The landing block is unauthenticated, so it gets an explicit projection
 * instead of the raw entity. Draft copy, internal scheduling fields and the
 * full media object never reach an anonymous visitor.
 */
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
          small: file.formats.small?.url || null,
          medium: file.formats.medium?.url || null,
          large: file.formats.large?.url || null,
        }
      : null,
  };
}

function toPublicCard(entry: any) {
  const cover = entry.cover;

  return {
    id: entry.documentId || entry.id,
    title: entry.title,
    excerpt: entry.excerpt || null,
    slug: entry.slug || null,
    kind: entry.kind || 'news',
    badgeLabel: entry.badgeLabel || null,
    linkUrl: entry.linkUrl || null,
    linkLabel: entry.linkLabel || null,
    publishAt: entry.publishAt || entry.publishedAt || null,
    isPinned: Boolean(entry.isPinned),
    // Lets the card link straight to the detail view without a second request
    // just to discover whether there is anything worth opening.
    hasBody: Boolean(entry.body && String(entry.body).trim()),
    cover: toMedia(cover),
  };
}

/** The card projection plus the long-form fields the detail view needs. */
function toPublicDetail(entry: any) {
  return {
    ...toPublicCard(entry),
    body: entry.body || null,
    video: toMedia(entry.video),
    expiresAt: entry.expiresAt || null,
  };
}

/**
 * "Live right now": published, flagged active and inside its scheduling window.
 * Shared by the list and the detail lookup so a post can never be readable at
 * its own URL after it has been unpublished or has expired.
 */
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

const VISIBLE_SORT = ['isPinned:desc', 'priority:desc', 'publishAt:desc', 'createdAt:desc'];

export default factories.createCoreController(UID, () => ({
  /**
   * GET /api/news-posts/public/list
   *
   * The cards the landing page should show right now. Pinned items lead, then
   * priority, then recency.
   */
  async publicList(ctx) {
    const requested = Number.parseInt(ctx.query?.limit as string, 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const entries = await strapi.documents(UID).findMany({
      status: 'published',
      filters: visibleNowFilter(),
      sort: VISIBLE_SORT,
      populate: { cover: true },
      limit,
    } as any);

    return { data: (entries || []).map(toPublicCard) };
  },

  /**
   * GET /api/news-posts/public/by-slug/:slug
   *
   * Backs both the routed modal and the standalone article page, so a shared
   * link and an in-page open render from exactly the same payload.
   */
  async publicBySlug(ctx) {
    const { slug } = ctx.params;
    if (!slug) return ctx.badRequest('slug is required');

    const [entry] = await strapi.documents(UID).findMany({
      status: 'published',
      filters: { $and: [{ slug }, visibleNowFilter()] },
      populate: { cover: true, video: true },
      limit: 1,
    } as any);

    if (!entry) return ctx.notFound('News post not found');

    return { data: toPublicDetail(entry) };
  },
}));
