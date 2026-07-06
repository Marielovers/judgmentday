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
const JONG_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChoseong(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null; 
    return CHOSEONG_LIST[Math.floor(code / 588)];
}

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
    constructor() { 
        this.ctx = null; 
        this.voiceDB = {}; 
        this.audioCache = {}; 
        this.masterGain = null;
    }
    async preloadVoices(charName) {
        const syllables = this.voiceDB[charName] || {};
        const promises = [];
    
        for (const char in syllables) {
            syllables[char].forEach(url => {
                promises.push(this.getAudioBuffer(url));
            });
        }
        await Promise.all(promises);
        console.log(`${charName} 음성 로딩 완료`);
    }
    async init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            if(ui.sliders.tts) this.masterGain.gain.value = parseFloat(ui.sliders.tts.value);
        }
        if (Object.keys(this.voiceDB).length === 0) {
            try { this.voiceDB = await (await fetch('voice_cache.json')).json(); } catch(e){}
        }
    }
    
    async getAudioBuffer(url) {
        if (this.audioCache[url]) return this.audioCache[url];
        try {
            const res = await fetch(url);
            if(!res.ok) return null;
            const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
            this.audioCache[url] = buf; return buf;
        } catch (e) { return null; }
    }
    
    convertNumbersToHangul(text) {
        const numMap = {'0':'영','1':'일','2':'이','3':'삼','4':'사','5':'오','6':'육','7':'칠','8':'팔','9':'구'};
        return text.split('').map(c => numMap[c] || c).join('');
    }
    
    findBestMatch(targetChar, availableSyllables) {
        const candidates = Object.keys(availableSyllables);
        if (candidates.length === 0) return null;
        let bestScore = -1;
        let bestMatch = null;
        for (const char of candidates) {
            const score = getSimilarityScore(targetChar, char);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = char;
            } else if (score === bestScore && score > 0) {
                if (Math.random() > 0.5) bestMatch = char;
            }
        }
        return bestScore >= 50 ? bestMatch : null;
    }

    findSimilarSyllable(targetChar, availableSyllables) {
        const targetCho = getChoseong(targetChar);
        if (!targetCho) return null;
        const similarChos = CHO_SIMILARITY[targetCho] || [targetCho];
        const availableKeys = Object.keys(availableSyllables);
        const candidates = availableKeys.filter(key => similarChos.includes(getChoseong(key)));
        if (candidates.length > 0) {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
        return null;
    }

    async playSpeech(charName, text, speedOption) {
        await this.init(); 
        const syllables = this.voiceDB[charName] || {};
        text = this.convertNumbersToHangul(text);
        let delayMs = 0, spaceMs = 80; 
        const fetchPromises = text.split('').map(async (char) => {
            if ([' ', '\n', '.', ',', '!', '?', '~'].includes(char)) return null;
            let wavs = syllables[char];
            if (!wavs || wavs.length === 0) {
                const bestMatch = this.findBestMatch(char, syllables);
                if (bestMatch) {
                    wavs = syllables[bestMatch];
                }
            }
            if (wavs && wavs.length > 0) {
                return await this.getAudioBuffer(wavs[Math.floor(Math.random() * wavs.length)].replace(/\\/g, '/'));
            }
            return null;
        });
        const buffers = await Promise.all(fetchPromises);
        let relativeTime = 0.05, timings = [];
        for (let buf of buffers) {
            timings.push(relativeTime);
            if (buf) {
                const src = this.ctx.createBufferSource();
                src.buffer = buf; 
                src.connect(this.masterGain);
                src.start(this.ctx.currentTime + relativeTime);
                relativeTime += buf.duration + delayMs/1000;
            } else { relativeTime += spaceMs/1000; }
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

let trialHistory = [];
let judgeLines = {}; 

const sfx = { gavel: new Audio('sfx/gavel.wav'), obj: new Audio('sfx/objection.wav'), thump: new Audio('sfx/thump.wav') };

const bgm = {
    Moderato: new Audio('sfx/Moderato.mp3'),
    Comedy: new Audio('sfx/Comedy.mp3'),
    Allegro: new Audio('sfx/Allegro.mp3'),
    Objection: new Audio('sfx/Objection.mp3'),
    Verdict: new Audio('sfx/Verdict.mp3'),
    Pursuit: new Audio('sfx/Pursuit.mp3')
};
let currentBgm = null;

function playBGM(trackName) {
    if (currentBgm) {
        currentBgm.pause();
        currentBgm.currentTime = 0;
    }
    if (bgm[trackName]) {
        currentBgm = bgm[trackName];
        currentBgm.loop = true;
        currentBgm.volume = parseFloat(ui.sliders.bgm.value);
        currentBgm.play().catch(e => console.warn(e));
    }
}

function stopBGM() {
    if (currentBgm) {
        currentBgm.pause();
        currentBgm.currentTime = 0;
        currentBgm = null;
    }
}

let appSettings = {}; 

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { 
                loadingScreen.style.display = 'none'; 
            }, 500);
        }
    }, 100);

    if (ui.btn.live) {
        ui.btn.live.addEventListener("click", () => {
            const text = ui.inputs.live.value.trim();
            if (text) {
                trialHistory.push(`[돌발 상황/실시간 증거 및 반응]: ${text} (이 내용을 즉각적으로 인지하고 발언에 반드시 엮어서 반응할 것)`);
                ui.inputs.live.value = "";
                ui.inputs.live.placeholder = "반영 성공! 추가 개입 대기 중...";
                setTimeout(() => ui.inputs.live.placeholder = "증언, 증거, 방청객 반응 추가...", 2000);
            }
        });
        ui.inputs.live.addEventListener("keypress", (e) => {
            if (e.key === "Enter") ui.btn.live.click();
        });
    }

    if (typeof AVAILABLE_CHARACTERS !== 'undefined') {
        AVAILABLE_CHARACTERS.forEach(c => {
            ui.selects.judge.add(new Option(c, c)); ui.selects.pros.add(new Option(c, c));
            ui.selects.law.add(new Option(c, c)); ui.selects.det.add(new Option(c, c));
        });
        if (AVAILABLE_CHARACTERS.includes("네르")) ui.selects.judge.value = "네르";
        if (AVAILABLE_CHARACTERS.includes("리온")) ui.selects.pros.value = "리온";
        if (AVAILABLE_CHARACTERS.includes("시온 더 다크불릿")) ui.selects.law.value = "시온 더 다크불릿";
        if (AVAILABLE_CHARACTERS.includes("영춘")) ui.selects.det.value = "영춘";
    }
    
    ui.sliders.bgm.addEventListener("input", (e) => {
        if(currentBgm) currentBgm.volume = parseFloat(e.target.value);
    });
    
    ui.sliders.sfx.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        sfx.gavel.volume = v; sfx.obj.volume = v; sfx.thump.volume = v;
    });
    
    ui.sliders.tts.addEventListener("input", (e) => {
        if(ttsEngine.masterGain) ttsEngine.masterGain.gain.value = parseFloat(e.target.value);
    });
    
    sfx.gavel.volume = parseFloat(ui.sliders.sfx.value);
    sfx.obj.volume = parseFloat(ui.sliders.sfx.value);
    sfx.thump.volume = parseFloat(ui.sliders.sfx.value);
    
    ui.btn.start.addEventListener("click", startCourt);
    ui.btn.end.addEventListener("click", () => { location.reload(); });
});

async function callGemini(sys, usr) {
    if (API_KEYS_LIST.length === 0) {
        try {
            const res = await fetch('api.txt');
            if (res.ok) {
                const text = await res.text();
                API_KEYS_LIST = text.split(/\r?\n/).map(k => k.trim()).filter(k => k.length > 0);
            }
        } catch (e) {}
    }

    const customKey = ui.inputs.api.value.trim();
    const emotionInstruction = "\n[중요] 생성하는 JSON의 emotion 필드 값은 반드시 다음 6가지 중 하나만 정확히 입력하세요: Idle, Dance, Panic, Sad, Angry, Happy";
    const finalSys = sys + emotionInstruction;
    
    const requestBody = { 
        contents: [{ parts: [{ text: usr }] }], 
        systemInstruction: { parts: [{ text: finalSys }] }, 
        generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: { 
                type: "OBJECT", 
                properties: { 
                    text: { type: "STRING" }, 
                    emotion: { type: "STRING", enum: ["Idle", "Dance", "Panic", "Sad", "Angry", "Happy"] }, 
                    summoned_character: { type: "STRING" },
                    bgm: { type: "STRING", enum: ["Moderato", "Comedy"] },
                    is_reversed: { type: "BOOLEAN" },
                    case_type: { type: "STRING", enum: ["유무죄", "논쟁"] },
                    pros_pos: { type: "STRING" },
                    law_pos: { type: "STRING" },
                    verdict_intro: { type: "STRING" },
                    reverse_success: { type: "STRING" },
                    reverse_fail: { type: "STRING" }
                }, 
                required: ["text", "emotion"] 
            } 
        } 
    };

    if (customKey) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${customKey}`, { 
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) 
            });
            if (res.ok) {
                let rawText = (await res.json()).candidates[0].content.parts[0].text;
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                return JSON.parse(rawText);
            }
        } catch (e) {
            return { text: "개인 API 키 호출에 실패했습니다!", emotion: "Panic", summoned_character: "없음", bgm: "Moderato" };
        }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
        for (let i = 0; i < API_KEYS_LIST.length; i++) {
            try {
                let decodedKey = API_KEYS_LIST[i];
                try { decodedKey = atob(decodedKey); } catch (e) {}

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${decodedKey}`, { 
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) 
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.candidates && data.candidates[0].content) {
                        let rawText = data.candidates[0].content.parts[0].text;
                        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                        return JSON.parse(rawText); 
                    }
                }
            } catch (e) {
                continue; 
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    return { text: "연결이 끊어졌습니다 교주님. 내일 오후 5시 이후에 다시 시도해주세요", emotion: "Panic", summoned_character: "영춘", bgm: "Moderato" };
}

async function playSpeech(role, charName, text, emotion) {
    ui.sub.name.innerText = `${role} (${charName})`;
    ui.sub.text.textContent = ""; 
    let target = (role === "판사" ? "judge" : (role === "검사" ? "pros" : (role === "변호사" ? "law" : "wit")));
    const img = ui.img[target];
    
    if (target === "wit") ui.wrap.wit.style.display = "block";
    
    img.onerror = () => { img.src = `images/${charName}_Idle.gif`; };
    img.src = `images/${charName}_${emotion}.gif`;
    img.classList.add("talking");
    
    const timings = await ttsEngine.playSpeech(charName, text, "매우 빠름");
    const startTime = performance.now(); 
    
    return new Promise(res => {
        let i = 0;
        function typeCheck() {
            const now = (performance.now() - startTime) / 1000;
            let typed = false;
            while (i < text.length && now >= timings[i]) {
                ui.sub.text.textContent += text.charAt(i); i++; typed = true;
            }
            if (typed) {
                ui.sub.text.scrollTop = ui.sub.text.scrollHeight;
            }
            if (i < text.length) requestAnimationFrame(typeCheck);
            else {
                img.classList.remove("talking");
                setTimeout(() => { img.src = `images/${charName}_Idle.gif`; res(); }, 800);
            }
        }
        requestAnimationFrame(typeCheck);
    });
}

function hideWitness() { ui.wrap.wit.style.display = "none"; ui.img.wit.src = ""; }

function playObj(role, txt = "이의 있음!") {
    return new Promise(res => {
        ui.obj.text.innerText = txt;
        ui.obj.text.style.color = role === "검사" ? "#5064FF" : "#E74C3C";
        ui.obj.popup.style.display = "block"; ui.obj.flash.style.opacity = 1;
        if (sfx.obj) { sfx.obj.currentTime = 0; sfx.obj.play().catch(()=>{}); }
        setTimeout(() => ui.obj.flash.style.opacity = 0, 100);
        setTimeout(() => { ui.obj.popup.style.display = "none"; res(); }, 1200);
    });
}

function playGavel(times = 1) {
    return new Promise(res => {
        let count = 0;
        const hit = () => {
            if (sfx.gavel) { sfx.gavel.currentTime = 0; sfx.gavel.play().catch(()=>{}); }
            ui.obj.flash.style.opacity = 0.5; setTimeout(() => ui.obj.flash.style.opacity = 0, 100);
            count++;
            if (count < times) setTimeout(hit, 400); else setTimeout(res, 600);
        }; hit();
    });
}

async function startCourt() {
    const topic = ui.inputs.topic.value.trim();
    if (!topic) return alert("쟁점을 입력하세요!");

    ui.wrap.liveGroup.style.display = "flex";

    appSettings = {
        topic, 
        turns: 2,               
        length: "보통",         
        speed: "매우 빠름",     
        freq: "무조건",         
        revProb: 0.05,          
        revTurns: 1,            
        r: { judge: ui.selects.judge.value, pros: ui.selects.pros.value, law: ui.selects.law.value, det: ui.selects.det.value }
    };

    ui.panel.config.style.display = "none"; ui.panel.court.style.display = "block";

    ui.img.judge.src = `images/${appSettings.r.judge}_Idle.gif`;
    ui.img.pros.src = `images/${appSettings.r.pros}_Idle.gif`;
    ui.img.law.src = `images/${appSettings.r.law}_Idle.gif`;

    await ttsEngine.init();
    try { await runTrial(); } 
    catch (e) { ui.sub.text.textContent = "치명적 오류 발생!"; }
    finally { ui.btn.end.style.display = "block"; }
}

async function runTrial() {
    const { topic, turns, length, revProb, r } = appSettings;
    const allChars = typeof AVAILABLE_CHARACTERS !== 'undefined' ? AVAILABLE_CHARACTERS.join(", ") : "없음";
    const getP = (name) => (typeof PERSONAS !== 'undefined' && PERSONAS[name]) ? PERSONAS[name] : `당신은 ${name}입니다.`;
    
    hideWitness(); trialHistory = [];
    ui.sub.name.innerText = `판사 (${r.judge})`; ui.sub.text.textContent = "재판 준비 중...";

    const jReq = `상황: 새로운 재판이 열렸습니다. 방청객들에게 쟁점("${topic}")을 소개하고 브리핑하세요. 길이는 ${length}.\n[특수 지시]\n1. 쟁점("${topic}")이 장난스럽거나 어이없는 개그 주제라면 'bgm'에 "Comedy"를, 진지하면 "Moderato"를 입력하세요.\n2. 쟁점이 범죄를 다루는 것이면 'case_type'을 "유무죄"로, 단순 가치관 대립이나 일상적 쟁점이면 "논쟁"으로 분류하세요.\n3. "논쟁"일 경우 검사 측의 입장(pros_pos)과 변호사 측의 입장(law_pos)을 각각 단어로 요약해서 적어주세요.\n4. 판사의 성격에 맞춰 다음 3가지 상황의 대사를 작성하세요:\n   - verdict_intro: 최종 판결을 내리기 직전 선언하는 대사\n   - reverse_success: 대역전 성공 시 당황하며 판결을 전면 재검토하겠다고 선언하는 대사\n   - reverse_fail: 대역전 실패 시 화를 내며 이의를 기각하는 대사`;
    
    const jRes = await callGemini(getP(r.judge), jReq);

    const caseType = jRes.case_type || "유무죄";
    const prosPos = jRes.pros_pos || "유죄";
    const lawPos = jRes.law_pos || "무죄";
    judgeLines = {
        intro: jRes.verdict_intro || "양측의 주장을 모두 검토한 결과, 다음과 같이 선고합니다!",
        success: jRes.reverse_success || "정숙! 상황이 완전히 뒤바뀌었으니 판결을 전면 재검토하겠노라!",
        fail: jRes.reverse_fail || "정숙! 억지 주장에 흔들리지 않겠다! 이의를 기각하는 바이다!"
    };

    playBGM(jRes.bgm === "Comedy" ? "Comedy" : "Moderato");
    
    await playGavel(3);
    await playSpeech("판사", r.judge, jRes.text, jRes.emotion);
    trialHistory.push(`판사(${r.judge}): ${jRes.text}`);

    for (let i = 0; i < turns; i++) {
        if (i >= 1 && turns > 2 && i < turns - 1) playBGM('Allegro');
        else if (i === turns - 1 && turns > 2) playBGM('Objection');

        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = "검사 변론 중...";
        const prosRole = caseType === "유무죄" ? "피고의 유죄를 강력히 주장하세요." : `상대방을 논파하고 '${prosPos}'의 입장을 강력히 대변하세요.`;
        const pReq = `쟁점: "${topic}"\n기록: ${JSON.stringify(trialHistory)}\n상황: ${prosRole} 길이: ${length}.\n[필수 지시] 당신의 주장을 뒷받침하거나 거짓 증언을 해줄 증인을 목록 중 무조건 1명 선택해 'summoned_character'에 적으세요. 목록: [${allChars}]`;
        const pRes = await callGemini(getP(r.pros), pReq);
        await playObj("검사", "변론 개시!");
        await playSpeech("검사", r.pros, pRes.text, pRes.emotion);
        trialHistory.push(`검사(${r.pros}): ${pRes.text}`);

        let activeWitness = (pRes.summoned_character && pRes.summoned_character !== "없음") ? pRes.summoned_character : r.det; 
        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = `증인 (${activeWitness}) 증언 중...`;
        const wPrompt1 = `쟁점: "${topic}"\n상황: 검사(${r.pros})의 요청으로 증인석에 섰습니다. 검사의 의견에 동조하며 변호사 측이 불리하도록 자신 있게 증언하세요. 길이: ${length}`;
        const wRes1 = await callGemini(getP(activeWitness), wPrompt1);
        await playSpeech("증인", activeWitness, wRes1.text, wRes1.emotion);
        trialHistory.push(`증인(${activeWitness}): ${wRes1.text}`); 
        hideWitness();

        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = "변호사 반론 중...";
        const lawRole = caseType === "유무죄" ? "피고의 무죄를 강력히 방어하세요." : `검사를 반박하고 '${lawPos}'의 입장을 강력히 대변하세요.`;
        const lReq = `쟁점: "${topic}"\n기록: ${JSON.stringify(trialHistory)}\n상황: 방금 전 검사 측과 증인이 펼친 주장의 모순을 찾아내 박살내고 ${lawRole} 길이: ${length}.`;
        const lRes = await callGemini(getP(r.law), lReq);
        await playObj("변호사", "이의 있음!");
        await playSpeech("변호사", r.law, lRes.text, lRes.emotion);
        trialHistory.push(`변호사(${r.law}): ${lRes.text}`);
    }

    stopBGM();

    ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = "최종 판결 조율 중...";
    const verdictTask = caseType === "유무죄" ? "검사 측의 승리(유죄)로 판결을 내리세요." : `재판 과정을 참고하여 '${prosPos}'의 손을 들어주는 판결을 내리세요.`;
    const vReq = `쟁점: "${topic}"\n기록: ${JSON.stringify(trialHistory)}\n상황: 양측의 주장이 끝났습니다. ${verdictTask} 길이: ${length}.\n[특수 지시] 재판 결과에 직접 영향을 받는 당사자가 있다면 다음 목록 중 1명을 'summoned_character'에 적어 판결 후 반응을 확인하세요. 딱히 없으면 '없음'이라고 적으세요. 목록: [${allChars}]`;
    const vRes = await callGemini(getP(r.judge), vReq);
    
    await playSpeech("판사", r.judge, judgeLines.intro, "Idle");
    await playGavel(3); if (sfx.thump) sfx.thump.play().catch(()=>{});
    
    playBGM('Verdict'); 
    await playSpeech("판사", r.judge, vRes.text, vRes.emotion);

    if (vRes.summoned_character && vRes.summoned_character !== "없음" && PERSONAS[vRes.summoned_character]) {
        const defName = vRes.summoned_character;
        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = `당사자 (${defName}) 반응 중...`;
        const defPrompt = `쟁점: "${topic}"\n상황: 방금 판사가 당신에게 불리한(패소/유죄) 최종 선고를 내렸습니다. 이 결과에 대한 생생한 반응을 성격에 맞게 표현하세요. 길이: ${length}`;
        const defRes = await callGemini(getP(defName), defPrompt);
        await playSpeech("피고인", defName, defRes.text, defRes.emotion);
        trialHistory.push(`피고인(${defName}): ${defRes.text}`);
        hideWitness();
    }

    if (Math.random() < revProb) {
        stopBGM(); 

        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = "대역전 이벤트 발동!";
        await playObj("변호사", "잠깐!!");
        
        playBGM('Pursuit'); 

        let lastWitness = trialHistory.find(h => h.startsWith("증인("))?.match(/\((.*?)\)/)?.[1] || r.det;
        
        const revLaw = await callGemini(getP(r.law), `상황: 선고가 났지만 당신은 방금 전 증인(${lastWitness})이 했던 증언에서 치명적인 거짓말과 모순을 발견했습니다! 결정적 증거를 들이밀며 증인을 사정없이 몰아붙이세요! 길이: ${length}`);
        await playSpeech("변호사", r.law, revLaw.text, revLaw.emotion);
        
        ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = "증인 정체 탄록 중...";
        const revWit = await callGemini(getP(lastWitness), `상황: 변호사(${r.law})가 당신의 완벽한 거짓말의 모순을 증거와 함께 폭로했습니다! 완전히 변명의 여지가 없습니다. 크게 당황하고 발악하며 자신의 죄를 자백하거나 무너지세요. 길이: ${length}`);
        await playSpeech("증인", lastWitness, revWit.text, revWit.emotion); 
        
        const revPros = await callGemini(getP(r.pros), `상황: 믿었던 증인이 거짓말을 자백하며 완벽하게 무너졌습니다. 재판이 뒤집힌 것에 절망하며 윽박지르거나 무너지세요.`);
        await playSpeech("검사", r.pros, revPros.text, revPros.emotion);
        
        const revTarget = caseType === "유무죄" ? "무죄" : lawPos;
        const revJudgeReq = `상황: 증인의 자백으로 법정이 술렁이고 있습니다! 이전에 내린 판결을 번복할지 결정해야 합니다.\n[판결 지시] 변호사의 역전 주장이 타당하다면 'is_reversed'를 true로 하고 대역전('${revTarget}' 승리) 선고를 내리세요. 만약 변호사의 주장이 억지라고 판단되면 'is_reversed'를 false로 하고 이의를 기각하여 기존 선고를 유지하세요. 길이는 ${length}.\n[특수 지시] 판결을 받고 반응할 당사자를 'summoned_character'에 적으세요. 없으면 '없음'. 목록: [${allChars}]`;
        
        const revJudge = await callGemini(getP(r.judge), revJudgeReq);
        
        stopBGM();
        await playGavel(3);

        if (revJudge.is_reversed !== false) {
            await playSpeech("판사", r.judge, judgeLines.success, "Panic");
            playBGM('Verdict'); 
            await playSpeech("판사", r.judge, revJudge.text, revJudge.emotion);

            if (revJudge.summoned_character && revJudge.summoned_character !== "없음" && PERSONAS[revJudge.summoned_character]) {
                const defName = revJudge.summoned_character;
                ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = `당사자 (${defName}) 환호 중...`;
                const defPrompt = `쟁점: "${topic}"\n상황: 대역전극이 벌어져 판사가 당신에게 유리하게 번복 선고를 내렸습니다! 기적적으로 살아난 기쁨과 감격을 성격에 맞게 표현하세요! 길이: ${length}`;
                const defRes = await callGemini(getP(defName), defPrompt);
                await playSpeech("당사자", defName, defRes.text, defRes.emotion);
                trialHistory.push(`당사자(${defName}): ${defRes.text}`);
            }
        } else {
            await playSpeech("판사", r.judge, judgeLines.fail, "Angry");
            playBGM('Verdict'); 
            await playSpeech("판사", r.judge, revJudge.text, revJudge.emotion);

            if (revJudge.summoned_character && revJudge.summoned_character !== "없음" && PERSONAS[revJudge.summoned_character]) {
                const defName = revJudge.summoned_character;
                ui.sub.name.innerText = "시스템"; ui.sub.text.textContent = `당사자 (${defName}) 절망 중...`;
                const defPrompt = `쟁점: "${topic}"\n상황: 마지막 희망이었던 이의 제기마저 기각되어 결국 패소가 확정되었습니다! 완전한 절망과 슬픔을 성격에 맞게 표현하세요. 길이: ${length}`;
                const defRes = await callGemini(getP(defName), defPrompt);
                await playSpeech("당사자", defName, defRes.text, defRes.emotion);
                trialHistory.push(`당사자(${defName}): ${defRes.text}`);
            }
        }
    }
    
}