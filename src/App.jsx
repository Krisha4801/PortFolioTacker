import { loadSampleData } from './loadSampleData';
import { validationForManageTransactionPage } from './validationForManageTransactionPage';
import { fetchAndUpdatePrices, updateHoldingPricesInFirebase } from './bufferStorage_currPrice';
import NotesModal from './NotesModal';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, TrendingUp, TrendingDown, RefreshCw, Wallet, BarChart3, ArrowLeft, Edit, Trash2, Save, X, LogIn, LogOut } from 'lucide-react';
import { db, auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, getDoc, setDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import AIAdvisor from './AIAdvisor';
import { fetchIndexHistories, normalise } from './fetchHistoricalData';

const isE2EMode = () => (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('e2e') === '1'
);

const e2eUser = {
  uid: 'selenium-e2e-user',
  displayName: 'Selenium Tester',
  email: 'selenium@example.com'
};

const e2eHoldings = [
  {
    id: 'e2e-stock-1',
    type: 'stock',
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    category: null,
    currentPrice: 3850,
    totalQuantity: 10,
    avgCost: 3500,
    totalCost: 35000,
    currentValue: 38500,
    totalIncome: 0,
    lastTransactionDate: '2024-01-10',
    transactionCount: 1
  }
];

const e2eTransactions = [
  {
    id: 'e2e-txn-1',
    holdingId: 'e2e-stock-1',
    type: 'buy',
    date: '2024-01-10',
    quantity: 10,
    price: 3500,
    amount: 35000,
    deleted: false
  }
];

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
const MOBILE_DROPDOWN_MAX_LABEL = 22;

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 500);
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

const truncateDropdownLabel = (label, maxLength = MOBILE_DROPDOWN_MAX_LABEL) => {
  if (typeof label !== 'string') return label;
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const CompactSelect = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-slate-900' : 'text-slate-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[60] mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="py-1">
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  style={{
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#1e293b'
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="block break-words">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// After all your imports, add this:

const STOCK_API_BASE_URL = 'https://stock.indianapi.in';

// API Key rotation system
const API_KEYS = [
  import.meta.env.VITE_X_Api_Key_1,
  import.meta.env.VITE_X_Api_Key_2,
  import.meta.env.VITE_X_Api_Key_3,
  import.meta.env.VITE_X_Api_Key_4,
  import.meta.env.VITE_X_Api_Key_5
].filter(Boolean); // Remove undefined keys

let currentApiKeyIndex = 0;

const sendAlertNotification = async (message, toEmail = 'krisha4801@gmail.com') => {
  try {
    console.error('🚨 ALERT:', message);

    const emailServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const emailTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_USER_ID;

    if (!emailServiceId || !emailTemplateId || !publicKey) {
      console.warn('⚠️ Email credentials missing');
      return;
    }

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: emailServiceId,
        template_id: emailTemplateId,
        user_id: publicKey,
        template_params: {
          message: message,
          to_email: toEmail,
          from_name: 'Portfolio Tracker',
          reply_to: 'krisha4801@gmail.com'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email failed:', error);
      return;
    }
    console.log('✅ Email sent successfully to', toEmail);
  } catch (error) {
    console.error('❌ Email error:', error);
  }
};
const fetchStockPrice = async (symbolOrName, isMutualFund = false) => {
  const cleanSymbol = symbolOrName.replace(/\.(NS|BO)$/i, '').trim();

  // Try all API keys in sequence
  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const apiKey = API_KEYS[currentApiKeyIndex];

    try {
      // Different endpoint for MF vs Stock
      const endpoint = isMutualFund
        ? `${STOCK_API_BASE_URL}/mutual_funds_details?stock_name=${encodeURIComponent(cleanSymbol)}`
        : `${STOCK_API_BASE_URL}/stock?name=${encodeURIComponent(cleanSymbol)}`;

      const response = await fetch(endpoint, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      // Check for quota/rate limit errors
      if (response.status === 429 || response.status === 403) {
        const exhaustedKeyIndex = currentApiKeyIndex;
        console.warn(`⚠️ API Key ${exhaustedKeyIndex + 1} quota exceeded, rotating...`);

        // Send email for THIS key exhaustion
        const remainingKeys = API_KEYS.length - attempt - 1;
        await sendAlertNotification(
          `⚠️ API Key #${exhaustedKeyIndex + 1} exhausted. ${remainingKeys} keys remaining.`
        );

        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;

        // All keys exhausted?
        if (attempt === API_KEYS.length - 1) {
          await sendAlertNotification(
            `🚨 CRITICAL: ALL ${API_KEYS.length} API KEYS EXHAUSTED!`
          );
          throw new Error('All API keys exhausted.');
        }
        continue;
      }

      if (!response.ok) {
        throw new Error(`Stock/Fund not found (${response.status})`);
      }

      console.log(`✅ API Key ${currentApiKeyIndex + 1} - Request successful`);

      const data = await response.json();

      // Handle MF response
      if (isMutualFund) {
        if (!data.basic_info?.fund_name || !data.nav_info?.current_nav) {
          throw new Error('No fund details found');
        }

        return {
          success: true,
          price: data.nav_info.current_nav,
          companyName: data.basic_info.fund_name,
          symbol: data.basic_info.fund_name.toUpperCase().replace(/\s+/g, '-'),
          category: data.basic_info.category
        };
      }

      // Handle Stock response
      const nsePrice = parseFloat(data.currentPrice?.NSE || 0);
      const bsePrice = parseFloat(data.currentPrice?.BSE || 0);
      const currentPrice = nsePrice || bsePrice;

      if (!currentPrice) throw new Error('No price found');

      return {
        success: true,
        price: currentPrice,
        companyName: data.companyName || cleanSymbol,
        symbol: data.symbol || cleanSymbol
      };

    } catch (error) {
      throw error;
    }
  }

  throw new Error('Failed to fetch price with all available API keys');
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

  const [txnHistoryPageNum, setTxnHistoryPageNum] = useState(1);
  const [txnHistoryItemsPerPage, setTxnHistoryItemsPerPage] = useState(25);
  const [txnHistoryPaginatedTxns, setTxnHistoryPaginatedTxns] = useState([]);
  const [txnHistoryHasNext, setTxnHistoryHasNext] = useState(false);
  const [txnHistoryTotalCount, setTxnHistoryTotalCount] = useState(0);
  const [isLoadingTxnHistory, setIsLoadingTxnHistory] = useState(false);

  // Manage page filters
  const [manageFilters, setManageFilters] = useState({
    instrumentType: '',
    holdingId: ''
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [paginationCursors, setPaginationCursors] = useState({});
  const [hasNextPage, setHasNextPage] = useState(false);

  const [showNotes, setShowNotes] = useState(false);
  const [portfolioNotes, setPortfolioNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [hasUpdatedPrices, setHasUpdatedPrices] = useState(false);
  // Price alerts
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [alertForm, setAlertForm] = useState({ holdingId: '', targetPrice: '', direction: 'above' });
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [isSavingAlert, setIsSavingAlert] = useState(false);

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
  const [indexHistories, setIndexHistories] = useState({ sensex: null, nifty: null, sp500: null });
  const [isFetchingIndex, setIsFetchingIndex] = useState(false);
  const [indexFetchError, setIndexFetchError] = useState(null);
  const [isCompactDropdownViewport, setIsCompactDropdownViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => {
      setIsCompactDropdownViewport(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateAllPrices = async () => {
    if (!user || holdings.length === 0) return;
    if (isUpdatingPrices) return; // Prevent double clicks

    try {
      setIsUpdatingPrices(true);
      setUpdateProgress(0);
      setHasUpdatedPrices(true);
      console.log('🔄 Updating all prices...');

      // Group holdings by type (exclude bank)
      const stockHoldings = holdings.filter(h => h.type === 'stock');
      const mfHoldings = holdings.filter(h => h.type === 'mf');
      const goldHoldings = holdings.filter(h => h.type === 'gold');

      const totalHoldings = stockHoldings.length + mfHoldings.length + goldHoldings.length;
      let completedCount = 0;

      // Fetch all in parallel with progress tracking
      const [stockPrices, mfPrices, goldPrices] = await Promise.all([
        stockHoldings.length
          ? fetchAndUpdatePrices(stockHoldings, 'stock', fetchStockPrice, db, user.uid)
            .then(res => {
              completedCount += stockHoldings.length;
              setUpdateProgress(Math.min(90, (completedCount / totalHoldings) * 90));
              return res;
            })
          : Promise.resolve([]),
        mfHoldings.length
          ? fetchAndUpdatePrices(mfHoldings, 'mf', fetchStockPrice, db, user.uid)
            .then(res => {
              completedCount += mfHoldings.length;
              setUpdateProgress(Math.min(90, (completedCount / totalHoldings) * 90));
              return res;
            })
          : Promise.resolve([]),
        goldHoldings.length
          ? fetchAndUpdatePrices(goldHoldings, 'gold', fetchStockPrice, db, user.uid)
            .then(res => {
              completedCount += goldHoldings.length;
              setUpdateProgress(Math.min(90, (completedCount / totalHoldings) * 90));
              return res;
            })
          : Promise.resolve([])
      ]);

      // Combine all updates
      const allUpdates = [...stockPrices, ...mfPrices, ...goldPrices];

      if (allUpdates.length > 0) {
        // Update local state
        setHoldings(prev => prev.map(h => {
          const updated = allUpdates.find(u => u.id === h.id);
          return updated ? { ...h, currentPrice: updated.currentPrice } : h;
        }));

        // Update Firebase in background
        await updateHoldingPricesInFirebase(allUpdates, db, user.uid);

        console.log(`✅ Updated ${allUpdates.length} prices`);
      }

      setUpdateProgress(100);
      setLastDataFetch(Date.now());

      // Keep progress bar visible for 500ms then hide
      setTimeout(() => {
        setIsUpdatingPrices(false);
        setUpdateProgress(0);
      }, 500);

    } catch (error) {
      console.error('❌ Error updating prices:', error);
      setIsUpdatingPrices(false);
      setUpdateProgress(0);
    }
  };


  // Data states
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [paginatedTransactions, setPaginatedTransactions] = useState([]);
  const [totalTransactionCount, setTotalTransactionCount] = useState(0);
  const [lastDataFetch, setLastDataFetch] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0); // 0-100
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    if (isE2EMode()) {
      setHoldings(e2eHoldings);
      setTransactions(e2eTransactions);
      setLastDataFetch(Date.now());
      return;
    }

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
        if (lastDataFetch && lastDataFetch > (now - CACHE_DURATION)) {
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

        // Only fetch prices for non-bank holdings
        const nonBankHoldings = loadedHoldings.filter(h => h.type !== 'bank');
        if (nonBankHoldings.length > 0) {
          // Group by type and fetch
          const stockHoldings = nonBankHoldings.filter(h => h.type === 'stock');
          const mfHoldings = nonBankHoldings.filter(h => h.type === 'mf');
          const goldHoldings = nonBankHoldings.filter(h => h.type === 'gold');

          Promise.all([
            stockHoldings.length ? fetchAndUpdatePrices(stockHoldings, 'stock', fetchStockPrice, db, user.uid) : Promise.resolve([]),
            mfHoldings.length ? fetchAndUpdatePrices(mfHoldings, 'mf', fetchStockPrice, db, user.uid) : Promise.resolve([]),
            goldHoldings.length ? fetchAndUpdatePrices(goldHoldings, 'gold', fetchStockPrice, db, user.uid) : Promise.resolve([])
          ]).then(([stockPrices, mfPrices, goldPrices]) => {
            const allPrices = [...stockPrices, ...mfPrices, ...goldPrices];
            if (allPrices.length > 0) {
              setHoldings(prev => prev.map(h => {
                const updated = allPrices.find(p => p.id === h.id);
                return updated ? { ...h, currentPrice: updated.currentPrice } : h;
              }));
            }
          });
        }
        // Cache the data
        setCachedData(`${cacheKey}_holdings`, loadedHoldings);
        setCachedData(`${cacheKey}_transactions`, loadedTransactions);
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

        if (isE2EMode()) {
          const docs = transactions
            .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice((currentPageNum - 1) * itemsPerPage, currentPageNum * itemsPerPage);

          if (isMounted) {
            setTotalTransactionCount(count);
            setPaginatedTransactions(docs);
            setHasNextPage(currentPageNum * itemsPerPage < count);
            setIsLoadingTransactions(false);
          }
          return;
        }

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

  // Load paginated transactions for Transaction History page
  useEffect(() => {
    if (currentPage !== 'transactions' || !selectedHolding) {
      setTxnHistoryPaginatedTxns([]);
      setTxnHistoryHasNext(false);
      setTxnHistoryTotalCount(0);
      return;
    }

    let isMounted = true;
    setIsLoadingTxnHistory(true);

    const loadPage = async () => {
      try {
        // Check if this is sample data (temp IDs start with 'temp-')
        const isSampleData = selectedHolding.startsWith('temp-');

        if (isSampleData) {
          // For sample data, use local transactions
          const filteredTxns = transactions
            .filter(t => t.holdingId === selectedHolding && !t.deleted)
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
          const startIdx = (txnHistoryPageNum - 1) * txnHistoryItemsPerPage;
          const endIdx = startIdx + txnHistoryItemsPerPage;
          const paginatedTxns = filteredTxns.slice(startIdx, endIdx);

          if (isMounted) {
            setTxnHistoryTotalCount(filteredTxns.length);
            setTxnHistoryPaginatedTxns(paginatedTxns);
            setTxnHistoryHasNext(endIdx < filteredTxns.length);
            setIsLoadingTxnHistory(false);
          }
        } else {
          // For real data, fetch from Firebase
          const count = transactions.filter(t => t.holdingId === selectedHolding && !t.deleted).length;

          const { docs, hasMore } = await fetchTransactionsPage(
            selectedHolding,
            txnHistoryPageNum,
            txnHistoryItemsPerPage
          );

          if (isMounted) {
            setTxnHistoryTotalCount(count);
            setTxnHistoryPaginatedTxns(docs);
            setTxnHistoryHasNext(hasMore);
            setIsLoadingTxnHistory(false);
          }
        }
      } catch (error) {
        console.error('Error loading transaction history:', error);
        if (isMounted) setIsLoadingTxnHistory(false);
      }
    };

    loadPage();
    return () => {
      isMounted = false;
      setIsLoadingTxnHistory(false);
    };
  }, [selectedHolding, txnHistoryPageNum, txnHistoryItemsPerPage, transactions.length, currentPage]);

  useEffect(() => {
    if (user) loadPriceAlerts();
  }, [user]);

  useEffect(() => {
    if (holdings.length > 0 && priceAlerts.length > 0) {
      checkPriceAlerts();
    }
  }, [holdings, priceAlerts]); // Checks alerts every time prices are refreshed
  const calculateHoldingStats = (holdingId) => {
    const holding = holdings.find(h => h.id === holdingId);
    if (!holding) return null;

    // Bank balance special case
    if (holding.type === 'bank') {
      const holdingTransactions = transactions
        .filter(t => t.holdingId === holdingId && !t.deleted)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const latestBalance = holdingTransactions.length > 0
        ? holdingTransactions[0].price
        : 0;

      // Calculate total deposits (sum of all balance updates)
      const totalDeposits = holdingTransactions.reduce((sum, t) => sum + t.amount, 0);

      return {
        ...holding,
        quantity: 0,
        avgCost: 0,
        totalCost: totalDeposits,
        currentValue: latestBalance,
        capitalGain: latestBalance - totalDeposits,
        totalIncome: 0,
        totalGain: latestBalance - totalDeposits,
        totalReturn: totalDeposits > 0 ? ((latestBalance - totalDeposits) / totalDeposits) * 100 : 0
      };
    }

    // USE DENORMALIZED VALUES (fallback to calculation if missing)
    // ALWAYS calculate from transactions (source of truth)
    const holdingTransactions = transactions.filter(t => t.holdingId === holdingId && !t.deleted);

    // Step 1: Calculate avgCost from buy transactions only
    let buyQuantity = 0;
    let buyCost = 0;
    holdingTransactions.forEach(txn => {
      if (txn.type === 'buy') {
        buyQuantity += txn.quantity;
        buyCost += txn.amount;
      }
    });
    const avgCost = buyQuantity > 0 ? buyCost / buyQuantity : 0;

    // Step 2: Calculate running totals using avgCost for sells
    let totalQuantity = 0;
    let totalCost = 0;
    let totalIncome = 0;

    holdingTransactions.forEach(txn => {
      if (txn.type === 'buy') {
        totalQuantity += txn.quantity;
        totalCost += txn.amount;
      } else if (txn.type === 'sell') {
        totalQuantity -= txn.quantity;
        totalCost -= txn.quantity * avgCost; // reduce cost basis by avg cost of sold units
      } else if (txn.type === 'dividend' || txn.type === 'interest') {
        totalIncome += txn.amount;
      }
    });

    const currentValue = holding.type === 'bank'
      ? holding.currentPrice
      : (totalQuantity * (holding.currentPrice || 0));
    const capitalGain = currentValue - totalCost;
    const unrealizedGain = currentValue - totalCost;
    const realizedGain = 0; // not tracked in calculateHoldingStats, only in updateHoldingStats
    const totalGain = unrealizedGain + realizedGain + totalIncome;
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      ...holding,
      quantity: totalQuantity,
      avgCost,
      totalCost,
      currentValue,
      capitalGain: unrealizedGain,
      realizedGain,
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
      summary[holding.type].currentValue += (holding.type === 'bank'
        ? stats.currentValue
        : (stats.quantity * (stats.currentPrice || 0)));
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
    let realizedGain = 0;
    let lastTransactionDate = null;

    // Step 1: pre-calculate avgCost from buys only
    let buyQty = 0, buyCostTotal = 0;
    holdingTransactions.forEach(txn => {
      if (txn.type === 'buy') { buyQty += txn.quantity; buyCostTotal += txn.amount; }
    });
    const avgCost = buyQty > 0 ? buyCostTotal / buyQty : 0;

    // Step 2: calculate running totals
    holdingTransactions.forEach(txn => {
      if (txn.type === 'buy') {
        totalQuantity += txn.quantity;
        totalCost += txn.amount;
      } else if (txn.type === 'sell') {
        totalQuantity -= txn.quantity;
        totalCost -= txn.quantity * avgCost;
        realizedGain += txn.amount - (txn.quantity * avgCost);
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

    const currentValue = holding.type === 'bank'
      ? holding.currentPrice  // For bank, currentPrice IS the balance
      : (totalQuantity * (holding.currentPrice || 0));

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

  const reloadCurrentPage = async () => {
    if (!manageFilters.holdingId || manageFilters.holdingId === '__new__') return;

    try {
      const count = transactions.filter(t => t.holdingId === manageFilters.holdingId && !t.deleted).length;
      const { docs, hasMore } = await fetchTransactionsPage(
        manageFilters.holdingId,
        currentPageNum,
        itemsPerPage
      );

      setTotalTransactionCount(count);
      setPaginatedTransactions(docs);
      setHasNextPage(hasMore);
    } catch (error) {
      console.error('Error reloading page:', error);
    }
  };

  const clearCache = useCallback(() => {
    if (!user) return;

    const cacheKey = `portfolio_${user.uid}`;
    const keys = [`${cacheKey}_holdings`, `${cacheKey}_transactions`];
    keys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Cache cleared');
  }, [user]);

  const saveNotes = async () => {
    if (!user) return;

    setIsSavingNotes(true);
    try {
      const notesRef = doc(db, `users/${user.uid}/settings/notes`);
      await setDoc(notesRef, {
        content: portfolioNotes,
        updatedAt: new Date().toISOString()
      });
      alert('✅ Notes saved');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    }
    setIsSavingNotes(false);
  };

  const typeSummary = useMemo(() => calculateTypeSummary(), [holdings, transactions]);
  const portfolioStats = useMemo(() =>
    calculatePortfolioStats(),
    [holdings, transactions]
  );
  const pieData = useMemo(() =>
    typeSummary
      .map(item => ({
        name: INSTRUMENT_LABELS[item.type],
        value: item.type === 'bank' ? item.totalCost : item.currentValue,
        color: COLORS[item.type]
      }))
      .filter(item => item.value > 0),
    [typeSummary]
  );

  useEffect(() => {
    const needsIndex = graphToggles.sensex || graphToggles.nifty || graphToggles.sp500;
    if (!needsIndex) return;

    let cancelled = false;
    setIsFetchingIndex(true);
    setIndexFetchError(null);

    fetchIndexHistories(graphPeriod, graphToggles)
      .then(results => {
        if (!cancelled) {
          setIndexHistories(results);
          setIsFetchingIndex(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Index fetch error:', err);
          setIndexFetchError('Could not load index data. Check your connection.');
          setIsFetchingIndex(false);
        }
      });

    return () => { cancelled = true; };
  }, [graphPeriod, graphToggles.sensex, graphToggles.nifty, graphToggles.sp500]);

  const generateBenchmarkData = () => {
    const periods = {
      '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180,
      '1Y': 365, '3Y': 1095, '5Y': 1825, '7Y': 2555, '10Y': 3650, 'All': 3650
    };
    const days = periods[graphPeriod];
    const step = Math.max(1, Math.floor(days / 50));

    const activeTxns = transactions
      .filter(t => !t.deleted && (t.type === 'buy' || t.type === 'sell'))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── 1. Build raw market-value series ──
    const portfolioRaw = [];
    for (let i = days; i >= 0; i -= step) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let totalValue = 0;
      const typeValue = { stock: 0, mf: 0, gold: 0 };

      holdings.forEach(holding => {
        if (holding.type === 'bank' || !holding.currentPrice) return;
        const holdingTxns = activeTxns.filter(
          t => t.holdingId === holding.id && t.date <= dateStr
        );
        let qty = 0;
        holdingTxns.forEach(t => {
          if (t.type === 'buy') qty += t.quantity;
          if (t.type === 'sell') qty -= t.quantity;
        });
        if (qty <= 0) return;
        const value = qty * holding.currentPrice;
        totalValue += value;
        if (typeValue[holding.type] !== undefined)
          typeValue[holding.type] += value;
      });

      portfolioRaw.push({
        dateStr,
        label: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        total: totalValue,
        stock: typeValue.stock,
        mf: typeValue.mf,
        gold: typeValue.gold,
      });
    }

    // ── 2. Use TODAY's value as the base (last point) ──
    // This way base is always non-zero, and we show % change relative to now
    // All lines start wherever they started and end at ~100 today
    // Better: use the LAST non-zero value as base = 100, so chart ends at 100
    // and earlier points show how much lower/higher things were
    const lastNonZero = [...portfolioRaw].reverse().find(p => p.total > 0);
    if (!lastNonZero) return [];

    const base = {
      total: lastNonZero.total || 1,
      stock: lastNonZero.stock || 1,
      mf: lastNonZero.mf || 1,
      gold: lastNonZero.gold || 1,
    };

    // ── 3. Build index lookup maps ──
    // Normalise index so TODAY = same value as portfolio today (both end near 100)
    const indexLookup = {};
    ['sensex', 'nifty', 'sp500'].forEach(key => {
      const hist = indexHistories[key];
      if (!hist || hist.length === 0) return;

      // Use the LAST available index value as the base (so it ends near 100 too)
      const lastClose = hist[hist.length - 1].close;
      if (!lastClose) return;

      const map = {};
      hist.forEach(d => {
        map[d.date] = parseFloat(((d.close / lastClose) * 100).toFixed(2));
      });
      indexLookup[key] = map;
    });

    const closestValue = (map, dateStr) => {
      if (!map) return undefined;
      if (map[dateStr] !== undefined) return map[dateStr];
      for (let back = 1; back <= 7; back++) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() - back);
        const k = d.toISOString().split('T')[0];
        if (map[k] !== undefined) return map[k];
      }
      return undefined;
    };

    // ── 4. Assemble chart — skip leading zero points ──
    const firstNonZeroIdx = portfolioRaw.findIndex(p => p.total > 0);
    const startIdx = firstNonZeroIdx === -1 ? 0 : firstNonZeroIdx;

    return portfolioRaw.slice(startIdx).map(p => {
      const point = { date: p.label };

      if (graphToggles.portfolio)
        point.portfolio = parseFloat(((p.total / base.total) * 100).toFixed(2));

      if (graphToggles.stock)
        point.stock = p.stock > 0
          ? parseFloat(((p.stock / base.stock) * 100).toFixed(2))
          : undefined;

      if (graphToggles.mf)
        point.mf = p.mf > 0
          ? parseFloat(((p.mf / base.mf) * 100).toFixed(2))
          : undefined;

      if (graphToggles.gold)
        point.gold = p.gold > 0
          ? parseFloat(((p.gold / base.gold) * 100).toFixed(2))
          : undefined;

      if (graphToggles.sensex)
        point.sensex = closestValue(indexLookup.sensex, p.dateStr);

      if (graphToggles.nifty)
        point.nifty = closestValue(indexLookup.nifty, p.dateStr);

      if (graphToggles.sp500)
        point.sp500 = closestValue(indexLookup.sp500, p.dateStr);

      return point;
    });
  };
  const renderHomePage = () => {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
            <h2 className="text-xl font-bold text-slate-800">Account Overview</h2>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setShowNotes(true)}
                  className="flex flex-col items-center gap-1 px-2 py-1 text-slate-600 hover:text-blue-600 transition-colors border border-slate-300 rounded bg-white"
                  title="Take Notes"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="text-xs font-light">Take Notes</span>
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
              <div className="text-slate-600 text-xs font-medium mb-1">Total Gains (since investment)</div>
              <div className={`text-xl font-bold ${portfolioStats.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioStats.totalGain >= 0 ? '+' : ''}₹{
                  Math.abs(portfolioStats.totalGain) >= 100000
                    ? `${(portfolioStats.totalGain / 100000).toFixed(2)}L`
                    : Math.abs(portfolioStats.totalGain) >= 1000
                      ? `${(portfolioStats.totalGain / 1000).toFixed(1)}K`
                      : portfolioStats.totalGain.toFixed(0)
                }
              </div>
              <div className="text-xs text-slate-500">
                (Inc. ₹{
                  Math.abs(portfolioStats.totalIncome) >= 100000
                    ? `${(portfolioStats.totalIncome / 100000).toFixed(2)}L`
                    : Math.abs(portfolioStats.totalIncome) >= 1000
                      ? `${(portfolioStats.totalIncome / 1000).toFixed(1)}K`
                      : portfolioStats.totalIncome.toFixed(0)
                } from Interest & Dividend)
              </div>
            </div>

            <div className="text-center min-w-0">
              <div className="text-slate-600 text-xs font-medium mb-1">Total Returns (since investment)</div>
              <div className={`text-xl font-bold flex items-center justify-center gap-1 ${portfolioStats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioStats.totalReturn >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {portfolioStats.totalReturn >= 0 ? '+' : ''}{portfolioStats.totalReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {holdings.length === 0 && transactions.filter(t => !t.deleted).length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <p className="text-blue-800 mb-4">
              Your portfolio is empty. Want to try with sample data?
              <span className="block text-xs text-blue-600 mt-1">Don't worry - you can refresh or re-log in to clear off the sample data automatically</span>
            </p>
            <button
              onClick={() => {
                // Load sample data directly into state (not Firebase)
                loadSampleData(setHoldings, setTransactions);
                alert('Sample data loaded! Refresh the page to clear it.');
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Load Sample Data
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Portfolio Allocation</h3>
            <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 640 ? 280 : 400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                <Legend
                  iconType="circle"
                  iconSize={12}
                  wrapperStyle={{ paddingTop: '16px', fontSize: '13px', color: '#475569' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-x-hidden overflow-y-visible">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Asset Summary</h2>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 overflow-y-visible">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Cost</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Value</th>
                      <th
                        className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase cursor-pointer hover:text-blue-600 relative group overflow-visible"
                        style={{ overflow: 'visible' }}
                        onClick={() => setShowGainInPercent(!showGainInPercent)}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Return {showGainInPercent ? '%' : '₹'}</span>
                          <svg
                            className="w-4 h-4 text-slate-400 group-hover:text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute right-0 top-full pb-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                          Click to toggle % / ₹
                        </div>
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
                        }}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.type] }}></div>
                            <span className="font-medium text-slate-900">{INSTRUMENT_LABELS[item.type]}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900 cursor-pointer">
                          {item.type === 'bank'
                            ? `-`
                            : `₹${item.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                          }
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900 cursor-pointer">
                          {item.type === 'bank'
                            ? `₹${item.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : `₹${(item.currentValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                          }
                        </td>
                        <td className={`px-6 py-4 text-right font-medium ${item.totalGain >= 0 ? 'text-green-600' : 'text-red-600'} cursor-pointer`}>
                          <div className="flex items-center justify-end gap-2">
                            <span>
                              {item.type === 'bank' ? (
                                '-'
                              ) : showGainInPercent ? (
                                <>{item.totalReturn >= 0 ? '+' : ''}{item.totalReturn.toFixed(2)}%</>
                              ) : (
                                <>{item.totalGain >= 0 ? '+' : ''}₹{item.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>
                              )}
                            </span>
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <NotesModal
            showNotes={showNotes}
            setShowNotes={setShowNotes}
            portfolioNotes={portfolioNotes}
            setPortfolioNotes={setPortfolioNotes}
            saveNotes={saveNotes}
            isSavingNotes={isSavingNotes}
          />
        </div>
        <div className="text-center text-xs text-slate-400 mt-2">
          <strong><b>Disclaimer:</b></strong> All Returns are calculated only for unrealized gains i.e. Sell transactions are not factored in. Current Price calculated at login - Click Update button on Top-Bar to see up-to-date price.
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
            className="inline-flex items-center gap-2 px-4 py-2 text-white border border-blue-600 rounded-lg transition-colors font-medium bg-blue-600 hover:bg-blue-600 hover:border-blue-600">            <ArrowLeft size={20} />
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
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Existing Balance</th>
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
          style={{ backgroundColor: '#2563eb', color: 'white' }}
          className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg transition-colors font-medium hover:text-blue-700 hover:border-blue-700 hover:bg-blue-50 hover:text-blue-700"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="bg-white rounded-xl shadow-md overflow-x-hidden overflow-y-visible">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">{INSTRUMENT_LABELS[selectedType]} Holdings</h2>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 overflow-y-visible">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full">
                <thead className="bg-slate-50 relative">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Name</th>
                    {selectedType === 'mf' && <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>}
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      {selectedType === 'gold' ? 'Weight (gm)' : 'Units'}
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-7 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      {selectedType === 'stock' ? 'Unit Cost' : selectedType === 'gold' ? 'Cost (per gm)' : 'Purchase NAV (per unit)'}
                    </th>
                    <th className="hidden sm:table-cell px-3 sm:px-3 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      {selectedType === 'stock' ? 'Current Price' : selectedType === 'gold' ? 'Current Price (per gm)' : 'Current NAV (per unit)'}
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                      {selectedType === 'gold' ? 'Interest Accrued' : 'Total Dividends'}
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Total Value</th>
                    <th
                      className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase cursor-pointer hover:text-blue-600 relative group overflow-visible"
                      style={{ overflow: 'visible' }}
                      onClick={() => setShowGainInPercent(!showGainInPercent)}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Return {showGainInPercent ? '%' : '₹'}</span>
                        <svg
                          className="w-4 h-4 text-slate-400 group-hover:text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="absolute right-0 top-full pb-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        Click to toggle % / ₹
                      </div>
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
                      <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-slate-900">{holding.name}</td>
                      {selectedType === 'mf' && <td className="hidden md:table-cell px-6 py-4 text-slate-600">{holding.category}</td>}
                      <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-900">{holding.quantity.toFixed(2)}</td>
                      <td className="hidden lg:table-cell px-7 py-4 text-right text-slate-900">₹{holding.avgCost.toFixed(2)}</td>
                      <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-900">₹{holding.currentPrice.toFixed(2)}</td>
                      <td className="hidden lg:table-cell px-6 py-4 text-right">
                        ₹{holding.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-medium text-slate-900">
                        ₹{holding.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${holding.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <div className="flex items-center justify-end gap-2">
                          <span>
                            {showGainInPercent ? (
                              <>{holding.totalReturn >= 0 ? '+' : ''}{holding.totalReturn.toFixed(2)}%</>
                            ) : (
                              <>{holding.totalGain >= 0 ? '+' : ''}₹{holding.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>
                            )}
                          </span>
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-1">
            <h3 className="text-xl font-bold text-slate-800">Performance Comparison</h3>
            {isFetchingIndex && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> Loading index data...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            All lines end at 100 (today) — earlier values show how much lower or higher things were relative to now.
            A line at 90 means it was 10% lower than today; at 110 means 10% higher.
          </p>

          {indexFetchError && (
            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              ⚠️ {indexFetchError}
            </div>
          )}

          {(() => {
            // Find the oldest transaction date for holdings of this type
            const relevantHoldingIds = holdings
              .filter(h => h.type === selectedType && h.type !== 'bank')
              .map(h => h.id);

            const oldestTxn = transactions
              .filter(t => relevantHoldingIds.includes(t.holdingId) && !t.deleted && t.type === 'buy')
              .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

            const daysSinceOldest = oldestTxn
              ? Math.floor((Date.now() - new Date(oldestTxn.date)) / (1000 * 60 * 60 * 24))
              : 0;

            const ALL_PERIODS = [
              { label: '1D', days: 1 },
              { label: '1W', days: 7 },
              { label: '1M', days: 30 },
              { label: '3M', days: 90 },
              { label: '6M', days: 180 },
              { label: '1Y', days: 365 },
              { label: '3Y', days: 1095 },
              { label: '5Y', days: 1825 },
              { label: '7Y', days: 2555 },
              { label: '10Y', days: 3650 },
              { label: 'All', days: daysSinceOldest },
            ];

            // Only show periods where at least 1 transaction exists within the window
            const validPeriods = ALL_PERIODS.filter(p => daysSinceOldest >= p.days || p.label === 'All');

            // If current graphPeriod is no longer valid, reset to the largest valid one
            const validLabels = validPeriods.map(p => p.label);
            if (!validLabels.includes(graphPeriod) && validPeriods.length > 0) {
              // Use setTimeout to avoid setState during render
              setTimeout(() => setGraphPeriod(validPeriods[validPeriods.length - 1].label), 0);
            }

            return (
              <div className="flex flex-wrap gap-2 mb-4">
                {validPeriods.map(({ label }) => (
                  <button
                    key={label}
                    onClick={() => setGraphPeriod(label)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${graphPeriod === label
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {label}
                  </button>
                ))}
                {oldestTxn && (
                  <span className="text-xs text-slate-400 self-center ml-1">
                    Oldest {INSTRUMENT_LABELS[selectedType]} purchase: {new Date(oldestTxn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-2 mb-6">
            {Object.keys(graphToggles).map(key => (
              <button
                key={key}
                onClick={() => setGraphToggles({ ...graphToggles, [key]: !graphToggles[key] })}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${graphToggles[key]
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-slate-100 text-slate-500'
                  }`}
              >
                {key === 'sensex' ? 'Sensex' :
                  key === 'nifty' ? 'Nifty 50' :
                    key === 'sp500' ? 'S&P 500' :
                      key === 'portfolio' ? 'My Portfolio' :
                        key === 'mf' ? 'Mutual Funds' :
                          key === 'stock' ? 'Stocks' : 'Gold'}
              </button>
            ))}
          </div>

          {(() => {
            const chartData = generateBenchmarkData();

            // Detect which asset lines have insufficient data
            // (any point below 50 = had very little holdings at that time)
            const warnings = [];
            const assetKeys = [
              { key: 'stock', label: 'Stocks' },
              { key: 'mf', label: 'Mutual Funds' },
              { key: 'gold', label: 'Gold' },
            ];
            assetKeys.forEach(({ key, label }) => {
              if (!graphToggles[key]) return;
              const values = chartData
                .map(d => d[key])
                .filter(v => v !== undefined && v !== null);
              if (values.length === 0) return;
              const minVal = Math.min(...values);
              if (minVal < 50) {
                warnings.push(label);
              }
            });

            return (
              <>
                {warnings.length > 0 && (
                  <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700">
                      <strong>{warnings.join(', ')}</strong> line{warnings.length > 1 ? 's' : ''}{' '}
                      {warnings.length > 1 ? 'have' : 'has'} insufficient data for part of this period —
                      you held very little of {warnings.length > 1 ? 'these assets' : 'this asset'} earlier in the window.
                      The sharp rise reflects new purchases, not price growth.
                      {' '}<span className="font-medium">Try a shorter time period</span> that matches when you started investing in {warnings.length > 1 ? 'them' : 'it'}.
                    </p>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 640 ? 250 : 400}>
                  <LineChart data={generateBenchmarkData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(0)}`}
                      label={{ value: 'Indexed (Base 100)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const label =
                          name === 'portfolio' ? 'My Portfolio' :
                            name === 'sensex' ? 'Sensex' :
                              name === 'nifty' ? 'Nifty 50' :
                                name === 'sp500' ? 'S&P 500' :
                                  name === 'mf' ? 'Mutual Funds' :
                                    name === 'stock' ? 'Stocks' : 'Gold';
                        const isAsset = ['stock', 'mf', 'gold'].includes(name);
                        const val = parseFloat(value);
                        const suffix = isAsset && val < 50 ? ' ⚠️ low data' : '';
                        return [`${val.toFixed(2)}${suffix}`, label];
                      }}
                      labelStyle={{ fontSize: 12 }}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend formatter={(value) =>
                      value === 'portfolio' ? 'My Portfolio' :
                        value === 'sensex' ? 'Sensex' :
                          value === 'nifty' ? 'Nifty 50' :
                            value === 'sp500' ? 'S&P 500' :
                              value === 'mf' ? 'Mutual Funds' :
                                value === 'stock' ? 'Stocks' : 'Gold'
                    } />
                    {graphToggles.sensex && <Line type="monotone" dataKey="sensex" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />}
                    {graphToggles.nifty && <Line type="monotone" dataKey="nifty" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />}
                    {graphToggles.sp500 && <Line type="monotone" dataKey="sp500" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />}
                    {graphToggles.portfolio && <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={3} dot={false} connectNulls />}
                    {graphToggles.mf && <Line type="monotone" dataKey="mf" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />}
                    {graphToggles.stock && <Line type="monotone" dataKey="stock" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />}
                    {graphToggles.gold && <Line type="monotone" dataKey="gold" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />}
                  </LineChart>
                </ResponsiveContainer>
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderTransactionsPage = () => {
    const holding = holdings.find(h => h.id === selectedHolding);
    const stats = calculateHoldingStats(selectedHolding);
    const totalPages = Math.ceil(txnHistoryTotalCount / txnHistoryItemsPerPage);

    return (
      <div className="space-y-8">
        <button
          onClick={() => setCurrentPage('detail')}
          style={{ backgroundColor: '#2563eb', color: 'white' }}
          className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg transition-colors font-medium hover:text-blue-700 hover:border-blue-700 hover:bg-blue-50"
        >
          <ArrowLeft size={20} />
          Back to All {INSTRUMENT_LABELS[selectedType]}
        </button>

        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
            <h2 className="text-2xl font-bold text-slate-800">
              {selectedType === 'stock' ? 'Stock' : selectedType === 'mf' ? 'Fund' : INSTRUMENT_LABELS[selectedType]}: <span className='text-slate-500'>{holding.name}</span>
            </h2>
            {selectedType === 'mf' && holding.category && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {holding.category}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div>
              <div className="text-slate-600 text-sm">{selectedType === 'gold' ? 'Total Weight (grams)' : 'Total Units'}</div>
              <div className="text-lg sm:text-xl font-bold text-slate-600">{stats.quantity.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">{selectedType === 'gold' ? 'Avg Cost (per gram)' : 'Avg Cost'}</div>
              <div className="text-lg sm:text-xl font-bold text-slate-600">₹{stats.avgCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">{selectedType === 'gold' ? 'Current Price (per gram)' : 'Current Price'}</div>
              <div className="text-lg sm:text-xl font-bold text-slate-600">₹{stats.currentPrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">{selectedType === 'gold' ? 'Interest Accrued' : 'Total Dividends'}</div>
              <div className="text-lg sm:text-xl font-bold text-slate-600">₹{stats.totalIncome.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">Total Value</div>
              <div className="text-lg sm:text-xl font-bold text-slate-600">₹{stats.currentValue.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm cursor-pointer hover:text-blue-600 flex items-center gap-1" onClick={() => setShowGainInPercent(!showGainInPercent)}>
                <span>Total Return {showGainInPercent ? '%' : '₹'}</span>
                <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className={`text-xl font-bold ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {showGainInPercent ? (
                  <>{stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(2)}%</>
                ) : (
                  <>{stats.totalGain >= 0 ? '+' : ''}₹{stats.totalGain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h3 className="text-xl font-bold text-slate-800">Transaction History</h3>
            <div className="flex w-full sm:w-auto items-center gap-3">
              <label className="text-sm text-slate-600">Show:</label>
              <select
                value={txnHistoryItemsPerPage}
                onChange={(e) => {
                  setTxnHistoryItemsPerPage(Number(e.target.value));
                  setTxnHistoryPageNum(1);
                }}
                style={{ backgroundColor: '#f1f5f9', color: 'black' }}
                className="min-w-0 flex-1 sm:flex-none px-3 py-1 border border-slate-300 rounded-lg text-sm"
              >
                {ITEMS_PER_PAGE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingTxnHistory ? (
            <div className="p-12 text-center">
              <RefreshCw className="mx-auto text-slate-400 mb-4 animate-spin" size={48} />
              <p className="text-slate-600">Loading transactions...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                        <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          Quantity {selectedType === 'gold' ? '(Grams)' : ''}
                        </th>
                        <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {selectedType === 'gold' ? 'Cost' : 'Price'}
                        </th>
                        {selectedType !== 'gold' && (
                          <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                            {manageFilters.instrumentType === 'gold' ? 'Total Cost' : 'Amount'}
                          </th>
                        )}
                        <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {selectedType === 'gold' ? 'Interest' : 'Dividend'}
                        </th>
                        {selectedType !== 'gold' && (
                          <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Balance Units</th>
                        )}
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {selectedType === 'gold' ? 'Interest' : 'Dividend'}
                        </th>
                        {selectedType !== 'gold' && (
                          <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Balance Units</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {txnHistoryPaginatedTxns.map((txn, idx) => {
                        let runningBalance = 0;
                        for (let i = txnHistoryPaginatedTxns.length - 1; i >= idx; i--) {
                          if (txnHistoryPaginatedTxns[i].type === 'buy') runningBalance += txnHistoryPaginatedTxns[i].quantity;
                          if (txnHistoryPaginatedTxns[i].type === 'sell') runningBalance -= txnHistoryPaginatedTxns[i].quantity;
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
                            <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-900">{txn.quantity > 0 ? txn.quantity.toFixed(2) : '-'}</td>
                            <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-900">{txn.price > 0 ? `₹${txn.price.toFixed(2)}` : '-'}</td>
                            {selectedType !== 'gold' && (
                              <td className="px-6 py-4 text-right font-medium text-slate-900">₹{txn.amount.toLocaleString('en-IN')}</td>
                            )}
                            <td className="hidden md:table-cell px-6 py-4 text-right text-green-600">
                              {txn.type === 'dividend' || txn.type === 'interest' ? `₹${txn.amount.toLocaleString('en-IN')}` : '-'}
                            </td>
                            {selectedType !== 'gold' && (
                              <td className="hidden md:table-cell px-6 py-4 text-right text-slate-600">{runningBalance.toFixed(2)}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-xs sm:text-sm text-slate-600">
                    Showing {((txnHistoryPageNum - 1) * txnHistoryItemsPerPage) + 1} to {Math.min(txnHistoryPageNum * txnHistoryItemsPerPage, txnHistoryTotalCount)} of {txnHistoryTotalCount} transactions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTxnHistoryPageNum(Math.max(1, txnHistoryPageNum - 1))}
                      disabled={txnHistoryPageNum === 1}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-slate-600">
                      Page {txnHistoryPageNum} of {totalPages}
                    </span>
                    <button
                      onClick={() => setTxnHistoryPageNum(txnHistoryPageNum + 1)}
                      disabled={!txnHistoryHasNext}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
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

    // Call validation
    // With:
    const validationResult = await validationForManageTransactionPage(
      transactionForm,
      manageFilters,
      editingTransaction,
      transactions,
      fetchStockPrice,
      currentApiKeyIndex,
      setIsSaving,
    );

    // If validation failed, it returns early with setIsSaving(false), so this won't execute
    if (!validationResult) return;

    const { fetchedPriceData, amount } = validationResult;

    if (isE2EMode()) {
      const e2eTransaction = {
        id: `e2e-txn-${Date.now()}`,
        holdingId: manageFilters.holdingId,
        type: sanitizeInput(transactionForm.type),
        date: transactionForm.date,
        quantity: (transactionForm.type === 'buy' || transactionForm.type === 'sell')
          ? Number(transactionForm.quantity) || 0
          : 0,
        price: Number(transactionForm.price) || 0,
        amount,
        interestRate: transactionForm.interestRate ? parseFloat(transactionForm.interestRate) : null,
        interestStartDate: transactionForm.interestStartDate || null,
        interestEndDate: transactionForm.interestEndDate || null,
        deleted: false,
        deletedAt: null
      };

      setTransactions(prev => [...prev, e2eTransaction]);
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
      setIsSaving(false);
      alert('E2E test transaction saved successfully!');
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

        const symbolUpper = transactionForm.symbol.toUpperCase();

        // ✅ Get company name FIRST (from API or fallback)
        let currentPrice = Number(transactionForm.price) || 0;
        let companyName = transactionForm.name || symbolUpper;
        let actualSymbol = symbolUpper;

        if (fetchedPriceData && fetchedPriceData.success) {
          currentPrice = fetchedPriceData.price;
          companyName = fetchedPriceData.companyName;
          actualSymbol = fetchedPriceData.symbol || symbolUpper;
          console.log(`✅ Using fetched price: ₹${currentPrice}, name: ${companyName}`);
        }

        const duplicate = holdings.find(h => {
          if (h.type !== manageFilters.instrumentType) return false;

          // For gold and bank, check only name
          if (manageFilters.instrumentType === 'gold' || manageFilters.instrumentType === 'bank') {
            return h.name.toUpperCase() === companyName.toUpperCase();
          }

          // For stock and MF, check both symbol and name
          return h.symbol.toUpperCase() === symbolUpper || h.name.toUpperCase() === companyName.toUpperCase();
        });

        if (duplicate) {
          setIsSaving(false);
          alert(`A ${INSTRUMENT_LABELS[manageFilters.instrumentType]} with name "${companyName}" already exists!`);
          return;
        }

        // ✅ NOW show confirm with proper name
        if (!confirm(`Create new ${manageFilters.instrumentType === 'stock' ? 'Stock' :
          manageFilters.instrumentType === 'mf' ? 'Mutual Fund' :
            manageFilters.instrumentType === 'gold' ? 'Gold' :
              'Bank'}: "${companyName}"?`)) {
          setIsSaving(false);
          return;
        }

        // ✅ CREATE THE HOLDING OBJECT
        const newHolding = {
          type: manageFilters.instrumentType,
          symbol: actualSymbol,
          name: companyName,  // Use fetched name
          category: transactionForm.category ? sanitizeInput(transactionForm.category) : null,
          currentPrice: currentPrice,
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
          ? Number(transactionForm.quantity) || 0
          : 0,
        price: Number(transactionForm.price) || 0,
        amount,
        interestRate: transactionForm.interestRate ? parseFloat(transactionForm.interestRate) : null,
        interestStartDate: transactionForm.interestStartDate || null,
        interestEndDate: transactionForm.interestEndDate || null,
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

      try {
        await batch.commit();

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

        // ✅ Reload updated holding stats into local state
        const holdingRef = doc(db, `users/${user.uid}/holdings`, targetHoldingId);
        const holdingSnap = await getDoc(holdingRef);
        if (holdingSnap.exists()) {
          setHoldings(prev => prev.map(h =>
            h.id === targetHoldingId
              ? { id: holdingSnap.id, ...holdingSnap.data() }
              : h
          ));
        }
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

      await reloadCurrentPage();

      clearCache();
      setLastDataFetch(Date.now());
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

      // Update holding stats
      if (txn && txn.holdingId) {
        await updateHoldingStats(txn.holdingId);
      }

      clearCache();
      setLastDataFetch(Date.now());
      await reloadCurrentPage();

      alert('Transaction deleted successfully!');
      const remainingTxns = transactions.filter(t =>
        t.holdingId === txn.holdingId && !t.deleted && t.id !== id
      );

      if (remainingTxns.length === 0) {
        // Delete the holding if no transactions left
        try {
          await deleteDoc(doc(db, `users/${user.uid}/holdings`, txn.holdingId));
          setHoldings(prev => prev.filter(h => h.id !== txn.holdingId));
          setManageFilters({ instrumentType: '', holdingId: '' });
          console.log('✅ Empty holding deleted automatically');
        } catch (error) {
          console.error('Error deleting empty holding:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction: ' + error.message);
    }
  };

  const calculateQuantityAtDate = (holdingId, targetDate) => {
    const holdingTxns = transactions
      .filter(t => t.holdingId === holdingId && !t.deleted && t.date <= targetDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let quantity = 0;
    for (const txn of holdingTxns) {
      if (txn.type === 'buy') quantity += txn.quantity;
      if (txn.type === 'sell') quantity -= txn.quantity;
    }

    return quantity;
  };

  const loadPriceAlerts = async () => {
    if (!user) return;
    try {
      const alertsRef = collection(db, `users/${user.uid}/priceAlerts`);
      const snap = await getDocs(alertsRef);
      setPriceAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading alerts:', e);
    }
  };

  const saveAlert = async () => {
    if (!alertForm.holdingId || !alertForm.targetPrice) {
      alert('Please select a holding and enter a target price.');
      return;
    }

    const holding = holdings.find(h => h.id === alertForm.holdingId);
    if (!holding) return;

    setIsSavingAlert(true);
    try {
      // Verify holding is valid via API
      const isMF = holding.type === 'mf';
      const priceData = await fetchStockPrice(holding.symbol || holding.name, isMF);
      if (!priceData.success) {
        alert('Could not verify this holding with the price API. Alert not saved.');
        setIsSavingAlert(false);
        return;
      }

      const alertData = {
        holdingId: alertForm.holdingId,
        holdingName: holding.name,
        holdingType: holding.type,
        symbol: holding.symbol || holding.name,
        targetPrice: parseFloat(alertForm.targetPrice),
        direction: alertForm.direction, // 'above' or 'below'
        currentPriceAtCreation: priceData.price,
        triggered: false,
        createdAt: new Date().toISOString(),
        userEmail: user.email
      };

      const alertsRef = collection(db, `users/${user.uid}/priceAlerts`);
      const docRef = await addDoc(alertsRef, alertData);
      setPriceAlerts(prev => [...prev, { id: docRef.id, ...alertData }]);

      setAlertForm({ holdingId: '', targetPrice: '', direction: 'above' });
      setShowAlertForm(false);
      alert(`✅ Alert set! You'll be emailed when ${holding.name} goes ${alertForm.direction} ₹${alertForm.targetPrice}`);
    } catch (e) {
      alert('Failed to save alert: ' + e.message);
    }
    setIsSavingAlert(false);
  };

  const deleteAlert = async (alertId) => {
    if (!confirm('Delete this price alert?')) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/priceAlerts`, alertId));
      setPriceAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) {
      alert('Failed to delete alert: ' + e.message);
    }
  };



  const checkPriceAlerts = async () => {
    if (!user || priceAlerts.length === 0) return;
    const activeAlerts = priceAlerts.filter(a => !a.triggered);
    if (activeAlerts.length === 0) return;

    for (const alert of activeAlerts) {
      try {
        // Use price already loaded in holdings — no extra API call needed
        const holding = holdings.find(h => h.id === alert.holdingId);
        if (!holding || !holding.currentPrice) continue;

        const currentPrice = holding.currentPrice;
        const triggered =
          (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.direction === 'below' && currentPrice <= alert.targetPrice);

        if (triggered) {
          await sendAlertNotification(
            `🚨 Price Alert Triggered!\n\n${alert.holdingName} has gone ${alert.direction} your target of ₹${alert.targetPrice}.\nCurrent Price: ₹${currentPrice}.\n\n`,
            alert.userEmail || user.email
          );

          // Mark as triggered in Firestore
          const alertRef = doc(db, `users/${user.uid}/priceAlerts`, alert.id);
          await updateDoc(alertRef, { triggered: true, triggeredAt: new Date().toISOString(), triggeredPrice: currentPrice });
          setPriceAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, triggered: true } : a));

          console.log(`✅ Alert triggered for ${alert.holdingName}`);
        }
      } catch (e) {
        console.error(`Error checking alert for ${alert.holdingName}:`, e);
      }
    }
  };
  // Check alerts whenever holdings prices are updated
  useEffect(() => {
    if (user && holdings.length > 0 && priceAlerts.length > 0) {
      checkPriceAlerts();
    }
  }, [holdings]);

  // Load alerts on login
  useEffect(() => {
    if (user) loadPriceAlerts();
  }, [user]);
  const renderManageTransactions = () => {
    const filteredHoldings = manageFilters.instrumentType
      ? holdings.filter(h => h.type === manageFilters.instrumentType)
      : [];
    const categoryOptions = [
      { value: 'stock', label: 'Stocks' },
      { value: 'mf', label: 'Mutual Funds' },
      { value: 'gold', label: 'Gold' },
      { value: 'bank', label: 'Bank Balance' }
    ];
    const holdingOptions = manageFilters.instrumentType
      ? [
        { value: '__new__', label: `Add New ${INSTRUMENT_LABELS[manageFilters.instrumentType]}` },
        ...filteredHoldings.map(h => ({ value: h.id, label: h.name }))
      ]
      : [];

    const totalPages = Math.ceil(totalTransactionCount / itemsPerPage);

    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h2 className="text-2xl font-bold text-slate-800">Manage Transactions</h2>
          {manageFilters.holdingId && !showTransactionForm &&
            (manageFilters.instrumentType !== 'bank' || manageFilters.holdingId === '__new__') && (
              <button
                onClick={() => {
                  setShowTransactionForm(true);
                  setEditingTransaction(null);
                  setTransactionForm({
                    type: manageFilters.instrumentType === 'bank' ? 'balance' : 'buy',
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
                className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Add Transaction
              </button>
            )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Select Category & Holding</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-slate-700 mb-2 break-words">1. Select Category</label>
              {isCompactDropdownViewport ? (
                <CompactSelect
                  value={manageFilters.instrumentType}
                  placeholder="-- Select Category --"
                  ariaLabel="Select Category"
                  options={categoryOptions}
                  onChange={(nextValue) => {
                    setManageFilters({ instrumentType: nextValue, holdingId: '' });
                    setCurrentPageNum(1);
                    setPaginationCursors({});
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                />
              ) : (
                <select
                  value={manageFilters.instrumentType}
                  onChange={(e) => {
                    setManageFilters({ instrumentType: e.target.value, holdingId: '' });
                    setCurrentPageNum(1);
                    setPaginationCursors({});
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  style={{ backgroundColor: '#f8fafc', color: 'black' }}
                  className="w-full min-w-0 px-3 py-2 pr-10 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {!manageFilters.instrumentType && <option value="" disabled>-- Select Category --</option>}
                  <option value="stock">Stocks</option>
                  <option value="mf">Mutual Funds</option>
                  <option value="gold">Gold</option>
                  <option value="bank">Bank Balance</option>
                </select>
              )}
            </div>

            {manageFilters.instrumentType && (
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 mb-2 break-words">
                  2. Select {INSTRUMENT_LABELS[manageFilters.instrumentType]}
                </label>
                {isCompactDropdownViewport ? (
                  <CompactSelect
                    value={manageFilters.holdingId}
                    placeholder="-- Select Holding --"
                    ariaLabel={`Select ${INSTRUMENT_LABELS[manageFilters.instrumentType]}`}
                    options={holdingOptions}
                    onChange={(nextValue) => {
                      setManageFilters({ ...manageFilters, holdingId: nextValue });
                      setCurrentPageNum(1);
                      setPaginationCursors({});
                      setShowTransactionForm(false);
                      setEditingTransaction(null);
                    }}
                  />
                ) : (
                  <select
                    value={manageFilters.holdingId}
                    onChange={(e) => {
                      setManageFilters({ ...manageFilters, holdingId: e.target.value });
                      setCurrentPageNum(1);
                      setPaginationCursors({});
                      setShowTransactionForm(false);
                      setEditingTransaction(null);
                    }}
                    style={{ backgroundColor: '#f8fafc', color: 'black' }}
                    className="w-full min-w-0 px-3 py-2 pr-10 text-sm sm:text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {!manageFilters.holdingId && <option value="" disabled>-- Select Holding --</option>}
                    <option value="__new__">+ Add New {INSTRUMENT_LABELS[manageFilters.instrumentType]}</option>
                    {filteredHoldings.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {showTransactionForm && (manageFilters.holdingId || manageFilters.instrumentType) && (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {editingTransaction ? 'Edit Transaction' : manageFilters.holdingId === '__new__' ? 'Add New Holding & Transaction' : 'Add New Transaction'}
              </h3>
              <button
                onClick={() => {
                  setShowTransactionForm(false);
                  setEditingTransaction(null);
                }}
                style={{ backgroundColor: 'white', color: '#475569' }}
                className="self-start sm:self-auto p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-300 hover:text-blue-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Show Name and Symbol fields if adding new holding */}
              {manageFilters.holdingId === '__new__' && (
                <>
                  {/* Only show Name field for gold and bank */}
                  {(manageFilters.instrumentType === 'mf' || manageFilters.instrumentType === 'gold' || manageFilters.instrumentType === 'bank') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {manageFilters.instrumentType === 'mf' ? 'Fund Name *' : 'Name * '}
                        <span className="text-xs text-slate-500">
                          {manageFilters.instrumentType === 'gold' ? '(e.g. SBI Gold Deposit, Arihant Jewellers)' :
                            manageFilters.instrumentType === 'bank' ? '(e.g. HDFC Savings Account)' :
                              ''}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={transactionForm.name}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          if (/^[A-Z\s]*$/.test(val) && val.length <= 100) {
                            setTransactionForm({ ...transactionForm, name: val });
                          }
                        }}
                        placeholder={manageFilters.instrumentType === 'mf' ? "Enter fund name" : "Enter name"}
                        style={{ backgroundColor: '#f8fafc', color: 'black' }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Symbol field - autocomplete for stocks, regular input for gold/bank */}
                  {manageFilters.instrumentType === 'stock' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <div className="flex items-center gap-1">
                          <span>Symbol *</span>
                          {manageFilters.instrumentType === 'stock' && (
                            <div className="relative group inline-block">
                              <svg className="w-4 h-4 text-slate-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <div className="absolute left-0 top-full mt-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                Quick Google search: "Ticker Symbol for <span className="underline">Company name</span>"
                              </div>
                            </div>
                          )}
                        </div>
                      </label>

                      <input
                        type="text"
                        value={transactionForm.symbol}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          if (/^[A-Z]*$/.test(val) && val.length <= 20) {
                            setTransactionForm({ ...transactionForm, symbol: val });
                          }
                        }}
                        placeholder="Example: Infosys ticker symbol is INFY"
                        style={{ backgroundColor: '#f8fafc', color: 'black' }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {(manageFilters.instrumentType === 'mf') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                      <select
                        value={transactionForm.category}
                        onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}
                        style={{ backgroundColor: '#f8fafc', color: 'black' }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="" disabled>Select category</option>
                        <option value="Liquid Fund">Liquid Fund</option>
                        <option value="Flexi Cap">Flexi Cap</option>
                        <option value="Large Cap">Large Cap</option>
                        <option value="Mid Cap">Mid Cap</option>
                        <option value="Small Cap">Small Cap</option>
                        <option value="Balanced Advantage">Balanced Advantage</option>
                        <option value="Debt">Debt</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {manageFilters.instrumentType !== 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Type {manageFilters.holdingId === '__new__' && (
                    <span className="text-xs text-slate-500 mt-1">Locked to "Buy" for New Holdings 🔒</span>
                  )}</label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
                    disabled={manageFilters.holdingId === '__new__'}
                    style={{ backgroundColor: '#f8fafc', color: 'black' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                    {manageFilters.instrumentType !== 'gold' && <option value="dividend">Dividend</option>}
                    {manageFilters.instrumentType === 'gold' && <option value="interest">Interest</option>}
                  </select>
                </div>
              )}

              {manageFilters.instrumentType !== 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date * <span className="text-xs text-slate-500">
                      ({new Date(2024, 11, 31).toLocaleDateString(navigator.language, { year: 'numeric', month: '2-digit', day: '2-digit' })
                        .replace('31', 'dd').replace('12', 'mm').replace('2024', 'yyyy')})
                    </span>
                  </label>
                  <input
                    type="date"
                    value={transactionForm.date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    style={{ backgroundColor: '#f8fafc', color: 'black' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {transactionForm.type !== 'dividend' && transactionForm.type !== 'interest' && transactionForm.type !== 'balance' && (
                <>
                  {manageFilters.instrumentType !== 'bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {manageFilters.instrumentType === 'gold' ? 'Weight (Grams)' : 'Quantity'} *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={transactionForm.quantity}
                        onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') {
                            e.preventDefault();
                          }
                        }}
                        style={{ backgroundColor: '#f8fafc', color: 'black', colorScheme: 'light' }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {manageFilters.instrumentType === 'mf' ? 'NAV (Per Unit) *' :
                        manageFilters.instrumentType === 'gold' ? 'Price Per Gram *' :
                          manageFilters.instrumentType === 'bank' ? 'Current Balance *' :
                            'Price *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={transactionForm.price}
                      onChange={(e) => setTransactionForm({ ...transactionForm, price: e.target.value })}
                      style={{ backgroundColor: '#f8fafc', color: 'black', colorScheme: 'light' }}
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
                    style={{ backgroundColor: '#f8fafc', color: 'black', colorScheme: 'light' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {manageFilters.instrumentType === 'gold' && transactionForm.type === 'interest' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Interest From Date *</label>
                    <input
                      type="date"
                      value={transactionForm.interestStartDate}
                      onChange={(e) => setTransactionForm({ ...transactionForm, interestStartDate: e.target.value })}
                      style={{ backgroundColor: '#f8fafc', color: 'black' }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Interest To Date *</label>
                    <input
                      type="date"
                      value={transactionForm.interestEndDate || ''}
                      onChange={(e) => setTransactionForm({ ...transactionForm, interestEndDate: e.target.value })}
                      style={{ backgroundColor: '#f8fafc', color: 'black' }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleSaveTransaction}
                disabled={isSaving}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-2 rounded-lg ${isSaving
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
                className="w-full sm:w-auto px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rest of the transaction list code stays the same... */}
        {manageFilters.holdingId && manageFilters.holdingId !== '__new__' && manageFilters.instrumentType !== 'bank' && paginatedTransactions.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <h3 className="text-xl font-bold text-slate-800">
                Transactions for {holdings.find(h => h.id === manageFilters.holdingId)?.name}
              </h3>
              <div className="flex w-full sm:w-auto items-center gap-3">
                <label className="text-sm text-slate-600">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPageNum(1);
                    setPaginationCursors({});
                  }}
                  style={{ backgroundColor: '#f8fafc', color: 'black' }}
                  className="min-w-0 flex-1 sm:flex-none px-3 py-1 border border-slate-300 rounded-lg text-sm">
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
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                          <label className="block">
                            <div className="flex items-center gap-1">
                              <span>Date</span>
                              <span className="text-xs normal-case text-slate-500">
                                ({new Date(2024, 11, 31).toLocaleDateString(navigator.language, { year: 'numeric', month: '2-digit', day: '2-digit' })
                                  .replace('31', 'dd').replace('12', 'mm').replace('2024', 'yyyy')})
                              </span>
                              <span className="text-lg">↑</span>
                            </div>
                          </label>
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Type</th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {manageFilters.instrumentType === 'gold' ? 'Quantity (grams)' : 'Quantity'}
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {manageFilters.instrumentType === 'gold' ? 'Price (per gram)' :
                            manageFilters.instrumentType === 'mf' ? 'NAV (per unit)' : 'Price'}
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">
                          {manageFilters.instrumentType === 'gold' ? 'Interest / Total Cost' : 'Amount'}
                        </th>
                        {manageFilters.instrumentType === 'gold' && (
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Duration of Interest</th>
                        )}
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
                          <td className="px-6 py-4 text-right text-slate-900">
                            {txn.type === 'interest' && txn.interestStartDate ? (
                              <div className="flex items-center justify-end gap-1 relative group">
                                <span>{calculateQuantityAtDate(txn.holdingId, txn.interestStartDate).toFixed(2)}</span>
                                <svg className="w-4 h-4 text-slate-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute right-0 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                  Total quantity held at interest start date ({new Date(txn.interestStartDate).toLocaleDateString('en-IN')})
                                </div>
                              </div>
                            ) : txn.type === 'dividend' ? (
                              <div className="flex items-center justify-end gap-1 relative group">
                                <span>{calculateQuantityAtDate(txn.holdingId, txn.date).toFixed(2)}</span>
                                <svg className="w-4 h-4 text-slate-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute right-0 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                  Total quantity held at dividend date ({new Date(txn.date).toLocaleDateString('en-IN')})
                                </div>
                              </div>
                            ) : txn.quantity > 0 ? (
                              txn.quantity.toFixed(2)
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-900">
                            {txn.type === 'interest' || txn.type === 'dividend' ? '-' : (txn.price > 0 ? `₹${txn.price.toFixed(2)}` : '-')}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-900">₹{txn.amount.toLocaleString('en-IN')}</td>
                          {manageFilters.instrumentType === 'gold' && (
                            <td className="px-6 py-4 text-slate-900">
                              {txn.type === 'interest' && txn.interestStartDate && txn.interestEndDate
                                ? `${new Date(txn.interestStartDate).toLocaleDateString('en-IN')} to ${new Date(txn.interestEndDate).toLocaleDateString('en-IN')}`
                                : '-'}
                            </td>
                          )}
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 8px' }}
                                onClick={() => {
                                  setTransactionForm({
                                    type: txn.type,
                                    date: txn.date,
                                    quantity: txn.quantity.toString(),
                                    price: txn.price.toString(),
                                    interestRate: txn.interestRate?.toString() || '',
                                    interestStartDate: txn.interestStartDate || '',
                                    interestEndDate: txn.interestEndDate || '',  // ✅ ADD THIS LINE
                                    name: '',
                                    symbol: '',
                                    category: ''
                                  });
                                  setEditingTransaction(txn);
                                  setShowTransactionForm(true);

                                  // Scroll to edit form after it's shown
                                  setTimeout(() => {
                                    const editForm = document.querySelector('[class*="bg-white rounded-xl shadow-md p-6"]');
                                    if (editForm) {
                                      editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                  }, 150);;
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '6px 8px' }}
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
              <div className="p-4 border-t border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div className="text-sm text-slate-600">
                  Showing {((currentPageNum - 1) * itemsPerPage) + 1} to {Math.min(currentPageNum * itemsPerPage, totalTransactionCount)} of {totalTransactionCount} transactions
                </div>
                <div className="flex flex-wrap gap-2">
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

        {/* Bank Balance Display - No transaction history, just current balance */}
        {manageFilters.holdingId && manageFilters.holdingId !== '__new__' && manageFilters.instrumentType === 'bank' && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {holdings.find(h => h.id === manageFilters.holdingId)?.name}
              </h3>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <div className="text-sm text-slate-600 mb-1">Current Balance</div>
                  <div className="text-2xl font-bold text-slate-800">
                    ₹{calculateHoldingStats(manageFilters.holdingId)?.currentValue.toLocaleString('en-IN') || '0'}
                  </div>
                </div>
                {!showTransactionForm && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const holding = holdings.find(h => h.id === manageFilters.holdingId);
                        const latestTxn = transactions
                          .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted)
                          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                        setTransactionForm({
                          type: 'balance',
                          date: new Date().toISOString().split('T')[0],
                          quantity: '',
                          price: latestTxn?.amount.toString() || '',
                          interestRate: '',
                          interestStartDate: '',
                          interestEndDate: '',
                          name: '',
                          symbol: '',
                          category: ''
                        });
                        setEditingTransaction(latestTxn || null);
                        setShowTransactionForm(true);

                        setTimeout(() => {
                          const editForm = document.querySelector('[class*="bg-white rounded-xl shadow-md p-6"]');
                          if (editForm) {
                            editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 150);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Edit size={18} />
                      Update Balance
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('Delete this bank account? This will remove all associated data.')) return;

                        try {
                          const holdingId = manageFilters.holdingId;

                          // Delete all transactions for this bank
                          const bankTransactions = transactions.filter(t => t.holdingId === holdingId);
                          const batch = writeBatch(db);

                          bankTransactions.forEach(txn => {
                            const txnRef = doc(db, `users/${user.uid}/transactions`, txn.id);
                            batch.delete(txnRef);
                          });

                          // Delete the holding
                          const holdingRef = doc(db, `users/${user.uid}/holdings`, holdingId);
                          batch.delete(holdingRef);

                          await batch.commit();

                          // Update local state
                          setTransactions(prev => prev.filter(t => t.holdingId !== holdingId));
                          setHoldings(prev => prev.filter(h => h.id !== holdingId));
                          setManageFilters({ instrumentType: '', holdingId: '' });

                          clearCache();
                          setLastDataFetch(Date.now());

                          alert('Bank account deleted successfully!');
                        } catch (error) {
                          console.error('Error deleting bank:', error);
                          alert('Failed to delete bank account: ' + error.message);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Trash2 size={18} />
                      Delete Bank
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Price Alerts Section */}
        {manageFilters.instrumentType && manageFilters.instrumentType !== 'bank' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Price Alerts</h3>
                <p className="text-xs text-slate-400 mt-1">Get emailed when a holding hits your target price</p>
              </div>
              {!showAlertForm && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowAlertForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus size={16} />
                    Set Alert
                  </button>
                  <button
                    onClick={async () => {
                      await checkPriceAlerts();
                      alert('✅ Alert check complete. If any threshold was hit, an email was sent.');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm border border-slate-300"
                  >
                    <RefreshCw size={16} />
                    Check Now
                  </button>
                </div>
              )}
            </div>

            {showAlertForm && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Holding *</label>
                    <select
                      value={alertForm.holdingId}
                      onChange={e => setAlertForm({ ...alertForm, holdingId: e.target.value })}
                      style={{ backgroundColor: '#f8fafc', color: 'black' }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Holding --</option>
                      {holdings
                        .filter(h => h.type === manageFilters.instrumentType)
                        .map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Alert When Price Goes *</label>
                    <select
                      value={alertForm.direction}
                      onChange={e => setAlertForm({ ...alertForm, direction: e.target.value })}
                      style={{ backgroundColor: '#f8fafc', color: 'black' }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="above">Above (Target High)</option>
                      <option value="below">Below (Target Low / Stop Loss)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Target Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={alertForm.targetPrice}
                      onChange={e => setAlertForm({ ...alertForm, targetPrice: e.target.value })}
                      placeholder="e.g. 500"
                      style={{ backgroundColor: '#f8fafc', color: 'black', colorScheme: 'light' }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={saveAlert}
                    disabled={isSavingAlert}
                    className={`flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm text-white ${isSavingAlert ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    <Save size={15} />
                    {isSavingAlert ? 'Verifying & Saving...' : 'Save Alert'}
                  </button>
                  <button
                    onClick={() => { setShowAlertForm(false); setAlertForm({ holdingId: '', targetPrice: '', direction: 'above' }); }}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Active Alerts List */}
            {priceAlerts.filter(a => holdings.find(h => h.id === a.holdingId)?.type === manageFilters.instrumentType).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No price alerts set for {INSTRUMENT_LABELS[manageFilters.instrumentType]}</p>
            ) : (
              <div className="space-y-2">
                {priceAlerts
                  .filter(a => holdings.find(h => h.id === a.holdingId)?.type === manageFilters.instrumentType)
                  .map(alert => {
                    const holding = holdings.find(h => h.id === alert.holdingId);
                    const currentPrice = holding?.currentPrice || 0;
                    const isClose = Math.abs(currentPrice - alert.targetPrice) / alert.targetPrice < 0.05; // within 5%
                    return (
                      <div key={alert.id} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border ${alert.triggered ? 'bg-green-50 border-green-200' : isClose ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`w-2 h-2 rounded-full ${alert.triggered ? 'bg-green-500' : isClose ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          <div className="min-w-0">
                            <span className="block font-medium text-slate-800 text-sm break-words">{alert.holdingName}</span>
                            <span className="block text-slate-500 text-xs sm:inline sm:ml-2">
                              Alert when {alert.direction} ₹{alert.targetPrice.toLocaleString('en-IN')}
                            </span>
                            {currentPrice > 0 && (
                              <span className="block text-slate-400 text-xs sm:inline sm:ml-2">
                                (Current: ₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {alert.triggered && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Triggered ✓</span>}
                          {isClose && !alert.triggered && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Near Target ⚡</span>}
                          <button
                            onClick={() => deleteAlert(alert.id)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '4px 6px' }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
      </div>
    );
  };

  useEffect(() => {
    if (isE2EMode()) {
      setUser(e2eUser);
      setLoading(false);
      return undefined;
    }

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

        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('price_cache_') || key === 'gold_price_global') {
            localStorage.removeItem(key);
          }
        });

        localStorage.setItem('last_user_id', currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Restore lastDataFetch from localStorage on component mount/user change
    const savedLastFetch = localStorage.getItem('lastDataFetch');
    if (savedLastFetch) {
      setLastDataFetch(Number(savedLastFetch));
      console.log('✅ Restored lastDataFetch from localStorage');
    }
  }, [user]);

  useEffect(() => {
    if (lastDataFetch) {
      localStorage.setItem('lastDataFetch', lastDataFetch.toString());
    }
  }, [lastDataFetch]);

  useEffect(() => {
    if (!user) return;

    const loadNotes = async () => {
      try {
        const notesRef = doc(db, `users/${user.uid}/settings/notes`);
        const notesSnap = await getDoc(notesRef);
        if (notesSnap.exists()) {
          setPortfolioNotes(notesSnap.data().content || '');
        }
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };

    loadNotes();
  }, [user]); // Runs every time component mounts with a user


  // Block keyboard refresh shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault();
        alert('Please use the "Refresh" button (↻) in the Header to Update Prices');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (hasUpdatedPrices) {
      localStorage.setItem('hasUpdatedPrices', 'true');
    }
  }, [hasUpdatedPrices]);

  // Auto logout after 24 hours of inactivity
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const LAST_ACTIVITY_KEY = 'lastActivityTime';

    // Update last activity time
    const updateActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    };

    // Check if user should be logged out
    const checkInactivity = () => {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

      if (lastActivity) {
        const timeSinceActivity = Date.now() - Number(lastActivity);

        if (timeSinceActivity > INACTIVITY_LIMIT) {
          console.log('🔒 Auto-logout: 24hr inactivity');
          alert('You have been logged out due to inactivity (24 hours).');

          // Clear everything and logout
          clearCache();
          localStorage.removeItem('lastDataFetch');
          localStorage.removeItem('hasUpdatedPrices');
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          setLastDataFetch(null);
          setHasUpdatedPrices(false);
          logOut();
        }
      } else {
        // First time - set initial activity
        updateActivity();
      }
    };

    // Check on mount
    checkInactivity();

    // Update activity on user interaction
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [user]);

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
      <>
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
        <div className="fixed bottom-0 w-full text-center pb-4 bg-gradient-to-br from-slate-50 to-slate-100">
          <p className="text-slate-400 text-sm">

          </p>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile-friendly header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        {/* Mock Data Banner */}
        {holdings.some(h => h.id.startsWith('temp-')) && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-6 lg:px-10 py-2">
            <p className="text-sm text-amber-800 text-center">
              ⚠️ <strong>Mock Data Mode</strong> - This is sample data for demonstration. Refresh the page or re-login to clear it.
            </p>
          </div>
        )}
        {isUpdatingPrices && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm mx-4">
              <RefreshCw size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">Updating Prices...</h3>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-600">{updateProgress}% Complete</p>
            </div>
          </div>
        )}
        <div className="max-w-none xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center">
            {/* Logo and title */}
            <div className="flex min-w-0 items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <Wallet className="text-blue-600" size={28} />
                <h1 className="text-lg sm:text-2xl font-bold text-slate-800 break-words">
                  {getFirstName(user)}'s Portfolio
                </h1>
              </div>
            </div>

            {/* User info and actions */}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:w-auto lg:justify-end">
              {/* Last update time */}
              {lastDataFetch && localStorage.getItem('hasUpdatedPrices') && (
                <span className="hidden sm:block text-xs text-slate-400 whitespace-nowrap">
                  Updated {(() => {
                    const seconds = Math.floor((currentTime - lastDataFetch) / 1000);
                    if (seconds < 60) return `${seconds}s ago`;
                    const minutes = Math.floor(seconds / 60);
                    const remainingSeconds = seconds % 60;
                    if (minutes < 60) return `${minutes}m ${remainingSeconds}s ago`;
                    const hours = (minutes / 60).toFixed(1);
                    return `${hours}hr ago`;
                  })()}
                </span>
              )}

              {/* Desktop refresh button */}
              <button
                onClick={async () => {
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('price_cache_') || key === 'gold_price_global') {
                      localStorage.removeItem(key);
                    }
                  });
                  await updateAllPrices();
                }}
                disabled={isUpdatingPrices}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
                className={`${isUpdatingPrices ? 'hidden sm:block opacity-50 cursor-not-allowed' : 'hidden sm:block'} text-slate-600 hover:text-blue-600 transition-colors`}
                title="Refresh data"
              >
                <RefreshCw size={18} />
              </button>

              {/* Navigation tabs */}
              <nav className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {currentPage !== 'home' && currentPage !== 'detail' && currentPage !== 'transactions' && (
                  <button
                    onClick={() => setCurrentPage('home')}
                    style={{ backgroundColor: '#2563eb', color: 'white' }}
                    className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors bg-blue-600 text-white hover:bg-blue-800`}
                  >
                    Dashboard
                  </button>
                )}
                {currentPage !== 'manage' && (
                  <div className="relative group w-full sm:w-auto">
                    <button
                      onClick={() => {
                        const hasMockData = holdings.some(h => h.id.startsWith('temp-'));
                        if (!hasMockData) {
                          setCurrentPage('manage');
                        }
                      }}
                      disabled={holdings.some(h => h.id.startsWith('temp-'))}
                      style={holdings.some(h => h.id.startsWith('temp-'))
                        ? { backgroundColor: '#d1d5db', color: '#6b7280', cursor: 'not-allowed' }
                        : { backgroundColor: '#2563eb', color: 'white' }
                      }
                      className="w-full px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors whitespace-nowrap"
                    >
                      <span className="hidden sm:inline">Manage Transactions</span>
                      <span className="sm:hidden">Manage</span>
                    </button>
                    {holdings.some(h => h.id.startsWith('temp-')) && (
                      <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        Manage Transactions not available in Mock Data Mode. Please Refresh or Re-Login
                      </div>
                    )}
                  </div>
                )}
              </nav>

              {/* Logout button */}
              <button
                onClick={() => {
                  // Clear mock data if present
                  const hasMockData = holdings.some(h => h.id.startsWith('temp-'));
                  if (hasMockData) {
                    setHoldings([]);
                    setTransactions([]);
                  }
                  clearCache();
                  localStorage.removeItem('lastDataFetch');
                  localStorage.removeItem('hasUpdatedPrices');
                  setLastDataFetch(null);  // ✅ Clear from state
                  setHasUpdatedPrices(false);
                  setCurrentTime(Date.now());  // ✅ Reset timer
                  logOut();
                }}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
                className="flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm sm:text-base border border-slate-300 hover:text-blue-600" >
                <LogOut size={18} />
                <span className="sm:inline" >Logout</span>
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
      <AIAdvisor
        holdings={holdings}
        transactions={transactions}
        typeSummary={typeSummary}
        portfolioStats={portfolioStats}
      />
    </div>
  );
};

export default PortfolioTracker;

