import {createConfig} from "ponder";
import {getBaseConfig} from "./base-ponder.config";
import * as fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

export default createConfig({
    database: {
        kind: "postgres",
        connectionString: process.env.PONDER_DATABASE_URL,
        poolConfig: {
            ssl: {
                ca: fs.readFileSync(process.env.PONDER_DATABASE_CA).toString()
            }
        }
    },
    ...getBaseConfig(),
});