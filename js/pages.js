// Логика страниц. Функции кладутся в PAGES[имя] и вызываются роутером из app.js.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Вход / регистрация (index.html)
PAGES.index = function () {
  if (Auth.current()) { location.href = "pages/home.html"; return; }

  const mount = $("#authMount");
  let mode = "login"; // login | register
  let avatarData = DEFAULT_AVATAR;

  function render() {
    const isReg = mode === "register";
    mount.innerHTML = `
      <div class="card form-card card--tilt-l">
        <span class="tape"></span>
        <h2 style="text-align:center">${isReg ? "Заводим аккаунт" : "С возвращением!"}</h2>
        <form id="authForm">
          ${
            isReg
              ? `<div class="avatar-edit">
                   <img id="avPreview" src="${avatarData}" alt="avatar">
                   <label class="btn btn--ghost btn--sm">
                     📷 выбрать фото
                     <input id="avFile" type="file" accept="image/*" hidden>
                   </label>
                 </div>
                 <div class="field"><label>Как зовут вас</label><input name="name" required></div>
                 <div class="field"><label>Кличка кота</label><input name="catName" placeholder="Барсик"></div>`
              : ""
          }
          <div class="field"><label>Email</label><input name="email" type="email" required></div>
          <div class="field"><label>Пароль</label><input name="password" type="password" required minlength="4"></div>
          <p class="form-msg" id="authMsg"></p>
          <button class="btn btn--block" type="submit">${isReg ? "Зарегистрироваться" : "Войти"}</button>
        </form>
        <p class="switch-line">
          ${isReg ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}
          <a href="#" id="toggleMode">${isReg ? "Войти" : "Зарегистрироваться"}</a>
        </p>
      </div>`;

    $("#toggleMode").addEventListener("click", (e) => {
      e.preventDefault(); mode = isReg ? "login" : "register"; avatarData = DEFAULT_AVATAR; render();
    });

    const avFile = $("#avFile");
    if (avFile) {
      avFile.addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return;
        avatarData = await fileToDataURL(f);
        $("#avPreview").src = avatarData;
      });
    }

    $("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msg = $("#authMsg");
      try {
        if (isReg) {
          Auth.register({
            name: fd.get("name"), email: fd.get("email"), password: fd.get("password"),
            catName: fd.get("catName"), avatar: avatarData,
          });
        } else {
          Auth.login(fd.get("email"), fd.get("password"));
        }
        location.href = "pages/home.html";
      } catch (err) {
        msg.textContent = err.message; msg.className = "form-msg err";
      }
    });
  }
  render();
};

// Главная (home.html)
PAGES.home = function () {
  const u = Auth.current();
  const g = $("#greeting");
  if (g) g.innerHTML = `Привет, <span class="scribble">${u.name}</span>!`;
  const sub = $("#catLine");
  if (sub) sub.textContent = `Дневник кота по кличке ${u.catName}`;

  // сворачивание справочника — состояние запоминаем в localStorage
  const group = $("#refGroup");
  const toggle = $("#refToggle");
  const wrap = group?.querySelector(".tiles-wrap");
  if (group && toggle && wrap) {
    const KEY = userKey("ref_collapsed");

    const expand = (animate) => {
      group.classList.remove("collapsed");
      wrap.style.overflow = "hidden";
      if (animate) {
        wrap.style.maxHeight = wrap.scrollHeight + "px";
        wrap.addEventListener("transitionend", function te(e) {
          if (e.target !== wrap || e.propertyName !== "max-height") return;
          // отпускаем высоту, чтобы при ресайзе плитки не обрезались
          wrap.style.maxHeight = "none";
          wrap.style.overflow = "visible";
          wrap.removeEventListener("transitionend", te);
        });
      } else {
        wrap.style.maxHeight = "none";
        wrap.style.overflow = "visible";
      }
    };

    const collapse = (animate) => {
      group.classList.add("collapsed");
      wrap.style.overflow = "hidden";
      if (animate) {
        wrap.style.maxHeight = wrap.scrollHeight + "px"; // от текущей высоты
        void wrap.offsetHeight;                          // форсируем reflow
        wrap.style.maxHeight = "0px";
      } else {
        wrap.style.maxHeight = "0px";
      }
    };

    const setLabel = (collapsed) => {
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "развернуть ▼" : "свернуть ▲";
    };

    let collapsed = Store.get(KEY, false);
    (collapsed ? collapse : expand)(false); // на загрузке без анимации
    setLabel(collapsed);

    toggle.addEventListener("click", () => {
      collapsed = !collapsed;
      Store.set(KEY, collapsed);
      (collapsed ? collapse : expand)(true);
      setLabel(collapsed);
    });
  }
};

// Породы: сетка карточек + модалка с деталями (breeds.html)
PAGES.breeds = function () {
  const grid = $("#breedGrid");
  grid.innerHTML = BREEDS.map(
    (b) => `
    <article class="breed-card" data-id="${b.id}">
      <img src="../${b.photo}" alt="${b.name}" loading="lazy">
      <h3>${b.name}</h3>
      <div class="tag">${b.tagline}</div>
      <div class="life">⏳ ${b.lifespan}</div>
    </article>`
  ).join("");

  const backdrop = $("#breedModal");
  const body = $("#breedModalBody");

  function openBreed(id) {
    const b = BREEDS.find((x) => x.id === id);
    if (!b) return;
    body.innerHTML = `
      <img class="hero-img" src="../${b.photo}" alt="${b.name}">
      <h2>${b.name} <span class="pill">${b.lifespan}</span></h2>
      <p class="hand" style="font-size:1.3rem;color:var(--pen-blue);margin:0 0 8px">${b.tagline}</p>
      <div class="block"><h3>История</h3><p>${b.history}</p></div>
      <div class="columns">
        <div class="block"><h3>Характер</h3><ul>${b.character.map((x) => `<li>${x}</li>`).join("")}</ul></div>
        <div class="block"><h3>Питание</h3><ul>${b.food.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      </div>
      <div class="block"><h3>Здоровье</h3><ul>${b.health.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
    backdrop.classList.add("open");
  }
  function close() { backdrop.classList.remove("open"); }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".breed-card");
    if (card) openBreed(+card.dataset.id);
  });
  $("#breedClose").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
};

// Медицина / прививки — заметки (medical.html)
const KIND_LABEL = { vaccine: "💉 Прививка", med: "🩺 Медицина", note: "📝 Заметка" };

PAGES.medical = function () {
  const listEl = $("#notesList");
  const KEY = userKey("notes");
  let notes = Store.get(KEY, []);

  function save() { Store.set(KEY, notes); }

  function render() {
    if (!notes.length) {
      listEl.innerHTML = `<p class="empty">Пока пусто. Запиши первую заметку про здоровье кота 🐾</p>`;
      return;
    }
    listEl.innerHTML = notes
      .slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(
        (n) => `
      <article class="note kind-${n.kind}" data-id="${n.id}">
        <div class="kind">${KIND_LABEL[n.kind]}</div>
        <h3>${escapeHtml(n.title)}</h3>
        <div class="body">${escapeHtml(n.body || "")}</div>
        <div class="row">
          ${n.date ? `<span class="date-chip">📅 ${fmtDate(n.date)}</span>` : ""}
          <button class="btn btn--ghost btn--sm" data-cal>${n.date ? "Изменить дату" : "В календарь"}</button>
          <button class="del" data-del title="Удалить">🗑</button>
        </div>
      </article>`
      ).join("");
  }

  $("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = fd.get("date");
    notes.push({
      id: uid(), kind: fd.get("kind"), title: fd.get("title").trim(),
      body: fd.get("body").trim(), date: date || null,
    });
    save(); render(); e.target.reset();
    toast("Заметка сохранена");
  });

  listEl.addEventListener("click", (e) => {
    const art = e.target.closest(".note"); if (!art) return;
    const id = art.dataset.id;
    const n = notes.find((x) => x.id === id);
    if (e.target.closest("[data-del]")) {
      notes = notes.filter((x) => x.id !== id); save(); render();
    } else if (e.target.closest("[data-cal]")) {
      const d = prompt("Дата для календаря (ГГГГ-ММ-ДД):", n.date || new Date().toISOString().slice(0, 10));
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        n.date = d; save(); render();
        toast("Привязано к календарю");
      } else if (d !== null) {
        toast("Формат: 2026-06-16");
      }
    }
  });

  render();
};

// Календарь: месяц + напоминания по дням (calendar.html)
PAGES.calendar = function () {
  const grid = $("#calGrid");
  const title = $("#calTitle");
  const CAL_KEY = userKey("cal");      // напоминания, созданные в календаре
  const NOTES_KEY = userKey("notes");  // медзаметки с привязанной датой

  let cal = Store.get(CAL_KEY, {});    // { "2026-06-16": [{id,title}] }
  const cur = new Date(); cur.setDate(1);
  const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

  function saveCal() { Store.set(CAL_KEY, cal); }
  function notesByDate() {
    const notes = Store.get(NOTES_KEY, []);
    const map = {};
    notes.filter((n) => n.date).forEach((n) => { (map[n.date] ||= []).push(n); });
    return map;
  }

  function render() {
    const y = cur.getFullYear(), m = cur.getMonth();
    title.textContent = `${MONTHS[m]} ${y}`;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // понедельник = 0
    const daysIn = new Date(y, m + 1, 0).getDate();
    const todayIso = new Date().toISOString().slice(0, 10);
    const nmap = notesByDate();

    let html = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("");
    for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell empty-cell"></div>`;
    for (let day = 1; day <= daysIn; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const reminders = cal[iso] || [];
      const meds = nmap[iso] || [];
      const dots = [
        ...meds.map((n) => `<span class="dot ${n.kind}"></span>`),
        ...reminders.map(() => `<span class="dot"></span>`),
      ].slice(0, 5).join("");
      const firstLabel = (meds[0]?.title || reminders[0]?.title || "");
      html += `
        <div class="cal-cell ${iso === todayIso ? "today" : ""}" data-iso="${iso}">
          <div class="num">${day}</div>
          ${firstLabel ? `<div class="mini">${escapeHtml(firstLabel)}</div>` : ""}
          <div class="dots">${dots}</div>
        </div>`;
    }
    grid.innerHTML = html;
  }

  function openDay(iso) {
    const reminders = cal[iso] || [];
    const meds = (notesByDate()[iso] || []);
    showModal(`
      <button class="close" data-close>&times;</button>
      <h2>${fmtDate(iso)}</h2>
      ${
        meds.length
          ? `<div class="block"><h3 style="color:var(--teal)">Из медзаметок</h3>
               <ul>${meds.map((n) => `<li>${KIND_LABEL[n.kind]} — ${escapeHtml(n.title)}</li>`).join("")}</ul></div>`
          : ""
      }
      <div class="block"><h3 style="color:var(--teal)">Напоминания</h3>
        <div id="dayReminders">${
          reminders.length
            ? reminders.map((r) => `<div class="row" data-id="${r.id}" style="margin:4px 0">
                <span>🔔 ${escapeHtml(r.title)}</span>
                <button class="del" data-del style="margin-left:auto">🗑</button></div>`).join("")
            : `<p class="muted">Пока ничего.</p>`
        }</div>
      </div>
      <form id="reminderForm" class="field" style="margin-top:14px">
        <label>Новое напоминание / заметка на день</label>
        <div class="row">
          <input name="title" placeholder="Дать таблетку от глистов" required style="flex:1">
          <button class="btn btn--sm" type="submit">+ Добавить</button>
        </div>
      </form>`);

    $("#reminderForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = new FormData(e.target).get("title").trim();
      if (!t) return;
      (cal[iso] ||= []).push({ id: uid(), title: t });
      saveCal(); render(); openDay(iso); toast("Напоминание добавлено");
    });
    $("#dayReminders").addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (row && e.target.closest("[data-del]")) {
        cal[iso] = (cal[iso] || []).filter((r) => r.id !== row.dataset.id);
        if (!cal[iso].length) delete cal[iso];
        saveCal(); render(); openDay(iso);
      }
    });
  }

  $("#calPrev").addEventListener("click", () => { cur.setMonth(cur.getMonth() - 1); render(); });
  $("#calNext").addEventListener("click", () => { cur.setMonth(cur.getMonth() + 1); render(); });
  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-cell:not(.empty-cell)");
    if (cell) openDay(cell.dataset.iso);
  });

  render();
};

// История кота — лента постов (history.html)
PAGES.history = function () {
  const feed = $("#feed");
  const KEY = userKey("posts");
  let posts = Store.get(KEY, []);
  let imgData = null;

  function save() { Store.set(KEY, posts); }

  function render() {
    if (!posts.length) {
      feed.innerHTML = `<p class="empty">История пока чистая. Добавь первый момент из жизни кота ✏️</p>`;
      return;
    }
    feed.innerHTML = posts
      .slice().reverse()
      .map(
        (p) => `
      <article class="post" data-id="${p.id}">
        <button class="del" data-del title="Удалить">🗑</button>
        ${p.img ? `<img src="${p.img}" alt="фото" loading="lazy">` : ""}
        <div class="meta">${fmtDate(p.date)}</div>
        <div class="text">${escapeHtml(p.text)}</div>
      </article>`
      ).join("");
  }

  const fileInput = $("#postImg");
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    imgData = f ? await fileToDataURL(f) : null;
    $("#postImgName").textContent = f ? f.name : "";
  });

  $("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text").trim();
    if (!text && !imgData) { toast("Добавь текст или фото"); return; }
    posts.push({ id: uid(), text, img: imgData, date: new Date().toISOString().slice(0, 10) });
    save(); render();
    e.target.reset(); imgData = null; $("#postImgName").textContent = "";
    toast("Добавлено в историю");
  });

  feed.addEventListener("click", (e) => {
    const art = e.target.closest(".post");
    if (art && e.target.closest("[data-del]")) {
      posts = posts.filter((p) => p.id !== art.dataset.id); save(); render();
    }
  });

  render();
};

// Профиль (profile.html)
PAGES.profile = function () {
  const u = Auth.current();
  let avatarData = u.avatar;

  $("#avPreview").src = avatarData;
  $("#pf-name").value = u.name;
  $("#pf-cat").value = u.catName;
  $("#pf-email").value = u.email;

  $("#avFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    avatarData = await fileToDataURL(f);
    $("#avPreview").src = avatarData;
  });

  $("#profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    Auth.update({
      name: $("#pf-name").value.trim(),
      catName: $("#pf-cat").value.trim() || "Кот",
      avatar: avatarData,
    });
    toast("Профиль обновлён");
    setTimeout(() => location.reload(), 700);
  });

  $("#logoutBtn").addEventListener("click", () => {
    Auth.logout();
    location.href = "../index.html";
  });
};

/* экранирование пользовательского текста */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* модалка общего назначения (для календаря) */
function showModal(innerHtml) {
  let backdrop = $("#genericModal");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "genericModal";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal" id="genericModalBody"></div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-close]")) backdrop.classList.remove("open");
    });
  }
  $("#genericModalBody").innerHTML = innerHtml;
  backdrop.classList.add("open");
}
