import express from "express";
import path from "path";

import chatRoutes   from "./chat.js";
import chatPruebas  from "./chatPruebas.js"; // nueva ruta
import reportRoutes from "./reports.js";

const router = express.Router();
const publicDir = path.join(process.cwd(), "public");

// Páginas HTML
router.get("/",        (req, res) => res.sendFile(path.join(publicDir, "index.html")));
router.get("/reporte", (req, res) => res.sendFile(path.join(publicDir, "reporte.html")));
router.get("/pruebas", (req, res) => {
  res.sendFile(path.join(publicDir, "pruebas.html"));
});

// Rutas funcionales
router.use("/", chatRoutes);            // Chat normal (MySQL)
router.use("/pruebas", chatPruebas);    // Chat alternativo (SQLite)
router.use("/api", reportRoutes);       // Reportes

export default router;
