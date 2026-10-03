// Live native sessions owned by the Embedded Lab and HDL toolchain: the open serial session and its
// native handle, the poll timer, an in-flight Arduino upload and the current HDL job. The shell
// closes them when a project is opened or closed.
export const nativeSessions = {
  activeSerialSession: null,
  activeSerialNative: null,
  serialPollTimer: null,
  activeArduinoUpload: null,
  activeHdlJob: null,
};
