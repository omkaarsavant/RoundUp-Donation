// Myntra Content Script - Detects cart total on Myntra

class MyntraCartDetector {
    constructor() {
        this.lastAmount = null;
        this.init();
    }

    init() {
        console.log('Myntra: Initializing detector');
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
            console.log('Myntra: Starting detection...');
            
            // PRIORITY 1: Look for "Total Amount" label first
            const totalAmountPrice = this.findTotalByLabel('Total Amount');
            if (totalAmountPrice) {
                console.log('Myntra: Found Total Amount:', totalAmountPrice);
                if (totalAmountPrice !== this.lastAmount && this.isValidAmount(totalAmountPrice)) {
                    this.lastAmount = totalAmountPrice;
                    this.notifyDonation(totalAmountPrice);
                }
                return;
            }
            
            // PRIORITY 2: Scan for largest price on page (likely the total)
            let largestPrice = 0;
            let largestElem = null;
            let allElements = document.querySelectorAll('*');
            console.log('Myntra: Scanning', allElements.length, 'elements');
            
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
                    
                    console.log('Myntra: Found amount:', amount, 'Near label:', isNearLabel);
                    // Prefer amounts near labels, but still track largest
                    if (amount > largestPrice) {
                        largestPrice = amount;
                        largestElem = elem;
                    }
                }
            }
            
            if (largestPrice > 0) {
                console.log('Myntra: Largest price found:', largestPrice);
                if (largestPrice !== this.lastAmount) {
                    this.lastAmount = largestPrice;
                    this.notifyDonation(largestPrice);
                } else {
                    console.log('Myntra: Amount already notified');
                }
            } else {
                console.log('Myntra: No valid amount found');
            }
        } catch (error) {
            console.error('Error detecting Myntra cart total:', error);
        }
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
            
            // For each label element, look for price in next siblings
            for (let labelElem of labelElements) {
                // Check next 5 siblings for a price
                let current = labelElem.nextElementSibling;
                for (let i = 0; i < 5 && current; i++) {
                    const siblingText = (current.textContent || '').trim();
                    const match = siblingText.match(/₹\s*([0-9,]+(?:\.\d{1,2})?)/);
                    if (match) {
                        const amount = parseInt(match[1].replace(/,/g, ''));
                        if (this.isValidAmount(amount)) {
                            console.log('Myntra: Found price after label:', amount);
                            return amount;
                        }
                    }
                    current = current.nextElementSibling;
                }
            }
            
            console.log('Myntra: No amount found for label:', labelText);
            return null;
        } catch (error) {
            console.error('Error in findTotalByLabel:', error);
            return null;
        }
    }

    extractAmount(text) {
        try {
            let cleaned = text.replace(/₹|,/g, '').trim();
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
        console.log('Myntra: notifyDonation called with amount:', amount);
        chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
            console.log('Myntra: Got settings:', response);
            if (!response?.selectedNGO) {
                console.log('Myntra: No NGO selected, skipping');
                return;
            }
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
                        ngoId: response.selectedNGO.id,
                        ngoName: response.selectedNGO.name,
                        ngoUPI: response.selectedNGO.upiId,
                        ngoDescription: response.selectedNGO.description,
                        ngoLogo: response.selectedNGO.logo
                    }
                }, (msgResponse) => {
                    console.log('Myntra: Message response:', msgResponse);
                });
            } else {
                console.log('Myntra: Donation amount is 0 or negative, skipping');
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

new MyntraCartDetector();
