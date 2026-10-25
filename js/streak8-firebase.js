/* streak8 Firebase global leaderboard (v1.2.0)
 *
 * Uses the Firebase REST API (no SDK) so the MV3 extension stays light:
 *  - Identity Toolkit: anonymous sign-in -> stable per-device uid
 *  - Firestore: one document per player at leaderboard/{uid}
 *
 * Everything here is best-effort and never throws into the game.
 */
(function () {
  "use strict";

  var API_KEY = "AIzaSyCETdGbw03ADtzNBTGYBGfGQ8EwEY0UJ2A";
  var PROJECT_ID = "streak8-25e33";
  var AUTH_KEY = "s8_fb_auth";   // { uid, idToken, refreshToken, expiresAt }
  var PEAK_KEY = "s8_last_peak";  // highest balance ever submitted

  var BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";

  // Web version: localStorage-backed store with the same callback shape
  // the extension storage had, so auth (s8_fb_auth) and peak
  // (s8_last_peak) persist per browser instead of being lost on every
  // call (which would mint a fresh anonymous uid per submission).
  function store() {
    return {
      get: function (keys, cb) {
        var out = {};
        var list = Array.isArray(keys) ? keys : [keys];
        list.forEach(function (k) {
          try {
            var raw = localStorage.getItem(k);
            if (raw !== null) { try { out[k] = JSON.parse(raw); } catch (e) { out[k] = raw; } }
          } catch (e) { /* ignore */ }
        });
        if (cb) cb(out);
      },
      set: function (obj, cb) {
        Object.keys(obj || {}).forEach(function (k) {
          try { localStorage.setItem(k, JSON.stringify(obj[k])); } catch (e) { /* ignore */ }
        });
        if (cb) cb();
      }
    };
  }
  function get(keys) {
    return new Promise(function (resolve) {
      var s = store();
      if (!s) return resolve({});
      try { s.get(keys, function (r) { resolve(r || {}); }); }
      catch (e) { resolve({}); }
    });
  }
  function set(obj) {
    return new Promise(function (resolve) {
      var s = store();
      if (!s) return resolve();
      try { s.set(obj, function () { resolve(); }); }
      catch (e) { resolve(); }
    });
  }

  async function signIn() {
    var res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    });
    if (!res.ok) throw new Error("signUp " + res.status);
    var j = await res.json();
    return {
      uid: j.localId,
      idToken: j.idToken,
      refreshToken: j.refreshToken,
      expiresAt: Date.now() + (parseInt(j.expiresIn || "3600", 10) - 60) * 1000
    };
  }

  async function refresh(idTokenIgnored, refreshToken) {
    var res = await fetch("https://securetoken.googleapis.com/v1/token?key=" + API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken)
    });
    if (!res.ok) throw new Error("refresh " + res.status);
    var j = await res.json();
    return {
      uid: j.user_id,
      idToken: j.id_token,
      refreshToken: j.refresh_token,
      expiresAt: Date.now() + (parseInt(j.expires_in || "3600", 10) - 60) * 1000
    };
  }

  var authPromise = null;
  async function ensureAuth() {
    if (authPromise) return authPromise;
    authPromise = (async function () {
      var cached = (await get(AUTH_KEY))[AUTH_KEY];
      if (cached && cached.uid && cached.idToken) {
        if (cached.expiresAt && cached.expiresAt > Date.now()) return cached;
        if (cached.refreshToken) {
          try {
            var r = await refresh(cached.idToken, cached.refreshToken);
            await set({ [AUTH_KEY]: r });
            return r;
          } catch (e) { /* fall through to fresh sign-in */ }
        }
      }
      var fresh = await signIn();
      await set({ [AUTH_KEY]: fresh });
      return fresh;
    })();
    try { return await authPromise; }
    finally { authPromise = null; }
  }

  function str(v) { return { stringValue: String(v == null ? "" : v) }; }
  function num(v) { return { integerValue: String(Math.round(Number(v) || 0)) }; }

  // Submit (or refresh) this player's peak + current balance. Never throws.
  // entry = { name, country, peak, current, games }. The stored peak never
  // decreases; current balance is always overwritten (it can be negative).
  async function submitPeak(entry) {
    try {
      if (!entry) return false;
      var prev = (await get(PEAK_KEY))[PEAK_KEY] || 0;
      var peak = Math.max(prev, Math.round(Number(entry.peak) || 0));
      var current = Math.round(Number(entry.current) || 0);
      if (!(peak > 0)) return false;
      await set({ [PEAK_KEY]: peak });
      var auth = await ensureAuth();
      var fields = {
        name: str(entry.name || "Player"),
        balance: num(peak),
        currentBalance: { integerValue: String(current) },
        games: num(entry.games || 0),
        updatedAt: { timestampValue: new Date().toISOString() }
      };
      if (entry.country) fields.country = str(entry.country);
      else fields.country = { nullValue: null };
      var url = BASE + "/leaderboard/" + encodeURIComponent(auth.uid)
        + "?updateMask.fieldPaths=name&updateMask.fieldPaths=country"
        + "&updateMask.fieldPaths=balance&updateMask.fieldPaths=currentBalance&updateMask.fieldPaths=games&updateMask.fieldPaths=updatedAt";
      var res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + auth.idToken
        },
        body: JSON.stringify({ fields: fields })
      });
      if (res.ok) return true;
      // Legacy fallback: if the project's Firestore rules predate the
      // currentBalance field, the full write is rejected and the player
      // never appears on the board. Retry with the original field set
      // (name/country/balance/games/updatedAt) so the player still shows
      // up; the read side treats their peak as their current balance.
      var legacy = {
        name: fields.name,
        country: fields.country,
        balance: fields.balance,
        games: fields.games,
        updatedAt: fields.updatedAt
      };
      var url2 = BASE + "/leaderboard/" + encodeURIComponent(auth.uid)
        + "?updateMask.fieldPaths=name&updateMask.fieldPaths=country"
        + "&updateMask.fieldPaths=balance&updateMask.fieldPaths=games&updateMask.fieldPaths=updatedAt";
      var res2 = await fetch(url2, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + auth.idToken
        },
        body: JSON.stringify({ fields: legacy })
      });
      return res2.ok;
    } catch (e) { return false; }
  }

  function docToEntry(doc) {
    try {
      var f = doc.fields || {};
      var id = String(doc.name || "").split("/").pop();
      var sv = function (k) { return f[k] && f[k].stringValue !== undefined ? f[k].stringValue : null; };
      var iv = function (k) {
        if (!f[k]) return 0;
        if (f[k].integerValue !== undefined) return parseInt(f[k].integerValue, 10) || 0;
        if (f[k].doubleValue !== undefined) return Math.round(Number(f[k].doubleValue)) || 0;
        return 0;
      };
      var ts = f.updatedAt && f.updatedAt.timestampValue ? Date.parse(f.updatedAt.timestampValue) : Date.now();
      var bal = iv("balance");
      var cur = f.currentBalance && f.currentBalance.integerValue !== undefined
        ? parseInt(f.currentBalance.integerValue, 10) || 0
        : bal; // docs written before currentBalance existed
      return {
        id: id,
        name: sv("name") || "Player",
        country: sv("country"),
        balance: bal,
        current: cur,
        games: iv("games"),
        date: isNaN(ts) ? Date.now() : ts
      };
    } catch (e) { return null; }
  }

  // Top `limit` players by CURRENT balance, highest first. Never throws.
  // Inclusion still requires a positive all-time peak (balance > 0).
  // The UI sorts client-side, so this only needs to RETURN the right docs.
  async function runBoardQuery(structuredQuery) {
    var res = await fetch(BASE + ":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: structuredQuery })
    });
    if (!res.ok) return null;
    var rows = await res.json();
    var out = [];
    (rows || []).forEach(function (r) {
      if (r.document) {
        var e = docToEntry(r.document);
        if (e && e.balance > 0) out.push(e);
      }
    });
    return out;
  }

  async function fetchTop(limit) {
    try {
      limit = Math.max(1, Math.min(200, limit || 50));
      var byCurrent = await runBoardQuery({
        from: [{ collectionId: "leaderboard" }],
        orderBy: [{ field: { fieldPath: "currentBalance" }, direction: "DESCENDING" }],
        limit: limit
      });
      if (byCurrent && byCurrent.length) return byCurrent;
      // Firestore EXCLUDES documents missing the orderBy field, so any
      // player whose doc predates currentBalance (or was written by the
      // legacy fallback above) vanishes from the ordered query. Fall back
      // to an unordered fetch so those players still appear; docToEntry
      // already treats their peak as their current balance.
      var all = await runBoardQuery({
        from: [{ collectionId: "leaderboard" }],
        limit: limit
      });
      return all;
    } catch (e) { return null; }
  }

  // Every name currently on the board: [{ id, name }], or null when the
  // board can't be read. Board reads are public; no auth needed.
  async function fetchNames() {
    try {
      var res = await fetch(BASE + ":runQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: "leaderboard" }],
          select: { fields: [{ fieldPath: "name" }] },
          limit: 200
        } })
      });
      if (!res.ok) return null;
      var rows = await res.json();
      var out = [];
      (rows || []).forEach(function (r) {
        if (r.document) {
          var f = r.document.fields || {};
          out.push({
            id: String(r.document.name || "").split("/").pop(),
            name: f.name && f.name.stringValue !== undefined ? f.name.stringValue : ""
          });
        }
      });
      return out;
    } catch (e) { return null; }
  }

  // Duplicate-name check (v1.6.2). Squash mirrors Streak8.squashName in
  // core (lowercase, letters/digits only) so lookalikes count as taken;
  // duplicated here because this module is standalone. Returns true (a
  // different player has the name), false (free), or null when the check
  // itself couldn't be completed.
  async function isNameTaken(name) {
    try {
      var key = String(name == null ? "" : name).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key.length < 2) return false;
      var myUid = await uid();
      if (!myUid) return null;
      var entries = await fetchNames();
      if (!entries) return null;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e || e.id === myUid) continue;
        var other = String(e.name == null ? "" : e.name).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (other === key) return true;
      }
      return false;
    } catch (e) { return null; }
  }

  // Cached uid without triggering network (null until first auth).
  async function cachedUid() {
    try {
      var c = (await get(AUTH_KEY))[AUTH_KEY];
      return (c && c.uid) || null;
    } catch (e) { return null; }
  }

  async function uid() {
    try { return (await ensureAuth()).uid; }
    catch (e) { return null; }
  }

  window.S8Firebase = {
    ensureAuth: ensureAuth,
    submitPeak: submitPeak,
    fetchTop: fetchTop,
    isNameTaken: isNameTaken,
    uid: uid,
    cachedUid: cachedUid
  };
})();
