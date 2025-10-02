/**
 * Title: app.js
 * Description: Create server and return index to run it.
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
//Handle Global Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
//Test API
app.get("/test", (req, res) => {
    res.send({
        message: "Welcome to Vintage Crawler!",
    });
});
// -------------------- API Routes --------------------
app.use("/api/v1", ScrapRoutes);
// -------------------- CSV Routes --------------------
app.use("/api/v1", csvRoutes);
// Serve CSVs from the output folder
app.use("/output", express.static(path.join(__dirname, "output")));
// -------------------- Serve Dashboard --------------------
app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});
//Handle Global Middleware
const errorHandler = (err, req, res, next) => {
    errorResponse(res, {
        statusCode: err.statusCode || 500,
        message: err.message || "Internal Server Error!",
    });
    return;
};
app.use(errorHandler);
export default app;
