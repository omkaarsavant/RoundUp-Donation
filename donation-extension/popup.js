// Popup Script - Handles donation UI and user interactions

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('notification');
    const defaultContent = document.getElementById('defaultContent');
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');
    const settingsLink = document.getElementById('settingsLink');

    // Check if we're showing notification
    chrome.storage.session.get(['donationData'], (result) => {
        if (result.donationData) {
            displayDonationNotification(result.donationData);
            chrome.storage.session.remove(['donationData']);
        } else {
            displayDefaultContent();
        }
    });

    // Settings link
    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    // Accept donation
    acceptBtn.addEventListener('click', async () => {
        const donationData = JSON.parse(localStorage.getItem('currentDonation') || '{}');
        
        if (!donationData.ngoUPI) {
            alert('NGO UPI ID not found. Please configure settings.');
            return;
        }

        try {
            // Record donation in backend
            const response = await fetch('http://localhost:5000/api/donations/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalAmount: donationData.originalAmount,
                    roundedAmount: donationData.roundedAmount,
                    donationAmount: donationData.donationAmount,
                    ngoId: donationData.ngoId,
                    website: donationData.website,
                    timestamp: new Date().toISOString()
                })
            });

            const data = await response.json();
            console.log('Donation recorded:', data);

            // Generate UPI payment link
            const upiLink = generateUPILink(
                donationData.ngoUPI,
                donationData.donationAmount,
                donationData.ngoName,
                data.transactionId
            );

            // Open UPI payment
            window.location.href = upiLink;

            // Close popup after opening payment
            setTimeout(() => {
                window.close();
            }, 500);

        } catch (error) {
            console.error('Error recording donation:', error);
            alert('Error processing donation. Please try again.');
        }
    });

    // Decline donation
    declineBtn.addEventListener('click', () => {
        localStorage.removeItem('currentDonation');
        window.close();
    });

    function displayDonationNotification(data) {
        document.getElementById('currentAmount').textContent = `₹${data.originalAmount}`;
        document.getElementById('roundedAmount').textContent = `₹${data.roundedAmount}`;
        document.getElementById('donationAmount').textContent = `₹${data.donationAmount}`;
        document.getElementById('ngoName').textContent = data.ngoName;
        document.getElementById('ngoDescription').textContent = data.ngoDescription;
        document.getElementById('ngoLogo').src = data.ngoLogo || 'icons/default-ngo.png';

        localStorage.setItem('currentDonation', JSON.stringify(data));

        notification.classList.remove('hidden');
        defaultContent.classList.add('hidden');
    }

    function displayDefaultContent() {
        notification.classList.add('hidden');
        defaultContent.classList.remove('hidden');

        // Update status
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentUrl = tabs[0].url;
            const isCheckoutPage = isOnCheckoutPage(currentUrl);
            
            document.getElementById('pageStatus').textContent = isCheckoutPage ? '✅ Checkout Detected' : '❌ Not on checkout';
            document.getElementById('pageStatus').style.color = isCheckoutPage ? '#4CAF50' : '#999';
        });

        chrome.storage.sync.get(['extensionEnabled'], (result) => {
            const status = result.extensionEnabled !== false ? 'Active' : 'Disabled';
            document.getElementById('extensionStatus').textContent = status;
        });
    }

    function isOnCheckoutPage(url) {
        const checkoutKeywords = ['cart', 'checkout', 'payment', 'billing', 'placeorder', 'ordersummary'];
        return checkoutKeywords.some(keyword => url.toLowerCase().includes(keyword));
    }
});

/**
 * Generate UPI payment link
 * Format: upi://pay?pa=UPI_ID&pn=NAME&tn=DESCRIPTION&am=AMOUNT&tr=REFERENCE_ID
 */
function generateUPILink(upiId, amount, ngoName, transactionId) {
    const upiParams = {
        pa: upiId,
        pn: encodeURIComponent(ngoName),
        tn: encodeURIComponent(`Donation via RoundUp - ${transactionId}`),
        am: amount.toString(),
        tr: transactionId
    };

    const queryString = Object.entries(upiParams)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    return `upi://pay?${queryString}`;
}
