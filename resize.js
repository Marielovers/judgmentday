function resizeGame() {
    const viewport = document.getElementById('game-viewport');
    
    const baseW = 1600;
    const baseH = 900;
    
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    
    const scaleW = winW / baseW;
    const scaleH = winH / baseH;
    
    const finalScale = Math.min(scaleW, scaleH);

    viewport.style.transform = `translate(-50%, -50%) scale(${finalScale})`;
}

window.addEventListener('resize', resizeGame);
resizeGame();