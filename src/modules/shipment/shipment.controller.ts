import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { shipmentService } from "./shipment.service";

const calculatePrice = catchAsync(async (req: Request, res: Response) => {

    const payload = req.body
  const result = await shipmentService.calculateShipmentPriceFromDB(payload);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Price Calculated Successfully',
    data: result,
  });
});

export const shipmentController = {
    calculatePrice
}