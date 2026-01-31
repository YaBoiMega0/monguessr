const MODE_STANDARD = "standard";
const MODE_ENDLESS = "endless";
const MODE_CUSTOM = "custom";

const DEFAULT_ROUNDS = 5;
const DEFAULT_HEALTH = 5000;

let currentMode = MODE_STANDARD;
let selectedDifficulty = "easy";
let isAllSelected = false;

let modeTabs: NodeListOf<HTMLButtonElement>, panelPrimaryTitle: HTMLElement, panelPrimarySubtitle: HTMLElement,
    previewText: HTMLElement, difficultyChips: NodeListOf<HTMLButtonElement>, tagChips: NodeListOf<HTMLButtonElement>,
    customSettings: NodeListOf<HTMLElement>, customGamemode: HTMLSelectElement, customTimer: HTMLInputElement,
    customRounds: HTMLInputElement, customHealth: HTMLInputElement, customPanel: HTMLElement, standardPanel: HTMLElement,
    startBtn: HTMLButtonElement, allToggleBtn: HTMLButtonElement, tagsList: HTMLElement;

document.addEventListener('DOMContentLoaded', async () => {
    setupUI();
    bindEvents();
});

function setupUI() {
    modeTabs = document.querySelectorAll<HTMLButtonElement>(".mode-tab")!;
    panelPrimaryTitle = document.getElementById("panelPrimaryTitle")!;
    panelPrimarySubtitle = document.getElementById("panelPrimarySubtitle")!;
    previewText = document.getElementById("previewText")!;
    difficultyChips = document.querySelectorAll<HTMLButtonElement>(".difficulty-chip")!;
    tagChips = document.querySelectorAll<HTMLButtonElement>(".tag-chip")!;
    customSettings = document.querySelectorAll<HTMLElement>(".setting-pill")!;
    customGamemode = document.getElementById("customGamemode")! as HTMLSelectElement;
    customTimer = document.getElementById("customTimer")! as HTMLInputElement;
    customRounds = document.getElementById("customRounds")! as HTMLInputElement;
    customHealth = document.getElementById("customHealth")! as HTMLInputElement;
    customPanel = document.getElementById("customPanel")!;
    standardPanel = document.getElementById("standardPanel")!;
    startBtn = document.getElementById("startBtn")! as HTMLButtonElement;
    allToggleBtn = document.getElementById("allToggle")! as HTMLButtonElement;
    tagsList = document.getElementById("tags-list")!;
    
    updateModeUI();
}

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
    }

    updateCustomUI();
}

function updateCustomUI() {
    if (currentMode !== MODE_CUSTOM) {
        startBtn.disabled = false;
        updatePreviewText();
        return
    }
    
    const gamemode = customGamemode.value;
    let roundsPanel = document.getElementById("numRounds")!;
    let healthPanel = document.getElementById("startHealth")!;

    if (gamemode === "standard") {
        healthPanel.style.display = "none";
        roundsPanel.style.display = "flex";
    } else if (gamemode === "endless") {
        roundsPanel.style.display = "none";
        healthPanel.style.display = "flex";
    }

    startBtn.disabled = (getSelectedTags('difficulty').length > 0)

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

    startBtn.disabled = !(Boolean(difficultyTags.length));

    try {
        roundsValue = Number(customRounds.value);
    } catch (error) {};
    try {
        healthValue = Number(customHealth.value);
    } catch (error) {};
    
    const timerValue = Number(customTimer.value || 0);

    parts.push(
        "Difficulties: " +
        (difficultyTags.length ? difficultyTags.join(", ") : "none")
    );
    parts.push(
        "Tags: " +
        (isAllSelected ? "All" : (locationTags.length ? locationTags.join(", ") : "none"))
    );
    parts.push(
        `Gamemode: ${capitalize(gamemode)}`
    );
    parts.push(
        `${(gamemode === "standard") ? 
            `Rounds: ${Math.max(1, roundsValue)}` : 
            `Health: ${Math.max(1, healthValue)}`}`
    );
    parts.push(
        `Timer: ${timerValue > 0 ? timerValue + "s" : "no limit"}`
    );
    }

    let message = parts
    .map((p, index) => {
        if (index === 0) {
        const [label, value] = p.split(": ");
        if (!value) return p;
        return `${label}: <strong>${value}</strong>`;
        }
        return p;
    })
    .join(" | ");

    previewText.innerHTML = message;

    return message;
}

function capitalize(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSelectedTags(type: string, sentenceCase: boolean = true): string[] {
    return Array.from(
    customPanel.querySelectorAll<HTMLElement>(
        `.tag-chip[data-tag-type="${type}"].selected`
    )
    ).map((chip) => (sentenceCase ? capitalize(chip.dataset.tag!) : chip.dataset.tag!));
}

function getConfig() {
    if (currentMode === MODE_STANDARD || currentMode === MODE_ENDLESS) {
    return {
        gamemode: currentMode,
        difficulty: selectedDifficulty || null,
    };
    }

    const difficultyTags = getSelectedTags("difficulty", false);
    const locationTags = getSelectedTags("location", false);

    let roundsValue = DEFAULT_ROUNDS;
    let healthValue = DEFAULT_HEALTH;
    try {
        roundsValue = Number(customRounds.value);
    } catch (error) {};
    try {
        healthValue = Number(customHealth.value);
    } catch (error) {};

    return {
    gamemode: customGamemode.value,
    gamemodeParam: (customGamemode.value === "standard" ? 
        Math.max(1, roundsValue) : Math.max(1, healthValue)
    ),
    timerSeconds: Number.parseInt(customTimer.value || '0'),
    difficulties: difficultyTags,
    tags: locationTags,
    };
}

function bindEvents() {
modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    if (!mode || tab.disabled) return;
    currentMode = mode;
    updateModeUI();
    });
});

difficultyChips.forEach((chip) => {
    chip.addEventListener("click", () => {
    if (currentMode === MODE_CUSTOM) return;

    selectedDifficulty = chip.dataset.tag!;
    difficultyChips.forEach((c) =>
        c.classList.toggle("selected", c === chip)
    );
    updatePreviewText();
    });
});

if (difficultyChips.length) {
    difficultyChips[0]!.classList.add("selected");
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
    if (currentMode === MODE_CUSTOM) updateCustomUI();
    });
});

allToggleBtn.addEventListener("click", () => {
  const classifierTags = Array.from(tagsList.children);
  
  if (isAllSelected) {
    // Deselect ALL
    isAllSelected = false;
    allToggleBtn.classList.remove("selected");
    for (let tag of classifierTags) {
      if (tag.classList.contains("tag-chip")) {
        tag.classList.remove("selected", "disabled");
      }
    }
  } else {
    // Select ALL and disable individuals
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

startBtn.addEventListener("click", async () => {
    const conf = getConfig();
    console.log("Starting game with:", conf);

    // TRANSFER THIS INFO TO SERVER
    const response = await fetch('./api/getsession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conf)
    });
    const { sessionid } = await response.json();

    // STORE SESSION ID IN SESSION STORAGE
    sessionStorage.setItem('sessionid', sessionid.toString());
    
    if (!conf.gamemodeParam) conf.gamemodeParam = (conf.gamemode === 'standard' ? 5 : 5000)
    if (!conf.timerSeconds && conf.timerSeconds !== 0) conf.timerSeconds = 60
    sessionStorage.setItem('gameState', JSON.stringify(conf));
    
    window.location.href = "./game";
});
}