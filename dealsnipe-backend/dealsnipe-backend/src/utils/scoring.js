/**
 * Calculates a deal score based on asking price vs estimated market value.
 * Returns: { score: 'great' | 'fair' | 'overpriced', percentOff: number }
 */
function scoreDeal(askingPrice, marketValue) {
  if (!marketValue || marketValue <= 0) {
    return { score: 'unknown', percentOff: null };
  }

  const diff = marketValue - askingPrice;
  const percentOff = (diff / marketValue) * 100;

  let score;
  if (percentOff >= 10) {
    score = 'great';       // 10%+ below market = Great Deal
  } else if (percentOff >= 0) {
    score = 'fair';        // At or slightly below market = Fair
  } else {
    score = 'overpriced';  // Above market = Overpriced
  }

  return { score, percentOff: Math.round(percentOff) };
}

module.exports = { scoreDeal };
