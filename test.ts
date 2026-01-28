import { advanceGameState, garbageCollectSessions, getGameState, getPicture, newSession, validateSession } from "./src/db_interface";
import type { GameState, LocGuess, LocResponse, Params } from "./src/types/types";
import { calcDist, calcScore, generateSessionID, get_time } from "./src/utils";

const LOG_LVL = Number.parseInt(Bun.env.LOG_LVL || '1')

async function test_gen_session(): Promise<number> {
    const params: Params = {gamemode: "standard", gamemodeParam: 5, timerSeconds: 60, difficulties: ["medium"], tags: ["indoor", "outdoor", "carparks"]};
    const sessionid: number = generateSessionID(params);
    const success: boolean = await newSession(sessionid, params);

    return sessionid
}

async function test_submit_guess(sessionid: number) {
    const guess: LocGuess = JSON.parse(`{"sessionid": ${sessionid}, "xpos": 0, "ypos": 0}`);
    if (!validateSession(guess.sessionid) && LOG_LVL >= 1) console.error("INVALID SESSION!!!");
    if (LOG_LVL >= 4) console.log(`${get_time()} got guess:`);
    if (LOG_LVL >= 4) console.log(guess);

    const gameState: GameState = await getGameState(guess.sessionid);
    if (LOG_LVL >= 4) console.log(`${get_time()} got gamestate:`);
    if (LOG_LVL >= 4) console.log(gameState);
    const dist: number = calcDist([gameState.correctx, gameState.correcty], [guess.xpos, guess.ypos]);
    if (LOG_LVL >= 4) console.log(`${get_time()} got distance: ${dist}`);
    const score_add: number = calcScore(dist);
    if (LOG_LVL >= 4) console.log(`${get_time()} got score: ${score_add}`);

    const [score, curr_round] = await advanceGameState(guess.sessionid, score_add);
    if (LOG_LVL >= 3) console.log(`${get_time()} Game state advanced. | New score: ${score} | New Round Number: ${curr_round}`)

    const res: LocResponse = {
        xpos: (gameState.difficulty !== 'impossible') ? gameState.correctx : null,
        ypos: (gameState.difficulty !== 'impossible') ? gameState.correcty : null,
        distance: dist,
        score: score,
        curr_round: curr_round
    }
    return res;
}

async function test_get_picture() {
    const { sessionid } = JSON.parse("{0}");
    if (!validateSession(sessionid)) return new Response('Invalid Session ID.', { status: 401 });
    return new Response(await getPicture(sessionid), {
        headers: {'Content-Type': 'image/jpeg'}
    })
}

for (let d = 0; d < 2000000; d += 2000) {
    console.log(`${d/1000}m | ${calcScore(d)}`)
}
