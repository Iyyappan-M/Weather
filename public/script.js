/**
 * SkyCast - Premium Weather Dashboard Logic
 */

// --- CONFIGURATION ---
const API_KEY = "8828708f974f9546a319ba23e5785588";
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

// --- DOM ELEMENTS ---
const elements = {
    cityInput: document.getElementById('city-input'),
    displayCity: document.getElementById('display-city'),
    temperature: document.getElementById('temperature'),
    description: document.getElementById('weather-description'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    feelsLike: document.getElementById('feels-like'),
    pressure: document.getElementById('pressure'),
    weatherIcon: document.getElementById('weather-icon'),
    currentDate: document.getElementById('current-date'),
    currentTime: document.getElementById('current-time'),
    sidebarName: document.getElementById('sidebar-name'),
    sidebarLocation: document.getElementById('sidebar-location'),
    welcomeUser: document.getElementById('welcome-user'),
    userAvatar: document.getElementById('user-avatar'),
    logoutBtn: document.getElementById('logout-btn'),
    locationBtn: document.getElementById('location-btn'),
    initialLoader: document.getElementById('initial-loader'),
    uvProgress: document.getElementById('uv-progress'),
    uvText: document.getElementById('uv-text'),
    weatherTip: document.getElementById('weather-tip'),
    suggestionsBox: document.getElementById('search-suggestions'),
    profileForm: document.getElementById('update-profile-form'),
    navItems: document.querySelectorAll('#main-nav li'),
    pages: document.querySelectorAll('.page-section'),
    bgContainer: document.getElementById('bg-container')
};

let currentUser = null;
let currentWeatherData = null;

// --- GAME STATE ---
let skyGame = {
    score: 0,
    highScore: localStorage.getItem('skyCatchHighScore') || 0,
    isGameOver: false,
    catcherX: 50,
    objects: [],
    spawnRate: 1500,
    lastSpawn: 0,
    difficulty: 1,
    loopId: null,
    isStarted: false
};

// --- INITIALIZATION ---
async function init() {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Initial ripple effects
    setupRipples();

    // Fetch User Profile
    currentUser = await apiFetch('/api/user/me');
    if (!currentUser) {
        window.location.href = '/login';
        return;
    }

    // Populate UI
    populateUserData(currentUser);
    
    // Fetch Initial Weather
    await fetchWeather(currentUser.city || 'London');

    // Remove Loader
    setTimeout(() => {
        elements.initialLoader.style.opacity = '0';
        setTimeout(() => elements.initialLoader.classList.add('hidden'), 500);
    }, 1000);

    // Event Listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            switchPage(section);
            elements.navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            if (section === 'game') {
                if (!skyGame.isStarted) initSkyGame();
            } else {
                stopSkyGame();
            }
        });
    });

    // Search
    elements.cityInput.addEventListener('input', debounce(handleSearchInput, 500));
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch(elements.cityInput.value);
    });

    elements.locationBtn.addEventListener('click', useGeolocation);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.profileForm.addEventListener('submit', handleProfileUpdate);
}

// --- CORE LOGIC ---

async function fetchWeather(city) {
    try {
        const response = await fetch(`${BASE_URL}?q=${city}&appid=${API_KEY}&units=metric`);
        const data = await response.json();

        if (response.ok) {
            updateWeatherUI(data);
        } else if (response.status === 404) {
            // Find nearest city if not found
            await findNearestCity(city);
        }
    } catch (err) {
        console.error("Weather fetch failed:", err);
    }
}

async function findNearestCity(query) {
    try {
        const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${API_KEY}`);
        const geoData = await geoResponse.json();
        
        if (geoData && geoData.length > 0) {
            const nearest = geoData[0];
            await fetchWeatherByCoords(nearest.lat, nearest.lon);
        } else {
            console.warn("No nearest city found for:", query);
        }
    } catch (err) {
        console.error("Geocoding failed:", err);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(`${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
        const data = await response.json();
        if (response.ok) updateWeatherUI(data);
    } catch (err) {
        console.error("Weather by coords failed:", err);
    }
}

function updateWeatherUI(data) {
    currentWeatherData = data;
    
    // Animate content update
    const homeSection = document.getElementById('home-section');
    homeSection.classList.remove('fade-in');
    void homeSection.offsetWidth;
    homeSection.classList.add('fade-in');

    elements.displayCity.innerText = `${data.name}, ${data.sys.country}`;
    elements.temperature.innerText = `${Math.round(data.main.temp)}°`;
    elements.description.innerText = data.weather[0].description;
    elements.humidity.innerText = `${data.main.humidity}%`;
    elements.windSpeed.innerText = `${data.wind.speed} km/h`;
    elements.feelsLike.innerText = `${Math.round(data.main.feels_like)}°`;
    elements.pressure.innerText = `${data.main.pressure} hPa`;

    const iconCode = data.weather[0].icon;
    elements.weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

    // Dynamic Elements
    updateBackgroundEnvironment(data);
    updateUVIndex(data);
    updateWeatherTip(data);
}

function updateBackgroundEnvironment(data) {
    const main = data.weather[0].main;
    const isNight = data.weather[0].icon.includes('n');
    
    // Clear previous
    const animationLayers = ['rain-container', 'cloud-container', 'star-container', 'rainbow-overlay'];
    animationLayers.forEach(id => {
        const el = document.getElementById(id);
        el.classList.add('hidden');
        el.style.opacity = '0';
        el.innerHTML = '';
    });

    // Set Base Gradient
    let gradient = "radial-gradient(circle at top right, #1e293b, #0f172a)";
    if (isNight) {
        gradient = "radial-gradient(circle at top right, #020617, #0f172a)";
        showLayer('star-container', createStars);
    } else {
        if (main === 'Clear') gradient = "radial-gradient(circle at top right, #3B82F6, #06B6D4)";
        if (main === 'Clouds') gradient = "radial-gradient(circle at top right, #475569, #1e293b)";
        if (main === 'Rain' || main === 'Drizzle') gradient = "radial-gradient(circle at top right, #1e3a8a, #0f172a)";
    }
    
    elements.bgContainer.style.background = gradient;

    // Trigger Animations
    if (main === 'Rain' || main === 'Drizzle') showLayer('rain-container', createRain);
    else if (main === 'Clouds') showLayer('cloud-container', createClouds);
    else if (main === 'Clear' && !isNight) showLayer('rainbow-overlay');
}

function showLayer(id, creatorFunc) {
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    setTimeout(() => el.style.opacity = '1', 10);
    if (creatorFunc) creatorFunc(el);
}

// --- ANIMATION CREATORS ---

function createRain(container) {
    for (let i = 0; i < 60; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = Math.random() * 100 + '%';
        drop.style.animationDuration = Math.random() * 0.5 + 0.3 + 's';
        drop.style.animationDelay = Math.random() * 2 + 's';
        drop.style.opacity = Math.random() * 0.3 + 0.2;
        container.appendChild(drop);
    }
}

function createStars(container) {
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 2 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDuration = Math.random() * 3 + 2 + 's';
        star.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(star);
    }
}

function createClouds(container) {
    for (let i = 0; i < 10; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        const size = Math.random() * 400 + 200;
        cloud.style.width = size + 'px';
        cloud.style.height = size * 0.6 + 'px';
        cloud.style.left = Math.random() * 100 + '%';
        cloud.style.top = Math.random() * 100 + '%';
        cloud.style.animationDuration = Math.random() * 60 + 40 + 's';
        cloud.style.animationDelay = -Math.random() * 60 + 's';
        container.appendChild(cloud);
    }
}

// --- UI HELPERS ---

function updateUVIndex(data) {
    // Estimating UV index for 2.5 API (Simplified)
    // In real app, use One Call API. Here we simulate based on cloud cover.
    const clouds = data.clouds.all;
    let uv = Math.max(1, 11 - (clouds / 10)); // Higher clouds = lower UV
    if (data.weather[0].icon.includes('n')) uv = 0;

    const percentage = (uv / 12) * 100;
    elements.uvProgress.style.width = percentage + '%';
    
    let text = "Low Risk";
    if (uv > 3) text = "Moderate Risk";
    if (uv > 6) text = "High Risk";
    if (uv > 8) text = "Very High Risk";
    if (uv === 0) text = "Dynamic Night";

    elements.uvText.innerText = `${uv.toFixed(1)} - ${text}`;
}

function updateWeatherTip(data) {
    const temp = data.main.temp;
    const main = data.weather[0].main;
    
    let tip = "Perfect day for a walk in the park!";
    if (temp < 10) tip = "Cold out there! Don't forget your jacket.";
    if (temp > 30) tip = "It's scorching! Stay hydrated and seek shade.";
    if (main === 'Rain') tip = "Rainy day? A great time for a cozy book and coffee.";
    if (main === 'Clouds') tip = "Overcast skies are great for soft-light photography!";
    
    elements.weatherTip.innerText = tip;
}

function populateUserData(user) {
    elements.sidebarName.innerText = user.name || 'Premium User';
    elements.sidebarLocation.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${user.city}, ${user.country}`;
    elements.welcomeUser.innerText = `Welcome Back, ${user.name.split(' ')[0]}!`;
    
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3B82F6&color=fff&size=128`;
    elements.userAvatar.src = avatar;
    document.getElementById('profile-display-avatar').src = avatar;
    document.getElementById('profile-display-name').innerText = user.name;
    document.getElementById('profile-display-location').innerText = `${user.city}, ${user.country}`;
    
    document.getElementById('update-name').value = user.name || '';
    document.getElementById('update-city').value = user.city || '';
    document.getElementById('update-country').value = user.country || '';
}

function switchPage(pageId) {
    elements.pages.forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`${pageId}-section`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
    }
}

async function handleSearchInput(e) {
    const val = e.target.value.trim();
    if (val.length < 3) {
        elements.suggestionsBox.classList.add('hidden');
        return;
    }

    try {
        const resp = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${val}&limit=5&appid=${API_KEY}`);
        const data = await resp.json();
        
        if (data.length > 0) {
            elements.suggestionsBox.innerHTML = data.map(city => `
                <div class="suggestion-item" onclick="performSearch('${city.name}, ${city.country}')">
                    <i class="fa-solid fa-location-dot"></i> ${city.name}${city.state ? ', '+city.state : ''}, ${city.country}
                </div>
            `).join('');
            elements.suggestionsBox.classList.remove('hidden');
        } else {
            elements.suggestionsBox.classList.add('hidden');
        }
    } catch (err) {
        console.error("Suggestions failed", err);
    }
}

window.performSearch = function(query) {
    elements.cityInput.value = query;
    elements.suggestionsBox.classList.add('hidden');
    fetchWeather(query);
    switchPage('home');
};

async function handleProfileUpdate(e) {
    e.preventDefault();
    const status = document.getElementById('profile-status');
    const updateData = {
        name: document.getElementById('update-name').value,
        city: document.getElementById('update-city').value,
        country: document.getElementById('update-country').value
    };

    const result = await apiFetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });

    if (result) {
        status.innerText = "Changes saved brilliantly!";
        status.classList.remove('hidden');
        populateUserData(result.user);
        setTimeout(() => status.classList.add('hidden'), 3000);
    }
}

// --- UTILS ---

async function apiFetch(url, options = {}) {
    try {
        const resp = await fetch(url, options);
        if (resp.ok) return await resp.json();
        return null;
    } catch (err) {
        console.error("API Error:", err);
        return null;
    }
}

function updateDateTime() {
    const now = new Date();
    elements.currentDate.innerText = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    elements.currentTime.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function setupRipples() {
    document.querySelectorAll('.ripple-target').forEach(btn => {
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.addEventListener('click', function(e) {
            const circle = document.createElement('span');
            const diameter = Math.max(this.clientWidth, this.clientHeight);
            const radius = diameter / 2;
            
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - this.offsetLeft - radius}px`;
            circle.style.top = `${e.clientY - this.offsetTop - radius}px`;
            circle.classList.add('ripple');
            
            const ripple = this.getElementsByClassName('ripple')[0];
            if (ripple) ripple.remove();
            this.appendChild(circle);
        });
    });
}

function useGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        });
    }
}

async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// --- SKY CATCH GAME LOGIC ---

function initSkyGame() {
    const catcher = document.getElementById('game-catcher');
    const area = document.getElementById('game-area');
    const restartBtn = document.getElementById('restart-game-btn');
    const backBtn = document.getElementById('back-to-dash-btn');

    // Create background stars
    const bgElements = area.querySelector('.game-bg-elements');
    for (let i = 0; i < 30; i++) {
        const s = document.createElement('div');
        s.className = 'bg-star-twinkle';
        s.style.width = s.style.height = Math.random() * 3 + 1 + 'px';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = Math.random() * 3 + 's';
        bgElements.appendChild(s);
    }

    // Controls
    window.addEventListener('keydown', (e) => {
        if (skyGame.isGameOver) return;
        if (e.key === 'ArrowLeft') skyGame.catcherX = Math.max(0, skyGame.catcherX - 8);
        if (e.key === 'ArrowRight') skyGame.catcherX = Math.min(100, skyGame.catcherX + 8);
        updateCatcherPos();
    });

    // Touch/Mouse Drag
    area.addEventListener('mousemove', (e) => {
        if (skyGame.isGameOver) return;
        const rect = area.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        skyGame.catcherX = Math.max(0, Math.min(100, x));
        updateCatcherPos();
    });

    area.addEventListener('touchmove', (e) => {
        if (skyGame.isGameOver) return;
        const rect = area.getBoundingClientRect();
        const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
        skyGame.catcherX = Math.max(0, Math.min(100, x));
        updateCatcherPos();
        e.preventDefault();
    }, { passive: false });

    function updateCatcherPos() {
        catcher.style.left = `calc(${skyGame.catcherX}% - 50px)`;
    }

    restartBtn.addEventListener('click', resetSkyGame);
    backBtn.addEventListener('click', () => switchPage('home'));

    // Display high score on load
    document.getElementById('game-best-val').innerText = skyGame.highScore;

    startSkyGame();
}

// Audio Synthesizer for Game sounds
const audio = {
    ctx: null,
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playCatch() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },
    playFail() {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
};

function startSkyGame() {
    skyGame.isStarted = true;
    skyGame.isGameOver = false;
    skyGame.score = 0;
    skyGame.difficulty = 1;
    document.getElementById('game-score-val').innerText = '0';
    skyGame.loopId = requestAnimationFrame(gameLoop);
}

function stopSkyGame() {
    cancelAnimationFrame(skyGame.loopId);
    skyGame.isStarted = false;
}

function gameLoop(timestamp) {
    if (skyGame.isGameOver) return;

    // Spawning
    if (timestamp - skyGame.lastSpawn > skyGame.spawnRate / skyGame.difficulty) {
        spawnObject();
        skyGame.lastSpawn = timestamp;
    }

    updateObjects();
    
    // Increase difficulty slowly
    skyGame.difficulty += 0.0001;

    skyGame.loopId = requestAnimationFrame(gameLoop);
}

function spawnObject() {
    const area = document.getElementById('game-area');
    const obj = document.createElement('div');
    const isStar = Math.random() > 0.7; // 30% chance for star
    
    obj.className = `falling-object ${isStar ? 'star-danger' : 'cloud-good'}`;
    obj.innerHTML = `<div class="object-inner">${isStar ? '⭐' : '☁️'}</div>`;
    obj.style.left = Math.random() * 90 + 5 + '%';
    obj.style.top = '-80px';
    
    area.appendChild(obj);
    
    skyGame.objects.push({
        el: obj,
        y: -80,
        speed: (Math.random() * 3 + 3) * skyGame.difficulty,
        type: isStar ? 'star' : 'cloud'
    });
}

function updateObjects() {
    const areaHeight = document.getElementById('game-area').clientHeight;
    
    for (let i = skyGame.objects.length - 1; i >= 0; i--) {
        const obj = skyGame.objects[i];
        obj.y += obj.speed;
        obj.el.style.top = obj.y + 'px';

        // Collision Check (Tuned for more generous hitbox)
        if (obj.y > areaHeight - 120 && obj.y < areaHeight - 40) {
            const objX = parseFloat(obj.el.style.left);
            if (Math.abs(objX - skyGame.catcherX) < 12) {
                if (obj.type === 'cloud') {
                    catchCloud(i);
                } else {
                    gameOver();
                }
                continue;
            }
        }

        // Remove if off screen
        if (obj.y > areaHeight) {
            obj.el.remove();
            skyGame.objects.splice(i, 1);
        }
    }
}

function catchCloud(index) {
    const obj = skyGame.objects[index];
    skyGame.score++;
    document.getElementById('game-score-val').innerText = skyGame.score;
    
    // Update Best Score
    if (skyGame.score > skyGame.highScore) {
        skyGame.highScore = skyGame.score;
        document.getElementById('game-best-val').innerText = skyGame.highScore;
        localStorage.setItem('skyCatchHighScore', skyGame.highScore);
    }

    audio.playCatch();
    obj.el.classList.add('catch-pop');
    setTimeout(() => obj.el.remove(), 400);
    skyGame.objects.splice(index, 1);
}

function gameOver() {
    skyGame.isGameOver = true;
    audio.playFail();
    document.getElementById('final-score').innerText = skyGame.score;
    document.getElementById('final-best-score').innerText = skyGame.highScore;
    document.getElementById('game-over-screen').classList.remove('hidden');
    
    // Shine effect on stars
    skyGame.objects.forEach(obj => {
        if (obj.type === 'star') obj.el.style.filter = 'brightness(3) shadow(0 0 20px gold)';
    });
}

function resetSkyGame() {
    skyGame.score = 0;
    skyGame.difficulty = 1;
    skyGame.objects.forEach(obj => obj.el.remove());
    skyGame.objects = [];
    document.getElementById('game-score-val').innerText = '0';
    document.getElementById('game-over-screen').classList.add('hidden');
    skyGame.lastSpawn = performance.now();
    startSkyGame();
}

init();
