// User Routes - Manage user preferences and settings

const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Helper to map DB snake_case to frontend camelCase
const mapProfileToFrontend = (p) => {
    if (!p) return p;
    return {
        userId: p.id,
        email: p.email,
        selectedNGO: p.selected_ngo_id,
        roundingRule: p.rounding_rule,
        extensionEnabled: p.extension_enabled,
        totalDonated: parseFloat(p.total_donated || 0),
        donationCount: parseInt(p.donation_count || 0),
        lastActive: p.last_active ? (p.last_active.toDate ? p.last_active.toDate() : p.last_active) : null
    };
};

// Get user profile (Protected route, uses Firebase ID Token)
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid; // Firebase uses uid

        // Fetch profile
        const profileRef = db.collection('profiles').doc(userId);
        const doc = await profileRef.get();
        
        let profile = {};
        if (doc.exists) {
            profile = { id: doc.id, ...doc.data() };
            
            // Update last_active silently
            await profileRef.update({ last_active: new Date() });
        } else {
            // Create a default profile if it doesn't exist
            profile = {
                id: userId,
                email: req.user.email,
                selected_ngo_id: null,
                rounding_rule: '5', // Default
                extension_enabled: true,
                total_donated: 0,
                donation_count: 0,
                last_active: new Date(),
                created_at: new Date()
            };
            await profileRef.set(profile);
        }

        res.json(mapProfileToFrontend(profile));
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Update user preferences (Protected)
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { selectedNGO, roundingRule, extensionEnabled } = req.body;
        const db = getDB();
        const userId = req.user.uid;

        const updates = { last_active: new Date() };
        if (selectedNGO !== undefined) updates.selected_ngo_id = selectedNGO;
        if (roundingRule !== undefined) updates.rounding_rule = roundingRule;
        if (extensionEnabled !== undefined) updates.extension_enabled = extensionEnabled;

        const profileRef = db.collection('profiles').doc(userId);
        await profileRef.set(updates, { merge: true }); // Use set with merge in case doc doesn't exist

        const updatedDoc = await profileRef.get();
        if (!updatedDoc.exists) {
             return res.status(500).json({ error: 'Failed to update profile' });
        }
        
        const profile = { id: updatedDoc.id, ...updatedDoc.data() };

        res.json(mapProfileToFrontend(profile));
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});

// Get user donation stats (Protected)
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.uid;

        const donationsSnapshot = await db.collection('donations')
            .where('user_id', '==', userId)
            .get();

        const donations = [];
        donationsSnapshot.forEach(doc => {
            donations.push({ id: doc.id, ...doc.data() });
        });

        const completed = donations.filter(d => d.status === 'completed');
        const totalDonated = completed.reduce((sum, d) => sum + parseFloat(d.donation_amount || 0), 0);

        const byNGO = {};
        donations.forEach(d => {
            if (!byNGO[d.ngo_id]) byNGO[d.ngo_id] = { count: 0, total: 0 };
            if (d.status === 'completed') {
                byNGO[d.ngo_id].count++;
                byNGO[d.ngo_id].total += parseFloat(d.donation_amount || 0);
            }
        });

        res.json({
            totalDonations: donations.length,
            completedDonations: completed.length,
            totalDonated,
            byNGO
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
