// Общая логика: авторизация, шапка, роутинг. Хранилище — localStorage.

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
       <rect width='160' height='160' fill='#86a96f'/>
       <text x='80' y='104' font-size='90' text-anchor='middle' font-family='sans-serif'>🐱</text>
     </svg>`
  );

const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

const Auth = {
  users() { return Store.get("cck_users", {}); },
  current() {
    const email = Store.get("cck_session", null);
    if (!email) return null;
    return this.users()[email] || null;
  },
  register({ name, email, password, catName, avatar }) {
    email = email.trim().toLowerCase();
    const users = this.users();
    if (users[email]) throw new Error("Такой email уже зарегистрирован");
    users[email] = { name, email, password, catName: catName || "Кот", avatar: avatar || DEFAULT_AVATAR };
    Store.set("cck_users", users);
    Store.set("cck_session", email);
    return users[email];
  },
  login(email, password) {
    email = email.trim().toLowerCase();
    const u = this.users()[email];
    if (!u || u.password !== password) throw new Error("Неверный email или пароль");
    Store.set("cck_session", email);
    return u;
  },
  logout() { localStorage.removeItem("cck_session"); },
  update(patch) {
    const u = this.current(); if (!u) return null;
    const users = this.users();
    users[u.email] = { ...u, ...patch };
    Store.set("cck_users", users);
    return users[u.email];
  },
};

// ключ данных юзера, изолированный по email
function userKey(suffix) {
  const u = Auth.current();
  return `cck_${suffix}_${u ? u.email : "anon"}`;
}

function requireAuth() {
  if (!Auth.current()) { location.href = base() + "index.html"; return false; }
  return true;
}

// относительный путь до корня (страницы лежат в /pages/)
function base() {
  return location.pathname.includes("/pages/") ? "../" : "";
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function buildTopbar({ back } = {}) {
  const u = Auth.current();
  const b = base();
  const bar = document.createElement("header");
  bar.className = "topbar";
  bar.innerHTML = `
    ${back ? `<a class="back-btn" href="#" data-back>← назад</a>` : ""}
    <a class="brand" href="${b}${u ? "pages/home.html" : "index.html"}">
      <span class="paw">🐾</span> Cool Cat Kit
    </a>
    <span class="spacer"></span>
    ${
      u
        ? `<a class="me" href="${b}pages/profile.html" title="Профиль">
             <img src="${u.avatar}" alt="avatar"><span class="hand" style="font-size:1.2rem">${u.catName}</span>
           </a>`
        : `<a class="btn btn--sm" href="${b}index.html">Войти</a>`
    }`;
  document.body.prepend(bar);

  const backBtn = bar.querySelector("[data-back]");
  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const explicit = document.body.dataset.back;
      if (explicit) location.href = explicit;
      else if (history.length > 1) history.back();
      else location.href = b + "pages/home.html";
    });
  }
}

// роутер: по data-page вызывает нужный инициализатор
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const needsAuth = !["index"].includes(page);
  if (needsAuth && !requireAuth()) return;

  buildTopbar({ back: page !== "index" && page !== "home" });

  const init = PAGES[page];
  if (init) init();
});

const PAGES = {}; // инициализаторы страниц заполняются в pages.js
