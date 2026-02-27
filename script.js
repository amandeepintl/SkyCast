document.addEventListener('DOMContentLoaded', () => {
    const cityInput = document.getElementById('cityInput');
    const searchButton = document.getElementById('searchButton');
    const weatherDisplay = document.getElementById('weatherDisplay');
    const weatherCard = document.getElementById('weatherCard');
    const cityName = document.getElementById('cityName');
    const locationDetails = document.getElementById('locationDetails');
    const localTime = document.getElementById('localTime');
    const temperature = document.getElementById('temperature');
    const description = document.getElementById('description');
    const feelsLike = document.getElementById('feelsLike');
    const uvIndex = document.getElementById('uvIndex');
    const humidity = document.getElementById('humidity');
    const wind = document.getElementById('wind');
    const windDir = document.getElementById('windDir');
    const pressure = document.getElementById('pressure');
    const visibility = document.getElementById('visibility');
    const precip = document.getElementById('precip');
    const loader = document.getElementById('loader');
    const errorState = document.getElementById('errorState');
    const historyContainer = document.getElementById('history-container');
    const suggestionsList = document.getElementById('suggestionsList');

    let searchHistory = JSON.parse(localStorage.getItem('skycast_history')) || [];
    let debounceTimer;

    const updateHistoryUI = () => {
        historyContainer.innerHTML = '';
        searchHistory.forEach(city => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const cityText = document.createElement('span');
            cityText.textContent = city;
            cityText.onclick = () => {
                cityInput.value = city;
                fetchWeather(city);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeHistoryItem(city);
            };

            item.appendChild(cityText);
            item.appendChild(deleteBtn);
            historyContainer.appendChild(item);
        });
    };

    const removeHistoryItem = (city) => {
        searchHistory = searchHistory.filter(c => c !== city);
        localStorage.setItem('skycast_history', JSON.stringify(searchHistory));
        updateHistoryUI();
    };

    const saveToHistory = (city) => {
        const normalized = city.trim();
        searchHistory = searchHistory.filter(c => c.toLowerCase() !== normalized.toLowerCase());
        searchHistory.unshift(normalized);
        if (searchHistory.length > 5) searchHistory.pop();
        localStorage.setItem('skycast_history', JSON.stringify(searchHistory));
        updateHistoryUI();
    };

    const fetchWeather = async (city) => {
        clearTimeout(debounceTimer);
        suggestionsList.classList.add('hidden');
        suggestionsList.innerHTML = '';
        weatherCard.classList.remove('animate-in');
        errorState.classList.add('hidden');
        loader.classList.remove('hidden');

        try {
            const url = `http://api.weatherstack.com/current?access_key=${API_CONFIG.WEATHER_KEY}&query=${encodeURIComponent(city)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                switch (data.error.code) {
                    case 104: throw new Error('API tier exhausted. Monthly limit reached.');
                    case 105: throw new Error('API plan restriction. Endpoint not supported.');
                    case 101: throw new Error('Invalid API key provided.');
                    case 615: throw new Error('Sector not found. Please try another location.');
                    default: throw new Error(data.error.info || 'Sector signal lost.');
                }
            }

            cityName.textContent = data.location.name;
            locationDetails.textContent = `${data.location.region}, ${data.location.country}`;
            localTime.textContent = `Local Time: ${data.location.localtime}`;

            temperature.textContent = data.current.temperature;
            description.textContent = data.current.weather_descriptions[0];

            feelsLike.textContent = `${data.current.feelslike}°`;
            uvIndex.textContent = data.current.uv_index;
            humidity.textContent = `${data.current.humidity}%`;
            wind.textContent = `${data.current.wind_speed} km/h`;
            windDir.textContent = data.current.wind_dir;
            pressure.textContent = `${data.current.pressure} mb`;
            visibility.textContent = `${data.current.visibility} km`;
            precip.textContent = `${data.current.precip} mm`;

            saveToHistory(data.location.name);
            loader.classList.add('hidden');
            weatherDisplay.classList.remove('hidden');

            requestAnimationFrame(() => {
                setTimeout(() => {
                    weatherCard.classList.add('animate-in');
                }, 100);
            });

        } catch (error) {
            console.error('Cosmic Fetch Error:', error);
            loader.classList.add('hidden');
            weatherDisplay.classList.add('hidden');

            // Handle Network & Custom Errors
            if (!navigator.onLine) {
                errorState.textContent = 'No Internet Connection. Please check your network.';
            } else if (error instanceof TypeError) {
                errorState.textContent = 'Network error or secure connection failed.';
            } else {
                errorState.textContent = error.message || 'Sector signal lost.';
            }

            errorState.classList.remove('hidden');
        }
    };

    const fetchSuggestions = async (query) => {
        if (query.length < 2) {
            suggestionsList.classList.add('hidden');
            return;
        }

        try {
            // Include cities, administrative areas (states), and independent countries
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Sort by population, giving priority to countries (PCLI) and states (ADM1)
                data.results.sort((a, b) => {
                    const popA = a.population || (a.feature_code === 'PCLI' ? 100000000 : (a.feature_code === 'ADM1' ? 5000000 : 0));
                    const popB = b.population || (b.feature_code === 'PCLI' ? 100000000 : (b.feature_code === 'ADM1' ? 5000000 : 0));
                    return popB - popA;
                });

                const finalResults = data.results.slice(0, 5);
                renderSuggestions(finalResults);
            } else {
                // Fallback: If Open-Meteo geocoding fails (e.g., for some exact country names), try REST Countries API quietly
                try {
                    const countryUrl = `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}?fields=name,capital,population,region`;
                    const countryRes = await fetch(countryUrl);
                    if (countryRes.ok) {
                        const countryData = await countryRes.json();
                        const mappedData = countryData.map(c => ({
                            name: c.name.common,
                            admin1: c.region,
                            country: c.name.common,
                            population: c.population
                        })).sort((a, b) => b.population - a.population).slice(0, 3);
                        renderSuggestions(mappedData);
                        return;
                    }
                } catch (e) {
                    console.log("Country fallback failed", e);
                }
                suggestionsList.classList.add('hidden');
            }
        } catch (error) {
            console.error('Suggestions Error:', error);
            suggestionsList.classList.add('hidden');
        }
    };

    const renderSuggestions = (suggestions) => {
        suggestionsList.innerHTML = '';
        suggestions.forEach(place => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';

            const name = place.name;
            const admin = place.admin1 ? `${place.admin1}, ` : '';
            const sub = `${admin}${place.country}`;

            div.innerHTML = `
                ${name}
                <span class="sub">${sub}</span>
            `;

            div.onclick = () => {
                cityInput.value = name;
                suggestionsList.classList.add('hidden');
                // Pass city, country to ensure Weatherstack gets the right one
                fetchWeather(`${name}, ${place.country}`);
            };
            suggestionsList.appendChild(div);
        });
        suggestionsList.classList.remove('hidden');
    };

    cityInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    searchButton.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    });

    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) fetchWeather(city);
        }
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            suggestionsList.classList.add('hidden');
        }
    });

    // Init UI
    updateHistoryUI();
});
