// src/admin.ts
var guessIcon = L.icon({
  iconUrl: "./assets/marker-icon-tall.png",
  iconSize: [48, 90]
});
var selectedDifficulty = "easy";
var guessPos = null;
var mapInstance = null;
var currentGuessMarker = null;
var currentErrorPopup = null;
var pImg = null;
var difficultyChips;
var tagsList;
var tagChips;
var sendBtn;
var imgInput;
var coordsText;
var bottomBoundary = -37.916;
var topBoundary = -37.905;
var leftBoundary = 145.127;
var rightBoundary = 145.143;
document.addEventListener("DOMContentLoaded", () => {
  setupUI();
  bindEvents();
});
function setupUI() {
  difficultyChips = document.querySelectorAll(".difficulty-chip");
  tagsList = document.getElementById("tags-list");
  tagChips = document.querySelectorAll(".tag-chip");
  sendBtn = document.getElementById("sendBtn");
  imgInput = document.getElementById("photoInput");
  coordsText = document.getElementById("coordsText");
  const mapElement = document.getElementById("map");
  const bounds = L.latLngBounds(L.latLng(bottomBoundary, leftBoundary), L.latLng(topBoundary, rightBoundary));
  mapInstance = L.map(mapElement, {
    attributionControl: false,
    zoomDelta: 0.6,
    minZoom: 15,
    maxBounds: bounds,
    renderer: L.canvas()
  }).setView([-37.91, 145.13], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    detectRetina: true
  }).addTo(mapInstance);
  L.Icon.Default.mergeOptions({
    iconUrl: "assets/marker-icon.png",
    shadowUrl: null
  });
}
function validCoordinates(lat, long) {
  return leftBoundary < long && long < rightBoundary && bottomBoundary < lat && lat < topBoundary;
}
function latLongToCoords(lat, long) {
  const x = Math.ceil((long - leftBoundary) * 125000000);
  const y = Math.ceil((lat - bottomBoundary) * 125000000);
  return [x, y];
}
function getSelectedTags(type) {
  return Array.from(tagsList.querySelectorAll(`.tag-chip[data-tag-type="${type}"].selected`)).map((chip) => chip.dataset.tag);
}
function getConfig() {
  if (!guessPos)
    return null;
  const locationTags = getSelectedTags("location");
  return {
    difficulty: selectedDifficulty,
    tags: locationTags,
    xpos: guessPos[0],
    ypos: guessPos[1]
  };
}
async function preprocessImage(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const targetW = 1920;
      const targetH = 1080;
      const aspect = targetW / targetH;
      let drawW, drawH;
      if (Math.abs(img.width / img.height - aspect) < 0.01) {
        drawH = img.height;
        drawW = img.width;
      } else if (img.width / img.height > aspect) {
        drawH = img.height;
        drawW = drawH * aspect;
      } else {
        drawW = img.width;
        drawH = Math.floor(drawW / aspect);
      }
      canvas.width = targetW;
      canvas.height = targetH;
      const sx = (img.width - drawW) / 2;
      const sy = (img.height - drawH) / 2;
      ctx.drawImage(img, sx, sy, drawW, drawH, 0, 0, targetW, targetH);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(`Critical Error:
AVIF Encoding Failed.`), "image/avif", 0.9);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
}
async function submitLocation() {
  if (!pImg)
    return;
  const conf = getConfig();
  const img = pImg;
  const fd = new FormData;
  fd.append("settings", JSON.stringify(conf));
  fd.append("image", img, "preprocessed.avif");
  const response = await fetch("./api/uploadpicture", {
    method: "POST",
    body: fd
  });
  if (response.status === 200) {
    alert("Successfully added location to database!");
    imgInput.files = null;
  } else {
    alert(`ERROR:
Unable to add location to database.`);
  }
}
function bindEvents() {
  difficultyChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedDifficulty = chip.dataset.tag;
      difficultyChips.forEach((c) => c.classList.toggle("selected", c === chip));
    });
  });
  if (difficultyChips.length) {
    difficultyChips[0].classList.add("selected");
  }
  tagChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
    });
  });
  sendBtn.onclick = submitLocation;
  if (!mapInstance)
    return;
  mapInstance.on("click", (e) => {
    if (validCoordinates(e.latlng.lat, e.latlng.lng)) {
      guessPos = latLongToCoords(e.latlng.lat, e.latlng.lng);
      coordsText.textContent = `Selected: (${guessPos[0]}, ${guessPos[1]})`;
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
  imgInput.onchange = async () => {
    if (imgInput.files?.[0]) {
      pImg = await preprocessImage(imgInput.files[0]);
    }
  };
}
