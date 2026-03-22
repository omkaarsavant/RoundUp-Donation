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
        console.log('Background: Initiating Google Sign-In via WebAuthFlow...');
        
        const clientId = '547040678375-ab5hqpb9325hgrtltpre1spkra3j32mk.apps.googleusercontent.com';
        const redirectUri = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
        const scopes = ['openid', 'email', 'profile'].join(' ');
        
        // Use prompt=select_account to force the account picker every time
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&prompt=select_account`;

        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (responseUrl) => {
            if (chrome.runtime.lastError) {
                console.error("WebAuthFlow Error:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            if (!responseUrl) {
                console.error("WebAuthFlow: No response URL received");
                sendResponse({ success: false, error: 'Authentication failed or was cancelled.' });
                return;
            }

            console.log('Background: Received response URL, extracting token...');
            
            try {
                // Parse access_token from the URL fragment (#access_token=...)
                const url = new URL(responseUrl);
                const params = new URLSearchParams(url.hash.substring(1));
                const token = params.get('access_token');

                if (!token) {
                    throw new Error('Access token not found in URL fragment');
                }

                console.log('Background: Token extracted. Exchanging with Firebase...');
                const credential = GoogleAuthProvider.credential(null, token);
                const userCredential = await signInWithCredential(auth, credential);
                
                console.log("Firebase login successful for:", userCredential.user.email);
                sendResponse({ success: true, user: userCredential.user });
            } catch (err) {
                console.error("Auth Processing Error:", err);
                sendResponse({ success: false, error: `Authentication failed: ${err.message}` });
            }
        });
        return true; // Keep message channel open
    }
    
    if (request.action === 'signOut') {
        // 1. Get the current token before signing out of Firebase
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) {
                // 2. Revoke the token via Google's API
                fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
                    .then(() => {
                        console.log('Background: Token revoked successfully');
                        // 3. Remove from Chrome's cache
                        chrome.identity.removeCachedAuthToken({ token }, () => {
                            console.log('Background: Cached token removed');
                        });
                    })
                    .catch(err => console.error('Background: Token revocation failed:', err));
            }

            // 4. Sign out of Firebase and clear storage
            signOut(auth).then(() => {
                chrome.storage.sync.clear(() => {
                    chrome.storage.session.clear(() => {
                        sendResponse({ success: true });
                    });
                });
            }).catch(err => {
                console.error("Firebase SignOut error:", err);
                sendResponse({ success: false, error: err.message });
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
