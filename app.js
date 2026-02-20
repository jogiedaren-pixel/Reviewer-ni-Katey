// --- Constants ---
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const CATEGORIES = [
    { id: 0, name: "Psychological Assessment", short: "PA", color: "var(--cat-0)" },
    { id: 1, name: "Industrial Organizational Psych", short: "IO", color: "var(--cat-1)" },
    { id: 2, name: "Abnormal Psychology", short: "AP", color: "var(--cat-2)" },
    { id: 3, name: "Developmental Psychology", short: "DP", color: "var(--cat-3)" }
];

// --- State ---
let cards = JSON.parse(localStorage.getItem('studyCards')) || [];
let activeSetId = null; // 0-3
let studyQueue = [];
let currentCardIndex = 0;
let isFlipped = false;
let theme = localStorage.getItem('theme') || 'light';

// --- DOM Elements ---
const views = {
    home: document.getElementById('view-home'),
    set: document.getElementById('view-set'),
    study: document.getElementById('view-study')
};

const setsGrid = document.getElementById('setsGrid');
const themeToggle = document.getElementById('themeToggle');
const syncBtn = document.getElementById('syncBtn');
const toast = document.getElementById('toast');

// Set View Elements
const backToHome = document.getElementById('backToHome');
const setTitle = document.getElementById('setTitle');
const setBadge = document.getElementById('setBadge');
const setCount = document.getElementById('setCount');
const termsList = document.getElementById('termsList');
const newQuestion = document.getElementById('newQuestion');
const newAnswer = document.getElementById('newAnswer');
const addCardBtn = document.getElementById('addCardBtn');
const studyBtn = document.getElementById('studyBtn');
const clearDeckBtn = document.getElementById('clearDeckBtn');
const termsCountLabel = document.getElementById('termsCountLabel');

// Modal Elements
const confirmModal = document.getElementById('confirmModal');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');

// Study View Elements
const closeStudy = document.getElementById('closeStudy');
const studyProgress = document.getElementById('studyProgress');
const activeCard = document.getElementById('activeCard');
const cardFrontText = document.getElementById('cardFrontText');
const cardBackText = document.getElementById('cardBackText');
const prevCardBtn = document.getElementById('prevCard');
const nextCardBtn = document.getElementById('nextCard');
const flipCardBtn = document.getElementById('flipCardBtn');
const shuffleBtn = document.getElementById('shuffleBtn');

// --- Initialization ---
applyTheme(theme);
renderHome();

// --- Event Listeners ---

// Navigation & Theme
themeToggle.addEventListener('click', toggleTheme);
backToHome.addEventListener('click', () => switchView('home'));
closeStudy.addEventListener('click', () => switchView('set'));

// Set Actions
addCardBtn.addEventListener('click', addCardToActiveSet);
studyBtn.addEventListener('click', startStudyMode);
clearDeckBtn.addEventListener('click', showClearConfirm);
confirmCancel.addEventListener('click', hideModal);
confirmOk.addEventListener('click', clearActiveSet);

// Study Actions
activeCard.addEventListener('click', flipCard);
flipCardBtn.addEventListener('click', flipCard);
nextCardBtn.addEventListener('click', nextCard);
prevCardBtn.addEventListener('click', prevCard);
shuffleBtn.addEventListener('click', shuffleStudyQueue);

// Sync
syncBtn.addEventListener('click', connectAndSync);

// --- Functions ---

// 1. Theme Logic
function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    applyTheme(theme);
    localStorage.setItem('theme', theme);
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeToggle.textContent = t === 'light' ? '🌙' : '☀️';
}

// 2. Navigation Logic
function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    if (viewName === 'home') renderHome();
}

// 3. Render Home Dashboard
function renderHome() {
    setsGrid.innerHTML = '';

    CATEGORIES.forEach(cat => {
        const count = cards.filter(c => c.cat === cat.id).length;
        const card = document.createElement('div');
        card.className = 'set-card';
        card.onclick = () => openSet(cat.id);

        card.innerHTML = `
            <div>
                <span class="set-badge" style="background-color: ${cat.color}">${cat.short}</span>
                <h3 class="set-card-title" style="margin-top: 12px">${cat.name}</h3>
            </div>
            <div class="set-card-meta">
                <span>${count} terms</span>
                <span>👤 Reviewer</span>
            </div>
        `;
        setsGrid.appendChild(card);
    });
}

// 4. Set Details Logic
function openSet(id) {
    activeSetId = id;
    const cat = CATEGORIES[id];

    setTitle.textContent = cat.name;
    setBadge.textContent = cat.short;
    setBadge.style.backgroundColor = cat.color;

    renderTermsList();
    switchView('set');
}

function renderTermsList() {
    const setCards = cards.filter(c => c.cat === activeSetId);
    setCount.textContent = `${setCards.length} terms`;
    termsCountLabel.textContent = setCards.length;
    termsList.innerHTML = '';

    if (setCards.length === 0) {
        termsList.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-secondary); font-style: italic;">No terms yet. Add one above!</div>`;
        return;
    }

    setCards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'term-item';
        item.innerHTML = `
            <div class="term-content">
                <span class="term-q">${card.q}</span>
                <span class="term-a">${card.a}</span>
            </div>
            <button class="delete-btn" onclick="deleteCard(${card.id})">×</button>
        `;
        termsList.appendChild(item);
    });
}

// Clear Deck with Confirmation
function showClearConfirm() {
    const setCards = cards.filter(c => c.cat === activeSetId);
    if (setCards.length === 0) return;
    const catName = CATEGORIES[activeSetId].name;
    document.getElementById('confirmMsg').textContent =
        `This will delete all ${setCards.length} cards in "${catName}". This cannot be undone.`;
    confirmModal.classList.remove('hidden');
}

function hideModal() {
    confirmModal.classList.add('hidden');
}

function clearActiveSet() {
    cards = cards.filter(c => c.cat !== activeSetId);
    saveCards();
    renderTermsList();
    hideModal();
    showToast('Deck cleared');
}

function addCardToActiveSet() {
    const q = newQuestion.value.trim();
    const a = newAnswer.value.trim();

    if (!q || !a) return;

    cards.push({
        id: Date.now(),
        cat: activeSetId,
        q,
        a
    });

    saveCards();
    renderTermsList();

    newQuestion.value = '';
    newAnswer.value = '';
    newQuestion.focus();
}

// Make delete global so onclick works
window.deleteCard = function (id) {
    if (confirm("Delete this card?")) {
        cards = cards.filter(c => c.id !== id);
        saveCards();
        renderTermsList();
    }
}

function saveCards() {
    localStorage.setItem('studyCards', JSON.stringify(cards));
}

// 5. Study Mode Logic
function startStudyMode() {
    studyQueue = cards.filter(c => c.cat === activeSetId);
    if (studyQueue.length === 0) {
        alert("Add some cards first!");
        return;
    }

    currentCardIndex = 0;
    isFlipped = false;
    renderActiveCard();
    switchView('study');
}

function renderActiveCard() {
    const card = studyQueue[currentCardIndex];
    cardFrontText.textContent = card.q;
    cardBackText.textContent = card.a;
    studyProgress.textContent = `${currentCardIndex + 1} / ${studyQueue.length}`;

    activeCard.classList.remove('flipped');
    isFlipped = false;
}

function flipCard() {
    isFlipped = !isFlipped;
    activeCard.classList.toggle('flipped', isFlipped);
}

function nextCard() {
    if (currentCardIndex < studyQueue.length - 1) {
        currentCardIndex++;
        renderActiveCard();
    } else {
        // Loop back to start? Or finish?
        if (confirm("End of deck. Restart?")) {
            currentCardIndex = 0;
            renderActiveCard();
        }
    }
}

function prevCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        renderActiveCard();
    }
}

function shuffleStudyQueue() {
    // Fisher-Yates shuffle
    for (let i = studyQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [studyQueue[i], studyQueue[j]] = [studyQueue[j], studyQueue[i]];
    }
    currentCardIndex = 0;
    renderActiveCard();
    showToast("Deck Shuffled!");
}

// 6. BLE Sync Logic
async function connectAndSync() {
    if (!navigator.bluetooth) {
        alert("Web Bluetooth not supported.");
        return;
    }

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'StudyBuddy_Reviewer' }],
            optionalServices: [SERVICE_UUID]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        showToast("Syncing...");
        await sendData(characteristic);

    } catch (error) {
        console.error(error);
        alert("Sync Failed: " + error.message);
    }
}

async function sendData(characteristic) {
    const encoder = new TextEncoder();

    // 1. CLEAR
    await characteristic.writeValue(encoder.encode("CLEAR"));
    await new Promise(r => setTimeout(r, 100));

    // 2. ADD Each Card
    for (const card of cards) {
        const cat = card.cat !== undefined ? card.cat : 0;
        const payload = `ADD|${cat}|${card.q}|${card.a}`;
        await characteristic.writeValue(encoder.encode(payload));
        await new Promise(r => setTimeout(r, 80)); // Slight delay
    }

    showToast("Sync Complete! ✅");
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}
