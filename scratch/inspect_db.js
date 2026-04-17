const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://spectre:5rLIPU4I1KKm@bmo.fixlo.co:55555/fixlo_db'
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('report_deposits', 'report_withdrawals')
    ORDER BY table_name, column_name
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
