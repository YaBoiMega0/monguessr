import { SQL } from "bun";

const LOG_LVL = Number.parseInt(Bun.env.LOG_LVL || '1')

async function getDB(): Promise<SQL> {
    return new SQL({
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

const db = await getDB();
const tagName = 'is_indoor';
const lid = 17;
await db.unsafe('UPDATE locations SET ' + tagName + ' = 1 WHERE id = ?', [lid]);
