/**
 * Title: app.ts
 * Description: Create server, serve dashboard, CSVs, and APIs.
 * Author: Md Abdullah
 * Date: 03/10/2024
 */
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { errorResponse } from "./controllers/responseController.js";
import ScrapRoutes from "./routes/ScrapRoutes.js";
import csvRoutes from "./routes/csvRoutes.js";
const app = express();
// ✅ Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// -------------------- Global Middleware --------------------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// -------------------- Test API --------------------
app.get("/test", (_req, res) => {
    res.send({ message: "Welcome to Vintage Crawler!" });
});
// -------------------- API Routes --------------------
app.use("/api/v1", ScrapRoutes);
app.use("/api/v1", csvRoutes);
// -------------------- Serve CSVs --------------------
// Serve CSVs from project root `output` folder
app.use("/output", express.static(path.join(__dirname, "../output")));
// Optional: Force download route
app.get("/download/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "../output", filename);
    res.download(filePath, filename, (err) => {
        if (err)
            res.status(404).send("File not found");
    });
});
// -------------------- Serve Dashboard --------------------
app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});
// -------------------- Global Error Handler --------------------
const errorHandler = (err, req, res, next) => {
    errorResponse(res, {
        statusCode: err.statusCode || 500,
        message: err.message || "Internal Server Error!",
    });
};
app.use(errorHandler);
export default app;
