import { type Params } from './types/types'

export function get_time(): string { return `[${new Date().toLocaleTimeString()}]` }

export function calcDist(pos1: [number, number], pos2: [number, number]): number {
    const dx = pos2[0] - pos1[0];
    const dy = pos2[1] - pos1[1];
    return Math.sqrt(dx * dx + dy * dy);
}

export function calcScore(dist: number): number {
    if (dist < 10000) return 5000;

    return Math.floor(5000 * Math.exp(-10*((dist-10000)/5000000)))
}

export function generateSessionID(params: Params): number {
    // Hash the parameters plus a random salt, return as a number
    return Number(Bun.hash(JSON.stringify(params) + Bun.randomUUIDv7())) % 9007199254740991
}

export function latLongToCoords(lat: number, long: number): [number, number] {
    // Translate 0.016 lat/long into 2 million integer units
    const x: number = Math.ceil((long - 145.127) * 125000000);
    const y: number = Math.ceil((lat + 37.916) * 125000000);
    return [x, y]
}

export function coordsToLatLong(x: number, y: number): [number, number] {
    // Translate 0-2 million integers to floats 0-0.016 lat/long 
    const long: number = (x / 125000000) + 145.127;
    const lat: number = (y / 125000000) - 37.916;
    return [lat, long]
}