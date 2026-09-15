import { RulePack } from "../src/lib/schema.ts";
import rental from "../rules/rental.json";
import employment from "../rules/employment.json";

for (const [name, data] of [
  ["rental", rental],
  ["employment", employment],
] as const) {
  const result = RulePack.safeParse(data);
  if (!result.success) {
    console.error(`${name}.json FAILED validation:`);
    console.error(result.error.format());
    process.exitCode = 1;
    continue;
  }
  const ids = new Set<string>();
  let dupes = 0;
  for (const rule of result.data) {
    if (ids.has(rule.id)) {
      console.error(`${name}.json: duplicate rule id ${rule.id}`);
      dupes++;
    }
    ids.add(rule.id);
  }
  console.log(
    `${name}.json OK — ${result.data.length} rules, ${new Set(result.data.map((r) => r.clauseType)).size} clause types, ${dupes} duplicate ids`
  );
}
