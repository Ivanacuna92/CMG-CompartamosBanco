// utils/dbClient.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,     // 198.59.144.181
  port: Number(process.env.DB_PORT), // 2083
  user: process.env.DB_USER,     // cyfsaaic_nrfm
  password: process.env.DB_PASSWORD, // e)O6URjsJ7fy
  database: process.env.DB_NAME, // cyfsaaic_nrfm
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
