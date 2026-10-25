use super::{
    ContractError, DataKey, DeviceRegistered, LifecycleStatus, ReDevice, ReDeviceClient,
    RepairAttested, Role, MAX_DEVICE_ID, MIN_DEVICE_ID, TTL_THRESHOLD,
};
use soroban_sdk::testutils::{storage::Persistent as _, Address as _, Events as _, Ledger};
use soroban_sdk::{Address, BytesN, Env, Event, String, Vec};

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let registrar = Address::generate(&env);
    let contract_id = env.register(ReDevice, (admin.clone(),));
    (env, contract_id, admin, registrar)
}

fn register(
    client: &ReDeviceClient<'_>,
    env: &Env,
    registrar: &Address,
    request_byte: u8,
    serial_byte: u8,
    status: LifecycleStatus,
) -> u64 {
    client.register_device(
        registrar,
        &BytesN::from_array(env, &[request_byte; 32]),
        &BytesN::from_array(env, &[serial_byte; 32]),
        &String::from_str(env, "lenovo"),
        &String::from_str(env, "thinkpad-t14"),
        &String::from_str(env, "Lenovo"),
        &String::from_str(env, "ThinkPad T14"),
        &String::from_str(env, "***AB9"),
        &status,
    )
}

fn attest(
    client: &ReDeviceClient<'_>,
    env: &Env,
    repairer: &Address,
    request_byte: u8,
    device_id: u64,
    next_status: LifecycleStatus,
) -> u32 {
    client.attest_repair(
        repairer,
        &BytesN::from_array(env, &[request_byte; 32]),
        &device_id,
        &String::from_str(env, "Battery replacement"),
        &String::from_str(env, "Battery replaced and tested"),
        &next_status,
        &Some(96),
        &Some(1_700_000_000),
    )
}

#[test]
fn registration_is_wallet_signed_unique_and_publicly_readable() {
    let (env, contract_id, _admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_000_000);
    let id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    assert!((MIN_DEVICE_ID..=MAX_DEVICE_ID).contains(&id));
    assert_eq!(
        env.events().all(),
        [DeviceRegistered {
            device_id: id,
            registrar: registrar.clone(),
            serial_commitment: BytesN::from_array(&env, &[2; 32]),
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(env.auths().len(), 1);
    assert_eq!(env.auths()[0].0, registrar);
    let device = client.get_device(&id).unwrap();
    assert_eq!(device.commitment_version, 1);
    assert_eq!(device.registrar, registrar);
    assert_eq!(
        device.product_namespace,
        String::from_str(&env, "thinkpad-t14")
    );
    assert_eq!(device.registered_at, 1_700_000_000);
    assert_eq!(device.repair_count, 0);
    assert_eq!(
        client.get_device_by_commitment(&BytesN::from_array(&env, &[2; 32])),
        Some(id)
    );
    assert_eq!(client.get_device(&1), None);
}

#[test]
fn registrations_receive_distinct_five_digit_ids() {
    let (env, contract_id, _admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let mut ids = Vec::new(&env);
    for number in 1..=25 {
        let id = register(
            &client,
            &env,
            &registrar,
            number,
            number,
            LifecycleStatus::Used,
        );
        assert!((MIN_DEVICE_ID..=MAX_DEVICE_ID).contains(&id));
        assert!(!ids.contains(&id));
        ids.push_back(id);
    }
}

#[test]
fn ungranted_and_revoked_registrars_can_register() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let first_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    assert!((MIN_DEVICE_ID..=MAX_DEVICE_ID).contains(&first_id));

    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.revoke_role(&admin, &Role::Registrar, &registrar);
    assert_eq!(
        register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used),
        first_id
    );
    assert!(!client.has_role(&Role::Registrar, &registrar));
    let second_id = register(&client, &env, &registrar, 3, 4, LifecycleStatus::Used);
    assert!((MIN_DEVICE_ID..=MAX_DEVICE_ID).contains(&second_id));
    assert_ne!(first_id, second_id);
}

#[test]
fn only_admin_can_manage_roles_and_replacement_is_atomic() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let outsider = Address::generate(&env);
    let successor = Address::generate(&env);

    assert_eq!(
        client.try_grant_role(&outsider, &Role::Registrar, &registrar),
        Err(Ok(ContractError::Unauthorized))
    );
    client.grant_role(&admin, &Role::Registrar, &registrar);
    assert_eq!(
        client.try_grant_role(&admin, &Role::Registrar, &registrar),
        Err(Ok(ContractError::RoleAlreadyGranted))
    );
    client.replace_role(&admin, &Role::Registrar, &registrar, &successor);
    assert!(!client.has_role(&Role::Registrar, &registrar));
    assert!(client.has_role(&Role::Registrar, &successor));
    assert_eq!(
        client.try_replace_role(&admin, &Role::Registrar, &successor, &successor),
        Err(Ok(ContractError::InvalidInput))
    );
}

#[test]
fn duplicate_commitment_is_rejected_but_original_device_is_locatable() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    let id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);

    assert_eq!(
        client.try_register_device(
            &registrar,
            &BytesN::from_array(&env, &[3; 32]),
            &BytesN::from_array(&env, &[2; 32]),
            &String::from_str(&env, "lenovo"),
            &String::from_str(&env, "thinkpad-t14"),
            &String::from_str(&env, "Lenovo"),
            &String::from_str(&env, "ThinkPad T14"),
            &String::from_str(&env, "***AB9"),
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::DuplicateDevice))
    );
    assert_eq!(
        client.get_device_by_commitment(&BytesN::from_array(&env, &[2; 32])),
        Some(id)
    );
}

#[test]
fn replay_returns_the_same_device_and_changed_arguments_fail() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    let id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    assert_eq!(
        register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used),
        id
    );
    assert_eq!(
        client.get_registration_result(&registrar, &BytesN::from_array(&env, &[1; 32])),
        Some(id)
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &BytesN::from_array(&env, &[1; 32]),
            &BytesN::from_array(&env, &[3; 32]),
            &String::from_str(&env, "lenovo"),
            &String::from_str(&env, "thinkpad-t14"),
            &String::from_str(&env, "Lenovo"),
            &String::from_str(&env, "ThinkPad T14"),
            &String::from_str(&env, "***AB9"),
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::DuplicateRequest))
    );
    let second_id = register(&client, &env, &registrar, 2, 3, LifecycleStatus::Used);
    assert!((MIN_DEVICE_ID..=MAX_DEVICE_ID).contains(&second_id));
    assert_ne!(id, second_id);
}

#[test]
fn invalid_registration_fields_fail_closed() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    let request_id = BytesN::from_array(&env, &[1; 32]);
    let serial = BytesN::from_array(&env, &[2; 32]);
    let namespace = String::from_str(&env, "lenovo");
    let product_namespace = String::from_str(&env, "thinkpad-t14");
    let brand = String::from_str(&env, "Lenovo");
    let model = String::from_str(&env, "ThinkPad T14");
    let masked = String::from_str(&env, "***AB9");

    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &serial,
            &namespace,
            &String::from_str(&env, "ThinkPad T14"),
            &brand,
            &model,
            &masked,
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &serial,
            &String::from_str(&env, "LENOVO"),
            &product_namespace,
            &brand,
            &model,
            &masked,
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &serial,
            &namespace,
            &product_namespace,
            &String::from_str(&env, "   "),
            &model,
            &masked,
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &serial,
            &namespace,
            &product_namespace,
            &brand,
            &model,
            &String::from_str(&env, "AB9"),
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &serial,
            &namespace,
            &product_namespace,
            &brand,
            &model,
            &masked,
            &LifecycleStatus::PartsOnly,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &BytesN::from_array(&env, &[0; 32]),
            &serial,
            &namespace,
            &product_namespace,
            &brand,
            &model,
            &masked,
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_register_device(
            &registrar,
            &request_id,
            &BytesN::from_array(&env, &[0; 32]),
            &namespace,
            &product_namespace,
            &brand,
            &model,
            &masked,
            &LifecycleStatus::Used,
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(client.get_device(&1), None);
}

#[test]
fn repair_attestation_preserves_ledger_and_claimed_times() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.grant_role(&admin, &Role::Repairer, &repairer);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_001_000);

    let index = attest(
        &client,
        &env,
        &repairer,
        3,
        device_id,
        LifecycleStatus::Repaired,
    );
    assert_eq!(index, 0);
    assert_eq!(
        env.events().all(),
        [RepairAttested {
            device_id,
            index,
            repairer: repairer.clone(),
        }
        .to_xdr(&env, &contract_id)]
    );
    assert_eq!(env.auths().len(), 1);
    assert_eq!(env.auths()[0].0, repairer);
    let record = client.get_repairs(&device_id, &0, &20).get(0).unwrap();
    assert_eq!(record.previous_status, LifecycleStatus::Used);
    assert_eq!(record.next_status, LifecycleStatus::Repaired);
    assert_eq!(record.battery_health, Some(96));
    assert_eq!(record.claimed_service_time, Some(1_700_000_000));
    assert_eq!(record.attested_at, 1_700_001_000);
    assert_eq!(client.get_device(&device_id).unwrap().repair_count, 1);
    assert_eq!(client.get_repair_count(&device_id), 1);
}

#[test]
fn unauthorized_and_revoked_repairers_cannot_write() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    let request_id = BytesN::from_array(&env, &[3; 32]);
    let repair_type = String::from_str(&env, "Battery replacement");
    let notes = String::from_str(&env, "Battery replaced");

    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &device_id,
            &repair_type,
            &notes,
            &LifecycleStatus::Repaired,
            &Some(96),
            &None,
        ),
        Err(Ok(ContractError::Unauthorized))
    );
    client.grant_role(&admin, &Role::Repairer, &repairer);
    client.revoke_role(&admin, &Role::Repairer, &repairer);
    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &device_id,
            &repair_type,
            &notes,
            &LifecycleStatus::Repaired,
            &Some(96),
            &None,
        ),
        Err(Ok(ContractError::Unauthorized))
    );
    assert_eq!(client.get_repair_count(&device_id), 0);
}

#[test]
fn repair_replay_is_idempotent_and_different_arguments_fail() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.grant_role(&admin, &Role::Repairer, &repairer);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_001_000);

    assert_eq!(
        attest(
            &client,
            &env,
            &repairer,
            3,
            device_id,
            LifecycleStatus::Repaired
        ),
        0
    );
    assert_eq!(
        attest(
            &client,
            &env,
            &repairer,
            3,
            device_id,
            LifecycleStatus::Repaired
        ),
        0
    );
    assert_eq!(client.get_repair_count(&device_id), 1);
    assert_eq!(
        client.get_repair_result(&repairer, &BytesN::from_array(&env, &[3; 32])),
        Some(0)
    );
    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &BytesN::from_array(&env, &[3; 32]),
            &device_id,
            &String::from_str(&env, "Battery replacement"),
            &String::from_str(&env, "Changed details"),
            &LifecycleStatus::Repaired,
            &Some(96),
            &Some(1_700_000_000),
        ),
        Err(Ok(ContractError::DuplicateRequest))
    );
    assert_eq!(client.get_repair_count(&device_id), 1);
}

#[test]
fn invalid_repair_inputs_and_transitions_fail_closed() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.grant_role(&admin, &Role::Repairer, &repairer);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_001_000);
    let request_id = BytesN::from_array(&env, &[3; 32]);
    let repair_type = String::from_str(&env, "Battery replacement");
    let notes = String::from_str(&env, "Battery replaced");

    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &device_id,
            &repair_type,
            &notes,
            &LifecycleStatus::Used,
            &None,
            &None,
        ),
        Err(Ok(ContractError::InvalidTransition))
    );
    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &device_id,
            &repair_type,
            &notes,
            &LifecycleStatus::Repaired,
            &Some(101),
            &None,
        ),
        Err(Ok(ContractError::InvalidBatteryHealth))
    );
    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &device_id,
            &repair_type,
            &notes,
            &LifecycleStatus::Repaired,
            &None,
            &Some(1_700_100_000),
        ),
        Err(Ok(ContractError::InvalidInput))
    );
    assert_eq!(
        client.try_attest_repair(
            &repairer,
            &request_id,
            &99,
            &repair_type,
            &notes,
            &LifecycleStatus::Repaired,
            &None,
            &None,
        ),
        Err(Ok(ContractError::DeviceNotFound))
    );
    assert_eq!(client.get_repair_count(&device_id), 0);
}

#[test]
fn repair_pages_are_bounded_and_separate() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.grant_role(&admin, &Role::Repairer, &repairer);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_001_000);

    for number in 1..=21 {
        let status = if number % 2 == 1 {
            LifecycleStatus::Repaired
        } else {
            LifecycleStatus::Refurbished
        };
        assert_eq!(
            attest(&client, &env, &repairer, number, device_id, status),
            u32::from(number - 1)
        );
    }
    assert_eq!(client.get_repair_count(&device_id), 21);
    assert_eq!(client.get_repairs(&device_id, &0, &20).len(), 20);
    assert_eq!(client.get_repairs(&device_id, &20, &20).len(), 1);
    assert_eq!(client.get_repairs(&device_id, &21, &20).len(), 0);
    assert_eq!(
        client.try_get_repairs(&device_id, &0, &21),
        Err(Ok(ContractError::PageLimitExceeded))
    );
    assert_eq!(
        client.try_get_repairs(&device_id, &0, &0),
        Err(Ok(ContractError::PageLimitExceeded))
    );
}

#[test]
fn repair_refreshes_the_serial_index_ttl() {
    let (env, contract_id, admin, registrar) = setup();
    let client = ReDeviceClient::new(&env, &contract_id);
    let repairer = Address::generate(&env);
    client.grant_role(&admin, &Role::Registrar, &registrar);
    client.grant_role(&admin, &Role::Repairer, &repairer);
    let device_id = register(&client, &env, &registrar, 1, 2, LifecycleStatus::Used);
    let serial_key = DataKey::Serial(BytesN::from_array(&env, &[2; 32]));
    let initial_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&serial_key)
    });
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 1_700_001_000;
        ledger.sequence_number += initial_ttl - TTL_THRESHOLD + 1;
    });
    let reduced_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&serial_key)
    });
    assert!(reduced_ttl < initial_ttl);

    attest(
        &client,
        &env,
        &repairer,
        3,
        device_id,
        LifecycleStatus::Repaired,
    );
    let refreshed_ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&serial_key)
    });
    assert!(refreshed_ttl > reduced_ttl);
}
