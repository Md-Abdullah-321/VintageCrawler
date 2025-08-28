/**
 * Title: Response controller
 * Description: Create default response for request success and error.
 * Author: Md Abdullah
 * Date: 06/10/2024
 */

import { Response } from "express";

export const errorResponse = (
  res: Response,
  { statusCode = 500, message = "Internal Server Error" }
) => {
  return res.status(statusCode).json({
    success: false,
    messege: message,
  });
};

export const successResponse = (
  res: Response,
  { statusCode = 200, message = "Success", payload = {} }
) => {
  return res.status(statusCode).json({
    success: true,
    messege: message,
    payload,
  });
};
