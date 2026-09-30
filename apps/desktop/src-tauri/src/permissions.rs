use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Permission {
    ProjectRead,
    ProjectWrite,
    ProcessExecute,
    ArtifactWrite,
    DeviceSerial,
    DeviceUsb,
    DeviceCapture,
    DeviceProgrammer,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProjectGrant {
    pub project_id: String,
    pub scopes: BTreeSet<Permission>,
    #[serde(default)]
    pub device_targets: BTreeMap<Permission, BTreeSet<String>>,
}

impl ProjectGrant {
    pub fn new(project_id: String, scopes: impl IntoIterator<Item = Permission>) -> Result<Self, String> {
        if project_id.trim().is_empty() || project_id.len() > 200 || project_id.chars().any(|character| character.is_control() || matches!(character, '/' | '\\')) {
            return Err("project identity is invalid".into());
        }
        Ok(Self { project_id, scopes: scopes.into_iter().collect(), device_targets: BTreeMap::new() })
    }

    pub fn require(&self, project_id: &str, permission: Permission) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        if !self.scopes.contains(&permission) { return Err(format!("permission {:?} was not granted", permission)); }
        Ok(())
    }

    pub fn grant(&mut self, project_id: &str, permission: Permission) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        self.scopes.insert(permission);
        Ok(())
    }

    pub fn revoke(&mut self, project_id: &str, permission: Permission) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        if matches!(permission, Permission::ProjectRead | Permission::ProjectWrite) { return Err("core project permissions cannot be revoked during an open session".into()); }
        self.scopes.remove(&permission);
        Ok(())
    }

    pub fn grant_target(&mut self, project_id: &str, permission: Permission, target: &str) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        validate_device_permission(&permission)?;
        validate_device_target(target)?;
        self.device_targets.entry(permission).or_default().insert(target.to_string());
        Ok(())
    }

    pub fn require_target(&self, project_id: &str, permission: Permission, target: &str) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        validate_device_permission(&permission)?;
        validate_device_target(target)?;
        if !self.device_targets.get(&permission).is_some_and(|targets| targets.contains(target)) { return Err(format!("explicit {:?} permission was not granted for target '{}'", permission, target)); }
        Ok(())
    }

    pub fn revoke_target(&mut self, project_id: &str, permission: Permission, target: &str) -> Result<(), String> {
        if self.project_id != project_id { return Err("project grant does not match the requested project".into()); }
        validate_device_permission(&permission)?;
        validate_device_target(target)?;
        if let Some(targets) = self.device_targets.get_mut(&permission) { targets.remove(target); }
        Ok(())
    }
}

fn validate_device_permission(permission: &Permission) -> Result<(), String> {
    if matches!(permission, Permission::DeviceSerial | Permission::DeviceUsb | Permission::DeviceCapture | Permission::DeviceProgrammer) { Ok(()) } else { Err("permission is not a device-target scope".into()) }
}

fn validate_device_target(target: &str) -> Result<(), String> {
    if target.trim().is_empty() || target.len() > 4096 || target.chars().any(char::is_control) { return Err("device target is invalid".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scopes_are_project_bound_and_not_implicitly_broadened() {
        let grant = ProjectGrant::new("demo".into(), [Permission::ProjectRead]).unwrap();
        assert!(grant.require("demo", Permission::ProjectRead).is_ok());
        assert!(grant.require("other", Permission::ProjectRead).is_err());
        assert!(grant.require("demo", Permission::ProcessExecute).is_err());
        assert!(ProjectGrant::new("../escape".into(), []).is_err());
        assert!(ProjectGrant::new("demo\nidentity".into(), []).is_err());
    }

    #[test]
    fn explicit_grant_adds_only_the_requested_scope() {
        let mut grant = ProjectGrant::new("demo".into(), [Permission::ProjectRead]).unwrap();
        grant.grant("demo", Permission::ProcessExecute).unwrap();
        assert!(grant.require("demo", Permission::ProcessExecute).is_ok());
        assert!(grant.require("demo", Permission::ArtifactWrite).is_err());
        grant.grant("demo", Permission::ArtifactWrite).unwrap();
        assert!(grant.require("demo", Permission::ArtifactWrite).is_ok());
        assert!(grant.require("other", Permission::ProcessExecute).is_err());
        assert!(grant.grant("other", Permission::DeviceUsb).is_err());
        grant.revoke("demo", Permission::ArtifactWrite).unwrap();
        assert!(grant.require("demo", Permission::ArtifactWrite).is_err());
        assert!(grant.revoke("demo", Permission::ProjectRead).is_err());
    }

    #[test]
    fn device_grants_are_exact_target_and_scope_bound() {
        let mut grant = ProjectGrant::new("demo".into(), [Permission::ProjectRead]).unwrap();
        grant.grant_target("demo", Permission::DeviceProgrammer, "COM4").unwrap();
        assert!(grant.require_target("demo", Permission::DeviceProgrammer, "COM4").is_ok());
        assert!(grant.require_target("demo", Permission::DeviceSerial, "COM4").is_err());
        assert!(grant.require_target("demo", Permission::DeviceProgrammer, "COM5").is_err());
        assert!(grant.require_target("other", Permission::DeviceProgrammer, "COM4").is_err());
        assert!(grant.grant_target("demo", Permission::ProcessExecute, "COM4").is_err());
        assert!(grant.grant_target("demo", Permission::DeviceProgrammer, "bad\nport").is_err());
        grant.revoke_target("demo", Permission::DeviceProgrammer, "COM4").unwrap();
        assert!(grant.require_target("demo", Permission::DeviceProgrammer, "COM4").is_err());
    }
}
