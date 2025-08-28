/**
 * Title: ScrapController.ts
 * Description: Manage scrap controller.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

// Dependencies
import { NextFunction, Request, Response } from "express";

// Start Scraping Job
export const startScrapingJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { make, model, keep_duplicates, debug_mode } = req.body;

    // Validate required fields
    if (!make || !model) {
      return res.status(400).json({
        status: "error",
        message: "Make and model are required fields.",
      });
    }
  } catch (error) {
    next(error);
  }
};
