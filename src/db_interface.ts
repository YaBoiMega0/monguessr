import { type Params, type StandardParams, type CustomParams, type GameState, type Difficulty, type Tag } from './types/types'
import { SQL } from 'bun'
import { get_time } from './utils.ts';

const ENDLESS_START_HP = Number.parseInt(Bun.env.ENDLESS_START_HP || '5000')
const LOG_LVL = Number.parseInt(Bun.env.LOG_LVL || '1')
let dbpool: SQL | null = null;

async function getDB(): Promise<SQL> {
    if (!dbpool) {
    dbpool = new SQL({
        adapter:  'mysql',
        hostname: Bun.env.MYSQL_HOST,
        port:     Bun.env.MYSQL_PORT,
        username: Bun.env.MYSQL_USER,
        password: Bun.env.MYSQL_PASS,
        database: Bun.env.MYSQL_DATABASE,

        max: 1, // MUST EQUAL 1 OR ELSE PROGRAM HANGS DUE TO BUG IN BUN: https://github.com/oven-sh/bun/issues/26235
        connectionTimeout: Number.parseInt(Bun.env.MYSQL_CONNECTION_TIMEOUT || '30'),
    });
    }
    return dbpool
}

export async function newSession(sessionid: number, params: Params): Promise<boolean> {
    const db = await getDB();
    if (Object.keys(params).length === 2) {
        // Non-custom session creation
                if (LOG_LVL >= 4) console.log(`${get_time()} Initialising non-custom session`);
        const stdParams = params as StandardParams;
        const gm: string = (stdParams.gamemode === 'endless' ? 'E' : 'S');
        const dif: string = stdParams.difficulty.slice(0,1).toUpperCase();
        const locid: number = await newLocation(db, [stdParams.difficulty]);
        const startscore: number = (gm === 'E' ? ENDLESS_START_HP : 0);

        const result = await db`INSERT INTO sessions(
        sessionid, gamemode, difficulty, locationid, score)
        values(
        ${sessionid}, ${gm}, ${dif}, ${locid}, ${startscore})`
        return result.affectedRows > 0

    } else if (Object.keys(params).length === 5) {
        // Custom session creation
                if (LOG_LVL >= 4) console.log(`${get_time()} Initialising custom session`);
        const cusParams = params as CustomParams;
        const gm: string = (params.gamemode === 'endless' ? 'E' : 'S');
        const locid: number = await newLocation(db, cusParams.difficulties, cusParams.tags);
        const startscore: number = (params.gamemode === 'endless' ? cusParams.gamemodeParam : 0);

        const result = await db`INSERT INTO sessions(
        sessionid, gamemode, locationid, score, is_custom, custom_params)
        values(
        ${sessionid}, ${gm}, ${locid}, ${startscore}, 1, ${params})`
            if (LOG_LVL >= 4) console.log(result);
        return result.affectedRows > 0

    }
            if (LOG_LVL >= 1) console.error(`${get_time()} Invalid params sent to session generator:\n    ${params}`);
    return false
}

export async function validateSession(sessionid: number): Promise<boolean> {
    const db = await getDB();
    const result = await db`SELECT EXISTS(SELECT 1 FROM sessions WHERE sessionid = ${sessionid});`

    return (Object.values(result[0])[0] === 1)
}

export async function killSession(sessionid: number, db: SQL | null = null) {
    if (!db) {
        db = await getDB();  // Only if no db passed
    }
    await db`DELETE FROM sessions WHERE sessionid = ${sessionid}`;
            if (LOG_LVL >= 3) console.log(`${get_time()} Killed session with id ${sessionid}`);
}

export async function garbageCollectSessions(max_inactive_mins: number = 60) {
    // input a number of minutes or leave blank for 1 hour
    // kills all sessions older than that amount of time
    const db = await getDB();
    await db`DELETE FROM sessions WHERE last_activity < NOW() - INTERVAL ${max_inactive_mins} MINUTE;`
}

export async function getGameState(sessionid: number): Promise<GameState> {
    // lookup sessionid in sessions table and retrieve data
    // perform SQL join to get location info the same query
    const db = await getDB();
    const gstate = await db`SELECT l.difficulty, s.locationid, s.score, l.xpos, l.ypos
                            FROM sessions s
                            JOIN locations l ON s.locationid = l.id
                            WHERE s.sessionid = ${sessionid};`;
    
    const dif: Difficulty = (
        gstate[0].difficulty === 'E' ? 'easy' : (
        gstate[0].difficulty === 'M' ? 'medium' : (
        gstate[0].difficulty === 'H' ? 'hard' : 'impossible'
        )));
    
    return {
      difficulty: dif,
      locationId: gstate[0].locationid,
      correctx: gstate[0].xpos,
      correcty: gstate[0].ypos,
      score: gstate[0].score,
    };
}

async function newLocation(db: SQL, difficulties: Difficulty[], tags: Tag[] = ['all']): Promise<number> {
    const difs = difficulties.map((d) => `"${d.slice(0,1).toUpperCase()}"`).join(',')  
     
    // Add tag filtering
    // let filter: string = `WHERE difficulty IN (${difs})`;
    // if (tags[0] !== 'all') {
    //     const tagConditions = tags.map(tag => {
    //         if (tag === 'indoor') return "is_indoor = 1";
    //         if (tag === 'outdoor') return "is_outdoor = 1"; 
    //         if (tag === 'carparks') return "is_carpark = 1";
    //         return "1=0"; // invalid tag
    //     });
    //     filter += " AND (" + tagConditions.join(" OR ") + ")";
    // }
            if (LOG_LVL >= 4) console.log(`${get_time()} Attempting to fetch from database: SELECT id FROM locations WHERE difficulty in (${difs}) ORDER BY RAND() LIMIT 1;`)
    const result = await db.unsafe(`
        SELECT id 
        FROM locations 
        WHERE difficulty in (${difs}) 
        ORDER BY RAND() 
        LIMIT 1;`);
    
    if (result.length === 0) {
                if (LOG_LVL >= 1) console.error(`${get_time()} No location exists for difficulties | ${difs} | and tags | ${tags} |`);
        return 0;
    }
    return result[0].id;
}

export async function advanceGameState(sessionid: number, score_add: number): Promise<[number, number]> {
    // step 1: lookup sessionid in sessions table and retrieve data
    const db = await getDB();
    const result = await db`SELECT gamemode, difficulty, score, curr_round, is_custom, custom_params
                            FROM sessions
                            WHERE sessionid = ${sessionid};`;
    const gm: string = (result[0].gamemode === 'E' ? 'endless' : 'standard');
    let score: number = result[0].score;
    const curr_round: number = result[0].curr_round + 1;
    const is_custom: boolean = result[0].is_custom;
    const custom_params: CustomParams | null = result[0].custom_params;
            if (LOG_LVL >= 4) console.log(`${get_time()} Game info in advanceGameState: ${gm} | ${score} | ${curr_round} | ${is_custom}`);
    
    // step 2: check health and num_rounds to end game
    if (gm === 'standard') {
        score += score_add;
        const num_rounds = (is_custom ? custom_params!.gamemodeParam : 5);
        if (curr_round > num_rounds) {
                    if (LOG_LVL >= 3) console.log(`${get_time()} ENDING STANDARD GAME WITH SID ${sessionid} - FINAL ROUND FINISHED`);
            killSession(sessionid, db);
            return [score, curr_round]
        }
    } else {
        score -= (5000 - score_add);
        if (score <= 0) {
                    if (LOG_LVL >= 3) console.log(`${get_time()} ENDING ENDLESS GAME WITH SID ${sessionid} - HEALTH DEPLETED`);
            killSession(sessionid, db);
            return [score, curr_round - 1]
        }
    }
            
    // step 3: select a random applicable location id from locations table
    const difs: Difficulty[] = (!is_custom ? [(
        result[0].difficulty === 'E' ? 'easy' : (
        result[0].difficulty === 'M' ? 'medium' : (
        result[0].difficulty === 'H' ? 'hard' : 'impossible'
        )))] : custom_params!.difficulties);
    const tags: Tag[] = (!is_custom ? ['all'] : custom_params!.tags);
    const locid = await newLocation(db, difs, tags)

            if (LOG_LVL >= 4) console.log(`${get_time()} Attempting to write to DB: locationid = ${locid}, score = ${score}, curr_round = ${curr_round} WHERE sessionid = ${sessionid}`)

    // step 4: update sessions table with new info
    await db`UPDATE sessions
             SET locationid = ${locid},
                 score = ${score},
                 curr_round = ${curr_round}
             WHERE sessionid = ${sessionid}`;

    return [score, curr_round]
}

export async function getPicture(sessionid: number): Promise<Blob> {
    // lookup sessionid in sessions table and retrieve locationid
    const db = await getDB();
    const result = await db`SELECT locationid FROM sessions WHERE sessionid = ${sessionid};`;
    const locid = result[0].locationid

    // access filesystem for corresponding location image
    const file = Bun.file(`./images/${locid}.jpg`);
    if (!await file.exists()) {
        return Bun.file(`./images/ERROR.jpg`);
    }
    return file
}