export const roundTo = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

export const calculateGainLoss = (totalCost, currentValue, totalIncome = 0) => {
  return roundTo((Number(currentValue) || 0) - (Number(totalCost) || 0) + (Number(totalIncome) || 0));
};

export const calculateReturnPercentage = (totalCost, totalGain) => {
  const cost = Number(totalCost) || 0;
  if (cost <= 0) return 0;
  return roundTo(((Number(totalGain) || 0) / cost) * 100);
};

export const calculatePortfolioAggregates = (holdings = []) => {
  const totals = holdings.reduce(
    (acc, holding) => {
      const totalCost = Number(holding.totalCost) || 0;
      const currentValue = Number(holding.currentValue) || 0;
      const totalIncome = Number(holding.totalIncome) || 0;

      acc.totalCost += totalCost;
      acc.currentValue += currentValue;
      acc.totalIncome += totalIncome;

      if (!acc.byType[holding.type]) {
        acc.byType[holding.type] = {
          totalCost: 0,
          currentValue: 0,
          totalIncome: 0,
          totalGain: 0,
          totalReturn: 0
        };
      }

      acc.byType[holding.type].totalCost += totalCost;
      acc.byType[holding.type].currentValue += currentValue;
      acc.byType[holding.type].totalIncome += totalIncome;

      return acc;
    },
    {
      totalCost: 0,
      currentValue: 0,
      totalIncome: 0,
      totalGain: 0,
      totalReturn: 0,
      byType: {}
    }
  );

  totals.totalCost = roundTo(totals.totalCost);
  totals.currentValue = roundTo(totals.currentValue);
  totals.totalIncome = roundTo(totals.totalIncome);
  totals.totalGain = calculateGainLoss(totals.totalCost, totals.currentValue, totals.totalIncome);
  totals.totalReturn = calculateReturnPercentage(totals.totalCost, totals.totalGain);

  Object.keys(totals.byType).forEach((type) => {
    const group = totals.byType[type];
    group.totalCost = roundTo(group.totalCost);
    group.currentValue = roundTo(group.currentValue);
    group.totalIncome = roundTo(group.totalIncome);
    group.totalGain = calculateGainLoss(group.totalCost, group.currentValue, group.totalIncome);
    group.totalReturn = calculateReturnPercentage(group.totalCost, group.totalGain);
  });

  return totals;
};

export const canAddHolding = (holdings = [], newHolding = {}) => {
  const nextSymbol = String(newHolding.symbol || '').trim().toLowerCase();
  const nextName = String(newHolding.name || '').trim().toLowerCase();
  const nextType = newHolding.type;

  return !holdings.some((holding) => {
    const sameType = holding.type === nextType;
    const sameSymbol = nextSymbol && String(holding.symbol || '').trim().toLowerCase() === nextSymbol;
    const sameName = nextName && String(holding.name || '').trim().toLowerCase() === nextName;
    return sameType && (sameSymbol || sameName);
  });
};

export const shouldTriggerAlert = ({ currentPrice, targetPrice, direction }) => {
  const current = Number(currentPrice);
  const target = Number(targetPrice);

  if (!Number.isFinite(current) || !Number.isFinite(target)) return false;
  if (direction === 'above') return current >= target;
  if (direction === 'below') return current <= target;
  return false;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 500);
};

export const getFallbackPriceResult = (apiResult, previousPrice) => {
  if (apiResult?.success && Number.isFinite(Number(apiResult.price))) {
    return {
      price: Number(apiResult.price),
      usedFallback: false
    };
  }

  return {
    price: Number(previousPrice) || 0,
    usedFallback: true
  };
};
