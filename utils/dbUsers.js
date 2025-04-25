// utils/dbUsers.js
import { readFileSync } from "fs";

let dbUsers = [];
try {
  const data = readFileSync("db.json", "utf-8");
  dbUsers = JSON.parse(data);
} catch (error) {
  console.error("Error al cargar db.json:", error);
}

export { dbUsers };
