import { query } from "../src/lib/db";

async function check() {
  try {
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `);
    console.log("Transactions Columns:");
    console.table(res.rows);

    const res2 = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'report_summary_daily'
    `);
    console.log("\nReport Summary Daily Columns:");
    console.table(res2.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
