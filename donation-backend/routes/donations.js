// Donation Routes - Record and manage donations

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const { Donation, TransactionLog } = require('../models');

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env');
} else {
    console.log('✅ Razorpay initialized with Key ID:', process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...');
}

// Debug Log: Check TransactionLog actions
console.log('📊 Allowed TransactionLog actions:', TransactionLog.schema.path('action').enumValues);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Record a new donation
router.post('/record', async (req, res) => {
    try {
        const {
            originalAmount,
            roundedAmount,
            donationAmount,
            ngoId,
            ngoName,
            website,
            timestamp
        } = req.body;

        // Validation
        if (!originalAmount || !roundedAmount || !donationAmount || !ngoId || !ngoName || !website) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const transactionId = `txn-${uuidv4()}`;

        // Create donation record
        const donation = new Donation({
            transactionId,
            ngoId,
            ngoName,
            originalAmount,
            roundedAmount,
            donationAmount,
            website,
            status: 'pending',
            timestamp: timestamp || new Date()
        });

        await donation.save();

        // Log transaction
        const log = new TransactionLog({
            transactionId,
            ngoId,
            donationAmount,
            action: 'initiated',
            details: {
                originalAmount,
                roundedAmount,
                website
            }
        });

        await log.save();

        console.log(`✓ Donation recorded: ${transactionId} - ₹${donationAmount} to ${ngoId}`);

        res.status(201).json({
            success: true,
            transactionId,
            donation
        });
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

// Create Razorpay payment link
router.post('/create-payment-link', async (req, res) => {
    try {
        const {
            originalAmount,
            roundedAmount,
            donationAmount,
            ngoId,
            ngoName,
            website
        } = req.body;

        // Validation
        if (!originalAmount || !roundedAmount || !donationAmount || !ngoId || !ngoName || !website) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const transactionId = `txn-${uuidv4()}`;

        // Create donation record in pending status
        const donation = new Donation({
            transactionId,
            ngoId,
            ngoName,
            originalAmount,
            roundedAmount,
            donationAmount,
            website,
            status: 'pending',
            timestamp: new Date()
        });

        await donation.save();

        // Create Razorpay Payment Link
        const paymentLinkRequest = {
            amount: Math.round(donationAmount * 100), // Razorpay expects amount in paise
            currency: "INR",
            accept_partial: false,
            description: `Donation to ${ngoName || 'NGO'} via RoundUp`,
            customer: {
                name: "RoundUp Donor",
                email: "donor@example.com",
                contact: "9876543210"
            },
            notify: {
                sms: false,
                email: false
            },
            reminder_enable: false,
            notes: {
                transactionId: transactionId,
                ngoId: ngoId,
                website: website
            },
            callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/donations/callback/${transactionId}`,
            callback_method: "get"
        };

        const paymentLink = await razorpay.paymentLink.create(paymentLinkRequest);

        // Update donation with Razorpay Pay Link ID
        donation.upiTransactionId = paymentLink.id; // Using this field temporarily or could add razorpayPaymentLinkId
        await donation.save();

        // Log transaction
        const log = new TransactionLog({
            transactionId,
            ngoId,
            donationAmount,
            action: 'payment_link_created',
            details: {
                paymentLinkId: paymentLink.id,
                paymentLinkUrl: paymentLink.short_url
            }
        });
        await log.save();

        console.log(`✓ Razorpay Payment Link created: ${paymentLink.id} for txn ${transactionId}`);

        res.status(201).json({
            success: true,
            transactionId,
            paymentLinkUrl: paymentLink.short_url
        });
    } catch (error) {
        console.error('Error creating Razorpay payment link:', error);
        res.status(500).json({ error: 'Failed to create payment link', details: error.message });
    }
});

// Razorpay Callback - Handles redirection after payment (Test environment simulation)
router.get('/callback/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { razorpay_payment_id, razorpay_payment_link_status } = req.query;

        console.log(`Callback received for ${transactionId}: status=${razorpay_payment_link_status}`);

        // Add headers to help with Local Network Access issues in Chrome
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        // In a real app, you'd verify the signature here. 
        // For test env, we'll update based on status.
        
        let status = 'pending';
        if (razorpay_payment_link_status === 'paid') {
            status = 'completed';
        } else if (razorpay_payment_link_status === 'cancelled' || razorpay_payment_link_status === 'expired') {
            status = 'failed';
        }

        if (status !== 'pending') {
            await Donation.findOneAndUpdate(
                { transactionId },
                { status, upiTransactionId: razorpay_payment_id }
            );

            await new TransactionLog({
                transactionId,
                action: status,
                details: { razorpay_payment_id }
            }).save();
        }

        // Redirect to a premium success/failure page
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RoundUp - Donation Status</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #f0f2f5;
                        color: #1a1a1a;
                    }
                    .card {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                        text-align: center;
                        max-width: 400px;
                        width: 90%;
                        animation: slideUp 0.5s ease-out;
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .icon {
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 24px;
                        font-size: 40px;
                    }
                    .success-icon {
                        background: #e8f5e9;
                        color: #2e7d32;
                    }
                    .error-icon {
                        background: #ffebee;
                        color: #c62828;
                    }
                    h1 {
                        margin: 0 0 16px;
                        font-size: 24px;
                        font-weight: 700;
                    }
                    p {
                        margin: 0 0 32px;
                        color: #666;
                        line-height: 1.5;
                        font-size: 16px;
                    }
                    .btn {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 14px 28px;
                        border-radius: 12px;
                        text-decoration: none;
                        font-weight: 600;
                        transition: all 0.2s;
                        border: none;
                        cursor: pointer;
                        font-size: 16px;
                        width: 100%;
                    }
                    .btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 15px -3px rgba(102, 126, 234, 0.3);
                    }
                    .success-text { color: #2e7d32; }
                    .error-text { color: #d32f2f; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon ${status === 'completed' ? 'success-icon' : 'error-icon'}">
                        ${status === 'completed' ? 'Success' : 'Alert'}
                    </div>
                    <h1 class="${status === 'completed' ? 'success-text' : 'error-text'}">
                        ${status === 'completed' ? 'Thank You!' : 'Payment ' + status}
                    </h1>
                    <p>
                        ${status === 'completed' 
                            ? 'Your contribution makes a real difference. We have recorded your donation.' 
                            : 'There was an issue processing your payment. Please try again or contact support.'}
                    </p>
                    <button onclick="closePopup()" class="btn">Close Window</button>
                    <script>
                        function closePopup() {
                            if (window.parent) {
                                window.parent.postMessage('payment-success', '*');
                            }
                        }
                        // Auto-close after 5 seconds if successful
                        if ("${status}" === "completed") {
                            setTimeout(() => {
                                // In some browsers window.close() only works if opened by script
                                // For the extension popup, the user can just see it and close.
                            }, 5000);
                        }
                    </script>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error in Razorpay callback:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get recent donations
router.get('/recent', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const donations = await Donation.find()
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .select('-__v');

        res.json(donations);
    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Get donation history
router.get('/history', async (req, res) => {
    try {
        const donations = await Donation.find()
            .sort({ timestamp: -1 })
            .select('-__v');

        res.json(donations);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get donation by transaction ID
router.get('/:transactionId', async (req, res) => {
    try {
        const donation = await Donation.findOne({ transactionId: req.params.transactionId });

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        res.json(donation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch donation' });
    }
});

// Update donation status
router.patch('/:transactionId/status', async (req, res) => {
    try {
        const { status, upiTransactionId } = req.body;

        if (!['pending', 'completed', 'failed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const donation = await Donation.findOneAndUpdate(
            { transactionId: req.params.transactionId },
            { 
                status,
                upiTransactionId: upiTransactionId || undefined
            },
            { new: true }
        );

        if (!donation) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        // Log status update
        const log = new TransactionLog({
            transactionId: req.params.transactionId,
            ngoId: donation.ngoId,
            donationAmount: donation.donationAmount,
            action: status === 'completed' ? 'completed' : 'failed',
            details: { upiTransactionId }
        });

        await log.save();

        console.log(`✓ Donation ${req.params.transactionId} status updated to ${status}`);

        res.json(donation);
    } catch (error) {
        console.error('Error updating donation:', error);
        res.status(500).json({ error: 'Failed to update donation' });
    }
});

// Get statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const totalDonations = await Donation.countDocuments();
        const totalAmount = await Donation.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$donationAmount' } } }
        ]);

        const byNGO = await Donation.aggregate([
            { $match: { status: 'completed' } },
            { $group: { 
                _id: '$ngoId', 
                count: { $sum: 1 },
                total: { $sum: '$donationAmount' }
            }}
        ]);

        const byWebsite = await Donation.aggregate([
            { $match: { status: 'completed' } },
            { $group: { 
                _id: '$website', 
                count: { $sum: 1 },
                total: { $sum: '$donationAmount' }
            }}
        ]);

        res.json({
            totalDonations,
            totalAmount: totalAmount[0]?.total || 0,
            byNGO,
            byWebsite
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Clear history (for testing)
router.post('/clear', async (req, res) => {
    try {
        await Donation.deleteMany({});
        await TransactionLog.deleteMany({});
        res.json({ message: 'All donation records cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

module.exports = router;
