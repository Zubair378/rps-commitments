import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, Migrator, PostgresDialect, SqliteDialect, type Migration } from 'kysely';
import { Pool } from 'pg';

export interface DB {
  users: { id: string; username: string; password_hash: string; created_at: string };
  sessions: {
    id: string;
    user_id: string;
    token_hash: string;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
  };
  public_keys: {
    id: string;
    user_id: string;
    jwk: string;
    created_at: string;
    revoked_at: string | null;
  };
  tournaments: {
    id: string;
    name: string;
    capacity: number;
    status: string;
    created_at: string;
  };
  participants: { id: string; tournament_id: string; user_id: string; slot: number };
  matches: {
    id: string;
    tournament_id: string;
    player_a_id: string;
    player_b_id: string;
    status: string;
    stage: number;
    position: number;
    wins_required: number;
    winner_user_id: string | null;
    created_at: string;
  };
  rounds: {
    id: string;
    match_id: string;
    round_no: number;
    status: string;
    commit_deadline: string;
    reveal_deadline: string | null;
    winner_user_id: string | null;
    created_at: string;
  };
  commitments: {
    id: string;
    round_id: string;
    user_id: string;
    key_id: string;
    mode: string;
    commitment: string;
    signature: string;
    created_at: string;
  };
  reveals: {
    id: string;
    round_id: string;
    user_id: string;
    move: number;
    blinding_factor: string;
    valid: number;
    created_at: string;
  };
  audit_log: {
    seq: number;
    prev_hash: string;
    hash: string;
    event_type: string;
    event_json: string;
    created_at: string;
  };
}

const initial: Migration = {
  async up(db) {
    await db.schema
      .createTable('users')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('username', 'text', (c) => c.notNull().unique())
      .addColumn('password_hash', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createTable('sessions')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('token_hash', 'text', (c) => c.notNull().unique())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('expires_at', 'text', (c) => c.notNull())
      .addColumn('revoked_at', 'text')
      .execute();
    await db.schema
      .createTable('public_keys')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('jwk', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('revoked_at', 'text')
      .execute();
    await db.schema
      .createTable('tournaments')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('capacity', 'integer', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createTable('participants')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('tournament_id', 'text', (c) => c.notNull().references('tournaments.id'))
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('slot', 'integer', (c) => c.notNull())
      .addUniqueConstraint('participants_tournament_user_unique', ['tournament_id', 'user_id'])
      .addUniqueConstraint('participants_tournament_slot_unique', ['tournament_id', 'slot'])
      .execute();
    await db.schema
      .createTable('matches')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('tournament_id', 'text', (c) => c.notNull().references('tournaments.id'))
      .addColumn('player_a_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('player_b_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createTable('rounds')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('match_id', 'text', (c) => c.notNull().references('matches.id'))
      .addColumn('round_no', 'integer', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('commit_deadline', 'text', (c) => c.notNull())
      .addColumn('reveal_deadline', 'text')
      .addColumn('winner_user_id', 'text')
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('rounds_match_number_unique', ['match_id', 'round_no'])
      .execute();
    await db.schema
      .createTable('commitments')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('round_id', 'text', (c) => c.notNull().references('rounds.id'))
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('key_id', 'text', (c) => c.notNull().references('public_keys.id'))
      .addColumn('mode', 'text', (c) => c.notNull())
      .addColumn('commitment', 'text', (c) => c.notNull())
      .addColumn('signature', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('commitments_round_user_unique', ['round_id', 'user_id'])
      .execute();
    await db.schema
      .createTable('reveals')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('round_id', 'text', (c) => c.notNull().references('rounds.id'))
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id'))
      .addColumn('move', 'integer', (c) => c.notNull())
      .addColumn('blinding_factor', 'text', (c) => c.notNull())
      .addColumn('valid', 'integer', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addUniqueConstraint('reveals_round_user_unique', ['round_id', 'user_id'])
      .execute();
    await db.schema
      .createTable('audit_log')
      .addColumn('seq', 'integer', (c) => c.primaryKey())
      .addColumn('prev_hash', 'text', (c) => c.notNull())
      .addColumn('hash', 'text', (c) => c.notNull())
      .addColumn('event_type', 'text', (c) => c.notNull())
      .addColumn('event_json', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
  },
  async down(db) {
    for (const table of [
      'audit_log',
      'reveals',
      'commitments',
      'rounds',
      'matches',
      'participants',
      'tournaments',
      'public_keys',
      'sessions',
      'users',
    ]) {
      await db.schema.dropTable(table).execute();
    }
  },
};

const bracket: Migration = {
  async up(db) {
    await db.schema
      .alterTable('matches')
      .addColumn('stage', 'integer', (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .alterTable('matches')
      .addColumn('position', 'integer', (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema
      .alterTable('matches')
      .addColumn('wins_required', 'integer', (c) => c.notNull().defaultTo(1))
      .execute();
    await db.schema.alterTable('matches').addColumn('winner_user_id', 'text').execute();
    await db.schema
      .createIndex('matches_bracket_unique')
      .on('matches')
      .columns(['tournament_id', 'stage', 'position'])
      .unique()
      .execute();
  },
  async down(db) {
    await db.schema.dropIndex('matches_bracket_unique').execute();
    for (const column of ['winner_user_id', 'wins_required', 'position', 'stage']) {
      await db.schema.alterTable('matches').dropColumn(column).execute();
    }
  },
};

export function createDatabase(url: string): Kysely<DB> {
  if (url.startsWith('file:')) {
    const path = url.slice(5);
    if (!path) throw new Error('Missing SQLite path');
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const sqlite = new Database(path);
    sqlite.pragma('foreign_keys = ON');
    return new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  }
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return new Kysely<DB>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: url }) }),
    });
  }
  throw new Error('DATABASE_URL must use file:, postgres:, or postgresql:');
}

export async function migrate(db: Kysely<DB>) {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return { '001_initial': initial, '002_bracket': bracket };
      },
    },
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}
