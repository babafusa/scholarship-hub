/**
 * admin.js — ScholarHub Admin Dashboard
 * Updated with Drafts tab and publish workflow.
 */
'use strict';

let editingScholarshipId = null;
let editingPostId        = null;
let scholarships         = [];
let posts                = [];
let drafts               = [];

/* ------------------------------------------
   LOGIN
------------------------------------------ */

const loginBtn       = document.getElementById('loginBtn');
const loginEmail     = document.getElementById('loginEmail');
const loginPassword  = document.getElementById('loginPassword');
const loginError     = document.getElementById('loginError');
const loginScreen    = document.getElementById('loginScreen');
const adminApp       = document.getElementById('adminApp');
const adminUserEmail = document.getElementById('adminUserEmail');

function showLoginError(msg) {
  loginError.textContent   = msg;
  loginError.style.display = 'block';
}

async function handleLogin() {
  const email    = loginEmail.value.trim();
  const password = loginPassword.value;
  loginError.style.display = 'none';
  loginBtn.textContent = 'Signing in...';
  loginBtn.disabled    = true;
  try {
    await window.Auth.signIn(email, password);
    showApp();
  } catch (err) {
    showLoginError(err.message || 'Invalid email or password.');
  } finally {
    loginBtn.textContent = 'Sign In';
    loginBtn.disabled    = false;
  }
}

loginBtn.addEventListener('click', handleLogin);
loginEmail.addEventListener('keydown',    e => { if (e.key === 'Enter') loginPassword.focus(); });
loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

/* ------------------------------------------
   APP INIT
------------------------------------------ */

function showApp() {
  loginScreen.style.display = 'none';
  adminApp.style.display    = 'grid';
  window.Auth.getUser().then(user => {
    if (adminUserEmail && user) adminUserEmail.textContent = user.email;
  });
  loadScholarships();
  loadDrafts();
  loadPosts();
}

window.Auth.isLoggedIn().then(loggedIn => { if (loggedIn) showApp(); });

/* ------------------------------------------
   LOGOUT
------------------------------------------ */

document.getElementById('logoutBtn').addEventListener('click', () => {
  window.Auth.signOut();
  loginScreen.style.display = 'flex';
  adminApp.style.display    = 'none';
  loginEmail.value          = '';
  loginPassword.value       = '';
});

/* ------------------------------------------
   TAB NAVIGATION
------------------------------------------ */

document.querySelectorAll('.admin-nav__item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav__item').forEach(i => i.classList.remove('admin-nav__item--active'));
    item.classList.add('admin-nav__item--active');
    const tab = item.dataset.tab;
    document.getElementById('tab-scholarships').style.display = tab === 'scholarships' ? '' : 'none';
    document.getElementById('tab-drafts').style.display       = tab === 'drafts'       ? '' : 'none';
    document.getElementById('tab-posts').style.display        = tab === 'posts'        ? '' : 'none';
  });
});

/* ------------------------------------------
   ALERT
------------------------------------------ */

function showAlert(msg, type = 'success') {
  const el = document.getElementById('adminAlert');
  el.textContent   = msg;
  el.className     = 'admin-alert admin-alert--' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* ------------------------------------------
   HELPERS
------------------------------------------ */

function parseCSV(str) {
  return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today    = new Date(); today.setHours(0,0,0,0);
  const deadline = new Date(dateStr + 'T00:00:00');
  return Math.ceil((deadline - today) / 86400000);
}

function statusBadge(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null)  return '<span class="badge badge--success">Open</span>';
  if (days < 0)       return '<span class="badge badge--neutral">Closed</span>';
  if (days <= 14)     return '<span class="badge badge--danger">Urgent</span>';
  if (days <= 30)     return '<span class="badge badge--warning">Closing Soon</span>';
  return '<span class="badge badge--success">Open</span>';
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])
  );
}

/* ------------------------------------------
   DRAFTS TAB — AI-generated scholarship drafts
------------------------------------------ */

async function loadDrafts() {
  const tbody = document.getElementById('draftsTableBody');
  const badge = document.getElementById('draftsBadge');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="admin-table__loading">Loading drafts...</td></tr>';

  try {
    const data = await window.DB.select('scholarships', 'status=eq.draft&order=created_at.desc');
    drafts = Array.isArray(data) ? data : [];

    // Update badge count
    if (badge) {
      badge.textContent = drafts.length;
      badge.style.display = drafts.length > 0 ? 'inline-flex' : 'none';
    }

    renderDraftsTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-table__loading">Error loading drafts.</td></tr>';
    showAlert('Failed to load drafts: ' + err.message, 'error');
  }
}

function renderDraftsTable() {
  const tbody = document.getElementById('draftsTableBody');
  if (!tbody) return;

  if (drafts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-table__loading">
          <div style="text-align:center;padding:var(--space-10)">
            <div style="font-size:2rem;margin-bottom:var(--space-3)">🤖</div>
            <div style="font-weight:600;color:var(--color-text-primary);margin-bottom:var(--space-2)">No drafts yet</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-muted)">The AI agent runs every 2 hours and will deposit new scholarship drafts here for your review.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = drafts.map(s => `
    <tr>
      <td>
        <div class="admin-table__title">${escHtml(s.emoji || '🎓')} ${escHtml(s.title)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">${escHtml(s.organization)} · ${escHtml(s.country_of_study || '')}</div>
      </td>
      <td><span class="badge badge--primary">${escHtml((s.level || []).join(', '))}</span></td>
      <td>${formatDate(s.deadline)}</td>
      <td>${statusBadge(s.deadline)}</td>
      <td>
        <div style="font-size:var(--text-sm);color:var(--color-text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escHtml(s.description || '')}
        </div>
      </td>
      <td>
        <div class="admin-table__actions">
          <button class="btn btn--primary btn--sm" onclick="publishDraft('${escHtml(s.id)}', '${escHtml(s.title)}')">✓ Publish</button>
          <button class="btn btn--outline btn--sm" onclick="editDraft('${escHtml(s.id)}')">Edit</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--color-danger)" onclick="deleteDraft('${escHtml(s.id)}', '${escHtml(s.title)}')">✕ Reject</button>
        </div>
      </td>
    </tr>`).join('');
}

window.publishDraft = async function(id, title) {
  if (!confirm('Publish "' + title + '"? It will go live on the website immediately.')) return;
  try {
    await window.DB.update('scholarships', id, {
      status: 'published',
      updated_at: new Date().toISOString(),
    });
    showAlert('"' + title + '" is now live on the website!');
    await loadDrafts();
    await loadScholarships();
  } catch (err) {
    showAlert('Error publishing: ' + err.message, 'error');
  }
};

window.editDraft = function(id) {
  // Opens the draft in the scholarship edit form
  const s = drafts.find(x => x.id === id);
  if (!s) return;

  // Switch to scholarships tab
  document.querySelectorAll('.admin-nav__item').forEach(i => i.classList.remove('admin-nav__item--active'));
  document.querySelector('[data-tab="scholarships"]').classList.add('admin-nav__item--active');
  document.getElementById('tab-scholarships').style.display = '';
  document.getElementById('tab-drafts').style.display       = 'none';
  document.getElementById('tab-posts').style.display        = 'none';

  // Pre-fill the form
  editingScholarshipId = id;
  document.getElementById('s_id').value           = s.id;
  document.getElementById('s_id').disabled        = true;
  document.getElementById('s_title').value        = s.title || '';
  document.getElementById('s_organization').value = s.organization || '';
  document.getElementById('s_emoji').value        = s.emoji || '🎓';
  document.getElementById('s_description').value  = s.description || '';
  document.getElementById('s_amount').value       = s.amount || '';
  document.getElementById('s_deadline').value     = s.deadline || '';
  document.getElementById('s_link').value         = s.link || '';
  document.getElementById('s_level').value        = (s.level || []).join(', ');
  document.getElementById('s_region').value       = (s.region || []).join(', ');
  document.getElementById('s_tags').value         = (s.tags || []).join(', ');
  document.getElementById('s_country').value      = s.country_of_study || '';
  document.getElementById('s_featured').checked   = s.featured || false;

  document.getElementById('scholarshipFormTitle').textContent = 'Edit Draft Before Publishing';
  document.getElementById('scholarshipForm').style.display = '';
  document.getElementById('scholarshipForm').scrollIntoView({ behavior: 'smooth' });
};

window.deleteDraft = async function(id, title) {
  if (!confirm('Reject and delete "' + title + '"? This cannot be undone.')) return;
  try {
    await window.DB.delete('scholarships', id);
    showAlert('Draft rejected and deleted.');
    await loadDrafts();
  } catch (err) {
    showAlert('Error deleting draft: ' + err.message, 'error');
  }
};

/* ------------------------------------------
   SCHOLARSHIPS — LOAD & RENDER (published only)
------------------------------------------ */

async function loadScholarships() {
  const tbody = document.getElementById('scholarshipsTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">Loading...</td></tr>';
  try {
    const data = await window.DB.select('scholarships', 'status=eq.published&order=created_at.desc');
    scholarships = Array.isArray(data) ? data : [];
    renderScholarshipsTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">Error loading scholarships.</td></tr>';
    showAlert('Failed to load scholarships: ' + err.message, 'error');
  }
}

function renderScholarshipsTable() {
  const tbody = document.getElementById('scholarshipsTableBody');
  if (scholarships.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">No published scholarships yet.</td></tr>';
    return;
  }
  tbody.innerHTML = scholarships.map(s => `
    <tr>
      <td>
        <div class="admin-table__title">${escHtml(s.emoji || '🎓')} ${escHtml(s.title)}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">${escHtml(s.organization)}</div>
      </td>
      <td>${formatDate(s.deadline)}</td>
      <td>${statusBadge(s.deadline)}</td>
      <td>${s.featured ? '<span class="badge badge--accent">Featured</span>' : '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">—</span>'}</td>
      <td>
        <div class="admin-table__actions">
          <button class="btn btn--outline btn--sm" onclick="editScholarship('${escHtml(s.id)}')">Edit</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--color-danger)" onclick="deleteScholarship('${escHtml(s.id)}', '${escHtml(s.title)}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ------------------------------------------
   SCHOLARSHIPS — ADD / EDIT
------------------------------------------ */

document.getElementById('addScholarshipBtn').addEventListener('click', () => {
  editingScholarshipId = null;
  clearScholarshipForm();
  document.getElementById('scholarshipFormTitle').textContent = 'Add New Scholarship';
  document.getElementById('s_id').disabled = false;
  document.getElementById('scholarshipForm').style.display = '';
  document.getElementById('scholarshipForm').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('cancelScholarshipBtn').addEventListener('click', () => {
  document.getElementById('scholarshipForm').style.display = 'none';
  editingScholarshipId = null;
});

document.getElementById('saveScholarshipBtn').addEventListener('click', saveScholarship);

function clearScholarshipForm() {
  ['s_id','s_title','s_organization','s_emoji','s_description','s_amount',
   's_deadline','s_link','s_level','s_region','s_tags','s_country'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('s_featured').checked = false;
  document.getElementById('s_emoji').value = '🎓';
}

window.editScholarship = function(id) {
  const s = scholarships.find(x => x.id === id);
  if (!s) return;
  editingScholarshipId = id;
  document.getElementById('s_id').value           = s.id;
  document.getElementById('s_id').disabled        = true;
  document.getElementById('s_title').value        = s.title || '';
  document.getElementById('s_organization').value = s.organization || '';
  document.getElementById('s_emoji').value        = s.emoji || '🎓';
  document.getElementById('s_description').value  = s.description || '';
  document.getElementById('s_amount').value       = s.amount || '';
  document.getElementById('s_deadline').value     = s.deadline || '';
  document.getElementById('s_link').value         = s.link || '';
  document.getElementById('s_level').value        = (s.level || []).join(', ');
  document.getElementById('s_region').value       = (s.region || []).join(', ');
  document.getElementById('s_tags').value         = (s.tags || []).join(', ');
  document.getElementById('s_country').value      = s.country_of_study || '';
  document.getElementById('s_featured').checked   = s.featured || false;
  document.getElementById('scholarshipFormTitle').textContent = 'Edit Scholarship';
  document.getElementById('scholarshipForm').style.display = '';
  document.getElementById('scholarshipForm').scrollIntoView({ behavior: 'smooth' });
};

async function saveScholarship() {
  const id    = document.getElementById('s_id').value.trim();
  const title = document.getElementById('s_title').value.trim();
  const org   = document.getElementById('s_organization').value.trim();
  if (!id || !title || !org) { showAlert('ID, Title, and Organization are required.', 'error'); return; }
  if (!editingScholarshipId && !/^[a-z0-9-]+$/.test(id)) {
    showAlert('ID must contain only lowercase letters, numbers, and hyphens.', 'error'); return;
  }
  const body = {
    title, organization: org,
    emoji:            document.getElementById('s_emoji').value.trim() || '🎓',
    description:      document.getElementById('s_description').value.trim(),
    amount:           document.getElementById('s_amount').value.trim(),
    deadline:         document.getElementById('s_deadline').value || null,
    link:             document.getElementById('s_link').value.trim(),
    level:            parseCSV(document.getElementById('s_level').value),
    region:           parseCSV(document.getElementById('s_region').value),
    tags:             parseCSV(document.getElementById('s_tags').value),
    country_of_study: document.getElementById('s_country').value.trim(),
    featured:         document.getElementById('s_featured').checked,
    status:           'published',
    updated_at:       new Date().toISOString(),
  };
  const saveBtn = document.getElementById('saveScholarshipBtn');
  saveBtn.textContent = 'Saving...'; saveBtn.disabled = true;
  try {
    if (editingScholarshipId) {
      await window.DB.update('scholarships', editingScholarshipId, body);
      showAlert('Scholarship updated successfully.');
    } else {
      await window.DB.insert('scholarships', { id, ...body, created_at: new Date().toISOString() });
      showAlert('Scholarship added successfully.');
    }
    document.getElementById('scholarshipForm').style.display = 'none';
    editingScholarshipId = null;
    await loadScholarships();
  } catch (err) {
    showAlert('Error saving: ' + err.message, 'error');
  } finally {
    saveBtn.textContent = 'Save Scholarship'; saveBtn.disabled = false;
  }
}

window.deleteScholarship = async function(id, title) {
  if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
  try {
    await window.DB.delete('scholarships', id);
    showAlert('Scholarship deleted.');
    await loadScholarships();
  } catch (err) {
    showAlert('Error deleting: ' + err.message, 'error');
  }
};

/* ------------------------------------------
   BLOG POSTS
------------------------------------------ */

async function loadPosts() {
  const tbody = document.getElementById('postsTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">Loading...</td></tr>';
  try {
    const data = await window.DB.select('blog_posts', 'order=date.desc');
    posts = Array.isArray(data) ? data : [];
    renderPostsTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">Error loading posts.</td></tr>';
  }
}

function renderPostsTable() {
  const tbody = document.getElementById('postsTableBody');
  if (posts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-table__loading">No posts yet.</td></tr>';
    return;
  }
  tbody.innerHTML = posts.map(p => `
    <tr>
      <td><div class="admin-table__title">${escHtml(p.title)}</div></td>
      <td><span class="badge badge--primary">${escHtml(p.category)}</span></td>
      <td>${formatDate(p.date)}</td>
      <td>${p.featured ? '<span class="badge badge--accent">Featured</span>' : '<span style="color:var(--color-text-muted);font-size:var(--text-xs)">—</span>'}</td>
      <td>
        <div class="admin-table__actions">
          <button class="btn btn--outline btn--sm" onclick="editPost('${escHtml(p.id)}')">Edit</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--color-danger)" onclick="deletePost('${escHtml(p.id)}', '${escHtml(p.title)}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

document.getElementById('addPostBtn').addEventListener('click', () => {
  editingPostId = null;
  clearPostForm();
  document.getElementById('postFormTitle').textContent = 'Add New Post';
  document.getElementById('p_id').disabled = false;
  document.getElementById('p_date').value  = new Date().toISOString().split('T')[0];
  document.getElementById('postForm').style.display = '';
  document.getElementById('postForm').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('cancelPostBtn').addEventListener('click', () => {
  document.getElementById('postForm').style.display = 'none';
  editingPostId = null;
});

document.getElementById('savePostBtn').addEventListener('click', savePost);

function clearPostForm() {
  ['p_id','p_title','p_category','p_excerpt','p_content','p_image','p_read_time','p_date'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p_featured').checked = false;
}

window.editPost = function(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  editingPostId = id;
  document.getElementById('p_id').value        = p.id;
  document.getElementById('p_id').disabled     = true;
  document.getElementById('p_title').value     = p.title || '';
  document.getElementById('p_category').value  = p.category || '';
  document.getElementById('p_excerpt').value   = p.excerpt || '';
  document.getElementById('p_content').value   = p.content || '';
  document.getElementById('p_image').value     = p.image || '';
  document.getElementById('p_read_time').value = p.read_time || '';
  document.getElementById('p_date').value      = p.date || '';
  document.getElementById('p_featured').checked = p.featured || false;
  document.getElementById('postFormTitle').textContent = 'Edit Post';
  document.getElementById('postForm').style.display = '';
  document.getElementById('postForm').scrollIntoView({ behavior: 'smooth' });
};

async function savePost() {
  const id       = document.getElementById('p_id').value.trim();
  const title    = document.getElementById('p_title').value.trim();
  const category = document.getElementById('p_category').value;
  if (!id || !title || !category) { showAlert('ID, Title, and Category are required.', 'error'); return; }
  if (!editingPostId && !/^[a-z0-9-]+$/.test(id)) {
    showAlert('ID must contain only lowercase letters, numbers, and hyphens.', 'error'); return;
  }
  const body = {
    title, category,
    excerpt:    document.getElementById('p_excerpt').value.trim(),
    content:    document.getElementById('p_content').value.trim(),
    image:      document.getElementById('p_image').value.trim(),
    read_time:  document.getElementById('p_read_time').value.trim(),
    date:       document.getElementById('p_date').value || new Date().toISOString().split('T')[0],
    featured:   document.getElementById('p_featured').checked,
    updated_at: new Date().toISOString(),
  };
  const saveBtn = document.getElementById('savePostBtn');
  saveBtn.textContent = 'Saving...'; saveBtn.disabled = true;
  try {
    if (editingPostId) {
      await window.DB.update('blog_posts', editingPostId, body);
      showAlert('Post updated.');
    } else {
      await window.DB.insert('blog_posts', { id, ...body, created_at: new Date().toISOString() });
      showAlert('Post added.');
    }
    document.getElementById('postForm').style.display = 'none';
    editingPostId = null;
    await loadPosts();
  } catch (err) {
    showAlert('Error saving post: ' + err.message, 'error');
  } finally {
    saveBtn.textContent = 'Save Post'; saveBtn.disabled = false;
  }
}

window.deletePost = async function(id, title) {
  if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;
  try {
    await window.DB.delete('blog_posts', id);
    showAlert('Post deleted.');
    await loadPosts();
  } catch (err) {
    showAlert('Error deleting: ' + err.message, 'error');
  }
};
