
/**
 * 导航模块
 */
const NavigationModule = {
    switchTab(tabId) {
        document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.content-section').forEach(el => el.classList.remove('block'));
        document.getElementById(tabId).classList.remove('hidden');
        document.getElementById(tabId).classList.add('block');
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtnId = tabId.replace('section-', 'tab-');
        document.getElementById(activeBtnId).classList.add('active');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

/**
 * 卡片翻转模块
 */
const CardModule = {
    toggle(cardId) {
        const front = document.getElementById(`${cardId}-front`);
        const back = document.getElementById(`${cardId}-back`);
        if (front && back) {
            front.classList.toggle('hidden');
            back.classList.toggle('hidden');
        }
    }
};



/**
 * 选择题模块
 */
const QuizModule = {
    init() {
        const container = document.getElementById('choice-questions-container');
        container.innerHTML = API_DATA.choiceQuestions.map(q => this.renderQuestion(q)).join('');
    },
    
    renderQuestion(q) {
        return `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${q.question}</p>
                </div>
                <div class="space-y-3 pl-11">
                    ${Object.entries(q.options).map(([key, value]) => `
                        <div onclick="QuizModule.selectOption('${q.id}', '${key}', this)" class="option-item p-3 rounded border border-gray-200 bg-gray-50" data-question="${q.id}" data-option="${key}">
                            <span class="font-bold text-amber-700 mr-2">${key}.</span>
                            <span class="text-gray-700">${value}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 pl-11 hidden" id="analysis-${q.id}">
                    <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p class="text-sm font-bold text-green-800 mb-2">✅ 正确答案：${q.correct}</p>
                        <p class="text-sm text-green-700">${q.analysis}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    selectOption(questionId, selectedOption, element) {
        const parentGrid = element.closest('.space-y-3');
        if (parentGrid.dataset.done === '1') return;
        parentGrid.dataset.done = '1';
        parentGrid.style.pointerEvents = 'none';
        parentGrid.style.opacity = '0.75';
        
        const question = API_DATA.choiceQuestions.find(q => q.id === questionId);
        const allOptions = document.querySelectorAll(`[data-question="${questionId}"]`);
        
        allOptions.forEach(opt => {
            opt.classList.remove('correct-selected', 'wrong-selected');
        });
        
        const analysisEl = document.getElementById(`analysis-${questionId}`);
        
        if (selectedOption === question.correct) {
            element.classList.add('correct-selected');
            analysisEl.classList.remove('hidden');
        } else {
            element.classList.add('wrong-selected');
            analysisEl.classList.remove('hidden');
        }
    },
    
    toggleAllAnswers() {
        const allAnalyses = document.querySelectorAll('[id^="analysis-"]');
        const isHidden = Array.from(allAnalyses).some(el => el.classList.contains('hidden'));
        allAnalyses.forEach(el => {
            if (isHidden) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }
};

/**
 * 填空题模块
 */
const BlankModule = {
    init() {
        const container = document.getElementById('blank-questions-container');
        container.innerHTML = API_DATA.blankQuestions.map(q => this.renderQuestion(q)).join('');
    },
    
    renderQuestion(q) {
        const blanks = q.answer.split('|');
        let questionText = q.question;
        blanks.forEach((_, index) => {
            questionText = questionText.replace('______', `<input type="text" class="blank-input" data-question="${q.id}" data-blank="${index}" autocomplete="off">`);
        });
        
        return `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${questionText}</p>
                </div>
                <div class="pl-11">
                    <button onclick="BlankModule.checkOne('${q.id}')" class="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200">校验答案</button>
                    <div class="mt-3 hidden" id="feedback-${q.id}">
                        <p class="text-sm text-green-700"><strong>参考答案：</strong>${q.answer.replace(/\|/g, ' / ')}</p>
                        <p class="text-sm text-gray-600 mt-1"><strong>解析：</strong>${q.analysis}</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    checkOne(questionId) {
        const question = API_DATA.blankQuestions.find(q => q.id === questionId);
        const inputs = document.querySelectorAll(`[data-question="${questionId}"]`);
        const correctAnswers = question.answer.split('|').map(a => a.trim());
        let allCorrect = true;
        
        inputs.forEach((input, index) => {
            const userAnswer = input.value.trim();
            const isCorrect = correctAnswers.some(ans => ans.includes(userAnswer) || userAnswer.includes(ans));
            
            if (isCorrect && userAnswer) {
                input.classList.add('input-correct');
                input.classList.remove('input-wrong');
            } else {
                input.classList.add('input-wrong');
                input.classList.remove('input-correct');
                allCorrect = false;
            }
        });
        
        const feedbackEl = document.getElementById(`feedback-${questionId}`);
        feedbackEl.classList.remove('hidden');
    },
    
    checkAll() {
        API_DATA.blankQuestions.forEach(q => this.checkOne(q.id));
    }
};

/**
 * 问答题模块
 */
const EssayModule = {
    init() {
        const container = document.getElementById('essay-questions-container');
        container.innerHTML = API_DATA.essayQuestions.map(q => this.renderQuestion(q)).join('');
    },
    
    renderQuestion(q) {
        return `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${q.question}</p>
                </div>
                <div class="pl-11">
                    <textarea class="essay-textarea mb-3" placeholder="在此写下你的思考..."></textarea>
                    <button onclick="EssayModule.toggleAnswer('${q.id}')" class="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200">查看参考答案与思路</button>
                    <div id="answer-${q.id}" class="answer-box hidden mt-4 p-4 bg-amber-50 rounded border border-amber-200 text-sm text-gray-800 leading-relaxed">
                        ${q.answerHtml}
                    </div>
                </div>
            </div>
        `;
    },
    
    toggleAnswer(questionId) {
        const answerEl = document.getElementById(`answer-${questionId}`);
        answerEl.classList.toggle('hidden');
    },
    
    toggleAllAnswers() {
        const allAnswers = document.querySelectorAll('[id^="answer-"]');
        const isHidden = Array.from(allAnswers).some(el => el.classList.contains('hidden'));
        allAnswers.forEach(el => {
            if (isHidden) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }
};
