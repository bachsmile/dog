const { Client } = require('pg');

async function clean() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '753951',
    database: 'law',
  });
  try {
    await client.connect();
    console.log('Connected to database. Dropping schema...');
    // Drop all tables in public schema by dropping and recreating schema
    await client.query(`DROP SCHEMA public CASCADE;`);
    await client.query(`CREATE SCHEMA public;`);
    await client.query(`GRANT ALL ON SCHEMA public TO postgres;`);
    await client.query(`GRANT ALL ON SCHEMA public TO public;`);
    console.log('Database cleaned successfully. Tables will be recreated on next app start.');
  } catch (err) {
    console.error('Error cleaning database:', err);
  } finally {
    await client.end();
  }
}

clean();
