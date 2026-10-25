#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    String, Vec,
};

const TTL_THRESHOLD: u32 = 17_280;
const TTL_TARGET: u32 = 518_400;
const MIN_DEVICE_ID: u64 = 10_000;
const MAX_DEVICE_ID: u64 = 99_999;
const ID_DRAW_ATTEMPTS: u32 = 64;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Registrar,
    Repairer,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LifecycleStatus {
    Used,
    Repaired,
    Refurbished,
    PartsOnly,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Admin,
    Role(Role, Address),
    Serial(BytesN<32>),
    Device(u64),
    Repair(u64, u32),
    RegistrationRequest(Address, BytesN<32>),
    RepairRequest(Address, BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Device {
    pub id: u64,
    pub commitment_version: u32,
    pub registrar: Address,
    pub serial_commitment: BytesN<32>,
    pub manufacturer_namespace: String,
    pub product_namespace: String,
    pub brand: String,
    pub model: String,
    pub masked_serial: String,
    pub status: LifecycleStatus,
    pub registered_at: u64,
    pub repair_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrationFields {
    serial_commitment: BytesN<32>,
    manufacturer_namespace: String,
    product_namespace: String,
    brand: String,
    model: String,
    masked_serial: String,
    status: LifecycleStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrationRequest {
    fields: RegistrationFields,
    device_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepairRecord {
    pub device_id: u64,
    pub index: u32,
    pub repairer: Address,
    pub repair_type: String,
    pub notes: String,
    pub previous_status: LifecycleStatus,
    pub next_status: LifecycleStatus,
    pub battery_health: Option<u32>,
    pub claimed_service_time: Option<u64>,
    pub attested_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct RepairFields {
    device_id: u64,
    repair_type: String,
    notes: String,
    next_status: LifecycleStatus,
    battery_health: Option<u32>,
    claimed_service_time: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct RepairRequest {
    fields: RepairFields,
    index: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleChanged {
    #[topic]
    pub account: Address,
    pub role: Role,
    pub active: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeviceRegistered {
    #[topic]
    pub device_id: u64,
    pub registrar: Address,
    pub serial_commitment: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepairAttested {
    #[topic]
    pub device_id: u64,
    #[topic]
    pub index: u32,
    pub repairer: Address,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    Unauthorized = 1,
    RoleAlreadyGranted = 2,
    RoleNotGranted = 3,
    DuplicateDevice = 4,
    InvalidInput = 5,
    DuplicateRequest = 6,
    IdAllocationFailed = 7,
    DeviceNotFound = 8,
    InvalidTransition = 9,
    InvalidBatteryHealth = 10,
    PageLimitExceeded = 11,
    RepairCountOverflow = 12,
}

#[contract]
pub struct ReDevice;

#[contractimpl]
impl ReDevice {
    pub fn __constructor(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        touch_instance(&env);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn has_role(env: Env, role: Role, account: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Role(role, account))
    }

    pub fn grant_role(
        env: Env,
        admin: Address,
        role: Role,
        account: Address,
    ) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;
        let key = DataKey::Role(role.clone(), account.clone());
        if env.storage().persistent().has(&key) {
            return Err(ContractError::RoleAlreadyGranted);
        }
        env.storage().persistent().set(&key, &true);
        touch_persistent(&env, &key);
        touch_instance(&env);
        RoleChanged {
            account,
            role,
            active: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn revoke_role(
        env: Env,
        admin: Address,
        role: Role,
        account: Address,
    ) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;
        let key = DataKey::Role(role.clone(), account.clone());
        if !env.storage().persistent().has(&key) {
            return Err(ContractError::RoleNotGranted);
        }
        env.storage().persistent().remove(&key);
        touch_instance(&env);
        RoleChanged {
            account,
            role,
            active: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn replace_role(
        env: Env,
        admin: Address,
        role: Role,
        old_account: Address,
        new_account: Address,
    ) -> Result<(), ContractError> {
        require_admin(&env, &admin)?;
        if old_account == new_account {
            return Err(ContractError::InvalidInput);
        }
        let old_key = DataKey::Role(role.clone(), old_account.clone());
        let new_key = DataKey::Role(role.clone(), new_account.clone());
        if !env.storage().persistent().has(&old_key) {
            return Err(ContractError::RoleNotGranted);
        }
        if env.storage().persistent().has(&new_key) {
            return Err(ContractError::RoleAlreadyGranted);
        }
        env.storage().persistent().remove(&old_key);
        env.storage().persistent().set(&new_key, &true);
        touch_persistent(&env, &new_key);
        touch_instance(&env);
        RoleChanged {
            account: old_account,
            role: role.clone(),
            active: false,
        }
        .publish(&env);
        RoleChanged {
            account: new_account,
            role,
            active: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn register_device(
        env: Env,
        registrar: Address,
        request_id: BytesN<32>,
        serial_commitment: BytesN<32>,
        manufacturer_namespace: String,
        product_namespace: String,
        brand: String,
        model: String,
        masked_serial: String,
        status: LifecycleStatus,
    ) -> Result<u64, ContractError> {
        registrar.require_auth();
        let fields = RegistrationFields {
            serial_commitment: serial_commitment.clone(),
            manufacturer_namespace: manufacturer_namespace.clone(),
            product_namespace: product_namespace.clone(),
            brand: brand.clone(),
            model: model.clone(),
            masked_serial: masked_serial.clone(),
            status: status.clone(),
        };
        let request_key = DataKey::RegistrationRequest(registrar.clone(), request_id.clone());
        if let Some(previous) = env
            .storage()
            .persistent()
            .get::<_, RegistrationRequest>(&request_key)
        {
            if previous.fields != fields {
                return Err(ContractError::DuplicateRequest);
            }
            return Ok(previous.device_id);
        }
        if request_id == BytesN::from_array(&env, &[0u8; 32])
            || serial_commitment == BytesN::from_array(&env, &[0u8; 32])
            || !valid_namespace(&manufacturer_namespace)
            || !valid_namespace(&product_namespace)
            || !valid_text(&brand, 64)
            || !valid_text(&model, 64)
            || masked_serial.len() < 4
            || !valid_text(&masked_serial, 32)
            || !matches!(status, LifecycleStatus::Used | LifecycleStatus::Refurbished)
        {
            return Err(ContractError::InvalidInput);
        }
        let serial_key = DataKey::Serial(serial_commitment.clone());
        if env.storage().persistent().has(&serial_key) {
            return Err(ContractError::DuplicateDevice);
        }
        let mut id = None;
        for _ in 0..ID_DRAW_ATTEMPTS {
            let candidate = env.prng().gen_range(MIN_DEVICE_ID..=MAX_DEVICE_ID);
            if !env.storage().persistent().has(&DataKey::Device(candidate)) {
                id = Some(candidate);
                break;
            }
        }
        let id = id.ok_or(ContractError::IdAllocationFailed)?;
        let device = Device {
            id,
            commitment_version: 1,
            registrar: registrar.clone(),
            serial_commitment,
            manufacturer_namespace,
            product_namespace,
            brand,
            model,
            masked_serial,
            status,
            registered_at: env.ledger().timestamp(),
            repair_count: 0,
        };
        let device_key = DataKey::Device(id);
        env.storage().persistent().set(&serial_key, &id);
        env.storage().persistent().set(&device_key, &device);
        env.storage().persistent().set(
            &request_key,
            &RegistrationRequest {
                fields,
                device_id: id,
            },
        );
        touch_persistent(&env, &serial_key);
        touch_persistent(&env, &device_key);
        touch_persistent(&env, &request_key);
        touch_instance(&env);
        DeviceRegistered {
            device_id: id,
            registrar,
            serial_commitment: device.serial_commitment,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn get_device(env: Env, device_id: u64) -> Option<Device> {
        env.storage().persistent().get(&DataKey::Device(device_id))
    }

    pub fn get_device_by_commitment(env: Env, commitment: BytesN<32>) -> Option<u64> {
        env.storage().persistent().get(&DataKey::Serial(commitment))
    }

    pub fn get_registration_result(
        env: Env,
        actor: Address,
        request_id: BytesN<32>,
    ) -> Option<u64> {
        env.storage()
            .persistent()
            .get::<_, RegistrationRequest>(&DataKey::RegistrationRequest(actor, request_id))
            .map(|request| request.device_id)
    }

    pub fn attest_repair(
        env: Env,
        repairer: Address,
        request_id: BytesN<32>,
        device_id: u64,
        repair_type: String,
        notes: String,
        next_status: LifecycleStatus,
        battery_health: Option<u32>,
        claimed_service_time: Option<u64>,
    ) -> Result<u32, ContractError> {
        repairer.require_auth();
        let role_key = DataKey::Role(Role::Repairer, repairer.clone());
        if !env.storage().persistent().has(&role_key) {
            return Err(ContractError::Unauthorized);
        }
        let fields = RepairFields {
            device_id,
            repair_type: repair_type.clone(),
            notes: notes.clone(),
            next_status: next_status.clone(),
            battery_health,
            claimed_service_time,
        };
        let request_key = DataKey::RepairRequest(repairer.clone(), request_id.clone());
        if let Some(previous) = env
            .storage()
            .persistent()
            .get::<_, RepairRequest>(&request_key)
        {
            if previous.fields != fields {
                return Err(ContractError::DuplicateRequest);
            }
            return Ok(previous.index);
        }
        if request_id == BytesN::from_array(&env, &[0u8; 32])
            || !valid_text(&repair_type, 64)
            || !valid_text(&notes, 500)
            || claimed_service_time
                .is_some_and(|time| time > env.ledger().timestamp().saturating_add(86_400))
        {
            return Err(ContractError::InvalidInput);
        }
        if battery_health.is_some_and(|health| health > 100) {
            return Err(ContractError::InvalidBatteryHealth);
        }
        let device_key = DataKey::Device(device_id);
        let mut device: Device = env
            .storage()
            .persistent()
            .get(&device_key)
            .ok_or(ContractError::DeviceNotFound)?;
        if !valid_transition(&device.status, &next_status) {
            return Err(ContractError::InvalidTransition);
        }
        let index = device.repair_count;
        device.repair_count = index
            .checked_add(1)
            .ok_or(ContractError::RepairCountOverflow)?;
        let record = RepairRecord {
            device_id,
            index,
            repairer: repairer.clone(),
            repair_type,
            notes,
            previous_status: device.status.clone(),
            next_status: next_status.clone(),
            battery_health,
            claimed_service_time,
            attested_at: env.ledger().timestamp(),
        };
        device.status = next_status;
        let repair_key = DataKey::Repair(device_id, index);
        let serial_key = DataKey::Serial(device.serial_commitment.clone());
        env.storage().persistent().set(&repair_key, &record);
        env.storage().persistent().set(&device_key, &device);
        env.storage()
            .persistent()
            .set(&request_key, &RepairRequest { fields, index });
        touch_persistent(&env, &role_key);
        touch_persistent(&env, &serial_key);
        touch_persistent(&env, &repair_key);
        touch_persistent(&env, &device_key);
        touch_persistent(&env, &request_key);
        touch_instance(&env);
        RepairAttested {
            device_id,
            index,
            repairer,
        }
        .publish(&env);
        Ok(index)
    }

    pub fn get_repair_count(env: Env, device_id: u64) -> Result<u32, ContractError> {
        let device: Device = env
            .storage()
            .persistent()
            .get(&DataKey::Device(device_id))
            .ok_or(ContractError::DeviceNotFound)?;
        Ok(device.repair_count)
    }

    pub fn get_repairs(
        env: Env,
        device_id: u64,
        start: u32,
        limit: u32,
    ) -> Result<Vec<RepairRecord>, ContractError> {
        if limit == 0 || limit > 20 {
            return Err(ContractError::PageLimitExceeded);
        }
        let device: Device = env
            .storage()
            .persistent()
            .get(&DataKey::Device(device_id))
            .ok_or(ContractError::DeviceNotFound)?;
        let mut repairs = Vec::new(&env);
        let end = start.saturating_add(limit).min(device.repair_count);
        for index in start..end {
            let record: RepairRecord = env
                .storage()
                .persistent()
                .get(&DataKey::Repair(device_id, index))
                .ok_or(ContractError::DeviceNotFound)?;
            repairs.push_back(record);
        }
        Ok(repairs)
    }

    pub fn get_repair_result(env: Env, actor: Address, request_id: BytesN<32>) -> Option<u32> {
        env.storage()
            .persistent()
            .get::<_, RepairRequest>(&DataKey::RepairRequest(actor, request_id))
            .map(|request| request.index)
    }
}

fn require_admin(env: &Env, actor: &Address) -> Result<(), ContractError> {
    actor.require_auth();
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    if *actor != admin {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

fn valid_namespace(value: &String) -> bool {
    let length = value.len();
    if length == 0 || length > 64 {
        return false;
    }
    let bytes = value.to_bytes();
    let mut previous_was_separator = true;
    for index in 0..length {
        let byte = bytes.get(index).unwrap();
        let letter_or_digit = byte.is_ascii_lowercase() || byte.is_ascii_digit();
        if letter_or_digit {
            previous_was_separator = false;
        } else if (byte == b'.' || byte == b'_' || byte == b'-') && !previous_was_separator {
            previous_was_separator = true;
        } else {
            return false;
        }
    }
    !previous_was_separator
}

fn valid_text(value: &String, maximum: u32) -> bool {
    let length = value.len();
    if length == 0 || length > maximum {
        return false;
    }
    let bytes = value.to_bytes();
    let mut has_content = false;
    for index in 0..length {
        let byte = bytes.get(index).unwrap();
        if byte < 0x20 || byte == 0x7f {
            return false;
        }
        if byte != b' ' {
            has_content = true;
        }
    }
    has_content
}

fn valid_transition(previous: &LifecycleStatus, next: &LifecycleStatus) -> bool {
    matches!(
        (previous, next),
        (LifecycleStatus::Used, LifecycleStatus::Repaired)
            | (LifecycleStatus::Used, LifecycleStatus::Refurbished)
            | (LifecycleStatus::Used, LifecycleStatus::PartsOnly)
            | (LifecycleStatus::Repaired, LifecycleStatus::Refurbished)
            | (LifecycleStatus::Repaired, LifecycleStatus::PartsOnly)
            | (LifecycleStatus::Refurbished, LifecycleStatus::Repaired)
            | (LifecycleStatus::Refurbished, LifecycleStatus::PartsOnly)
    )
}

fn touch_instance(env: &Env) {
    env.deployer()
        .extend_ttl(env.current_contract_address(), TTL_THRESHOLD, TTL_TARGET);
}

fn touch_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_TARGET);
}

#[cfg(test)]
mod test;
