const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openImage:         ()      => ipcRenderer.invoke('open-image'),
  toggleClickThrough: ()     => ipcRenderer.invoke('toggle-click-through'),
  setOpacity:        (v)     => ipcRenderer.invoke('set-opacity', v),
  getState:          ()      => ipcRenderer.invoke('get-state'),
  resizeToImage:     (w, h)  => ipcRenderer.invoke('resize-to-image', w, h),
  close:             ()      => ipcRenderer.invoke('close'),

  onClickThroughChanged: (cb) => ipcRenderer.on('click-through-changed', (_e, v) => cb(v)),
  onOpacityChanged:      (cb) => ipcRenderer.on('opacity-changed',       (_e, v) => cb(v)),
});
