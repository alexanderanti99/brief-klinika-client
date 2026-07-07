import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { defaultFormSchema } from './default-schema.js';

const defaultConfig = {
  texts: {},
  hiddenFields: [],
  formSchema: defaultFormSchema
};

function normalizeConfig(config) {
  return {
    texts: config?.texts && typeof config.texts === 'object' && !Array.isArray(config.texts)
      ? config.texts
      : {},
    hiddenFields: Array.isArray(config?.hiddenFields) ? config.hiddenFields : [],
    formSchema: config?.formSchema
      && config.formSchema.version === defaultFormSchema.version
      && Array.isArray(config.formSchema.sections)
      ? config.formSchema
      : defaultFormSchema
  };
}

function normalizeRecord(record) {
  return {
    id: record.id || null,
    clinicName: record.clinicName || record.clinic_name || 'Без названия',
    submittedAt: record.submittedAt || record.submitted_at || new Date().toISOString(),
    payload: record.payload || {}
  };
}

function createJsonStorage(filePath) {
  const resolvedPath = path.resolve(filePath || '.data/brief-data.json');
  let state = {
    config: defaultConfig,
    responses: []
  };

  async function readState() {
    try {
      const raw = await fs.readFile(resolvedPath, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        config: normalizeConfig(parsed.config),
        responses: Array.isArray(parsed.responses) ? parsed.responses.map(normalizeRecord) : []
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeState();
    }
  }

  async function writeState() {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, JSON.stringify(state, null, 2), 'utf8');
  }

  return {
    async init() {
      await readState();
    },
    async getConfig() {
      return normalizeConfig(state.config);
    },
    async saveConfig(config) {
      state.config = normalizeConfig(config);
      await writeState();
      return state.config;
    },
    async createResponse(record) {
      const saved = normalizeRecord({
        ...record,
        id: Date.now()
      });
      state.responses.unshift(saved);
      state.responses = state.responses.slice(0, 500);
      await writeState();
      return saved;
    },
    async listResponses() {
      return state.responses.slice(0, 100);
    },
    async clearResponses() {
      state.responses = [];
      await writeState();
    },
    async close() {}
  };
}

function createPostgresStorage(connectionString) {
  const pool = new Pool({ connectionString });

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brief_settings (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brief_responses (
          id bigserial PRIMARY KEY,
          submitted_at timestamptz NOT NULL,
          clinic_name text NOT NULL,
          payload jsonb NOT NULL
        )
      `);
    },
    async getConfig() {
      const result = await pool.query(
        'SELECT value FROM brief_settings WHERE key = $1',
        ['config']
      );
      return normalizeConfig(result.rows[0]?.value || defaultConfig);
    },
    async saveConfig(config) {
      const normalized = normalizeConfig(config);
      await pool.query(
        `INSERT INTO brief_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        ['config', JSON.stringify(normalized)]
      );
      return normalized;
    },
    async createResponse(record) {
      const normalized = normalizeRecord(record);
      const result = await pool.query(
        `INSERT INTO brief_responses (submitted_at, clinic_name, payload)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id, submitted_at, clinic_name, payload`,
        [
          normalized.submittedAt,
          normalized.clinicName,
          JSON.stringify(normalized.payload)
        ]
      );
      return normalizeRecord(result.rows[0]);
    },
    async listResponses() {
      const result = await pool.query(
        `SELECT id, submitted_at, clinic_name, payload
         FROM brief_responses
         ORDER BY submitted_at DESC
         LIMIT 100`
      );
      return result.rows.map(normalizeRecord);
    },
    async clearResponses() {
      await pool.query('DELETE FROM brief_responses');
    },
    async close() {
      await pool.end();
    }
  };
}

export function createStorage(options = {}) {
  const env = options.env || process.env;
  if (env.DATABASE_URL) return createPostgresStorage(env.DATABASE_URL);
  return createJsonStorage(options.filePath || env.DATA_FILE);
}
