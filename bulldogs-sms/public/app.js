/* =====================================================================
   Bulldogs University SMS - front-end
   Sections: helpers · API · auth (sign in / make an account) · app shell
             · views · modals · actions
   ===================================================================== */
const API = '/api';
const PROGRAMS = [
  'Bachelor of Science in Computer Science with specialization in Digital Forensics (BSCS-DF)',
  'Bachelor of Science in Computer Science with specialization in Machine Learning'
];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const state = { token: sessionStorage.getItem('bu_token'), user: null, profile: null };
const db = { students: [], courses: [], grades: [], users: [] };
let selectedRoleForLogin = null;
let currentView = 'dashboard';
let regTab = 'pending';
let gradeFilter = '';
let editingItem = null;
let activeModalType = '';

/* ---------------------------------------------------------------- helpers */
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_LABEL = { admin: 'Administrator', professor: 'Professor', student: 'Student' };

function formatDate(v) {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  return isNaN(d) ? esc(v) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function firstName(name) {
  if (!name) return '';
  return name.includes(',') ? name.split(',')[1].trim().split(' ')[0] : name;
}
function gradeEquiv(str) { const m = /\((\d+(?:\.\d+)?)\)\s*$/.exec(String(str || '')); return m ? parseFloat(m[1]) : null; }
function gpaOf(grades) {
  let pts = 0, units = 0;
  grades.forEach(g => { const e = gradeEquiv(g.final); if (e !== null) { const u = g.units || 3; pts += e * u; units += u; } });
  return units ? (pts / units).toFixed(2) : '—';
}
function banner(el, msg, kind = 'error') {
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  el.className = `text-xs rounded-lg px-3 py-2 border ${styles[kind]}`;
  el.textContent = msg;
}
const hideEl = (el) => { el.classList.add('hidden'); el.textContent = ''; };
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2800);
}
const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-nuBlue';
function field(id, label, { type = 'text', value = '', required = true, placeholder = '', extra = '' } = {}) {
  return `<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="${id}">${label}${required ? '' : ' <span class="font-normal text-slate-400">(optional)</span>'}</label>
    <input type="${type}" id="${id}" ${required ? 'required' : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra} class="${inputCls}"></div>`;
}
function selectField(id, label, options, selected = '', extra = '') {
  return `<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="${id}">${label}</label>
    <select id="${id}" ${extra} class="${inputCls}">${options.map(o => {
      const [val, text] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${val === selected ? 'selected' : ''}>${esc(text)}</option>`;
    }).join('')}</select></div>`;
}
const chips = (codes, cls = 'bg-blue-50 text-nuBlue') =>
  codes.length ? codes.map(c => `<span class="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${cls} mr-1 mb-1">${esc(c)}</span>`).join('') : '<span class="text-slate-400">None</span>';
const emptyRow = (cols, msg) => `<tr><td colspan="${cols}" class="py-10 px-4 text-center text-slate-400 text-xs">${msg}</td></tr>`;

/* -------------------------------------------------------------------- API */
async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token && !path.startsWith('/auth/login')) { logout('Your session has expired. Please sign in again.'); }
    const err = new Error(data.message || 'Request failed');
    err.code = data.code; err.status = res.status;
    throw err;
  }
  return data;
}

async function loadAll() {
  const role = state.user.role;
  const jobs = [api('/courses'), api('/grades')];
  if (role !== 'student') jobs.push(api('/students'));
  if (role === 'admin') jobs.push(api('/users'));
  const [courses, grades, students, users] = await Promise.all(jobs);
  db.courses = courses.map(c => ({ ...c, id: c._id }));
  db.grades = grades.map(g => ({ ...g, id: g._id }));
  db.students = (students || []).map(s => ({ ...s, id: s._id }));
  db.users = (users || []).map(u => ({ ...u }));
}
const pendingCount = () => db.users.filter(u => u.status === 'pending').length;

/* ------------------------------------------- AUTH: sign in / make account */
function showStep(n) {
  [1, 2, 3, 4].forEach(i => $('auth-step-' + i).classList.toggle('hidden', i !== n));
}
function showRoleSelector() { showStep(1); }

function showLoginForm(role) {
  selectedRoleForLogin = role;
  showStep(2);
  hideEl($('login-error'));
  $('login-password').value = '';
  $('login-username').value = '';
  $('login-form-title').textContent = { admin: 'Administrator Sign In', professor: 'Professor Sign In', student: 'Student Sign In' }[role];
  $('login-id-label').textContent = { admin: 'Admin Email', professor: 'Institutional Email / Employee ID', student: 'Institutional Email / Student Number' }[role];
  $('login-register-link').classList.toggle('hidden', role === 'admin');   // admins cannot self-register
  $('login-username').focus();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = $('login-btn'); btn.disabled = true;
  const identifier = $('login-username').value.trim();
  hideEl($('login-error'));
  try {
    const data = await api('/auth/login', 'POST', { role: selectedRoleForLogin, identifier, password: $('login-password').value });
    state.token = data.token;
    sessionStorage.setItem('bu_token', data.token);
    await enterApp(data.user);
  } catch (err) {
    state.token = null; sessionStorage.removeItem('bu_token');
    if (err.code === 'INVALID' && selectedRoleForLogin !== 'admin') {
      // not registered / wrong details -> offer registration
      showRegisterForm(identifier, 'We could not find a registered account with those details. Make an account below, or go back and check what you typed.');
    } else if (err.code === 'PENDING') {
      banner($('login-error'), err.message, 'warn');
    } else {
      banner($('login-error'), err.code === 'INVALID' ? 'Incorrect email or password.' : err.message);
    }
  } finally { btn.disabled = false; }
}

function showRegisterForm(prefillId = '', notice = '') {
  const role = selectedRoleForLogin;
  showStep(3);
  hideEl($('register-error'));
  if (notice) banner($('register-error'), notice, 'warn');
  $('register-role-tag').textContent = role === 'student' ? 'Student Account' : 'Professor Account';
  const email = prefillId.includes('@') ? prefillId : '';
  const idVal = prefillId && !prefillId.includes('@') ? prefillId : '';
  const pw = field('reg-password', 'Password (min. 8 characters)', { type: 'password', extra: 'minlength="8"' }) +
             field('reg-password2', 'Confirm Password', { type: 'password' });
  $('register-fields').innerHTML = role === 'student'
    ? field('reg-name', 'Full Name (Last, First Middle)', { placeholder: 'Dela Cruz, Juan Santos' }) +
      field('reg-id', 'Student Number', { value: idVal, placeholder: '2024-1234567' }) +
      field('reg-email', 'Institutional Email', { type: 'email', value: email }) +
      selectField('reg-program', 'Program', PROGRAMS) +
      selectField('reg-year', 'Year Level', YEARS, '3rd Year') +
      `<div class="grid grid-cols-2 gap-3">${field('reg-mobile', 'Mobile No.', { required: false, placeholder: '(+63) 900 000 0000' })}${field('reg-birth', 'Birth Date', { type: 'date', required: false })}</div>` + pw
    : field('reg-name', 'Full Name (with title)', { placeholder: 'Mr. Juan S. Dela Cruz' }) +
      field('reg-id', 'Employee ID', { value: idVal, placeholder: 'FAC-0006' }) +
      field('reg-email', 'Institutional Email', { type: 'email', value: email }) +
      field('reg-dept', 'Department', { value: 'College of Computing and Information Technologies' }) + pw;
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const err = $('register-error');
  if ($('reg-password').value !== $('reg-password2').value) return banner(err, 'Passwords do not match.');
  const role = selectedRoleForLogin;
  const body = {
    role, name: $('reg-name').value, email: $('reg-email').value, password: $('reg-password').value
  };
  if (role === 'student') {
    Object.assign(body, {
      studentNum: $('reg-id').value, program: $('reg-program').value, year: $('reg-year').value,
      mobile: $('reg-mobile').value, birthDate: $('reg-birth').value
    });
  } else {
    Object.assign(body, { employeeId: $('reg-id').value, department: $('reg-dept').value });
  }
  const btn = $('register-btn'); btn.disabled = true;
  try {
    await api('/auth/register', 'POST', body);
    showStep(4);
  } catch (ex) { banner(err, ex.message); }
  finally { btn.disabled = false; }
}

async function enterApp(user) {
  state.user = user;
  if (user.role === 'student') state.profile = (await api('/auth/me')).profile;
  await loadAll();
  $('user-display-greeting').textContent =
    'Hi, ' + (user.role === 'admin' ? 'Admin' : user.role === 'student' ? firstName(user.name) : user.name.replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, 'Prof. ').split(' ').slice(0, 2).join(' '));
  renderHeaderAvatar();
  $('auth-modal').classList.add('hidden');
  $('app-container').classList.remove('hidden');
  currentView = 'dashboard'; gradeFilter = ''; regTab = 'pending';
  renderSidebar();
  renderContent();
}

function logout(message) {
  state.token = null; state.user = null; state.profile = null;
  sessionStorage.removeItem('bu_token');
  Object.assign(db, { students: [], courses: [], grades: [], users: [] });
  closeModal();
  $('app-container').classList.add('hidden');
  $('auth-modal').classList.remove('hidden');
  showStep(1);
  if (typeof message === 'string') toast(message);
}

function renderHeaderAvatar() {
  const el = $('header-avatar');
  el.innerHTML = state.user && state.user.photo
    ? `<img src="${esc(state.user.photo)}" alt="" class="w-full h-full object-cover">`
    : '<i class="fa-solid fa-user"></i>';
}

/* --------------------------------------------------------------- app shell */
function navLinks() {
  const role = state.user.role;
  if (role === 'admin') return [
    { id: 'dashboard', label: 'System Dashboard', icon: 'fa-chart-pie' },
    { id: 'registrations', label: 'Account Registrations', icon: 'fa-user-check', badge: pendingCount() },
    { id: 'students', label: 'Student Records', icon: 'fa-user-graduate' },
    { id: 'courses', label: 'Course Catalog', icon: 'fa-book' },
    { id: 'grades', label: 'Grade Registry', icon: 'fa-marker' }
  ];
  if (role === 'professor') return [
    { id: 'dashboard', label: 'Faculty Dashboard', icon: 'fa-chart-pie' },
    { id: 'students', label: 'My Students', icon: 'fa-user-graduate' },
    { id: 'courses', label: 'My Subjects', icon: 'fa-book' },
    { id: 'grades', label: 'Grade Management', icon: 'fa-marker' }
  ];
  return [
    { id: 'dashboard', label: 'My Student Portal', icon: 'fa-house' },
    { id: 'profile', label: 'My Profile', icon: 'fa-user' },
    { id: 'courses', label: 'My Class Offerings', icon: 'fa-book' },
    { id: 'grades', label: 'My Grade Report', icon: 'fa-award' }
  ];
}

function renderSidebar() {
  $('sidebar-nav').innerHTML = navLinks().map(l => `
    <button onclick="navigate('${l.id}')" class="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${currentView === l.id ? 'bg-nuBlue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
      <i class="fa-solid ${l.icon} w-5 text-center ${currentView === l.id ? 'text-nuGold' : 'text-slate-400'}"></i>
      <span class="flex-1 text-left">${l.label}</span>
      ${l.badge ? `<span class="bg-rose-500 text-white rounded-full px-2 py-0.5 text-[10px] font-bold">${l.badge}</span>` : ''}
    </button>`).join('');
}

function navigate(viewId) {
  currentView = viewId;
  renderSidebar();
  renderContent();
  // refresh data in the background so lists (e.g. new registrations) are current
  loadAll().then(() => { if (currentView === viewId && !$('app-container').classList.contains('hidden')) { renderSidebar(); renderContent(); } }).catch(() => {});
}

function renderContent() {
  if (!state.user) return;
  $('action-btn-container').innerHTML = '';
  const views = { dashboard: viewDashboard, registrations: viewRegistrations, profile: viewProfile, students: viewStudents, courses: viewCourses, grades: viewGrades };
  const allowed = navLinks().map(l => l.id);
  (views[allowed.includes(currentView) ? currentView : 'dashboard'])();
}

function setHeader(title, subtitle, actionHtml = '') {
  $('view-title').textContent = title;
  $('view-subtitle').textContent = subtitle;
  $('action-btn-container').innerHTML = actionHtml;
}
const primaryBtn = (onclick, icon, label, disabled = false) =>
  `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} class="bg-nuBlue hover:bg-blue-900 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 shadow-sm"><i class="fa-solid ${icon}"></i><span>${label}</span></button>`;
const statCard = (label, value, color, icon, bg) => `
  <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div><p class="text-xs font-semibold uppercase tracking-wider text-slate-400">${label}</p>
    <h3 class="text-3xl font-extrabold ${color} mt-1">${value}</h3></div>
    <div class="w-12 h-12 ${bg} ${color} rounded-xl flex items-center justify-center text-xl"><i class="fa-solid ${icon}"></i></div>
  </div>`;
const navCard = (view, color, icon, title, text) => `
  <div onclick="navigate('${view}')" class="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-nuBlue transition cursor-pointer">
    <h4 class="font-bold ${color} text-sm"><i class="fa-solid ${icon} mr-2"></i> ${title}</h4>
    <p class="text-xs text-slate-500 mt-1">${text}</p></div>`;

/* ------------------------------------------------------------------ views */
function viewDashboard() {
  const u = state.user, role = u.role;
  const roleName = ROLE_LABEL[role];
  let cards = '', nav = '', extra = '';
  if (role === 'admin') {
    const profs = db.users.filter(x => x.role === 'professor' && x.status === 'approved').length;
    cards = statCard('Enrolled Students', db.students.length, 'text-nuBlue', 'fa-users', 'bg-blue-50') +
            statCard('Course Offerings', db.courses.length, 'text-amber-600', 'fa-book-open', 'bg-amber-50') +
            statCard('Pending Registrations', pendingCount(), pendingCount() ? 'text-rose-600' : 'text-emerald-600', 'fa-user-clock', pendingCount() ? 'bg-rose-50' : 'bg-emerald-50');
    nav = navCard('registrations', 'text-rose-600', 'fa-user-check', 'Account Registrations', 'Confirm or reject new student and professor accounts.') +
          navCard('students', 'text-nuBlue', 'fa-user-graduate', 'Student Records', 'Manage student profiles, enrollment and standing.') +
          navCard('courses', 'text-amber-600', 'fa-book', 'Course Catalog', `Courses, schedules and professor assignments (${profs} approved professors).`) +
          navCard('grades', 'text-emerald-600', 'fa-marker', 'Grade Registry', 'Midterm and final evaluation records.');
    if (pendingCount()) extra = `<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm flex items-center justify-between gap-4">
      <span><i class="fa-solid fa-bell mr-2"></i>${pendingCount()} account registration${pendingCount() > 1 ? 's are' : ' is'} waiting for your confirmation.</span>
      <button onclick="navigate('registrations')" class="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700">Review</button></div>`;
  } else if (role === 'professor') {
    cards = statCard('My Subjects', db.courses.length, 'text-amber-600', 'fa-book-open', 'bg-amber-50') +
            statCard('My Students', db.students.length, 'text-nuBlue', 'fa-users', 'bg-blue-50') +
            statCard('Grades Recorded', db.grades.length, 'text-emerald-600', 'fa-marker', 'bg-emerald-50');
    nav = navCard('courses', 'text-amber-600', 'fa-book', 'My Subjects', 'Subjects assigned to you and their schedules.') +
          navCard('students', 'text-nuBlue', 'fa-user-graduate', 'My Students', 'Students enrolled in your subjects.') +
          navCard('grades', 'text-emerald-600', 'fa-marker', 'Grade Management', 'Encode and update grades for your subjects only.');
    if (!db.courses.length) extra = `<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm"><i class="fa-solid fa-circle-info mr-2"></i>No subjects are assigned to you yet. Please ask the admin to assign your subjects.</div>`;
  } else {
    cards = statCard('Enrolled Subjects', db.courses.length, 'text-amber-600', 'fa-book-open', 'bg-amber-50') +
            statCard('Grades Posted', db.grades.length, 'text-nuBlue', 'fa-award', 'bg-blue-50') +
            statCard('Standing GPA', gpaOf(db.grades), 'text-emerald-600', 'fa-star', 'bg-emerald-50');
    nav = navCard('profile', 'text-nuBlue', 'fa-user', 'My Profile', 'View your details and update your photo.') +
          navCard('courses', 'text-amber-600', 'fa-book', 'My Class Offerings', 'Your enrolled subjects, schedules and instructors.') +
          navCard('grades', 'text-emerald-600', 'fa-award', 'My Grade Report', 'Your midterm and final grades.');
  }
  setHeader(`${roleName} Dashboard`, `Welcome back, ${u.name}.`);
  $('main-content-area').innerHTML = `${extra}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">${cards}</div>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h3 class="font-bold text-slate-900 text-base">Quick Navigation</h3>
      <div class="grid grid-cols-1 sm:grid-cols-${role === 'admin' ? '2' : '3'} gap-4">${nav}</div></div>`;
}

/* ---- Admin: account registrations ---- */
function viewRegistrations() {
  setHeader('Account Registrations', 'Confirm or reject student and professor account requests.');
  const tabs = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
  const list = db.users.filter(u => u.status === regTab);
  const statusPill = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-rose-100 text-rose-700' };
  const btn = (id, st, label, cls) => `<button onclick="setRegStatus('${id}','${st}')" class="px-2.5 py-1 rounded text-[11px] font-semibold ${cls}">${label}</button>`;
  const actions = (u) => {
    if (u.status === 'pending') return btn(u._id || u.id, 'approved', '<i class="fa-solid fa-check mr-1"></i>Confirm', 'bg-emerald-600 text-white hover:bg-emerald-700') + ' ' + btn(u.id, 'rejected', 'Reject', 'bg-rose-100 text-rose-700 hover:bg-rose-200');
    if (u.status === 'approved') return btn(u.id, 'rejected', 'Revoke', 'bg-slate-100 text-slate-700 hover:bg-slate-200');
    return btn(u.id, 'approved', 'Confirm', 'bg-emerald-600 text-white hover:bg-emerald-700') +
      ` <button onclick="deleteRegistration('${u.id}')" class="text-rose-600 hover:text-rose-800 p-1" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
  };
  $('main-content-area').innerHTML = `
    <div class="flex gap-2 flex-wrap">${tabs.map(([k, l]) => {
      const n = db.users.filter(u => u.status === k).length;
      return `<button onclick="setRegTab('${k}')" class="px-4 py-2 rounded-lg text-xs font-semibold border transition ${regTab === k ? 'bg-nuBlue text-white border-nuBlue' : 'bg-white text-slate-600 border-slate-200 hover:border-nuBlue'}">${l} <span class="ml-1 opacity-80">(${n})</span></button>`;
    }).join('')}</div>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-nuBlue text-white text-xs font-semibold uppercase tracking-wider">
          <th class="py-3 px-4">Name</th><th class="py-3 px-4">Role</th><th class="py-3 px-4">ID Number</th><th class="py-3 px-4">Email</th>
          <th class="py-3 px-4">Details</th><th class="py-3 px-4">Submitted</th><th class="py-3 px-4">Status</th><th class="py-3 px-4 text-right">Action</th></tr></thead>
        <tbody class="divide-y divide-slate-100 text-xs">
          ${list.length ? list.map(u => `<tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-semibold text-slate-800">${esc(u.name)}</td>
            <td class="py-3 px-4">${ROLE_LABEL[u.role]}</td>
            <td class="py-3 px-4 font-mono text-nuBlue font-semibold">${esc(u.studentNum || u.employeeId)}</td>
            <td class="py-3 px-4 text-slate-600">${esc(u.email)}</td>
            <td class="py-3 px-4 text-slate-600">${u.role === 'student' ? `${esc(u.year)}<br><span class="text-slate-400">${esc(u.program)}</span>` : esc(u.department)}</td>
            <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusPill[u.status]}">${u.status}</span></td>
            <td class="py-3 px-4 text-right whitespace-nowrap">${actions(u)}</td></tr>`).join('')
          : emptyRow(8, `No ${regTab} registrations.`)}
        </tbody></table></div></div>`;
}
function setRegTab(t) { regTab = t; viewRegistrations(); }

/* ---- Student: profile (only the photo is editable) ---- */
function viewProfile() {
  const p = state.profile, u = state.user;
  setHeader('Student Profile Information', 'Personal and academic background details.');
  $('main-content-area').innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
        <div class="flex flex-col items-center gap-2">
          <div class="w-28 h-28 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-4xl shadow-inner overflow-hidden border-2 border-nuGold/50">
            ${u.photo ? `<img src="${esc(u.photo)}" alt="Profile photo" class="w-full h-full object-cover">` : '<i class="fa-solid fa-user"></i>'}
          </div>
          <input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp" class="hidden" onchange="handlePhotoChosen(event)">
          <button onclick="$('photo-input').click()" class="text-xs font-semibold text-nuBlue hover:underline"><i class="fa-solid fa-camera mr-1"></i>${u.photo ? 'Change photo' : 'Upload photo'}</button>
          ${u.photo ? `<button onclick="removePhoto()" class="text-[11px] text-rose-600 hover:underline">Remove photo</button>` : ''}
        </div>
        <div class="space-y-1">
          <h2 class="text-xl font-bold text-slate-900">${esc(p.name)}</h2>
          <p class="text-xs font-medium text-nuBlue">Course: ${esc(p.program)}</p>
          <div class="text-xs text-slate-500 space-y-0.5 pt-1">
            <p><span class="font-semibold text-slate-700">ID Number:</span> ${esc(p.studentNum)}</p>
            <p><span class="font-semibold text-slate-700">Year Level:</span> ${esc(p.year)}</p>
            <p><span class="font-semibold text-slate-700">Department:</span> ${esc(p.department)}</p>
            <p><span class="font-semibold text-slate-700">Official Email:</span> ${esc(p.email)}</p>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><span class="font-semibold text-slate-500 block mb-1">Birth Date</span> ${formatDate(p.birthDate)}</div>
        <div class="bg-slate-50 p-3 rounded-lg border border-slate-200"><span class="font-semibold text-slate-500 block mb-1">Mobile No.</span> ${esc(p.mobile) || '—'}</div>
      </div>
      <p class="text-[11px] text-slate-400"><i class="fa-solid fa-lock mr-1"></i>Only your photo can be changed here. To correct any other detail, please contact the admin.</p>
    </div>`;
}

// Crop to a 256x256 JPEG so the stored photo stays small
function handlePhotoChosen(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast('Please choose a JPG, PNG or WEBP image.');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = async () => {
      const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
      const side = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      await savePhoto(c.toDataURL('image/jpeg', 0.85), 'Photo updated.');
    };
    img.onerror = () => toast('That file could not be read as an image.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
async function removePhoto() { if (confirm('Remove your profile photo?')) await savePhoto(null, 'Photo removed.'); }
async function savePhoto(photo, okMsg) {
  try {
    const r = await api('/auth/photo', 'PUT', { photo });
    state.user.photo = r.photo || undefined;
    renderHeaderAvatar(); viewProfile(); toast(okMsg);
  } catch (err) { toast(err.message); }
}

/* ---- Students ---- */
function viewStudents() {
  const admin = state.user.role === 'admin';
  setHeader(admin ? 'Student Records Management' : 'My Students',
    admin ? 'Manage student records, enrollment and standing.' : 'Students enrolled in the subjects assigned to you.',
    admin ? primaryBtn("openModal('student')", 'fa-user-plus', 'Add Student') : '');
  const cols = admin ? 7 : 5;
  $('main-content-area').innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-nuBlue text-white text-xs font-semibold uppercase tracking-wider">
          <th class="py-3 px-4">Student ID</th><th class="py-3 px-4">Full Name</th><th class="py-3 px-4">Program</th><th class="py-3 px-4">Year Level</th>
          ${admin ? '<th class="py-3 px-4">GPA</th>' : ''}
          <th class="py-3 px-4">${admin ? 'Enrolled Subjects' : 'My Subject(s)'}</th>
          ${admin ? '<th class="py-3 px-4 text-right">Actions</th>' : ''}</tr></thead>
        <tbody class="divide-y divide-slate-100 text-xs">
          ${db.students.length ? db.students.map(s => `<tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-mono text-nuBlue font-semibold">${esc(s.studentNum)}</td>
            <td class="py-3 px-4 font-semibold text-slate-800">${esc(s.name)}</td>
            <td class="py-3 px-4 text-slate-600">${esc(s.program)}</td>
            <td class="py-3 px-4 text-slate-600">${esc(s.year)}</td>
            ${admin ? `<td class="py-3 px-4 font-semibold text-emerald-600">${esc(s.gpa)}</td>` : ''}
            <td class="py-3 px-4">${chips(s.courses || [])}</td>
            ${admin ? `<td class="py-3 px-4 text-right whitespace-nowrap">
              <button onclick="openEnrollModal('${s.id}')" class="text-emerald-600 hover:text-emerald-800 p-1" title="Manage enrollment"><i class="fa-solid fa-list-check"></i></button>
              <button onclick="editStudent('${s.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteStudent('${s.id}')" class="text-rose-600 hover:text-rose-800 p-1" title="Delete"><i class="fa-solid fa-trash"></i></button></td>` : ''}
          </tr>`).join('') : emptyRow(cols, admin ? 'No students yet.' : 'No students are enrolled in your subjects yet.')}
        </tbody></table></div></div>`;
}

/* ---- Courses ---- */
function viewCourses() {
  const { role } = state.user;
  const admin = role === 'admin';
  setHeader(
    role === 'student' ? 'My Class Offerings' : role === 'professor' ? 'My Subjects' : 'Course Catalog',
    admin ? 'Manage courses and assign professors.' : role === 'professor' ? 'Only subjects assigned to you are shown.' : 'Subjects you are enrolled in.',
    admin ? primaryBtn("openModal('course')", 'fa-plus', 'Add Course') : '');
  const count = (code) => db.students.filter(s => (s.courses || []).includes(code)).length;
  $('main-content-area').innerHTML = db.courses.length ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">${db.courses.map(c => `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-2.5 py-1 bg-blue-50 text-nuBlue font-mono text-xs font-bold rounded">${esc(c.code)}</span>
          <span class="text-xs font-medium text-slate-500">${esc(c.units)} Units</span>
        </div>
        <h3 class="font-bold text-slate-900 text-base">${esc(c.title)}</h3>
        <p class="text-xs text-slate-600 mt-1"><i class="fa-solid fa-chalkboard-user mr-1.5 text-slate-400"></i> ${esc(c.instructor)}</p>
        ${role !== 'student' ? `<p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-users mr-1.5 text-slate-400"></i> ${count(c.code)} enrolled student(s)</p>` : ''}
      </div>
      <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span><i class="fa-regular fa-calendar-days mr-1 text-slate-400"></i> ${esc(c.schedule)}</span>
        ${admin ? `<span class="space-x-2 whitespace-nowrap">
          <button onclick="editCourse('${c.id}')" class="text-blue-600 hover:text-blue-800" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteCourse('${c.id}')" class="text-rose-600 hover:text-rose-800" title="Delete"><i class="fa-solid fa-trash"></i></button></span>` : ''}
      </div>
    </div>`).join('')}</div>`
  : `<div class="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">${
      role === 'professor' ? 'No subjects are assigned to you yet. Please contact the admin.' :
      role === 'student' ? 'You are not enrolled in any subjects yet. Please contact the admin.' : 'No courses yet.'}</div>`;
}

/* ---- Grades ---- */
function viewGrades() {
  const { role } = state.user;
  const staff = role !== 'student';
  setHeader(role === 'student' ? 'My Academic Grade Report' : role === 'professor' ? 'Grade Management' : 'Student Grade Registry',
    role === 'student' ? 'Official scholastic records for AY 2026 - 2027 2nd Term.'
      : role === 'professor' ? 'You can only view and encode grades for the subjects assigned to you.' : 'Master grade registry across all courses.',
    staff ? primaryBtn("openModal('grade')", 'fa-marker', 'Input Grade Record') : '');
  const shown = gradeFilter ? db.grades.filter(g => g.code === gradeFilter) : db.grades;
  const cols = staff ? 7 : 4;
  $('main-content-area').innerHTML = `
    ${staff ? `<div class="flex items-center gap-3 text-xs"><label class="font-semibold text-slate-600">Subject:</label>
      <select onchange="gradeFilter=this.value;viewGrades()" class="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
        <option value="">${role === 'professor' ? 'All my subjects' : 'All subjects'}</option>
        ${db.courses.map(c => `<option value="${esc(c.code)}" ${gradeFilter === c.code ? 'selected' : ''}>${esc(c.code)} - ${esc(c.title)}</option>`).join('')}
      </select></div>` : `<div class="bg-white rounded-xl border border-slate-200 px-5 py-3 text-sm flex items-center justify-between">
        <span class="text-slate-500">Standing GPA (units-weighted, final grades)</span><span class="font-bold text-emerald-600 text-lg">${gpaOf(db.grades)}</span></div>`}
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-nuBlue text-white text-xs font-semibold uppercase tracking-wider">
          ${staff ? '<th class="py-3 px-4">Student ID</th><th class="py-3 px-4">Student Name</th>' : ''}
          <th class="py-3 px-4">Subject Code</th><th class="py-3 px-4">Subject Description</th>
          <th class="py-3 px-4 text-center">Midterm Grade</th><th class="py-3 px-4 text-center">Final Grade</th>
          ${staff ? '<th class="py-3 px-4 text-right">Action</th>' : ''}</tr></thead>
        <tbody class="divide-y divide-slate-100 text-xs">
          ${shown.length ? shown.map(g => `<tr class="hover:bg-slate-50 transition">
            ${staff ? `<td class="py-3 px-4 font-mono text-nuBlue">${esc(g.studentNum)}</td><td class="py-3 px-4 font-semibold text-slate-800">${esc(g.studentName)}</td>` : ''}
            <td class="py-3 px-4 font-mono font-bold text-nuBlue">${esc(g.code)}</td>
            <td class="py-3 px-4 text-slate-600">${esc(g.course)}</td>
            <td class="py-3 px-4 text-center font-mono text-slate-700 font-semibold">${esc(g.midterm)}</td>
            <td class="py-3 px-4 text-center font-mono text-slate-900 font-bold">${esc(g.final)}</td>
            ${staff ? `<td class="py-3 px-4 text-right whitespace-nowrap">
              <button onclick="editGrade('${g.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteGrade('${g.id}')" class="text-rose-600 hover:text-rose-800 p-1" title="Delete"><i class="fa-solid fa-trash"></i></button></td>` : ''}
          </tr>`).join('') : emptyRow(cols, 'No grade records to show.')}
        </tbody></table></div></div>`;
}

/* ----------------------------------------------------------------- modals */
function openModal(type, item = null) {
  activeModalType = type; editingItem = item;
  hideEl($('form-error'));
  const titleEl = $('modal-title'), fieldsEl = $('form-fields');
  $('modal-submit').textContent = 'Save Record';

  if (type === 'student') {
    titleEl.textContent = item ? 'Edit Student Record' : 'Add New Student';
    fieldsEl.innerHTML =
      field('f-name', 'Full Name (Last, First Middle)', { value: item?.name }) +
      field('f-snum', 'Student Number', { value: item ? item.studentNum : '2024-' }) +
      field('f-email', 'Institutional Email', { type: 'email', value: item?.email }) +
      selectField('f-program', 'Program', PROGRAMS, item?.program) +
      selectField('f-year', 'Year Level', YEARS, item?.year || '3rd Year');
  } else if (type === 'course') {
    titleEl.textContent = item ? 'Edit Course Offering' : 'Add Course Offering';
    const profs = db.users.filter(u => u.role === 'professor' && u.status === 'approved');
    fieldsEl.innerHTML =
      field('c-code', 'Subject Code', { value: item?.code, placeholder: 'e.g. CCDIGFOL' }) +
      field('c-title', 'Subject Description', { value: item?.title }) +
      `<div class="grid grid-cols-2 gap-4">${field('c-units', 'Units', { type: 'number', value: item?.units ?? 3, extra: 'min="0" max="12" step="0.5"' })}
        ${field('c-schedule', 'Schedule', { value: item?.schedule || 'MWF 10:00 AM - 11:30 AM' })}</div>` +
      selectField('c-prof', 'Assigned Professor', [['', '— Not assigned —'], ...profs.map(p => [p._id || p.id, `${p.name} (${p.employeeId})`])], item?.professor ? String(item.professor) : '') +
      (profs.length ? '' : '<p class="text-xs text-amber-700">No approved professors yet. Approve a professor registration first to assign one.</p>');
  } else if (type === 'grade') {
    if (item) {
      titleEl.textContent = 'Edit Grade Record';
      fieldsEl.innerHTML = `<div class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
        <p><span class="font-semibold">Student:</span> ${esc(item.studentName)} (${esc(item.studentNum)})</p>
        <p><span class="font-semibold">Subject:</span> ${esc(item.code)} - ${esc(item.course)}</p></div>` + gradeInputs(item);
    } else {
      if (!db.courses.length) { toast(state.user.role === 'professor' ? 'No subjects are assigned to you yet.' : 'Add a course first.'); activeModalType = ''; return; }
      titleEl.textContent = 'Input Grade Record';
      fieldsEl.innerHTML =
        selectField('g-course', 'Subject', db.courses.map(c => [c.code, `${c.code} - ${c.title}`]), gradeFilter || db.courses[0].code, 'onchange="refreshGradeStudents()"') +
        `<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="g-student">Student</label>
          <select id="g-student" class="${inputCls}"></select>
          <p id="g-student-note" class="text-[11px] text-slate-400 mt-1"></p></div>` + gradeInputs();
      refreshGradeStudents();
    }
  } else if (type === 'enroll') {
    titleEl.textContent = 'Manage Enrollment';
    $('modal-submit').textContent = 'Save Enrollment';
    fieldsEl.innerHTML = `<div class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3"><span class="font-semibold">${esc(item.name)}</span> (${esc(item.studentNum)})</div>
      <div class="space-y-2">${db.courses.length ? db.courses.map(c => `
        <label class="flex items-start gap-3 text-xs p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" class="enroll-box mt-0.5" value="${esc(c.code)}" ${(item.courses || []).includes(c.code) ? 'checked' : ''}>
          <span><span class="font-mono font-bold text-nuBlue">${esc(c.code)}</span> - ${esc(c.title)}<br><span class="text-slate-400">${esc(c.instructor)}</span></span></label>`).join('')
        : '<p class="text-xs text-slate-400">No courses available.</p>'}</div>
      <p class="text-[11px] text-amber-700">Unchecking a subject also removes any grade recorded for it.</p>`;
  }
  $('modal-form').classList.remove('hidden');
}

function gradeInputs(g = {}) {
  return `<div class="grid grid-cols-2 gap-4">${field('g-midterm', 'Midterm (Score / Equiv)', { value: g.midterm, placeholder: '96 (4.0)' })}
    ${field('g-final', 'Final (Score / Equiv)', { value: g.final, placeholder: '98 (4.0)' })}</div>
    <p class="text-[11px] text-slate-400">Tip: put the grade-point equivalent in brackets, e.g. 96 (4.0). It is used to compute the student's GPA.</p>`;
}

// Only students enrolled in the chosen subject (and not yet graded in it) can be picked
function refreshGradeStudents() {
  const code = $('g-course').value;
  const graded = new Set(db.grades.filter(g => g.code === code).map(g => g.studentNum));
  const all = db.students.filter(s => (s.courses || []).includes(code));
  const open = all.filter(s => !graded.has(s.studentNum));
  $('g-student').innerHTML = open.map(s => `<option value="${esc(s.studentNum)}">${esc(s.name)} (${esc(s.studentNum)})</option>`).join('');
  $('g-student-note').textContent = !all.length ? 'No students are enrolled in this subject yet.'
    : !open.length ? 'All enrolled students already have a grade for this subject (use the edit button).' : '';
}

function closeModal() {
  $('modal-form').classList.add('hidden');
  editingItem = null; activeModalType = '';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const errEl = $('form-error'); hideEl(errEl);
  const btn = $('modal-submit'); btn.disabled = true;
  try {
    if (activeModalType === 'student') {
      const payload = {
        name: $('f-name').value, studentNum: $('f-snum').value, email: $('f-email').value,
        program: $('f-program').value, year: $('f-year').value
      };
      await (editingItem ? api('/students/' + editingItem.id, 'PUT', payload) : api('/students', 'POST', payload));
    } else if (activeModalType === 'course') {
      const payload = {
        code: $('c-code').value, title: $('c-title').value, units: $('c-units').value,
        schedule: $('c-schedule').value, professor: $('c-prof').value || null
      };
      await (editingItem ? api('/courses/' + editingItem.id, 'PUT', payload) : api('/courses', 'POST', payload));
    } else if (activeModalType === 'grade') {
      if (editingItem) {
        await api('/grades/' + editingItem.id, 'PUT', { midterm: $('g-midterm').value, final: $('g-final').value });
      } else {
        const studentNum = $('g-student').value;
        if (!studentNum) throw new Error('Select a student first.');
        await api('/grades', 'POST', { studentNum, code: $('g-course').value, midterm: $('g-midterm').value, final: $('g-final').value });
      }
    } else if (activeModalType === 'enroll') {
      const codes = [...document.querySelectorAll('.enroll-box:checked')].map(b => b.value);
      await api(`/students/${editingItem.id}/enrollments`, 'PUT', { codes });
    }
    await loadAll();
  } catch (err) {
    banner(errEl, err.message); btn.disabled = false; return;
  }
  btn.disabled = false;
  closeModal(); renderSidebar(); renderContent(); toast('Saved.');
}

/* ---------------------------------------------------------------- actions */
async function removeRecord(path, label) {
  if (!confirm('Delete this ' + label + '?')) return;
  try { await api(path, 'DELETE'); await loadAll(); renderSidebar(); renderContent(); toast('Deleted.'); }
  catch (err) { alert('Delete failed: ' + err.message); }
}
const findBy = (list, id) => list.find(x => String(x.id || x._id) === String(id));

function editStudent(id) { const s = findBy(db.students, id); if (s) openModal('student', s); }
function openEnrollModal(id) { const s = findBy(db.students, id); if (s) openModal('enroll', s); }
function deleteStudent(id) { removeRecord('/students/' + id, 'student (this also removes their account, grades and enrollment)'); }
function editCourse(id) { const c = findBy(db.courses, id); if (c) openModal('course', c); }
function deleteCourse(id) { removeRecord('/courses/' + id, 'course (this also removes its enrollments and grades)'); }
function editGrade(id) { const g = findBy(db.grades, id); if (g) openModal('grade', g); }
function deleteGrade(id) { removeRecord('/grades/' + id, 'grade record'); }

async function setRegStatus(id, status) {
  try {
    await api(`/users/${id}/status`, 'PATCH', { status });
    await loadAll(); renderSidebar(); viewRegistrations();
    toast(status === 'approved' ? 'Account confirmed. The user can now sign in.' : 'Account access rejected.');
  } catch (err) { alert('Update failed: ' + err.message); }
}
function deleteRegistration(id) {
  if (!confirm('Permanently delete this registration?')) return;
  api('/users/' + id, 'DELETE').then(loadAll).then(() => { renderSidebar(); viewRegistrations(); toast('Deleted.'); })
    .catch(err => alert('Delete failed: ' + err.message));
}

/* ------------------------------------------------------------------- init */
(async function init() {
  if (!state.token) return;
  try {
    const { user } = await api('/auth/me');
    await enterApp(user);
  } catch { state.token = null; sessionStorage.removeItem('bu_token'); }
})();
