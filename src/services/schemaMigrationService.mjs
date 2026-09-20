/**
 * Tasklet 8.11: Version Control Framework
 * Semantic versioning and migration framework for output schemas.
 * Ensures backwards compatibility for stored historical documents.
 */

export class UnsupportedSchemaMigrationError extends Error {
  constructor(fromVersion, toVersion) {
    super(`No migration path from schema version ${fromVersion} to ${toVersion}`);
    this.name = 'UNSUPPORTED_SCHEMA_MIGRATION';
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
  }
}

export class SchemaMigrationService {
  constructor() {
    this.migrations = new Map();
    this.registerMigration('1.0', '1.1', this.migrate_1_0_to_1_1);
    this.registerMigration('1.1', '1.2', this.migrate_1_1_to_1_2);
  }

  registerMigration(fromVer, toVer, fn) {
    this.migrations.set(`${fromVer}->${toVer}`, fn);
  }

  migratePayload(payload, fromVersion, toVersion) {
    if (!payload) throw new Error('Payload is required for migration');
    if (fromVersion === toVersion) return JSON.parse(JSON.stringify(payload));

    const key = `${fromVersion}->${toVersion}`;
    const migrator = this.migrations.get(key);
    if (!migrator) {
      throw new UnsupportedSchemaMigrationError(fromVersion, toVersion);
    }

    return migrator(JSON.parse(JSON.stringify(payload)));
  }

  migrate_1_0_to_1_1(doc10) {
    // 1.0 -> 1.1 is strictly additive: no existing data lost
    const doc11 = { ...doc10 };
    doc11.schema_version = '1.1';

    if (!doc11.health) {
      doc11.health = { individual_scores: null, composite_score: null };
    } else {
      doc11.health.individual_scores = null;
    }

    if (!doc11.insights_v2) doc11.insights_v2 = [];
    if (!doc11.assumptions) doc11.assumptions = [];
    if (!doc11.dependencies) doc11.dependencies = [];
    if (!doc11.opportunities) doc11.opportunities = [];
    if (!doc11.provenance) {
      doc11.provenance = {
        capture_source: 'Migrated historical record',
        independence_disclaimer_required: true,
      };
    }

    return doc11;
  }

  migrate_1_1_to_1_2(doc11) {
    const doc12 = { ...doc11 };
    doc12.schema_version = '1.2';
    if (!doc12.audit_trail) {
      doc12.audit_trail = {
        migrated_at: new Date().toISOString(),
        tamper_evident: true,
      };
    }
    return doc12;
  }
}
