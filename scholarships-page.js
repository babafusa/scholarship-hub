/**
 * scholarships-page.js — ScholarHub
 * Full listings page — now fetches from Supabase.
 */
'use strict';

let allScholarships = [];
let searchQuery     = '';
let activeFilters   = { level: [], region: [], funding: [], deadline: [] };
let sortOrder       = 'deadline';

const resultsGrid     = document.getElementById('scholarshipResults');
const resultsCount    = document.getElementById('resultsCount');
const searchInput     = document.getElementById('scholarshipSearch');
const sortSelect      = document.getElementById('sortSelect');
const clearBtn        = document.getElementById('clearFilters');
const activeFiltersEl = document.getElementById('activeFilters');
const filterToggle    = document.getElementById('filterToggle');
const filterPanel     = document.getElementById('filterPanel');
const activeCountEl   = document.getElementById('activeFilterCount');
const checkboxes      = document.querySelectorAll('.filter-checkbox');

async function fetchScholarships() {
  try {
    const data = await window.DB.select('scholarships', 'order=created_at.desc&limit=200');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[ScholarHub]', err);
    return [];
  }
}

function applyFiltersAndSearch() {
  let results = [...allScholarships];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    results = results.filter(s =>
      (s.title         && s.title.toLowerCase().includes(q)) ||
      (s.organization  && s.organization.toLowerCase().includes(q)) ||
      (s.description   && s.description.toLowerCase().includes(q)) ||
      (s.country_of_study && s.country_of_study.toLowerCase().includes(q)) ||
      (s.tags          && s.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  if (activeFilters.level.length > 0)
    results = results.filter(s => s.level && s.level.some(l => activeFilters.level.includes(l)));

  if (activeFilters.region.length > 0)
    results = results.filter(s => s.region && s.region.some(r => activeFilters.region.includes(r)));

  if (activeFilters.funding.length > 0) {
    results = results.filter(s => {
      const amount = (s.amount || '').toLowerCase();
      return activeFilters.funding.some(f => {
        if (f === 'fully-funded') return amount.includes('fully');
        if (f === 'partial')      return amount.includes('partial');
        return false;
      });
    });
  }

  if (activeFilters.deadline.length > 0) {
    results = results.filter(s => {
      const days = window.ScholarHub.daysUntil(s.deadline);
      return activeFilters.deadline.some(d => {
        if (d === 'open')         return days === null || days >= 0;
        if (d === 'closing-soon') return days !== null && days >= 0 && days <= 30;
        return false;
      });
    });
  }

  return sortResults(results, sortOrder);
}

function sortResults(list, order) {
  return [...list].sort((a, b) => {
    if (order === 'az') return (a.title || '').localeCompare(b.title || '');
    if (order === 'za') return (b.title || '').localeCompare(a.title || '');
    const dA = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
    const dB = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
    return dA - dB;
  });
}

function buildCard(s) {
  const S           = window.ScholarHub;
  const days        = S.daysUntil(s.deadline);
  const badgeClass  = S.deadlineBadgeClass(days);
  const dlLabel     = S.deadlineLabel(days, s.deadline);
  const urgentClass = (days !== null && days >= 0 && days <= 14) ? ' card__deadline--urgent' : '';
  const levelBadges = (s.level || []).map(l => '<span class="badge badge--primary">' + S.escapeHtml(capitalise(l)) + '</span>').join('');
  const fundingBadge = s.amount ? '<span class="badge badge--accent">' + S.escapeHtml(s.amount) + '</span>' : '';

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
           target="_blank" rel="noopener noreferrer">Apply &rarr;</a>
      </div>
    </article>`;
}

function capitalise(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function render() {
  const results = applyFiltersAndSearch();
  if (resultsCount) {
    resultsCount.innerHTML = results.length === 0
      ? 'No scholarships match your search.'
      : '<strong>' + results.length + '</strong> of <strong>' + allScholarships.length + '</strong> scholarships';
  }
  if (!resultsGrid) return;
  if (results.length === 0) {
    resultsGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__icon">&#128269;</div><h3 class="empty-state__title">No results found</h3><p class="empty-state__text">Try different keywords or clear your filters.</p></div>`;
  } else {
    resultsGrid.innerHTML = results.map(buildCard).join('');
  }
  renderActiveFilterTags();
  updateActiveFilterCount();
}

function renderActiveFilterTags() {
  if (!activeFiltersEl) return;
  const tags = [];
  Object.entries(activeFilters).forEach(([group, values]) => {
    values.forEach(val => {
      tags.push('<button class="filter-tag" data-group="' + group + '" data-value="' + val + '">' +
        capitalise(val.replace(/-/g, ' ')) + ' <span class="filter-tag__remove" aria-hidden="true">&#x2715;</span></button>');
    });
  });
  activeFiltersEl.innerHTML = tags.join('');
  activeFiltersEl.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const group = tag.dataset.group;
      const value = tag.dataset.value;
      activeFilters[group] = activeFilters[group].filter(v => v !== value);
      const cb = document.querySelector('.filter-checkbox[name="' + group + '"][value="' + value + '"]');
      if (cb) cb.checked = false;
      render();
    });
  });
}

function updateActiveFilterCount() {
  if (!activeCountEl) return;
  const total = Object.values(activeFilters).flat().length;
  activeCountEl.textContent = total;
  activeCountEl.hidden = total === 0;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

if (filterToggle && filterPanel) {
  filterToggle.addEventListener('click', () => {
    const isOpen = filterPanel.classList.toggle('is-open');
    filterToggle.setAttribute('aria-expanded', String(isOpen));
  });
}
if (searchInput)  searchInput.addEventListener('input', debounce(e => { searchQuery = e.target.value; render(); }, 250));
if (sortSelect)   sortSelect.addEventListener('change', e => { sortOrder = e.target.value; render(); });
if (clearBtn)     clearBtn.addEventListener('click', () => {
  activeFilters = { level: [], region: [], funding: [], deadline: [] };
  checkboxes.forEach(cb => { cb.checked = false; });
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  render();
});
checkboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    const { name: group, value, checked } = cb;
    if (checked) { if (!activeFilters[group].includes(value)) activeFilters[group].push(value); }
    else          { activeFilters[group] = activeFilters[group].filter(v => v !== value); }
    render();
  });
});

async function init() {
  allScholarships = await fetchScholarships();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
