import { Router } from "express";
import { Role } from "@prisma/client";
import { auth } from "../../middlewares/auth";
import { shipmentController } from "./shipment.controller";

const router = Router();


router.post('/calculate-price', shipmentController.calculatePrice)

router.post('/create-shipment', auth(Role.CUSTOMER), shipmentController.createShipment)

export const shipmentRoutes = router