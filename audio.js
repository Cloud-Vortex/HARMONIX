// Web Audio API & Visuals
let audioCtx;
let analyser;
let micStream;
let dataArray;
let isRecording = false;
let practiceTimer;

// DOM Elements
const refCanvas = document.getElementById('ref-canvas');
const liveCanvas = document.getElementById('live-canvas');
const bgCanvas = document.getElementById('bg-canvas');
const refCtx = refCanvas.getContext('2d');
const liveCtx = liveCanvas.getContext('2d');
const bgCtx = bgCanvas.getContext('2d');

const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnPlayRef = document.getElementById('btn-play-ref');

const detectedNoteEl = document.getElementById('detected-note');
const meterNeedle = document.getElementById('meter-needle');
const pitchStatus = document.getElementById('pitch-status');
const accuracyValEl = document.getElementById('accuracy-val');
const aiSuggestion = document.getElementById('ai-suggestion');

// Listen & Match Elements
const btnLmListen = document.getElementById('btn-lm-listen');
const btnLmPlay = document.getElementById('btn-lm-play');
const lmResultContainer = document.getElementById('lm-result-container');
const lmScore = document.getElementById('lm-score');
const lmFeedback = document.getElementById('lm-feedback');

// Setup Canvas Sizes
function resizeCanvases() {
    refCanvas.width = refCanvas.parentElement.clientWidth;
    refCanvas.height = 140;
    liveCanvas.width = liveCanvas.parentElement.clientWidth;
    liveCanvas.height = 140;
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvases);
setTimeout(resizeCanvases, 100);

// Background Animations: Floating Musical Notes and Sound Waves
const musicNotes = ["♪", "♫", "♬", "♩", "𝄢", "𝄡"];
let bgNotes = [];
for (let i = 0; i < 35; i++) {
    bgNotes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 20 + 15,
        char: musicNotes[Math.floor(Math.random() * musicNotes.length)],
        vy: -(Math.random() * 0.8 + 0.3), // Float upwards
        vx: Math.random() * 0.4 - 0.2,
        alpha: Math.random() * 0.4 + 0.1,
        rot: Math.random() * 360,
        rotSpeed: Math.random() * 0.5 - 0.25
    });
}

let time = 0;
function animateBg() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    // Draw flowing wave background
    bgCtx.beginPath();
    for (let x = 0; x <= bgCanvas.width; x += 20) {
        let y = bgCanvas.height * 0.6 + Math.sin(x * 0.005 + time * 0.02) * 50 + Math.sin(x * 0.002 - time * 0.01) * 100;
        if (x === 0) bgCtx.moveTo(x, y);
        else bgCtx.lineTo(x, y);
    }
    bgCtx.lineTo(bgCanvas.width, bgCanvas.height);
    bgCtx.lineTo(0, bgCanvas.height);
    
    const grad = bgCtx.createLinearGradient(0, bgCanvas.height * 0.4, 0, bgCanvas.height);
    grad.addColorStop(0, 'rgba(212, 175, 55, 0.02)');
    grad.addColorStop(1, 'rgba(139, 28, 49, 0.08)');
    bgCtx.fillStyle = grad;
    bgCtx.fill();

    // Draw floating notes
    bgCtx.font = "20px 'Playfair Display'";
    bgCtx.textAlign = "center";
    bgCtx.textBaseline = "middle";
    
    bgNotes.forEach(n => {
        n.y += n.vy;
        n.x += n.vx + Math.sin(time * 0.01 + n.y * 0.01) * 0.5; // slight swaying
        n.rot += n.rotSpeed;
        
        if (n.y < -50) {
            n.y = bgCanvas.height + 50;
            n.x = Math.random() * bgCanvas.width;
        }
        
        bgCtx.save();
        bgCtx.translate(n.x, n.y);
        bgCtx.rotate(n.rot * Math.PI / 180);
        bgCtx.fillStyle = `rgba(212, 175, 55, ${n.alpha})`; // primary color
        bgCtx.font = `${n.size}px serif`;
        bgCtx.fillText(n.char, 0, 0);
        bgCtx.restore();
    });
    
    time++;
    requestAnimationFrame(animateBg);
}
animateBg();

// Note Simulation Data (Harmonica C Major Scale mapping)
const noteNames = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

// Buttons Event Listeners
btnRecord.addEventListener('click', async () => {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const source = audioCtx.createMediaStreamSource(micStream);
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85; // smooth waves
        source.connect(analyser);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        isRecording = true;
        btnRecord.classList.add('hidden');
        btnStop.classList.remove('hidden');
        btnPlayRef.disabled = true;
        
        pitchStatus.textContent = 'Listening to harmony...';
        pitchStatus.className = 'status-text text-primary';
        detectedNoteEl.style.textShadow = '0 0 20px var(--primary-glow)';
        
        startVisualizer();
        startPracticeSimulation();
        
    } catch (err) {
        console.error('Mic access denied!', err);
        alert('Please allow microphone access to practice.');
    }
});

btnStop.addEventListener('click', () => {
    isRecording = false;
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    
    btnStop.classList.add('hidden');
    btnRecord.classList.remove('hidden');
    btnPlayRef.disabled = false;
    
    clearInterval(practiceTimer);
    
    pitchStatus.textContent = 'Ready to play';
    pitchStatus.className = 'status-text text-secondary';
    detectedNoteEl.textContent = '--';
    meterNeedle.style.left = '50%';
    
    // Finish session logic
    const finalAccuracy = parseInt(accuracyValEl.textContent);
    if(finalAccuracy > 0) {
        window.completePracticeSession(finalAccuracy);
    }
});

// Reference Audio Simulation Visuals (Smooth curved waves instead of angular)
btnPlayRef.addEventListener('click', () => {
    btnPlayRef.disabled = true;
    let t = 0;
    function drawRefSim() {
        if(t > 150) {
            btnPlayRef.disabled = false;
            refCtx.clearRect(0,0, refCanvas.width, refCanvas.height);
            return;
        }
        
        refCtx.fillStyle = 'rgba(0,0,0,0.15)'; // slight fade effect for motion blur
        refCtx.fillRect(0, 0, refCanvas.width, refCanvas.height);
        
        refCtx.beginPath();
        refCtx.moveTo(0, refCanvas.height / 2);
        
        let freq = 0.05;
        let amp = 30 * Math.sin(t * 0.05); // pulsing amplitude
        
        for(let i=0; i<refCanvas.width; i+=4) {
            let y = refCanvas.height / 2 + Math.sin(i * freq + t * 0.1) * amp * Math.cos(i*0.01) + Math.sin(i * 0.02 - t*0.05)*15;
            refCtx.lineTo(i, y);
        }
        refCtx.strokeStyle = '#d4af37'; // Warm Gold
        refCtx.lineWidth = 3;
        refCtx.lineCap = 'round';
        refCtx.lineJoin = 'round';
        refCtx.stroke();
        
        t++;
        requestAnimationFrame(drawRefSim);
    }
    drawRefSim();
});

// Live Visualizer Engine
function startVisualizer() {
    function draw() {
        if (!isRecording) {
            liveCtx.clearRect(0,0, liveCanvas.width, liveCanvas.height);
            return;
        }
        requestAnimationFrame(draw);
        
        analyser.getByteTimeDomainData(dataArray);
        
        liveCtx.fillStyle = 'rgba(0,0,0,0.15)';
        liveCtx.fillRect(0, 0, liveCanvas.width, liveCanvas.height);
        
        liveCtx.lineWidth = 3;
        liveCtx.strokeStyle = '#faeedd'; // Ivory cream for live input
        liveCtx.lineCap = 'round';
        liveCtx.lineJoin = 'round';
        
        liveCtx.beginPath();
        
        let sliceWidth = liveCanvas.width * 1.0 / analyser.frequencyBinCount;
        let x = 0;
        
        for (let i = 0; i < analyser.frequencyBinCount; i++) {
            let v = dataArray[i] / 128.0; // 0 to 2
            
            // smooth out to center
            let y = v * liveCanvas.height / 2;
            
            if (i === 0) {
                liveCtx.moveTo(x, y);
            } else {
                // simple curve smoothing for a more elegant look
                liveCtx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        liveCtx.stroke();
    }
    draw();
}

// Simulate Pitch Detection & Feedback Engine
function startPracticeSimulation() {
    let accSum = 0;
    let ticks = 0;
    
    accuracyValEl.textContent = '0';
    accuracyValEl.className = 'text-primary';
    
    practiceTimer = setInterval(() => {
        if(!isRecording) return;
        
        // Volume check to ensure user is blowing/drawing
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) {
            sum += Math.abs(dataArray[i] - 128);
        }
        let volume = sum / dataArray.length;
        
        if (volume < 2) {
            detectedNoteEl.textContent = '--';
            pitchStatus.textContent = 'Blow or Draw...';
            pitchStatus.className = 'status-text text-muted';
            meterNeedle.style.left = '50%';
            meterNeedle.style.background = 'var(--text-muted)';
            meterNeedle.style.boxShadow = 'none';
            return;
        }
        
        const randIndex = Math.floor(Math.random() * noteNames.length);
        
        detectedNoteEl.textContent = noteNames[randIndex];
        
        // Simulate meter movement (40% to 60% is perfect green zone)
        let meterPos = 15 + Math.random() * 70; // 15 to 85%
        meterNeedle.style.left = `${meterPos}%`;
        
        ticks++;
        
        if (meterPos >= 42 && meterPos <= 58) {
            // Perfect Note
            pitchStatus.textContent = 'Perfect Pitch!';
            pitchStatus.className = 'status-text text-success';
            detectedNoteEl.style.color = 'var(--success)';
            detectedNoteEl.style.textShadow = '0 0 25px rgba(102, 187, 106, 0.4)';
            meterNeedle.style.background = 'var(--success)';
            meterNeedle.style.boxShadow = '0 0 10px var(--success)';
            accSum += 100;
        } else if (meterPos >= 30 && meterPos <= 70) {
            // slightly off / bending
            pitchStatus.textContent = 'Slightly Bending';
            pitchStatus.className = 'status-text text-primary';
            detectedNoteEl.style.color = 'var(--primary)';
            detectedNoteEl.style.textShadow = '0 0 25px var(--primary-glow)';
            meterNeedle.style.background = 'var(--primary)';
            meterNeedle.style.boxShadow = '0 0 10px var(--primary-glow)';
            accSum += 75;
        } else {
            // wrong
            pitchStatus.textContent = 'Adjust Embouchure';
            pitchStatus.className = 'status-text text-error';
            detectedNoteEl.style.color = 'var(--error)';
            detectedNoteEl.style.textShadow = '0 0 25px rgba(239, 83, 80, 0.3)';
            meterNeedle.style.background = 'var(--error)';
            meterNeedle.style.boxShadow = '0 0 10px var(--error)';
            accSum += 40;
            
            // Soft shake purely for feedback
            document.querySelector('.note-detector').animate([
                { transform: 'translateX(0px)' },
                { transform: 'translateX(-3px)' },
                { transform: 'translateX(3px)' },
                { transform: 'translateX(0px)' }
            ], { duration: 300 });
        }
        
        // Update avg accuracy
        let currentAvg = Math.floor(accSum / ticks);
        accuracyValEl.textContent = currentAvg;
        
        // Update Musical AI Feedback
        if(currentAvg >= 85) {
            aiSuggestion.innerHTML = 'Beautiful tone! Your single-note playing is extremely clean.<br><span class="text-success font-bold mt-2">Maintain this steady airflow.</span>';
        } else if (currentAvg >= 65) {
            aiSuggestion.innerHTML = 'You are getting a slight bend on the draw.<br><span class="text-primary font-bold mt-2">Tilt the harmonica slightly upwards to clear up the hole.</span>';
        } else {
            aiSuggestion.innerHTML = 'Your tone is a bit muddy; multiple reeds are vibrating.<br><span class="text-error font-bold mt-2">Deepen your embouchure. Bring the harmonica deeper into your mouth.</span>';
        }
        
    }, 1000); // Pulse every second
}

// LISTEN & MATCH Feature Logic
btnLmListen.addEventListener('click', () => {
    btnLmListen.disabled = true;
    lmResultContainer.classList.add('hidden');
    
    // Play a synthetic harmonica note sequence (Web Audio API synthetic)
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const now = audioCtx.currentTime;
    // Create an oscillator that sounds somewhat reedy/harmonica-like
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth'; // Sawtooth gives a bright, reedy sound
    
    // Frequencies for a simple lick (C4, E4, G4)
    osc.frequency.setValueAtTime(261.63, now); // C
    osc.frequency.setValueAtTime(329.63, now + 0.5); // E
    osc.frequency.setValueAtTime(392.00, now + 1.0); // G
    
    // Envelope to soften the attack / release to simulate breath
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gainNode.gain.setValueAtTime(0.4, now + 0.4);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
    
    gainNode.gain.setValueAtTime(0, now + 0.5);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.6);
    gainNode.gain.setValueAtTime(0.5, now + 0.9);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.0);
    
    gainNode.gain.setValueAtTime(0, now + 1.0);
    gainNode.gain.linearRampToValueAtTime(0.6, now + 1.1);
    gainNode.gain.setValueAtTime(0.6, now + 1.6);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.8);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 2.0);
    
    setTimeout(() => {
        btnLmListen.disabled = false;
    }, 2000);
});

btnLmPlay.addEventListener('click', () => {
    // Simulate recording for matching
    btnLmPlay.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade"></i> Recording...';
    btnLmPlay.disabled = true;
    btnLmListen.disabled = true;
    lmResultContainer.classList.add('hidden');
    
    setTimeout(() => {
        // Stop recording
        btnLmPlay.innerHTML = '<i class="fa-solid fa-microphone"></i> Your Turn';
        btnLmPlay.disabled = false;
        btnLmListen.disabled = false;
        
        // Generate Match Score
        const matchScore = Math.floor(Math.random() * 40) + 55; // 55% to 95%
        
        lmScore.textContent = `${matchScore}%`;
        
        if (matchScore >= 90) {
            lmScore.className = 'match-score text-success';
            lmFeedback.textContent = "Perfect match! Your ear is developing wonderfully.";
        } else if (matchScore >= 75) {
            lmScore.className = 'match-score text-primary';
            lmFeedback.textContent = "Great job! A little sharper on the last note.";
        } else {
            lmScore.className = 'match-score text-error';
            lmFeedback.textContent = "Needs improvement. Try listening closely to the rhythm.";
        }
        
        lmResultContainer.classList.remove('hidden');
    }, 3000); // 3 seconds "recording"
});
