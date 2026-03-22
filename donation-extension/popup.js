// Popup Script - Handles donation UI and user interactions

const API_BASE_URL = 'https://roundup-donation.onrender.com/api';
let currentSession = null;

// Helper to get absolute logo URL
function getLogoUrl(path) {
    if (!path) return 'icons/default-ngo.png';
    if (path.startsWith('http')) return path;
const root = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
    const url = `${root}/${path}`;
    console.log(`[DEBUG] Final Logo URL (Popup) for ${path}: ${url}`);
    return url;
}

// Global server status state
let isServerOnline = false;

async function pingServer() {
    console.log('[DEBUG] Pinging server for cold start...');
    const serverStatusIndicators = document.querySelectorAll('.server-status-indicator');
    
    // Health endpoint
    const healthUrl = API_BASE_URL.replace(/\/api\/?$/, '') + '/health';

    try {
        const response = await fetch(healthUrl);
        if (response.ok) {
            isServerOnline = true;
            serverStatusIndicators.forEach(indicator => {
                indicator.classList.add('online');
                const textElem = indicator.querySelector('.status-text');
                if (textElem) textElem.textContent = 'Server Online';
                
                // Fade out after a moment
                setTimeout(() => {
                    indicator.style.opacity = '0.4';
                }, 4000);
            });

            // Update accept button if it's currently in "connecting" state
            const acceptBtn = document.getElementById('acceptBtn');
            if (acceptBtn && acceptBtn.dataset.waitingForServer === 'true') {
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'Donate & Pay';
                acceptBtn.dataset.waitingForServer = 'false';
                acceptBtn.classList.remove('btn-disabled');
            }

            console.log('✓ Server is awake and responsive');
            return true;
        }
    } catch (error) {
        console.warn('! Server is likely booting (cold start)...', error.message);
    }
    
    // Retry if not online
    if (!isServerOnline) {
        setTimeout(pingServer, 2000);
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // Start pinging immediately
    pingServer();
    
    // Auth UI elements
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const loginError = document.getElementById('loginError');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const signOutBtn = document.getElementById('signOutBtn');

    // Email Auth Elements
    const emailAuthForm = document.getElementById('emailAuthForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const emailLogInBtn = document.getElementById('emailLogInBtn');
    const emailSignUpBtn = document.getElementById('emailSignUpBtn');

    // App UI elements
    const notification = document.getElementById('notification');
    const defaultContent = document.getElementById('defaultContent');
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');
    const settingsLink = document.getElementById('settingsLink');
    const paymentContainer = document.getElementById('paymentContainer');
    const paymentIframe = document.getElementById('paymentIframe');
    const paymentBackBtn = document.getElementById('paymentBackBtn');
    const closeThankYouBtn = document.getElementById('closeThankYouBtn');

    // Initial load Flow
    await checkAuthStatus();

    // -- AUTH FLOW -- //
    
    async function checkAuthStatus() {
        chrome.runtime.sendMessage({ action: 'getSession' }, async (response) => {
            if (response && response.session) {
                currentSession = response.session;
                showAppUI(currentSession.user.email);
            } else {
                showAuthUI();
            }
        });
    }

    function showAuthUI() {
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }

    function showAppUI(email) {
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        if (userEmailDisplay) userEmailDisplay.textContent = email;
        
        // Resume checking for pending payments/donations
        initializeAppLogic();
    }

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            googleSignInBtn.disabled = true;
            googleSignInBtn.innerHTML = 'Signing in...';
            loginError.style.display = 'none';
            loginError.style.color = '#D32F2F';

            chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, (response) => {
                if (response && response.success) {
                    currentSession = { user: response.user };
                    showAppUI(currentSession.user.email);
                } else {
                    googleSignInBtn.disabled = false;
                    googleSignInBtn.innerHTML = 'Continue with Google';
                    loginError.textContent = response?.error || 'Sign in failed. Please try again.';
                    loginError.style.display = 'block';
                }
            });
        });
    }

    if (emailLogInBtn) {
        emailLogInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(!emailAuthForm.checkValidity()) {
                emailAuthForm.reportValidity();
                return;
            }
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            emailLogInBtn.disabled = true;
            emailLogInBtn.innerHTML = 'Logging in...';
            loginError.style.display = 'none';
            loginError.style.color = '#D32F2F';

            chrome.runtime.sendMessage({ action: 'signInWithEmail', email, password }, (response) => {
                emailLogInBtn.disabled = false;
                emailLogInBtn.innerHTML = 'Log In';
                
                if (response && response.success) {
                    currentSession = { user: response.user };
                    showAppUI(currentSession.user.email);
                } else {
                    loginError.textContent = response?.error || 'Sign in failed. Please try again.';
                    loginError.style.display = 'block';
                }
            });
        });
    }

    if (emailAuthForm) {
        emailAuthForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            emailSignUpBtn.disabled = true;
            emailSignUpBtn.innerHTML = 'Signing up...';
            loginError.style.display = 'none';
            loginError.style.color = '#D32F2F';

            chrome.runtime.sendMessage({ action: 'signUpWithEmail', email, password }, (response) => {
                emailSignUpBtn.disabled = false;
                emailSignUpBtn.innerHTML = 'Sign Up';

                if (response && response.success) {
                    if (response.user) {
                        currentSession = { user: response.user };
                        showAppUI(currentSession.user.email);
                    } else {
                        loginError.textContent = 'Sign up successful! Please check your email to confirm.';
                        loginError.style.color = 'var(--lux-accent, #4CAF50)';
                        loginError.style.display = 'block';
                    }
                } else {
                    loginError.textContent = response?.error || 'Sign up failed. Please try again.';
                    loginError.style.display = 'block';
                }
            });
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOutBtn.disabled = true;
            signOutBtn.textContent = 'Signing out...';
            localStorage.clear();
            chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
                signOutBtn.disabled = false;
                signOutBtn.textContent = 'Sign Out';
                currentSession = null;
                showAuthUI();
            });
        });
    }

    // -- APP FLOW -- //

    function initializeAppLogic() {
        console.log('[DEBUG] Initializing app logic (Detection Flow)');

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
    }

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
    if(settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });
    }

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
    if (paymentBackBtn) {
        paymentBackBtn.addEventListener('click', () => {
            showView('notification');
        });
    }

    // Accept donation
    if (acceptBtn) {
        acceptBtn.addEventListener('click', async () => {
            const donationData = JSON.parse(localStorage.getItem('currentDonation') || '{}');
            
            if (!donationData.ngoUPI && !donationData.ngoId) {
                alert('NGO info not found. Please configure settings.');
                return;
            }

            if (!currentSession) {
                alert('Please sign in to donate.');
                return;
            }

            try {
                console.log('Initiating Razorpay payment for:', donationData.ngoName);
                acceptBtn.disabled = true;
                acceptBtn.textContent = "Processing...";
                
                // Request the Firebase ID token from the background script
                const { token } = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'getAuthToken' }, resolve);
                });

                if (!token) throw new Error('Not authenticated');

                // Record donation and create Razorpay Payment Link, PASSING JWT
                const response = await fetch(`${API_BASE_URL}/donations/create-payment-link`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        originalAmount: donationData.originalAmount,
                        roundedAmount: donationData.roundedAmount,
                        donationAmount: donationData.donationAmount,
                        ngoId: donationData.ngoId,
                        ngoName: donationData.ngoName,
                        website: donationData.website,
                        userId: currentSession.user.uid || currentSession.user.id
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
            } finally {
                acceptBtn.disabled = false;
                acceptBtn.textContent = "Donate & Pay";
            }
        });
    }

    // Decline donation
    if (declineBtn) {
        declineBtn.addEventListener('click', () => {
            localStorage.removeItem('currentDonation');
            window.close();
        });
    }

    function displayDonationNotification(data) {
        const hasNgo = !!data.ngoId;
        
        document.getElementById('currentAmount').textContent = `₹${data.originalAmount}`;
        document.getElementById('roundedAmount').textContent = `₹${data.roundedAmount}`;
        document.getElementById('donationAmount').textContent = `₹${data.donationAmount}`;
        
        const ngoNameEl = document.getElementById('ngoName');
        const ngoDescEl = document.getElementById('ngoDescription');
        const ngoLogoEl = document.getElementById('ngoLogo');
        const acceptBtn = document.getElementById('acceptBtn');
        
        if (hasNgo) {
            ngoNameEl.textContent = data.ngoName;
            ngoDescEl.textContent = data.ngoDescription;
            const logoUrl = getLogoUrl(data.ngoLogo);
            ngoLogoEl.src = logoUrl;
            ngoLogoEl.style.filter = 'none';
            
            if (!isServerOnline) {
                acceptBtn.disabled = true;
                acceptBtn.textContent = 'Booting Server...';
                acceptBtn.dataset.waitingForServer = 'true';
                acceptBtn.classList.add('btn-disabled');
            } else {
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'Donate & Pay';
                acceptBtn.dataset.waitingForServer = 'false';
                acceptBtn.classList.remove('btn-disabled');
            }
        } else {
            ngoNameEl.innerHTML = '<span style="color: var(--lux-accent);">NGO Not Selected</span>';
            ngoDescEl.textContent = 'Please set your preferred NGO in settings to enable rounding donations.';
            ngoLogoEl.src = 'icons/default-ngo.png';
            ngoLogoEl.style.filter = 'grayscale(100%)';
            
            acceptBtn.disabled = true;
            acceptBtn.textContent = 'Set NGO in Settings';
            acceptBtn.classList.add('btn-disabled');
        }

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

        chrome.storage.sync.get(['extensionEnabled', 'selectedNGO'], (result) => {
            const extensionStatusEl = document.getElementById('extensionStatus');
            const ngoAlert = document.getElementById('ngoAlert');
            
            if (extensionStatusEl) {
                const status = result.extensionEnabled !== false ? 'Active' : 'Disabled';
                extensionStatusEl.textContent = status;
            }

            if (ngoAlert) {
                if (!result.selectedNGO) {
                    ngoAlert.classList.remove('hidden');
                } else {
                    ngoAlert.classList.add('hidden');
                }
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
