import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredObject, stringifyStoredObject } from '../lib/storage'

test('parseStoredObject accepts stored json string', () => {
  const result = parseStoredObject('{"alpha":1}', { alpha: 0 })
  assert.deepEqual(result, { alpha: 1 })
})

test('parseStoredObject accepts object values directly', () => {
  const result = parseStoredObject({ alpha: 2 }, { alpha: 0 })
  assert.deepEqual(result, { alpha: 2 })
})

test('stringifyStoredObject keeps valid object payloads', () => {
  assert.equal(stringifyStoredObject({ alpha: 3 }), '{"alpha":3}')
})
