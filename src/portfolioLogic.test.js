import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGainLoss,
  calculatePortfolioAggregates,
  calculateReturnPercentage,
  canAddHolding,
  getFallbackPriceResult,
  sanitizeInput,
  shouldTriggerAlert
} from './portfolioLogic.js';

test('AT-01 calculates total portfolio values across multiple asset types', () => {
  const result = calculatePortfolioAggregates([
    { type: 'stock', totalCost: 10000, currentValue: 12500, totalIncome: 250 },
    { type: 'mf', totalCost: 5000, currentValue: 4500, totalIncome: 0 },
    { type: 'bank', totalCost: 0, currentValue: 2000, totalIncome: 0 }
  ]);

  assert.equal(result.totalCost, 15000);
  assert.equal(result.currentValue, 19000);
  assert.equal(result.totalIncome, 250);
  assert.equal(result.totalGain, 4250);
  assert.equal(result.totalReturn, 28.33);
});

test('AT-02 calculates profit when current value is greater than investment', () => {
  assert.equal(calculateGainLoss(10000, 12500, 300), 2800);
});

test('AT-03 calculates loss when current value is less than investment', () => {
  assert.equal(calculateGainLoss(10000, 8200, 0), -1800);
});

test('AT-04 calculates return percentage and handles zero investment safely', () => {
  assert.equal(calculateReturnPercentage(10000, 1250), 12.5);
  assert.equal(calculateReturnPercentage(0, 500), 0);
});

test('AT-05 handles empty portfolio data without errors', () => {
  const result = calculatePortfolioAggregates([]);

  assert.deepEqual(result, {
    totalCost: 0,
    currentValue: 0,
    totalIncome: 0,
    totalGain: 0,
    totalReturn: 0,
    byType: {}
  });
});

test('AT-06 rejects duplicate holdings by symbol or name inside same asset type', () => {
  const existing = [
    { type: 'stock', symbol: 'RELIANCE', name: 'Reliance Industries' },
    { type: 'mf', symbol: 'PPFAS-FLEXI', name: 'Parag Parikh Flexi Cap Fund' }
  ];

  assert.equal(canAddHolding(existing, { type: 'stock', symbol: 'reliance', name: 'Reliance Industries' }), false);
  assert.equal(canAddHolding(existing, { type: 'mf', symbol: 'NEW-FUND', name: 'Parag Parikh Flexi Cap Fund' }), false);
  assert.equal(canAddHolding(existing, { type: 'stock', symbol: 'TCS', name: 'Tata Consultancy Services' }), true);
});

test('AT-07 evaluates alert threshold rules correctly', () => {
  assert.equal(shouldTriggerAlert({ currentPrice: 105, targetPrice: 100, direction: 'above' }), true);
  assert.equal(shouldTriggerAlert({ currentPrice: 95, targetPrice: 100, direction: 'above' }), false);
  assert.equal(shouldTriggerAlert({ currentPrice: 90, targetPrice: 100, direction: 'below' }), true);
  assert.equal(shouldTriggerAlert({ currentPrice: 105, targetPrice: 100, direction: 'below' }), false);
});

test('AT-08 sanitizes script-like input from user text fields', () => {
  const result = sanitizeInput(' <script>alert("x")</script> javascript:bad onclick=run ');

  assert.equal(result.includes('<'), false);
  assert.equal(result.includes('>'), false);
  assert.equal(/javascript:/i.test(result), false);
  assert.equal(/onclick=/i.test(result), false);
});

test('AT-09 uses previous price as fallback when API result fails', () => {
  assert.deepEqual(getFallbackPriceResult({ success: true, price: 2500 }, 2400), {
    price: 2500,
    usedFallback: false
  });

  assert.deepEqual(getFallbackPriceResult({ success: false }, 2400), {
    price: 2400,
    usedFallback: true
  });
});
