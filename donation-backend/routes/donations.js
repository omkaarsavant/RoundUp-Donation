// Donation Routes - Record and manage donations

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in .env');
} else {
    console.log('✅ Razorpay initialized with Key ID:', process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...');
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Helper to map DB to frontend camelCase
const mapDonationToFrontend = (d) => {
    if (!d) return d;
    return {
        ...d,
        transactionId: d.transaction_id || d.transactionId,
        userId: d.user_id || d.userId,
        ngoId: d.ngo_id || d.ngoId,
        ngoName: d.ngo_name || d.ngoName,
        originalAmount: parseFloat(d.original_amount || d.originalAmount || 0),
        roundedAmount: parseFloat(d.rounded_amount || d.roundedAmount || 0),
        donationAmount: parseFloat(d.donation_amount || d.donationAmount || 0),
        upiTransactionId: d.upi_transaction_id || d.upiTransactionId,
        timestamp: d.timestamp && typeof d.timestamp.toDate === 'function' ? d.timestamp.toDate().toISOString() : d.timestamp
    };
};

// Record a new donation (protected)
router.post('/record', requireAuth, async (req, res) => {
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

        const db = getDB();
        const transactionId = `txn-${uuidv4()}`;
        const userId = req.user.uid;

        const newDonation = {
            transaction_id: transactionId,
            user_id: userId,
            ngo_id: ngoId,
            ngo_name: ngoName,
            original_amount: originalAmount,
            rounded_amount: roundedAmount,
            donation_amount: donationAmount,
            website,
            status: 'pending',
            timestamp: timestamp ? new Date(timestamp) : new Date()
        };

        const docRef = db.collection('donations').doc(transactionId);
        await docRef.set(newDonation);

        const newLog = {
            transaction_id: transactionId,
            user_id: userId || null,
            ngo_id: ngoId,
            donation_amount: donationAmount,
            action: 'initiated',
            details: {
                originalAmount,
                roundedAmount,
                website
            },
            timestamp: new Date()
        };

        await db.collection('transaction_logs').add(newLog);

        console.log(`✓ Donation recorded: ${transactionId} - ₹${donationAmount} to ${ngoId}`);

        res.status(201).json({
            success: true,
            transactionId,
            donation: mapDonationToFrontend(newDonation)
        });
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

// Create Razorpay payment link (protected)
router.post('/create-payment-link', requireAuth, async (req, res) => {
    try {
        const {
            originalAmount,
            roundedAmount,
            donationAmount,
            ngoId,
            ngoName,
            website
        } = req.body;
        
        const userId = req.user.uid; // Get from decoded token

        if (!originalAmount || !roundedAmount || !donationAmount || !ngoId || !ngoName || !website) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = getDB();
        const transactionId = `txn-${uuidv4()}`;

        const newDonation = {
            transaction_id: transactionId,
            user_id: userId || null,
            ngo_id: ngoId,
            ngo_name: ngoName,
            original_amount: originalAmount,
            rounded_amount: roundedAmount,
            donation_amount: donationAmount,
            website,
            status: 'pending',
            timestamp: new Date()
        };

        const docRef = db.collection('donations').doc(transactionId);
        await docRef.set(newDonation);

        // Create Razorpay Payment Link
        const paymentLinkRequest = {
            amount: Math.round(donationAmount * 100),
            currency: "INR",
            accept_partial: false,
            description: `Donation to ${ngoName || 'NGO'} via RoundUp`,
            customer: {
                name: "RoundUp Donor",
                email: "donor@example.com",
                contact: "9876543210"
            },
            notify: { sms: false, email: false },
            reminder_enable: false,
            notes: {
                transactionId,
                ngoId,
                website
            },
            callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/donations/callback/${transactionId}`,
            callback_method: "get"
        };

        const paymentLink = await razorpay.paymentLink.create(paymentLinkRequest);

        // Update donation
        await docRef.update({ upi_transaction_id: paymentLink.id });

        // Log transaction
        await db.collection('transaction_logs').add({
            transaction_id: transactionId,
            user_id: userId || null,
            ngo_id: ngoId,
            donation_amount: donationAmount,
            action: 'payment_link_created',
            details: { paymentLinkId: paymentLink.id, paymentLinkUrl: paymentLink.short_url },
            timestamp: new Date()
        });

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

// Razorpay Callback
router.get('/callback/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { razorpay_payment_id, razorpay_payment_link_status } = req.query;
        const db = getDB();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        let status = 'pending';
        if (razorpay_payment_link_status === 'paid') {
            status = 'completed';
        } else if (razorpay_payment_link_status === 'cancelled' || razorpay_payment_link_status === 'expired') {
            status = 'failed';
        }

        if (status !== 'pending') {
            const docRef = db.collection('donations').doc(transactionId);
            await docRef.update({ 
                status, 
                upi_transaction_id: razorpay_payment_id 
            });

            await db.collection('transaction_logs').add({
                transaction_id: transactionId,
                action: status,
                details: { razorpay_payment_id },
                timestamp: new Date()
            });
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RoundUp - Donation Status</title>
                <style>
                    body { font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F9F8F6; color: #1A1A1A; }
                    .card { background: transparent; border-top: 2px solid ${status === 'completed' ? '#D4AF37' : '#1A1A1A'}; padding: 4rem 3rem; text-align: center; max-width: 440px; width: 90%; }
                    h1 { font-family: 'Playfair Display', serif; font-size: 2.5rem; }
                    h1 em { font-style: italic; color: #D4AF37; }
                    .btn { background: #1A1A1A; color: #F9F8F6; padding: 1rem 2.5rem; text-transform: uppercase; letter-spacing: 0.2em; border: none; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>${status === 'completed' ? 'Thank <em>You</em>' : 'Payment <em>' + status + '</em>'}</h1>
                    <p>${status === 'completed' ? 'Your contribution has been received.' : 'There was an issue processing your payment.'}</p>
                    <button onclick="closePopup()" class="btn">Close</button>
                    <script>
                        function closePopup() { if (window.parent) window.parent.postMessage('payment-success', '*'); }
                    </script>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error in callback:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get recent donations
router.get('/recent', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const db = getDB();
        const userId = req.user.uid;
        
        const snapshot = await db.collection('donations')
            .where('user_id', '==', userId)
            .get();

        const donations = [];
        snapshot.forEach(doc => {
            donations.push({ id: doc.id, ...doc.data() });
        });

        // Sort in memory to avoid needing a composite index
        donations.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return timeB - timeA;
        });

        res.json(donations.slice(0, limit).map(mapDonationToFrontend));
    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Get donation history
router.get('/history', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid;
        
        const snapshot = await db.collection('donations')
            .where('user_id', '==', userId)
            .get();
            
        const donations = [];
        snapshot.forEach(doc => {
            donations.push({ id: doc.id, ...doc.data() });
        });

        // Sort in memory to avoid needing a composite index
        donations.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return timeB - timeA;
        });

        res.json(donations.map(mapDonationToFrontend));
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get donation by transaction ID (protected)
router.get('/:transactionId', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid;
        const doc = await db.collection('donations').doc(req.params.transactionId).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        const donation = doc.data();
        if (donation.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        res.json(mapDonationToFrontend({ id: doc.id, ...donation }));
    } catch (error) {
        console.error('Error fetching donation:', error);
        res.status(500).json({ error: 'Failed to fetch donation' });
    }
});

// Update donation status (protected)
router.patch('/:transactionId/status', requireAuth, async (req, res) => {
    try {
        const { status, upiTransactionId } = req.body;
        const userId = req.user.uid;
        if (!['pending', 'completed', 'failed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const db = getDB();
        const docRef = db.collection('donations').doc(req.params.transactionId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Donation not found' });
        }

        const donationData = doc.data();
        if (donationData.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        await docRef.update({ 
            status, 
            upi_transaction_id: upiTransactionId || null 
        });

        const updatedDoc = await docRef.get();
        const finalData = updatedDoc.data();

        await db.collection('transaction_logs').add({
            transaction_id: req.params.transactionId,
            user_id: userId,
            ngo_id: finalData.ngo_id,
            donation_amount: finalData.donation_amount,
            action: status === 'completed' ? 'completed' : 'failed',
            details: { upiTransactionId },
            timestamp: new Date()
        });

        res.json(mapDonationToFrontend({ id: updatedDoc.id, ...finalData }));
    } catch (error) {
        console.error('Error updating donation:', error);
        res.status(500).json({ error: 'Failed to update donation' });
    }
});

// Get statistics
router.get('/stats/summary', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid;
        
        const snapshot = await db.collection('donations')
            .where('user_id', '==', userId)
            .get();
            
        const donations = [];
        snapshot.forEach(doc => {
            donations.push({ id: doc.id, ...doc.data() });
        });

        const completed = donations.filter(d => d.status === 'completed');
        const totalAmount = completed.reduce((sum, d) => sum + parseFloat(d.donation_amount || 0), 0);

        const byNGO = {};
        const byWebsite = {};

        completed.forEach(d => {
            if (!byNGO[d.ngo_id]) byNGO[d.ngo_id] = { count: 0, total: 0 };
            byNGO[d.ngo_id].count++;
            byNGO[d.ngo_id].total += parseFloat(d.donation_amount || 0);

            if (d.website) {
                if (!byWebsite[d.website]) byWebsite[d.website] = { count: 0, total: 0 };
                byWebsite[d.website].count++;
                byWebsite[d.website].total += parseFloat(d.donation_amount || 0);
            }
        });

        // Map back to expected output format
        const byNgoArray = Object.keys(byNGO).map(k => ({ _id: k, count: byNGO[k].count, total: byNGO[k].total }));
        const byWebsiteArray = Object.keys(byWebsite).map(k => ({ _id: k, count: byWebsite[k].count, total: byWebsite[k].total }));

        res.json({
            totalDonations: donations.length,
            totalAmount,
            byNGO: byNgoArray,
            byWebsite: byWebsiteArray
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Clear history (for testing)
router.post('/clear', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid;
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID missing' });
        }

        const batch = db.batch();
        let opsCount = 0;

        const donationsSnapshot = await db.collection('donations')
            .where('user_id', '==', userId)
            .get();
            
        donationsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            opsCount++;
        });

        const logsSnapshot = await db.collection('transaction_logs')
            .where('user_id', '==', userId)
            .get();
            
        logsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            opsCount++;
        });

        if (opsCount > 0) {
            await batch.commit();
        }
        
        console.log(`✓ History cleared for UID: ${userId} (${opsCount} records)`);
        res.json({ success: true, message: 'History cleared successfully' });
    } catch (error) {
        console.error('Error clearing history:', error);
        res.status(500).json({ 
            error: 'Failed to clear history', 
            details: error.message
        });
    }
});

module.exports = router;
