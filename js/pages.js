// Логика страниц. Данные с сервера через api() (см. app.js). Инициализаторы в PAGES[имя].

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
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

// ── даты / возраст / склонения ──────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const dateToISO = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addMonths = (iso, months) => { const d = isoToDate(iso); d.setMonth(d.getMonth() + months); return dateToISO(d); };
const daysUntil = (iso) => Math.round((isoToDate(iso) - isoToDate(todayISO())) / 86400000);

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
function ageText(birthIso) {
  if (!birthIso) return "";
  const b = isoToDate(birthIso), n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) months--;
  if (months < 0) return "";
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${plural(y, "год", "года", "лет")}`);
  if (m) parts.push(`${m} ${plural(m, "месяц", "месяца", "месяцев")}`);
  return parts.length ? parts.join(" ") : "меньше месяца";
}
function whenText(iso) {
  const d = daysUntil(iso);
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d === -1) return "вчера";
  if (d > 0) return `через ${d} ${plural(d, "день", "дня", "дней")}`;
  return `${-d} ${plural(-d, "день", "дня", "дней")} назад`;
}

// порода берётся из статического справочника (js/data.js) — там полные детали
function breedName(id) {
  if (id == null || typeof BREEDS === "undefined") return "";
  const b = BREEDS.find((x) => x.id === id);
  return b ? b.name : "";
}
const SEX_LABEL = { m: "♂ котик", f: "♀ кошка" };

// ── константы разделов ──────────────────────────────────────────────
const KIND_LABEL = { vaccine: "💉 Прививка", med: "🩺 Медицина", note: "📝 Заметка" };
const CAL_CATS = {
  reminder: "🔔 Напоминание",
  food:     "🍗 Корм",
  vaccine:  "💉 Прививка",
  walk:     "🐾 Прогулка",
  grooming: "✂️ Груминг",
  vet:      "🩺 Ветеринар",
};
const catIcon = (cat) => (CAL_CATS[cat] || CAL_CATS.reminder).split(" ")[0];

// версия ассетов: бамп сбрасывает кэш браузера при замене картинок
const ASSET_VER = "4";
const BREED_FOCUS = {
  2: "center 5%", 3: "center 8%", 9: "center 25%", 12: "center 14%", 13: "center 30%",
};
const focusFor = (id) => BREED_FOCUS[id] || "center 28%";

// ── вычисления из загруженных данных ────────────────────────────────
const latestWeightOf = (weights) => (weights.length ? weights[weights.length - 1] : null);

function nextVaccineDueFrom(notes) {
  const due = notes
    .filter((n) => n.kind === "vaccine" && n.date && n.repeatMonths)
    .map((n) => ({ title: n.title, date: addMonths(n.date, n.repeatMonths) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return due.find((x) => daysUntil(x.date) >= 0) || due[due.length - 1] || null;
}

function upcomingEventsFrom(notes, reminders, limit = 4) {
  const out = [];
  reminders.forEach((r) => out.push({ date: r.date, icon: catIcon(r.category), label: r.title }));
  notes.filter((n) => n.date).forEach((n) =>
    out.push({ date: n.date, icon: KIND_LABEL[n.kind].split(" ")[0], label: n.title }));
  notes.filter((n) => n.kind === "vaccine" && n.date && n.repeatMonths).forEach((n) =>
    out.push({ date: addMonths(n.date, n.repeatMonths), icon: "🔁", label: `повтор: ${n.title}` }));
  return out
    .filter((e) => daysUntil(e.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// ── Вход / регистрация (index.html) ─────────────────────────────────
PAGES.index = function () {
  const mount = $("#authMount");
  let mode = "login";
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
                 <div class="field"><label>Кличка котика</label><input name="catName" placeholder="Барсик"></div>`
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

    $("#authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msg = $("#authMsg");
      const btn = e.target.querySelector("button[type=submit]");
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = "…";
      msg.textContent = "";
      try {
        if (isReg) {
          await Auth.register({
            name: fd.get("name"), email: fd.get("email"), password: fd.get("password"),
            catName: fd.get("catName") || "Котик", avatar: avatarData,
          });
        } else {
          await Auth.login(fd.get("email"), fd.get("password"));
        }
        location.href = "pages/home.html";
      } catch (err) {
        msg.textContent = err.message; msg.className = "form-msg err";
        btn.disabled = false; btn.textContent = label;
      }
    });
  }
  render();
};

// ── Главная + дашборд (home.html) ───────────────────────────────────
PAGES.home = async function () {
  const me = Auth.current();
  const g = $("#greeting");
  if (g) g.innerHTML = `Привет, <span class="scribble">${me.name}</span>!`;
  const sub = $("#catLine");
  if (sub) sub.textContent = `Дневник котика по кличке ${me.cat.name}`;

  const dash = $("#dashboard");
  if (dash) {
    const [notes, reminders, weights] = await Promise.all([
      api("/notes"), api("/reminders"), api("/weights"),
    ]);
    const cat = me.cat;
    const breed = breedName(cat.breedId);
    const age = ageText(cat.birthday);
    const w = latestWeightOf(weights);
    const vac = nextVaccineDueFrom(notes);
    const vacOverdue = vac && daysUntil(vac.date) < 0;
    const events = upcomingEventsFrom(notes, reminders, 4);

    const chips = [
      breed && `<span>🐈 ${breed}</span>`,
      age && `<span>🎂 ${age}</span>`,
      cat.sex && `<span>${SEX_LABEL[cat.sex]}</span>`,
      w && `<span>⚖️ ${w.kg} кг</span>`,
    ].filter(Boolean).join("");

    dash.innerHTML = `
      <section class="dash card card--tilt-r">
        <span class="tape"></span>
        <div class="dash-pet">
          <img class="dash-ava" src="${cat.avatarUrl || DEFAULT_AVATAR}" alt="${escapeHtml(cat.name)}">
          <div class="dash-pet-info">
            <h2 class="hand">${escapeHtml(cat.name)}</h2>
            <div class="dash-meta">${chips || `<span class="muted">паспорт пока не заполнен</span>`}</div>
            <a class="dash-edit" href="profile.html">✎ паспорт котика</a>
          </div>
        </div>
        <div class="dash-cols">
          <div class="dash-box">
            <h3>💉 Прививки</h3>
            ${
              vac
                ? `<p class="dash-vac">${escapeHtml(vac.title)}<br>
                     <b class="${vacOverdue ? "dash-warn" : "dash-ok"}">${fmtDate(vac.date)} · ${whenText(vac.date)}</b></p>`
                : `<p class="muted">нет запланированных повторов</p>`
            }
            <a class="dash-link" href="medical.html">все записи →</a>
          </div>
          <div class="dash-box">
            <h3>📅 Ближайшее</h3>
            ${
              events.length
                ? `<ul class="dash-events">${events.map((e) => `
                    <li><span class="dash-ev-label">${e.icon} ${escapeHtml(e.label)}</span>
                        <span class="dash-when">${whenText(e.date)}</span></li>`).join("")}</ul>`
                : `<p class="muted">пусто — отметь даты в календаре</p>`
            }
            <a class="dash-link" href="calendar.html">в календарь →</a>
          </div>
        </div>
      </section>`;
  }

  // сворачивание справочника — состояние интерфейса храним локально
  const group = $("#refGroup");
  const toggle = $("#refToggle");
  const wrap = group?.querySelector(".tiles-wrap");
  if (group && toggle && wrap) {
    const KEY = "cck_ref_collapsed";
    const expand = (animate) => {
      group.classList.remove("collapsed");
      wrap.style.overflow = "hidden";
      if (animate) {
        wrap.style.maxHeight = wrap.scrollHeight + "px";
        wrap.addEventListener("transitionend", function te(e) {
          if (e.target !== wrap || e.propertyName !== "max-height") return;
          wrap.style.maxHeight = "none"; wrap.style.overflow = "visible";
          wrap.removeEventListener("transitionend", te);
        });
      } else { wrap.style.maxHeight = "none"; wrap.style.overflow = "visible"; }
    };
    const collapse = (animate) => {
      group.classList.add("collapsed");
      wrap.style.overflow = "hidden";
      if (animate) { wrap.style.maxHeight = wrap.scrollHeight + "px"; void wrap.offsetHeight; wrap.style.maxHeight = "0px"; }
      else { wrap.style.maxHeight = "0px"; }
    };
    const setLabel = (collapsed) => {
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "развернуть ▼" : "свернуть ▲";
    };
    let collapsed = localStorage.getItem(KEY) === "1";
    (collapsed ? collapse : expand)(false);
    setLabel(collapsed);
    toggle.addEventListener("click", () => {
      collapsed = !collapsed;
      localStorage.setItem(KEY, collapsed ? "1" : "0");
      (collapsed ? collapse : expand)(true);
      setLabel(collapsed);
    });
  }
};

// ── Породы (breeds.html) — статический справочник, без API ──────────
PAGES.breeds = function () {
  const grid = $("#breedGrid");
  const search = $("#breedSearch");
  const countEl = $("#breedCount");
  const emptyEl = $("#breedEmpty");

  const cardHtml = (b) => `
    <article class="breed-card" data-id="${b.id}">
      <img src="../${b.photo}?v=${ASSET_VER}" alt="${b.name}" loading="lazy" style="object-position:${focusFor(b.id)}">
      <h3>${b.name}</h3>
      <div class="tag">${b.tagline}</div>
      <div class="life">⏳ ${b.lifespan}</div>
    </article>`;

  function renderGrid(q = "") {
    q = q.trim().toLowerCase();
    const list = !q ? BREEDS : BREEDS.filter((b) =>
      [b.name, b.tagline, ...(b.character || [])].join(" ").toLowerCase().includes(q));
    grid.innerHTML = list.map(cardHtml).join("");
    if (emptyEl) emptyEl.hidden = list.length > 0;
    if (countEl) countEl.textContent = `${list.length} из ${BREEDS.length}`;
  }
  renderGrid();
  if (search) search.addEventListener("input", () => renderGrid(search.value));

  const backdrop = $("#breedModal");
  const body = $("#breedModalBody");

  function openBreed(id) {
    const b = BREEDS.find((x) => x.id === id);
    if (!b) return;
    body.innerHTML = `
      <img class="hero-img" src="../${b.photo}?v=${ASSET_VER}" alt="${b.name}" style="object-position:${focusFor(b.id)}">
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

// ── Советы по еде: карточки кормов + сравнение (food-tips.html) ──────
PAGES["food-tips"] = function () {
  const grid = $("#foodGrid");
  if (!grid || typeof FOODS === "undefined") return;

  grid.innerHTML = FOODS.map((f) => `
    <article class="food-card" data-id="${f.id}">
      <img src="../${f.photo}" alt="${f.name}" loading="lazy">
      <div class="food-card-body">
        <span class="food-badge food-${f.cls}">${f.clsLabel}</span>
        <h3>${f.name}</h3>
        <div class="tag">${f.tagline}</div>
        <div class="food-price">${f.price}</div>
      </div>
    </article>`).join("");

  const cmp = $("#foodCompare");
  if (cmp && typeof FOOD_COMPARE !== "undefined") {
    cmp.innerHTML = `
      <h2>Классы кормов</h2>
      <div class="food-table-wrap">
        <table class="food-table">
          <thead><tr><th></th>${FOOD_COMPARE.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>${FOOD_COMPARE.rows.map((r) =>
            `<tr><th>${r[0]}</th>${r.slice(1).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  const backdrop = $("#foodModal");
  const body = $("#foodModalBody");
  function openFood(id) {
    const f = FOODS.find((x) => x.id === id);
    if (!f) return;
    body.innerHTML = `
      <img class="hero-img" src="../${f.photo}" alt="${f.name}">
      <h2>${f.name} <span class="pill">${f.clsLabel}</span></h2>
      <p class="hand" style="font-size:1.3rem;color:var(--pen-blue);margin:0 0 8px">${f.tagline}</p>
      <div class="block"><h3>О корме</h3><p>${f.desc}</p></div>
      <div class="block"><h3>Цена</h3><p>${f.price}</p></div>`;
    backdrop.classList.add("open");
  }
  function close() { backdrop.classList.remove("open"); }
  grid.addEventListener("click", (e) => { const c = e.target.closest(".food-card"); if (c) openFood(+c.dataset.id); });
  $("#foodClose").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
};

// ── Мемы про котиков (memes.html) — статичная подборка, без API ─────
PAGES.memes = function () {
  const grid = $("#memeGrid");
  if (!grid || typeof MEMES === "undefined") return;

  grid.innerHTML = MEMES.map((m) => `
    <article class="meme-card" data-id="${m.id}">
      <img src="../${m.photo}?v=${ASSET_VER}" alt="${m.caption}" loading="lazy">
      <div class="meme-cap">${m.caption}</div>
    </article>`).join("");

  const backdrop = $("#memeModal");
  const body = $("#memeModalBody");
  function openMeme(id) {
    const m = MEMES.find((x) => x.id === id);
    if (!m) return;
    body.innerHTML = `
      <img class="meme-modal-img" src="../${m.photo}?v=${ASSET_VER}" alt="${m.caption}">
      <p class="meme-modal-cap">${m.caption}</p>`;
    backdrop.classList.add("open");
  }
  function close() { backdrop.classList.remove("open"); }
  grid.addEventListener("click", (e) => { const c = e.target.closest(".meme-card"); if (c) openMeme(+c.dataset.id); });
  $("#memeClose").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
};

// ── Медицина / прививки (medical.html) ──────────────────────────────
PAGES.medical = async function () {
  const listEl = $("#notesList");
  let notes = await api("/notes");
  let filter = "all";

  const form = $("#noteForm");
  const repeatField = $("#repeatField");
  const syncRepeat = () => { repeatField.style.display = form.kind.value === "vaccine" ? "" : "none"; };
  form.kind.addEventListener("change", syncRepeat);
  syncRepeat();

  function render() {
    const shown = notes.filter((n) => filter === "all" || n.kind === filter);
    if (!shown.length) {
      listEl.innerHTML = `<p class="empty">${notes.length ? "В этой категории пусто" : "Пока пусто. Запиши первую заметку про здоровье котика 🐾"}</p>`;
      return;
    }
    listEl.innerHTML = shown
      .slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((n) => {
        const due = n.kind === "vaccine" && n.date && n.repeatMonths ? addMonths(n.date, n.repeatMonths) : null;
        const dueOverdue = due && daysUntil(due) < 0;
        return `
      <article class="note kind-${n.kind}" data-id="${n.id}">
        <div class="kind">${KIND_LABEL[n.kind]}</div>
        <h3>${escapeHtml(n.title)}</h3>
        <div class="body">${escapeHtml(n.body || "")}</div>
        ${due ? `<div class="next-due ${dueOverdue ? "overdue" : ""}">🔁 повтор: ${fmtDate(due)} <span class="muted">· ${whenText(due)}</span></div>` : ""}
        <div class="row">
          ${n.date ? `<span class="date-chip">📅 ${fmtDate(n.date)}</span>` : ""}
          <button class="btn btn--ghost btn--sm" data-cal>${n.date ? "Изменить дату" : "В календарь"}</button>
          <button class="del" data-del title="Удалить">🗑</button>
        </div>
      </article>`;
      }).join("");
  }

  $("#noteFilters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    filter = chip.dataset.filter;
    $$("#noteFilters .chip").forEach((c) => c.classList.toggle("active", c === chip));
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const kind = fd.get("kind");
    await api("/notes", { method: "POST", body: {
      kind, title: fd.get("title").trim(), body: fd.get("body").trim(),
      date: fd.get("date") || null,
      repeatMonths: kind === "vaccine" ? Number(fd.get("repeatM")) || 0 : 0,
    }});
    notes = await api("/notes");
    render(); e.target.reset(); syncRepeat();
    toast("Заметка сохранена");
  });

  listEl.addEventListener("click", async (e) => {
    const art = e.target.closest(".note"); if (!art) return;
    const id = +art.dataset.id;
    const n = notes.find((x) => x.id === id);
    if (e.target.closest("[data-del]")) {
      await api(`/notes/${id}`, { method: "DELETE" });
      notes = await api("/notes"); render();
    } else if (e.target.closest("[data-cal]")) {
      const d = prompt("Дата для календаря (ГГГГ-ММ-ДД):", n.date || todayISO());
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        await api(`/notes/${id}`, { method: "PATCH", body: {
          kind: n.kind, title: n.title, body: n.body, date: d, repeatMonths: n.repeatMonths || 0,
        }});
        notes = await api("/notes"); render();
        toast("Привязано к календарю");
      } else if (d !== null) {
        toast("Формат: 2026-06-16");
      }
    }
  });

  render();
};

// ── Календарь (calendar.html) ───────────────────────────────────────
PAGES.calendar = async function () {
  const grid = $("#calGrid");
  const title = $("#calTitle");
  let reminders = await api("/reminders");
  let notes = await api("/notes");

  const cur = new Date(); cur.setDate(1);
  const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

  const remindersByDate = () => {
    const map = {};
    reminders.forEach((r) => { (map[r.date] ||= []).push(r); });
    return map;
  };
  const notesByDate = () => {
    const map = {};
    notes.filter((n) => n.date).forEach((n) => { (map[n.date] ||= []).push(n); });
    notes.filter((n) => n.kind === "vaccine" && n.date && n.repeatMonths).forEach((n) => {
      const due = addMonths(n.date, n.repeatMonths);
      (map[due] ||= []).push({ kind: "vaccine", title: `🔁 повтор: ${n.title}` });
    });
    return map;
  };

  function render() {
    const y = cur.getFullYear(), m = cur.getMonth();
    title.textContent = `${MONTHS[m]} ${y}`;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysIn = new Date(y, m + 1, 0).getDate();
    const todayIso = todayISO();
    const rmap = remindersByDate();
    const nmap = notesByDate();

    let html = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("");
    for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell empty-cell"></div>`;
    for (let day = 1; day <= daysIn; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const rem = rmap[iso] || [];
      const meds = nmap[iso] || [];
      const dots = [
        ...meds.map((n) => `<span class="dot ${n.kind}"></span>`),
        ...rem.map(() => `<span class="dot"></span>`),
      ].slice(0, 5).join("");
      const firstLabel = (meds[0]?.title || rem[0]?.title || "");
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
    const rem = remindersByDate()[iso] || [];
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
      <div class="block"><h3 style="color:var(--teal)">События дня</h3>
        <div id="dayReminders">${
          rem.length
            ? rem.map((r) => `<div class="row reminder-row" data-id="${r.id}">
                <span>${catIcon(r.category)} ${escapeHtml(r.title)}</span>
                <button class="del" data-del title="Удалить">🗑</button></div>`).join("")
            : `<p class="muted">Пока ничего.</p>`
        }</div>
      </div>
      <form id="reminderForm" style="margin-top:16px">
        <div class="field" style="margin-bottom:10px">
          <label>Новое событие на день</label>
          <select name="cat">${
            Object.entries(CAL_CATS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")
          }</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <input name="title" placeholder="Что нужно сделать?" required>
        </div>
        <button class="btn btn--block" type="submit" style="margin-top:20px">+ Добавить</button>
      </form>`);

    $("#reminderForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const t = fd.get("title").trim();
      if (!t) return;
      await api("/reminders", { method: "POST", body: { date: iso, title: t, category: fd.get("cat") } });
      reminders = await api("/reminders");
      render(); openDay(iso); toast("Событие добавлено");
    });
    $("#dayReminders").addEventListener("click", async (e) => {
      const row = e.target.closest("[data-id]");
      if (row && e.target.closest("[data-del]")) {
        await api(`/reminders/${row.dataset.id}`, { method: "DELETE" });
        reminders = await api("/reminders");
        render(); openDay(iso);
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

// ── Калькулятор корма (food.html) ───────────────────────────────────
PAGES.food = async function () {
  const form = $("#foodForm");
  const out = $("#foodOut");

  const weights = await api("/weights");
  const w = latestWeightOf(weights);
  if (w) form.kg.value = w.kg;

  function calc() {
    const kg = parseFloat(form.kg.value);
    if (!(kg > 0)) { out.innerHTML = `<p class="form-msg err">Укажи вес котика</p>`; return; }
    const stage = form.stage.value;
    const activity = form.activity.value;
    const neutered = form.neutered.value === "yes";
    const kcal100 = parseFloat(form.kcal.value) || 360;

    const RER = 70 * Math.pow(kg, 0.75);
    let factor;
    if (stage === "kitten") factor = 2.5;
    else {
      factor = stage === "senior" ? (neutered ? 1.1 : 1.2) : (neutered ? 1.2 : 1.4);
      factor *= activity === "low" ? 0.9 : activity === "high" ? 1.15 : 1;
    }
    const der = Math.round(RER * factor);
    const grams = Math.round((der * 100) / kcal100);
    const perMeal = Math.round(grams / 2);

    out.innerHTML = `
      <div class="food-big">
        <div class="food-num"><b>${der}</b><span>ккал / день</span></div>
        <div class="food-num accent"><b>${grams}</b><span>грамм сухого / день</span></div>
      </div>
      <ul class="food-notes">
        <li>База обмена (RER): <b>${Math.round(RER)}</b> ккал · коэффициент ×${factor.toFixed(2)}</li>
        <li>Раздели на 2 приёма: ≈ <b>${perMeal} г</b> утром и вечером</li>
        <li>Это сухой корм при <b>${kcal100}</b> ккал/100 г — для влажного норма в граммах будет больше.</li>
        ${stage === "kitten" ? `<li class="muted">Котятам корм дают чаще — 3–4 раза в день.</li>` : ""}
      </ul>
      <p class="muted" style="margin-top:10px;font-size:.85rem">Ориентир. При болезнях, беременности или ожирении норму определяет ветеринар.</p>`;
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  if (w) calc();
};

// ── Трекер веса с графиком (weight.html) ────────────────────────────
PAGES.weight = async function () {
  const listEl = $("#weightList");
  const statsEl = $("#weightStats");
  const canvas = $("#weightChart");
  const form = $("#weightForm");
  form.date.value = todayISO();

  let weights = await api("/weights");

  function render() {
    if (weights.length) {
      const cur = weights[weights.length - 1];
      const first = weights[0];
      const diff = +(cur.kg - first.kg).toFixed(2);
      const kgs = weights.map((d) => d.kg);
      const min = Math.min(...kgs), max = Math.max(...kgs);
      const trend = diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : "= 0";
      const trendCls = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      statsEl.innerHTML = `
        <span class="ws-cur"><b>${cur.kg}</b> кг</span>
        <span class="ws-trend ${trendCls}">${trend} кг</span>
        <span class="muted">мин ${min} · макс ${max} · ${weights.length} ${plural(weights.length, "запись", "записи", "записей")}</span>`;
    } else {
      statsEl.innerHTML = `<span class="muted">пока нет измерений</span>`;
    }

    drawWeightChart(canvas, weights);

    if (!weights.length) {
      listEl.innerHTML = `<p class="empty">Добавь первое измерение веса ⚖️</p>`;
      return;
    }
    listEl.innerHTML = weights
      .slice().reverse()
      .map((d, i, arr) => {
        const prev = arr[i + 1];
        const delta = prev ? +(d.kg - prev.kg).toFixed(2) : 0;
        const deltaHtml = prev
          ? `<span class="wl-delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}">${delta > 0 ? "+" : ""}${delta || 0}</span>`
          : "";
        return `
          <div class="wl-row" data-id="${d.id}">
            <span class="wl-date">${fmtDate(d.date)}</span>
            <span class="wl-kg">${d.kg} кг ${deltaHtml}</span>
            <button class="del" data-del title="Удалить">🗑</button>
          </div>`;
      }).join("");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = form.date.value;
    const kg = +parseFloat(form.kg.value).toFixed(2);
    if (!date || !(kg > 0)) return;
    await api("/weights", { method: "POST", body: { date, kg } });
    weights = await api("/weights");
    render(); form.kg.value = "";
    toast("Вес записан");
  });

  listEl.addEventListener("click", async (e) => {
    const row = e.target.closest(".wl-row");
    if (row && e.target.closest("[data-del]")) {
      await api(`/weights/${row.dataset.id}`, { method: "DELETE" });
      weights = await api("/weights"); render();
    }
  });

  window.addEventListener("resize", () => drawWeightChart(canvas, weights));
  render();
};

function drawWeightChart(canvas, data) {
  const wrap = canvas.parentElement;
  const cssW = wrap.clientWidth;
  const cssH = 240;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const colLine = css("--line") || "#cfd8c2";
  const colInk = css("--ink-soft") || "#5b6452";
  const colSage = css("--sage-700") || "#5a7d52";
  const colTeal = css("--teal") || "#4d6b73";
  ctx.font = "12px Nunito, sans-serif";

  if (!data.length) {
    ctx.fillStyle = colInk; ctx.textAlign = "center";
    ctx.fillText("Нет данных — добавь измерение веса", cssW / 2, cssH / 2);
    return;
  }

  const padL = 40, padR = 16, padT = 16, padB = 28;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const kgs = data.map((d) => d.kg);
  let minK = Math.min(...kgs), maxK = Math.max(...kgs);
  if (minK === maxK) { minK -= 0.5; maxK += 0.5; }
  const padK = (maxK - minK) * 0.15;
  minK = Math.max(0, minK - padK); maxK = maxK + padK;

  const x = (i) => padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (kg) => padT + plotH - ((kg - minK) / (maxK - minK)) * plotH;

  ctx.strokeStyle = colLine; ctx.fillStyle = colInk; ctx.lineWidth = 1;
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const kg = minK + ((maxK - minK) * t) / ticks;
    const yy = y(kg);
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(cssW - padR, yy); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(kg.toFixed(1), padL - 6, yy);
  }

  ctx.strokeStyle = colSage; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((d, i) => { const px = x(i), py = y(d.kg); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.stroke();
  ctx.lineTo(x(data.length - 1), padT + plotH);
  ctx.lineTo(x(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = "rgba(134,169,111,.14)"; ctx.fill();

  const step = Math.ceil(data.length / 6);
  data.forEach((d, i) => {
    const px = x(i), py = y(d.kg);
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = colTeal; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#fffdf6"; ctx.stroke();
    if (i % step === 0 || i === data.length - 1) {
      ctx.fillStyle = colInk; ctx.textAlign = "center"; ctx.textBaseline = "top";
      const [, mm, dd] = d.date.split("-");
      ctx.fillText(`${dd}.${mm}`, px, padT + plotH + 8);
    }
  });
}

// ── История котика (history.html) ─────────────────────────────────────
PAGES.history = async function () {
  const feed = $("#feed");
  let posts = await api("/posts");
  let imgData = null;

  function render() {
    if (!posts.length) {
      feed.innerHTML = `<p class="empty">История пока чистая. Добавь первый момент из жизни котика ✏️</p>`;
      return;
    }
    feed.innerHTML = posts
      .map((p) => `
      <article class="post" data-id="${p.id}">
        <button class="del" data-del title="Удалить">🗑</button>
        ${p.imageUrl ? `<img src="${p.imageUrl}" alt="фото" loading="lazy">` : ""}
        <div class="meta">${fmtDate(p.date)}</div>
        <div class="text">${escapeHtml(p.text)}</div>
      </article>`).join("");
  }

  const fileInput = $("#postImg");
  fileInput.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    imgData = f ? await fileToDataURL(f) : null;
    $("#postImgName").textContent = f ? f.name : "";
  });

  $("#postForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text").trim();
    if (!text && !imgData) { toast("Добавь текст или фото"); return; }
    await api("/posts", { method: "POST", body: { text, imageUrl: imgData, date: todayISO() } });
    posts = await api("/posts");
    render();
    e.target.reset(); imgData = null; $("#postImgName").textContent = "";
    toast("Добавлено в историю");
  });

  feed.addEventListener("click", async (e) => {
    const art = e.target.closest(".post");
    if (art && e.target.closest("[data-del]")) {
      await api(`/posts/${art.dataset.id}`, { method: "DELETE" });
      posts = await api("/posts"); render();
    }
  });

  render();
};

// ── Профиль + паспорт котика (profile.html) ───────────────────────────
PAGES.profile = async function () {
  const me = Auth.current();
  const cat = me.cat;
  let avatarData = cat.avatarUrl || DEFAULT_AVATAR;

  const breedSel = $("#pf-breed");
  breedSel.innerHTML =
    `<option value="">— не указана —</option>` +
    (typeof BREEDS !== "undefined"
      ? BREEDS.map((b) => `<option value="${b.id}">${b.name}</option>`).join("")
      : "");

  $("#avPreview").src = avatarData;
  $("#pf-name").value = me.name;
  $("#pf-email").value = me.email;
  $("#pf-cat").value = cat.name || "";
  breedSel.value = cat.breedId != null ? String(cat.breedId) : "";
  $("#pf-sex").value = cat.sex || "";
  $("#pf-birth").value = cat.birthday || "";
  $("#pf-chip").value = cat.chip || "";

  const weights = await api("/weights");
  const w = latestWeightOf(weights);
  $("#pf-weight").innerHTML = w
    ? `<b>${w.kg} кг</b> <span class="muted">· ${fmtDate(w.date)}</span>`
    : `<span class="muted">не указан</span>`;

  const ageEl = $("#pf-age");
  const showAge = () => { const a = ageText($("#pf-birth").value || null); ageEl.textContent = a ? `· ${a}` : ""; };
  showAge();
  $("#pf-birth").addEventListener("change", showAge);

  $("#avFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    avatarData = await fileToDataURL(f);
    $("#avPreview").src = avatarData;
  });

  $("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    const breedVal = breedSel.value;
    try {
      await Auth.update({
        name: $("#pf-name").value.trim(),
        catName: $("#pf-cat").value.trim() || "Котик",
        avatarUrl: avatarData,
        breedId: breedVal ? Number(breedVal) : null,
        sex: $("#pf-sex").value || null,
        birthday: $("#pf-birth").value || null,
        chip: $("#pf-chip").value.trim(),
      });
      toast("Паспорт сохранён");
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      toast(err.message); btn.disabled = false;
    }
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

/* модалка общего назначения (календарь) */
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
