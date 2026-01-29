import { type LocGuess, type LocResponse } from './types/types';
import L from "leaflet";

declare global {
  interface Window {
    mapInstance: L.Map;
  }
}

const correctIcon = L.icon({
    iconUrl: './assets/flag-centered.png',
    iconSize: [49, 54]
})
const guessIcon = L.icon({
    iconUrl: './assets/marker-icon-tall.png',
    iconSize: [48, 90]
})

let sessionid = Number.parseInt(sessionStorage.sessionid || '-1');
if (sessionid === -1) kickFromGame('Missing session ID.\nAccess this page only after selecting game options.')

let gameState = JSON.parse(sessionStorage.gameState || 'null');
if (!gameState) kickFromGame('Missing game settings.\nAccess this page only after selecting game options.')
if (!gameState.score) gameState.score = (gameState.gamemode === 'standard' ? 0 : gameState.gamemodeParam);
if (!gameState.curr_round) gameState.curr_round = 1;

let currentImage: string | null = null;
let guessed: boolean = false;
let guessPos: [number, number] | null = null;
let mapInstance: L.Map | null = null;
let currentGuessMarker: L.Marker | null = null;
let currentErrorPopup: L.Popup | null = null;
let timerElement: HTMLElement, scoreElement: HTMLElement, roundElement: HTMLElement, 
    imageElement: HTMLImageElement, submitBtn: HTMLButtonElement, nextBtn: HTMLButtonElement;

const bottomBoundary = -37.916
const topBoundary = -37.905
const leftBoundary = 145.127
const rightBoundary = 145.143

let stopTimer;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    setupUI();
    await loadNextPicture();
    bindEvents();
});

function kickFromGame(message: string) {
    alert(message);
    fetch(`./api/killsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid })
    });  
    sessionStorage.clear();
    window.location.href = "./";
}

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

    }).addTo(mapInstance);


    const resizeObserver = new ResizeObserver(() => {
        if (mapInstance) setTimeout(() => mapInstance!.invalidateSize(), 100);
    });
    resizeObserver.observe(mapElement);

    // Set paths for custom marker icon
    L.Icon.Default.mergeOptions({
        iconUrl: 'assets/marker-icon.png',
        shadowUrl: null,
    });

    timerElement = document.getElementById('timer') as HTMLElement;
    scoreElement = document.getElementById('scoreText') as HTMLElement;
    roundElement = document.getElementById('currentRoundText') as HTMLElement;
    imageElement = document.getElementById('currentPicture') as HTMLImageElement;
    submitBtn = document.getElementById('submitGuessButton') as HTMLButtonElement;
    nextBtn = document.getElementById('nextRoundButton') as HTMLButtonElement;

    updateRound();
    updateScore(true);
    if (Number.parseInt(gameState.timerSeconds) !== 0) {
        stopTimer = startCountdown();
    } else {
        timerElement.hidden = true;
    }
}

function startCountdown() {
    let timerInterval: NodeJS.Timeout | null = null;
    // Clear any existing timer
    if (timerInterval) clearInterval(timerInterval);
    
    let timeLeft = gameState.timerSeconds;
    
    const updateDisplay = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval!);
            timerElement.textContent = '0:00';
            if (!guessPos) guessPos = [0, 0];
            submitGuess();
            return;
        }
        timeLeft--;
    };
    
    // Initial display
    updateDisplay();
    
    // Start countdown
    timerInterval = setInterval(updateDisplay, 1000);
    
    // Return stop function
    return () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };
}

async function loadNextPicture() {
    const response = await fetch(`./api/getpicture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid })
    });
    
    if (!response.ok) {
        kickFromGame('Critical error:\nFailed to load picture. Please start a new session and try again.');
        return;
    }
    
    const imgBlob: Blob = await response.blob();
    currentImage = URL.createObjectURL(imgBlob);
    imageElement.src = currentImage;

    guessed = false;
    nextBtn.style.display = 'none';
    submitBtn.style.display = 'block';
    
    // Reset map - clear markers/lines and reset view
    if (mapInstance) {
        mapInstance.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                mapInstance!.removeLayer(layer);
            }
        });
        mapInstance.setView([-37.91, 145.13], 16);
    }
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

function coordsToLatLong(x: number, y: number): [number, number] {
    // Translate 0-2 million integers to floats 0-0.016 lat/long 
    const long: number = (x / 125000000) + leftBoundary;
    const lat: number = (y / 125000000) + bottomBoundary;
    return [lat, long]
}

async function submitGuess() {
    if (guessed || !guessPos || !mapInstance) return;

    const [xpos, ypos] = guessPos;

    stopTimer!();

    const guess: LocGuess = { sessionid, xpos, ypos }

    const response = await fetch(`./api/submitguess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guess)
    });

    if (!response.ok) {
        kickFromGame('Critical error:\nGuess submission failed. Please start a new session and try again.');
        return;
    }

    const result = await response.json() as LocResponse;

    guessed = true;
    gameState.score = result.score;
    gameState.curr_round = result.curr_round;

    console.log(result.distance)

    updateScore();

    // Show correct location (unless impossible mode)
    if (result.xpos !== null && result.ypos !== null) {
        const [rlat, rlong] = coordsToLatLong(result.xpos, result.ypos)
        const [glat, glong] = coordsToLatLong(guessPos[0], guessPos[1])
        L.marker([rlat, rlong], {
            icon: correctIcon,
            riseOnHover: true
        }).addTo(mapInstance);
        L.polyline([[glat, glong], [rlat, rlong]], {
            color: 'red',
            weight: 2,
            dashArray: '5, 5'
        }).addTo(mapInstance);
    } else console.log("Location hidden due to difficulty")
    mapInstance.setView([-37.91, 145.13], 15);

    submitBtn.style.display = 'none';
    submitBtn.disabled = true;
    nextBtn.style.display = 'block';
    guessPos = null;
    saveProgress();
}

async function nextRound() {
    if ((gameState.gamemode === 'standard' && gameState.curr_round > gameState.gamemodeParam) || (
         gameState.gamemode === 'endless' && gameState.score <= 0)) {
        endGame();
        return;
    };
    updateRound();
    guessed = false;
    submitBtn.style.display = 'block';
    nextBtn.style.display = 'none';
    saveProgress();
    await loadNextPicture();
    stopTimer = startCountdown();
}

function updateRound() {
    if (gameState.gamemode === 'standard') {
        roundElement.textContent = `Round: ${gameState.curr_round}/${gameState.gamemodeParam}`;
    } else if (gameState.gamemode === 'endless') {
        roundElement.textContent = `Round: ${gameState.curr_round}`;
    } else {
        kickFromGame('Critical error:\nCorrupted local game state.\nPlease start a new session and try again.')
    }
}

function updateScore(instant: boolean = false) {
    if (instant) scoreElement.textContent = `${gameState.gamemode === 'standard' ? 'Points' : 'Health'}: ${Math.max(0, gameState.score)}`;
    
    const targetScore = gameState.score;
    let currentScore = Number.parseInt(scoreElement.textContent!.slice(7));

    let wait: boolean = false;
    
    function tick() {
        if (wait) {
            wait = false;
            requestAnimationFrame(tick)
            return
        }
        const dif = targetScore - currentScore;
        if (dif === 0) return;
        
        const inc = Math.abs(dif) > 222 ? 111 : 
                   Math.abs(dif) > 22 ? 11 : 1;
        
        currentScore += (dif < 0 ? -inc : inc);

        scoreElement.textContent = `${gameState.gamemode === 'standard' ? 'Points' : 'Health'}: ${Math.max(0, currentScore)}`;
        
        wait = true
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function endGame() {
    fetch(`./api/killsession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionid })
        });
    sessionStorage.clear()
    alert(`Game Over! Final Score: ${gameState.gamemode === 'endless' ? gameState.curr_round : gameState.score}`);
    window.location.href = "./";
}

function bindEvents() {
    (submitBtn as HTMLElement).onclick = submitGuess;
    (nextBtn as HTMLElement).onclick = nextRound;

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            guessed ? nextRound() : submitGuess();
        }
    });

    // All map event handling
    if (!mapInstance) return
    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
        // Upon clicking valid map location: place a guessIcon marker
        if (validCoordinates(e.latlng.lat, e.latlng.lng)) {
            if (submitBtn.disabled) submitBtn.disabled = false;
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

    const mapElement = document.getElementById('map') as HTMLElement;
    const handleHover = () => {
        setTimeout(() => {
            mapInstance!.invalidateSize();
        }, 50);
    };

    mapElement.addEventListener('mouseenter', handleHover);
    mapElement.addEventListener('mouseleave', handleHover);
}

function saveProgress() {
    sessionStorage.setItem("gameState", JSON.stringify(gameState))
}