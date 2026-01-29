// src/game.ts
var correctIcon = L.icon({
  iconUrl: "./assets/flag-centered.png",
  iconSize: [49, 54]
});
var guessIcon = L.icon({
  iconUrl: "./assets/marker-icon-tall.png",
  iconSize: [48, 90]
});
var sessionid = Number.parseInt(sessionStorage.sessionid || "-1");
if (sessionid === -1)
  kickFromGame(`Missing session ID.
Access this page only after selecting game options.`);
var gameState = JSON.parse(sessionStorage.gameState || "null");
if (!gameState)
  kickFromGame(`Missing game settings.
Access this page only after selecting game options.`);
if (!gameState.score)
  gameState.score = gameState.gamemode === "standard" ? 0 : gameState.gamemodeParam;
if (!gameState.curr_round)
  gameState.curr_round = 1;
var currentImage = null;
var guessed = false;
var guessPos = null;
var mapInstance = null;
var currentGuessMarker = null;
var currentErrorPopup = null;
var timerElement;
var scoreElement;
var roundElement;
var imageElement;
var submitBtn;
var nextBtn;
var bottomBoundary = -37.916;
var topBoundary = -37.905;
var leftBoundary = 145.127;
var rightBoundary = 145.143;
var stopTimer;
document.addEventListener("DOMContentLoaded", async () => {
  setupUI();
  await loadNextPicture();
  bindEvents();
});
function kickFromGame(message) {
  alert(message);
  fetch(`./api/killsession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionid })
  });
  sessionStorage.clear();
  window.location.href = "./";
}
function setupUI() {
  const mapElement = document.getElementById("map");
  const bounds = L.latLngBounds(L.latLng(bottomBoundary, leftBoundary), L.latLng(topBoundary, rightBoundary));
  mapInstance = L.map(mapElement, {
    attributionControl: false,
    zoomDelta: 0.6,
    minZoom: 15,
    maxBounds: bounds,
    renderer: L.canvas()
  }).setView([-37.91, 145.13], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {}).addTo(mapInstance);
  const resizeObserver = new ResizeObserver(() => {
    if (mapInstance)
      setTimeout(() => mapInstance.invalidateSize(), 100);
  });
  resizeObserver.observe(mapElement);
  L.Icon.Default.mergeOptions({
    iconUrl: "assets/marker-icon.png",
    shadowUrl: null
  });
  timerElement = document.getElementById("timer");
  scoreElement = document.getElementById("scoreText");
  roundElement = document.getElementById("currentRoundText");
  imageElement = document.getElementById("currentPicture");
  submitBtn = document.getElementById("submitGuessButton");
  nextBtn = document.getElementById("nextRoundButton");
  updateRound();
  updateScore(true);
  if (Number.parseInt(gameState.timerSeconds) !== 0) {
    stopTimer = startCountdown();
  } else {
    timerElement.hidden = true;
  }
}
function startCountdown() {
  let timerInterval = null;
  if (timerInterval)
    clearInterval(timerInterval);
  let timeLeft = gameState.timerSeconds;
  const updateDisplay = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerElement.textContent = "0:00";
      if (!guessPos)
        guessPos = [0, 0];
      submitGuess();
      return;
    }
    timeLeft--;
  };
  updateDisplay();
  timerInterval = setInterval(updateDisplay, 1000);
  return () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
}
async function loadNextPicture() {
  const response = await fetch(`./api/getpicture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionid })
  });
  if (!response.ok) {
    kickFromGame(`Critical error:
Failed to load picture. Please start a new session and try again.`);
    return;
  }
  const imgBlob = await response.blob();
  currentImage = URL.createObjectURL(imgBlob);
  imageElement.src = currentImage;
  guessed = false;
  nextBtn.style.display = "none";
  submitBtn.style.display = "block";
  if (mapInstance) {
    mapInstance.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        mapInstance.removeLayer(layer);
      }
    });
    mapInstance.setView([-37.91, 145.13], 16);
  }
}
function validCoordinates(lat, long) {
  return leftBoundary < long && long < rightBoundary && bottomBoundary < lat && lat < topBoundary;
}
function latLongToCoords(lat, long) {
  const x = Math.ceil((long - 145.127) * 125000000);
  const y = Math.ceil((lat + 37.916) * 125000000);
  return [x, y];
}
function coordsToLatLong(x, y) {
  const long = x / 125000000 + 145.127;
  const lat = y / 125000000 - 37.916;
  return [lat, long];
}
async function submitGuess() {
  if (guessed || !guessPos || !mapInstance)
    return;
  const [xpos, ypos] = guessPos;
  stopTimer();
  const guess = { sessionid, xpos, ypos };
  const response = await fetch(`./api/submitguess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guess)
  });
  if (!response.ok) {
    kickFromGame(`Critical error:
Guess submission failed. Please start a new session and try again.`);
    return;
  }
  const result = await response.json();
  guessed = true;
  gameState.score = result.score;
  gameState.curr_round = result.curr_round;
  console.log(result.distance);
  updateScore();
  if (result.xpos !== null && result.ypos !== null) {
    const [rlat, rlong] = coordsToLatLong(result.xpos, result.ypos);
    const [glat, glong] = coordsToLatLong(guessPos[0], guessPos[1]);
    L.marker([rlat, rlong], {
      icon: correctIcon,
      riseOnHover: true
    }).addTo(mapInstance);
    L.polyline([[glat, glong], [rlat, rlong]], {
      color: "red",
      weight: 2,
      dashArray: "5, 5"
    }).addTo(mapInstance);
  } else
    console.log("Location hidden due to difficulty");
  mapInstance.setView([-37.91, 145.13], 15);
  submitBtn.style.display = "none";
  submitBtn.disabled = true;
  nextBtn.style.display = "block";
  guessPos = null;
  saveProgress();
}
async function nextRound() {
  if (gameState.gamemode === "standard" && gameState.curr_round > gameState.gamemodeParam || gameState.gamemode === "endless" && gameState.score <= 0) {
    endGame();
    return;
  }
  updateRound();
  guessed = false;
  submitBtn.style.display = "block";
  nextBtn.style.display = "none";
  saveProgress();
  await loadNextPicture();
  stopTimer = startCountdown();
}
function updateRound() {
  if (gameState.gamemode === "standard") {
    roundElement.textContent = `Round: ${gameState.curr_round}/${gameState.gamemodeParam}`;
  } else if (gameState.gamemode === "endless") {
    roundElement.textContent = `Round: ${gameState.curr_round}`;
  } else {
    kickFromGame(`Critical error:
Corrupted local game state.
Please start a new session and try again.`);
  }
}
function updateScore(instant = false) {
  if (instant)
    scoreElement.textContent = `${gameState.gamemode === "standard" ? "Points" : "Health"}: ${Math.max(0, gameState.score)}`;
  const targetScore = gameState.score;
  let currentScore = Number.parseInt(scoreElement.textContent.slice(7));
  let wait = false;
  function tick() {
    if (wait) {
      wait = false;
      requestAnimationFrame(tick);
      return;
    }
    const dif = targetScore - currentScore;
    if (dif === 0)
      return;
    const inc = Math.abs(dif) > 222 ? 111 : Math.abs(dif) > 22 ? 11 : 1;
    currentScore += dif < 0 ? -inc : inc;
    scoreElement.textContent = `${gameState.gamemode === "standard" ? "Points" : "Health"}: ${Math.max(0, currentScore)}`;
    wait = true;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function endGame() {
  fetch(`./api/killsession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionid })
  });
  sessionStorage.clear();
  alert(`Game Over! Final Score: ${gameState.gamemode === "endless" ? gameState.curr_round : gameState.score}`);
  window.location.href = "./";
}
function bindEvents() {
  submitBtn.onclick = submitGuess;
  nextBtn.onclick = nextRound;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      guessed ? nextRound() : submitGuess();
    }
  });
  if (!mapInstance)
    return;
  mapInstance.on("click", (e) => {
    if (validCoordinates(e.latlng.lat, e.latlng.lng)) {
      if (submitBtn.disabled)
        submitBtn.disabled = false;
      guessPos = latLongToCoords(e.latlng.lat, e.latlng.lng);
      if (currentGuessMarker)
        mapInstance.removeLayer(currentGuessMarker);
      currentGuessMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: guessIcon }).addTo(mapInstance);
    } else {
      if (currentErrorPopup)
        mapInstance.closePopup(currentErrorPopup);
      currentErrorPopup = L.popup([e.latlng.lat, e.latlng.lng], {
        content: "<p>This is not inside the Monash Campus!</p>",
        closeButton: false
      }).openOn(mapInstance);
      setTimeout(() => {
        if (currentErrorPopup) {
          mapInstance.closePopup(currentErrorPopup);
          currentErrorPopup = null;
        }
      }, 3000);
    }
  });
  const mapElement = document.getElementById("map");
  const handleHover = () => {
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 50);
  };
  mapElement.addEventListener("mouseenter", handleHover);
  mapElement.addEventListener("mouseleave", handleHover);
}
function saveProgress() {
  sessionStorage.setItem("gameState", JSON.stringify(gameState));
}
