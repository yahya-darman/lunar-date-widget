// Cache keys
const CACHE_KEY_HIJRI = 'cached_hijri_date';
const CACHE_KEY_LAST_UPDATE = 'last_update_time';
const CACHE_KEY_LOCATION = 'cached_location';
const CACHE_KEY_PRAYER_TIMES = 'cached_prayer_times';

// Function to get user's location
async function getUserLocation() {
    try {
        // First try to get cached location
        const cachedLocation = await chrome.storage.local.get(CACHE_KEY_LOCATION);
        if (cachedLocation[CACHE_KEY_LOCATION]) {
            return cachedLocation[CACHE_KEY_LOCATION];
        }

        // If no cached location, get from IP geolocation
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        const location = {
            city: data.city,
            country: data.country_name,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // Cache the location
        await chrome.storage.local.set({
            [CACHE_KEY_LOCATION]: location
        });

        return location;
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
}

// Function to format time in 12-hour format
function formatTime(timeStr) {
    try {
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return timeStr;
    }
}

// Function to update prayer times display
function updatePrayerTimes(timings) {
    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();
    let nextPrayer = null;
    let nextPrayerTime = null;

    // Cache the prayer times
    chrome.storage.local.set({
        [CACHE_KEY_PRAYER_TIMES]: timings
    });

    prayerNames.forEach(prayer => {
        const lowercasePrayer = prayer.toLowerCase();
        const timeElement = document.getElementById(`${lowercasePrayer}-time`);
        if (timeElement && timings[prayer]) {
            const formattedTime = formatTime(timings[prayer]);
            timeElement.textContent = formattedTime;

            // Check if this is the next prayer
            const [prayerHours, prayerMinutes] = timings[prayer].split(':');
            const prayerDate = new Date();
            prayerDate.setHours(parseInt(prayerHours), parseInt(prayerMinutes), 0);

            if (prayerDate > now && (!nextPrayerTime || prayerDate < nextPrayerTime)) {
                nextPrayer = prayer;
                nextPrayerTime = prayerDate;
            }
        }
    });

    // Highlight next prayer
    document.querySelectorAll('.prayer-time').forEach(el => {
        el.classList.remove('next-prayer');
    });
    if (nextPrayer) {
        const nextPrayerElement = document.querySelector(`#${nextPrayer.toLowerCase()}-time`).closest('.prayer-time');
        if (nextPrayerElement) {
            nextPrayerElement.classList.add('next-prayer');
        }
    }
}

// Function to get Hijri date and prayer times
async function getHijriDate() {
    try {
        const location = await getUserLocation();
        if (!location) {
            throw new Error('Could not determine location');
        }

        document.getElementById('location-text').textContent = `${location.city}, ${location.country}`;
        document.getElementById('prayer-times-title').textContent = `Prayer Times of ${location.city}, ${location.country}`;

        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${Math.floor(Date.now() / 1000)}?latitude=${location.latitude}&longitude=${location.longitude}&method=2`
        );
        
        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        if (!data.data || !data.data.date || !data.data.date.hijri) {
            throw new Error('Invalid API response format');
        }

        const hijri = data.data.date.hijri;
        const dateStr = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
        
        // Update prayer times
        if (data.data.timings) {
            updatePrayerTimes(data.data.timings);
        }

        // Cache the result
        await chrome.storage.local.set({
            [CACHE_KEY_HIJRI]: dateStr,
            [CACHE_KEY_LAST_UPDATE]: Date.now()
        });

        document.getElementById('hijri-date').textContent = dateStr;
    } catch (error) {
        console.error('Error fetching Hijri date:', error);
        document.getElementById('location-text').textContent = 'Location unavailable';
        document.getElementById('prayer-times-title').textContent = 'Prayer Times';
        
        // Try to use cached data
        const cachedData = await chrome.storage.local.get([CACHE_KEY_HIJRI, CACHE_KEY_PRAYER_TIMES]);
        if (cachedData[CACHE_KEY_HIJRI]) {
            document.getElementById('hijri-date').textContent = cachedData[CACHE_KEY_HIJRI] + ' (Cached)';
        }
        if (cachedData[CACHE_KEY_PRAYER_TIMES]) {
            updatePrayerTimes(cachedData[CACHE_KEY_PRAYER_TIMES]);
        }
    }
}

// Function to get Ramadan dates for a specific year
function getRamadanDates(year) {
    const dates = {
        2024: {
            start: new Date('2024-03-10T00:00:00'),
            end: new Date('2024-04-09T00:00:00')
        },
        2025: {
            start: new Date('2025-02-28T00:00:00'),
            end: new Date('2025-03-29T00:00:00')
        },
        2026: {
            start: new Date('2026-02-17T00:00:00'),
            end: new Date('2026-03-18T00:00:00')
        }
    };

    return dates[year] || null;
}

// Function to calculate time difference
function getTimeDifference(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    
    return {
        total: diff,
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    };
}

// Function to update countdown display
function updateDisplay(id, time) {
    try {
        const daysId = id ? `${id}-days` : 'days';
        const hoursId = id ? `${id}-hours` : 'hours';
        const minutesId = id ? `${id}-minutes` : 'minutes';

        const daysElement = document.getElementById(daysId);
        const hoursElement = document.getElementById(hoursId);
        const minutesElement = document.getElementById(minutesId);

        if (!daysElement || !hoursElement || !minutesElement) {
            console.error('Could not find countdown elements:', { daysId, hoursId, minutesId });
            return;
        }

        daysElement.textContent = Math.max(0, time.days).toString().padStart(2, '0');
        hoursElement.textContent = Math.max(0, time.hours).toString().padStart(2, '0');
        minutesElement.textContent = Math.max(0, time.minutes).toString().padStart(2, '0');
    } catch (error) {
        console.error('Error updating display:', error);
    }
}

// Function to check if we're in Ramadan
function isInRamadan(now) {
    const year = now.getFullYear();
    const dates = getRamadanDates(year);
    
    if (!dates) return false;
    return now >= dates.start && now < dates.end;
}

// Function to get next Ramadan start date
function getNextRamadanDate() {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Check current year and next two years
    for (let year = currentYear; year <= currentYear + 2; year++) {
        const dates = getRamadanDates(year);
        if (dates && now < dates.start) {
            return dates.start;
        }
    }
    
    // If we're past all known dates, approximate
    const lastKnownYear = Math.max(...Object.keys(getRamadanDates(currentYear)));
    const lastDates = getRamadanDates(lastKnownYear);
    return new Date(lastDates.start.getTime() + 355 * 24 * 60 * 60 * 1000);
}

// Function to update all countdowns
function updateCountdowns() {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const dates = getRamadanDates(currentYear);
        
        if (isInRamadan(now)) {
            // We're in Ramadan - show Eid countdown
            document.getElementById('ramadan-countdown').classList.add('d-none');
            document.getElementById('eid-countdown').classList.remove('d-none');
            
            const timeTillEid = getTimeDifference(dates.end);
            updateDisplay('eid', timeTillEid);
        } else {
            // Show Ramadan countdown
            document.getElementById('ramadan-countdown').classList.remove('d-none');
            document.getElementById('eid-countdown').classList.add('d-none');
            
            const nextRamadan = getNextRamadanDate();
            const timeTillRamadan = getTimeDifference(nextRamadan);
            updateDisplay('', timeTillRamadan);
        }
    } catch (error) {
        console.error('Error in updateCountdowns:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    getHijriDate();
    updateCountdowns();
    // Update countdown every minute
    setInterval(() => {
        getHijriDate();
        updateCountdowns();
    }, 60000);
}); 