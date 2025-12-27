// Configuration
const REPO_USER = "NotEnoughUpdates";
const REPO_NAME = "NotEnoughUpdates-REPO";
const BRANCH = "master";

// Global State
let itemIndex = [];
let petDataCache = {};
let currentBuild = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
    weapon: null,
    pet: null,
    profile: {
        combat: 0,
        foraging: 0,
        magical_power: 0,
        base_strength: 0,
        base_crit_damage: 0
    }
};

// The "Indexer" Function
async function loadIndex() {
    const statusElement = document.getElementById('loading-status');
    
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_USER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        // Filter for .json files inside items/
        itemIndex = data.tree
            .filter(node => node.path.startsWith('items/') && node.path.endsWith('.json'))
            .map(node => {
                // Extract filename
                const parts = node.path.split('/');
                const fileName = parts[parts.length - 1];

                // Format name: Remove .json, replace _ with space, Title Case
                const cleanName = fileName
                    .replace('.json', '')
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/(?:^|\s)\w/g, c => c.toUpperCase());

                return { name: cleanName, path: node.path };
            });

        statusElement.textContent = "Ready!";
        statusElement.style.backgroundColor = "#66bb6a"; // Green for success
        statusElement.style.color = "#ffffff";

    } catch (error) {
        console.error("Failed to load index:", error);
        statusElement.textContent = "Error loading data";
        statusElement.style.backgroundColor = "#ef5350"; // Red for error
    }
}

// Pet Data Fetcher
async function loadPetConstants() {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/${BRANCH}/constants/pets.json`);
        if (!response.ok) {
            throw new Error(`Pet constants error: ${response.status}`);
        }
        petDataCache = await response.json();
    } catch (error) {
        console.error("Failed to load pet constants:", error);
    }
}

// Initialization
async function init() {
    await Promise.all([loadIndex(), loadPetConstants()]);
}

init();

// --- Stat Engine ---

function calculateTotalStats() {
    // 1. Define base stats
    let stats = {
        damage: 0,
        strength: 0,
        crit_chance: 30,
        crit_damage: 50,
        health: 100,
        defense: 0,
        speed: 100,
        intelligence: 0,
        magic_find: 0,
        ferocity: 0,
        attack_speed: 0,
        bonus_damage_percent: 0
    };

    // 2. Add Item Stats (Loop through equipment slots)
    const slots = ['helmet', 'chestplate', 'leggings', 'boots', 'weapon'];
    slots.forEach(slot => {
        if (currentBuild[slot]) {
            addItemStats(stats, currentBuild[slot]);
        }
    });

    // 3. Add Pet Stats
    if (currentBuild.pet) {
        addPetStats(stats, currentBuild.pet);
    }

    // 4. Profile Stats
    calculateProfileStats(stats);

    // 5. Derived Stats
    stats.ehp = getEHP(stats);
    stats.total_damage = getMeleeDamage(stats);

    return stats;
}

function calculateProfileStats(stats) {
    const profile = currentBuild.profile;

    // Combat Level: +0.5% Crit Chance, +4% Additive Damage per level
    stats.crit_chance += profile.combat * 0.5;
    stats.bonus_damage_percent += profile.combat * 4;

    // Foraging Level: +1 or +2 Strength per level (Using 2 for simplicity)
    stats.strength += profile.foraging * 2;

    // Magical Power: Approx 0.1 Str/CD per MP
    stats.strength += profile.magical_power * 0.1;
    stats.crit_damage += profile.magical_power * 0.1;

    // Manual Base Stats
    stats.strength += profile.base_strength || 0;
    stats.crit_damage += profile.base_crit_damage || 0;
}

function addItemStats(stats, item) {
    if (!item.stats) return;

    const statMap = {
        'DAMAGE': 'damage', 'STRENGTH': 'strength', 'CRIT_CHANCE': 'crit_chance',
        'CRIT_DAMAGE': 'crit_damage', 'HEALTH': 'health', 'DEFENSE': 'defense',
        'WALK_SPEED': 'speed', 'INTELLIGENCE': 'intelligence',
        'MAGIC_FIND': 'magic_find', 'FEROCITY': 'ferocity', 'ATTACK_SPEED': 'attack_speed'
    };

    for (let key in item.stats) {
        if (statMap[key]) stats[statMap[key]] += item.stats[key];
    }
}

function addPetStats(stats, petItem) {
    let petId = petItem.internalname;
    if (petId && petId.startsWith("PET_")) petId = petId.substring(4);

    const petData = petDataCache[petId];
    // Default to LEGENDARY if tier is missing
    const rarity = petItem.tier || "LEGENDARY";
    
    if (petData && petData[rarity] && petData[rarity].stats) {
        const level = currentBuild.profile.level || 100;
        const statMap = {
            'DAMAGE': 'damage', 'STRENGTH': 'strength', 'CRIT_CHANCE': 'crit_chance',
            'CRIT_DAMAGE': 'crit_damage', 'HEALTH': 'health', 'DEFENSE': 'defense',
            'WALK_SPEED': 'speed', 'INTELLIGENCE': 'intelligence',
            'MAGIC_FIND': 'magic_find', 'FEROCITY': 'ferocity', 'ATTACK_SPEED': 'attack_speed'
        };

        for (let key in petData[rarity].stats) {
            if (statMap[key]) {
                stats[statMap[key]] += (level / 100) * petData[rarity].stats[key];
            }
        }
    }
}

function getMeleeDamage(stats) {
    // Hypixel formula: (5 + Damage + Strength/5) * (1 + Strength/100) * (1 + CritDamage/100)
    const base = 5 + stats.damage + (stats.strength / 5);
    const strMult = 1 + (stats.strength / 100);
    const cdMult = 1 + (stats.crit_damage / 100);
    const additiveMult = 1 + (stats.bonus_damage_percent / 100);
    return Math.floor(base * strMult * cdMult * additiveMult);
}

function getEHP(stats) {
    return Math.floor(stats.health * (1 + (stats.defense / 100)));
}

// --- UI & Interaction ---

const searchInput = document.getElementById('item-search');
const searchResults = document.getElementById('search-results');
const slotSelect = document.getElementById('slot-select');
const equippedList = document.getElementById('equipped-list');

// Profile Settings Listeners
const profileMap = {
    'input-combat': 'combat',
    'input-foraging': 'foraging',
    'input-mp': 'magical_power',
    'input-base-str': 'base_strength',
    'input-base-cd': 'base_crit_damage'
};

for (const [id, key] of Object.entries(profileMap)) {
    const element = document.getElementById(id);
    if (element) element.addEventListener('input', (e) => {
        currentBuild.profile[key] = Number(e.target.value) || 0;
        updateUI();
    });
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Search Logic
searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.toLowerCase();
    searchResults.innerHTML = '';
    
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    // Filter itemIndex
    const results = itemIndex.filter(item => 
        item.name.toLowerCase().includes(query)
    ).slice(0, 10); // Limit results for performance

    if (results.length > 0) {
        searchResults.style.display = 'block';
        results.forEach(item => {
            const div = document.createElement('div');
            // Clean up filename for display
            div.textContent = item.name;
            div.style.padding = '8px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #444';
            
            // Hover effect
            div.addEventListener('mouseenter', () => div.style.backgroundColor = '#444');
            div.addEventListener('mouseleave', () => div.style.backgroundColor = 'transparent');

            div.addEventListener('click', () => {
                const slot = slotSelect.value;
                setItem(slot, item.path);
                searchResults.style.display = 'none';
                searchInput.value = '';
            });
            searchResults.appendChild(div);
        });
    } else {
        searchResults.style.display = 'none';
    }
}, 300));

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
    }
});

// Fetch and Equip Item
async function setItem(slot, path) {
    const statusElement = document.getElementById('loading-status');
    statusElement.textContent = `Loading ${slot}...`;
    statusElement.style.backgroundColor = "#ffeb3b"; // Yellow
    statusElement.style.color = "#000";

    try {
        const url = `https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/${BRANCH}/${path}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch item: ${response.status}`);
        }
        
        const itemData = await response.json();
        
        // Update build
        currentBuild[slot] = itemData;
        updateUI();
        
        statusElement.textContent = "Ready!";
        statusElement.style.backgroundColor = "#66bb6a";
        statusElement.style.color = "#fff";

    } catch (error) {
        console.error("Error setting item:", error);
        statusElement.textContent = "Error loading item";
        statusElement.style.backgroundColor = "#ef5350";
    }
}

// Update UI Elements
function updateUI() {
    const stats = calculateTotalStats();

    // Update Stat Grid
    document.getElementById('stat-damage').textContent = Math.floor(stats.damage);
    document.getElementById('stat-strength').textContent = Math.floor(stats.strength);
    document.getElementById('stat-crit-chance').textContent = Math.floor(stats.crit_chance) + '%';
    document.getElementById('stat-crit-damage').textContent = Math.floor(stats.crit_damage) + '%';
    document.getElementById('stat-health').textContent = Math.floor(stats.health);
    document.getElementById('stat-defense').textContent = Math.floor(stats.defense);

    // Update Summary
    document.getElementById('summary-ehp').textContent = stats.ehp.toLocaleString();
    document.getElementById('summary-total-damage').textContent = stats.total_damage.toLocaleString();

    // Render Equipped List
    equippedList.innerHTML = '';
    const slots = ['helmet', 'chestplate', 'leggings', 'boots', 'weapon', 'pet'];
    
    slots.forEach(slot => {
        if (currentBuild[slot]) {
            const li = document.createElement('li');
            li.style.marginBottom = '10px';
            li.style.padding = '10px';
            li.style.backgroundColor = '#333';
            li.style.borderRadius = '4px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            // Clean display name (remove color codes like §a)
            let displayName = currentBuild[slot].displayname || currentBuild[slot].name || 'Unknown Item';
            displayName = displayName.replace(/§[0-9a-fk-or]/g, '');

            const textSpan = document.createElement('span');
            textSpan.textContent = `${slot.charAt(0).toUpperCase() + slot.slice(1)}: ${displayName}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.style.marginLeft = '10px';
            removeBtn.style.backgroundColor = '#d32f2f';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.padding = '5px 10px';
            removeBtn.style.borderRadius = '4px';
            removeBtn.style.cursor = 'pointer';
            
            removeBtn.onclick = () => {
                currentBuild[slot] = null;
                updateUI();
            };

            li.appendChild(textSpan);
            li.appendChild(removeBtn);
            equippedList.appendChild(li);
        }
    });
}