// --- Constants for BLE ---
// Note: We'll need to match this UUID in the ESP32 code
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// --- Category Names ---
const CATEGORIES = [
    "Psychological Assessment",
    "Industrial Organizational Psychology",
    "Abnormal Psychology",
    "Developmental Psychology"
];
const CAT_SHORT = ["PA", "IO", "AP", "DP"];

// --- State ---
let cards = JSON.parse(localStorage.getItem('studyCards')) || [];
let filterCategory = 'all'; // 'all' or 0-3
let bluetoothDevice;
let bluetoothCharacteristic;

// --- DOM Elements ---
const categorySelect = document.getElementById('categorySelect');
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');
const addBtn = document.getElementById('addBtn');
const cardList = document.getElementById('cardList');
const clearBtn = document.getElementById('clearBtn');
const syncBtn = document.getElementById('syncBtn');
const statusText = document.getElementById('statusText');
const categoryTabs = document.getElementById('categoryTabs');

// --- Initialization ---
renderCards();

// --- Event Listeners ---
addBtn.addEventListener('click', addCard);
clearBtn.addEventListener('click', clearDeck);
syncBtn.addEventListener('click', connectAndSync);

// Category tab filtering
categoryTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('cat-tab')) {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        filterCategory = e.target.dataset.cat === 'all' ? 'all' : parseInt(e.target.dataset.cat);
        renderCards();
    }
});

// --- Functions ---

function addCard() {
    const q = questionInput.value.trim();
    const a = answerInput.value.trim();
    const cat = parseInt(categorySelect.value);

    if (!q || !a) {
        alert("Please enter both a question and an answer!");
        return;
    }

    const newCard = { id: Date.now(), q, a, cat };
    cards.push(newCard);
    saveCards();
    renderCards();

    // Clear inputs (keep category selected)
    questionInput.value = '';
    answerInput.value = '';
    questionInput.focus();
}

function deleteCard(id) {
    cards = cards.filter(c => c.id !== id);
    saveCards();
    renderCards();
}

function clearDeck() {
    if (confirm("Are you sure you want to delete all cards?")) {
        cards = [];
        saveCards();
        renderCards();
    }
}

function saveCards() {
    localStorage.setItem('studyCards', JSON.stringify(cards));
}

function renderCards() {
    cardList.innerHTML = '';

    // Filter by category
    const filtered = filterCategory === 'all'
        ? cards
        : cards.filter(c => c.cat === filterCategory);

    if (filtered.length === 0) {
        const msg = filterCategory === 'all'
            ? 'No cards yet. Add some above!'
            : `No cards in ${CATEGORIES[filterCategory]}`;
        cardList.innerHTML = `<li class="empty-state">${msg}</li>`;
        return;
    }

    filtered.forEach(card => {
        const li = document.createElement('li');
        const catLabel = CAT_SHORT[card.cat] || 'PA';
        const catClass = `cat-badge cat-${card.cat}`;
        li.innerHTML = `
            <div class="card-preview">
                <div class="card-header-row">
                    <span class="${catClass}">${catLabel}</span>
                    <span class="q-text">${card.q}</span>
                </div>
                <span class="a-text">A: ${card.a}</span>
            </div>
            <span class="delete-icon">×</span>
        `;
        li.querySelector('.delete-icon').onclick = () => deleteCard(card.id);
        cardList.appendChild(li);
    });
}

// --- Bluetooth Logic ---

async function connectAndSync() {
    if (!navigator.bluetooth) {
        statusText.textContent = "Web Bluetooth not supported on this browser/device.";
        return;
    }

    try {
        statusText.textContent = "Scanning for 'StudyBuddy'...";

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'StudyBuddy_Reviewer' }],
            optionalServices: [SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        statusText.textContent = "Connecting...";
        const server = await bluetoothDevice.gatt.connect();

        statusText.textContent = "Getting Service...";
        const service = await server.getPrimaryService(SERVICE_UUID);

        statusText.textContent = "Getting Characteristic...";
        bluetoothCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        statusText.textContent = "Connected! Syncing...";
        await sendData();

    } catch (error) {
        console.error(error);
        statusText.textContent = "Error: " + error.message;
    }
}

async function sendData() {
    if (!bluetoothCharacteristic) return;

    // Protocol: CLEAR first, then ADD each card with category
    const encoder = new TextEncoder();

    try {
        // 1. Send CLEAR command
        await bluetoothCharacteristic.writeValue(encoder.encode("CLEAR"));
        await new Promise(r => setTimeout(r, 100)); // Small delay

        // 2. Send each card with category
        for (const card of cards) {
            // Format: ADD|Category|Question|Answer
            const cat = card.cat !== undefined ? card.cat : 0;
            const payload = `ADD|${cat}|${card.q}|${card.a}`;
            await bluetoothCharacteristic.writeValue(encoder.encode(payload));
            await new Promise(r => setTimeout(r, 100)); // Delay between packets
        }

        statusText.textContent = `Sync Complete! ✅ (${cards.length} cards)`;
        setTimeout(() => bluetoothCharacteristic.startNotifications(), 500);

    } catch (err) {
        statusText.textContent = "Sync Failed: " + err.message;
    }
}

function onDisconnected(event) {
    statusText.textContent = "Device Disconnected";
    bluetoothCharacteristic = null;
    bluetoothDevice = null;
}
