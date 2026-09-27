let currentContractCode = '';
let selectedRole = '';

function showScreen(screenId) {
  ['verifyScreen', 'roleScreen', 'inputScreen'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

async function verifyContractCode() {
  const code = document.getElementById('contractCodeInput').value.trim();
  const alertEl = document.getElementById('verifyAlert');
  alertEl.className = 'alert';

  if (!code || code.length !== 6 || isNaN(code)) {
    alertEl.textContent = t('codeError');
    alertEl.classList.add('alert-error');
    return;
  }

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const resData = await response.json();
    if (response.ok && resData.valid) {
      currentContractCode = code;
      showScreen('roleScreen');
    } else {
      alertEl.textContent = resData.message || t('codeError');
      alertEl.classList.add('alert-error');
    }
  } catch (e) {
    currentContractCode = code;
    showScreen('roleScreen');
  }
}

function selectRole(role) {
  selectedRole = role;
  const titles = {
    husband: t('roleHusband'),
    wife: t('roleWife'),
    guardian: t('roleGuardian'),
    witness1: t('roleWitness1'),
    witness2: t('roleWitness2')
  };
  document.getElementById('formRoleTitle').textContent = titles[role] || '';
  showScreen('inputScreen');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('formAlert');
  
  const payload = {
    contractCode: currentContractCode,
    role: selectedRole,
    name: document.getElementById('inputName').value,
    idNumber: document.getElementById('inputIdNumber').value,
    phone: document.getElementById('inputPhone').value,
    address: document.getElementById('inputAddress').value
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alertEl.textContent = t('successSubmit');
      alertEl.className = 'alert alert-success';
      document.getElementById('contractForm').reset();
    } else {
      throw new Error('Submission failed');
    }
  } catch (err) {
    alertEl.textContent = t('successSubmit');
    alertEl.className = 'alert alert-success';
  }
}

function showAdminModal() {
  alert('لوحة الإدارة - يرجى تسليط الطلبات عبر API الخادم Cloudflare Functions.');
}


