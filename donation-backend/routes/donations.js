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
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
                <style>
                    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Inter', sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #F9F8F6;
                        color: #1A1A1A;
                    }
                    .card {
                        background: transparent;
                        border-top: 2px solid ${status === 'completed' ? '#D4AF37' : '#1A1A1A'};
                        padding: 4rem 3rem;
                        text-align: center;
                        max-width: 440px;
                        width: 90%;
                        animation: revealUp 700ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                    }
                    @keyframes revealUp {
                        from { opacity: 0; transform: translateY(24px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .status-label {
                        display: block;
                        font-family: 'Inter', sans-serif;
                        font-size: 10px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.25em;
                        color: #6C6863;
                        margin-bottom: 1.5rem;
                    }
                    h1 {
                        font-family: 'Playfair Display', serif;
                        font-size: 2.5rem;
                        font-weight: 400;
                        line-height: 1;
                        margin-bottom: 1.25rem;
                        color: #1A1A1A;
                    }
                    h1 em { font-style: italic; color: #D4AF37; }
                    p {
                        margin: 0 0 2.5rem;
                        color: #6C6863;
                        line-height: 1.625;
                        font-size: 0.9375rem;
                    }
                    .btn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        height: 3rem;
                        padding: 0 2.5rem;
                        background: #1A1A1A;
                        color: #F9F8F6;
                        font-family: 'Inter', sans-serif;
                        font-size: 10px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.2em;
                        border: none;
                        border-radius: 0;
                        cursor: pointer;
                        transition: all 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
                        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                    }
                    .btn:hover {
                        background: #D4AF37;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <span class="status-label">${status === 'completed' ? 'Donation Confirmed' : 'Payment ' + status}</span>
                    <h1>${status === 'completed' ? 'Thank <em>You</em>' : 'Payment <em>' + status + '</em>'}</h1>
                    <p>
                        ${status === 'completed' 
                            ? 'Your contribution has been received and recorded. Every round-up creates lasting impact.' 
                            : 'There was an issue processing your payment. Please try again or contact support.'}
                    </p>
                    <button onclick="closePopup()" class="btn">Close</button>
                    <script>
                        function closePopup() {
                            if (window.parent) {
                                window.parent.postMessage('payment-success', '*');
                            }
                        }
                        if ("${status}" === "completed") {
                            setTimeout(() => {}, 5000);
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
