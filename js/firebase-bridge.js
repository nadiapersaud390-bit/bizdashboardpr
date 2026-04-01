/**
 * firebase-bridge.js — BIZ Level Up Dashboard (PR)
 * Converted from ES module syntax to compat SDK (no import/export).
 * firebase-config.js must run first and set window.db.
 */
(function() {
  const db = window.db;
  const broadcastRef     = db.ref('broadcast');
  const triviaRef        = db.ref('trivia_scores');
  const sessionsRef      = db.ref('active_sessions');
  const activityRef      = db.ref('user_activity');
  const jamalPresenceRef = db.ref('admin_monitor/jamal/presence');
  const jamalClicksRef   = db.ref('admin_monitor/jamal/clicks');

  // ── BROADCAST LISTENER ──────────────────────────────────────────────
  broadcastRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.message && data.active) {
      if (typeof showBroadcastBar === 'function') showBroadcastBar(data.message);
      else window._pendingBroadcast = data.message;
    } else {
      if (typeof hideBroadcastBar === 'function') hideBroadcastBar();
      else window._pendingBroadcast = null;
    }
  });

  // ── TRIVIA SCORES LISTENER ───────────────────────────────────────────
  triviaRef.on('value', (snapshot) => {
    window._triviaFirebaseScores = snapshot.val() || {};
    if (typeof renderTriviaLeaderboard === 'function') renderTriviaLeaderboard();
  });

  // ── BROADCAST WRITE / CLEAR ──────────────────────────────────────────
  window._fbSendBroadcast = async (msg) => {
    await broadcastRef.set({ message: msg, active: true, ts: Date.now() });
  };
  window._fbClearBroadcast = async () => {
    await broadcastRef.remove();
  };

  // ── TRIVIA SCORE SAVE ────────────────────────────────────────────────
  window._fbSaveTriviaScore = async (roundKey, entry) => {
    const key = roundKey + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await db.ref('trivia_scores/' + key).set(entry);
  };

  // ── JAMAL MONITORING ─────────────────────────────────────────────────
  window._startJamalTracking = async () => {
    const _jamalSince = Date.now();
    await jamalPresenceRef.set({ online: true, since: _jamalSince, ts: new Date().toISOString() });
    localStorage.setItem('biz_jamal_since', String(_jamalSince));
    window.addEventListener('beforeunload', () => {
      const storedSince = parseInt(localStorage.getItem('biz_jamal_since') || '0');
      if (storedSince === _jamalSince) {
        jamalPresenceRef.set({ online: false, lastSeen: Date.now(), ts: new Date().toISOString() });
      }
    });
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button,a,[data-tab]') || e.target;
      const label = (target.textContent || '').trim().slice(0, 80)
                  || target.getAttribute('aria-label') || target.id || target.tagName;
      db.ref('admin_monitor/jamal/clicks/' + Date.now()).set({
        label, tag: target.tagName, id: target.id || '', ts: new Date().toISOString()
      });
    }, true);
  };

  // ── NADIA SUPER-ADMIN MONITOR ────────────────────────────────────────
  window._startNadiaMonitor = () => {
    const panel = document.createElement('div');
    panel.id = 'nadia-monitor-panel';
    panel.style.cssText = 'position:fixed;bottom:90px;left:16px;z-index:10001;width:min(300px,calc(100vw - 32px));background:rgba(5,0,30,0.97);border:1px solid rgba(139,92,246,0.5);border-radius:20px;padding:18px;box-shadow:0 8px 40px rgba(139,92,246,0.3);font-family:Inter,sans-serif;';
    panel.innerHTML = `<div style="font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#a78bfa;margin-bottom:12px;display:flex;align-items:center;gap:8px;">🔍 Jamal Monitor<span id="jamal-online-dot" style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;margin-left:auto;"></span><span id="jamal-status-text" style="font-size:9px;color:#64748b;">Offline</span></div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#475569;margin-bottom:6px;">Recent Clicks</div><div id="jamal-clicks-list" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;font-size:11px;color:#cbd5e1;"><div style="color:#475569;font-style:italic;">Waiting for activity…</div></div><button onclick="document.getElementById('nadia-monitor-panel').style.display='none'" style="margin-top:12px;width:100%;padding:8px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;">Hide Panel</button>`;
    document.body.appendChild(panel);

    const toggleBtn = document.createElement('div');
    toggleBtn.style.cssText = 'position:fixed;bottom:24px;left:20px;z-index:10002;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#5b21b6,#8b5cf6);border:2px solid rgba(139,92,246,0.5);box-shadow:0 4px 24px rgba(139,92,246,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;';
    toggleBtn.title = 'Jamal Monitor';
    toggleBtn.textContent = '🔍';
    toggleBtn.onclick = () => {
      const p = document.getElementById('nadia-monitor-panel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
    };
    document.body.appendChild(toggleBtn);

    jamalPresenceRef.on('value', (snap) => {
      const data = snap.val();
      const dot = document.getElementById('jamal-online-dot');
      const txt = document.getElementById('jamal-status-text');
      if (!dot) return;
      if (data && data.online) {
        dot.style.background = '#22c55e'; dot.style.boxShadow = '0 0 6px #22c55e';
        const since = data.since ? new Date(data.since).toLocaleTimeString('en-US', {timeZone:'America/Guyana', hour:'2-digit', minute:'2-digit'}) : '';
        txt.textContent = 'Online' + (since ? ' since ' + since : ''); txt.style.color = '#22c55e';
      } else {
        dot.style.background = '#ef4444'; dot.style.boxShadow = 'none';
        const seen = data && data.lastSeen ? new Date(data.lastSeen).toLocaleTimeString('en-US', {timeZone:'America/Guyana', hour:'2-digit', minute:'2-digit'}) : '';
        txt.textContent = seen ? 'Last seen ' + seen : 'Offline'; txt.style.color = '#64748b';
      }
    });

    jamalClicksRef.on('value', (snap) => {
      const list = document.getElementById('jamal-clicks-list');
      if (!list) return;
      const data = snap.val();
      if (!data) { list.innerHTML = '<div style="color:#475569;font-style:italic;">No clicks yet</div>'; return; }
      const entries = Object.entries(data).sort((a, b) => b[0] - a[0]).slice(0, 20);
      list.innerHTML = entries.map(([ts, v]) => {
        const t = new Date(parseInt(ts)).toLocaleTimeString('en-US', {timeZone:'America/Guyana', hour:'2-digit', minute:'2-digit', second:'2-digit'});
        return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:6px 10px;"><span style="color:#475569;font-size:9px;">' + t + '</span><span style="margin-left:6px;color:#e2e8f0;">' + (v.label || v.tag) + '</span></div>';
      }).join('');
    });
  };

  // ── SESSION PRESENCE ─────────────────────────────────────────────────
  window._fbWriteSession = async (user) => {
    const key = (user.ytelId || user.name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionEntry = {
      name: user.name || 'Unknown', role: user.role || 'agent', level: user.level || 'agent',
      ytelId: user.ytelId || null, late: user.late || false, clockedTime: user.clockedTime || null,
      since: Date.now(), online: true, ts: new Date().toISOString(),
    };
    const userSessionRef = db.ref('active_sessions/' + key);
    await userSessionRef.set(sessionEntry);
    const _sessionSince = sessionEntry.since;
    localStorage.setItem('biz_session_since_' + key, String(_sessionSince));
    window.addEventListener('beforeunload', () => {
      const storedSince = parseInt(localStorage.getItem('biz_session_since_' + key) || '0');
      if (storedSince === _sessionSince) {
        userSessionRef.set({ ...sessionEntry, online: false, lastSeen: Date.now() });
      }
    });
    window._mySessionRef  = userSessionRef;
    window._mySessionData = sessionEntry;

    const userActivityBase = 'user_activity/' + key;
    const _logActivity = (type, label, extra) => {
      db.ref(userActivityBase + '/events/' + Date.now()).set({
        type, label, extra: extra || '', ts: new Date().toISOString(),
      });
    };
    window._userActivityKey = key;
    window._logUserActivity = _logActivity;

    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, [onclick], [data-tab]') || e.target;
      if (target.classList && (target.classList.contains('opt-btn') || target.classList.contains('tf-true') || target.classList.contains('tf-false'))) {
        _logActivity('click', '🎯 Trivia answer selected', target.textContent.trim().slice(0, 40));
        return;
      }
      const rawLabel = (target.innerText || target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70)
        || target.getAttribute('aria-label') || target.title || target.id || target.tagName;
      if (!rawLabel || rawLabel.length < 2) return;
      _logActivity('click', rawLabel, target.id || '');
    }, true);
  };

  // Sessions listener for Nadia's panel
  sessionsRef.on('value', (snap) => {
    window._activeSessions = snap.val() || {};
    if (typeof window._onSessionsUpdate === 'function') window._onSessionsUpdate(window._activeSessions);
  });

  // Activity listener
  activityRef.on('value', (snap) => {
    window._allUserActivity = snap.val() || {};
    if (typeof window._onActivityUpdate === 'function') window._onActivityUpdate(window._allUserActivity);
  });

})();
