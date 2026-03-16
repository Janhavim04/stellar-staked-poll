import { describe, it, expect, beforeEach } from 'vitest'

// ── Helper functions from App.jsx ──

const STROOP = 10000000

function toXLM(stroops) {
  return (stroops / STROOP).toFixed(2)
}

function calcYesPercent(yesStake, noStake) {
  const total = yesStake + noStake
  if (total === 0) return 50
  return Math.round((yesStake / total) * 100)
}

function calcNoPercent(yesStake, noStake) {
  const total = yesStake + noStake
  if (total === 0) return 50
  return Math.round((noStake / total) * 100)
}

function isValidStake(amount, minStake) {
  const stroops = Math.floor(parseFloat(amount) * STROOP)
  return stroops >= minStake
}

function isValidOption(option) {
  return option === 0 || option === 1
}

function calcPayout(voterStake, totalStake, winningTotal) {
  if (winningTotal === 0) return 0
  return Math.floor((voterStake * totalStake) / winningTotal)
}

function isPollClosed(deadline) {
  const now = Math.floor(Date.now() / 1000)
  return now > deadline
}

function saveToCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }))
}

function readFromCache(key, ttlSeconds) {
  const cached = localStorage.getItem(key)
  if (!cached) return null
  const parsed = JSON.parse(cached)
  const age = (Date.now() - parsed.timestamp) / 1000
  if (age > ttlSeconds) return null
  return parsed
}


// ══════════════════════════════════════
// TEST SUITE 1 — Stake Calculations
// ══════════════════════════════════════
describe('Stake Calculations', () => {

  it('should convert stroops to XLM correctly', () => {
    expect(toXLM(10000000)).toBe('1.00')
    expect(toXLM(100000000)).toBe('10.00')
    expect(toXLM(0)).toBe('0.00')
  })

  it('should return 50/50 when no stakes', () => {
    expect(calcYesPercent(0, 0)).toBe(50)
    expect(calcNoPercent(0, 0)).toBe(50)
  })

  it('should calculate correct percentages with stakes', () => {
    expect(calcYesPercent(300, 100)).toBe(75)
    expect(calcNoPercent(300, 100)).toBe(25)
  })

  it('should return 100% yes when all stake is yes', () => {
    expect(calcYesPercent(500, 0)).toBe(100)
    expect(calcNoPercent(500, 0)).toBe(0)
  })

  it('should calculate payout correctly', () => {
    // voter staked 100, total is 300, winning side staked 200
    // payout = (100 * 300) / 200 = 150
    expect(calcPayout(100, 300, 200)).toBe(150)
  })

  it('should return 0 payout if winning total is 0', () => {
    expect(calcPayout(100, 300, 0)).toBe(0)
  })

})


// ══════════════════════════════════════
// TEST SUITE 2 — Vote Validation
// ══════════════════════════════════════
describe('Vote Validation', () => {

  it('should accept 0 as valid option (Yes)', () => {
    expect(isValidOption(0)).toBe(true)
  })

  it('should accept 1 as valid option (No)', () => {
    expect(isValidOption(1)).toBe(true)
  })

  it('should reject invalid options', () => {
    expect(isValidOption(2)).toBe(false)
    expect(isValidOption(-1)).toBe(false)
    expect(isValidOption(null)).toBe(false)
  })

  it('should accept stake above minimum', () => {
    const minStake = 100000000 // 10 XLM
    expect(isValidStake('10', minStake)).toBe(true)
    expect(isValidStake('50', minStake)).toBe(true)
  })

  it('should reject stake below minimum', () => {
    const minStake = 100000000 // 10 XLM
    expect(isValidStake('5', minStake)).toBe(false)
    expect(isValidStake('0', minStake)).toBe(false)
  })

})


// ══════════════════════════════════════
// TEST SUITE 3 — Poll State
// ══════════════════════════════════════
describe('Poll State', () => {

  it('should detect poll as open when deadline is in future', () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 86400
    expect(isPollClosed(futureDeadline)).toBe(false)
  })

  it('should detect poll as closed when deadline has passed', () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 86400
    expect(isPollClosed(pastDeadline)).toBe(true)
  })

  it('should correctly determine winner — yes wins', () => {
    const yesStake = 300
    const noStake  = 100
    const winner   = yesStake >= noStake ? 'yes' : 'no'
    expect(winner).toBe('yes')
  })

  it('should correctly determine winner — no wins', () => {
    const yesStake = 100
    const noStake  = 400
    const winner   = yesStake >= noStake ? 'yes' : 'no'
    expect(winner).toBe('no')
  })

  it('should default to yes on tie', () => {
    const yesStake = 200
    const noStake  = 200
    const winner   = yesStake >= noStake ? 'yes' : 'no'
    expect(winner).toBe('yes')
  })

})


// ══════════════════════════════════════
// TEST SUITE 4 — Caching
// ══════════════════════════════════════
describe('Results Caching', () => {

  beforeEach(() => {
    localStorage.clear()
  })

  it('should save and retrieve results from cache', () => {
    saveToCache('staked_poll_results', { yes: 500, no: 300 })
    const data = readFromCache('staked_poll_results', 30)
    expect(data).not.toBeNull()
    expect(data.yes).toBe(500)
    expect(data.no).toBe(300)
  })

  it('should return null when cache is empty', () => {
    expect(readFromCache('staked_poll_results', 30)).toBeNull()
  })

  it('should return null when cache is expired', () => {
    const expired = { yes: 100, no: 50, timestamp: Date.now() - 60000 }
    localStorage.setItem('staked_poll_results', JSON.stringify(expired))
    expect(readFromCache('staked_poll_results', 30)).toBeNull()
  })

  it('should return data when cache is fresh', () => {
    saveToCache('staked_poll_results', { yes: 200, no: 100 })
    const data = readFromCache('staked_poll_results', 30)
    expect(data).not.toBeNull()
  })

  it('should overwrite old cache', () => {
    saveToCache('staked_poll_results', { yes: 10, no: 5 })
    saveToCache('staked_poll_results', { yes: 99, no: 44 })
    const data = readFromCache('staked_poll_results', 30)
    expect(data.yes).toBe(99)
    expect(data.no).toBe(44)
  })

})