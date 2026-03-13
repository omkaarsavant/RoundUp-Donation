// Flipkart Content Script - Detects cart total on Flipkart

class FlipkartCartDetector {
    constructor() {
        this.lastAmount = null;
        this.init();
    }

    init() {
        console.log('Flipkart: Initializing detector');
        this.observeDOM();

        // Listen for requests from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getCartTotal') {
                console.log('Flipkart: Received getCartTotal request from popup');
                const amount = this.detectCartTotal(true);
                if (amount) {
                    this.getDonationData(amount).then(data => {
                        sendResponse({ success: true, data: data });
                    });
                    return true;
                } else {
                    sendResponse({ success: false, error: 'Total not found' });
                }
            }
        });

        // Run detection immediately and then every 2 seconds
        this.detectCartTotal();
        setTimeout(() => this.detectCartTotal(), 500);
        setTimeout(() => this.detectCartTotal(), 1000);
        this.detectionInterval = setInterval(() => this.detectCartTotal(), 2000);
    }

    observeDOM() {
        const config = { 
            childList: true, 
            subtree: true, 
            characterData: false 
        };

        const observer = new MutationObserver(() => {
            this.detectCartTotal();
        });

        if (document.body) {
            observer.observe(document.body, config);
        }
    }

    detectCartTotal(returnAmount = false) {
        try {
            console.log('Flipkart: Starting detection...');
            
            // PRIORITY 1: Look for specific total labels first
            const totalLabels = ['Total Amount', 'Total Payable', 'Payable Amount', 'Amount Payable', 'Order Total'];
            for (let labelText of totalLabels) {
                const amount = this.findTotalByLabel(labelText);
                if (amount) {
                    if (returnAmount) return amount;
                    console.log(`Flipkart: Priority 1 Found ${labelText}:`, amount);
                    if (amount !== this.lastAmount && this.isValidAmount(amount)) {
                        console.log('Flipkart: Amount changed from', this.lastAmount, 'to', amount);
                        this.lastAmount = amount;
                        this.notifyDonation(amount);
                    } else {
                        console.log('Flipkart: Priority 1 amount same as last or invalid:', amount, 'last:', this.lastAmount);
                    }
                    return;
                }
            }
            
            // PRIORITY 2: Scan for largest price on page (likely the total)
            console.log('Flipkart: Priority 1 failed, starting Priority 2...');
            let largestPrice = 0;
            let largestElem = null;
            const allElements = document.querySelectorAll('*');
            console.log('Flipkart: Priority 2 scanning', allElements.length, 'elements');
            
            for (let elem of allElements) {
                const text = elem.textContent?.trim() || '';
                if (elem.children.length > 0) continue;
                if (elem.tagName.match(/SCRIPT|STYLE|SMALL|SVG|COMMENT/i)) continue;
                
                const amount = this.extractAmount(text);
                if (amount && amount > 0 && this.isValidAmount(amount)) {
                    // EXCLUSION: Skip if it mentions savings/discount/mrp in any ancestor (up to 6 levels)
                    let current = elem;
                    let shouldSkip = false;
                    for (let i = 0; i < 6 && current; i++) {
                        const content = (current.textContent || '').toLowerCase();
                        if (this.isSavingsLabel(content)) {
                            shouldSkip = true;
                            break;
                        }
                        current = current.parentElement;
                    }

                    if (shouldSkip) continue;

                    if (amount > largestPrice) {
                        largestPrice = amount;
                        largestElem = elem;
                    }
                }
            }
            
            if (largestPrice > 0) {
                if (returnAmount) return largestPrice;
                console.log('Flipkart: Priority 2 Selected largest price:', largestPrice);
                if (largestPrice !== this.lastAmount) {
                    console.log('Flipkart: Priority 2 Amount changed from', this.lastAmount, 'to', largestPrice);
                    this.lastAmount = largestPrice;
                    this.notifyDonation(largestPrice);
                } else {
                    console.log('Flipkart: Priority 2 amount same as last:', largestPrice);
                }
            } else {
                console.log('Flipkart: No valid prices found in Priority 2');
            }
            return returnAmount ? null : undefined;
        } catch (error) {
            console.error('Error detecting Flipkart cart total:', error);
        }
    }

    isSavingsLabel(text) {
        if (!text) return false;
        const lower = text.toLowerCase();
        const savingsKeywords = [
            'savings', 'saved', 'discount', 'discounts', 'off', 'you save', 
            'total savings', 'mrp', 'coupon', 'applied', 'bag discount', 
            'platform fee', 'price (', 'total mrp', 'maximum retail price',
            'list price', 'selling price', 'delivery charges', 'packaging fee'
        ];
        // If it contains "total amount" or "total payable", it's NOT a savings label even if it has "mrp" elsewhere
        if (lower.includes('total amount') || lower.includes('total payable') || lower.includes('amount payable')) {
            return false;
        }
        return savingsKeywords.some(keyword => lower.includes(keyword));
    }

    findTotalByLabel(labelText) {
        try {
            console.log('Flipkart: Searching for label:', labelText);
            
            const allElements = document.querySelectorAll('*');
            
            // Find SHORT elements that contain the label
            const labelElements = [];
            for (let elem of allElements) {
                const text = (elem.textContent || '').trim();
                
                // Check if element text contains the label and is short (not a parent)
                if (text.toLowerCase().includes(labelText.toLowerCase()) && text.length < 100) {
                    labelElements.push(elem);
                    console.log('Flipkart: Found label element:', text);
                }
            }
            
            for (let labelElem of labelElements) {
                const elemText = labelElem.textContent || '';
                const lowerText = elemText.toLowerCase();
                
                // EXCLUSION: If the label itself or its surroundings mention "saved/savings/discount/mrp"
                // But allow if it specifically contains our target label words
                if (this.isSavingsLabel(elemText) && 
                    !lowerText.includes('total amount') && 
                    !lowerText.includes('total payable') && 
                    !lowerText.includes('amount payable')) {
                    console.log('Flipkart: Skipping label candidate due to exclusion keywords:', elemText);
                    continue;
                }

                // Check the element itself (e.g., "Total Amount ₹1,168")
                const selfAmount = this.extractAmount(elemText);
                if (selfAmount && selfAmount > 0 && this.isValidAmount(selfAmount)) {
                    // Even if found in self, double check it's not a saved amount
                    if (!this.isSavingsLabel(elemText)) {
                        console.log('Flipkart: Found price in label element itself:', selfAmount);
                        return selfAmount;
                    }
                }

                // Check next 3 siblings for a price
                let current = labelElem.nextElementSibling;
                for (let i = 0; i < 3 && current; i++) {
                    // Check if sibling itself is a savings label
                    if (this.isSavingsLabel(current.textContent)) {
                        console.log('Flipkart: Skipping sibling because it is a savings label');
                        continue;
                    }
                    const amount = this.searchInContainer(current);
                    if (amount) return amount;
                    current = current.nextElementSibling;
                }

                // Check siblings of the parent
                if (labelElem.parentElement && labelElem.parentElement.nextElementSibling) {
                    const amount = this.searchInContainer(labelElem.parentElement.nextElementSibling);
                    if (amount) return amount;
                }
            }
            
            console.log('Flipkart: No amount found for label:', labelText);
            return null;
        } catch (error) {
            console.error('Error in findTotalByLabel:', error);
            return null;
        }
    }

    searchInContainer(container) {
        if (!container) return null;
        
        // Find all spans/divs in the container that might have prices
        const priceElems = container.querySelectorAll('span, div');
        for (let el of priceElems) {
            // Leaf elements only to avoid parent noise
            if (el.children.length > 0) continue;
            
            const text = (el.textContent || '').trim();
            if (text.length > 30 || this.isSavingsLabel(text)) continue;

            const match = text.match(/₹\s*([0-9,]+(?:\.\d{1,2})?)/);
            if (match) {
                const amount = parseInt(match[1].replace(/,/g, ''));
                if (this.isValidAmount(amount)) {
                    console.log('Flipkart: Extracted amount from container:', text, 'Amount:', amount);
                    return amount;
                }
            }
        }
        return null;
    }

    extractAmount(text) {
        try {
            if (!text) return null;
            // EXCLUSION: If text contains a minus sign, it's a discount, not a total
            if (text.includes('-') || text.includes('−')) {
                return null;
            }
            // Look for number with optional commas and decimal
            const match = text.match(/₹?\s*([0-9,]+(?:\.\d{1,2})?)/);
            if (match) {
                let amountStr = match[1].replace(/,/g, '');
                const amount = parseInt(amountStr);
                return isNaN(amount) ? null : amount;
            }
        } catch (error) {
            console.error('Error extracting amount:', error);
        }
        return null;
    }

    isValidAmount(amount) {
        return amount >= 50 && amount <= 100000;
    }

    isLikelyTotal(element) {
        const text = (element.textContent || '').trim();
        
        // Exclude very small prices (likely item prices)
        if (/^₹?\s*\d{1,2}(\.\d{1,2})?$/.test(text)) {
            return false;
        }
        
        // Check visibility
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        
        // Check parent context
        const parentText = element.parentElement?.textContent || '';
        const contextPatterns = [
            /total/i,
            /amount/i,
            /payable/i,
            /grand/i,
            /final/i
        ];
        
        const hasGoodContext = contextPatterns.some(p => p.test(parentText));
        
        // Price patterns
        const pricePatterns = [
            /^\d{3,6}(\.\d{1,2})?$/,
            /Total/i,
            /^₹\s*\d+/,
            /Amount/i,
            /Grand/i
        ];

        return pricePatterns.some(pattern => pattern.test(text)) || hasGoodContext;
    }

    notifyDonation(amount) {
        console.log('Flipkart: notifyDonation triggered with amount:', amount);
        // RESTRICTION: Only notify on specific Flipkart cart/checkout pages
        if (!this.isOnCheckoutPage()) {
            console.log('Flipkart: Not on a designated checkout page, skipping notification');
            return;
        }

        console.log('Flipkart: Requesting donation settings...');
        chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
            console.log('Flipkart: Got settings response:', response);
            if (!response) {
                console.error('Flipkart: No response from background script for settings');
                return;
            }
            
            if (response.extensionEnabled === false) {
                console.log('Flipkart: Extension is disabled in settings');
                return;
            }

            const roundedAmount = this.calculateRoundUp(amount, response.roundingRule);
            const donationAmount = roundedAmount - amount;
            console.log('Flipkart: Rounding rule:', response.roundingRule, 'Amount:', amount, 'Rounded:', roundedAmount, 'Donation:', donationAmount);

            if (donationAmount >= 0) {
                console.log('Flipkart: Sending showDonationNotification message to background');
                chrome.runtime.sendMessage({
                    action: 'showDonationNotification',
                    data: {
                        originalAmount: amount,
                        roundedAmount: roundedAmount,
                        donationAmount: donationAmount,
                        website: 'flipkart.com',
                        ngoId: response.selectedNGO?.id || null,
                        ngoName: response.selectedNGO?.name || null,
                        ngoUPI: response.selectedNGO?.upiId || null,
                        ngoDescription: response.selectedNGO?.description || null,
                        ngoLogo: response.selectedNGO?.logo || null
                    }
                }, (msgResponse) => {
                    console.log('Flipkart: showDonationNotification response from background:', msgResponse);
                    if (chrome.runtime.lastError) {
                        console.error('Flipkart: Runtime error sending notification:', chrome.runtime.lastError.message);
                    }
                });
            } else {
                console.log('Flipkart: Donation amount is 0 or negative, skipping');
            }
        });
    }

    async getDonationData(amount) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
                if (response.extensionEnabled === false) {
                    resolve(null);
                    return;
                }

                const roundedAmount = this.calculateRoundUp(amount, response.roundingRule);
                const donationAmount = roundedAmount - amount;

                resolve({
                    originalAmount: amount,
                    roundedAmount: roundedAmount,
                    donationAmount: donationAmount,
                    website: 'flipkart.com',
                    ngoId: response.selectedNGO?.id || null,
                    ngoName: response.selectedNGO?.name || null,
                    ngoUPI: response.selectedNGO?.upiId || null,
                    ngoDescription: response.selectedNGO?.description || null,
                    ngoLogo: response.selectedNGO?.logo || null
                });
            });
        });
    }

    calculateRoundUp(amount, rule) {
        // Hardcoded to 5 as per user request
        const ruleNum = 5;
        const remainder = amount % ruleNum;
        return remainder === 0 ? amount : amount + (ruleNum - remainder);
    }

    isOnCheckoutPage() {
        const path = window.location.pathname.toLowerCase();
        const url = window.location.href.toLowerCase();
        console.log('Flipkart: Checking path:', path);
        // Flipkart cart is /viewcart, checkout is /checkout or /viewcheckout
        const isCheckout = path.includes('/viewcart') || path.includes('/checkout') || path.includes('/viewcheckout');
        console.log('Flipkart: isCheckout:', isCheckout);
        return isCheckout;
    }
}

new FlipkartCartDetector();
