/**
 * blog.js — Homepage blog preview — now fetches from Supabase.
 */
'use strict';

async function initBlog() {
  const container = document.getElementById('latestPosts');
  if (!container) return;

  try {
    const posts = await window.DB.select('blog_posts', 'status=eq.published&featured=eq.true&order=date.desc&limit=3');
    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p class="empty-state__text">Guides coming soon.</p></div>';
      return;
    }
    container.innerHTML = posts.map(buildBlogCard).join('');
  } catch (err) {
    console.error('[ScholarHub] blog.js:', err);
  }
}

function buildBlogCard(post) {
  const S = window.ScholarHub;
  const imageContent = post.image
    ? '<img src="' + S.escapeHtml(post.image) + '" alt="' + S.escapeHtml(post.title) + '" loading="lazy" />'
    : '<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--color-primary-100),var(--color-primary-200));display:flex;align-items:center;justify-content:center;font-size:2.5rem;">&#128218;</div>';

  return `
    <a href="blog-post.html?id=${S.escapeHtml(post.id)}" class="blog-card" style="text-decoration:none">
      <div class="blog-card__image">${imageContent}</div>
      <div class="blog-card__body">
        <span class="blog-card__category">${S.escapeHtml(post.category || '')}</span>
        <h3 class="blog-card__title">${S.escapeHtml(post.title)}</h3>
        <p class="blog-card__excerpt">${S.escapeHtml(post.excerpt || '')}</p>
        <div class="blog-card__meta">
          <span>&#128197; ${S.escapeHtml(S.formatDate(post.date))}</span>
          <span>&middot;</span>
          <span>&#9200; ${S.escapeHtml(post.read_time || '')}</span>
        </div>
      </div>
    </a>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBlog);
} else {
  initBlog();
}
