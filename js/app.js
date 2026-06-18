// API + авторизация + шапка + роутинг. Данные хранятся на сервере (FastAPI + PostgreSQL).

const API_BASE = "https://coolcatkit-api.onrender.com/api";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
       <rect width='160' height='160' fill='#86a96f'/>
       <text x='80' y='104' font-size='90' text-anchor='middle' font-family='sans-serif'>🐱</text>
     </svg>`
  );

// ── токен ─────────────────────────────────────────────
const Token = {
  get() { return localStorage.getItem("cck_token"); },
  set(t) { localStorage.setItem("cck_token", t); },
  clear() { localStorage.removeItem("cck_token"); },
};

// ── базовый запрос к API ──────────────────────────────
async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = Token.get();
  if (t) headers["Authorization"] = "Bearer " + t;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }

  if (!res.ok) {
    let msg = "Ошибка " + res.status;
    if (data && data.detail) {
      msg = Array.isArray(data.detail) ? (data.detail[0]?.msg || msg) : data.detail;
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── авторизация ───────────────────────────────────────
const Auth = {
  _me: null,
  async register({ name, email, password, catName, avatar }) {
    const { token } = await api("/auth/register", {
      method: "POST", body: { name, email, password, catName },
    });
    Token.set(token);
    if (avatar && avatar !== DEFAULT_AVATAR) {
      try { await api("/me", { method: "PATCH", body: { avatarUrl: avatar } }); } catch { /* не критично */ }
    }
    this._me = null;
  },
  async login(email, password) {
    const { token } = await api("/auth/login", { method: "POST", body: { email, password } });
    Token.set(token);
    this._me = null;
  },
  logout() { Token.clear(); this._me = null; },
  async loadMe() { this._me = await api("/me"); return this._me; },
  current() { return this._me; },          // профиль из кэша (после loadMe)
  async update(patch) { this._me = await api("/me", { method: "PATCH", body: patch }); return this._me; },
};

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
  t._t = setTimeout(() => t.classList.remove("show"), 2600);
}

// экран загрузки (важно для «холодного старта» бесплатного сервера)
function showLoader() {
  if (document.getElementById("appLoader")) return;
  const l = document.createElement("div");
  l.id = "appLoader";
  l.className = "app-loader";
  l.innerHTML = `
    <div class="app-loader-paw">🐾</div>
    <p>Загрузка…</p>
    <p class="muted" style="font-size:.85rem;max-width:280px">первый вход после простоя сервера может занять до минуты</p>`;
  document.body.appendChild(l);
}
function hideLoader() { document.getElementById("appLoader")?.remove(); }

function buildTopbar({ back } = {}) {
  const me = Auth.current();
  const cat = me ? me.cat : null;
  const b = base();
  const bar = document.createElement("header");
  bar.className = "topbar";
  bar.innerHTML = `
    ${back ? `<a class="back-btn" href="#" data-back>← назад</a>` : ""}
    <a class="brand" href="${b}${me ? "pages/home.html" : "index.html"}">
      <span class="paw">🐾</span> Cool Cat Kit
    </a>
    <span class="spacer"></span>
    ${
      me
        ? `<a class="me" href="${b}pages/profile.html" title="Профиль">
             <img src="${cat.avatarUrl || DEFAULT_AVATAR}" alt="avatar"><span class="hand" style="font-size:1.2rem">${cat.name}</span>
           </a>`
        : ""
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

// роутер: грузит профиль, гейтит доступ, вызывает инициализатор страницы
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  const onIndex = page === "index";

  if (!onIndex) {
    if (!Token.get()) { location.href = base() + "index.html"; return; }
    showLoader();
    try {
      await Auth.loadMe();
    } catch (e) {
      hideLoader();
      if (e.status === 401) { Auth.logout(); location.href = base() + "index.html"; return; }
      toast("Сервер недоступен, обнови страницу позже");
      return;
    }
    hideLoader();
  } else if (Token.get()) {
    // уже залогинен — пробуем сразу на главную
    showLoader();
    try { await Auth.loadMe(); location.href = "pages/home.html"; return; }
    catch (e) { if (e.status === 401) Auth.logout(); }
    hideLoader();
  }

  buildTopbar({ back: page !== "index" && page !== "home" });

  const init = PAGES[page];
  if (init) {
    try { await init(); }
    catch (e) { console.error(e); toast(e.message || "Ошибка загрузки"); }
  }

  initFaq();
});

const PAGES = {}; // инициализаторы страниц заполняются в pages.js

// FAQ-аккордеон на странице входа: открыт только один пункт за раз
function initFaq() {
  const items = [...document.querySelectorAll(".faq-item")];

  const close = (item) => {
    const a = item.querySelector(".faq-a");
    if (a.style.maxHeight === "none") { a.style.maxHeight = a.scrollHeight + "px"; void a.offsetHeight; }
    item.classList.remove("open");
    a.style.maxHeight = "0px";
  };
  const open = (item) => {
    const a = item.querySelector(".faq-a");
    item.classList.add("open");
    a.style.maxHeight = a.scrollHeight + "px";
    a.addEventListener("transitionend", function te(e) {
      if (e.target !== a || e.propertyName !== "max-height") return;
      if (item.classList.contains("open")) a.style.maxHeight = "none";
      a.removeEventListener("transitionend", te);
    });
  };

  items.forEach((item) => {
    const q = item.querySelector(".faq-q");
    if (!q) return;
    q.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      items.forEach(close);
      if (!wasOpen) open(item);
    });
  });
}
