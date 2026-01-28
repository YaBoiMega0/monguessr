// src/select.ts
var MODE_STANDARD = "standard";
var MODE_ENDLESS = "endless";
var MODE_CUSTOM = "custom";
var DEFAULT_ROUNDS = 5;
var DEFAULT_HEALTH = 5000;
var currentMode = MODE_STANDARD;
var selectedDifficulty = "easy";
var isAllSelected = false;
var modeTabs = document.querySelectorAll(".mode-tab");
var panelPrimaryTitle = document.getElementById("panelPrimaryTitle");
var panelPrimarySubtitle = document.getElementById("panelPrimarySubtitle");
var previewText = document.getElementById("previewText");
var difficultyChips = document.querySelectorAll(".difficulty-chip");
var tagChips = document.querySelectorAll(".tag-chip");
var customSettings = document.querySelectorAll(".setting-pill");
var customGamemode = document.getElementById("customGamemode");
var customTimer = document.getElementById("customTimer");
var customRounds = document.getElementById("customRounds");
var customHealth = document.getElementById("customHealth");
var customPanel = document.getElementById("customPanel");
var standardPanel = document.getElementById("standardPanel");
var startBtn = document.getElementById("startBtn");
var allToggleBtn = document.getElementById("allToggle");
var tagsList = document.getElementById("tags-list");
function updateModeUI() {
  modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === currentMode);
  });
  if (currentMode === MODE_STANDARD) {
    panelPrimaryTitle.textContent = "Standard mode";
    panelPrimarySubtitle.textContent = "5 rounds | Get the highest score";
    customPanel.hidden = true;
    standardPanel.hidden = false;
  } else if (currentMode === MODE_ENDLESS) {
    panelPrimaryTitle.textContent = "Endless mode";
    panelPrimarySubtitle.textContent = "Health-based run | Survive as long as you can";
    customPanel.hidden = true;
    standardPanel.hidden = false;
  } else if (currentMode === MODE_CUSTOM) {
    standardPanel.hidden = true;
    customPanel.hidden = false;
    updateCustomUI();
  }
  updatePreviewText();
}
function updateCustomUI() {
  if (currentMode != MODE_CUSTOM) {
    return;
  }
  const gamemode = customGamemode.value;
  let roundsPanel = document.getElementById("numRounds");
  let healthPanel = document.getElementById("startHealth");
  if (gamemode === "standard") {
    healthPanel.style.display = "none";
    roundsPanel.style.display = "flex";
  } else if (gamemode === "endless") {
    roundsPanel.style.display = "none";
    healthPanel.style.display = "flex";
  }
  updatePreviewText();
}
function updatePreviewText() {
  const parts = [];
  if (currentMode === MODE_STANDARD) {
    parts.push("Mode: Standard");
    parts.push(`Difficulty: ${capitalize(selectedDifficulty)}`);
  } else if (currentMode === MODE_ENDLESS) {
    parts.push("Mode: Endless");
    parts.push(`Difficulty: ${capitalize(selectedDifficulty)}`);
  } else if (currentMode === MODE_CUSTOM) {
    parts.push("Mode: Custom");
    const difficultyTags = getSelectedTags("difficulty");
    const locationTags = getSelectedTags("location");
    const gamemode = customGamemode.value;
    let roundsValue = DEFAULT_ROUNDS;
    let healthValue = DEFAULT_HEALTH;
    try {
      roundsValue = Number(customRounds.value);
    } catch (error) {}
    try {
      healthValue = Number(customHealth.value);
    } catch (error) {}
    const timerValue = Number(customTimer.value || 0);
    parts.push("Difficulties: " + (difficultyTags.length ? difficultyTags.join(", ") : "none"));
    parts.push("Tags: " + (isAllSelected ? "All" : locationTags.length ? locationTags.join(", ") : "none"));
    parts.push(`Gamemode: ${capitalize(gamemode)}`);
    parts.push(`${gamemode === "standard" ? `Rounds: ${Math.max(1, roundsValue)}` : `Health: ${Math.max(1, healthValue)}`}`);
    parts.push(`Timer: ${timerValue > 0 ? timerValue + "s" : "no limit"}`);
  }
  let message = parts.map((p, index) => {
    if (index === 0) {
      const [label, value] = p.split(": ");
      if (!value)
        return p;
      return `${label}: <strong>${value}</strong>`;
    }
    return p;
  }).join(" | ");
  previewText.innerHTML = message;
  return message;
}
function capitalize(value) {
  if (!value)
    return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function getSelectedTags(type, sentenceCase = true) {
  return Array.from(customPanel.querySelectorAll(`.tag-chip[data-tag-type="${type}"].selected`)).map((chip) => sentenceCase ? capitalize(chip.dataset.tag) : chip.dataset.tag);
}
modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    if (!mode || tab.disabled)
      return;
    currentMode = mode;
    updateModeUI();
  });
});
difficultyChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (currentMode === MODE_CUSTOM)
      return;
    selectedDifficulty = chip.dataset.tag;
    difficultyChips.forEach((c) => c.classList.toggle("selected", c === chip));
    updatePreviewText();
  });
});
if (difficultyChips.length) {
  difficultyChips[0].classList.add("selected");
}
tagChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chip.classList.toggle("selected");
    if (currentMode === MODE_CUSTOM) {
      updatePreviewText();
    }
  });
});
customSettings.forEach((setting) => {
  setting.addEventListener("change", () => {
    if (currentMode === MODE_CUSTOM)
      updateCustomUI();
  });
});
allToggleBtn.addEventListener("click", () => {
  const classifierTags = Array.from(tagsList.children);
  if (isAllSelected) {
    isAllSelected = false;
    allToggleBtn.classList.remove("selected");
    for (let tag of classifierTags) {
      if (tag.classList.contains("tag-chip")) {
        tag.classList.remove("selected", "disabled");
      }
    }
  } else {
    isAllSelected = true;
    allToggleBtn.classList.add("selected");
    for (let tag of classifierTags) {
      if (tag.classList.contains("tag-chip") && !tag.classList.contains("all")) {
        tag.classList.add("selected", "disabled");
      }
    }
  }
  updatePreviewText();
});
function getConfig() {
  if (currentMode === MODE_STANDARD || currentMode === MODE_ENDLESS) {
    return {
      gamemode: currentMode,
      difficulty: selectedDifficulty || null
    };
  }
  const difficultyTags = getSelectedTags("difficulty", false);
  const locationTags = getSelectedTags("location", false);
  let roundsValue = DEFAULT_ROUNDS;
  let healthValue = DEFAULT_HEALTH;
  try {
    roundsValue = Number(customRounds.value);
  } catch (error) {}
  try {
    healthValue = Number(customHealth.value);
  } catch (error) {}
  return {
    gamemode: customGamemode.value,
    gamemodeParam: customGamemode.value === "standard" ? Math.max(1, roundsValue) : Math.max(1, healthValue),
    timerSeconds: Number.parseInt(customTimer.value || "0"),
    difficulties: difficultyTags,
    tags: locationTags
  };
}
startBtn.addEventListener("click", async () => {
  const conf = getConfig();
  console.log("Starting game with:", conf);
  const response = await fetch("./api/getsession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conf)
  });
  const { sessionid } = await response.json();
  sessionStorage.setItem("sessionid", sessionid.toString());
  if (!conf.gamemodeParam)
    conf.gamemodeParam = conf.gamemode === "standard" ? 5 : 5000;
  if (!conf.timerSeconds && conf.timerSeconds !== 0)
    conf.timerSeconds = 60;
  sessionStorage.setItem("gameState", JSON.stringify(conf));
  window.location.href = "./game";
});
updateModeUI();
