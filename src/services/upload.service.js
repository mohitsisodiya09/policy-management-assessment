import fs from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { MESSAGES } from '../constants/messages.js';
import { Account, Agent, Carrier, LOB, Policy, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const WORKER_URL = new URL('../workers/fileParser.worker.js', import.meta.url);

export function parseFileInWorker(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, {
      workerData: { filePath },
    });

    let settled = false;

    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    worker.on('message', (message) => {
      settled = true;
      if (message.success) {
        resolve(message.data);
        return;
      }
      reject(new ApiError(400, message.error?.message || MESSAGES.UPLOAD_PARSE_FAILED));
    });

    worker.on('error', (error) => {
      fail(new ApiError(500, MESSAGES.UPLOAD_WORKER_ERROR(error.message)));
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        fail(new ApiError(500, MESSAGES.UPLOAD_WORKER_EXIT(code)));
      }
    });
  });
}

function userLookupKey(user) {
  if (user.email) {
    return `email:${user.email.toLowerCase()}`;
  }
  return `fallback:${user.firstName}|${user.phoneNumber}|${user.dob || ''}`;
}

/**
 * Upsert with one retry when a parallel insert races a unique index (E11000).
 */
async function findOneAndUpsert(Model, filter, update) {
  try {
    return await Model.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }
    return Model.findOneAndUpdate(filter, update, { new: true });
  }
}

async function upsertByUniqueField(Model, items, fieldName) {
  const map = new Map();

  await Promise.all(
    items.map(async (item) => {
      const value = item[fieldName];
      const doc = await findOneAndUpsert(Model, { [fieldName]: value }, { $setOnInsert: { [fieldName]: value } });
      map.set(value, doc._id);
    })
  );

  return map;
}

async function upsertUsers(users) {
  const map = new Map();

  await Promise.all(
    users.map(async (item) => {
      const email = item.email ? item.email.toLowerCase() : '';
      const filter = email
        ? { email }
        : {
            firstName: item.firstName,
            phoneNumber: item.phoneNumber,
            dob: item.dob ? new Date(item.dob) : null,
          };

      const doc = await findOneAndUpsert(User, filter, {
        $set: {
          firstName: item.firstName,
          dob: item.dob ? new Date(item.dob) : null,
          address: item.address,
          phoneNumber: item.phoneNumber,
          state: item.state,
          zipCode: item.zipCode,
          email,
          gender: item.gender,
          userType: item.userType,
        },
      });

      map.set(userLookupKey(item), doc._id);
    })
  );

  return map;
}

async function upsertAccounts(accounts, userIdByKey) {
  const map = new Map();

  await Promise.all(
    accounts.map(async (item) => {
      const userId = userIdByKey.get(item.userKey) || null;
      const doc = await findOneAndUpsert(
        Account,
        { accountName: item.accountName },
        { $set: { accountName: item.accountName, userId } }
      );
      map.set(item.accountName, doc._id);
    })
  );

  return map;
}

async function upsertPolicies(policies, maps) {
  const results = await Promise.all(
    policies.map(async (item) => {
      const userId = maps.users.get(item.userKey);
      const policyCategoryId = maps.lobs.get(item.categoryName);
      const companyCollectionId = maps.carriers.get(item.companyName);

      if (!userId || !policyCategoryId || !companyCollectionId) {
        logger.warn({ policyNumber: item.policyNumber }, 'Skipping policy due to missing refs');
        return 0;
      }

      await findOneAndUpsert(
        Policy,
        { policyNumber: item.policyNumber },
        {
          $set: {
            policyNumber: item.policyNumber,
            policyStartDate: item.policyStartDate ? new Date(item.policyStartDate) : null,
            policyEndDate: item.policyEndDate ? new Date(item.policyEndDate) : null,
            policyCategoryId,
            companyCollectionId,
            userId,
            agentId: maps.agents.get(item.agentName) || null,
            accountId: maps.accounts.get(item.accountName) || null,
          },
        }
      );

      return 1;
    })
  );

  return results.reduce((sum, value) => sum + value, 0);
}

async function cleanupUpload(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn({ err: error, filePath }, 'Failed to remove uploaded file');
  }
}

export async function ingestUploadedFile(file) {
  const startedAt = Date.now();

  try {
    const parsed = await parseFileInWorker(file.path);

    // Independent collections can upsert in parallel.
    const [agentIds, lobIds, carrierIds, userIds] = await Promise.all([
      upsertByUniqueField(Agent, parsed.agents, 'agentName'),
      upsertByUniqueField(LOB, parsed.lobs, 'categoryName'),
      upsertByUniqueField(Carrier, parsed.carriers, 'companyName'),
      upsertUsers(parsed.users),
    ]);

    const accountIds = await upsertAccounts(parsed.accounts, userIds);
    const policyCount = await upsertPolicies(parsed.policies, {
      agents: agentIds,
      lobs: lobIds,
      carriers: carrierIds,
      users: userIds,
      accounts: accountIds,
    });

    return {
      durationMs: Date.now() - startedAt,
      file: {
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
      stats: {
        ...parsed.stats,
        policiesUpserted: policyCount,
      },
    };
  } finally {
    await cleanupUpload(file.path);
  }
}
