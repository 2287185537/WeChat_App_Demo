// index.js
// 获取应用实例
const app = getApp();

// Color Constants
const WORK_START_COLOR = '#E57373'; // Morandi Red Start
const WORK_END_COLOR = '#EF9A9A';   // Morandi Red End (Lighter)
const BREAK_START_COLOR = '#81C784'; // Grass Green Start
const BREAK_END_COLOR = '#AED581';   // Lighter Grass Green End
const FEEDBACK_CUE_DURATION = 1000; // ms, duration for the feedback cue visibility

Page({
  data: {
    // Timer and session state
    timer: null,
    remainingTime: 1500, // Default 25 minutes
    isRunning: false,
    sessionType: 'work', // 'work' or 'break'
    workDuration: 25,    // in minutes
    breakDuration: 5,    // in minutes
    currentTimeDisplay: '25:00',

    // Task management
    activeTask: 'Focus on your task!',

    // UI settings
    sliderValue: 25,
    soundEnabled: true,
    currentBackgroundColor: WORK_START_COLOR,
    showFeedbackCue: false,
    lastFeedbackTriggerSecond: 0,

    // Audio context
    _audioContext: null,

    // Statistics and History
    completedPomodoros: 0,
    pomodoroHistory: [],

    // User Info (optional, from template)
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'),
  },

  // --- Color Manipulation Helper Functions ---
  _hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { // 3 digits
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) { // 6 digits
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    return { r, g, b };
  },

  _rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  },

  _interpolateColor(color1Rgb, color2Rgb, factor) {
    const f = Math.max(0, Math.min(1, factor)); // Ensure factor is between 0 and 1
    const r = Math.round(color1Rgb.r + f * (color2Rgb.r - color1Rgb.r));
    const g = Math.round(color1Rgb.g + f * (color2Rgb.g - color1Rgb.g));
    const b = Math.round(color1Rgb.b + f * (color2Rgb.b - color1Rgb.b));
    return { r, g, b };
  },

  calculateFocusBackgroundColor(remainingSeconds, totalDurationSeconds) {
    const startColorRgb = this._hexToRgb(WORK_START_COLOR);
    const endColorRgb = this._hexToRgb(WORK_END_COLOR);
    const progress = (totalDurationSeconds - remainingSeconds) / totalDurationSeconds;
    const interpolatedRgb = this._interpolateColor(startColorRgb, endColorRgb, progress);
    return this._rgbToHex(interpolatedRgb.r, interpolatedRgb.g, interpolatedRgb.b);
  },

  calculateBreakBackgroundColor(remainingSeconds, totalDurationSeconds) {
    const startColorRgb = this._hexToRgb(BREAK_START_COLOR);
    const endColorRgb = this._hexToRgb(BREAK_END_COLOR);
    const progress = (totalDurationSeconds - remainingSeconds) / totalDurationSeconds;
    const interpolatedRgb = this._interpolateColor(startColorRgb, endColorRgb, progress);
    return this._rgbToHex(interpolatedRgb.r, interpolatedRgb.g, interpolatedRgb.b);
  },

  // --- Timer Logic ---
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  },

  updateDisplay(newRemainingTime) {
    this.setData({
      currentTimeDisplay: this.formatTime(newRemainingTime !== undefined ? newRemainingTime : this.data.remainingTime)
    });
  },

  startTimer() {
    if (this.data.isRunning || this.data.remainingTime === 0) return;
    
    let initialSetData = { isRunning: true };
    if (this.data.sessionType === 'work' && this.data.remainingTime === this.data.workDuration * 60) {
      initialSetData.lastFeedbackTriggerSecond = 0; // Reset for a fresh work session
    }
    this.setData(initialSetData);

    const timer = setInterval(() => {
      const newRemainingTime = this.data.remainingTime - 1;
      let updates = { remainingTime: newRemainingTime };

      if (this.data.sessionType === 'work') {
        updates.currentBackgroundColor = this.calculateFocusBackgroundColor(newRemainingTime, this.data.workDuration * 60);
        const totalWorkSeconds = this.data.workDuration * 60;
        const elapsedSecondsForCue = totalWorkSeconds - newRemainingTime;
        if (elapsedSecondsForCue > 0 && elapsedSecondsForCue % 300 === 0 && elapsedSecondsForCue !== this.data.lastFeedbackTriggerSecond) {
          updates.showFeedbackCue = true;
          updates.lastFeedbackTriggerSecond = elapsedSecondsForCue;
          setTimeout(() => {
            this.setData({ showFeedbackCue: false });
          }, FEEDBACK_CUE_DURATION);
        }
      } else { // 'break' session
        updates.currentBackgroundColor = this.calculateBreakBackgroundColor(newRemainingTime, this.data.breakDuration * 60);
        updates.showFeedbackCue = false;
        updates.lastFeedbackTriggerSecond = 0;
      }
      
      this.setData(updates);
      this.updateDisplay(newRemainingTime);

      if (newRemainingTime <= 0) {
        clearInterval(this.data.timer);
        this.setData({ isRunning: false, timer: null });
        if (this.data.sessionType === 'work') {
          this.recordCompletedPomodoro();
        }
        this.playSound();
        this.switchSession();
      }
    }, 1000);
    this.setData({ timer: timer });
  },

  pauseTimer() {
    if (!this.data.isRunning) return;
    clearInterval(this.data.timer);
    this.setData({ isRunning: false, timer: null });
  },

  resetTimer() {
    clearInterval(this.data.timer);
    let newRemainingTime;
    let updates = {
      isRunning: false,
      timer: null,
      showFeedbackCue: false,
      lastFeedbackTriggerSecond: 0,
    };

    if (this.data.sessionType === 'work') {
      newRemainingTime = this.data.workDuration * 60;
      updates.sliderValue = this.data.workDuration; // Keep slider consistent for work
      updates.currentBackgroundColor = WORK_START_COLOR;
    } else { // 'break' session
      newRemainingTime = this.data.breakDuration * 60;
      updates.currentBackgroundColor = BREAK_START_COLOR;
    }
    updates.remainingTime = newRemainingTime;
    
    this.setData(updates);
    this.updateDisplay(newRemainingTime);
  },

  switchSession() {
    const isWork = this.data.sessionType === 'work';
    const newSessionType = isWork ? 'break' : 'work';
    const newRemainingTime = (isWork ? this.data.breakDuration : this.data.workDuration) * 60;
    
    this.setData({
      sessionType: newSessionType,
      remainingTime: newRemainingTime,
      isRunning: false, // Stop timer before switching
      timer: null,
      currentBackgroundColor: isWork ? BREAK_START_COLOR : WORK_START_COLOR,
      showFeedbackCue: false,
      lastFeedbackTriggerSecond: 0,
    });
    this.updateDisplay(newRemainingTime);
    this.startTimer(); // Automatically start the new session
  },

  // --- UI Event Handlers ---
  sliderChange(e) {
    const newDuration = e.detail.value;
    this.setData({ workDuration: newDuration, sliderValue: newDuration });
    if (!this.data.isRunning && this.data.sessionType === 'work') {
      this.setData({ remainingTime: newDuration * 60 });
      this.updateDisplay(newDuration * 60);
    }
  },

  onTaskInput(e) {
    this.setData({ activeTask: e.detail.value });
  },

  onSoundChange(e) {
    this.setData({ soundEnabled: e.detail.value });
    wx.setStorageSync('soundEnabled', e.detail.value);
  },

  // --- Data & Sound ---
  recordCompletedPomodoro() {
    const newCompletedPomodoros = this.data.completedPomodoros + 1;
    const newHistoryEntry = {
      task: this.data.activeTask || "Untitled Task",
      completedAt: new Date().toLocaleString()
    };
    const newPomodoroHistory = [newHistoryEntry, ...this.data.pomodoroHistory];
    this.setData({
      completedPomodoros: newCompletedPomodoros,
      pomodoroHistory: newPomodoroHistory
    });
    wx.setStorageSync('completedPomodoros', newCompletedPomodoros);
    wx.setStorageSync('pomodoroHistory', newPomodoroHistory);
  },

  clearHistory() {
    this.setData({ completedPomodoros: 0, pomodoroHistory: [] });
    wx.setStorageSync('completedPomodoros', 0);
    wx.setStorageSync('pomodoroHistory', []);
    wx.showToast({ title: 'History Cleared', icon: 'success', duration: 1500 });
  },

  playSound() {
    if (this.data.soundEnabled && this._audioContext) {
      this._audioContext.stop();
      this._audioContext.play();
    }
  },
  
  // --- Page Lifecycle Callbacks ---
  onLoad() {
    // Initialize timer state
    const initialWorkTime = this.data.workDuration * 60;
    this.setData({
      remainingTime: initialWorkTime,
      currentTimeDisplay: this.formatTime(initialWorkTime),
      sliderValue: this.data.workDuration,
      sessionType: 'work', // Explicitly set default
      activeTask: 'Focus on your task!', // Default task
      currentBackgroundColor: WORK_START_COLOR, // Default to work start color
      showFeedbackCue: false,
      lastFeedbackTriggerSecond: 0
    });

    // Load sound preference
    const soundEnabled = wx.getStorageSync('soundEnabled');
    if (soundEnabled !== '') { // Check if a value was actually stored
      this.setData({ soundEnabled: soundEnabled });
    } else {
      wx.setStorageSync('soundEnabled', this.data.soundEnabled); // Store default if nothing
    }

    // Initialize InnerAudioContext
    this._audioContext = wx.createInnerAudioContext();
    this._audioContext.src = 'pages/index/notification.mp3'; // Path to your sound file
    this._audioContext.onPlay(() => console.log('Notification sound started playing.'));
    this._audioContext.onEnded(() => console.log('Notification sound finished playing.'));
    this._audioContext.onError((res) => console.error("Audio playback error:", res.errMsg));

    // Load statistics
    const completedPomodoros = wx.getStorageSync('completedPomodoros') || 0;
    const pomodoroHistory = wx.getStorageSync('pomodoroHistory') || [];
    this.setData({
      completedPomodoros: completedPomodoros,
      pomodoroHistory: pomodoroHistory
    });
  },

  // Optional User Info methods (from template, can be removed if not used)
  bindViewTap() { // Example navigation, if logs page exists
    wx.navigateTo({ url: '../logs/logs' });
  },
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '展示用户信息',
      success: (res) => {
        this.setData({ userInfo: res.userInfo, hasUserInfo: true });
      }
    });
  },
  getUserInfo(e) {
    if (e.detail.userInfo) {
      this.setData({ userInfo: e.detail.userInfo, hasUserInfo: true });
    }
  }
});
