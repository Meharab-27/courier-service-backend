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


export const createShipment = catchAsync(async (req: Request, res: Response) => {

  const user = req.user!
   const payload = req.body

  const result = await shipmentService.createShipmentIntoDB(user, payload);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Parcel Has Been Booked Successfully.Please Pay For the Shipment',
    data: result,
  });
});

export const shipmentController = {
    calculatePrice,
    createShipment
}