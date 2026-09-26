import { MESSAGES } from '../constants/messages.js';
import * as policyService from '../services/policy.service.js';

export async function searchByUsername(req, res, next) {
  try {
    const result = await policyService.searchPoliciesByUsername(req.query);

    return res.success(MESSAGES.POLICY_SEARCH_SUCCESS, result);
  } catch (error) {
    return next(error);
  }
}

export async function aggregateByUser(req, res, next) {
  try {
    const result = await policyService.getAggregatedPoliciesByUser();

    return res.success(MESSAGES.POLICY_AGGREGATE_SUCCESS, result);
  } catch (error) {
    return next(error);
  }
}
