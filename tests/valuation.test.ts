import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreFinanceiro, scoreNutricao, scoreSaude, scoreTarefas } from '../lib/valuation'

test('scoreFinanceiro rewards positive savings behavior', () => {
  const score = scoreFinanceiro(
    [
      { type: 'INCOME', amount: 5000, date: new Date() },
      { type: 'EXPENSE', amount: 2000, date: new Date() },
    ],
    [{ limit: 2500 }]
  )

  assert.equal(score, 100)
})

test('scoreSaude returns zero when there is no data', () => {
  assert.equal(scoreSaude([], [], []), 0)
})

test('scoreNutricao returns zero when there is no data', () => {
  assert.equal(scoreNutricao([]), 0)
})

test('scoreTarefas rewards inbox under control and completed work', () => {
  const today = new Date()
  const score = scoreTarefas([
    { bucket: 'INBOX', status: 'PENDING', updatedAt: today },
    { bucket: 'TODAY', status: 'COMPLETED', updatedAt: today },
    { bucket: 'TODAY', status: 'COMPLETED', updatedAt: today },
    { bucket: 'THIS_WEEK', status: 'IN_PROGRESS', updatedAt: today },
  ])

  assert.equal(score, 70)
})
