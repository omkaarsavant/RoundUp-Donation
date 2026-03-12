// Donation Routes - Record and manage donations

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Donation, TransactionLog } = require('../models');

// Record a new donation
router.post('/record', async (req, res) => {
    try {
        const {
            originalAmount,
            roundedAmount,
            donationAmount,
            ngoId,
            website,
            timestamp
        } = req.body;

        // Validation
        if (!originalAmount || !roundedAmount || !donationAmount || !ngoId || !website) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const transactionId = `txn-${uuidv4()}`;

        // Create donation record
        const donation = new Donation({
            transactionId,
            ngoId,
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
