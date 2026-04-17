import { calculatePortfolioAggregates } from './portfolioLogic';

export const loadSampleData = (setHoldings, setTransactions, setPortfolioAggregates) => {
    const sampleHoldings = [
        // Stocks
        {
            id: 'temp-stock-1',
            type: 'stock',
            symbol: 'RELIANCE',
            name: 'Reliance Industries',
            category: null,
            currentPrice: 2800,
            totalQuantity: 10,
            avgCost: 2450,
            totalCost: 24500,
            currentValue: 28000,
            totalIncome: 500,
            lastTransactionDate: '2024-01-15',
            transactionCount: 2
        },
        {
            id: 'temp-stock-2',
            type: 'stock',
            symbol: 'TCS',
            name: 'Tata Consultancy Services',
            category: null,
            currentPrice: 3850,
            totalQuantity: 5,
            avgCost: 3600,
            totalCost: 18000,
            currentValue: 19250,
            totalIncome: 300,
            lastTransactionDate: '2024-03-20',
            transactionCount: 1
        },
        {
            id: 'temp-stock-3',
            type: 'stock',
            symbol: 'INFY',
            name: 'Infosys',
            category: null,
            currentPrice: 1650,
            totalQuantity: 15,
            avgCost: 1500,
            totalCost: 22500,
            currentValue: 24750,
            totalIncome: 0,
            lastTransactionDate: '2024-05-10',
            transactionCount: 1
        },
        // Mutual Funds
        {
            id: 'temp-mf-1',
            type: 'mf',
            symbol: 'PPFAS-FLEXI',
            name: 'Parag Parikh Flexi Cap Fund',
            category: 'Flexi Cap',
            currentPrice: 48,
            totalQuantity: 100,
            avgCost: 45,
            totalCost: 4500,
            currentValue: 4800,
            totalIncome: 0,
            lastTransactionDate: '2024-02-20',
            transactionCount: 1
        },
        {
            id: 'temp-mf-2',
            type: 'mf',
            symbol: 'AXIS-MIDCAP',
            name: 'Axis Midcap Fund',
            category: 'Mid Cap',
            currentPrice: 72,
            totalQuantity: 80,
            avgCost: 65,
            totalCost: 5200,
            currentValue: 5760,
            totalIncome: 0,
            lastTransactionDate: '2024-04-15',
            transactionCount: 1
        },
        {
            id: 'temp-mf-3',
            type: 'mf',
            symbol: 'HDFC-LIQUID',
            name: 'HDFC Liquid Fund',
            category: 'Liquid Fund',
            currentPrice: 3550,
            totalQuantity: 20,
            avgCost: 3500,
            totalCost: 70000,
            currentValue: 71000,
            totalIncome: 0,
            lastTransactionDate: '2024-01-05',
            transactionCount: 1
        },
        // Gold
        {
            id: 'temp-gold-1',
            type: 'gold',
            symbol: 'SBI-GOLD',
            name: 'SBI Gold Deposit',
            category: null,
            currentPrice: 6500,
            totalQuantity: 10,
            avgCost: 6200,
            totalCost: 62000,
            currentValue: 65000,
            totalIncome: 1000,
            lastTransactionDate: '2024-03-10',
            transactionCount: 2
        },
        {
            id: 'temp-gold-2',
            type: 'gold',
            symbol: 'PHYSICAL-GOLD',
            name: 'Physical Gold - Jewelry',
            category: null,
            currentPrice: 6400,
            totalQuantity: 25,
            avgCost: 5800,
            totalCost: 145000,
            currentValue: 160000,
            totalIncome: 0,
            lastTransactionDate: '2023-11-20',
            transactionCount: 1
        },
        // Bank
        {
            id: 'temp-bank-1',
            type: 'bank',
            symbol: 'HDFC-SAVINGS',
            name: 'HDFC Savings Account',
            category: null,
            currentPrice: 0,
            totalQuantity: 0,
            avgCost: 0,
            totalCost: 0,
            currentValue: 50000,
            totalIncome: 0,
            lastTransactionDate: '2024-01-01',
            transactionCount: 1
        },
        {
            id: 'temp-bank-2',
            type: 'bank',
            symbol: 'SBI-SAVINGS',
            name: 'SBI Savings Account',
            category: null,
            currentPrice: 0,
            totalQuantity: 0,
            avgCost: 0,
            totalCost: 0,
            currentValue: 25000,
            totalIncome: 0,
            lastTransactionDate: '2024-01-01',
            transactionCount: 1
        }
    ];

    const sampleTransactions = [
        // Stock 1 - Reliance transactions
        {
            id: 'temp-txn-1',
            holdingId: 'temp-stock-1',
            type: 'buy',
            date: '2023-08-15',
            quantity: 5,
            price: 2300,
            amount: 11500,
            deleted: false
        },
        {
            id: 'temp-txn-2',
            holdingId: 'temp-stock-1',
            type: 'buy',
            date: '2024-01-15',
            quantity: 5,
            price: 2600,
            amount: 13000,
            deleted: false
        },
        {
            id: 'temp-txn-3',
            holdingId: 'temp-stock-1',
            type: 'dividend',
            date: '2024-03-20',
            quantity: 0,
            price: 250,
            amount: 250,
            deleted: false
        },
        {
            id: 'temp-txn-4',
            holdingId: 'temp-stock-1',
            type: 'dividend',
            date: '2024-06-15',
            quantity: 0,
            price: 250,
            amount: 250,
            deleted: false
        },
        // Stock 2 - TCS transactions
        {
            id: 'temp-txn-5',
            holdingId: 'temp-stock-2',
            type: 'buy',
            date: '2024-01-10',
            quantity: 3,
            price: 3500,
            amount: 10500,
            deleted: false
        },
        {
            id: 'temp-txn-6',
            holdingId: 'temp-stock-2',
            type: 'buy',
            date: '2024-03-20',
            quantity: 2,
            price: 3700,
            amount: 7400,
            deleted: false
        },
        {
            id: 'temp-txn-7',
            holdingId: 'temp-stock-2',
            type: 'dividend',
            date: '2024-05-15',
            quantity: 0,
            price: 150,
            amount: 150,
            deleted: false
        },
        {
            id: 'temp-txn-8',
            holdingId: 'temp-stock-2',
            type: 'dividend',
            date: '2024-07-01',
            quantity: 0,
            price: 150,
            amount: 150,
            deleted: false
        },
        // Stock 3 - Infosys transactions
        {
            id: 'temp-txn-9',
            holdingId: 'temp-stock-3',
            type: 'buy',
            date: '2024-02-05',
            quantity: 10,
            price: 1480,
            amount: 14800,
            deleted: false
        },
        {
            id: 'temp-txn-10',
            holdingId: 'temp-stock-3',
            type: 'buy',
            date: '2024-05-10',
            quantity: 5,
            price: 1540,
            amount: 7700,
            deleted: false
        },
        {
            id: 'temp-txn-11',
            holdingId: 'temp-stock-3',
            type: 'dividend',
            date: '2024-08-20',
            quantity: 0,
            price: 200,
            amount: 200,
            deleted: false
        },
        // MF 1 - Parag Parikh transactions
        {
            id: 'temp-txn-12',
            holdingId: 'temp-mf-1',
            type: 'buy',
            date: '2023-12-10',
            quantity: 50,
            price: 44,
            amount: 2200,
            deleted: false
        },
        {
            id: 'temp-txn-13',
            holdingId: 'temp-mf-1',
            type: 'buy',
            date: '2024-02-20',
            quantity: 50,
            price: 46,
            amount: 2300,
            deleted: false
        },
        {
            id: 'temp-txn-14',
            holdingId: 'temp-mf-1',
            type: 'dividend',
            date: '2024-06-30',
            quantity: 0,
            price: 120,
            amount: 120,
            deleted: false
        },
        // MF 2 - Axis Midcap transactions
        {
            id: 'temp-txn-15',
            holdingId: 'temp-mf-2',
            type: 'buy',
            date: '2024-01-20',
            quantity: 40,
            price: 63,
            amount: 2520,
            deleted: false
        },
        {
            id: 'temp-txn-16',
            holdingId: 'temp-mf-2',
            type: 'buy',
            date: '2024-04-15',
            quantity: 40,
            price: 67,
            amount: 2680,
            deleted: false
        },
        {
            id: 'temp-txn-17',
            holdingId: 'temp-mf-2',
            type: 'dividend',
            date: '2024-07-25',
            quantity: 0,
            price: 100,
            amount: 100,
            deleted: false
        },
        // MF 3 - HDFC Liquid transactions
        {
            id: 'temp-txn-18',
            holdingId: 'temp-mf-3',
            type: 'buy',
            date: '2023-11-15',
            quantity: 10,
            price: 3480,
            amount: 34800,
            deleted: false
        },
        {
            id: 'temp-txn-19',
            holdingId: 'temp-mf-3',
            type: 'buy',
            date: '2024-01-05',
            quantity: 10,
            price: 3520,
            amount: 35200,
            deleted: false
        },
        {
            id: 'temp-txn-20',
            holdingId: 'temp-mf-3',
            type: 'dividend',
            date: '2024-04-10',
            quantity: 0,
            price: 85,
            amount: 85,
            deleted: false
        },
        // Gold 1 - SBI Gold transactions
        {
            id: 'temp-txn-21',
            holdingId: 'temp-gold-1',
            type: 'buy',
            date: '2023-09-15',
            quantity: 5,
            price: 6000,
            amount: 30000,
            deleted: false
        },
        {
            id: 'temp-txn-22',
            holdingId: 'temp-gold-1',
            type: 'buy',
            date: '2024-03-10',
            quantity: 5,
            price: 6400,
            amount: 32000,
            deleted: false
        },
        {
            id: 'temp-txn-23',
            holdingId: 'temp-gold-1',
            type: 'interest',
            date: '2024-09-15',
            quantity: 0,
            price: 500,
            amount: 500,
            interestStartDate: '2023-09-15',
            interestEndDate: '2024-09-15',
            deleted: false
        },
        {
            id: 'temp-txn-24',
            holdingId: 'temp-gold-1',
            type: 'interest',
            date: '2024-12-10',
            quantity: 0,
            price: 500,
            amount: 500,
            interestStartDate: '2024-03-10',
            interestEndDate: '2024-12-10',
            deleted: false
        },
        // Gold 2 - Physical Gold transactions
        {
            id: 'temp-txn-25',
            holdingId: 'temp-gold-2',
            type: 'buy',
            date: '2022-10-10',
            quantity: 15,
            price: 5600,
            amount: 84000,
            deleted: false
        },
        {
            id: 'temp-txn-26',
            holdingId: 'temp-gold-2',
            type: 'buy',
            date: '2023-11-20',
            quantity: 10,
            price: 6100,
            amount: 61000,
            deleted: false
        },
        // Bank 1 - HDFC transactions
        {
            id: 'temp-txn-27',
            holdingId: 'temp-bank-1',
            type: 'balance',
            date: '2024-01-01',
            quantity: 0,
            price: 50000,
            amount: 50000,
            deleted: false
        },
        // Bank 2 - SBI transactions
        {
            id: 'temp-txn-28',
            holdingId: 'temp-bank-2',
            type: 'balance',
            date: '2024-01-01',
            quantity: 0,
            price: 25000,
            amount: 25000,
            deleted: false
        }
    ];
    setHoldings(sampleHoldings);
    setTransactions(sampleTransactions);

    setPortfolioAggregates(calculatePortfolioAggregates(sampleHoldings));
}
