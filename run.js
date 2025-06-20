import Schemas, {initDB} from "./index.js";

(async () => {
  const schemas = await Schemas;
  await initDB('walgreens', false);
})();
