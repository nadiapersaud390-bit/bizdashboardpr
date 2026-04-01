// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const ATTENDANCE_URL = 'https://script.google.com/macros/s/AKfycbx3KgIsi044NcqzbSRaCUSoz9wgdyYhhXx4VVe9UmPBA-OPY9mc7VaXBByowHqECi5GRw/exec';

const AGENT_WHITELIST = {
  'REO': 'Reo',
  // Add more: 'YTELID': 'Full Name'
};

const ADMINS = [
  { name: 'Nadia', password: 'GodisLove', level: 'super'     },
  { name: 'Admin', password: '0000',      level: 'secondary' },
  { name: 'Jamal', password: '0000',      level: 'secondary' },
];

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let loginMode = 'agent';
let currentUser = null;
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

// ─────────────────────────────────────────────
// CURSOR TRACKING
// ─────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const cursor = document.getElementById('login-cursor');
const cursorDot = document.getElementById('login-cursor-dot');

let cursorRX = mouseX, cursorRY = mouseY;
let dotRX = mouseX, dotRY = mouseY;

loginScreen && loginScreen.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

loginScreen && loginScreen.addEventListener('mouseenter', () => {
  if (cursor) { cursor.style.opacity = '1'; cursorDot.style.opacity = '1'; }
});
loginScreen && loginScreen.addEventListener('mouseleave', () => {
  if (cursor) { cursor.style.opacity = '0'; cursorDot.style.opacity = '0'; }
});

// Make interactive elements big the cursor
document.querySelectorAll('.login-btn, .login-tab, .login-input').forEach(el => {
  el.addEventListener('mouseenter', () => cursor && cursor.classList.add('big'));
  el.addEventListener('mouseleave', () => cursor && cursor.classList.remove('big'));
});

function animateCursor() {
  // Cursor animation disabled — cursors are hidden
}
animateCursor();

// ─────────────────────────────────────────────
// CANVAS — disabled for performance
// ─────────────────────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById('login-canvas');
  if (canvas) canvas.style.display = 'none';
})();

// ─────────────────────────────────────────────
// FLOATING HEADSET — static, no parallax loop
// ─────────────────────────────────────────────
(function headsetParallax() {
  // Parallax removed for performance
})();

// ─────────────────────────────────────────────
// WAVEFORM
// ─────────────────────────────────────────────
(function buildWaveform() {
  const container = document.getElementById('login-waveform');
  if (!container) return;
  const NUM_BARS = 28;
  for (let i = 0; i < NUM_BARS; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    const height = Math.random() * 60 + 20;
    bar.style.cssText = `height:${height}%;animation-delay:${(i * 0.06).toFixed(2)}s;animation-duration:${(0.6 + Math.random() * 0.6).toFixed(2)}s;`;
    container.appendChild(bar);
  }
})();

// ─────────────────────────────────────────────
// LIVE CLOCK ON LOGIN
// ─────────────────────────────────────────────
function updateLoginClock() {
  const el = document.getElementById('login-clock-display');
  if (!el) return;
  const t = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  el.textContent = 'Live · ' + t;
}
updateLoginClock();
setInterval(updateLoginClock, 1000);

// ─────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────
function setLoginMode(mode) {
  loginMode = mode;
  document.getElementById('tab-agent').classList.toggle('active', mode === 'agent');
  document.getElementById('tab-admin').classList.toggle('active', mode === 'admin');
  document.getElementById('agent-form').style.display = mode === 'agent' ? '' : 'none';
  document.getElementById('admin-form').style.display  = mode === 'admin'  ? '' : 'none';
  document.getElementById('agent-error').textContent = '';
  document.getElementById('admin-error').textContent = '';
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
// Parse a shift string like "8AM-5PM" or "8:00 AM - 5:00 PM" into start hour (24h) and minute
function parseShiftStart(shiftStr) {
  if (!shiftStr) return null;
  // Try common patterns: "8AM", "8:30AM", "8:00 AM", "8:00AM - 5PM"
  const m = shiftStr.replace(/\s+/g,'').match(/^(\d{1,2})(?::(\d{2}))?(AM|PM|am|pm)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  const meridiem = (m[3]||'').toUpperCase();
  if (meridiem === 'PM' && h !== 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return { h, min };
}

// Returns true if the agent is logging in more than 15 minutes late
function isLateLogin(shiftStr) {
  const start = parseShiftStart(shiftStr);
  if (!start) return false;
  const now = new Date();
  const guyanaStr = now.toLocaleString('en-US', { timeZone: 'America/Guyana' });
  const guyana = new Date(guyanaStr);
  const currentH = guyana.getHours();
  const currentM = guyana.getMinutes();
  const currentTotalMin = currentH * 60 + currentM;
  const shiftTotalMin = start.h * 60 + start.min;
  return (currentTotalMin - shiftTotalMin) > 15;
}

// ─────────────────────────────────────────────
// AGENT LOGIN
// ─────────────────────────────────────────────
async function attemptAgentLogin() {
  const input = document.getElementById('agent-ytel-input');
  const errEl = document.getElementById('agent-error');
  const ytelId = input.value.trim().toUpperCase();
  if (!ytelId) { shakeInput(input); errEl.innerHTML = '⚠ Please enter your Ytel ID'; return; }

  errEl.textContent = '';
  input.disabled = true;

  // First, try to look up the agent in the roster to get their name + shift for late detection
  let agentName = AGENT_WHITELIST[ytelId] || ytelId;
  let shiftForLate = null;
  let rosterData = null;

  try {
    const url = ATTENDANCE_URL
      + '?action=getAgentSchedule'
      + '&ytelId=' + encodeURIComponent(ytelId)
      + '&agentName=';
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal });
    clearTimeout(fetchTimeout);
    rosterData = await resp.json();
    if (rosterData && rosterData.found) {
      agentName = rosterData.name || agentName;
      shiftForLate = rosterData.shift || null;
    }
  } catch(e) {
    // Roster lookup failed or timed out — proceed with local name
  }

  const clockTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit'
  });

  // Determine if late
  const late = shiftForLate ? isLateLogin(shiftForLate) : false;
  const statusBadge = late
    ? '⚠️ Marked Late · ' + clockTime
    : '✅ Marked Present · ' + clockTime;
  const successMsg = late ? 'Late Arrival Recorded' : 'Welcome Back!';

  showLoginSuccess(agentName, successMsg, statusBadge, late);
  markPRAttendance(ytelId, agentName, late);

  setTimeout(() => {
    currentUser = { name: agentName, ytelId, role: 'agent', level: 'agent', late, rosterData, clockedTime: clockTime };
    enterDashboard();
  }, 2600);
}

// ─────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────
function attemptAdminLogin() {
  const nameInput = document.getElementById('admin-name-input');
  const passInput = document.getElementById('admin-pass-input');
  const errEl = document.getElementById('admin-error');
  const name = nameInput.value.trim();
  const pass = passInput.value.trim();

  if (!name || !pass) {
    errEl.innerHTML = '⚠ Enter both name and password';
    shakeInput(!name ? nameInput : passInput); return;
  }

  const admin = ADMINS.find(a => a.name.toLowerCase() === name.toLowerCase() && a.password === pass);
  if (!admin) {
    errEl.innerHTML = '⚠ Invalid credentials';
    shakeInput(passInput); passInput.value = ''; return;
  }

  errEl.textContent = '';
  nameInput.disabled = true; passInput.disabled = true;
  const levelLabel = admin.level === 'super' ? '🔐 Super Admin Unlocked' : '🛡️ Admin Access Granted';
  showLoginSuccess(admin.name, levelLabel, '✓ Full Dashboard Access');

  setTimeout(() => {
    currentUser = { name: admin.name, role: 'admin', level: admin.level };
    bcAdminUnlocked = true;
    const floatBtn = document.getElementById('bc-float-btn');
    if (floatBtn) { floatBtn.classList.add('unlocked'); floatBtn.style.animation = 'bcBtnAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) both'; }
    const panel = document.getElementById('bc-panel');
    if (panel && !document.getElementById('bc-tp-preview-btn')) {
      const btn = document.createElement('button');
      btn.id = 'bc-tp-preview-btn'; btn.className = 'bc-clear-btn';
      btn.style.cssText = 'margin-top:6px;color:#FFD700;border-color:rgba(255,215,0,0.25);';
      btn.innerHTML = '👑 Preview Top Performers';
      btn.onclick = () => showTopPerformerPopup(true);
      panel.appendChild(btn);
    }
    // ── Role-specific extras ──
    if (admin.name.toLowerCase() === 'jamal' && typeof window._startJamalTracking === 'function') {
      window._startJamalTracking();
    }
    if (admin.level === 'super' && typeof window._startNadiaMonitor === 'function') {
      window._startNadiaMonitor();
    }
    enterDashboard();
  }, 2600);
}

// ─────────────────────────────────────────────
// ATTENDANCE — mark agent P or L in the PR Weekly sheet only.
// No Attendance Log tab. Single call, no duplication.
// ─────────────────────────────────────────────
async function markPRAttendance(ytelId, agentName, late) {
  try {
    const now = new Date();
    const params = new URLSearchParams({
      action: 'attendance',
      ytelId,
      name: agentName,
      status: late ? 'Late' : 'Present',
      time: now.toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: now.toLocaleDateString('en-US', { timeZone: 'America/Guyana', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      timestamp: now.toISOString(),
    });
    await fetch(ATTENDANCE_URL + '?' + params.toString(), { method: 'GET', mode: 'no-cors' });
    console.log('Attendance marked (' + (late ? 'L' : 'P') + ') for', agentName);
  } catch (e) { console.warn('Attendance mark failed:', e); }
}

// ─────────────────────────────────────────────
// SUCCESS + ENTER DASHBOARD
// ─────────────────────────────────────────────
function showLoginSuccess(name, msg, badge, late) {
  document.getElementById('success-name-text').textContent = name;
  document.getElementById('success-msg-text').textContent = msg;
  document.getElementById('attendance-badge-text').textContent = badge;
  // Visual indicator: orange ring + warning icon if late
  const checkIcon = document.getElementById('success-check-icon');
  const fill = document.getElementById('success-loading-fill');
  if (late) {
    if (checkIcon) checkIcon.textContent = '⚠️';
    if (fill) fill.style.background = 'linear-gradient(90deg,#f97316,#eab308)';
    const rings = document.querySelectorAll('.success-ring');
    rings.forEach(r => { r.style.borderColor = r.style.borderColor.replace('197,94','115,22'); });
    const badge2 = document.getElementById('attendance-badge-text');
    if (badge2) badge2.style.cssText += ';background:rgba(249,115,22,0.12);border-color:rgba(249,115,22,0.35);color:#f97316;';
  } else {
    if (checkIcon) checkIcon.textContent = '✅';
    if (fill) fill.style.background = '';
  }
  document.getElementById('login-success').classList.add('show');
}

function enterDashboard() {
  if (currentUser) saveSession(currentUser);
  const screen = document.getElementById('login-screen');
  screen.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  screen.style.opacity = '0';
  screen.style.transform = 'scale(1.06)';
  // Hide cursor elements
  if (cursor) cursor.style.display = 'none';
  if (cursorDot) cursorDot.style.display = 'none';
  setTimeout(() => {
    screen.style.display='none';
    document.body.style.cursor = '';
    renderUserBadge();
    if (currentUser && currentUser.role === 'agent') {
      showAgentInfoBanner();
    }
  }, 600);
}

// ─────────────────────────────────────────────
// AGENT INFO BANNER — pulls from Apps Script
// Supports PR agents: match by Ytel ID → name
// Shows Live Performance (daily leads) under name
// Marks Present / Late based on shift time
// ─────────────────────────────────────────────
async function showAgentInfoBanner() {
  if (!currentUser || currentUser.role !== 'agent') return;

  const banner    = document.getElementById('agent-info-banner');
  const nameEl    = document.getElementById('aib-name');
  const roleEl    = document.getElementById('aib-role');
  const rowsEl    = document.getElementById('aib-rows');
  const badgeEl   = document.getElementById('aib-clocked-badge');
  const timeEl    = document.getElementById('aib-clock-time');
  const presenceBadge = document.getElementById('aib-presence-badge');
  const presenceLabel = document.getElementById('aib-presence-label');
  const perfRow   = document.getElementById('aib-perf-row');

  // Set name and Ytel ID immediately
  nameEl.textContent = currentUser.name;
  roleEl.textContent = (currentUser.ytelId ? currentUser.ytelId + ' · ' : '') + 'Agent';

  // Clock-in time — use saved time from session so refresh doesn't change it
  const clockedTime = currentUser.clockedTime || new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit'
  });
  timeEl.textContent = 'Clocked in · ' + clockedTime;

  // Mark Present or Late
  const late = currentUser.late || false;
  if (late) {
    badgeEl.textContent = '⚠ Late Arrival';
    badgeEl.className = 'aib-clocked late';
    presenceBadge.className = 'aib-presence-badge late';
    presenceLabel.textContent = 'Late';
  } else {
    badgeEl.textContent = '✓ Present';
    badgeEl.className = 'aib-clocked';
    presenceBadge.className = 'aib-presence-badge present';
    presenceLabel.textContent = 'Present';
  }

  banner.classList.add('show');

  // Use cached roster data if already fetched during login
  let data = currentUser.rosterData || null;

  if (!data) {
    try {
      const url = ATTENDANCE_URL
        + '?action=getAgentSchedule'
        + '&ytelId=' + encodeURIComponent(currentUser.ytelId || '')
        + '&agentName=' + encodeURIComponent(currentUser.name || '');
      const resp = await fetch(url, { method: 'GET', mode: 'cors' });
      data = await resp.json();
    } catch (e) {
      console.warn('Schedule fetch failed:', e);
    }
  }

  if (data && data.found) {
    // Update name to matched roster name
    if (data.name) {
      nameEl.textContent = data.name;
      currentUser.name = data.name;
    }
    if (data.team) roleEl.textContent = (currentUser.ytelId ? currentUser.ytelId + ' · ' : '') + 'Agent · ' + data.team;

    // Show compact performance row under name
    const shiftVal  = document.getElementById('aib-perf-shift');
    const lunchVal  = document.getElementById('aib-perf-lunch');
    const weekVal   = document.getElementById('aib-perf-weekly');
    const dailyVal  = document.getElementById('aib-perf-daily');

    let perfVisible = false;
    if (data.shift)   { shiftVal.textContent = data.shift;    perfVisible = true; }
    if (data.lunch)   { lunchVal.textContent = data.lunch;    perfVisible = true; }
    if (data.weekLead != null) { weekVal.textContent = String(data.weekLead); perfVisible = true; }

    // Try to find this agent's daily lead count from the live leaderboard
    const agentLower = (data.name || currentUser.name || '').toLowerCase();
    if (typeof agents !== 'undefined' && agents.length) {
      const match = agents.find(a => a.name && a.name.toLowerCase().includes(agentLower));
      if (match) {
        dailyVal.textContent = String(match.dailyLeads || 0);
        perfVisible = true;
      }
    }

    if (perfVisible) {
      perfRow.style.display = 'flex';
      rowsEl.style.display = 'none'; // Hide old pill row — data shown in perf row
    } else {
      rowsEl.innerHTML = '<div class="aib-pill-loading">Schedule on file — no details</div>';
    }

    // Also check late status now that we have shift from roster
    if (!currentUser.late && data.shift) {
      const nowLate = isLateLogin(data.shift);
      if (nowLate) {
        badgeEl.textContent = '⚠ Late Arrival';
        badgeEl.className = 'aib-clocked late';
        presenceBadge.className = 'aib-presence-badge late';
        presenceLabel.textContent = 'Late';
      }
    }

  } else {
    rowsEl.innerHTML = '<div class="aib-pill-loading">No schedule on file</div>';
  }
}

// Periodically refresh daily lead count in banner (every 30s)
setInterval(() => {
  if (!currentUser || currentUser.role !== 'agent') return;
  const dailyVal = document.getElementById('aib-perf-daily');
  if (!dailyVal) return;
  const agentLower = (currentUser.name || '').toLowerCase();
  if (typeof agents !== 'undefined' && agents.length) {
    const match = agents.find(a => a.name && a.name.toLowerCase().includes(agentLower));
    if (match) dailyVal.textContent = String(match.dailyLeads || 0);
  }
}, 30000);

function renderUserBadge() {
  if (!currentUser) return;
  // Show logout button only — agent badge card removed
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.classList.add('show');

  // Hide Weekly tab for agents; show only for admins
  const weeklyTab = document.getElementById('tab-weekly');
  if (weeklyTab) {
    weeklyTab.style.display = currentUser.role === 'admin' ? '' : 'none';
  }

  // Show "Who's Online" tab only for Nadia (super admin)
  const onlineTab = document.getElementById('tab-online');
  if (onlineTab) {
    const isNadia = currentUser.role === 'admin' && currentUser.level === 'super';
    onlineTab.style.display = isNadia ? '' : 'none';
  }

  // Write this user's session to Firebase presence
  if (typeof window._fbWriteSession === 'function') {
    window._fbWriteSession(currentUser);
  }
}

// ─────────────────────────────────────────────
// SESSION PERSISTENCE
// ─────────────────────────────────────────────
function getTodayDateString() {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Guyana' });
}

function saveSession(user) {
  const session = { user, loginDate: getTodayDateString() };
  sessionStorage.setItem('biz_session', JSON.stringify(session));
  // Also mirror to localStorage for cross-tab/refresh persistence
  localStorage.setItem('biz_session', JSON.stringify(session));
}

function loadSession() {
  try {
    const raw = localStorage.getItem('biz_session') || sessionStorage.getItem('biz_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    // If saved on a different calendar day → expired
    if (session.loginDate !== getTodayDateString()) {
      clearSession();
      return null;
    }
    return session.user;
  } catch (e) { return null; }
}

function clearSession() {
  sessionStorage.removeItem('biz_session');
  localStorage.removeItem('biz_session');
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
function logoutUser() {
  clearSession();
  currentUser = null;
  bcAdminUnlocked = false;

  // Hide logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.classList.remove('show');

  // Remove user badge
  const badge = document.getElementById('user-badge');
  if (badge) badge.remove();

  // Hide agent info banner
  const banner = document.getElementById('agent-info-banner');
  if (banner) banner.classList.remove('show');

  // Hide broadcast float btn
  const floatBtn = document.getElementById('bc-float-btn');
  if (floatBtn) floatBtn.classList.remove('unlocked');

  // Reset agent input
  const agentInput = document.getElementById('agent-ytel-input');
  if (agentInput) { agentInput.value = ''; agentInput.disabled = false; }
  const adminNameInput = document.getElementById('admin-name-input');
  if (adminNameInput) { adminNameInput.value = ''; adminNameInput.disabled = false; }
  const adminPassInput = document.getElementById('admin-pass-input');
  if (adminPassInput) { adminPassInput.value = ''; adminPassInput.disabled = false; }

  // Show login screen
  const screen = document.getElementById('login-screen');
  screen.style.opacity = '0';
  screen.style.transform = 'scale(0.96)';
  screen.style.display='';
  requestAnimationFrame(() => {
    screen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    screen.style.opacity = '1';
    screen.style.transform = 'scale(1)';
  });

  // Restore cursor
  if (cursor) cursor.style.display = '';
  if (cursorDot) cursorDot.style.display = '';

  // Reset login mode to agent
  setLoginMode('agent');
  setTimeout(() => { const i = document.getElementById('agent-ytel-input'); if (i) i.focus(); }, 500);
}

// ─────────────────────────────────────────────
// WHO'S ONLINE VIEW — Nadia Super-Admin
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// WHO'S ONLINE VIEW — Nadia Super-Admin (UPGRADED)
// Full activity feed per user: tabs visited + clicks
// ─────────────────────────────────────────────

function renderOnlineView() {
  const sessions = window._activeSessions || {};
  _buildOnlineCards(sessions);
  // Re-render session cards when Firebase updates
  window._onSessionsUpdate = (sess) => _buildOnlineCards(sess);
  // Re-render activity drawers when activity updates
  window._onActivityUpdate = (activity) => _refreshAllActivityDrawers(activity);
}

function _getUserKey(entry) {
  return (entry.ytelId || entry.name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function _buildOnlineCards(sessions) {
  const list = document.getElementById('online-users-list');
  if (!list) return;

  const entries = Object.values(sessions);
  if (!entries.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#475569;font-size:13px;font-weight:700;"><div style="font-size:36px;margin-bottom:10px;">👁</div><div>No sessions recorded yet.</div><div style="font-size:11px;color:#334155;margin-top:6px;">Users will appear here when they log in.</div></div>';
    document.getElementById('online-count-present').textContent = '0';
    document.getElementById('online-count-late').textContent = '0';
    document.getElementById('online-count-total').textContent = '0';
    return;
  }

  entries.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return (b.since || 0) - (a.since || 0);
  });

  let presentCount = 0, lateCount = 0;
  entries.forEach(e => { if (e.online) { presentCount++; if (e.late) lateCount++; } });
  document.getElementById('online-count-present').textContent = presentCount;
  document.getElementById('online-count-late').textContent = lateCount;
  document.getElementById('online-count-total').textContent = entries.length;

  const isAdminEntry = (e) => e.role === 'admin';

  // Preserve open drawers
  const openKeys = new Set();
  list.querySelectorAll('.ou-activity-drawer[data-open="true"]').forEach(d => openKeys.add(d.dataset.userkey));

  list.innerHTML = entries.map((e, i) => {
    const key = _getUserKey(e);
    const emoji = isAdminEntry(e) ? '🛡️' : e.late ? '⚠️' : e.online ? '🎧' : '💤';
    const dotClass = !e.online ? 'offline' : e.late ? 'late' : 'online';
    const avatarClass = !e.online ? 'offline' : isAdminEntry(e) ? 'admin' : e.late ? 'late' : 'online';
    const cardClass = !e.online ? 'is-offline' : e.late ? 'is-late' : 'is-online';

    const sinceTime = e.since ? new Date(e.since).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit' }) : '';
    const lastSeenTime = e.lastSeen ? new Date(e.lastSeen).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit' }) : '';

    let badgeLabel, badgeClass;
    if (!e.online) { badgeLabel = lastSeenTime ? 'Last seen ' + lastSeenTime : 'Offline'; badgeClass = 'offline'; }
    else if (isAdminEntry(e)) { badgeLabel = '🔐 Admin'; badgeClass = 'admin'; }
    else if (e.late) { badgeLabel = '⚠ Late'; badgeClass = 'late'; }
    else { badgeLabel = '✓ Present'; badgeClass = 'present'; }

    const metaParts = [];
    if (e.ytelId) metaParts.push(e.ytelId);
    if (e.role) metaParts.push(e.role === 'admin' ? (e.level === 'super' ? 'Super Admin' : 'Admin') : 'Agent');
    if (sinceTime && e.online) metaParts.push('In since ' + sinceTime);
    if (e.clockedTime && e.online && !isAdminEntry(e)) metaParts.push('Clocked ' + e.clockedTime);

    // Get activity for this user
    const activity = (window._allUserActivity || {})[key] || {};
    const events = activity.events ? Object.entries(activity.events) : [];
    const sorted = events.sort((a,b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 20);

    const lastAction = sorted.length ? sorted[0][1] : null;
    const lastActionText = lastAction ? (lastAction.label || '—') : null;
    const lastActionTime = sorted.length ? new Date(parseInt(sorted[0][0])).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

    const isOpen = openKeys.has(key);

    const activityRows = sorted.length ? sorted.map(([ts, ev]) => {
      const t = new Date(parseInt(ts)).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const typeColor = ev.type === 'tab' ? '#8b5cf6' : '#3b82f6';
      const typeLabel = ev.type === 'tab' ? 'TAB' : 'CLICK';
      const typeBg = ev.type === 'tab' ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.1)';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);margin-bottom:4px;">
        <span style="background:${typeBg};border:1px solid ${typeColor}33;border-radius:5px;padding:1px 5px;font-size:8px;font-weight:900;text-transform:uppercase;color:${typeColor};flex-shrink:0;margin-top:1px;">${typeLabel}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.label || '—'}</div>
          ${ev.extra ? `<div style="font-size:9px;color:#475569;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.extra}</div>` : ''}
        </div>
        <span style="font-size:9px;color:#475569;flex-shrink:0;">${t}</span>
      </div>`;
    }).join('') : '<div style="color:#334155;font-size:11px;font-weight:700;padding:10px 0;text-align:center;">No activity recorded yet</div>';

    return `<div class="online-user-card ${cardClass}" style="flex-direction:column;align-items:stretch;gap:0;padding:0;animation-delay:${i * 0.05}s;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;" onclick="_toggleActivityDrawer('${key}')">
        <div class="ou-avatar ${avatarClass}">${emoji}</div>
        <div style="flex:1;min-width:0;">
          <div class="ou-name">${e.name || 'Unknown'}</div>
          <div class="ou-meta">${metaParts.join(' · ')}</div>
          ${lastActionText && e.online ? `<div style="font-size:9px;color:#a78bfa;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⚡ ${lastActionText}${lastActionTime ? ' · ' + lastActionTime : ''}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span class="ou-dot ${dotClass}"></span>
          <span class="ou-badge ${badgeClass}">${badgeLabel}</span>
          <span style="color:#475569;font-size:10px;transition:transform 0.25s;" id="ou-arrow-${key}">${isOpen ? '▲' : '▼'}</span>
        </div>
      </div>
      <div class="ou-activity-drawer" data-userkey="${key}" data-open="${isOpen}" style="max-height:${isOpen ? '420px' : '0'};overflow:hidden;transition:max-height 0.35s ease;background:rgba(0,0,0,0.25);border-top:${isOpen ? '1px solid rgba(139,92,246,0.2)' : 'none'};">
        <div style="padding:12px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#8b5cf6;">📋 Activity Feed — Last 20 Actions</div>
            <div style="font-size:9px;color:#334155;font-weight:700;">${sorted.length} event${sorted.length !== 1 ? 's' : ''}</div>
          </div>
          <div id="ou-feed-${key}" style="max-height:320px;overflow-y:auto;">${activityRows}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Update last-update timestamp
  const upEl = document.getElementById('online-last-update');
  if (upEl) {
    const t = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    upEl.textContent = 'Updated ' + t;
  }
}

function _toggleActivityDrawer(key) {
  const drawer = document.querySelector('.ou-activity-drawer[data-userkey="' + key + '"]');
  const arrow = document.getElementById('ou-arrow-' + key);
  if (!drawer) return;
  const isOpen = drawer.dataset.open === 'true';
  drawer.dataset.open = isOpen ? 'false' : 'true';
  drawer.style.maxHeight = isOpen ? '0' : '420px';
  drawer.style.borderTop = isOpen ? 'none' : '1px solid rgba(139,92,246,0.2)';
  if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
}

function _refreshAllActivityDrawers(activity) {
  // Update only the open feed divs so we don't re-render everything
  document.querySelectorAll('.ou-activity-drawer[data-open="true"]').forEach(drawer => {
    const key = drawer.dataset.userkey;
    const feedEl = document.getElementById('ou-feed-' + key);
    if (!feedEl) return;
    const userActivity = (activity || {})[key] || {};
    const events = userActivity.events ? Object.entries(userActivity.events) : [];
    const sorted = events.sort((a,b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 20);
    if (!sorted.length) return;

    // Update "last action" text in header row
    const card = drawer.closest('.online-user-card');
    if (card) {
      const lastEv = sorted[0][1];
      const lastTs = new Date(parseInt(sorted[0][0])).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const lastActionEl = card.querySelector('div[style*="color:#a78bfa"]');
      if (lastActionEl) lastActionEl.textContent = '⚡ ' + (lastEv.label || '—') + ' · ' + lastTs;
    }

    feedEl.innerHTML = sorted.map(([ts, ev]) => {
      const t = new Date(parseInt(ts)).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const typeColor = ev.type === 'tab' ? '#8b5cf6' : '#3b82f6';
      const typeLabel = ev.type === 'tab' ? 'TAB' : 'CLICK';
      const typeBg = ev.type === 'tab' ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.1)';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);margin-bottom:4px;">
        <span style="background:${typeBg};border:1px solid ${typeColor}33;border-radius:5px;padding:1px 5px;font-size:8px;font-weight:900;text-transform:uppercase;color:${typeColor};flex-shrink:0;margin-top:1px;">${typeLabel}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.label || '—'}</div>
          ${ev.extra ? `<div style="font-size:9px;color:#475569;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.extra}</div>` : ''}
        </div>
        <span style="font-size:9px;color:#475569;flex-shrink:0;">${t}</span>
      </div>`;
    }).join('');
  });

  // Also refresh the last-action preview on closed cards
  document.querySelectorAll('.ou-activity-drawer[data-open="false"]').forEach(drawer => {
    const key = drawer.dataset.userkey;
    const card = drawer.closest('.online-user-card');
    if (!card) return;
    const userActivity = (activity || {})[key] || {};
    const events = userActivity.events ? Object.entries(userActivity.events) : [];
    const sorted = events.sort((a,b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 1);
    if (!sorted.length) return;
    const lastEv = sorted[0][1];
    const lastTs = new Date(parseInt(sorted[0][0])).toLocaleTimeString('en-US', { timeZone: 'America/Guyana', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const lastActionEl = card.querySelector('div[style*="color:#a78bfa"]');
    if (lastActionEl) lastActionEl.textContent = '⚡ ' + (lastEv.label || '—') + ' · ' + lastTs;
  });
}

// ─────────────────────────────────────────────
// NADIA ONLINE VIEW HELPERS
// ─────────────────────────────────────────────
function _nadiaExpandAll() {
  document.querySelectorAll('.ou-activity-drawer').forEach(drawer => {
    const key = drawer.dataset.userkey;
    drawer.dataset.open = 'true';
    drawer.style.maxHeight = '420px';
    drawer.style.borderTop = '1px solid rgba(139,92,246,0.2)';
    const arrow = document.getElementById('ou-arrow-' + key);
    if (arrow) arrow.textContent = '▲';
  });
  // Trigger a full activity refresh to populate all open drawers
  if (window._allUserActivity) _refreshAllActivityDrawers(window._allUserActivity);
}

function _nadiaCollapseAll() {
  document.querySelectorAll('.ou-activity-drawer').forEach(drawer => {
    const key = drawer.dataset.userkey;
    drawer.dataset.open = 'false';
    drawer.style.maxHeight = '0';
    drawer.style.borderTop = 'none';
    const arrow = document.getElementById('ou-arrow-' + key);
    if (arrow) arrow.textContent = '▼';
  });
}

// ─────────────────────────────────────────────
// MIDNIGHT AUTO-LOGOUT (Guyana time)
// ─────────────────────────────────────────────
function scheduleMidnightLogout() {
  const now = new Date();
  // Get current Guyana time
  const guyanaStr = now.toLocaleString('en-US', { timeZone: 'America/Guyana' });
  const guyana = new Date(guyanaStr);
  // Calculate ms until next midnight in Guyana
  const nextMidnight = new Date(guyana);
  nextMidnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = nextMidnight - guyana;

  setTimeout(() => {
    if (currentUser) {
      clearSession();
      logoutUser();
    }
    // Re-schedule for next day too
    scheduleMidnightLogout();
  }, msUntilMidnight);
}
scheduleMidnightLogout();

// ─────────────────────────────────────────────
// RESTORE SESSION ON PAGE LOAD
// ─────────────────────────────────────────────
(function restoreSession() {
  const savedUser = loadSession();
  if (!savedUser) return;

  currentUser = savedUser;

  // Replicate admin-specific state
  if (currentUser.role === 'admin') {
    bcAdminUnlocked = true;
    const floatBtn = document.getElementById('bc-float-btn');
    if (floatBtn) { floatBtn.classList.add('unlocked'); }
    const panel = document.getElementById('bc-panel');
    if (panel && !document.getElementById('bc-tp-preview-btn')) {
      const btn = document.createElement('button');
      btn.id = 'bc-tp-preview-btn'; btn.className = 'bc-clear-btn';
      btn.style.cssText = 'margin-top:6px;color:#FFD700;border-color:rgba(255,215,0,0.25);';
      btn.innerHTML = '👑 Preview Top Performers';
      btn.onclick = () => showTopPerformerPopup(true);
      panel.appendChild(btn);
    }
    // Re-start role-specific monitors on session restore
    if (currentUser.name && currentUser.name.toLowerCase() === 'jamal') {
      // Defer until Firebase is ready
      setTimeout(() => {
        if (typeof window._startJamalTracking === 'function') window._startJamalTracking();
      }, 800);
    }
    if (currentUser.level === 'super') {
      setTimeout(() => {
        if (typeof window._startNadiaMonitor === 'function') window._startNadiaMonitor();
      }, 800);
    }
  }

  // Skip login screen and go straight to dashboard
  const screen = document.getElementById('login-screen');
  if (screen) screen.style.display='none';
  document.body.style.cursor = '';
  if (cursor) cursor.style.display = 'none';
  if (cursorDot) cursorDot.style.display = 'none';

  renderUserBadge();
  if (currentUser.role === 'agent') showAgentInfoBanner();
})();

// ─────────────────────────────────────────────
// PATCH: save session after successful login
// ─────────────────────────────────────────────
// Session is saved inside enterDashboard directly (see above)

function shakeInput(el) {
  el.classList.add('error');
  setTimeout(() => el.classList.remove('error'), 600);
}

// Autofocus
setTimeout(() => { const i = document.getElementById('agent-ytel-input'); if (i) i.focus(); }, 500);
