import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { authValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.customerRegistrationZodSchema),
  authController.registerUser
);
router.post("/login", authController.loginUser);
router.post("/refresh-token", authController.refreshToken);

router.post("/google", authController.googleLogin);

export const authRoutes = router;