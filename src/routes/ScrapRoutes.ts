/**
 * Title: ScrapRoutes.ts
 * Description: Manage scrap routes.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

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
ScrapRoutes.delete("/jobs/clear", async (_req, res) => {
  try {
    await clearAllJobs();
    res.json({ success: true, message: "All jobs cleared" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || "Failed to clear jobs" });
  }
});

export default ScrapRoutes;
