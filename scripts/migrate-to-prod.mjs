import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import Database from 'better-sqlite3'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(projectRoot, envFile)

  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath, override: envFile === '.env.local' })
  }
}

const targetDatabaseUrl = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
const sqlitePath = path.resolve(projectRoot, process.env.SOURCE_SQLITE_PATH ?? 'dev.db')

if (!targetDatabaseUrl) {
  throw new Error('TARGET_DATABASE_URL or DATABASE_URL must be set.')
}

if (!/^postgres(ql)?:\/\//.test(targetDatabaseUrl)) {
  throw new Error('Target database must be PostgreSQL.')
}

if (!fs.existsSync(sqlitePath)) {
  throw new Error(`SQLite source not found at ${sqlitePath}.`)
}

const sqlite = new Database(sqlitePath, { readonly: true })
const pool = new pg.Pool({ connectionString: targetDatabaseUrl })

function rows(table) {
  try {
    return sqlite.prepare(`SELECT * FROM "${table}"`).all()
  } catch (error) {
    if (error.message.includes('no such table')) {
      return []
    }

    throw error
  }
}

const BOOL_COLS = new Set([
  'achieved',
  'allDay',
  'billable',
  'completed',
  'isActive',
  'isRecurring',
  'onboarded',
  'read',
])

function fixRow(row) {
  const out = {}

  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'number' && BOOL_COLS.has(key) ? value === 1 : value
  }

  return out
}

async function buildUserIdMap(client) {
  const localUsers = rows('User')
  const map = new Map()

  for (const user of localUsers) {
    const res = await client.query('SELECT id FROM "User" WHERE email = $1', [user.email])

    if (res.rows.length > 0) {
      map.set(user.id, res.rows[0].id)
      console.log(`  mapped user ${user.email}`)
    }
  }

  return map
}

function remapUserId(row, userIdMap) {
  if (row.userId && userIdMap.has(row.userId)) {
    return { ...row, userId: userIdMap.get(row.userId) }
  }

  return row
}

async function upsertRows(client, table, data, conflictCol = 'id') {
  if (!data.length) return 0

  const cols = Object.keys(data[0])
  const colList = cols.map((col) => `"${col}"`).join(', ')
  let count = 0

  for (const rawRow of data) {
    const row = fixRow(rawRow)
    const values = cols.map((col) => row[col])
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    const updateSet = cols
      .filter((col) => col !== conflictCol)
      .map((col) => `"${col}" = EXCLUDED."${col}"`)
      .join(', ')

    const sql = `
      INSERT INTO "${table}" (${colList})
      VALUES (${placeholders})
      ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSet}
    `

    try {
      await client.query('SAVEPOINT sp')
      await client.query(sql, values)
      await client.query('RELEASE SAVEPOINT sp')
      count++
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT sp')

      if (!error.message.includes('duplicate key')) {
        console.warn(`    skipped ${table}: ${error.message.slice(0, 120)}`)
      }
    }
  }

  return count
}

async function migrate() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('\nMapping users by email...')
    const userIdMap = await buildUserIdMap(client)

    if (userIdMap.size === 0) {
      console.log('  No matching PostgreSQL users found.')
      console.log('  Create the target account first, then run the import again.')
      await client.query('ROLLBACK')
      return
    }

    const tablesWithUser = [
      'Employee',
      'Budget',
      'Transaction',
      'Goal',
      'Habit',
      'HabitLog',
      'Task',
      'Contact',
      'Interaction',
      'Commitment',
      'Book',
      'Course',
      'Skill',
      'DiaryEntry',
      'Notification',
      'CompanyValuation',
      'Workout',
      'BodyMetric',
      'SleepLog',
      'HydrationLog',
      'MealPlan',
      'Meal',
      'Subject',
      'Assignment',
      'StudySession',
      'Project',
      'ProjectTask',
      'Meeting',
      'TimeEntry',
      'GtdTask',
      'SavingsGoal',
      'CalendarEvent',
      'SavedConversation',
    ]

    const tablesNoUser = ['KeyResult', 'WorkoutExercise', 'MealItem', 'SubjectGrade']

    let total = 0
    console.log('\nImporting legacy SQLite data...')

    for (const table of tablesWithUser) {
      const data = rows(table).map((row) => remapUserId(row, userIdMap))
      const count = await upsertRows(client, table, data)
      console.log(`  ${table}: ${count} rows`)
      total += count
    }

    for (const table of tablesNoUser) {
      const data = rows(table)
      const count = await upsertRows(client, table, data)
      console.log(`  ${table}: ${count} rows`)
      total += count
    }

    await client.query('COMMIT')
    console.log(`\nImport completed: ${total} rows copied to PostgreSQL.`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Import failed. Transaction rolled back:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    sqlite.close()
    await pool.end()
  }
}

await migrate()
