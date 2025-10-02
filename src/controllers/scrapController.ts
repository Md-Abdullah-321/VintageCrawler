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
      make,
      model,
      transmission,
      site,
      keep_duplicates = false,
      debug_mode = false,
    } = req.body;

    // Validate required fields
    if (!make || !model) {
      res.status(400).json({
        status: "error",
        message: "Make and model are required fields.",
      });
      return;
    }

    // Start a scraping job
    const response = await startScraping(
      make,
      model,
      transmission,
      site,
      Boolean(keep_duplicates),
      Boolean(debug_mode)
    );

    successResponse(res, response);
  } catch (error) {
    next(error);
  }
};