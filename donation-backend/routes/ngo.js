// NGO Routes - Manage NGOs

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { NGO } = require('../models');

// Get all NGOs
router.get('/', async (req, res) => {
    try {
        const ngos = await NGO.find().select('-__v');

        // If no NGOs in database, return sample data
        if (ngos.length === 0) {
            const sampleNGOs = [
                {
                    id: 'ngo-001',
                    name: 'Teach India Foundation',
                    description: 'Providing quality education to underprivileged children',
                    upiId: 'teachindia@upi',
                    logo: 'https://via.placeholder.com/100?text=Teach+India',
                    category: 'education',
                    website: 'https://teachindia.org'
                },
                {
                    id: 'ngo-002',
                    name: 'Doctors Without Borders',
                    description: 'Medical aid to communities in need',
                    upiId: 'dwb.india@upi',
                    logo: 'https://via.placeholder.com/100?text=DWB',
                    category: 'health',
                    website: 'https://msf.org'
                },
                {
                    id: 'ngo-003',
                    name: 'Clean Environment India',
                    description: 'Working towards a cleaner, greener India',
                    upiId: 'cleanenv@upi',
                    logo: 'https://via.placeholder.com/100?text=Clean+Env',
                    category: 'environment',
                    website: 'https://cleanindia.org'
                },
                {
                    id: 'ngo-004',
                    name: 'Hope for Children',
                    description: 'Supporting underprivileged children\'s welfare',
                    upiId: 'hopechildren@upi',
                    logo: 'https://via.placeholder.com/100?text=Hope',
                    category: 'poverty',
                    website: 'https://hopechildren.org'
                },
                {
                    id: 'ngo-005',
                    name: 'Disaster Relief Network',
                    description: 'Emergency aid for disaster-affected communities',
                    upiId: 'drn.india@upi',
                    logo: 'https://via.placeholder.com/100?text=DRN',
                    category: 'disaster',
                    website: 'https://disasterrelief.org'
                }
            ];

            return res.json(sampleNGOs);
        }

        res.json(ngos);
    } catch (error) {
        console.error('Error fetching NGOs:', error);
        res.status(500).json({ error: 'Failed to fetch NGOs' });
    }
});

// Get specific NGO
router.get('/:id', async (req, res) => {
    try {
        const ngo = await NGO.findOne({ id: req.params.id });

        if (!ngo) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json(ngo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch NGO' });
    }
});

// Create NGO (Admin only in production)
router.post('/', async (req, res) => {
    try {
        const { name, description, upiId, logo, category, website } = req.body;

        // Validation
        if (!name || !upiId || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const ngo = new NGO({
            id: `ngo-${uuidv4().slice(0, 8)}`,
            name,
            description,
            upiId,
            logo: logo || 'https://via.placeholder.com/100',
            category: category || 'other',
            website: website || ''
        });

        await ngo.save();
        res.status(201).json(ngo);
    } catch (error) {
        console.error('Error creating NGO:', error);
        res.status(500).json({ error: 'Failed to create NGO' });
    }
});

// Update NGO
router.put('/:id', async (req, res) => {
    try {
        const ngo = await NGO.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );

        if (!ngo) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json(ngo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update NGO' });
    }
});

// Delete NGO
router.delete('/:id', async (req, res) => {
    try {
        const ngo = await NGO.findOneAndDelete({ id: req.params.id });

        if (!ngo) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json({ message: 'NGO deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete NGO' });
    }
});

module.exports = router;
