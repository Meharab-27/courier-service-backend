import { Router } from "express";
import { shipmentController } from "./shipment.controller";

const router = Router();


router.post('/calculate-price', shipmentController.calculatePrice)

export const shipmentRoutes = router