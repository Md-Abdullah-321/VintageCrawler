/**
 * Title: ScrapRoutes.ts
 * Description: Manage scrap routes.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */
// Dependencies
import express from "express";
import { startScrapingJob } from "../controllers/scrapController.js";
import { getJobStatus } from "../Services/scrap.service.js";
// Initialize router
const ScrapRoutes = express.Router();
// Define routes
ScrapRoutes.post("/scrape", startScrapingJob);
ScrapRoutes.get("/scrape/status/:jobId", (req, res) => {
    const { jobId } = req.params;
    const job = getJobStatus(jobId);
    res.json(job);
});
// Export the router
export default ScrapRoutes;
