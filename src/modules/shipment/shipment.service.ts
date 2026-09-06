import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middlewares/auth";
import { ICalculatePricePayload, ICreateShipmentPayload } from "./shipment.interface";
import { computeShipmentCost, generateTrackingNumber } from "./shipment.utils";


const calculateShipmentPriceFromDB = async(payload: ICalculatePricePayload)=>{
   
   
   
    const [originHub, destHub] = await Promise.all([
    prisma.hub.findFirst({ where: { id: payload.originHubId, deletedAt: null } }),
    prisma.hub.findFirst({ where: { id: payload.destinationHubId, deletedAt: null } }),
  
]);

   if(!originHub || !destHub){

    throw new Error("Sender Or Recierver is Not Right Or Currently off")
   }

   const isSameZone = originHub.zone.toLowerCase() === destHub.zone.toLowerCase()

   
   return computeShipmentCost({
    weightKg: Number(payload.weightKg),
    lengthCm: Number(payload.lengthCm),
    widthCm: Number(payload.widthCm),
    heightCm: Number(payload.heightCm),
    isSameZone,
    isFragile: payload.isFragile,
  });

}


const createShipmentIntoDB = async(user : RequestUser,payload:ICreateShipmentPayload) =>{
    const customer = await prisma.customer.findUnique({
        where : {
            userId : user.userId
        }
    })

    if(!customer){
        throw new Error("Customer Profile Not Found");
    }

    const [originHub, destHub] = await Promise.all([
    prisma.hub.findFirst({ where: { id: payload.originHubId, deletedAt: null } }),
    prisma.hub.findFirst({ where: { id: payload.destinationHubId, deletedAt: null } }),
  ]);

  if(!originHub || !destHub){
    throw new Error("Selected Hub Is Wrong")
  
}

const isSameZone = originHub.zone.toLowerCase() === destHub.zone.toLowerCase()



   const priceDetails = computeShipmentCost({
    weightKg : Number(payload.weightKg),
    lengthCm : Number(payload.lengthCm),
    widthCm: Number(payload.widthCm),
    heightCm: Number(payload.heightCm),
    isSameZone,
    isFragile: payload.isFragile,
   })


   const trackingNumber = generateTrackingNumber();

   return await prisma.$transaction(async(tx)=>{
    const shipment = await prisma.shipment.create({
        data : {
            trackingNumber,
            customerId: customer.id,
            originHubId : payload.originHubId,
            destinationHubId: payload.destinationHubId,
            senderName: payload.senderName,
            senderPhone : payload.senderPhone,
            senderAddress:payload.senderAddress,
            receiverName:payload.receiverName,
            receiverPhone:payload.receiverPhone,
            receiverAddress:payload.receiverAddress,
            weightKg:priceDetails.actualWeightKg,
            lengthCm: Number(payload.lengthCm),
            widthCm : Number(payload.widthCm),
            heightCm : Number(payload.heightCm),
            chargeableWeightKg:priceDetails.chargeableWeightKg,
            baseFare : priceDetails.baseFare,
            surcharge : priceDetails.surcharge,
            totalCost:priceDetails.surcharge,
            status:'PAYMENT_PENDING',
            deliveryNotes:payload.deliveryNotes || null

        },
        include: {
        originHub: { select: { name: true, code: true, zone: true } },
        destinationHub: { select: { name: true, code: true, zone: true } },
      },

    })
   })
}

export const shipmentService = {
    calculateShipmentPriceFromDB
}