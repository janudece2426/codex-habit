const STORAGE_KEY = "small-habit-pieces-v1";
const SYNC_KEY_STORAGE = "small-habit-pieces-sync-key";
const SYNC_TABLE = "habit_sync_states";
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
  partialCompletions: {},
};

let state = loadState();
let currentView = "today";
let selectedHabitId = null;
let installPrompt = null;
let syncKey = localStorage.getItem(SYNC_KEY_STORAGE) || "";
let remoteUpdatedAt = "";
let syncTimer = null;
let isSyncing = false;

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
      partialCompletions: parsed.partialCompletions || {},
    };
  } catch {
    return seedState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
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
  updateSyncUi();
}

function getDoneSet(date = todayKey()) {
  return new Set(state.completions[date] || []);
}

function getPartialSet(date = todayKey()) {
  return new Set(state.partialCompletions?.[date] || []);
}

function isDone(id, date = todayKey()) {
  return getDoneSet(date).has(id);
}

function isPartial(id, date = todayKey()) {
  return getPartialSet(date).has(id);
}

function getHabitCredit(id, date = todayKey()) {
  if (isDone(id, date)) return 1;
  if (isPartial(id, date)) return 0.5;
  return 0;
}

function getDayScore(date = todayKey()) {
  return state.habits.reduce((sum, habit) => sum + getHabitCredit(habit.id, date), 0);
}

function toggleDone(id, sourceElement) {
  const date = todayKey();
  const done = getDoneSet(date);
  const partial = getPartialSet(date);
  if (done.has(id)) {
    done.delete(id);
  } else {
    done.add(id);
    partial.delete(id);
    celebrate(sourceElement);
  }
  state.completions[date] = Array.from(done);
  state.partialCompletions[date] = Array.from(partial);
  saveState();
  render();
}

function togglePartial(id, sourceElement) {
  const date = todayKey();
  const done = getDoneSet(date);
  const partial = getPartialSet(date);
  if (partial.has(id)) {
    partial.delete(id);
  } else {
    partial.add(id);
    done.delete(id);
    showToast("좋아. 반만큼 해낸 것도 기록했어요.");
    createBurst(sourceElement, 8);
  }
  state.completions[date] = Array.from(done);
  state.partialCompletions[date] = Array.from(partial);
  saveState();
  render();
}

function renderToday() {
  const list = $("#todayList");
  const total = state.habits.length;
  const score = getDayScore();
  const doneCount = state.habits.filter((habit) => isDone(habit.id)).length;
  const partialCount = state.habits.filter((habit) => isPartial(habit.id)).length;
  const remainingCount = Math.max(0, total - doneCount - partialCount);
  const percent = total ? Math.round((score / total) * 100) : 0;

  $("#todayPercent").textContent = `${percent}%`;
  $("#ringText").textContent = `${percent}%`;
  $("#ringValue").style.strokeDashoffset = String(314 - (314 * percent) / 100);
  $("#todayScoreText").textContent = `${formatScore(score)} / ${total}`;
  $("#doneCountText").textContent = doneCount;
  $("#partialCountText").textContent = partialCount;
  $("#remainingCountText").textContent = remainingCount;
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
  const partial = isPartial(habit.id);
  const status = done ? "완료" : partial ? "반달성" : "대기";
  return `
    <article class="habit-card ${done ? "is-done" : ""} ${partial ? "is-partial" : ""}">
      <div class="habit-actions">
        <button class="check-button ${done ? "is-done" : ""}" type="button" data-action="toggle" data-id="${habit.id}" aria-label="${habit.name} 완료">✓</button>
        <button class="partial-button ${partial ? "is-partial" : ""}" type="button" data-action="partial" data-id="${habit.id}" aria-label="${habit.name} 반달성">◐</button>
      </div>
      <div>
        <span class="habit-icon">${categorySymbols[habit.category] || "•"}</span>
        <button class="text-button habit-title" type="button" data-action="detail" data-id="${habit.id}">${escapeHtml(habit.name)}</button>
        <div class="habit-meta">${habit.time} · ${categoryLabels[habit.category]} · ${escapeHtml(habit.micro)}</div>
      </div>
      ${
        compact
          ? `<span class="chip ${partial ? "is-partial" : ""}">${status}</span>`
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
        <span class="chip ${isPartial(habit.id) ? "is-partial" : ""}">${isDone(habit.id) ? "오늘 완료" : isPartial(habit.id) ? "오늘 반달성" : "오늘 대기"}</span>
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
        <button class="secondary-button" type="button" data-action="partial" data-id="${habit.id}">${isPartial(habit.id) ? "반달성 취소" : "반만 달성"}</button>
        <button class="primary-button" type="button" data-action="toggle" data-id="${habit.id}">${isDone(habit.id) ? "완료 취소" : "오늘 완료"}</button>
      </div>
    </article>
  `;
}

function renderStats() {
  const dates = new Set([...Object.keys(state.completions), ...Object.keys(state.partialCompletions || {})]);
  const total = Array.from(dates).reduce((sum, date) => sum + getDayScore(date), 0);
  $("#streakStat").textContent = `${getStreak()}일`;
  $("#totalStat").textContent = `${formatScore(total)}점`;
  $("#habitStat").textContent = `${state.habits.length}개`;

  const { days, year, month } = getCurrentMonthDays();
  const max = Math.max(1, state.habits.length);
  $("#monthChartTitle").textContent = `${month}월 흐름`;
  $("#monthChart").style.setProperty("--month-days", days.length);
  $("#monthChart").innerHTML = days
    .map(({ key, label, isToday, isFuture }) => {
      const count = getDayScore(key);
      const height = isFuture ? 8 : 18 + (count / max) * 150;
      const isFiveDayMark = label % 5 === 0;
      return `
        <div class="bar-wrap ${isToday ? "is-today" : ""} ${isFuture ? "is-future" : ""} ${isFiveDayMark ? "is-five-day-mark" : ""}">
          <div class="bar" style="height:${height}px" title="${month}월 ${label}일 ${formatScore(count)}점"></div>
          <span class="bar-label">${label}</span>
        </div>
      `;
    })
    .join("");

  const elapsedDays = days.filter(({ isFuture }) => !isFuture);
  const currentScore = elapsedDays.reduce((sum, { key }) => sum + getDayScore(key), 0);
  const previousScore = getPreviousMonthScore(year, month, elapsedDays.length);
  const growth = previousScore ? Math.round(((currentScore - previousScore) / previousScore) * 100) : null;
  const growthElement = $("#monthlyGrowth");
  growthElement.textContent = growth === null ? "지난달 기록 없음" : `${growth >= 0 ? "+" : ""}${growth}%`;
  growthElement.classList.toggle("is-negative", growth !== null && growth < 0);
}

function getCurrentMonthDays() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const todayDate = today.getDate();
  const dayCount = new Date(year, month, 0).getDate();
  return {
    year,
    month,
    days: Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        key: dateKey(date),
        label: index + 1,
        isToday: index + 1 === todayDate,
        isFuture: index + 1 > todayDate,
      };
    }),
  };
}

function getPreviousMonthScore(year, month, dayCount) {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, month - 2, index + 1);
    return date.getMonth() === (month + 10) % 12 ? getDayScore(dateKey(date)) : 0;
  }).reduce((sum, score) => sum + score, 0);
}

function getStreak() {
  let streak = 0;
  const total = state.habits.length;
  if (!total) return 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dateKey(date);
    if (getDayScore(key) >= total) streak += 1;
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
  Object.keys(state.partialCompletions || {}).forEach((date) => {
    state.partialCompletions[date] = state.partialCompletions[date].filter((habitId) => habitId !== id);
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

function getSyncConfig() {
  const config = window.HABIT_SYNC_CONFIG || {};
  return {
    url: String(config.supabaseUrl || "").replace(/\/$/, ""),
    anonKey: String(config.supabaseAnonKey || ""),
  };
}

function isCloudConfigured() {
  const { url, anonKey } = getSyncConfig();
  return Boolean(url && anonKey);
}

function getSyncHeaders(extra = {}) {
  const { anonKey } = getSyncConfig();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    ...extra,
  };
}

function getSyncEndpoint(key = syncKey) {
  const { url } = getSyncConfig();
  return `${url}/rest/v1/${SYNC_TABLE}?sync_key=eq.${encodeURIComponent(key)}`;
}

function getSyncUpsertEndpoint() {
  const { url } = getSyncConfig();
  return `${url}/rest/v1/${SYNC_TABLE}?on_conflict=sync_key`;
}

function normalizeRemotePayload(payload) {
  return {
    habits: Array.isArray(payload?.habits) ? payload.habits : [],
    completions: payload?.completions && typeof payload.completions === "object" ? payload.completions : {},
    partialCompletions:
      payload?.partialCompletions && typeof payload.partialCompletions === "object" ? payload.partialCompletions : {},
  };
}

async function fetchCloudState(key = syncKey) {
  if (!isCloudConfigured() || !key) return null;
  const response = await fetch(`${getSyncEndpoint(key)}&select=payload,updated_at`, {
    headers: getSyncHeaders(),
  });
  if (!response.ok) throw new Error("동기화 데이터를 불러오지 못했어요.");
  const rows = await response.json();
  if (!rows.length) return null;
  return {
    payload: normalizeRemotePayload(rows[0].payload),
    updatedAt: rows[0].updated_at || "",
  };
}

async function pushCloudState() {
  if (!isCloudConfigured() || !syncKey || isSyncing) return;
  isSyncing = true;
  updateSyncUi("동기화 중");
  try {
    const response = await fetch(getSyncUpsertEndpoint(), {
      method: "POST",
      headers: getSyncHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify({
        sync_key: syncKey,
        payload: state,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) throw new Error("동기화 저장에 실패했어요.");
    const rows = await response.json();
    remoteUpdatedAt = rows[0]?.updated_at || new Date().toISOString();
    updateSyncUi("동기화됨");
  } catch (error) {
    updateSyncUi("동기화 실패");
    showToast(error.message);
  } finally {
    isSyncing = false;
  }
}

function scheduleCloudSave() {
  if (!isCloudConfigured() || !syncKey) {
    updateSyncUi();
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushCloudState, 500);
}

function generateSyncKey() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

async function connectSyncKey(key) {
  const nextKey = key.trim();
  if (!nextKey) {
    showToast("동기화 코드를 입력해줘.");
    return;
  }
  if (!isCloudConfigured()) {
    showToast("Supabase 설정을 먼저 넣어야 해요.");
    updateSyncUi();
    return;
  }

  try {
    const remote = await fetchCloudState(nextKey);
    syncKey = nextKey;
    localStorage.setItem(SYNC_KEY_STORAGE, syncKey);
    $("#syncKeyInput").value = syncKey;

    if (remote) {
      state = remote.payload;
      remoteUpdatedAt = remote.updatedAt;
      saveState();
      render();
      showToast("동기화 데이터를 불러왔어요.");
    } else {
      await pushCloudState();
      showToast("새 동기화 공간을 만들었어요.");
    }
    updateSyncUi();
  } catch (error) {
    showToast(error.message);
    updateSyncUi("연결 실패");
  }
}

async function pullCloudState() {
  if (!syncKey) {
    showToast("먼저 동기화 코드를 연결해줘.");
    return;
  }
  try {
    const remote = await fetchCloudState(syncKey);
    if (!remote) {
      showToast("아직 저장된 동기화 데이터가 없어요.");
      return;
    }
    state = remote.payload;
    remoteUpdatedAt = remote.updatedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    showToast("클라우드 기록을 불러왔어요.");
  } catch (error) {
    showToast(error.message);
  }
}

function updateSyncUi(status = "") {
  const button = $("#syncButton");
  const statusText = $("#syncStatus");
  const input = $("#syncKeyInput");
  if (!button || !statusText || !input) return;

  input.value = syncKey;
  button.classList.toggle("is-connected", Boolean(syncKey && isCloudConfigured()));

  if (!isCloudConfigured()) {
    button.textContent = "동기화 설정";
    statusText.textContent = "Supabase URL과 anon key를 config.js에 넣으면 PC와 폰을 연결할 수 있어요.";
    return;
  }

  if (!syncKey) {
    button.textContent = "동기화";
    statusText.textContent = "새 코드를 만들거나, 다른 기기에서 만든 코드를 입력해줘.";
    return;
  }

  button.textContent = "동기화됨";
  const time = remoteUpdatedAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(remoteUpdatedAt)) : "";
  statusText.textContent = status ? `${status}${time ? ` · ${time}` : ""}` : `연결된 코드로 기록을 맞추고 있어요${time ? ` · ${time}` : ""}.`;
}

function celebrate(sourceElement) {
  createBurst(sourceElement);
  showToast("좋아요. 오늘의 작은 조각 하나 완료");
}

function createBurst(sourceElement, particleCount = 16) {
  const rect = sourceElement?.getBoundingClientRect();
  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const colors = ["#cc785c", "#5db8a6", "#e8a55a", "#5db872"];

  Array.from({ length: particleCount }, (_, index) => {
    const particle = document.createElement("span");
    const angle = (Math.PI * 2 * index) / particleCount;
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

function formatScore(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
  if (action === "partial") togglePartial(id, actionButton);
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

$("#syncButton").addEventListener("click", () => {
  $("#syncDialog").showModal();
  updateSyncUi();
});

$("#createSyncKey").addEventListener("click", async () => {
  const nextKey = generateSyncKey();
  $("#syncKeyInput").value = nextKey;
  await connectSyncKey(nextKey);
});

$("#connectSyncKey").addEventListener("click", async () => {
  await connectSyncKey($("#syncKeyInput").value);
});

$("#copySyncKey").addEventListener("click", async () => {
  if (!syncKey) {
    showToast("복사할 동기화 코드가 없어요.");
    return;
  }
  try {
    await navigator.clipboard.writeText(syncKey);
    showToast("동기화 코드를 복사했어요.");
  } catch {
    $("#syncKeyInput").select();
    showToast("코드를 선택했어요. 직접 복사해줘.");
  }
});

$("#pullSyncNow").addEventListener("click", pullCloudState);

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

async function initSync() {
  updateSyncUi();
  if (!isCloudConfigured() || !syncKey) return;
  await pullCloudState();
}

resetForm();
setView("today");
initSync();
