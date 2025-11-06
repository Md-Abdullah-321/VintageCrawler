/**
 * Title: ScrapController.ts
 * Description: Manage scrap controller.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { NextFunction, Request, Response } from "express";
import { launchBrowser } from "../helpers/puppeteer-utils.js";
import { getJobStatus, jobs, startScraping } from "../Services/scrap.service.js";
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
    
    // Check for existing in-progress job
    let existingJob = null;
    for (const [jobId, job] of jobs.entries()) {
      if (method === "url") {
        if (job.url === url && job.status === "in progress") {
          existingJob = [jobId, job];
          break;
        }
      } else {
        if (
          job.make === make &&
          job.model === model &&
          job.site === site &&
          job.transmission === transmission &&
          job.status === "in progress"
        ) {
          existingJob = [jobId, job];
          break;
        }
      }
    }

    // Return existing job if duplicates NOT allowed
    if (existingJob && !keep_duplicates) {
      const [jobId] = existingJob;
      res.status(200).json({
        statusCode: 200,
        message: `Job ${jobId} already in progress for ${method === "url" ? url : `${make} ${model}`}`,
        payload: { jobId, source: method === "url" ? url : site },
      });
      return;
    }

    // Launch Puppeteer
    const browser = await launchBrowser(!debug_mode).catch((err: any) => {
      throw new Error(`Browser launch failed: ${err.message}`);
    });

    // Start scraping job (progress is set inside service)
    const response = await startScraping(
      method,
      url,
      make,
      model,
      transmission,
      site,
      Boolean(keep_duplicates),
      browser
    );

    if (response) {
      successResponse(res, response);
    }
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: `Controller error: ${error.message}`
    });
  }
};

// Get Job Logs
export const getJobLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({
        status: "error",
        message: "Job ID is required", 
      });
      return;
    }

    const job = getJobStatus(jobId);
    successResponse(res, {
      statusCode: 200,
      message: `Logs for job ${jobId}`,
      payload: {
        jobId,
        status: job.status,
        progress: job.progress,
        logs: job.logs || []
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: `Error fetching job logs: ${error.message}`
    });
  }
};
