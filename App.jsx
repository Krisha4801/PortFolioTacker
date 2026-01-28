import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, TrendingUp, TrendingDown, RefreshCw, Wallet, BarChart3, ArrowLeft, Edit, Trash2, Save, X, LogIn, LogOut } from 'lucide-react';
import { db, auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, getDoc, setDoc, writeBatch, orderBy, limit } from 'firebase/firestore';

// Color palette for instruments
const COLORS = {
  stock: '#3b82f6',
  mf: '#10b981',
  gold: '#f59e0b',
  bank: '#8b5cf6'
};

const INSTRUMENT_LABELS = {
  stock: 'Stocks',
  mf: 'Mutual Funds',
  gold: 'Gold',
  bank: 'Bank Balance'
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 500);
};

const sanitizeNumber = (input) => {
  const str = String(input).trim();
  const cleaned = str.replace(/[^\d.-]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return cleaned;
};

const getFirstName = (user) => {
  if (!user) return 'Portfolio';

  // Try displayName first
  if (user.displayName) {
    return user.displayName.split(' ')[0];
  }

  // Fallback to email username
  if (user.email) {
    return user.email.split('@')[0];
  }
  return 'Portfolio';
};

const PortfolioTracker = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [showGainInPercent, setShowGainInPercent] = useState(true);
  const [transactionForm, setTransactionForm] = useState({
    type: 'buy',
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    price: '',
    interestRate: '',
    interestStartDate: '',
    name: '',
    symbol: '',
    category: ''
  });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manage page filters
  const [manageFilters, setManageFilters] = useState({
    instrumentType: '',
    holdingId: ''
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [paginationCursors, setPaginationCursors] = useState({});
  const [hasNextPage, setHasNextPage] = useState(false);

  // Graph settings
  const [graphPeriod, setGraphPeriod] = useState('1Y');
  const [graphToggles, setGraphToggles] = useState({
    sensex: true,
    nifty: false,
    sp500: false,
    portfolio: true,
    mf: false,
    stock: false,
    gold: false
  });

  // Data states
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [portfolioAggregates, setPortfolioAggregates] = useState(null);
  const [paginatedTransactions, setPaginatedTransactions] = useState([]);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);
  const [lastDataFetch, setLastDataFetch] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      if (!user || !user.uid) {
        console.error('❌ No authenticated user!');
        return;
      }

      // ✅ Validate user owns this data
      const userId = user.uid;
      if (!userId.match(/^[a-zA-Z0-9-_]+$/)) {
        console.error('❌ Invalid user ID format!');
        return;
      }

      try {
        const now = Date.now();
        const cacheKey = `portfolio_${user.uid}`;

        // Check if we have recent data in memory
        if (lastDataFetch && (now - lastDataFetch < CACHE_DURATION)) {
          console.log('✅ Using in-memory cache (no fetch needed)');
          return;
        }

        // Try to load from localStorage cache first
        const cachedHoldings = getCachedData(`${cacheKey}_holdings`);
        const cachedTransactions = getCachedData(`${cacheKey}_transactions`);
        const cachedAggregates = getCachedData(`${cacheKey}_aggregates`);

        if (cachedHoldings && cachedTransactions) {
          console.log('✅ Loaded from localStorage cache');
          setHoldings(cachedHoldings);
          setTransactions(cachedTransactions);
          if (cachedAggregates) {
            setPortfolioAggregates(cachedAggregates);
          }
          setLastDataFetch(now);
          return;
        }

        // Cache miss - fetch from Firebase
        console.log('📡 Fetching fresh data from Firebase...');

        // Load holdings
        const holdingsRef = collection(db, `users/${user.uid}/holdings`);
        const holdingsSnap = await getDocs(holdingsRef);
        const loadedHoldings = holdingsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Load transactions
        const transactionsRef = collection(db, `users/${user.uid}/transactions`);
        const transactionsQuery = query(transactionsRef, limit(10000));  // ✅ Hard limit
        const transactionsSnap = await getDocs(transactionsQuery);

        if (transactionsSnap.docs.length === 10000) {
          console.warn('⚠️ Transaction limit reached! Some transactions may not be loaded.');
          // TODO: Implement chunked loading
        }

        const loadedTransactions = transactionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // If Firebase is empty
        if (loadedHoldings.length === 0 && loadedTransactions.length === 0) {
          console.log("Firebase is empty - use 'Load Sample Data' button if needed");
        }

        setHoldings(loadedHoldings);
        setTransactions(loadedTransactions);

        // Cache the data
        setCachedData(`${cacheKey}_holdings`, loadedHoldings);
        setCachedData(`${cacheKey}_transactions`, loadedTransactions);

        // Load portfolio aggregates
        const aggRef = doc(db, `users/${user.uid}/aggregates/portfolio`);
        const aggSnap = await getDoc(aggRef);

        if (aggSnap.exists()) {
          const aggData = aggSnap.data();
          setPortfolioAggregates(aggData);
          setCachedData(`${cacheKey}_aggregates`, aggData);
        } else if (loadedHoldings.length > 0) {
          console.log('Creating initial portfolio aggregates...');
          await recalculatePortfolioAggregates();
          // Reload aggregates after creation
          const newAggSnap = await getDoc(aggRef);
          if (newAggSnap.exists()) {
            const aggData = newAggSnap.data();
            setPortfolioAggregates(aggData);
            setCachedData(`${cacheKey}_aggregates`, aggData);
          }
        }

        setLastDataFetch(now);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data from Firebase');
      }
    };

    loadData();
  }, [user]); // Only reload when user changes

  // Load paginated transactions when holding selection changes
  useEffect(() => {
    if (!manageFilters.holdingId || manageFilters.holdingId === '__new__') {
      setPaginatedTransactions([]);
      setHasNextPage(false);
      setTotalTransactionCount(0);
      setIsLoadingTransactions(false);
      return;
    }

    let isMounted = true;
    setIsLoadingTransactions(true);

    const loadPage = async () => {
      try {
        // Get total count (for display only)
        const count = transactions.filter(t => t.holdingId === manageFilters.holdingId && !t.deleted).length;

        // Fetch paginated data from Firestore
        const { docs, hasMore } = await fetchTransactionsPage(
          manageFilters.holdingId,
          currentPageNum,
          itemsPerPage
        );

        if (isMounted) {
          setTotalTransactionCount(count);
          setPaginatedTransactions(docs);
          setHasNextPage(hasMore);
          setIsLoadingTransactions(false);
        }
      } catch (error) {
        console.error('Error loading page:', error);
        if (isMounted) {
          setIsLoadingTransactions(false);
        }
      }
    };

    loadPage();
    return () => {
      isMounted = false;
      setIsLoadingTransactions(false);
    };
  }, [manageFilters.holdingId, currentPageNum, itemsPerPage, transactions.length]); // Reload when transactions change

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateHoldingStats = (holdingId) => {
    const holding = holdings.find(h => h.id === holdingId);
    if (!holding) return null;

    // Bank balance special case
    if (holding.type === 'bank') {
      const holdingTransactions = transactions
        .filter(t => t.holdingId === holdingId && !t.deleted)
        .sort((a, b) => new Date(b.date) - new Date(a.date));  // ✅ Sort by date

      const latestBalance = holdingTransactions.length > 0
        ? holdingTransactions[0].amount  // ✅ First item after sorting = most recent
        : 0;

      return {
        ...holding,
        quantity: 0,
        avgCost: 0,
        totalCost: 0,
        currentValue: latestBalance,
        capitalGain: 0,
        totalIncome: 0,
        totalGain: 0,
        totalReturn: 0
      };
    }

    // USE DENORMALIZED VALUES (fallback to calculation if missing)
    const totalQuantity = holding.totalQuantity ?? 0;
    const avgCost = holding.avgCost ?? 0;
    const totalCost = holding.totalCost ?? 0;
    const totalIncome = holding.totalIncome ?? 0;

    const currentValue = totalQuantity * (holding.currentPrice || 0);
    const capitalGain = currentValue - totalCost;
    const totalGain = capitalGain + totalIncome;
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      ...holding,
      quantity: totalQuantity,
      avgCost,
      totalCost,
      currentValue,
      capitalGain,
      totalIncome,
      totalGain,
      totalReturn
    };
  };

  const calculateTypeSummary = () => {
    const summary = {};

    holdings.forEach(holding => {
      const stats = calculateHoldingStats(holding.id);
      if (!stats) return;

      if (!summary[holding.type]) {
        summary[holding.type] = {
          type: holding.type,
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          totalGain: 0
        };
      }

      summary[holding.type].totalCost += stats.totalCost;
      summary[holding.type].currentValue += stats.currentValue;
      summary[holding.type].totalIncome += stats.totalIncome;
      summary[holding.type].totalGain += stats.totalGain;
    });

    return Object.values(summary).map(item => ({
      ...item,
      totalReturn: item.totalCost > 0 ? (item.totalGain / item.totalCost) * 100 : 0
    }));
  };

  const calculatePortfolioStats = () => {
    const typeSummary = calculateTypeSummary();

    const totalCost = typeSummary.reduce((sum, item) => sum + item.totalCost, 0);
    const currentValue = typeSummary.reduce((sum, item) => sum + item.currentValue, 0);
    const totalIncome = typeSummary.reduce((sum, item) => sum + item.totalIncome, 0);
    const totalGain = typeSummary.reduce((sum, item) => sum + item.totalGain, 0);
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return { totalCost, currentValue, totalIncome, totalGain, totalReturn };
  };

  const updateHoldingStats = async (holdingId) => {
    if (!user) return;

    const holding = holdings.find(h => h.id === holdingId);
    if (!holding) return;

    const holdingTransactions = transactions.filter(t => t.holdingId === holdingId && !t.deleted);

    let totalQuantity = 0;
    let totalCost = 0;
    let totalIncome = 0;
    let lastTransactionDate = null;

    holdingTransactions.forEach(txn => {
      if (txn.type === 'buy') {
        totalQuantity += txn.quantity;
        totalCost += txn.amount;
      } else if (txn.type === 'sell') {
        totalQuantity -= txn.quantity;
      } else if (txn.type === 'dividend' || txn.type === 'interest') {
        totalIncome += txn.amount;
      }

      if (!lastTransactionDate || txn.date > lastTransactionDate) {
        lastTransactionDate = txn.date;
      }
    });

    // Calculate gold interest if applicable
    if (holding.type === 'gold') {
      const goldTxn = holdingTransactions.find(t => t.type === 'buy' && t.interestRate);
      if (goldTxn && goldTxn.interestRate) {
        const startDate = new Date(goldTxn.interestStartDate || goldTxn.date);
        const today = new Date();
        const daysHeld = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const yearsHeld = daysHeld / 365;
        const accruedInterest = totalCost * (goldTxn.interestRate / 100) * yearsHeld;
        totalIncome += accruedInterest;
      }
    }

    const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const currentValue = totalQuantity * holding.currentPrice;

    // NEW: Use batch for holding + aggregate updates
    try {
      const batch = writeBatch(db);

      // Update holding
      const holdingRef = doc(db, `users/${user.uid}/holdings`, holdingId);
      batch.update(holdingRef, {
        totalQuantity,
        avgCost,
        totalCost,
        currentValue,
        totalIncome,
        lastTransactionDate,
        transactionCount: holdingTransactions.length,
        updatedAt: new Date().toISOString()
      });

      await batch.commit();

      // Update local state
      setHoldings(prev => prev.map(h =>
        h.id === holdingId
          ? { ...h, totalQuantity, avgCost, totalCost, currentValue, totalIncome, lastTransactionDate, transactionCount: holdingTransactions.length, updatedAt: new Date().toISOString() }
          : h
      ));

      console.log('✅ Holding stats updated via batch');
    } catch (error) {
      console.error('Error updating holding stats:', error);
    }
  };

  const recalculatePortfolioAggregates = async () => {
    if (!user) return;

    try {
      const typeSummary = calculateTypeSummary();

      const totalCost = typeSummary.reduce((sum, item) => sum + item.totalCost, 0);
      const currentValue = typeSummary.reduce((sum, item) => sum + item.currentValue, 0);
      const totalIncome = typeSummary.reduce((sum, item) => sum + item.totalIncome, 0);
      const totalGain = typeSummary.reduce((sum, item) => sum + item.totalGain, 0);
      const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

      const byType = {};
      typeSummary.forEach(item => {
        byType[item.type] = {
          totalCost: item.totalCost,
          currentValue: item.currentValue,
          totalIncome: item.totalIncome,
          totalGain: item.totalGain,
          totalReturn: item.totalReturn
        };
      });

      const aggData = {
        totalCost,
        currentValue,
        totalIncome,
        totalGain,
        totalReturn,
        byType,
        lastCalculated: new Date().toISOString()
      };

      // NEW: Use batch
      const batch = writeBatch(db);
      const aggRef = doc(db, `users/${user.uid}/aggregates/portfolio`);
      batch.set(aggRef, aggData);
      await batch.commit();

      // Update local state
      setPortfolioAggregates(aggData);

      if (user) {
        setCachedData(`portfolio_${user.uid}_aggregates`, aggData);
      }

      console.log('✅ Portfolio aggregates updated via batch');
    } catch (error) {
      console.error('Error updating portfolio aggregates:', error);
    }
  };

  // IMPORTANT: Requires 2 Firestore composite indexes:
  // Index 1 (for Manage Transactions page):
  // Collection: transactions
  // Fields: holdingId (Ascending), deleted (Ascending), date (Descending)
  // Index 2 (for Transaction History page):
  // Collection: transactions  
  // Fields: holdingId (Ascending), date (Descending)
  const fetchTransactionsPage = async (holdingId, pageNum, pageSize) => {
    if (!user || !holdingId || holdingId === '__new__') return { docs: [], hasMore: false };

    try {
      const transactionsRef = collection(db, `users/${user.uid}/transactions`);
      let q = query(
        transactionsRef,
        where('holdingId', '==', holdingId),
        where('deleted', '==', false),
        orderBy('date', 'desc'),
        limit(pageSize + 1) // Fetch one extra to check if there's a next page
      );

      // If not first page, use cursor
      if (pageNum > 1 && paginationCursors[holdingId]?.[pageNum - 1]) {
        try {
          const { startAfter: startAfterImport } = await import('firebase/firestore');
          q = query(q, startAfterImport(paginationCursors[holdingId][pageNum - 1]));
        } catch (error) {
          console.error('Error importing startAfter:', error);
        }
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.slice(0, pageSize).map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const hasMore = snapshot.docs.length > pageSize;

      // Store cursor for next page
      if (hasMore && snapshot.docs[pageSize - 1]) {
        setPaginationCursors(prev => ({
          ...prev,
          [holdingId]: {
            ...prev[holdingId],
            [pageNum]: snapshot.docs[pageSize - 1]
          }
        }));
      }

      return { docs, hasMore };
    } catch (error) {
      console.error('Error fetching paginated transactions:', error);
      return { docs: [], hasMore: false };
    }
  };

  // Cache helper functions
  const getCachedData = useCallback((key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid (within CACHE_DURATION)
      if (now - timestamp < CACHE_DURATION) {
        console.log(`✅ Using cached ${key} (${Math.floor((now - timestamp) / 1000)}s old)`);
        return data;
      } else {
        console.log(`❌ Cache expired for ${key}`);
        localStorage.removeItem(key);
        return null;
      }
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }, [CACHE_DURATION]);

  const setCachedData = useCallback((key, data) => {
    try {
      const dataStr = JSON.stringify({
        data,
        timestamp: Date.now()
      });

      // Check if data is too large (>2MB as safety buffer for 5MB total limit)
      if (dataStr.length > 2 * 1024 * 1024) {
        console.warn(`⚠️ Cache too large for ${key}, skipping cache`);
        return;
      }

      localStorage.setItem(key, dataStr);
      console.log(`💾 Cached ${key} (${(dataStr.length / 1024).toFixed(1)}KB)`);
    } catch (error) {
      // Quota exceeded - clear old cache and try again
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded, clearing cache...');
        try {
          // Clear all portfolio caches
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('portfolio_')) {
              localStorage.removeItem(k);
            }
          });
          console.log('✅ Cache cleared due to quota');
        } catch (clearError) {
          console.error('Error clearing cache:', clearError);
        }
      } else {
        console.error('Error writing cache:', error);
      }
    }
  }, []);

  const clearCache = useCallback(() => {
    if (!user) return;

    const cacheKey = `portfolio_${user.uid}`;
    const keys = [`${cacheKey}_holdings`, `${cacheKey}_transactions`, `${cacheKey}_aggregates`];
    keys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Cache cleared');
  }, [user]);


  const typeSummary = useMemo(() => calculateTypeSummary(), [holdings, transactions]);
  const portfolioStats = useMemo(() =>
    portfolioAggregates || calculatePortfolioStats(),
    [portfolioAggregates, holdings, transactions]
  );
  const pieData = useMemo(() =>
    typeSummary.map(item => ({
      name: INSTRUMENT_LABELS[item.type],
      value: item.currentValue,
      color: COLORS[item.type]
    })),
    [typeSummary]
  );

  const generateBenchmarkData = () => {
    const periods = {
      '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180,
      '1Y': 365, '3Y': 1095, '5Y': 1825, '7Y': 2555, '10Y': 3650, 'All': 3650
    };

    const days = periods[graphPeriod];
    const data = [];

    for (let i = days; i >= 0; i -= Math.max(1, Math.floor(days / 50))) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        sensex: 70000 + Math.random() * 5000,
        nifty: 21000 + Math.random() * 1500,
        sp500: 4500 + Math.random() * 300,
        portfolio: 100 + (days - i) * 0.05 + Math.random() * 10,
        mf: 100 + (days - i) * 0.06 + Math.random() * 8,
        stock: 100 + (days - i) * 0.04 + Math.random() * 12,
        gold: 100 + (days - i) * 0.03 + Math.random() * 5
      });
    }

    return data;
  };

  const renderHomePage = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Account Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">            
            <div className="text-center min-w-0">
              <div className="text-slate-600 text-xs font-medium mb-1">Investment</div>
              <div className="text-xl font-bold text-slate-800">
                ₹{(portfolioStats.totalCost / 100000).toFixed(2)}L
              </div>
            </div>

            <div className="text-center min-w-0">
              <div className="text-slate-600 text-xs font-medium mb-1">Current Value</div>
              <div className="text-xl font-bold text-slate-800">
                ₹{(portfolioStats.currentValue / 100000).toFixed(2)}L
              </div>
            </div>

            <div className="text-center min-w-0">
              <div className="text-slate-600 text-xs font-medium mb-1">Total Gain</div>
              <div className={`text-xl font-bold ${portfolioStats.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioStats.totalGain >= 0 ? '+' : ''}₹{(portfolioStats.totalGain / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-slate-500">
                (Inc. ₹{(portfolioStats.totalIncome / 1000).toFixed(1)}K)
              </div>
            </div>

            <div className="text-center min-w-0">
              <div className="text-slate-600 text-xs font-medium mb-1">Returns</div>
              <div className={`text-xl font-bold flex items-center justify-center gap-1 ${portfolioStats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioStats.totalReturn >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {portfolioStats.totalReturn >= 0 ? '+' : ''}{portfolioStats.totalReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {holdings.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <p className="text-blue-800 mb-4">Your portfolio is empty. Want to try with sample data?</p>
            <button
              onClick={loadSampleDataToFirebase}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Load Sample Data
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Portfolio Allocation</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={window.innerWidth < 640 ? 90 : 120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Asset Summary</h2>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Cost</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Value</th>
                      <th
                        className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase cursor-pointer hover:text-blue-600"
                        onClick={() => setShowGainInPercent(!showGainInPercent)}
                      >
                        Gain {showGainInPercent ? '%' : '₹'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {typeSummary.map(item => (
                      <tr
                        key={item.type}
                        onClick={() => {
                          setSelectedType(item.type);
                          setCurrentPage('detail');
                        }}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.type] }}></div>
                            <span className="font-medium text-slate-900">{INSTRUMENT_LABELS[item.type]}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          ₹{item.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          ₹{item.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`px-6 py-4 text-right font-medium ${item.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {showGainInPercent ? (
                            <>{item.totalReturn >= 0 ? '+' : ''}{item.totalReturn.toFixed(2)}%</>
                          ) : (
                            <>{item.totalGain >= 0 ? '+' : ''}₹{item.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPage = () => {
    const typeHoldings = holdings
      .filter(h => h.type === selectedType)
      .map(h => calculateHoldingStats(h.id))
      .filter(Boolean);

    if (selectedType === 'bank') {
      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentPage('home')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Home
          </button>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">Bank Balances</h2>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Bank Name</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {typeHoldings.map(holding => (
                      <tr key={holding.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{holding.name}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <button
          onClick={() => setCurrentPage('home')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">{INSTRUMENT_LABELS[selectedType]} Holdings</h2>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                    {selectedType !== 'gold' && <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>}
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      {selectedType === 'gold' ? 'Weight (gm)' : 'Units'}
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Cost NAV</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Current NAV</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Value</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Income</th>
                    <th
                      className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase cursor-pointer hover:text-blue-600"
                      onClick={() => setShowGainInPercent(!showGainInPercent)}
                    >
                      Gain {showGainInPercent ? '%' : '₹'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {typeHoldings.map(holding => (
                    <tr
                      key={holding.id}
                      onClick={() => {
                        setSelectedHolding(holding.id);
                        setCurrentPage('transactions');
                      }}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">{holding.name}</td>
                      {selectedType !== 'gold' && <td className="px-6 py-4 text-slate-600">{holding.category}</td>}
                      <td className="px-6 py-4 text-right text-slate-900">{holding.quantity.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-900">₹{holding.avgCost.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-900">₹{holding.currentPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">
                        ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-6 py-4 text-right text-green-600">
                        ₹{holding.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${holding.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {showGainInPercent ? (
                          <>{holding.totalReturn >= 0 ? '+' : ''}{holding.totalReturn.toFixed(2)}%</>
                        ) : (
                          <>{holding.totalGain >= 0 ? '+' : ''}₹{holding.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Performance Comparison</h3>

          <div className="flex flex-wrap gap-2 mb-4">
            {['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '7Y', '10Y', 'All'].map(period => (
              <button
                key={period}
                onClick={() => setGraphPeriod(period)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${graphPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {period}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {Object.keys(graphToggles).map(key => (
              <button
                key={key}
                onClick={() => setGraphToggles({ ...graphToggles, [key]: !graphToggles[key] })}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${graphToggles[key]
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-slate-100 text-slate-500'
                  }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={generateBenchmarkData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {graphToggles.sensex && <Line type="monotone" dataKey="sensex" stroke="#ef4444" strokeWidth={2} dot={false} />}
              {graphToggles.nifty && <Line type="monotone" dataKey="nifty" stroke="#f59e0b" strokeWidth={2} dot={false} />}
              {graphToggles.sp500 && <Line type="monotone" dataKey="sp500" stroke="#8b5cf6" strokeWidth={2} dot={false} />}
              {graphToggles.portfolio && <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={3} dot={false} />}
              {graphToggles.mf && <Line type="monotone" dataKey="mf" stroke="#10b981" strokeWidth={2} dot={false} />}
              {graphToggles.stock && <Line type="monotone" dataKey="stock" stroke="#06b6d4" strokeWidth={2} dot={false} />}
              {graphToggles.gold && <Line type="monotone" dataKey="gold" stroke="#f59e0b" strokeWidth={2} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTransactionsPage = () => {
    const holding = holdings.find(h => h.id === selectedHolding);
    // NEW: Exclude deleted transactions
    const holdingTransactions = transactions
      .filter(t => t.holdingId === selectedHolding && !t.deleted)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const stats = calculateHoldingStats(selectedHolding);

    return (
      <div className="space-y-8">
        <button
          onClick={() => setCurrentPage('detail')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to {INSTRUMENT_LABELS[selectedType]}
        </button>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{holding.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-slate-600 text-sm">Total Units</div>
              <div className="text-xl font-bold text-slate-800">{stats.quantity.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">Avg Cost</div>
              <div className="text-xl font-bold text-slate-800">₹{stats.avgCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">Current Value</div>
              <div className="text-xl font-bold text-slate-800">₹{stats.currentValue.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">Total Return</div>
              <div className={`text-xl font-bold ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-800">Transaction History</h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Quantity</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Price</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Amount</th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Balance Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {holdingTransactions.map((txn, idx) => {
                    let runningBalance = 0;
                    for (let i = holdingTransactions.length - 1; i >= idx; i--) {
                      if (holdingTransactions[i].type === 'buy') runningBalance += holdingTransactions[i].quantity;
                      if (holdingTransactions[i].type === 'sell') runningBalance -= holdingTransactions[i].quantity;
                    }

                    return (
                      <tr key={txn.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900">{new Date(txn.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${txn.type === 'buy' ? 'bg-green-100 text-green-800' :
                            txn.type === 'sell' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                            {txn.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">{txn.quantity > 0 ? txn.quantity.toFixed(2) : '-'}</td>
                        <td className="px-6 py-4 text-right text-slate-900">{txn.price > 0 ? `₹${txn.price.toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">₹{txn.amount.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{runningBalance.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveTransaction = async () => {
    console.log('🔵 Save Transaction Started');

    if (isSaving) {
      console.log('⚠️ Already saving, ignoring click');
      return;
    }

    if (!transactionForm.date) {
      alert('Please select a date');
      setIsSaving(false);
      return;
    }

    // === START VALIDATION ===

    // Validate date FIRST (so enteredDate exists)
    const enteredDate = new Date(transactionForm.date);

    // Check if date is valid
    if (isNaN(enteredDate.getTime())) {
      alert('Invalid date format');
      setIsSaving(false);
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (enteredDate > today) {
      alert('Transaction date cannot be in the future');
      setIsSaving(false);
      return;
    }

    const minDate = new Date('2000-01-01');
    if (enteredDate < minDate) {
      alert('Transaction date seems too old. Please check the date.');
      setIsSaving(false);
      return;
    }

    // Validate transaction type EARLY
    let validTypes = ['buy', 'sell', 'dividend', 'interest'];
    if (manageFilters.instrumentType === 'bank') {
      validTypes.push('balance');
    }

    if (!validTypes.includes(transactionForm.type)) {
      alert('Invalid transaction type for this instrument');
      setIsSaving(false);
      return;
    }

    // Validate quantity (for buy/sell transactions) - use Number() not parseFloat()
    if (transactionForm.type === 'buy' || transactionForm.type === 'sell') {
      const qtyStr = String(transactionForm.quantity).trim();
      const qty = Number(qtyStr);

      if (qtyStr === '' || isNaN(qty) || qty <= 0 || !isFinite(qty)) {
        alert('Quantity must be a positive number');
        setIsSaving(false);
        return;
      }

      // Upper bound validation
      const MAX_QUANTITY = 1000000; // 10 lakh units
      if (qty > MAX_QUANTITY) {
        alert(`Quantity cannot exceed ${MAX_QUANTITY.toLocaleString('en-IN')} units`);
        setIsSaving(false);
        return;
      }

      // Check if selling more than owned
      if (transactionForm.type === 'sell' && manageFilters.holdingId !== '__new__') {
        const holding = holdings.find(h => h.id === manageFilters.holdingId);
        if (holding && holding.totalQuantity < qty) {
          alert(`Cannot sell ${qty} units. You only own ${holding.totalQuantity.toFixed(2)} units.`);
          setIsSaving(false);
          return;
        }
      }
    }

    // Validate price/amount - use Number() not parseFloat()
    const priceStr = String(transactionForm.price).trim();
    const priceValue = Number(priceStr);

    if (priceStr === '' || isNaN(priceValue) || priceValue <= 0 || !isFinite(priceValue)) {
      alert('Price/Amount must be a positive number');
      setIsSaving(false);
      return;
    }

    // Upper bound validation
    const MAX_PRICE = 10000000; // 1 crore (10 million)
    if (priceValue > MAX_PRICE) {
      alert(`Price cannot exceed ₹${MAX_PRICE.toLocaleString('en-IN')}`);
      setIsSaving(false);
      return;
    }

    // Validate gold-specific fields
    if (manageFilters.instrumentType === 'gold' && transactionForm.interestRate) {
      const rateStr = String(transactionForm.interestRate).trim();
      const rate = Number(rateStr);
      if (rateStr !== '' && (isNaN(rate) || rate < 0 || rate > 100)) {
        alert('Interest rate must be between 0 and 100');
        setIsSaving(false);
        return;
      }
    }

    // Validate NEW holding fields ONLY if creating new holding
    if (manageFilters.holdingId === '__new__') {
      if (!transactionForm.name || !transactionForm.symbol) {
        alert('Please enter both Name and Symbol for new holding');
        setIsSaving(false);
        return;
      }

      if (transactionForm.name.trim().length < 2) {
        alert('Holding name must be at least 2 characters');
        setIsSaving(false);
        return;
      }

      if (transactionForm.symbol.trim().length < 2 || transactionForm.symbol.trim().length > 20) {
        alert('Symbol must be between 2 and 20 characters');
        setIsSaving(false);
        return;
      }

      if (!/^[A-Z0-9.-]+$/i.test(transactionForm.symbol.trim())) {
        alert('Symbol can only contain letters, numbers, dots and hyphens');
        setIsSaving(false);
        return;
      }
    }

    // === END VALIDATION ===

    // Calculate amount AFTER validation
    const amount = transactionForm.type === 'dividend' || transactionForm.type === 'interest' || transactionForm.type === 'balance'
      ? priceValue
      : (Number(transactionForm.quantity) || 0) * priceValue;

    const MAX_AMOUNT = 1000000000; // 100 crore
    if (amount > MAX_AMOUNT) {
      alert(`Transaction amount cannot exceed ₹${(MAX_AMOUNT / 10000000).toFixed(0)} crore`);
      setIsSaving(false);
      return;
    }

    if (!manageFilters.holdingId) {
      alert('Please select a holding first!');
      setIsSaving(false);
      return;
    }

    try {
      setIsSaving(true);
      const batch = writeBatch(db);
      let batchOperationCount = 0;
      const MAX_BATCH_SIZE = 500;
      let targetHoldingId = manageFilters.holdingId;
      let newHoldingCreated = false;
      let tempHolding = null;

      // If creating new holding
      if (manageFilters.holdingId === '__new__') {
        console.log('✅ Creating new holding...');

        if (!confirm(`Create new ${INSTRUMENT_LABELS[manageFilters.instrumentType]}: "${transactionForm.name}" (${transactionForm.symbol})?`)) {
          setIsSaving(false);
          return;
        }

        const symbolUpper = transactionForm.symbol.toUpperCase();
        const duplicate = holdings.find(h =>
          h.type === manageFilters.instrumentType &&
          h.symbol.toUpperCase() === symbolUpper
        );

        if (duplicate) {
          setIsSaving(false);
          alert(`A ${INSTRUMENT_LABELS[manageFilters.instrumentType]} with symbol "${symbolUpper}" already exists!`);
          return;
        }

        // ✅ CREATE THE HOLDING OBJECT
        const newHolding = {
          type: manageFilters.instrumentType,
          symbol: sanitizeInput(transactionForm.symbol).toUpperCase(),
          name: sanitizeInput(transactionForm.name),
          category: transactionForm.category ? sanitizeInput(transactionForm.category) : null,
          currentPrice: Number(transactionForm.price) || 0,
          totalQuantity: 0,
          avgCost: 0,
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          lastTransactionDate: null,
          transactionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const holdingRef = doc(collection(db, `users/${user.uid}/holdings`));
        batch.set(holdingRef, newHolding);
        batchOperationCount++;

        if (batchOperationCount >= MAX_BATCH_SIZE) {
          alert('Operation too large. Please contact support.');
          setIsSaving(false);
          return;
        }

        targetHoldingId = holdingRef.id;
        newHoldingCreated = true;

        // Store for optimistic update AFTER commit
        tempHolding = { ...newHolding, id: holdingRef.id };
      }

      // Create/Update transaction
      const newTransaction = {
        holdingId: targetHoldingId,
        type: sanitizeInput(transactionForm.type),
        date: transactionForm.date,
        quantity: (transactionForm.type === 'buy' || transactionForm.type === 'sell')
          ? Number(sanitizeNumber(transactionForm.quantity)) || 0
          : 0,
        price: Number(sanitizeNumber(transactionForm.price)) || 0,
        amount,
        interestRate: transactionForm.interestRate ? parseFloat(transactionForm.interestRate) : null,
        interestStartDate: transactionForm.interestStartDate || null,
        deleted: false,
        deletedAt: null
      };

      console.log('Transaction to save:', newTransaction);

      let txnRef;
      if (editingTransaction) {
        console.log('✅ Updating transaction:', editingTransaction.id);
        txnRef = doc(db, `users/${user.uid}/transactions`, editingTransaction.id);
        const updatedTransaction = { ...newTransaction, deleted: false, deletedAt: null };
        batch.update(txnRef, updatedTransaction);
      } else {
        console.log('✅ Creating new transaction...');
        txnRef = doc(collection(db, `users/${user.uid}/transactions`));
        batch.set(txnRef, newTransaction);
      }

      batchOperationCount++;

      if (batchOperationCount >= MAX_BATCH_SIZE) {
        alert('Operation too large. Please contact support.');
        setIsSaving(false);
        return;
      }

      // ✅ NOW commit everything atomically (holding + transaction together)
      console.log('🔄 Committing batch...');

      try {
        await batch.commit();
        console.log('✅ Batch committed successfully!');

        // ✅ Optimistic update AFTER successful commit
        if (newHoldingCreated) {
          setHoldings(prev => [...prev, tempHolding]);
          setManageFilters(prev => ({ ...prev, holdingId: targetHoldingId }));
        }

        if (editingTransaction) {
          setTransactions(prev => prev.map(t =>
            t.id === editingTransaction.id ? { ...newTransaction, id: editingTransaction.id } : t
          ));
        } else {
          setTransactions(prev => [...prev, { ...newTransaction, id: txnRef.id }]);
        }
      } catch (error) {
        console.error('❌ Batch commit failed:', error);
        // No optimistic updates were made, so nothing to rollback
        throw error;
      }

      // Update holding stats and aggregates AFTER successful commit
      try {
        await updateHoldingStats(targetHoldingId);
        await recalculatePortfolioAggregates();
      } catch (statsError) {
        console.error('⚠️ Transaction saved but stats update failed:', statsError);
        alert('Transaction saved, but portfolio stats update failed. Please refresh the page.');
      }

      // Reset form
      setTransactionForm({
        type: 'buy',
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        price: '',
        interestRate: '',
        interestStartDate: '',
        name: '',
        symbol: '',
        category: ''
      });
      setEditingTransaction(null);
      setShowTransactionForm(false);

      clearCache();
      setLastDataFetch(null);
      setIsSaving(false);
      alert('Transaction saved successfully!');
    } catch (error) {
      console.error('❌ Error saving transaction:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      setIsSaving(false);
      alert('Failed to save transaction: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Delete this transaction?')) return;

    try {
      const txn = transactions.find(t => t.id === id);
      if (!txn || txn.deleted) {
        alert('Transaction is already deleted');
        return;
      }

      // NEW: Soft delete - mark as deleted instead of removing
      const batch = writeBatch(db);
      const txnRef = doc(db, `users/${user.uid}/transactions`, id);

      batch.update(txnRef, {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      console.log('🔄 Committing soft delete batch...');
      await batch.commit();
      console.log('✅ Soft delete batch committed!');

      // Update local state - mark as deleted
      setTransactions(prev => prev.map(t =>
        t.id === id
          ? { ...t, deleted: true, deletedAt: new Date().toISOString() }
          : t
      ));

      // Update holding stats and aggregates AFTER successful commit
      if (txn && txn.holdingId) {
        await updateHoldingStats(txn.holdingId);
        await recalculatePortfolioAggregates();
      }

      clearCache();
      setLastDataFetch(null);

      alert('Transaction deleted successfully!');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction: ' + error.message);
    }
  };

  const renderManageTransactions = () => {
    const filteredHoldings = manageFilters.instrumentType
      ? holdings.filter(h => h.type === manageFilters.instrumentType)
      : [];

    const totalPages = Math.ceil(totalTransactionCount / itemsPerPage);

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Manage Transactions</h2>
          {(manageFilters.holdingId || manageFilters.instrumentType) && (
            <button
              onClick={() => {
                setShowTransactionForm(true);
                setEditingTransaction(null);
                setTransactionForm({
                  type: 'buy',
                  date: new Date().toISOString().split('T')[0],
                  quantity: '',
                  price: '',
                  interestRate: '',
                  interestStartDate: '',
                  name: '',
                  symbol: '',
                  category: ''
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Transaction
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Select Category & Holding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">1. Select Category</label>
              <select
                value={manageFilters.instrumentType}
                onChange={(e) => {
                  setManageFilters({ instrumentType: e.target.value, holdingId: '' });
                  setCurrentPageNum(1);
                  setPaginationCursors({});
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Category --</option>
                <option value="stock">Stocks</option>
                <option value="mf">Mutual Funds</option>
                <option value="gold">Gold</option>
                <option value="bank">Bank Balance</option>
              </select>
            </div>

            {manageFilters.instrumentType && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  2. Select {INSTRUMENT_LABELS[manageFilters.instrumentType]}
                </label>
                <select
                  value={manageFilters.holdingId}
                  onChange={(e) => {
                    setManageFilters({ ...manageFilters, holdingId: e.target.value });
                    setCurrentPageNum(1);
                    setPaginationCursors({});
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {!manageFilters.holdingId && <option value="">-- Select Holding --</option>}
                  <option value="__new__">➕ Add New {INSTRUMENT_LABELS[manageFilters.instrumentType]}</option>
                  {filteredHoldings.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {showTransactionForm && (manageFilters.holdingId || manageFilters.instrumentType) && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {editingTransaction ? 'Edit Transaction' : manageFilters.holdingId === '__new__' ? 'Add New Holding & Transaction' : 'Add New Transaction'}
              </h3>
              <button
                onClick={() => {
                  setShowTransactionForm(false);
                  setEditingTransaction(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Show Name and Symbol fields if adding new holding */}
              {manageFilters.holdingId === '__new__' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Name * <span className="text-xs text-slate-500">(e.g., Reliance Industries)</span>
                    </label>
                    <input
                      type="text"
                      value={transactionForm.name}
                      onChange={(e) => setTransactionForm({ ...transactionForm, name: e.target.value })}
                      placeholder="Enter holding name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Symbol * <span className="text-xs text-slate-500">(e.g., RELIANCE.NS)</span>
                    </label>
                    <input
                      type="text"
                      value={transactionForm.symbol}
                      onChange={(e) => setTransactionForm({ ...transactionForm, symbol: e.target.value })}
                      placeholder="Enter symbol"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {(manageFilters.instrumentType === 'mf' || manageFilters.instrumentType === 'stock') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                      <select
                        value={transactionForm.category}
                        onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        {manageFilters.instrumentType === 'mf' && (
                          <>
                            <option value="Liquid Fund">Liquid Fund</option>
                            <option value="Flexi Cap">Flexi Cap</option>
                            <option value="Large Cap">Large Cap</option>
                            <option value="Mid Cap">Mid Cap</option>
                            <option value="Small Cap">Small Cap</option>
                            <option value="Balanced Advantage">Balanced Advantage</option>
                            <option value="Debt">Debt</option>
                          </>
                        )}
                        {manageFilters.instrumentType === 'stock' && (
                          <>
                            <option value="Large Cap">Large Cap</option>
                            <option value="Mid Cap">Mid Cap</option>
                            <option value="Small Cap">Small Cap</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Type</label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                  <option value="dividend">Dividend</option>
                  <option value="interest">Interest</option>
                  {manageFilters.instrumentType === 'bank' && <option value="balance">Update Balance</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {transactionForm.type !== 'dividend' && transactionForm.type !== 'interest' && transactionForm.type !== 'balance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {manageFilters.instrumentType === 'gold' ? 'Weight (grams)' : 'Quantity'} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={transactionForm.quantity}
                      onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={transactionForm.price}
                      onChange={(e) => setTransactionForm({ ...transactionForm, price: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {(transactionForm.type === 'dividend' || transactionForm.type === 'interest' || transactionForm.type === 'balance') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transactionForm.price}
                    onChange={(e) => setTransactionForm({ ...transactionForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {manageFilters.instrumentType === 'gold' && transactionForm.type === 'buy' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={transactionForm.interestRate}
                      onChange={(e) => setTransactionForm({ ...transactionForm, interestRate: e.target.value })}
                      placeholder="e.g., 2.5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Interest Start Date</label>
                    <input
                      type="date"
                      value={transactionForm.interestStartDate}
                      onChange={(e) => setTransactionForm({ ...transactionForm, interestStartDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveTransaction}
                disabled={isSaving}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg ${isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : editingTransaction ? 'Update' : 'Save'} Transaction
              </button>
              <button
                onClick={() => {
                  setShowTransactionForm(false);
                  setEditingTransaction(null);
                }}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rest of the transaction list code stays the same... */}
        {manageFilters.holdingId && manageFilters.holdingId !== '__new__' && paginatedTransactions.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                Transactions for {holdings.find(h => h.id === manageFilters.holdingId)?.name}
              </h3>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPageNum(1);
                    setPaginationCursors({});
                  }}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(n => (
                    <option key={n} value={n}>{n} per page</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Quantity</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Price</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Amount</th>
                        <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {paginatedTransactions.map(txn => (
                        <tr key={txn.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-slate-900">{new Date(txn.date).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${txn.type === 'buy' ? 'bg-green-100 text-green-800' :
                              txn.type === 'sell' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                              {txn.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-900">{txn.quantity > 0 ? txn.quantity.toFixed(2) : '-'}</td>
                          <td className="px-6 py-4 text-right text-slate-900">{txn.price > 0 ? `₹${txn.price.toFixed(2)}` : '-'}</td>
                          <td className="px-6 py-4 text-right font-medium text-slate-900">₹{txn.amount.toLocaleString('en-IN')}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => {
                                  setTransactionForm({
                                    type: txn.type,
                                    date: txn.date,
                                    quantity: txn.quantity.toString(),
                                    price: txn.price.toString(),
                                    interestRate: txn.interestRate?.toString() || '',
                                    interestStartDate: txn.interestStartDate || '',
                                    name: '',
                                    symbol: '',
                                    category: ''
                                  });
                                  setEditingTransaction(txn);
                                  setShowTransactionForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(txn.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  Showing {((currentPageNum - 1) * itemsPerPage) + 1} to {Math.min(currentPageNum * itemsPerPage, totalTransactionCount)} of {totalTransactionCount} transactions
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPageNum(Math.max(1, currentPageNum - 1))}
                    disabled={currentPageNum === 1}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    Page {currentPageNum} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageNum(currentPageNum + 1)}
                    disabled={!hasNextPage}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show loading state */}
        {isLoadingTransactions && manageFilters.holdingId && manageFilters.holdingId !== '__new__' && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <RefreshCw className="mx-auto text-slate-400 mb-4 animate-spin" size={48} />
            <p className="text-slate-600">Loading transactions...</p>
          </div>
        )}

        {/* Show empty state only when NOT loading and conditions are met */}
        {!isLoadingTransactions &&
          manageFilters.holdingId &&
          manageFilters.holdingId !== '__new__' &&
          paginatedTransactions.length === 0 &&
          totalTransactionCount === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <BarChart3 className="mx-auto text-slate-300 mb-4" size={64} />
              <p className="text-slate-600 text-lg mb-4">No transactions found for this holding</p>
              <button
                onClick={() => setShowTransactionForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Add First Transaction
              </button>
            </div>
          )}
      </div>
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const lastUser = localStorage.getItem('last_user_id');
        if (lastUser && lastUser !== currentUser.uid) {
          console.log('🔄 User changed, clearing cache');
          // ✅ Manually clear for the new user
          const cacheKey = `portfolio_${currentUser.uid}`;
          const keys = [`${cacheKey}_holdings`, `${cacheKey}_transactions`, `${cacheKey}_aggregates`];
          keys.forEach(key => localStorage.removeItem(key));
        }
        localStorage.setItem('last_user_id', currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center min-w-0">
          <Wallet className="mx-auto text-blue-600 mb-4" size={64} />
          <p className="text-slate-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md mx-auto text-center">
          <Wallet className="mx-auto text-blue-600 mb-4" size={64} />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Portfolio Tracker</h1>
          <p className="text-slate-600 mb-6">Track your investments in one place</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-3 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Function to load sample data to Firebase
  const loadSampleDataToFirebase = async () => {
    if (!user) return;

    try {
      const sampleHoldings = [
        {
          type: 'stock',
          symbol: 'RELIANCE.NS',
          name: 'Reliance Industries',
          category: 'Large Cap',
          currentPrice: 2800,
          totalQuantity: 0,
          avgCost: 0,
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          lastTransactionDate: null,
          transactionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          type: 'mf',
          symbol: 'PPFAS-FLEXI',
          name: 'Parag Parikh Flexi Cap Fund',
          category: 'Flexi Cap',
          currentPrice: 48,
          totalQuantity: 0,
          avgCost: 0,
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          lastTransactionDate: null,
          transactionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          type: 'mf',
          symbol: 'HDFC-LIQUID',
          name: 'HDFC Liquid Fund',
          category: 'Liquid Fund',
          currentPrice: 3545,
          totalQuantity: 0,
          avgCost: 0,
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          lastTransactionDate: null,
          transactionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
      ];

      // Save each holding to Firebase
      const holdingIds = {};
      for (const holding of sampleHoldings) {
        const docRef = await addDoc(collection(db, `users/${user.uid}/holdings`), holding);
        holdingIds[holding.symbol] = docRef.id;
      }

      // Create sample transactions
      const txnRef = await addDoc(collection(db, `users/${user.uid}/transactions`), {
        holdingId: holdingIds['RELIANCE.NS'],
        type: 'buy',
        date: '2024-01-15',
        quantity: 10,
        price: 2450,
        amount: 24500,
        deleted: false,
        deletedAt: null
      });

      // ✅ Update state with real ID
      setTransactions([{
        id: txnRef.id,  // ✅ Use real Firebase ID
        holdingId: holdingIds['RELIANCE.NS'],
        type: 'buy',
        date: '2024-01-15',
        quantity: 10,
        price: 2450,
        amount: 24500,
        deleted: false,
        deletedAt: null
      }]);

      // Now update stats
      await updateHoldingStats(holdingIds['RELIANCE.NS']);

      alert('Sample data loaded! Refreshing page...');
      window.location.reload();
    } catch (error) {
      console.error('Error loading sample data:', error);
      alert('Failed to load sample data');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile-friendly header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-none xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            {/* Logo and title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <Wallet className="text-blue-600" size={28} />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  {getFirstName(user)}'s Portfolio
                </h1>
              </div>
              {/* Mobile refresh button */}
              <button
                onClick={() => {
                  clearCache();
                  setLastDataFetch(null);
                  window.location.reload();
                }}
                className="sm:hidden text-slate-600 hover:text-blue-600 transition-colors p-2"
                title="Refresh data"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {/* User info and actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              {/* Last update time */}
              {lastDataFetch && (
                <span className="hidden sm:block text-xs text-slate-400 whitespace-nowrap">
                  Updated {Math.floor((currentTime - lastDataFetch) / 1000)}s ago
                </span>
              )}

              {/* Desktop refresh button */}
              <button
                onClick={() => {
                  clearCache();
                  setLastDataFetch(null);
                  window.location.reload();
                }}
                className="hidden sm:block text-slate-600 hover:text-blue-600 transition-colors"
                title="Refresh data"
              >
                <RefreshCw size={18} />
              </button>

              {/* Navigation tabs */}
              <nav className="flex gap-2">
                {currentPage !== 'home' && (
                  <button
                    onClick={() => setCurrentPage('home')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors bg-blue-600 text-white hover:bg-blue-800`}
                  >
                    Dashboard
                  </button>
                )}
                {currentPage !== 'manage' && (
                  <button
                    onClick={() => setCurrentPage('manage')}
                    className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap bg-blue-600 text-white hover:bg-blue-800`}
                  >
                    <span className="hidden sm:inline">Manage Transactions</span>
                    <span className="sm:hidden">Manage</span>
                  </button>
                )}
              </nav>

              {/* Logout button */}
              <button
                onClick={() => {
                  clearCache();
                  logOut();
                }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm sm:text-base border border-slate-300"
              >
                <LogOut size={18} />
                <span className="sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-none xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-8">
        {currentPage === 'home' && renderHomePage()}
        {currentPage === 'detail' && renderDetailPage()}
        {currentPage === 'transactions' && renderTransactionsPage()}
        {currentPage === 'manage' && renderManageTransactions()}
      </div>
    </div>
  );
};

export default PortfolioTracker;