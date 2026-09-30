#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TerminationPlan {
    WindowsTaskkill { executable: &'static str, args: Vec<String> },
    PosixProcessGroup { signal: &'static str, pid: u32 },
}

pub fn owned_termination(pid: u32, windows: bool) -> TerminationPlan {
    if windows {
        TerminationPlan::WindowsTaskkill {
            executable: "C:\\Windows\\System32\\taskkill.exe",
            args: vec!["/PID".into(), pid.to_string(), "/T".into(), "/F".into()],
        }
    } else {
        TerminationPlan::PosixProcessGroup { signal: "TERM", pid }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn termination_is_fixed_and_tree_scoped() {
        assert_eq!(owned_termination(42, true), TerminationPlan::WindowsTaskkill { executable: "C:\\Windows\\System32\\taskkill.exe", args: vec!["/PID".into(), "42".into(), "/T".into(), "/F".into()] });
        assert_eq!(owned_termination(42, false), TerminationPlan::PosixProcessGroup { signal: "TERM", pid: 42 });
    }
}
