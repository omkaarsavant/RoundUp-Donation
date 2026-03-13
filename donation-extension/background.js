// Background Service Worker - Handles extension lifecycle and communication
import { auth } from './config.js';
import { 
    signInWithCredential, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from './libs/firebase.js';

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.runtime.openOptionsPage();
    }
});

// Broadcast session changes to other extension parts
onAuthStateChanged(auth, (user) => {
    console.log('Auth state changed in background:', user ? user.uid : 'logged out');
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'signInWithGoogle') {
        console.log('Background: Initiating Google Sign-In...');
        // 1. Get OAuth token from Chrome Identity
        chrome.identity.getAuthToken({ interactive: true }, async function (token) {
            if (chrome.runtime.lastError) {
                console.error("Identity Error:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            console.log('Background: Got Chrome Identity token. Exchanging with Firebase...');
            
            try {
                // 2. Exchange token with Firebase using Google Auth Provider
                const credential = GoogleAuthProvider.credential(null, token);
                console.log('Background: Created Firebase Credential from Access Token');
                
                const userCredential = await signInWithCredential(auth, credential);
                const idToken = await userCredential.user.getIdToken();

                console.log("Firebase login successful for:", userCredential.user.email);
                console.log("Firebase ID Token generated (first 20 chars):", idToken.substring(0, 20));
                
                sendResponse({ success: true, user: userCredential.user });
            } catch (err) {
                console.error("Firebase Auth Exchange Error:", err);
                sendResponse({ success: false, error: `Firebase Auth failed: ${err.message}` });
            }
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'signOut') {
        signOut(auth).then(() => {
            // Clear all user-specific extension storage
            chrome.storage.sync.clear(() => {
                chrome.storage.session.clear(() => {
                    // Also revoke the Chrome Identity token
                    chrome.identity.getAuthToken({ interactive: false }, (token) => {
                        if (token) {
                            chrome.identity.removeCachedAuthToken({ token }, function() {
                                sendResponse({ success: true });
                            });
                        } else {
                            sendResponse({ success: true });
                        }
                    });
                });
            });
        });
        return true;
    }

    if (request.action === 'signInWithEmail') {
        signInWithEmailAndPassword(auth, request.email, request.password)
            .then((userCredential) => {
                console.log("Email SignIn successful:", userCredential.user);
                sendResponse({ success: true, user: userCredential.user });
            })
            .catch(err => {
                console.error("Caught Exception in Email SignIn:", err);
                sendResponse({ success: false, error: err.message || 'Network error during sign in' });
            });
        return true;
    }

    if (request.action === 'signUpWithEmail') {
        createUserWithEmailAndPassword(auth, request.email, request.password)
            .then((userCredential) => {
                console.log("Email SignUp successful:", userCredential.user);
                sendResponse({ success: true, user: userCredential.user });
            })
            .catch(err => {
                console.error("Caught Exception in Email SignUp:", err);
                sendResponse({ success: false, error: err.message || 'Network error during sign up' });
            });
        return true;
    }

    if (request.action === 'getSession') {
        // Return current user if loaded, or wait for initialization
        const user = auth.currentUser;
        if (user !== undefined) {
             sendResponse({ session: user ? { user } : null });
             return false;
        } else {
             const unsubscribe = onAuthStateChanged(auth, (usr) => {
                 unsubscribe();
                 sendResponse({ session: usr ? { user: usr } : null });
             });
             return true;
        }
    }

    if (request.action === 'getAuthToken') {
        // Helper to get ID token for backend requests
        const user = auth.currentUser;
        if (user) {
            user.getIdToken().then(token => sendResponse({ token })).catch(err => sendResponse({ error: err.message }));
            return true;
        } else {
            sendResponse({ token: null });
            return false;
        }
    }

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
        // Reset payment success flag for this tab when refreshed
        const successKey = `paymentCompleted_${tabId}`;
        chrome.storage.session.remove([successKey]);

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
