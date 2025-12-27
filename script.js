// Configuration
const REPO_USER = "NotEnoughUpdates";
const REPO_NAME = "NotEnoughUpdates-REPO";
const BRANCH = "master";

// Global State
let itemIndex = [];

// Symbol Map (Matches your CSS classes)
const STAT_SYMBOLS = {
    health: { sym: "❤", css: "stat-health" },
    defense: { sym: "❈", css: "stat-defense" },
    strength: { sym: "❁", css: "stat-strength" },
    intelligence: { sym: "✎", css: "stat-intelligence" },
    speed: { sym: "✦", css: "stat-speed" },
    crit_chance: { sym: "☣", css: "stat-crit" },
    crit_damage: { sym: "☠", css: "stat-crit" },
    attack_speed: { sym: "⚔", css: "stat-speed" },
    sea_creature_chance: { sym: "α", css: "stat-intelligence" },
    magic_find: { sym: "✯", css: "stat-intelligence" },
    ferocity: { sym: "⫽", css: "stat-health" }
};

// --- 1. Index Loader ---
async function loadIndex() {
    const statusElement = document.getElementById('status-dot');
    statusElement.classList.add('status-loading');
    
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_USER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`);
        if (!response.ok) throw new Error(response.status);

        const data = await response.json();

        // Filter for .json files inside items/
        itemIndex = data.tree
            .filter(node => node.path.startsWith('items/') && node.path.endsWith('.json'))
            .map(node => {
                const parts = node.path.split('/');
                const fileName = parts[parts.length - 1];
                const cleanName = fileName
                    .replace('.json', '')
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/(?:^|\s)\w/g, c => c.toUpperCase());

                return { name: cleanName, path: node.path };
            });

        statusElement.className = "status-ready";
        statusElement.title = "Connected";

    } catch (error) {
        console.error("Index Error:", error);
        statusElement.className = "status-error";
        statusElement.title = "Connection Failed";
    }
}

// --- 2. Add Item Logic ---
async function addItem(path) {
    try {
        // Fetch the specific item JSON
        const url = `https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/${BRANCH}/${path}`;
        const res = await fetch(url);
        const data = await res.json();

        // Create HTML Elements
        const li = document.createElement('li');
        li.className = 'list-entry';

        // 1. Info Section (Name, Type, Rarity)
        const infoDiv = document.createElement('div');
        infoDiv.className = 'entry-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'entry-name';
        nameSpan.textContent = data.displayname ? data.displayname.replace(/§./g, '') : data.internalname;
        // Basic Rarity Color Logic
        const rarityColor = getRarityColor(data.tier || "COMMON");
        nameSpan.style.color = rarityColor;

        const typeSpan = document.createElement('span');
        typeSpan.className = 'entry-type';
        // Try to guess type from ID or Data
        let type = "ITEM";
        if(path.includes("WEAPON")) type = "WEAPON";
        else if(path.includes("ARMOR")) type = "ARMOR";
        else if(path.includes("PET")) type = "PET";
        typeSpan.textContent = type;

        const raritySpan = document.createElement('span');
        raritySpan.className = 'entry-rarity';
        raritySpan.textContent = data.tier || "COMMON";
        
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(typeSpan);
        infoDiv.appendChild(raritySpan);

        // 2. Stats Section
        const statsDiv = document.createElement('div');
        statsDiv.className = 'entry-stats';

        if (data.stats) {
            for (const [key, val] of Object.entries(data.stats)) {
                // NEU uses uppercase keys (DAMAGE, STRENGTH), map to lowercase for our lookup
                const lowerKey = key.toLowerCase();
                
                if (STAT_SYMBOLS[lowerKey]) {
                    const statSpan = document.createElement('span');
                    const sym = STAT_SYMBOLS[lowerKey].sym;
                    const cssClass = STAT_SYMBOLS[lowerKey].css;
                    
                    statSpan.className = cssClass;
                    statSpan.textContent = `+${val}${sym}`; // e.g. +50❁
                    statsDiv.appendChild(statSpan);
                }
            }
        }

        li.appendChild(infoDiv);
        li.appendChild(statsDiv);

        document.getElementById('selected-items-list').appendChild(li);

    } catch (err) {
        console.error("Item Fetch Error:", err);
    }
}

// Helper: Rarity Colors
function getRarityColor(tier) {
    const colors = {
        COMMON: "#ffffff",
        UNCOMMON: "#55ff55",
        RARE: "#5555ff",
        EPIC: "#aa00aa",
        LEGENDARY: "#ffaa00",
        MYTHIC: "#ff55ff",
        DIVINE: "#55ffff",
        SPECIAL: "#ff5555"
    };
    return colors[tier] || "#ffffff";
}

// --- 3. UI Interaction ---
const searchInput = document.getElementById('item-search');
const searchResults = document.getElementById('search-results');
const clearListBtn = document.getElementById('clear-list-btn');

// Debounce
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    clearTimeout(searchTimeout);

    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(() => {
        searchResults.innerHTML = '';
        const results = itemIndex.filter(item => item.name.toLowerCase().includes(query)).slice(0, 10);

        if (results.length > 0) {
            searchResults.style.display = 'block';
            results.forEach(item => {
                const div = document.createElement('div');
                div.textContent = item.name;
                div.addEventListener('click', () => {
                    addItem(item.path);
                    searchResults.style.display = 'none';
                    searchInput.value = '';
                });
                searchResults.appendChild(div);
            });
        } else {
            searchResults.style.display = 'none';
        }
    }, 300);
});

// Hide search on outside click
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
    }
});

// Clear List
clearListBtn.addEventListener('click', () => {
    document.getElementById('selected-items-list').innerHTML = '';
});

// Start
loadIndex();