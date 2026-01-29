import L from "leaflet";

declare global {
  interface Window {
    mapInstance: L.Map;
  }
}

const guessIcon = L.icon({
    iconUrl: './assets/marker-icon-tall.png',
    iconSize: [48, 90]
})

let selectedDifficulty = "easy";
let guessPos: [number, number] | null = null;
let mapInstance: L.Map | null = null;
let currentGuessMarker: L.Marker | null = null;
let currentErrorPopup: L.Popup | null = null;
let pImg: Blob | null = null;
let difficultyChips: NodeListOf<HTMLButtonElement>, tagsList: HTMLElement, tagChips: NodeListOf<HTMLButtonElement>,
sendBtn: HTMLButtonElement, imgInput: HTMLInputElement, coordsText: HTMLElement

const bottomBoundary = -37.916
const topBoundary = -37.905
const leftBoundary = 145.127
const rightBoundary = 145.143

document.addEventListener('DOMContentLoaded', () => {
    setupUI();
    bindEvents();
});

function setupUI() {
    difficultyChips = document.querySelectorAll<HTMLButtonElement>(".difficulty-chip")!;
    tagsList = document.getElementById("tags-list")!;
    tagChips = document.querySelectorAll<HTMLButtonElement>(".tag-chip")!;
    sendBtn = document.getElementById("sendBtn")! as HTMLButtonElement;
    imgInput = document.getElementById("photoInput")! as HTMLInputElement;
    coordsText = document.getElementById("coordsText")! as HTMLElement;
    
    const mapElement = document.getElementById('map') as HTMLElement;
    const bounds = L.latLngBounds(L.latLng(bottomBoundary, leftBoundary), L.latLng(topBoundary, rightBoundary));
    
    // Initialize Leaflet map
    mapInstance = L.map(mapElement, {
        attributionControl: false,
        zoomDelta: 0.6,
        minZoom: 15,
        maxBounds: bounds,
        renderer: L.canvas()
    }).setView([-37.91, 145.13], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        detectRetina: true,
    }).addTo(mapInstance);

    L.Icon.Default.mergeOptions({
        iconUrl: 'assets/marker-icon.png',
        shadowUrl: null,
    });
}

function validCoordinates(lat: number, long: number): boolean {
    return ((leftBoundary < long) && (long < rightBoundary) && (bottomBoundary < lat) && (lat < topBoundary))
}

function latLongToCoords(lat: number, long: number): [number, number] {
    // Translate 0.016 lat/long into 2 million integer units
    const x: number = Math.ceil((long - leftBoundary) * 125000000);
    const y: number = Math.ceil((lat - bottomBoundary) * 125000000);
    return [x, y]
}

function getSelectedTags(type: string): string[] {
    return Array.from(
    tagsList.querySelectorAll<HTMLElement>(
        `.tag-chip[data-tag-type="${type}"].selected`
    )
    ).map((chip) => (chip.dataset.tag!));
}

function getConfig() {
    if (!guessPos) return null;
    
    const locationTags = getSelectedTags("location");

    return {
    difficulty: selectedDifficulty,
    tags: locationTags,
    xpos: guessPos[0],
    ypos: guessPos[1]
    };
}

async function preprocessImage(imageFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Target exactly 1920x1080 (16:9)
        const targetW = 1920;
        const targetH = 1080;
        const aspect = targetW / targetH;
        
        let drawW: number, drawH: number;
        if (Math.abs(img.width / img.height - aspect) < 0.01) {
            drawH = img.height;
            drawW = img.width;
        } else if (img.width / img.height > aspect) {
            // Too wide
            drawH = img.height;
            drawW = drawH * aspect;
        } else {
            // Too tall
            drawW = img.width;
            drawH = Math.floor(drawW / aspect);
        }
        
        // Center crop & scale
        canvas.width = targetW;
        canvas.height = targetH;
        const sx = (img.width - drawW) / 2;
        const sy = (img.height - drawH) / 2;
        ctx.drawImage(img, sx, sy, drawW, drawH, 0, 0, targetW, targetH);
        
        // Encode AVIF
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject('Critical Error:\nAVIF Encoding Failed.'),
            'image/avif',
            0.9  // Quality
        );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
}

async function submitLocation() {
    if (!pImg) return;
    
    const conf = getConfig();
    const img = pImg;

    const fd = new FormData();
    fd.append('settings', JSON.stringify(conf))
    fd.append('image', img, 'preprocessed.avif');

    const response = await fetch('./api/uploadpicture', {
        method: 'POST',
        body: fd,
    });

    if (response.status === 200) {
        alert("Successfully added location to database!")
        imgInput.files = null;
    } else {
        alert("ERROR:\nUnable to add location to database.")
    }
};

function bindEvents() {
    // Difficulty chips select on click | only 1 at a time
    difficultyChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            selectedDifficulty = chip.dataset.tag!;
            difficultyChips.forEach((c) =>
                c.classList.toggle("selected", c === chip)
            );
        });
    });
    if (difficultyChips.length) {
        difficultyChips[0]!.classList.add("selected");
    }

    // Tag chips select on click | multiple at once
    tagChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            chip.classList.toggle("selected");
        });
    });
    
    // Send button triggers location submission
    sendBtn.onclick = submitLocation;

    // All map event handling
    if (!mapInstance) return
    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
        // Upon clicking valid map location: place a guessIcon marker
        if (validCoordinates(e.latlng.lat, e.latlng.lng)) {
            guessPos = latLongToCoords(e.latlng.lat, e.latlng.lng)
            coordsText.textContent = `Selected: (${guessPos[0]}, ${guessPos[1]})`;

            if (currentGuessMarker) mapInstance!.removeLayer(currentGuessMarker);
            currentGuessMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: guessIcon }).addTo(mapInstance!);
        } else {
            // Upon clicking invalid map location: place an error popup
            if (currentErrorPopup) mapInstance!.closePopup(currentErrorPopup);
            
            currentErrorPopup = L.popup([e.latlng.lat, e.latlng.lng], {
                content: '<p>This is not inside the Monash Campus!</p>',
                closeButton: false,
            }).openOn(mapInstance!);
            
            // Auto-close after 3 seconds
            setTimeout(() => {
                if (currentErrorPopup) {
                    mapInstance!.closePopup(currentErrorPopup);
                    currentErrorPopup = null;
                }
            }, 3000);}
    });

    imgInput.onchange = async () => {
        if (imgInput.files?.[0]) {
            pImg = await preprocessImage(imgInput.files[0]);
        }
    };
}