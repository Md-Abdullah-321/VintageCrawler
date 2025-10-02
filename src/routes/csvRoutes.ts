/**
 * Title: CSV Routes
 * Description: Routes for handling CSV file listings
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { Router } from "express";
import fs from "fs/promises";
import path from "path";

const csvRoutes = Router();
const outputDir = path.join(process.cwd(), "output");

interface FileDetail {
  fileName: string;
  createdAt: string;
}

csvRoutes.get("/csv", async (req, res) => {
  try {
    try {
      await fs.access(outputDir);
    } catch {
      console.log("Output directory does not exist or is inaccessible");
      return res.json([]);
    }

    const files = (await fs.readdir(outputDir)).filter((f) => f.endsWith(".csv"));

    const fileDetails: FileDetail[] = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);
        return {
          fileName: file,
          createdAt: stats.birthtime.toISOString(),
        };
      })
    );

    fileDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(fileDetails);
  } catch (err) {
    console.error("❌ Error listing CSVs:", err);
    res.status(500).json({ message: "Failed to list CSVs" });
  }
});

export default csvRoutes;