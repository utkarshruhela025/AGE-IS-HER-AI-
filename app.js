// State variables
let isMonitoring = false;
let audioContext, analyser, microphone, javascriptNode;
let currentCoords = { lat: 28.9845, lng: 77.7064 }; // Default fallback coordinates
let lastTriggerTime = 0;

// UI Elements
const statusBox = document.getElementById("status-box");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const audioLevelDisplay = document.getElementById("audio-level");
const motionLevelDisplay = document.getElementById("motion-level");
const threatScoreDisplay = document.getElementById("threat-score");
const logsContainer = document.getElementById("logs");

// Initialize Map using Leaflet
const map = L.map("map").setView([currentCoords.lat, currentCoords.lng], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
}).addTo(map);
let userMarker = L.marker([currentCoords.lat, currentCoords.lng]).addTo(map);

// Get real GPS position
if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos) => {
        currentCoords.lat = pos.coords.latitude;
        currentCoords.lng = pos.coords.longitude;
        userMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
        map.setView([currentCoords.lat, currentCoords.lng]);
    });
}

// Start Monitoring Button Event
startBtn.addEventListener("click", async () => {
    try {
        await initAudioListening();
        initMotionDetection();
        initSpeechRecognition();

        isMonitoring = true;
        statusBox.className = "status-box active";
        statusBox.innerText = "ACTIVE • LISTENING FOR THREATS";
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        alert("Please grant Microphone & Sensor permissions to start: " + err.message);
    }
});

// Stop Monitoring Button Event
stopBtn.addEventListener("click", () => {
    isMonitoring = false;
    if (audioContext) audioContext.close();
    statusBox.className = "status-box standby";
    statusBox.innerText = "SYSTEM STANDBY";
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

// 1. Audio Level / Scream Analysis via Web Audio API
async function initAudioListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
        if (!isMonitoring) return;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;
        for (let i = 0; i < array.length; i++) {
            values += array[i];
        }
        const average = Math.round(values / array.length);
        audioLevelDisplay.innerText = average + " dB";

        // Acoustic threshold trigger (Loud scream / sudden high volume)
        if (average > 75) {
            triggerEmergency("Acoustic Threat / High Decibel Spike", 0.88);
        }
    };
}

// 2. Motion / Sudden Drop / Violent Grab Detection
function initMotionDetection() {
    if (window.DeviceMotionEvent) {
        window.addEventListener("devicemotion", (event) => {
            if (!isMonitoring) return;
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            // Calculate total acceleration vector
            const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
            motionLevelDisplay.innerText = magnitude.toFixed(1) + " m/s²";

            // Threshold for violent grab or sudden fall (normal is ~9.8 m/s²)
            if (magnitude > 28) {
                triggerEmergency("Kinematic Anomaly / Violent Phone Grab", 0.94);
            }
        });
    }
}

// 3. Safe-Word Voice Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        console.log("Heard:", transcript);

        // Customizable Safe-Words
        if (transcript.includes("red orchid") || transcript.includes("help") || transcript.includes("save me")) {
            triggerEmergency(`Safe-Word Vocalized: "${transcript}"`, 0.99);
        }
    };

    recognition.onend = () => {
        if (isMonitoring) recognition.start(); // Keep listening continuous
    };

    recognition.start();
}

// 4. Multi-Tier Dispatch Handler
async function triggerEmergency(threatType, score) {
    const now = Date.now();
    // Debounce to prevent multiple triggers within 6 seconds
    if (now - lastTriggerTime < 6000) return;
    lastTriggerTime = now;

    threatScoreDisplay.innerText = score.toFixed(2);
    statusBox.className = "status-box alert";
    statusBox.innerText = "🚨 EMERGENCY DISPATCH TRIGGERED";

    // Send payload to the FastAPI Python Backend
    try {
        const response = await fetch("http://192.168.1.15:8000/api/trigger-alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                threat_type: threatType,
                threat_score: score,
                latitude: currentCoords.lat,
                longitude: currentCoords.lng,
                details: "Zero-touch edge detection event"
            })
        });

        const data = await response.json();
        
        // Log to Dashboard
        const logItem = document.createElement("p");
        logItem.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${threatType} | Hash: ${data.incident.vault_hash.substring(0, 10)}...`;
        logsContainer.prepend(logItem);

    } catch (err) {
        console.error("Failed to reach Python backend:", err);
    }
}