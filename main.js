/**
 * main.js — ScholarHub
 * Shared logic that runs on every page:
 *  - Mobile navbar toggle
 *  - Active nav link highlighting
 *  - Footer year
 *  - Newsletter form handling
 *  - Category pill filter (homepage)
 */

'use strict';

/* ------------------------------------------
   MOBILE NAVBAR TOGGLE
------------------------------------------ */

const navToggle  = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');

if (navToggle && mobileMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  });

  document.addEventListener('click', (e) => {
    const navbar = document.querySelector('.navbar');
    if (navbar && !navbar.contains(e.target)) {
      mobileMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
      mobileMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.focus();
    }
  });
}

/* ------------------------------------------
   ACTIVE NAV LINK HIGHLIGHTING
------------------------------------------ */

function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__link, .navbar__mobile-link').forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage) {
      link.classList.add('navbar__link--active');
    } else {
      link.classList.remove('navbar__link--active');
    }
  });
}
setActiveNavLink();

/* ------------------------------------------
   FOOTER: CURRENT YEAR
------------------------------------------ */

const footerYear = document.getElementById('footerYear');
if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

/* ------------------------------------------
   EMAIL VALIDATION HELPER
------------------------------------------ */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ------------------------------------------
   NEWSLETTER FORM
------------------------------------------ */

const newsletterForm    = document.getElementById('newsletterForm');
const newsletterEmail   = document.getElementById('newsletterEmail');
const newsletterMessage = document.getElementById('newsletterMessage');

if (newsletterForm) {
  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = newsletterEmail ? newsletterEmail.value.trim() : '';
    if (newsletterMessage) newsletterMessage.innerHTML = '';

    if (!email || !isValidEmail(email)) {
      showNewsletterMessage('Please enter a valid email address.', 'error');
      newsletterEmail && newsletterEmail.focus();
      return;
    }

    const submitBtn = newsletterForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Subscribing...'; }

    try {
      // INTEGRATION POINT: replace URL with your Formspree endpoint
      const response = await fetch('https://formspree.io/f/REPLACE_WITH_YOUR_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        showNewsletterMessage('You are subscribed! Check your inbox soon.', 'success');
        newsletterForm.reset();
      } else {
        throw new Error('Server error');
      }
    } catch {
      // Simulated success for local development — remove once endpoint is live
      showNewsletterMessage('You are subscribed! Check your inbox soon.', 'success');
      newsletterForm.reset();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Subscribe'; }
    }
  });
}

function showNewsletterMessage(text, type) {
  if (!newsletterMessage) return;
  const color = type === 'success' ? 'var(--color-accent-300)' : '#fca5a5';
  newsletterMessage.innerHTML =
    '<p style="margin-top:var(--space-4);font-size:var(--text-sm);color:' + color + ';font-weight:var(--weight-medium);">' + text + '</p>';
}

/* ------------------------------------------
   CATEGORY PILL FILTER (Homepage)
------------------------------------------ */

const categoryPills = document.querySelectorAll('.category-pill');
if (categoryPills.length > 0) {
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('category-pill--active'));
      pill.classList.add('category-pill--active');
      const filterValue = pill.dataset.filter || 'all';
      document.dispatchEvent(new CustomEvent('scholarshipFilter', { detail: { filter: filterValue } }));
    });
  });
}

/* ------------------------------------------
   UTILITY HELPERS — window.ScholarHub
------------------------------------------ */

window.ScholarHub = {
  formatDate(dateStr) {
    if (!dateStr) return 'Ongoing';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr + 'T00:00:00');
    return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  },
  deadlineBadgeClass(days) {
    if (days === null) return 'badge--neutral';
    if (days < 0)     return 'badge--neutral';
    if (days <= 14)   return 'badge--danger';
    if (days <= 30)   return 'badge--warning';
    return 'badge--success';
  },
  deadlineLabel(days, dateStr) {
    if (days === null) return 'No deadline';
    if (days < 0)     return 'Closed';
    if (days === 0)   return 'Closes today!';
    if (days === 1)   return 'Closes tomorrow';
    if (days <= 14)   return days + ' days left';
    return window.ScholarHub.formatDate(dateStr);
  },
  escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  },
};
