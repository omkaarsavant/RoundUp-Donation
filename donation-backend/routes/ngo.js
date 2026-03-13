// NGO Routes - Manage NGOs

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

// Helper to map DB to frontend format (camelCase)
const mapToFrontend = (ngo) => {
    if (!ngo) return ngo;
    return {
        ...ngo,
        id: ngo.id || ngo.ngo_id,
        upiId: ngo.upi_id || ngo.upiId
    };
};

// Get all NGOs
router.get('/', async (req, res) => {
    try {
        const { location } = req.query;
        const db = getDB();
        
        // Note: Firestore doesn't have a direct case-insensitive 'ilike' query. 
        // For a simple implementation without a full text search engine, we'll
        // fetch all and filter in memory, or just return them if no location is passed.
        const ngosSnapshot = await db.collection('ngos').get();
        let ngos = [];

        ngosSnapshot.forEach(doc => {
            ngos.push({ id: doc.id, ...doc.data() });
        });

        if (location) {
            const lowerQuery = location.toLowerCase();
            ngos = ngos.filter(ngo => 
                (ngo.location && ngo.location.toLowerCase().includes(lowerQuery)) ||
                (ngo.category && ngo.category.toLowerCase().includes(lowerQuery)) ||
                (ngo.description && ngo.description.toLowerCase().includes(lowerQuery))
            );
        }

        // Return found NGOs

        res.json(ngos.map(mapToFrontend));
    } catch (error) {
        console.error('Error fetching NGOs:', error);
        res.status(500).json({ error: 'Failed to fetch NGOs' });
    }
});

// Get specific NGO
router.get('/:id', async (req, res) => {
    try {
        const db = getDB();
        const doc = await db.collection('ngos').doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json(mapToFrontend({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching specific NGO:', error);
        res.status(500).json({ error: 'Failed to fetch NGO' });
    }
});

// Create NGO (Admin only in production)
router.post('/', async (req, res) => {
    try {
        const { name, description, upiId, logo, category, website, phone, location } = req.body;

        if (!name || !upiId || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = getDB();
        const newNgoId = `ngo-${uuidv4().slice(0, 8)}`;
        
        const newNgo = {
            ngo_id: newNgoId, // keep for compatibility if needed, though doc.id is better
            name,
            description,
            upi_id: upiId,
            logo: logo || 'https://via.placeholder.com/100',
            category: category || 'other',
            website: website || '',
            phone: phone || '',
            location: location || 'Nashik',
            created_at: new Date()
        };

        const docRef = db.collection('ngos').doc(newNgoId);
        await docRef.set(newNgo);

        res.status(201).json(mapToFrontend({ id: newNgoId, ...newNgo }));
    } catch (error) {
        console.error('Error creating NGO:', error);
        res.status(500).json({ error: 'Failed to create NGO' });
    }
});

// Update NGO
router.put('/:id', async (req, res) => {
    try {
        const db = getDB();
        const docRef = db.collection('ngos').doc(req.params.id);
        
        const updates = { ...req.body, updated_at: new Date() };
        if (updates.upiId) {
            updates.upi_id = updates.upiId;
            delete updates.upiId;
        }
        delete updates.id; // don't try to update id

        await docRef.update(updates);

        const updatedDoc = await docRef.get();
        if (!updatedDoc.exists) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json(mapToFrontend({ id: updatedDoc.id, ...updatedDoc.data() }));
    } catch (error) {
        console.error('Error updating NGO:', error);
        res.status(500).json({ error: 'Failed to update NGO' });
    }
});

// Delete NGO
router.delete('/:id', async (req, res) => {
    try {
        const db = getDB();
        const docRef = db.collection('ngos').doc(req.params.id);
        
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        await docRef.delete();

        res.json({ message: 'NGO deleted successfully' });
    } catch (error) {
        console.error('Error deleting NGO:', error);
        res.status(500).json({ error: 'Failed to delete NGO' });
    }
});

module.exports = router;
