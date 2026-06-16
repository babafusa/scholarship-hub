/**
 * deadlines.js — Deadline tracker — now fetches from Supabase.
 */
'use strict';

let allScholarships = [];
let activeStatus    = 'all';
let sortOrder       = 'deadline-asc';

const deadlineList = document.getElementById('deadlineList');
const dlCount      = document.getElementById('dlCount');
const dlSort       = document.getElementById('dlSort');
const statOpen     = document.getElementById('statOpen');
const statSoon     = document.getElementById('statSoon');
const statClosed   = document.getElementById('statClosed');
const pills        = document.querySelectorAll('.dl-pill');

async function fetchScholarships() {
  try {
    const data = await window.DB.select('scholarships', 'status=eq.published&order=deadline.asc.nullslast&limit=200');
    return Array.isArray(data) ? data : [];
  } catch (err) { console.error('[ScholarHub]', err); return []; }
}

function getStatus(days) {
  if (days === null) return 'open';
  if (days < 0)      return 'closed';
  if (days <= 14)    return 'urgent';
  if (days <= 30)    return 'soon';
  return 'open';
}

function getStatusLabel(status) {
  return { open: 'Open', soon: 'Closing Soon', urgent: 'Urgent', closed: 'Closed' }[status] || 'Open';
}

function getStatusBadgeClass(status) {
  return { open: 'badge--success', soon: 'badge--warning', urgent: 'badge--danger', closed: 'badge--neutral' }[status] || 'badge--neutral';
}

function buildCountdown(days, status) {
  if (status === 'closed') return '<span class="dl-countdown--closed">Applications closed</span>';
  if (days === null) return '<span class="dl-countdown--closed" style="color:var(--color-success);font-style:normal;font-weight:600;">Rolling deadline</span>';
  if (days === 0)    return '<span class="dl-countdown--closed" style="color:var(--color-danger);font-style:normal;font-weight:600;">Closes today!</span>';

  let html = '<div class="dl-countdown">';
  html += '<div class="dl-countdown__unit"><span class="dl-countdown__number">' + days + '</span><span class="dl-countdown__label">' + (days === 1 ? 'Day' : 'Days') + '</span></div>';
  html += '</div>';
  return html;
}

function buildProgressBar(days, status) {
  if (status === 'closed') return '<div class="dl-progress"><div class="dl-progress__label"><span>Progress</span><span>100%</span></div><div class="dl-progress__bar"><div class="dl-progress__fill" style="width:100%"></div></div></div>';
  if (days === null) return '<div class="dl-progress"><div class="dl-progress__label"><span>Rolling deadline</span><span>—</span></div><div class="dl-progress__bar"><div class="dl-progress__fill" style="width:30%;background:var(--color-success)"></div></div></div>';
  const pct = Math.min(100, Math.round(((180 - Math.max(0, days)) / 180) * 100));
  return '<div class="dl-progress"><div class="dl-progress__label"><span>Window used</span><span>' + pct + '%</span></div><div class="dl-progress__bar"><div class="dl-progress__fill" style="width:' + pct + '%"></div></div></div>';
}

function buildCard(s) {
  const S      = window.ScholarHub;
  const days   = S.daysUntil(s.deadline);
  const status = getStatus(days);
  const levelBadges  = (s.level || []).map(l => '<span class="badge badge--primary">' + S.escapeHtml(capitalise(l)) + '</span>').join('');
  const fundingBadge = s.amount ? '<span class="badge badge--accent">' + S.escapeHtml(s.amount) + '</span>' : '';
  const applyBtn = status === 'closed'
    ? '<button class="btn btn--ghost btn--sm" disabled style="opacity:0.5;cursor:not-allowed">Closed</button>'
    : '<a href="' + S.escapeHtml(s.link || '#') + '" class="btn btn--primary btn--sm" target="_blank" rel="noopener noreferrer">Apply &rarr;</a>';

  return `
    <div class="dl-card dl-card--${status}" role="article">
      <div class="dl-card__top">
        <div class="dl-card__logo" aria-hidden="true">${S.escapeHtml(s.emoji || '🎓')}</div>
        <div class="dl-card__info">
          <div class="dl-card__title">${S.escapeHtml(s.title)}</div>
          <div class="dl-card__org">${S.escapeHtml(s.organization)} &middot; ${S.escapeHtml(s.country_of_study || '')}</div>
        </div>
        <div class="dl-card__badge"><span class="badge ${getStatusBadgeClass(status)}">${getStatusLabel(status)}</span></div>
      </div>
      <div class="dl-card__countdown">
        ${buildCountdown(days, status)}
        ${buildProgressBar(days, status)}
      </div>
      <div class="dl-card__bottom">
        <div class="dl-card__tags">
          ${fundingBadge}${levelBadges}
          <span class="badge badge--neutral">&#128197; ${S.escapeHtml(S.formatDate(s.deadline))}</span>
        </div>
        ${applyBtn}
      </div>
    </div>`;
}

function capitalise(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function getProcessed() {
  let list = allScholarships.map(s => {
    const days = window.ScholarHub.daysUntil(s.deadline);
    return { ...s, _days: days, _status: getStatus(days) };
  });

  if (activeStatus !== 'all') {
    if (activeStatus === 'open')   list = list.filter(s => s._status !== 'closed');
    else if (activeStatus === 'soon') list = list.filter(s => s._status === 'soon' || s._status === 'urgent');
    else list = list.filter(s => s._status === activeStatus);
  }

  list.sort((a, b) => {
    if (sortOrder === 'az') return (a.title || '').localeCompare(b.title || '');
    if (sortOrder === 'deadline-desc') {
      const dA = a.deadline ? new Date(a.deadline) : new Date(0);
      const dB = b.deadline ? new Date(b.deadline) : new Date(0);
      return dB - dA;
    }
    const dA = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
    const dB = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
    return dA - dB;
  });
  return list;
}

function updateStats() {
  const statuses = allScholarships.map(s => getStatus(window.ScholarHub.daysUntil(s.deadline)));
  if (statOpen)   statOpen.textContent   = statuses.filter(s => s !== 'closed').length;
  if (statSoon)   statSoon.textContent   = statuses.filter(s => s === 'soon' || s === 'urgent').length;
  if (statClosed) statClosed.textContent = statuses.filter(s => s === 'closed').length;
}

function render() {
  const list = getProcessed();
  if (dlCount) {
    dlCount.innerHTML = list.length === 0
      ? 'No scholarships match this filter.'
      : 'Showing <strong>' + list.length + '</strong> of <strong>' + allScholarships.length + '</strong> scholarships';
  }
  if (!deadlineList) return;
  deadlineList.innerHTML = list.length === 0
    ? '<div class="empty-state"><div class="empty-state__icon">📭</div><h3 class="empty-state__title">Nothing here</h3><p class="empty-state__text">Try a different filter.</p></div>'
    : list.map(buildCard).join('');
}

pills.forEach(pill => {
  pill.addEventListener('click', () => {
    pills.forEach(p => p.classList.remove('dl-pill--active'));
    pill.classList.add('dl-pill--active');
    activeStatus = pill.dataset.status || 'all';
    render();
  });
});

if (dlSort) dlSort.addEventListener('change', e => { sortOrder = e.target.value; render(); });

async function init() {
  allScholarships = await fetchScholarships();
  updateStats();
  render();
  setInterval(() => { render(); updateStats(); }, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
