import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middlewares/auth";
import { ICalculatePricePayload, ICreateShipmentPayload, IShipmentFilterOptions, IUpdateShipmentPayload } from "./shipment.interface";
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
    if (!user || !user.userId) {
        throw new Error("You are not authorized. Please log in to access this resource.");
    }

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

    });

    await tx.shipmentLog.create({
        data : {
            shipmentId : shipment.id,
            fromStatus : 'ORDER_PLACED',
            toStatus : 'PAYMENT_PENDING',
            performedById :user.userId,
            remarks : 'Parcel Has Been Booked...It Is Waiting For Payment'
        }
    })

    return shipment
   })

}


 const getAllShipmentsFromDB = async(user: RequestUser, filters:IShipmentFilterOptions) =>{
    if (!user || !user.role) {
        throw new Error("You are not authorized. Please log in to access this resource.");
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const {status,searchTerm,sortBy = 'createdAt',sortOrder='desc'} = filters;


    const andConditions : any[] = [{deletedAt : null}];

    if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: user.userId } });
    andConditions.push({ customerId: customer?.id || 'NO_ACCESS' });
  } else if (user.role === 'COURIER') {
    andConditions.push({ courierId: user.userId });
  }


  if(status) {
    andConditions.push({status});
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { trackingNumber: { contains: searchTerm, mode: 'insensitive' } },
        { receiverPhone: { contains: searchTerm, mode: 'insensitive' } },
        { receiverName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  };

  const whereConditions = { AND: andConditions };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        originHub: { select: { name: true, code: true } },
        destinationHub: { select: { name: true, code: true } },
      },
    }),
    prisma.shipment.count({ where: whereConditions }),
  ]);



  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: shipments,
  };
 }


 const getShipmentByIdFromDB = async(user:RequestUser,shipmentId: string) =>{

    if (!user || !user.role) {
        throw new Error("You are not authorized. Please log in to access this resource.");
    }

    const shipment = await prisma.shipment.findFirst({
      where : {
        id : shipmentId,
        deletedAt:null
      },
      include : {
        originHub:true,
        destinationHub:true,
        customer: { select: { name: true, email: true, alternatePhone: true } },
      statusLogs: {
        orderBy: { createdAt: 'asc' },
        include: { performedBy: { select: { name: true, role: true } } },
      }}
    });

    if(!shipment){
      throw new Error("The Shipment Not Found")
    }

    if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: user.userId } });
    if (!customer || shipment.customerId !== customer.id) {
      throw new Error('Unauthorized Access');
    }
  }

 return shipment

 }


 const updateShipmentInDB = async(user :RequestUser,shipmentId:string,payload:IUpdateShipmentPayload)=>{

  const shipment = await prisma.shipment.findFirst({
    where : {
      id : shipmentId,
      deletedAt:null
    }
  });

  if(!shipment){
    throw new Error("Shipment Not Found")
  }

  if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: user.userId } });
    if (!customer || shipment.customerId !== customer.id) {
      throw new Error('UnAuthorized Access');
    }
  }

  if (!['ORDER_PLACED', 'PAYMENT_PENDING', 'PAID'].includes(shipment.status)) {
    throw new Error('Data Cannot Change During The Shipment');
  }

  return await prisma.shipment.update({
    where : {
      id :shipmentId
    },
    data: payload
  })



 }


 const cancelShipmentInDB = async(user :RequestUser,shipmentId:string)=>{
  const shipment = await prisma.shipment.findFirst({
    where : {
      id : shipmentId,
      deletedAt: null
    }
  });

  if(!shipment){
    throw new Error("Shipment Not Found");
  }

  if(user.role === "CUSTOMER"){
    const customer = await prisma.customer.findUnique({
      where : {userId: user.userId}
    });
    if(!customer || shipment.customerId === customer.id){
      throw new Error("Unauthorized Access")
    }
  }


  if (!['ORDER_PLACED', 'PAYMENT_PENDING', 'PAID'].includes(shipment.status)) {
    throw new Error(`This Parcel Is '${shipment.status}' In Condition, You Cannot Cancel It।`);
  }


  return await prisma.$transaction(async(tx)=>{
    const updated = await tx.shipment.update({
      where : {id :shipmentId},
      data : {status: 'CANCELLED'}
    });

    await tx.shipmentLog.create({
      data : {
        shipmentId,
        fromStatus:shipment.status,
        toStatus: 'CANCELLED',
        performedById:user.userId,
        remarks : 'Customer Cancel The Parcel By His Own'
      }
    });
    return updated
  })
 }


export const shipmentService = {
    calculateShipmentPriceFromDB,
    createShipmentIntoDB,
    getAllShipmentsFromDB,
    getShipmentByIdFromDB,
    updateShipmentInDB,
    cancelShipmentInDB
}