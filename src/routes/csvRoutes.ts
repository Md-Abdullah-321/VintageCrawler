/**
 * Title: CSV Routes
 * Description: Routes for handling CSV and ZIP file listings and deletion
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { getJobStatus, removeJobByFileName } from "../Services/scrap.service.js";
import { successResponse } from "../controllers/responseController.js";

const csvRoutes = Router();
const outputDir = path.join(process.cwd(), "output");

interface FileDetail {
  fileName: string;
  startedAt: string | null;
}

csvRoutes.get("/csv", async (_req, res) => {
  try {
    try {
      await fs.access(outputDir);
    } catch {
      console.log("Output directory does not exist or is inaccessible");
      return successResponse(res, {
        statusCode: 200,
        message: "No files yet",
        payload: [],
      });
    }

    const files = (await fs.readdir(outputDir)).filter(
      (f) => f.endsWith(".csv") || f.endsWith(".zip")
    );

    const fileDetails: FileDetail[] = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);
        const jobId = file.replace(/\.csv|\.zip$/, "");
        const job = getJobStatus(jobId); // Fetch job metadata from scrap.service.ts
        return {
          fileName: file,
          startedAt: job.startedAt || stats.birthtime.toISOString(), // Use startedAt or fallback to createdAt
        };
      })
    );

    fileDetails.sort(
      (a, b) =>
        new Date(b.startedAt || 0).getTime() -
        new Date(a.startedAt || 0).getTime()
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Files retrieved successfully",
      payload: fileDetails,
    });
  } catch (err) {
    console.error("❌ Error listing files:", err);
    res.status(500).json({ message: "Failed to list files" });
  }
});

// New DELETE route for files
csvRoutes.delete("/delete/:filename", async (req, res) => {
  const { filename } = req.params;

  // Basic path traversal guard
  if (filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  const filePath = path.join(outputDir, filename);

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    await removeJobByFileName(filename);
    return successResponse(res, {
      statusCode: 200,
      message: "File deleted successfully",
      payload: { filename },
    });
  } catch (err) {
    console.error("❌ Error deleting file:", err);
    const status = (err as any)?.code === "ENOENT" ? 404 : 500;
    return res.status(status).json({ message: "File not found" });
  }
});

export default csvRoutes;
