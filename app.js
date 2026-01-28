// Genki Study App - Main Application

// ===== Audio Pronunciation =====
let speechSynthesis = window.speechSynthesis;
let japaneseVoice = null;

function initAudio() {
  if (!speechSynthesis) {
    console.warn('Speech synthesis not supported in this browser');
    return;
  }

  // Load voices and find a Japanese voice
  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    japaneseVoice = voices.find(voice => voice.lang.startsWith('ja')) || null;

    if (!japaneseVoice && voices.length > 0) {
      // Try to find any voice that might work with Japanese
      japaneseVoice = voices.find(voice =>
        voice.lang.includes('ja') ||
        voice.name.toLowerCase().includes('japanese')
      );
    }
  }

  // Load voices immediately if available
  loadVoices();

  // Chrome loads voices asynchronously
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function speakJapanese(text) {
  if (!speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return;
  }

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85; // Slightly slower for learning
  utterance.pitch = 1;

  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  speechSynthesis.speak(utterance);
}

function speakCurrentItem(item, category) {
  if (!item) return;

  let textToSpeak = '';

  if (category === 'kanji') {
    // For kanji, speak the character and its readings
    textToSpeak = item.character;
  } else if (category === 'phrases') {
    textToSpeak = item.japanese;
  } else {
    // Vocabulary - speak the Japanese word
    textToSpeak = item.japanese;
  }

  speakJapanese(textToSpeak);
}

function speakFlashcardItem() {
  const item = state.flashcardItems[state.flashcardIndex];
  if (item) {
    speakCurrentItem(item, state.currentCategory);
  }
}

function speakQuizQuestion() {
  const item = state.quizItems[state.quizIndex];
  if (!item) return;

  // Only speak Japanese text (jp-en mode shows Japanese question)
  if (state.quizType === 'jp-en') {
    if (state.currentCategory === 'kanji') {
      speakJapanese(item.character);
    } else {
      speakJapanese(item.japanese);
    }
  }
}

// ===== State Management =====
const state = {
  currentChapter: null,
  currentCategory: 'vocabulary',
  currentView: 'home',
  flashcardIndex: 0,
  flashcardItems: [],
  flashcardState: 0, // 0 = kanji/japanese, 1 = reading/hiragana, 2 = english
  quizItems: [],
  quizIndex: 0,
  quizScore: 0,
  quizType: null,
  translationsHidden: false,
  progress: loadProgress()
};

// ===== LocalStorage Functions =====
function loadProgress() {
  const saved = localStorage.getItem('genkiProgress');
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    known: {},
    needsPractice: {},
    quizScores: [],
    streak: 0,
    lastStudyDate: null
  };
}

function saveProgress() {
  localStorage.setItem('genkiProgress', JSON.stringify(state.progress));
}

function updateStreak() {
  const today = new Date().toDateString();
  const lastDate = state.progress.lastStudyDate;

  if (!lastDate) {
    state.progress.streak = 1;
  } else if (lastDate === today) {
    // Same day, no change
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastDate === yesterday.toDateString()) {
      state.progress.streak++;
    } else {
      state.progress.streak = 1;
    }
  }

  state.progress.lastStudyDate = today;
  saveProgress();
}

// ===== View Management =====
function showView(viewName) {
  // Update header navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update mobile navigation
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Show target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
    state.currentView = viewName;
  }

  // Handle specific view logic
  if (viewName === 'home') {
    renderChapterGrid();
  } else if (viewName === 'progress') {
    renderProgress();
  }

  // Scroll to top when changing views
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Chapter Grid =====
function renderChapterGrid() {
  const grid = document.querySelector('.chapter-grid');
  grid.innerHTML = '';

  genkiData.chapters.forEach(chapter => {
    const card = document.createElement('div');
    card.className = 'chapter-card';
    card.onclick = () => selectChapter(chapter.id);

    const vocabCount = chapter.vocabulary?.length || 0;
    const kanjiCount = chapter.kanji?.length || 0;
    const phraseCount = chapter.phrases?.length || 0;

    card.innerHTML = `
      <div class="chapter-number">${chapter.id}</div>
      <h3>${chapter.title}</h3>
      <p class="chapter-card-jp">${chapter.titleJp}</p>
      <div class="chapter-stats">
        <span class="chapter-stat">📚 ${vocabCount} words</span>
        <span class="chapter-stat">漢 ${kanjiCount} kanji</span>
        <span class="chapter-stat">💬 ${phraseCount} phrases</span>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ===== Chapter Selection =====
function selectChapter(chapterId) {
  state.currentChapter = genkiData.chapters.find(c => c.id === chapterId);

  if (state.currentChapter) {
    document.getElementById('chapter-title-text').textContent =
      `Chapter ${state.currentChapter.id}: ${state.currentChapter.title}`;
    document.getElementById('chapter-title-jp').textContent =
      state.currentChapter.titleJp;

    selectCategory('vocabulary');
    showView('chapter');
    updateStreak();
  }
}

// ===== Category Selection =====
function selectCategory(category) {
  state.currentCategory = category;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
}

// ===== Review Modes =====
function startReview(mode) {
  if (mode === 'browse') {
    startBrowse();
  } else if (mode === 'flashcard') {
    startFlashcards();
  }
}

// ===== Browse Mode =====
function startBrowse() {
  const items = getItemsForCurrentCategory();
  const category = state.currentCategory;

  document.getElementById('browse-title').textContent =
    `${state.currentChapter.title} - ${capitalizeFirst(category)}`;

  renderBrowseList(items);
  showView('browse');
}

function renderBrowseList(items) {
  const list = document.getElementById('browse-list');
  list.innerHTML = '';

  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `browse-item ${state.currentCategory === 'kanji' ? 'kanji' : ''}`;

    const textToSpeak = item.japanese || item.character;
    const audioBtn = `<button class="audio-btn" onclick="event.stopPropagation(); speakJapanese('${textToSpeak.replace(/'/g, "\\'")}')" title="Listen to pronunciation" aria-label="Play pronunciation">🔊</button>`;

    if (state.currentCategory === 'kanji') {
      div.innerHTML = `
        <div class="kanji-character">${item.character}</div>
        <div class="kanji-details">
          <div class="kanji-readings">
            <span>音: ${item.onyomi}</span> | <span>訓: ${item.kunyomi}</span>
          </div>
          <div class="kanji-meaning browse-english ${state.translationsHidden ? 'hidden' : ''}">${item.meaning}</div>
          <div class="kanji-examples browse-english ${state.translationsHidden ? 'hidden' : ''}">${item.examples?.join(', ') || ''}</div>
        </div>
        ${audioBtn}
      `;
    } else if (state.currentCategory === 'phrases') {
      div.innerHTML = `
        <div class="browse-jp">${item.japanese}</div>
        <div>
          <div class="browse-english ${state.translationsHidden ? 'hidden' : ''}">${item.english}</div>
          ${item.notes ? `<div class="browse-reading browse-english ${state.translationsHidden ? 'hidden' : ''}">${item.notes}</div>` : ''}
        </div>
        ${audioBtn}
      `;
    } else {
      div.innerHTML = `
        <div>
          <div class="browse-jp">${item.japanese}</div>
          <div class="browse-reading">${item.reading}</div>
        </div>
        <div class="browse-english ${state.translationsHidden ? 'hidden' : ''}">${item.english}</div>
        <span class="browse-type">${item.type || ''}</span>
        ${audioBtn}
      `;
    }

    list.appendChild(div);
  });
}

function filterItems() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const items = getItemsForCurrentCategory();

  const filtered = items.filter(item => {
    const searchable = [
      item.japanese,
      item.reading,
      item.english,
      item.character,
      item.meaning,
      item.onyomi,
      item.kunyomi,
      item.notes
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(query);
  });

  renderBrowseList(filtered);
}

function toggleTranslations() {
  state.translationsHidden = !state.translationsHidden;
  const btn = document.getElementById('toggle-translation');
  btn.classList.toggle('active', state.translationsHidden);
  btn.innerHTML = state.translationsHidden
    ? '<span class="eye-icon">👁</span> Show English'
    : '<span class="eye-icon">👁</span> Hide English';

  document.querySelectorAll('.browse-english').forEach(el => {
    el.classList.toggle('hidden', state.translationsHidden);
  });
}

// ===== Flashcard Mode =====
function startFlashcards() {
  state.flashcardItems = [...getItemsForCurrentCategory()];
  state.flashcardIndex = 0;
  state.flashcardState = 0;

  document.getElementById('flashcard-total').textContent = state.flashcardItems.length;
  updateFlashcard();
  showView('flashcard');
}

function updateFlashcard() {
  const item = state.flashcardItems[state.flashcardIndex];
  if (!item) return;

  // Reset to state 0 when navigating to a new card
  state.flashcardState = 0;

  const card = document.getElementById('flashcard');
  card.classList.remove('flipped', 'state-0', 'state-1', 'state-2');
  card.classList.add('state-0');

  document.getElementById('flashcard-current').textContent = state.flashcardIndex + 1;

  updateFlashcardContent();
}

function updateFlashcardContent() {
  const item = state.flashcardItems[state.flashcardIndex];
  if (!item) return;

  const frontContent = document.getElementById('flashcard-front-content');
  const cardState = state.flashcardState;

  if (state.currentCategory === 'kanji') {
    if (cardState === 0) {
      frontContent.innerHTML = `<div class="flashcard-main">${item.character}</div>`;
    } else if (cardState === 1) {
      frontContent.innerHTML = `
        <div class="flashcard-label">Reading</div>
        <div class="flashcard-reading-display">${item.onyomi} / ${item.kunyomi}</div>
      `;
    } else {
      frontContent.innerHTML = `
        <div class="flashcard-label">Meaning</div>
        <div class="flashcard-meaning-display">${item.meaning}</div>
      `;
    }
  } else if (state.currentCategory === 'phrases') {
    if (cardState === 0) {
      frontContent.innerHTML = `<div class="flashcard-main">${item.japanese}</div>`;
    } else if (cardState === 1) {
      // Phrases don't have readings, so show notes or skip to english
      if (item.notes) {
        frontContent.innerHTML = `
          <div class="flashcard-label">Notes</div>
          <div class="flashcard-reading-display">${item.notes}</div>
        `;
      } else {
        frontContent.innerHTML = `
          <div class="flashcard-label">English</div>
          <div class="flashcard-meaning-display">${item.english}</div>
        `;
      }
    } else {
      frontContent.innerHTML = `
        <div class="flashcard-label">English</div>
        <div class="flashcard-meaning-display">${item.english}</div>
      `;
    }
  } else {
    // Vocabulary
    if (cardState === 0) {
      frontContent.innerHTML = `<div class="flashcard-main">${item.japanese}</div>`;
    } else if (cardState === 1) {
      frontContent.innerHTML = `
        <div class="flashcard-label">Reading</div>
        <div class="flashcard-reading-display">${item.reading}</div>
      `;
    } else {
      frontContent.innerHTML = `
        <div class="flashcard-label">English</div>
        <div class="flashcard-meaning-display">${item.english}</div>
      `;
    }
  }

  updateFlashcardIndicator();
}

function updateFlashcardIndicator() {
  const indicators = document.querySelectorAll('.state-indicator');
  indicators.forEach((ind, i) => {
    ind.classList.toggle('active', i === state.flashcardState);
  });
}

function flipCard() {
  const card = document.getElementById('flashcard');

  // Remove previous state class
  card.classList.remove(`state-${state.flashcardState}`);

  // Cycle through 3 states: 0 -> 1 -> 2 -> 0
  state.flashcardState = (state.flashcardState + 1) % 3;

  // Add new state class and trigger flip animation
  card.classList.add(`state-${state.flashcardState}`, 'flipping');

  // Update content
  updateFlashcardContent();

  // Remove animation class after it completes
  setTimeout(() => {
    card.classList.remove('flipping');
  }, 300);
}

function nextCard() {
  if (state.flashcardIndex < state.flashcardItems.length - 1) {
    state.flashcardIndex++;
    updateFlashcard();
  }
}

function prevCard() {
  if (state.flashcardIndex > 0) {
    state.flashcardIndex--;
    updateFlashcard();
  }
}

function shuffleFlashcards() {
  for (let i = state.flashcardItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.flashcardItems[i], state.flashcardItems[j]] =
      [state.flashcardItems[j], state.flashcardItems[i]];
  }
  state.flashcardIndex = 0;
  updateFlashcard();
}

function rateCard(rating) {
  const item = state.flashcardItems[state.flashcardIndex];
  const key = getItemKey(item);

  if (rating === 'known') {
    state.progress.known[key] = true;
    delete state.progress.needsPractice[key];
  } else {
    state.progress.needsPractice[key] = true;
    delete state.progress.known[key];
  }

  saveProgress();
  nextCard();
}

function getItemKey(item) {
  return `${state.currentChapter.id}-${state.currentCategory}-${item.japanese || item.character}`;
}

// ===== Quiz Mode =====
function startQuiz(type) {
  state.quizType = type;
  state.quizItems = [...getItemsForCurrentCategory()];

  // Shuffle quiz items
  for (let i = state.quizItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.quizItems[i], state.quizItems[j]] =
      [state.quizItems[j], state.quizItems[i]];
  }

  // Limit to 10 questions max
  state.quizItems = state.quizItems.slice(0, 10);
  state.quizIndex = 0;
  state.quizScore = 0;

  document.getElementById('quiz-total').textContent = state.quizItems.length;
  document.getElementById('quiz-score').textContent = '0';

  updateQuizQuestion();
  showView('quiz');
}

function updateQuizQuestion() {
  const item = state.quizItems[state.quizIndex];
  if (!item) return;

  const questionEl = document.getElementById('quiz-question');
  const optionsEl = document.getElementById('quiz-options');
  const feedbackEl = document.getElementById('quiz-feedback');
  const nextBtn = document.getElementById('quiz-next-btn');
  const audioBtn = document.getElementById('quiz-audio-btn');

  feedbackEl.className = 'quiz-feedback';
  feedbackEl.textContent = '';
  nextBtn.style.display = 'none';

  // Update progress bar
  const progress = (state.quizIndex / state.quizItems.length) * 100;
  document.getElementById('quiz-progress-fill').style.width = `${progress}%`;

  // Generate question
  if (state.quizType === 'jp-en') {
    questionEl.className = 'quiz-question';
    if (state.currentCategory === 'kanji') {
      questionEl.textContent = item.character;
    } else {
      questionEl.textContent = item.japanese;
    }
    // Show audio button for Japanese questions
    if (audioBtn) audioBtn.style.display = 'inline-flex';
  } else {
    questionEl.className = 'quiz-question english';
    if (state.currentCategory === 'kanji') {
      questionEl.textContent = item.meaning;
    } else {
      questionEl.textContent = item.english;
    }
    // Hide audio button for English questions
    if (audioBtn) audioBtn.style.display = 'none';
  }

  // Generate options
  const options = generateOptions(item);
  optionsEl.innerHTML = '';

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';

    if (state.quizType === 'jp-en') {
      if (state.currentCategory === 'kanji') {
        btn.innerHTML = `
          <div>${option.meaning}</div>
          <div class="quiz-option-reading">${option.onyomi} / ${option.kunyomi}</div>
        `;
      } else if (state.currentCategory === 'phrases') {
        btn.innerHTML = `<div>${option.english}</div>`;
      } else {
        btn.innerHTML = `
          <div>${option.english}</div>
        `;
      }
    } else {
      if (state.currentCategory === 'kanji') {
        btn.innerHTML = `
          <div>${option.character}</div>
          <div class="quiz-option-reading">${option.onyomi} / ${option.kunyomi}</div>
        `;
      } else if (state.currentCategory === 'phrases') {
        btn.innerHTML = `<div>${option.japanese}</div>`;
      } else {
        btn.innerHTML = `
          <div>${option.japanese}</div>
          <div class="quiz-option-reading">${option.reading}</div>
        `;
      }
    }

    btn.onclick = () => checkAnswer(option, item, btn);
    optionsEl.appendChild(btn);
  });
}

function generateOptions(correctItem) {
  const allItems = getItemsForCurrentCategory();
  const options = [correctItem];

  // Get random wrong answers
  const otherItems = allItems.filter(item => {
    if (state.currentCategory === 'kanji') {
      return item.character !== correctItem.character;
    }
    return item.japanese !== correctItem.japanese;
  });

  // Shuffle and pick 3 wrong answers
  for (let i = otherItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
  }

  options.push(...otherItems.slice(0, 3));

  // Shuffle options
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

function checkAnswer(selected, correct, btnElement) {
  const optionsEl = document.getElementById('quiz-options');
  const feedbackEl = document.getElementById('quiz-feedback');
  const nextBtn = document.getElementById('quiz-next-btn');

  // Disable all options
  optionsEl.querySelectorAll('.quiz-option').forEach(btn => {
    btn.classList.add('disabled');
    btn.onclick = null;

    // Mark correct answer
    const isCorrect = state.currentCategory === 'kanji'
      ? btn.textContent.includes(correct.meaning) || btn.textContent.includes(correct.character)
      : btn.textContent.includes(correct.english) || btn.textContent.includes(correct.japanese);

    if (state.currentCategory === 'kanji') {
      if (btn.textContent.includes(correct.character) || btn.textContent.includes(correct.meaning)) {
        btn.classList.add('correct');
      }
    } else if (state.currentCategory === 'phrases') {
      if (btn.textContent.includes(correct.japanese) || btn.textContent.includes(correct.english)) {
        btn.classList.add('correct');
      }
    } else {
      if (btn.textContent.includes(correct.japanese) || btn.textContent.includes(correct.english)) {
        btn.classList.add('correct');
      }
    }
  });

  // Check if selected is correct
  const isCorrectAnswer = state.currentCategory === 'kanji'
    ? selected.character === correct.character
    : selected.japanese === correct.japanese;

  if (isCorrectAnswer) {
    btnElement.classList.add('correct');
    feedbackEl.textContent = 'Correct! Great job!';
    feedbackEl.className = 'quiz-feedback correct';
    state.quizScore++;
    document.getElementById('quiz-score').textContent = state.quizScore;
  } else {
    btnElement.classList.add('incorrect');
    feedbackEl.textContent = `Incorrect. The answer was: ${correct.english || correct.meaning}`;
    feedbackEl.className = 'quiz-feedback incorrect';
  }

  nextBtn.style.display = 'block';
  nextBtn.textContent = state.quizIndex === state.quizItems.length - 1
    ? 'See Results'
    : 'Next Question →';
}

function nextQuestion() {
  state.quizIndex++;

  if (state.quizIndex >= state.quizItems.length) {
    endQuizWithResults();
  } else {
    updateQuizQuestion();
  }
}

function endQuiz() {
  showView('chapter');
}

function endQuizWithResults() {
  const percentage = Math.round((state.quizScore / state.quizItems.length) * 100);

  // Save quiz score
  state.progress.quizScores.push({
    chapter: state.currentChapter.id,
    category: state.currentCategory,
    score: percentage,
    date: new Date().toISOString()
  });
  saveProgress();

  document.getElementById('final-score-value').textContent = percentage;

  let message = '';
  if (percentage === 100) {
    message = 'Perfect score! You\'re a Japanese master!';
  } else if (percentage >= 80) {
    message = 'Excellent work! Keep it up!';
  } else if (percentage >= 60) {
    message = 'Good effort! A little more practice will help.';
  } else {
    message = 'Keep studying! You\'ll get there!';
  }

  document.getElementById('score-message').textContent = message;

  // Show confetti for good scores
  if (percentage >= 80) {
    showConfetti();
  }

  showView('quiz-complete');
}

function showConfetti() {
  const container = document.getElementById('confetti');
  container.innerHTML = '';

  const colors = ['#8B5CF6', '#F472B6', '#14B8A6', '#22C55E', '#F59E0B'];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.innerHTML = '';
  }, 3000);
}

function restartQuiz() {
  startQuiz(state.quizType);
}

// ===== Progress View =====
function renderProgress() {
  // Update streak
  document.getElementById('streak-count').textContent = state.progress.streak;

  // Calculate stats
  const knownCount = Object.keys(state.progress.known).length;
  const practiceCount = Object.keys(state.progress.needsPractice).length;
  const quizCount = state.progress.quizScores.length;
  const avgScore = quizCount > 0
    ? Math.round(state.progress.quizScores.reduce((sum, q) => sum + q.score, 0) / quizCount)
    : 0;

  document.getElementById('total-known').textContent = knownCount;
  document.getElementById('total-practice').textContent = practiceCount;
  document.getElementById('quizzes-taken').textContent = quizCount;
  document.getElementById('avg-score').textContent = `${avgScore}%`;

  // Chapter progress
  const progressContainer = document.getElementById('chapter-progress-items');
  progressContainer.innerHTML = '';

  genkiData.chapters.forEach(chapter => {
    const totalItems =
      (chapter.vocabulary?.length || 0) +
      (chapter.kanji?.length || 0) +
      (chapter.phrases?.length || 0);

    let knownInChapter = 0;
    ['vocabulary', 'kanji', 'phrases'].forEach(cat => {
      const items = chapter[cat] || [];
      items.forEach(item => {
        const key = `${chapter.id}-${cat}-${item.japanese || item.character}`;
        if (state.progress.known[key]) knownInChapter++;
      });
    });

    const percent = totalItems > 0 ? Math.round((knownInChapter / totalItems) * 100) : 0;

    const item = document.createElement('div');
    item.className = 'chapter-progress-item';
    item.innerHTML = `
      <span class="chapter-progress-name">Ch. ${chapter.id}: ${chapter.title}</span>
      <div class="chapter-progress-bar">
        <div class="chapter-progress-fill" style="width: ${percent}%"></div>
      </div>
      <span class="chapter-progress-percent">${percent}%</span>
    `;

    progressContainer.appendChild(item);
  });
}

function resetProgress() {
  if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
    state.progress = {
      known: {},
      needsPractice: {},
      quizScores: [],
      streak: 0,
      lastStudyDate: null
    };
    saveProgress();
    renderProgress();
  }
}

// ===== Utility Functions =====
function getItemsForCurrentCategory() {
  if (!state.currentChapter) return [];
  return state.currentChapter[state.currentCategory] || [];
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== Keyboard Navigation =====
document.addEventListener('keydown', (e) => {
  if (state.currentView === 'flashcard') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flipCard();
    } else if (e.key === 'ArrowRight') {
      nextCard();
    } else if (e.key === 'ArrowLeft') {
      prevCard();
    }
  }
});

// ===== Touch/Swipe Gestures =====
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;
let touchHandled = false; // Prevent double-firing with onclick

function initTouchGestures() {
  const flashcard = document.getElementById('flashcard');
  if (!flashcard) return;

  // Remove existing listeners to prevent duplicates
  flashcard.removeEventListener('touchstart', handleTouchStart);
  flashcard.removeEventListener('touchmove', handleTouchMove);
  flashcard.removeEventListener('touchend', handleTouchEnd);
  flashcard.removeEventListener('click', handleCardClick);

  // Add touch listeners
  flashcard.addEventListener('touchstart', handleTouchStart, { passive: true });
  flashcard.addEventListener('touchmove', handleTouchMove, { passive: false });
  flashcard.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Add click listener for desktop (with touch guard)
  flashcard.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
  // If touch already handled this interaction, skip
  if (touchHandled) {
    touchHandled = false;
    return;
  }
  flipCard();
}

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
  isSwiping = false;
  touchHandled = false;
}

function handleTouchMove(e) {
  if (!touchStartX) return;

  const currentX = e.changedTouches[0].screenX;
  const currentY = e.changedTouches[0].screenY;
  const diffX = Math.abs(currentX - touchStartX);
  const diffY = Math.abs(currentY - touchStartY);

  // If horizontal swipe is dominant, prevent vertical scroll
  if (diffX > diffY && diffX > 10) {
    e.preventDefault();
    isSwiping = true;

    // Visual feedback during swipe
    const flashcardInner = document.querySelector('.flashcard-inner');
    const translateX = (currentX - touchStartX) * 0.3;
    flashcardInner.style.transform = `translateX(${translateX}px)`;
  }
}

function handleTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;

  const flashcardInner = document.querySelector('.flashcard-inner');

  // Reset transform
  if (flashcardInner) {
    flashcardInner.style.transform = '';
  }

  handleSwipeGesture();

  // Prevent onclick from firing after touch
  if (touchHandled) {
    e.preventDefault();
  }
}

function handleSwipeGesture() {
  const swipeThreshold = 50;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // Only process horizontal swipes that are more horizontal than vertical
  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        // Swipe right - previous card
        prevCard();
        showSwipeFeedback('prev');
      } else {
        // Swipe left - next card
        nextCard();
        showSwipeFeedback('next');
      }
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      touchHandled = true;
    }
  }

  // Check for tap (small movement)
  if (!isSwiping && Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
    // It was a tap, not a swipe - flip the card
    flipCard();
    touchHandled = true;
  }

  // Reset values
  touchStartX = 0;
  touchStartY = 0;
  touchEndX = 0;
  touchEndY = 0;
  isSwiping = false;
}

function showSwipeFeedback(direction) {
  const flashcard = document.getElementById('flashcard');
  flashcard.classList.add(`swipe-${direction}`);
  setTimeout(() => {
    flashcard.classList.remove(`swipe-${direction}`);
  }, 200);
}

// ===== Mobile Navigation Helpers =====
function isMobileDevice() {
  return (typeof window.orientation !== "undefined") ||
    (navigator.userAgent.indexOf('IEMobile') !== -1) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0);
}

// Update flashcard hint based on device
function updateFlashcardHint() {
  const hint = document.querySelector('.flashcard-hint');
  if (hint) {
    hint.textContent = isMobileDevice()
      ? 'Tap to cycle • Swipe left/right to navigate'
      : 'Click to cycle • Arrow keys to navigate';
  }
}

// ===== Pull to Refresh Prevention =====
function preventPullToRefresh() {
  let lastTouchY = 0;
  document.addEventListener('touchstart', (e) => {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    // Prevent pull to refresh when at top and pulling down
    if (scrollTop === 0 && touchY > lastTouchY && e.cancelable) {
      // Only prevent if we're in the app, not in a scrollable area
      const target = e.target;
      if (!target.closest('.browse-list') && !target.closest('.chapter-grid')) {
        e.preventDefault();
      }
    }
  }, { passive: false });
}

// ===== Viewport Height Fix for Mobile Browsers =====
function setViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// ===== Handle Orientation Change =====
function handleOrientationChange() {
  // Small delay to let the browser finish rotating
  setTimeout(() => {
    setViewportHeight();
    // Re-center flashcard if in flashcard view
    if (state.currentView === 'flashcard') {
      updateFlashcard();
    }
  }, 100);
}

// ===== Back Button Support =====
function initBackButtonSupport() {
  // Handle browser back button
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
      // Navigate without adding to history
      showViewWithoutHistory(e.state.view);
    } else {
      showViewWithoutHistory('home');
    }
  });
}

function showViewWithoutHistory(viewName) {
  // Update header navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update mobile navigation
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Show target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
    state.currentView = viewName;
  }

  // Handle specific view logic
  if (viewName === 'home') {
    renderChapterGrid();
  } else if (viewName === 'progress') {
    renderProgress();
  }
}

// Wrap showView to add history support
const originalShowView = showView;
showView = function(viewName) {
  originalShowView(viewName);

  // Add to browser history for back button support
  if (history.pushState) {
    history.pushState({ view: viewName }, '', `#${viewName}`);
  }
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize audio
  initAudio();

  // Set initial viewport height
  setViewportHeight();

  // Listen for resize and orientation changes
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', handleOrientationChange);

  // Prevent pull to refresh on mobile
  preventPullToRefresh();

  // Initialize back button support
  initBackButtonSupport();

  // Initialize touch gestures after a short delay
  setTimeout(initTouchGestures, 100);

  // Check for hash in URL to restore view
  const hash = window.location.hash.slice(1);
  if (hash && ['home', 'progress', 'chapter', 'browse', 'flashcard', 'quiz'].includes(hash)) {
    showViewWithoutHistory(hash);
  } else {
    showViewWithoutHistory('home');
  }
});

// Re-initialize touch gestures when entering flashcard view
const originalStartFlashcards = startFlashcards;
startFlashcards = function() {
  originalStartFlashcards();
  setTimeout(() => {
    initTouchGestures();
    updateFlashcardHint();
  }, 100);
};
