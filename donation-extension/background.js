// Background Service Worker - Handles extension lifecycle and communication

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showDonationNotification') {
        console.log('Background: Received showDonationNotification:', request.data);
        // Store donation data and open popup
        chrome.storage.session.set({ donationData: request.data }, () => {
            console.log('Background: Data stored, opening popup');
            chrome.action.openPopup().then(() => {
                console.log('Background: Popup opened successfully');
                sendResponse({ success: true });
            }).catch((err) => {
                console.error('Background: Error opening popup:', err);
                sendResponse({ success: false, error: err });
            });
        });
        return true;
    }

    if (request.action === 'getDonationSettings') {
        chrome.storage.sync.get(['selectedNGO', 'roundingRule', 'extensionEnabled'], (result) => {
            sendResponse({
                selectedNGO: result.selectedNGO || null,
                roundingRule: result.roundingRule || '5',
                extensionEnabled: result.extensionEnabled !== false
            });
        });
        return true;
    }

    if (request.action === 'saveDonationSettings') {
        chrome.storage.sync.set({
            selectedNGO: request.ngo,
            roundingRule: request.roundingRule,
            extensionEnabled: request.enabled
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// Inject content scripts when DOM is ready
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Check if on ecommerce site
        const checkoutSites = ['amazon.in', 'flipkart.com', 'myntra.com'];
        if (tab?.url && checkoutSites.some(site => tab.url.includes(site))) {
            // Inject observer script
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                function: setupObserver
            }).catch(err => console.log('Script injection failed:', err));
        }
    }
});

// Observer function to run in page context
function setupObserver() {
    // Listen for custom events from injected script
    window.addEventListener('cartTotalDetected', (event) => {
        chrome.runtime.sendMessage({
            action: 'cartTotalDetected',
            amount: event.detail.amount,
            website: event.detail.website,
            html: event.detail.html
        }).catch(err => console.log('Message failed:', err));
    });
}
