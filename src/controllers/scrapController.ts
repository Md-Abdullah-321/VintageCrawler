/**
 * Title: ScrapController.ts
 * Description: Manage scrap controller.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

// Dependencies
import { NextFunction, Request, Response } from "express";
import { startScraping } from "../Services/scrap.service.js";
import { successResponse } from "./responseController.js";

// Start Scraping Job
export const startScrapingJob = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      method,
      make = "",
      model = "",
      transmission = "",
      site = "",
      keep_duplicates = false,
      debug_mode = false,
      url = "",
    } = req.body;

    // Validate required fields
    if ((method === "url" && !url) || (method === "make_model" && (!make || !model))) {
      res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
      return;
    }
    
    // Start a scraping job
    const response = await startScraping(
      method,
      url,
      make,
      model,
      transmission,
      site,
      Boolean(keep_duplicates),
      Boolean(debug_mode)
    );

    if (response) {
      successResponse(res, response);
    }
  } catch (error) {
    next(error);
  }
};