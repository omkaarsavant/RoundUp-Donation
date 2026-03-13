// Settings Page Script

const API_BASE_URL = 'http://localhost:5000/api';
let currentSession = null;

// Helper to get absolute logo URL
function getLogoUrl(path) {
    if (!path) return 'icons/default-ngo.png';
    if (path.startsWith('http')) return path;
    // Remove /api from the end of the base URL to get the root
    const root = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
    const url = `${root}/${path}`;
    console.log(`[DEBUG] Final Logo URL for ${path}: ${url}`);
    return url;
}

document.addEventListener('DOMContentLoaded', async () => {

    // Auth elements
    const authNotice = document.getElementById('authNotice');
    const appSettings = document.getElementById('appSettings');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    // Form elements
    const locationModes = document.querySelectorAll('input[name="locationMode"]');
    const citySelectorGroup = document.getElementById('citySelectorGroup');
    const citySelect = document.getElementById('citySelect');
    const detectedCityName = document.getElementById('detectedCityName');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const historyPreview = document.getElementById('historyPreview');
    const historyTable = document.getElementById('historyTable');

    // Handle clicks on receipt buttons (Event Delegation)
    const handleReceiptClick = (e) => {
        const btn = e.target.closest('.download-receipt-btn');
        if (btn) {
            const txnId = btn.dataset.txnId;
            if (txnId) downloadReceipt(txnId);
        }
    };

    historyPreview.addEventListener('click', handleReceiptClick);
    historyTable.addEventListener('click', handleReceiptClick);

    // Initial load Flow
    await checkAuthStatus();

    // -- AUTH FLOW -- //
    function checkAuthStatus() {
        chrome.runtime.sendMessage({ action: 'getSession' }, async (response) => {
            if (response && response.session) {
                currentSession = response.session;
                userEmailDisplay.textContent = `Signed in as: ${currentSession.user.email}`;
                authNotice.classList.add('hidden');
                appSettings.classList.remove('hidden');
                initializeApp();
            } else {
                authNotice.classList.remove('hidden');
                appSettings.classList.add('hidden');
            }
        });
    }

    window.getAuthToken = async function () {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'getAuthToken' }, obj => resolve(obj?.token));
        });
    };

    // -- APP FLOW -- //
    async function initializeApp() {

        // Try to fetch profile from backend to sync settings
        try {
            const profileRes = await fetch(`${API_BASE_URL}/users/profile`, {
                headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
            });
            if (profileRes.ok) {
                const profile = await profileRes.json();
                if (profile.selectedNGO) {
                    // Sync backend NGO selection to local storage if it exists
                    // We need to fetch the full NGO object from the list to store it correctly
                    const ngosRes = await fetch(`${API_BASE_URL}/ngos`, {
                        headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
                    });
                    const ngos = await ngosRes.json();
                    const matchedNgo = ngos.find(n => n.id === profile.selectedNGO);
                    if (matchedNgo) {
                        await new Promise(r => chrome.storage.sync.set({ selectedNGO: matchedNgo }, r));
                    }
                }
            }
        } catch (e) {
            console.error('Failed to sync backend profile:', e);
        }

        // Load saved settings from sync storage (now synchronized with backend)
        chrome.storage.sync.get(['extensionEnabled', 'locationMode', 'selectedCity', 'selectedNGO'], async (result) => {

            const locationMode = result.locationMode || 'auto';
            document.querySelector(`input[name="locationMode"][value="${locationMode}"]`).checked = true;

            if (locationMode === 'select') {
                citySelectorGroup.classList.remove('hidden');
                if (result.selectedCity) {
                    citySelect.value = result.selectedCity;
                }
            }

            // Initialize based on mode
            if (locationMode === 'auto') {
                await autoDetectLocation();
            } else {
                await loadNGOs(citySelect.value);
            }
        });

        // Load donation history
        await loadDonationHistory();
    }

    // Handle Location Mode changes
    locationModes.forEach(mode => {
        mode.addEventListener('change', async (e) => {
            if (e.target.value === 'select') {
                citySelectorGroup.classList.remove('hidden');
                await loadNGOs(citySelect.value);
            } else {
                citySelectorGroup.classList.add('hidden');
                await autoDetectLocation();
            }
        });
    });

    // Handle City changes
    citySelect.addEventListener('change', async (e) => {
        await loadNGOs(e.target.value);
    });

    async function autoDetectLocation() {
        detectedCityName.textContent = 'Detecting...';
        // Mock auto-detection (in reality would use a geo-IP service or Geolocation API)
        setTimeout(async () => {
            const city = 'Nashik';
            detectedCityName.textContent = city;
            await loadNGOs(city);
        }, 1000);
    }


    // NGO Modal elements
    const ngoModal = document.getElementById('ngoModal');
    const ngoModalDetail = document.getElementById('ngoModalDetail');

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ngoModal) ngoModal.classList.add('hidden');
        if (e.target === document.getElementById('historyModal')) closeHistoryModal();
    });

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const result = await chrome.storage.sync.get(['selectedNGO']);
        const selectedNGO = result.selectedNGO;

        if (!selectedNGO) {
            status.textContent = 'Please select an NGO from the list below';
            status.style.color = '#D4AF37';
            return;
        }

        const locationMode = document.querySelector('input[name="locationMode"]:checked').value;
        const selectedCity = citySelect.value;

        try {
            // Save to backend profile
            const response = await fetch(`${API_BASE_URL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await window.getAuthToken()}`
                },
                body: JSON.stringify({
                    selectedNGO: selectedNGO.id
                })
            });

            if (!response.ok) throw new Error('Failed to update backend profile');

            // Save to chrome storage
            chrome.storage.sync.set({
                locationMode: locationMode,
                selectedCity: selectedCity,
                // selectedNGO object is already in sync storage from selectNGO()
            }, () => {
                status.textContent = 'Settings saved successfully';
                status.style.color = '#1A1A1A';
                setTimeout(() => {
                    status.textContent = '';
                }, 3000);
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            status.textContent = 'Failed to save settings to server';
            status.style.color = '#D32F2F';
        }
    });

    // History modal controls
    document.getElementById('viewHistory').addEventListener('click', openHistoryModal);
    document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
    document.getElementById('exportHistory').addEventListener('click', exportHistoryCSV);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
});

async function loadNGOs(location = '') {
    const ngoList = document.getElementById('ngoList');
    if (!ngoList) return;
    ngoList.innerHTML = '<div class="loading">Loading NGOs for ' + (location || 'all areas') + '...</div>';

    try {
        const url = location ? `${API_BASE_URL}/ngos?location=${encodeURIComponent(location)}` : `${API_BASE_URL}/ngos`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });
        const ngos = await response.json();

        chrome.storage.sync.get(['selectedNGO'], (result) => {
            const currentSelectedId = result.selectedNGO?.id;

            ngoList.innerHTML = ngos.map(ngo => {
                const logoUrl = getLogoUrl(ngo.logo);
                return `
                <div class="ngo-card ${currentSelectedId === ngo.id ? 'selected' : ''}" data-ngo='${escapeHtml(JSON.stringify(ngo))}'>
                    <div class="ngo-card-content">
                        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(ngo.name)}" class="ngo-card-logo">
                        <div class="ngo-info">
                            <div style="display: flex; align-items: baseline; gap: 0.5rem; justify-content: space-between;">
                                <h3>${escapeHtml(ngo.name)}</h3>
                                <span class="lux-label" style="font-size: 8px; opacity: 0.6; letter-spacing: 0.1em;">INFO</span>
                            </div>
                            <p>${escapeHtml(ngo.description)}</p>
                        </div>
                    </div>
                </div>
            `}).join('');

            // Add click listeners to cards
            document.querySelectorAll('.ngo-card').forEach(card => {
                card.addEventListener('click', () => {
                    const ngo = JSON.parse(card.dataset.ngo);
                    openNgoDetail(ngo);
                });
            });
        });

    } catch (error) {
        console.error('Error loading NGOs:', error);
        ngoList.innerHTML = `<p class="error">Failed to load NGOs. Make sure backend is running on ${API_BASE_URL}</p>`;
    }
}

function openNgoDetail(ngo) {
    const ngoModal = document.getElementById('ngoModal');
    const ngoModalDetail = document.getElementById('ngoModalDetail');

    chrome.storage.sync.get(['selectedNGO'], (result) => {
        const isSelected = result.selectedNGO?.id === ngo.id;
        const logoUrl = getLogoUrl(ngo.logo);
        
        ngoModalDetail.innerHTML = `
            <div class="ngo-detail-header">
                <div class="ngo-header-left">
                    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(ngo.name)}" class="ngo-detail-logo">
                    <div class="ngo-header-titles">
                        <h2>${escapeHtml(ngo.name)}</h2>
                        <p>${escapeHtml(ngo.category)}</p>
                    </div>
                </div>
                <div class="ngo-header-right">
                    ${isSelected ?
                `<button id="deselectNgoBtn" class="lux-btn lux-btn-secondary">Deselect NGO</button>` :
                `<button id="selectNgoBtn" class="lux-btn lux-btn-primary">Select NGO</button>`
            }
                </div>
            </div>
            <div class="ngo-detail-body">
                <div class="ngo-detail-section">
                    <h4>About</h4>
                    <p>${escapeHtml(ngo.description)}</p>
                </div>
                <div class="ngo-detail-section">
                    <h4>Contact & Payment Details</h4>
                    <div class="ngo-contact-info">
                        <div class="contact-item">
                            <span class="contact-icon">Website:</span>
                            <a href="${escapeHtml(ngo.website)}" target="_blank">${escapeHtml(ngo.website || 'No website provided')}</a>
                        </div>
                        <div class="contact-item">
                            <span class="contact-icon">Phone:</span>
                            <span>${escapeHtml(ngo.phone || 'No phone number provided')}</span>
                        </div>
                        <div class="contact-item">
                            <span class="contact-icon">UPI:</span>
                            <span><strong>${escapeHtml(ngo.upiId)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (isSelected) {
            document.getElementById('deselectNgoBtn').addEventListener('click', () => {
                deselectNGO();
            });
        } else {
            document.getElementById('selectNgoBtn').addEventListener('click', () => {
                selectNGO(ngo);
            });
        }

        ngoModal.classList.remove('hidden');
    });
}

function deselectNGO() {
    chrome.storage.sync.remove(['selectedNGO'], () => {
        const ngoModal = document.getElementById('ngoModal');
        ngoModal.classList.add('hidden');

        // Refresh the list to show unselected state
        refreshNGOList();

        // Show feedback
        const status = document.getElementById('status');
        status.textContent = `NGO deselected`;
        status.style.color = '#6C6863';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });
}

function refreshNGOList() {
    const locationMode = document.querySelector('input[name="locationMode"]:checked').value;
    const currentCity = document.getElementById('citySelect').value;

    if (locationMode === 'auto') {
        const detectedCity = document.getElementById('detectedCityName').textContent;
        loadNGOs(detectedCity === 'Searching...' || detectedCity === 'Detecting...' ? '' : detectedCity);
    } else {
        loadNGOs(currentCity);
    }
}

function selectNGO(ngo) {
    chrome.storage.sync.set({ selectedNGO: ngo }, () => {
        const ngoModal = document.getElementById('ngoModal');
        ngoModal.classList.add('hidden');

        // Refresh the list to show selected state
        refreshNGOList();

        // Show feedback
        const status = document.getElementById('status');
        status.textContent = `${ngo.name} selected`;
        status.style.color = '#D4AF37';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });
}

async function loadDonationHistory() {
    const historyPreview = document.getElementById('historyPreview');
    if (!historyPreview) return;

    try {
        const response = await fetch(`${API_BASE_URL}/donations/history`, {
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });
        const donations = await response.json();

        if (donations.length === 0) {
            historyPreview.innerHTML = '<p>No donations yet. Start donating to build your history!</p>';
            return;
        }

        // Limit preview to 5
        const recentDonations = donations.slice(0, 5);
        const totalDonated = donations.filter(d => d.status === 'completed' || d.status === 'paid').reduce((sum, d) => sum + d.donationAmount, 0);

        historyPreview.innerHTML = `
            <div class="history-summary">
                <div class="summary-item">
                    <span class="label">Total Donated</span>
                    <span class="value">₹${totalDonated}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Donations Made</span>
                    <span class="value">${donations.length}</span>
                </div>
            </div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>NGO</th>
                        <th>Donation</th>
                        <th>Status</th>
                        <th>Receipt</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentDonations.map(d => {
            const date = d.timestamp ? new Date(d.timestamp) : new Date();
            const formattedDate = isNaN(date.getTime()) ? '-' : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${escapeHtml(d.ngoName || d.ngoId)}</td>
                                <td>₹${d.donationAmount}</td>
                                <td>
                                    ${d.status === 'completed' ?
                    `<span class="status-text">${d.status}</span>` :
                    `<span class="badge ${d.status}">${d.status}</span>`
                }
                                </td>
                                <td>
                                    ${(d.status === 'completed' || d.status === 'paid') ? `<button class="lux-btn-icon download-receipt-btn" data-txn-id="${d.transactionId}" title="Download Receipt">Receipt</button>` : '-'}
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Error loading history:', error);
        historyPreview.innerHTML = '<p class="error">Failed to load history</p>';
    }
}

async function openHistoryModal() {
    const modal = document.getElementById('historyModal');

    try {
        const response = await fetch(`${API_BASE_URL}/donations/history`, {
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });
        const donations = await response.json();

        const table = document.getElementById('historyTable');
        if (donations.length === 0) {
            table.innerHTML = '<p>No donation history</p>';
        } else {
            table.innerHTML = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Bill Amount</th>
                            <th>Donation</th>
                            <th>NGO</th>
                            <th>Website</th>
                            <th>Status</th>
                            <th>Receipt</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${donations.map(d => {
                const date = d.timestamp ? new Date(d.timestamp) : new Date();
                const formattedDate = isNaN(date.getTime()) ? '-' : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                return `
                                <tr>
                                    <td>${formattedDate}</td>
                                    <td>₹${d.originalAmount}</td>
                                    <td>₹${d.donationAmount}</td>
                                    <td>${escapeHtml(d.ngoName || d.ngoId)}</td>
                                    <td>${escapeHtml(d.website)}</td>
                                    <td>
                                        ${d.status === 'completed' ?
                        `<span class="status-text">${d.status}</span>` :
                        `<span class="badge ${d.status}">${d.status}</span>`
                    }
                                    </td>
                                    <td>
                                        ${(d.status === 'completed' || d.status === 'paid') ? `<button class="lux-btn-icon download-receipt-btn" data-txn-id="${d.transactionId}" title="Download Receipt">Receipt</button>` : '-'}
                                    </td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            `;
        }

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading full history:', error);
        document.getElementById('historyTable').innerHTML = '<p class="error">Failed to load history</p>';
        modal.classList.remove('hidden');
    }
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

async function exportHistoryCSV() {
    try {
        const response = await fetch(`${API_BASE_URL}/donations/history`, {
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });
        const donations = await response.json();

        const csv = [
            ['Date', 'Original Amount', 'Donation Amount', 'NGO', 'Website', 'Status'].join(','),
            ...donations.map(d => [
                new Date(d.timestamp).toLocaleString(),
                d.originalAmount,
                d.donationAmount,
                d.ngoId,
                d.website,
                d.status
            ].map(field => `"${field ?? ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'donation-history.csv';
        a.click();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Error exporting history:', error);
        alert('Failed to export history');
    }
}

async function clearHistory() {
    if (!confirm('Are you sure you want to clear all donation history? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/donations/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });

        if (response.ok) {
            alert('History cleared');
            location.reload();
        } else {
            const errData = await response.json().catch(() => ({}));
            alert(`Failed to clear history: ${errData.error || 'Unknown error'} ${errData.details ? '(' + errData.details + ')' : ''}`);
        }
    } catch (error) {
        console.error('Error clearing history:', error);
        alert('Error clearing history');
    }
}

async function downloadReceipt(transactionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/donations/history`, {
            headers: { 'Authorization': `Bearer ${await window.getAuthToken()}` }
        });
        const donations = await response.json();
        const donation = donations.find(d => d.transactionId === transactionId);

        if (!donation) {
            alert('Receipt data not found');
            return;
        }

        const date = new Date(donation.timestamp);
        const formattedDate = isNaN(date.getTime()) ? 'N/A' : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

        // Initialize jsPDF with better fallback for UMD
        let JSPDF = null;
        if (window.jspdf && window.jspdf.jsPDF) {
            JSPDF = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            JSPDF = window.jsPDF;
        } else if (window.jspdf) {
            JSPDF = window.jspdf;
        }

        if (!JSPDF) {
            console.error('jsPDF library not found. Global jspdf:', window.jspdf);
            throw new Error('PDF library not loaded correctly');
        }

        const doc = new JSPDF();

        // === Luxury / Editorial Receipt Design ===

        // Header bar — Charcoal
        doc.setFillColor(26, 26, 26);
        doc.rect(0, 0, 210, 36, 'F');

        // Header text
        doc.setTextColor(249, 248, 246);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('DONATION RECEIPT', 105, 16, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(235, 229, 222);
        doc.text('Generated by Round-Up Donations', 105, 24, { align: 'center' });

        // Gold accent line
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.75);
        doc.line(20, 50, 190, 50);

        // Greeting
        let y = 64;
        doc.setTextColor(26, 26, 26);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text('Thank You', 20, y);

        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(108, 104, 99);
        doc.text('Your contribution has been received and recorded.', 20, y);

        // Details block
        y += 18;
        doc.setDrawColor(26, 26, 26);
        doc.setLineWidth(0.15);
        doc.line(20, y, 190, y); // top border

        y += 12;
        const details = [
            ['TRANSACTION', donation.transactionId],
            ['DATE', formattedDate],
            ['BENEFICIARY', donation.ngoName || donation.ngoId],
            ['PLATFORM', donation.website],
            ['BILL AMOUNT', 'Rs. ' + donation.originalAmount],
            ['DONATION', 'Rs. ' + donation.donationAmount]
        ];

        details.forEach(([label, value]) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(108, 104, 99);
            doc.text(label, 20, y);
            doc.setFontSize(10);
            doc.setTextColor(26, 26, 26);
            doc.text(String(value), 75, y);
            y += 11;
        });

        // Bottom separator
        y += 4;
        doc.setDrawColor(26, 26, 26);
        doc.setLineWidth(0.15);
        doc.line(20, y, 190, y);

        // Total Amount — gold highlight
        y += 16;
        doc.setFontSize(14);
        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Donated: Rs. ' + donation.donationAmount, 105, y, { align: 'center' });

        // Thank-you note
        y += 22;
        doc.setFontSize(10);
        doc.setTextColor(108, 104, 99);
        doc.setFont('helvetica', 'italic');
        doc.text('Every round-up creates lasting impact.', 105, y, { align: 'center' });
        y += 8;
        doc.text('Thank you for being a part of this journey.', 105, y, { align: 'center' });

        // Footer
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text('This is a computer-generated receipt and does not require a physical signature.', 105, 280, { align: 'center' });

        // Save the PDF
        doc.save(`Receipt-${donation.transactionId}.pdf`);

    } catch (error) {
        console.error('Error generating PDF receipt:', error);
        alert('Failed to generate PDF receipt. Please check your console.');
    }
}

// Export to window for onclick handlers
window.downloadReceipt = downloadReceipt;

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
