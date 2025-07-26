// Global variables
let map;
let markers = [];
let destinations = [];
let dayLabels = [];
let currentEditingId = null;
let originalArrivalDateForEdit = null;
let autoZoomEnabled = true;
let currentFilteredDate = null;

// Trip settings
let tripSettings = {
    destination: '',
    startDate: '',
    endDate: '',
    budget: 0
};

// Category to Font Awesome icon mapping
const categoryIcons = {
    accommodation: 'fa-hotel',
    activity: 'fa-person-hiking',
    food: 'fa-utensils',
    fly: 'fa-plane-departure',
    drive: 'fa-car',
    photo: 'fa-camera',
    beach: 'fa-umbrella-beach',
    falls: 'fa-water',
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
        dayLabels: dayLabels,
        tripSettings: tripSettings,
        autoZoomEnabled: autoZoomEnabled
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
            tripSettings = data.tripSettings || {
                destination: '',
                startDate: '',
                endDate: '',
                budget: 0
            };
            if (data.autoZoomEnabled !== undefined) {
                autoZoomEnabled = data.autoZoomEnabled;
            }
        } catch (e) {
            console.error("Error parsing cached data:", e);
            destinations = [];
            dayLabels = [];
            tripSettings = {
                destination: '',
                startDate: '',
                endDate: '',
                budget: 0
            };
            autoZoomEnabled = true;
            localStorage.removeItem('vacationData');
        }
    }
    updateTripDisplay();
    renderAll();
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', function() {
    const arrivalDateInput = document.getElementById('modalArrivalDate');

    initializeMap();
    loadInitialData();
    
    // Set initial auto-zoom button state
    const autoZoomBtn = document.getElementById('autoZoomBtn');
    if (autoZoomBtn && autoZoomEnabled) {
        autoZoomBtn.classList.add('active');
    }

    arrivalDateInput.addEventListener('change', () => {
        const arrivalDate = arrivalDateInput.value;
        if (arrivalDate) {
            document.getElementById('modalDepartureDate').min = arrivalDate;
        }
    });
});

function toggleAutoZoom() {
    autoZoomEnabled = !autoZoomEnabled;
    const autoZoomBtn = document.getElementById('autoZoomBtn');
    
    if (autoZoomEnabled) {
        autoZoomBtn.classList.add('active');
        // If enabling auto-zoom, fit map to current markers
        if (currentFilteredDate) {
            filterByDay(currentFilteredDate);
        } else {
            showAllDays();
        }
    } else {
        autoZoomBtn.classList.remove('active');
    }
    
    saveDataToCache();
}

function initializeMap() {
    map = L.map('map').setView([65, -18], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('popupclose', function(e) {
        document.querySelectorAll('.destination-item').forEach(item => {
            item.classList.remove('highlighted');
        });
    });
}

// --- TRIP SETTINGS ---

function openTripSettingsModal() {
    const modal = document.getElementById('tripSettingsModal');
    document.getElementById('tripName').value = tripSettings.destination;
    document.getElementById('tripStartDate').value = tripSettings.startDate;
    document.getElementById('tripEndDate').value = tripSettings.endDate;
    document.getElementById('tripBudget').value = tripSettings.budget || '';
    modal.style.display = 'block';
}

function closeTripSettingsModal() {
    document.getElementById('tripSettingsModal').style.display = 'none';
}

function saveTripSettings() {
    tripSettings.destination = document.getElementById('tripName').value;
    tripSettings.startDate = document.getElementById('tripStartDate').value;
    tripSettings.endDate = document.getElementById('tripEndDate').value;
    tripSettings.budget = parseFloat(document.getElementById('tripBudget').value) || 0;
    
    updateTripDisplay();
    saveDataToCache();
    closeTripSettingsModal();
}

function updateTripDisplay() {
    // Update destination display
    const destDisplay = document.getElementById('tripDestination');
    destDisplay.textContent = tripSettings.destination || 'Set Destination';
    
    // Update dates display
    const datesDisplay = document.getElementById('tripDatesDisplay');
    if (tripSettings.startDate && tripSettings.endDate) {
        datesDisplay.textContent = formatDateRange(tripSettings.startDate, tripSettings.endDate);
    } else {
        datesDisplay.textContent = 'No dates set';
    }
    
    // Update budget display
    const budgetDisplay = document.getElementById('budgetDisplay');
    budgetDisplay.textContent = formatCost(tripSettings.budget);
}

// --- MODAL AND DATA HANDLING ---

function openAddModal(id = null, dataToLoad = null) {
    const modal = document.getElementById('destinationModal');
    clearModalForm();
    
    const destData = dataToLoad || (id ? destinations.find(d => d.id === id) : null);

    if (destData) {
        if (id) {
            currentEditingId = id;
            originalArrivalDateForEdit = destData.arrivalDate;
        } else {
            currentEditingId = null;
        }
        document.getElementById('modalDestName').value = destData.name;
        document.getElementById('modalArrivalDate').value = destData.arrivalDate;
        document.getElementById('modalDepartureDate').value = destData.departureDate;
        document.getElementById('modalCategory').value = destData.category || 'activity';
        document.getElementById('modalPriority').value = destData.priority || 'medium';
        document.getElementById('modalCost').value = destData.cost || '';
        document.getElementById('modalTime').value = destData.time || '';
        document.getElementById('modalActivities').value = destData.activities;
        document.getElementById('modalAddress').value = destData.address || '';
        document.getElementById('modalCoordinates').value = (destData.lat && destData.lng) ? `${destData.lat}, ${destData.lng}` : '';
        document.getElementById('modalWebsiteLink').value = destData.websiteLink || '';
        document.getElementById('modalGoogleMapsLink').value = destData.googleMapsLink || '';
        document.getElementById('modalAdvisorSiteLink').value = destData.advisorSiteLink || '';
    } else {
        currentEditingId = null; 
        
        // If trip dates are set, use them as defaults
        if (tripSettings.startDate) {
            document.getElementById('modalArrivalDate').value = tripSettings.startDate;
            document.getElementById('modalDepartureDate').value = tripSettings.startDate;
            document.getElementById('modalDepartureDate').min = tripSettings.startDate;
        } else {
            const datedDestinations = destinations.filter(d => d.arrivalDate);
            if (datedDestinations.length > 0) {
                const earliestDate = datedDestinations.map(d => d.arrivalDate).sort((a, b) => new Date(a) - new Date(b))[0];
                document.getElementById('modalArrivalDate').value = earliestDate;
                document.getElementById('modalDepartureDate').min = earliestDate;
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
    form.querySelector('#modalAddress').value = '';
    form.querySelector('#modalCoordinates').value = '';
    form.querySelector('#modalWebsiteLink').value = '';
    form.querySelector('#modalGoogleMapsLink').value = '';
    form.querySelector('#modalAdvisorSiteLink').value = '';
    form.querySelector('#modalDepartureDate').min = '';
}

function unscheduleDestination() {
    document.getElementById('modalArrivalDate').value = '';
    document.getElementById('modalDepartureDate').value = '';
    saveDestination();
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
    const address = document.getElementById('modalAddress').value;
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

    if (name) {
        if (arrivalDate && !departureDate) departureDate = arrivalDate;

        if (currentEditingId && originalArrivalDateForEdit && originalArrivalDateForEdit !== arrivalDate) {
            const originalArrival = new Date(originalArrivalDateForEdit + 'T00:00:00');
            const newArrival = new Date(arrivalDate + 'T00:00:00');
            const diffTime = newArrival.getTime() - originalArrival.getTime();
            
            const originalDeparture = new Date(departureDate + 'T00:00:00');
            const newDeparture = new Date(originalDeparture.getTime() + diffTime);
            departureDate = formatDateForInput(newDeparture);
        }
        const destinationData = { 
            name, arrivalDate, departureDate, category, priority, cost, time, activities, address, lat, lng, websiteLink, googleMapsLink, advisorSiteLink 
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
        alert('Please enter a destination name.');
    }
}

function duplicateDestination(id) {
    const originalDest = destinations.find(d => d.id === id);
    if (!originalDest) return;

    const newDestData = JSON.parse(JSON.stringify(originalDest));
    newDestData.name = `${originalDest.name} - Copy`;
    delete newDestData.id;

    openAddModal(null, newDestData);
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

function openShiftDatesModal() {
    if (destinations.filter(d => d.arrivalDate).length === 0) {
        alert('There are no dated destinations to shift.');
        return;
    }
    const modal = document.getElementById('shiftDatesModal');
    const earliestDate = destinations
        .filter(d => d.arrivalDate)
        .map(d => d.arrivalDate)
        .sort((a, b) => new Date(a) - new Date(b))[0];
    document.getElementById('newStartDate').value = earliestDate;
    modal.style.display = 'block';
}

function closeShiftDatesModal() {
    document.getElementById('shiftDatesModal').style.display = 'none';
}

function shiftAllDates() {
    const newStartDateString = document.getElementById('newStartDate').value;
    if (!newStartDateString) {
        alert('Please select a new start date.');
        return;
    }

    const newStartDate = new Date(newStartDateString + 'T00:00:00');
    const oldStartDateString = destinations.filter(d => d.arrivalDate).map(d => d.arrivalDate).sort((a, b) => new Date(a) - new Date(b))[0];
    const oldStartDate = new Date(oldStartDateString + 'T00:00:00');

    const diffTime = newStartDate.getTime() - oldStartDate.getTime();
    
    destinations.forEach(dest => {
        if(dest.arrivalDate) {
            const oldArrival = new Date(dest.arrivalDate + 'T00:00:00');
            const oldDeparture = new Date(dest.departureDate + 'T00:00:00');
            
            dest.arrivalDate = formatDateForInput(new Date(oldArrival.getTime() + diffTime));
            dest.departureDate = formatDateForInput(new Date(oldDeparture.getTime() + diffTime));
        }
    });

    dayLabels.forEach(label => {
        const oldLabelDate = new Date(label.date + 'T00:00:00');
        label.date = formatDateForInput(new Date(oldLabelDate.getTime() + diffTime));
    });

    renderAll();
    closeShiftDatesModal();
}

function toggleDayCollapse(button) {
    const dayGroup = button.closest('.day-group');
    if (dayGroup) {
        dayGroup.classList.toggle('collapsed');
        const icon = button.querySelector('i');
        if (dayGroup.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        } else {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    }
}

function toggleAllDays(collapse) {
    document.querySelectorAll('.day-group:not(.unscheduled)').forEach(dayGroup => {
        const button = dayGroup.querySelector('.btn-toggle-day');
        if (collapse) {
            dayGroup.classList.add('collapsed');
            button.querySelector('i').classList.remove('fa-chevron-up');
            button.querySelector('i').classList.add('fa-chevron-down');
        } else {
            dayGroup.classList.remove('collapsed');
            button.querySelector('i').classList.remove('fa-chevron-down');
            button.querySelector('i').classList.add('fa-chevron-up');
        }
    });
}

// --- UI RENDERING ---

function renderAll() {
    renderDestinations();
    updateMarkers();
    saveDataToCache();
    
    // Update auto-zoom button state
    const autoZoomBtn = document.getElementById('autoZoomBtn');
    if (autoZoomBtn) {
        if (autoZoomEnabled) {
            autoZoomBtn.classList.add('active');
        } else {
            autoZoomBtn.classList.remove('active');
        }
    }
}

function renderDestinations() {
    const datedContainer = document.getElementById('destinationsList');
    const unscheduledContainer = document.getElementById('unscheduledContainer');
    datedContainer.innerHTML = '';
    unscheduledContainer.innerHTML = '';

    if (destinations.length === 0) {
        datedContainer.innerHTML = `<div class="empty-state"><i class="fas fa-map-marked-alt"></i><p>No destinations yet.</p></div>`;
        document.getElementById('totalCostDisplay').textContent = '0';
        return;
    }
    
    const datedDestinations = destinations.filter(d => d.arrivalDate);
    const undatedDestinations = destinations.filter(d => !d.arrivalDate);

    const groupedByDate = datedDestinations.reduce((acc, dest) => {
        const date = dest.arrivalDate;
        if (!acc[date]) acc[date] = [];
        acc[date].push(dest);
        return acc;
    }, {});

    let dayCounter = 0;
    let totalCost = 0;
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a) - new Date(b));

    renderDayNavigation(sortedDates);

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
        const categoryCounts = {};
        
        groupedByDate[date].forEach(dest => {
            totalCost += dest.cost;
            dayTotalTime += dest.time || 0;
            
            if (dest.category) {
                categoryCounts[dest.category] = (categoryCounts[dest.category] || 0) + 1;
            }

            const div = createDestinationElement(dest, dayColor);
            dayGroup.appendChild(div);
        });

        let previewHtml = '';
        for (const category in categoryCounts) {
            const iconClass = categoryIcons[category] || 'fa-map-pin';
            const count = categoryCounts[category];
            previewHtml += `<div class="preview-icon" style="background-color: ${dayColor}" title="${category}"><i class="fas ${iconClass}"></i><span>${count}</span></div>`;
        }

        const totalTimeHtml = dayTotalTime > 0 ? `<div class="day-total-time">${formatTime(dayTotalTime)}</div>` : '';
        
        // Get day of week
        const dateObj = new Date(date + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        
        daySeparator.innerHTML = `
            <div class="day-separator-header">
                <div class="day-info" onclick="filterByDay('${date}')">
                    <span>${weekday} Day ${dayCounter + 1} · ${formatDate(date)}</span>
                    ${totalTimeHtml}
                </div>
                <button class="btn btn-toggle-day" onclick="toggleDayCollapse(this)"><i class="fas fa-chevron-up"></i></button>
            </div>
            <div class="day-label-container">
                <span class="day-label">${dayLabelText}</span>
                <button class="btn btn-edit-day" onclick="openDayEditModal('${date}')"><i class="fas fa-pencil-alt"></i></button>
            </div>
            <div class="day-preview">${previewHtml}</div>
        `;

        datedContainer.appendChild(dayGroup);
        dayGroup.insertBefore(daySeparator, dayGroup.firstChild);
        dayCounter++;
    }

    if (undatedDestinations.length > 0) {
        const unscheduledHeader = document.createElement('h3');
        unscheduledHeader.textContent = 'Unscheduled';
        unscheduledContainer.appendChild(unscheduledHeader);
        const unscheduledGroup = document.createElement('div');
        unscheduledGroup.className = 'day-group unscheduled';
        unscheduledGroup.dataset.date = '';
        
        undatedDestinations.forEach(dest => {
            totalCost += dest.cost;
            const div = createDestinationElement(dest, '#757575');
            unscheduledGroup.appendChild(div);
        });
        unscheduledContainer.appendChild(unscheduledGroup);
    }

    document.getElementById('totalCostDisplay').textContent = formatCost(totalCost);
    
    // Update budget display color
    const budgetDisplay = document.querySelector('.budget-display');
    if (tripSettings.budget > 0 && totalCost > tripSettings.budget) {
        budgetDisplay.style.backgroundColor = '#ffebee';
        budgetDisplay.style.color = '#c62828';
    } else {
        budgetDisplay.style.backgroundColor = '#e8f5e9';
        budgetDisplay.style.color = '#1b5e20';
    }
    
    initializeSortable();
}

function createDestinationElement(dest, color) {
    const div = document.createElement('div');
    div.className = 'destination-item';
    div.dataset.id = dest.id;

    if (dest.lat && dest.lng) {
        div.setAttribute('onclick', `zoomToDestination(${dest.id})`);
    }

    const iconClass = categoryIcons[dest.category] || 'fa-map-pin';
    const categoryIconHtml = `<div class="category-icon" style="background-color: ${color}"><i class="fas ${iconClass}"></i></div>`;

    const actionsHtml = `
        <div class="destination-actions">
            <div class="destination-links">
                ${dest.websiteLink ? `<a href="${dest.websiteLink}" target="_blank" title="Visit Website"><i class="fas fa-link"></i></a>` : ''}
                ${dest.googleMapsLink ? `<a href="${dest.googleMapsLink}" target="_blank" title="Open in Google Maps"><i class="fas fa-map-location-dot"></i></a>` : ''}
                ${dest.advisorSiteLink ? `<a href="${dest.advisorSiteLink}" target="_blank" title="Visit Advisor Site"><i class="fas fa-user-tie"></i></a>` : ''}
            </div>
            <div class="crud-actions">
                <button class="btn btn-duplicate" onclick="event.stopPropagation(); duplicateDestination(${dest.id})" title="Duplicate"><i class="fas fa-copy"></i></button>
                <button class="btn btn-edit" onclick="event.stopPropagation(); openAddModal(${dest.id})" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger" onclick="event.stopPropagation(); deleteDestination(${dest.id})" title="Delete"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
    
    const timeHtml = dest.time ? `<div class="destination-meta time"><i class="fas fa-clock"></i><span>${formatTime(dest.time)}</span></div>` : '';
    const priority = dest.priority || 'medium';
    const priorityTagHtml = priority !== 'assumed' ? `<div class="priority-tag priority-${priority}">${priority}</div>` : '';
    const dateHtml = dest.arrivalDate ? `<div class="destination-meta"><i class="fas fa-calendar-alt"></i><span>${formatDateRange(dest.arrivalDate, dest.departureDate)}</span></div>` : '';
    const addressHtml = dest.address ? `<div class="destination-meta address"><i class="fas fa-map-marker-alt"></i><span>${dest.address}</span></div>` : '';

    div.innerHTML = `
        <div class="destination-header">
            ${categoryIconHtml}
            <div class="destination-content">
                <div class="destination-title">
                    <h4>${dest.name}</h4>
                    ${priorityTagHtml}
                </div>
                ${dateHtml}
                ${addressHtml}
                <div class="destination-meta cost">
                    <i class="fas fa-dollar-sign"></i>
                    <span>${formatCost(dest.cost)}</span>
                </div>
                ${timeHtml}
                <div class="destination-activities">${dest.activities || ''}</div>
                 <div class="destination-footer">
                    ${actionsHtml}
                </div>
            </div>
        </div>
    `;
    return div;
}

function initializeSortable() {
    const allGroups = document.querySelectorAll('.day-group');
    allGroups.forEach(group => {
        new Sortable(group, {
            group: 'shared-destinations',
            animation: 150,
            handle: '.destination-item',
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const itemId = evt.item.dataset.id;
                const newDate = evt.to.dataset.date;
                
                const destinationMap = new Map(destinations.map(d => [d.id.toString(), d]));
                
                if (newDate !== undefined && destinationMap.has(itemId)) {
                    const movedItem = destinationMap.get(itemId);
                    movedItem.arrivalDate = newDate;
                    if (!movedItem.departureDate && newDate) {
                        movedItem.departureDate = newDate;
                    }
                }
                
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

function highlightAndScrollToDestination(id) {
    document.querySelectorAll('.destination-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    const destElement = document.querySelector(`.destination-item[data-id='${id}']`);
    if (destElement) {
        destElement.classList.add('highlighted');
        destElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function zoomToDestination(id) {
    const dest = destinations.find(d => d.id === id);
    if (!dest || !dest.lat || !dest.lng) {
        console.warn('Destination has no coordinates to zoom to.');
        return;
    }

    // Only zoom if auto-zoom is enabled
    if (autoZoomEnabled) {
        map.flyTo([dest.lat, dest.lng], 15);
    }
    
    highlightAndScrollToDestination(id);

    const markerToOpen = markers.find(marker => marker.destinationId === id);
    if (markerToOpen) {
        markerToOpen.openPopup();
    }
}

function updateMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    const uniqueDates = [...new Set(destinations.filter(d=>d.arrivalDate).map(d => d.arrivalDate))].sort((a,b) => new Date(a) - new Date(b));
    const dateColorMap = uniqueDates.reduce((acc, date, index) => {
        const dayDetails = dayLabels.find(d => d.date === date);
        acc[date] = dayDetails?.color || defaultDayColors[index % defaultDayColors.length];
        return acc;
    }, {});

    destinations.forEach(dest => {
        if (dest.lat && dest.lng && dest.arrivalDate) {
            const dayColor = dateColorMap[dest.arrivalDate] || '#757575';
            const iconClass = categoryIcons[dest.category] || 'fa-map-marker-alt';
            
            const markerIconHtml = `<div class="map-icon-background" style="background-color: ${dayColor};"><i class="fas ${iconClass}"></i></div>`;
            const markerIcon = L.divIcon({
                className: 'custom-map-icon',
                html: markerIconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            const footerHtml = `
                <div class="destination-footer">
                    <div class="destination-actions">
                        <div class="destination-links">
                            ${dest.websiteLink ? `<a href="${dest.websiteLink}" target="_blank" title="Visit Website"><i class="fas fa-link"></i></a>` : ''}
                            ${dest.googleMapsLink ? `<a href="${dest.googleMapsLink}" target="_blank" title="Open in Google Maps"><i class="fas fa-map-location-dot"></i></a>` : ''}
                            ${dest.advisorSiteLink ? `<a href="${dest.advisorSiteLink}" target="_blank" title="Visit Advisor Site"><i class="fas fa-user-tie"></i></a>` : ''}
                        </div>
                        <div class="crud-actions">
                            <button class="btn btn-duplicate" onclick="duplicateDestination(${dest.id})"><i class="fas fa-copy"></i></button>
                            <button class="btn btn-edit" onclick="openAddModal(${dest.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger" onclick="deleteDestination(${dest.id})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                </div>
            `;
            
            const timeHtml = dest.time ? `<div class="popup-meta"><i class="fas fa-clock"></i><span>${formatTime(dest.time)}</span></div>` : '';
            const priority = dest.priority || 'medium';
            const priorityHtml = priority !== 'assumed' ? `<div class="popup-meta"><i class="fas fa-star"></i><span style="text-transform: capitalize;">${priority} Priority</span></div>` : '';
            const addressHtml = dest.address ? `<div class="popup-meta"><i class="fas fa-map-marker-alt"></i><span>${dest.address}</span></div>` : '';
            
            const popupContent = `
                <div class="map-popup">
                    <div class="popup-header">
                        <div class="category-icon" style="background-color: ${dayColor}">
                            <i class="fas ${iconClass}"></i>
                        </div>
                        <h4>${dest.name}</h4>
                    </div>
                    ${priorityHtml}
                    ${addressHtml}
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
                    ${footerHtml}
                </div>
            `;
            
            const marker = L.marker([dest.lat, dest.lng], { icon: markerIcon, riseOnHover: true })
                .addTo(map)
                .bindPopup(popupContent)
                .bindTooltip(dest.name);

            marker.on('click', () => {
                highlightAndScrollToDestination(dest.id);
            });
            
            marker.destinationDate = dest.arrivalDate;
            marker.destinationId = dest.id;
            markers.push(marker);
        }
    });

    // Apply current filter state to new markers
    if (currentFilteredDate) {
        filterByDay(currentFilteredDate);
    } else {
        showAllDays();
    }
}

function renderDayNavigation(dates) {
    const nav = document.getElementById('dayNavigation');
    if (!nav) return;
    nav.innerHTML = '';

    if (dates.length === 0) {
        nav.style.display = 'none';
        return;
    }
    nav.style.display = 'flex';

    dates.forEach((date, index) => {
        const dayDetails = dayLabels.find(d => d.date === date);
        const color = dayDetails?.color || defaultDayColors[index % defaultDayColors.length];
        const dateObj = new Date(date + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const day = dateObj.getDate();
        
        const btn = document.createElement('button');
        btn.className = 'day-nav-button';
        btn.dataset.date = date;
        btn.style.color = color;
        btn.style.borderColor = color;
        btn.textContent = `${weekday} ${day}`;
        btn.title = `Day ${index + 1} - ${formatDate(date)}`;
        
        btn.addEventListener('click', () => {
            // Filter by day (which will handle map zoom and dimming)
            filterByDay(date);
            
            // Also scroll to the day group
            const group = document.querySelector(`.day-group[data-date='${date}']`);
            if (group) {
                if (group.classList.contains('collapsed')) {
                    group.classList.remove('collapsed');
                    const icon = group.querySelector('.btn-toggle-day i');
                    if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
                }
                group.scrollIntoView({ behavior: 'smooth', block: 'start' });
                group.classList.add('flash-highlight');
                setTimeout(() => group.classList.remove('flash-highlight'), 800);
            }
        });
        nav.appendChild(btn);
    });

    updateActiveNavigation(currentFilteredDate);
}

function updateActiveNavigation(date) {
    document.querySelectorAll('.day-nav-button').forEach(btn => {
        if (date && btn.dataset.date === date) {
            btn.classList.add('active');
            const color = btn.style.color;
            btn.style.backgroundColor = color;
            btn.style.color = 'white';
            btn.style.borderColor = color;
        } else {
            btn.classList.remove('active');
            btn.style.backgroundColor = 'white';
            const color = btn.style.borderColor;
            btn.style.color = color;
        }
    });
}

function filterByDay(date) {
    if (date === currentFilteredDate) {
        showAllDays();
        return;
    }

    currentFilteredDate = date;
    const visibleMarkers = [];
    
    // Dim all markers first, then highlight the selected day's markers
    markers.forEach(marker => {
        if (marker.destinationDate === date) {
            marker.setOpacity(1);
            marker.setZIndexOffset(1000); // Bring to front
            visibleMarkers.push(marker);
        } else {
            marker.setOpacity(0.3); // Dim other markers
            marker.setZIndexOffset(0);
        }
    });

    // Dim/highlight day groups in sidebar
    document.querySelectorAll('.day-group').forEach(group => {
        if (group.dataset.date === date) {
            group.classList.remove('filtered');
        } else {
            group.classList.add('filtered');
        }
    });

    // Auto-zoom to selected day's markers if enabled
    if (visibleMarkers.length > 0 && autoZoomEnabled) {
        const group = L.featureGroup(visibleMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }

    updateActiveNavigation(date);
}

function showAllDays() {
    currentFilteredDate = null;
    const allVisibleMarkers = [];
    
    // Restore full opacity to all markers
    markers.forEach(marker => {
        marker.setOpacity(1);
        marker.setZIndexOffset(0);
        allVisibleMarkers.push(marker);
    });

    // Remove filtering from all day groups
    document.querySelectorAll('.day-group').forEach(group => {
        group.classList.remove('filtered');
    });

    // Auto-zoom to show all markers if enabled
    if (allVisibleMarkers.length > 0 && autoZoomEnabled) {
        const group = L.featureGroup(allVisibleMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }

    updateActiveNavigation(null);
}

function exportToJSON() {
    if (destinations.length === 0 && dayLabels.length === 0) {
        alert('No data to export!');
        return;
    }
    
    const dataToExport = {
        destinations: destinations,
        dayLabels: dayLabels,
        tripSettings: tripSettings,
        autoZoomEnabled: autoZoomEnabled
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const tripName = tripSettings.destination ? tripSettings.destination.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'vacation';
    a.download = `${tripName}-itinerary-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function saveTripToJSON() {
    exportToJSON();
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
                    tripSettings = data.tripSettings || {
                        destination: '',
                        startDate: '',
                        endDate: '',
                        budget: 0
                    };
                    if (data.autoZoomEnabled !== undefined) {
                        autoZoomEnabled = data.autoZoomEnabled;
                    }
                    updateTripDisplay();
                    renderAll();
                    
                    // Update auto-zoom button state
                    const autoZoomBtn = document.getElementById('autoZoomBtn');
                    if (autoZoomBtn) {
                        if (autoZoomEnabled) {
                            autoZoomBtn.classList.add('active');
                        } else {
                            autoZoomBtn.classList.remove('active');
                        }
                    }
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
        closeShiftDatesModal();
        closeTripSettingsModal();
    }
});
