/**
 * Arresalah Zentrum Berlin - Admin Edit Client Script (Complete & Full Version)
 * Handles loading, tabbing, populating, and saving contract details (including text/number dowries).
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
        showAlert('لم يتم العثور على كود العقد المحدد في الرابط!', 'danger');
        return;
    }

    // Set code in UI
    const codeInput = document.getElementById('contractCode');
    if (codeInput) codeInput.value = code;

    // Load contract data on startup
    await loadContractData(code);

    // Save button event listener
    const saveBtn = document.getElementById('saveAllBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveContractData(code);
        });
    }
});

/**
 * Load contract data from backend API
 */
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

            // Set Meta info
            const dateInput = document.getElementById('contractDate');
            if (dateInput) dateInput.value = contract.contractDate || '';

            const statusInput = document.getElementById('contractStatus');
            if (statusInput) statusInput.value = contract.status || 'draft';

            // Populate Parties (groom, bride, wali, witness1, witness2)
            if (contract.parties) {
                for (const [role, data] of Object.entries(contract.parties)) {
                    const pane = document.getElementById(`${role}-pane`);
                    if (pane && data) {
                        pane.querySelectorAll('[data-field]').forEach(input => {
                            const field = input.getAttribute('data-field');
                            if (data[field] !== undefined && data[field] !== null) {
                                input.value = data[field];
                            }
                        });
                    }
                }
            }

            // Populate Dowry (Supports both text and numbers freely)
            if (contract.dowry) {
                const dowryPane = document.getElementById('dowry-pane');
                if (dowryPane) {
                    dowryPane.querySelectorAll('[data-field]').forEach(input => {
                        const field = input.getAttribute('data-field');
                        if (contract.dowry[field] !== undefined && contract.dowry[field] !== null) {
                            input.value = contract.dowry[field];
                        }
                    });
                }
            }

        } else {
            showAlert('فشل في تحميل بيانات العقد: ' + (result.error || 'خطأ غير معروف'), 'danger');
        }
    } catch (error) {
        console.error('Error loading contract data:', error);
        showAlert('حدث خطأ أثناء الاتصال بالخادم لجلب بيانات العقد.', 'danger');
    }
}

/**
 * Save contract data (Save after edit)
 */
async function saveContractData(code) {
    const parties = {};
    const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

    // Collect data from all party tabs
    roles.forEach(role => {
        const pane = document.getElementById(`${role}-pane`);
        parties[role] = {};
        if (pane) {
            pane.querySelectorAll('[data-field]').forEach(input => {
                const field = input.getAttribute('data-field');
                parties[role][field] = input.value;
            });
        }
    });

    // Collect dowry data (allows text and numbers)
    const dowryPane = document.getElementById('dowry-pane');
    const dowry = {};
    if (dowryPane) {
        dowryPane.querySelectorAll('[data-field]').forEach(input => {
            const field = input.getAttribute('data-field');
            dowry[field] = input.value;
        });
    }

    const contractDateElem = document.getElementById('contractDate');
    const statusElem = document.getElementById('contractStatus');

    const contractDate = contractDateElem ? contractDateElem.value : '';
    const status = statusElem ? statusElem.value : 'draft';

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
            showAlert('تم حفظ التعديلات بنجاح في قاعدة البيانات!', 'success');
        } else {
            showAlert('فشل الحفظ: ' + (result.error || 'خطأ غير معروف'), 'danger');
        }
    } catch (error) {
        console.error('Error saving contract data:', error);
        showAlert('حدث خطأ أثناء الاتصال بالخادم لحفظ التعديلات.', 'danger');
    }
}

/**
 * Show alert helper function
 */
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;

    alertBox.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
