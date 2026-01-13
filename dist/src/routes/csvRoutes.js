/**
 * Title: CSV Routes
 * Description: Routes for handling CSV and ZIP file listings and deletion
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
import { getJobStatus, removeJobByFileName } from "../Services/scrap.service.js";
import { successResponse } from "../controllers/responseController.js";
const csvRoutes = Router();
const outputDir = path.join(process.cwd(), "output");
csvRoutes.get("/csv", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        try {
            yield fs.access(outputDir);
        }
        catch (_a) {
            console.log("Output directory does not exist or is inaccessible");
            return successResponse(res, {
                statusCode: 200,
                message: "No files yet",
                payload: [],
            });
        }
        const files = (yield fs.readdir(outputDir)).filter((f) => f.endsWith(".csv") || f.endsWith(".zip"));
        const fileDetails = yield Promise.all(files.map((file) => __awaiter(void 0, void 0, void 0, function* () {
            const filePath = path.join(outputDir, file);
            const stats = yield fs.stat(filePath);
            const jobId = file.replace(/\.csv|\.zip$/, "");
            const job = getJobStatus(jobId); // Fetch job metadata from scrap.service.ts
            return {
                fileName: file,
                startedAt: job.startedAt || stats.birthtime.toISOString(), // Use startedAt or fallback to createdAt
            };
        })));
        fileDetails.sort((a, b) => new Date(b.startedAt || 0).getTime() -
            new Date(a.startedAt || 0).getTime());
        return successResponse(res, {
            statusCode: 200,
            message: "Files retrieved successfully",
            payload: fileDetails,
        });
    }
    catch (err) {
        console.error("❌ Error listing files:", err);
        res.status(500).json({ message: "Failed to list files" });
    }
}));
// New DELETE route for files
csvRoutes.delete("/delete/:filename", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { filename } = req.params;
    // Basic path traversal guard
    if (filename.includes("..") || filename.includes("/")) {
        return res.status(400).json({ message: "Invalid filename" });
    }
    const filePath = path.join(outputDir, filename);
    try {
        yield fs.access(filePath);
        yield fs.unlink(filePath);
        yield removeJobByFileName(filename);
        return successResponse(res, {
            statusCode: 200,
            message: "File deleted successfully",
            payload: { filename },
        });
    }
    catch (err) {
        console.error("❌ Error deleting file:", err);
        const status = (err === null || err === void 0 ? void 0 : err.code) === "ENOENT" ? 404 : 500;
        return res.status(status).json({ message: "File not found" });
    }
}));
export default csvRoutes;
