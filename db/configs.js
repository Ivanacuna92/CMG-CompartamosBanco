// db/configs.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const clientePool = mysql.createPool({
  host: process.env.DB_c_HOST,
  port: Number(process.env.DB_c_PORT),
  user: process.env.DB_c_USER,
  password: process.env.DB_c_PASSWORD,
  database: process.env.DB_c_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Prueba de conexión directa
async function testConnection() {
  try {
    const [rows] = await clientePool.query("SELECT NOW() AS fecha");
    console.log("✅ Conexión MySQL exitosa:", rows[0].fecha);
  } catch (err) {
    console.error("❌ Error al conectar a MySQL:", err.message);
  }
}

// Ejecuta la prueba solo si se corre directamente este archivo
if (process.env.NODE_ENV !== "production") {
  testConnection();
}
