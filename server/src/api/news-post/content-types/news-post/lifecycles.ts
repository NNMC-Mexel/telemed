/**
 * Slug generation for news posts.
 *
 * Strapi only auto-fills a `uid` field from its own admin UI — anything written
 * through the content API (our /admin/news page, seeds, imports) arrives with
 * `slug: null`. The article URL is the whole point of the detail view, so the
 * slug is generated here instead, where every writer goes through it.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Kazakh-specific letters.
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

const slugify = (value: string): string =>
  String(value)
    .toLowerCase()
    .split('')
    .map((char) => (char in CYRILLIC_MAP ? CYRILLIC_MAP[char] : char))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

/**
 * Appends a counter only when a *different* document already holds the slug.
 *
 * Draft & publish stores two rows per document, so the published copy would
 * otherwise collide with its own draft. It never reaches this function: by then
 * `data.slug` is already set and the caller skips generation entirely.
 */
async function uniqueSlug(base: string): Promise<string> {
  const fallback = base || 'news';
  let candidate = fallback;
  let suffix = 2;

  // A handful of attempts is plenty; the counter only grows on real collisions
  // between distinct posts that share a title.
  while (suffix < 50) {
    const existing = await strapi
      .query('api::news-post.news-post')
      .findOne({ where: { slug: candidate }, select: ['id'] });

    if (!existing) return candidate;
    candidate = `${fallback}-${suffix}`;
    suffix += 1;
  }

  return `${fallback}-${Date.now()}`;
}

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    if (data.slug || !data.title) return;
    data.slug = await uniqueSlug(slugify(data.title));
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;
    // Only fill a missing slug. Rewriting it when an editor fixes a typo in the
    // title would silently break every link already shared.
    if (data.slug || !data.title) return;
    data.slug = await uniqueSlug(slugify(data.title));
  },
};
