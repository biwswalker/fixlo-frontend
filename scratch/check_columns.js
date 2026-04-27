const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `);
    console.log("Transactions Columns:");
    console.table(res.rows);

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'report_summary_daily'
    `);
    console.log("\nReport Summary Daily Columns:");
    console.table(res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
