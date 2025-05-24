// index.js
// 获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'), // 如需尝试获取用户信息可改为false
    timer: null, // to store the interval ID
    remainingTime: 1500, // for 25 minutes in seconds, initial work duration
    isRunning: false,
    sessionType: 'work', // 'work' or 'break'
    workDuration: 25, // in minutes
    breakDuration: 5, // in minutes
    currentTimeDisplay: '25:00', // initial display
    activeTask: 'Focus on your task!', // Default task message
    sliderValue: 25, // Initial value for the slider, matches workDuration
  },
  // 事件处理函数
  bindViewTap() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
  },

  updateDisplay() {
    this.setData({
      currentTimeDisplay: this.formatTime(this.data.remainingTime)
    });
  },

  startTimer() {
    if (this.data.isRunning || this.data.remainingTime === 0) {
      return;
    }
    this.setData({ isRunning: true });
    const timer = setInterval(() => {
      let newRemainingTime = this.data.remainingTime - 1;
      this.setData({ remainingTime: newRemainingTime });
      this.updateDisplay();

      if (this.data.remainingTime <= 0) {
        clearInterval(this.data.timer);
        this.setData({ isRunning: false, timer: null });
        this.switchSession();
        // Optional: Add sound notification or vibration here
      }
    }, 1000);
    this.setData({ timer: timer });
  },

  pauseTimer() {
    if (!this.data.isRunning) {
      return;
    }
    clearInterval(this.data.timer);
    this.setData({ isRunning: false, timer: null });
  },

  resetTimer() {
    clearInterval(this.data.timer);
    let newRemainingTime;
    let updates = {
      isRunning: false,
      timer: null,
    };
    if (this.data.sessionType === 'work') {
      newRemainingTime = this.data.workDuration * 60;
      updates.sliderValue = this.data.workDuration; // Update sliderValue to reflect workDuration
    } else {
      newRemainingTime = this.data.breakDuration * 60;
    }
    updates.remainingTime = newRemainingTime;
    this.setData(updates);
    this.updateDisplay();
  },

  sliderChange(e) {
    const newDuration = e.detail.value;
    this.setData({
      workDuration: newDuration,
      sliderValue: newDuration
    });

    if (!this.data.isRunning && this.data.sessionType === 'work') {
      this.setData({
        remainingTime: newDuration * 60,
      });
      this.updateDisplay();
    }
  },

  switchSession() {
    let newSessionType;
    let newRemainingTime;
    if (this.data.sessionType === 'work') {
      newSessionType = 'break';
      newRemainingTime = this.data.breakDuration * 60;
    } else {
      newSessionType = 'work';
      newRemainingTime = this.data.workDuration * 60;
    }
    this.setData({
      sessionType: newSessionType,
      remainingTime: newRemainingTime,
      isRunning: false, // Ensure timer is stopped before switching
      timer: null
    });
    this.updateDisplay();
    this.startTimer(); // Automatically start the new session
  },

  onTaskInput(e) {
    this.setData({
      activeTask: e.detail.value
    });
  },

  onLoad() {
    // Initialize timer state
    const initialWorkTime = this.data.workDuration * 60;
    this.setData({
      remainingTime: initialWorkTime,
      currentTimeDisplay: this.formatTime(initialWorkTime),
      sliderValue: this.data.workDuration // Initialize sliderValue from workDuration
      // sessionType is 'work' by default
      // activeTask is also set by default
    });

    // Comment out or remove user profile logic if not essential for the timer
    // if (wx.getUserProfile) {
    //   this.setData({
    //     canIUseGetUserProfile: true
    //   })
    // }
  },
  getUserProfile(e) {
    // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
    wx.getUserProfile({
      desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
      success: (res) => {
        console.log(res)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },
  getUserInfo(e) {
    // 不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息
    console.log(e)
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  }
})
