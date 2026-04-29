/* ============================================
   MEATLOGIC v6 — Customer Logic
   Email+Password Auth (No Magic Link)
   ============================================ */

var allProducts = {};
var cart = JSON.parse(localStorage.getItem("ml_cart") || "[]");
var receiptData = null;
var currentCat = "all";
var currentUser = null;
var cancelTarget = null;

/* ==========================================
   NAVIGATION
   ========================================== */
function showTab(tabName, el = null) {
    const tabs = document.querySelectorAll('.page-tab');
    const navLinks = document.querySelectorAll('.nav-link');

    // remove active nav
    navLinks.forEach(link => link.classList.remove('active'));

    // hide all tabs
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // wait konti para smooth transition
    setTimeout(() => {
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }, 100);

    // set active nav
    if(el){
        el.classList.add('active');
    }
}

function toggleMobile() { document.getElementById("nav-links").classList.toggle("open"); }
function closeMobile() { document.getElementById("nav-links").classList.remove("open"); }

/* ==========================================
   AUTH TAB SWITCHER
   ========================================== */
function switchAuthTab(tab) {
    var loginForm = document.getElementById("auth-login-form");
    var regForm = document.getElementById("auth-register-form");
    var loginBtn = document.getElementById("btn-login-tab");
    var regBtn = document.getElementById("btn-reg-tab");

    // Clear errors
    document.getElementById("login-error").classList.add("hidden");
    document.getElementById("register-error").classList.add("hidden");
    document.getElementById("register-success").classList.add("hidden");

    if (tab === "login") {
        loginForm.classList.remove("hidden");
        regForm.classList.add("hidden");
        loginBtn.classList.add("active");
        regBtn.classList.remove("active");
    } else {
        loginForm.classList.add("hidden");
        regForm.classList.remove("hidden");
        loginBtn.classList.remove("active");
        regBtn.classList.add("active");
    }
}

function togglePass(inputId, btn) {
    var input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
    }
}

/* ==========================================
   FIREBASE AUTH — EMAIL + PASSWORD
   ========================================== */

// Listen to auth state changes
firebase.auth().onAuthStateChanged(function(firebaseUser) {
    if (firebaseUser) {
        // User is logged in — fetch their profile from database
        db.ref("customers/" + firebaseUser.uid).once("value").then(function(snap) {
            if (snap.exists()) {
                setCurrentUser(firebaseUser.uid, snap.val());
            } else {
                // New Google user — create profile
                var userData = {
                    fullName: firebaseUser.displayName || "",
                    email: firebaseUser.email || "",
                    phone: "",
                    address: "",
                    createdAt: new Date().toISOString()
                };
                db.ref("customers/" + firebaseUser.uid).set(userData).then(function() {
                    setCurrentUser(firebaseUser.uid, userData);
                    showToast("Welcome to MeatLogic! Please complete your profile.");
                    showTab("profile");
                });
            }
        });
    } else {
        clearCurrentUser();
    }
});

/* --- REGISTER --- */
function doEmailPasswordRegister(e) {
    e.preventDefault();
    var fname = document.getElementById("reg-fname").value.trim();
    var lname = document.getElementById("reg-lname").value.trim();
    var email = document.getElementById("reg-email").value.trim();
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

    var btn = document.getElementById("btn-register");
    btn.disabled = true;
    btn.textContent = "Creating account...";

    firebase.auth().createUserWithEmailAndPassword(email, pass)
        .then(function(result) {
            var userId = result.user.uid;
            var userData = {
                fullName: fname + " " + lname,
                email: email,
                phone: phone,
                address: address,
                createdAt: new Date().toISOString()
            };
            return db.ref("customers/" + userId).set(userData).then(function() {
                setCurrentUser(userId, userData);
                sucEl.textContent = "Account created successfully! Welcome, " + fname + "!";
                sucEl.classList.remove("hidden");
                // Clear form
                document.getElementById("reg-fname").value = "";
                document.getElementById("reg-lname").value = "";
                document.getElementById("reg-email").value = "";
                document.getElementById("reg-phone").value = "";
                document.getElementById("reg-address").value = "";
                document.getElementById("reg-pass").value = "";
                document.getElementById("reg-pass2").value = "";
                showToast("Welcome to MeatLogic, " + fname + "!");
                setTimeout(function() { showTab("shop"); }, 1500);
            });
        })
        .catch(function(error) {
            var msg = error.message;
            if (error.code === "auth/email-already-in-use") {
                msg = "This email is already registered. Please log in instead.";
            } else if (error.code === "auth/weak-password") {
                msg = "Password is too weak. Use at least 6 characters.";
            } else if (error.code === "auth/invalid-email") {
                msg = "Invalid email address. Please check and try again.";
            }
            errEl.textContent = msg;
            errEl.classList.remove("hidden");
        })
        .finally(function() {
            btn.disabled = false;
            btn.textContent = "Create Account";
        });
}

/* --- LOGIN --- */
function doEmailPasswordLogin(e) {
    e.preventDefault();
    var email = document.getElementById("login-email").value.trim();
    var pass = document.getElementById("login-pass").value;

    var errEl = document.getElementById("login-error");
    errEl.classList.add("hidden");

    var btn = document.getElementById("btn-login");
    btn.disabled = true;
    btn.textContent = "Logging in...";

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(function() {
            // onAuthStateChanged will handle the rest
            showToast("Logged in successfully!");
            showTab("shop");
        })
        .catch(function(error) {
            var msg = error.message;
            if (error.code === "auth/user-not-found") {
                msg = "No account found with this email. Please register first.";
            } else if (error.code === "auth/wrong-password") {
                msg = "Incorrect password. Please try again.";
            } else if (error.code === "auth/invalid-email") {
                msg = "Invalid email address.";
            } else if (error.code === "auth/too-many-requests") {
                msg = "Too many failed attempts. Please try again later.";
            } else if (error.code === "auth/invalid-credential") {
                msg = "Wrong email or password. Please try again.";
            }
            errEl.textContent = msg;
            errEl.classList.remove("hidden");
        })
        .finally(function() {
            btn.disabled = false;
            btn.textContent = "Log In";
        });
}

/* --- GOOGLE SIGN IN --- */
function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(function(result) {
            // onAuthStateChanged will handle profile creation/loading
            showToast("Signed in with Google!");
            showTab("shop");
        })
        .catch(function(error) {
            showToast("Google Sign-in failed: " + error.message);
        });
}

/* --- LOGOUT --- */
function doCustomerLogout() {
    firebase.auth().signOut().then(function() {
        showToast("Logged out successfully.");
        showTab("home");
    });
}

/* --- SET / CLEAR USER --- */
function setCurrentUser(id, data) {
    currentUser = {
        id: id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || ""
    };
    localStorage.setItem("ml_user", JSON.stringify(currentUser));
    updateUIForUser();
}

function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem("ml_user");
    updateUIForUser();
}

function updateUIForUser() {
    var navAuth = document.getElementById("nav-auth");
    var navProfile = document.getElementById("nav-profile");
    var navMyOrders = document.getElementById("nav-myorders");
    var navUsername = document.getElementById("nav-username");

    if (currentUser) {
        if (navAuth) navAuth.style.display = "none";
        if (navProfile) navProfile.style.display = "";
        if (navMyOrders) navMyOrders.style.display = "";
        if (navUsername) navUsername.textContent = currentUser.fullName
            ? currentUser.fullName.split(" ")[0] : "Account";
    } else {
        if (navAuth) navAuth.style.display = "";
        if (navProfile) navProfile.style.display = "none";
        if (navMyOrders) navMyOrders.style.display = "none";
        if (navUsername) navUsername.textContent = "Account";
    }
}

/* ==========================================
   PROFILE
   ========================================== */
function loadProfile() {
    if (!currentUser) { showTab("auth"); return; }
    var avatar = document.getElementById("profile-avatar");
    var fullname = document.getElementById("profile-fullname");
    var emailDisplay = document.getElementById("profile-email-display");
    if (avatar) avatar.textContent = (currentUser.fullName || "U").charAt(0).toUpperCase();
    if (fullname) fullname.textContent = currentUser.fullName || "User";
    if (emailDisplay) emailDisplay.textContent = currentUser.email || "";
    document.getElementById("prof-name").value = currentUser.fullName || "";
    document.getElementById("prof-phone").value = currentUser.phone || "";
    document.getElementById("prof-address").value = currentUser.address || "";
}

function saveProfile() {
    if (!currentUser) return;
    var name = document.getElementById("prof-name").value.trim();
    var phone = document.getElementById("prof-phone").value.trim();
    var address = document.getElementById("prof-address").value.trim();
    if (!name) { showToast("Please enter your name."); return; }
    db.ref("customers/" + currentUser.id).update({ fullName: name, phone: phone, address: address })
        .then(function() {
            currentUser.fullName = name;
            currentUser.phone = phone;
            currentUser.address = address;
            localStorage.setItem("ml_user", JSON.stringify(currentUser));
            updateUIForUser();
            showToast("Profile updated!");
        });
}

/* ==========================================
   PRODUCTS
   ========================================== */
db.ref("products").on("value", function(snap) {
    var data = snap.val();
    var loadEl = document.getElementById("loading");
    if (loadEl) loadEl.classList.add("hidden");
    allProducts = data || {};
    renderProducts();
});

function renderProducts() {
    var grid = document.getElementById("products-grid");
    if (!grid) return;
    var entries = Object.entries(allProducts);
    var filtered = currentCat === "all" ? entries : entries.filter(function(e) { return e[1].category === currentCat; });
    if (entries.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">📦</div><h3>No products yet.</h3></div>';
        return;
    }
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">🔍</div><h3>No products in this category.</h3></div>';
        return;
    }
    grid.innerHTML = filtered.map(function(entry) {
        var id = entry[0], p = entry[1];
        var stk = p.onlineStock || 0;
        var out = stk <= 0, low = stk > 0 && stk <= 5;
        var sClass = out ? "stk-out" : low ? "stk-low" : "stk-ok";
        var sText = out ? "Sold Out" : stk + " left";
        var inCart = cart.find(function(c) { return c.id === id; });
        var qty = inCart ? inCart.qty : 0;
        var imgHtml = p.image
            ? '<img src="' + p.image + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
            : (p.emoji || "🥩");
        return '<div class="p-card">' +
            '<div class="p-card-top" style="' + (p.image ? 'padding:0;' : '') + '">' + imgHtml + '</div>' +
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
                (out ? '<button class="btn btn-ghost btn-full btn-sm" disabled>Sold Out</button>' :
                '<div class="qty-row">' +
                    '<button class="qty-btn" onclick="chgQty(\'' + id + '\',-1)">−</button>' +
                    '<span class="qty-val" id="q-' + id + '">' + qty + '</span>' +
                    '<button class="qty-btn" onclick="chgQty(\'' + id + '\',1)">+</button>' +
                '</div>' +
                '<button class="btn btn-primary btn-full btn-sm" onclick="addCart(\'' + id + '\')">' +
                    (qty > 0 ? "Update Cart" : "Add to Cart") + '</button>') +
            '</div>' +
        '</div>';
    }).join("");
}

function filterCat(cat, btn) {
    currentCat = cat;
    document.querySelectorAll(".cat-btn").forEach(function(b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    renderProducts();
}

/* ==========================================
   CART
   ========================================== */
function chgQty(id, d) {
    var el = document.getElementById("q-" + id);
    if (!el) return;
    var v = parseInt(el.textContent) + d;
    var max = (allProducts[id] && allProducts[id].onlineStock) || 0;
    if (v < 0) v = 0;
    if (v > max) { v = max; showToast("Max stock: " + max); }
    el.textContent = v;
}

function addCart(id) {
    var el = document.getElementById("q-" + id);
    if (!el) return;
    var qty = parseInt(el.textContent);
    var p = allProducts[id];
    if (!p) return;
    if (qty <= 0) {
        cart = cart.filter(function(c) { return c.id !== id; });
        saveCart(); updateBadge(); renderProducts();
        showToast("Removed from cart.");
        return;
    }
    if (qty > (p.onlineStock || 0)) { showToast("Not enough stock."); return; }
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
    var el = document.getElementById("cart-count");
    if (el) el.textContent = cart.reduce(function(s, c) { return s + c.qty; }, 0);
}

function renderCart() {
    var empty = document.getElementById("cart-empty");
    var loginWall = document.getElementById("cart-login-wall");
    var filled = document.getElementById("cart-filled");
    if (empty) empty.classList.add("hidden");
    if (loginWall) loginWall.classList.add("hidden");
    if (filled) filled.classList.add("hidden");

    if (cart.length === 0) { if (empty) empty.classList.remove("hidden"); return; }
    if (!currentUser) { if (loginWall) loginWall.classList.remove("hidden"); return; }
    if (filled) filled.classList.remove("hidden");

    var nameEl = document.getElementById("c-name");
    var phoneEl = document.getElementById("c-phone");
    var addrEl = document.getElementById("c-address");
    if (nameEl) nameEl.value = currentUser.fullName || "";
    if (phoneEl) phoneEl.value = currentUser.phone || "";
    if (addrEl) addrEl.value = currentUser.address || "";

    var html = "", sumHtml = "", total = 0;
    cart.forEach(function(c) {
        var p = allProducts[c.id];
        if (!p) return;
        var lt = p.price * c.qty;
        total += lt;
        var imgHtml = p.image
            ? '<img src="' + p.image + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
            : (p.emoji || "🥩");
        html += '<div class="c-item"><div class="c-item-emoji" style="overflow:hidden;">' + imgHtml + '</div><div class="c-item-info"><h4>' + p.name + '</h4><p>' + formatCurrency(p.price) + ' × ' + c.qty + ' ' + p.unit + '</p></div><span class="c-item-price">' + formatCurrency(lt) + '</span><button class="c-item-del" onclick="removeCart(\'' + c.id + '\')">✕</button></div>';
        sumHtml += '<div class="sum-line"><span>' + p.name + ' × ' + c.qty + '</span><span>' + formatCurrency(lt) + '</span></div>';
    });
    document.getElementById("cart-items").innerHTML = html;
    document.getElementById("summary-lines").innerHTML = sumHtml;
    document.getElementById("summary-total").textContent = formatCurrency(total);
}

/* ==========================================
   RECEIPT
   ========================================== */
function onReceipt(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("File too large. Max 5MB."); return; }
    compressImage(file, 800, 0.6).then(function(data) {
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

/* ==========================================
   PLACE ORDER
   ========================================== */
function placeOrder() {
    if (!currentUser) { showToast("Please log in first."); showTab("auth"); return; }
    var name = document.getElementById("c-name").value.trim();
    var phone = document.getElementById("c-phone").value.trim();
    var address = document.getElementById("c-address").value.trim();
    var courierEl = document.querySelector('input[name="courier"]:checked');
    var courier = courierEl ? courierEl.value : "Lalamove";
    if (!name || !phone || !address) { showToast("Please fill in all delivery details."); return; }
    if (cart.length === 0) { showToast("Your cart is empty."); return; }
    if (!receiptData) { showToast("Please upload your GCash receipt."); return; }
    var btn = document.getElementById("btn-place");
    if (btn) { btn.disabled = true; btn.textContent = "Placing order..."; }
    db.ref("products").once("value").then(function(snap) {
        var liveProducts = snap.val() || {};
        var total = 0, items = [];
        for (var i = 0; i < cart.length; i++) {
            var c = cart[i], p = liveProducts[c.id];
            if (!p || (p.onlineStock || 0) < c.qty) {
                showToast((p ? p.name : "An item") + " is out of stock.");
                if (btn) { btn.disabled = false; btn.textContent = "Place Order"; }
                return;
            }
            var lt = p.price * c.qty; total += lt;
            items.push({ productId: c.id, name: p.name, emoji: p.emoji || "🥩", price: p.price, qty: c.qty, unit: p.unit, lineTotal: lt });
        }
        var promises = cart.map(function(c) {
            return db.ref("products/" + c.id + "/onlineStock").transaction(function(cur) { return Math.max(0, (cur || 0) - c.qty); });
        });
        Promise.all(promises).then(function() {
            var orderId = "ORD-" + Date.now().toString().slice(-8);
            var orderData = { customerName: name, phone: phone, address: address, items: items, total: total, courier: courier, receipt: receiptData, status: "Pending", trackingInfo: "", riderInfo: "", customerId: currentUser.id, customerEmail: currentUser.email, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            db.ref("orders/" + orderId).set(orderData).then(function() {
                cart = []; saveCart(); updateBadge(); clearReceipt();
                document.getElementById("oid-box").textContent = orderId;
                document.getElementById("modal-success").classList.remove("hidden");
            });
        }).catch(function(err) {
            showToast("Error: " + err.message);
        }).finally(function() {
            if (btn) { btn.disabled = false; btn.textContent = "Place Order"; }
        });
    });
}

function closeSuccess() { document.getElementById("modal-success").classList.add("hidden"); }

/* ==========================================
   MY ORDERS
   ========================================== */
function loadMyOrders() {
    if (!currentUser) { showTab("auth"); return; }
    var container = document.getElementById("myorders-list");
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading orders...</p></div>';
    db.ref("orders").orderByChild("customerId").equalTo(currentUser.id).on("value", function(snap) {
        var data = snap.val();
        if (!data) {
            container.innerHTML = '<div class="empty-box"><div class="empty-ico">📦</div><h3>No orders yet</h3><button class="btn btn-primary" onclick="showTab(\'shop\')">Start Shopping</button></div>';
            return;
        }
        var orders = Object.entries(data).sort(function(a, b) { return new Date(b[1].createdAt) - new Date(a[1].createdAt); });
        container.innerHTML = orders.map(function(entry) {
            var id = entry[0], o = entry[1];
            var sc = statusBadgeClass(o.status);
            var itemsList = o.items.map(function(i) { return (i.emoji || "🥩") + " " + i.name + " × " + i.qty; }).join(" • ");
            var trackingHtml = "";
            if (o.riderInfo || o.trackingInfo) {
                trackingHtml = '<div class="oc-tracking">' + (o.courier === "Lalamove" && o.riderInfo ? "🏍️ <strong>Rider:</strong> " + o.riderInfo : o.trackingInfo ? "📦 <strong>Tracking #:</strong> " + o.trackingInfo : "") + '</div>';
            }
            var cancelHtml = o.status === "Pending" ? '<div class="oc-actions"><button class="btn-cancel-order" onclick="openCancelModal(\'' + id + '\')">❌ Cancel Order</button></div>' : "";
            return '<div class="order-card"><div class="oc-header"><div><span class="oc-id">' + id + '</span><span class="oc-date"> • ' + formatDate(o.createdAt) + '</span></div><span class="badge-s ' + sc + '">' + o.status + '</span></div><p class="oc-items">' + itemsList + '</p>' + trackingHtml + '<div class="oc-footer"><span class="oc-total">' + formatCurrency(o.total) + '</span><span class="oc-courier">' + (o.courier === "Lalamove" ? "🏍️" : "📦") + ' ' + o.courier + '</span></div>' + cancelHtml + '</div>';
        }).join("");
    });
}

/* ==========================================
   CANCEL ORDER
   ========================================== */
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
        if (!order || order.status !== "Pending") { showToast("Cannot cancel this order."); closeCancelModal(); return; }
        var promises = order.items.map(function(item) {
            return db.ref("products/" + item.productId + "/onlineStock").transaction(function(cur) { return (cur || 0) + item.qty; });
        });
        Promise.all(promises).then(function() {
            return db.ref("orders/" + orderId).update({ status: "Cancelled", updatedAt: new Date().toISOString() });
        }).then(function() {
            showToast("Order " + orderId + " cancelled.");
            closeCancelModal();
        });
    });
}

/* ==========================================
   HELPERS
   ========================================== */
function statusBadgeClass(s) {
    return { "Pending": "bs-pending", "Approved": "bs-approved", "Out for Delivery": "bs-delivering", "Completed": "bs-completed", "Rejected": "bs-rejected", "Cancelled": "bs-cancelled" }[s] || "bs-pending";
}

/* ==========================================
   INIT
   ========================================== */
updateBadge();
updateUIForUser();
