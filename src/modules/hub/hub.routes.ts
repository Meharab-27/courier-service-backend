import { Router } from "express";
import { hubController } from "./hub.controller";

const router = Router();



router.post('/create', hubController.createHub);

router.get('/',hubController.getAllHubs);


router.get('/:id',hubController.getHubById)



export const hubRoutes = router