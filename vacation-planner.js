// Global variables
let map;
let markers = [];
let destinations = [];
let dayLabels = [];
let currentEditingId = null;
let originalArrivalDateForEdit = null;
let autoZoomEnabled = true;
let currentFilteredDate = null;

// Category to Font Awesome icon mapping
const categoryIcons = {
    accommodation: 'fa-hotel',
    activity: 'fa-person-hiking',
    food: 'fa-utensils',
    fly: 'fa-plane-departure',
    drive: 'fa-car',
    shopping: 'fa-shopping-bag',
    entertainment: 'fa-film',
    other: 'fa-map-pin'
};

// Default colors for different days if not customized
const defaultDayColors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'
];

// --- HELPER FUNCTIONS ---

function hexToRgba(hex, alpha = 1) {
    if (!hex || !/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return 'rgba(0,0,0,0.1)';
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
    c = '0x' + c.join('');
    return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`;
}

function formatDate(dateString) {
    if (!dateString || dateString.length < 10) return dateString;
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function formatDateForInput(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateRange(startDate, endDate) {
    const formattedStart = formatDate(startDate);
    if (!endDate || startDate === endDate) return formattedStart;
    return `${formattedStart} to ${formatDate(endDate)}`;
}

function formatCost(number) {
    if (isNaN(number)) return '0';
    return Math.round(number).toLocaleString('en-US');
}

function formatTime(hours) {
    if (isNaN(hours) || hours === 0) return '';
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
}

// --- DATA PERSISTENCE ---

function saveDataToCache() {
    const dataToSave = {
        destinations: destinations,
        dayLabels: dayLabels
    };
    localStorage.setItem('vacationData', JSON.stringify(dataToSave));
}

function loadInitialData() {
    const cachedData = localStorage.getItem('vacationData');
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            destinations = data.destinations || [];
            dayLabels = data.dayLabels || [];
        } catch (e) {
            console.error("Error parsing cached data:", e);
            destinations = [];
            dayLabels = [];
            localStorage.removeItem('vacationData');
        }
    }
    renderAll();
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', function() {
    const autoZoomToggle = document.getElementById('autoZoomToggle');
    const arrivalDateInput = document.getElementById('modalArrivalDate');
    const departureDateInput = document.getElementById('modalDepartureDate');

    initializeMap();
    loadInitialData();
    
    autoZoomToggle.addEventListener('change', (e) => {
        autoZoomEnabled = e.target.checked;
    });

    arrivalDateInput.addEventListener('change', () => {
        const arrivalDate = arrivalDateInput.value;
        if (arrivalDate) {
            departureDateInput.min = arrivalDate;
            if (!currentEditingId && (!departureDateInput.value || departureDateInput.value < arrivalDate)) {
                departureDateInput.value = arrivalDate;
            }
        }
    });
});

function initializeMap() {
    map = L.map('map').setView([65, -18], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// --- MODAL AND DATA HANDLING ---

function openAddModal(id = null) {
    const modal = document.getElementById('destinationModal');
    clearModalForm();
    
    if (id) {
        currentEditingId = id;
        const dest = destinations.find(d => d.id === id);
        if (dest) {
            originalArrivalDateForEdit = dest.arrivalDate;
            document.getElementById('modalDestName').value = dest.name;
            document.getElementById('modalArrivalDate').value = dest.arrivalDate;
            document.getElementById('modalDepartureDate').value = dest.departureDate;
            document.getElementById('modalCategory').value = dest.category || 'activity';
            document.getElementById('modalPriority').value = dest.priority || 'medium';
            document.getElementById('modalCost').value = dest.cost || '';
            document.getElementById('modalTime').value = dest.time || '';
            document.getElementById('modalActivities').value = dest.activities;
            document.getElementById('modalCoordinates').value = (dest.lat && dest.lng) ? `${dest.lat}, ${dest.lng}` : '';
            document.getElementById('modalWebsiteLink').value = dest.websiteLink || '';
            document.getElementById('modalGoogleMapsLink').value = dest.googleMapsLink || '';
            document.getElementById('modalAdvisorSiteLink').value = dest.advisorSiteLink || '';
        }
    } else {
        currentEditingId = null;
        if (destinations.length > 0) {
            const earliestDate = destinations.map(d => d.arrivalDate).sort((a, b) => new Date(a) - new Date(b))[0];
            if (earliestDate) {
                const arrivalInput = document.getElementById('modalArrivalDate');
                const departureInput = document.getElementById('modalDepartureDate');
                arrivalInput.value = earliestDate;
                departureInput.value = earliestDate;
                departureInput.min = earliestDate;
            }
        }
    }
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('destinationModal').style.display = 'none';
    currentEditingId = null;
    originalArrivalDateForEdit = null;
    clearModalForm();
}

function clearModalForm() {
    const form = document.getElementById('destinationModal');
    form.querySelector('#modalDestName').value = '';
    form.querySelector('#modalArrivalDate').value = '';
    form.querySelector('#modalDepartureDate').value = '';
    form.querySelector('#modalCategory').value = 'activity';
    form.querySelector('#modalPriority').value = 'medium';
    form.querySelector('#modalCost').value = '';
    form.querySelector('#modalTime').value = '';
    form.querySelector('#modalActivities').value = '';
    form.querySelector('#modalCoordinates').value = '';
    form.querySelector('#modalWebsiteLink').value = '';
    form.querySelector('#modalGoogleMapsLink').value = '';
    form.querySelector('#modalAdvisorSiteLink').value = '';
    form.querySelector('#modalDepartureDate').min = '';
}

function saveDestination() {
    const name = document.getElementById('modalDestName').value;
    let arrivalDate = document.getElementById('modalArrivalDate').value;
    let departureDate = document.getElementById('modalDepartureDate').value;
    const category = document.getElementById('modalCategory').value;
    const priority = document.getElementById('modalPriority').value;
    const cost = parseFloat(document.getElementById('modalCost').value) || 0;
    const time = parseFloat(document.getElementById('modalTime').value) || 0;
    const activities = document.getElementById('modalActivities').value;
    const websiteLink = document.getElementById('modalWebsiteLink').value;
    const googleMapsLink = document.getElementById('modalGoogleMapsLink').value;
    const advisorSiteLink = document.getElementById('modalAdvisorSiteLink').value;
    
    const coordString = document.getElementById('modalCoordinates').value;
    let lat = 0, lng = 0;
    if (coordString) {
        const parts = coordString.split(',');
        if (parts.length === 2) {
            lat = parseFloat(parts[0].trim());
            lng = parseFloat(parts[1].trim());
        }
    }
    lat = isNaN(lat) ? 0 : lat;
    lng = isNaN(lng) ? 0 : lng;

    if (name && arrivalDate) {
        if (!departureDate) departureDate = arrivalDate;

        if (currentEditingId && originalArrivalDateForEdit && originalArrivalDateForEdit !== arrivalDate) {
            const originalArrival = new Date(originalArrivalDateForEdit + 'T00:00:00');
            const newArrival = new Date(arrivalDate + 'T00:00:00');
            const diffTime = newArrival.getTime() - originalArrival.getTime();
            
            const originalDeparture = new Date(departureDate + 'T00:00:00');
            const newDeparture = new Date(originalDeparture.getTime() + diffTime);
            departureDate = formatDateForInput(newDeparture);
        }

        const destinationData = { 
            name, arrivalDate, departureDate, category, priority, cost, time, activities, lat, lng, websiteLink, googleMapsLink, advisorSiteLink 
        };

        if (currentEditingId) {
            const destIndex = destinations.findIndex(d => d.id === currentEditingId);
            if (destIndex !== -1) destinations[destIndex] = { ...destinationData, id: currentEditingId };
        } else {
            destinations.push({ ...destinationData, id: Date.now() });
        }
        
        renderAll();
        closeModal();
    } else {
        alert('Please fill in at least the destination name and arrival date.');
    }
}

function deleteDestination(id) {
    if (confirm('Are you sure you want to delete this destination?')) {
        destinations = destinations.filter(d => d.id !== id);
        renderAll();
    }
}

function clearAll() {
    if (confirm('Are you sure you want to clear all itinerary data?')) {
        destinations = [];
        dayLabels = [];
        renderAll();
    }
}

function openDayEditModal(date) {
    const modal = document.getElementById('dayEditModal');
    const dayDetails = dayLabels.find(d => d.date === date);
    
    document.getElementById('dayEditDate').value = date;
    document.getElementById('dayLabelInput').value = dayDetails?.label || '';
    document.getElementById('dayColorInput').value = dayDetails?.color || '#f44336';
    
    modal.style.display = 'block';
}

function closeDayEditModal() {
    document.getElementById('dayEditModal').style.display = 'none';
}

function saveDayDetails() {
    const date = document.getElementById('dayEditDate').value;
    const label = document.getElementById('dayLabelInput').value.trim();
    const color = document.getElementById('dayColorInput').value;

    const dayDetails = dayLabels.find(d => d.date === date);
    if (dayDetails) {
        dayDetails.label = label;
        dayDetails.color = color;
    } else {
        dayLabels.push({ date, label, color });
    }
    renderAll();
    closeDayEditModal();
}

// --- UI RENDERING ---

function renderAll() {
    renderDestinations();
    updateMarkers();
    saveDataToCache();
}

function renderDestinations() {
    const container = document.getElementById('destinationsList');
    container.innerHTML = '';
    
    if (destinations.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-map-marked-alt"></i><p>No destinations yet.</p></div>`;
        document.getElementById('totalCostDisplay').textContent = '$0';
        return;
    }
    
    const groupedByDate = destinations.reduce((acc, dest) => {
        const date = dest.arrivalDate;
        if (!acc[date]) acc[date] = [];
        acc[date].push(dest);
        return acc;
    }, {});

    let dayCounter = 0;
    let totalCost = 0;
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a) - new Date(b));

    for (const date of sortedDates) {
        const dayDetails = dayLabels.find(d => d.date === date);
        const dayColor = dayDetails?.color || defaultDayColors[dayCounter % defaultDayColors.length];
        
        const dayGroup = document.createElement('div');
        dayGroup.className = 'day-group';
        dayGroup.style.backgroundColor = hexToRgba(dayColor, 0.05);
        dayGroup.style.borderColor = hexToRgba(dayColor, 0.2);
        dayGroup.dataset.date = date;

        const daySeparator = document.createElement('div');
        daySeparator.className = 'day-separator';
        daySeparator.style.color = dayColor;
        
        const dayLabelText = dayDetails?.label || 'Add a title for this day...';
        
        let dayTotalTime = 0;
        groupedByDate[date].forEach(dest => {
            totalCost += dest.cost;
            dayTotalTime += dest.time || 0;
            const div = document.createElement('div');
            div.className = 'destination-item';
            div.dataset.id = dest.id;

            const iconClass = categoryIcons[dest.category] || 'fa-map-pin';
            const categoryIconHtml = `<div class="category-icon" style="background-color: ${dayColor}"><i class="fas ${iconClass}"></i></div>`;

            const linksHtml = `
                <div class="destination-links">
                    ${dest.websiteLink ? `<a href="${dest.websiteLink}" target="_blank" title="Visit Website"><i class="fas fa-link"></i></a>` : ''}
                    ${dest.googleMapsLink ? `<a href="${dest.googleMapsLink}" target="_blank" title="Open in Google Maps"><i class="fas fa-map-location-dot"></i></a>` : ''}
                    ${dest.advisorSiteLink ? `<a href="${dest.advisorSiteLink}" target="_blank" title="Visit Advisor Site"><i class="fas fa-user-tie"></i></a>` : ''}
                </div>
            `;
            
            const actionsHtml = `
                <div class="destination-actions">
                    <button class="btn btn-edit" onclick="openAddModal(${dest.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" onclick="deleteDestination(${dest.id})"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            
            const timeHtml = dest.time ? `
                <div class="destination-meta time">
                    <i class="fas fa-clock"></i>
                    <span>${formatTime(dest.time)}</span>
                </div>
            ` : '';

            const priority = dest.priority || 'medium';
            const priorityTagHtml = `<div class="priority-tag priority-${priority}">${priority}</div>`;

            div.innerHTML = `
                <div class="destination-header">
                    ${categoryIconHtml}
                    <div class="destination-content">
                        <div class="destination-title">
                            <h4>${dest.name}</h4>
                            ${priorityTagHtml}
                        </div>
                        <div class="destination-meta">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${formatDateRange(dest.arrivalDate, dest.departureDate)}</span>
                        </div>
                        <div class="destination-meta cost">
                            <i class="fas fa-dollar-sign"></i>
                            <span>${formatCost(dest.cost)}</span>
                        </div>
                        ${timeHtml}
                        <div class="destination-activities">${dest.activities || ''}</div>
                         <div class="destination-footer">
                            ${linksHtml}
                            ${actionsHtml}
                        </div>
                    </div>
                </div>
            `;
            dayGroup.appendChild(div);
        });

        const totalTimeHtml = dayTotalTime > 0 ? `<div class="day-total-time">${formatTime(dayTotalTime)}</div>` : '';
        daySeparator.innerHTML = `
            <div class="day-info" onclick="filterByDay('${date}')">
                <span>Day ${dayCounter + 1} · ${formatDate(date)}</span>
                ${totalTimeHtml}
            </div>
            <div class="day-label-container">
                <span class="day-label">${dayLabelText}</span>
                <button class="btn btn-edit-day" onclick="openDayEditModal('${date}')"><i class="fas fa-pencil-alt"></i></button>
            </div>
        `;

        dayGroup.insertBefore(daySeparator, dayGroup.firstChild);
        container.appendChild(dayGroup);
        dayCounter++;
    }
    document.getElementById('totalCostDisplay').textContent = `$${formatCost(totalCost)}`;
    initializeSortable();
}

function initializeSortable() {
    const dayGroups = document.querySelectorAll('.day-group');
    dayGroups.forEach(group => {
        new Sortable(group, {
            animation: 150,
            handle: '.destination-item',
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const destinationMap = new Map(destinations.map(d => [d.id.toString(), d]));
                const newDestinations = [];
                document.querySelectorAll('.destination-item').forEach(item => {
                    const id = item.dataset.id;
                    if (destinationMap.has(id)) {
                        newDestinations.push(destinationMap.get(id));
                        destinationMap.delete(id);
                    }
                });
                destinations = newDestinations;
                renderAll();
            }
        });
    });
}

function updateMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    const uniqueDates = [...new Set(destinations.map(d => d.arrivalDate))].sort((a,b) => new Date(a) - new Date(b));
    const dateColorMap = uniqueDates.reduce((acc, date, index) => {
        const dayDetails = dayLabels.find(d => d.date === date);
        acc[date] = dayDetails?.color || defaultDayColors[index % defaultDayColors.length];
        return acc;
    }, {});

    destinations.forEach(dest => {
        if (dest.lat && dest.lng) {
            const dayColor = dateColorMap[dest.arrivalDate] || '#757575';
            const iconClass = categoryIcons[dest.category] || 'fa-map-marker-alt';
            
            const markerIconHtml = `<div class="map-icon-background" style="background-color: ${dayColor};"><i class="fas ${iconClass}"></i></div>`;
            const markerIcon = L.divIcon({
                className: 'custom-map-icon',
                html: markerIconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            const linksHtml = `
                <div class="destination-links">
                    ${dest.websiteLink ? `<a href="${dest.websiteLink}" target="_blank" title="Visit Website"><i class="fas fa-link"></i> Website</a>` : ''}
                    ${dest.googleMapsLink ? `<a href="${dest.googleMapsLink}" target="_blank" title="Open in Google Maps"><i class="fas fa-map-location-dot"></i> Map</a>` : ''}
                    ${dest.advisorSiteLink ? `<a href="${dest.advisorSiteLink}" target="_blank" title="Visit Advisor Site"><i class="fas fa-user-tie"></i> Advisor</a>` : ''}
                </div>
            `;
            
            const timeHtml = dest.time ? `
                <div class="popup-meta">
                    <i class="fas fa-clock"></i>
                    <span>${formatTime(dest.time)}</span>
                </div>
            ` : '';

            const priority = dest.priority || 'medium';

            const popupContent = `
                <div class="map-popup">
                    <div class="popup-header">
                        <div class="category-icon" style="background-color: ${dayColor}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <h4>${dest.name}</h4>
                    </div>
                     <div class="popup-meta">
                        <i class="fas fa-star"></i>
                        <span style="text-transform: capitalize;">${priority} Priority</span>
                    </div>
                    <div class="popup-meta">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${formatDateRange(dest.arrivalDate, dest.departureDate)}</span>
                    </div>
                    <div class="popup-meta cost">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${formatCost(dest.cost)}</span>
                    </div>
                    ${timeHtml}
                    <div class="popup-activities">
                        ${dest.activities || 'No additional notes.'}
                    </div>
                    ${linksHtml}
                </div>
            `;
            
            const marker = L.marker([dest.lat, dest.lng], { icon: markerIcon, riseOnHover: true })
                .addTo(map)
                .bindPopup(popupContent);
            
            marker.destinationDate = dest.arrivalDate;
            markers.push(marker);
        }
    });

    if (!currentFilteredDate) showAllDays();
}

function filterByDay(date) {
    if (date === currentFilteredDate) {
        showAllDays();
        return;
    }

    currentFilteredDate = date;
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
}

function showAllDays() {
    currentFilteredDate = null;
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
}

function exportToJSON() {
    if (destinations.length === 0 && dayLabels.length === 0) {
        alert('No data to export!');
        return;
    }
    
    const dataToExport = {
        destinations: destinations,
        dayLabels: dayLabels
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vacation-itinerary-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importFromJSON(event) {
    if (destinations.length > 0 || dayLabels.length > 0) {
        if (!confirm('An itinerary is already loaded. Do you want to overwrite it?')) {
            event.target.value = '';
            return;
        }
    }
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (typeof data === 'object' && data !== null && (Array.isArray(data.destinations) || Array.isArray(data.dayLabels))) {
                    destinations = data.destinations || [];
                    dayLabels = data.dayLabels || [];
                    renderAll();
                } else {
                    alert('Invalid JSON file. The file must be a valid itinerary object.');
                }
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    event.target.value = '';
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
        closeDayEditModal();
    }
});
