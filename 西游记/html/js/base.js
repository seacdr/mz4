
/**
 * 筛选指定回目的题目，并保持 API_DATA 的原有层级格式
 * @param {Object} data - 原始 API_DATA 对象
 * @param {string} chapterNum - 回目编号（如 "001"）
 * @returns {Object} 保持原格式的新对象
 */
function getQuestionsByChapter(data, chapterNum) {
    const result = {};
    // 遍历 API_DATA 的每一个顶层 key（choiceQuestions, blankQuestions, essayQuestions 等）
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (Array.isArray(data[key])) {
                // 筛选 id 包含目标编号的题目
                result[key] = data[key].filter(item => item.id && item.id.includes(chapterNum));
            } else {
                // 非数组属性直接保留
                result[key] = data[key];
            }
        }
    }
    return result;
}

/**
 * 获取当前 URL 解码后的文件编号
 */
function getURLNum(){
    num = "000";
    // 1. 获取当前 URL 解码后的文件名
    const pathname = decodeURIComponent(window.location.pathname);
    const fileName = pathname.split('/').pop(); 
    // 例如："西游记007 官封弼马心何足 名注齐天意未宁.html"
    // 2. 匹配“西游记”后面的 3 位数字
    const match = fileName.match(/西游记(\d{3})/);
    if (match) { num = match[1]; } // 获取到的 3 位数字，如 "007"
    else { num = "000"; }
    return num;
}
const PAGE_NUM = getURLNum();

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
        
        if (tabId === 'section-exercises') ExercisesLoader.init();
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
 * 本地持久化：把做题进度（选择答案、填空内容、问答内容、展开的解析）存入浏览器 localStorage
 * 关闭/刷新页面后自动恢复，无需联网。
 */
const Store = {
    _ns: 'xyj_',
    /**
     * @param {string} key 存储键名
     * @param {*} def 默认值
     * @param {boolean} pageScope 是否按当前页面隔离存储
     */
    get(key, def, pageScope = true) {
        try {
            let realKey = key;
            if(pageScope){
                realKey = `${PAGE_NUM}_${key}`;
            }
            const v = localStorage.getItem(this._ns + realKey);
            return v === null ? def : JSON.parse(v);
        } catch (e) { return def; }
    },

    /**
     * @param {string} key
     * @param {*} val
     * @param {boolean} pageScope 是否按当前页面隔离存储
     */
    set(key, val, pageScope = true) {
        try {
            let realKey = key;
            if(pageScope){
                realKey = `${PAGE_NUM}_${key}`;
            }
            localStorage.setItem(this._ns + realKey, JSON.stringify(val));
        } catch (e) {}
    },

    /**
     * @param {string} key
     * @param {boolean} pageScope 是否按当前页面隔离删除
     */
    del(key, pageScope = true) {
        try {
            let realKey = key;
            if(pageScope){
                realKey = `${PAGE_NUM}_${key}`;
            }
            localStorage.removeItem(this._ns + realKey);
        } catch (e) {}
    },

    // HTML 转义，避免用户输入被解析成标签
    esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // 【旧】清空全部做题记录（全局，保留用于旧功能）
    clearAll() {
        if (!confirm('确定清空全部做题记录？刷新后所有页面作答都将被清除。')) return;
        ['choice', 'choice_all', 'blank', 'blank_checked', 'essay', 'essay_open'].forEach(k => this.del(k));
        location.reload();
    },

    // ✨新增：只清空【当前页面】做题记录，其他页面数据保留
    clearCurrentPage() {
        if (!confirm('确定清空本页做题记录？本页所有选择、填空、问答内容会清除，其他页面不受影响。')) return;
        const keys = ['choice', 'choice_all', 'blank', 'blank_checked', 'essay', 'essay_open'];
        keys.forEach(k => this.del(k, true));
        location.reload();
    }
};


/**
 * 选择题模块
 */
const QuizModule = {
    _rendered: false,
    init() {
        const container = document.getElementById('choice-questions-container');
        if (!container || this._rendered) return;
        this._rendered = true;
        // 事件委托：整个容器只绑定一个监听器，替代上千个内联 onclick，点击更快
        container.addEventListener('click', (e) => {
            const opt = e.target.closest('.option-item');
            if (opt) this.selectOption(opt.dataset.question, opt.dataset.option, opt);
        });
        this._renderChunked(container, API_DATA.choiceQuestions);
    },

    // 分批渲染：每帧只插入一批卡片，避免一次性生成上千张卡导致页面卡死
    _renderChunked(container, items, chunkSize) {
        chunkSize = chunkSize || 60;
        let i = 0;
        const step = () => {
            const end = Math.min(i + chunkSize, items.length);
            let html = '';
            for (; i < end; i++) html += this.renderQuestion(items[i]);
            container.insertAdjacentHTML('beforeend', html);
            if (i < items.length) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    // 渲染单题：若本地已有作答记录，则直接恢复“已作答”状态（选项高亮 + 解析展开）
    renderQuestion(q) {
        const answers = Store.get('choice', {});
        const sel = answers[q.id] || '';
        const allOpen = Store.get('choice_all', false);
        const done = sel ? 'data-done="1"' : '';
        const gridStyle = sel ? ' style="pointer-events:none;opacity:0.75"' : '';
        const analysisHidden = (sel || allOpen) ? '' : 'hidden';
        const optionsHtml = Object.entries(q.options).map(([key, value]) => {
            let cls = 'option-item p-3 rounded border border-gray-200 bg-gray-50';
            if (sel) {
                if (key === q.correct) cls += ' correct-selected';
                else if (key === sel) cls += ' wrong-selected';
            }
            return `
                <div class="${cls}" data-question="${q.id}" data-option="${key}">
                    <span class="font-bold text-amber-700 mr-2">${key}.</span>
                    <span class="text-gray-700">${value}</span>
                </div>`;
        }).join('');

        return `
            <div class="q-card bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${q.question}</p>
                </div>
                <div class="space-y-3 pl-11" ${done}${gridStyle}>
                    ${optionsHtml}
                </div>
                <div class="mt-4 pl-11 ${analysisHidden}" id="analysis-${q.id}">
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
        if (!parentGrid || parentGrid.dataset.done === '1') return;
        parentGrid.dataset.done = '1';
        parentGrid.style.pointerEvents = 'none';
        parentGrid.style.opacity = '0.75';

        const question = API_DATA.choiceQuestions.find(q => q.id === questionId);
        const allOptions = document.querySelectorAll(`[data-question="${questionId}"]`);

        allOptions.forEach(opt => {
            opt.classList.remove('correct-selected', 'wrong-selected');
        });

        const analysisEl = document.getElementById(`analysis-${questionId}`);
        if (!analysisEl) return;

        if (selectedOption === question.correct) {
            element.classList.add('correct-selected');
            analysisEl.classList.remove('hidden');
        } else {
            element.classList.add('wrong-selected');
            analysisEl.classList.remove('hidden');
        }

        // 持久化：记住本题所选答案
        const answers = Store.get('choice', {});
        answers[questionId] = selectedOption;
        Store.set('choice', answers);
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
        // 持久化：记录“全部展开/收起解析”的状态
        Store.set('choice_all', !isHidden);
    }
};

/**
 * 填空题模块
 */
const BlankModule = {
    _rendered: false,
    init() {
        const container = document.getElementById('blank-questions-container');
        if (!container || this._rendered) return;
        this._rendered = true;
        // 事件委托：一键监听所有“校验答案”按钮
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.blank-check-btn');
            if (btn) this.checkOne(btn.dataset.question);
        });
        // 事件委托：输入时实时保存填空内容
        container.addEventListener('input', (e) => {
            const input = e.target.closest('.blank-input');
            if (input) this._saveInput(input);
        });
        this._renderChunked(container, API_DATA.blankQuestions);
    },

    _renderChunked(container, items, chunkSize) {
        chunkSize = chunkSize || 60;
        let i = 0;
        const step = () => {
            const end = Math.min(i + chunkSize, items.length);
            let html = '';
            for (; i < end; i++) html += this.renderQuestion(items[i]);
            container.insertAdjacentHTML('beforeend', html);
            if (i < items.length) {
                requestAnimationFrame(step);
            } else {
                this._restoreChecked();
            }
        };
        requestAnimationFrame(step);
    },

    // 恢复已校验题目的对错标记（输入框红绿样式）
    _restoreChecked() {
        const checkedMap = Store.get('blank_checked', {});
        Object.keys(checkedMap).forEach(qid => {
            if (checkedMap[qid]) this.checkOne(qid);
        });
    },

    _saveInput(input) {
        const qid = input.dataset.question;
        const idx = parseInt(input.dataset.blank, 10);
        const vals = Store.get('blank', {});
        const arr = vals[qid] || [];
        arr[idx] = input.value;
        vals[qid] = arr;
        Store.set('blank', vals);
    },

    // 渲染单题：恢复已填内容与“已校验”的反馈状态
    renderQuestion(q) {
        const blanks = q.answer.split('|');
        const vals = Store.get('blank', {})[q.id] || [];
        const checked = Store.get('blank_checked', {})[q.id] || false;
        let questionText = q.question;
        blanks.forEach((_, index) => {
            const val = Store.esc(vals[index]);
            questionText = questionText.replace('______', `<input type="text" class="blank-input" data-question="${q.id}" data-blank="${index}" value="${val}" autocomplete="off">`);
        });
        const feedbackHidden = checked ? '' : 'hidden';

        return `
            <div class="q-card bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${questionText}</p>
                </div>
                <div class="pl-11">
                    <button data-question="${q.id}" class="blank-check-btn text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200">校验答案</button>
                    <div class="mt-3 ${feedbackHidden}" id="feedback-${q.id}">
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
        //const correctAnswers = question.answer.split('|').map(a => a.trim());
        const correctAnswers = (question?.answer || '').split('|').map(a => a.trim()).filter(Boolean); // 可选：顺便过滤掉拆分后的空字符串

        inputs.forEach((input, index) => {
            const userAnswer = input.value.trim();
            const isCorrect = correctAnswers.some(ans => ans.includes(userAnswer) || userAnswer.includes(ans));

            if (isCorrect && userAnswer) {
                input.classList.add('input-correct');
                input.classList.remove('input-wrong');
            } else {
                input.classList.add('input-wrong');
                input.classList.remove('input-correct');
            }
        });

        const feedbackEl = document.getElementById(`feedback-${questionId}`);
        if (feedbackEl) feedbackEl.classList.remove('hidden');

        // 持久化：记录该题已校验，刷新后保持反馈状态
        const checked = Store.get('blank_checked', {});
        checked[questionId] = true;
        Store.set('blank_checked', checked);
    },

    checkAll() {
        API_DATA.blankQuestions.forEach(q => this.checkOne(q.id));
    }
};

/**
 * 问答题模块
 */
const EssayModule = {
    _rendered: false,
    init() {
        const container = document.getElementById('essay-questions-container');
        if (!container || this._rendered) return;
        this._rendered = true;
        // 事件委托：一键监听所有“查看答案”按钮
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.essay-toggle-btn');
            if (btn) this.toggleAnswer(btn.dataset.question);
        });
        // 事件委托：写作时实时保存问答内容
        container.addEventListener('input', (e) => {
            const ta = e.target.closest('.essay-textarea');
            if (ta) this._saveText(ta);
        });
        this._renderChunked(container, API_DATA.essayQuestions);
    },

    _renderChunked(container, items, chunkSize) {
        chunkSize = chunkSize || 60;
        let i = 0;
        const step = () => {
            const end = Math.min(i + chunkSize, items.length);
            let html = '';
            for (; i < end; i++) html += this.renderQuestion(items[i]);
            container.insertAdjacentHTML('beforeend', html);
            if (i < items.length) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    _saveText(ta) {
        const qid = ta.dataset.question;
        const vals = Store.get('essay', {});
        vals[qid] = ta.value;
        Store.set('essay', vals);
    },

    // 渲染单题：恢复已写内容与“已展开答案”的状态
    renderQuestion(q) {
        const vals = Store.get('essay', {});
        const value = Store.esc(vals[q.id]);
        const open = Store.get('essay_open', {})[q.id] || false;
        const answerHidden = open ? '' : 'hidden';

        return `
            <div class="q-card bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-sm">${q.num}</span>
                    <p class="text-gray-800 font-medium flex-1">${q.question}</p>
                </div>
                <div class="pl-11">
                    <textarea class="essay-textarea mb-3" data-question="${q.id}" placeholder="在此写下你的思考...">${value}</textarea>
                    <button data-question="${q.id}" class="essay-toggle-btn text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200">查看参考答案与思路</button>
                    <div id="answer-${q.id}" class="answer-box ${answerHidden} mt-4 p-4 bg-amber-50 rounded border border-amber-200 text-sm text-gray-800 leading-relaxed">
                        ${q.answerHtml}
                    </div>
                </div>
            </div>
        `;
    },

    toggleAnswer(questionId) {
        const answerEl = document.getElementById(`answer-${questionId}`);
        if (!answerEl) return;
        answerEl.classList.toggle('hidden');
        // 持久化：记录该题答案是否已展开
        const openMap = Store.get('essay_open', {});
        if (answerEl.classList.contains('hidden')) {
            delete openMap[questionId];
        } else {
            openMap[questionId] = true;
        }
        Store.set('essay_open', openMap);
    },

    toggleAllAnswers() {
        const allAnswers = document.querySelectorAll('[id^="answer-"]');
        const isHidden = Array.from(allAnswers).some(el => el.classList.contains('hidden'));
        const openMap = Store.get('essay_open', {});
        allAnswers.forEach(el => {
            if (isHidden) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
        // 同步持久化“全部展开/收起”状态
        if (isHidden) {
            API_DATA.essayQuestions.forEach(q => { openMap[q.id] = true; });
        } else {
            API_DATA.essayQuestions.forEach(q => { delete openMap[q.id]; });
        }
        Store.set('essay_open', openMap);
    }
};

/**
 * 一键返回顶部：滚动超过一定距离后显示，点击平滑回到顶部
 */
const TopButton = {
    init() {
        const btn = document.getElementById('back-to-top');
        if (!btn) return;
        const yNow = () => window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const showBtn = () => { btn.classList.toggle('show', yNow() > 300); };
        window.addEventListener('scroll', showBtn, { passive: true });
        document.addEventListener('scroll', showBtn, { passive: true });

        const goTop = (e) => {
            // 处理点击目标可能是文本节点的情况（↑ 字符）
            const t = e && e.target;
            const tEl = t && (t.nodeType === 1 ? t : t.parentElement);
            if (tEl && !tEl.closest('#back-to-top')) return;
            if (e && e.preventDefault) e.preventDefault();
            // 直接置顶：不用平滑动画，避免与离屏卡片懒渲染互相干扰导致滚动回弹
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            if (window.scrollTo) {
                try { window.scrollTo(0, 0); } catch (err) {}
            }
        };

        // 直接绑定 + 文档级事件委托双保险
        btn.addEventListener('click', goTop);
        document.addEventListener('click', goTop);
        showBtn();
    }
};

/**
 * 练习题懒加载器：首次进入“融会贯通”标签时才分批渲染，避免首屏一次性生成 2800+ 道题
 */
const ExercisesLoader = {
    init() {
        QuizModule.init();
        BlankModule.init();
        EssayModule.init();
    }
};

// 页面初始化逻辑入口
document.addEventListener('DOMContentLoaded', () => {
    // 优化：练习题改为进入“融会贯通”标签时按需分批渲染（见 ExercisesLoader ）
    TopButton.init();
});
