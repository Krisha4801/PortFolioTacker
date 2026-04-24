import test from 'node:test';
import assert from 'node:assert/strict';
import { validationForManageTransactionPage } from './validationForManageTransactionPage.js';

const baseTransactionForm = {
  date: '2024-04-10',
  type: 'buy',
  quantity: '10',
  price: '250',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  category: ''
};

const baseManageFilters = {
  instrumentType: 'stock',
  holdingId: 'stock-1'
};

const runValidation = (overrides = {}) => {
  const alerts = [];
  const savingStates = [];

  globalThis.alert = (message) => alerts.push(message);

  return validationForManageTransactionPage(
    { ...baseTransactionForm, ...overrides.transactionForm },
    { ...baseManageFilters, ...overrides.manageFilters },
    overrides.editingTransaction ?? null,
    overrides.transactions ?? [],
    overrides.fetchStockPrice ?? (async () => ({ success: true, price: 100 })),
    0,
    (state) => savingStates.push(state)
  ).then((result) => ({
    result,
    alerts,
    savingStates
  }));
};

test('AT-10 rejects transaction with negative quantity', async () => {
  const { result, alerts, savingStates } = await runValidation({
    transactionForm: { quantity: '-5' }
  });

  assert.equal(result, null);
  assert.equal(alerts.at(-1), 'Quantity must be a positive number');
  assert.equal(savingStates.at(-1), false);
});

test('AT-11 rejects transaction with zero or negative price', async () => {
  const { result, alerts, savingStates } = await runValidation({
    transactionForm: { price: '0' }
  });

  assert.equal(result, null);
  assert.equal(alerts.at(-1), 'Price/Amount must be a positive number');
  assert.equal(savingStates.at(-1), false);
});

test('AT-12 rejects future transaction date', async () => {
  const { result, alerts, savingStates } = await runValidation({
    transactionForm: { date: '2999-01-01' }
  });

  assert.equal(result, null);
  assert.equal(alerts.at(-1), 'Transaction date cannot be in the future');
  assert.equal(savingStates.at(-1), false);
});

test('AT-13 prevents selling more units than available on transaction date', async () => {
  const { result, alerts, savingStates } = await runValidation({
    transactionForm: {
      type: 'sell',
      quantity: '15',
      date: '2024-04-10'
    },
    transactions: [
      { id: 'txn-1', holdingId: 'stock-1', type: 'buy', quantity: 10, date: '2024-01-01', deleted: false }
    ]
  });

  assert.equal(result, null);
  assert.match(alerts.at(-1), /Cannot sell 15 units/);
  assert.equal(savingStates.at(-1), false);
});

test('AT-14 calculates transaction amount for valid buy transaction', async () => {
  const { result, alerts } = await runValidation({
    transactionForm: {
      quantity: '8',
      price: '125.50'
    }
  });

  assert.equal(alerts.length, 0);
  assert.deepEqual(result, {
    fetchedPriceData: null,
    amount: 1004
  });
});

test('AT-15 validates interest date range for gold interest transactions', async () => {
  const { result, alerts, savingStates } = await runValidation({
    manageFilters: {
      instrumentType: 'gold',
      holdingId: 'gold-1'
    },
    transactionForm: {
      type: 'interest',
      quantity: '',
      price: '500',
      interestStartDate: '2024-05-01',
      interestEndDate: '2024-04-01'
    }
  });

  assert.equal(result, null);
  assert.equal(alerts.at(-1), 'Interest To Date must be after Interest From Date');
  assert.equal(savingStates.at(-1), false);
});
