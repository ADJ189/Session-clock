// Node's built-in test runner does not resolve extensionless TypeScript
// imports, while `src/` uses them the way Vite does. Register a resolve hook
// so `npm run test:unit` loads the same sources the production bundle uses.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
