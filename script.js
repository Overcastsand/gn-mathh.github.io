const container = document.getElementById('container');
const zoneViewer = document.getElementById('zoneViewer');
let zoneFrame = document.getElementById('zoneFrame');
const searchBar = document.getElementById('searchBar');
const sortOptions = document.getElementById('sortOptions');
const filterOptions = document.getElementById('filterOptions');

// Configuration for delivery sources
const REPO_OWNER = "Overcastsand";
const ASSETS_REPO = "assets-gn";
const COVERS_REPO = "covers-gn";
const HTML_REPO = "html-gn";

let currentSHA = "main"; // Default to main, will be updated with latest SHA if possible

const zonesurls = [
    `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${ASSETS_REPO}@${currentSHA}/zones.json`,
    `https://raw.githubusercontent.com/${REPO_OWNER}/${ASSETS_REPO}/${currentSHA}/zones.json`,
    `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${ASSETS_REPO}@main/zones.json`,
    `https://raw.githubusercontent.com/${REPO_OWNER}/${ASSETS_REPO}/main/zones.json`
];

let coverURL = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${COVERS_REPO}@${currentSHA}`;
let htmlURL = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${HTML_REPO}@${currentSHA}`;
let rawCoverURL = `https://raw.githubusercontent.com/${REPO_OWNER}/${COVERS_REPO}/main`;
let rawHTMLURL = `https://raw.githubusercontent.com/${REPO_OWNER}/${HTML_REPO}/main`;

let zones = [];
let popularityData = {};
const featuredContainer = document.getElementById('featuredZones');

function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

/**
 * Fetches the latest commit SHA for a repository to ensure we get the freshest content from jsDelivr
 */
async function fetchLatestSHA(owner, repo) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&t=${Date.now()}`);
        if (response.ok) {
            const commits = await response.json();
            if (commits && commits.length > 0) {
                return commits[0].sha;
            }
        }
    } catch (e) {
        console.warn(`Failed to fetch latest SHA for ${owner}/${repo}, falling back to 'main'`);
    }
    return "main";
}

async function listZones() {
    container.innerHTML = "INITIALIZING ARCHIVES...";
    
    // Update SHA for all delivery repos
    currentSHA = await fetchLatestSHA(REPO_OWNER, ASSETS_REPO);
    
    // Update URLs with the latest SHA
    const activeURLs = [
        `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${ASSETS_REPO}@${currentSHA}/zones.json`,
        `https://raw.githubusercontent.com/${REPO_OWNER}/${ASSETS_REPO}/${currentSHA}/zones.json`,
        `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${ASSETS_REPO}@main/zones.json`,
        `https://raw.githubusercontent.com/${REPO_OWNER}/${ASSETS_REPO}/main/zones.json`
    ];
    
    coverURL = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${COVERS_REPO}@${currentSHA}`;
    htmlURL = `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${HTML_REPO}@${currentSHA}`;

    let success = false;
    let lastError = null;

    for (const url of activeURLs) {
        try {
            console.log("Attempting to fetch zones from:", url);
            const response = await fetch(url + "?t=" + Date.now());
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();
            zones = json;
            
            // Mark the first one as featured if none are marked
            if (zones.length > 0 && !zones.some(z => z.featured)) {
                zones[0].featured = true;
            }

            success = true;
            console.log("Successfully loaded zones from:", url);
            break;
        } catch (error) {
            console.warn(`Failed to fetch from ${url}:`, error.message);
            lastError = error;
        }
    }

    if (!success) {
        container.innerHTML = `CRITICAL_ERROR: Failed to load zones from all sources. <br> ${lastError ? lastError.message : "Unknown error"}`;
        return;
    }

    // Fetch popularity, but don't let it block the main site loading
    Promise.all([
        fetchPopularity("year").catch(e => console.warn("Stats year failed")),
        fetchPopularity("month").catch(e => console.warn("Stats month failed")),
        fetchPopularity("week").catch(e => console.warn("Stats week failed")),
        fetchPopularity("day").catch(e => console.warn("Stats day failed"))
    ]).then(() => {
        sortZones();
    });

    handleInitialView();
    populateFilters(zones);
}

function handleInitialView() {
    try {
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        const embed = window.location.hash.includes("embed");
        if (id) {
            const zone = zones.find(zone => zone.id + '' == id + '');
            if (zone) {
                if (embed) {
                    loadEmbeddedZone(zone);
                } else {
                    openZone(zone);
                }
            }
        }
    } catch(error){ console.error("Initial view error:", error); }
}

function populateFilters(json) {
    let alltags = [];
    for (const obj of json) {
        if (Array.isArray(obj.special)) {
            alltags.push(...obj.special);
        }
    }
    alltags = [...new Set(alltags)];
    let filteroption = document.getElementById("filterOptions");
    if (filteroption) {
        while (filteroption.children.length > 1) {
            filteroption.removeChild(filteroption.lastElementChild);
        }
        for (const tag of alltags) {
            const opt = document.createElement("option");
            opt.value = tag;
            opt.textContent = toTitleCase(tag);
            filteroption.appendChild(opt);
        }
    }
}

function loadEmbeddedZone(zone) {
    const url = zone.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    fetch(url+"?t="+Date.now()).then(response => response.text()).then(html => {
        // Inject base tag for relative resources
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        const baseTag = `<base href="${baseUrl}">`;
        
        document.documentElement.innerHTML = baseTag + html;
        
        const popup = document.createElement("div");
        popup.style.position = "fixed";
        popup.style.bottom = "20px";
        popup.style.right = "20px";
        popup.style.backgroundColor = "#cce5ff";
        popup.style.color = "#004085";
        popup.style.padding = "10px";
        popup.style.border = "1px solid #b8daff";
        popup.style.borderRadius = "5px";
        popup.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.1)";
        popup.style.fontFamily = "Arial, sans-serif";
        popup.innerHTML = `Play more games at <a href="https://gn-math.dev" target="_blank" style="color:#004085; font-weight:bold;">https://gn-math.dev</a>!`;
        const closeBtn = document.createElement("button");
        closeBtn.innerText = "×";
        closeBtn.style.marginLeft = "10px";
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.cursor = "pointer";
        closeBtn.onclick = () => popup.remove();
        popup.appendChild(closeBtn);
        document.body.appendChild(popup);
        
        document.documentElement.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');
            if (oldScript.src) newScript.src = oldScript.src;
            else newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
        });
    }).catch(error => alert("Failed to load zone: " + error));
}

async function fetchPopularity(duration) {
    try {
        if (!popularityData[duration]) {
            popularityData[duration] = {};
        }
        const response = await fetch(
            `https://data.jsdelivr.net/v1/stats/packages/gh/${REPO_OWNER}/${HTML_REPO}@${currentSHA}/files?period=` + duration
        );
        const data = await response.json();
        data.forEach(file => {
            const idMatch = file.name.match(/\/(\d+)\.html$/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                popularityData[duration][id] = file.hits?.total ?? 0;
            }
        });
    } catch (error) {
        if (!popularityData[duration]) {
            popularityData[duration] = {};
        }
        popularityData[duration][0] = 0;
    }
}

function sortZones() {
    const sortBy = sortOptions.value;
    if (sortBy === 'name') {
        zones.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'id') {
        zones.sort((a, b) => a.id - b.id);
    } else if (sortBy === 'popular') {
        zones.sort((a, b) => ((popularityData['year']?.[b.id]) ?? 0) - ((popularityData['year']?.[a.id]) ?? 0));
    } else if (sortBy === 'trendingMonth') {
        zones.sort((a, b) => ((popularityData['month']?.[b.id]) ?? 0) - ((popularityData['month']?.[a.id]) ?? 0));
    } else if (sortBy === 'trendingWeek') {
        zones.sort((a, b) => ((popularityData['week']?.[b.id]) ?? 0) - ((popularityData['week']?.[a.id]) ?? 0));
    } else if (sortBy === 'trendingDay') {
        zones.sort((a, b) => ((popularityData['day']?.[b.id]) ?? 0) - ((popularityData['day']?.[a.id]) ?? 0));
    }
    zones.sort((a, b) => (a.id === -1 ? -1 : b.id === -1 ? 1 : 0));
    const featured = zones.filter(z => z.featured);
    displayFeaturedZones(featured);
    displayZones(zones);
}

function displayFeaturedZones(featuredZones) {
    featuredContainer.innerHTML = "";
    featuredZones.forEach((file, index) => {
        const zoneItem = document.createElement("div");
        zoneItem.className = "zone-item";
        zoneItem.onclick = () => openZone(file);
        const img = document.createElement("img");
        
        const primarySrc = file.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        const fallbackSrc = file.cover.replace("{COVER_URL}", rawCoverURL).replace("{HTML_URL}", htmlURL);
        
        img.dataset.src = primarySrc;
        img.alt = file.name;
        img.loading = "lazy";
        img.className = "lazy-zone-img";
        
        img.onerror = function() {
            if (this.src !== fallbackSrc) {
                console.warn("CDN cover failed, falling back to raw GitHub for: " + file.name);
                this.src = fallbackSrc;
            }
        };
        
        zoneItem.appendChild(img);
        
        const info = document.createElement("div");
        info.className = "zone-info";
        const button = document.createElement("button");
        button.textContent = file.name;
        info.appendChild(button);
        zoneItem.appendChild(info);
        
        featuredContainer.appendChild(zoneItem);
    });

    const lazyImages = document.querySelectorAll('#featuredZones img.lazy-zone-img');
    setupLazyLoading(lazyImages);
}

function displayZones(zones) {
    container.innerHTML = "";
    zones.forEach((file, index) => {
        const zoneItem = document.createElement("div");
        zoneItem.className = "zone-item";
        zoneItem.onclick = () => openZone(file);
        const img = document.createElement("img");
        
        const primarySrc = file.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        const fallbackSrc = file.cover.replace("{COVER_URL}", rawCoverURL).replace("{HTML_URL}", htmlURL);
        
        img.dataset.src = primarySrc;
        img.alt = file.name;
        img.loading = "lazy";
        img.className = "lazy-zone-img";
        
        img.onerror = function() {
            if (this.src !== fallbackSrc) {
                this.src = fallbackSrc;
            }
        };
        
        zoneItem.appendChild(img);
        
        const info = document.createElement("div");
        info.className = "zone-info";
        const button = document.createElement("button");
        button.textContent = file.name;
        info.appendChild(button);
        zoneItem.appendChild(info);
        
        container.appendChild(zoneItem);   
    });

    const lazyImages = document.querySelectorAll('img.lazy-zone-img');
    setupLazyLoading(lazyImages);
}

function setupLazyLoading(elements) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove("lazy-zone-img");
                observer.unobserve(img);
            }
        });
    }, { rootMargin: "100px", threshold: 0.1 });

    elements.forEach(img => imageObserver.observe(img));
}

function filterZones2() {
    const query = filterOptions.value;
    if (query === "none") {
        displayZones(zones);
    } else {
        const filteredZones = zones.filter(zone => zone.special?.includes(query));
        displayZones(filteredZones);
    }
}

function filterZones() {
    const query = searchBar.value.toLowerCase();
    const filteredZones = zones.filter(zone => zone.name.toLowerCase().includes(query));
    displayZones(filteredZones);
}

function openZone(file) {
    if (file.url.startsWith("http")) {
        window.open(file.url, "_blank");
    } else {
        const primaryUrl = file.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
        const fallbackUrl = file.url.replace("{COVER_URL}", rawCoverURL).replace("{HTML_URL}", rawHTMLURL);
        
        // Show viewer with loading state
        document.getElementById('zoneName').textContent = "INITIALIZING STREAM...";
        zoneViewer.style.display = "flex";
        
        const tryFetch = (url, isFallback = false) => {
            fetch(url + "?t=" + Date.now())
                .then(response => {
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    return response.text();
                })
                .then(html => {
                    if (zoneFrame.contentDocument === null) {
                        zoneFrame = document.createElement("iframe");
                        zoneFrame.id = "zoneFrame";
                        zoneViewer.appendChild(zoneFrame);
                    }
                    
                    // Critical for delivery: Inject base tag to resolve relative paths in the game HTML
                    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
                    const baseTag = `<base href="${baseUrl}">`;
                    
                    zoneFrame.contentDocument.open();
                    zoneFrame.contentDocument.write(baseTag + html);
                    zoneFrame.contentDocument.close();
                    
                    document.getElementById('zoneName').textContent = file.name;
                    document.getElementById('zoneId').textContent = file.id;
                    document.getElementById('zoneAuthor').textContent = "by " + file.author;
                    if (file.authorLink) {
                        document.getElementById('zoneAuthor').href = file.authorLink;
                    }

                    try {
                        const url = new URL(window.location);
                        url.searchParams.set('id', file.id);
                        history.pushState(null, '', url.toString());
                    } catch(error){}
                })
                .catch(error => {
                    console.error("Fetch failed for " + url, error);
                    if (!isFallback) {
                        console.warn("Retrying with fallback URL...");
                        tryFetch(fallbackUrl, true);
                    } else {
                        alert("CRITICAL_ERROR: Failed to load game from all sources. Stream blocked.");
                        closeZone();
                    }
                });
        };

        tryFetch(primaryUrl);
    }
}

function aboutBlank() {
    const newWindow = window.open("about:blank", "_blank");
    let zoneUrl = zones.find(z => z.id + '' === document.getElementById('zoneId').textContent).url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    fetch(zoneUrl+"?t="+Date.now()).then(response => response.text()).then(html => {
        if (newWindow) {
            const baseUrl = zoneUrl.substring(0, zoneUrl.lastIndexOf('/') + 1);
            const baseTag = `<base href="${baseUrl}">`;
            newWindow.document.open();
            newWindow.document.write(baseTag + html);
            newWindow.document.close();
        }
    })
}

function closeZone() {
    zoneViewer.style.display = "none";
    if (zoneFrame.parentNode) {
        zoneFrame.parentNode.removeChild(zoneFrame);
    }
    zoneFrame = document.createElement("iframe");
    zoneFrame.id = "zoneFrame";
    zoneViewer.appendChild(zoneFrame);

    try {
        const url = new URL(window.location);
        url.searchParams.delete('id');
        history.pushState(null, '', url.toString());
    } catch(error){}
}

function downloadZone() {
    let zone = zones.find(z => z.id + '' === document.getElementById('zoneId').textContent);
    fetch(zone.url.replace("{HTML_URL}", htmlURL)+"?t="+Date.now()).then(res => res.text()).then(text => {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zone.name + ".html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function fullscreenZone() {
    if (zoneFrame.requestFullscreen) {
        zoneFrame.requestFullscreen();
    } else if (zoneFrame.mozRequestFullScreen) {
        zoneFrame.mozRequestFullScreen();
    } else if (zoneFrame.webkitRequestFullscreen) {
        zoneFrame.webkitRequestFullscreen();
    } else if (zoneFrame.msRequestFullscreen) {
        zoneFrame.msRequestFullscreen();
    }
}

async function saveData() {
    alert("Exporting data... please wait.");
}

async function loadData(event) {
}

function darkMode() {
    document.body.classList.toggle("dark-mode");
}

function cloakIcon(url) {
    const link = document.querySelector("link[rel~='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = url || "favicon.png";
    document.head.appendChild(link);
}

function cloakName(string) {
    document.title = string || "Overcastsand";
}

function tabCloak() {
    closePopup();
    document.getElementById('popupTitle').textContent = "Tab Cloak";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <label style="font-weight: bold;">Set Tab Title:</label><br>
        <input type="text" placeholder="Enter new tab name..." oninput="cloakName(this.value)">
        <br><br>
        <label style="font-weight: bold;">Set Tab Icon (URL):</label><br>
        <input type="text" placeholder="Enter icon URL..." oninput='cloakIcon(this.value)'>
    `;
    document.getElementById('popupOverlay').style.display = "flex";
}

const settingsBtn = document.getElementById('settings');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        document.getElementById('popupTitle').textContent = "System Config";
        const popupBody = document.getElementById('popupBody');
        popupBody.innerHTML = `
        <button class="terminal-controls" style="width:100%; margin-bottom:1rem; border:1px solid var(--primary); color:var(--primary);" onclick="darkMode()">Toggle Dark Mode</button>
        <button class="terminal-controls" style="width:100%; border:1px solid var(--primary); color:var(--primary);" onclick="tabCloak()">Tab Cloak</button>
        `;
        document.getElementById('popupOverlay').style.display = "flex";
    });
}

function showContact() {
    document.getElementById('popupTitle').textContent = "COMMS_LINK";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `<p>Discord: https://discord.gg/NAFw4ykZ7n</p><p>Email: gn.math.business@gmail.com</p>`;
    document.getElementById('popupOverlay').style.display = "flex";
}

function loadPrivacy() {
    document.getElementById('popupTitle').textContent = "PRIVACY_ENCRYPT";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `<p>Privacy policy content goes here...</p>`;
    document.getElementById('popupOverlay').style.display = "flex";
}

function loadDMCA() {
    document.getElementById('popupTitle').textContent = "DMCA_PROTOCOL";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `<p>DMCA details here...</p>`;
    document.getElementById('popupOverlay').style.display = "flex";
}

function closePopup() {
    document.getElementById('popupOverlay').style.display = "none";
}

listZones();
