const STORAGE_KEY = "interior-coordinator-dojo-progress";

const state = {
  questions: [],
  filtered: [],
  currentIndex: 0,
  currentQuestionId: null,
  selectedOption: null,
  revealed: false,
  progress: {
    correctIds: [],
    incorrectIds: [],
    seenIds: [],
    bookmarks: [],
  },
};

const elements = {
  volumeFilter: document.querySelector("#volume-filter"),
  chapterFilter: document.querySelector("#chapter-filter"),
  modeFilter: document.querySelector("#mode-filter"),
  searchInput: document.querySelector("#search-input"),
  shuffleToggle: document.querySelector("#shuffle-toggle"),
  resetProgress: document.querySelector("#reset-progress"),
  heroQuestionCount: document.querySelector("#hero-question-count"),
  heroStudiedCount: document.querySelector("#hero-studied-count"),
  heroAccuracy: document.querySelector("#hero-accuracy"),
  positionLabel: document.querySelector("#position-label"),
  correctCount: document.querySelector("#correct-count"),
  incorrectCount: document.querySelector("#incorrect-count"),
  bookmarkCount: document.querySelector("#bookmark-count"),
  volumeBadge: document.querySelector("#volume-badge"),
  chapterBadge: document.querySelector("#chapter-badge"),
  examBadge: document.querySelector("#exam-badge"),
  bookmarkButton: document.querySelector("#bookmark-button"),
  questionId: document.querySelector("#question-id"),
  questionText: document.querySelector("#question-text"),
  options: document.querySelector("#options"),
  revealButton: document.querySelector("#reveal-button"),
  prevButton: document.querySelector("#prev-button"),
  nextButton: document.querySelector("#next-button"),
  answerPanel: document.querySelector("#answer-panel"),
  answerText: document.querySelector("#answer-text"),
  explanationText: document.querySelector("#explanation-text"),
  keywordsText: document.querySelector("#keywords-text"),
  filteredCount: document.querySelector("#filtered-count"),
  sourceLabel: document.querySelector("#source-label"),
  datasetStatus: document.querySelector("#dataset-status"),
};

function loadProgress() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    state.progress = {
      correctIds: parsed.correctIds ?? [],
      incorrectIds: parsed.incorrectIds ?? [],
      seenIds: parsed.seenIds ?? [],
      bookmarks: parsed.bookmarks ?? [],
    };
  } catch {
    state.progress = {
      correctIds: [],
      incorrectIds: [],
      seenIds: [],
      bookmarks: [],
    };
  }
}

function saveProgress() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function uniqueValues(items, selector) {
  return [...new Set(items.map(selector).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function createOption(parent, index, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option-button";
  button.dataset.index = String(index);
  button.textContent = `${index + 1}. ${text}`;
  button.addEventListener("click", () => handleOptionSelect(index));
  parent.append(button);
}

function setSelectOptions(select, values, allLabel) {
  const previousValue = select.value;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "all";
  defaultOption.textContent = allLabel;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });

  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function updateFilterOptions() {
  setSelectOptions(elements.volumeFilter, uniqueValues(state.questions, (item) => item.volume), "すべての巻");
  setSelectOptions(
    elements.chapterFilter,
    uniqueValues(state.questions, (item) => item.chapter),
    "すべての章"
  );
}

function questionMatchesFilters(question) {
  const volume = elements.volumeFilter.value;
  const chapter = elements.chapterFilter.value;
  const mode = elements.modeFilter.value;
  const search = elements.searchInput.value.trim().toLowerCase();

  if (volume !== "all" && question.volume !== volume) {
    return false;
  }
  if (chapter !== "all" && question.chapter !== chapter) {
    return false;
  }
  if (mode === "bookmarked" && !state.progress.bookmarks.includes(question.id)) {
    return false;
  }
  if (mode === "incorrect" && !state.progress.incorrectIds.includes(question.id)) {
    return false;
  }
  if (search) {
    const haystack = [question.prompt, question.answer_text, question.keywords, ...question.options]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }
  return true;
}

function applyFilters() {
  state.filtered = state.questions.filter(questionMatchesFilters);
  if (elements.shuffleToggle.checked) {
    state.filtered = [...state.filtered].sort(() => Math.random() - 0.5);
  }

  const currentIndex = state.filtered.findIndex((item) => item.id === state.currentQuestionId);
  state.currentIndex = currentIndex >= 0 ? currentIndex : 0;

  if (!state.filtered.length) {
    renderEmptyState();
    updateMetrics();
    return;
  }

  state.currentQuestionId = state.filtered[state.currentIndex].id;
  renderCurrentQuestion();
  updateMetrics();
}

function addUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function markSeen(questionId) {
  addUnique(state.progress.seenIds, questionId);
  saveProgress();
}

function handleOptionSelect(index) {
  if (!state.filtered.length) {
    return;
  }
  state.selectedOption = index;
  state.revealed = true;

  const question = state.filtered[state.currentIndex];
  markSeen(question.id);

  if (question.answer_index === index) {
    addUnique(state.progress.correctIds, question.id);
    state.progress.incorrectIds = state.progress.incorrectIds.filter((id) => id !== question.id);
  } else {
    addUnique(state.progress.incorrectIds, question.id);
    state.progress.correctIds = state.progress.correctIds.filter((id) => id !== question.id);
  }

  saveProgress();
  renderCurrentQuestion();
  updateMetrics();
}

function revealAnswer() {
  if (!state.filtered.length) {
    return;
  }
  state.revealed = true;
  markSeen(state.filtered[state.currentIndex].id);
  renderCurrentQuestion();
  updateMetrics();
}

function toggleBookmark() {
  if (!state.filtered.length) {
    return;
  }
  const { id } = state.filtered[state.currentIndex];
  if (state.progress.bookmarks.includes(id)) {
    state.progress.bookmarks = state.progress.bookmarks.filter((item) => item !== id);
  } else {
    state.progress.bookmarks.push(id);
  }
  saveProgress();
  renderCurrentQuestion();
  updateMetrics();
}

function moveQuestion(direction) {
  if (!state.filtered.length) {
    return;
  }
  const nextIndex = state.currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.filtered.length) {
    return;
  }
  state.currentIndex = nextIndex;
  state.currentQuestionId = state.filtered[state.currentIndex].id;
  state.selectedOption = null;
  state.revealed = false;
  renderCurrentQuestion();
  updateMetrics();
}

function renderOptionStates(question) {
  [...elements.options.children].forEach((button) => {
    const index = Number(button.dataset.index);
    button.classList.toggle("selected", state.selectedOption === index);
    button.classList.toggle("correct", state.revealed && question.answer_index === index);
    button.classList.toggle(
      "incorrect",
      state.revealed && state.selectedOption === index && question.answer_index !== index
    );
  });
}

function renderCurrentQuestion() {
  const question = state.filtered[state.currentIndex];
  if (!question) {
    renderEmptyState();
    return;
  }

  elements.volumeBadge.textContent = question.volume || "巻不明";
  elements.chapterBadge.textContent = question.chapter || "章不明";
  elements.examBadge.textContent =
    question.exam_year && question.exam_round
      ? `${question.exam_year}年 第${question.exam_round}問`
      : `設問 ${question.blank_label}`;
  elements.questionId.textContent =
    question.set_number != null ? `問題 ${question.set_number}-${question.blank_label}` : question.id;
  elements.questionText.textContent = question.prompt;
  elements.sourceLabel.textContent = `${question.source_pdf} / p.${question.source_page}`;

  elements.options.innerHTML = "";
  question.options.forEach((option, index) => createOption(elements.options, index, option));
  renderOptionStates(question);

  elements.answerText.textContent = question.answer_text ?? "OCR確認待ち";
  elements.explanationText.textContent = question.explanation || "解説はまだ整形されていません。";
  elements.keywordsText.textContent = question.keywords || "補足情報はありません。";
  elements.answerPanel.classList.toggle("hidden", !state.revealed);

  const isBookmarked = state.progress.bookmarks.includes(question.id);
  elements.bookmarkButton.textContent = isBookmarked ? "★ 保存済み" : "☆ 保存";
}

function renderEmptyState() {
  elements.volumeBadge.textContent = "-";
  elements.chapterBadge.textContent = "条件に一致する問題がありません";
  elements.examBadge.textContent = "-";
  elements.questionId.textContent = "-";
  elements.questionText.textContent = "絞り込み条件を変更してください。";
  elements.options.innerHTML = "";
  elements.answerPanel.classList.add("hidden");
  elements.sourceLabel.textContent = "-";
}

function updateMetrics() {
  const studied = state.progress.seenIds.length;
  const correct = state.progress.correctIds.length;
  const incorrect = state.progress.incorrectIds.length;
  const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;

  elements.heroQuestionCount.textContent = String(state.questions.length);
  elements.heroStudiedCount.textContent = String(studied);
  elements.heroAccuracy.textContent = `${accuracy}%`;
  elements.correctCount.textContent = String(correct);
  elements.incorrectCount.textContent = String(incorrect);
  elements.bookmarkCount.textContent = String(state.progress.bookmarks.length);
  elements.filteredCount.textContent = String(state.filtered.length);
  elements.positionLabel.textContent = state.filtered.length
    ? `${state.currentIndex + 1} / ${state.filtered.length}`
    : "-";
}

function attachEvents() {
  [
    elements.volumeFilter,
    elements.chapterFilter,
    elements.modeFilter,
    elements.searchInput,
    elements.shuffleToggle,
  ].forEach((element) => element.addEventListener("input", applyFilters));

  elements.revealButton.addEventListener("click", revealAnswer);
  elements.prevButton.addEventListener("click", () => moveQuestion(-1));
  elements.nextButton.addEventListener("click", () => moveQuestion(1));
  elements.bookmarkButton.addEventListener("click", toggleBookmark);
  elements.resetProgress.addEventListener("click", () => {
    if (!window.confirm("学習記録をリセットしますか？")) {
      return;
    }
    state.progress = { correctIds: [], incorrectIds: [], seenIds: [], bookmarks: [] };
    saveProgress();
    updateMetrics();
    renderCurrentQuestion();
  });
}

async function loadQuestions() {
  const response = await fetch("./data/questions.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load questions.json: ${response.status}`);
  }
  const payload = await response.json();
  state.questions = payload.questions ?? [];
  elements.datasetStatus.textContent = `${state.questions.length}問を読み込み`;
}

async function start() {
  loadProgress();
  attachEvents();

  try {
    await loadQuestions();
    updateFilterOptions();
    state.currentQuestionId = state.questions[0]?.id ?? null;
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.datasetStatus.textContent = "データ読み込み失敗";
    renderEmptyState();
  }
}

start();
