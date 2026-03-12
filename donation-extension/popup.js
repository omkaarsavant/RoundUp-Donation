// Popup Script - Handles donation UI and user interactions

document.addEventListener('DOMContentLoaded', async () => {
    const notification = document.getElementById('notification');
    const defaultContent = document.getElementById('defaultContent');
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');
    const settingsLink = document.getElementById('settingsLink');

    // Check if payment was already completed for this tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId) {
            const successKey = `paymentCompleted_${tabId}`;
            chrome.storage.session.get([successKey, 'donationData'], (result) => {
                if (result[successKey]) {
                    console.log('Popup: Payment already completed for this tab');
                    showView('thankYouView');
                } else if (result.donationData) {
                    displayDonationNotification(result.donationData);
                    chrome.storage.session.remove(['donationData']);
                } else {
                    // Existing checkout detection logic
                    checkForCheckout(tabs[0]);
                }
            });
        }
    });

    function checkForCheckout(tab) {
        const url = tab?.url;
        const isSupportedSite = url && ['amazon.in', 'flipkart.com', 'myntra.com'].some(site => url.includes(site));

        console.log('Popup: Site:', url, 'isSupported:', isSupportedSite);

        if (isSupportedSite) {
            console.log('Popup: Supported site detected, requesting total from content script');
            chrome.tabs.sendMessage(tab.id, { action: 'getCartTotal' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Popup: Message failed (script might not be loaded):', chrome.runtime.lastError.message);
                    displayDefaultContent();
                    return;
                }

                if (response && response.success && response.data) {
                    console.log('Popup: Received on-demand total:', response.data);
                    displayDonationNotification(response.data);
                } else {
                    console.log('Popup: On-demand total not found or success=false, showing default');
                    displayDefaultContent();
                }
            });
        } else {
            displayDefaultContent();
        }
    }


    // Settings link
    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    const paymentContainer = document.getElementById('paymentContainer');
    const paymentIframe = document.getElementById('paymentIframe');
    const paymentBackBtn = document.getElementById('paymentBackBtn');

    // Handle messages from the payment iframe (e.g., closing the popup)
    window.addEventListener('message', (event) => {
        if (event.data === 'close-popup') {
            window.close();
        } else if (event.data === 'payment-success') {
            console.log('Popup: Received payment-success message');
            // Mark payment as completed for this tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0]?.id;
                if (tabId) {
                    const successKey = `paymentCompleted_${tabId}`;
                    chrome.storage.session.set({ [successKey]: true }, () => {
                        showView('thankYouView');
                    });
                }
            });
        }
    });

    const closeThankYouBtn = document.getElementById('closeThankYouBtn');
    if (closeThankYouBtn) {
        closeThankYouBtn.addEventListener('click', () => {
            window.close();
        });
    }

    function showView(viewId) {
        const views = ['notification', 'defaultContent', 'paymentContainer', 'thankYouView'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === viewId) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                    // Reset iframe if hiding payment view
                    if (id === 'paymentContainer') {
                        const iframe = document.getElementById('paymentIframe');
                        if (iframe) iframe.src = 'about:blank';
                    }
                }
            }
        });
    }

    // Back from payment
    paymentBackBtn.addEventListener('click', () => {
        showView('notification');
    });

    // Accept donation
    acceptBtn.addEventListener('click', async () => {
        const donationData = JSON.parse(localStorage.getItem('currentDonation') || '{}');
        
        if (!donationData.ngoUPI) {
            alert('NGO UPI ID not found. Please configure settings.');
            return;
        }

        try {
            console.log('Initiating Razorpay payment for:', donationData.ngoName);
            
            // Record donation and create Razorpay Payment Link
            const response = await fetch('http://localhost:5000/api/donations/create-payment-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalAmount: donationData.originalAmount,
                    roundedAmount: donationData.roundedAmount,
                    donationAmount: donationData.donationAmount,
                    ngoId: donationData.ngoId,
                    ngoName: donationData.ngoName,
                    website: donationData.website
                })
            });

            const data = await response.json();
            
            if (data.success && data.paymentLinkUrl) {
                console.log('Razorpay Payment Link created success:', data.paymentLinkUrl);
                
                // Switch to payment view
                showView('paymentContainer');
                
                // Clear any previous redirect messages and ensure iframe is visible
                const iwrapper = paymentContainer.querySelector('.iframe-wrapper');
                if (iwrapper) {
                    iwrapper.innerHTML = '<iframe id="paymentIframe" src="about:blank" frameBorder="0" style="width: 100%; height: 100%; border: none;"></iframe>';
                }
                
                // Load Razorpay in iframe
                const finalIframe = document.getElementById('paymentIframe');
                finalIframe.src = data.paymentLinkUrl;

            } else {
                console.error('Backend error:', data);
                throw new Error(data.error || 'Failed to create payment link');
            }

        } catch (error) {
            console.error('Extension popup error:', error);
            alert('Error processing donation: ' + error.message);
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

        showView('notification');
    }

    function displayDefaultContent() {
        showView('defaultContent');

        // Update status
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].url) return;
            const currentUrl = tabs[0].url;
            const isCheckoutPage = isOnCheckoutPage(currentUrl);
            
            const pageStatusEl = document.getElementById('pageStatus');
            if (pageStatusEl) {
                pageStatusEl.textContent = isCheckoutPage ? 'Checkout Detected' : 'Not on checkout';
                pageStatusEl.style.color = isCheckoutPage ? '#4CAF50' : '#999';
            }
        });

        chrome.storage.sync.get(['extensionEnabled'], (result) => {
            const extensionStatusEl = document.getElementById('extensionStatus');
            if (extensionStatusEl) {
                const status = result.extensionEnabled !== false ? 'Active' : 'Disabled';
                extensionStatusEl.textContent = status;
            }
        });
    }

    function isOnCheckoutPage(url) {
        if (!url) return false;
        const checkoutKeywords = [
            'cart', 'checkout', 'payment', 'billing', 'placeorder', 'ordersummary',
            '/gp/buy/', '/buy/pay', 'pay.flipkart.com', 'myntra.com/checkout'
        ];
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
