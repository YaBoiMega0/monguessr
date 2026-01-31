import { serve } from 'bun';
import { type Params, type LocGuess, type GameState, type LocResponse, type LocInfo } from './types/types'
import { get_time, calcDist, calcScore, generateSessionID } from './utils.ts'
import { newSession, getGameState, validateSession, killSession, getPicture, advanceGameState, addLocation, garbageCollectSessions } from './db_interface.ts';

const port = Bun.env.PORT || 8000;
const ADMIN_PW: string = Bun.env.PASS || 'admin';
const LOG_LVL = Number.parseInt(Bun.env.LOG_LVL || '1')

serve({
  port: port,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url);
    let path = url.pathname;

    // Sanitise string
    path = path.replace(/[^a-zA-Z0-9\/.\-_]/g, '');
    path = path.replace(/\.\.[\/\\]/g, '');

    if (LOG_LVL >= 4) console.log(`${get_time()} Request made to: ${path}`)
    
    if ( req.method == 'GET' ) {
        // Set path aliases
        if (path === '/') {
            path = '/index.html';
        } else if (path === '/select') {
            path = '/select.html';
        } else if (path === '/game') {
            path = '/game.html';
        }

        // Only serve public files
        const filePath = `./public${path}`;
        const file = Bun.file(filePath);

        if (await file.exists()) return new Response(file);

        // or access admin panel
        if (path.includes(ADMIN_PW)) return serve_admin(path);
            
        
    }
    else if (req.method === 'POST') {
        if (path.includes('api')) {
            const res = await process_api(path, req);
            if (res) return res
        }
    }

    return new Response('404 Not Found', { status: 404 });
  }},
);

async function process_api(path: string, req: Request): Promise<Response | null> {
    if (path === '/api/getsession') {
        const params: Params = await req.json() as Params;
        const sessionid: number = generateSessionID(params);
                if (LOG_LVL >= 4) console.log(`${get_time()} Attempting to create session ${sessionid} with params: ${JSON.stringify(params)}`)
        const success: boolean = await newSession(sessionid, params);
                if (LOG_LVL >= 4) console.log(`${get_time()} Responding to getsession with: ${sessionid}`)
        if (success) return Response.json({ sessionid });
    }
    if (path === '/api/submitguess') {
        const guess: LocGuess = await req.json() as LocGuess;
        if (!validateSession(guess.sessionid)) return new Response('Invalid Session ID.', { status: 401 });

        const gameState: GameState = await getGameState(guess.sessionid);
        const dist: number = calcDist([gameState.correctx, gameState.correcty], [guess.xpos, guess.ypos]);
        const score_add: number = calcScore(dist);

        const [score, curr_round] = await advanceGameState(guess.sessionid, score_add);

        const res: LocResponse = {
            xpos: (gameState.difficulty !== 'impossible') ? gameState.correctx : null,
            ypos: (gameState.difficulty !== 'impossible') ? gameState.correcty : null,
            distance: Math.ceil(dist/1000),
            score: score,
            curr_round: curr_round
        }
                if (LOG_LVL >= 4) console.log(`${get_time()} Responding to submitguess with: ${JSON.stringify(res)}`)

        return Response.json(res);
    }
    if (path === '/api/killsession') {
        const { sessionid } = await req.json() as { sessionid: number };
        if (!validateSession(sessionid)) return new Response('Invalid Session ID.', { status: 401 });
        killSession(sessionid);
    }
    if (path === '/api/getpicture') {
        const { sessionid } = await req.json() as { sessionid: number };
        if (!validateSession(sessionid)) return new Response('Invalid Session ID.', { status: 401 });

        const pic = await getPicture(sessionid)
        if (LOG_LVL >= 4) console.log(`${get_time()} Responding to getpicture with: ${pic.type}`)
        return new Response(pic, {
            headers: {'Content-Type': 'image/avif'}
        })
    }
    if (path === `/${ADMIN_PW}/api/uploadpicture`) {
        const fd = await req.formData() as FormData;
        const locinfo = JSON.parse(fd.get('settings') as string) as LocInfo;
        const newImg = fd.get('image') as Blob;
        const success: boolean = await addLocation(locinfo, newImg);
                if (LOG_LVL >= 3) console.log(`${get_time()} New picture uploaded. Success = ${success}`);
        if (success) return new Response("Success", { status: 200 });
    }
    return null
}

async function serve_admin(path: string): Promise<Response> {
    path = path.slice(ADMIN_PW.length + 1)

    // Serve private files to authenticated users
    const filePath = `./private${path}`;
    const file = Bun.file(filePath);

    if (LOG_LVL >= 4) console.log(`${get_time()} Serving private page ${filePath}`)
    if (await file.exists()) return new Response(file);

    return new Response('Not Found', { status: 404 });
}

setInterval(async () => {
    if (LOG_LVL >= 3) console.log(`${get_time()} Running session garbage collection`);
    await garbageCollectSessions(60); // Delete all inactive for longer than 60 minutes
}, 1000 * 3600);

console.log(`${get_time()} MonGuessr LIVE on http://localhost:${port}`);
