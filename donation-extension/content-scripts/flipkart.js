// Flipkart Content Script - Detects cart total on Flipkart

class FlipkartCartDetector {
    constructor() {
        this.lastAmount = null;
        this.init();
    }

    init() {
        console.log('Flipkart: Initializing detector');
        this.observeDOM();
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

    detectCartTotal() {
        try {
            console.log('Flipkart: Starting detection...');
            
            // PRIORITY 1: Look for "Total Payable" label first
            let totalAmount = this.findTotalByLabel('Total Payable');
            
            // PRIORITY 1.5: If not found, try "Total Amount" 
            if (!totalAmount) {
                totalAmount = this.findTotalByLabel('Total Amount');
            }
            
            if (totalAmount) {
                console.log('Flipkart: Found Total:', totalAmount);
                if (totalAmount !== this.lastAmount && this.isValidAmount(totalAmount)) {
                    this.lastAmount = totalAmount;
                    this.notifyDonation(totalAmount);
                }
                return;
            }
            
            // PRIORITY 2: Scan for largest price on page (likely the total)
            let largestPrice = 0;
            let largestElem = null;
            let allElements = document.querySelectorAll('*');
            console.log('Flipkart: Scanning', allElements.length, 'elements');
            
            for (let elem of allElements) {
                const text = elem.textContent?.trim() || '';
                
                // Only check leaf elements (no children)
                if (elem.children.length > 0) continue;
                
                // Skip script/style/comment elements
                if (elem.tagName.match(/SCRIPT|STYLE|SMALL|SVG|COMMENT/i)) continue;
                
                // Try to extract amount
                const amount = this.extractAmount(text);
                // Keep all amounts > 0, let isValidAmount handle filtering
                if (amount && amount > 0 && this.isValidAmount(amount)) {
                    // Check if near total-like labels
                    const parentText = (elem.parentElement?.textContent || '').toLowerCase();
                    const isNearLabel = /total|payable|amount|due|subtotal|final|checkout/i.test(parentText);
                    
                    console.log('Flipkart: Found amount:', amount, 'Near label:', isNearLabel);
                    // Prefer amounts near labels, but still track largest
                    if (amount > largestPrice) {
                        largestPrice = amount;
                        largestElem = elem;
                    }
                }
            }
            
            if (largestPrice > 0) {
                console.log('Flipkart: Largest price found:', largestPrice);
                if (largestPrice !== this.lastAmount) {
                    this.lastAmount = largestPrice;
                    this.notifyDonation(largestPrice);
                } else {
                    console.log('Flipkart: Amount already notified');
                }
            } else {
                console.log('Flipkart: No valid amount found');
            }
        } catch (error) {
            console.error('Error detecting Flipkart cart total:', error);
        }
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
            
            // Extract price from parent's next sibling
            for (let labelElem of labelElements) {
                if (labelElem.parentElement && labelElem.parentElement.nextElementSibling) {
                    const priceContainer = labelElem.parentElement.nextElementSibling;
                    
                    // Find all spans in the container that might have prices
                    const spans = priceContainer.querySelectorAll('span');
                    for (let span of spans) {
                        const spanText = (span.textContent || '').trim();
                        
                        // Skip if text is too long (probably contains multiple prices/sentences)
                        if (spanText.length > 100) continue;
                        
                        // Skip if it says "save"
                        if (spanText.toLowerCase().includes('save')) continue;
                        
                        const match = spanText.match(/₹\s*([0-9,]+(?:\.\d{1,2})?)/);
                        if (match) {
                            const amount = parseInt(match[1].replace(/,/g, ''));
                            if (this.isValidAmount(amount)) {
                                console.log('Flipkart: Extracted amount from span:', spanText, 'Amount:', amount);
                                return amount;
                            }
                        }
                    }
                }
            }
            
            console.log('Flipkart: No amount found for label:', labelText);
            return null;
        } catch (error) {
            console.error('Error in findTotalByLabel:', error);
            return null;
        }
    }

    extractAmount(text) {
        try {
            // Remove currency and commas
            let cleaned = text.replace(/₹|,/g, '').trim();
            
            // Find the number
            const match = cleaned.match(/\d+(\.\d{1,2})?/);
            if (match) {
                return parseInt(match[0]);
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
        console.log('Flipkart: notifyDonation called with amount:', amount);
        chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
            console.log('Flipkart: Got settings:', response);
            if (!response?.selectedNGO) {
                console.log('Flipkart: No NGO selected, skipping');
                return;
            }
            if (response.extensionEnabled === false) {
                console.log('Flipkart: Extension disabled');
                return;
            }

            const roundedAmount = this.calculateRoundUp(amount, response.roundingRule);
            const donationAmount = roundedAmount - amount;
            console.log('Flipkart: Rounding rule:', response.roundingRule, 'Amount:', amount, 'Rounded:', roundedAmount, 'Donation:', donationAmount);

            if (donationAmount >= 0) {
                console.log('Flipkart: Sending showDonationNotification message');
                chrome.runtime.sendMessage({
                    action: 'showDonationNotification',
                    data: {
                        originalAmount: amount,
                        roundedAmount: roundedAmount,
                        donationAmount: donationAmount,
                        website: 'flipkart.com',
                        ngoId: response.selectedNGO.id,
                        ngoName: response.selectedNGO.name,
                        ngoUPI: response.selectedNGO.upiId,
                        ngoDescription: response.selectedNGO.description,
                        ngoLogo: response.selectedNGO.logo
                    }
                }, (msgResponse) => {
                    console.log('Flipkart: Message response:', msgResponse);
                });
            } else {
                console.log('Flipkart: Donation amount is 0 or negative, skipping');
            }
        });
    }

    calculateRoundUp(amount, rule) {
        // Default to 5 if rule is missing or invalid
        const ruleNum = parseInt(rule) || 5;
        if (ruleNum <= 0) return amount;
        const remainder = amount % ruleNum;
        return remainder === 0 ? amount : amount + (ruleNum - remainder);
    }
}

new FlipkartCartDetector();
