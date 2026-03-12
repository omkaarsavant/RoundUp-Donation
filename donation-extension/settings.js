// Settings Page Script

document.addEventListener('DOMContentLoaded', async () => {
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

    // Load saved settings
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
        // For this demo, let's say it's Nashik
        setTimeout(async () => {
            const city = 'Nashik';
            detectedCityName.textContent = city;
            await loadNGOs(city);
        }, 1000);
    }


    // Load NGOs
    await loadNGOs();

    // Load donation history
    await loadDonationHistory();

    // NGO Modal elements
    const ngoModal = document.getElementById('ngoModal');
    const ngoModalDetail = document.getElementById('ngoModalDetail');
    const closeNgoModalBtn = document.getElementById('closeNgoModal');

    closeNgoModalBtn.addEventListener('click', () => ngoModal.classList.add('hidden'));
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ngoModal) ngoModal.classList.add('hidden');
        if (e.target === document.getElementById('historyModal')) closeHistoryModal();
    });

    // Save settings (now primarily for Enabled status and Location mode, as NGO is saved on selection)
    saveBtn.addEventListener('click', async () => {
        chrome.storage.sync.get(['selectedNGO'], (result) => {
            if (!result.selectedNGO) {
                status.textContent = 'Please select an NGO from the list below';
                status.style.color = '#ff9800';
                return;
            }

            const locationMode = document.querySelector('input[name="locationMode"]:checked').value;
            const selectedCity = citySelect.value;

            chrome.storage.sync.set({
                locationMode: locationMode,
                selectedCity: selectedCity
            }, () => {
                status.textContent = 'Settings saved successfully!';
                status.style.color = '#4CAF50';
                setTimeout(() => {
                    status.textContent = '';
                }, 3000);
            });
        });
    });

    // History modal controls
    document.getElementById('viewHistory').addEventListener('click', openHistoryModal);
    document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
    document.getElementById('exportHistory').addEventListener('click', exportHistoryCSV);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
});

async function loadNGOs(location = '') {
    const ngoList = document.getElementById('ngoList');
    ngoList.innerHTML = '<div class="loading">Loading NGOs for ' + (location || 'all areas') + '...</div>';

    try {
        const url = location ? `http://localhost:5000/api/ngos?location=${encodeURIComponent(location)}` : 'http://localhost:5000/api/ngos';
        const response = await fetch(url);
        const ngos = await response.json();

        chrome.storage.sync.get(['selectedNGO'], (result) => {
            const currentSelectedId = result.selectedNGO?.id;
            
            ngoList.innerHTML = ngos.map(ngo => `
                <div class="ngo-card ${currentSelectedId === ngo.id ? 'selected' : ''}" data-ngo='${escapeHtml(JSON.stringify(ngo))}'>
                    <div class="ngo-card-content">
                        <img src="${escapeHtml(ngo.logo)}" alt="${escapeHtml(ngo.name)}" class="ngo-card-logo">
                        <div class="ngo-info">
                            <h3>${escapeHtml(ngo.name)}</h3>
                            <p>${escapeHtml(ngo.description)}</p>
                        </div>
                    </div>
                    <span class="ngo-card-badge">View Details</span>
                </div>
            `).join('');

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
        ngoList.innerHTML = '<p class="error">Failed to load NGOs. Make sure backend is running on http://localhost:5000</p>';
    }
}

function openNgoDetail(ngo) {
    const ngoModal = document.getElementById('ngoModal');
    const ngoModalDetail = document.getElementById('ngoModalDetail');
    
    ngoModalDetail.innerHTML = `
        <div class="ngo-detail-header">
            <img src="${escapeHtml(ngo.logo)}" alt="${escapeHtml(ngo.name)}" class="ngo-detail-logo">
            <h2>${escapeHtml(ngo.name)}</h2>
            <p>${escapeHtml(ngo.category)}</p>
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
        <div class="ngo-select-action">
            <button id="selectNgoBtn" class="btn btn-primary btn-large" style="width: 100%;">Select This NGO</button>
        </div>
    `;

    document.getElementById('selectNgoBtn').addEventListener('click', () => {
        selectNGO(ngo);
    });

    ngoModal.classList.remove('hidden');
}

function selectNGO(ngo) {
    chrome.storage.sync.set({ selectedNGO: ngo }, () => {
        const ngoModal = document.getElementById('ngoModal');
        ngoModal.classList.add('hidden');
        
        // Refresh the list to show selected state
        const locationMode = document.querySelector('input[name="locationMode"]:checked').value;
        const currentCity = document.getElementById('citySelect').value;
        
        if (locationMode === 'auto') {
            const detectedCity = document.getElementById('detectedCityName').textContent;
            loadNGOs(detectedCity === 'Searching...' ? '' : detectedCity);
        } else {
            loadNGOs(currentCity);
        }

        // Show feedback
        const status = document.getElementById('status');
        status.textContent = `${ngo.name} selected!`;
        status.style.color = '#4CAF50';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    });
}

async function loadDonationHistory() {
    const historyPreview = document.getElementById('historyPreview');

    try {
        const response = await fetch('http://localhost:5000/api/donations/recent?limit=5');
        const donations = await response.json();

        if (donations.length === 0) {
            historyPreview.innerHTML = '<p>No donations yet. Start donating to build your history!</p>';
            return;
        }

        const totalDonated = donations.reduce((sum, d) => sum + d.donationAmount, 0);

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
                    ${donations.slice(0, 5).map(d => {
                        const date = new Date(d.timestamp);
                        const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                        return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${escapeHtml(d.ngoName || d.ngoId)}</td>
                                <td>₹${d.donationAmount}</td>
                                <td><span class="badge ${d.status}">${d.status}</span></td>
                                <td>
                                    ${(d.status === 'completed' || d.status === 'paid') ? `<button class="btn-icon download-receipt-btn" data-txn-id="${d.transactionId}" title="Download Receipt">Receipt</button>` : '-'}
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
        const response = await fetch('http://localhost:5000/api/donations/history');
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
                            const date = new Date(d.timestamp);
                            const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                            return `
                                <tr>
                                    <td>${formattedDate}</td>
                                    <td>₹${d.originalAmount}</td>
                                    <td>₹${d.donationAmount}</td>
                                    <td>${escapeHtml(d.ngoName || d.ngoId)}</td>
                                    <td>${escapeHtml(d.website)}</td>
                                    <td><span class="badge ${d.status}">${d.status}</span></td>
                                    <td>
                                        ${(d.status === 'completed' || d.status === 'paid') ? `<button class="btn-icon download-receipt-btn" data-txn-id="${d.transactionId}" title="Download Receipt">Receipt</button>` : '-'}
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
        const response = await fetch('http://localhost:5000/api/donations/history');
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
            ].map(field => `"${field}"`).join(','))
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
        const response = await fetch('http://localhost:5000/api/donations/clear', {
            method: 'POST'
        });

        if (response.ok) {
            alert('History cleared');
            location.reload();
        } else {
            alert('Failed to clear history');
        }
    } catch (error) {
        console.error('Error clearing history:', error);
        alert('Error clearing history');
    }
}

async function downloadReceipt(transactionId) {
    try {
        const response = await fetch(`http://localhost:5000/api/donations/history`);
        const donations = await response.json();
        const donation = donations.find(d => d.transactionId === transactionId);
        
        if (!donation) {
            alert('Receipt data not found');
            return;
        }

        const date = new Date(donation.timestamp);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

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

        // Design the PDF
        // Header
        doc.setFillColor(102, 126, 234); // Premium Gradient color
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("DONATION RECEIPT", 105, 25, { align: "center" });
        
        doc.setFontSize(10);
        doc.text("Generated by Round-Up Donations", 105, 33, { align: "center" });

        // Body Content
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        
        let y = 60;
        doc.setFont("helvetica", "bold");
        doc.text("Dear Valued Donor,", 20, y);
        
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.text("Thank you for your generous contribution through our platform.", 20, y);
        
        y += 20;
        // Transaction Details Box
        doc.setDrawColor(230, 230, 230);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(15, y, 180, 70, 3, 3, 'FD');
        
        y += 15;
        const details = [
            ["Transaction ID:", donation.transactionId],
            ["Date:", formattedDate],
            ["NGO Recipient:", donation.ngoName || donation.ngoId],
            ["From Platform:", donation.website],
            ["Bill Amount:", `Rs. ${donation.originalAmount}`],
            ["Donation Rounded Up:", `Rs. ${donation.donationAmount}`]
        ];

        details.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.text(label, 25, y);
            doc.setFont("helvetica", "normal");
            doc.text(String(value), 80, y);
            y += 10;
        });

        // Highlight Amount
        y += 10;
        doc.setFontSize(16);
        doc.setTextColor(102, 126, 234);
        doc.setFont("helvetica", "bold");
        doc.text(`Total Donated: Rs. ${donation.donationAmount}`, 105, y, { align: "center" });

        // Thank You Message
        y += 30;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(12);
        doc.setFont("helvetica", "italic");
        doc.text("Your small change is bringing a big change in the world.", 105, y, { align: "center" });
        
        y += 10;
        doc.text("Thank you for being a part of this journey!", 105, y, { align: "center" });

        // Footer
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text("This is a computer-generated receipt and does not require a physical signature.", 105, 280, { align: "center" });

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
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
