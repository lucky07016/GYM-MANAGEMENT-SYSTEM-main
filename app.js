(function () {
  "use strict";

  const STORAGE = {
    users: "gms_users",
    session: "gms_session",
    xp: "gms_xp",
    dietFlag: "gms_diet_bonus",
    workoutDay: "gms_workout_day",
    todos: "gms_todos",
    todoXp: "gms_todo_xp",
  };

  const LEVEL_TITLES = [
    "Novice Lifter",
    "Iron Initiate",
    "Steel Grinder",
    "Power Challenger",
    "Elite Athlete",
    "Titan",
    "Mythic Form",
    "Ascension",
    "Legend",
    "Overlord",
  ];

  const REWARD_DEFS = [
    { level: 2, icon: "🥤", name: "Hydration buff", desc: "+5% motivation (cosmetic)" },
    { level: 3, icon: "🎽", name: "Locker room badge", desc: "Wear your split with pride" },
    { level: 4, icon: "⚡", name: "Streak spark", desc: "Unlocks shiny UI accents" },
    { level: 5, icon: "🛡️", name: "Plate carrier", desc: "Mental armor for heavy days" },
    { level: 6, icon: "🏆", name: "Arena medal", desc: "Show off in profile card" },
    { level: 7, icon: "🌟", name: "Star player", desc: "Bonus toast flair" },
    { level: 8, icon: "💎", name: "Diamond discipline", desc: "Rare title shimmer" },
    { level: 9, icon: "🔥", name: "Inferno finisher", desc: "Burn mode activated" },
    { level: 10, icon: "👑", name: "Gym sovereign", desc: "Ultimate flex unlocked" },
  ];

  const CAT_COLORS = {
    morning: "#3ee8a8",
    work: "#5b8cff",
    gym: "#ff6b9d",
    meal: "#ffc857",
    rest: "#9b7bff",
    other: "#6b7a8f",
  };

  const SPLITS = {
    ppl: {
      label: "Push / Pull / Legs (3-day)",
      days: [
        {
          title: "Day 1 — Push",
          focus: "Chest, shoulders, triceps",
          exercises: ["Bench press 4×8", "Incline DB press 3×10", "OHP 4×8", "Lateral raises 3×15", "Tricep pushdowns 3×12"],
        },
        {
          title: "Day 2 — Pull",
          focus: "Back, biceps, rear delts",
          exercises: ["Deadlift or barbell rows 4×6", "Lat pulldown 4×10", "Cable row 3×12", "Face pulls 3×15", "Hammer curls 3×12"],
        },
        {
          title: "Day 3 — Legs",
          focus: "Quads, hamstrings, calves",
          exercises: ["Back squat 4×8", "Romanian deadlift 3×10", "Leg press 3×12", "Leg curl 3×12", "Standing calf raise 4×15"],
        },
      ],
    },
    upper_lower: {
      label: "Upper / Lower (4-day)",
      days: [
        {
          title: "Upper A",
          focus: "Chest, back, shoulders",
          exercises: ["Bench press 4×8", "Barbell row 4×8", "OHP 3×10", "Lateral raises 3×15"],
        },
        {
          title: "Lower A",
          focus: "Quads & posterior chain",
          exercises: ["Back squat 4×8", "Bulgarian split squat 3×10", "Leg curl 3×12", "Standing calf raise 4×12"],
        },
        {
          title: "Upper B",
          focus: "Volume & arms",
          exercises: ["Incline press 4×10", "Pull-ups 4×AMRAP", "Cable fly 3×12", "EZ-bar curl + pushdown superset"],
        },
        {
          title: "Lower B",
          focus: "Hinge & accessories",
          exercises: ["Deadlift 4×5", "Walking lunge 3×12", "Leg extension 3×15", "Hanging leg raise 3×12"],
        },
      ],
    },
    bro: {
      label: "Bro split (5-day)",
      days: [
        { title: "Chest", focus: "Chest + triceps", exercises: ["Flat bench", "Incline DB press", "Cable flyes", "Weighted dips"] },
        { title: "Back", focus: "Back + biceps", exercises: ["Deadlift", "Lat pulldown", "Seated cable row", "Barbell curls"] },
        { title: "Shoulders", focus: "Delts & traps", exercises: ["OHP", "Lateral raises", "Rear delt fly", "Shrugs"] },
        { title: "Legs", focus: "Quads & hamstrings", exercises: ["Squat", "Leg press", "Walking lunges", "RDL"] },
        { title: "Arms", focus: "Biceps & triceps", exercises: ["Barbell curl", "Skull crushers", "Rope pushdown", "Hammer curls"] },
      ],
    },
    fullbody: {
      label: "Full body (3-day)",
      days: [
        {
          title: "Day A — Compound",
          focus: "Full body strength",
          exercises: ["Back squat", "Bench press", "Barbell row", "Plank 3×45s"],
        },
        {
          title: "Day B — Balance",
          focus: "Posterior + pull",
          exercises: ["Deadlift", "OHP", "Pull-ups", "Leg curl"],
        },
        {
          title: "Day C — Volume",
          focus: "Machines & pump",
          exercises: ["Leg press", "Incline press", "Lat pulldown", "Arm superset"],
        },
      ],
    },
    arms_focus: {
      label: "Arms & delts (2-day)",
      days: [
        {
          title: "Arms A — Biceps bias",
          focus: "Biceps + forearms",
          exercises: ["Barbell curl 4×8", "Incline DB curl 3×12", "Hammer curl 3×12", "Wrist curl 3×15"],
        },
        {
          title: "Arms B — Triceps & shoulders",
          focus: "Triceps + lateral delts",
          exercises: ["Close-grip bench 4×8", "Overhead extension 3×12", "Pushdown 3×15", "Lateral raise 4×15"],
        },
      ],
    },
    core_legs: {
      label: "Core & legs (2-day)",
      days: [
        {
          title: "Leg power",
          focus: "Quads & glutes",
          exercises: ["Squat 5×5", "Leg press 4×12", "Bulgarian split squat 3×10", "Leg extension 3×15"],
        },
        {
          title: "Core & hinge",
          focus: "Hamstrings & abs",
          exercises: ["RDL 4×8", "Leg curl 4×12", "Hip thrust 3×12", "Cable crunch + side plank"],
        },
      ],
    },
  };

  function pageName() {
    return document.body.getAttribute("data-page") || "home";
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getUsers() {
    return loadJson(STORAGE.users, []);
  }

  function getSession() {
    return loadJson(STORAGE.session, null);
  }

  function setSession(email) {
    if (email) saveJson(STORAGE.session, { email });
    else localStorage.removeItem(STORAGE.session);
  }

  function getXp() {
    return Number(localStorage.getItem(STORAGE.xp) || 0);
  }

  function setXp(n) {
    localStorage.setItem(STORAGE.xp, String(Math.max(0, n)));
  }

  function addXp(amount, reason) {
    const prev = getXp();
    const prevLevel = getLevelFromXp(prev);
    setXp(prev + amount);
    const next = getXp();
    const nextLevel = getLevelFromXp(next);
    if (reason) toast(`+${amount} XP — ${reason}`);
    if (nextLevel > prevLevel) {
      queueLevelUp(prevLevel, nextLevel);
    }
    renderProgress();
  }

  function getLevelFromXp(total) {
    return Math.min(10, 1 + Math.floor(total / 100));
  }

  function getTitleForLevel(lv) {
    return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, lv - 1))];
  }

  let levelUpQueue = [];

  function queueLevelUp(from, to) {
    for (let L = from + 1; L <= to; L++) {
      levelUpQueue.push(L);
    }
    showNextLevelModal();
  }

  function showNextLevelModal() {
    if (levelUpQueue.length === 0) return;
    const L = levelUpQueue.shift();
    const modal = document.getElementById("modal-levelup");
    if (!modal) {
      toast(`Level ${L} — ${getTitleForLevel(L)}!`);
      if (levelUpQueue.length > 0) showNextLevelModal();
      return;
    }
    const titleEl = document.getElementById("levelup-title");
    const subEl = document.getElementById("levelup-sub");
    const rewardEl = document.getElementById("levelup-reward");
    const reward = REWARD_DEFS.find((r) => r.level === L);
    if (titleEl) titleEl.textContent = `Level ${L} — ${getTitleForLevel(L)}`;
    if (subEl) subEl.textContent = "You unlocked a new rank in the arena.";
    if (rewardEl) {
      if (reward) {
        rewardEl.innerHTML = `<strong>${reward.icon} ${reward.name}</strong><br><span style="color:var(--muted);font-size:0.9rem">${reward.desc}</span>`;
      } else {
        rewardEl.textContent = "Keep stacking wins.";
      }
    }
    modal.hidden = false;
  }

  function toast(msg) {
    const host = document.getElementById("toast-host");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  function renderHeader() {
    const session = getSession();
    const badge = document.getElementById("user-badge");
    const btnLogin = document.getElementById("btn-open-login");
    const btnOut = document.getElementById("btn-logout");
    if (!badge || !btnLogin || !btnOut) return;
    const onLoginPage = pageName() === "login";
    if (session && session.email) {
      const users = getUsers();
      const u = users.find((x) => x.email === session.email);
      badge.textContent = u ? u.displayName : session.email;
      badge.classList.remove("hidden");
      btnLogin.classList.add("hidden");
      btnOut.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
      if (onLoginPage) btnLogin.classList.add("hidden");
      else btnLogin.classList.remove("hidden");
      btnOut.classList.add("hidden");
    }
  }

  function initHeaderControls() {
    const btnOut = document.getElementById("btn-logout");
    if (btnOut) {
      btnOut.addEventListener("click", () => {
        setSession(null);
        renderHeader();
        toast("Logged out. Progress stays on this device.");
      });
    }
  }

  function redirectAfterAuth() {
    const q = new URLSearchParams(window.location.search);
    const next = q.get("next");
    if (next && /^[\w./-]+\.html?$/.test(next)) {
      window.location.href = next;
      return;
    }
    window.location.href = "index.html";
  }

  function initLoginPage() {
    const panelLogin = document.getElementById("panel-login");
    const panelSignup = document.getElementById("panel-signup");
    const showSignup = document.getElementById("btn-show-signup");
    const showLogin = document.getElementById("btn-show-login");

    if (showSignup && panelLogin && panelSignup) {
      showSignup.addEventListener("click", () => {
        panelLogin.classList.add("hidden");
        panelSignup.classList.remove("hidden");
      });
    }
    if (showLogin && panelLogin && panelSignup) {
      showLogin.addEventListener("click", () => {
        panelSignup.classList.add("hidden");
        panelLogin.classList.remove("hidden");
      });
    }

    const formLogin = document.getElementById("form-login");
    if (formLogin) {
      formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(formLogin);
        const email = String(fd.get("email")).trim().toLowerCase();
        const password = String(fd.get("password"));
        const users = getUsers();
        const u = users.find((x) => x.email === email);
        if (!u || u.password !== password) {
          toast("Login failed — check email/password.");
          return;
        }
        setSession(email);
        renderHeader();
        toast(`Welcome back, ${u.displayName}!`);
        setTimeout(redirectAfterAuth, 500);
      });
    }

    const formSignup = document.getElementById("form-signup");
    if (formSignup) {
      formSignup.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(formSignup);
        const displayName = String(fd.get("displayName")).trim();
        const email = String(fd.get("email")).trim().toLowerCase();
        const password = String(fd.get("password"));
        let users = getUsers();
        if (users.some((x) => x.email === email)) {
          toast("That email is already registered — try logging in.");
          return;
        }
        users.push({ displayName, email, password });
        saveJson(STORAGE.users, users);
        setSession(email);
        renderHeader();
        toast(`Account created — ${displayName}, your quest begins!`);
        addXp(20, "account created");
        setTimeout(redirectAfterAuth, 900);
      });
    }
  }

  function initLevelModalControls() {
    const ok = document.getElementById("btn-levelup-ok");
    if (ok) {
      ok.addEventListener("click", () => {
        const modal = document.getElementById("modal-levelup");
        if (modal) modal.hidden = true;
        if (levelUpQueue.length > 0) showNextLevelModal();
      });
    }
    document.querySelectorAll("[data-close-levelup]").forEach((el) => {
      el.addEventListener("click", () => {
        const modal = document.getElementById("modal-levelup");
        if (modal) modal.hidden = true;
        levelUpQueue = [];
      });
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function initWorkout() {
    const sel = document.getElementById("split-select");
    if (!sel) return;
    sel.innerHTML = "";
    Object.keys(SPLITS).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = SPLITS[key].label;
      sel.appendChild(opt);
    });

    function renderSplit() {
      const key = sel.value;
      const split = SPLITS[key];
      const box = document.getElementById("split-detail");
      if (!box) return;
      box.innerHTML = "";
      split.days.forEach((d) => {
        const art = document.createElement("div");
        art.className = "split-day";
        art.innerHTML = `
          <h4>${escapeHtml(d.title)}</h4>
          <p class="split-parts"><strong>Focus:</strong> ${escapeHtml(d.focus)}</p>
          <ul class="split-exercises">${d.exercises.map((ex) => `<li>${escapeHtml(ex)}</li>`).join("")}</ul>
        `;
        box.appendChild(art);
      });
    }

    sel.addEventListener("change", renderSplit);
    renderSplit();

    const btn = document.getElementById("btn-workout-done");
    if (btn) {
      btn.addEventListener("click", () => {
        const today = new Date().toDateString();
        if (localStorage.getItem(STORAGE.workoutDay) === today) {
          toast("Workout XP already claimed today — come back tomorrow!");
          return;
        }
        localStorage.setItem(STORAGE.workoutDay, today);
        addXp(25, "workout session");
      });
    }
  }

  function foodPool(budget, style, goal) {
    const pools = {
      low: {
        omnivore: ["Eggs", "Chicken thighs", "Canned tuna", "Lentils", "Oats", "Brown rice", "Frozen veg", "Bananas"],
        vegetarian: ["Eggs", "Greek yogurt", "Lentils", "Chickpeas", "Oats", "Rice", "Seasonal veg", "Paneer (small amt)"],
        vegan: ["Tofu", "Tempeh", "Lentils", "Black beans", "Oats", "Rice", "Frozen veg", "PB"],
        highprotein: ["Chicken breast", "Egg whites", "Cottage cheese", "Tuna", "Lentils", "Oats", "Broccoli", "Skim milk"],
      },
      mid: {
        omnivore: ["Salmon (frozen)", "Chicken breast", "Greek yogurt", "Quinoa", "Sweet potato", "Berries", "Olive oil", "Spinach"],
        vegetarian: ["Greek yogurt", "Eggs", "Quinoa", "Halloumi", "Lentil pasta", "Nuts", "Fruit", "Avocado"],
        vegan: ["Tofu", "Edamame", "Quinoa", "Hummus", "Chickpea pasta", "Chia", "Berries", "Plant milk"],
        highprotein: ["Chicken", "Fish", "Whey or plant protein", "Greek yogurt", "Quinoa", "Egg whites", "Broccoli", "Berries"],
      },
      high: {
        omnivore: ["Salmon", "Lean steak", "Shrimp", "Greek yogurt", "Quinoa", "Asparagus", "Berries", "Extra virgin olive oil"],
        vegetarian: ["Organic eggs", "Imported cheese", "Quinoa", "Truffle oil (dash)", "Microgreens", "Nuts", "Fruit", "Greek yogurt"],
        vegan: ["Organic tofu", "Jackfruit", "Quinoa", "Cashew cream", "Plant protein", "Berries", "Avocado", "Miso"],
        highprotein: ["Grass-fed steak", "Wild salmon", "Protein isolate", "Greek yogurt", "Egg whites", "Quinoa", "Greens", "Berries"],
      },
    };
    const b = pools[budget] ? budget : "mid";
    const st = pools[b][style] ? style : "omnivore";
    let base = pools[b][st].slice();
    if (goal === "cut") base.push("High-volume veg", "Water before meals");
    if (goal === "bulk") base.push("Extra rice serving", "Post-workout carb");
    return base;
  }

  function pickMealsForDay(dayIndex, pool, mealsPerDay, goal) {
    const out = [];
    const n = pool.length;
    for (let m = 0; m < mealsPerDay; m++) {
      const idx = (dayIndex * mealsPerDay + m) % n;
      const protein = goal === "bulk" ? "↑ protein" : goal === "cut" ? "lean protein" : "balanced";
      out.push(`${pool[idx]} (${protein})`);
    }
    return out;
  }

  function initDiet() {
    const form = document.getElementById("form-diet");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const budget = fd.get("budget");
      const dietStyle = fd.get("dietStyle");
      const goal = fd.get("goal");
      const mealsPerDay = Number(fd.get("mealsPerDay") || 4);
      const custom = String(fd.get("custom") || "").trim();

      const pool = foodPool(budget, dietStyle, goal);
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      let html = `<p class="diet-meta"><strong>Plan:</strong> ${budget} budget · ${dietStyle} · ${goal} · ${mealsPerDay} meals/day.</p>`;
      if (custom) html += `<p class="diet-meta"><strong>Your notes:</strong> ${escapeHtml(custom)}</p>`;
      html += '<div class="diet-table-wrap"><table class="diet-table"><thead><tr><th>Meal</th>';
      days.forEach((d) => {
        html += `<th>${d}</th>`;
      });
      html += "</tr></thead><tbody>";

      for (let meal = 0; meal < mealsPerDay; meal++) {
        html += `<tr><th>Meal ${meal + 1}</th>`;
        for (let day = 0; day < 7; day++) {
          const cell = pickMealsForDay(day, pool, mealsPerDay, goal)[meal];
          html += `<td>${escapeHtml(cell)}</td>`;
        }
        html += "</tr>";
      }

      html += "</tbody></table></div>";

      const out = document.getElementById("diet-output");
      if (!out) return;
      out.innerHTML = html;
      out.classList.remove("hidden");

      if (!localStorage.getItem(STORAGE.dietFlag)) {
        localStorage.setItem(STORAGE.dietFlag, "1");
        addXp(10, "first diet chart");
      } else {
        toast("Diet chart updated!");
      }
    });
  }

  function renderProgress() {
    const total = getXp();
    const level = getLevelFromXp(total);
    const title = getTitleForLevel(level);
    const xpInLevel = total % 100;
    const pct = level >= 10 ? 100 : xpInLevel;

    const elLevel = document.getElementById("game-level-num");
    if (!elLevel) return;

    document.getElementById("game-rank-title").textContent = title;
    elLevel.textContent = String(level);
    document.getElementById("total-xp").textContent = String(total);
    document.getElementById("xp-current").textContent = level >= 10 ? "MAX" : String(xpInLevel);
    document.getElementById("xp-next").textContent = level >= 10 ? "—" : "100";
    document.getElementById("xp-pct").textContent = level >= 10 ? "MAX" : `${pct}%`;

    const bar = document.getElementById("xp-bar-inner");
    if (bar) bar.style.width = `${level >= 10 ? 100 : pct}%`;

    const ring = document.getElementById("xp-ring-fill");
    if (ring) {
      const circumference = 2 * Math.PI * 28;
      const offset = circumference - (pct / 100) * circumference;
      ring.style.strokeDashoffset = level >= 10 ? 0 : offset;
    }

    const list = document.getElementById("reward-list");
    if (!list) return;
    list.innerHTML = "";
    REWARD_DEFS.forEach((r) => {
      const unlocked = level >= r.level;
      const li = document.createElement("li");
      li.className = "reward-item " + (unlocked ? "unlocked" : "locked");
      li.innerHTML = `
        <span class="reward-icon" aria-hidden="true">${r.icon}</span>
        <div>
          <strong>${escapeHtml(r.name)}</strong> <span style="color:var(--muted);font-size:0.8rem">(Lv ${r.level})</span><br />
          <span style="color:var(--muted);font-size:0.85rem">${escapeHtml(r.desc)}</span>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function getTodos() {
    return loadJson(STORAGE.todos, []);
  }

  function saveTodos(arr) {
    saveJson(STORAGE.todos, arr);
  }

  function getTodoXpSet() {
    return new Set(loadJson(STORAGE.todoXp, []));
  }

  function saveTodoXpSet(set) {
    saveJson(STORAGE.todoXp, Array.from(set));
  }

  function initPlanner() {
    const dateInput = document.getElementById("planner-date");
    if (!dateInput) return;
    const today = new Date();
    dateInput.valueAsDate = today;

    function selectedDateStr() {
      return dateInput.value || today.toISOString().slice(0, 10);
    }

    function renderPie(todos) {
      const totalMin = todos.reduce((s, t) => s + t.minutes, 0);
      const pie = document.getElementById("pie-chart");
      const leg = document.getElementById("pie-legend");
      const empty = document.getElementById("pie-empty");
      if (!pie || !leg || !empty) return;

      if (totalMin === 0) {
        pie.style.background = "rgba(255,255,255,0.06)";
        leg.innerHTML = "";
        empty.classList.remove("hidden");
        return;
      }
      empty.classList.add("hidden");

      const buckets = {};
      todos.forEach((t) => {
        buckets[t.category] = (buckets[t.category] || 0) + t.minutes;
      });

      const segs = Object.keys(buckets).map((k) => ({
        cat: k,
        pct: (buckets[k] / totalMin) * 100,
        color: CAT_COLORS[k] || CAT_COLORS.other,
      }));

      let deg = 0;
      const parts = [];
      segs.forEach((s) => {
        const span = (s.pct / 100) * 360;
        parts.push(`${s.color} ${deg}deg ${deg + span}deg`);
        deg += span;
      });
      pie.style.background = `conic-gradient(${parts.join(", ")})`;

      leg.innerHTML = "";
      segs.forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="pie-dot" style="background:${s.color}"></span> ${s.cat} — ${Math.round(
          (s.pct / 100) * totalMin
        )} min planned (${s.pct.toFixed(0)}%)`;
        leg.appendChild(li);
      });
    }

    function render() {
      const d = selectedDateStr();
      const todos = getTodos().filter((t) => t.date === d);
      const ul = document.getElementById("todo-list");
      if (!ul) return;
      ul.innerHTML = "";
      if (todos.length === 0) {
        ul.innerHTML = '<li style="color:var(--muted);font-size:0.9rem">No tasks — add one above.</li>';
      } else {
        todos.forEach((t) => {
          const li = document.createElement("li");
          li.className = "todo-item" + (t.done ? " done" : "");
          const id = `todo-${t.id}`;
          li.innerHTML = `
            <input type="checkbox" id="${id}" ${t.done ? "checked" : ""} data-id="${t.id}" />
            <label for="${id}">
              ${escapeHtml(t.title)}
              <span class="todo-meta">${t.minutes} min · ${t.category}</span>
            </label>
            <button type="button" class="todo-remove" data-del="${t.id}" aria-label="Remove task">&times;</button>
          `;
          ul.appendChild(li);
        });
      }

      ul.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          const id = cb.getAttribute("data-id");
          let arr = getTodos();
          const item = arr.find((x) => String(x.id) === id);
          if (!item) return;
          item.done = cb.checked;
          saveTodos(arr);

          if (item.done) {
            let xpSet = getTodoXpSet();
            const key = `${id}-${item.date}`;
            if (!xpSet.has(key)) {
              xpSet.add(key);
              saveTodoXpSet(xpSet);
              addXp(15, "task completed");
            }
          }
          render();
        });
      });

      ul.querySelectorAll(".todo-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-del");
          saveTodos(getTodos().filter((x) => String(x.id) !== id));
          render();
        });
      });

      renderPie(todos);
    }

    const formTodo = document.getElementById("form-todo");
    if (formTodo) {
      formTodo.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(formTodo);
        const title = String(fd.get("title")).trim();
        const minutes = Number(fd.get("minutes"));
        const category = fd.get("category");
        const arr = getTodos();
        const id = Date.now();
        arr.push({
          id,
          date: selectedDateStr(),
          title,
          minutes,
          category,
          done: false,
        });
        saveTodos(arr);
        formTodo.reset();
        const m = formTodo.querySelector('[name="minutes"]');
        if (m) m.value = "30";
        render();
        toast("Task added to your schedule");
      });
    }

    dateInput.addEventListener("change", render);
    render();
  }

  function initSlideshow(root) {
    const track = root.querySelector(".slideshow-track");
    if (!track) return;
    const slides = Array.from(root.querySelectorAll(".slide"));
    if (slides.length === 0) return;
    let index = slides.findIndex((s) => s.classList.contains("is-active"));
    if (index < 0) index = 0;

    const dotsHost = root.querySelector(".slideshow-dots");
    if (dotsHost) {
      dotsHost.innerHTML = "";
      slides.forEach((_, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slideshow-dot" + (i === index ? " is-active" : "");
        b.setAttribute("aria-label", `Go to slide ${i + 1}`);
        b.addEventListener("click", () => go(i));
        dotsHost.appendChild(b);
      });
    }

    function updateDots() {
      if (!dotsHost) return;
      const dots = dotsHost.querySelectorAll(".slideshow-dot");
      dots.forEach((d, i) => {
        d.classList.toggle("is-active", i === index);
      });
    }

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle("is-active", j === index));
      updateDots();
    }

    const prev = root.querySelector(".slideshow-prev");
    const next = root.querySelector(".slideshow-next");
    if (prev) prev.addEventListener("click", () => go(index - 1));
    if (next) next.addEventListener("click", () => go(index + 1));

    const interval = Number(root.dataset.interval) || 6000;
    const autoplay = root.dataset.autoplay === "true";
    let timer = null;
    if (autoplay && slides.length > 1) {
      timer = setInterval(() => go(index + 1), interval);
      root.addEventListener("mouseenter", () => {
        if (timer) clearInterval(timer);
        timer = null;
      });
      root.addEventListener("mouseleave", () => {
        if (!timer && slides.length > 1) {
          timer = setInterval(() => go(index + 1), interval);
        }
      });
    }
  }

  function initSlideshowAll() {
    document.querySelectorAll(".slideshow").forEach(initSlideshow);
  }

  function initReveal() {
    const els = document.querySelectorAll(".js-reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" }
    );
    els.forEach((el) => io.observe(el));
  }

  function init() {
    renderHeader();
    initHeaderControls();
    initReveal();
    initSlideshowAll();

    const p = pageName();

    if (p === "login") {
      initLoginPage();
      initLevelModalControls();
    } else {
      initLevelModalControls();
    }

    if (p === "workout") initWorkout();
    if (p === "diet") initDiet();
    if (p === "planner") initPlanner();

    if (p !== "login") {
      renderProgress();
    }

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("modal-levelup");
      if (modal) modal.hidden = true;
      levelUpQueue = [];
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
