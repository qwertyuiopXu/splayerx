<template>
  <div
    :data-component-name="$options.name"
    class="video">
    <base-video-player
      ref="videoCanvas"
      :defaultEvents="['play', 'pause', 'playing', 'canplay', 'timeupdate', 'loadedmetadata', 'durationchange']"
      :styleObject="{objectFit: 'contain', width: '100%', height: '100%'}"
      @play="onPlay"
      @pause="onPause"
      @playing="onPlaying"
      @canplay="onCanPlay"
      @timeupdate="onTimeupdate"
      @loadedmetadata="onMetaLoaded"
      @durationchange="onDurationChange"
      :src="src" />
    <BaseSubtitle/>
    <canvas class="canvas" ref="thumbnailCanvas"></canvas>
  </div>
</template>;

<script>
import asyncStorage from '@/helpers/asyncStorage';
import syncStorage from '@/helpers/syncStorage';
import WindowSizeHelper from '@/helpers/WindowSizeHelper.js';
import { mapGetters, mapActions } from 'vuex';
import { Video as videoActions } from '@/store/action-types';
import BaseSubtitle from './BaseSubtitle.vue';
import BaseVideoPlayer from './BaseVideoPlayer';


export default {
  name: 'video-canvas',
  components: {
    BaseSubtitle,
    'base-video-player': BaseVideoPlayer,
  },
  data() {
    return {
      videoExisted: false,
      shownTextTrack: false,
      newWidthOfWindow: 0,
      newHeightOfWindow: 0,
      timeUpdateIntervalID: null,
      windowSizeHelper: null,
      videoElement: null,
    };
  },
  props: {
    src: {
      type: String,
      required: true,
      validator(value) {
        // TODO: check if its a file or url
        if (value.length <= 0) {
          return false;
        }
        return true;
      },
    },
  },
  methods: {
    ...mapActions({
      videoConfigInitialize: videoActions.INITIALIZE,
    }),
    accurateTimeUpdate() {
      const { currentTime, duration } = this.videoElement;
      if (currentTime >= duration || this.videoElement.paused) {
        clearInterval(this.timeUpdateIntervalID);
      } else {
        this.$store.commit('AccurateTime', currentTime);
      }
    },
    onPlay() {
      this.$store.commit('isPlaying', true);
    },
    onPause() {
      this.$store.commit('isPlaying', false);
    },
    onPlaying() {
      // set interval to get update time
      const { duration } = this.videoElement;
      if (duration <= 240) {
        this.timeUpdateIntervalID = setInterval(this.accurateTimeUpdate, 10);
      }
    },
    onCanPlay() {
      // the video is ready to start playing
      this.$store.commit('Volume', this.videoElement.volume);
    },
    onMetaLoaded() {
      this.$bus.$emit('play');
      this.$bus.$emit('seek', this.currentTime);
      this.$store.commit('videoMeta', {
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight,
      });
      this.$bus.$emit('video-loaded');
    },
    onTimeupdate() {
      this.$store.commit('AccurateTime', this.videoElement.currentTime);
      const t = Math.floor(this.videoElement.currentTime);
      if (t !== this.$store.state.PlaybackState.CurrentTime) {
        this.$store.commit('CurrentTime', t);
      }
    },
    onDurationChange() {
      const t = Math.floor(this.$refs.videoCanvas.videoElement().duration);
      if (t !== this.$store.state.PlaybackState.duration) {
        this.$store.commit('Duration', t);
      }
    },
    onVideoSizeChange() {
      if (this.videoExisted) {
        this.$_calculateWindowSizeWhenVideoExisted();
        this.$_controlWindowSizeAtNewVideo();
      } else {
        this.$_calculateWindowSizeAtTheFirstTime();
        this.$_controlWindowSize();
        this.videoExisted = true;
      }
      this.$bus.$emit('screenshot-sizeset', this.videoWidth / this.videoHeight);
      this.windowSizeHelper.setNewWindowSize();
    },
    $_controlWindowSize() {
      const landingViewRectangle = this.windowBounds;

      const [windowX, windowY] = this.windowPosition;
      const windowPosition = { x: windowX, y: windowY };
      const currentDisplay = this.$electron.screen.getDisplayNearestPoint(windowPosition);

      const windowXY = this.calcNewWindowXY(currentDisplay, landingViewRectangle);

      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setSize', [
        parseInt(this.newWidthOfWindow, 10),
        parseInt(this.newHeightOfWindow, 10),
      ]);
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setPosition', [
        windowXY.windowX,
        windowXY.windowY,
      ]);
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setAspectRatio', [
        this.newWidthOfWindow / this.newHeightOfWindow,
      ]);
    },
    $_controlWindowSizeAtNewVideo() {
      const [windowX, windowY] = this.windowPosition;
      const windowPosition = { x: windowX, y: windowY };
      const currentDisplay = this.$electron.screen.getDisplayNearestPoint(windowPosition);

      const windowXY = this.avoidBeyondDisplayBorder(currentDisplay, windowX, windowY);

      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setSize', [
        parseInt(this.newWidthOfWindow, 10),
        parseInt(this.newHeightOfWindow, 10),
      ]);
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setPosition', [
        windowXY.windowX,
        windowXY.windowY,
      ]);
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setAspectRatio', [
        this.newWidthOfWindow / this.newHeightOfWindow,
      ]);
    },
    $_calculateWindowSizeAtTheFirstTime() {
      const [windowX, windowY] = this.windowPosition;
      const windowPosition = { x: windowX, y: windowY };
      const currentScreen = this.$electron.screen.getDisplayNearestPoint(windowPosition);
      const { width: screenWidth, height: screenHeight } = currentScreen.workAreaSize;
      const [minWidth, minHeight] = this.windowMinimumSize;
      const screenRatio = screenWidth / screenHeight;
      const minWindowRatio = minWidth / minHeight;
      if (this.videoWidth > screenWidth || this.videoHeight > screenHeight) {
        if (this.videoRatio > screenRatio) {
          this.newWidthOfWindow = screenWidth;
          this.newHeightOfWindow = this.calculateHeightByWidth;
        } else if (this.videoRatio < screenRatio) {
          this.newHeightOfWindow = screenHeight;
          this.newWidthOfWindow = this.calculateWidthByHeight;
        } else if (this.videoRatio === screenRatio) {
          [this.newWidthOfWindow, this.newHeightOfWindow] = [screenWidth, screenHeight];
        }
      } else if (this.videoWidth < minWidth || this.videoHeight < minHeight) {
        if (this.videoRatio > minWindowRatio) {
          this.newHeightOfWindow = minHeight;
          this.newWidthOfWindow = this.calculateWidthByHeight;
        } else if (this.videoRatio < minWindowRatio) {
          this.newWidthOfWindow = minWidth;
          this.newHeightOfWindow = this.calculateHeightByWidth;
        } else if (this.videoRatio === minWindowRatio) {
          [this.newWidthOfWindow, this.newHeightOfWindow]
            = [minWidth, minHeight];
        }
      } else {
        [this.newWidthOfWindow, this.newHeightOfWindow] = [this.videoWidth, this.videoHeight];
      }
    },
    $_calculateWindowSizeWhenVideoExisted() {
      const [windowWidth, windowHeight] = this.windowSize;
      const [minWidth, minHeight] = this.windowMinimumSize;
      const windowRatio = windowWidth / windowHeight;
      const minWindowRatio = minWidth / minHeight;
      if (this.videoWidth < windowWidth && this.videoHeight < windowHeight) {
        [this.newWidthOfWindow, this.newHeightOfWindow] = [this.videoWidth, this.videoHeight];
      } else if (this.videoWidth > windowWidth || this.videoHeight > windowHeight) {
        if (this.videoRatio > windowRatio) {
          this.newWidthOfWindow = windowWidth;
          this.newHeightOfWindow = this.calculateHeightByWidth;
        } else if (this.videoRatio < windowRatio) {
          this.newHeightOfWindow = windowHeight;
          this.newWidthOfWindow = this.calculateWidthByHeight;
        } else if (this.videoRatio === windowRatio) {
          [this.newWidthOfWindow, this.newHeightOfWindow]
            = [windowWidth, windowHeight];
        }
      }
      if (this.newWidthOfWindow < minWidth || this.newHeightOfWindow < minHeight) {
        if (this.videoRatio > minWindowRatio) {
          this.newHeightOfWindow = minHeight;
          this.newWidthOfWindow = this.calculateWidthByHeight;
        } else if (this.videoRatio < minWindowRatio) {
          this.newWidthOfWindow = minWidth;
          this.newHeightOfWindow = this.calculateHeightByWidth;
        } else if (this.videoRatio === minWindowRatio) {
          [this.newWidthOfWindow, this.newHeightOfWindow]
            = [this.videoWidth, this.videoHeight];
        }
      }
    },
    $_saveScreenshot() {
      const canvas = this.$refs.thumbnailCanvas;
      const canvasCTX = canvas.getContext('2d');
      const { videoHeight, videoWidth } = this.videoElement;
      [canvas.width, canvas.height] = [(videoWidth / videoHeight) * 1080, 1080];
      canvasCTX.drawImage(
        this.videoElement, 0, 0, videoWidth, videoHeight,
        0, 0, (videoWidth / videoHeight) * 1080, 1080,
      );
      const imagePath = canvas.toDataURL('image/png');
      [canvas.width, canvas.height] = [211.3, 122.6];
      canvasCTX.drawImage(
        this.videoElement, 0, 0, videoWidth, videoHeight,
        0, 0, 211.3, 122.6,
      );
      const smallImagePath = canvas.toDataURL('image/png');
      const data = {
        shortCut: imagePath,
        smallShortCut: smallImagePath,
        lastPlayedTime: this.currentTime,
        duration: this.$store.state.PlaybackState.Duration,
      };
      syncStorage.setSync('recent-played', data);
    },
    // responsible for calculating window position and size relative to LandingView's Center
    calcNewWindowXY(currentDisplay, landingViewRectangle) {
      let x = landingViewRectangle.x + (landingViewRectangle.width / 2);
      let y = landingViewRectangle.y + (landingViewRectangle.height / 2);
      x = Math.round(x - (this.newWidthOfWindow / 2));
      y = Math.round(y - (this.newHeightOfWindow / 2));

      return this.avoidBeyondDisplayBorder(currentDisplay, x, y);
    },
    // if the given (x, y) beyond the border of the given display, then adjust the x, y
    avoidBeyondDisplayBorder(display, x, y) {
      const {
        width: displayWidth,
        height: displayHeight,
        x: displayX, // the x axis of display's upper-left
        y: displayY, // the y axis of display's upper-left
      } = display.workArea;

      if (x < displayX) x = displayX;
      if (y < displayY) y = displayY;

      const right = x + this.newWidthOfWindow; // the x axis of window's right side
      if (right > displayX + displayWidth) {
        x = Math.round((displayX + displayWidth) - this.newWidthOfWindow);
      }
      const bottom = y + this.newHeightOfWindow; // the y axis of window's bottom side
      if (bottom > displayY + displayHeight) {
        y = Math.round((displayY + displayHeight) - this.newHeightOfWindow);
      }
      return { windowX: x, windowY: y };
    },
  },
  computed: {
    ...mapGetters(['volume', 'mute', 'rate']),
    calculateHeightByWidth() {
      return this.newWidthOfWindow / (this.videoWidth / this.videoHeight);
    },
    calculateWidthByHeight() {
      return this.newHeightOfWindow * (this.videoWidth / this.videoHeight);
    },
    currentTime() {
      return this.$store.state.PlaybackState.CurrentTime;
    },
    originSrcOfVideo() {
      return this.$store.state.PlaybackState.OriginSrcOfVideo;
    },
    videoMeta() {
      return this.$store.state.PlaybackState.videoMeta;
    },
    videoWidth() {
      return this.videoMeta.width;
    },
    videoHeight() {
      return this.videoMeta.height;
    },
    videoRatio() {
      if (!this.videoHeight) return 0;
      return this.videoWidth / this.videoHeight;
    },
    isFullScreen() {
      return this.$store.state.WindowState.isFullScreen;
    },
    windowSize() {
      return this.$store.state.WindowState.windowSize;
    },
    windowMinimumSize() {
      return this.$store.state.WindowState.windowMinimumSize;
    },
    windowPosition() {
      return this.$store.state.WindowState.windowPosition;
    },
    windowBounds() {
      return this.$store.state.WindowState.windowBounds;
    },
  },
  watch: {
    originSrcOfVideo(val, oldVal) {
      this.$_saveScreenshot();
      asyncStorage.get('recent-played')
        .then(async (data) => {
          const val = await this.infoDB().get('recent-played', 'path', oldVal);
          if (val && data) {
            const mergedData = Object.assign(val, data);
            this.infoDB().add('recent-played', mergedData);
          }
        });
    },
    volume(newVal) {
      this.videoElement.volume = newVal;
    },
    mute(newVal) {
      this.videoElement.muted = newVal;
    },
    rate(newVal) {
      this.videoElement.playbackRate = newVal;
    },
    videoRatio() {
      this.onVideoSizeChange();
    },
  },
  mounted() {
    this.videoElement = this.$refs.videoCanvas.videoElement();
    this.videoConfigInitialize({
      volume: 100,
      mute: false,
      rate: 1,
    });

    this.$bus.$on('toggle-fullscreen', () => {
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setFullScreen', [!this.isFullScreen]);
      this.$electron.ipcRenderer.send('callCurrentWindowMethod', 'setAspectRatio', [this.newWidthOfWindow / this.newHeightOfWindow]);
    });
    this.$bus.$on('toggle-playback', () => {
      if (this.videoElement.paused) {
        this.$bus.$emit('play');
        this.$bus.$emit('twinkle-play-icon');
      } else {
        this.$bus.$emit('pause');
        this.$bus.$emit('twinkle-pause-icon');
      }
    });
    this.$bus.$on('play', () => {
      this.videoElement.play();
    });
    this.$bus.$on('pause', () => {
      this.videoElement.pause();
    });
    this.$bus.$on('seek', (e) => {
      this.videoElement.currentTime = e;
      this.$store.commit('CurrentTime', e);
      this.$store.commit('AccurateTime', e);

      const filePath = decodeURI(this.videoElement.src);
      const indexOfLastDot = filePath.lastIndexOf('.');
      const ext = filePath.substring(indexOfLastDot + 1);
      if (ext === 'mkv') {
        this.$bus.$emit('seek-subtitle', e);
      }
    });
    this.windowSizeHelper = new WindowSizeHelper(this);
    window.onbeforeunload = () => {
      this.$_saveScreenshot();
    };
  },
};
</script>
<style lang="scss" scoped>
.video {
  height: 0;
}
.base-video-player {
  width: 100%;
  height: 100%;
  position: fixed;
}
.canvas {
  visibility: hidden;
}
</style>
