

var adminProducts = {}, adminOrders = {}, adminCustomers = {}, orderFilter = "all";
var productImageBase64 = null;

/* ---- LOGIN ---- */
function doLogin(e) {
    e.preventDefault();
    var em = document.getElementById("a-email").value.trim();
    var pw = document.getElementById("a-pass").value;
    if (em === ADMIN_EMAIL && pw === ADMIN_PASSWORD) {
        sessionStorage.setItem("ml_admin", "true");
        showDashboard();
    } else {
        var err = document.getElementById("login-err");
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
        weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
    loadData();
}
if (sessionStorage.getItem("ml_admin") === "true") showDashboard();

/* ---- SIDEBAR ---- */
function openSB() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("mob-overlay").classList.add("show");
}
function closeSB() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("mob-overlay").classList.remove("show");
}
function aTab(name, el) {
    document.querySelectorAll(".a-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("at-" + name).classList.add("active");
    document.querySelectorAll(".sb-link").forEach(l => l.classList.remove("active"));
    if (el) el.classList.add("active");
    var titles = {
        dashboard: "Dashboard", stock: "Stock Management",
        orders: "Orders", products: "Products", customers: "Customers"
    };
    document.getElementById("a-title").textContent = titles[name] || "Dashboard";
    if (name === "customers") renderCustomers();
    if (name === "orders") renderOrders();
    closeSB();
}

/* ---- LOAD DATA ---- */
function loadData() {
    db.ref("products").on("value", snap => {
        adminProducts = snap.val() || {};
        refreshDash(); renderStockGrid(); renderProdTable();
    });
    db.ref("orders").on("value", snap => {
        adminOrders = snap.val() || {};
        refreshDash(); renderOrders();
    });
    db.ref("customers").on("value", snap => {
        adminCustomers = snap.val() || {};
        refreshDash();
    });
}

/* ---- DASHBOARD ---- */
function refreshDash() {
    var today = new Date().toDateString();
    var ordArr = Object.entries(adminOrders);
    var todayOrds = ordArr.filter(e => new Date(e[1].createdAt).toDateString() === today);
    var pending = ordArr.filter(e => e[1].status === "Pending");
    var revenue = todayOrds
        .filter(e => e[1].status !== "Rejected" && e[1].status !== "Cancelled")
        .reduce((s, e) => s + e[1].total, 0);

    document.getElementById("s-orders").textContent = todayOrds.length;
    document.getElementById("s-pending").textContent = pending.length;
    document.getElementById("s-revenue").textContent = formatCurrency(revenue);
    document.getElementById("s-users").textContent = Object.keys(adminCustomers).length;

    var pb = document.getElementById("pend-badge");
    pb.textContent = pending.length;
    pb.style.display = pending.length > 0 ? "inline" : "none";

    var recent = document.getElementById("d-recent");
    if (todayOrds.length === 0) {
        recent.innerHTML = '<p class="muted">No orders today.</p>';
    } else {
        recent.innerHTML = todayOrds.slice(0, 5).map(e =>
            `<div class="ro-item">
                <span>
                    <strong>${e[1].customerName}</strong><br>
                    <small>${e[0]} • ${formatCurrency(e[1].total)}</small>
                </span>
                <span class="badge-s ${statusClass(e[1].status)}">${e[1].status}</span>
            </div>`
        ).join("");
    }

    var prodArr = Object.entries(adminProducts);
    var lowEl = document.getElementById("d-lowstock");
    var low = prodArr.filter(e => (e[1].onlineStock || 0) <= 5);
    if (low.length === 0) {
        lowEl.innerHTML = '<p class="muted">All well stocked.</p>';
    } else {
        lowEl.innerHTML = low.map(e => {
            var stk = e[1].onlineStock || 0;
            return `<div class="ls-item"><span>${e[1].emoji || "🥩"} ${e[1].name}</span><span class="p-stock ${stk === 0 ? "stk-out" : "stk-low"}">${stk} left</span></div>`;
        }).join("");
    }

    var init = document.getElementById("init-section");
    if (init) init.style.display = prodArr.length === 0 ? "block" : "none";
}

function statusClass(s) {
    return {
        Pending: "bs-pending", Approved: "bs-approved",
        "Out for Delivery": "bs-delivering", Completed: "bs-completed",
        Rejected: "bs-rejected", Cancelled: "bs-cancelled"
    }[s] || "bs-pending";
}
function initProducts() {
    loadDefaultProducts().then(() => showToast("Default products loaded!"));
}

/* ---- STOCK MANAGEMENT ---- */
function renderStockGrid() {
    var grid = document.getElementById("stock-grid");
    var entries = Object.entries(adminProducts);
    if (entries.length === 0) {
        grid.innerHTML = '<p class="muted">No products yet. Add products first.</p>';
        return;
    }
    grid.innerHTML = entries.map(([id, p]) => `
        <div class="sk-card">
            <div class="sk-top">
                <div class="sk-emoji" style="overflow:hidden; border-radius:8px;">
                    ${p.image
                        ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
                        : (p.emoji || "🥩")
                    }
                </div>
                <div>
                    <div class="sk-name">${p.name}</div>
                    <div class="sk-meta">${p.category} • ${formatCurrency(p.price)}</div>
                </div>
            </div>
            <div class="sk-input-row">
                <label>Online Stock:</label>
                <input type="number" class="sk-input" id="sk-${id}" value="${p.onlineStock || 0}" min="0" max="999">
            </div>
        </div>`
    ).join("");
}

function saveStock() {
    var updates = {};
    Object.keys(adminProducts).forEach(id => {
        var inp = document.getElementById("sk-" + id);
        if (inp) updates["products/" + id + "/onlineStock"] = parseInt(inp.value) || 0;
    });
    db.ref().update(updates).then(() => showToast("Stock saved successfully!"));
}

/* ---- ORDERS ---- */
function renderOrders() {
    var list = document.getElementById("orders-list");
    var entries = Object.entries(adminOrders)
        .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
    if (orderFilter !== "all") entries = entries.filter(e => e[1].status === orderFilter);

    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-box"><div class="empty-ico">📋</div><h3>No orders found</h3></div>';
        return;
    }

    list.innerHTML = entries.map(([id, o]) => `
        <div class="ao-card">
            <div class="ao-header" onclick="toggleDet('${id}')">
                <div class="ao-info">
                    <h4>${id} — ${o.customerName}</h4>
                    <p>${formatDate(o.createdAt)} • ${o.courier} • ${formatCurrency(o.total)}</p>
                </div>
                <span class="badge-s ${statusClass(o.status)}">${o.status}</span>
            </div>
            <div class="ao-detail" id="det-${id}">
                <div class="det-grid">
                    <div><div class="det-label">Customer</div><div class="det-val">${o.customerName}</div></div>
                    <div><div class="det-label">Phone</div><div class="det-val">${o.phone}</div></div>
                    <div><div class="det-label">Address</div><div class="det-val">${o.address}</div></div>
                    <div><div class="det-label">Courier</div><div class="det-val">${o.courier === "Lalamove" ? "🏍️" : "📦"} ${o.courier}</div></div>
                    <div><div class="det-label">Account</div><div class="det-val">${o.customerEmail || "Guest"}</div></div>
                    <div><div class="det-label">GCash Receipt</div><div class="det-val">
                        ${o.receipt
                            ? `<img src="${o.receipt}" class="rcpt-thumb" onclick="viewRcpt('${id}')">`
                            : "No receipt uploaded"
                        }
                    </div></div>
                </div>
                <div class="det-items">
                    <h5>Items Ordered</h5>
                    ${o.items.map(i =>
                        `<div class="di-row">
                            <span>${i.emoji || "🥩"} ${i.name} × ${i.qty} ${i.unit}</span>
                            <span>${formatCurrency(i.lineTotal)}</span>
                        </div>`
                    ).join("")}
                    <div class="di-row" style="font-weight:800;border:none;padding-top:8px;">
                        <span>Total</span>
                        <span style="color:var(--primary)">${formatCurrency(o.total)}</span>
                    </div>
                </div>
                <div class="det-actions">${getActions(id, o)}</div>
            </div>
        </div>`
    ).join("");
}

function getActions(id, o) {
    switch (o.status) {
        case "Pending":
            return `
                <button class="btn btn-success btn-sm" onclick="setStatus('${id}','Approved')">✅ Approve Payment</button>
                <button class="btn btn-sm" style="background:var(--red-500);color:#fff;" onclick="setStatus('${id}','Rejected')">❌ Reject</button>`;
        case "Approved":
            return `
                <div style="width:100%">
                    <small style="color:var(--text2)">${o.courier === "Lalamove" ? "Rider Name & Contact" : "LBC Tracking Number"}</small>
                    <div class="trk-group">
                        <input type="text" class="trk-input" id="trk-${id}"
                            placeholder="${o.courier === "Lalamove" ? "e.g. Mark - 0918 XXX" : "e.g. LBC-123456"}"
                            value="${o.riderInfo || o.trackingInfo || ""}">
                        <button class="btn btn-sm" style="background:var(--orange-500);color:#fff;" onclick="shipOrder('${id}')">🚚 Mark as Shipped</button>
                    </div>
                </div>`;
        case "Out for Delivery":
            return `
                <button class="btn btn-success btn-sm" onclick="setStatus('${id}','Completed')">✅ Mark as Completed</button>
                <span style="font-size:.83rem;color:var(--text2)">
                    ${o.courier === "Lalamove" ? "🏍️ " + (o.riderInfo || "") : "📦 " + (o.trackingInfo || "")}
                </span>`;
        case "Completed": return '<span style="color:var(--green-600);font-weight:600;">✅ Order Completed</span>';
        case "Rejected": return '<span style="color:var(--red-500);font-weight:600;">❌ Order Rejected</span>';
        case "Cancelled": return '<span style="color:var(--gray-500);font-weight:600;">🚫 Cancelled by Customer</span>';
        default: return "";
    }
}

function toggleDet(id) {
    document.getElementById("det-" + id).classList.toggle("open");
}
function setStatus(id, status) {
    if (status === "Rejected") {
        var o = adminOrders[id];
        if (o && o.status === "Pending" && o.items) {
            o.items.forEach(item => {
                db.ref("products/" + item.productId + "/onlineStock")
                    .transaction(cur => (cur || 0) + item.qty);
            });
        }
    }
    db.ref("orders/" + id).update({ status, updatedAt: new Date().toISOString() })
        .then(() => showToast(id + " → " + status));
}
function shipOrder(id) {
    var val = document.getElementById("trk-" + id).value.trim();
    if (!val) { showToast("Enter tracking/rider info first."); return; }
    var o = adminOrders[id];
    var updates = { status: "Out for Delivery", updatedAt: new Date().toISOString() };
    if (o.courier === "Lalamove") updates.riderInfo = val;
    else updates.trackingInfo = val;
    db.ref("orders/" + id).update(updates).then(() => showToast(id + " is now Out for Delivery!"));
}
function fOrd(filter, btn) {
    orderFilter = filter;
    document.querySelectorAll(".fbtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderOrders();
}
function viewRcpt(id) {
    var o = adminOrders[id];
    if (o && o.receipt) {
        document.getElementById("rcpt-view").src = o.receipt;
        document.getElementById("rcpt-modal").classList.remove("hidden");
    }
}
function closeRcpt() { document.getElementById("rcpt-modal").classList.add("hidden"); }

/* ---- PRODUCTS TABLE ---- */
function renderProdTable() {
    var tbody = document.getElementById("prod-tbody");
    var entries = Object.entries(adminProducts);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted">No products yet. Click "Add Product".</td></tr>';
        return;
    }
    tbody.innerHTML = entries.map(([id, p]) => `
        <tr>
            <td>
                <div style="width:55px;height:55px;border-radius:8px;overflow:hidden;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">
                    ${p.image
                        ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">`
                        : (p.emoji || "🥩")
                    }
                </div>
            </td>
            <td><strong>${p.name}</strong></td>
            <td><span class="p-cat-tag">${p.category}</span></td>
            <td><strong>${formatCurrency(p.price)}</strong></td>
            <td>${p.unit}</td>
            <td><strong>${p.onlineStock || 0}</strong></td>
            <td>
                <div class="t-actions">
                    <button class="t-btn t-btn-edit" onclick="editProd('${id}')">✏️ Edit</button>
                    <button class="t-btn t-btn-del" onclick="delProd('${id}')">🗑️ Delete</button>
                </div>
            </td>
        </tr>`
    ).join("");
}

/* ============================================
   IMAGE HANDLING — Base64 (No Firebase Storage)
   ============================================ */

function previewProductImage(e) {
    var file = e.target.files[0];
    if (!file) return;

    // Check file size — warn if too big
    var sizeKB = file.size / 1024;
    if (sizeKB > 2048) {
        showToast("Image too large! Please use an image under 2MB.");
        e.target.value = "";
        return;
    }

    // Compress then preview
    compressProductImage(file, 500, 0.75).then(base64 => {
        productImageBase64 = base64;
        document.getElementById("img-preview-el").src = base64;
        document.getElementById("img-upload-placeholder").classList.add("hidden");
        document.getElementById("img-upload-preview").classList.remove("hidden");
        var sizeAfterKB = Math.round(base64.length * 0.75 / 1024);
        showToast("Image ready! Compressed to ~" + sizeAfterKB + "KB");
    });
}

function compressProductImage(file, maxSize, quality) {
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.onload = e => {
            var img = new Image();
            img.onload = () => {
                var canvas = document.createElement("canvas");
                var w = img.width, h = img.height;
                // Resize to max dimension
                if (w > h) {
                    if (w > maxSize) { h = (maxSize / w) * h; w = maxSize; }
                } else {
                    if (h > maxSize) { w = (maxSize / h) * w; h = maxSize; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function removeProductImage() {
    productImageBase64 = null;
    document.getElementById("pm-image-file").value = "";
    document.getElementById("pm-existing-image").value = "";
    document.getElementById("img-preview-el").src = "";
    document.getElementById("img-upload-placeholder").classList.remove("hidden");
    document.getElementById("img-upload-preview").classList.add("hidden");
}

/* ---- PRODUCT MODAL ---- */
function openProductModal() {
    document.getElementById("pm-title").textContent = "Add Product";
    document.getElementById("prod-form").reset();
    document.getElementById("pm-id").value = "";
    document.getElementById("pm-emoji").value = "🥩";
    document.getElementById("pm-existing-image").value = "";
    productImageBase64 = null;
    document.getElementById("img-upload-placeholder").classList.remove("hidden");
    document.getElementById("img-upload-preview").classList.add("hidden");
    document.getElementById("prod-modal").classList.remove("hidden");
}

function closeProdModal() {
    document.getElementById("prod-modal").classList.add("hidden");
    productImageBase64 = null;
}

function editProd(id) {
    var p = adminProducts[id];
    if (!p) return;

    document.getElementById("pm-title").textContent = "Edit Product";
    document.getElementById("pm-id").value = id;
    document.getElementById("pm-name").value = p.name;
    document.getElementById("pm-cat").value = p.category;
    document.getElementById("pm-price").value = p.price;
    document.getElementById("pm-unit").value = p.unit;
    document.getElementById("pm-emoji").value = p.emoji || "🥩";
    document.getElementById("pm-existing-image").value = p.image || "";
    productImageBase64 = null;

    if (p.image) {
        document.getElementById("img-preview-el").src = p.image;
        document.getElementById("img-upload-placeholder").classList.add("hidden");
        document.getElementById("img-upload-preview").classList.remove("hidden");
    } else {
        document.getElementById("img-upload-placeholder").classList.remove("hidden");
        document.getElementById("img-upload-preview").classList.add("hidden");
    }

    document.getElementById("prod-modal").classList.remove("hidden");
}

function saveProd(e) {
    e.preventDefault();
    var btn = document.getElementById("pm-save-btn");
    btn.disabled = true;
    btn.textContent = "Saving...";

    var id = document.getElementById("pm-id").value || "p" + Date.now();
    var existingImage = document.getElementById("pm-existing-image").value || "";

    // Use new base64 image if uploaded, otherwise keep existing
    var imageToSave = productImageBase64 || existingImage;

    var data = {
        name: document.getElementById("pm-name").value.trim(),
        category: document.getElementById("pm-cat").value,
        price: parseFloat(document.getElementById("pm-price").value),
        unit: document.getElementById("pm-unit").value.trim(),
        emoji: document.getElementById("pm-emoji").value.trim() || "🥩",
        image: imageToSave,
        onlineStock: (adminProducts[id] && adminProducts[id].onlineStock) || 0
    };

    db.ref("products/" + id).set(data)
        .then(() => {
            closeProdModal();
            showToast("✅ Product saved successfully!");
        })
        .catch(err => {
            // If too large for database, save without image
            if (err.message.includes("size") || err.message.includes("limit")) {
                showToast("⚠️ Image too large for database. Saving without image. Try a smaller image.");
                data.image = "";
                db.ref("products/" + id).set(data).then(() => {
                    closeProdModal();
                    showToast("Product saved (without image).");
                });
            } else {
                showToast("Error saving product: " + err.message);
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = "Save Product";
        });
}

function delProd(id) {
    if (!confirm("Delete '" + adminProducts[id].name + "'? This cannot be undone.")) return;
    db.ref("products/" + id).remove().then(() => showToast("Product deleted."));
}

/* ---- CUSTOMERS ---- */
function renderCustomers() {
    var tbody = document.getElementById("cust-tbody");
    var entries = Object.entries(adminCustomers);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">No registered customers yet.</td></tr>';
        return;
    }
    tbody.innerHTML = entries.map(([, c]) => `
        <tr>
            <td><strong>${c.fullName || "N/A"}</strong></td>
            <td>${c.email}</td>
            <td>${c.phone || "-"}</td>
            <td>${c.address || "-"}</td>
            <td>${formatDate(c.createdAt)}</td>
        </tr>`
    ).join("");
}
