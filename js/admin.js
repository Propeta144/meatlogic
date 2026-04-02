/* ============================================
   MEATLOGIC — Admin Logic
   ============================================ */

let adminProducts = {};
let adminOrders = {};
let orderFilter = "all";

/* ---- LOGIN ---- */
function doLogin(e) {
    e.preventDefault();
    const em = document.getElementById("a-email").value.trim();
    const pw = document.getElementById("a-pass").value;

    if (em === ADMIN_EMAIL && pw === ADMIN_PASSWORD) {
        sessionStorage.setItem("ml_admin", "true");
        showDashboard();
    } else {
        const err = document.getElementById("login-err");
        err.textContent = "Invalid email or password.";
        err.classList.remove("hidden");
    }
}

function doLogout() {
    sessionStorage.removeItem("ml_admin");
    document.getElementById("admin-app").classList.add("hidden");
    document.getElementById("login-gate").classList.remove("hidden");
}

function showDashboard() {
    document.getElementById("login-gate").classList.add("hidden");
    document.getElementById("admin-app").classList.remove("hidden");
    document.getElementById("a-date").textContent = new Date().toLocaleDateString("en-PH", {
        weekday:"long", month:"long", day:"numeric", year:"numeric"
    });
    loadData();
}

// Auto-login if session exists
if (sessionStorage.getItem("ml_admin") === "true") { showDashboard(); }

/* ---- SIDEBAR ---- */
function openSB() { document.getElementById("sidebar").classList.add("open"); document.getElementById("mob-overlay").classList.add("show"); }
function closeSB() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("mob-overlay").classList.remove("show"); }

function aTab(name, el) {
    document.querySelectorAll(".a-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("at-" + name).classList.add("active");
    document.querySelectorAll(".sb-link").forEach(l => l.classList.remove("active"));
    if (el) el.classList.add("active");
    const titles = { dashboard:"Dashboard", stock:"Stock Management", orders:"Orders", products:"Products" };
    document.getElementById("a-title").textContent = titles[name] || "Dashboard";
    closeSB();
}

/* ---- LOAD DATA (Real-time) ---- */
function loadData() {
    db.ref("products").on("value", snap => {
        adminProducts = snap.val() || {};
        refreshDash();
        renderStockGrid();
        renderProdTable();
    });

    db.ref("orders").on("value", snap => {
        adminOrders = snap.val() || {};
        refreshDash();
        renderOrders();
    });
}

/* ---- DASHBOARD ---- */
function refreshDash() {
    const today = new Date().toDateString();
    const ordArr = Object.entries(adminOrders);
    const todayOrds = ordArr.filter(([, o]) => new Date(o.createdAt).toDateString() === today);
    const pending = ordArr.filter(([, o]) => o.status === "Pending");
    const revenue = todayOrds.filter(([, o]) => o.status !== "Rejected").reduce((s, [, o]) => s + o.total, 0);
    const prodArr = Object.entries(adminProducts);
    const online = prodArr.filter(([, p]) => (p.onlineStock || 0) > 0).length;

    document.getElementById("s-orders").textContent = todayOrds.length;
    document.getElementById("s-pending").textContent = pending.length;
    document.getElementById("s-revenue").textContent = formatCurrency(revenue);
    document.getElementById("s-products").textContent = online;

    const pb = document.getElementById("pend-badge");
    pb.textContent = pending.length;
    pb.style.display = pending.length > 0 ? "inline" : "none";

    // Recent orders
    const recent = document.getElementById("d-recent");
    if (todayOrds.length === 0) { recent.innerHTML = '<p class="muted">No orders today.</p>'; }
    else {
        recent.innerHTML = todayOrds.slice(0, 5).map(([id, o]) => {
            const sc = statusClass(o.status);
            return `<div class="ro-item"><span><strong>${o.customerName}</strong><br><small style="color:var(--text2)">${id} • ${formatCurrency(o.total)}</small></span><span class="badge-s ${sc}">${o.status}</span></div>`;
        }).join("");
    }

    // Low stock
    const lowEl = document.getElementById("d-lowstock");
    const low = prodArr.filter(([, p]) => (p.onlineStock || 0) <= 5);
    if (low.length === 0) { lowEl.innerHTML = '<p class="muted">All products well stocked.</p>'; }
    else {
        lowEl.innerHTML = low.map(([, p]) => {
            const stk = p.onlineStock || 0;
            const cls = stk === 0 ? "stk-out" : "stk-low";
            return `<div class="ls-item"><span>${p.emoji || "🥩"} ${p.name}</span><span class="p-stock ${cls}">${stk} left</span></div>`;
        }).join("");
    }

    // Show/hide init section
    const init = document.getElementById("init-section");
    if (init) init.style.display = prodArr.length === 0 ? "block" : "none";
}

function statusClass(s) {
    return { Pending:"bs-pending", Approved:"bs-approved", "Out for Delivery":"bs-delivering", Completed:"bs-completed", Rejected:"bs-rejected" }[s] || "bs-pending";
}

/* ---- INIT PRODUCTS ---- */
function initProducts() {
    loadDefaultProducts().then(() => showToast("Default products loaded!"));
}

/* ---- STOCK MANAGEMENT ---- */
function renderStockGrid() {
    const grid = document.getElementById("stock-grid");
    const entries = Object.entries(adminProducts);
    if (entries.length === 0) { grid.innerHTML = '<p class="muted">No products. Add products first.</p>'; return; }

    grid.innerHTML = entries.map(([id, p]) => `
        <div class="sk-card">
            <div class="sk-top">
                <div class="sk-emoji">${p.emoji || "🥩"}</div>
                <div><div class="sk-name">${p.name}</div><div class="sk-meta">${p.category} • ${formatCurrency(p.price)}</div></div>
            </div>
            <div class="sk-input-row">
                <label>Stock:</label>
                <input type="number" class="sk-input" id="sk-${id}" value="${p.onlineStock || 0}" min="0" max="999">
            </div>
        </div>
    `).join("");
}

function saveStock() {
    const updates = {};
    Object.keys(adminProducts).forEach(id => {
        const inp = document.getElementById("sk-" + id);
        if (inp) updates["products/" + id + "/onlineStock"] = parseInt(inp.value) || 0;
    });
    db.ref().update(updates).then(() => showToast("Stock updated!"));
}

/* ---- ORDERS ---- */
function renderOrders() {
    const list = document.getElementById("orders-list");
    let entries = Object.entries(adminOrders).sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

    if (orderFilter !== "all") entries = entries.filter(([, o]) => o.status === orderFilter);

    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-box"><div class="empty-ico">📋</div><h3>No orders found</h3></div>';
        return;
    }

    list.innerHTML = entries.map(([id, o]) => {
        const sc = statusClass(o.status);
        return `
        <div class="ao-card">
            <div class="ao-header" onclick="toggleDet('${id}')">
                <div class="ao-info">
                    <h4>${id} — ${o.customerName}</h4>
                    <p>${formatDate(o.createdAt)} • ${o.courier} • ${formatCurrency(o.total)}</p>
                </div>
                <span class="badge-s ${sc}">${o.status}</span>
            </div>
            <div class="ao-detail" id="det-${id}">
                <div class="det-grid">
                    <div><div class="det-label">Customer</div><div class="det-val">${o.customerName}</div></div>
                    <div><div class="det-label">Phone</div><div class="det-val">${o.phone}</div></div>
                    <div><div class="det-label">Address</div><div class="det-val">${o.address}</div></div>
                    <div><div class="det-label">Courier</div><div class="det-val">${o.courier === "Lalamove" ? "🏍️" : "📦"} ${o.courier}</div></div>
                    <div><div class="det-label">Receipt</div><div class="det-val">${
                        o.receipt ? `<img src="${o.receipt}" class="rcpt-thumb" onclick="viewRcpt('${id}')">` : "No receipt"
                    }</div></div>
                </div>
                <div class="det-items">
                    <h5>Items</h5>
                    ${o.items.map(i => `<div class="di-row"><span>${i.emoji||"🥩"} ${i.name} × ${i.qty} ${i.unit}</span><span>${formatCurrency(i.lineTotal)}</span></div>`).join("")}
                    <div class="di-row" style="font-weight:800;border:none;padding-top:8px;"><span>Total</span><span style="color:var(--primary)">${formatCurrency(o.total)}</span></div>
                </div>
                <div class="det-actions">${getActions(id, o)}</div>
            </div>
        </div>`;
    }).join("");
}

function getActions(id, o) {
    switch (o.status) {
        case "Pending": return `
            <button class="btn btn-success btn-sm" onclick="setStatus('${id}','Approved')">✅ Approve</button>
            <button class="btn btn-sm" style="background:var(--red-500);color:#fff;" onclick="setStatus('${id}','Rejected')">❌ Reject</button>`;
        case "Approved": return `
            <div style="width:100%">
                <small style="color:var(--text2)">${o.courier === "Lalamove" ? "Rider Name & Contact" : "LBC Tracking Number"}</small>
                <div class="trk-group">
                    <input type="text" class="trk-input" id="trk-${id}" placeholder="${o.courier === "Lalamove" ? "e.g. Mark - 0918 XXX" : "e.g. LBC-123456"}" value="${o.riderInfo || o.trackingInfo || ""}">
                    <button class="btn btn-sm" style="background:var(--orange-500);color:#fff;" onclick="shipOrder('${id}')">🚚 Ship</button>
                </div>
            </div>`;
        case "Out for Delivery": return `
            <button class="btn btn-success btn-sm" onclick="setStatus('${id}','Completed')">✅ Mark Completed</button>
            <span style="font-size:.83rem;color:var(--text2)">${o.courier === "Lalamove" ? "🏍️ " + (o.riderInfo || "") : "📦 " + (o.trackingInfo || "")}</span>`;
        case "Completed": return '<span style="color:var(--green-600);font-weight:600;">✅ Completed</span>';
        case "Rejected": return '<span style="color:var(--red-500);font-weight:600;">❌ Rejected</span>';
        default: return "";
    }
}

function toggleDet(id) {
    document.getElementById("det-" + id).classList.toggle("open");
}

function setStatus(id, status) {
    const updates = { status, updatedAt: new Date().toISOString() };

    // If rejecting a pending order, restore stock
    if (status === "Rejected") {
        const o = adminOrders[id];
        if (o && o.status === "Pending" && o.items) {
            o.items.forEach(item => {
                db.ref("products/" + item.productId + "/onlineStock").transaction(cur => (cur || 0) + item.qty);
            });
        }
    }

    db.ref("orders/" + id).update(updates).then(() => showToast(id + " → " + status));
}

function shipOrder(id) {
    const inp = document.getElementById("trk-" + id);
    const val = inp ? inp.value.trim() : "";
    if (!val) { showToast("Enter tracking/rider info first."); return; }

    const o = adminOrders[id];
    const updates = { status: "Out for Delivery", updatedAt: new Date().toISOString() };
    if (o.courier === "Lalamove") updates.riderInfo = val;
    else updates.trackingInfo = val;

    db.ref("orders/" + id).update(updates).then(() => showToast(id + " → Out for Delivery!"));
}

function fOrd(filter, btn) {
    orderFilter = filter;
    document.querySelectorAll(".fbtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderOrders();
}

function viewRcpt(id) {
    const o = adminOrders[id];
    if (o && o.receipt) {
        document.getElementById("rcpt-view").src = o.receipt;
        document.getElementById("rcpt-modal").classList.remove("hidden");
    }
}
function closeRcpt() { document.getElementById("rcpt-modal").classList.add("hidden"); }

/* ---- PRODUCTS CRUD ---- */
function renderProdTable() {
    const tbody = document.getElementById("prod-tbody");
    const entries = Object.entries(adminProducts);
    if (entries.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="muted">No products. Click "Add Product" or "Load Default Products".</td></tr>'; return; }

    tbody.innerHTML = entries.map(([id, p]) => `
        <tr>
            <td><div class="tp-cell"><div class="tp-emoji">${p.emoji || "🥩"}</div><span>${p.name}</span></div></td>
            <td><span class="p-cat-tag">${p.category}</span></td>
            <td><strong>${formatCurrency(p.price)}</strong></td>
            <td>${p.unit}</td>
            <td><strong>${p.onlineStock || 0}</strong></td>
            <td><div class="t-actions">
                <button class="t-btn t-btn-edit" onclick="editProd('${id}')">Edit</button>
                <button class="t-btn t-btn-del" onclick="delProd('${id}')">Delete</button>
            </div></td>
        </tr>`).join("");
}

function openProductModal() {
    document.getElementById("pm-title").textContent = "Add Product";
    document.getElementById("prod-form").reset();
    document.getElementById("pm-id").value = "";
    document.getElementById("pm-emoji").value = "🥩";
    document.getElementById("prod-modal").classList.remove("hidden");
}
function closeProdModal() { document.getElementById("prod-modal").classList.add("hidden"); }

function editProd(id) {
    const p = adminProducts[id];
    if (!p) return;
    document.getElementById("pm-title").textContent = "Edit Product";
    document.getElementById("pm-id").value = id;
    document.getElementById("pm-name").value = p.name;
    document.getElementById("pm-cat").value = p.category;
    document.getElementById("pm-price").value = p.price;
    document.getElementById("pm-unit").value = p.unit;
    document.getElementById("pm-emoji").value = p.emoji || "🥩";
    document.getElementById("prod-modal").classList.remove("hidden");
}

function saveProd(e) {
    e.preventDefault();
    const id = document.getElementById("pm-id").value || "p" + Date.now();
    const data = {
        name: document.getElementById("pm-name").value.trim(),
        category: document.getElementById("pm-cat").value,
        price: parseFloat(document.getElementById("pm-price").value),
        unit: document.getElementById("pm-unit").value.trim(),
        emoji: document.getElementById("pm-emoji").value.trim() || "🥩",
        onlineStock: (adminProducts[id] && adminProducts[id].onlineStock) || 0
    };
    db.ref("products/" + id).set(data).then(() => {
        closeProdModal();
        showToast("Product saved!");
    });
}

function delProd(id) {
    if (!confirm("Delete this product?")) return;
    db.ref("products/" + id).remove().then(() => showToast("Product deleted."));
}