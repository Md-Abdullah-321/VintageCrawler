/**
 * Title: ScrapRoutes.ts
 * Description: Manage scrap routes.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

// Dependencies
import express from "express";
import { startScrapingJob } from "../controllers/scrapController.js";

// Initialize router
const ScrapRoutes = express.Router();

// Import controllers

// Define routes
ScrapRoutes.post("/scrap", startScrapingJob);

// Export the router
export default ScrapRoutes;
