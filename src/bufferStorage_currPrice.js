import { doc, writeBatch } from 'firebase/firestore';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const fetchAndUpdatePrices = async (holdingsToUpdate, instrumentType, fetchStockPrice, db, userId) => {
    const now = Date.now();
    const updatedHoldings = [];

    try {
        // Special handling for gold - fetch GOLDBEES and convert
        if (instrumentType === 'gold') {
            const goldCache = localStorage.getItem('gold_price_global');
            let goldPrice = null;

            if (goldCache) {
                const { price, timestamp } = JSON.parse(goldCache);
                if (now - timestamp < CACHE_DURATION) {
                    console.log('✅ Using cached gold price');
                    goldPrice = price;
                }
            }

            // Fetch fresh gold price if cache expired
            if (!goldPrice) {
                console.log('🔄 Fetching fresh gold price from GOLDBEES...');
                try {
                    const goldETFData = await fetchStockPrice('GOLDBEES', false);
                    if (goldETFData.success) {
                        goldPrice = goldETFData.price * 127.2; // Convert to price per gram
                        console.log(`Gold BeES ETF price: ₹${goldETFData.price}, Price per gram: ₹${goldPrice}`);
                        localStorage.setItem('gold_price_global', JSON.stringify({ price: goldPrice, timestamp: now }));
                    } else {
                        console.warn('Failed to fetch gold price, using existing prices');
                        return []; // Return empty, keep existing prices
                    }
                } catch (error) {
                    console.error('Error fetching gold price:', error);
                    return [];
                }
            }

            // Update all gold holdings with same price
            const usingCache = goldCache && (now - JSON.parse(goldCache).timestamp < CACHE_DURATION);

            for (const holding of holdingsToUpdate) {
                updatedHoldings.push({
                    id: holding.id,
                    currentPrice: goldPrice,
                    cached: usingCache  // Mark as cached if from cache
                });
            }

            return updatedHoldings;
        }

        // For stocks/MF - check each holding individually
        const fetchPromises = holdingsToUpdate.map(async (holding) => {
            const cacheKey = `price_cache_${holding.id}`;
            const cached = localStorage.getItem(cacheKey);

            // Check cache first
            if (cached) {
                const { price, timestamp } = JSON.parse(cached);
                if (now - timestamp < CACHE_DURATION) {
                    console.log(`✅ Using cached price for ${holding.name}`);
                    return { id: holding.id, currentPrice: price, cached: true };
                }
            }

            // Fetch fresh price
            try {
                console.log(`🔄 Fetching fresh price for ${holding.name}...`);
                const result = await fetchStockPrice(
                    instrumentType === 'mf' ? holding.name : holding.symbol,
                    instrumentType === 'mf'
                );

                if (result.success) {
                    const newPrice = result.price;
                    localStorage.setItem(cacheKey, JSON.stringify({ price: newPrice, timestamp: now }));
                    return { id: holding.id, currentPrice: newPrice, cached: false };
                } else {
                    return { id: holding.id, currentPrice: holding.currentPrice, cached: true, failed: true };
                }
            } catch (error) {
                console.error(`❌ Failed to fetch price for ${holding.name}:`, error);
                return { id: holding.id, currentPrice: holding.currentPrice, cached: true, failed: true };
            }
        });

        const results = await Promise.all(fetchPromises);

        // Check if any failed
        const failedCount = results.filter(r => r.failed).length;
        if (failedCount > 0) {
            console.warn(`⚠️ ${failedCount} price(s) failed to update, using old prices`);
        }

        return results;
    } catch (error) {
        console.error('Error updating prices:', error);
        return [];
    }
};

export const updateHoldingPricesInFirebase = async (updatedPrices, db, userId) => {
    try {
        const batch = writeBatch(db);
        let updateCount = 0;

        updatedPrices.forEach(({ id, currentPrice, cached }) => {
            if (!cached) { // Only update Firebase if fetched fresh
                const holdingRef = doc(db, `users/${userId}/holdings`, id);
                batch.update(holdingRef, { currentPrice, updatedAt: new Date().toISOString() });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            try {
                await batch.commit();
                console.log(`✅ Updated ${updateCount} holdings in Firebase`);
            } catch (error) {
                console.error('⚠️ Failed to save prices to Firebase:', error);
                // Prices still work in-memory, just won't persist
                return false;
            }
        }

        return true;

    } catch (error) {
        console.error('Error updating prices in Firebase:', error);
        return false;
    }
};