// Amazon Content Script - Detects cart total on Amazon India

class AmazonCartDetector {
    constructor() {
        this.lastAmount = null;
        this.init();
    }

    init() {
        // Watch for DOM changes
        console.log('Amazon: Initializing detector');
        this.observeDOM();
        
        // Also check on page load with multiple intervals
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

        // Observe common cart containers
        const targets = [
            document.body,
            document.querySelector('.a-box'),
            document.querySelector('[role="main"]')
        ];

        targets.forEach(target => {
            if (target) observer.observe(target, config);
        });
    }

    detectCartTotal() {
        try {
            // Amazon displays total in multiple places - we need to be specific
            
            // PRIORITY 1: Look for "Order Total:" specifically
            const orderTotalAmount = this.findOrderTotal();
            if (orderTotalAmount) {
                if (orderTotalAmount !== this.lastAmount && this.isValidAmount(orderTotalAmount)) {
                    console.log('Amazon: Order Total found:', orderTotalAmount);
                    this.lastAmount = orderTotalAmount;
                    this.notifyDonation(orderTotalAmount);
                }
                return;
            }
            
            // PRIORITY 2: For payment page (/checkout/p/.../pay)
            if (window.location.pathname.includes('checkout')) {
                const paymentPageAmount = this.detectPaymentPageTotal();
                if (paymentPageAmount) {
                    if (paymentPageAmount !== this.lastAmount && this.isValidAmount(paymentPageAmount)) {
                        console.log('Amazon: Payment page amount:', paymentPageAmount);
                        this.lastAmount = paymentPageAmount;
                        this.notifyDonation(paymentPageAmount);
                    }
                    return;
                }
            }
            
            // PRIORITY 3: Find largest price as fallback
            let largestPrice = 0;
            const allElements = document.querySelectorAll('*');
            
            for (let elem of allElements) {
                const text = elem.textContent?.trim() || '';
                // Skip containers with children
                if (elem.children.length > 0) continue;
                // Skip script/style elements
                if (elem.tagName.match(/SCRIPT|STYLE|SMALL|SVG/i)) continue;
                
                const amount = this.extractAmount(text);
                if (amount && this.isValidAmount(amount) && amount > largestPrice) {
                    largestPrice = amount;
                }
            }
            
            if (largestPrice > 0 && largestPrice !== this.lastAmount) {
                console.log('Amazon: Found largest price:', largestPrice);
                this.lastAmount = largestPrice;
                this.notifyDonation(largestPrice);
            }
        } catch (error) {
            console.error('Error detecting Amazon cart total:', error);
        }
    }

    findOrderTotal() {
        try {
            const allElements = document.querySelectorAll('*');
            
            // Find SHORT elements containing "Order Total" text
            for (let elem of allElements) {
                const text = elem.textContent?.trim() || '';
                
                // Look for label with reasonable length (not a huge parent)
                if ((text.toLowerCase().includes('order total') || text.toLowerCase().includes('order total:')) && text.length < 100) {
                    console.log('Amazon: Found Order Total label element');
                    
                    // Check next 5 siblings for the price
                    let current = elem.nextElementSibling;
                    for (let i = 0; i < 5 && current; i++) {
                        const siblingText = (current.textContent || '').trim();
                        const match = siblingText.match(/₹\s*([0-9,]+(?:\.\d{1,2})?)/);
                        if (match) {
                            const amount = parseInt(match[1].replace(/,/g, ''));
                            if (this.isValidAmount(amount)) {
                                console.log('Amazon: Found Order Total amount:', amount);
                                return amount;
                            }
                        }
                        current = current.nextElementSibling;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding order total:', error);
            return null;
        }
    }

    detectPaymentPageTotal() {
        try {
            console.log('Detecting Amazon payment page total');
            
            // Strategy 1: Look for "Order Total" or similar label
            const labelAmount = this.findAmountByLabel('Order Total');
            if (labelAmount) {
                console.log('Found amount by label:', labelAmount);
                return labelAmount;
            }
            
            // Strategy 2: Look for "Total to pay" or "Amount to pay"
            const payAmount = this.findAmountByLabel('to pay');
            if (payAmount) {
                console.log('Found pay amount by label:', payAmount);
                return payAmount;
            }
            
            // Strategy 3: Use traditional selectors as fallback
            const paymentSelectors = [
                // Order summary - payment page style
                'div[data-component-type="s-result-card"] span',
                '[data-test-id*="order"]',
                '[data-test-id*="total"]',
                // Try finding in order summary boxes
                'span[class*="subtotal"]',
                'span[class*="total"]',
                'div[class*="Order-Summary"] span',
                // Payment method area
                'div[class*="a-accordion-row"] span.a-color-price',
                // Look for amount display in payment page
                'span.a-price-whole',
                'span.a-color-price',
                // Try data attributes
                '[data-price-whole]',
                // Last resort - any bold price
                'b.a-color-price'
            ];
            
            for (let selector of paymentSelectors) {
                const elements = document.querySelectorAll(selector);
                // On payment page, usually the last/largest price is the total
                for (let i = elements.length - 1; i >= 0; i--) {
                    const elem = elements[i];
                    if (this.isLikelyTotal(elem)) {
                        const amount = this.extractAmount(elem);
                        if (amount && this.isValidAmount(amount)) {
                            console.log('Found amount via selector:', amount);
                            return amount;
                        }
                    }
                }
            }
            
            // Strategy 4: Aggressive scan for any large price
            const allElements = document.querySelectorAll('*');
            let largestAmount = 0;
            let largestElem = null;
            
            for (let elem of allElements) {
                const text = elem.textContent.trim();
                if (/₹\s*\d+/.test(text) && elem.children.length === 0) {
                    const amount = this.extractAmount(elem);
                    if (amount && this.isValidAmount(amount)) {
                        // Check if near total-like labels
                        const parentText = (elem.parentElement?.textContent || '').toLowerCase();
                        const isNearLabel = /total|payable|amount|due|subtotal|final|order/i.test(parentText);
                        
                        if (amount > largestAmount) {
                            largestAmount = amount;
                            largestElem = elem;
                        }
                    }
                }
            }
            
            if (largestElem) {
                console.log('Found largest amount:', largestAmount);
                return largestAmount;
            }
            
            console.log('No payment page total found');
            return null;
        } catch (error) {
            console.error('Error detecting Amazon payment page total:', error);
            return null;
        }
    }

    findAmountByLabel(labelText) {
        try {
            const allElements = document.querySelectorAll('*');
            
            for (let elem of allElements) {
                const text = elem.textContent?.toLowerCase() || '';
                if (text.includes(labelText.toLowerCase())) {
                    // Found label, search nearby elements for price
                    
                    // Search next siblings
                    let current = elem;
                    for (let i = 0; i < 5; i++) {
                        current = current.nextElementSibling;
                        if (!current) break;
                        const amount = this.extractAmount(current.textContent);
                        if (amount && this.isValidAmount(amount)) return amount;
                    }
                    
                    // Search parent's next siblings
                    if (elem.parentElement) {
                        let parent = elem.parentElement;
                        for (let i = 0; i < 3; i++) {
                            parent = parent.nextElementSibling;
                            if (!parent) break;
                            const amount = this.extractAmount(parent.textContent);
                            if (amount && this.isValidAmount(amount)) return amount;
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error in findAmountByLabel:', error);
            return null;
        }
    }

    extractAmount(element) {
        try {
            // Null check before accessing textContent
            if (!element || !element.textContent) {
                return null;
            }
            let text = element.textContent.trim();
            
            // Remove "₹" and commas
            text = text.replace(/₹|,/g, '').trim();
            
            // Extract first number
            const match = text.match(/^\d+(\.\d{1,2})?/);
            if (match) {
                return parseInt(match[0]);
            }
        } catch (error) {
            console.error('Error extracting amount:', error);
        }
        return null;
    }

    isLikelyTotal(element) {
        const text = (element.textContent || '').trim();
        
        // Exclude small prices (likely product items, not totals)
        if (/^₹?\s*\d{1,2}(\.\d{1,2})?$/.test(text)) {
            return false;
        }
        
        // Check element visibility - hidden elements shouldn't count
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        
        // Check parent context - if it's clearly marked as total
        const parentText = element.parentElement?.textContent || '';
        const contextPatterns = [
            /total/i,
            /amount/i,
            /payable/i,
            /grand/i,
            /final/i,
            /balance/i
        ];
        
        const hasGoodContext = contextPatterns.some(p => p.test(parentText));
        
        // Price pattern matching
        const pricePatterns = [
            /^\d{3,6}(\.\d{1,2})?$/,    // Just numbers (3-6 digits)
            /Total/i,                    // Contains "Total"
            /^₹\s*\d+/,                  // Starts with rupee symbol
            /Order Total/i,              // Order total
            /Amount/i,                   // Amount
            /Grand Total/i,              // Grand total
            /Pay/i                       // Pay amount
        ];

        const isPriceFormat = pricePatterns.some(pattern => pattern.test(text));
        
        // Return true if it's a price format AND has good context OR matches strict patterns
        return isPriceFormat || hasGoodContext;
    }

    isValidAmount(amount) {
        // Valid amounts should be between ₹50 and ₹1,00,000
        return amount >= 50 && amount <= 100000;
    }

    notifyDonation(amount) {
        console.log('Amazon: notifyDonation called with amount:', amount);
        // Get settings from background script
        chrome.runtime.sendMessage({ action: 'getDonationSettings' }, (response) => {
            console.log('Amazon: Got settings:', response);
            if (!response?.selectedNGO) {
                console.log('Amazon: No NGO selected, skipping');
                return;
            }
            if (response.extensionEnabled === false) {
                console.log('Amazon: Extension disabled');
                return;
            }

            const roundedAmount = this.calculateRoundUp(amount, response.roundingRule);
            const donationAmount = roundedAmount - amount;
            console.log('Amazon: Rounding rule:', response.roundingRule, 'Amount:', amount, 'Rounded:', roundedAmount, 'Donation:', donationAmount);

            if (donationAmount >= 0) {
                // Trigger popup with donation data
                console.log('Amazon: Sending showDonationNotification message');
                chrome.runtime.sendMessage({
                    action: 'showDonationNotification',
                    data: {
                        originalAmount: amount,
                        roundedAmount: roundedAmount,
                        donationAmount: donationAmount,
                        website: 'amazon.in',
                        ngoId: response.selectedNGO.id,
                        ngoName: response.selectedNGO.name,
                        ngoUPI: response.selectedNGO.upiId,
                        ngoDescription: response.selectedNGO.description,
                        ngoLogo: response.selectedNGO.logo
                    }
                });
            }
        });
    }

    calculateRoundUp(amount, rule) {
        const ruleNum = parseInt(rule);
        const remainder = amount % ruleNum;
        return remainder === 0 ? amount : amount + (ruleNum - remainder);
    }
}

// Initialize detector
new AmazonCartDetector();
