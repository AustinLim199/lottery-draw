// Import confetti library
import confetti from 'https://cdn.skypack.dev/canvas-confetti';

class LotteryDraw {
    constructor() {
        this.drawBtn = document.getElementById('drawBtn');
        this.participants = document.querySelectorAll('.participant-card');
        this.nameDisplay = document.getElementById('nameDisplay');
        this.currentName = document.getElementById('currentName');
        this.container = document.querySelector('.participants-container');
        this.isDrawing = false;
        this.currentAnimation = null;
        this.drawCountDisplay = document.getElementById('drawCountDisplay');
        this.totalDraws = 35;
        
        // Initialize modals
        this.winnerModal = new bootstrap.Modal(document.getElementById('winnerModal'), {
            backdrop: 'static',
            keyboard: false
        });
        this.grandFinaleModal = new bootstrap.Modal(document.getElementById('grandFinaleModal'));
        
        // Initialize buttons
        this.markAbsentBtn = document.getElementById('markAbsentBtn');
        this.acceptRewardBtn = document.getElementById('acceptRewardBtn');
        
        // Verify initialization
        if (!this.container) {
            console.error('Participants container not found');
        }
        if (this.participants.length === 0) {
            console.error('No participant cards found');
        }
        if (!this.markAbsentBtn || !this.acceptRewardBtn) {
            console.error('Winner action buttons not found');
        }
        if (!this.nameDisplay || !this.currentName) {
            console.error('Name display elements not found');
        }
        
        // Add prize status elements
        this.currentPrizeType = document.getElementById('currentPrizeType');
        this.smallPrizeCount = document.getElementById('smallPrizeCount');
        this.mediumPrizeCount = document.getElementById('mediumPrizeCount');
        this.bigPrizeCount = document.getElementById('bigPrizeCount');
        
        // Track current winner
        this.currentWinner = null;
        
        // Initialize absent participants set
        this.absentParticipants = new Set();
        
        // Initialize available participants array
        this.updateAvailableParticipants();
        
        // Add header scroll handling
        this.header = document.querySelector('.app-header');
        window.addEventListener('scroll', () => this.handleHeaderScroll());
        
        // Add reset button
        this.resetBtn = document.getElementById('resetBtn');
        
        // Add celebration sound
        this.grandFinaleSound = new Audio('/static/sounds/celebration.mp3');
        
        // Initialize draw counter
        this.drawCounter = document.getElementById('drawCounter');
        
        // Setup all event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadPreviousWinners();
        this.loadAbsentParticipants();
    }

    setupEventListeners() {
        // Draw button
        this.drawBtn.addEventListener('click', () => this.startDraw());
        
        // Winner action buttons
        if (this.markAbsentBtn) {
            this.markAbsentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAbsentWinner();
            });
        }
        
        if (this.acceptRewardBtn) {
            this.acceptRewardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAcceptWinner();
            });
        }
        
        // Reset button
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.confirmReset());
        }
    }

    async handleAbsentWinner() {
        if (!this.currentWinner) {
            console.error('No current winner to mark as absent');
            return;
        }
        
        try {
            const response = await fetch(`/mark-absent/${this.currentWinner.id}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Mark participant as absent in UI
            const card = document.querySelector(`[data-id="${this.currentWinner.id}"]`);
            if (card) {
                card.classList.add('absent');
                this.absentParticipants.add(parseInt(this.currentWinner.id));
            }
            
            // Close modal and reset UI
            this.winnerModal.hide();
            this.currentWinner = null;
            this.resetUI();
            
        } catch (error) {
            console.error('Error marking participant as absent:', error);
            alert('Failed to mark participant as absent. Please try again.');
        }
    }

    async handleAcceptWinner() {
        if (!this.currentWinner) {
            console.error('No current winner to accept');
            return;
        }
        
        try {
            const response = await fetch(`/accept-winner/${this.currentWinner.id}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update prize status and draw count
            if (data.prizeStatus) {
                this.updatePrizeStatus(data.prizeStatus);
            }
            if (data.drawCount) {
                this.updateDrawCount(data.drawCount);
            }
            
            // Mark winner in UI
            this.markWinner(this.currentWinner.id);
            
            // Close modal and reset UI
            this.winnerModal.hide();
            this.currentWinner = null;
            
        } catch (error) {
            console.error('Error accepting winner:', error);
            alert('Failed to record winner. Please try again.');
        }
    }

    async showWinnerCelebration(winner, drawCount) {
        console.log('Draw count:', drawCount); // Debug log
        
        // Store current winner for absent/accept handling
        this.currentWinner = winner;
        
        // Check if this is the final draw (35th draw)
        if (drawCount === 34) {
            console.log('Showing grand finale celebration'); // Debug log
            await this.showGrandFinaleCelebration(winner);
        } else {
            // Regular winner celebration
            document.getElementById('winnerPhoto').src = `/static/images/${winner.photo}`;
            document.getElementById('winnerName').textContent = winner.name;
            
            if (winner.prizeStatus) {
                this.updatePrizeStatus(winner.prizeStatus);
            }
            
            const winnerCard = Array.from(this.participants)
                .find(card => card.dataset.id === String(winner.id));
            
            if (winnerCard) {
                const previousWinner = document.querySelector('.final-selection');
                if (previousWinner && previousWinner !== winnerCard) {
                    previousWinner.classList.remove('final-selection');
                }
                
                winnerCard.classList.add('final-selection');
                winnerCard.classList.remove('previous-winner');
                
                winnerCard.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }
            
            this.shootConfetti();
            this.playCelebrationSound();
            
            // Show modal
            this.winnerModal.show();
        }
    }

    async startDraw() {
        if (this.isDrawing) return;
        
        try {
            this.isDrawing = true;
            this.drawBtn.disabled = true;
            
            // Reset previous winner animations before new draw
            const previousWinner = document.querySelector('.final-selection');
            if (previousWinner) {
                previousWinner.classList.remove('final-selection');
                previousWinner.classList.add('previous-winner');
            }
            
            // Clear any existing highlights
            this.clearPreviousAnimation();
            
            // Get winner from backend
            const response = await fetch('/draw', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Draw response:', data); // Debug log
            
            if (!data.winner || !data.winner.id) {
                throw new Error('Invalid winner data received');
            }

            // Update draw count display
            this.updateDrawCount(data.draw_count);

            // Run selection animation
            await this.animateSelection(data.winner);
            
            // Brief pause after animation
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Show celebration
            await this.showWinnerCelebration(data.winner, data.draw_count);
            
        } catch (error) {
            console.error('Draw error:', error);
            this.handleError(error);
        } finally {
            this.isDrawing = false;
            this.drawBtn.disabled = false;
            this.resetUI();
        }
    }

    clearPreviousAnimation() {
        // Remove highlight from all cards
        this.participants.forEach(card => {
            card.classList.remove('highlight');
        });
        
        // Remove selection-active class from container
        this.container.classList.remove('selection-active');
    }

    updateAvailableParticipants() {
        // Get all participants except previous winners
        this.availableParticipants = Array.from(this.participants)
            .filter(card => !card.classList.contains('previous-winner') && 
                           !card.classList.contains('final-selection'));
    }

    async animateSelection(winner) {
        return new Promise((resolve, reject) => {
            try {
                const duration = 5000;
                const startTime = performance.now();
                const winnerIndex = Array.from(this.participants)
                    .findIndex(el => el.dataset.id === String(winner.id));
                
                if (winnerIndex === -1) {
                    throw new Error('Winner not found in participants');
                }

                // Update available participants before starting animation
                this.updateAvailableParticipants();
                
                // Show name display at start of animation
                if (this.nameDisplay) {
                    this.nameDisplay.classList.add('active');
                }
                this.container.classList.add('selection-active');
                
                const animate = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    
                    // Remove previous highlight
                    const highlighted = document.querySelector('.participant-card.highlight');
                    if (highlighted) highlighted.classList.remove('highlight');
                    
                    let currentIndex;
                    if (progress >= 0.95) {
                        // Final selection - show winner
                        currentIndex = winnerIndex;
                        const winnerCard = this.participants[currentIndex];
                        winnerCard.classList.add('highlight', 'final-selection');
                        if (this.currentName) {
                            this.currentName.textContent = winnerCard.dataset.name;
                        }
                        
                        if (progress >= 1) {
                            setTimeout(() => {
                                if (this.nameDisplay) {
                                    this.nameDisplay.classList.remove('active');
                                }
                                this.container.classList.remove('selection-active');
                            }, 1000);
                            return resolve();
                        }
                    } else {
                        // Only select from available (non-winner) participants
                        if (this.availableParticipants.length > 0) {
                            // Get random available participant
                            const randomIndex = Math.floor(Math.random() * this.availableParticipants.length);
                            const selectedCard = this.availableParticipants[randomIndex];
                            
                            // Only highlight if not a previous winner
                            if (!selectedCard.classList.contains('previous-winner')) {
                                selectedCard.classList.add('highlight');
                                if (this.currentName) {
                                    this.currentName.textContent = selectedCard.dataset.name;
                                }
                                
                                // Play tick sound for each selection
                                this.playTickSound();
                            }
                        }
                    }
                    
                    // Adjust animation speed
                    const speed = progress < 0.5 ? 50 : 
                                 progress < 0.8 ? 100 : 
                                 progress < 0.95 ? 200 : 300;
                    
                    this.currentAnimation = setTimeout(() => {
                        requestAnimationFrame(animate);
                    }, speed);
                };
                
                requestAnimationFrame(animate);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    handleError(error) {
        // Reset UI
        this.clearPreviousAnimation();
        
        // Show user-friendly error message
        alert('Sorry, something went wrong with the draw. Please try again.');
        
        // Log detailed error
        console.error('Detailed error:', error);
    }

    resetUI() {
        // Clear any ongoing animations
        if (this.currentAnimation) {
            clearTimeout(this.currentAnimation);
            this.currentAnimation = null;
        }
        
        // Reset button state
        this.drawBtn.disabled = false;
        
        // Clear highlights if any remain
        this.clearPreviousAnimation();
    }

    updatePrizeStatus(prizeStatus) {
        this.currentPrizeType.textContent = prizeStatus.currentType;
        this.smallPrizeCount.textContent = 
            `${prizeStatus.remaining.small}/${prizeStatus.total.small}`;
        this.mediumPrizeCount.textContent = 
            `${prizeStatus.remaining.medium}/${prizeStatus.total.medium}`;
        this.bigPrizeCount.textContent = 
            `${prizeStatus.remaining.big}/${prizeStatus.total.big}`;
    }

    markWinner(winnerId) {
        const winnerCard = Array.from(this.participants)
            .find(card => card.dataset.id === String(winnerId));
        if (winnerCard) {
            winnerCard.classList.add('previous-winner');
            // Update available participants after marking a winner
            this.updateAvailableParticipants();
        }
    }

    async showGrandFinaleCelebration(winner) {
        console.log('Starting grand finale celebration'); // Debug log
        
        // Clear any existing sparkle effects
        const existingSparkle = document.querySelector('.sparkle');
        if (existingSparkle) {
            existingSparkle.remove();
        }
        
        // Find and prepare winner card
        const winnerCard = document.querySelector(`[data-id="${winner.id}"]`);
        if (winnerCard) {
            // Remove any existing winner classes
            document.querySelectorAll('.final-selection, .grand-winner').forEach(el => {
                el.classList.remove('final-selection', 'grand-winner');
            });
            
            // Add grand winner classes
            winnerCard.classList.add('final-selection', 'grand-winner');
            
            // Scroll to winner with delay for dramatic effect
            setTimeout(() => {
                winnerCard.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }, 500);
        }
        
        // Update modal content
        document.getElementById('grandWinnerPhoto').src = `/static/images/${winner.photo}`;
        document.getElementById('grandWinnerName').textContent = winner.name;
        
        // Start celebrations
        this.addSparkleEffect();
        this.shootGrandFinaleConfetti();
        
        // Play special sound
        try {
            await this.grandFinaleSound.play();
        } catch (error) {
            console.log('Sound autoplay blocked or error:', error);
        }
        
        // Show modal with delay for effects to start
        setTimeout(() => {
            this.grandFinaleModal.show();
        }, 800);
    }

    addSparkleEffect() {
        const sparkleContainer = document.createElement('div');
        sparkleContainer.className = 'sparkle';
        
        // Add more sparkles for greater effect
        for (let i = 0; i < 40; i++) { // Increased from 20 to 40
            const sparkle = document.createElement('span');
            sparkle.style.left = `${Math.random() * 100}%`;
            sparkle.style.top = `${Math.random() * 100}%`;
            sparkle.style.animationDelay = `${Math.random() * 1}s`;
            sparkle.style.width = `${Math.random() * 4 + 2}px`; // Varied sizes
            sparkle.style.height = sparkle.style.width;
            sparkleContainer.appendChild(sparkle);
        }
        
        document.querySelector('.grand-finale').appendChild(sparkleContainer);
    }

    shootGrandFinaleConfetti() {
        const duration = 8000; // Increased duration to 8 seconds
        const animationEnd = Date.now() + duration;
        const defaults = { 
            startVelocity: 45, // Increased velocity
            spread: 360,
            ticks: 60,
            zIndex: 0,
            shapes: ['square', 'circle'],
            colors: ['#ffd700', '#ff0000', '#00ff00', '#0000ff', '#ffffff']
        };

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 100 * (timeLeft / duration); // Doubled particle count
            
            // Multiple confetti bursts from different angles
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: 0.5, y: Math.random() - 0.2 }
            });
        }, 200);
    }

    randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    shootConfetti() {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        let frame;
        
        const animate = () => {
            const timeLeft = animationEnd - Date.now();
            
            if (timeLeft <= 0) {
                cancelAnimationFrame(frame);
                return;
            }
            
            const particleCount = Math.floor(50 * (timeLeft / duration));
            
            // Shoot confetti from multiple angles
            requestAnimationFrame(() => {
                confetti({
                    ...this.confettiDefaults,
                    particleCount,
                    origin: { x: 0.2, y: 0.5 }
                });
                confetti({
                    ...this.confettiDefaults,
                    particleCount,
                    origin: { x: 0.8, y: 0.5 }
                });
            });
            
            frame = requestAnimationFrame(animate);
        };
        
        frame = requestAnimationFrame(animate);
        
        // Cleanup
        setTimeout(() => {
            cancelAnimationFrame(frame);
        }, duration);
    }

    playTickSound() {
        if (!this.tickSound) {
            this.tickSound = new Audio('/static/sounds/tick.mp3');
            this.tickSound.volume = 0.2;
        }
        this.tickSound.currentTime = 0;
        this.tickSound.play().catch(() => {});
    }

    playCelebrationSound() {
        try {
            const audio = new Audio('/static/sounds/celebration.mp3');
            audio.volume = 0.3;
            audio.play();
        } catch (error) {
            console.log('Sound playback failed:', error);
        }
    }

    handleHeaderScroll() {
        if (window.scrollY > 20) {
            this.header.classList.add('scrolled');
        } else {
            this.header.classList.remove('scrolled');
        }
    }

    async loadPreviousWinners() {
        try {
            const response = await fetch('/winners');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const winners = await response.json();
            
            // Mark each winner in the UI
            winners.forEach(winnerId => {
                this.markWinner(winnerId);
            });
            
            // Update available participants
            this.updateAvailableParticipants();
            
        } catch (error) {
            console.error('Error loading previous winners:', error);
        }
    }

    async confirmReset() {
        // Show confirmation dialog
        if (confirm('Are you sure you want to reset the draw? This will clear all winners and reset prize counts.')) {
            await this.resetDraw();
        }
    }

    async resetDraw() {
        try {
            const response = await fetch('/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Reset UI
            this.participants.forEach(card => {
                card.classList.remove('winner');
                card.style.opacity = '1';
            });
            
            // Reset prize counts
            const prizeStatus = {
                remaining: { small: 20, medium: 10, big: 5 },
                total: { small: 20, medium: 10, big: 5 },
                currentType: "SMALL"
            };
            this.updatePrizeCounts(prizeStatus);
            
            // Enable draw button if disabled
            this.drawBtn.disabled = false;
            
            // Update available participants
            this.updateAvailableParticipants();
            
            // Show success message
            alert('Draw has been reset successfully!');
            
            // Add page reload after 1.5 seconds
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (error) {
            console.error('Error resetting draw:', error);
            alert('Failed to reset draw. Please try again.');
        }
    }

    updatePrizeCounts(prizeStatus) {
        // Update prize count displays
        this.smallPrizeCount.textContent = `${prizeStatus.remaining.small}/${prizeStatus.total.small}`;
        this.mediumPrizeCount.textContent = `${prizeStatus.remaining.medium}/${prizeStatus.total.medium}`;
        this.bigPrizeCount.textContent = `${prizeStatus.remaining.big}/${prizeStatus.total.big}`;
        
        // Update current prize type
        this.currentPrizeType.textContent = prizeStatus.currentType;
    }

    // Add new method to update counter
    updateDrawCounter(remainingDraws) {
        if (this.drawCounter) {
            const remaining = this.totalDraws - remainingDraws;
            this.drawCounter.textContent = this.totalDraws - remaining;
        }
    }

    updateDrawCount(drawCount) {
        const drawCountDisplay = document.getElementById('drawCountDisplay');
        const currentDrawNumber = document.getElementById('currentDrawNumber');
        
        if (currentDrawNumber) {
            currentDrawNumber.textContent = `#${drawCount + 1}`;
            
            // Add update animation
            drawCountDisplay.classList.remove('draw-count-update');
            void drawCountDisplay.offsetWidth; // Trigger reflow
            drawCountDisplay.classList.add('draw-count-update');
        }
    }

    async loadAbsentParticipants() {
        try {
            const response = await fetch('/absent-participants');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const absentIds = await response.json();
            this.absentParticipants = new Set(absentIds);
            
            // Mark absent participants in UI
            this.absentParticipants.forEach(id => {
                const card = document.querySelector(`[data-id="${id}"]`);
                if (card) {
                    card.classList.add('absent');
                }
            });
        } catch (error) {
            console.error('Error loading absent participants:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LotteryDraw();
});
