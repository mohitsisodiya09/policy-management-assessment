import { MESSAGES } from '../constants/messages.js';
import { Policy, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Search policy info by username (firstName) and/or email.
 * Query fields are already trimmed / escaped / normalized by the validator.
 */
export async function searchPoliciesByUsername({ username, email }) {
  const userFilter = {};
  if (username) {
    userFilter.firstName = new RegExp(`^${username}$`, 'i');
  }
  if (email) {
    userFilter.email = email;
  }

  const users = await User.find(userFilter).select('_id').lean();
  if (!users.length) {
    throw new ApiError(404, MESSAGES.POLICY_USER_NOT_FOUND);
  }

  const policies = await Policy.find({
    userId: { $in: users.map((user) => user._id) },
  })
    .populate([
      {
        path: 'userId',
        select: 'firstName email phoneNumber state zipCode userType gender dob address',
      },
      { path: 'policyCategoryId', select: 'categoryName' },
      { path: 'companyCollectionId', select: 'companyName' },
      { path: 'agentId', select: 'agentName' },
      { path: 'accountId', select: 'accountName' },
    ])
    .select('policyNumber policyStartDate policyEndDate userId policyCategoryId companyCollectionId agentId accountId')
    .lean();

  return {
    policies: policies.map((policy) => ({
      policyNumber: policy.policyNumber,
      policyStartDate: policy.policyStartDate,
      policyEndDate: policy.policyEndDate,
      user: policy.userId,
      category: policy.policyCategoryId,
      carrier: policy.companyCollectionId,
      agent: policy.agentId,
      account: policy.accountId,
    })),
  };
}

/**
 * Aggregated policies grouped by each user.
 */
export async function getAggregatedPoliciesByUser() {
  const users = await Policy.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $lookup: {
        from: 'lobs',
        localField: 'policyCategoryId',
        foreignField: '_id',
        as: 'lob',
      },
    },
    {
      $lookup: {
        from: 'carriers',
        localField: 'companyCollectionId',
        foreignField: '_id',
        as: 'carrier',
      },
    },
    {
      $group: {
        _id: '$userId',
        firstName: { $first: '$user.firstName' },
        email: { $first: '$user.email' },
        totalPolicies: { $sum: 1 },
        policies: {
          $push: {
            policyNumber: '$policyNumber',
            policyStartDate: '$policyStartDate',
            policyEndDate: '$policyEndDate',
            category: { $arrayElemAt: ['$lob.categoryName', 0] },
            carrier: { $arrayElemAt: ['$carrier.companyName', 0] },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        firstName: 1,
        email: 1,
        totalPolicies: 1,
        policies: 1,
      },
    },
    { $sort: { totalPolicies: -1, firstName: 1 } },
  ]);

  return { users };
}
