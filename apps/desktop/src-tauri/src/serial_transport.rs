use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

const MAX_SESSIONS: usize = 16;
const MAX_BUFFER_BYTES: usize = 1024 * 1024;
const MAX_WRITE_BYTES: usize = 16 * 1024;

struct SerialSession {
    target: String,
    port: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    buffer: Arc<Mutex<VecDeque<u8>>>,
    dropped_bytes: Arc<AtomicU64>,
    stop: Arc<AtomicBool>,
    error: Arc<Mutex<Option<String>>>,
    reader: Option<JoinHandle<()>>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SerialPollResult {
    pub bytes: Vec<u8>,
    pub dropped_bytes: u64,
    pub open: bool,
    pub error: Option<String>,
}

#[derive(Clone, Default)]
pub struct SerialRegistry {
    sessions: Arc<Mutex<HashMap<(String, String), SerialSession>>>,
}

fn validate_session_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("serial session id is invalid".into());
    }
    Ok(())
}

fn validate_target(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        return Err("serial target is invalid".into());
    }
    Ok(())
}

fn validate_options(baud: u32, max_buffer_bytes: usize) -> Result<(), String> {
    if !(300..=4_000_000).contains(&baud) {
        return Err("serial baud rate must be from 300 through 4000000".into());
    }
    if !(1024..=MAX_BUFFER_BYTES).contains(&max_buffer_bytes) {
        return Err("serial buffer must be from 1024 through 1048576 bytes".into());
    }
    Ok(())
}

fn append_bounded(buffer: &mut VecDeque<u8>, input: &[u8], limit: usize) -> u64 {
    buffer.extend(input);
    let overflow = buffer.len().saturating_sub(limit);
    buffer.drain(..overflow);
    overflow as u64
}

impl SerialRegistry {
    pub fn start(
        &self,
        project_id: String,
        id: String,
        target: String,
        baud: u32,
        max_buffer_bytes: usize,
    ) -> Result<(), String> {
        validate_session_id(&id)?;
        validate_target(&target)?;
        validate_options(baud, max_buffer_bytes)?;
        let key = (project_id, id);
        {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| "serial registry is poisoned".to_string())?;
            if sessions.contains_key(&key) {
                return Err("serial session id is already active for this project".into());
            }
            if sessions.len() >= MAX_SESSIONS {
                return Err("serial session limit reached".into());
            }
        }
        let port = serialport::new(&target, baud)
            .timeout(Duration::from_millis(25))
            .open()
            .map_err(|error| format!("serial port could not be opened: {error}"))?;
        let port = Arc::new(Mutex::new(port));
        let buffer = Arc::new(Mutex::new(VecDeque::new()));
        let dropped_bytes = Arc::new(AtomicU64::new(0));
        let stop = Arc::new(AtomicBool::new(false));
        let error = Arc::new(Mutex::new(None));
        let reader_port = Arc::clone(&port);
        let reader_buffer = Arc::clone(&buffer);
        let reader_dropped = Arc::clone(&dropped_bytes);
        let reader_stop = Arc::clone(&stop);
        let reader_error = Arc::clone(&error);
        let reader = std::thread::spawn(move || {
            let mut chunk = [0_u8; 4096];
            while !reader_stop.load(Ordering::Relaxed) {
                let result = match reader_port.lock() {
                    Ok(mut port) => port.read(&mut chunk),
                    Err(_) => {
                        if let Ok(mut slot) = reader_error.lock() {
                            *slot = Some("serial port lock is poisoned".into());
                        }
                        break;
                    }
                };
                match result {
                    Ok(0) => {}
                    Ok(count) => match reader_buffer.lock() {
                        Ok(mut output) => {
                            let dropped =
                                append_bounded(&mut output, &chunk[..count], max_buffer_bytes);
                            reader_dropped.fetch_add(dropped, Ordering::Relaxed);
                        }
                        Err(_) => {
                            if let Ok(mut slot) = reader_error.lock() {
                                *slot = Some("serial buffer lock is poisoned".into());
                            }
                            break;
                        }
                    },
                    Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {}
                    Err(error) => {
                        if let Ok(mut slot) = reader_error.lock() {
                            *slot = Some(format!("serial read failed: {error}"));
                        }
                        break;
                    }
                }
            }
        });
        let mut session = SerialSession {
            target,
            port,
            buffer,
            dropped_bytes,
            stop,
            error,
            reader: Some(reader),
        };
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?;
        if sessions.contains_key(&key) {
            session.stop.store(true, Ordering::Relaxed);
            if let Some(reader) = session.reader.take() {
                let _ = reader.join();
            }
            return Err("serial session id became active before registration".into());
        }
        sessions.insert(key, session);
        Ok(())
    }

    pub fn target(&self, project_id: &str, id: &str) -> Result<String, String> {
        validate_session_id(id)?;
        self.sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?
            .get(&(project_id.to_string(), id.to_string()))
            .map(|session| session.target.clone())
            .ok_or_else(|| "serial session was not found".into())
    }

    pub fn write(&self, project_id: &str, id: &str, bytes: &[u8]) -> Result<(), String> {
        if bytes.len() > MAX_WRITE_BYTES {
            return Err("serial write exceeds 16 KiB".into());
        }
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?;
        let session = sessions
            .get(&(project_id.to_string(), id.to_string()))
            .ok_or_else(|| "serial session was not found".to_string())?;
        let result = session
            .port
            .lock()
            .map_err(|_| "serial port lock is poisoned".to_string())?
            .write_all(bytes)
            .map_err(|error| format!("serial write failed: {error}"));
        result
    }

    pub fn poll(
        &self,
        project_id: &str,
        id: &str,
        max_bytes: usize,
    ) -> Result<SerialPollResult, String> {
        if max_bytes == 0 || max_bytes > 64 * 1024 {
            return Err("serial poll size must be from 1 through 65536 bytes".into());
        }
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?;
        let session = sessions
            .get(&(project_id.to_string(), id.to_string()))
            .ok_or_else(|| "serial session was not found".to_string())?;
        let mut buffer = session
            .buffer
            .lock()
            .map_err(|_| "serial buffer lock is poisoned".to_string())?;
        let count = max_bytes.min(buffer.len());
        let bytes = buffer.drain(..count).collect();
        let error = session
            .error
            .lock()
            .map_err(|_| "serial error lock is poisoned".to_string())?
            .clone();
        Ok(SerialPollResult {
            bytes,
            dropped_bytes: session.dropped_bytes.load(Ordering::Relaxed),
            open: error.is_none() && !session.stop.load(Ordering::Relaxed),
            error,
        })
    }

    pub fn close(&self, project_id: &str, id: &str) -> Result<(), String> {
        validate_session_id(id)?;
        let mut session = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?
            .remove(&(project_id.to_string(), id.to_string()))
            .ok_or_else(|| "serial session was not found".to_string())?;
        session.stop.store(true, Ordering::Relaxed);
        if let Some(reader) = session.reader.take() {
            let _ = reader.join();
        }
        Ok(())
    }

    pub fn close_project(&self, project_id: &str) -> Result<(), String> {
        let ids: Vec<String> = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?
            .keys()
            .filter(|(owner, _)| owner == project_id)
            .map(|(_, id)| id.clone())
            .collect();
        for id in ids {
            self.close(project_id, &id)?;
        }
        Ok(())
    }

    pub fn close_target(&self, project_id: &str, target: &str) -> Result<(), String> {
        let ids: Vec<String> = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?
            .iter()
            .filter(|((owner, _), session)| owner == project_id && session.target == target)
            .map(|((_, id), _)| id.clone())
            .collect();
        for id in ids {
            self.close(project_id, &id)?;
        }
        Ok(())
    }

    pub fn close_all(&self) -> Result<(), String> {
        let keys: Vec<(String, String)> = self
            .sessions
            .lock()
            .map_err(|_| "serial registry is poisoned".to_string())?
            .keys()
            .cloned()
            .collect();
        for (project_id, id) in keys {
            self.close(&project_id, &id)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn serial_configuration_and_buffers_are_bounded() {
        assert!(validate_session_id("serial-1").is_ok());
        assert!(validate_session_id("bad/id").is_err());
        assert!(validate_target("COM4").is_ok());
        assert!(validate_target("bad\nport").is_err());
        assert!(validate_options(115_200, 64 * 1024).is_ok());
        assert!(validate_options(0, 1024).is_err());
        assert!(validate_options(9600, MAX_BUFFER_BYTES + 1).is_err());
        let mut buffer = VecDeque::from(vec![1, 2, 3]);
        assert_eq!(append_bounded(&mut buffer, &[4, 5, 6], 4), 2);
        assert_eq!(buffer, VecDeque::from(vec![3, 4, 5, 6]));
    }

    #[test]
    fn missing_serial_sessions_fail_without_hardware_access() {
        let registry = SerialRegistry::default();
        assert!(registry.target("project", "serial-1").is_err());
        assert!(registry.write("project", "serial-1", b"hello").is_err());
        assert!(registry.poll("project", "serial-1", 1024).is_err());
        assert!(registry.close_project("project").is_ok());
    }
}
