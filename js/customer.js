/* ============================================
   MEATLOGIC v3 — Customer Logic
   With: Auth, Saved Address, My Orders, Cancel
   ============================================ */

var allProducts = {};
var cart = JSON.parse(localStorage.getItem("ml_cart") || "[]");
var receiptData = null;
var currentCat = "all";
var currentUser = JSON.parse(localStorage.getItem("ml_user") || "null");
var cancelTarget = null;

/* ====================
   NAVIGATION & TABS
   ==================== */
function showTab(tab, el) {
    document.querySelectorAll(".page-tab").forEach(function(t) { t.classList.remove("active"); });
    var target = document.getElementById("tab-" + tab);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach(function(n) { n.classList.remove("active"); });
    if (el) {
        el.classList.add("active");
    } else {
        document.querySelectorAll(".nav-link").forEach(function(n) {
            if (n.dataset.tab === tab) n.classList.add("active");
        });
    }

    if (tab === "cart") renderCart();
    if (tab === "myorders") loadMyOrders();
    if (tab === "profile") loadProfile();
    closeMobile();
    window.scrollTo(0, 0);
}

function toggleMobile() { document.getElementById("nav-links").classList.toggle("open"); }
function closeMobile() { document.getElementById("nav-links").classList.remove("open"); }

/* ====================
   AUTH — REGISTER
   ==================== */
function showAuthForm(form) {
    document.getElementById("form-login").classList.add("hidden");
    document.getElementById("form-register").classList.add("hidden");
    document.getElementById("btn-login-tab").classList.remove("active");
    document.getElementById("btn-register-tab").classList.remove("active");

    if (form === "login") {
        document.getElementById("form-login").classList.remove("hidden");
        document.getElementById("btn-login-tab").classList.add("active");
    } else {
        document.getElementById("form-register").classList.remove("hidden");
        document.getElementById("btn-register-tab").classList.add("active");
    }
    // Clear errors
    document.getElementById("login-error").classList.add("hidden");
    document.getElementById("register-error").classList.add("hidden");
    document.getElementById("register-success").classList.add("hidden");
}

function doCustomerRegister(e) {
    e.preventDefault();
    var fname = document.getElementById("reg-fname").value.trim();
    var lname = document.getElementById("reg-lname").value.trim();
    var email = document.getElementById("reg-email").value.trim().toLowerCase();
    var phone = document.getElementById("reg-phone").value.trim();
    var address = document.getElementById("reg-address").value.trim();
    var pass = document.getElementById("reg-pass").value;
    var pass2 = document.getElementById("reg-pass2").value;

    var errEl = document.getElementById("register-error");
    var sucEl = document.getElementById("register-success");
    errEl.classList.add("hidden");
    sucEl.classList.add("hidden");

    if (pass !== pass2) {
        errEl.textContent = "Passwords do not match.";
        errEl.classList.remove("hidden");
        return;
    }

    if (pass.length < 6) {
        errEl.textContent = "Password must be at least 6 characters.";
        errEl.classList.remove("hidden");
        return;
    }

    // Check if email already exists
    db.ref("customers").orderByChild("email").equalTo(email).once("value").then(function(snap) {
        if (snap.exists()) {
            errEl.textContent = "An account with this email already exists.";
            errEl.classList.remove("hidden");
            return;
        }

        // Create account
        var userId = "cust_" + Date.now();
        var userData = {
            firstName: fname,
            lastName: lname,
            fullName: fname + " " + lname,
            email: email,
            phone: phone,
            address: address,
            password: pass,
            createdAt: new Date().toISOString()
        };

        db.ref("customers/" + userId).set(userData).then(function() {
            sucEl.textContent = "Account created! You can now log in.";
            sucEl.classList.remove("hidden");
            document.getElementById("register-error").classList.add("hidden");

            // Clear form
            e.target.reset();

            // Switch to login after 1.5s
            setTimeout(function() {
                showAuthForm("login");
                document.getElementById("login-email").value = email;
                sucEl.classList.add("hidden");
            }, 1500);
        });
    });
}

/* ====================
   AUTH — LOGIN
   ==================== */
function doCustomerLogin(e) {
    e.preventDefault();
    var email = document.getElementById("login-email").value.trim().toLowerCase();
    var pass = document.getElementById("login-pass").value;
    var errEl = document.getElementById("login-error");
    errEl.classList.add("hidden");

    db.ref("customers").orderByChild("email").equalTo(email).once("value").then(function(snap) {
        if (!snap.exists()) {
            errEl.textContent = "No account found with this email.";
            errEl.classList.remove("hidden");
            return;
        }

        var found = false;
        snap.forEach(function(child) {
            var user = child.val();
            if (user.password === pass) {
                found = true;
                currentUser = {
                    id: child.key,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    fullName: user.fullName,
                    email: user.email,
                    phone: user.phone,
                    address: user.address
                };
                localStorage.setItem("ml_user", JSON.stringify(currentUser));
                updateUIForUser();
                showToast("Welcome back, " + user.firstName + "!");
                showTab("shop");
            }
        });

        if (!found) {
            errEl.textContent = "Incorrect password.";
            errEl.classList.remove("hidden");
        }
    });
}

function doCustomerLogout() {
    currentUser = null;
    localStorage.removeItem("ml_user");
    updateUIForUser();
    showToast("Logged out successfully.");
    showTab("home");
}

function updateUIForUser() {
    var navAuth = document.getElementById("nav-auth");
    var navProfile = document.getElementById("nav-profile");
    var navMyOrders = document.getElementById("nav-myorders");
    var prompt = document.getElementById("checkout-login-prompt");
    var navUsername = document.getElementById("nav-username");

    if (currentUser) {
        navAuth.style.display = "none";
        navProfile.style.display = "";
        navMyOrders.style.display = "";
        if (prompt) prompt.style.display = "none";
        navUsername.textContent = currentUser.firstName;

        // Auto-fill checkout
        var nameEl = document.getElementById("c-name");
        var phoneEl = document.getElementById("c-phone");
        var addrEl = document.getElementById("c-address");
        if (nameEl && !nameEl.value) nameEl.value = currentUser.fullName || "";
        if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone || "";
        if (addrEl && !addrEl.value) addrEl.value = currentUser.address || "";
    } else {
        navAuth.style.display = "";
        navProfile.style.display = "none";
        navMyOrders.style.display = "none";
        if (prompt) prompt.style.display = "";
        navUsername.textContent = "Account";
    }
}

/* ====================
   PROFILE
   ==================== */
function loadProfile() {
    if (!currentUser) { showTab("auth"); return; }

    document.getElementById("profile-avatar").textContent = (currentUser.firstName || "U").charAt(0).toUpperCase();
    document.getElementById("profile-fullname").textContent = currentUser.fullName || "User";
    document.getElementById("profile-email-display").textContent = currentUser.email || "";
    document.getElementById("prof-name").value = currentUser.fullName || "";
    document.getElementById("prof-phone").value = currentUser.phone || "";
    document.getElementById("prof-address").value = currentUser.address || "";
}

function saveProfile() {
    if (!currentUser) return;

    var name = document.getElementById("prof-name").value.trim();
    var phone = document.getElementById("prof-phone").value.trim();
    var address = document.getElementById("prof-address").value.trim();

    var updates = {};
    if (name) {
        updates.fullName = name;
        var parts = name.split(" ");
        updates.firstName = parts[0];
        updates.lastName = parts.slice(1).join(" ") || "";
    }
    if (phone) updates.phone = phone;
    if (address) updates.address = address;

    db.ref("customers/" + currentUser.id).update(updates).then(function() {
        // Update local
        if (name) { currentUser.fullName = updates.fullName; currentUser.firstName = updates.firstName; currentUser.lastName = updates.lastName; }
        if (phone) currentUser.phone = phone;
        if (address) currentUser.address = address;
        localStorage.setItem("ml_user", JSON.stringify(currentUser));
        updateUIForUser();
        showToast("Profile updated!");
    });
}

/* ====================
   PRODUCTS
   ==================== */
db.ref("products").on("value", function(snap) {
    var data = snap.val();
    document.getElementById("loading").classList.add("hidden");

    if (!data) {
        document.getElementById("products-grid").innerHTML =
            '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">📦</div><h3>No products yet</h3><p>Check back soon!</p></div>';
        allProducts = {};
        return;
    }
    allProducts = data;
    renderProducts();
});

function renderProducts() {
    var grid = document.getElementById("products-grid");
    var entries = Object.entries(allProducts);
    var filtered = currentCat === "all" ? entries : entries.filter(function(e) { return e[1].category === currentCat; });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">🔍</div><h3>No products in this category</h3></div>';
        return;
    }

    grid.innerHTML = filtered.map(function(entry) {
        var id = entry[0], p = entry[1];
        var stk = p.onlineStock || 0;
        var out = stk <= 0;
        var low = stk > 0 && stk <= 5;
        var sClass = out ? "stk-out" : low ? "stk-low" : "stk-ok";
        var sText = out ? "Sold Out" : stk + " left";
        var inCart = cart.find(function(c) { return c.id === id; });
        var qty = inCart ? inCart.qty : 0;

        return '<div class="p-card">' +
            '<div class="p-card-top">' + (p.emoji || "🥩") + '</div>' +
            '<div class="p-card-body">' +
                '<span class="p-cat-tag">' + p.category + '</span>' +
                '<h3>' + p.name + '</h3>' +
                '<p class="p-unit">' + p.unit + '</p>' +
                '<div class="p-foot">' +
                    '<span class="p-price">' + formatCurrency(p.price) + '</span>' +
                    '<span class="p-stock ' + sClass + '">' + sText + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="p-actions">' +
                (out ?
                    '<button class="btn btn-ghost btn-full btn-sm" disabled>Sold Out</button>' :
                    '<div class="qty-row">' +
                        '<button class="qty-btn" onclick="chgQty(\'' + id + '\',-1)">−</button>' +
                        '<span class="qty-val" id="q-' + id + '">' + qty + '</span>' +
                        '<button class="qty-btn" onclick="chgQty(\'' + id + '\',1)">+</button>' +
                    '</div>' +
                    '<button class="btn btn-primary btn-full btn-sm" onclick="addCart(\'' + id + '\')">' +
                        (qty > 0 ? "Update Cart" : "Add to Cart") +
                    '</button>'
                ) +
            '</div>' +
        '</div>';
    }).join("");
}

function filterCat(cat, btn) {
    currentCat = cat;
    document.querySelectorAll(".cat-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    renderProducts();
}

/* ====================
   CART
   ==================== */
function chgQty(id, d) {
    var el = document.getElementById("q-" + id);
    if (!el) return;
    var v = parseInt(el.textContent) + d;
    var max = (allProducts[id] && allProducts[id].onlineStock) || 0;
    if (v < 0) v = 0;
    if (v > max) { v = max; showToast("Max stock is " + max); }
    el.textContent = v;
}

function addCart(id) {
    var el = document.getElementById("q-" + id);
    var qty = parseInt(el.textContent);
    var p = allProducts[id];
    if (!p) return;

    if (qty <= 0) {
        cart = cart.filter(function(c) { return c.id !== id; });
        saveCart(); updateBadge(); renderProducts();
        showToast("Removed from cart");
        return;
    }
    if (qty > (p.onlineStock || 0)) { showToast("Not enough stock"); return; }

    var ex = cart.find(function(c) { return c.id === id; });
    if (ex) ex.qty = qty; else cart.push({ id: id, qty: qty });
    saveCart(); updateBadge(); renderProducts();
    showToast("Cart updated!");
}

function removeCart(id) {
    cart = cart.filter(function(c) { return c.id !== id; });
    saveCart(); updateBadge(); renderCart(); renderProducts();
}

function saveCart() { localStorage.setItem("ml_cart", JSON.stringify(cart)); }

function updateBadge() {
    var n = cart.reduce(function(s, c) { return s + c.qty; }, 0);
    document.getElementById("cart-count").textContent = n;
}

function renderCart() {
    var empty = document.getElementById("cart-empty");
    var filled = document.getElementById("cart-filled");
    var items = document.getElementById("cart-items");
    var lines = document.getElementById("summary-lines");
    var totalEl = document.getElementById("summary-total");

    // Auto-fill from user profile
    if (currentUser) {
        var nameEl = document.getElementById("c-name");
        var phoneEl = document.getElementById("c-phone");
        var addrEl = document.getElementById("c-address");
        if (nameEl && !nameEl.value) nameEl.value = currentUser.fullName || "";
        if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone || "";
        if (addrEl && !addrEl.value) addrEl.value = currentUser.address || "";
    }

    if (cart.length === 0) {
        empty.classList.remove("hidden"); filled.classList.add("hidden");
        return;
    }
    empty.classList.add("hidden"); filled.classList.remove("hidden");

    var html = "", sumHtml = "", total = 0;
    cart.forEach(function(c) {
        var p = allProducts[c.id];
        if (!p) return;
        var lt = p.price * c.qty;
        total += lt;
        html += '<div class="c-item">' +
            '<div class="c-item-emoji">' + (p.emoji || "🥩") + '</div>' +
            '<div class="c-item-info"><h4>' + p.name + '</h4><p>' + formatCurrency(p.price) + ' × ' + c.qty + ' ' + p.unit + '</p></div>' +
            '<span class="c-item-price">' + formatCurrency(lt) + '</span>' +
            '<button class="c-item-del" onclick="removeCart(\'' + c.id + '\')">✕</button>' +
        '</div>';
        sumHtml += '<div class="sum-line"><span>' + p.name + ' × ' + c.qty + '</span><span>' + formatCurrency(lt) + '</span></div>';
    });

    items.innerHTML = html;
    lines.innerHTML = sumHtml;
    totalEl.textContent = formatCurrency(total);
}

/* ====================
   RECEIPT
   ==================== */
function onReceipt(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("File too large. Max 5MB."); return; }
    compressImage(file, 600, 0.5).then(function(data) {
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

/* ====================
   PLACE ORDER
   ==================== */
function placeOrder() {
    var name = document.getElementById("c-name").value.trim();
    var phone = document.getElementById("c-phone").value.trim();
    var address = document.getElementById("c-address").value.trim();
    var courier = document.querySelector('input[name="courier"]:checked').value;

    if (!name || !phone || !address) { showToast("Please fill in all required fields."); return; }
    if (cart.length === 0) { showToast("Cart is empty."); return; }
    if (!receiptData) { showToast("Please upload your GCash receipt."); return; }

    var btn = document.getElementById("btn-place");
    btn.disabled = true; btn.textContent = "Placing order...";

    db.ref("products").once("value").then(function(snap) {
        var liveProducts = snap.val() || {};
        var total = 0;
        var items = [];

        for (var i = 0; i < cart.length; i++) {
            var c = cart[i];
            var p = liveProducts[c.id];
            if (!p) { showToast("Product not found."); btn.disabled = false; btn.textContent = "Place Order"; return; }
            if ((p.onlineStock || 0) < c.qty) {
                showToast(p.name + " only has " + (p.onlineStock || 0) + " left.");
                btn.disabled = false; btn.textContent = "Place Order"; return;
            }
            var lt = p.price * c.qty;
            total += lt;
            items.push({ productId: c.id, name: p.name, emoji: p.emoji, price: p.price, qty: c.qty, unit: p.unit, lineTotal: lt });
        }

        // Deduct stock
        var promises = cart.map(function(c) {
            return db.ref("products/" + c.id + "/onlineStock").transaction(function(cur) {
                if (cur === null) return 0;
                return Math.max(0, cur - c.qty);
            });
        });

        Promise.all(promises).then(function() {
            var orderId = "ORD-" + Date.now().toString().slice(-8);
            var orderData = {
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
                customerId: currentUser ? currentUser.id : "",
                customerEmail: currentUser ? currentUser.email : "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            db.ref("orders/" + orderId).set(orderData).then(function() {
                cart = [];
                saveCart(); updateBadge(); clearReceipt();
                document.getElementById("c-name").value = "";
                document.getElementById("c-phone").value = "";
                document.getElementById("c-address").value = "";

                document.getElementById("oid-box").textContent = orderId;

                // Show correct button
                if (currentUser) {
                    document.getElementById("suc-btn-orders").style.display = "";
                    document.getElementById("suc-btn-track").style.display = "none";
                } else {
                    document.getElementById("suc-btn-orders").style.display = "none";
                    document.getElementById("suc-btn-track").style.display = "";
                }

                document.getElementById("modal-success").classList.remove("hidden");
                btn.disabled = false; btn.textContent = "Place Order";
            });
        });
    }).catch(function(err) {
        console.error(err);
        showToast("Error placing order.");
        btn.disabled = false; btn.textContent = "Place Order";
    });
}

function closeSuccess() {
    document.getElementById("modal-success").classList.add("hidden");
}

/* ====================
   MY ORDERS (Logged-in)
   ==================== */
function loadMyOrders() {
    if (!currentUser) { showTab("auth"); return; }

    var container = document.getElementById("myorders-list");
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading orders...</p></div>';

    db.ref("orders").orderByChild("customerId").equalTo(currentUser.id).once("value").then(function(snap) {
        var data = snap.val();
        if (!data) {
            container.innerHTML = '<div class="empty-box"><div class="empty-ico">📦</div><h3>No orders yet</h3><p>Your order history will appear here.</p><button class="btn btn-primary" onclick="showTab(\'shop\')">Start Shopping</button></div>';
            return;
        }

        var orders = Object.entries(data).sort(function(a, b) {
            return new Date(b[1].createdAt) - new Date(a[1].createdAt);
        });

        container.innerHTML = orders.map(function(entry) {
            var id = entry[0], o = entry[1];
            var sc = statusBadgeClass(o.status);
            var itemsList = o.items.map(function(i) { return (i.emoji || "🥩") + " " + i.name + " × " + i.qty; }).join(" • ");

            var trackingHtml = "";
            if (o.riderInfo || o.trackingInfo) {
                trackingHtml = '<div class="oc-tracking">' +
                    (o.courier === "Lalamove" && o.riderInfo ? "🏍️ <strong>Rider:</strong> " + o.riderInfo :
                     o.trackingInfo ? "📦 <strong>Tracking #:</strong> " + o.trackingInfo : "") +
                '</div>';
            }

            var cancelHtml = "";
            if (o.status === "Pending") {
                cancelHtml = '<div class="oc-actions">' +
                    '<button class="btn-cancel-order" onclick="openCancelModal(\'' + id + '\')">❌ Cancel Order</button>' +
                '</div>';
            }

            return '<div class="order-card">' +
                '<div class="oc-header">' +
                    '<div><span class="oc-id">' + id + '</span><span class="oc-date"> • ' + formatDate(o.createdAt) + '</span></div>' +
                    '<span class="badge-s ' + sc + '">' + o.status + '</span>' +
                '</div>' +
                '<p class="oc-items">' + itemsList + '</p>' +
                trackingHtml +
                '<div class="oc-footer">' +
                    '<span class="oc-total">' + formatCurrency(o.total) + '</span>' +
                    '<span class="oc-courier">' + (o.courier === "Lalamove" ? "🏍️" : "📦") + " " + o.courier + '</span>' +
                '</div>' +
                cancelHtml +
            '</div>';
        }).join("");
    });
}

/* ====================
   CANCEL ORDER
   ==================== */
function openCancelModal(orderId) {
    cancelTarget = orderId;
    document.getElementById("cancel-order-id").textContent = orderId;
    document.getElementById("modal-cancel").classList.remove("hidden");
}

function closeCancelModal() {
    cancelTarget = null;
    document.getElementById("modal-cancel").classList.add("hidden");
}

function confirmCancelOrder() {
    if (!cancelTarget) return;
    var orderId = cancelTarget;

    db.ref("orders/" + orderId).once("value").then(function(snap) {
        var order = snap.val();
        if (!order || order.status !== "Pending") {
            showToast("This order can no longer be cancelled.");
            closeCancelModal();
            return;
        }

        // Restore stock
        var promises = order.items.map(function(item) {
            return db.ref("products/" + item.productId + "/onlineStock").transaction(function(cur) {
                return (cur || 0) + item.qty;
            });
        });

        Promise.all(promises).then(function() {
            return db.ref("orders/" + orderId).update({
                status: "Cancelled",
                updatedAt: new Date().toISOString()
            });
        }).then(function() {
            showToast("Order " + orderId + " has been cancelled.");
            closeCancelModal();
            loadMyOrders();
        });
    });
}

/* ====================
   TRACK ORDER
   ==================== */
function trackOrder() {
    var id = document.getElementById("track-id").value.trim().toUpperCase();
    var result = document.getElementById("track-result");

    if (!id) { showToast("Enter an Order ID"); return; }

    result.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

    db.ref("orders/" + id).once("value").then(function(snap) {
        var order = snap.val();
        if (!order) {
            result.innerHTML = '<div class="empty-box"><div class="empty-ico">❌</div><h3>Order not found</h3><p>Check the Order ID and try again.</p></div>';
            return;
        }

        var sc = statusBadgeClass(order.status);
        var trackingHtml = "";
        if (order.riderInfo || order.trackingInfo) {
            trackingHtml = '<div class="track-tracking">' +
                (order.courier === "Lalamove" && order.riderInfo ? "🏍️ <strong>Rider:</strong> " + order.riderInfo :
                 order.trackingInfo ? "📦 <strong>Tracking #:</strong> " + order.trackingInfo : "") +
            '</div>';
        }

        result.innerHTML =
        '<div class="track-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
                '<h3>' + id + '</h3>' +
                '<span class="badge-s ' + sc + '">' + order.status + '</span>' +
            '</div>' +
            '<div class="track-grid">' +
                '<div><div class="tg-label">Customer</div><div class="tg-value">' + order.customerName + '</div></div>' +
                '<div><div class="tg-label">Phone</div><div class="tg-value">' + order.phone + '</div></div>' +
                '<div><div class="tg-label">Courier</div><div class="tg-value">' + (order.courier === "Lalamove" ? "🏍️" : "📦") + ' ' + order.courier + '</div></div>' +
                '<div><div class="tg-label">Date</div><div class="tg-value">' + formatDate(order.createdAt) + '</div></div>' +
            '</div>' +
            '<div class="track-items">' +
                order.items.map(function(i) {
                    return '<div class="ti-row"><span>' + (i.emoji || "🥩") + ' ' + i.name + ' × ' + i.qty + '</span><span>' + formatCurrency(i.lineTotal) + '</span></div>';
                }).join("") +
                '<div class="track-total"><span>Total</span><span style="color:var(--primary)">' + formatCurrency(order.total) + '</span></div>' +
            '</div>' +
            trackingHtml +
        '</div>';
    });
}

/* ====================
   HELPERS
   ==================== */
function statusBadgeClass(s) {
    var map = {
        "Pending": "bs-pending",
        "Approved": "bs-approved",
        "Out for Delivery": "bs-delivering",
        "Completed": "bs-completed",
        "Rejected": "bs-rejected",
        "Cancelled": "bs-cancelled"
    };
    return map[s] || "bs-pending";
}

/* ====================
   INIT
   ==================== */
updateBadge();
updateUIForUser();