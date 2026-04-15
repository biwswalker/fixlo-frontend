
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://spectre:5rLIPU4I1KKm@bmo.fixlo.co:5432/fixlo_db'
});

async function check() {
  try {
    const res = await pool.query('SELECT id, image_path FROM transaction WHERE image_path IS NOT NULL LIMIT 1');
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
