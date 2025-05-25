import {createConfig} from "ponder";
import {getBaseConfig} from "./base-ponder.config";

export default createConfig({
  database: {
    kind: "pglite",
  },
  ...getBaseConfig(),
});