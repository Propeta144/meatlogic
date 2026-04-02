/* ============================================
   MEATLOGIC — Customer Logic
   No login needed. Cart in localStorage.
   Products & Orders in Firebase.
   ============================================ */

let allProducts = {};
let cart = JSON.parse(localStorage.getItem("ml_cart") || "[]");
let receiptData = null;
let currentCat = "all";

/* ---- NAV & TABS ---- */
function showTab(tab, el) {
    document.querySelectorAll(".page-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.add("active");
    document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
    if (el) el.classList.add("active");
    else {
        document.querySelectorAll(".nav-link").forEach(n => {
            if (n.dataset.tab === tab) n.classList.add("active");
        });
    }
    if (tab === "cart") renderCart();
    closeMobile();
    window.scrollTo(0, 0);
}

function toggleMobile() {
    document.getElementById("nav-links").classList.toggle("open");
}
function closeMobile() {
    document.getElementById("nav-links").classList.remove("open");
}

/* ---- LOAD PRODUCTS (Real-time from Firebase) ---- */
db.ref("products").on("value", snap => {
    const data = snap.val();
    document.getElementById("loading").classList.add("hidden");

    if (!data) {
        document.getElementById("products-grid").innerHTML =
            '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">📦</div><h3>No products yet</h3><p>The admin hasn\'t added products yet. Check back soon!</p></div>';
        allProducts = {};
        return;
    }
    allProducts = data;
    renderProducts();
});

function renderProducts() {
    const grid = document.getElementById("products-grid");
    const entries = Object.entries(allProducts);

    const filtered = currentCat === "all"
        ? entries
        : entries.filter(([, p]) => p.category === currentCat);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">🔍</div><h3>No products in this category</h3></div>';
        return;
    }

    grid.innerHTML = filtered.map(([id, p]) => {
        const stk = p.onlineStock || 0;
        const out = stk <= 0;
        const low = stk > 0 && stk <= 5;
        const sClass = out ? "stk-out" : low ? "stk-low" : "stk-ok";
        const sText = out ? "Sold Out" : stk + " left";
        const inCart = cart.find(c => c.id === id);
        const qty = inCart ? inCart.qty : 0;

        return `
        <div class="p-card">
            <div class="p-card-top">${p.emoji || "🥩"}</div>
            <div class="p-card-body">
                <span class="p-cat-tag">${p.category}</span>
                <h3>${p.name}</h3>
                <p class="p-unit">${p.unit}</p>
                <div class="p-foot">
                    <span class="p-price">${formatCurrency(p.price)}</span>
                    <span class="p-stock ${sClass}">${sText}</span>
                </div>
            </div>
            <div class="p-actions">
                ${out ? '<button class="btn btn-ghost btn-full btn-sm" disabled>Sold Out</button>' : `
                <div class="qty-row">
                    <button class="qty-btn" onclick="chgQty('${id}',-1)">−</button>
                    <span class="qty-val" id="q-${id}">${qty}</span>
                    <button class="qty-btn" onclick="chgQty('${id}',1)">+</button>
                </div>
                <button class="btn btn-primary btn-full btn-sm" onclick="addCart('${id}')">${qty > 0 ? "Update Cart" : "Add to Cart"}</button>
                `}
            </div>
        </div>`;
    }).join("");
}

function filterCat(cat, btn) {
    currentCat = cat;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderProducts();
}

/* ---- QUANTITY ---- */
function chgQty(id, d) {
    const el = document.getElementById("q-" + id);
    if (!el) return;
    let v = parseInt(el.textContent) + d;
    const max = (allProducts[id] && allProducts[id].onlineStock) || 0;
    if (v < 0) v = 0;
    if (v > max) { v = max; showToast("Max stock is " + max); }
    el.textContent = v;
}

/* ---- CART ---- */
function addCart(id) {
    const el = document.getElementById("q-" + id);
    const qty = parseInt(el.textContent);
    const p = allProducts[id];
    if (!p) return;

    if (qty <= 0) {
        cart = cart.filter(c => c.id !== id);
        saveCart(); updateBadge(); renderProducts();
        showToast("Removed from cart");
        return;
    }
    if (qty > (p.onlineStock || 0)) { showToast("Not enough stock"); return; }

    const ex = cart.find(c => c.id === id);
    if (ex) ex.qty = qty; else cart.push({ id, qty });
    saveCart(); updateBadge(); renderProducts();
    showToast("Cart updated!");
}

function removeCart(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart(); updateBadge(); renderCart(); renderProducts();
}

function saveCart() { localStorage.setItem("ml_cart", JSON.stringify(cart)); }

function updateBadge() {
    const n = cart.reduce((s, c) => s + c.qty, 0);
    document.getElementById("cart-count").textContent = n;
}

function renderCart() {
    const empty = document.getElementById("cart-empty");
    const filled = document.getElementById("cart-filled");
    const items = document.getElementById("cart-items");
    const lines = document.getElementById("summary-lines");
    const totalEl = document.getElementById("summary-total");

    if (cart.length === 0) {
        empty.classList.remove("hidden"); filled.classList.add("hidden");
        return;
    }
    empty.classList.add("hidden"); filled.classList.remove("hidden");

    let html = "", sumHtml = "", total = 0;
    cart.forEach(c => {
        const p = allProducts[c.id];
        if (!p) return;
        const lt = p.price * c.qty;
        total += lt;
        html += `
        <div class="c-item">
            <div class="c-item-emoji">${p.emoji || "🥩"}</div>
            <div class="c-item-info"><h4>${p.name}</h4><p>${formatCurrency(p.price)} × ${c.qty} ${p.unit}</p></div>
            <span class="c-item-price">${formatCurrency(lt)}</span>
            <button class="c-item-del" onclick="removeCart('${c.id}')">✕</button>
        </div>`;
        sumHtml += `<div class="sum-line"><span>${p.name} × ${c.qty}</span><span>${formatCurrency(lt)}</span></div>`;
    });

    items.innerHTML = html;
    lines.innerHTML = sumHtml;
    totalEl.textContent = formatCurrency(total);
}

/* ---- RECEIPT ---- */
function onReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("File too large. Max 5MB."); return; }
    compressImage(file, 600, 0.5).then(data => {
        receiptData = data;
        document.getElementById("receipt-img").src = data;
        document.getElementById("upload-ph").classList.add("hidden");
        document.getElementById("upload-pv").classList.remove("hidden");
    });
}

function clearReceipt() {
    receiptData = null;
    document.getElementById("receipt-file").value = "";
    document.getElementById("upload-ph").classList.remove("hidden");
    document.getElementById("upload-pv").classList.add("hidden");
}

/* ---- PLACE ORDER ---- */
async function placeOrder() {
    const name = document.getElementById("c-name").value.trim();
    const phone = document.getElementById("c-phone").value.trim();
    const address = document.getElementById("c-address").value.trim();
    const courier = document.querySelector('input[name="courier"]:checked').value;

    if (!name || !phone || !address) { showToast("Please fill in all required fields."); return; }
    if (cart.length === 0) { showToast("Cart is empty."); return; }
    if (!receiptData) { showToast("Please upload your GCash receipt."); return; }

    const btn = document.getElementById("btn-place");
    btn.disabled = true; btn.textContent = "Placing order...";

    try {
        // Verify stock and build items
        const snap = await db.ref("products").once("value");
        const liveProducts = snap.val() || {};
        let total = 0;
        const items = [];

        for (const c of cart) {
            const p = liveProducts[c.id];
            if (!p) { showToast("Product not found: " + c.id); btn.disabled = false; btn.textContent = "Place Order"; return; }
            if ((p.onlineStock || 0) < c.qty) {
                showToast(p.name + " only has " + (p.onlineStock || 0) + " left.");
                btn.disabled = false; btn.textContent = "Place Order"; return;
            }
            const lt = p.price * c.qty;
            total += lt;
            items.push({ productId: c.id, name: p.name, emoji: p.emoji, price: p.price, qty: c.qty, unit: p.unit, lineTotal: lt });
        }

        // Deduct stock using transactions
        for (const c of cart) {
            await db.ref("products/" + c.id + "/onlineStock").transaction(cur => {
                if (cur === null) return 0;
                return Math.max(0, cur - c.qty);
            });
        }

        // Create order
        const orderId = "ORD-" + Date.now().toString().slice(-8);
        await db.ref("orders/" + orderId).set({
            customerName: name,
            phone: phone,
            address: address,
            items: items,
            total: total,
            courier: courier,
            receipt: receiptData,
            status: "Pending",
            trackingInfo: "",
            riderInfo: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Clear cart & form
        cart = [];
        saveCart(); updateBadge(); clearReceipt();
        document.getElementById("c-name").value = "";
        document.getElementById("c-phone").value = "";
        document.getElementById("c-address").value = "";

        // Show success
        document.getElementById("oid-box").textContent = orderId;
        document.getElementById("modal-success").classList.remove("hidden");

    } catch (err) {
        console.error(err);
        showToast("Error placing order. Please try again.");
    }

    btn.disabled = false; btn.textContent = "Place Order";
}

function closeSuccess() {
    document.getElementById("modal-success").classList.add("hidden");
    showTab("shop");
}

/* ---- TRACK ORDER ---- */
async function trackOrder() {
    const id = document.getElementById("track-id").value.trim().toUpperCase();
    const result = document.getElementById("track-result");

    if (!id) { showToast("Enter an Order ID"); return; }

    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

    const snap = await db.ref("orders/" + id).once("value");
    const order = snap.val();

    if (!order) {
        result.innerHTML = '<div class="empty-box"><div class="empty-ico">❌</div><h3>Order not found</h3><p>Check the Order ID and try again.</p></div>';
        return;
    }

    const sc = { Pending: "bs-pending", Approved: "bs-approved", "Out for Delivery": "bs-delivering", Completed: "bs-completed", Rejected: "bs-rejected" };

    let trackingHtml = "";
    if (order.riderInfo || order.trackingInfo) {
        trackingHtml = `<div class="track-tracking">${
            order.courier === "Lalamove" && order.riderInfo ? "🏍️ <strong>Rider:</strong> " + order.riderInfo :
            order.trackingInfo ? "📦 <strong>Tracking #:</strong> " + order.trackingInfo : ""
        }</div>`;
    }

    result.innerHTML = `
    <div class="track-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <h3>${id}</h3>
            <span class="badge-s ${sc[order.status] || "bs-pending"}">${order.status}</span>
        </div>
        <div class="track-grid">
            <div><div class="tg-label">Customer</div><div class="tg-value">${order.customerName}</div></div>
            <div><div class="tg-label">Phone</div><div class="tg-value">${order.phone}</div></div>
            <div><div class="tg-label">Courier</div><div class="tg-value">${order.courier === "Lalamove" ? "🏍️" : "📦"} ${order.courier}</div></div>
            <div><div class="tg-label">Date</div><div class="tg-value">${formatDate(order.createdAt)}</div></div>
        </div>
        <div class="track-items">
            ${order.items.map(i => `<div class="ti-row"><span>${i.emoji||"🥩"} ${i.name} × ${i.qty}</span><span>${formatCurrency(i.lineTotal)}</span></div>`).join("")}
            <div class="track-total"><span>Total</span><span style="color:var(--primary)">${formatCurrency(order.total)}</span></div>
        </div>
        ${trackingHtml}
    </div>`;
}

/* ---- INIT ---- */
updateBadge();