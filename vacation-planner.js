// Global variables
let map;
let markers = [];
let destinations = [];
let editingId = null;
let currentEditingId = null; // For modal editing
let showAllBtn;
let autoZoomEnabled = true;

// Category to Font Awesome icon mapping
const categoryIcons = {
    accommodation: 'fa-hotel',
    activity: 'fa-person-hiking',
    food: 'fa-utensils',
    transportation: 'fa-plane-departure',
    shopping: 'fa-shopping-bag',
    entertainment: 'fa-film',
    other: 'fa-map-pin'
};

// Colors for different days
const dayColors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'
];

// --- HELPER FUNCTIONS ---

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha = 1) {
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return 'rgba(0,0,0,0.1)'; // Return a default color if hex is invalid
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`;
}

// Helper function to format date strings to MM/DD/YYYY
function formatDate(dateString) {
    if (!dateString || dateString.length < 10) {
        return dateString; // Return original if invalid or not in YYYY-MM-DD format
    }
    // Split date to avoid timezone issues that can change the date
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    return `${month}/${day}/${year}`;
}

// Helper function to format a date range, hiding the end date if it's the same as the start
function formatDateRange(startDate, endDate) {
    const formattedStart = formatDate(startDate);
    if (!endDate || startDate === endDate) {
        return formattedStart;
    }
    return `${formattedStart} to ${formatDate(endDate)}`;
}


// --- INITIALIZATION ---

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    showAllBtn = document.getElementById('showAllBtn');
    const autoZoomToggle = document.getElementById('autoZoomToggle');

    initializeMap();
    checkForInitialData();
    
    showAllBtn.addEventListener('click', showAllDays);
    autoZoomToggle.addEventListener('change', (e) => {
        autoZoomEnabled = e.target.checked;
    });
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map').setView([65, -18], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Check for initial data
function checkForInitialData() {
    fetch('iceland-itinerary.csv')
        .then(response => {
            if (response.ok) return response.text();
            throw new Error('CSV not found');
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                complete: function(results) {
                    destinations = results.data
                        .filter(row => row.Name)
                        .map((row, index) => ({
                            id: Date.now() + index,
                            name: row.Name || '',
                            arrivalDate: row['Arrival Date'] || '',
                            departureDate: row['Departure Date'] || '',
                            activities: row.Activities || '',
                            category: row.Category || 'activity',
                            cost: parseFloat(row.Cost) || 0,
                            lat: parseFloat(row.Latitude) || 0,
                            lng: parseFloat(row.Longitude) || 0
                        }));
                    
                    renderDestinations();
                    updateMarkers();
                }
            });
        })
        .catch(error => {
            console.log('No initial CSV file found, starting with empty itinerary');
            renderDestinations();
        });
}


// --- MODAL AND DATA HANDLING ---

// Modal functions
function openAddModal(id = null) {
    const modal = document.getElementById('destinationModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (id) {
        currentEditingId = id;
        modalTitle.textContent = 'Edit Destination';
        const dest = destinations.find(d => d.id === id);
        if (dest) {
            document.getElementById('modalDestName').value = dest.name;
            document.getElementById('modalArrivalDate').value = dest.arrivalDate;
            document.getElementById('modalDepartureDate').value = dest.departureDate;
            document.getElementById('modalCategory').value = dest.category || 'activity';
            document.getElementById('modalCost').value = dest.cost || '';
            document.getElementById('modalActivities').value = dest.activities;
            document.getElementById('modalCoordinates').value = (dest.lat && dest.lng) ? `${dest.lat}, ${dest.lng}` : '';
        }
    } else {
        currentEditingId = null;
        modalTitle.textContent = 'Add New Destination';
        clearModalForm();
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('destinationModal').style.display = 'none';
    currentEditingId = null;
    clearModalForm();
}

function clearModalForm() {
    const form = document.getElementById('destinationModal');
    form.querySelector('#modalDestName').value = '';
    form.querySelector('#modalArrivalDate').value = '';
    form.querySelector('#modalDepartureDate').value = '';
    form.querySelector('#modalCategory').value = 'activity';
    form.querySelector('#modalCost').value = '';
    form.querySelector('#modalActivities').value = '';
    form.querySelector('#modalCoordinates').value = '';
}

// Save destination
function saveDestination() {
    const name = document.getElementById('modalDestName').value;
    const arrivalDate = document.getElementById('modalArrivalDate').value;
    const departureDate = document.getElementById('modalDepartureDate').value;
    const category = document.getElementById('modalCategory').value;
    const cost = parseFloat(document.getElementById('modalCost').value) || 0;
    const activities = document.getElementById('modalActivities').value;
    
    const coordString = document.getElementById('modalCoordinates').value;
    let lat = 0;
    let lng = 0;
    if (coordString) {
        const parts = coordString.split(',');
        if (parts.length === 2) {
            lat = parseFloat(parts[0].trim());
            lng = parseFloat(parts[1].trim());
        }
    }
    lat = isNaN(lat) ? 0 : lat;
    lng = isNaN(lng) ? 0 : lng;

    if (name && arrivalDate && departureDate) {
        if (currentEditingId) {
            const destIndex = destinations.findIndex(d => d.id === currentEditingId);
            if (destIndex !== -1) {
                destinations[destIndex] = { ...destinations[destIndex], name, arrivalDate, departureDate, category, cost, activities, lat, lng };
            }
        } else {
            destinations.push({ id: Date.now(), name, arrivalDate, departureDate, category, cost, activities, lat, lng });
        }
        
        renderDestinations();
        updateMarkers();
        closeModal();
    } else {
        alert('Please fill in at least the destination name and dates.');
    }
}

// Delete destination
function deleteDestination(id) {
    if (confirm('Are you sure you want to delete this destination?')) {
        destinations = destinations.filter(d => d.id !== id);
        renderDestinations();
        updateMarkers();
    }
}


// --- UI RENDERING ---

// Render destinations list
function renderDestinations() {
    const container = document.getElementById('destinationsList');
    container.innerHTML = '';
    
    if (destinations.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-map-marked-alt"></i><p>No destinations yet.</p></div>`;
        document.getElementById('totalCostDisplay').textContent = '$0.00';
        return;
    }
    
    destinations.sort((a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate));
    
    const groupedByDate = destinations.reduce((acc, dest) => {
        const date = dest.arrivalDate;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(dest);
        return acc;
    }, {});

    let dayCounter = 0;
    let totalCost = 0;
    for (const date in groupedByDate) {
        const dayColor = dayColors[dayCounter % dayColors.length];
        
        const dayGroup = document.createElement('div');
        dayGroup.className = 'day-group';
        dayGroup.style.backgroundColor = hexToRgba(dayColor, 0.05);
        dayGroup.style.borderColor = hexToRgba(dayColor, 0.2);
        dayGroup.dataset.date = date;

        const daySeparator = document.createElement('div');
        daySeparator.className = 'day-separator';
        daySeparator.innerHTML = `Day ${dayCounter + 1} &middot; ${formatDate(date)}`;
        daySeparator.style.color = dayColor;
        daySeparator.addEventListener('click', () => filterByDay(date));
        dayGroup.appendChild(daySeparator);

        groupedByDate[date].forEach(dest => {
            totalCost += dest.cost;
            const div = document.createElement('div');
            div.className = 'destination-item';
            div.dataset.id = dest.id;

            const iconClass = categoryIcons[dest.category] || 'fa-map-pin';
            const categoryIconHtml = `<div class="category-icon" style="background-color: ${dayColor}"><i class="fas ${iconClass}"></i></div>`;

            div.innerHTML = `
                <div class="destination-header">
                    ${categoryIconHtml}
                    <div class="destination-content">
                        <h4>${dest.name}</h4>
                        <div class="destination-meta">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${formatDateRange(dest.arrivalDate, dest.departureDate)}</span>
                        </div>
                        <div class="destination-meta cost">
                            <i class="fas fa-dollar-sign"></i>
                            <span>${dest.cost.toFixed(2)}</span>
                        </div>
                        <div class="destination-activities">${dest.activities}</div>
                    </div>
                </div>
                <div class="destination-actions">
                    <button class="btn btn-edit" onclick="openAddModal(${dest.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" onclick="deleteDestination(${dest.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            dayGroup.appendChild(div);
        });
        container.appendChild(dayGroup);
        dayCounter++;
    }
    document.getElementById('totalCostDisplay').textContent = `$${totalCost.toFixed(2)}`;
}


// Update map markers
function updateMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    const uniqueDates = [...new Set(destinations.map(d => d.arrivalDate))].sort((a,b) => new Date(a) - new Date(b));
    const dateColorMap = uniqueDates.reduce((acc, date, index) => {
        acc[date] = dayColors[index % dayColors.length];
        return acc;
    }, {});

    destinations.forEach(dest => {
        if (dest.lat && dest.lng) {
            const dayColor = dateColorMap[dest.arrivalDate] || '#757575';
            const iconClass = categoryIcons[dest.category] || 'fa-map-marker-alt';
            
            // Create the marker icon
            const markerIconHtml = `<div class="map-icon-background" style="background-color: ${dayColor};"><i class="fas ${iconClass}"></i></div>`;
            const markerIcon = L.divIcon({
                className: 'custom-map-icon',
                html: markerIconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            // Create the popup content
            const popupContent = `
                <div class="map-popup">
                    <div class="popup-header">
                        <div class="category-icon" style="background-color: ${dayColor}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <h4>${dest.name}</h4>
                    </div>
                    <div class="popup-meta">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${formatDateRange(dest.arrivalDate, dest.departureDate)}</span>
                    </div>
                    <div class="popup-meta cost">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${dest.cost.toFixed(2)}</span>
                    </div>
                    <div class="popup-activities">
                        ${dest.activities || 'No additional notes.'}
                    </div>
                </div>
            `;
            
            const marker = L.marker([dest.lat, dest.lng], { icon: markerIcon, riseOnHover: true })
                .addTo(map)
                .bindPopup(popupContent);
            
            marker.destinationDate = dest.arrivalDate;
            markers.push(marker);
        }
    });

    showAllDays();
}


// --- MAP FILTERING ---

// Filter map markers by a specific day
function filterByDay(date) {
    const visibleMarkers = [];
    markers.forEach(marker => {
        if (marker.destinationDate === date) {
            marker.addTo(map);
            visibleMarkers.push(marker);
        } else {
            map.removeLayer(marker);
        }
    });

    document.querySelectorAll('.day-group').forEach(group => {
        if (group.dataset.date === date) {
            group.classList.remove('filtered');
        } else {
            group.classList.add('filtered');
        }
    });

    if (visibleMarkers.length > 0 && autoZoomEnabled) {
        const group = L.featureGroup(visibleMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }

    showAllBtn.style.display = 'inline-flex';
}

// Show all markers and reset filters
function showAllDays() {
    const allVisibleMarkers = [];
    markers.forEach(marker => {
        marker.addTo(map);
        allVisibleMarkers.push(marker);
    });

    document.querySelectorAll('.day-group').forEach(group => {
        group.classList.remove('filtered');
    });

    if (allVisibleMarkers.length > 0 && autoZoomEnabled) {
        const group = L.featureGroup(allVisibleMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }

    showAllBtn.style.display = 'none';
}


// --- CSV AND EVENT LISTENERS ---

// Export to CSV
function exportToCSV() {
    if (destinations.length === 0) {
        alert('No destinations to export!');
        return;
    }
    
    const csv = Papa.unparse({
        fields: ['Name', 'Arrival Date', 'Departure Date', 'Category', 'Cost', 'Activities', 'Latitude', 'Longitude'],
        data: destinations.map(d => [d.name, d.arrivalDate, d.departureDate, d.category, d.cost, d.activities, d.lat, d.lng])
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vacation-itinerary-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import from CSV
function importFromCSV(event) {
    const file = event.target.files[0];
    if (file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                destinations = results.data
                    .filter(row => row.Name)
                    .map((row, index) => ({
                        id: Date.now() + index,
                        name: row.Name || '',
                        arrivalDate: row['Arrival Date'] || '',
                        departureDate: row['Departure Date'] || '',
                        category: row.Category || 'activity',
                        cost: parseFloat(row.Cost) || 0,
                        activities: row.Activities || '',
                        lat: parseFloat(row.Latitude) || 0,
                        lng: parseFloat(row.Longitude) || 0
                    }));
                
                renderDestinations();
                updateMarkers();
            },
            error: function(error) {
                alert('Error parsing CSV file: ' + error.message);
            }
        });
    }
    event.target.value = '';
}

// Event listeners
window.onclick = function(event) {
    if (event.target === document.getElementById('destinationModal')) {
        closeModal();
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});
