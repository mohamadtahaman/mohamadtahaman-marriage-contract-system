document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
        showAlert('لم يتم تحديد كود العقد!', 'danger');
        return;
    }

    document.getElementById('contractCode').value = code;

    // Load contract data
    await loadContractData(code);

    // Save button event
    document.getElementById('saveAllBtn').addEventListener('click', () => {
        saveContractData(code);
    });
});

async function loadContractData(code) {
    try {
        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view', code })
        });

        const result = await response.json();
        if (result.success && result.contract) {
            const contract = result.contract;

            // Set contract meta
            document.getElementById('contractDate').value = contract.contractDate || '';
            document.getElementById('contractStatus').value = contract.status || 'draft';

            // Populate parties
            if (contract.parties) {
                for (const [role, data] of Object.entries(contract.parties)) {
                    const pane = document.getElementById(`${role}-pane`);
                    if (pane && data) {
                        const inputs = pane.querySelectorAll('[data-field]');
                        inputs.forEach(input => {
                            const field = input.getAttribute('data-field');
                            if (data[field] !== undefined && data[field] !== null) {
                                input.value = data[field];
                            }
                        });
                    }
                }
            }

            // Populate dowry (supports text and numbers)
            if (contract.dowry) {
                const dowryPane = document.getElementById('dowry-pane');
                const inputs = dowryPane.querySelectorAll('[data-field]');
                inputs.forEach(input => {
                    const field = input.getAttribute('data-field');
                    if (contract.dowry[field] !== undefined && contract.dowry[field] !== null) {
                        input.value = contract.dowry[field];
                    }
                });
            }
        } else {
            showAlert('فشل في تحميل بيانات العقد: ' + (result.error || 'غير معروف'), 'danger');
        }
    } catch (error) {
        console.error('Error loading contract:', error);
        showAlert('حدث خطأ أثناء الاتصال بالخادم لجلب بيانات العقد.', 'danger');
    }
}

async function saveContractData(code) {
    const parties = {};
    const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

    roles.forEach(role => {
        const pane = document.getElementById(`${role}-pane`);
        parties[role] = {};
        const inputs = pane.querySelectorAll('[data-field]');
        inputs.forEach(input => {
            const field = input.getAttribute('data-field');
            parties[role][field] = input.value;
        });
    });

    const dowryPane = document.getElementById('dowry-pane');
    const dowry = {};
    dowryPane.querySelectorAll('[data-field]').forEach(input => {
        const field = input.getAttribute('data-field');
        dowry[field] = input.value; // Accepts both text and numbers
    });

    const contractDate = document.getElementById('contractDate').value;
    const status = document.getElementById('contractStatus').value;

    const payload = {
        action: 'update_contract',
        code,
        contractDate,
        status,
        parties,
        dowry
    };

    try {
        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            showAlert('تم حفظ جميع التعديلات بنجاح!', 'success');
        } else {
            showAlert('فشل الحفظ: ' + (result.error || 'خطأ غير معروف'), 'danger');
        }
    } catch (error) {
        console.error('Error saving contract:', error);
        showAlert('حدث خطأ أثناء الاتصال بالخادم لحفظ التعديلات.', 'danger');
    }
}

function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
