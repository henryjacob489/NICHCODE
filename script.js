/* ============================================================
   CROPGUARD AI — MAIN SCRIPT
   ------------------------------------------------------------
   One file, works on all 7 pages.
   Each section checks if its target elements exist before running,
   so nothing breaks on pages that don't use that feature.
   ============================================================ */


/* ============================================================
   1. MOBILE NAVBAR (hamburger toggle)
   Runs on: every page
   ============================================================ */
function toggleMenu() {
    const navLinks = document.getElementById("navLinks");
    if (navLinks) navLinks.classList.toggle("open");
}

// Close menu when a link is clicked
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const navLinks = document.getElementById("navLinks");
            if (navLinks) navLinks.classList.remove("open");
        });
    });
});


/* ============================================================
   2. CHAT (home page)
   Runs on: home.html only
   ============================================================ */
let pendingChatImage = null;

function handleChatImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    pendingChatImage = file;

    const preview = document.getElementById("chatPreviewImg");
    const previewBox = document.getElementById("chatImagePreview");
    preview.src = URL.createObjectURL(file);
    previewBox.style.display = "flex";
}

function removeChatImage() {
    pendingChatImage = null;
    document.getElementById("chatImageInput").value = "";
    document.getElementById("chatImagePreview").style.display = "none";
}

function clearChat() {
    const messages = document.getElementById("chatMessages");
    if (!messages) return;

    messages.innerHTML = `
        <div class="chat-msg bot">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble">
                Chat cleared. Upload a crop photo or ask a new question!
            </div>
        </div>
    `;
    removeChatImage();
}

async function sendChatMessage() {
    const input = document.getElementById("chatTextInput");
    const messages = document.getElementById("chatMessages");
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text && !pendingChatImage) return;

    // 1. Show user message
    if (pendingChatImage) {
        const imgUrl = URL.createObjectURL(pendingChatImage);
        messages.innerHTML += `
            <div class="chat-msg user">
                <div class="msg-avatar">👨‍🌾</div>
                <div class="msg-bubble">
                    <img src="${imgUrl}" alt="Crop image">
                    ${text ? escapeHtml(text) : "Please analyze this crop."}
                </div>
            </div>
        `;
    } else {
        messages.innerHTML += `
            <div class="chat-msg user">
                <div class="msg-avatar">👨‍🌾</div>
                <div class="msg-bubble">${escapeHtml(text)}</div>
            </div>
        `;
    }

    // 2. Clear input + show typing
    input.value = "";
    messages.scrollTop = messages.scrollHeight;

    const typingId = "typing-" + Date.now();
    messages.innerHTML += `
        <div class="chat-msg bot" id="${typingId}">
            <div class="msg-avatar">🤖</div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messages.scrollTop = messages.scrollHeight;

    // 3. Prepare request to Python
    const formData = new FormData();
    formData.append("message", text);
    if (pendingChatImage) formData.append("image", pendingChatImage);

    try {
        const res = await fetch("/chat", { method: "POST", body: formData });
        const data = await res.json();

        // 4. Remove typing, add AI reply
        document.getElementById(typingId)?.remove();
        messages.innerHTML += `
            <div class="chat-msg bot">
                <div class="msg-avatar">🤖</div>
                <div class="msg-bubble">${formatAIResponse(data.reply)}</div>
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;

    } catch (err) {
        document.getElementById(typingId)?.remove();
        messages.innerHTML += `
            <div class="chat-msg bot">
                <div class="msg-avatar">🤖</div>
                <div class="msg-bubble">
                    Sorry, I couldn't reach the AI. Please check your connection and try again.
                </div>
            </div>
        `;
    }

    removeChatImage();
}

// Converts markdown-ish AI text (with line breaks and **bold**) into HTML
function formatAIResponse(text) {
    if (!text) return "";
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
}

// Prevents HTML injection
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}


/* ============================================================
   3. HOME — Nearby dealers preview
   Runs on: home.html only
   ============================================================ */
async function loadHomeDealers() {
    const container = document.getElementById("homeDealerList");
    if (!container) return;

    try {
        const res = await fetch("/api/dealers");
        const dealers = await res.json();
        renderDealerMini(container, dealers.slice(0, 5));
    } catch (err) {
        container.innerHTML = `<p style="color:#999;">Dealers unavailable.</p>`;
    }
}

function renderDealerMini(container, dealers) {
    container.innerHTML = dealers.map(d => `
        <div class="dealer-mini">
            <h4>${escapeHtml(d.name)}</h4>
            <p>📍 ${escapeHtml(d.distance || "Near you")}</p>
            <p>📞 ${escapeHtml(d.phone)}</p>
            <span class="dealer-tag">${escapeHtml(d.products ? d.products[0] : "Agro-inputs")}</span>
        </div>
    `).join("");
}


/* ============================================================
   4. LIBRARY — Pest & disease grid, search, crop tabs
   Runs on: library.html only
   ============================================================ */
const PEST_DATA = [
    // MAIZE
    { crop: "maize", name: "Fall Armyworm", icon: "🐛", part: "Leaf, whorl",
      symptoms: "Ragged holes, moist frass, larvae in whorl", treatment: "Insecticide" },
    { crop: "maize", name: "Stem Borer", icon: "🐛", part: "Stem",
      symptoms: "Dead heart, holes in stalk, broken stems", treatment: "Insecticide" },
    { crop: "maize", name: "Downy Mildew", icon: "🍂", part: "Leaf",
      symptoms: "Yellow streaks, white fungal growth", treatment: "Fungicide" },
    { crop: "maize", name: "Striga (Witchweed)", icon: "🌿", part: "Root zone",
      symptoms: "Purple flowers, stunted growth, yellowing", treatment: "Herbicide" },
    { crop: "maize", name: "Maize Streak Virus", icon: "🦠", part: "Leaf",
      symptoms: "Yellow streaks along veins, stunting", treatment: "Virucide" },

    // CASSAVA
    { crop: "cassava", name: "Cassava Mosaic Disease", icon: "🦠", part: "Leaf",
      symptoms: "Mosaic pattern, distorted leaves, stunting", treatment: "Virucide" },
    { crop: "cassava", name: "Bacterial Blight", icon: "🍂", part: "Leaf, stem",
      symptoms: "Angular leaf spots, gum exudate, wilting", treatment: "Bactericide" },
    { crop: "cassava", name: "Green Mite", icon: "🕷️", part: "Leaf",
      symptoms: "Yellow spots, leaf drop, tiny mites on underside", treatment: "Acaricide" },

    // RICE
    { crop: "rice", name: "Rice Blast", icon: "🍂", part: "Leaf, neck",
      symptoms: "Diamond-shaped spots, neck rot", treatment: "Fungicide" },
    { crop: "rice", name: "Bacterial Leaf Blight", icon: "🦠", part: "Leaf",
      symptoms: "Yellow-white lesions from leaf tip, wilting", treatment: "Bactericide" },
    { crop: "rice", name: "Stem Borer", icon: "🐛", part: "Stem",
      symptoms: "Dead heart, white earheads", treatment: "Insecticide" },

    // TOMATO
    { crop: "tomato", name: "Late Blight", icon: "🍂", part: "Leaf, fruit",
      symptoms: "Brown patches, white mold, fruit rot", treatment: "Fungicide" },
    { crop: "tomato", name: "Leaf Miner", icon: "🐛", part: "Leaf",
      symptoms: "Winding white trails inside leaf", treatment: "Insecticide" },
    { crop: "tomato", name: "Bacterial Wilt", icon: "🦠", part: "Whole plant",
      symptoms: "Sudden wilting, vascular browning", treatment: "Bactericide" },

    // YAM
    { crop: "yam", name: "Anthracnose", icon: "🍂", part: "Leaf, vine",
      symptoms: "Dark sunken lesions, dieback", treatment: "Fungicide" },
    { crop: "yam", name: "Yam Mosaic Virus", icon: "🦠", part: "Leaf",
      symptoms: "Mottled leaves, reduced tuber size", treatment: "Virucide" },
    { crop: "yam", name: "Nematodes", icon: "🪱", part: "Root/tuber",
      symptoms: "Galls on roots, poor tuber yield", treatment: "Nematicide" },

    // PEPPER
    { crop: "pepper", name: "Anthracnose", icon: "🍂", part: "Fruit",
      symptoms: "Sunken circular spots on fruit", treatment: "Fungicide" },
    { crop: "pepper", name: "Bacterial Spot", icon: "🦠", part: "Leaf, fruit",
      symptoms: "Water-soaked spots, leaf drop", treatment: "Bactericide" },
    { crop: "pepper", name: "Aphids", icon: "🐜", part: "Leaf, shoot",
      symptoms: "Curled leaves, sticky honeydew, sooty mold", treatment: "Insecticide" },
];

let currentCrop = "all";
let currentSearch = "";

function renderLibrary() {
    const grid = document.getElementById("libraryGrid");
    if (!grid) return;

    const filtered = PEST_DATA.filter(p => {
        const matchCrop = currentCrop === "all" || p.crop === currentCrop;
        const q = currentSearch.toLowerCase();
        const matchSearch = !q ||
            p.name.toLowerCase().includes(q) ||
            p.crop.toLowerCase().includes(q) ||
            p.symptoms.toLowerCase().includes(q) ||
            p.treatment.toLowerCase().includes(q);
        return matchCrop && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No results found</h3>
                <p>Try a different crop or search term.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="pest-card ${p.crop}">
            <div class="pest-card-header">
                <div class="pest-card-icon">${p.icon}</div>
                <div class="pest-card-title">
                    <h3>${escapeHtml(p.name)}</h3>
                    <span class="pest-card-crop">${p.crop}</span>
                </div>
            </div>
            <div class="pest-card-body">
                <div class="pest-info-row">
                    <span class="label">Affected:</span>
                    <span class="value">${escapeHtml(p.part)}</span>
                </div>
                <div class="pest-info-row">
                    <span class="label">Symptoms:</span>
                    <span class="value">${escapeHtml(p.symptoms)}</span>
                </div>
                <span class="treatment-tag ${p.treatment.toLowerCase()}">${p.treatment}</span>
            </div>
            <div class="pest-card-footer">
                <a href="/scan" class="pest-scan-btn">📸 Scan My Crop →</a>
            </div>
        </div>
    `).join("");
}

function filterLibrary() {
    const input = document.getElementById("librarySearch");
    if (input) currentSearch = input.value;
    renderLibrary();
}

function selectCropTab(crop) {
    currentCrop = crop;
    document.querySelectorAll(".crop-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.crop === crop);
    });
    renderLibrary();
}


/* ============================================================
   5. DEALERS PAGE — list + filter
   Runs on: dealers.html only
   ============================================================ */
let allDealers = [];

async function loadDealersPage() {
    const container = document.getElementById("dealerList");
    if (!container) return;

    try {
        const res = await fetch("/api/dealers");
        allDealers = await res.json();
        renderDealers(allDealers);
    } catch (err) {
        container.innerHTML = `<p style="color:#999;">Could not load dealers.</p>`;
    }
}

function filterDealers() {
    const val = document.getElementById("dealerFilter").value;
    const filtered = val === "all"
        ? allDealers
        : allDealers.filter(d => d.products && d.products.includes(val));
    renderDealers(filtered);
}

function renderDealers(dealers) {
    const container = document.getElementById("dealerList");
    if (!container) return;

    if (dealers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏪</div>
                <h3>No dealers match this filter</h3>
                <p>Try a different product category.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = dealers.map(d => `
        <div class="dealer-card">
            <div class="dealer-card-header">
                <div>
                    <h3>${escapeHtml(d.name)}</h3>
                    <p class="dealer-owner">Owner: ${escapeHtml(d.owner || "—")}</p>
                </div>
                ${d.cac ? `<span class="dealer-verified">✓ VERIFIED</span>` : ""}
            </div>
            <div class="dealer-info">
                <div class="info-row"><span class="info-icon">📍</span>${escapeHtml(d.location || "—")}</div>
                <div class="info-row"><span class="info-icon">📞</span>${escapeHtml(d.phone || "—")}</div>
                <div class="info-row"><span class="info-icon">🕐</span>${escapeHtml(d.hours || "—")}</div>
            </div>
            <div class="dealer-tags">
                ${(d.products || []).map(p => `<span class="tag">${escapeHtml(p)}</span>`).join("")}
            </div>
            <div class="dealer-actions">
                <a href="tel:${escapeHtml(d.phone || "")}" class="call-btn">📞 Call</a>
                <a href="https://www.google.com/maps?q=${encodeURIComponent(d.location || "")}"
                   target="_blank" class="directions-btn">🗺️ Directions</a>
            </div>
        </div>
    `).join("");
}


/* ============================================================
   6. FARMER SIGN UP — form submit
   Runs on: farmer-signup.html only
   ============================================================ */
async function registerFarmer(event) {
    event.preventDefault();

    const crops = Array.from(document.querySelectorAll(
        '#farmerForm input[type="checkbox"]:checked'
    )).map(cb => cb.value);

    if (crops.length === 0) {
        alert("Please select at least one crop you grow.");
        return;
    }

    const data = {
        name: document.getElementById("farmerName").value,
        phone: document.getElementById("farmerPhone").value,
        state: document.getElementById("farmerState").value,
        lga: document.getElementById("farmerLGA").value,
        crops: crops,
        farmSize: document.getElementById("farmerFarmSize").value,
    };

    try {
        await fetch("/api/farmers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (err) {
        console.warn("Save failed (demo continues):", err);
    }

    document.getElementById("farmerForm").style.display = "none";
    document.getElementById("farmerSuccess").style.display = "block";
}


/* ============================================================
   7. DEALER SIGN UP — form submit + GPS
   Runs on: dealer-signup.html only
   ============================================================ */
async function registerDealer(event) {
    event.preventDefault();

    const products = Array.from(document.querySelectorAll(
        '#dealerForm input[type="checkbox"]:checked'
    )).map(cb => cb.value);

    if (products.length === 0) {
        alert("Please select at least one product category.");
        return;
    }

    const data = {
        name: document.getElementById("storeName").value,
        owner: document.getElementById("ownerName").value,
        phone: document.getElementById("dealerPhone").value,
        state: document.getElementById("dealerState").value,
        lga: document.getElementById("dealerLGA").value,
        gps: document.getElementById("dealerGPS").value,
        products: products,
        hours: document.getElementById("dealerHours").value,
        cac: document.getElementById("dealerCAC").value,
    };

    try {
        await fetch("/api/dealers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (err) {
        console.warn("Save failed (demo continues):", err);
    }

    document.getElementById("dealerForm").style.display = "none";
    document.getElementById("dealerSuccess").style.display = "block";
}

function getLocation() {
    const field = document.getElementById("dealerGPS");
    if (!field) return;

    if (!navigator.geolocation) {
        alert("Geolocation is not supported on this device.");
        return;
    }

    field.value = "Locating...";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            field.value = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        },
        (err) => {
            field.value = "";
            alert("Could not get location. Please type it in manually.");
        }
    );
}


/* ============================================================
   8. SCAN PAGE — upload + analyze
   Runs on: scan.html only
   ============================================================ */
function initScanPage() {
    const input = document.getElementById("imageInput");
    const preview = document.getElementById("preview");
    const zone = document.getElementById("uploadZone");
    if (!input || !zone) return;

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
    });

    // Drag-and-drop
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (!file) return;
        input.files = e.dataTransfer.files;
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
    });
}

async function analyzeImage() {
    const input = document.getElementById("imageInput");
    const file = input?.files[0];
    if (!file) {
        alert("Please upload an image first.");
        return;
    }

    const cropSelect = document.getElementById("cropSelect");
    const crop = cropSelect ? cropSelect.value : "auto";

    document.getElementById("loading").style.display = "block";
    document.getElementById("analyzeBtn").disabled = true;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("crop", crop);

    try {
        const res = await fetch("/analyze", { method: "POST", body: formData });
        const data = await res.json();
        sessionStorage.setItem("diagnosisResult", JSON.stringify(data));
        window.location.href = "/result";
    } catch (err) {
        alert("Analysis failed. Please try again.");
        document.getElementById("loading").style.display = "none";
        document.getElementById("analyzeBtn").disabled = false;
    }
}


/* ============================================================
   9. RESULT PAGE — display stored diagnosis
   Runs on: result.html only
   ============================================================ */
function loadResultPage() {
    const icon = document.getElementById("resultIcon");
    if (!icon) return;

    const raw = sessionStorage.getItem("diagnosisResult");
    const data = raw ? JSON.parse(raw) : null;

    if (!data || !data.result) {
        document.getElementById("issueName").textContent = "No result found";
        document.getElementById("actionText").textContent =
            "Please scan a crop image first.";
        return;
    }

    const r = data.result;

    document.getElementById("issueName").textContent = r.issue || "Unknown";
    document.getElementById("detectedCrop").textContent = r.crop || "—";
    document.getElementById("affectedPart").textContent = r.affected_part || "—";
    document.getElementById("confidenceLevel").textContent = r.confidence || "—";
    document.getElementById("severity").textContent = r.severity || "—";
    document.getElementById("treatmentType").textContent = r.treatment_category || "None";
    document.getElementById("actionText").textContent = r.action || "—";

    if ((r.issue || "").toLowerCase() === "healthy") {
        icon.textContent = "✅";
        icon.classList.add("healthy");
    } else if ((r.confidence || "").toLowerCase() === "high") {
        icon.textContent = "🚨";
        icon.classList.add("danger");
    }
}


/* ============================================================
   10. PAGE ROUTER — run the right code per page
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;

    if (path === "/" || path === "/home") {
        loadHomeDealers();
    } else if (path === "/library") {
        renderLibrary();
    } else if (path === "/dealers") {
        loadDealersPage();
    } else if (path === "/scan") {
        initScanPage();
    } else if (path === "/result") {
        loadResultPage();
    }
});