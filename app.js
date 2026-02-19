// --- Constants for BLE ---
// Note: We'll need to match this UUID in the ESP32 code
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// --- State ---
let cards = JSON.parse(localStorage.getItem('studyCards')) || [];
let bluetoothDevice;
let bluetoothCharacteristic;

// --- DOM Elements ---
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');
const addBtn = document.getElementById('addBtn');
const cardList = document.getElementById('cardList');
const clearBtn = document.getElementById('clearBtn');
const syncBtn = document.getElementById('syncBtn');
const statusText = document.getElementById('statusText');

// --- Initialization ---
renderCards();

// --- Event Listeners ---
addBtn.addEventListener('click', addCard);
clearBtn.addEventListener('click', clearDeck);
syncBtn.addEventListener('click', connectAndSync);

// --- Functions ---

function addCard() {
    const q = questionInput.value.trim();
    const a = answerInput.value.trim();

    if (!q || !a) {
        alert("Please enter both a question and an answer!");
        return;
    }

    const newCard = { id: Date.now(), q, a };
    cards.push(newCard);
    saveCards();
    renderCards();

    // Clear inputs
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

    if (cards.length === 0) {
        cardList.innerHTML = '<li class="empty-state">No cards yet. Add some above!</li>';
        return;
    }

    cards.forEach(card => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="card-preview">
                <span class="q-text">Q: ${card.q}</span>
                <span class="a-text">A: ${card.a}</span>
            </div>
            <span class="delete-icon" onclick="deleteCard(${card.id})">×</span>
        `;
        // Hacky global bind for the onclick, better to use event delegation but this is simple
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

    // Protocol: CLEAR first, then ADD each card
    const encoder = new TextEncoder();

    try {
        // 1. Send CLEAR command
        await bluetoothCharacteristic.writeValue(encoder.encode("CLEAR"));
        await new Promise(r => setTimeout(r, 100)); // Small delay

        // 2. Send each card
        for (const card of cards) {
            // Format: ADD|Question|Answer
            // Note: Simplistic, doesn't handle pipes in text yet
            const payload = `ADD|${card.q}|${card.a}`;
            await bluetoothCharacteristic.writeValue(encoder.encode(payload));
            await new Promise(r => setTimeout(r, 100)); // Delay between packets
        }

        statusText.textContent = "Sync Complete! ✅";
        setTimeout(() => bluetoothCharacteristic.startNotifications(), 500); // Listen for ACKs if we implemented them

    } catch (err) {
        statusText.textContent = "Sync Failed: " + err.message;
    }
}

function onDisconnected(event) {
    statusText.textContent = "Device Disconnected";
    bluetoothCharacteristic = null;
    bluetoothDevice = null;
}
