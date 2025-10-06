/**
 * Title: CSV Routes
 * Description: Routes for handling CSV file listings
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
import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { getJobStatus } from "../Services/scrap.service.js";
const csvRoutes = Router();
const outputDir = path.join(process.cwd(), "output");
csvRoutes.get("/csv", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        try {
            yield fs.access(outputDir);
        }
        catch (_a) {
            console.log("Output directory does not exist or is inaccessible");
            return res.json([]);
        }
        const files = (yield fs.readdir(outputDir)).filter((f) => f.endsWith(".csv"));
        const fileDetails = yield Promise.all(files.map((file) => __awaiter(void 0, void 0, void 0, function* () {
            const filePath = path.join(outputDir, file);
            const stats = yield fs.stat(filePath);
            const jobId = file.replace(".csv", "");
            const job = getJobStatus(jobId); // Fetch job metadata from scrap.service.ts
            return {
                fileName: file,
                startedAt: job.startedAt || stats.birthtime.toISOString() // Use startedAt or fallback to createdAt
            };
        })));
        fileDetails.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
        res.json(fileDetails);
    }
    catch (err) {
        console.error("❌ Error listing CSVs:", err);
        res.status(500).json({ message: "Failed to list CSVs" });
    }
}));
export default csvRoutes;
