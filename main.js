
let API_KEYS_LIST = [];
const CHOSEONG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHO_SIMILARITY = {
    'ㄱ': ['ㄱ', 'ㄲ', 'ㅋ'], 'ㄴ': ['ㄴ'], 'ㄷ': ['ㄷ', 'ㄸ', 'ㅌ'],
    'ㄹ': ['ㄹ'], 'ㅁ': ['ㅁ'], 'ㅂ': ['ㅂ', 'ㅃ', 'ㅍ'],
    'ㅅ': ['ㅅ', 'ㅆ'], 'ㅇ': ['ㅇ'], 'ㅈ': ['ㅈ', 'ㅉ', 'ㅊ'], 'ㅎ': ['ㅎ']
};
const JUNG_SIMILARITY = {
    'ㅏ': ['ㅏ', 'ㅑ'], 'ㅓ': ['ㅓ', 'ㅕ'], 'ㅗ': ['ㅗ', 'ㅛ'],
    'ㅜ': ['ㅜ', 'ㅠ'], 'ㅣ': ['ㅣ', 'ㅐ', 'ㅔ', 'ㅒ', 'ㅖ'], 'ㅡ': ['ㅡ']
};
const CHO_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];

function decompose(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null;
    return { cho: Math.floor(code / 588), jung: Math.floor((code % 588) / 28), jong: code % 28 };
}

function getSimilarityScore(target, candidate) {
    const t = decompose(target);
    const c = decompose(candidate);
    if (!t || !c) return -1;
    let score = 0;
    if (t.cho === c.cho) score += 100;
    else if (CHO_SIMILARITY[CHO_LIST[t.cho]]?.includes(CHO_LIST[c.cho])) score += 50;
    if (t.jung === c.jung) score += 30;
    else if (JUNG_SIMILARITY[JUNG_LIST[t.jung]]?.includes(JUNG_LIST[c.jung])) score += 15;
    if (t.jong === c.jong) score += 5;
    return score;
}

class VoiceEngine {
    constructor() { this.ctx = null; this.masterGain = null; this.audioBuffers = {}; this.spriteData = {}; }
    async init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            if(ui.sliders.tts) this.masterGain.gain.value = parseFloat(ui.sliders.tts.value);
        }
    }
    async preloadVoices(charName) {
        await this.init();
        if (this.audioBuffers[charName]) return;
        try {
            const jsonRes = await fetch(`voices/${charName}.json`);
            if (jsonRes.ok) this.spriteData[charName] = await jsonRes.json();
            const audioRes = await fetch(`voices/${charName}.ogg`);
            if (audioRes.ok) {
                const arrayBuffer = await audioRes.arrayBuffer();
                this.audioBuffers[charName] = await this.ctx.decodeAudioData(arrayBuffer);
            }
        } catch (e) {}
    }
    convertNumbersToHangul(text) {
        const numMap = {'0':'영','1':'일','2':'이','3':'삼','4':'사','5':'오','6':'육','7':'칠','8':'팔','9':'구'};
        return text.split('').map(c => numMap[c] || c).join('');
    }
    findBestMatch(targetChar, availableSyllables) {
        const candidates = Object.keys(availableSyllables);
        if (candidates.length === 0) return null;
        let bestScore = -1, bestMatch = null;
        for (const char of candidates) {
            const score = getSimilarityScore(targetChar, char);
            if (score > bestScore) { bestScore = score; bestMatch = char; }
            else if (score === bestScore && score > 0 && Math.random() > 0.5) bestMatch = char;
        }
        return bestScore >= 50 ? bestMatch : null;
    }
    async playSpeech(charName, text) {
        await this.init();
        if (!this.audioBuffers[charName] || !this.spriteData[charName]) await this.preloadVoices(charName);
        const buffer = this.audioBuffers[charName], sprites = this.spriteData[charName] || {};
        text = this.convertNumbersToHangul(text);
        let relativeTime = 0.05, timings = [];
        for (const char of text) {
            timings.push(relativeTime);
            if ([' ', '\n', '.', ',', '!', '?', '~'].includes(char)) { relativeTime += 0.08; continue; }
            let spriteArray = sprites[char] || sprites[this.findBestMatch(char, sprites)];
            if (spriteArray && spriteArray.length > 0 && buffer) {
                const variant = spriteArray[Math.floor(Math.random() * spriteArray.length)];
                const startTime = variant.start_ms / 1000, duration = Math.max(0.05, variant.duration_ms / 1000);
                const src = this.ctx.createBufferSource();
                src.buffer = buffer;
                const fadeNode = this.ctx.createGain();
                fadeNode.connect(this.masterGain);
                src.connect(fadeNode);
                const playTime = this.ctx.currentTime + relativeTime;
                fadeNode.gain.setValueAtTime(0, playTime);
                fadeNode.gain.linearRampToValueAtTime(1, playTime + 0);
                src.start(playTime, startTime, duration);
                relativeTime += duration;
            } else relativeTime += 0.08;
        }
        return timings;
    }
}
const ttsEngine = new VoiceEngine();
const ui = {
    panel: { config: document.getElementById("config-panel"), court: document.getElementById("court-panel") },
    btn: { start: document.getElementById("start-btn"), end: document.getElementById("end-btn"), live: document.getElementById("live-evidence-btn") },
    inputs: { topic: document.getElementById("trial-topic"), api: document.getElementById("custom-api-key"), live: document.getElementById("live-evidence-input") },
    selects: { judge: document.getElementById("select-judge"), pros: document.getElementById("select-prosecutor"), law: document.getElementById("select-lawyer"), det: document.getElementById("select-detective") },
    sub: { name: document.getElementById("speaker-name"), text: document.getElementById("speech-text") },
    obj: { popup: document.getElementById("objection-popup"), text: document.getElementById("objection-text"), flash: document.getElementById("flash-overlay") },
    img: { judge: document.getElementById("judge-img"), pros: document.getElementById("prosecutor-img"), law: document.getElementById("lawyer-img"), wit: document.getElementById("witness-img") },
    wrap: { wit: document.getElementById("witness-wrapper"), liveGroup: document.getElementById("live-intervention-group") },
    sliders: { bgm: document.getElementById("vol-bgm"), sfx: document.getElementById("vol-sfx"), tts: document.getElementById("vol-tts") }
};
let trialHistory = [], judgeLines = {}, currentEmotions = { judge: "Idle", pros: "Idle", law: "Idle", wit: "Idle" }, currentActors = { judge: "", pros: "", law: "", wit: "" };
const sfx = { gavel: new Audio('sfx/gavel.wav'), obj: new Audio('sfx/objection.wav'), thump: new Audio('sfx/thump.wav') };
const bgm = { Moderato: new Audio('sfx/Moderato.mp3'), Comedy: new Audio('sfx/Comedy.mp3'), Allegro: new Audio('sfx/Allegro.mp3'), Objection: new Audio('sfx/Objection.mp3'), Verdict: new Audio('sfx/Verdict.mp3'), Pursuit: new Audio('sfx/Pursuit.mp3') };
let currentBgm = null;
function playBGM(t) { if (currentBgm) { currentBgm.pause(); currentBgm.currentTime = 0; } if (bgm[t]) { currentBgm = bgm[t]; currentBgm.loop = true; currentBgm.volume = parseFloat(ui.sliders.bgm.value); currentBgm.play().catch(()=>{}); } }
function stopBGM() { if (currentBgm) { currentBgm.pause(); currentBgm.currentTime = 0; currentBgm = null; } }

async function callGemini(sys, usr) {
    const emotionInstruction = "\n[지시] emotions 객체에 모든 등장인물의 표정을 지정하세요 (Idle, Panic, Sad, Angry, Happy).";
    const requestBody = { contents: [{ parts: [{ text: usr }] }], systemInstruction: { parts: [{ text: sys + emotionInstruction }] }, generationConfig: { responseMimeType: "application/json" } };
    
    const keys = ui.inputs.api.value.trim() ? [ui.inputs.api.value.trim()] : API_KEYS_LIST;
    for (let key of keys) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
            if (res.ok) return JSON.parse((await res.json()).candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, ''));
        } catch (e) { continue; }
    }
    return { text: "통신 실패", emotions: { judge: "Idle", pros: "Idle", law: "Idle", wit: "Idle" } };
}

async function playSpeech(role, charName, text, emotionsObj) {
    if (emotionsObj) currentEmotions = { ...currentEmotions, ...emotionsObj };
    let target = role === "판사" ? "judge" : role === "검사" ? "pros" : role === "변호사" ? "law" : "wit";
    if (role === "증인") { currentActors.wit = charName; ui.wrap.wit.style.display = "block"; }
    
    const updateImg = (img, c, e) => { if (c) img.src = `images/${c}_${e}.gif`; };
    updateImg(ui.img.judge, currentActors.judge, currentEmotions.judge);
    updateImg(ui.img.pros, currentActors.pros, currentEmotions.pros);
    updateImg(ui.img.law, currentActors.law, currentEmotions.law);
    updateImg(ui.img.wit, currentActors.wit, currentEmotions.wit);
    
    ui.sub.name.innerText = `${role} (${charName})`; ui.sub.text.textContent = "";
    const img = ui.img[target]; img.classList.add("talking");
    const timings = await ttsEngine.playSpeech(charName, text);
    const startTime = performance.now();
    return new Promise(res => {
        let i = 0;
        function typeCheck() {
            const now = (performance.now() - startTime) / 1000;
            while (i < text.length && now >= timings[i]) { ui.sub.text.textContent += text.charAt(i); i++; }
            if (i < text.length) requestAnimationFrame(typeCheck);
            else { img.classList.remove("talking"); setTimeout(res, 2000); }
        }
        requestAnimationFrame(typeCheck);
    });
}

function playObj(role, txt) {
    ui.obj.text.innerText = txt; ui.obj.popup.style.display = "block"; ui.obj.flash.style.opacity = 1;
    if (sfx.obj) { sfx.obj.currentTime = 0; sfx.obj.play().catch(()=>{}); }
    setTimeout(() => { ui.obj.popup.style.display = "none"; ui.obj.flash.style.opacity = 0; }, 1200);
}

function playVerdictText(txt) {
    ui.obj.text.innerText = txt; ui.obj.popup.style.display = "block";
    if (sfx.thump) sfx.thump.play().catch(()=>{});
    setTimeout(() => ui.obj.popup.style.display = "none", 1500);
}

async function startCourt() {
    ui.panel.config.style.display = "none"; ui.panel.court.style.display = "block";
    await runTrial();
}

async function runTrial() {
    const { judge, pros, law, det } = { judge: ui.selects.judge.value, pros: ui.selects.pros.value, law: ui.selects.law.value, det: ui.selects.det.value };
    currentActors = { judge, pros, law, wit: "" };
    const getP = (n) => typeof PERSONAS !== 'undefined' ? PERSONAS[n] : "";
    
    const jRes = await callGemini(getP(judge), `쟁점("${ui.inputs.topic.value}") 브리핑.`);
    judgeLines = { intro: jRes.verdict_intro, success: jRes.reverse_success, fail: jRes.reverse_fail };
    
    await playSpeech("판사", judge, jRes.text, jRes.emotions);
    
    for (let i = 0; i < 2; i++) {
        const pRes = await callGemini(getP(pros), `검사 논리`);
        playObj("검사", "변론 개시!"); await playSpeech("검사", pros, pRes.text, pRes.emotions);
        if (pRes.summoned_character && pRes.summoned_character !== "없음") {
            const wRes = await callGemini(getP(pRes.summoned_character), "증언");
            await playSpeech("증인", pRes.summoned_character, wRes.text, wRes.emotions);
            ui.wrap.wit.style.display = "none";
        }
        const lRes = await callGemini(getP(law), `변호사 반론`);
        playObj("변호사", "이의 있음!"); await playSpeech("변호사", law, lRes.text, lRes.emotions);
        if (lRes.summoned_character && lRes.summoned_character !== "없음") {
            const wRes = await callGemini(getP(lRes.summoned_character), "증언");
            await playSpeech("증인", lRes.summoned_character, wRes.text, wRes.emotions);
            ui.wrap.wit.style.display = "none";
        }
    }
    
    const vRes = await callGemini(getP(judge), "최종 판결");
    await playSpeech("판사", judge, vRes.text, vRes.emotions);
    playVerdictText(vRes.winner === "검사" ? "유죄" : "무죄");
    
    if (vRes.summoned_character && PERSONAS[vRes.summoned_character]) {
        const isWinner = (vRes.winner === "검사" && (vRes.summoned_character === pros || vRes.summoned_character !== law)) || 
                         (vRes.winner === "변호사" && (vRes.summoned_character === law || vRes.summoned_character !== pros));
        const res = await callGemini(getP(vRes.summoned_character), isWinner ? "승리 반응" : "패배 반응");
        await playSpeech("당사자", vRes.summoned_character, res.text, res.emotions);
    }

    if (Math.random() < 0.3) {
        const loser = vRes.winner === "검사" ? law : pros;
        playObj(loser, "잠깐!!");
        const rRes = await callGemini(getP(loser), "역전 발언");
        await playSpeech(loser === pros ? "검사" : "변호사", loser, rRes.text, rRes.emotions);
        
        const fRes = await callGemini(getP(judge), "역전 판결");
        await playSpeech("판사", judge, fRes.text, fRes.emotions);
        playVerdictText(fRes.is_reversed ? "판결 번복" : "기각");
    }
}
