/* streak8 UI — wires Streak8 core to the DOM. No frameworks, no remote code. */
(function () {
  "use strict";
  const S8 = window.Streak8;
  const STORAGE_KEY = "hl_jackpot_balance";

  /* ---------- storage (web version: localStorage only) ---------- */
  const store = {
    async getKey(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        if (v === null) return fallback;
        try { return JSON.parse(v); } catch (e) { return /^-?\d+$/.test(v) ? parseInt(v, 10) : v; }
      } catch (e) { return fallback; }
    },
    async setKey(key, value) {
      try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    get(fallback) { return this.getKey(STORAGE_KEY, fallback); },
    set(value) { return this.setKey(STORAGE_KEY, value); },
  };
  const PROFILE_KEY = "hl_player_profile";
  const LB_KEY = "hl_leaderboard";
  const TUT_KEY = "hl_tutorial_seen";

  /* ---------- state ---------- */
  const Phase = { IDLE: "IDLE", PLAYING: "PLAYING", VICTORY: "VICTORY", CASHED_OUT: "CASHED_OUT", CONTINUE_OFFER: "CONTINUE_OFFER", GAMEOVER: "GAMEOVER" };
  let phase = Phase.IDLE;
  let game = null;              // core round state
  let balance = 0;
  let jackpotRange = { min: S8.INITIAL_JACKPOT_RANGE.min, max: S8.INITIAL_JACKPOT_RANGE.max };
  let isProcessing = false;
  let fallingIndex = null;
  let timers = [];
  let lastJackpot = 0, lastBalance = 0;
  let freshCard = -1;             // board slot that was just dealt (gets the flip animation once)

  const $ = (id) => document.getElementById(id);
  const later = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* ---------- tween engine (deck-of-cards animateTo pattern) ---------- */
  const Ease = {
    cubicInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    cubicOut: t => 1 - Math.pow(1 - t, 3)
  };
  function tween({ duration = 500, delay = 0, ease = "cubicInOut", onUpdate, onComplete }) {
    const t0 = performance.now() + delay;
    let raf = 0, done = false;
    function frame(now) {
      if (done) return;
      let p = (now - t0) / duration;
      if (p < 0) { raf = requestAnimationFrame(frame); return; }
      p = Math.min(1, p);
      if (onUpdate) onUpdate(Ease[ease](p), p);
      if (p < 1) raf = requestAnimationFrame(frame);
      else { done = true; if (onComplete) onComplete(); }
    }
    raf = requestAnimationFrame(frame);
    return { cancel() { done = true; cancelAnimationFrame(raf); } };
  }

  /* ---------- deal + flip choreography ---------- */
  // Fresh card: drops onto its slot facedown, then a true 3D flip reveals it.
  function animateDealFlip(slotEl) {
    const card = slotEl.querySelector(".card");
    if (!card) return;
    const inner = card.querySelector(".card-inner");
    if (!inner) return;
    tween({ duration: 340, ease: "cubicOut",
      onUpdate: (e) => {
        card.style.transform =
          "translateY(" + (-48 * (1 - e)).toFixed(1) + "px) rotate(" + (-10 * (1 - e)).toFixed(2) +
          "deg) scale(" + (0.94 + 0.06 * e).toFixed(3) + ")";
      },
      onComplete: () => {
        card.style.transform = "";
        tween({ duration: 520, ease: "cubicInOut",
          onUpdate: (e2) => { inner.style.transform = "rotateY(" + (180 - 180 * e2).toFixed(2) + "deg)"; },
          onComplete: () => { card.classList.remove("facedown"); inner.style.transform = ""; } });
      }});
  }
  // Base card at round start: flips in from facedown.
  function animateBaseDeal() {
    const card = $("baseCard").querySelector(".card");
    if (!card) return;
    const inner = card.querySelector(".card-inner");
    if (!inner) return;
    card.classList.add("facedown");
    tween({ duration: 420, ease: "cubicInOut", delay: 120,
      onUpdate: (e) => { inner.style.transform = "rotateY(" + (180 - 180 * e).toFixed(2) + "deg)"; },
      onComplete: () => { card.classList.remove("facedown"); inner.style.transform = ""; } });
  }

  /* ---------- rolling number ---------- */
  function rollNumber(el, from, to) {
    const dur = 600, t0 = performance.now();
    function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (to - from) * eased);
      el.textContent = S8.formatCurrency(val);
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = S8.formatCurrency(to); el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- card DOM ---------- */
  function cardEl(card, opts) {
    opts = opts || {};
    const d = document.createElement("div");
    d.className = "card " + card.color + (opts.variant && opts.variant !== "default" ? " " + opts.variant : "");
    if (!opts.revealed) d.classList.add("facedown");
    if (opts.outcome === "win") d.classList.add("win");
    if (opts.outcome === "loss") d.classList.add("loss");
    if (opts.falling) d.classList.add("falling");
    d.innerHTML =
      '<div class="card-inner">' +
      '<div class="face">' +
        '<div class="corner tl"><span class="r">' + card.rank + '</span><span class="s">' + card.suit + "</span></div>" +
        '<div class="pip">' + card.suit + "</div>" +
        '<div class="corner br"><span class="r">' + card.rank + '</span><span class="s">' + card.suit + "</span></div>" +
      "</div>" +
      '<div class="back"><div class="medal">?</div></div>' +
      "</div>";
    return d;
  }

  function renderBase() {
    const wrap = $("baseCard");
    wrap.innerHTML = "";
    if (game && game.baseCard) wrap.appendChild(cardEl(game.baseCard, { revealed: true }));
    $("baseTag").classList.toggle("show", !!(game && game.baseCard && game.baseCard.rank === "A" && phase === Phase.PLAYING && game.index === 0));
  }

  function renderBoard() {
    const qual = $("qualSlots"), run = $("runSlots");
    qual.innerHTML = ""; run.innerHTML = "";
    let dealSlot = null;
    for (let i = 0; i < 8; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      const num = document.createElement("span");
      num.className = "slot-num";
      num.textContent = "#" + (i + 1);
      slot.appendChild(num);

      const c = game ? game.board[i] : null;
      let outcome = null;
      if (c) {
        if (i < game.index) outcome = "win";
        else if (i === game.index && (phase === Phase.GAMEOVER || phase === Phase.CONTINUE_OFFER)) outcome = "loss";
      }
      let variant = "default";
      if (i >= 4) variant = i === 7 ? "gold" : "jackpot";
      const isNext = phase === Phase.PLAYING && game && game.index === i;
      const dealIn = !!(c && i === freshCard && fallingIndex !== i);
      if (dealIn) dealSlot = slot;
      const el = c
        ? cardEl(c, { revealed: !dealIn, outcome: outcome, variant: variant, falling: fallingIndex === i })
        : cardEl({ rank: "?", suit: "?", color: "black", value: 0 }, { revealed: false });
      if (isNext) { const w = document.createElement("div"); w.className = "slot-next"; w.appendChild(el); slot.appendChild(w); }
      else slot.appendChild(el);

      if (i >= 4) {
        const tier = document.createElement("div");
        tier.className = "tier" + (isNext ? " next" : "") + (game && i < game.index ? " done" : "");
        tier.textContent = S8.formatCurrency(game ? S8.tierFor(i, game.jackpot) : 0);
        slot.appendChild(tier);
      }
      (i < 4 ? qual : run).appendChild(slot);
    }
    freshCard = -1; // animation plays once per deal
    if (dealSlot) animateDealFlip(dealSlot);
  }

  function renderHeader(animate) {
    const j = game ? game.jackpot : lastJackpot;
    const jEl = $("jackpotValue");
    if (animate) rollNumber(jEl, lastJackpot, j); else jEl.textContent = S8.formatCurrency(j);
    lastJackpot = j;
    const bEl = $("balanceValue");
    if (animate) rollNumber(bEl, lastBalance, balance); else bEl.textContent = S8.formatCurrency(balance);
    bEl.classList.toggle("negative", balance < 0);
    lastBalance = balance;
    $("jackpotBox").classList.toggle("run-active", phase === Phase.PLAYING && game !== null && game.index >= 4);
  }

  function currentCard() {
    if (!game || phase !== Phase.PLAYING) return null;
    return game.index === 0 ? game.baseCard : game.board[game.index - 1];
  }

  function renderControls() {
    const playing = phase === Phase.PLAYING;
    $("btnHigher").classList.toggle("hidden", !playing);
    $("btnLower").classList.toggle("hidden", !playing);
    $("btnStart").classList.toggle("hidden", playing);

    const mid = $("btnMiddle");
    const hint = $("ctlHint");
    mid.classList.add("hidden");
    mid.classList.remove("cashout");
    mid.onclick = null;
    hint.textContent = "";

    if (playing && game) {
      const cc = currentCard();
      const disH = cc && cc.rank === "A";
      const disL = cc && cc.rank === "2";
      $("btnHigher").disabled = isProcessing || disH;
      $("btnLower").disabled = isProcessing || disL;
      if (disH) hint.textContent = "Ace is High — cannot go Higher";
      else if (disL) hint.textContent = "2 is Low — cannot go Lower";

      if (S8.canSwap(game) && !isProcessing) {
        mid.classList.remove("hidden");
        mid.querySelector("em").textContent = "Swap $100";
        mid.onclick = doSwap;
      } else if (S8.canCashOut(game) && !isProcessing) {
        mid.classList.remove("hidden");
        mid.classList.add("cashout");
        mid.querySelector("em").textContent = "Cash Out";
        mid.onclick = doCashOut;
      }
    } else {
      $("btnHigher").disabled = true;
      $("btnLower").disabled = true;
    }
  }

  function render(animateHeader) {
    renderHeader(animateHeader);
    renderBase();
    renderBoard();
    renderControls();
  }

  /* ---------- modal ---------- */
  const ICONS = {
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  };

  function showModal(kind, title, sub, actions, celebrate) {
    const ov = $("modal"), card = $("modalCard");
    card.className = "modal " + kind + (celebrate ? " celebrate" : "");
    $("modalIcon").innerHTML = ICONS[kind === "gold" ? "trophy" : kind === "green" ? "coins" : kind === "orange" ? "alert" : "x"];
    $("modalTitle").textContent = title;
    $("modalSub").textContent = sub || "";
    const box = $("modalActions");
    box.innerHTML = "";
    if (actions === "continue") {
      box.style.flexDirection = "row";
      box.style.alignItems = "";
      const c = document.createElement("button");
      c.className = "modal-btn primary"; c.textContent = "Continue — halve jackpot";
      c.onclick = doContinue;
      const g = document.createElement("button");
      g.className = "modal-btn"; g.textContent = "Give Up";
      g.onclick = () => { hideModal(); startRound(); };
      box.appendChild(c); box.appendChild(g);
    } else {
      box.style.flexDirection = "column";
      box.style.alignItems = "center";
      const n = document.createElement("div");
      n.className = "modal-next"; n.textContent = "Next hand starting";
      const dots = document.createElement("div");
      dots.className = "dots"; dots.innerHTML = "<i></i><i></i><i></i>";
      box.appendChild(n); box.appendChild(dots);
    }
    ov.classList.remove("hidden");
    if (celebrate) launchConfetti();
  }
  function hideModal() { $("modal").classList.add("hidden"); stopConfetti(); }

  /* ---------- confetti (jackpot wins) ---------- */
  let confettiRAF = 0;
  function launchConfetti() {
    const cv = $("confettiCanvas");
    if (!cv) return;
    cv.classList.remove("hidden");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ["#f5c542", "#34d399", "#f87171", "#ffffff", "#a78bfa", "#60a5fa", "#fb923c"];
    const parts = [];
    for (let i = 0; i < 170; i++) {
      parts.push({
        x: Math.random() * W,
        y: -24 - Math.random() * H * 0.35,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 9,
        vx: -1.6 + Math.random() * 3.2,
        vy: 2 + Math.random() * 3.4,
        rot: Math.random() * Math.PI * 2,
        vr: -0.16 + Math.random() * 0.32,
        color: colors[i % colors.length],
        circle: Math.random() < 0.28,
      });
    }
    const t0 = performance.now(), dur = 3200;
    cancelAnimationFrame(confettiRAF);
    (function frame(t) {
      const el = t - t0;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - el / dur);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.rot += p.vr;
        if (p.y > H + 30) { p.y = -24; p.x = Math.random() * W; p.vy = 2 + Math.random() * 3; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.45 + 0.55 * Math.abs(Math.sin(p.rot * 2))));
        ctx.restore();
      }
      if (el < dur) confettiRAF = requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); cv.classList.add("hidden"); }
    })(t0);
  }
  function stopConfetti() {
    cancelAnimationFrame(confettiRAF);
    const cv = $("confettiCanvas");
    if (cv) cv.classList.add("hidden");
  }

  /* ---------- game flow ---------- */
  function startRound() {
    clearTimers();
    hideModal();
    game = S8.newRound(balance, jackpotRange);
    phase = Phase.PLAYING;
    isProcessing = false;
    fallingIndex = null;
    render(true);
    animateBaseDeal();
    // retrigger the run-label slide each round
    const run = document.querySelector(".panel.run");
    run.classList.remove("enter"); void run.offsetWidth;
  }

  function markRunEntered() {
    const run = document.querySelector(".panel.run");
    run.classList.remove("enter"); void run.offsetWidth; run.classList.add("enter");
  }

  function doGuess(guess) {
    if (phase !== Phase.PLAYING || isProcessing || !game) return;
    const cc = currentCard();
    if (!cc) return;
    if (guess === "higher" && cc.rank === "A") return;
    if (guess === "lower" && cc.rank === "2") return;

    isProcessing = true;
    const res = S8.applyGuess(game, guess);
    game = res.state;
    freshCard = game.index - (res.outcome === "push" || res.outcome === "correct" ? 1 : 0);

    if (res.outcome === "push") {
      isProcessing = false;
      if (game.index === 4) markRunEntered();
      render(true);
      $("ctlHint").textContent = "Push — jackpot halved";
      return;
    }
    if (res.outcome === "correct") {
      isProcessing = false;
      if (game.index === 4) markRunEntered();
      render(true);
      return;
    }
    if (res.outcome === "victory") {
      balance = game.balance;
      saveBalance();
      countGame();
      render(true);
      later(1500, () => {
        isProcessing = false;
        phase = Phase.VICTORY;
        jackpotRange = S8.nextRange(jackpotRange, "victory");
        showModal("gold", "Jackpot!", "You won " + S8.formatCurrency(res.winnings), undefined, true);
        render(false);
        later(2000, startRound);
      });
      return;
    }
    // wrong guess: falling card, then modal
    fallingIndex = game.index;
    render(false);
    later(2000, () => {
      isProcessing = false;
      if (res.outcome === "continue-offer") {
        phase = Phase.CONTINUE_OFFER;
        showModal("orange", "Wrong Guess!", "Halve the jackpot to continue?", "continue");
      } else {
        balance = game.balance;
        saveBalance();
        countGame();
        phase = Phase.GAMEOVER;
        jackpotRange = S8.nextRange(jackpotRange, "gameover");
        const sub = res.loss > 0 ? "Lost " + S8.formatCurrency(res.loss) : ("It was " + (res.wasHigher ? "Higher" : "Lower"));
        showModal("red", "Game Over", sub);
        later(2000, startRound);
      }
      render(false);
    });
  }

  function doContinue() {
    if (phase !== Phase.CONTINUE_OFFER || !game) return;
    hideModal();
    game = S8.applyContinue(game);
    phase = Phase.PLAYING;
    fallingIndex = null;
    if (game.index === 4) markRunEntered();
    render(true);
  }

  function doCashOut() {
    if (phase !== Phase.PLAYING || !game || !S8.canCashOut(game)) return;
    const res = S8.applyCashOut(game);
    game = res.state;
    balance = game.balance;
    saveBalance();
    countGame();
    phase = Phase.CASHED_OUT;
    showModal("green", "Cashed Out!", "You won " + S8.formatCurrency(res.winnings));
    render(true);
    later(2000, startRound);
  }

  function doSwap() {
    if (phase !== Phase.PLAYING || !game || !S8.canSwap(game)) return;
    game = S8.applySwap(game);
    balance = game.balance;
    saveBalance();
    render(true);
  }

  /* ---------- player profile ---------- */
  let profile = null;

  // Optional country tag for the player. ISO 3166-1 alpha-2 codes.
  const COUNTRIES = [
    ["CA", "Canada"], ["US", "United States"], ["GB", "United Kingdom"], ["IE", "Ireland"],
    ["AU", "Australia"], ["NZ", "New Zealand"],
    ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["PT", "Portugal"],
    ["NL", "Netherlands"], ["BE", "Belgium"], ["CH", "Switzerland"], ["AT", "Austria"],
    ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"],
    ["PL", "Poland"], ["CZ", "Czechia"], ["SK", "Slovakia"], ["HU", "Hungary"],
    ["RO", "Romania"], ["GR", "Greece"], ["UA", "Ukraine"],
    ["TR", "Turkey"], ["IL", "Israel"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["QA", "Qatar"],
    ["IN", "India"], ["PK", "Pakistan"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"], ["NP", "Nepal"],
    ["PH", "Philippines"], ["TH", "Thailand"], ["VN", "Vietnam"], ["MY", "Malaysia"],
    ["SG", "Singapore"], ["ID", "Indonesia"], ["JP", "Japan"], ["KR", "South Korea"],
    ["CN", "China"], ["TW", "Taiwan"], ["HK", "Hong Kong"],
    ["MX", "Mexico"], ["BR", "Brazil"], ["AR", "Argentina"], ["CL", "Chile"],
    ["CO", "Colombia"], ["PE", "Peru"], ["VE", "Venezuela"],
    ["ZA", "South Africa"], ["NG", "Nigeria"], ["GH", "Ghana"], ["KE", "Kenya"],
    ["EG", "Egypt"], ["MA", "Morocco"], ["DZ", "Algeria"], ["ET", "Ethiopia"],
    ["RU", "Russia"], ["BY", "Belarus"], ["KZ", "Kazakhstan"],
  ];
  function countryName(code) {
    for (const c of COUNTRIES) if (c[0] === code) return c[1];
    return code || "";
  }
  // v1.6.2: the player's country is extracted from the browser locale,
  // never asked. Returns an accepted alpha-2 code or null.
  function detectCountry() {
    try {
      const locs = [];
      if (navigator.language) locs.push(navigator.language);
      if (navigator.languages) for (const l of navigator.languages) locs.push(l);
      try {
        const intlLoc = Intl.DateTimeFormat().resolvedOptions().locale;
        if (intlLoc) locs.push(intlLoc);
      } catch (e) { /* ignore */ }
      return S8.countryFromLocales(locs, COUNTRIES.map((c) => c[0]));
    } catch (e) { return null; }
  }
  function genId() {
    const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    try {
      const r = crypto.getRandomValues(new Uint8Array(4));
      for (let i = 0; i < 4; i++) s += A[r[i] % A.length];
    } catch (e) {
      for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    }
    return "Player-" + s;
  }
  function displayName() { return (profile && profile.name) || (profile && profile.id) || "Player"; }

  const BANNED = ["fuck","shit","bitch","cunt","dick","pussy","whore","slut","bastard","asshole",
    "nigger","nigga","faggot","fagot","retard","penis","vagina","boob","tits","titt","porn","xxx",
    "kike","chink","spic","tranny","dildo","orgasm","masturbat","ejaculat","blowjob","handjob",
    "suckmyd","rapist","molest","nazi","hitler","kkk","anal","cum","jizz","clit","labia"];
  function validateName(n) {
    if (n.length < 2) return "Use at least 2 characters.";
    if (n.length > 16) return "Keep it to 16 characters or fewer.";
    if (!/^[A-Za-z0-9 _.\-]+$/.test(n)) return "Letters, numbers, spaces and - _ . only.";
    const squashed = n.toLowerCase().replace(/[^a-z]/g, "");
    for (const w of BANNED) if (squashed.indexOf(w) !== -1) return "That name isn't allowed — pick another.";
    return null;
  }

  /* ---------- leaderboard (local top-10 bankroll peaks) ---------- */
  let lbCountryFilter = ""; // "" = all countries

  // Push the current profile name/country onto all of this player's entries.
  async function syncMyEntries() {
    if (!profile) return;
    try {
      const board = await store.getKey(LB_KEY, []);
      const nm = displayName();
      const myCountry = profile.country || null;
      let changed = false;
      board.forEach((e) => {
        if (e.id === profile.id) {
          if (e.name !== nm) { e.name = nm; changed = true; }
          if ((e.country || null) !== myCountry) { e.country = myCountry; changed = true; }
        }
      });
      if (changed) await store.setKey(LB_KEY, board);
    } catch (e) { /* never break the game for leaderboard */ }
  }

  // A completed hand counts as a game played (give-ups restart, they don't count).
  async function countGame() {
    if (!profile) return;
    profile.games = (profile.games || 0) + 1;
    try { await store.setKey(PROFILE_KEY, profile); } catch (e) { /* ignore */ }
  }

  // Peak ordering: highest balance first; ties broken by fewest games played.
  function peakRank(a, b) {
    if (b.balance !== a.balance) return b.balance - a.balance;
    const ga = (a.games === undefined || a.games === null) ? Infinity : a.games;
    const gb = (b.games === undefined || b.games === null) ? Infinity : b.games;
    return ga - gb;
  }

  // Rank by CURRENT balance (v1.4.0 board). Entries without a current value
  // (local fallback peaks) treat current as their peak.
  function boardRank(a, b) {
    const ca = (a.current === undefined || a.current === null) ? a.balance : a.current;
    const cb = (b.current === undefined || b.current === null) ? b.balance : b.current;
    if (cb !== ca) return cb - ca;
    return peakRank(a, b);
  }

  function lbCountries(board) {
    const set = {};
    board.forEach((e) => { if (e.country) set[e.country] = true; });
    if (profile && profile.country) set[profile.country] = true;
    return Object.keys(set).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  }

  function renderCountryFilter(board, globalBoard) {
    const sel = $("lbCountryFilter");
    const codes = lbCountries(board);
    if (codes.indexOf(lbCountryFilter) < 0) lbCountryFilter = "";
    sel.innerHTML = "";
    const all = document.createElement("option");
    all.value = ""; all.textContent = "All countries";
    sel.appendChild(all);
    codes.forEach((code) => {
      const o = document.createElement("option");
      o.value = code; o.textContent = countryName(code);
      sel.appendChild(o);
    });
    sel.value = lbCountryFilter;
    $("lbSub").textContent = lbCountryFilter ? countryName(lbCountryFilter) : (globalBoard ? "global board" : "local board");
  }
  async function recordPeak() {
    if (!profile || balance <= 0) return;
    try {
      const board = await store.getKey(LB_KEY, []);
      const nm = displayName();
      let changed = false;
      const myCountry = (profile && profile.country) || null;
      board.forEach((e) => {
        if (e.id === profile.id) {
          if (e.name !== nm) { e.name = nm; changed = true; }
          if ((e.country || null) !== myCountry) { e.country = myCountry; changed = true; }
        }
      });
      const myBest = board.reduce((m, e) => (e.id === profile.id ? Math.max(m, e.balance) : m), 0);
      if (balance > myBest) {
        board.push({ id: profile.id, name: nm, balance: balance, country: myCountry, games: (profile && profile.games) || 0, date: Date.now() });
        board.sort(peakRank);
        board.length = Math.min(board.length, 10);
        changed = true;
      }
      if (changed) await store.setKey(LB_KEY, board);
      // Global leaderboard: best-effort submit of this player's peak + current.
      if (changed && window.S8Firebase) {
        try {
          window.S8Firebase.submitPeak({
            name: displayName(),
            country: (profile && profile.country) || null,
            peak: balance,
            current: balance,
            games: (profile && profile.games) || 0
          });
        } catch (e) { /* never break the game for leaderboard */ }
      }
    } catch (e) { /* never break the game for leaderboard */ }
  }
  // Best-effort sync of the CURRENT balance to the global board (v1.4.0).
  // Runs on every balance change; the stored peak is never lowered by this.
  function syncCurrentBalance() {
    try {
      if (!profile || !window.S8Firebase) return;
      window.S8Firebase.submitPeak({
        name: displayName(),
        country: (profile && profile.country) || null,
        peak: 0,
        current: balance,
        games: (profile && profile.games) || 0
      });
    } catch (e) { /* never break the game for leaderboard */ }
  }

  function saveBalance() { store.set(balance); recordPeak(); syncCurrentBalance(); }

  async function renderLeaderboard() {
    // Global board first; fall back to the local board when offline.
    let board = null, globalBoard = false;
    try {
      if (window.S8Firebase) {
        const g = await window.S8Firebase.fetchTop(200);
        if (g && g.length) { board = g; globalBoard = true; }
      }
    } catch (e) { /* fall through to local */ }
    if (!board) board = await store.getKey(LB_KEY, []);
    board.forEach((e) => { if (e.current === undefined || e.current === null) e.current = e.balance; });
    board.sort(boardRank); // display invariant: ranked by current balance
    const myUid = window.S8Firebase ? await window.S8Firebase.cachedUid() : null;
    const isMe = (e) => profile && (e.id === profile.id || (myUid && e.id === myUid));
    renderCountryFilter(board, globalBoard);
    const shown = lbCountryFilter ? board.filter((e) => e.country === lbCountryFilter) : board;
    $("lbName").textContent = displayName() + (profile && profile.country ? " (" + profile.country + ")" : "");
    const list = $("lbList");
    list.innerHTML = "";
    if (!shown.length) {
      const d = document.createElement("div");
      d.className = "lb-empty";
      d.textContent = lbCountryFilter
        ? "No peaks from " + countryName(lbCountryFilter) + " yet."
        : "No peaks yet — finish a hand in profit to set one.";
      list.appendChild(d);
    }
    shown.forEach((e, i) => {
      const li = document.createElement("li");
      li.className = "lb-row" + (isMe(e) ? " me" : "") + (i < 3 ? " r" + (i + 1) : "");
      const rank = document.createElement("span"); rank.className = "lb-ranknum"; rank.textContent = String(i + 1);
      const nm = document.createElement("span"); nm.className = "lb-name"; nm.textContent = e.name;
      li.appendChild(rank); li.appendChild(nm);
      if (isMe(e)) {
        const you = document.createElement("span"); you.className = "lb-you"; you.textContent = "you";
        li.appendChild(you);
      }
      if (e.country) {
        const cc = document.createElement("span"); cc.className = "lb-country"; cc.textContent = e.country;
        li.appendChild(cc);
      }
      if (e.games !== undefined && e.games !== null) {
        const gm = document.createElement("span"); gm.className = "lb-games";
        gm.textContent = e.games + (e.games === 1 ? " game" : " games");
        li.appendChild(gm);
      }
      // All-time peak in brackets (v1.4.0); hidden when it equals the current balance.
      if (e.balance !== e.current) {
        const pk = document.createElement("span"); pk.className = "lb-peak";
        pk.textContent = "(peak " + S8.formatCurrency(e.balance) + ")";
        li.appendChild(pk);
      }
      const cur = (e.current === undefined || e.current === null) ? e.balance : e.current;
      const amt = document.createElement("span"); amt.className = "lb-amt" + (cur < 0 ? " neg" : "");
      amt.textContent = S8.formatCurrency(cur);
      li.appendChild(amt);
      list.appendChild(li);
    });
    const rankEl = $("lbRank");
    const idx = profile ? shown.findIndex(isMe) : -1;
    const scope = lbCountryFilter ? " in " + countryName(lbCountryFilter) : "";
    if (idx >= 0) rankEl.textContent = "Your rank" + scope + ": #" + (idx + 1) + " of " + shown.length;
    else rankEl.textContent = shown.length ? "You have no rank" + scope + " yet." : "";
  }

  async function savePlayerName() {
    const raw = $("lbNameInput").value.trim().replace(/\s+/g, " ");
    const err = $("lbNameErr");
    const bad = validateName(raw);
    if (bad) { err.textContent = bad; err.classList.remove("hidden"); return; }
    // v1.6.2: duplicate names are refused. The name locks after this one
    // set, so the check must actually complete — if it can't, ask again
    // later rather than risk locking in a duplicate.
    const btn = $("lbSaveName");
    btn.disabled = true;
    try {
      if (window.S8Firebase && window.S8Firebase.isNameTaken) {
        const taken = await window.S8Firebase.isNameTaken(raw);
        if (taken === true) { err.textContent = "That name is taken — pick another."; err.classList.remove("hidden"); return; }
        if (taken === null) { err.textContent = "Couldn't check that name — check your connection and try again."; err.classList.remove("hidden"); return; }
      }
    } finally { btn.disabled = false; }
    err.classList.add("hidden");
    profile.name = raw;
    if (!profile.country) profile.country = detectCountry();
    await store.setKey(PROFILE_KEY, profile);
    $("lbEditor").classList.add("hidden");
    await syncMyEntries();
    // Push the new name/country to the global board (uses stored peak).
    try {
      if (window.S8Firebase) {
        window.S8Firebase.submitPeak({
          name: displayName(),
          country: profile.country || null,
          peak: 0,
          current: balance,
          games: profile.games || 0
        });
      }
    } catch (e) { /* never break the game for leaderboard */ }
    renderLeaderboard();
  }

  // v1.5.0: names lock after the first set — offer the one-time set when a
  // nameless player first opens the leaderboard.
  function showNameEditorOnce() {
    $("lbEditor").classList.remove("hidden");
    $("lbNameInput").value = "";
    const dc = (profile && profile.country) || detectCountry();
    $("lbOnceNote").textContent = "Pick your leaderboard name — one time only."
      + (dc ? " Country is set automatically: " + countryName(dc) + "." : "");
    $("lbNameErr").classList.add("hidden");
    $("lbNameInput").focus();
  }

  function bindLeaderboard() {
    $("lbBtn").onclick = () => {
      renderLeaderboard();
      $("lbModal").classList.remove("hidden");
      if (profile && !profile.name) showNameEditorOnce();
    };
    $("lbClose").onclick = () => $("lbModal").classList.add("hidden");
    $("lbModal").addEventListener("click", (e) => { if (e.target.id === "lbModal") $("lbModal").classList.add("hidden"); });
    $("lbCountryFilter").onchange = () => { lbCountryFilter = $("lbCountryFilter").value; renderLeaderboard(); };
    $("lbSaveName").onclick = savePlayerName;
    $("lbNameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") savePlayerName(); });
  }

  /* ---------- winning demo (v1.6.0) ----------
     12-beat scripted jackpot win on the real board. The caption text pops up
     (positioned clear of the referred card) then drops to the bottom bar.
     Auto-advances; a tap drops/advances early, Skip exits. Board DOM is
     saved and restored, so Help replays are safe mid-session. */
  const DEMO_TIERS_FULL = [2500, 5000, 7500, 10000];
  const DEMO_TIERS_HALF = [1250, 2500, 3750, 5000];
  function demoCard(rank, suit) {
    return { rank: rank, suit: suit, color: (suit === "♥" || suit === "♦") ? "red" : "black", value: 0 };
  }
  // quals/runs entries: null = facedown, [rank, suit] = revealed, [rank, suit, 1] = push badge
  const DEMO_Q4 = [["9","♥"], ["9","♦",1], ["4","♣"], ["K","♠"]];
  const DEMO_BEATS = [
    { pos: "pos-mid", jackpot: 10000, quals: [null,null,null,null], runs: [null,null,null,null], tiersLit: 0,
      html: "This is your base card: the 7♠. Every guess is higher or lower than the previous card." },
    { pos: "pos-mid", jackpot: 10000, quals: [null,null,null,null], runs: [null,null,null,null], tiersLit: 0, glow: "both",
      html: "Will the next card be <b class=\"t-green\">HIGHER</b> or <b class=\"t-red\">LOWER</b> than 7♠?" },
    { pos: "pos-low", jackpot: 10000, quals: [["9","♥"],null,null,null], runs: [null,null,null,null], tiersLit: 0, glow: "higher",
      html: "9 beats 7. You advance!" },
    { pos: "pos-low", jackpot: 5000, halved: true, quals: [["9","♥"],["9","♦",1],null,null], runs: [null,null,null,null], tiersLit: 0, extraWait: 2000,
      html: "Same value: <b class=\"t-red\">PUSH</b>! The jackpot is halved, but you move on for free." },
    { pos: "pos-low", jackpot: 5000, halved: true, quals: [["9","♥"],["9","♦",1],["4","♣"],null], runs: [null,null,null,null], tiersLit: 0, glow: "lower",
      html: "4 is lower than 9. <b class=\"t-red\">LOWER</b> wins! Keep going." },
    { pos: "pos-low", jackpot: 5000, halved: true, quals: DEMO_Q4, runs: [null,null,null,null], tiersLit: 0, glow: "higher",
      html: "King beats 4. <b class=\"t-green\">HIGHER</b> wins! Qualifier cleared." },
    { info: true },
    { pos: "pos-top", jackpot: 5000, halved: true, quals: DEMO_Q4, runs: [["A","♦"],null,null,null], tiersLit: 1, glow: "higher",
      html: "Ace beats King. 25% tier reached ($1,250)!<span class=\"dare\">Do you dare to keep going?</span>" },
    { pos: "pos-top", jackpot: 5000, halved: true, quals: DEMO_Q4, runs: [["A","♦"],["3","♣"],null,null], tiersLit: 2, glow: "lower",
      html: "3 is lower than Ace. 50% tier reached ($2,500)!<span class=\"dare\">Do you dare to keep going?</span>" },
    { pos: "pos-top", jackpot: 5000, halved: true, quals: DEMO_Q4, runs: [["A","♦"],["3","♣"],["8","♥"],null], tiersLit: 3, glow: "higher",
      html: "8 beats 3. 75% tier reached ($3,750)!<span class=\"dare\">Do you dare to go for the jackpot?</span>" },
    { pos: "pos-top", jackpot: 5000, halved: true, quals: DEMO_Q4, runs: [["A","♦"],["3","♣"],["8","♥"],["Q","♠"]], tiersLit: 4, glow: "higher",
      html: "Queen beats 8. 100% tier reached ($5,000)!" },
    { win: true },
  ];

  let demoActive = false, demoIdx = -1, demoPhase = "", demoGen = 0, demoTimers = [];
  let demoSaved = null, demoCtlWas = null;
  function demoLater(fn, ms) {
    const g = demoGen;
    const t = setTimeout(() => { if (demoActive && demoGen === g) fn(); }, ms);
    demoTimers.push(t);
  }
  function demoClearTimers() { demoTimers.forEach(clearTimeout); demoTimers = []; }

  function renderDemoBeat(b) {
    const bw = $("baseCard");
    bw.innerHTML = "";
    bw.appendChild(cardEl(demoCard("7", "♠"), { revealed: true }));
    $("baseTag").classList.remove("show");
    const qual = $("qualSlots"), run = $("runSlots");
    qual.innerHTML = ""; run.innerHTML = "";
    const dummy = demoCard("?", "?");
    const tierVals = b.halved ? DEMO_TIERS_HALF : DEMO_TIERS_FULL;
    for (let i = 0; i < 8; i++) {
      const isRun = i >= 4;
      const sc = isRun ? b.runs[i - 4] : b.quals[i];
      const slot = document.createElement("div");
      slot.className = "slot";
      const num = document.createElement("span");
      num.className = "slot-num"; num.textContent = "#" + (i + 1);
      slot.appendChild(num);
      if (sc && sc[2]) {
        const badge = document.createElement("span");
        badge.className = "push-badge"; badge.textContent = "PUSH";
        slot.appendChild(badge);
      }
      slot.appendChild(sc
        ? cardEl(demoCard(sc[0], sc[1]), { revealed: true, variant: isRun ? (i === 7 ? "gold" : "jackpot") : "default" })
        : cardEl(dummy, { revealed: false }));
      if (isRun) {
        const tier = document.createElement("div");
        tier.className = "tier" + ((i - 4) < b.tiersLit ? " lit" : " dim");
        tier.textContent = S8.formatCurrency(tierVals[i - 4]);
        slot.appendChild(tier);
      }
      (isRun ? run : qual).appendChild(slot);
    }
    $("jackpotValue").textContent = S8.formatCurrency(b.jackpot);
    const ht = $("halvedTag");
    ht.classList.toggle("hidden", !b.halved);
    ht.classList.toggle("pulse", !!b.halved);
    $("btnHigher").classList.toggle("demo-glow", b.glow === "higher" || b.glow === "both");
    $("btnLower").classList.toggle("demo-glow", b.glow === "lower" || b.glow === "both");
  }

  // FLIP-drop the caption text from its pop-up spot to the bottom bar.
  function demoDropText() {
    if (!demoActive || demoPhase !== "pop") return;
    const txt = $("demoText"), ov = $("demoOverlay");
    const r1 = txt.getBoundingClientRect(), or = ov.getBoundingClientRect();
    txt.classList.remove("as-pop", "pos-top", "pos-mid", "pos-low");
    txt.classList.add("as-cap", "no-anim");
    const r2 = txt.getBoundingClientRect();
    txt.style.top = (r1.top - or.top) + "px";
    txt.style.bottom = "auto";
    txt.style.width = r1.width + "px";
    void txt.offsetWidth;
    txt.classList.remove("no-anim");
    txt.style.top = (r2.top - or.top) + "px";
    txt.style.width = r2.width + "px";
    demoPhase = "cap";
    demoLater(() => {
      txt.style.top = ""; txt.style.bottom = ""; txt.style.width = "";
    }, 700);
  }

  function playDemoBeat(i) {
    demoClearTimers();
    if (i >= DEMO_BEATS.length) { endDemo(); return; }
    demoIdx = i;
    const b = DEMO_BEATS[i];
    $("demoSteps").textContent = "STEP " + (i + 1) + " OF " + DEMO_BEATS.length;
    $("demoInfoVeil").classList.add("hidden");
    $("demoWinVeil").classList.add("hidden");
    const txt = $("demoText");
    if (b.win) {
      demoPhase = "win";
      txt.classList.add("gone");
      renderDemoBeat(DEMO_BEATS[10]);
      $("demoWinVeil").classList.remove("hidden");
      launchConfetti();
      demoLater(endDemo, 7000);
      return;
    }
    if (b.info) {
      demoPhase = "info";
      txt.classList.add("gone");
      renderDemoBeat(DEMO_BEATS[5]);
      $("demoInfoVeil").classList.remove("hidden");
      demoLater(() => playDemoBeat(i + 1), 6000);
      return;
    }
    demoPhase = "pop";
    renderDemoBeat(b);
    txt.style.top = ""; txt.style.bottom = ""; txt.style.width = "";
    txt.classList.remove("gone", "as-cap", "no-anim");
    txt.classList.add("as-pop", b.pos);
    $("demoTextP").innerHTML = b.html;
    demoLater(demoDropText, 1400);
    demoLater(() => playDemoBeat(i + 1), 1400 + 700 + 2000 + (b.extraWait || 0));
  }

  function demoAdvance() {
    if (!demoActive) return;
    demoGen++;
    playDemoBeat(demoIdx + 1);
  }

  function demoTap() {
    if (!demoActive) return;
    if (demoPhase === "pop") { demoGen++; demoClearTimers(); demoDropText(); demoPhase = "cap";
      demoLater(() => playDemoBeat(demoIdx + 1), 2000); }
    else if (demoPhase === "cap" || demoPhase === "info") demoAdvance();
  }

  function startDemo() {
    if (demoActive) return;
    demoSaved = {
      base: $("baseCard").innerHTML,
      qual: $("qualSlots").innerHTML,
      run: $("runSlots").innerHTML,
      jackpot: $("jackpotValue").textContent,
    };
    demoCtlWas = {
      higherHidden: $("btnHigher").classList.contains("hidden"),
      lowerHidden: $("btnLower").classList.contains("hidden"),
    };
    demoActive = true; demoGen++;
    document.body.classList.add("demo-playing");
    $("btnHigher").classList.remove("hidden");
    $("btnLower").classList.remove("hidden");
    $("btnHigher").disabled = true; $("btnLower").disabled = true;
    $("btnStart").classList.add("hidden");
    $("btnMiddle").classList.add("hidden");
    $("demoOverlay").classList.remove("hidden");
    playDemoBeat(0);
  }

  async function endDemo() {
    if (!demoActive) return;
    demoActive = false; demoGen++;
    demoClearTimers();
    stopConfetti();
    $("demoOverlay").classList.add("hidden");
    $("demoInfoVeil").classList.add("hidden");
    $("demoWinVeil").classList.add("hidden");
    document.body.classList.remove("demo-playing");
    $("btnHigher").classList.remove("demo-glow");
    $("btnLower").classList.remove("demo-glow");
    if (demoSaved) {
      $("baseCard").innerHTML = demoSaved.base;
      $("qualSlots").innerHTML = demoSaved.qual;
      $("runSlots").innerHTML = demoSaved.run;
      $("jackpotValue").textContent = demoSaved.jackpot;
      $("halvedTag").classList.add("hidden");
      $("halvedTag").classList.remove("pulse");
      if (demoCtlWas) {
        $("btnHigher").classList.toggle("hidden", demoCtlWas.higherHidden);
        $("btnLower").classList.toggle("hidden", demoCtlWas.lowerHidden);
      }
      $("btnHigher").disabled = false; $("btnLower").disabled = false;
      renderControls();
    }
    try { await store.setKey(TUT_KEY, "1"); } catch (e) { /* ignore */ }
  }

  function bindDemo() {
    $("demoSkip").onclick = (e) => { e.stopPropagation(); endDemo(); };
    $("demoInfoGo").onclick = (e) => { e.stopPropagation(); demoAdvance(); };
    $("demoWinGo").onclick = (e) => { e.stopPropagation(); endDemo(); };
    $("demoTapCatch").onclick = () => demoTap();
  }

  /* ---------- splash: NTH Star -> game logo, then winning demo on first run ---------- */
  function runSplash() {
    const sp = $("splash");
    const stages = [$("splashStage1"), $("splashStage2")];
    let stage = 1, done = false, t1 = 0, t2 = 0;
    const show = (n) => {
      stage = n;
      stages.forEach((s, i) => s.classList.toggle("hidden", i !== n - 1));
    };
    const finish = async () => {
      if (done) return; done = true;
      clearTimeout(t1); clearTimeout(t2);
      sp.classList.add("done");
      setTimeout(() => { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
      const seen = await store.getKey(TUT_KEY, null);
      if (!seen) startDemo();
    };
    t1 = setTimeout(() => { if (!done) show(2); }, 1900);
    t2 = setTimeout(() => { if (!done) finish(); }, 3800);
    sp.addEventListener("click", () => {
      if (done) return;
      if (stage === 1) { clearTimeout(t1); show(2); }
      else { clearTimeout(t2); finish(); }
    });
  }

  /* ---------- help ---------- */
  function bindHelp() {
    $("helpBtn").onclick = () => $("help").classList.remove("hidden");
    $("helpWatchDemo").onclick = () => { $("help").classList.add("hidden"); startDemo(); };
    $("helpClose").onclick = () => $("help").classList.add("hidden");
    $("helpOk").onclick = () => $("help").classList.add("hidden");
    $("help").addEventListener("click", (e) => { if (e.target.id === "help") $("help").classList.add("hidden"); });
  }

  /* ---------- keyboard ---------- */
  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (demoActive) { if (e.key === "Escape") endDemo(); return; }
      if (!$("help").classList.contains("hidden")) { if (e.key === "Escape") $("help").classList.add("hidden"); return; }
      if (!$("modal").classList.contains("hidden")) {
        if (phase === Phase.CONTINUE_OFFER && (e.key === "Enter" || e.key === " ")) doContinue();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "h") doGuess("higher");
      else if (k === "arrowdown" || k === "l") doGuess("lower");
      else if (k === "c") doCashOut();
      else if (k === "s") doSwap();
      else if (k === "enter" && phase === Phase.IDLE) startRound();
    });
  }

  /* ---------- init ---------- */
  async function init() {
    let b = await store.get(0);
    balance = (typeof b === "number" && !isNaN(b)) ? b : 0;
    lastBalance = balance;
    profile = await store.getKey(PROFILE_KEY, null);
    if (!profile || !profile.id) {
      profile = { id: genId(), name: null, createdAt: Date.now() };
      await store.setKey(PROFILE_KEY, profile);
    }
    // v1.6.2: backfill the country from the browser locale (never asked).
    if (profile && !profile.country) {
      const dc = detectCountry();
      if (dc) {
        profile.country = dc;
        await store.setKey(PROFILE_KEY, profile);
      }
    }
    lastJackpot = S8.generateJackpot(jackpotRange);
    $("btnStart").onclick = startRound;
    $("btnHigher").onclick = () => doGuess("higher");
    $("btnLower").onclick = () => doGuess("lower");
    bindHelp();
    bindDemo();
    bindKeys();
    bindLeaderboard();
    runSplash();
    render(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
