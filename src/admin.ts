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

const difficultyChips: NodeListOf<HTMLButtonElement> = document.querySelectorAll<HTMLButtonElement>(".difficulty-chip")!;
const tagsList: HTMLElement = document.getElementById("tags-list")!;
const tagChips: NodeListOf<HTMLButtonElement> = document.querySelectorAll<HTMLButtonElement>(".tag-chip")!;
const sendBtn: HTMLButtonElement = document.getElementById("sendBtn")! as HTMLButtonElement;
const imgInput: HTMLInputElement = document.getElementById("photoInput")! as HTMLInputElement;

let guessPos: [number, number] | null = null;
let mapInstance: L.Map | null = null;
let currentGuessMarker: L.Marker | null = null;
let currentErrorPopup: L.Popup | null = null;

const bottomBoundary = -37.916
const topBoundary = -37.905
const leftBoundary = 145.127
const rightBoundary = 145.143

document.addEventListener('DOMContentLoaded', async () => {
    setupUI();
    bindEvents();
});

function setupUI() {
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

async function preprocessImage(image) {
    // Get image from global variable imgInput: HTMLInputElement
    // Force image into JPEG encoding
    // SCALE/CROP to 1920x1080 (do not distort or squash pixels)
    //    example: 2560x1440 would need no cropping, since it is 16:9
    //    2600x1440 would be cropped vertically by 40px to become 16:9 then scaled to 1920x1080
    // return for most efficiently sending over the internet
}

async function submitLocation(): Promise<boolean> {
    const conf = getConfig();
    console.log("Starting game with:", conf);

    const response = await fetch('./api/getsession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conf), // ADD THE IMAGE TO THIS SOMEHOW
    });

    return response.ok
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

    // const mapElement = document.getElementById('map') as HTMLElement;
    // const handleHover = () => {
    //     setTimeout(() => {
    //         mapInstance!.invalidateSize();
    //     }, 50);
    // };

    // mapElement.addEventListener('mouseenter', handleHover);
    // mapElement.addEventListener('mouseleave', handleHover);
}