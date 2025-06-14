import {createConfig} from "ponder";
import {getBaseConfig} from "./base-ponder.config";
import dotenv from "dotenv";

dotenv.config();

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  ...getBaseConfig(),
});
