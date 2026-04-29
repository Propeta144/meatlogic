/* ============================================
   MEATLOGIC v5 — Customer Logic
   Login Required to Checkout
   ============================================ */

var allProducts = {};
var cart = JSON.parse(localStorage.getItem("ml_cart") || "[]");
var receiptData = null;
var currentCat = "all";
var currentUser = null;
var cancelTarget = null;

/* ==========================================
   TAB NAVIGATION
   ========================================== */
function showTab(tab, el) {
    document.querySelectorAll(".page-tab").forEach(function(t) {
        t.classList.remove("active");
    });

    var target = document.getElementById("tab-" + tab);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach(function(n) {
        n.classList.remove("active");
    });

    if (el) {
        el.classList.add("active");
    } else {
        document.querySelectorAll(".nav-link[data-tab='" + tab + "']").forEach(function(n) {
            n.classList.add("active");
        });
    }

    if (tab === "cart") renderCart();
    if (tab === "myorders") loadMyOrders();
    if (tab === "profile") loadProfile();

    closeMobile();
    window.scrollTo(0, 0);
}

function toggleMobile() {
    document.getElementById("nav-links").classList.toggle("open");
}
function closeMobile() {
    document.getElementById("nav-links").classList.remove("open");
}

/* ==========================================
   AUTH — FIREBASE
   ========================================== */
firebase.auth().onAuthStateChanged(function(firebaseUser) {
    if (firebaseUser) {
        db.ref("customers/" + firebaseUser.uid).once("value").then(function(snap) {
            if (snap.exists()) {
                setCurrentUser(firebaseUser.uid, snap.val());
            } else {
                processUserLogin(firebaseUser, true);
            }
        });
    } else {
        clearCurrentUser();
    }
});

function sendEmailLink(e) {
    e.preventDefault();
    var email = document.getElementById("auth-email").value.trim();
    var btn = document.getElementById("btn-send-link");
    var errEl = document.getElementById("auth-error");

    btn.disabled = true;
    btn.textContent = "Sending...";
    errEl.classList.add("hidden");

    var actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true
    };

    firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
        .then(function() {
            localStorage.setItem("emailForSignIn", email);
            document.getElementById("sent-email-display").textContent = email;
            showAuthForm("sent");
        })
        .catch(function(error) {
            errEl.textContent = error.message;
            errEl.classList.remove("hidden");
        })
        .finally(function() {
            btn.disabled = false;
            btn.textContent = "Send Sign-in Link";
        });
}

function handleSignInLink() {
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        var email = localStorage.getItem("emailForSignIn");
        if (!email) {
            email = window.prompt("Please enter your email to complete sign-in:");
        }
        if (email) {
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then(function(result) {
                    localStorage.removeItem("emailForSignIn");
                    window.history.replaceState({}, document.title, window.location.pathname);
                    processUserLogin(result.user, result.additionalUserInfo.isNewUser);
                })
                .catch(function(error) {
                    showToast("Sign-in error: " + error.message);
                });
        }
    }
}

function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then(function(result) {
            processUserLogin(result.user, result.additionalUserInfo.isNewUser);
        })
        .catch(function(error) {
            showToast("Google Sign-in failed: " + error.message);
        });
}

function processUserLogin(firebaseUser, isNew) {
    var userId = firebaseUser.uid;
    if (isNew) {
        var userData = {
            fullName: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            phone: firebaseUser.phoneNumber || "",
            address: "",
            createdAt: new Date().toISOString()
        };
        db.ref("customers/" + userId).set(userData).then(function() {
            setCurrentUser(userId, userData);
            showToast("Welcome to MeatLogic!");
            showTab("profile");
        });
    } else {
        showToast("Welcome back!");
        showTab("shop");
    }
}

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

function doCustomerLogout() {
    firebase.auth().signOut().then(function() {
        showToast("Logged out successfully.");
        showTab("home");
    });
}

function showAuthForm(view) {
    var errEl = document.getElementById("auth-error");
    if (errEl) errEl.classList.add("hidden");

    var initial = document.getElementById("auth-view-initial");
    var sent = document.getElementById("auth-view-sent");

    if (view === "initial") {
        if (initial) initial.classList.remove("hidden");
        if (sent) sent.classList.add("hidden");
    } else {
        if (initial) initial.classList.add("hidden");
        if (sent) sent.classList.remove("hidden");
    }
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
            ? currentUser.fullName.split(" ")[0]
            : "Account";
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
    if (!currentUser) {
        showTab("auth");
        return;
    }

    var avatar = document.getElementById("profile-avatar");
    var fullname = document.getElementById("profile-fullname");
    var emailDisplay = document.getElementById("profile-email-display");
    var profName = document.getElementById("prof-name");
    var profPhone = document.getElementById("prof-phone");
    var profAddress = document.getElementById("prof-address");

    if (avatar) avatar.textContent = (currentUser.fullName || "U").charAt(0).toUpperCase();
    if (fullname) fullname.textContent = currentUser.fullName || "User";
    if (emailDisplay) emailDisplay.textContent = currentUser.email || "";
    if (profName) profName.value = currentUser.fullName || "";
    if (profPhone) profPhone.value = currentUser.phone || "";
    if (profAddress) profAddress.value = currentUser.address || "";
}

function saveProfile() {
    if (!currentUser) return;

    var name = document.getElementById("prof-name").value.trim();
    var phone = document.getElementById("prof-phone").value.trim();
    var address = document.getElementById("prof-address").value.trim();

    if (!name) {
        showToast("Please enter your name.");
        return;
    }

    var updates = {
        fullName: name,
        phone: phone,
        address: address
    };

    db.ref("customers/" + currentUser.id).update(updates).then(function() {
        currentUser.fullName = name;
        currentUser.phone = phone;
        currentUser.address = address;
        localStorage.setItem("ml_user", JSON.stringify(currentUser));
        updateUIForUser();
        showToast("Profile updated successfully!");
    }).catch(function(err) {
        showToast("Error saving profile: " + err.message);
    });
}

/* ==========================================
   PRODUCTS (Load from Firebase)
   ========================================== */
db.ref("products").on("value", function(snap) {
    var data = snap.val();
    var loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.classList.add("hidden");

    if (!data) {
        var grid = document.getElementById("products-grid");
        if (grid) grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">📦</div><h3>No products yet</h3><p>Check back soon!</p></div>';
        allProducts = {};
        return;
    }
    allProducts = data;
    renderProducts();
});

function renderProducts() {
    var grid = document.getElementById("products-grid");
    if (!grid) return;

    var entries = Object.entries(allProducts);
    var filtered = currentCat === "all"
        ? entries
        : entries.filter(function(e) { return e[1].category === currentCat; });

    if (entries.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">📦</div><h3>No products available today.</h3><p>Check back later!</p></div>';
        return;
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-box" style="grid-column:1/-1"><div class="empty-ico">🔍</div><h3>No products in this category.</h3></div>';
        return;
    }

    grid.innerHTML = filtered.map(function(entry) {
        var id = entry[0];
        var p = entry[1];
        var stk = p.onlineStock || 0;
        var out = stk <= 0;
        var low = stk > 0 && stk <= 5;
        var sClass = out ? "stk-out" : low ? "stk-low" : "stk-ok";
        var sText = out ? "Sold Out" : stk + " left";
        var inCart = cart.find(function(c) { return c.id === id; });
        var qty = inCart ? inCart.qty : 0;

        // Image or Emoji display
        var imgHtml = p.image
            ? '<img src="' + p.image + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
            : (p.emoji || "🥩");

        return '<div class="p-card">' +
            '<div class="p-card-top" style="padding:' + (p.image ? '0' : '') + ';">' + imgHtml + '</div>' +
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
                (out
                    ? '<button class="btn btn-ghost btn-full btn-sm" disabled>Sold Out</button>'
                    : '<div class="qty-row">' +
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
    if (btn) btn.classList.add("active");
    renderProducts();
}

/* ==========================================
   CART LOGIC
   ========================================== */
function chgQty(id, d) {
    var el = document.getElementById("q-" + id);
    if (!el) return;
    var v = parseInt(el.textContent) + d;
    var max = (allProducts[id] && allProducts[id].onlineStock) || 0;
    if (v < 0) v = 0;
    if (v > max) { v = max; showToast("Max available stock: " + max); }
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
        saveCart();
        updateBadge();
        renderProducts();
        showToast("Removed from cart.");
        return;
    }

    if (qty > (p.onlineStock || 0)) {
        showToast("Not enough stock available.");
        return;
    }

    var ex = cart.find(function(c) { return c.id === id; });
    if (ex) {
        ex.qty = qty;
    } else {
        cart.push({ id: id, qty: qty });
    }

    saveCart();
    updateBadge();
    renderProducts();
    showToast("Cart updated!");
}

function removeCart(id) {
    cart = cart.filter(function(c) { return c.id !== id; });
    saveCart();
    updateBadge();
    renderCart();
    renderProducts();
}

function saveCart() {
    localStorage.setItem("ml_cart", JSON.stringify(cart));
}

function updateBadge() {
    var el = document.getElementById("cart-count");
    if (el) el.textContent = cart.reduce(function(s, c) { return s + c.qty; }, 0);
}

function renderCart() {
    var empty = document.getElementById("cart-empty");
    var loginWall = document.getElementById("cart-login-wall");
    var filled = document.getElementById("cart-filled");
    var itemsEl = document.getElementById("cart-items");
    var linesEl = document.getElementById("summary-lines");
    var totalEl = document.getElementById("summary-total");

    // Hide all first
    if (empty) empty.classList.add("hidden");
    if (loginWall) loginWall.classList.add("hidden");
    if (filled) filled.classList.add("hidden");

    // Empty cart
    if (cart.length === 0) {
        if (empty) empty.classList.remove("hidden");
        return;
    }

    // Not logged in — show login wall
    if (!currentUser) {
        if (loginWall) loginWall.classList.remove("hidden");
        return;
    }

    // Logged in + has items — show checkout
    if (filled) filled.classList.remove("hidden");

    // Auto-fill user details
    var nameEl = document.getElementById("c-name");
    var phoneEl = document.getElementById("c-phone");
    var addrEl = document.getElementById("c-address");
    if (nameEl) nameEl.value = currentUser.fullName || "";
    if (phoneEl) phoneEl.value = currentUser.phone || "";
    if (addrEl) addrEl.value = currentUser.address || "";

    // Build cart items HTML
    var html = "";
    var sumHtml = "";
    var total = 0;

    cart.forEach(function(c) {
        var p = allProducts[c.id];
        if (!p) return;
        var lt = p.price * c.qty;
        total += lt;

        var imgHtml = p.image
            ? '<img src="' + p.image + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
            : (p.emoji || "🥩");

        html += '<div class="c-item">' +
            '<div class="c-item-emoji" style="overflow:hidden;">' + imgHtml + '</div>' +
            '<div class="c-item-info">' +
                '<h4>' + p.name + '</h4>' +
                '<p>' + formatCurrency(p.price) + ' × ' + c.qty + ' ' + p.unit + '</p>' +
            '</div>' +
            '<span class="c-item-price">' + formatCurrency(lt) + '</span>' +
            '<button class="c-item-del" onclick="removeCart(\'' + c.id + '\')">✕</button>' +
        '</div>';

        sumHtml += '<div class="sum-line">' +
            '<span>' + p.name + ' × ' + c.qty + '</span>' +
            '<span>' + formatCurrency(lt) + '</span>' +
        '</div>';
    });

    if (itemsEl) itemsEl.innerHTML = html;
    if (linesEl) linesEl.innerHTML = sumHtml;
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

/* ==========================================
   RECEIPT UPLOAD
   ========================================== */
function onReceipt(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast("File too large. Max 5MB.");
        return;
    }

    compressImage(file, 800, 0.6).then(function(data) {
        receiptData = data;
        var imgEl = document.getElementById("receipt-img");
        var ph = document.getElementById("upload-ph");
        var pv = document.getElementById("upload-pv");
        if (imgEl) imgEl.src = data;
        if (ph) ph.classList.add("hidden");
        if (pv) pv.classList.remove("hidden");
    });
}

function clearReceipt() {
    receiptData = null;
    var fileEl = document.getElementById("receipt-file");
    var ph = document.getElementById("upload-ph");
    var pv = document.getElementById("upload-pv");
    if (fileEl) fileEl.value = "";
    if (ph) ph.classList.remove("hidden");
    if (pv) pv.classList.add("hidden");
}

/* ==========================================
   PLACE ORDER
   ========================================== */
function placeOrder() {
    if (!currentUser) {
        showToast("Please log in first to place an order.");
        showTab("auth");
        return;
    }

    var name = document.getElementById("c-name").value.trim();
    var phone = document.getElementById("c-phone").value.trim();
    var address = document.getElementById("c-address").value.trim();
    var courierEl = document.querySelector('input[name="courier"]:checked');
    var courier = courierEl ? courierEl.value : "Lalamove";

    if (!name || !phone || !address) {
        showToast("Please fill in all your delivery details.");
        return;
    }
    if (cart.length === 0) {
        showToast("Your cart is empty.");
        return;
    }
    if (!receiptData) {
        showToast("Please upload your GCash receipt.");
        return;
    }

    var btn = document.getElementById("btn-place");
    if (btn) { btn.disabled = true; btn.textContent = "Placing order..."; }

    db.ref("products").once("value").then(function(snap) {
        var liveProducts = snap.val() || {};
        var total = 0;
        var items = [];

        for (var i = 0; i < cart.length; i++) {
            var c = cart[i];
            var p = liveProducts[c.id];
            if (!p) {
                showToast("A product in your cart was not found.");
                if (btn) { btn.disabled = false; btn.textContent = "Place Order"; }
                return;
            }
            if ((p.onlineStock || 0) < c.qty) {
                showToast(p.name + " only has " + (p.onlineStock || 0) + " left.");
                if (btn) { btn.disabled = false; btn.textContent = "Place Order"; }
                return;
            }
            var lt = p.price * c.qty;
            total += lt;
            items.push({
                productId: c.id,
                name: p.name,
                emoji: p.emoji || "🥩",
                price: p.price,
                qty: c.qty,
                unit: p.unit,
                lineTotal: lt
            });
        }

        // Deduct stock
        var promises = cart.map(function(c) {
            return db.ref("products/" + c.id + "/onlineStock").transaction(function(cur) {
                return Math.max(0, (cur || 0) - c.qty);
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
                customerId: currentUser.id,
                customerEmail: currentUser.email,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            return db.ref("orders/" + orderId).set(orderData).then(function() {
                // Clear cart after success
                cart = [];
                saveCart();
                updateBadge();
                clearReceipt();

                // Reset form
                var nameEl = document.getElementById("c-name");
                var phoneEl = document.getElementById("c-phone");
                var addrEl = document.getElementById("c-address");
                if (nameEl) nameEl.value = "";
                if (phoneEl) phoneEl.value = "";
                if (addrEl) addrEl.value = "";

                // Show success
                var oidBox = document.getElementById("oid-box");
                if (oidBox) oidBox.textContent = orderId;
                var modal = document.getElementById("modal-success");
                if (modal) modal.classList.remove("hidden");
            });
        }).catch(function(err) {
            showToast("Error placing order: " + err.message);
        }).finally(function() {
            if (btn) { btn.disabled = false; btn.textContent = "Place Order"; }
        });
    });
}

function closeSuccess() {
    var modal = document.getElementById("modal-success");
    if (modal) modal.classList.add("hidden");
}

/* ==========================================
   MY ORDERS
   ========================================== */
function loadMyOrders() {
    if (!currentUser) {
        showTab("auth");
        return;
    }

    var container = document.getElementById("myorders-list");
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading your orders...</p></div>';

    db.ref("orders").orderByChild("customerId").equalTo(currentUser.id).on("value", function(snap) {
        var data = snap.val();
        if (!data) {
            container.innerHTML = '<div class="empty-box"><div class="empty-ico">📦</div><h3>No orders yet</h3><p>Your order history will appear here.</p><button class="btn btn-primary" onclick="showTab(\'shop\')">Start Shopping</button></div>';
            return;
        }

        var orders = Object.entries(data).sort(function(a, b) {
            return new Date(b[1].createdAt) - new Date(a[1].createdAt);
        });

        container.innerHTML = orders.map(function(entry) {
            var id = entry[0];
            var o = entry[1];
            var sc = statusBadgeClass(o.status);
            var itemsList = o.items.map(function(i) {
                return (i.emoji || "🥩") + " " + i.name + " × " + i.qty;
            }).join(" • ");

            var trackingHtml = "";
            if (o.riderInfo || o.trackingInfo) {
                trackingHtml = '<div class="oc-tracking">' +
                    (o.courier === "Lalamove" && o.riderInfo
                        ? "🏍️ <strong>Rider:</strong> " + o.riderInfo
                        : o.trackingInfo
                            ? "📦 <strong>Tracking #:</strong> " + o.trackingInfo
                            : ""
                    ) +
                '</div>';
            }

            var cancelHtml = "";
            if (o.status === "Pending") {
                cancelHtml = '<div class="oc-actions">' +
                    '<button class="btn-cancel-order" onclick="openCancelModal(\'' + id + '\')">' +
                        '❌ Cancel Order' +
                    '</button>' +
                '</div>';
            }

            return '<div class="order-card">' +
                '<div class="oc-header">' +
                    '<div>' +
                        '<span class="oc-id">' + id + '</span>' +
                        '<span class="oc-date"> • ' + formatDate(o.createdAt) + '</span>' +
                    '</div>' +
                    '<span class="badge-s ' + sc + '">' + o.status + '</span>' +
                '</div>' +
                '<p class="oc-items">' + itemsList + '</p>' +
                trackingHtml +
                '<div class="oc-footer">' +
                    '<span class="oc-total">' + formatCurrency(o.total) + '</span>' +
                    '<span class="oc-courier">' + (o.courier === "Lalamove" ? "🏍️" : "📦") + ' ' + o.courier + '</span>' +
                '</div>' +
                cancelHtml +
            '</div>';
        }).join("");
    });
}

/* ==========================================
   CANCEL ORDER
   ========================================== */
function openCancelModal(orderId) {
    cancelTarget = orderId;
    var el = document.getElementById("cancel-order-id");
    if (el) el.textContent = orderId;
    var modal = document.getElementById("modal-cancel");
    if (modal) modal.classList.remove("hidden");
}

function closeCancelModal() {
    cancelTarget = null;
    var modal = document.getElementById("modal-cancel");
    if (modal) modal.classList.add("hidden");
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
        }).catch(function(err) {
            showToast("Error cancelling order: " + err.message);
        });
    });
}

/* ==========================================
   HELPER FUNCTIONS
   ========================================== */
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

/* ==========================================
   INITIAL LOAD
   ========================================== */
handleSignInLink();
updateBadge();
updateUIForUser();
