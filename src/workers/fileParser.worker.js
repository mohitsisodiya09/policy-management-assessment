import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { parse } from 'csv-parse/sync';
import XLSX from 'xlsx';

const REQUIRED_FIELDS = ['policy_number', 'firstname', 'category_name', 'company_name'];

const FIELD_ALIASES = {
  agent: ['agent', 'agent_name'],
  firstname: ['firstname', 'first_name', 'first'],
  dob: ['dob', 'date_of_birth'],
  address: ['address'],
  phone: ['phone', 'phone_number', 'phonenumber'],
  state: ['state'],
  zip: ['zip', 'zip_code', 'zipcode'],
  email: ['email'],
  gender: ['gender'],
  usertype: ['usertype', 'user_type'],
  account_name: ['account_name', 'accountname'],
  category_name: ['category_name', 'categoryname', 'lob'],
  company_name: ['company_name', 'companyname', 'carrier'],
  policy_number: ['policy_number', 'policynumber'],
  policy_start_date: ['policy_start_date', 'policystartdate', 'start_date'],
  policy_end_date: ['policy_end_date', 'policyenddate', 'end_date'],
};

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function buildHeaderMap(headers) {
  const normalized = headers.map(normalizeHeader);
  const map = {};

  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index !== -1) {
      map[canonical] = headers[index];
    }
  }

  return map;
}

function pick(row, headerMap, key) {
  const header = headerMap[key];
  if (!header) return '';

  const value = row[header];
  if (value === undefined || value === null) return '';

  return String(value).trim();
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const asString = String(value).trim();
  if (!asString) return null;

  // Excel serial date support
  if (/^\d+(\.\d+)?$/.test(asString)) {
    const serial = Number(asString);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + serial * 24 * 60 * 60 * 1000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }

  const date = new Date(asString);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return parse(fs.readFileSync(filePath, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error('Workbook has no sheets');
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
    });
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}

function buildUserKey({ email, firstName, phoneNumber, dob }) {
  if (email) {
    return `email:${email.toLowerCase()}`;
  }
  return `fallback:${firstName}|${phoneNumber}|${dob || ''}`;
}

function emptyResult() {
  return {
    agents: [],
    users: [],
    accounts: [],
    lobs: [],
    carriers: [],
    policies: [],
    stats: { totalRows: 0, skippedRows: 0 },
  };
}

function transformRows(rows) {
  if (!rows.length) {
    return emptyResult();
  }

  const headerMap = buildHeaderMap(Object.keys(rows[0]));
  const missing = REQUIRED_FIELDS.filter((field) => !headerMap[field]);

  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  const agents = new Map();
  const users = new Map();
  const accounts = new Map();
  const lobs = new Map();
  const carriers = new Map();
  const policies = new Map();
  let skippedRows = 0;

  for (const row of rows) {
    const policyNumber = pick(row, headerMap, 'policy_number');
    const firstName = pick(row, headerMap, 'firstname');
    const categoryName = pick(row, headerMap, 'category_name');
    const companyName = pick(row, headerMap, 'company_name');

    if (!policyNumber || !firstName || !categoryName || !companyName) {
      skippedRows += 1;
      continue;
    }

    const agentName = pick(row, headerMap, 'agent') || 'Unknown Agent';
    const accountName = pick(row, headerMap, 'account_name') || `${firstName} Account`;
    const email = pick(row, headerMap, 'email').toLowerCase();

    const user = {
      firstName,
      dob: parseDate(pick(row, headerMap, 'dob')),
      address: pick(row, headerMap, 'address'),
      phoneNumber: pick(row, headerMap, 'phone'),
      state: pick(row, headerMap, 'state'),
      zipCode: pick(row, headerMap, 'zip'),
      email,
      gender: pick(row, headerMap, 'gender'),
      userType: pick(row, headerMap, 'usertype'),
    };

    const key = buildUserKey(user);

    agents.set(agentName, { agentName });
    users.set(key, user);
    accounts.set(accountName, { accountName, userKey: key });
    lobs.set(categoryName, { categoryName });
    carriers.set(companyName, { companyName });
    policies.set(policyNumber, {
      policyNumber,
      policyStartDate: parseDate(pick(row, headerMap, 'policy_start_date')),
      policyEndDate: parseDate(pick(row, headerMap, 'policy_end_date')),
      agentName,
      accountName,
      categoryName,
      companyName,
      userKey: key,
    });
  }

  return {
    agents: [...agents.values()],
    users: [...users.values()],
    accounts: [...accounts.values()],
    lobs: [...lobs.values()],
    carriers: [...carriers.values()],
    policies: [...policies.values()],
    stats: {
      totalRows: rows.length,
      skippedRows,
      uniqueAgents: agents.size,
      uniqueUsers: users.size,
      uniqueAccounts: accounts.size,
      uniqueLobs: lobs.size,
      uniqueCarriers: carriers.size,
      uniquePolicies: policies.size,
    },
  };
}

function run() {
  try {
    const { filePath } = workerData;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Upload file not found for worker processing');
    }

    parentPort.postMessage({
      success: true,
      data: transformRows(readRows(filePath)),
    });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
}

run();
