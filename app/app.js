const STORAGE_KEY = "small-habit-pieces-v1";
const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayKey = () => dateKey();

const categoryLabels = {
  health: "건강",
  mind: "마음",
  study: "공부",
  life: "생활",
};

const categorySymbols = {
  health: "⌁",
  mind: "♡",
  study: "◌",
  life: "✦",
};

const seedState = {
  habits: [
    {
      id: crypto.randomUUID(),
      name: "물 한 컵 마시기",
      micro: "컵을 눈에 보이는 곳에 두기",
      category: "health",
      time: "09:00",
      steps: ["컵 꺼내기", "물 따르기", "한 컵 마시기"],
      createdAt: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      name: "5분 스트레칭",
      micro: "매트 위에 앉기",
      category: "health",
      time: "18:30",
      steps: ["매트 펴기", "목 돌리기", "어깨와 허리 풀기"],
      createdAt: Date.now() + 1,
    },
    {
      id: crypto.randomUUID(),
      name: "하루 한 줄 기록",
      micro: "노트 앱 열기",
      category: "mind",
      time: "22:00",
      steps: ["노트 열기", "오늘 좋았던 일 떠올리기", "한 줄 쓰기"],
      createdAt: Date.now() + 2,
    },
  ],
  completions: {},
};

let state = loadState();
let currentView = "today";
let selectedHabitId = null;
let installPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const views = {
  today: $("#todayView"),
  habits: $("#habitsView"),
  add: $("#addView"),
  detail: $("#detailView"),
  stats: $("#statsView"),
};

const titles = {
  today: "작은 성공",
  habits: "내 습관",
  add: "새로운 작은 습관",
  detail: "작은 성공",
  stats: "나의 성장",
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState;
  try {
    const parsed = JSON.parse(raw);
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : seedState.habits,
      completions: parsed.completions || {},
    };
  } catch {
    return seedState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setView(view) {
  currentView = view;
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("is-visible", key === view);
  });
  $$(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === view);
  });
  $("#viewTitle").textContent = titles[view];
  render();
}

function render() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  renderToday();
  renderHabits();
  renderStats();
  if (currentView === "detail") renderDetail();
}

function getDoneSet(date = todayKey()) {
  return new Set(state.completions[date] || []);
}

function isDone(id, date = todayKey()) {
  return getDoneSet(date).has(id);
}

function toggleDone(id, sourceElement) {
  const date = todayKey();
  const done = getDoneSet(date);
  if (done.has(id)) {
    done.delete(id);
  } else {
    done.add(id);
    celebrate(sourceElement);
  }
  state.completions[date] = Array.from(done);
  saveState();
  render();
}

function renderToday() {
  const list = $("#todayList");
  const total = state.habits.length;
  const done = getDoneSet().size;
  const percent = total ? Math.round((done / total) * 100) : 0;

  $("#todayPercent").textContent = `${percent}%`;
  $("#ringText").textContent = `${percent}%`;
  $("#ringValue").style.strokeDashoffset = String(314 - (314 * percent) / 100);
  $("#todayMessage").textContent =
    percent === 100
      ? "오늘의 작은 조각을 모두 맞췄어요."
      : percent >= 50
        ? "좋은 흐름이에요. 조금만 더 가면 돼요."
        : "가장 쉬운 것 하나부터 시작해볼까요?";

  if (!total) {
    list.innerHTML = `<div class="empty-state">아직 습관이 없어요. 새 습관을 하나 만들어볼게요.</div>`;
    return;
  }

  list.innerHTML = state.habits
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((habit) => habitCardTemplate(habit, true))
    .join("");
}

function renderHabits() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const category = $("#categoryFilter").value;
  const habits = state.habits.filter((habit) => {
    const matchesQuery = `${habit.name} ${habit.micro}`.toLowerCase().includes(query);
    const matchesCategory = category === "all" || habit.category === category;
    return matchesQuery && matchesCategory;
  });

  $("#habitList").innerHTML = habits.length
    ? habits.map((habit) => habitCardTemplate(habit, false)).join("")
    : `<div class="empty-state">조건에 맞는 습관이 없어요.</div>`;
}

function habitCardTemplate(habit, compact) {
  const done = isDone(habit.id);
  return `
    <article class="habit-card ${done ? "is-done" : ""}">
      <button class="check-button ${done ? "is-done" : ""}" type="button" data-action="toggle" data-id="${habit.id}" aria-label="${habit.name} 완료">✓</button>
      <div>
        <span class="habit-icon">${categorySymbols[habit.category] || "•"}</span>
        <button class="text-button habit-title" type="button" data-action="detail" data-id="${habit.id}">${escapeHtml(habit.name)}</button>
        <div class="habit-meta">${habit.time} · ${categoryLabels[habit.category]} · ${escapeHtml(habit.micro)}</div>
      </div>
      ${
        compact
          ? `<span class="chip">${done ? "완료" : "대기"}</span>`
          : `<button class="icon-button" type="button" data-action="edit" data-id="${habit.id}" aria-label="수정">수정</button>`
      }
    </article>
  `;
}

function renderDetail() {
  const habit = state.habits.find((item) => item.id === selectedHabitId) || state.habits[0];
  selectedHabitId = habit?.id || null;
  const panel = $("#detailPanel");

  if (!habit) {
    panel.innerHTML = `<div class="empty-state">자세히 볼 습관이 없어요.</div>`;
    return;
  }

  panel.innerHTML = `
    <article class="detail-card">
      <div class="detail-title-row">
        <div>
          <p class="eyebrow">${categoryLabels[habit.category]} · ${habit.time}</p>
          <h2>${escapeHtml(habit.name)}</h2>
        </div>
        <span class="chip">${isDone(habit.id) ? "오늘 완료" : "오늘 대기"}</span>
      </div>
      <p>${escapeHtml(habit.micro)}</p>
      <ul class="step-list">
        ${habit.steps
          .map(
            (step, index) =>
              `<li><span class="step-number">${index + 1}</span><span>${escapeHtml(step)}</span><span class="step-check">⌄</span></li>`,
          )
          .join("")}
      </ul>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-view-target="habits">목록</button>
        <button class="secondary-button" type="button" data-action="edit" data-id="${habit.id}">수정</button>
        <button class="danger-button" type="button" data-action="delete" data-id="${habit.id}">삭제</button>
        <button class="primary-button" type="button" data-action="toggle" data-id="${habit.id}">${isDone(habit.id) ? "완료 취소" : "오늘 완료"}</button>
      </div>
    </article>
  `;
}

function renderStats() {
  const total = Object.values(state.completions).reduce((sum, ids) => sum + ids.length, 0);
  $("#streakStat").textContent = `${getStreak()}일`;
  $("#totalStat").textContent = `${total}회`;
  $("#habitStat").textContent = `${state.habits.length}개`;

  const days = getLastSevenDays();
  const max = Math.max(1, state.habits.length);
  $("#weekChart").innerHTML = days
    .map(({ key, label }) => {
      const count = (state.completions[key] || []).length;
      const height = 18 + (count / max) * 150;
      return `
        <div class="bar-wrap">
          <div class="bar" style="height:${height}px" title="${label} ${count}개"></div>
          <span class="bar-label">${label}</span>
        </div>
      `;
    })
    .join("");
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: dateKey(date),
      label: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date),
    };
  });
}

function getStreak() {
  let streak = 0;
  const total = state.habits.length;
  if (!total) return 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dateKey(date);
    if ((state.completions[key] || []).length >= total) streak += 1;
    else break;
  }
  return streak;
}

function resetForm() {
  $("#editingId").value = "";
  $("#habitForm").reset();
  $("#habitTime").value = "09:00";
  $("#cancelEdit").style.display = "none";
}

function editHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  $("#editingId").value = habit.id;
  $("#habitName").value = habit.name;
  $("#habitMicro").value = habit.micro;
  $("#habitCategory").value = habit.category;
  syncCategoryChoice(habit.category);
  $("#habitTime").value = habit.time;
  $("#habitSteps").value = habit.steps.join("\n");
  $("#cancelEdit").style.display = "inline-flex";
  setView("add");
}

function deleteHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  if (!confirm(`"${habit.name}" 습관을 삭제할까요?`)) return;
  state.habits = state.habits.filter((item) => item.id !== id);
  Object.keys(state.completions).forEach((date) => {
    state.completions[date] = state.completions[date].filter((habitId) => habitId !== id);
  });
  saveState();
  selectedHabitId = null;
  showToast("습관을 삭제했어요.");
  setView("habits");
}

function handleSubmit(event) {
  event.preventDefault();
  const id = $("#editingId").value;
  const steps = $("#habitSteps").value
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  const habit = {
    id: id || crypto.randomUUID(),
    name: $("#habitName").value.trim(),
    micro: $("#habitMicro").value.trim(),
    category: $("#habitCategory").value,
    time: $("#habitTime").value || "09:00",
    steps: steps.length ? steps : [$("#habitMicro").value.trim()],
    createdAt: id ? state.habits.find((item) => item.id === id)?.createdAt || Date.now() : Date.now(),
  };

  if (id) {
    state.habits = state.habits.map((item) => (item.id === id ? habit : item));
    showToast("습관을 수정했어요.");
  } else {
    state.habits.push(habit);
    showToast("새 습관을 추가했어요.");
  }
  saveState();
  resetForm();
  selectedHabitId = habit.id;
  setView("detail");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

function celebrate(sourceElement) {
  createBurst(sourceElement);
  showToast("좋아요. 오늘의 작은 조각 하나 완료");
}

function createBurst(sourceElement) {
  const rect = sourceElement?.getBoundingClientRect();
  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const colors = ["#cc785c", "#5db8a6", "#e8a55a", "#5db872"];

  Array.from({ length: 16 }, (_, index) => {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 16;
    const distance = 42 + Math.random() * 46;
    particle.className = "burst-particle";
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.background = colors[index % colors.length];
    particle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
    document.body.appendChild(particle);
    window.setTimeout(() => particle.remove(), 760);
    return particle;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view], [data-view-target]");
  if (viewButton) {
    const view = viewButton.dataset.view || viewButton.dataset.viewTarget;
    if (view === "add") resetForm();
    setView(view);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === "toggle") toggleDone(id, actionButton);
  if (action === "detail") {
    selectedHabitId = id;
    setView("detail");
  }
  if (action === "edit") editHabit(id);
  if (action === "delete") deleteHabit(id);
});

$("#habitForm").addEventListener("submit", handleSubmit);
$("#cancelEdit").addEventListener("click", () => {
  resetForm();
  setView("habits");
});
$("#searchInput").addEventListener("input", renderHabits);
$("#categoryFilter").addEventListener("change", renderHabits);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#installButton").hidden = false;
});

$("#installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#installButton").hidden = true;
});

  if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

function syncCategoryChoice(category) {
  $$("input[name='categoryChoice']").forEach((input) => {
    input.checked = input.value === category;
  });
}

$$("input[name='categoryChoice']").forEach((input) => {
  input.addEventListener("change", () => {
    $("#habitCategory").value = input.value;
  });
});

$("#habitCategory").addEventListener("change", () => {
  syncCategoryChoice($("#habitCategory").value);
});

resetForm();
setView("today");
