// Internal app — never crawled, never indexed. No settings lookup: there is no
// configuration in which an admin/staff surface belongs in a search index.
export default function robots() {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
