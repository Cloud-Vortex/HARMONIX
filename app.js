// App State
const state = {
    xp: parseInt(localStorage.getItem('harmonix_xp')) || 0,
    level: parseInt(localStorage.getItem('harmonix_lvl')) || 1,
    streak: parseInt(localStorage.getItem('harmonix_streak')) || 0,
    lastPractice: localStorage.getItem('harmonix_last_date') || null,
    accuracyHistory: JSON.parse(localStorage.getItem('harmonix_acc_history')) || [60, 65, 75, 70, 85],
    totalMinutes: parseInt(localStorage.getItem('harmonix_minutes')) || 0,
    mySongs: JSON.parse(localStorage.getItem('harmonix_mysongs')) || [
        { id: 's1', title: 'Ode to Joy', duration: '1:45', lastPracticed: 'Yesterday', accuracy: 85, isBase: true },
        { id: 's2', title: 'Blues Riff in G', duration: '0:45', lastPracticed: '2 Days Ago', accuracy: 70, isBase: true }
    ],
    currentPracticeStep: 1
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    updateUIState();
    loadSongs();
    initChart();
    checkStreak();

    // Setup Quick Start
    document.getElementById('btn-quick-start').addEventListener('click', () => {
        navigateTo('practice');
    });
    
    // Guided Practice Step clicks
    document.querySelectorAll('.guided-steps .step').forEach((stepEl, index) => {
        stepEl.addEventListener('click', () => {
            setPracticeStep(index + 1);
        });
    });

    // Close Modal
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('reward-modal').classList.add('hidden');
    });
    
    // Upload Hook
    const uploadInput = document.getElementById('song-upload');
    uploadInput.addEventListener('change', handleFileUpload);
}

function setupNavigation() {
    const links = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.view-section');

    links.forEach(link => {
        link.addEventListener('click', () => {
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const target = link.getAttribute('data-target');
            sections.forEach(sec => {
                if (sec.id === target) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });

            if(target === 'progress' && window.myChart) {
                window.myChart.update();
            }
        });
    });
}

function navigateTo(sectionId) {
    const link = document.querySelector(`.nav-links li[data-target="${sectionId}"]`);
    if(link) link.click();
}

function calculateLevelFromXP(xp) {
    return Math.floor(xp / 500) + 1;
}

function updateUIState() {
    const calculatedLevel = calculateLevelFromXP(state.xp);
    if(calculatedLevel > state.level) {
        state.level = calculatedLevel;
        localStorage.setItem('harmonix_lvl', state.level);
    }

    const currentLevelXP = state.xp % 500;
    const progressPercent = (currentLevelXP / 500) * 100;

    // Sidebar
    document.getElementById('nav-level').textContent = state.level;
    document.getElementById('nav-xp-bar').style.width = `${progressPercent}%`;
    document.getElementById('nav-streak').textContent = state.streak;

    // Home Dash
    const ranks = ["Amateur", "Busker", "Studio Musician", "Virtuoso", "Harmonica Legend"];
    const rankIndex = Math.min(state.level - 1, ranks.length - 1);
    document.getElementById('home-rank').textContent = ranks[rankIndex];
    document.getElementById('home-xp-text').textContent = `${currentLevelXP} / 500 XP`;
    
    // SVG Circle
    const circle = document.getElementById('home-xp-circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progressPercent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Time
    const hours = Math.floor(state.totalMinutes / 60);
    const mins = state.totalMinutes % 60;
    document.getElementById('total-time').textContent = `${hours}h ${mins}m`;
}

function loadSongs() {
    const container = document.getElementById('songs-container');
    container.innerHTML = '';

    state.mySongs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card glass-panel';
        
        card.innerHTML = `
            <h3 class="mb-2" style="position: relative; z-index: 2;">${song.title}</h3>
            <p class="text-muted text-sm mb-1"><i class="fa-regular fa-clock"></i> ${song.duration}</p>
            <p class="text-muted text-sm mb-3"><i class="fa-solid fa-calendar-day"></i> Last: ${song.lastPracticed}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <span class="text-secondary text-sm">Best Accuracy</span>
                <span class="font-bold text-success">${song.accuracy}%</span>
            </div>
            
            <div class="song-card-actions mt-4" style="position: relative; z-index: 2;">
                <button class="btn btn-primary btn-practice" data-id="${song.id}" style="flex-grow: 1; padding: 0.5rem;">
                    Practice
                </button>
                ${!song.isBase ? `<button class="btn-icon-small btn-delete" data-id="${song.id}" title="Delete Song"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });

    // Event listeners
    container.querySelectorAll('.btn-practice').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const song = state.mySongs.find(s => s.id === id);
            document.getElementById('song-title-playing').textContent = `Practicing: ${song.title}`;
            navigateTo('practice');
            setPracticeStep(1); // Reset to Listen step
        });
    });
    
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            state.mySongs = state.mySongs.filter(s => s.id !== id);
            localStorage.setItem('harmonix_mysongs', JSON.stringify(state.mySongs));
            loadSongs();
        });
    });

    // populate badges
    const badgesContainer = document.getElementById('badges-container');
    badgesContainer.innerHTML = `
        <div class="badge-card" style="opacity: 1;">
            <i class="fa-solid fa-music"></i>
            <div>1st Note</div>
        </div>
        <div class="badge-card" style="${state.streak >= 3 ? '' : 'opacity: 0.4'}">
            <i class="fa-solid fa-fire text-accent"></i>
            <div>3 Day Streak</div>
        </div>
        <div class="badge-card" style="${state.level >= 2 ? '' : 'opacity: 0.4'}">
            <i class="fa-solid fa-star"></i>
            <div>Level 2</div>
        </div>
        <div class="badge-card" style="${state.accuracyHistory.some(a => a > 90) ? '' : 'opacity: 0.4'}">
            <i class="fa-solid fa-bullseye"></i>
            <div>Perfect Pitch (>90%)</div>
        </div>
    `;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    // Simulate reading & saving audio file to localStorage (using mocked data for demo to prevent quota exceed)
    const newSong = {
        id: 'u_' + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        duration: '2:15', // mocked due to lack of actual audio parsing parsing in this demo
        lastPracticed: 'Never',
        accuracy: 0,
        isBase: false
    };
    
    state.mySongs.push(newSong);
    localStorage.setItem('harmonix_mysongs', JSON.stringify(state.mySongs));
    
    // Reset file input
    e.target.value = '';
    
    // Reload UI
    loadSongs();
    alert(`"${newSong.title}" added to your library!`);
}

function setPracticeStep(step) {
    state.currentPracticeStep = step;
    
    // Update UI step markers
    document.querySelectorAll('.guided-steps .step').forEach((el, index) => {
        if((index + 1) <= step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    // Update progress bar
    const bar = document.getElementById('song-progress');
    if(step === 1) bar.style.width = '10%';
    else if(step === 2) bar.style.width = '40%';
    else if(step === 3) bar.style.width = '70%';
    else if(step === 4) bar.style.width = '100%';
}

function initChart() {
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    // Primary #d4af37
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');   
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0.0)');

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.accuracyHistory.map((_, i) => `S${i+1}`),
            datasets: [{
                label: 'Accuracy %',
                data: state.accuracyHistory,
                borderColor: '#d4af37',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#8b1c31', // Accent Deep Red
                pointBorderColor: '#faeedd',
                pointHoverBackgroundColor: '#faeedd',
                pointHoverBorderColor: '#8b1c31',
                pointRadius: 5,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: false, min: 40, max: 100, ticks: {color: '#faeedd'} },
                x: { ticks: {color: '#faeedd'} }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function checkStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (state.lastPractice) {
        const lastDate = new Date(state.lastPractice);
        const currentDate = new Date(today);
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays > 1) {
            state.streak = 0;
            localStorage.setItem('harmonix_streak', state.streak);
        }
    } else {
        state.streak = 0;
    }
}

// Complete Practice Session
window.completePracticeSession = function(accuracy) {
    const xpGained = Math.floor(accuracy * 0.5) + 30; // Boosted XP formula
    
    state.xp += xpGained;
    state.totalMinutes += 5; // Simulating 5 min practiced per session
    
    const today = new Date().toISOString().split('T')[0];
    if (state.lastPractice !== today) {
        state.streak += 1;
        state.lastPractice = today;
        localStorage.setItem('harmonix_last_date', today);
        localStorage.setItem('harmonix_streak', state.streak);
    }
    
    state.accuracyHistory.push(accuracy);
    if(state.accuracyHistory.length > 15) state.accuracyHistory.shift();
    
    localStorage.setItem('harmonix_xp', state.xp);
    localStorage.setItem('harmonix_minutes', state.totalMinutes);
    localStorage.setItem('harmonix_acc_history', JSON.stringify(state.accuracyHistory));
    
    updateUIState();
    
    if(window.myChart) {
        window.myChart.data.labels = state.accuracyHistory.map((_, i) => `S${i+1}`);
        window.myChart.data.datasets[0].data = state.accuracyHistory;
        window.myChart.update();
    }
    
    // Show Modal
    document.getElementById('modal-xp').textContent = `+${xpGained}`;
    document.getElementById('modal-acc').textContent = `${accuracy}%`;
    document.getElementById('reward-modal').classList.remove('hidden');
    
    // Check if we progress through Guided Step
    if(accuracy > 75 && state.currentPracticeStep < 4) {
        setPracticeStep(state.currentPracticeStep + 1);
    }
};
