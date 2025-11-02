// 游戏主控制器
class Game {
    constructor() {
        this.currentScreen = 'mainScreen';
        this.player = {
            name: '',
            level: 1,
            exp: 0,
            expToNext: 100,
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            coins: 0,
            winCount: 0,
            totalGames: 0,
            equipment: [],
            skills: []
        };
        this.currentLevel = 0;
        this.currentChapter = 1;  // 当前章节
        this.chapterStartLevel = 0;  // 章节起始关卡索引
        this.currentQuestionIndex = 0; // 当前章节内已答题目数
        this.chapterQuestions = []; // 当前章节的所有题目
        this.chapterScore = 100; // 当前章节分数，满分100
        this.wrongAnswers = []; // 错题记录
        this.chapterHistory = {}; // 章节历史记录 { chapterId: [{timestamp, score, wrongAnswers, completedQuestions}] }
        this.currentSessionStartTime = null; // 当前答题会话开始时间
        this.enemy = null;
        this.gameState = 'menu'; // menu, playing, victory, defeat
        this.init();
    }

    init() {
        this.loadGame();
        this.setupEventListeners();
        this.updateUI();
        this.generateLevels();
    }

    // 保存游戏数据到本地存储
    saveGame() {
        const saveData = {
            player: this.player,
            currentLevel: this.currentLevel,
            chapterHistory: this.chapterHistory,
            timestamp: Date.now()
        };
        localStorage.setItem('angleHeroSave', JSON.stringify(saveData));
        console.log('游戏已保存，包含章节历史');
    }

    // 从本地存储加载游戏数据
    loadGame() {
        const saveData = localStorage.getItem('angleHeroSave');
        if (saveData) {
            try {
                const data = JSON.parse(saveData);
                this.player = { ...this.player, ...data.player };
                this.currentLevel = data.currentLevel || 0;
                this.chapterHistory = data.chapterHistory || {};

                // 检查是否是7天内的存档
                if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    document.getElementById('continueBtn').style.display = 'block';
                }
                
                console.log('加载存档成功，章节历史记录:', Object.keys(this.chapterHistory).length, '个章节');
            } catch (e) {
                console.error('加载存档失败:', e);
            }
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('continueBtn').addEventListener('click', () => this.continueGame());
        document.getElementById('backToMainBtn').addEventListener('click', () => this.showScreen('mainScreen'));
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
        document.getElementById('nextChapterBtn').addEventListener('click', () => this.startNextChapter());
        document.getElementById('giveUpBtn').addEventListener('click', () => this.giveUp());
        document.getElementById('useItemBtn').addEventListener('click', () => this.useItem());
        document.getElementById('closeCharacterBtn').addEventListener('click', () => this.showScreen('mapScreen'));
        
        // 历史记录模态框关闭
        const closeHistoryModal = document.getElementById('closeHistoryModal');
        const historyModal = document.getElementById('historyModal');
        
        if (closeHistoryModal) {
            closeHistoryModal.addEventListener('click', () => {
                historyModal.style.display = 'none';
            });
        }
        
        // 点击模态框外部关闭
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    historyModal.style.display = 'none';
                }
            });
        }
    }

    // 切换屏幕
    showScreen(screenId) {
        try {
            // 移除所有屏幕的 active 类
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
            });
            
            // 添加目标屏幕的 active 类
            const targetScreen = document.getElementById(screenId);
            if (!targetScreen) {
                console.error(`找不到屏幕元素: ${screenId}`);
                return;
            }
            
            targetScreen.classList.add('active');
            this.currentScreen = screenId;

            // 根据屏幕类型更新UI
            if (screenId === 'mapScreen') {
                this.updateMapUI();
            } else if (screenId === 'characterScreen') {
                this.updateCharacterUI();
            }
        } catch (error) {
            console.error('切换屏幕时出错:', error);
        }
    }

    // 开始游戏
    startGame() {
        const name = document.getElementById('playerName').value.trim();
        if (name) {
            this.player.name = name;
            this.showScreen('mapScreen');
            this.saveGame();
        } else {
            alert('请输入勇者名字！');
        }
    }

    // 继续游戏
    continueGame() {
        this.showScreen('mapScreen');
    }

    // 更新UI
    updateUI() {
        document.getElementById('playerLevel').textContent = `等级 ${this.player.level}`;
        document.getElementById('playerExp').textContent = `经验 ${this.player.exp}/${this.player.expToNext}`;
        document.getElementById('playerCoins').textContent = `💰 ${this.player.coins}`;
        document.getElementById('charLevel').textContent = this.player.level;
        document.getElementById('charExp').textContent = `${this.player.exp}/${this.player.expToNext}`;
        document.getElementById('charCoins').textContent = this.player.coins;
        const winRate = this.player.totalGames > 0 ? Math.round((this.player.winCount / this.player.totalGames) * 100) : 0;
        document.getElementById('charWinRate').textContent = `${winRate}%`;

        // 更新血条
        const hpPercent = (this.player.hp / this.player.maxHp) * 100;
        const mpPercent = (this.player.mp / this.player.maxMp) * 100;
        document.getElementById('hpFill').style.width = hpPercent + '%';
        document.getElementById('mpFill').style.width = mpPercent + '%';
        document.getElementById('hpValue').textContent = `${this.player.hp}/${this.player.maxHp}`;
        document.getElementById('mpValue').textContent = `${this.player.mp}/${this.player.maxMp}`;
    }

    // 更新地图界面
    updateMapUI() {
        const chaptersContainer = document.getElementById('chaptersContainer');
        if (!chaptersContainer) return;
        
        chaptersContainer.innerHTML = '';

        const chapters = this.getChapters();
        
        chapters.forEach(chapter => {
            const progress = this.getChapterProgress(chapter.id);
            const isUnlocked = this.isChapterUnlocked(chapter.id);
            
            const chapterCard = document.createElement('div');
            chapterCard.className = `chapter-card ${!isUnlocked ? 'locked' : ''} ${progress.completed > 0 ? 'completed' : ''}`;
            
            // 星级显示
            let stars = '';
            if (progress.highestScore >= 90) {
                stars = '🌟🌟🌟';
            } else if (progress.highestScore >= 75) {
                stars = '⭐⭐';
            } else if (progress.highestScore >= 60) {
                stars = '⭐';
            }
            
            chapterCard.innerHTML = `
                <div class="chapter-icon">${chapter.icon}</div>
                <div class="chapter-info">
                    <div class="chapter-name">第${chapter.id}章：${chapter.name}</div>
                    <div class="chapter-stats">
                        ${isUnlocked ? `
                            <div class="chapter-score">
                                ${progress.completed > 0 ? `最高分: ${progress.highestScore} ${stars}` : '未开始'}
                            </div>
                            <div class="chapter-progress">
                                完成次数: ${progress.completed}
                            </div>
                        ` : '<div class="chapter-locked">🔒 未解锁</div>'}
                    </div>
                </div>
                <div class="chapter-actions">
                    ${isUnlocked ? `
                        <button class="btn-chapter-start" data-chapter="${chapter.id}">
                            ${progress.completed > 0 ? '再次挑战' : '开始'}
                        </button>
                        ${progress.completed > 0 ? `
                            <button class="btn-chapter-history" data-chapter="${chapter.id}">
                                查看记录
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            `;
            
            chaptersContainer.appendChild(chapterCard);
        });
        
        // 绑定事件
        document.querySelectorAll('.btn-chapter-start').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chapterId = parseInt(e.target.dataset.chapter);
                this.startChapter(chapterId);
            });
        });
        
        document.querySelectorAll('.btn-chapter-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chapterId = parseInt(e.target.dataset.chapter);
                this.showChapterHistory(chapterId);
            });
        });
    }

    // 开始章节
    startChapter(chapterId) {
        const chapterQuestions = this.getChapterQuestions(chapterId);
        if (chapterQuestions.length === 0) return;
        
        // 记录开始时间
        this.currentSessionStartTime = Date.now();
        
        // 开始第一题
        this.startLevel(chapterQuestions[0].id - 1); // id从1开始，索引从0开始
    }

    // 显示章节历史记录
    showChapterHistory(chapterId) {
        const modal = document.getElementById('historyModal');
        const historyList = document.getElementById('historyList');
        const modalTitle = document.getElementById('historyModalTitle');
        
        if (!modal || !historyList) return;
        
        const chapter = this.getChapters().find(c => c.id === chapterId);
        const history = this.chapterHistory[chapterId] || [];
        
        modalTitle.textContent = `📊 ${chapter.name} - 历史记录`;
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无答题记录</div>';
        } else {
            historyList.innerHTML = '';
            
            // 按时间倒序排列
            const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
            
            sortedHistory.forEach((record, index) => {
                const date = new Date(record.timestamp);
                const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                const duration = Math.floor(record.duration / 1000);
                
                let stars = '';
                if (record.score >= 90) {
                    stars = '🌟🌟🌟';
                } else if (record.score >= 75) {
                    stars = '⭐⭐';
                } else if (record.score >= 60) {
                    stars = '⭐';
                }
                
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-header">
                        <span class="history-index">#${history.length - index}</span>
                        <span class="history-date">${dateStr}</span>
                        <span class="history-score ${record.score >= 90 ? 'excellent' : record.score >= 60 ? 'good' : 'normal'}">${record.score}分 ${stars}</span>
                    </div>
                    <div class="history-details">
                        <div class="history-stat">⏱️ 用时: ${duration}秒</div>
                        <div class="history-stat">❌ 错题: ${record.wrongAnswers.length}道</div>
                    </div>
                    ${record.wrongAnswers.length > 0 ? `
                        <div class="history-wrong-answers">
                            <div class="wrong-answers-title">错题列表：</div>
                            ${record.wrongAnswers.map((wrong, idx) => `
                                <div class="wrong-answer-item">
                                    <div class="wrong-question">${idx + 1}. ${wrong.question}</div>
                                    <div class="wrong-correct">✓ ${wrong.correctAnswer}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="perfect-score">🎯 完美通关！全部答对！</div>'}
                `;
                
                historyList.appendChild(historyItem);
            });
        }
        
        modal.style.display = 'flex';
    }

    // 更新角色界面
    updateCharacterUI() {
        const equipmentList = document.getElementById('equipmentList');
        equipmentList.innerHTML = '';

        if (this.player.equipment.length === 0) {
            equipmentList.innerHTML = '<div style="text-align: center; color: #95a5a6;">暂无装备</div>';
        } else {
            this.player.equipment.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'equipment-item';
                itemElement.innerHTML = `
                    <h4>${item.name}</h4>
                    <p>${item.description}</p>
                `;
                equipmentList.appendChild(itemElement);
            });
        }
    }

    // 生成关卡
    generateLevels() {
        // 这里是关卡数据的生成逻辑
        // 将在后面的代码中实现
    }

    // 开始关卡
    startLevel(levelIndex) {
        const level = levelsData[levelIndex];
        const isNewChapter = levelIndex === 0 || level.chapter !== levelsData[levelIndex - 1]?.chapter;
        
        // 如果是新章节的开始
        if (isNewChapter) {
            console.log(`开始新章节 ${level.chapter}: ${level.chapterName}`);
            this.currentChapter = level.chapter;
            this.chapterStartLevel = levelIndex;
            
            // 重置章节分数和错题记录
            this.chapterScore = 100;
            this.wrongAnswers = [];
            
            // 初始化敌人
            this.enemy = {
                name: level.enemy.name,
                hp: level.enemy.hp,
                maxHp: level.enemy.hp
            };
            
            // 重置玩家状态
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            
            this.addBattleLog(`============ 第${level.chapter}章：${level.chapterName} ============`);
            this.addBattleLog(`强敌出现：${this.enemy.name} (HP: ${this.enemy.maxHp})`);
            this.addBattleLog(`💯 当前分数：${this.chapterScore}/100`);
        } else {
            console.log(`继续章节 ${level.chapter}，当前题目 ${levelIndex - this.chapterStartLevel + 1}`);
        }
        
        this.currentLevel = levelIndex;
        this.showScreen('gameScreen');
        this.gameState = 'playing';
        this.player.totalGames++;
        
        this.updateGameUI();
        this.displayQuestion();
    }

    // 更新游戏界面
    updateGameUI() {
        document.getElementById('currentLevel').textContent = this.player.level;
        document.getElementById('enemySprite').textContent = this.enemy.name === '概念怪兽' ? '👹' : '👾';
        document.querySelector('.enemy-name').textContent = this.enemy.name;
        document.getElementById('enemyHpFill').style.width = (this.enemy.hp / this.enemy.maxHp * 100) + '%';
        document.getElementById('enemyHpValue').textContent = `${this.enemy.hp}/${this.enemy.maxHp}`;
        
        // 使用章节分数替代玩家HP显示
        const hpPercent = this.chapterScore;
        document.getElementById('hpFill').style.width = hpPercent + '%';
        document.getElementById('hpValue').textContent = `${this.chapterScore}/100`;
        
        // MP保持不变
        const mpPercent = (this.player.mp / this.player.maxMp) * 100;
        document.getElementById('mpFill').style.width = mpPercent + '%';
        document.getElementById('mpValue').textContent = `${this.player.mp}/${this.player.maxMp}`;
        
        this.updateUI();
    }

    // 显示题目
    displayQuestion() {
        console.log('displayQuestion 被调用，当前关卡索引:', this.currentLevel);
        const level = levelsData[this.currentLevel];
        console.log('题目内容:', level.question.stem);
        const questionArea = document.querySelector('.question-area');

        // 更新题目文本
        const questionTextElement = document.getElementById('questionText');
        if (questionTextElement) {
            // 添加淡出效果
            questionTextElement.style.opacity = '0';
            questionTextElement.style.transition = 'opacity 0.3s';
            
            // 延迟更新内容，让淡出效果生效
            setTimeout(() => {
                questionTextElement.textContent = level.question.stem;
                questionTextElement.style.opacity = '1';
                console.log('题目文本已更新:', questionTextElement.textContent);
            }, 100);
        } else {
            console.error('找不到 questionText 元素！');
        }

        // 清除之前的选项
        const answerOptions = document.getElementById('answerOptions');
        if (!answerOptions) {
            console.error('找不到 answerOptions 元素！');
            return;
        }
        // 强制清除所有子元素
        while (answerOptions.firstChild) {
            answerOptions.removeChild(answerOptions.firstChild);
        }
        // 也使用 innerHTML 确保清除
        answerOptions.innerHTML = '';
        // 强制浏览器重新渲染
        void answerOptions.offsetHeight;
        console.log('选项已清除，当前子元素数量:', answerOptions.children.length);

        // 根据题型生成不同的UI
        if (level.type === 'choice') {
            console.log('生成选择题选项，共', level.question.options.length, '个选项');
            level.question.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.className = 'answer-option';
                button.textContent = option;
                button.disabled = false;
                button.style.pointerEvents = 'auto';
                button.style.opacity = '0';
                button.style.cursor = 'pointer';
                button.style.transition = 'opacity 0.3s';
                
                button.addEventListener('click', () => {
                    // 防止重复点击
                    if (button.disabled) return;
                    console.log('选项按钮被点击:', option);
                    this.selectAnswer(index);
                });
                
                answerOptions.appendChild(button);
                
                // 添加淡入动画
                setTimeout(() => {
                    button.style.opacity = '1';
                }, 150 + index * 50);
            });
            console.log('选择题选项已生成');
        } else if (level.type === 'multiInput') {
            // 多输入框题型
            const inputContainer = document.createElement('div');
            inputContainer.className = 'multi-input-container';
            
            level.question.inputs.forEach((input, index) => {
                const inputRow = document.createElement('div');
                inputRow.className = 'input-row';
                inputRow.innerHTML = `
                    <label class="input-label">${input.label}</label>
                    <input type="number" class="angle-input" data-index="${index}" placeholder="输入角度">
                    <span class="input-unit">${input.unit}</span>
                `;
                inputContainer.appendChild(inputRow);
            });
            
            const submitBtn = document.createElement('button');
            submitBtn.className = 'btn btn-primary submit-multi-input';
            submitBtn.textContent = '提交答案';
            submitBtn.style.width = '100%';
            submitBtn.style.marginTop = '20px';
            
            submitBtn.addEventListener('click', () => {
                if (submitBtn.disabled) return;
                
                const inputs = inputContainer.querySelectorAll('.angle-input');
                const answers = Array.from(inputs).map(input => input.value.trim());
                
                // 检查是否所有输入框都已填写
                if (answers.some(ans => ans === '')) {
                    alert('请填写所有角度！');
                    return;
                }
                
                submitBtn.disabled = true;
                submitBtn.style.pointerEvents = 'none';
                submitBtn.style.opacity = '0.6';
                
                // 禁用所有输入框
                inputs.forEach(input => input.disabled = true);
                
                this.checkAnswer(answers);
            });
            
            inputContainer.appendChild(submitBtn);
            answerOptions.appendChild(inputContainer);
        } else if (level.type === 'input') {
            const inputContainer = document.createElement('div');
            inputContainer.innerHTML = `
                <input type="text" id="answerInput" placeholder="输入答案" style="padding: 15px; font-size: 18px; width: 100%; margin-bottom: 15px; border: 2px solid #ddd; border-radius: 10px;">
                <button id="submitAnswerBtn" class="btn btn-primary" style="width: 100%;">提交答案</button>
            `;
            answerOptions.appendChild(inputContainer);

            const submitBtn = document.getElementById('submitAnswerBtn');
            submitBtn.addEventListener('click', () => {
                // 防止重复点击
                if (submitBtn.disabled) return;
                const answer = document.getElementById('answerInput').value.trim();
                if (answer) {
                    submitBtn.disabled = true;
                    submitBtn.style.pointerEvents = 'none';
                    submitBtn.style.opacity = '0.6';
                    this.checkAnswer(answer);
                }
            });
        }

        // 绘制图形（如果有）
        this.drawQuestionImage(level);
        console.log('题目显示完成');
    }

    // 绘制题目图形
    drawQuestionImage(level) {
        const imageContainer = document.getElementById('questionImage');
        imageContainer.innerHTML = '';

        // 如果题目有配图，直接使用原图
        if (level.image) {
            const img = document.createElement('img');
            img.src = level.image;
            img.alt = '题目图片';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '300px';
            img.style.objectFit = 'contain';
            imageContainer.appendChild(img);
        }
    }


    // 选择答案
    selectAnswer(selectedIndex) {
        const level = levelsData[this.currentLevel];
        console.log(`用户选择了索引 ${selectedIndex}: "${level.question.options[selectedIndex]}"`);
        this.checkAnswer(selectedIndex);
    }

    // 检查答案
    checkAnswer(playerAnswer) {
        const level = levelsData[this.currentLevel];
        console.log(`检查答案: 当前关卡 ${this.currentLevel + 1}, 题目: ${level.question.stem}`);
        console.log(`选项:`, level.question.options);
        console.log(`选择的答案索引:`, playerAnswer, `正确答案索引:`, level.question.correct);
        
        // 禁用所有选项按钮，防止重复点击
        const answerOptions = document.getElementById('answerOptions');
        const buttons = answerOptions.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
        });
        
        const isCorrect = this.validateAnswer(level, playerAnswer);
        console.log(`答案验证结果: ${isCorrect ? '正确' : '错误'}`);
        
        if (isCorrect) {
            console.log('执行正确答案处理...');
            this.handleCorrectAnswer();
        } else {
            console.log('执行错误答案处理...');
            this.handleWrongAnswer();
        }
    }

    // 验证答案
    validateAnswer(level, playerAnswer) {
        if (level.type === 'choice') {
            // 确保比较的是数字类型
            const selectedIndex = Number(playerAnswer);
            const correctIndex = Number(level.question.correct);
            console.log(`验证答案: 选择了索引 ${selectedIndex}, 正确答案索引是 ${correctIndex}`);
            return selectedIndex === correctIndex;
        } else if (level.type === 'multiInput') {
            // 多输入框验证
            const correctAnswers = level.question.correct;
            if (!Array.isArray(playerAnswer) || playerAnswer.length !== correctAnswers.length) {
                return false;
            }
            // 检查每个答案是否正确
            return playerAnswer.every((ans, index) => 
                ans.toString().trim() === correctAnswers[index].toString().trim()
            );
        } else if (level.type === 'input') {
            return playerAnswer.toString().trim() === level.question.correct.toString().trim();
        }
        return false;
    }

    // 处理正确答案
    handleCorrectAnswer() {
        console.log('handleCorrectAnswer 被调用');
        const level = levelsData[this.currentLevel];
        const damage = this.calculateDamage();
        console.log(`造成伤害: ${damage}, 敌人当前HP: ${this.enemy.hp}`);

        // 对敌人造成伤害
        this.enemy.hp = Math.max(0, this.enemy.hp - damage);
        console.log(`敌人剩余HP: ${this.enemy.hp}`);
        this.addBattleLog(`✓ 回答正确！你对 ${this.enemy.name} 造成了 ${damage} 点伤害！`);
        this.updateGameUI();

        // 判断是否是章节最后一题
        const isLastQuestionInChapter = this.currentLevel === levelsData.length - 1 || 
                                         levelsData[this.currentLevel + 1].chapter !== level.chapter;

        // 检查是否击败敌人
        if (this.enemy.hp <= 0) {
            console.log('敌人被击败！');
            this.addBattleLog(`${this.enemy.name} 被击败了！`);
            setTimeout(() => this.victory(), 1500);
        } else if (isLastQuestionInChapter) {
            // 章节最后一题，即使敌人还有血也算通关
            console.log('章节最后一题答对，章节通关！');
            this.addBattleLog(`太棒了！${level.chapterName}完成！`);
            setTimeout(() => this.victory(), 1500);
        } else {
            // 不是最后一题，继续下一题
            const remainingQuestions = levelsData.filter((q, idx) => 
                idx > this.currentLevel && q.chapter === level.chapter
            ).length;
            console.log(`答对题目，章节还剩 ${remainingQuestions} 道题`);
            this.addBattleLog(`太棒了！还剩 ${remainingQuestions} 道题，继续加油！`);
            setTimeout(() => {
                // 自动进入下一题
                this.currentLevel++;
                this.displayQuestion();
            }, 1500);
        }
    }

    // 计算伤害
    calculateDamage() {
        let baseDamage = 50;
        const accuracy = this.player.equipment.reduce((acc, item) => acc + (item.accuracy || 0), 0);
        baseDamage += accuracy;

        // 暴击
        if (Math.random() < 0.2) {
            this.addBattleLog('暴击！');
            return Math.floor(baseDamage * 1.5);
        }
        return baseDamage;
    }

    // 处理错误答案
    handleWrongAnswer() {
        console.log('handleWrongAnswer 被调用');
        const level = levelsData[this.currentLevel];
        
        // 计算本章节的题目总数
        const chapterQuestions = levelsData.filter(q => q.chapter === level.chapter);
        const scorePerQuestion = Math.floor(100 / chapterQuestions.length);
        
        // 扣分
        this.chapterScore = Math.max(0, this.chapterScore - scorePerQuestion);
        console.log(`答错扣分: ${scorePerQuestion}, 剩余分数: ${this.chapterScore}`);
        this.addBattleLog(`✗ 回答错误！扣除 ${scorePerQuestion} 分，当前分数：${this.chapterScore}/100`);
        
        // 记录错题
        const wrongAnswer = {
            chapter: level.chapter,
            chapterName: level.chapterName,
            questionTitle: level.title,
            question: level.question.stem,
            correctAnswer: level.type === 'choice' 
                ? level.question.options[level.question.correct]
                : level.type === 'multiInput'
                ? level.question.inputs.map((input, i) => `${input.label} ${level.question.correct[i]}${input.unit}`).join(', ')
                : level.question.correct
        };
        this.wrongAnswers.push(wrongAnswer);
        
        // 显示正确答案提示
        this.addBattleLog(`💡 正确答案是：${wrongAnswer.correctAnswer}`);
        
        this.updateGameUI();

        // 判断是否是章节最后一题
        const isLastQuestionInChapter = this.currentLevel === levelsData.length - 1 || 
                                         levelsData[this.currentLevel + 1].chapter !== level.chapter;
        
        if (isLastQuestionInChapter) {
            // 最后一题，无论对错都结束章节
            console.log('章节最后一题答错，章节结束');
            this.addBattleLog(`本章结束！最终得分：${this.chapterScore}/100`);
            setTimeout(() => this.victory(), 2000);
        } else {
            // 不是最后一题，继续下一题
            console.log('答错但可以继续，显示下一题');
            this.addBattleLog(`还有机会！继续下一题...`);
            setTimeout(() => {
                this.currentLevel++;
                this.displayQuestion();
            }, 2000);
        }
    }

    // 敌人攻击
    enemyAttack() {
        console.log('enemyAttack 被调用');
        const damage = 25;
        this.player.hp = Math.max(0, this.player.hp - damage);
        console.log(`玩家受到敌人伤害: ${damage}, 剩余HP: ${this.player.hp}`);
        this.addBattleLog(`敌人对你造成了 ${damage} 点伤害！`);
        this.updateGameUI();

        if (this.player.hp > 0) {
            console.log('玩家HP大于0，1.5秒后显示下一题');
            setTimeout(() => {
                console.log('显示下一题');
                this.addBattleLog('请继续答题！');
                this.displayQuestion();
            }, 1500);
        } else {
            console.log('玩家HP归零，准备失败');
            this.defeat();
        }
    }

    // 添加战斗日志
    addBattleLog(message) {
        const battleLog = document.getElementById('battleLog');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = message;
        battleLog.appendChild(entry);
        battleLog.scrollTop = battleLog.scrollHeight;
    }

    // 胜利
    victory() {
        console.log('victory 被调用');
        this.gameState = 'victory';
        this.player.winCount++;
        const level = levelsData[this.currentLevel];

        // 保存本次答题历史
        const chapterId = level.chapter;
        const completedQuestions = this.getChapterQuestions(chapterId).map(q => q.id);
        
        const historyRecord = {
            timestamp: this.currentSessionStartTime || Date.now(),
            score: this.chapterScore,
            wrongAnswers: [...this.wrongAnswers], // 深拷贝错题列表
            completedQuestions: completedQuestions,
            duration: Date.now() - (this.currentSessionStartTime || Date.now())
        };
        
        if (!this.chapterHistory[chapterId]) {
            this.chapterHistory[chapterId] = [];
        }
        this.chapterHistory[chapterId].push(historyRecord);
        
        console.log(`保存章节${chapterId}历史记录:`, historyRecord);

        // 获得奖励
        const expGain = level.reward.exp || 100;
        const coinGain = level.reward.coins || 50;
        const item = level.reward.item;

        this.player.exp += expGain;
        this.player.coins += coinGain;

        console.log(`获得奖励: ${expGain} 经验, ${coinGain} 金币`);
        this.addBattleLog(`胜利！获得 ${expGain} 经验值和 ${coinGain} 金币！`);

        if (item) {
            this.player.equipment.push(item);
            this.addBattleLog(`获得装备：${item.name}！`);
        }

        // 检查升级
        this.checkLevelUp();

        // 解锁下一关（章节完成后解锁下一章节的第一题）
        const nextLevelIndex = this.currentLevel + 1;
        if (nextLevelIndex < levelsData.length) {
            // 找到下一个章节的起始关卡
            const currentChapter = level.chapter;
            const nextChapter = levelsData[nextLevelIndex].chapter;
            
            if (nextChapter !== currentChapter) {
                // 已经到了新章节
                this.currentLevel = nextLevelIndex;
                console.log(`章节完成！解锁下一章节，当前关卡索引: ${this.currentLevel}`);
            } else {
                // 还在当前章节（不应该到这里）
                this.currentLevel = nextLevelIndex;
                console.log(`关卡索引更新: ${this.currentLevel}`);
            }
        } else {
            console.log('所有关卡已完成');
        }

        this.saveGame();
        console.log('准备显示结果界面');
        this.showResultScreen(true);
    }

    // 失败
    defeat() {
        console.log('defeat 被调用');
        this.gameState = 'defeat';
        this.addBattleLog('挑战失败...');
        this.saveGame();
        this.showResultScreen(false);
    }

    // 显示结果界面
    showResultScreen(isVictory) {
        this.showScreen('resultScreen');

        const resultIcon = document.getElementById('resultIcon');
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        const nextLevelBtn = document.getElementById('nextLevelBtn');
        const nextChapterBtn = document.getElementById('nextChapterBtn');
        const expReward = document.getElementById('expReward');
        const coinReward = document.getElementById('coinReward');
        const itemReward = document.getElementById('itemReward');
        const level = levelsData[this.currentLevel];

        // 生成成绩报告
        let scoreReport = `\n📊 本章成绩：${this.chapterScore}/100 分`;
        if (this.chapterScore >= 90) {
            scoreReport += ' 🌟🌟🌟 (优秀)';
        } else if (this.chapterScore >= 75) {
            scoreReport += ' ⭐⭐ (良好)';
        } else if (this.chapterScore >= 60) {
            scoreReport += ' ⭐ (及格)';
        } else {
            scoreReport += ' (需要加强)';
        }
        
        // 获取历史最高分
        const chapterHistory = this.chapterHistory[level.chapter] || [];
        const previousHighScore = chapterHistory.length > 1 
            ? Math.max(...chapterHistory.slice(0, -1).map(h => h.score))
            : 0;

        if (isVictory) {
            resultIcon.textContent = '🎉';
            resultTitle.textContent = '章节完成！';
            resultTitle.className = 'result-title';
            
            let message = `恭喜你完成了${level.chapterName}！${scoreReport}`;
            
            // 显示与上次对比
            if (previousHighScore > 0) {
                if (this.chapterScore > previousHighScore) {
                    message += `<br><br>🎯 太棒了！比上次提高了 ${this.chapterScore - previousHighScore} 分！`;
                } else if (this.chapterScore === previousHighScore) {
                    message += `<br><br>👍 和上次一样好！`;
                } else {
                    message += `<br><br>💪 继续努力！上次最高分是 ${previousHighScore} 分`;
                }
            }
            
            resultMessage.innerHTML = message;

            // 显示错题记录
            if (this.wrongAnswers.length > 0) {
                resultMessage.innerHTML += `<br><br>❌ 本章错题：${this.wrongAnswers.length} 道<br>`;
                resultMessage.innerHTML += '<div style="text-align: left; max-height: 200px; overflow-y: auto; margin: 10px auto; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 14px;">';
                this.wrongAnswers.forEach((wrong, index) => {
                    resultMessage.innerHTML += `<div style="margin-bottom: 8px; padding: 5px; background: white; border-radius: 5px;">`;
                    resultMessage.innerHTML += `<strong>${index + 1}. ${wrong.questionTitle}</strong><br>`;
                    resultMessage.innerHTML += `题目：${wrong.question}<br>`;
                    resultMessage.innerHTML += `<span style="color: #27ae60;">✓ 正确答案：${wrong.correctAnswer}</span>`;
                    resultMessage.innerHTML += `</div>`;
                });
                resultMessage.innerHTML += '</div>';
            } else {
                resultMessage.innerHTML += '<br><br>🎯 太棒了！全部答对，满分通过！';
            }

            // 显示奖励
            expReward.textContent = `+${level.reward.exp || 100} 经验`;
            coinReward.textContent = `+${level.reward.coins || 50} 金币`;
            expReward.style.display = 'block';
            coinReward.style.display = 'block';
            
            if (level.reward.item) {
                itemReward.textContent = `获得：${level.reward.item.name}`;
                itemReward.style.display = 'block';
            } else {
                itemReward.style.display = 'none';
            }

            // 检查是否有下一章
            const nextLevelIndex = this.currentLevel + 1;
            const hasNextChapter = nextLevelIndex < levelsData.length;
            
            // 显示/隐藏"下一章"按钮
            if (hasNextChapter && this.isChapterUnlocked(levelsData[nextLevelIndex].chapter)) {
                nextChapterBtn.style.display = 'block';
                nextChapterBtn.textContent = `🎯 挑战第${levelsData[nextLevelIndex].chapter}章`;
            } else if (hasNextChapter && !this.isChapterUnlocked(levelsData[nextLevelIndex].chapter)) {
                // 下一章已解锁
                nextChapterBtn.style.display = 'block';
                nextChapterBtn.textContent = `🎯 挑战第${levelsData[nextLevelIndex].chapter}章`;
            } else {
                nextChapterBtn.style.display = 'none';
            }
            
            // 修改"返回章节选择"按钮
            nextLevelBtn.style.display = 'block';
            nextLevelBtn.textContent = '返回章节选择';
        } else {
            resultIcon.textContent = '😢';
            resultTitle.textContent = '失败';
            resultTitle.className = 'result-title defeat';
            resultMessage.textContent = '不要气馁，再试一次吧！';
            // 失败时显示"重新挑战"按钮
            nextLevelBtn.style.display = 'block';
            nextLevelBtn.textContent = '重新挑战';
            nextChapterBtn.style.display = 'none';
            expReward.style.display = 'none';
            coinReward.style.display = 'none';
            itemReward.style.display = 'none';
        }
    }

    // 检查升级
    checkLevelUp() {
        while (this.player.exp >= this.player.expToNext) {
            this.player.exp -= this.player.expToNext;
            this.player.level++;
            this.player.maxHp += 20;
            this.player.maxMp += 10;
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.player.expToNext = Math.floor(this.player.expToNext * 1.5);

            this.addBattleLog(`恭喜升级！当前等级：${this.player.level}`);
            this.showLevelUpAnimation();
        }
    }

    // 显示升级动画
    showLevelUpAnimation() {
        const animation = document.createElement('div');
        animation.className = 'level-up-animation';
        animation.textContent = 'LEVEL UP!';
        document.body.appendChild(animation);

        setTimeout(() => {
            document.body.removeChild(animation);
        }, 2000);
    }

    // 下一关
    nextLevel() {
        // 如果是失败后的重新挑战，重新开始当前章节
        if (this.gameState === 'defeat') {
            console.log('重新挑战当前章节');
            const level = levelsData[this.currentLevel];
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.startChapter(level.chapter);
            return;
        }
        
        // 胜利后，始终返回章节选择界面
        console.log('返回章节选择界面');
        this.showScreen('mapScreen');
    }
    
    // 开始下一章
    startNextChapter() {
        const nextLevelIndex = this.currentLevel + 1;
        if (nextLevelIndex < levelsData.length) {
            const nextChapterId = levelsData[nextLevelIndex].chapter;
            console.log(`开始下一章：第${nextChapterId}章`);
            this.startChapter(nextChapterId);
        } else {
            console.log('已完成所有章节');
            alert('恭喜你完成了所有章节！🎉');
            this.showScreen('mapScreen');
        }
    }

    // 放弃
    giveUp() {
        if (confirm('确定要放弃挑战吗？')) {
            this.defeat();
        }
    }

    // 使用道具
    useItem() {
        alert('道具系统开发中...');
    }

    // 获取所有章节信息
    getChapters() {
        const chapters = {};
        levelsData.forEach(level => {
            if (!chapters[level.chapter]) {
                chapters[level.chapter] = {
                    id: level.chapter,
                    name: level.chapterName,
                    icon: this.getChapterIcon(level.chapter),
                    questions: []
                };
            }
            chapters[level.chapter].questions.push(level);
        });
        return Object.values(chapters);
    }

    // 获取章节图标
    getChapterIcon(chapterId) {
        const icons = {
            1: '🏘️',
            2: '🌲',
            3: '⛩️',
            4: '🕐',
            5: '🧮',
            6: '📐',
            7: '🎯',
            8: '👑'
        };
        return icons[chapterId] || '📖';
    }

    // 获取章节进度
    getChapterProgress(chapterId) {
        const history = this.chapterHistory[chapterId] || [];
        if (history.length === 0) {
            return {
                completed: 0,
                highestScore: 0,
                status: 'locked' // locked, unlocked, completed
            };
        }

        const highestScore = Math.max(...history.map(h => h.score));
        return {
            completed: history.length,
            highestScore: highestScore,
            status: 'completed'
        };
    }

    // 获取某章节的所有题目
    getChapterQuestions(chapterId) {
        return levelsData.filter(level => level.chapter === chapterId);
    }

    // 检查章节是否解锁
    isChapterUnlocked(chapterId) {
        if (chapterId === 1) return true; // 第一章始终解锁
        const prevChapterProgress = this.getChapterProgress(chapterId - 1);
        return prevChapterProgress.completed > 0; // 前一章完成过至少一次就解锁
    }
}

// 关卡数据 - 按章节分组
const levelsData = [
    // 第一章：直线与线段基础（关卡1-3）
    {
        id: 1,
        chapter: 1,
        chapterName: "直线与线段基础",
        title: "直线村的长老试炼",
        type: "choice",
        enemy: { name: "概念怪兽", hp: 300 },
        question: {
            stem: "两点之间（ ）最短？",
            options: ["直线", "射线", "线段", "曲线"],
            correct: 2
        },
        reward: { exp: 100, coins: 50, item: { name: "基础测量器", description: "+5% 准确率", accuracy: 5 } }
    },
    {
        id: 2,
        chapter: 1,
        chapterName: "直线与线段基础",
        title: "直线村的终极试炼",
        type: "choice",
        enemy: { name: "概念怪兽", hp: 300 },
        question: {
            stem: "过一点可以画（ ）条直线？",
            options: ["1条", "2条", "3条", "无数条"],
            correct: 3
        },
        reward: { exp: 100, coins: 50 }
    },
    {
        id: 3,
        chapter: 1,
        chapterName: "直线与线段基础",
        title: "射线镇的守护者",
        type: "choice",
        enemy: { name: "概念怪兽", hp: 300 },
        question: {
            stem: "过两点可以画（ ）条直线？",
            options: ["0条", "1条", "2条", "无数条"],
            correct: 1
        },
        reward: { exp: 100, coins: 50 }
    },
    // 第二章：角的分类（关卡4-6）
    {
        id: 4,
        chapter: 2,
        chapterName: "角的分类",
        title: "锐角森林的分类试炼",
        type: "choice",
        enemy: { name: "角度精灵", hp: 350 },
        question: {
            stem: "大于( )°而小于( )°的角叫作锐角？",
            options: ["0°, 90°", "0°, 180°", "90°, 180°", "0°, 360°"],
            correct: 0
        },
        reward: { exp: 100, coins: 50 }
    },
    {
        id: 5,
        chapter: 2,
        chapterName: "角的分类",
        title: "直角神殿的试炼",
        type: "choice",
        enemy: { name: "角度精灵", hp: 350 },
        question: {
            stem: "直角等于( )°？",
            options: ["45°", "90°", "180°", "360°"],
            correct: 1
        },
        reward: { exp: 100, coins: 50 }
    },
    {
        id: 6,
        chapter: 2,
        chapterName: "角的分类",
        title: "钝角峡谷的挑战",
        type: "choice",
        enemy: { name: "角度精灵", hp: 350 },
        question: {
            stem: "大于( )°而小于( )°的角叫作钝角？",
            options: ["0°, 90°", "90°, 180°", "180°, 270°", "90°, 360°"],
            correct: 1
        },
        reward: { exp: 100, coins: 50, item: { name: "观察眼镜", description: "+10% 准确率", accuracy: 10 } }
    },
    // 第三章：角的度量与转换（关卡7-8）
    {
        id: 7,
        chapter: 3,
        chapterName: "角的度量与转换",
        title: "平角湖的转换试炼",
        type: "choice",
        enemy: { name: "转换法师", hp: 400 },
        question: {
            stem: "1平角 = ( )° = ( )倍的直角？",
            options: ["180°, 2", "180°, 1", "360°, 2", "360°, 4"],
            correct: 0
        },
        reward: { exp: 120, coins: 60, item: { name: "转换魔法书", description: "角度转换能力", accuracy: 10 } }
    },
    {
        id: 8,
        chapter: 3,
        chapterName: "角的度量与转换",
        title: "周角峰的传说",
        type: "choice",
        enemy: { name: "转换法师", hp: 400 },
        question: {
            stem: "1周角 = ( )° = ( )倍的平角 = ( )倍的直角？",
            options: ["360°, 1, 2", "360°, 2, 4", "180°, 2, 4", "360°, 3, 6"],
            correct: 1
        },
        reward: { exp: 150, coins: 80 }
    },
    // 第四章：钟表角度（关卡9-10）
    {
        id: 9,
        chapter: 4,
        chapterName: "钟表角度",
        title: "钟表迷宫的时光试炼",
        type: "choice",
        enemy: { name: "时间守护者", hp: 450 },
        question: {
            stem: "钟面上的时针和分针在3时成( )角？",
            options: ["锐角", "直角", "钝角", "平角"],
            correct: 1
        },
        reward: { exp: 150, coins: 80, item: { name: "时光指针", description: "时间计算辅助", accuracy: 12 } }
    },
    {
        id: 10,
        chapter: 4,
        chapterName: "钟表角度",
        title: "钟表迷宫的深邃试炼",
        type: "choice",
        enemy: { name: "时间守护者", hp: 450 },
        question: {
            stem: "钟面上的时针和分针在6时成( )角？",
            options: ["锐角", "直角", "钝角", "平角"],
            correct: 3
        },
        reward: { exp: 150, coins: 80 }
    },
    // 第五章：角度计算（关卡11-13）
    {
        id: 11,
        chapter: 5,
        chapterName: "角度计算",
        title: "计算神殿的数学试炼",
        type: "input",
        enemy: { name: "数学恶魔", hp: 500 },
        question: {
            stem: "∠1 是 ∠2 的2倍，∠2 = 50°，那么 ∠1 = ( )°？",
            correct: "100"
        },
        reward: { exp: 150, coins: 80, item: { name: "计算法杖", description: "计算能力提升", accuracy: 15 } }
    },
    {
        id: 12,
        chapter: 5,
        chapterName: "角度计算",
        title: "计算神殿的高阶试炼",
        type: "input",
        enemy: { name: "数学恶魔", hp: 500 },
        question: {
            stem: "∠1 + ∠2 + ∠3 = 180°，其中 ∠1 = 30°，∠2 = 66°，那么 ∠3 = ( )°？",
            correct: "84"
        },
        reward: { exp: 150, coins: 80 }
    },
    {
        id: 13,
        chapter: 5,
        chapterName: "角度计算",
        title: "计算神殿的终极试炼",
        type: "input",
        enemy: { name: "数学恶魔", hp: 500 },
        question: {
            stem: "∠1 比 ∠2 的3倍少 10°，∠2 = 20°，∠1 = ( )°？",
            correct: "50"
        },
        reward: { exp: 180, coins: 100, item: { name: "智慧之书", description: "综合能力提升", accuracy: 20 } }
    },
    // 第六章：真理判断（关卡14-15）
    {
        id: 14,
        chapter: 6,
        chapterName: "真理判断",
        title: "真理圣殿的判断试炼",
        type: "choice",
        enemy: { name: "真理守护者", hp: 400 },
        question: {
            stem: "判断：过一点只能画出一条直线。",
            options: ["✓ 正确", "✗ 错误"],
            correct: 1
        },
        reward: { exp: 180, coins: 100 }
    },
    {
        id: 15,
        chapter: 6,
        chapterName: "真理判断",
        title: "真理圣殿的洞察试炼",
        type: "choice",
        enemy: { name: "真理守护者", hp: 400 },
        question: {
            stem: "判断：一条射线长10厘米。",
            options: ["✓ 正确", "✗ 错误"],
            correct: 1
        },
        reward: { exp: 180, coins: 100 }
    },
    // 第七章：图形推理（关卡16-17）
    {
        id: 16,
        chapter: 7,
        chapterName: "图形推理",
        title: "图形要塞的侦探试炼",
        type: "multiInput",
        enemy: { name: "几何怪兽", hp: 500 },
        image: "images/e011ce98726e7a75b29961accc22f8ef2c6b4b9a6ff05389f16e3b7e7e239541.jpg",
        question: {
            stem: "如图所示，已知 ∠1 = 40°，则各角分别为多少度？",
            inputs: [
                { label: "∠2 =", unit: "°" },
                { label: "∠3 =", unit: "°" },
                { label: "∠4 =", unit: "°" }
            ],
            correct: ["140", "40", "140"]
        },
        reward: { exp: 200, coins: 120, item: { name: "推理大师帽", description: "逻辑推理能力", accuracy: 18 } }
    },
    {
        id: 17,
        chapter: 7,
        chapterName: "图形推理",
        title: "图形要塞的深度试炼",
        type: "multiInput",
        enemy: { name: "几何怪兽", hp: 500 },
        image: "images/d4f5f4f4cfe4f0fcc53d362f6c1674e2dd0bcfe52e428cf1632e05d9963f55d3.jpg",
        question: {
            stem: "已知图中 ∠1 = 60°, ∠3 = 40°，则各角是多少度？",
            inputs: [
                { label: "∠2 =", unit: "°" },
                { label: "∠4 =", unit: "°" }
            ],
            correct: ["30", "140"]
        },
        reward: { exp: 200, coins: 120 }
    },
    // 第八章：角的计数（关卡18-19）
    {
        id: 18,
        chapter: 8,
        chapterName: "角的计数",
        title: "几何王国的计数试炼",
        type: "choice",
        enemy: { name: "计数精灵", hp: 450 },
        image: "images/b0c2fb83c62ef0fe70b59f284fb571cb0c61f400b45bbc4e479da622848a8960.jpg",
        question: {
            stem: "图中一共有几个角？（不考虑180°及以上的角）",
            options: ["3个", "4个", "5个", "6个"],
            correct: 3
        },
        reward: { exp: 220, coins: 150, item: { name: "精确之眼", description: "精确计数能力", accuracy: 22 } }
    },
    {
        id: 19,
        chapter: 8,
        chapterName: "角的计数",
        title: "几何王国的探索试炼",
        type: "choice",
        enemy: { name: "计数精灵", hp: 450 },
        image: "images/97c0b697c55a7ac1f730d8e2543a5556e6d7d051216281ee3845a897cbd6c0b3.jpg",
        question: {
            stem: "三角形内有（ ）个角？",
            options: ["6个", "9个", "12个", "15个"],
            correct: 2
        },
        reward: { exp: 220, coins: 150 }
    }
];

// 初始化游戏
const game = new Game();
