const translations = {
  en: {
    eyebrow: "Welcome to our wedding",
    title: "Find your place",
    intro: "Enter your name below and we’ll guide you to your table.",
    searchLabel: "Your name",
    searchPlaceholder: "Start typing your name…",
    reveal: "Find my table",
    searchAgain: "Search another name",
    cantFind: "I cannot find my name",
    emptyHint: "Your table will appear here",
    chartEyebrow: "Guest directory",
    chartTitle: "Seating chart",
    chartIntro: "Names are listed alphabetically by last name.",
    guestColumn: "Guest",
    tableColumn: "Table",
    welcome: "Welcome",
    tableIs: "Your table is",
    resultNote: "Please look for this number at the reception.",
    chooseName: "Please choose your name from the suggestions.",
    matchCount: count => `${count} ${count === 1 ? "match" : "matches"} found`,
    suggestions: count => `${count} close ${count === 1 ? "match" : "matches"} found`,
    noMatches: "No close matches yet"
  },
  zh: {
    eyebrow: "欢迎参加我们的婚礼",
    title: "寻找您的座位",
    intro: "请在下方输入您的姓名，我们将为您显示桌号。",
    searchLabel: "您的姓名",
    searchPlaceholder: "请输入您的姓名…",
    reveal: "查找我的桌号",
    searchAgain: "查询另一个姓名",
    cantFind: "找不到我的名字",
    emptyHint: "您的桌号将在这里显示",
    chartEyebrow: "宾客名单",
    chartTitle: "座位表",
    chartIntro: "宾客姓名按姓氏字母顺序排列。",
    guestColumn: "宾客",
    tableColumn: "桌号",
    welcome: "欢迎",
    tableIs: "您的桌号是",
    resultNote: "请在宴会厅寻找此桌号。",
    chooseName: "请从建议列表中选择您的姓名。",
    matchCount: count => `找到 ${count} 个结果`,
    suggestions: count => `找到 ${count} 个相近结果`,
    noMatches: "暂未找到相近结果"
  },
  nl: {
    eyebrow: "Welkom op onze bruiloft",
    title: "Vind je plek",
    intro: "Vul hieronder je naam in en wij wijzen je de weg naar je tafel.",
    searchLabel: "Je naam",
    searchPlaceholder: "Begin je naam te typen…",
    reveal: "Vind mijn tafel",
    searchAgain: "Zoek een andere naam",
    cantFind: "Ik kan mijn naam niet vinden",
    emptyHint: "Je tafel verschijnt hier",
    chartEyebrow: "Gastenlijst",
    chartTitle: "Tafelindeling",
    chartIntro: "De namen staan alfabetisch op achternaam.",
    guestColumn: "Gast",
    tableColumn: "Tafel",
    welcome: "Welkom",
    tableIs: "Je tafel is",
    resultNote: "Zoek dit nummer bij de receptie.",
    chooseName: "Kies je naam uit de suggesties.",
    matchCount: count => `${count} ${count === 1 ? "resultaat" : "resultaten"} gevonden`,
    suggestions: count => `${count} ${count === 1 ? "vergelijkbaar resultaat" : "vergelijkbare resultaten"} gevonden`,
    noMatches: "Nog geen vergelijkbare resultaten"
  }
};

let guests = [];
let currentLanguage = "en";
let activeSuggestion = -1;
let currentMatches = [];
let selectedGuest = null;

const searchInput = document.querySelector("#guest-search");
const suggestions = document.querySelector("#suggestions");
const searchStatus = document.querySelector("#search-status");
const matchCount = document.querySelector("#match-count");
const clearButton = document.querySelector("#clear-search");
const searchForm = document.querySelector("#search-form");
const envelope = document.querySelector("#envelope");
const envelopeBack = document.querySelector(".envelope-back");
const revealButton = document.querySelector("#reveal-button");
const searchAgainButton = document.querySelector("#search-again");
const cardGuestName = document.querySelector("#card-guest-name");
const cardTableNumber = document.querySelector("#card-table-number");
const dialog = document.querySelector("#seating-dialog");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }

  const headers = rows.shift().map(header => header.trim());
  return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

function guestScore(guest, rawQuery) {
  const query = normalize(rawQuery);
  const fullName = normalize(`${guest.first_name} ${guest.last_name}`);
  const reverseName = normalize(`${guest.last_name} ${guest.first_name}`);
  const terms = [fullName, reverseName, normalize(guest.first_name), normalize(guest.last_name), ...guest.aliases.split("|").map(normalize)].filter(Boolean);

  if (terms.some(term => term === query)) return 0;
  if (terms.some(term => term.startsWith(query))) return 1;
  if (terms.some(term => term.includes(query))) return 2;

  const queryWords = query.split(" ");
  if (queryWords.every(word => terms.some(term => term.split(" ").some(part => part.startsWith(word))))) return 3;

  const closest = Math.min(...terms.map(term => levenshtein(query, term)));
  const allowed = query.length <= 4 ? 1 : query.length <= 8 ? 2 : 3;
  return closest <= allowed ? 4 + closest / 10 : Infinity;
}

function findMatches(query) {
  if (!normalize(query)) return [];
  return guests
    .map(guest => ({ guest, score: guestScore(guest, query) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.guest.last_name.localeCompare(b.guest.last_name))
    .slice(0, 6)
    .map(item => item.guest);
}

function renderSuggestions() {
  currentMatches = findMatches(searchInput.value);
  matchCount.textContent = translations[currentLanguage].matchCount(currentMatches.length);
  matchCount.classList.toggle("is-visible", Boolean(searchInput.value.trim()));
  activeSuggestion = -1;
  suggestions.innerHTML = "";

  if (!searchInput.value.trim() || currentMatches.length === 0) {
    suggestions.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    if (searchInput.value.trim()) searchStatus.textContent = translations[currentLanguage].noMatches;
    return;
  }

  currentMatches.forEach((guest, index) => {
    const item = document.createElement("li");
    item.setAttribute("role", "option");
    item.id = `suggestion-${index}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-button";
    button.innerHTML = `<span class="suggestion-name">${escapeHTML(guest.first_name)} ${escapeHTML(guest.last_name)}</span><span class="suggestion-hint">${escapeHTML(guest.aliases.split("|")[0] || "")}</span>`;
    button.addEventListener("click", () => selectGuest(guest));
    item.appendChild(button);
    suggestions.appendChild(item);
  });

  suggestions.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchStatus.textContent = translations[currentLanguage].suggestions(currentMatches.length);
}

function escapeHTML(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function selectGuest(guest) {
  selectedGuest = guest;
  searchInput.value = `${guest.first_name} ${guest.last_name}`;
  clearButton.classList.add("is-visible");
  suggestions.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  matchCount.textContent = translations[currentLanguage].matchCount(1);
  matchCount.classList.add("is-visible");
  searchStatus.textContent = "";
}

function renderCard() {
  if (!selectedGuest) return;
  cardGuestName.textContent = `${selectedGuest.first_name} ${selectedGuest.last_name}`;
  cardTableNumber.textContent = selectedGuest.table;
  document.querySelectorAll("[data-card-i18n]").forEach(element => {
    element.textContent = translations[currentLanguage][element.dataset.cardI18n];
  });
}

function revealGuest() {
  if (!selectedGuest) return;
  renderCard();
  suggestions.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.disabled = true;
  revealButton.disabled = true;
  searchForm.setAttribute("aria-hidden", "true");
  envelopeBack.setAttribute("aria-hidden", "false");
  envelope.classList.add("is-opening");
  searchAgainButton.hidden = false;
  searchStatus.textContent = "";
}

function resetEnvelope() {
  envelope.classList.remove("is-opening");
  envelopeBack.setAttribute("aria-hidden", "true");
  searchAgainButton.hidden = true;
  searchForm.setAttribute("aria-hidden", "false");
  searchInput.disabled = false;
  revealButton.disabled = false;
  searchInput.value = "";
  selectedGuest = null;
  currentMatches = [];
  matchCount.textContent = translations[currentLanguage].matchCount(0);
  matchCount.classList.remove("is-visible");
  clearButton.classList.remove("is-visible");
  suggestions.hidden = true;
  searchStatus.textContent = "";
  window.setTimeout(() => searchInput.focus(), 800);
}

function renderSeatingChart() {
  const sorted = [...guests].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  document.querySelector("#seating-list").innerHTML = sorted
    .map(guest => `<tr><td>${escapeHTML(guest.first_name)} ${escapeHTML(guest.last_name)}</td><td>${escapeHTML(guest.table)}</td></tr>`)
    .join("");
}

function setLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language === "zh" ? "zh-Hans" : language;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = translations[language][element.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    element.placeholder = translations[language][element.dataset.i18nPlaceholder];
  });
  document.querySelectorAll(".language-button").forEach(button => button.classList.toggle("is-active", button.dataset.lang === language));
  matchCount.textContent = translations[language].matchCount(currentMatches.length);
  renderCard();
  localStorage.setItem("wedding-language", language);
}

searchInput.addEventListener("input", () => {
  selectedGuest = null;
  matchCount.textContent = translations[currentLanguage].matchCount(0);
  clearButton.classList.toggle("is-visible", Boolean(searchInput.value));
  searchStatus.textContent = "";
  renderSuggestions();
});

searchInput.addEventListener("keydown", event => {
  if (suggestions.hidden || !currentMatches.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeSuggestion = (activeSuggestion + direction + currentMatches.length) % currentMatches.length;
    document.querySelectorAll(".suggestion-button").forEach((button, index) => button.classList.toggle("is-active", index === activeSuggestion));
    searchInput.setAttribute("aria-activedescendant", `suggestion-${activeSuggestion}`);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (activeSuggestion >= 0) selectGuest(currentMatches[activeSuggestion]);
    else if (currentMatches.length === 1) selectGuest(currentMatches[0]);
    searchForm.requestSubmit();
  } else if (event.key === "Escape") {
    suggestions.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
  }
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  selectedGuest = null;
  currentMatches = [];
  matchCount.textContent = translations[currentLanguage].matchCount(0);
  matchCount.classList.remove("is-visible");
  clearButton.classList.remove("is-visible");
  suggestions.hidden = true;
  searchStatus.textContent = "";
  searchInput.focus();
});

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!selectedGuest) {
    const exactMatch = findMatches(searchInput.value).find(guest => guestScore(guest, searchInput.value) === 0);
    if (exactMatch) selectGuest(exactMatch);
  }
  if (!selectedGuest) {
    renderSuggestions();
    searchStatus.textContent = translations[currentLanguage].chooseName;
    return;
  }
  revealGuest();
});

document.querySelectorAll(".language-button").forEach(button => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
searchAgainButton.addEventListener("click", resetEnvelope);
document.querySelector("#open-chart").addEventListener("click", () => dialog.showModal());
document.querySelector("#close-chart").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

fetch("guests.csv")
  .then(response => {
    if (!response.ok) throw new Error("Could not load guests.csv");
    return response.text();
  })
  .then(text => {
    guests = parseCSV(text);
    renderSeatingChart();
  })
  .catch(error => {
    console.error(error);
    searchInput.disabled = true;
    searchInput.placeholder = "Guest list unavailable";
  });

const savedLanguage = localStorage.getItem("wedding-language");
setLanguage(Object.hasOwn(translations, savedLanguage) ? savedLanguage : "en");
