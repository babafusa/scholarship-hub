/**
 * blog-post.js — Single post page — now fetches from Supabase.
 */
'use strict';

async function fetchPost(id) {
  try {
    const data = await window.DB.select('blog_posts', 'id=eq.' + encodeURIComponent(id) + '&limit=1');
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (err) { console.error('[ScholarHub]', err); return null; }
}

async function fetchMorePosts(excludeId) {
  try {
    const data = await window.DB.select('blog_posts', 'id=neq.' + encodeURIComponent(excludeId) + '&order=date.desc&limit=3');
    return Array.isArray(data) ? data : [];
  } catch (err) { return []; }
}

function getPostIdFromURL() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function populatePage(post, morePosts) {
  const S = window.ScholarHub;
  const titleEl = document.getElementById('postTitle');
  const metaEl  = document.getElementById('postMetaDesc');
  if (titleEl) titleEl.textContent = post.title + ' | ScholarHub';
  if (metaEl)  metaEl.setAttribute('content', post.excerpt || '');

  const heroMeta   = document.getElementById('postHeroMeta');
  const heroTitle  = document.getElementById('postHeroTitle');
  const heroByline = document.getElementById('postHeroByline');

  if (heroMeta) {
    heroMeta.innerHTML =
      '<span class="badge badge--accent">' + S.escapeHtml(post.category) + '</span>' +
      '<span style="color:var(--color-primary-300);font-size:var(--text-sm)">' + S.escapeHtml(S.formatDate(post.date)) + '</span>';
  }
  if (heroTitle)  heroTitle.textContent = post.title;
  if (heroByline) heroByline.innerHTML  = '<span>&#9200; ' + S.escapeHtml(post.read_time || '') + '</span>';

  const postBody = document.getElementById('postBody');
  if (postBody && post.content) {
    postBody.innerHTML = post.content;
    const headings = postBody.querySelectorAll('h2');
    headings.forEach((h, i) => { if (!h.id) h.id = 'section-' + i; });
    buildTableOfContents(headings);
    initScrollSpy(headings);
  }

  const morePostsEl = document.getElementById('morePosts');
  if (morePostsEl) {
    if (morePosts.length === 0) {
      const sec = morePostsEl.closest('section');
      if (sec) sec.style.display = 'none';
    } else {
      morePostsEl.innerHTML = morePosts.map(buildMiniCard).join('');
    }
  }
}

function buildTableOfContents(headings) {
  const tocEl   = document.getElementById('tableOfContents');
  const tocCard = document.getElementById('tocCard');
  if (!tocEl) return;
  if (headings.length === 0) { if (tocCard) tocCard.style.display = 'none'; return; }
  tocEl.innerHTML = Array.from(headings).map(h =>
    '<a href="#' + h.id + '" class="toc-link">' + window.ScholarHub.escapeHtml(h.textContent) + '</a>'
  ).join('');
}

function initScrollSpy(headings) {
  if (!headings.length) return;
  const tocLinks = document.querySelectorAll('.toc-link');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(link => link.classList.toggle('toc-link--active', link.getAttribute('href') === '#' + id));
      }
    });
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
  headings.forEach(h => observer.observe(h));
}

function buildMiniCard(post) {
  const S = window.ScholarHub;
  return `
    <a href="blog-post.html?id=${S.escapeHtml(post.id)}" class="blog-card" style="text-decoration:none">
      <div class="blog-card__image">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,var(--color-primary-100),var(--color-primary-200));display:flex;align-items:center;justify-content:center;font-size:2rem;">&#128218;</div>
      </div>
      <div class="blog-card__body">
        <span class="blog-card__category">${S.escapeHtml(post.category)}</span>
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

function show404() {
  const heroTitle = document.getElementById('postHeroTitle');
  const postBody  = document.getElementById('postBody');
  if (heroTitle) heroTitle.textContent = 'Post not found';
  if (postBody)  postBody.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">&#128221;</div>
      <h3 class="empty-state__title">We could not find that guide</h3>
      <p class="empty-state__text">It may have been moved or the link is incorrect.</p>
      <a href="blog.html" class="btn btn--primary" style="margin-top:var(--space-6)">Back to all guides</a>
    </div>`;
  const tocCard = document.getElementById('tocCard');
  if (tocCard) tocCard.style.display = 'none';
}

async function init() {
  const postId = getPostIdFromURL();
  if (!postId) { show404(); return; }
  const [post, morePosts] = await Promise.all([fetchPost(postId), fetchMorePosts(postId)]);
  if (!post) { show404(); return; }
  populatePage(post, morePosts);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
