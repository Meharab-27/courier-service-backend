import cors from "cors";
import cookieParser from "cookie-parser";
import express, { Application, Request, Response } from "express";
import httpStatus from "http-status";
import config from "./config";
import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/user/user.routes";
import { customerRoutes } from "./modules/customer/customer.routes";
import { globalErrorHandler } from "./middlewares/globalErrorHandler";

const app: Application = express();

app.use(
  cors({
    origin: config.app_url || "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Root route check
app.get("/", (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Courier & Logistics Platform Backend API",
  });
});

// Application API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: "API Route Not Found",
  });
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;