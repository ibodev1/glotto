import { z } from "zod";
import { configSchema } from "../src/config.ts";

const OUTPUT = new URL("../schema/glotto.schema.json", import.meta.url);

const schema = {
  ...z.toJSONSchema(configSchema, { io: "input" }),
  $id: "https://raw.githubusercontent.com/ibodev1/glotto/main/schema/glotto.schema.json",
  title: "Glotto config",
  description:
    "Configuration for the Glotto CLI. Command-line flags override these values.",
};

await Bun.write(OUTPUT, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Schema written to ${Bun.fileURLToPath(OUTPUT)}`);
