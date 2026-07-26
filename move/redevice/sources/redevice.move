// Copyright (c) 2026 ReDevice contributors
// SPDX-License-Identifier: MIT

/// ReDevice records unique device passports and authorized repair attestations.
///
/// The registry prevents a normalized serial number from receiving more than
/// one passport. Only a SHA-256 hash is stored; the raw serial stays off-chain.
module redevice::redevice {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    #[test_only]
    use sui::test_scenario as ts;

    const PACKAGE_VERSION: u64 = 3;

    const LIFECYCLE_USED: u8 = 0;
    const LIFECYCLE_REPAIRED: u8 = 1;
    const LIFECYCLE_REFURBISHED: u8 = 2;
    const LIFECYCLE_PARTS_ONLY: u8 = 3;

    const VERIFICATION_MANUFACTURER: u8 = 1;
    const VERIFICATION_REPAIRER: u8 = 2;

    const E_INVALID_REPAIRER: u64 = 1;
    const E_REPAIRER_REVOKED: u64 = 2;
    const E_NOT_CAP_HOLDER: u64 = 3;
    const E_INVALID_BATTERY_HEALTH: u64 = 4;
    const E_INVALID_LIFECYCLE_STATUS: u64 = 5;
    const E_ALREADY_REVOKED: u64 = 6;
    const E_DEVICE_ALREADY_REGISTERED: u64 = 7;
    const E_INVALID_SERIAL_HASH: u64 = 8;
    const E_INVALID_REGISTRAR: u64 = 9;
    const E_REGISTRAR_REVOKED: u64 = 10;

    /// Created once when the package is published and owned by the publisher.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared index that enforces one passport per serial hash.
    public struct DeviceRegistry has key {
        id: UID,
        serial_to_passport: Table<address, ID>,
        registered_count: u64,
    }

    /// A shared authorization object for one device registrar wallet.
    public struct RegistrarCap has key {
        id: UID,
        registrar: address,
        display_name: String,
        active: bool,
    }

    /// A shared authorization object for one repairer wallet.
    public struct RepairerCap has key {
        id: UID,
        repairer: address,
        display_name: String,
        active: bool,
    }

    /// One immutable entry within a device passport's append-only history.
    public struct RepairRecord has store, drop {
        repair_type: String,
        notes: String,
        previous_status: u8,
        new_status: u8,
        battery_health: u8,
        evidence_blob_id: String,
        repairer: address,
        serviced_at_ms: u64,
        attested_at_ms: u64,
    }

    /// Public on-chain passport for one physical device.
    public struct DevicePassport has key {
        id: UID,
        manufacturer: address,
        device_name: String,
        brand: String,
        model: String,
        masked_serial: String,
        serial_hash: address,
        verification_level: u8,
        lifecycle_status: u8,
        history_started_at_ms: u64,
        repairs: vector<RepairRecord>,
    }

    public struct RepairerGranted has copy, drop {
        cap_id: ID,
        repairer: address,
    }

    public struct RepairerRevoked has copy, drop {
        cap_id: ID,
        repairer: address,
    }

    public struct RegistrarGranted has copy, drop {
        cap_id: ID,
        registrar: address,
    }

    public struct RegistrarRevoked has copy, drop {
        cap_id: ID,
        registrar: address,
    }

    public struct PassportCreated has copy, drop {
        passport_id: ID,
        manufacturer: address,
        serial_hash: address,
    }

    public struct RepairAdded has copy, drop {
        passport_id: ID,
        repairer: address,
        record_index: u64,
    }

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        let registry = DeviceRegistry {
            id: object::new(ctx),
            serial_to_passport: table::new(ctx),
            registered_count: 0,
        };

        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(registry);
    }

    /// Grants an address permission to create device passports.
    public entry fun grant_registrar(
        _admin: &AdminCap,
        registrar: address,
        display_name: String,
        ctx: &mut TxContext,
    ) {
        assert!(registrar != @0x0, E_INVALID_REGISTRAR);

        let cap = RegistrarCap {
            id: object::new(ctx),
            registrar,
            display_name,
            active: true,
        };
        let cap_id = object::id(&cap);

        event::emit(RegistrarGranted { cap_id, registrar });
        transfer::share_object(cap);
    }

    /// Revokes a registrar's permission without deleting its audit trail.
    public entry fun revoke_registrar(
        _admin: &AdminCap,
        cap: &mut RegistrarCap,
    ) {
        assert!(cap.active, E_ALREADY_REVOKED);

        cap.active = false;
        event::emit(RegistrarRevoked {
            cap_id: object::id(cap),
            registrar: cap.registrar,
        });
    }

    /// Grants an address permission to attest repairs.
    public entry fun grant_repairer(
        _admin: &AdminCap,
        repairer: address,
        display_name: String,
        ctx: &mut TxContext,
    ) {
        assert!(repairer != @0x0, E_INVALID_REPAIRER);

        let cap = RepairerCap {
            id: object::new(ctx),
            repairer,
            display_name,
            active: true,
        };
        let cap_id = object::id(&cap);

        event::emit(RepairerGranted { cap_id, repairer });
        transfer::share_object(cap);
    }

    /// Revokes a repairer's permission without deleting its audit trail.
    public entry fun revoke_repairer(
        _admin: &AdminCap,
        cap: &mut RepairerCap,
    ) {
        assert!(cap.active, E_ALREADY_REVOKED);

        cap.active = false;
        event::emit(RepairerRevoked {
            cap_id: object::id(cap),
            repairer: cap.repairer,
        });
    }

    /// Creates one passport for a serial hash and records it atomically.
    public entry fun create_passport(
        registrar_cap: &RegistrarCap,
        registry: &mut DeviceRegistry,
        device_name: String,
        brand: String,
        model: String,
        masked_serial: String,
        serial_hash: address,
        lifecycle_status: u8,
        history_started_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        assert!(registrar_cap.active, E_REGISTRAR_REVOKED);
        assert!(sender == registrar_cap.registrar, E_NOT_CAP_HOLDER);
        assert!(is_valid_lifecycle_status(lifecycle_status), E_INVALID_LIFECYCLE_STATUS);
        assert!(serial_hash != @0x0, E_INVALID_SERIAL_HASH);
        assert!(
            !table::contains(&registry.serial_to_passport, serial_hash),
            E_DEVICE_ALREADY_REGISTERED,
        );

        let manufacturer = sender;
        let passport = DevicePassport {
            id: object::new(ctx),
            manufacturer,
            device_name,
            brand,
            model,
            masked_serial,
            serial_hash,
            verification_level: VERIFICATION_MANUFACTURER,
            lifecycle_status,
            history_started_at_ms,
            repairs: vector[],
        };
        let passport_id = object::id(&passport);

        table::add(
            &mut registry.serial_to_passport,
            serial_hash,
            passport_id,
        );
        registry.registered_count = registry.registered_count + 1;

        event::emit(PassportCreated {
            passport_id,
            manufacturer,
            serial_hash,
        });
        transfer::share_object(passport);
    }

    /// Appends one repair attestation and updates the current lifecycle state.
    public entry fun add_repair_record(
        cap: &RepairerCap,
        passport: &mut DevicePassport,
        repair_type: String,
        notes: String,
        new_status: u8,
        battery_health: u8,
        evidence_blob_id: String,
        serviced_at_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        assert!(cap.active, E_REPAIRER_REVOKED);
        assert!(sender == cap.repairer, E_NOT_CAP_HOLDER);
        assert!(battery_health <= 100, E_INVALID_BATTERY_HEALTH);
        assert!(is_valid_lifecycle_status(new_status), E_INVALID_LIFECYCLE_STATUS);

        let record_index = vector::length(&passport.repairs);
        let record = RepairRecord {
            repair_type,
            notes,
            previous_status: passport.lifecycle_status,
            new_status,
            battery_health,
            evidence_blob_id,
            repairer: sender,
            serviced_at_ms,
            attested_at_ms: clock::timestamp_ms(clock),
        };

        vector::push_back(&mut passport.repairs, record);
        passport.lifecycle_status = new_status;
        passport.verification_level = VERIFICATION_REPAIRER;

        event::emit(RepairAdded {
            passport_id: object::id(passport),
            repairer: sender,
            record_index,
        });
    }

    public fun package_version(): u64 {
        PACKAGE_VERSION
    }

    public fun repairer_address(cap: &RepairerCap): address {
        cap.repairer
    }

    public fun registrar_address(cap: &RegistrarCap): address {
        cap.registrar
    }

    public fun registrar_is_active(cap: &RegistrarCap): bool {
        cap.active
    }

    public fun repairer_is_active(cap: &RepairerCap): bool {
        cap.active
    }

    public fun registry_count(registry: &DeviceRegistry): u64 {
        registry.registered_count
    }

    public fun is_serial_registered(
        registry: &DeviceRegistry,
        serial_hash: address,
    ): bool {
        table::contains(&registry.serial_to_passport, serial_hash)
    }

    public fun passport_manufacturer(passport: &DevicePassport): address {
        passport.manufacturer
    }

    public fun passport_serial_hash(passport: &DevicePassport): address {
        passport.serial_hash
    }

    public fun passport_lifecycle_status(passport: &DevicePassport): u8 {
        passport.lifecycle_status
    }

    public fun passport_verification_level(passport: &DevicePassport): u8 {
        passport.verification_level
    }

    public fun passport_repair_count(passport: &DevicePassport): u64 {
        vector::length(&passport.repairs)
    }

    public fun repair_record_repairer(record: &RepairRecord): address {
        record.repairer
    }

    fun is_valid_lifecycle_status(status: u8): bool {
        status == LIFECYCLE_USED ||
            status == LIFECYCLE_REPAIRED ||
            status == LIFECYCLE_REFURBISHED ||
            status == LIFECYCLE_PARTS_ONLY
    }

    #[test_only]
    const ADMIN: address = @0xA;

    #[test_only]
    const AUTHORIZED_REGISTRAR: address = @0xB;

    #[test_only]
    const AUTHORIZED_REPAIRER: address = @0xC;

    #[test_only]
    const UNAUTHORIZED_USER: address = @0xD;

    #[test_only]
    const DEMO_SERIAL_HASH: address = @0x123;

    #[test]
    fun package_version_is_three() {
        assert!(package_version() == 3, 0);
    }

    #[test]
    fun manufacturer_can_create_unique_passport() {
        let mut scenario = ts::begin(ADMIN);
        init(scenario.ctx());

        scenario.next_tx(ADMIN);
        let admin_cap: AdminCap = scenario.take_from_sender();
        grant_registrar(
            &admin_cap,
            AUTHORIZED_REGISTRAR,
            std::string::utf8(b"Lisbon Device Issuer"),
            scenario.ctx(),
        );
        scenario.return_to_sender(admin_cap);

        scenario.next_tx(AUTHORIZED_REGISTRAR);
        let registrar_cap: RegistrarCap = scenario.take_shared();
        let mut registry: DeviceRegistry = scenario.take_shared();

        create_demo_passport(&registrar_cap, &mut registry, scenario.ctx());
        assert!(registry_count(&registry) == 1, 0);
        assert!(is_serial_registered(&registry, DEMO_SERIAL_HASH), 0);

        ts::return_shared(registrar_cap);
        ts::return_shared(registry);

        scenario.next_tx(AUTHORIZED_REGISTRAR);
        let passport: DevicePassport = scenario.take_shared();

        assert!(passport_manufacturer(&passport) == AUTHORIZED_REGISTRAR, 0);
        assert!(passport_serial_hash(&passport) == DEMO_SERIAL_HASH, 0);
        assert!(passport_lifecycle_status(&passport) == LIFECYCLE_USED, 0);
        assert!(passport_verification_level(&passport) == VERIFICATION_MANUFACTURER, 0);
        assert!(passport_repair_count(&passport) == 0, 0);

        ts::return_shared(passport);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = E_DEVICE_ALREADY_REGISTERED)]
    fun duplicate_serial_is_rejected() {
        let mut scenario = ts::begin(ADMIN);
        init(scenario.ctx());

        scenario.next_tx(ADMIN);
        let admin_cap: AdminCap = scenario.take_from_sender();
        grant_registrar(
            &admin_cap,
            AUTHORIZED_REGISTRAR,
            std::string::utf8(b"Lisbon Device Issuer"),
            scenario.ctx(),
        );
        scenario.return_to_sender(admin_cap);

        scenario.next_tx(AUTHORIZED_REGISTRAR);
        let registrar_cap: RegistrarCap = scenario.take_shared();
        let mut registry: DeviceRegistry = scenario.take_shared();

        create_demo_passport(&registrar_cap, &mut registry, scenario.ctx());
        create_demo_passport(&registrar_cap, &mut registry, scenario.ctx());

        abort 0
    }

    #[test]
    #[expected_failure(abort_code = E_NOT_CAP_HOLDER)]
    fun unauthorized_registrar_is_rejected() {
        let mut scenario = ts::begin(ADMIN);
        init(scenario.ctx());

        scenario.next_tx(ADMIN);
        let admin_cap: AdminCap = scenario.take_from_sender();
        grant_registrar(
            &admin_cap,
            AUTHORIZED_REGISTRAR,
            std::string::utf8(b"Lisbon Device Issuer"),
            scenario.ctx(),
        );
        scenario.return_to_sender(admin_cap);

        scenario.next_tx(UNAUTHORIZED_USER);
        let registrar_cap: RegistrarCap = scenario.take_shared();
        let mut registry: DeviceRegistry = scenario.take_shared();

        create_demo_passport(&registrar_cap, &mut registry, scenario.ctx());

        abort 0
    }

    #[test]
    fun authorized_repairer_can_add_record() {
        let mut scenario = setup_demo();

        scenario.next_tx(AUTHORIZED_REPAIRER);
        let repairer_cap: RepairerCap = scenario.take_shared();
        let mut passport: DevicePassport = scenario.take_shared();
        let clock: Clock = scenario.take_shared();

        add_demo_repair(&repairer_cap, &mut passport, &clock, scenario.ctx());

        assert!(passport_repair_count(&passport) == 1, 0);
        assert!(passport_lifecycle_status(&passport) == LIFECYCLE_REFURBISHED, 0);
        assert!(passport_verification_level(&passport) == VERIFICATION_REPAIRER, 0);

        ts::return_shared(repairer_cap);
        ts::return_shared(passport);
        ts::return_shared(clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = E_NOT_CAP_HOLDER)]
    fun unauthorized_wallet_is_rejected() {
        let mut scenario = setup_demo();

        scenario.next_tx(UNAUTHORIZED_USER);
        let repairer_cap: RepairerCap = scenario.take_shared();
        let mut passport: DevicePassport = scenario.take_shared();
        let clock: Clock = scenario.take_shared();

        add_demo_repair(&repairer_cap, &mut passport, &clock, scenario.ctx());

        abort 0
    }

    #[test]
    #[expected_failure(abort_code = E_REPAIRER_REVOKED)]
    fun revoked_repairer_is_rejected() {
        let mut scenario = setup_demo();

        scenario.next_tx(ADMIN);
        let admin_cap: AdminCap = scenario.take_from_sender();
        let mut repairer_cap: RepairerCap = scenario.take_shared();
        revoke_repairer(&admin_cap, &mut repairer_cap);
        scenario.return_to_sender(admin_cap);
        ts::return_shared(repairer_cap);

        scenario.next_tx(AUTHORIZED_REPAIRER);
        let revoked_cap: RepairerCap = scenario.take_shared();
        let mut passport: DevicePassport = scenario.take_shared();
        let clock: Clock = scenario.take_shared();

        add_demo_repair(&revoked_cap, &mut passport, &clock, scenario.ctx());

        abort 0
    }

    #[test_only]
    fun setup_demo(): ts::Scenario {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(scenario.ctx());
        clock::share_for_testing(clock);
        init(scenario.ctx());

        scenario.next_tx(ADMIN);
        let admin_cap: AdminCap = scenario.take_from_sender();
        let mut registry: DeviceRegistry = scenario.take_shared();

        grant_repairer(
            &admin_cap,
            AUTHORIZED_REPAIRER,
            std::string::utf8(b"Lisbon Repair Center"),
            scenario.ctx(),
        );
        grant_registrar(
            &admin_cap,
            AUTHORIZED_REGISTRAR,
            std::string::utf8(b"Lisbon Device Issuer"),
            scenario.ctx(),
        );

        scenario.return_to_sender(admin_cap);
        ts::return_shared(registry);

        scenario.next_tx(AUTHORIZED_REGISTRAR);
        let registrar_cap: RegistrarCap = scenario.take_shared();
        let mut registry: DeviceRegistry = scenario.take_shared();
        create_demo_passport(&registrar_cap, &mut registry, scenario.ctx());
        ts::return_shared(registrar_cap);
        ts::return_shared(registry);
        scenario
    }

    #[test_only]
    fun create_demo_passport(
        registrar_cap: &RegistrarCap,
        registry: &mut DeviceRegistry,
        ctx: &mut TxContext,
    ) {
        create_passport(
            registrar_cap,
            registry,
            std::string::utf8(b"Azat's MacBook"),
            std::string::utf8(b"Apple"),
            std::string::utf8(b"MacBook Pro 14"),
            std::string::utf8(b"C02*****92"),
            DEMO_SERIAL_HASH,
            LIFECYCLE_USED,
            1_753_401_600_000,
            ctx,
        );
    }

    #[test_only]
    fun add_demo_repair(
        cap: &RepairerCap,
        passport: &mut DevicePassport,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        add_repair_record(
            cap,
            passport,
            std::string::utf8(b"Battery replacement"),
            std::string::utf8(b"Battery replaced and diagnostics passed."),
            LIFECYCLE_REFURBISHED,
            96,
            std::string::utf8(b"walrus-demo-blob-id"),
            1_753_488_000_000,
            clock,
            ctx,
        );
    }
}
