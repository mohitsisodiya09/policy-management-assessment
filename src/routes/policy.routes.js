import express from 'express';
import * as policyController from '../controllers/policy.controller.js';
import validate from '../middleware/validate.js';
import { searchQuerySchema } from '../validators/policy.validator.js';

const router = express.Router();

router.get('/search', validate(searchQuerySchema, 'query'), policyController.searchByUsername);
router.get('/aggregate/by-user', policyController.aggregateByUser);

export default router;
