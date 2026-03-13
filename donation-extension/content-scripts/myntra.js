// Myntra Content Script - Detects cart total on Myntra

class MyntraCartDetector {
    constructor() {
        this.lastAmount = null;
        this.init();
    }

    init() {
        console.log('Myntra: Initializing detector');
        this.observeDOM();

        // Listen for requests from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getCartTotal') {
                console.log('Myntra: Received getCartTotal request from popup');
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
            console.log('Myntra: Starting detection...');
            
            // PRIORITY 1: Look for specific total labels first
            const totalLabels = ['Total Amount', 'Total Payable', 'Payable Amount', 'Amount Payable', 'Order Total'];
            for (let labelText of totalLabels) {
                const amount = this.findTotalByLabel(labelText);
                if (amount) {
                    if (returnAmount) return amount;
                    console.log(`Myntra: Found ${labelText}:`, amount);
                    if (amount !== this.lastAmount && this.isValidAmount(amount)) {
                        this.lastAmount = amount;
                        this.notifyDonation(amount);
                    }
                    return;
                }
            }
            
            // PRIORITY 2: Scan for largest price on page (likely the total)
            let largestPrice = 0;
            let largestElem = null;
            let allElements = document.querySelectorAll('*');
            
            for (let elem of allElements) {
                const text = elem.textContent?.trim() || '';
                if (elem.children.length > 0) continue;
                if (elem.tagName.match(/SCRIPT|STYLE|SMALL|SVG|COMMENT/i)) continue;
                
                const amount = this.extractAmount(text);
                if (amount && amount > 0 && this.isValidAmount(amount)) {
                    // EXCLUSION: Skip if it mentions savings/discount/mrp in any ancestor (up to 4 levels)
                    let current = elem;
                    let shouldSkip = false;
                    for (let i = 0; i < 4 && current; i++) {
                        if (this.isSavingsLabel(current.textContent)) {
                            shouldSkip = true;
                            break;
                        }
                        current = current.parentElement;
                    }

                    if (shouldSkip) {
                        console.log('Myntra: Skipping price near savings/mrp label:', text);
                        continue;
                    }

                    console.log('Myntra: Considering potential price:', text, 'Amount:', amount);
                    
                    if (amount > largestPrice) {
                        largestPrice = amount;
                        largestElem = elem;
                    }
                }
            }
            
            if (largestPrice > 0) {
                if (returnAmount) return largestPrice;
                console.log('Myntra: Selected largest price:', largestPrice);
                if (largestPrice !== this.lastAmount) {
                    this.lastAmount = largestPrice;
                    this.notifyDonation(largestPrice);
                }
            }
            return returnAmount ? null : undefined;
        } catch (error) {
            console.error('Error detecting Myntra cart total:', error);
        }
    }

    isSavingsLabel(text) {
        if (!text) return false;
        const savingsKeywords = [
            'savings', 'saved', 'discount', 'off', 'you save', 'total savings', 
            'mrp', 'total mrp', 'coupon', 'applied', 'bag discount', 'platform fee'
        ];
        return savingsKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    findTotalByLabel(labelText) {
        try {
            console.log('Myntra: Searching for label:', labelText);
            const allElements = document.querySelectorAll('*');
            
            // Find SHORT elements that contain the label (likely the label itself)
            const labelElements = [];
            for (let elem of allElements) {
                const text = (elem.textContent || '').trim();
                
                // Find elements that are close to label text (not huge parents)
                if (text.toLowerCase().includes(labelText.toLowerCase()) && text.length < 100) {
                    labelElements.push(elem);
                }
            }
            
            console.log('Myntra: Found', labelElements.length, 'label candidates');
            
            // For each label element, look for price in the element itself, siblings or parent-siblings
            for (let labelElem of labelElements) {
                // EXCLUSION: If the label itself or its surroundings mention "saved/savings/discount/mrp"
                // but ONLY if the label isn't our target "Total Amount" label.
                // We check if the element contains EXCLUSION keywords but NOT our target label effectively.
                const elemText = labelElem.textContent || '';
                if (this.isSavingsLabel(elemText) && !elemText.toLowerCase().includes('total amount') && !elemText.toLowerCase().includes('total payable')) {
                    console.log('Myntra: Skipping candidate due to exclusion keywords:', elemText);
                    continue;
                }

                // Check the element itself (e.g., "Total Amount ₹1,062")
                const selfAmount = this.extractAmount(elemText);
                if (selfAmount && selfAmount > 0 && this.isValidAmount(selfAmount)) {
                    console.log('Myntra: Found price in label element itself:', selfAmount);
                    return selfAmount;
                }

                // Check next 3 siblings for a price
                let current = labelElem.nextElementSibling;
                for (let i = 0; i < 3 && current; i++) {
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
            
            console.log('Myntra: No amount found for label:', labelText);
            return null;
        } catch (error) {
            console.error('Error in findTotalByLabel:', error);
            return null;
        }
    }

    searchInContainer(container) {
        if (!container) return null;
        const priceElems = container.querySelectorAll('span, div');
        for (let el of priceElems) {
            if (el.children.length > 0) continue;
            const text = (el.textContent || '').trim();
            if (text.length > 30 || this.isSavingsLabel(text)) continue;
            const match = text.match(/₹\s*([0-9,]+(?:\.\d{1,2})?)/);
            if (match) {
                const amount = parseInt(match[1].replace(/,/g, ''));
                if (this.isValidAmount(amount)) {
                    console.log('Myntra: Extracted amount from container:', text, 'Amount:', amount);
                    return amount;
                }
            }
        }
        return null;
    }

    extractAmount(text) {
        try {
            if (!text) return null;
            // Look for number with optional commas and decimal
            // Example: ₹1,062.00 or 1062
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
        
        // Skip small prices (individual item prices)
        if (/^₹?\s*\d{1,2}(\.\d{1,2})?$/.test(text)) {
            return false;
        }
        
        // Check if visible
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        
        // Check parent element for context
        const parentText = element.parentElement?.textContent || '';
        const contextPatterns = [
            /total/i,
            /payable/i,
            /final/i,
            /amount/i,
            /grand/i
        ];
        
        const hasGoodContext = contextPatterns.some(p => p.test(parentText));
        
        // Check text patterns
        const pricePatterns = [
            /^\d{3,6}(\.\d{1,2})?$/,
            /Total/i,
            /^₹\s*\d+/,
            /Payable/i,
            /Amount/i
        ];

        return pricePatterns.some(pattern => pattern.test(text)) || hasGoodContext;
    }

    notifyDonation(amount) {
        // RESTRICTION: Only notify on specific Myntra checkout/cart pages
        if (!this.isOnCheckoutPage()) {
            console.log('Myntra: Not on a designated checkout page, skipping notification');
            return;
        }

        console.log('Myntra: notifyDonation called with amount:', amount);
        chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
            console.log('Myntra: Got settings:', response);
            
            if (response.extensionEnabled === false) {
                console.log('Myntra: Extension disabled');
                return;
            }

            const roundedAmount = this.calculateRoundUp(amount, response.roundingRule);
            const donationAmount = roundedAmount - amount;
            console.log('Myntra: Rounding rule:', response.roundingRule, 'Amount:', amount, 'Rounded:', roundedAmount, 'Donation:', donationAmount);

            if (donationAmount >= 0) {
                console.log('Myntra: Sending showDonationNotification message');
                chrome.runtime.sendMessage({
                    action: 'showDonationNotification',
                    data: {
                        originalAmount: amount,
                        roundedAmount: roundedAmount,
                        donationAmount: donationAmount,
                        website: 'myntra.com',
                        ngoId: response.selectedNGO?.id || null,
                        ngoName: response.selectedNGO?.name || null,
                        ngoUPI: response.selectedNGO?.upiId || null,
                        ngoDescription: response.selectedNGO?.description || null,
                        ngoLogo: response.selectedNGO?.logo || null
                    }
                }, (msgResponse) => {
                    console.log('Myntra: Message response:', msgResponse);
                });
            } else {
                console.log('Myntra: Donation amount is 0 or negative, skipping');
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
                    website: 'myntra.com',
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
        // Myntra cart/checkout URL usually contains /checkout/cart
        const path = window.location.pathname.toLowerCase();
        const url = window.location.href.toLowerCase();
        
        // Target: https://www.myntra.com/checkout/cart
        return path === '/checkout/cart' || path.includes('/checkout/payment');
    }
}

new MyntraCartDetector();
