import {createConfig} from "ponder";
import {getBaseConfig} from "./base-ponder.config";

export default createConfig({
    database: {
        kind: "postgres",
        connectionString: process.env.PONDER_DATABASE_URL,
    },
    ...getBaseConfig(),
});