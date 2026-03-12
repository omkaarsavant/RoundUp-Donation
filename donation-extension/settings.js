// Settings Page Script

document.addEventListener('DOMContentLoaded', async () => {
    const extensionEnabled = document.getElementById('extensionEnabled');
    const statusLabel = document.getElementById('statusLabel');
    const roundingRules = document.querySelectorAll('input[name="roundingRule"]');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['extensionEnabled', 'roundingRule', 'selectedNGO'], (result) => {
        extensionEnabled.checked = result.extensionEnabled !== false;
        updateStatusLabel();

        if (result.roundingRule) {
            document.querySelector(`input[value="${result.roundingRule}"]`).checked = true;
        }
    });

    // Toggle status label
    extensionEnabled.addEventListener('change', updateStatusLabel);

    function updateStatusLabel() {
        statusLabel.textContent = extensionEnabled.checked ? 'Extension Enabled ✓' : 'Extension Disabled ✗';
        statusLabel.style.color = extensionEnabled.checked ? '#4CAF50' : '#f44336';
    }

    // Load NGOs
    await loadNGOs();

    // Load donation history
    await loadDonationHistory();

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const selectedNGO = document.querySelector('input[name="ngo"]:checked');
        
        if (!selectedNGO) {
            status.textContent = '⚠️ Please select an NGO';
            status.style.color = '#ff9800';
            return;
        }

        const roundingRule = document.querySelector('input[name="roundingRule"]:checked').value;

        // Get selected NGO details
        const selectedNGOData = JSON.parse(selectedNGO.dataset.ngo);

        chrome.storage.sync.set({
            extensionEnabled: extensionEnabled.checked,
            roundingRule: roundingRule,
            selectedNGO: selectedNGOData
        }, () => {
            status.textContent = '✓ Settings saved successfully!';
            status.style.color = '#4CAF50';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        });
    });

    // History modal controls
    document.getElementById('viewHistory').addEventListener('click', openHistoryModal);
    document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
    document.getElementById('exportHistory').addEventListener('click', exportHistoryCSV);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
});

async function loadNGOs() {
    const ngoList = document.getElementById('ngoList');

    try {
        const response = await fetch('http://localhost:5000/api/ngos');
        const ngos = await response.json();

        ngoList.innerHTML = ngos.map(ngo => `
            <label class="ngo-card">
                <input type="radio" name="ngo" data-ngo="${escapeHtml(JSON.stringify(ngo))}">
                <div class="ngo-card-content">
                    <img src="${escapeHtml(ngo.logo)}" alt="${escapeHtml(ngo.name)}" class="ngo-card-logo">
                    <div class="ngo-info">
                        <h3>${escapeHtml(ngo.name)}</h3>
                        <p>${escapeHtml(ngo.description)}</p>
                        <p class="ngo-upi">UPI: ${escapeHtml(ngo.upiId)}</p>
                    </div>
                </div>
            </label>
        `).join('');

        // Load previously selected NGO
        chrome.storage.sync.get(['selectedNGO'], (result) => {
            if (result.selectedNGO) {
                const radios = document.querySelectorAll('input[name="ngo"]');
                radios.forEach(radio => {
                    const ngoData = JSON.parse(radio.dataset.ngo);
                    if (ngoData.id === result.selectedNGO.id) {
                        radio.checked = true;
                    }
                });
            }
        });

    } catch (error) {
        console.error('Error loading NGOs:', error);
        ngoList.innerHTML = '<p class="error">Failed to load NGOs. Make sure backend is running on http://localhost:5000</p>';
    }
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
                    </tr>
                </thead>
                <tbody>
                    ${donations.slice(0, 5).map(d => `
                        <tr>
                            <td>${new Date(d.timestamp).toLocaleDateString()}</td>
                            <td>${escapeHtml(d.ngoId)}</td>
                            <td>₹${d.donationAmount}</td>
                            <td><span class="badge ${d.status}">${d.status}</span></td>
                        </tr>
                    `).join('')}
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
                        </tr>
                    </thead>
                    <tbody>
                        ${donations.map(d => `
                            <tr>
                                <td>${new Date(d.timestamp).toLocaleString()}</td>
                                <td>₹${d.originalAmount}</td>
                                <td>₹${d.donationAmount}</td>
                                <td>${escapeHtml(d.ngoId)}</td>
                                <td>${escapeHtml(d.website)}</td>
                                <td><span class="badge ${d.status}">${d.status}</span></td>
                            </tr>
                        `).join('')}
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
