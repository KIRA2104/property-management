const API_BASE = window.location.origin;
let isLoginMode = true;
let accessToken = localStorage.getItem('token') || null;

let allProperties = [];
let allTenants = [];
let allAgreements = [];
let allPayments = [];

let editingPropertyId = null;
let editingTenantId = null;
let editingAgreementId = null;
let editingPaymentId = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (accessToken) {
        checkAuth();
    } else {
        openModal('authModal');
    }
});

// Notifications
function showNotification(message, isError = false) {
    const notif = document.getElementById('notification');
    notif.innerHTML = isError 
        ? `<i class="fa-solid fa-circle-exclamation" style="color: var(--danger)"></i> ${message}`
        : `<i class="fa-solid fa-circle-check" style="color: var(--success)"></i> ${message}`;
    notif.style.borderLeftColor = isError ? 'var(--danger)' : 'var(--primary)';
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 3000);
}

// Modals
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    
    // Reset state if closing
    if (id === 'propertyModal') editingPropertyId = null;
    if (id === 'tenantModal') editingTenantId = null;
    if (id === 'agreementModal') editingAgreementId = null;
    if (id === 'paymentModal') editingPaymentId = null;
}
function closeModalOutside(e, id) {
    if(e.target.id === id) closeModal(id);
}

// Tabs
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId + 'Tab').classList.add('active');
    
    if (tabId === 'properties') fetchProperties();
    if (tabId === 'tenants') fetchTenants();
    if (tabId === 'agreements') fetchAgreements();
    if (tabId === 'payments') fetchPayments();
}

// Auth Logic
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').innerText = isLoginMode ? 'Welcome Back' : 'Create Account';
    document.getElementById('authSubtitle').innerText = isLoginMode ? 'Sign in to manage your properties' : 'Register to get started';
    document.getElementById('authSubmitBtn').innerText = isLoginMode ? 'Sign In' : 'Register';
    document.getElementById('authToggle').innerText = isLoginMode ? "Don't have an account? Register" : "Already have an account? Sign in";
    document.getElementById('emailGroup').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('email').required = !isLoginMode;
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        if (isLoginMode) {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            if (!res.ok) throw new Error('Invalid credentials');
            
            const data = await res.json();
            accessToken = data.access_token;
            localStorage.setItem('token', accessToken);
            
            closeModal('authModal');
            checkAuth();
            showNotification('Successfully logged in');
        } else {
            const email = document.getElementById('email').value;
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password, is_active: true, is_superuser: false })
            });
            
            if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
            
            showNotification('Account created! Please log in.');
            toggleAuthMode();
        }
    } catch (err) {
        showNotification(err.message, true);
    }
}

async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            document.getElementById('loginBtnBtn').style.display = 'none';
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('userName').innerText = `Hello, ${user.username}`;
            document.getElementById('appContainer').classList.remove('hidden');
            
            fetchProperties(); // load initial data
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

function logout() {
    accessToken = null;
    localStorage.removeItem('token');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('loginBtnBtn').style.display = 'block';
    openModal('authModal');
}

// API Fetchers
async function fetchAPI(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ? JSON.stringify(err.detail) : 'Request failed');
    }
    if (res.status !== 204) return await res.json();
}

// --- PROPERTIES ---
async function fetchProperties() {
    try {
        allProperties = await fetchAPI('/properties/');
        const list = document.getElementById('propertiesList');
        list.innerHTML = allProperties.length ? '' : '<p style="color:var(--text-muted)">No properties found. Add one!</p>';
        
        allProperties.forEach(p => {
            list.innerHTML += `
                <div class="card">
                    <h3>
                        <span style="display:flex; flex-direction:column; gap:0.25rem;">
                            ${p.address} 
                            <span class="badge ${p.is_available ? 'success' : 'danger'}" style="width:fit-content">${p.is_available ? 'Available' : 'Rented'}</span>
                        </span>
                        <div class="card-actions">
                            <button class="outline" onclick="openEditProperty('${p.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="outline" style="color:var(--danger); border-color:transparent" onclick="deleteProperty('${p.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </h3>
                    <p class="card-meta">${p.description || 'No description provided'}</p>
                    <div class="card-price">₹${p.monthly_rent} <span style="font-size:0.875rem; color:var(--text-muted); font-weight: 500">/ month</span></div>
                </div>
            `;
        });
    } catch(e) { showNotification(e.message, true); }
}

function openAddProperty() {
    editingPropertyId = null;
    document.querySelector('#propertyModal form').reset();
    document.querySelector('#propertyModal .modal-header h2').innerText = 'Add New Property';
    openModal('propertyModal');
}

function openEditProperty(id) {
    const p = allProperties.find(x => x.id === id);
    if (!p) return;
    editingPropertyId = id;
    document.getElementById('propAddress').value = p.address;
    document.getElementById('propDesc').value = p.description || '';
    document.getElementById('propRent').value = p.monthly_rent;
    document.querySelector('#propertyModal .modal-header h2').innerText = 'Edit Property';
    openModal('propertyModal');
}

async function createProperty(e) {
    e.preventDefault();
    const payload = {
        address: document.getElementById('propAddress').value,
        description: document.getElementById('propDesc').value,
        monthly_rent: document.getElementById('propRent').value,
        is_available: true
    };
    try {
        if (editingPropertyId) {
            const p = allProperties.find(x => x.id === editingPropertyId);
            payload.is_available = p.is_available;
            await fetchAPI(`/properties/${editingPropertyId}`, { method: 'PUT', body: JSON.stringify(payload) });
            showNotification('Property updated successfully');
        } else {
            await fetchAPI('/properties/', { method: 'POST', body: JSON.stringify(payload) });
            showNotification('Property added successfully');
        }
        closeModal('propertyModal');
        e.target.reset();
        fetchProperties();
    } catch(err) { showNotification(err.message, true); }
}

async function deleteProperty(id) {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
        await fetchAPI(`/properties/${id}`, { method: 'DELETE' });
        showNotification('Property deleted');
        fetchProperties();
    } catch(e) { showNotification(e.message, true); }
}

// --- TENANTS ---
async function fetchTenants() {
    try {
        allTenants = await fetchAPI('/tenants/');
        const list = document.getElementById('tenantsList');
        list.innerHTML = allTenants.length ? '' : '<p style="color:var(--text-muted)">No tenants found. Add one!</p>';
        
        allTenants.forEach(t => {
            list.innerHTML += `
                <div class="card">
                    <h3>
                        <span>${t.first_name} ${t.last_name}</span>
                        <div class="card-actions">
                            <button class="outline" onclick="openEditTenant('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="outline" style="color:var(--danger); border-color:transparent" onclick="deleteTenant('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </h3>
                    <p class="card-meta"><i class="fa-solid fa-envelope" style="color:var(--primary)"></i> ${t.email}</p>
                    <p class="card-meta" style="margin-bottom:0"><i class="fa-solid fa-phone" style="color:var(--primary)"></i> ${t.phone_number || 'N/A'}</p>
                </div>
            `;
        });
    } catch(e) { showNotification(e.message, true); }
}

function openAddTenant() {
    editingTenantId = null;
    document.querySelector('#tenantModal form').reset();
    document.querySelector('#tenantModal .modal-header h2').innerText = 'Add New Tenant';
    openModal('tenantModal');
}

function openEditTenant(id) {
    const t = allTenants.find(x => x.id === id);
    if (!t) return;
    editingTenantId = id;
    document.getElementById('tenFirst').value = t.first_name;
    document.getElementById('tenLast').value = t.last_name;
    document.getElementById('tenEmail').value = t.email;
    document.getElementById('tenPhone').value = t.phone_number || '';
    document.querySelector('#tenantModal .modal-header h2').innerText = 'Edit Tenant';
    openModal('tenantModal');
}

async function createTenant(e) {
    e.preventDefault();
    const payload = {
        first_name: document.getElementById('tenFirst').value,
        last_name: document.getElementById('tenLast').value,
        email: document.getElementById('tenEmail').value,
        phone_number: document.getElementById('tenPhone').value || null
    };
    try {
        if (editingTenantId) {
            await fetchAPI(`/tenants/${editingTenantId}`, { method: 'PATCH', body: JSON.stringify(payload) });
            showNotification('Tenant updated successfully');
        } else {
            await fetchAPI('/tenants/', { method: 'POST', body: JSON.stringify(payload) });
            showNotification('Tenant added successfully');
        }
        closeModal('tenantModal');
        e.target.reset();
        fetchTenants();
    } catch(err) { showNotification(err.message, true); }
}

async function deleteTenant(id) {
    if (!confirm('Are you sure you want to delete this tenant?')) return;
    try {
        await fetchAPI(`/tenants/${id}`, { method: 'DELETE' });
        showNotification('Tenant deleted');
        fetchTenants();
    } catch(e) { showNotification(e.message, true); }
}

// --- AGREEMENTS ---
async function fetchAgreements() {
    try {
        allAgreements = await fetchAPI('/agreements/');
        const list = document.getElementById('agreementsList');
        list.innerHTML = allAgreements.length ? '' : '<p style="color:var(--text-muted)">No agreements active.</p>';
        
        allAgreements.forEach(a => {
            list.innerHTML += `
                <div class="card">
                    <h3>
                        <span style="display:flex; flex-direction:column; gap:0.25rem;">
                            Agreement 
                            <span class="badge ${a.status === 'active' ? 'success' : 'danger'}" style="width:fit-content">${a.status.toUpperCase()}</span>
                        </span>
                        <div class="card-actions">
                            <button class="outline" onclick="openEditAgreement('${a.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="outline" style="color:var(--danger); border-color:transparent" onclick="deleteAgreement('${a.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </h3>
                    <p class="card-meta"><i class="fa-regular fa-calendar" style="color:var(--primary)"></i> ${a.start_date} &rarr; ${a.end_date}</p>
                    <div class="card-price">₹${a.agreed_rent}</div>
                </div>
            `;
        });
    } catch(e) { showNotification(e.message, true); }
}

async function populateAgreementModal() {
    try {
        const props = await fetchAPI('/properties/');
        const tenants = await fetchAPI('/tenants/');
        
        const propSelect = document.getElementById('agrProperty');
        propSelect.innerHTML = '<option value="">Select a property</option>';
        props.filter(p => p.is_available).forEach(p => {
            propSelect.innerHTML += `<option value="${p.id}">${p.address} (₹${p.monthly_rent})</option>`;
        });

        const tenSelect = document.getElementById('agrTenant');
        tenSelect.innerHTML = '<option value="">Select a tenant</option>';
        tenants.forEach(t => {
            tenSelect.innerHTML += `<option value="${t.id}">${t.first_name} ${t.last_name}</option>`;
        });
    } catch(e) { showNotification(e.message, true); }
}

function openAddAgreement() {
    editingAgreementId = null;
    document.querySelector('#agreementModal form').reset();
    document.querySelector('#agreementModal .modal-header h2').innerText = 'Create Rental Agreement';
    // Enable all inputs
    document.getElementById('agrProperty').disabled = false;
    document.getElementById('agrTenant').disabled = false;
    document.getElementById('agrStart').disabled = false;
    document.getElementById('agrEnd').disabled = false;
    document.getElementById('agrRent').disabled = false;
    document.getElementById('agrDeposit').disabled = false;
    
    // Add status input if not exists
    let statusSelect = document.getElementById('agrStatus');
    if (statusSelect) statusSelect.closest('.form-group').style.display = 'none';

    populateAgreementModal().then(() => openModal('agreementModal'));
}

async function openEditAgreement(id) {
    const a = allAgreements.find(x => x.id === id);
    if (!a) return;
    editingAgreementId = id;
    
    await populateAgreementModal();
    
    // Ensure the property is in the select list if it's currently rented
    const propSelect = document.getElementById('agrProperty');
    if (!Array.from(propSelect.options).some(opt => opt.value === a.property_id)) {
        propSelect.innerHTML += `<option value="${a.property_id}">Property ID: ${a.property_id}</option>`;
    }

    document.getElementById('agrProperty').value = a.property_id;
    document.getElementById('agrTenant').value = a.tenant_id;
    document.getElementById('agrStart').value = a.start_date;
    document.getElementById('agrEnd').value = a.end_date;
    document.getElementById('agrRent').value = a.agreed_rent;
    document.getElementById('agrDeposit').value = a.deposit;
    
    // Disable non-editable fields
    document.getElementById('agrProperty').disabled = true;
    document.getElementById('agrTenant').disabled = true;
    document.getElementById('agrStart').disabled = true;
    document.getElementById('agrEnd').disabled = true;
    document.getElementById('agrRent').disabled = true;
    document.getElementById('agrDeposit').disabled = true;

    // Add status field for editing
    let statusSelect = document.getElementById('agrStatus');
    if (!statusSelect) {
        const form = document.querySelector('#agreementModal form');
        const btn = form.querySelector('button[type="submit"]');
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>Status</label>
            <select id="agrStatus">
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
            </select>
        `;
        form.insertBefore(div, btn);
        statusSelect = document.getElementById('agrStatus');
    }
    statusSelect.closest('.form-group').style.display = 'block';
    statusSelect.value = a.status;

    document.querySelector('#agreementModal .modal-header h2').innerText = 'Edit Agreement Status';
    openModal('agreementModal');
}

async function createAgreement(e) {
    e.preventDefault();
    try {
        if (editingAgreementId) {
            const status = document.getElementById('agrStatus').value;
            await fetchAPI(`/agreements/${editingAgreementId}`, { 
                method: 'PATCH', 
                body: JSON.stringify({ status }) 
            });
            showNotification('Agreement status updated successfully');
        } else {
            const payload = {
                property_id: document.getElementById('agrProperty').value,
                tenant_id: document.getElementById('agrTenant').value,
                start_date: document.getElementById('agrStart').value,
                end_date: document.getElementById('agrEnd').value,
                agreed_rent: document.getElementById('agrRent').value,
                deposit: document.getElementById('agrDeposit').value,
                status: 'active'
            };
            await fetchAPI('/agreements/', { method: 'POST', body: JSON.stringify(payload) });
            showNotification('Agreement created successfully');
        }
        closeModal('agreementModal');
        e.target.reset();
        fetchAgreements();
        fetchProperties();
    } catch(err) { showNotification(err.message, true); }
}

async function deleteAgreement(id) {
    if (!confirm('Are you sure you want to delete this agreement?')) return;
    try {
        await fetchAPI(`/agreements/${id}`, { method: 'DELETE' });
        showNotification('Agreement deleted');
        fetchAgreements();
        fetchProperties();
    } catch(e) { showNotification(e.message, true); }
}

// --- PAYMENTS ---
async function fetchPayments() {
    try {
        allPayments = await fetchAPI('/payments/');
        const list = document.getElementById('paymentsList');
        list.innerHTML = allPayments.length ? '' : '<p style="color:var(--text-muted)">No payment records.</p>';
        
        allPayments.forEach(p => {
            let badgeClass = p.status === 'confirmed' ? 'success' : (p.status === 'pending' ? 'badge-pending' : 'danger');
            let color = badgeClass === 'success' ? '#34d399' : (badgeClass === 'danger' ? '#f87171' : '#fcd34d');
            let bg = badgeClass === 'success' ? 'rgba(16,185,129,0.15)' : (badgeClass === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)');
            
            list.innerHTML += `
                <div class="card">
                    <h3>
                        <span style="display:flex; flex-direction:column; gap:0.25rem;">
                            Payment 
                            <span class="badge" style="width:fit-content; background:${bg}; color:${color}; border: 1px solid ${color}">${p.status.toUpperCase()}</span>
                        </span>
                        <div class="card-actions">
                            <button class="outline" onclick="openEditPayment('${p.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="outline" style="color:var(--danger); border-color:transparent" onclick="deletePayment('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </h3>
                    <p class="card-meta"><i class="fa-regular fa-calendar" style="color:var(--primary)"></i> ${p.payment_date}</p>
                    <div class="card-price">₹${p.amount}</div>
                </div>
            `;
        });
    } catch(e) { showNotification(e.message, true); }
}

async function populatePaymentModal() {
    try {
        const agreements = await fetchAPI('/agreements/');
        const paySelect = document.getElementById('payAgreement');
        paySelect.innerHTML = '<option value="">Select an agreement</option>';
        agreements.filter(a => a.status === 'active').forEach(a => {
            paySelect.innerHTML += `<option value="${a.id}">Agreement (Rent: ₹${a.agreed_rent})</option>`;
        });
    } catch(e) { showNotification(e.message, true); }
}

function openAddPayment() {
    editingPaymentId = null;
    document.querySelector('#paymentModal form').reset();
    document.querySelector('#paymentModal .modal-header h2').innerText = 'Record Payment';
    
    document.getElementById('payAgreement').disabled = false;
    document.getElementById('payAmount').disabled = false;
    document.getElementById('payDate').disabled = false;
    
    populatePaymentModal().then(() => openModal('paymentModal'));
}

async function openEditPayment(id) {
    const p = allPayments.find(x => x.id === id);
    if (!p) return;
    editingPaymentId = id;
    
    await populatePaymentModal();
    
    const paySelect = document.getElementById('payAgreement');
    if (!Array.from(paySelect.options).some(opt => opt.value === p.agreement_id)) {
        paySelect.innerHTML += `<option value="${p.agreement_id}">Agreement ID: ${p.agreement_id}</option>`;
    }

    document.getElementById('payAgreement').value = p.agreement_id;
    document.getElementById('payAmount').value = p.amount;
    document.getElementById('payDate').value = p.payment_date;
    document.getElementById('payStatus').value = p.status;
    
    document.getElementById('payAgreement').disabled = true;
    document.getElementById('payAmount').disabled = true;
    document.getElementById('payDate').disabled = true;

    document.querySelector('#paymentModal .modal-header h2').innerText = 'Edit Payment Status';
    openModal('paymentModal');
}

async function createPayment(e) {
    e.preventDefault();
    try {
        if (editingPaymentId) {
            const status = document.getElementById('payStatus').value;
            await fetchAPI(`/payments/${editingPaymentId}`, { 
                method: 'PATCH', 
                body: JSON.stringify({ status }) 
            });
            showNotification('Payment status updated successfully');
        } else {
            const payload = {
                agreement_id: document.getElementById('payAgreement').value,
                amount: document.getElementById('payAmount').value,
                payment_date: document.getElementById('payDate').value,
                status: document.getElementById('payStatus').value
            };
            await fetchAPI('/payments/', { method: 'POST', body: JSON.stringify(payload) });
            showNotification('Payment recorded successfully');
        }
        closeModal('paymentModal');
        e.target.reset();
        fetchPayments();
    } catch(err) { showNotification(err.message, true); }
}

async function deletePayment(id) {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
        await fetchAPI(`/payments/${id}`, { method: 'DELETE' });
        showNotification('Payment deleted');
        fetchPayments();
    } catch(e) { showNotification(e.message, true); }
}
