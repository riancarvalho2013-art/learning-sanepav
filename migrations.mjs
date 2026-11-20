export const migrations = [{
  version: 1,
  name: 'organizational-foundation',
  up: `
    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX companies_name ON companies(lower(name));
    CREATE TABLE units (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      UNIQUE(id, company_id), UNIQUE(company_id, name)
    );
    CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      UNIQUE(id, company_id), UNIQUE(company_id, name)
    );
    CREATE TABLE people (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE person_organizations (
      person_id TEXT PRIMARY KEY REFERENCES people(id) ON DELETE RESTRICT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      unit_id TEXT,
      department_id TEXT,
      position TEXT NOT NULL DEFAULT '',
      hired_at TEXT,
      ended_at TEXT,
      revision INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(unit_id, company_id) REFERENCES units(id, company_id) ON DELETE RESTRICT,
      FOREIGN KEY(department_id, company_id) REFERENCES departments(id, company_id) ON DELETE RESTRICT,
      CHECK(ended_at IS NULL OR (hired_at IS NOT NULL AND ended_at >= hired_at))
    );
    CREATE TABLE company_access (
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      PRIMARY KEY(person_id,company_id)
    );
    CREATE TABLE domain_audit (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event TEXT NOT NULL,
      at TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT
    );
    CREATE TABLE password_resets (
      token_hash TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE TABLE password_reset_requests (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      rate_key TEXT NOT NULL,
      requested_at INTEGER NOT NULL
    );
    CREATE INDEX password_reset_rate ON password_reset_requests(rate_key,requested_at);
    CREATE INDEX domain_audit_entity ON domain_audit(entity_type,entity_id,sequence);
  `,
  down: `
    DROP TABLE password_reset_requests;
    DROP TABLE password_resets;
    DROP TABLE domain_audit;
    DROP TABLE company_access;
    DROP TABLE person_organizations;
    DROP TABLE people;
    DROP TABLE departments;
    DROP TABLE units;
    DROP TABLE companies;
  `
}]

export function migrate(database) {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)')
  database.exec('BEGIN IMMEDIATE')
  try {
    for (const migration of migrations) {
      if (database.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(migration.version)) continue
      database.exec(migration.up)
      database.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(migration.version, migration.name, new Date().toISOString())
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

// Explicit operator action, after backup. The original objects table is preserved.
export function rollbackFoundation(database) {
  database.exec('BEGIN IMMEDIATE')
  try {
    for (const migration of [...migrations].reverse()) {
      if (!database.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(migration.version)) continue
      database.exec(migration.down)
      database.prepare('DELETE FROM schema_migrations WHERE version=?').run(migration.version)
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
