var allProducts = {}, cart = JSON.parse(localStorage.getItem("ml_cart") || "[]"), receiptData = null, currentCat = "all", currentUser = null, cancelTarget = null;

// --- Main UI/Tab Functions ---
function showTab(tab, el) {
    document.querySelectorAll(".page-tab").forEach(t => t.classList.remove("active"));
    var target = document.getElementById("tab-" + tab);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
    if (el) el.classList.add("active");
    else document.querySelectorAll(".nav-link[data-tab='" + tab + "']").forEach(n => n.classList.add("active"));
    if (tab === "cart") renderCart();
    if (tab === "myorders") loadMyOrders();
    if (tab === "profile") loadProfile();
    closeMobile(); window.scrollTo(0, 0);
}
function toggleMobile() { document.getElementById("nav-links").classList.toggle("open"); }
function closeMobile() { document.getElementById("nav-links").classList.remove("open"); }

// --- Auth UI and State ---
function updateUIForUser(user) {
    var navAuth = document.getElementById("nav-auth"), navProfile = document.getElementById("nav-profile"), navMyOrders = document.getElementById("nav-myorders"), navUsername = document.getElementById("nav-username");
    if (user) {
        navAuth.style.display = "none"; navProfile.style.display = ""; navMyOrders.style.display = "";
        navUsername.textContent = user.fullName ? user.fullName.split(' ')[0] : "Account";
    } else {
        navAuth.style.display = ""; navProfile.style.display = "none"; navMyOrders.style.display = "none";
        navUsername.textContent = "Account";
    }
}
function showAuthForm(view) {
    document.getElementById('auth-error').classList.add('hidden');
    if (view === 'initial') {
        document.getElementById('auth-view-initial').classList.remove('hidden');
        document.getElementById('auth-view-sent').classList.add('hidden');
    } else {
        document.getElementById('auth-view-initial').classList.add('hidden');
        document.getElementById('auth-view-sent').classList.remove('hidden');
    }
}
function setCurrentUser(id, data) {
    currentUser = { id: id, fullName: data.fullName, email: data.email, phone: data.phone, address: data.address };
    localStorage.setItem('ml_user', JSON.stringify(currentUser));
    updateUIForUser(currentUser);
}
function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('ml_user');
    updateUIForUser(null);
}

// --- Firebase Auth Handlers ---
firebase.auth().onAuthStateChanged(firebaseUser => {
    if (firebaseUser) {
        db.ref('customers/' + firebaseUser.uid).once('value').then(snap => {
            if (snap.exists()) setCurrentUser(firebaseUser.uid, snap.val());
            else processUserLogin(firebaseUser, true);
        });
    } else { clearCurrentUser(); }
});
function sendEmailLink(e) {
    e.preventDefault();
    var email = document.getElementById('auth-email').value, btn = document.getElementById('btn-send-link');
    btn.disabled = true; btn.textContent = 'Sending...';
    var actionCodeSettings = { url: window.location.origin, handleCodeInApp: true };
    firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            localStorage.setItem('emailForSignIn', email);
            document.getElementById('sent-email-display').textContent = email;
            showAuthForm('sent');
        }).catch(error => {
            document.getElementById('auth-error').textContent = error.message;
            document.getElementById('auth-error').classList.remove('hidden');
        }).finally(() => { btn.disabled = false; btn.textContent = 'Send Sign-in Link'; });
}
function handleSignInLink() {
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        var email = localStorage.getItem('emailForSignIn');
        if (!email) email = window.prompt('Please provide your email to complete sign-in');
        if (email) {
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then(result => {
                    localStorage.removeItem('emailForSignIn');
                    window.history.replaceState({}, document.title, window.location.pathname);
                    processUserLogin(result.user, result.additionalUserInfo.isNewUser);
                }).catch(error => showToast('Error: ' + error.message));
        }
    }
}
function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(result => processUserLogin(result.user, result.additionalUserInfo.isNewUser))
        .catch(error => showToast('Google Sign-in failed: ' + error.message));
}
function processUserLogin(firebaseUser, isNew) {
    if (isNew) {
        var userData = { fullName: firebaseUser.displayName || "", email: firebaseUser.email, phone: firebaseUser.phoneNumber || "", address: "", createdAt: new Date().toISOString() };
        db.ref('customers/' + firebaseUser.uid).set(userData).then(() => {
            setCurrentUser(firebaseUser.uid, userData);
            showToast('Welcome to MeatLogic!');
            showTab('profile');
        });
    } else { showToast('Welcome back!'); showTab('shop'); }
}
function doCustomerLogout() {
    firebase.auth().signOut().then(() => { showToast("Logged out."); showTab("home"); });
}

// --- Profile ---
function loadProfile() {
    if (!currentUser) { showTab("auth"); return; }
    document.getElementById("profile-avatar").textContent = (currentUser.fullName || "U").charAt(0).toUpperCase();
    document.getElementById("profile-fullname").textContent = currentUser.fullName || "User";
    document.getElementById("profile-email-display").textContent = currentUser.email || "";
    document.getElementById("prof-name").value = currentUser.fullName || "";
    document.getElementById("prof-phone").value = currentUser.phone || "";
    document.getElementById("prof-address").value = currentUser.address || "";
}
function saveProfile() {
    if (!currentUser) return;
    var name = document.getElementById("prof-name").value.trim(), phone = document.getElementById("prof-phone").value.trim(), address = document.getElementById("prof-address").value.trim();
    var updates = { fullName: name, phone: phone, address: address };
    db.ref("customers/" + currentUser.id).update(updates).then(() => {
        currentUser.fullName = name; currentUser.phone = phone; currentUser.address = address;
        localStorage.setItem('ml_user', JSON.stringify(currentUser));
        updateUIForUser(currentUser);
        showToast("Profile updated!");
    });
}

// --- Products & Cart Logic ---
db.ref("products").on("value", snap => {
    var data = snap.val(); document.getElementById("loading").classList.add("hidden");
    allProducts = data || {}; renderProducts();
});
function renderProducts() {
    var grid = document.getElementById("products-grid");
    var entries = Object.entries(allProducts);
    var filtered = currentCat === "all" ? entries : entries.filter(e => e[1].category === currentCat);
    if (entries.length === 0) { grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><h3>Admin has not added products yet.</h3></div>'; return; }
    if (filtered.length === 0) { grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><h3>No products in this category.</h3></div>'; return; }
    grid.innerHTML = filtered.map(e => {
        var id = e[0], p = e[1];
        var stk = p.onlineStock || 0, out = stk <= 0, low = stk > 0 && stk <= 5;
        var sClass = out ? "stk-out" : low ? "stk-low" : "stk-ok", sText = out ? "Sold Out" : stk + " left";
        var inCart = cart.find(c => c.id === id), qty = inCart ? inCart.qty : 0;
        return `<div class="p-card"><div class="p-card-top">${p.emoji || "🥩"}</div><div class="p-card-body"><span class="p-cat-tag">${p.category}</span><h3>${p.name}</h3><p class="p-unit">${p.unit}</p><div class="p-foot"><span class="p-price">${formatCurrency(p.price)}</span><span class="p-stock ${sClass}">${sText}</span></div></div><div class="p-actions">${out ? `<button class="btn btn-ghost btn-full btn-sm" disabled>Sold Out</button>` : `<div class="qty-row"><button class="qty-btn" onclick="chgQty('${id}',-1)">−</button><span class="qty-val" id="q-${id}">${qty}</span><button class="qty-btn" onclick="chgQty('${id}',1)">+</button></div><button class="btn btn-primary btn-full btn-sm" onclick="addCart('${id}')">${qty > 0 ? "Update Cart" : "Add to Cart"}</button>`}</div></div>`;
    }).join("");
}
function filterCat(cat, btn) { currentCat = cat; document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); renderProducts(); }
function chgQty(id, d) {
    var el = document.getElementById("q-" + id); if (!el) return;
    var v = parseInt(el.textContent) + d, max = (allProducts[id] && allProducts[id].onlineStock) || 0;
    if (v < 0) v = 0; if (v > max) { v = max; showToast("Max stock is " + max); }
    el.textContent = v;
}
function addCart(id) {
    var qty = parseInt(document.getElementById("q-" + id).textContent), p = allProducts[id];
    if (!p) return; if (qty <= 0) cart = cart.filter(c => c.id !== id);
    else { if (qty > (p.onlineStock || 0)) { showToast("Not enough stock"); return; } var ex = cart.find(c => c.id === id); if (ex) ex.qty = qty; else cart.push({ id, qty }); }
    saveCart(); updateBadge(); renderProducts(); showToast("Cart updated!");
}
function removeCart(id) { cart = cart.filter(c => c.id !== id); saveCart(); updateBadge(); renderCart(); renderProducts(); }
function saveCart() { localStorage.setItem("ml_cart", JSON.stringify(cart)); }
function updateBadge() { document.getElementById("cart-count").textContent = cart.reduce((s, c) => s + c.qty, 0); }

// --- Checkout ---
function renderCart() {
    var empty = document.getElementById("cart-empty"), loginWall = document.getElementById("cart-login-wall"), filled = document.getElementById("cart-filled"), items = document.getElementById("cart-items"), lines = document.getElementById("summary-lines"), totalEl = document.getElementById("summary-total");
    loginWall.classList.add('hidden'); filled.classList.add('hidden'); empty.classList.add('hidden');

    if (cart.length === 0) { empty.classList.remove('hidden'); return; }
    if (!currentUser) { loginWall.classList.remove('hidden'); return; }
    
    filled.classList.remove('hidden');
    document.getElementById("c-name").value = currentUser.fullName || "";
    document.getElementById("c-phone").value = currentUser.phone || "";
    document.getElementById("c-address").value = currentUser.address || "";
    
    var html = "", sumHtml = "", total = 0;
    cart.forEach(c => {
        var p = allProducts[c.id]; if (!p) return;
        var lt = p.price * c.qty; total += lt;
        html += `<div class="c-item"><div class="c-item-emoji">${p.emoji || "🥩"}</div><div class="c-item-info"><h4>${p.name}</h4><p>${formatCurrency(p.price)} × ${c.qty} ${p.unit}</p></div><span class="c-item-price">${formatCurrency(lt)}</span><button class="c-item-del" onclick="removeCart('${c.id}')">✕</button></div>`;
        sumHtml += `<div class="sum-line"><span>${p.name} × ${c.qty}</span><span>${formatCurrency(lt)}</span></div>`;
    });
    items.innerHTML = html; lines.innerHTML = sumHtml; totalEl.textContent = formatCurrency(total);
}
function onReceipt(e) {
    var file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("File too large (Max 5MB)."); return; }
    compressImage(file, 800, 0.6).then(data => {
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
function placeOrder() {
    if (!currentUser) { showToast("Please log in to order."); showTab('auth'); return; }
    var name = document.getElementById("c-name").value.trim(), phone = document.getElementById("c-phone").value.trim(), address = document.getElementById("c-address").value.trim(), courier = document.querySelector('input[name="courier"]:checked').value;
    if (!name || !phone || !address) { showToast("Please fill in your details."); return; }
    if (cart.length === 0) { showToast("Cart is empty."); return; }
    if (!receiptData) { showToast("Please upload your GCash receipt."); return; }
    var btn = document.getElementById("btn-place"); btn.disabled = true; btn.textContent = "Placing order...";
    db.ref("products").once("value").then(snap => {
        var liveProducts = snap.val() || {}, total = 0, items = [];
        for (var i = 0; i < cart.length; i++) {
            var c = cart[i], p = liveProducts[c.id];
            if (!p || (p.onlineStock || 0) < c.qty) { showToast((p ? p.name : "An item") + " is out of stock."); btn.disabled = false; btn.textContent = "Place Order"; return; }
            items.push({ productId: c.id, name: p.name, emoji: p.emoji, price: p.price, qty: c.qty, unit: p.unit, lineTotal: p.price * c.qty }); total += p.price * c.qty;
        }
        var promises = cart.map(c => db.ref("products/" + c.id + "/onlineStock").transaction(cur => Math.max(0, (cur || 0) - c.qty)));
        Promise.all(promises).then(() => {
            var orderId = "ORD-" + Date.now().toString().slice(-8);
            var orderData = { customerName: name, phone: phone, address: address, items, total, courier, receipt: receiptData, status: "Pending", customerId: currentUser.id, customerEmail: currentUser.email, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            db.ref("orders/" + orderId).set(orderData).then(() => {
                cart = []; saveCart(); updateBadge(); clearReceipt();
                document.getElementById("oid-box").textContent = orderId;
                document.getElementById("modal-success").classList.remove("hidden");
            });
        }).finally(() => { btn.disabled = false; btn.textContent = "Place Order"; });
    });
}
function closeSuccess() { document.getElementById("modal-success").classList.add("hidden"); }

// --- My Orders & Cancellation ---
function loadMyOrders() {
    if (!currentUser) { showTab("auth"); return; }
    var container = document.getElementById("myorders-list"); container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    db.ref("orders").orderByChild("customerId").equalTo(currentUser.id).on("value", snap => { // Use .on() for real-time updates
        var data = snap.val(); if (!data) { container.innerHTML = '<div class="empty-box"><h3>No orders yet</h3></div>'; return; }
        var orders = Object.entries(data).sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));
        container.innerHTML = orders.map(e => {
            var id = e[0], o = e[1], sc = statusBadgeClass(o.status), itemsList = o.items.map(i => `${i.emoji || "🥩"} ${i.name} × ${i.qty}`).join(" • ");
            var trackingHtml = "", cancelHtml = "";
            if (o.riderInfo || o.trackingInfo) trackingHtml = `<div class="oc-tracking">${o.courier === "Lalamove" && o.riderInfo ? `🏍️ <strong>Rider:</strong> ${o.riderInfo}` : o.trackingInfo ? `📦 <strong>Tracking #:</strong> ${o.trackingInfo}` : ""}</div>`;
            if (o.status === "Pending") cancelHtml = `<div class="oc-actions"><button class="btn-cancel-order" onclick="openCancelModal('${id}')">❌ Cancel Order</button></div>`;
            return `<div class="order-card"><div class="oc-header"><div><span class="oc-id">${id}</span><span class="oc-date"> • ${formatDate(o.createdAt)}</span></div><span class="badge-s ${sc}">${o.status}</span></div><p class="oc-items">${itemsList}</p>${trackingHtml}<div class="oc-footer"><span class="oc-total">${formatCurrency(o.total)}</span><span class="oc-courier">${o.courier === "Lalamove" ? "🏍️" : "📦"} ${o.courier}</span></div>${cancelHtml}</div>`;
        }).join("");
    });
}
function openCancelModal(orderId) { cancelTarget = orderId; document.getElementById("cancel-order-id").textContent = orderId; document.getElementById("modal-cancel").classList.remove("hidden"); }
function closeCancelModal() { cancelTarget = null; document.getElementById("modal-cancel").classList.add("hidden"); }
function confirmCancelOrder() {
    if (!cancelTarget) return;
    db.ref("orders/" + cancelTarget).once("value").then(snap => {
        var order = snap.val(); if (!order || order.status !== "Pending") { showToast("This order can no longer be cancelled."); closeCancelModal(); return; }
        var promises = order.items.map(item => db.ref("products/" + item.productId + "/onlineStock").transaction(cur => (cur || 0) + item.qty));
        Promise.all(promises).then(() => db.ref("orders/" + cancelTarget).update({ status: "Cancelled", updatedAt: new Date().toISOString() }))
            .then(() => { showToast("Order " + cancelTarget + " has been cancelled."); closeCancelModal(); });
    });
}
function statusBadgeClass(s) { return { "Pending": "bs-pending", "Approved": "bs-approved", "Out for Delivery": "bs-delivering", "Completed": "bs-completed", "Rejected": "bs-rejected", "Cancelled": "bs-cancelled" }[s] || "bs-pending"; }

// --- Initial Load ---
handleSignInLink();
updateBadge();
