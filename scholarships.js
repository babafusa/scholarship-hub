/**
 * scholarships.js — ScholarHub
 * Homepage featured scholarships — now fetches from Supabase.
 */
'use strict';

let allScholarships = [];
let activeFilter    = 'all';
const FEATURED_LIMIT = 3;

async function fetchScholarships() {
  try {
    const data = await window.DB.select(
      'scholarships',
      'status=eq.published&order=created_at.desc&limit=50'
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[ScholarHub] fetchScholarships:', err);
    return [];
  }
}

function buildScholarshipCard(s) {
  const S          = window.ScholarHub;
  const days       = S.daysUntil(s.deadline);
  const badgeClass = S.deadlineBadgeClass(days);
  const dlLabel    = S.deadlineLabel(days, s.deadline);
  const urgentClass = (days !== null && days >= 0 && days <= 14) ? ' card__deadline--urgent' : '';

  const levelBadges = (s.level || [])
    .map(l => '<span class="badge badge--primary">' + S.escapeHtml(capitalise(l)) + '</span>')
    .join('');
  const fundingBadge = s.amount
    ? '<span class="badge badge--accent">' + S.escapeHtml(s.amount) + '</span>' : '';

  return `
    <article class="card" role="article">
      <div class="card__header">
        <div class="card__logo" aria-hidden="true">${S.escapeHtml(s.emoji || '🎓')}</div>
        <span class="badge ${badgeClass}">${S.escapeHtml(dlLabel)}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${S.escapeHtml(s.title)}</h3>
        <p class="card__org">${S.escapeHtml(s.organization)} &middot; ${S.escapeHtml(s.country_of_study || '')}</p>
        <p class="card__description">${S.escapeHtml(s.description || '')}</p>
        <div class="card__meta">${fundingBadge}${levelBadges}</div>
      </div>
      <div class="card__footer">
        <span class="card__deadline${urgentClass}">&#128197; ${S.escapeHtml(S.formatDate(s.deadline))}</span>
        <a href="${S.escapeHtml(s.link || '#')}" class="btn btn--primary btn--sm"
           target="_blank" rel="noopener noreferrer"
           aria-label="Apply for ${S.escapeHtml(s.title)}">Apply &rarr;</a>
      </div>
    </article>`;
}

function renderFeatured(scholarships, filter) {
  const container = document.getElementById('featuredScholarships');
  if (!container) return;

  let filtered = filter === 'all'
    ? scholarships.filter(s => s.featured)
    : scholarships.filter(s =>
        (s.tags   && s.tags.includes(filter)) ||
        (s.region && s.region.includes(filter)) ||
        (s.level  && s.level.includes(filter))
      );

  filtered = filtered.slice(0, FEATURED_LIMIT);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state__icon">&#128269;</div>
        <h3 class="empty-state__title">No scholarships found</h3>
        <p class="empty-state__text">Try a different category or <a href="scholarships.html">browse all</a>.</p>
      </div>`;
    return;
  }
  container.innerHTML = filtered.map(buildScholarshipCard).join('');
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

async function initScholarships() {
  allScholarships = await fetchScholarships();
  renderFeatured(allScholarships, activeFilter);

  document.addEventListener('scholarshipFilter', (e) => {
    activeFilter = e.detail.filter || 'all';
    renderFeatured(allScholarships, activeFilter);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScholarships);
} else {
  initScholarships();
}
