import { query } from "@/lib/db";

async function main() {
  const result = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'report_deposits'
  `);
  console.log(
    "Columns in report_deposits:",
    result.rows.map((r) => r.column_name),
  );
}

main();
