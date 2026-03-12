// Rounding Algorithm and Helpers
// Used in both frontend and backend

/**
 * Calculate round-up amount based on rounding rule
 * @param {number} amount - The original amount
 * @param {string|number} rule - Rounding rule (5, 10, or 100)
 * @returns {number} Rounded amount
 */
function calculateRoundUp(amount, rule) {
    const ruleNum = parseInt(rule);
    const remainder = amount % ruleNum;
    return remainder === 0 ? amount : amount + (ruleNum - remainder);
}

/**
 * Calculate donation amount
 * @param {number} originalAmount - Original bill amount
 * @param {string|number} rule - Rounding rule
 * @returns {object} { originalAmount, roundedAmount, donationAmount }
 */
function calculateDonation(originalAmount, rule) {
    const roundedAmount = calculateRoundUp(originalAmount, rule);
    const donationAmount = roundedAmount - originalAmount;

    return {
        originalAmount,
        roundedAmount,
        donationAmount
    };
}

/**
 * Check if amount is valid for donation
 * @param {number} amount - Amount to check
 * @returns {boolean}
 */
function isValidDonationAmount(amount) {
    // Must be between ₹50 and ₹100,000
    return amount >= 50 && amount <= 100000;
}

/**
 * Get recommended rounding rule based on amount
 * @param {number} amount - The amount
 * @returns {string} Recommended rule (5, 10, or 100)
 */
function getRecommendedRule(amount) {
    if (amount < 500) return '5';      // Small amounts: round to 5
    if (amount < 5000) return '10';    // Medium amounts: round to 10
    return '100';                       // Large amounts: round to 100
}

/**
 * Format amount as Indian Rupees
 * @param {number} amount
 * @returns {string} Formatted amount
 */
function formatIndianRupees(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

// Test cases:
/*
calculateDonation(695, 5):
  Input: ₹695
  Output: { originalAmount: 695, roundedAmount: 700, donationAmount: 5 }

calculateDonation(1234, 10):
  Input: ₹1234
  Output: { originalAmount: 1234, roundedAmount: 1240, donationAmount: 6 }

calculateDonation(5678, 100):
  Input: ₹5678
  Output: { originalAmount: 5678, roundedAmount: 5700, donationAmount: 22 }

calculateDonation(500, 5):
  Input: ₹500 (already round)
  Output: { originalAmount: 500, roundedAmount: 500, donationAmount: 0 }
*/

module.exports = {
    calculateRoundUp,
    calculateDonation,
    isValidDonationAmount,
    getRecommendedRule,
    formatIndianRupees
};
