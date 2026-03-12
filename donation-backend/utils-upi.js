// Helper: UPI URL Generator
// This creates valid UPI payment links

const generateUPILink = (upiId, amount, name, transactionId) => {
    /**
     * UPI URL Scheme Format:
     * upi://pay?pa=<upi-id>&pn=<name>&tn=<description>&am=<amount>&tr=<ref-id>
     * 
     * Parameters:
     * pa: Payee address (UPI ID)
     * pn: Payee name
     * tn: Transaction note
     * am: Amount in rupees
     * tr: Transaction reference (for tracking)
     */

    const params = {
        pa: upiId,                          // UPI ID of NGO
        pn: encodeURIComponent(name),       // Name of NGO
        tn: encodeURIComponent(`Round-Up Donation ${transactionId}`),  // Description
        am: amount.toString(),              // Amount in rupees
        tr: transactionId                   // Reference ID
    };

    const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    return `upi://pay?${queryString}`;
};

// Example usage:
// const upiLink = generateUPILink(
//     'ngo@upi',
//     5,
//     'Teach India Foundation',
//     'txn-abc123'
// );
// console.log(upiLink);
// Output: upi://pay?pa=ngo@upi&pn=Teach%20India%20Foundation&tn=Round-Up%20Donation%20txn-abc123&am=5&tr=txn-abc123

module.exports = generateUPILink;

// Common UPI IDs to test:
/*
Google Pay:     googlepay.upi
PhonePe:        phonepe.upi
BHIM:           bhim.upi
PayTM:          paytm.upi
WhatsApp Pay:   whatsapp.upi

Testing:
To test UPI links, use:
upi://pay?pa=test@upi&pn=Test&tn=Test&am=1&tr=test123
*/
