// User Routes - Manage user preferences and settings

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { User, Donation } = require('../models');

// Get or create user
router.get('/:userId', async (req, res) => {
    try {
        let user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            // Create new user
            user = new User({
                userId: req.params.userId
            });
            await user.save();
        }

        // Update last active
        user.lastActive = new Date();
        await user.save();

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user preferences
router.put('/:userId', async (req, res) => {
    try {
        const { selectedNGO, roundingRule, extensionEnabled } = req.body;

        let user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            user = new User({ userId: req.params.userId });
        }

        if (selectedNGO) user.selectedNGO = selectedNGO;
        if (roundingRule) user.roundingRule = roundingRule;
        if (extensionEnabled !== undefined) user.extensionEnabled = extensionEnabled;

        user.lastActive = new Date();
        await user.save();

        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Get user donation stats
router.get('/:userId/stats', async (req, res) => {
    try {
        const donations = await Donation.find({ userId: req.params.userId });

        const totalDonated = donations
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + d.donationAmount, 0);

        const byNGO = {};
        donations.forEach(d => {
            if (!byNGO[d.ngoId]) {
                byNGO[d.ngoId] = { count: 0, total: 0 };
            }
            if (d.status === 'completed') {
                byNGO[d.ngoId].count++;
                byNGO[d.ngoId].total += d.donationAmount;
            }
        });

        res.json({
            totalDonations: donations.length,
            completedDonations: donations.filter(d => d.status === 'completed').length,
            totalDonated,
            byNGO
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
