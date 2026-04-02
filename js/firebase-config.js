import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCjdkZKVjzHdXGQiDsDaCy2x9O6khFYQMA",
  authDomain: "meatlogic-68c9b.firebaseapp.com",
  databaseURL: "https://meatlogic-68c9b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "meatlogic-68c9b",
  storageBucket: "meatlogic-68c9b.firebasestorage.app",
  messagingSenderId: "404862252936",
  appId: "1:404862252936:web:3dc93ba393b67504d96c3d",
  measurementId: "G-YHWXJEPJ1J"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---- Admin Credentials (change if you want) ---- */
const ADMIN_EMAIL = "admin@meatlogic.com";
const ADMIN_PASSWORD = "admin123";

/* ---- Helper Functions ---- */
function formatCurrency(n) {
    return "₱" + Number(n).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-PH", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function showToast(msg) {
    const t = document.getElementById("toast");
    const m = document.getElementById("toast-msg");
    m.textContent = msg;
    t.classList.remove("hidden");
    t.classList.add("show");
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.classList.add("hidden"), 300);
    }, 3000);
}

function compressImage(file, maxW, quality) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                let w = img.width, h = img.height;
                if (w > maxW) { h = (maxW / w) * h; w = maxW; }
                c.width = w; c.height = h;
                c.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL("image/jpeg", quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* ---- Initialize Default Products (run once) ---- */
function loadDefaultProducts() {
    const defaults = {
        p1:  { name: "Beef Sirloin",     category: "beef",      price: 380, unit: "per kg",   emoji: "🥩", onlineStock: 15 },
        p2:  { name: "Beef Short Ribs",  category: "beef",      price: 350, unit: "per kg",   emoji: "🥩", onlineStock: 10 },
        p3:  { name: "Beef Brisket",     category: "beef",      price: 320, unit: "per kg",   emoji: "🥩", onlineStock: 12 },
        p4:  { name: "Ground Beef",      category: "beef",      price: 280, unit: "per kg",   emoji: "🥩", onlineStock: 20 },
        p5:  { name: "Pork Belly",       category: "pork",      price: 290, unit: "per kg",   emoji: "🍖", onlineStock: 25 },
        p6:  { name: "Pork Chop",        category: "pork",      price: 250, unit: "per kg",   emoji: "🍖", onlineStock: 20 },
        p7:  { name: "Pork Ribs",        category: "pork",      price: 270, unit: "per kg",   emoji: "🍖", onlineStock: 15 },
        p8:  { name: "Pork Tenderloin",  category: "pork",      price: 300, unit: "per kg",   emoji: "🍖", onlineStock: 10 },
        p9:  { name: "Chicken Breast",   category: "chicken",   price: 180, unit: "per kg",   emoji: "🍗", onlineStock: 30 },
        p10: { name: "Chicken Thigh",    category: "chicken",   price: 160, unit: "per kg",   emoji: "🍗", onlineStock: 25 },
        p11: { name: "Whole Chicken",    category: "chicken",   price: 200, unit: "per pc",   emoji: "🍗", onlineStock: 15 },
        p12: { name: "Chicken Wings",    category: "chicken",   price: 190, unit: "per kg",   emoji: "🍗", onlineStock: 20 },
        p13: { name: "Pork Longganisa",  category: "processed", price: 150, unit: "per pack", emoji: "🌭", onlineStock: 20 },
        p14: { name: "Beef Tapa",        category: "processed", price: 200, unit: "per pack", emoji: "🥓", onlineStock: 15 },
        p15: { name: "Skinless Hotdog",  category: "processed", price: 120, unit: "per pack", emoji: "🌭", onlineStock: 25 },
        p16: { name: "Beef Tocino",      category: "processed", price: 180, unit: "per pack", emoji: "🥓", onlineStock: 18 }
    };
    return db.ref("products").set(defaults);
}