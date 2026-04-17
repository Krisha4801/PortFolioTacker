export const validationForManageTransactionPage = async (
    transactionForm,
    manageFilters,
    editingTransaction,
    transactions,
    fetchStockPrice,
    currentApiKeyIndex,
    setIsSaving,
) => {
    // Validate date FIRST (so enteredDate exists)
    const enteredDate = new Date(transactionForm.date);

    if (!transactionForm.date) {
        alert('Please select a date');
        setIsSaving(false);
        return null
    }

    // Check if date is valid
    if (isNaN(enteredDate.getTime())) {
        alert('Invalid date format');
        setIsSaving(false);
        return null
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (enteredDate > today) {
        alert('Transaction date cannot be in the future');
        setIsSaving(false);
        return null
    }

    const minDate = new Date('2000-01-01');
    if (enteredDate < minDate) {
        alert('Transaction date seems too old. Please check the date.');
        setIsSaving(false);
        return null
    }

    // Validate transaction type EARLY
    let validTypes = ['buy', 'sell', 'dividend', 'interest'];
    if (manageFilters.instrumentType === 'bank') {
        validTypes.push('balance');
    }

    if (!validTypes.includes(transactionForm.type)) {
        alert('Invalid transaction type for this instrument');
        setIsSaving(false);
        return null
    }

    // Validate quantity (for buy/sell transactions) - use Number() not parseFloat()
    if (manageFilters.instrumentType !== 'bank' && (transactionForm.type === 'buy' || transactionForm.type === 'sell')) {
        const qtyStr = String(transactionForm.quantity).trim();
        const qty = Number(qtyStr);

        if (qtyStr === '' || isNaN(qty) || qty <= 0 || !isFinite(qty)) {
            alert('Quantity must be a positive number');
            setIsSaving(false);
            return null
        }

        // Upper bound validation
        const MAX_QUANTITY = 100000000; // 100000000 lakh units
        if (qty > MAX_QUANTITY) {
            alert(`Quantity cannot exceed ${MAX_QUANTITY.toLocaleString('en-IN')} units`);
            setIsSaving(false);
            return null
        }

        // Check if selling more than owned
        // Check if selling more than owned AT THE DATE OF TRANSACTION
        // Check if editing a BUY transaction would cause negative quantity later

        // Validate sell transactions don't exceed available quantity
        if (transactionForm.type === 'sell' && manageFilters.holdingId !== '__new__') {
            // Calculate quantity available at the transaction date
            let availableQty = 0;

            transactions
                .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted && t.date <= transactionForm.date)
                .forEach(t => {
                    // Skip the transaction being edited
                    if (editingTransaction && t.id === editingTransaction.id) return null

                    if (t.type === 'buy') availableQty += t.quantity;
                    if (t.type === 'sell') availableQty -= t.quantity;
                });

            if (qty > availableQty) {
                alert(`Cannot sell ${qty} units. Only ${availableQty.toFixed(2)} units available on ${new Date(transactionForm.date).toLocaleDateString('en-IN')}`);
                setIsSaving(false);
                return null
            }

            // Check if this sell would cause negative quantity in future transactions
            let runningQty = availableQty - qty;
            const laterTransactions = transactions
                .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted && t.date > transactionForm.date)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            for (const txn of laterTransactions) {
                if (txn.type === 'buy') runningQty += txn.quantity;
                if (txn.type === 'sell') runningQty -= txn.quantity;

                if (runningQty < 0) {
                    alert(`Cannot sell ${qty} units on ${new Date(transactionForm.date).toLocaleDateString('en-IN')}. This would cause negative quantity (${runningQty.toFixed(2)}) on ${new Date(txn.date).toLocaleDateString('en-IN')}.`);
                    setIsSaving(false);
                    return null
                }
            }
        }

        // Prevent editing buy/dividend/interest to sell or reducing quantity that would cause negatives
        if (editingTransaction && manageFilters.holdingId !== '__new__') {
            // Case 1: Changing transaction type to sell
            if (transactionForm.type === 'sell' && editingTransaction.type !== 'sell') {
                alert('Cannot change transaction type to SELL. Please delete this transaction and create a new SELL transaction instead.');
                setIsSaving(false);
                return null
            }

            // Case 2: Reducing a buy transaction quantity
            if (transactionForm.type === 'buy' && editingTransaction.type === 'buy') {
                const qtyDifference = editingTransaction.quantity - qty;

                if (qtyDifference > 0) {
                    // Calculate running quantity after this edit
                    let runningQty = 0;
                    transactions
                        .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted && t.date <= transactionForm.date)
                        .forEach(t => {
                            if (t.id === editingTransaction.id) {
                                runningQty += qty; // Use new quantity
                            } else {
                                if (t.type === 'buy') runningQty += t.quantity;
                                if (t.type === 'sell') runningQty -= t.quantity;
                            }
                        });

                    if (runningQty < 0) {
                        alert(`Cannot reduce buy quantity to ${qty}. This would cause negative quantity (${runningQty.toFixed(2)}) on ${new Date(transactionForm.date).toLocaleDateString('en-IN')}.`);
                        setIsSaving(false);
                        return null
                    }

                    // Check future transactions
                    const laterTransactions = transactions
                        .filter(t => t.holdingId === manageFilters.holdingId && !t.deleted && t.date > transactionForm.date)
                        .sort((a, b) => new Date(a.date) - new Date(b.date));

                    for (const txn of laterTransactions) {
                        if (txn.type === 'buy') runningQty += txn.quantity;
                        if (txn.type === 'sell') runningQty -= txn.quantity;

                        if (runningQty < 0) {
                            alert(`Cannot reduce buy quantity to ${qty}. This would cause negative quantity (${runningQty.toFixed(2)}) on ${new Date(txn.date).toLocaleDateString('en-IN')}.`);
                            setIsSaving(false);
                            return null
                        }
                    }
                }
            }
        }
    }

    // Validate price/amount - use Number() not parseFloat()
    const priceStr = String(transactionForm.price).trim();
    const priceValue = Number(priceStr);

    if (priceStr === '' || isNaN(priceValue) || priceValue <= 0 || !isFinite(priceValue)) {
        alert('Price/Amount must be a positive number');
        setIsSaving(false);
        return null
    }

    // Upper bound validation
    const MAX_PRICE = 10000000000; // 1000 crore
    if (priceValue > MAX_PRICE) {
        alert(`Price cannot exceed ₹${MAX_PRICE.toLocaleString('en-IN')}`);
        setIsSaving(false);
        return null
    }

    // Validate gold-specific fields for interest transactions
    if (manageFilters.instrumentType === 'gold' && transactionForm.type === 'interest') {
        if (!transactionForm.interestStartDate) {
            alert('Please select Interest From Date');
            setIsSaving(false);
            return null
        }

        if (!transactionForm.interestEndDate) {
            alert('Please select Interest To Date');
            setIsSaving(false);
            return null
        }

        // Validate that end date is after start date
        const startDate = new Date(transactionForm.interestStartDate);
        const endDate = new Date(transactionForm.interestEndDate);

        if (endDate <= startDate) {
            alert('Interest To Date must be after Interest From Date');
            setIsSaving(false);
            return null
        }
    }

    // Validate NEW holding fields ONLY if creating new holding
    if (manageFilters.holdingId === '__new__') {
        // For stocks/MF, only symbol is required (name auto-filled)
        // For gold/bank, both name and symbol are required
        const needsName = manageFilters.instrumentType === 'gold' || manageFilters.instrumentType === 'bank';

        if (manageFilters.instrumentType === 'stock') {
            if (!transactionForm.symbol) {
                alert('Please select a symbol');
                setIsSaving(false);
                return null
            }

            if (transactionForm.symbol.trim().length < 2 || transactionForm.symbol.trim().length > 20) {
                alert('Symbol must be between 2 and 20 characters');
                setIsSaving(false);
                return null
            }

            if (!/^[A-Z0-9.-]+$/i.test(transactionForm.symbol.trim())) {
                alert('Symbol can only contain letters, numbers, dots and hyphens');
                setIsSaving(false);
                return null
            }
        }

        if (manageFilters.instrumentType === 'mf' && !transactionForm.category) {
            alert('Please select a category for Mutual Fund');
            setIsSaving(false);
            return null
        }

        if (needsName && !transactionForm.name) {
            alert('Please enter a name');
            setIsSaving(false);
            return null
        }

        if (!needsName && !transactionForm.name) {
            // Extract name from symbol (remove .NS/.BO suffix)
            const cleanSymbol = transactionForm.symbol.replace(/\.(NS|BO)$/i, '');
            transactionForm.name = cleanSymbol;
        }
    }

    // Verify symbol exists via API (only when creating NEW holding) - FETCH ONCE AND STORE
    let fetchedPriceData = null;
    if (manageFilters.holdingId === '__new__') {
        if (manageFilters.instrumentType === 'stock') {
            // Stock validation - check symbol
            setIsSaving(true);
            try {
                fetchedPriceData = await fetchStockPrice(transactionForm.symbol);
                if (!fetchedPriceData.success) {
                    setIsSaving(false);
                    alert('Invalid symbol. Please check and try again.');
                    return null
                }
            } catch (error) {
                setIsSaving(false);
                alert('Could not verify symbol. Please check the symbol and try again.');
                return null
            }
        } else if (manageFilters.instrumentType === 'mf') {
            // MF validation - check name
            setIsSaving(true);
            try {
                fetchedPriceData = await fetchStockPrice(transactionForm.name, true); // true = isMutualFund
                if (!fetchedPriceData.success) {
                    setIsSaving(false);
                    alert('Invalid fund name. Please check and try again.');
                    return null;
                }
            } catch (error) {
                setIsSaving(false);
                alert('Could not verify fund name. Please check the fund name and try again.');
                return null;
            }
        } else if (manageFilters.instrumentType === 'gold') {
            // Gold validation - fetch Nippon India ETF Gold BeES price
            setIsSaving(true);
            try {
                const goldETFData = await fetchStockPrice('GOLDBEES');
                if (!goldETFData.success) {
                    setIsSaving(false);
                    alert('Could not fetch gold price. Please try again.');
                    return null
                }

                // Calculate price per gram (ETF price * 127.2)
                const pricePerGram = goldETFData.price * 127.2;
                console.log("Gold BeES ETF price:", goldETFData.price);
                console.log("Calculated price per gram:", pricePerGram);

                fetchedPriceData = {
                    success: true,
                    price: pricePerGram,
                    companyName: transactionForm.name,
                    symbol: transactionForm.name.toUpperCase().replace(/\s+/g, '-')
                };
            } catch (error) {
                setIsSaving(false);
                alert('Could not fetch gold price. Please try again.');
                return null
            }
        }
    }

    // Calculate amount AFTER validation
    const amount = transactionForm.type === 'dividend' || transactionForm.type === 'interest' || transactionForm.type === 'balance'
        ? priceValue
        : (Number(transactionForm.quantity) || 0) * priceValue;

    const MAX_AMOUNT = 100000000000; // 10000 crore
    if (amount > MAX_AMOUNT) {
        alert(`Transaction amount cannot exceed ₹${(MAX_AMOUNT / 1000000000).toFixed(0)} crore`);
        setIsSaving(false);
        return null
    }

    if (!manageFilters.holdingId) {
        alert('Please select a holding first!');
        setIsSaving(false);
        return null
    }

    return {
        fetchedPriceData,
        amount
    }
};