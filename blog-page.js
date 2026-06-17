/**
 * blog-page.js — Blog index page — now fetches from Supabase.
 */
'use strict';

let allPosts       = [];
let activeCategory = 'all';
let searchQuery    = '';
let currentImageMap = new Map();

const featuredPostEl    = document.getElementById('featuredPost');
const blogGrid          = document.getElementById('blogGrid');
const blogResultsCount  = document.getElementById('blogResultsCount');
const blogSearchInput   = document.getElementById('blogSearch');
const categoryTabs      = document.querySelectorAll('.blog-tab');

async function fetchPosts() {
  try {
    const data = await window.DB.select('blog_posts', 'status=eq.published&order=date.desc&limit=100');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[ScholarHub]', err);
    return [];
  }
}

function testImage(url) {
  return new Promise(resolve => {
    if (!url) { resolve(false); return; }
    const img = new Image();
    img.onload  = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function buildImageMap(posts) {
  const results = await Promise.all(posts.map(p => testImage(p.image).then(ok => [p.id, ok])));
  return new Map(results);
}

function getCategoryEmoji(category) {
  const map = { 'Application Tips': '✏️', 'Scholarship Lists': '🎓', 'Guides': '📘', 'Interviews': '🎤' };
  return map[category] || '📘';
}

function getFilteredPosts() {
  let results = [...allPosts];
  if (activeCategory !== 'all') results = results.filter(p => p.category === activeCategory);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    results = results.filter(p =>
      (p.title    && p.title.toLowerCase().includes(q)) ||
      (p.excerpt  && p.excerpt.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }
  return results;
}

function buildImageContent(post, imageWorks) {
  const S = window.ScholarHub;
  return imageWorks
    ? '<img src="' + S.escapeHtml(post.image) + '" alt="' + S.escapeHtml(post.title) + '" loading="lazy" />'
    : '<div class="img-fallback" aria-hidden="true">' + getCategoryEmoji(post.category) + '</div>';
}

function buildFeaturedCard(post, imageWorks) {
  const S = window.ScholarHub;
  return `
    <a href="blog-post.html?id=${S.escapeHtml(post.id)}" class="featured-post" aria-label="Read: ${S.escapeHtml(post.title)}">
      <div class="featured-post__image">${buildImageContent(post, imageWorks)}</div>
      <div class="featured-post__body">
        <div class="featured-post__label">
          <span class="badge badge--accent">${S.escapeHtml(post.category)}</span>
          <span class="badge badge--primary">Featured</span>
        </div>
        <h2 class="featured-post__title">${S.escapeHtml(post.title)}</h2>
        <p class="featured-post__excerpt">${S.escapeHtml(post.excerpt || '')}</p>
        <div class="featured-post__meta">
          <span>📅 ${S.escapeHtml(S.formatDate(post.date))}</span>
          <span>&middot;</span>
          <span>⏰ ${S.escapeHtml(post.read_time || '')}</span>
        </div>
      </div>
    </a>`;
}

function buildBlogCard(post, imageWorks) {
  const S = window.ScholarHub;
  return `
    <a href="blog-post.html?id=${S.escapeHtml(post.id)}" class="blog-card" style="text-decoration:none">
      <div class="blog-card__image">${buildImageContent(post, imageWorks)}</div>
      <div class="blog-card__body">
        <span class="blog-card__category">${S.escapeHtml(post.category)}</span>
        <h3 class="blog-card__title">${S.escapeHtml(post.title)}</h3>
        <p class="blog-card__excerpt">${S.escapeHtml(post.excerpt || '')}</p>
        <div class="blog-card__meta">
          <span>📅 ${S.escapeHtml(S.formatDate(post.date))}</span>
          <span>&middot;</span>
          <span>⏰ ${S.escapeHtml(post.read_time || '')}</span>
        </div>
      </div>
    </a>`;
}

function render(imageMap) {
  const filtered = getFilteredPosts();
  if (blogResultsCount) {
    blogResultsCount.innerHTML = filtered.length === 0 ? 'No guides found.'
      : '<strong>' + filtered.length + '</strong> guide' + (filtered.length !== 1 ? 's' : '');
  }
  if (featuredPostEl) {
    if (filtered.length > 0) {
      const fp = filtered[0];
      featuredPostEl.innerHTML = buildFeaturedCard(fp, imageMap.get(fp.id) === true);
      featuredPostEl.style.display = '';
    } else {
      featuredPostEl.innerHTML = '';
      featuredPostEl.style.display = 'none';
    }
  }
  if (blogGrid) {
    const gridPosts = filtered.slice(1);
    blogGrid.innerHTML = gridPosts.length === 0 && filtered.length === 0
      ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__icon">📝</div><h3 class="empty-state__title">No guides found</h3><p class="empty-state__text">Try a different category.</p></div>'
      : gridPosts.map(p => buildBlogCard(p, imageMap.get(p.id) === true)).join('');
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function injectFallbackStyles() {
  const style = document.createElement('style');
  style.textContent = '.img-fallback{width:100%;height:100%;background:linear-gradient(135deg,var(--color-primary-100),var(--color-primary-200));display:flex;align-items:center;justify-content:center;font-size:2.5rem;}';
  document.head.appendChild(style);
}

function attachListeners() {
  if (blogSearchInput) {
    blogSearchInput.addEventListener('input', debounce(e => { searchQuery = e.target.value; render(currentImageMap); }, 250));
  }
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => { t.classList.remove('blog-tab--active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('blog-tab--active');
      tab.setAttribute('aria-selected', 'true');
      activeCategory = tab.dataset.category || 'all';
      render(currentImageMap);
    });
  });
}

async function init() {
  injectFallbackStyles();
  allPosts = await fetchPosts();
  currentImageMap = await buildImageMap(allPosts);
  attachListeners();
  render(currentImageMap);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
