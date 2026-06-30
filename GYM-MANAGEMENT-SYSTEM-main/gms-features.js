(function () {
  "use strict";

  const API = "http://localhost:3000/api";
  const NAV_ITEMS = [
    { href: "index.html", label: "Home", page: "home" },
    { href: "workout.html", label: "Workouts", page: "workout" },
    { href: "exercises.html", label: "Exercises", page: "exercises" },
    { href: "diet.html", label: "Diet", page: "diet" },
    { href: "tracker.html", label: "Tracker", page: "tracker" },
    { href: "planner.html", label: "Planner", page: "planner" },
    { href: "mart.html", label: "Mart", page: "mart" },
    { href: "chat.html", label: "AI Coach", page: "chat" },
    { href: "progress.html", label: "Progress", page: "progress" },
  ];

  const STORAGE = {
    dailyLog: "gms_daily_log",
    dietPlan: "gms_diet_plan",
    cart: "gms_cart",
    chatHistory: "gms_chat_history",
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

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function toast(msg) {
    const host = document.getElementById("toast-host");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function getServerUser() {
    try {
      const raw = localStorage.getItem("gms_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function syncAuthBadge() {
    const badge = document.getElementById("user-badge");
    const btnLogin = document.getElementById("btn-open-login");
    const btnOut = document.getElementById("btn-logout");
    if (!badge) return;

    const serverUser = getServerUser();
    const onLoginPage = pageName() === "login";

    if (serverUser?.displayName || serverUser?.email) {
      badge.textContent = serverUser.displayName || serverUser.email;
      badge.classList.remove("hidden");
      if (btnLogin) btnLogin.classList.add("hidden");
      if (btnOut) btnOut.classList.remove("hidden");
      return;
    }

    badge.classList.add("hidden");
    if (btnLogin) {
      if (onLoginPage) btnLogin.classList.add("hidden");
      else btnLogin.classList.remove("hidden");
    }
    if (btnOut) btnOut.classList.add("hidden");
  }

  function buildNav() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const current = pageName();
    nav.innerHTML = NAV_ITEMS.map(
      (item) =>
        `<a href="${item.href}"${item.page === current ? ' class="nav-active" aria-current="page"' : ""}>${item.label}</a>`
    ).join("");
  }

  function initMobileNav() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector(".nav-toggle")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.id = "nav-toggle";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span><span></span><span></span>";

    const overlay = document.createElement("div");
    overlay.className = "nav-overlay hidden";
    overlay.id = "nav-overlay";

    const nav = header.querySelector(".nav");
    if (nav) header.insertBefore(toggle, nav);
    document.body.appendChild(overlay);

    function closeNav() {
      header.classList.remove("nav-open");
      overlay.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    function openNav() {
      header.classList.add("nav-open");
      overlay.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    toggle.addEventListener("click", () => {
      if (header.classList.contains("nav-open")) closeNav();
      else openNav();
    });
    overlay.addEventListener("click", closeNav);
    nav?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeNav();
    });
  }

  function initLogout() {
    const btnOut = document.getElementById("btn-logout");
    if (!btnOut || btnOut.dataset.gmsBound) return;
    btnOut.dataset.gmsBound = "1";
    btnOut.addEventListener("click", () => {
      localStorage.removeItem("gms_user");
      syncAuthBadge();
      toast("Logged out.");
    });
  }

  function getDailyLog(date) {
    const all = loadJson(STORAGE.dailyLog, {});
    if (!all[date]) {
      all[date] = { water: 0, meals: [], workout: false, weight: null, mood: null, notes: "" };
    }
    return all;
  }

  function saveDailyLog(all) {
    saveJson(STORAGE.dailyLog, all);
  }

  function initExercises() {
    const muscleHost = document.getElementById("muscle-groups");
    const listHost = document.getElementById("exercise-list");
    const searchInput = document.getElementById("exercise-search");
    if (!muscleHost || !listHost) return;

    let data = { muscleGroups: [], exercises: [] };
    let activeMuscle = "all";

    function renderExercises() {
      const q = (searchInput?.value || "").trim().toLowerCase();
      let items = data.exercises;
      if (activeMuscle !== "all") items = items.filter((e) => e.muscle === activeMuscle);
      if (q) items = items.filter((e) => e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q));

      if (!items.length) {
        listHost.innerHTML = '<p class="empty-state">No exercises match your filter.</p>';
        return;
      }

      listHost.innerHTML = items
        .map(
          (ex) => `
        <article class="exercise-card card">
          <div class="exercise-card-head">
            <h3>${escapeHtml(ex.name)}</h3>
            <span class="badge-pill">${escapeHtml(ex.difficulty)}</span>
          </div>
          <p class="exercise-meta"><strong>Equipment:</strong> ${escapeHtml(ex.equipment)} · <strong>Suggested:</strong> ${escapeHtml(ex.sets)}</p>
          <p class="muted-block">${escapeHtml(ex.tips)}</p>
          <button type="button" class="btn btn-ghost btn-sm btn-add-workout-log" data-name="${escapeHtml(ex.name)}">Log to today</button>
        </article>`
        )
        .join("");

      listHost.querySelectorAll(".btn-add-workout-log").forEach((btn) => {
        btn.addEventListener("click", () => {
          const name = btn.getAttribute("data-name");
          const date = todayKey();
          const all = getDailyLog(date);
          if (!all[date].exercises) all[date].exercises = [];
          all[date].exercises.push({ name, at: new Date().toISOString() });
          all[date].workout = true;
          saveDailyLog(all);
          toast(`Logged "${name}" to today's tracker.`);
        });
      });
    }

    function renderMuscleChips() {
      const chips = [
        { id: "all", name: "All", icon: "🏋️" },
        ...data.muscleGroups,
      ];
      muscleHost.innerHTML = chips
        .map(
          (g) =>
            `<button type="button" class="muscle-chip${activeMuscle === g.id ? " is-active" : ""}" data-muscle="${g.id}">${g.icon || "💪"} ${escapeHtml(g.name)}</button>`
        )
        .join("");

      muscleHost.querySelectorAll(".muscle-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          activeMuscle = chip.getAttribute("data-muscle");
          renderMuscleChips();
          renderExercises();
        });
      });
    }

    fetch(`${API}/exercises`)
      .then((r) => r.json())
      .then((json) => {
        data = json;
        renderMuscleChips();
        renderExercises();
      })
      .catch(() => {
        listHost.innerHTML = '<p class="empty-state">Could not load exercises. Start the server with npm start.</p>';
      });

    searchInput?.addEventListener("input", renderExercises);
  }

  function initTracker() {
    const dateInput = document.getElementById("tracker-date");
    const waterDisplay = document.getElementById("water-count");
    const mealsList = document.getElementById("tracker-meals");
    const workoutStatus = document.getElementById("tracker-workout");
    const exerciseLog = document.getElementById("tracker-exercises");
    const weightInput = document.getElementById("tracker-weight");
    const moodSelect = document.getElementById("tracker-mood");
    const notesInput = document.getElementById("tracker-notes");
    const summaryHost = document.getElementById("tracker-summary");
    const streakHost = document.getElementById("tracker-streak");
    if (!dateInput) return;

    dateInput.value = todayKey();

    function selectedDate() {
      return dateInput.value || todayKey();
    }

    function calcStreak() {
      const all = loadJson(STORAGE.dailyLog, {});
      let streak = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const key = d.toISOString().slice(0, 10);
        const day = all[key];
        if (day && (day.workout || day.meals?.length || day.water >= 4)) streak++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    }

    function render() {
      const date = selectedDate();
      const all = getDailyLog(date);
      const day = all[date];

      if (waterDisplay) waterDisplay.textContent = String(day.water);
      if (weightInput) weightInput.value = day.weight ?? "";
      if (moodSelect) moodSelect.value = day.mood ?? "";
      if (notesInput) notesInput.value = day.notes ?? "";

      if (workoutStatus) {
        workoutStatus.textContent = day.workout ? "✅ Workout logged" : "⏳ No workout yet";
        workoutStatus.className = "tracker-status " + (day.workout ? "is-done" : "");
      }

      if (mealsList) {
        if (!day.meals?.length) {
          mealsList.innerHTML = '<li class="muted-block">No meals logged. Add from Diet Lab macro calculator.</li>';
        } else {
          mealsList.innerHTML = day.meals
            .map(
              (m) =>
                `<li><strong>${escapeHtml(m.name)}</strong> — ${m.calories} kcal · P${m.protein}g C${m.carbs}g F${m.fat}g</li>`
            )
            .join("");
        }
      }

      if (exerciseLog) {
        const exs = day.exercises || [];
        exerciseLog.innerHTML = exs.length
          ? exs.map((e) => `<li>${escapeHtml(e.name)}</li>`).join("")
          : '<li class="muted-block">No exercises logged yet.</li>';
      }

      const totalCal = (day.meals || []).reduce((s, m) => s + Number(m.calories || 0), 0);
      const totalP = (day.meals || []).reduce((s, m) => s + Number(m.protein || 0), 0);
      if (summaryHost) {
        summaryHost.innerHTML = `
          <div class="tracker-stat"><span>${totalCal}</span><small>Calories</small></div>
          <div class="tracker-stat"><span>${totalP.toFixed(0)}g</span><small>Protein</small></div>
          <div class="tracker-stat"><span>${day.water}/8</span><small>Water glasses</small></div>
          <div class="tracker-stat"><span>${day.workout ? "Yes" : "No"}</span><small>Workout</small></div>`;
      }
      if (streakHost) streakHost.textContent = `${calcStreak()} day streak`;
    }

    function updateDay(patch) {
      const date = selectedDate();
      const all = getDailyLog(date);
      Object.assign(all[date], patch);
      saveDailyLog(all);
      render();
    }

    dateInput.addEventListener("change", render);

    document.getElementById("btn-water-plus")?.addEventListener("click", () => {
      const date = selectedDate();
      const all = getDailyLog(date);
      all[date].water = Math.min(20, (all[date].water || 0) + 1);
      saveDailyLog(all);
      render();
    });

    document.getElementById("btn-water-minus")?.addEventListener("click", () => {
      const date = selectedDate();
      const all = getDailyLog(date);
      all[date].water = Math.max(0, (all[date].water || 0) - 1);
      saveDailyLog(all);
      render();
    });

    document.getElementById("btn-mark-workout")?.addEventListener("click", () => updateDay({ workout: true }));

    document.getElementById("btn-save-tracker")?.addEventListener("click", () => {
      updateDay({
        weight: weightInput?.value ? Number(weightInput.value) : null,
        mood: moodSelect?.value || null,
        notes: notesInput?.value || "",
      });
      toast("Daily log saved.");
    });

    render();
  }

  window.gmsAddMealToTracker = function (meal) {
    const date = todayKey();
    const all = getDailyLog(date);
    all[date].meals.push(meal);
    saveDailyLog(all);
    toast("Meal added to today's tracker.");
  };

  function initMart() {
    const grid = document.getElementById("product-grid");
    const categoriesHost = document.getElementById("mart-categories");
    const cartPanel = document.getElementById("cart-panel");
    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");
    const cartCount = document.getElementById("cart-count");
    if (!grid) return;

    let data = { categories: [], products: [] };
    let activeCat = "all";

    function getCart() {
      return loadJson(STORAGE.cart, []);
    }

    function saveCart(cart) {
      saveJson(STORAGE.cart, cart);
      renderCart();
    }

    function renderCart() {
      const cart = getCart();
      const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
      if (cartCount) cartCount.textContent = String(cart.reduce((s, i) => s + i.qty, 0));
      if (cartTotal) cartTotal.textContent = `₹${total.toLocaleString()}`;
      if (!cartItems) return;
      if (!cart.length) {
        cartItems.innerHTML = '<p class="muted-block">Your cart is empty.</p>';
        return;
      }
      cartItems.innerHTML = cart
        .map(
          (item) => `
        <div class="cart-row">
          <span>${item.icon} ${escapeHtml(item.name)}</span>
          <div class="cart-row-actions">
            <button type="button" class="btn-qty" data-id="${item.id}" data-d="-1">−</button>
            <span>${item.qty}</span>
            <button type="button" class="btn-qty" data-id="${item.id}" data-d="1">+</button>
            <span>₹${(item.price * item.qty).toLocaleString()}</span>
          </div>
        </div>`
        )
        .join("");

      cartItems.querySelectorAll(".btn-qty").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const d = Number(btn.getAttribute("data-d"));
          let cart = getCart();
          const idx = cart.findIndex((c) => c.id === id);
          if (idx === -1) return;
          cart[idx].qty += d;
          if (cart[idx].qty <= 0) cart = cart.filter((c) => c.id !== id);
          saveCart(cart);
        });
      });
    }

    function addToCart(product) {
      let cart = getCart();
      const existing = cart.find((c) => c.id === product.id);
      if (existing) existing.qty += 1;
      else cart.push({ ...product, qty: 1 });
      saveCart(cart);
      toast(`${product.name} added to cart.`);
    }

    function renderProducts() {
      let items = data.products;
      if (activeCat !== "all") items = items.filter((p) => p.category === activeCat);
      grid.innerHTML = items
        .map(
          (p) => `
        <article class="product-card card">
          <div class="product-icon">${p.icon}</div>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="muted-block">${escapeHtml(p.desc)}</p>
          <div class="product-footer">
            <span class="product-price">₹${p.price.toLocaleString()}</span>
            <span class="product-rating">★ ${p.rating}</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm btn-add-cart" data-id="${p.id}">Add to cart</button>
        </article>`
        )
        .join("");

      grid.querySelectorAll(".btn-add-cart").forEach((btn) => {
        btn.addEventListener("click", () => {
          const product = data.products.find((p) => p.id === btn.getAttribute("data-id"));
          if (product) addToCart(product);
        });
      });
    }

    function renderCategories() {
      if (!categoriesHost) return;
      const cats = [{ id: "all", name: "All", icon: "🛒" }, ...data.categories];
      categoriesHost.innerHTML = cats
        .map(
          (c) =>
            `<button type="button" class="mart-cat-chip${activeCat === c.id ? " is-active" : ""}" data-cat="${c.id}">${c.icon} ${escapeHtml(c.name)}</button>`
        )
        .join("");
      categoriesHost.querySelectorAll(".mart-cat-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          activeCat = chip.getAttribute("data-cat");
          renderCategories();
          renderProducts();
        });
      });
    }

    fetch(`${API}/products`)
      .then((r) => r.json())
      .then((json) => {
        data = json;
        renderCategories();
        renderProducts();
        renderCart();
      })
      .catch(() => {
        grid.innerHTML = '<p class="empty-state">Could not load products. Start the server.</p>';
      });

    document.getElementById("btn-toggle-cart")?.addEventListener("click", () => {
      cartPanel?.classList.toggle("hidden");
    });

    document.getElementById("btn-checkout")?.addEventListener("click", () => {
      const cart = getCart();
      if (!cart.length) {
        toast("Cart is empty.");
        return;
      }
      toast("Order placed! (Demo checkout — no payment processed)");
      saveCart([]);
    });
  }

  function initChat() {
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages");
    const quickBtns = document.querySelectorAll(".chat-quick");
    if (!form || !messages) return;

    let history = loadJson(STORAGE.chatHistory, []);

    function appendMessage(role, text) {
      const div = document.createElement("div");
      div.className = `chat-msg chat-msg--${role}`;
      div.innerHTML = role === "bot" ? `<strong>AI Coach</strong><p>${escapeHtml(text)}</p>` : `<strong>You</strong><p>${escapeHtml(text)}</p>`;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function renderHistory() {
      messages.innerHTML = "";
      if (!history.length) {
        appendMessage("bot", "Hi! I'm your personal fitness coach. Ask about workouts, diet, supplements, recovery, or how to use this app.");
        return;
      }
      history.forEach((h) => appendMessage(h.role === "user" ? "user" : "bot", h.text));
    }

    async function sendMessage(text) {
      const msg = text.trim();
      if (!msg) return;
      appendMessage("user", msg);
      history.push({ role: "user", text: msg });
      saveJson(STORAGE.chatHistory, history);

      const typing = document.createElement("div");
      typing.className = "chat-msg chat-msg--bot chat-typing";
      typing.textContent = "Thinking…";
      messages.appendChild(typing);

      try {
        const user = getServerUser();
        const context = user ? `User: ${user.displayName}, logged in` : "Guest user";
        const res = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, context }),
        });
        const data = await res.json();
        typing.remove();
        const reply = data.reply || "Sorry, I couldn't respond right now.";
        appendMessage("bot", reply);
        history.push({ role: "bot", text: reply });
        saveJson(STORAGE.chatHistory, history.slice(-40));
      } catch {
        typing.remove();
        appendMessage("bot", "Network error — make sure the server is running on port 3000.");
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage(input.value);
      input.value = "";
    });

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.textContent));
    });

    document.getElementById("btn-clear-chat")?.addEventListener("click", () => {
      history = [];
      saveJson(STORAGE.chatHistory, []);
      renderHistory();
    });

    renderHistory();
  }

  function initChatWidget() {
    if (pageName() === "chat") return;
    if (document.getElementById("chat-fab")) return;

    const fab = document.createElement("a");
    fab.href = "chat.html";
    fab.className = "chat-fab";
    fab.id = "chat-fab";
    fab.title = "AI Fitness Coach";
    fab.innerHTML = "💬";
    document.body.appendChild(fab);
  }

  function initDietEnhancements() {
    const btnSave = document.getElementById("btn-save-diet-plan");
    const btnAddLog = document.getElementById("btn-add-to-log");
    const tdeeForm = document.getElementById("form-tdee");

    btnSave?.addEventListener("click", () => {
      const out = document.getElementById("diet-output");
      if (!out || out.classList.contains("hidden")) {
        toast("Generate a diet plan first.");
        return;
      }
      saveJson(STORAGE.dietPlan, { html: out.innerHTML, savedAt: new Date().toISOString() });
      toast("Diet plan saved locally.");
    });

    const saved = loadJson(STORAGE.dietPlan, null);
    if (saved?.html) {
      const out = document.getElementById("diet-output");
      if (out && out.classList.contains("hidden")) {
        out.innerHTML = saved.html;
        out.classList.remove("hidden");
      }
    }

    btnAddLog?.addEventListener("click", () => {
      const name = document.getElementById("result-food-name")?.textContent;
      if (!name) {
        toast("Calculate macros first.");
        return;
      }
      window.gmsAddMealToTracker({
        name,
        calories: document.getElementById("result-calories")?.textContent?.replace(/\D/g, "") || 0,
        protein: parseFloat(document.getElementById("result-protein")?.textContent) || 0,
        carbs: parseFloat(document.getElementById("result-carbs")?.textContent) || 0,
        fat: parseFloat(document.getElementById("result-fat")?.textContent) || 0,
      });
    });

    tdeeForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(tdeeForm);
      const weight = Number(fd.get("weight"));
      const height = Number(fd.get("height"));
      const age = Number(fd.get("age"));
      const sex = fd.get("sex");
      const activity = Number(fd.get("activity"));
      const goal = fd.get("tdeeGoal");

      const bmr = sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5;
      const tdee = Math.round(bmr * activity);
      let target = tdee;
      let protein = Math.round(weight * 2);
      if (goal === "cut") target = tdee - 400;
      if (goal === "bulk") target = tdee + 300;

      const host = document.getElementById("tdee-result");
      if (host) {
        host.innerHTML = `
          <p><strong>Maintenance (TDEE):</strong> ${tdee} kcal/day</p>
          <p><strong>Your target:</strong> ${target} kcal/day (${goal})</p>
          <p><strong>Protein target:</strong> ~${protein}g/day</p>
          <p class="muted-block">Use Diet Lab below to build meals around these numbers.</p>`;
        host.classList.remove("hidden");
      }
    });
  }

  function init() {
    buildNav();
    initMobileNav();
    syncAuthBadge();
    initLogout();
    initChatWidget();

    const p = pageName();
    if (p === "exercises") initExercises();
    if (p === "tracker") initTracker();
    if (p === "mart") initMart();
    if (p === "chat") initChat();
    if (p === "diet") initDietEnhancements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
