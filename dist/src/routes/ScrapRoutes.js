/**
 * Title: ScrapRoutes.ts
 * Description: Manage scrap routes.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Dependencies
import express from "express";
import multer from "multer";
import { getJobLogs, startScrapingJob } from "../controllers/scrapController.js"; // Added getJobLogs if needed
import { clearAllJobs, getAllJobs, getJobStatus } from "../Services/scrap.service.js";
// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });
// Initialize router
const ScrapRoutes = express.Router();
// Define routes
ScrapRoutes.post("/scrape", upload.single("excel_file"), startScrapingJob);
ScrapRoutes.get("/scrape/status/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = getJobStatus(jobId);
    res.json(job);
});
ScrapRoutes.get("/jobs", (_req, res) => {
    const data = getAllJobs();
    res.json({ success: true, payload: data });
});
// Optional: Add logs route if implemented
ScrapRoutes.get("/scrape/logs/:jobId", getJobLogs);
ScrapRoutes.delete("/jobs/clear", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield clearAllJobs();
        res.json({ success: true, message: "All jobs cleared" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to clear jobs" });
    }
}));
export default ScrapRoutes;
